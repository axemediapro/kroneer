const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const { generateLiftTrackingToken } = require('./installationController');

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
      console.error('Gabim në ngarkimin e tiketave të servisit:', err);
      req.flash('error', 'Nuk u ngarkuan kërkesat për servis.');
      res.redirect('/paneli');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      if (!id || isNaN(id)) {
        req.flash('error', 'ID e pavlefshme e tiketës.');
        return res.redirect('/servisi');
      }

      const ticket = await prisma.serviceTicket.findUnique({
        where: { id },
        include: {
          customer: true,
          elevator: true,
          technician: true
        }
      });

      if (!ticket) {
        req.flash('error', 'Kërkesa e servisit nuk u gjet.');
        return res.redirect('/servisi');
      }

      // Gjej të dhëna plotësuese për liftin (Instalimi, Kontrata e Mirëmbajtjes, Pasaporta)
      let installation = null;
      let trackingUrl = null;
      if (ticket.serialNumber) {
        installation = await prisma.installation.findFirst({
          where: { serialNumber: ticket.serialNumber },
          include: { project: true }
        });
        if (installation) {
          const token = generateLiftTrackingToken(installation.id, installation.serialNumber);
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          trackingUrl = `${baseUrl}/track/lift/${token}`;
        }
      }

      const [maintenanceContract, technicians, company, activityLogs] = await Promise.all([
        ticket.serialNumber ? prisma.maintenanceContract.findFirst({
          where: { serialNumber: ticket.serialNumber }
        }) : null,
        prisma.user.findMany({
          where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        }),
        prisma.companySettings.findFirst(),
        prisma.activity.findMany({
          where: {
            entityType: 'Servis',
            entityId: ticket.id
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      const statuses = ['Hapur', 'Caktuar', 'Në proces', 'Në pritje', 'Zgjidhur', 'Mbyllur'];
      const priorities = ['I ulët', 'Normal', 'I lartë', 'Kritik'];

      res.render('servisi/detajet', {
        pageTitle: `Tiketa e Servisit: ${ticket.number} - KRONEER`,
        ticket,
        installation,
        trackingUrl,
        maintenanceContract,
        technicians,
        statuses,
        priorities,
        company,
        activityLogs
      });
    } catch (err) {
      console.error('Gabim në shfaqjen e detajeve të servisit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë hapjes së tiketës.');
      res.redirect('/servisi');
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const ticket = await prisma.serviceTicket.findUnique({
        where: { id },
        include: {
          customer: true,
          elevator: true,
          technician: true
        }
      });

      if (!ticket) {
        req.flash('error', 'Kërkesa e servisit nuk u gjet.');
        return res.redirect('/servisi');
      }

      const company = await prisma.companySettings.findFirst();

      res.render('servisi/print', {
        layout: 'layouts/print',
        pageTitle: `Fletëdalje Servisi ${ticket.number} - KRONEER`,
        ticket,
        company
      });
    } catch (err) {
      console.error('Gabim në printimin e fletëdaljes së servisit:', err);
      res.redirect(`/servisi/${req.params.id}`);
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
      res.redirect(`/servisi/${ticket.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e tiketës së servisit:', err);
      req.flash('error', 'Nuk u regjistrua kërkesa e servisit.');
      res.redirect('/servisi/krijo');
    }
  }

  static async postUpdateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status, technicianId, priority, resolutionNotes } = req.body;

      const isResolved = status === 'Zgjidhur' || status === 'Mbyllur';

      const updated = await prisma.serviceTicket.update({
        where: { id },
        data: {
          status,
          priority: priority || undefined,
          technicianId: technicianId ? parseInt(technicianId) : undefined,
          resolutionNotes: resolutionNotes !== undefined ? resolutionNotes.trim() : undefined,
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
      res.redirect(req.headers.referer || `/servisi/${id}`);
    } catch (err) {
      console.error('Gabim në përditësimin e tiketës së servisit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë përditësimit të tiketës.');
      res.redirect(`/servisi/${req.params.id}`);
    }
  }
}

module.exports = ServiceController;
