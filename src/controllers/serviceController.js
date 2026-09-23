const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class ServiceController {
  static async getIndex(req, res) {
    try {
      const { priority, status, search } = req.query;
      const where = {};

      if (priority) where.priority = priority;
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { serialNumber: { contains: search } },
          { problemDescription: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const tickets = await prisma.serviceTicket.findMany({
        where,
        include: {
          customer: true,
          elevator: true,
          technician: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const priorities = ['I ulët', 'Normal', 'I lartë', 'Kritik'];
      const statuses = ['Hapur', 'Caktuar', 'Në proces', 'Në pritje', 'Zgjidhur', 'Mbyllur'];

      res.render('servisi/index', {
        pageTitle: 'Kërkesat për Servis - KRONEER',
        tickets,
        priorities,
        statuses,
        filters: { priority: priority || '', status: status || '', search: search || '' }
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u ngarkuan kërkesat për servis.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const elevators = await prisma.elevator.findMany({ where: { status: 'Aktiv' } });
      const technicians = await prisma.user.findMany({
        where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } }
      });
      const nextNumber = await NumberService.getNextNumber('service');

      res.render('servisi/krijo', {
        pageTitle: 'Krijo Kërkesë të Re për Servis - KRONEER',
        customers,
        elevators,
        technicians,
        nextNumber
      });
    } catch (err) {
      console.error(err);
      res.redirect('/servisi');
    }
  }

  static async postCreate(req, res) {
    try {
      const { customerId, elevatorId, serialNumber, problemDescription, priority, technicianId, scheduledDate } = req.body;
      const number = await NumberService.getNextNumber('service');

      const ticket = await prisma.serviceTicket.create({
        data: {
          number,
          customerId: parseInt(customerId),
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          serialNumber: serialNumber ? serialNumber.trim() : null,
          problemDescription: problemDescription.trim(),
          priority: priority || 'Normal',
          technicianId: technicianId ? parseInt(technicianId) : null,
          status: technicianId ? 'Caktuar' : 'Hapur',
          reportedDate: new Date(),
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Servis',
        entityId: ticket.id,
        description: `U hap tiketa e re e servisit ${ticket.number} me prioritet [${ticket.priority}].`
      });

      req.flash('success', `Kërkesa e servisit ${ticket.number} u regjistrua me sukses.`);
      res.redirect('/servisi');
    } catch (err) {
      console.error('Gabim në krijimin e tiketës së servisit:', err);
      req.flash('error', 'Nuk u regjistrua kërkesa e servisit.');
      res.redirect('/servisi/krijo');
    }
  }

  static async postUpdateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status, technicianId, resolutionNotes } = req.body;

      const isResolved = status === 'Zgjidhur' || status === 'Mbyllur';

      const updated = await prisma.serviceTicket.update({
        where: { id },
        data: {
          status,
          technicianId: technicianId ? parseInt(technicianId) : undefined,
          resolutionNotes: resolutionNotes ? resolutionNotes.trim() : undefined,
          resolvedDate: isResolved ? new Date() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Servis',
        entityId: id,
        description: `Tiketa e servisit ${updated.number} u përditësua në statusin "${status}".`
      });

      req.flash('success', `Tiketa ${updated.number} u përditësua me sukses.`);
      res.redirect('/servisi');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Ndodhi një gabim gjatë përditësimit të tiketës.');
      res.redirect('/servisi');
    }
  }
}

module.exports = ServiceController;
