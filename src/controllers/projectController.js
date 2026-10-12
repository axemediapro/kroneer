const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const { ownedProjectsWhere, canAccessProject } = require('../services/projectScope');

class ProjectController {
  static async getIndex(req, res) {
    try {
      const { stage, search, managerId, line } = req.query;
      const user = req.session.user;
      const isField = user && (user.role === 'MENAXHER_PROJEKTI' || user.role === 'TEKNIK');
      const lineOfBusiness = (line && line !== 'te-gjitha') ? line : '';

      const where = {};
      if (lineOfBusiness) {
        where.OR = [
          { lineOfBusiness: lineOfBusiness },
          { name: { contains: lineOfBusiness, mode: 'insensitive' } }
        ];
      }

      if (user && (user.role === 'MENAXHER_PROJEKTI' || user.role === 'TEKNIK')) {
        Object.assign(where, ownedProjectsWhere(user));
      } else if (managerId && managerId !== 'te-gjitha') {
        where.projectManagerId = parseInt(managerId);
      }

      if (stage) where.stage = stage;
      if (search) {
        const s = { contains: search, mode: 'insensitive' };
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: [{ number: s }, { name: s }, { customer: { companyName: s } }] }
          ];
          delete where.OR;
        } else {
          where.OR = [{ number: s }, { name: s }, { customer: { companyName: s } }];
        }
      }

      const [projects, managers] = await Promise.all([
        prisma.project.findMany({
          where,
          include: {
            customer: true,
            projectManager: true,
            teamMembers: {
              include: { employee: true }
            },
            interventions: true,
            installations: true,
            contract: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        })
      ]);

      const stages = [
        'Planifikim',
        'Inxhinieri',
        'Prodhim',
        'Transport',
        'Instalim',
        'Testim',
        'Inspektim',
        'Dorëzim',
        'Përfunduar'
      ];

      res.render('projektet/index', {
        pageTitle: 'Projektet & Ekipet - KRONEER',
        projects,
        managers,
        stages,
        filters: {
          stage: stage || '',
          search: search || '',
          line: lineOfBusiness,
          managerId: managerId || (user && (user.role === 'MENAXHER_PROJEKTI' || user.role === 'TEKNIK') && !req.query.all ? String(user.id) : 'te-gjitha')
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e projekteve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen projektet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const [customers, managers, employees, nextNumber] = await Promise.all([
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        NumberService.getNextNumber('project')
      ]);

      const defaultLine = req.query.line === 'Modernizim' ? 'Modernizim' : (req.query.line === 'Servis' ? 'Servis' : 'Instalim');

      res.render('projektet/krijo', {
        pageTitle: defaultLine === 'Modernizim' ? 'Hap Projekt Modernizimi - KRONEER' : 'Hap Projekt të Ri - KRONEER',
        customers,
        managers,
        employees,
        nextNumber,
        defaultLine
      });
    } catch (err) {
      console.error(err);
      res.redirect('/projektet');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        name, customerId, elevatorCount, floorsCount, value, stage, lineOfBusiness,
        startDate, targetCompletionDate, notes, projectManagerId, teamMembers
      } = req.body;
      const allowedLines = ['Furnizim', 'Instalim', 'Servis', 'Modernizim'];
      const businessLine = allowedLines.includes(lineOfBusiness) ? lineOfBusiness : 'Instalim';

      const number = await NumberService.getNextNumber('project');
      const pmId = projectManagerId ? parseInt(projectManagerId) : (req.session.user?.role === 'MENAXHER_PROJEKTI' ? req.session.user.id : null);

      const project = await prisma.project.create({
        data: {
          number,
          name: name.trim(),
          lineOfBusiness: businessLine,
          customerId: customerId ? parseInt(customerId) : null,
          projectManagerId: pmId,
          elevatorCount: parseInt(elevatorCount) || 1,
          floorsCount: parseInt(floorsCount) || 5,
          value: parseFloat(value) || 0,
          stage: stage || 'Planifikim',
          startDate: startDate ? new Date(startDate) : new Date(),
          targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
          notes: notes ? notes.trim() : null
        }
      });

      // Shtimi i punëtorëve fillestarë në ekip
      if (teamMembers) {
        const memberIds = Array.isArray(teamMembers) ? teamMembers : [teamMembers];
        for (const empId of memberIds) {
          if (empId) {
            await prisma.projectMember.create({
              data: {
                projectId: project.id,
                employeeId: parseInt(empId),
                roleInProject: 'Monter / Teknik'
              }
            }).catch(() => {});
          }
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Projekt',
        entityId: project.id,
        description: `U hap projekti i ri "${project.name}" (${project.number}) me menaxher të caktuar.`
      });

      req.flash('success', `Projekti ${project.number} u hap me sukses.`);
      res.redirect(`/projektet/${project.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e projektit:', err);
      req.flash('error', 'Nuk u krijua projekti.');
      res.redirect('/projektet/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [project, allEmployees, managers] = await Promise.all([
        prisma.project.findUnique({
          where: { id },
          include: {
            customer: true,
            contract: true,
            projectManager: true,
            teamMembers: {
              include: { employee: true },
              orderBy: { id: 'asc' }
            },
            interventions: {
              include: {
                teamWorkers: { include: { employee: true } },
                projectManager: true
              },
              orderBy: { date: 'desc' }
            },
            installations: {
              include: { checklistItems: true, technician: true }
            },
            handovers: true,
            payments: true,
            documents: true,
            employeeTransactions: {
              include: { employee: true },
              orderBy: { date: 'desc' }
            }
          }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        })
      ]);

      if (!project) {
        req.flash('error', 'Projekti nuk u gjet.');
        return res.redirect('/projektet');
      }

      if (!canAccessProject(req.session.user, project)) {
        req.flash('error', 'Nuk keni autorizim për këtë projekt. Mund të shihni vetëm projektet tuaja.');
        return res.redirect('/projektet');
      }

      // Filtro punëtorët që nuk janë ende në ekipin e këtij projekti
      const assignedEmployeeIds = project.teamMembers.map(tm => tm.employeeId);
      const availableEmployees = allEmployees.filter(e => !assignedEmployeeIds.includes(e.id));

      const stages = [
        'Planifikim',
        'Inxhinieri',
        'Prodhim',
        'Transport',
        'Instalim',
        'Testim',
        'Inspektim',
        'Dorëzim',
        'Përfunduar'
      ];

      res.render('projektet/detajet', {
        pageTitle: `${project.name} (${project.number}) - KRONEER`,
        project,
        availableEmployees,
        managers,
        stages
      });
    } catch (err) {
      console.error(err);
      res.redirect('/projektet');
    }
  }

  static async postUpdateStage(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { stage } = req.body;

      const project = await prisma.project.update({
        where: { id },
        data: {
          stage,
          completedDate: stage === 'Përfunduar' ? new Date() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Projekt',
        entityId: id,
        description: `Faza e projektit "${project.name}" u përditësua në "${stage}".`
      });

      req.flash('success', `Faza e projektit u ndryshua në "${stage}".`);
      res.redirect(`/projektet/${id}`);
    } catch (err) {
      console.error(err);
      res.redirect('/projektet');
    }
  }

  // Shto anëtar në ekipin e projektit
  static async postAddTeamMember(req, res) {
    try {
      const projectId = parseInt(req.params.id);
      const { employeeId, roleInProject, notes } = req.body;

      if (!employeeId) {
        req.flash('error', 'Ju lutem përzgjidhni punëtorin.');
        return res.redirect(`/projektet/${projectId}`);
      }

      await prisma.projectMember.create({
        data: {
          projectId,
          employeeId: parseInt(employeeId),
          roleInProject: roleInProject || 'Monter / Teknik',
          notes: notes ? notes.trim() : null
        }
      });

      const emp = await prisma.employee.findUnique({ where: { id: parseInt(employeeId) } });
      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Projekt',
        entityId: projectId,
        description: `${emp?.firstName} ${emp?.lastName} u caktua në ekipin e projektit si "${roleInProject || 'Monter'}".`
      });

      req.flash('success', `Punëtori ${emp?.firstName} ${emp?.lastName} u shtua në ekipin e projektit!`);
      res.redirect(`/projektet/${projectId}`);
    } catch (err) {
      console.error('Gabim në shtimin e anëtarit të ekipit:', err);
      req.flash('error', 'Punëtori tashmë është në këtë ekip ose ndodhi një gabim.');
      res.redirect(`/projektet/${req.params.id}`);
    }
  }

  // Heq anëtar nga ekipi i projektit
  static async postRemoveTeamMember(req, res) {
    try {
      const projectId = parseInt(req.params.id);
      const memberId = parseInt(req.params.memberId);

      await prisma.projectMember.delete({
        where: { id: memberId }
      });

      req.flash('success', 'Anëtari u hoq nga ekipi i projektit.');
      res.redirect(`/projektet/${projectId}`);
    } catch (err) {
      console.error('Gabim në heqjen e anëtarit të ekipit:', err);
      req.flash('error', 'Nuk u arrit të hiqet anëtari.');
      res.redirect(`/projektet/${req.params.id}`);
    }
  }

  // Ndrysho Menaxherin e Projektit
  static async postUpdateProjectManager(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { projectManagerId } = req.body;

      const project = await prisma.project.update({
        where: { id },
        data: {
          projectManagerId: projectManagerId ? parseInt(projectManagerId) : null
        },
        include: { projectManager: true }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Projekt',
        entityId: id,
        description: `Menaxheri i projektit "${project.name}" u përcaktua: ${project.projectManager?.fullName || 'Pa menaxher'}.`
      });

      req.flash('success', 'Menaxheri i projektit u përditësua me sukses.');
      res.redirect(`/projektet/${id}`);
    } catch (err) {
      console.error(err);
      res.redirect(`/projektet/${req.params.id}`);
    }
  }
}

module.exports = ProjectController;
