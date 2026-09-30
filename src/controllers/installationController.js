const crypto = require('crypto');
const prisma = require('../config/prisma');
const QRCode = require('qrcode');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

const TRACKING_SECRET = process.env.SESSION_SECRET || 'kroneer_lift_tracking_secret_2026';

function generateLiftTrackingToken(installationId, serialNumber) {
  const data = `lift_${installationId}_${serialNumber}_kroneer_secure`;
  const hash = crypto.createHmac('sha256', TRACKING_SECRET).update(data).digest('hex').substring(0, 16);
  return Buffer.from(`${installationId}-${hash}`).toString('base64url');
}

function verifyLiftTrackingToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [idStr, hash] = decoded.split('-');
    const id = parseInt(idStr);
    if (!id || isNaN(id)) return null;
    return id;
  } catch (e) {
    return null;
  }
}

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
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Gjenerimi i QR Code dhe Tokenit Publik për çdo instalim
      for (const inst of installations) {
        const token = generateLiftTrackingToken(inst.id, inst.serialNumber);
        inst.trackingToken = token;
        inst.trackingUrl = `${baseUrl}/track/lift/${token}`;
        inst.qrCodeDataUrl = await QRCode.toDataURL(inst.trackingUrl, {
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

      const trackingToken = generateLiftTrackingToken(installation.id, installation.serialNumber);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const trackingUrl = `${baseUrl}/track/lift/${trackingToken}`;

      const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 280,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      // Kontrollo nëse ekziston procesverbal dorëzimi ose kontratë mirëmbajtjeje për këtë lift
      const [handover, maintenanceContract, serviceTickets, elevatorModelData] = await Promise.all([
        prisma.handover.findFirst({
          where: { serialNumber: installation.serialNumber }
        }),
        prisma.maintenanceContract.findFirst({
          where: { serialNumber: installation.serialNumber },
          include: { visits: { orderBy: { visitDate: 'desc' } }, technician: true }
        }),
        prisma.serviceTicket.findMany({
          where: { serialNumber: installation.serialNumber },
          orderBy: { reportedDate: 'desc' },
          take: 5
        }),
        prisma.elevator.findFirst({
          where: {
            OR: [
              { model: installation.elevatorModel },
              { code: installation.elevatorModel }
            ]
          }
        })
      ]);

      res.render('instalimet/detajet', {
        pageTitle: `Instalimi & Pasaporta: ${installation.elevatorModel} (${installation.serialNumber}) - KRONEER`,
        installation,
        trackingToken,
        trackingUrl,
        qrCodeDataUrl,
        handover,
        maintenanceContract,
        serviceTickets,
        elevatorModelData
      });
    } catch (err) {
      console.error('Gabim në shfaqjen e detajeve të instalimit:', err);
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
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
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

      await prisma.installation.update({
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

  // ==========================================
  // PORTALI PUBLIK ENKRIPTUAR PËR KLIENTIN (LIVE TRACKING & LIFECYCLE)
  // ==========================================
  static async getPublicLiftTracking(req, res) {
    try {
      const { token } = req.params;
      const verifiedId = verifyLiftTrackingToken(token);

      let installation = null;

      if (verifiedId) {
        installation = await prisma.installation.findUnique({
          where: { id: verifiedId },
          include: {
            project: { include: { customer: true, contract: true } },
            technician: true,
            checklistItems: { orderBy: { id: 'asc' } }
          }
        });
      }

      // Fallback nëse kërkohet me serialNumber direkt (p.sh. /track/lift/KR-SN-2026-00431)
      if (!installation && token) {
        installation = await prisma.installation.findFirst({
          where: { serialNumber: token.trim() },
          include: {
            project: { include: { customer: true, contract: true } },
            technician: true,
            checklistItems: { orderBy: { id: 'asc' } }
          }
        });
      }

      if (!installation) {
        return res.status(404).render('partials/error', {
          layout: 'layouts/public',
          pageTitle: 'Lifti nuk u gjet - KRONEER',
          statusCode: 404,
          errorMessage: 'Linku i kërkuar nuk është i vlefshëm ose ky lift nuk ekziston në bazën e të dhënave KRONEER.'
        });
      }

      const canonicalToken = generateLiftTrackingToken(installation.id, installation.serialNumber);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const trackingUrl = `${baseUrl}/track/lift/${canonicalToken}`;

      const qrCodeDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 300,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      // Ngarko të gjitha të dhënat e ciklit jetësor pas instalimit
      const [handover, maintenanceContract, serviceTickets, elevatorModelData, company] = await Promise.all([
        prisma.handover.findFirst({
          where: { serialNumber: installation.serialNumber }
        }),
        prisma.maintenanceContract.findFirst({
          where: { serialNumber: installation.serialNumber },
          include: {
            visits: { orderBy: { visitDate: 'desc' }, take: 15 },
            technician: true
          }
        }),
        prisma.serviceTicket.findMany({
          where: { serialNumber: installation.serialNumber },
          orderBy: { reportedDate: 'desc' },
          take: 10
        }),
        prisma.elevator.findFirst({
          where: {
            OR: [
              { model: installation.elevatorModel },
              { code: installation.elevatorModel }
            ]
          },
          include: { media: true }
        }),
        prisma.companySettings.findFirst()
      ]);

      res.render('public/lift-tracking', {
        layout: 'layouts/public',
        pageTitle: `Gjendja Live e Liftit (SN: ${installation.serialNumber}) — KRONEER Real-Time Tracking`,
        installation,
        handover,
        maintenanceContract,
        serviceTickets,
        elevatorModelData,
        company,
        trackingToken: canonicalToken,
        trackingUrl,
        qrCodeDataUrl,
        activeTab: req.query.tab || 'progresi'
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e portalit publik të liftit:', err);
      res.status(500).render('partials/error', {
        layout: 'layouts/public',
        pageTitle: 'Gabim në sistem',
        statusCode: 500,
        errorMessage: 'Ndodhi një gabim gjatë ngarkimit të gjendjes së liftit.'
      });
    }
  }

  // Raportim i Shpejtë i Defektit direkt nga Linku Publik i Liftit
  static async postPublicReportIssue(req, res) {
    try {
      const { token } = req.params;
      const verifiedId = verifyLiftTrackingToken(token);

      let installation = null;
      if (verifiedId) {
        installation = await prisma.installation.findUnique({
          where: { id: verifiedId },
          include: { project: true }
        });
      }
      if (!installation && token) {
        installation = await prisma.installation.findFirst({
          where: { serialNumber: token.trim() },
          include: { project: true }
        });
      }

      if (!installation) {
        return res.status(404).json({ success: false, error: 'Lifti nuk u gjet.' });
      }

      const { reporterName, reporterPhone, problemDescription, priority } = req.body;

      if (!problemDescription || !problemDescription.trim()) {
        req.flash('error', 'Ju lutemi përshkruani problemin e vërejtur.');
        return res.redirect(`/track/lift/${token}`);
      }

      const ticketNumber = await NumberService.getNextNumber('service');

      const fullDesc = `[Raportuar nga Portali Publik]\nPersoni: ${reporterName || 'Klient / Banor'}\nTelefoni: ${reporterPhone || 'I pacaktuar'}\nPërshkrimi: ${problemDescription.trim()}`;

      const ticket = await prisma.serviceTicket.create({
        data: {
          number: ticketNumber,
          customerId: installation.project.customerId,
          serialNumber: installation.serialNumber,
          problemDescription: fullDesc,
          priority: priority || 'Normal',
          status: 'Hapur',
          reportedDate: new Date()
        }
      });

      // Krijo njoftim për stafin administrativ
      await prisma.notification.create({
        data: {
          title: `Kërkesë e Re Servisi (${ticket.number})`,
          message: `U raportua një problem nga portali publik për liftin SN: ${installation.serialNumber} (${installation.elevatorModel}).`,
          type: priority === 'Kritik' || priority === 'I lartë' ? 'error' : 'warning',
          linkUrl: '/servisi-mirembajtja?tab=servisi'
        }
      });

      await ActivityService.log({
        userName: reporterName || 'Klient / Portali Publik',
        actionType: 'Krijuar',
        entityType: 'Servis',
        entityId: ticket.id,
        description: `Kërkesë servisi ${ticket.number} u raportua nga portali publik për liftin SN: ${installation.serialNumber}.`
      });

      req.flash('success', `Kërkesa juaj e servisit (Tiketa: ${ticket.number}) u regjistrua me sukses në sistemin KRONEER. Ekipi ynë i teknikëve do të kontaktojë së shpejti!`);
      res.redirect(`/track/lift/${token}?tab=servisi`);
    } catch (err) {
      console.error('Gabim në raportimin publik të defektit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë regjistrimit të kërkesës suaj.');
      res.redirect(`/track/lift/${req.params.token}`);
    }
  }
}

module.exports = InstallationController;
module.exports.generateLiftTrackingToken = generateLiftTrackingToken;
module.exports.verifyLiftTrackingToken = verifyLiftTrackingToken;
