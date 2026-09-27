const crypto = require('crypto');
const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

const TRACKING_SECRET = process.env.SESSION_SECRET || 'kroneer_tracking_secret_2026';

function generateTrackingToken(interventionId) {
  const data = `int_${interventionId}_kroneer_live`;
  const hash = crypto.createHmac('sha256', TRACKING_SECRET).update(data).digest('hex').substring(0, 16);
  return Buffer.from(`${interventionId}-${hash}`).toString('base64url');
}

function verifyTrackingToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [idStr, hash] = decoded.split('-');
    const id = parseInt(idStr);
    if (!id || isNaN(id)) return null;
    const expectedHash = crypto.createHmac('sha256', TRACKING_SECRET).update(`int_${id}_kroneer_live`).digest('hex').substring(0, 16);
    if (hash === expectedHash) return id;
    return null;
  } catch (e) {
    return null;
  }
}

class InterventionController {
  // 1. Lista e Intervenimeve në Terren
  static async getIndex(req, res) {
    try {
      const { statusi, tipi, projectManagerId, puntoriId, search } = req.query;
      const user = req.session.user;

      const where = {};

      if (statusi && statusi !== 'te-gjitha') {
        where.status = statusi;
      }
      if (tipi && tipi !== 'te-gjitha') {
        where.type = tipi;
      }
      if (user && user.role === 'MENAXHER_PROJEKTI') {
        where.OR = [
          { projectManagerId: user.id },
          { project: { projectManagerId: user.id } }
        ];
      } else if (user && user.role === 'TEKNIK') {
        const currentEmp = await prisma.employee.findFirst({ where: { userId: user.id } });
        where.teamWorkers = {
          some: {
            employeeId: currentEmp ? currentEmp.id : -1
          }
        };
      } else if (projectManagerId && projectManagerId !== 'te-gjitha') {
        where.projectManagerId = parseInt(projectManagerId);
      }

      if (puntoriId && puntoriId !== 'te-gjitha') {
        where.teamWorkers = {
          some: {
            employeeId: parseInt(puntoriId)
          }
        };
      }

      if (search && search.trim()) {
        const q = search.trim();
        const searchConditions = [
          { number: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { location: { contains: q, mode: 'insensitive' } },
          { elevatorSerialNumber: { contains: q, mode: 'insensitive' } },
          { project: { name: { contains: q, mode: 'insensitive' } } }
        ];
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            { OR: searchConditions }
          ];
          delete where.OR;
        } else {
          where.OR = searchConditions;
        }
      }

      const [interventions, managers, employees, projects] = await Promise.all([
        prisma.intervention.findMany({
          where,
          include: {
            project: { include: { customer: true } },
            projectManager: true,
            teamWorkers: {
              include: { employee: true }
            }
          },
          orderBy: { date: 'desc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        prisma.project.findMany({
          where: { stage: { not: 'Përfunduar' } },
          orderBy: { name: 'asc' }
        })
      ]);

      const types = [
        'Montim & Instalim',
        'Mirëmbajtje Periodike',
        'Servis Urgjent',
        'Riparim & Pjesë',
        'Testim & Kalibrim',
        'Inspektim Teknik'
      ];

      const statuses = ['Planifikuar', 'Në Proces', 'Përfunduar', 'Anuluar'];

      // Gjenero trackingToken për çdo intervenim
      interventions.forEach(int => {
        int.trackingToken = generateTrackingToken(int.id);
        int.trackingUrl = `/track/${int.trackingToken}`;
      });

      res.render('intervenimet/index', {
        pageTitle: 'Intervenimet në Terren & Ekipet - KRONEER',
        interventions,
        managers,
        employees,
        projects,
        types,
        statuses,
        filters: {
          statusi: statusi || 'te-gjitha',
          tipi: tipi || 'te-gjitha',
          projectManagerId: projectManagerId || (user && user.role === 'MENAXHER_PROJEKTI' && !req.query.all ? String(user.id) : 'te-gjitha'),
          puntoriId: puntoriId || 'te-gjitha',
          search: search || ''
        }
      });
    } catch (err) {
      console.error('Gabim në listimin e intervenimeve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen intervenimet.');
      res.redirect('/paneli');
    }
  }

  // 2. Faqja e Regjistrimit të Intervenimit të Ri
  static async getCreate(req, res) {
    try {
      const { projectId } = req.query;

      const [projects, managers, employees, nextNumber] = await Promise.all([
        prisma.project.findMany({
          include: { customer: true, teamMembers: { include: { employee: true } } },
          orderBy: { name: 'asc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        NumberService.getNextNumber('intervention')
      ]);

      res.render('intervenimet/krijo', {
        pageTitle: 'Regjistro Intervenim të Ri - KRONEER',
        projects,
        managers,
        employees,
        nextNumber,
        selectedProjectId: projectId ? parseInt(projectId) : null
      });
    } catch (err) {
      console.error('Gabim në hapjen e formës së intervenimit:', err);
      req.flash('error', 'Ndodhi një gabim.');
      res.redirect('/intervenimet');
    }
  }

  // 3. Ruajtja e Intervenimit me Ekipin e Monterëve
  static async postCreate(req, res) {
    try {
      const {
        title, type, priority, projectId, location, elevatorModel, elevatorSerialNumber,
        date, startTime, endTime, durationHours, projectManagerId, teamLeadName,
        status, workDescription, partsReplaced, clientSignee, notes,
        workers // Array ose objekt i punëtorëve të përzgjedhur me role
      } = req.body;

      if (!title) {
        req.flash('error', 'Ju lutem plotësoni titullin e intervenimit.');
        return res.redirect('/intervenimet/krijo');
      }

      const number = await NumberService.getNextNumber('intervention');
      const pmId = projectManagerId ? parseInt(projectManagerId) : (req.session.user?.role === 'MENAXHER_PROJEKTI' ? req.session.user.id : null);

      const intervention = await prisma.intervention.create({
        data: {
          number,
          title: title.trim(),
          type: type || 'Montim & Instalim',
          priority: priority || 'Normal',
          projectId: projectId ? parseInt(projectId) : null,
          location: location ? location.trim() : null,
          elevatorModel: elevatorModel ? elevatorModel.trim() : null,
          elevatorSerialNumber: elevatorSerialNumber ? elevatorSerialNumber.trim() : null,
          date: date ? new Date(date) : new Date(),
          startTime: startTime || '08:30',
          endTime: endTime || null,
          durationHours: parseFloat(durationHours) || 0,
          projectManagerId: pmId,
          teamLeadName: teamLeadName ? teamLeadName.trim() : null,
          status: status || 'Në Proces',
          workDescription: workDescription ? workDescription.trim() : null,
          partsReplaced: partsReplaced ? partsReplaced.trim() : null,
          clientSignee: clientSignee ? clientSignee.trim() : null,
          notes: notes ? notes.trim() : null
        }
      });

      // Shtimi i punëtorëve në ekipin e intervenimit
      if (workers) {
        const workerList = Array.isArray(workers) ? workers : [workers];
        for (const w of workerList) {
          if (w) {
            const empId = typeof w === 'object' ? parseInt(w.id) : parseInt(w);
            const role = typeof w === 'object' && w.role ? w.role : 'Monter';
            const cashGiven = typeof w === 'object' && w.cashGiven ? parseFloat(w.cashGiven) : 0;
            const bonusGiven = typeof w === 'object' && w.bonusGiven ? parseFloat(w.bonusGiven) : 0;

            if (empId) {
              await prisma.interventionWorker.create({
                data: {
                  interventionId: intervention.id,
                  employeeId: empId,
                  roleInTeam: role,
                  cashGiven,
                  bonusGiven
                }
              }).catch(() => {});

              // Nëse u dha Kesh direkt për këtë intervenim, regjistroje te EmployeeTransaction
              if (cashGiven > 0) {
                const cashNum = await NumberService.getNextNumber('employee_cash');
                await prisma.employeeTransaction.create({
                  data: {
                    number: cashNum,
                    employeeId: empId,
                    type: 'KESH_AVANC',
                    category: 'Mëditje Terreni',
                    amount: cashGiven,
                    title: `Mëditje kesh për intervenimin ${intervention.number}`,
                    projectId: intervention.projectId,
                    interventionId: intervention.id,
                    recordedBy: req.session.user?.fullName || 'Menaxher Projekti'
                  }
                }).catch(() => {});
              }

              // Nëse u dha Bonus direkt për këtë intervenim, regjistroje te EmployeeTransaction
              if (bonusGiven > 0) {
                const bonNum = await NumberService.getNextNumber('employee_bonus');
                await prisma.employeeTransaction.create({
                  data: {
                    number: bonNum,
                    employeeId: empId,
                    type: 'BONUS',
                    category: 'Bonus Intervenimi / Montimi',
                    amount: bonusGiven,
                    title: `Bonus për punimet në ${intervention.number}`,
                    projectId: intervention.projectId,
                    interventionId: intervention.id,
                    recordedBy: req.session.user?.fullName || 'Menaxher Projekti'
                  }
                }).catch(() => {});
              }
            }
          }
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Intervenim',
        entityId: intervention.id,
        description: `U regjistrua intervenimi ${intervention.number} ("${intervention.title}") me ekipin përkatës.`
      });

      req.flash('success', `Intervenimi ${intervention.number} u regjistrua me sukses me ekipin pjesëmarrës!`);
      res.redirect(`/intervenimet/${intervention.id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e intervenimit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së intervenimit.');
      res.redirect('/intervenimet/krijo');
    }
  }

  // 4. Detajet e Intervenimit (Ekipi i Saktë & Raporti)
  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [intervention, allEmployees] = await Promise.all([
        prisma.intervention.findUnique({
          where: { id },
          include: {
            project: { include: { customer: true } },
            projectManager: true,
            teamWorkers: {
              include: { employee: true },
              orderBy: { id: 'asc' }
            },
            transactions: {
              include: { employee: true },
              orderBy: { id: 'asc' }
            }
          }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        })
      ]);

      if (!intervention) {
        req.flash('error', 'Intervenimi nuk u gjet.');
        return res.redirect('/intervenimet');
      }

      // Shto linkun e koduar të tracking-ut publik
      intervention.trackingToken = generateTrackingToken(intervention.id);
      intervention.trackingUrl = `/track/${intervention.trackingToken}`;

      const assignedWorkerIds = intervention.teamWorkers.map(tw => tw.employeeId);
      const availableEmployees = allEmployees.filter(e => !assignedWorkerIds.includes(e.id));

      res.render('intervenimet/detajet', {
        pageTitle: `${intervention.title} (${intervention.number}) - KRONEER`,
        intervention,
        availableEmployees
      });
    } catch (err) {
      console.error('Gabim në hapjen e detajeve të intervenimit:', err);
      req.flash('error', 'Nuk u arrit të hapet intervenimi.');
      res.redirect('/intervenimet');
    }
  }

  // 5. Ndrysho Statusin e Intervenimit
  static async postUpdateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      const intervention = await prisma.intervention.update({
        where: { id },
        data: { status }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Intervenim',
        entityId: id,
        description: `Statusi i intervenimit ${intervention.number} u ndryshua në "${status}".`
      });

      req.flash('success', `Statusi u përditësua në "${status}".`);
      res.redirect(`/intervenimet/${id}`);
    } catch (err) {
      console.error(err);
      res.redirect(`/intervenimet/${req.params.id}`);
    }
  }

  // 6. Shto Monter / Punëtor në Ekipin e Intervenimit
  static async postAddWorker(req, res) {
    try {
      const interventionId = parseInt(req.params.id);
      const { employeeId, roleInTeam, cashGiven, bonusGiven, notes } = req.body;

      const empId = parseInt(employeeId);
      if (!empId) {
        req.flash('error', 'Ju lutem zgjidhni punëtorin.');
        return res.redirect(`/intervenimet/${interventionId}`);
      }

      const cash = parseFloat(cashGiven) || 0;
      const bonus = parseFloat(bonusGiven) || 0;

      await prisma.interventionWorker.create({
        data: {
          interventionId,
          employeeId: empId,
          roleInTeam: roleInTeam || 'Monter',
          cashGiven: cash,
          bonusGiven: bonus,
          notes: notes ? notes.trim() : null
        }
      });

      const intervention = await prisma.intervention.findUnique({ where: { id: interventionId } });

      if (cash > 0) {
        const cashNum = await NumberService.getNextNumber('employee_cash');
        await prisma.employeeTransaction.create({
          data: {
            number: cashNum,
            employeeId: empId,
            type: 'KESH_AVANC',
            category: 'Mëditje Terreni',
            amount: cash,
            title: `Mëditje kesh për intervenimin ${intervention?.number}`,
            projectId: intervention?.projectId,
            interventionId,
            recordedBy: req.session.user?.fullName || 'Menaxher Projekti'
          }
        }).catch(() => {});
      }

      if (bonus > 0) {
        const bonNum = await NumberService.getNextNumber('employee_bonus');
        await prisma.employeeTransaction.create({
          data: {
            number: bonNum,
            employeeId: empId,
            type: 'BONUS',
            category: 'Bonus Intervenimi',
            amount: bonus,
            title: `Bonus për intervenimin ${intervention?.number}`,
            projectId: intervention?.projectId,
            interventionId,
            recordedBy: req.session.user?.fullName || 'Menaxher Projekti'
          }
        }).catch(() => {});
      }

      req.flash('success', 'Punëtori u shtua në ekipin e këtij intervenimi.');
      res.redirect(`/intervenimet/${interventionId}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Punëtori është tashmë në ekip ose ndodhi një gabim.');
      res.redirect(`/intervenimet/${req.params.id}`);
    }
  }

  // 7. Heq Monter nga Ekipi i Intervenimit
  static async postRemoveWorker(req, res) {
    try {
      const interventionId = parseInt(req.params.id);
      const workerId = parseInt(req.params.workerId);

      await prisma.interventionWorker.delete({
        where: { id: workerId }
      });

      req.flash('success', 'Punëtori u hoq nga ky intervenim.');
      res.redirect(`/intervenimet/${interventionId}`);
    } catch (err) {
      console.error(err);
      res.redirect(`/intervenimet/${req.params.id}`);
    }
  }

  // 8. Raport Zyrtar i Intervenimit për Printim (PDF)
  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [intervention, company] = await Promise.all([
        prisma.intervention.findUnique({
          where: { id },
          include: {
            project: { include: { customer: true } },
            projectManager: true,
            teamWorkers: {
              include: { employee: true },
              orderBy: { id: 'asc' }
            }
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!intervention) {
        req.flash('error', 'Intervenimi nuk u gjet.');
        return res.redirect('/intervenimet');
      }

      res.render('intervenimet/print', {
        pageTitle: `Raport_Intervenimi_${intervention.number}`,
        intervention,
        company: company || {},
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim gjatë përgatitjes së raportit për printim.');
    }
  }

  // 9. Faqja Publike e Ndjekjes Live (Encrypted Tracking)
  static async getPublicTracking(req, res) {
    try {
      const { token } = req.params;
      const interventionId = verifyTrackingToken(token);

      if (!interventionId) {
        return res.status(404).render('partials/error', {
          pageTitle: 'Link i Pavlefshëm - KRONEER',
          message: 'Linku i ndjekjes së intervenimit është i pasaktë ose ka skaduar.',
          layout: 'layouts/public'
        });
      }

      const [intervention, company] = await Promise.all([
        prisma.intervention.findUnique({
          where: { id: interventionId },
          include: {
            project: { include: { customer: true } },
            projectManager: true,
            teamWorkers: {
              include: { employee: true },
              orderBy: { id: 'asc' }
            }
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!intervention) {
        return res.status(404).render('partials/error', {
          pageTitle: 'Intervenimi nuk u gjet - KRONEER',
          message: 'Intervenimi i kërkuar nuk ekziston.',
          layout: 'layouts/public'
        });
      }

      intervention.trackingToken = token;
      intervention.trackingUrl = `/track/${token}`;

      res.render('public/track-intervention', {
        pageTitle: `Ndjekja Live: ${intervention.title} (${intervention.number}) - KRONEER`,
        intervention,
        company: company || { companyName: 'KRONEER', phone: '+383 (0) 38 500 600', email: 'info@kroneer-lifts.com' },
        layout: 'layouts/public'
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e ndjekjes live të intervenimit:', err);
      res.status(500).render('partials/error', {
        pageTitle: 'Gabim Sistemi - KRONEER',
        message: 'Ndodhi një gabim gjatë ngarkimit të statusit të intervenimit.',
        layout: 'layouts/public'
      });
    }
  }
}

module.exports = InterventionController;
