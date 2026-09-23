const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class ProjectController {
  static async getIndex(req, res) {
    try {
      const { stage, search } = req.query;
      const where = {};

      if (stage) where.stage = stage;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { name: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const projects = await prisma.project.findMany({
        where,
        include: {
          customer: true,
          installations: true,
          contract: true
        },
        orderBy: { createdAt: 'desc' }
      });

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
        pageTitle: 'Projektet - KRONEER',
        projects,
        stages,
        filters: { stage: stage || '', search: search || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e projekteve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen projektet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const nextNumber = await NumberService.getNextNumber('project');

      res.render('projektet/krijo', {
        pageTitle: 'Hap Projekt të Ri - KRONEER',
        customers,
        nextNumber
      });
    } catch (err) {
      console.error(err);
      res.redirect('/projektet');
    }
  }

  static async postCreate(req, res) {
    try {
      const { name, customerId, elevatorCount, floorsCount, value, stage, startDate, targetCompletionDate, notes } = req.body;
      const number = await NumberService.getNextNumber('project');

      const project = await prisma.project.create({
        data: {
          number,
          name: name.trim(),
          customerId: parseInt(customerId),
          elevatorCount: parseInt(elevatorCount) || 1,
          floorsCount: parseInt(floorsCount) || 5,
          value: parseFloat(value) || 0,
          stage: stage || 'Planifikim',
          startDate: startDate ? new Date(startDate) : new Date(),
          targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
          notes: notes ? notes.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Projekt',
        entityId: project.id,
        description: `U hap projekti i ri "${project.name}" (${project.number}).`
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
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          customer: true,
          contract: true,
          installations: {
            include: { checklistItems: true, technician: true }
          },
          handovers: true,
          payments: true,
          documents: true
        }
      });

      if (!project) {
        req.flash('error', 'Projekti nuk u gjet.');
        return res.redirect('/projektet');
      }

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
}

module.exports = ProjectController;
