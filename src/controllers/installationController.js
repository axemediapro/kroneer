const prisma = require('../config/prisma');
const QRCode = require('qrcode');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

const DEFAULT_CHECKLIST = [
  { key: 'chk_shaft', title: 'Kontrolli i boshtit (dimensionet, vertikaliteti)' },
  { key: 'chk_pit', title: 'Kontrolli i gropës (thellësia, hidroizolimi, shkallët)' },
  { key: 'chk_rails', title: 'Montimi i shinave udhëzuese të kabinës dhe kundërpeshës' },
  { key: 'chk_machine', title: 'Montimi i motorit gearless dhe bazamentit mbajtës' },
  { key: 'chk_controller', title: 'Montimi i panelit kontrollor dhe inverterit VVVF' },
  { key: 'chk_doors', title: 'Montimi i dyerve të kateve dhe mekanizmave të mbylljes' },
  { key: 'chk_cabin', title: 'Montimi i skeletit të kabinës, dyshemesë dhe mureve' },
  { key: 'chk_electrical', title: 'Lidhja e instalimeve elektrike dhe kabllos fleksibile' },
  { key: 'chk_safety', title: 'Montimi dhe kalibrimi i sistemit të sigurisë dhe frenimit' },
  { key: 'chk_phone', title: 'Testimi i telefonit emergjent GSM dhe butonit të alarmit' },
  { key: 'chk_testing', title: 'Testimi statik dhe dinamik me ngarkesë të plotë' },
  { key: 'chk_inspection', title: 'Inspektimi teknik zyrtar dhe certifikimi' },
  { key: 'chk_handover', title: 'Dorëzimi teknik dhe trajnimi i stafit/klientit' }
];

class InstallationController {
  static async getIndex(req, res) {
    try {
      const { status, search } = req.query;
      const user = req.session.user;
      const where = {};

      if (user && user.role === 'MENAXHER_PROJEKTI') {
        where.project = {
          OR: [
            { projectManagerId: user.id },
            { teamMembers: { some: { employee: { userId: user.id } } } }
          ]
        };
      } else if (user && user.role === 'TEKNIK') {
        where.OR = [
          { technicianId: user.id },
          { project: { teamMembers: { some: { employee: { userId: user.id } } } } }
        ];
      }

      if (status) where.status = status;
      if (search) {
        const s = { contains: search, mode: 'insensitive' };
        const searchConditions = [
          { serialNumber: s },
          { elevatorModel: s },
          { teamLead: s },
          { project: { name: s } }
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

      const installations = await prisma.installation.findMany({
        where,
        include: {
          project: { include: { customer: true } },
          technician: true,
          checklistItems: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const statuses = ['Në Pritje', 'Në Instalim', 'Në Testim', 'Përfunduar'];

      // Gjenerimi i QR Code për çdo numër serik (skanueshëm nga ekipi në terren)
      for (const inst of installations) {
        inst.qrCodeDataUrl = await QRCode.toDataURL(inst.serialNumber, {
          width: 220,
          margin: 1.5,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
      }

      res.render('instalimet/index', {
        pageTitle: 'Qendra e Instalimeve - KRONEER',
        installations,
        statuses,
        filters: { status: status || '', search: search || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e instalimeve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen instalimet.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const projects = await prisma.project.findMany({
        where: { stage: { not: 'Përfunduar' } },
        orderBy: { name: 'asc' }
      });
      const elevators = await prisma.elevator.findMany({ where: { status: 'Aktiv' } });
      const technicians = await prisma.user.findMany({
        where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } }
      });
      const nextSerial = await NumberService.getNextNumber('serial');

      res.render('instalimet/krijo', {
        pageTitle: 'Cakto Instalim të Ri - KRONEER',
        projects,
        elevators,
        technicians,
        nextSerial
      });
    } catch (err) {
      console.error(err);
      res.redirect('/instalimet');
    }
  }

  static async postCreate(req, res) {
    try {
      const { projectId, elevatorModel, serialNumber, teamLead, technicianId, startDate, targetDate, notes } = req.body;
      const serial = serialNumber || await NumberService.getNextNumber('serial');

      const installation = await prisma.installation.create({
        data: {
          projectId: parseInt(projectId),
          elevatorModel: elevatorModel.trim(),
          serialNumber: serial.trim(),
          teamLead: teamLead ? teamLead.trim() : 'Ekipi Inxhinierik KRONEER',
          technicianId: technicianId ? parseInt(technicianId) : null,
          startDate: startDate ? new Date(startDate) : new Date(),
          targetDate: targetDate ? new Date(targetDate) : null,
          progressPercent: 0,
          status: 'Në Instalim',
          notes: notes ? notes.trim() : null
        }
      });

      // Krijimi i 13 artikujve të listës së kontrollit
      for (const item of DEFAULT_CHECKLIST) {
        await prisma.installationChecklist.create({
          data: {
            installationId: installation.id,
            itemKey: item.key,
            itemTitle: item.title,
            isCompleted: false
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Instalim',
        entityId: installation.id,
        description: `U caktua instalimi i liftit ${installation.elevatorModel} me numër serik ${installation.serialNumber}.`
      });

      req.flash('success', `Instalimi me numër serik ${installation.serialNumber} u caktua me sukses.`);
      res.redirect(`/instalimet/${installation.id}`);
    } catch (err) {
      console.error('Gabim në caktimin e instalimit:', err);
      req.flash('error', 'Nuk u caktua instalimi.');
      res.redirect('/instalimet/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const installation = await prisma.installation.findUnique({
        where: { id },
        include: {
          project: { include: { customer: true, handovers: true } },
          technician: true,
          checklistItems: { orderBy: { id: 'asc' } }
        }
      });

      if (!installation) {
        req.flash('error', 'Instalimi nuk u gjet.');
        return res.redirect('/instalimet');
      }

      const qrCodeDataUrl = await QRCode.toDataURL(installation.serialNumber, {
        width: 240,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      res.render('instalimet/detajet', {
        pageTitle: `Instalimi: ${installation.elevatorModel} (${installation.serialNumber}) - KRONEER`,
        installation,
        qrCodeDataUrl
      });
    } catch (err) {
      console.error(err);
      res.redirect('/instalimet');
    }
  }

  static async postToggleChecklist(req, res) {
    try {
      const installationId = parseInt(req.params.id);
      const { checklistItemId } = req.body;

      const item = await prisma.installationChecklist.findUnique({
        where: { id: parseInt(checklistItemId) }
      });

      if (!item) {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
          return res.status(404).json({ success: false, error: 'Artikulli nuk u gjet.' });
        }
        return res.redirect(`/instalimet/${installationId}`);
      }

      const newStatus = !item.isCompleted;

      await prisma.installationChecklist.update({
        where: { id: item.id },
        data: {
          isCompleted: newStatus,
          completedAt: newStatus ? new Date() : null,
          completedBy: newStatus ? (req.session.user?.fullName || 'Teknik KRONEER') : null
        }
      });

      // Rillogarit përqindjen e progresit
      const allItems = await prisma.installationChecklist.findMany({
        where: { installationId }
      });

      const completedCount = allItems.filter(i => i.isCompleted).length;
      const progressPercent = Math.round((completedCount / allItems.length) * 100);

      let installationStatus = 'Në Instalim';
      if (progressPercent === 100) {
        installationStatus = 'Përfunduar';
      } else if (progressPercent >= 75) {
        installationStatus = 'Në Testim';
      }

      const updated = await prisma.installation.update({
        where: { id: installationId },
        data: {
          progressPercent,
          status: installationStatus,
          completionDate: progressPercent === 100 ? new Date() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Instalim',
        entityId: installationId,
        description: `Pika e kontrollit "${item.itemTitle}" u shënua si ${newStatus ? 'e përfunduar' : 'e papërfunduar'}. Progresi: ${progressPercent}%.`
      });

      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.json({
          success: true,
          item: { id: item.id, isCompleted: newStatus },
          progressPercent,
          status: installationStatus
        });
      }

      req.flash('success', `Lista e kontrollit u përditësua. Progresi: ${progressPercent}%.`);
      res.redirect(`/instalimet/${installationId}`);
    } catch (err) {
      console.error('Gabim në përditësimin e checklist-it:', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        return res.status(500).json({ success: false, error: 'Gabim në server.' });
      }
      res.redirect(`/instalimet/${req.params.id}`);
    }
  }
}

module.exports = InstallationController;
