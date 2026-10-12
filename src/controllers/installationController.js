const crypto = require('crypto');
const prisma = require('../config/prisma');
const QRCode = require('qrcode');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

const TRACKING_SECRET = process.env.SESSION_SECRET || 'kroneer_lift_tracking_secret_2026';

function buildInstallationWhere(user, status, search) {
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
    const term = { contains: search, mode: 'insensitive' };
    const searchConditions = [
      { serialNumber: term },
      { elevatorModel: term },
      { teamLead: term },
      { project: { name: term } }
    ];
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  return where;
}

function buildInstallationSummary(installations, tickets, openProblemCount = tickets.length) {
  return {
    total: installations.length,
    averageProgress: installations.length
      ? Math.round(installations.reduce((sum, item) => sum + item.progressPercent, 0) / installations.length)
      : 0,
    inProgress: installations.filter(item => item.status === 'Në Instalim').length,
    testing: installations.filter(item => item.status === 'Në Testim').length,
    openProblems: openProblemCount
  };
}

async function loadLiveDashboard(where) {
  const [installations, serialRows, aggregate, statusCounts] = await Promise.all([
    prisma.installation.findMany({
      where,
      select: {
        id: true,
        serialNumber: true,
        elevatorModel: true,
        status: true,
        progressPercent: true,
        teamLead: true,
        technician: { select: { fullName: true } },
        project: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 8
    }),
    prisma.installation.findMany({ where, select: { serialNumber: true } }),
    prisma.installation.aggregate({ where, _count: { _all: true }, _avg: { progressPercent: true } }),
    prisma.installation.groupBy({ by: ['status'], where, _count: { _all: true } })
  ]);

  const serialNumbers = serialRows.map(item => item.serialNumber);
  const ticketWhere = {
    serialNumber: { in: serialNumbers },
    status: { notIn: ['Zgjidhur', 'Mbyllur'] }
  };
  const [tickets, openProblemCount] = await Promise.all(serialNumbers.length ? [
    prisma.serviceTicket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        number: true,
        serialNumber: true,
        problemDescription: true,
        priority: true,
        status: true,
        reportedDate: true,
        technician: { select: { fullName: true } }
      },
      orderBy: { reportedDate: 'desc' },
      take: 12
    }),
    prisma.serviceTicket.count({ where: ticketWhere })
  ] : [Promise.resolve([]), Promise.resolve(0)]);

  const countForStatus = status => statusCounts.find(item => item.status === status)?._count._all || 0;
  return {
    installations,
    tickets,
    summary: {
      total: aggregate._count._all,
      averageProgress: Math.round(aggregate._avg.progressPercent || 0),
      inProgress: countForStatus('Në Instalim'),
      testing: countForStatus('Në Testim'),
      openProblems: openProblemCount
    }
  };
}

function generateLiftTrackingToken(installationId, serialNumber) {
  const data = `lift_${installationId}_${serialNumber}_kroneer_secure`;
  const hash = crypto.createHmac('sha256', TRACKING_SECRET).update(data).digest('hex').substring(0, 16);
  return Buffer.from(`${installationId}-${hash}`).toString('base64url');
}

function decodeLiftTrackingToken(token) {
  try {
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('-');
    const [idStr, hash] = parts;
    const id = Number(idStr);
    if (parts.length !== 2 || !Number.isSafeInteger(id) || id < 1 || !/^[a-f0-9]{16}$/.test(hash || '')) return null;
    return { id, hash };
  } catch (e) {
    return null;
  }
}

function verifyLiftTrackingToken(token, serialNumber) {
  const decoded = decodeLiftTrackingToken(token);
  if (!decoded || !serialNumber) return null;

  const expectedHash = crypto.createHmac('sha256', TRACKING_SECRET)
    .update(`lift_${decoded.id}_${serialNumber}_kroneer_secure`)
    .digest('hex')
    .substring(0, 16);
  const actual = Buffer.from(decoded.hash);
  const expected = Buffer.from(expectedHash);
  return crypto.timingSafeEqual(actual, expected) ? decoded.id : null;
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
      const where = buildInstallationWhere(req.session.user, status, search);

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

      const serialNumbers = installations.map(inst => inst.serialNumber);
      const activeTickets = serialNumbers.length ? await prisma.serviceTicket.findMany({
        where: {
          serialNumber: { in: serialNumbers },
          status: { notIn: ['Zgjidhur', 'Mbyllur'] }
        },
        select: {
          id: true,
          number: true,
          serialNumber: true,
          problemDescription: true,
          priority: true,
          status: true,
          reportedDate: true,
          technician: { select: { fullName: true } }
        },
        orderBy: { reportedDate: 'desc' },
        take: 12
      }) : [];
      const openProblemCount = serialNumbers.length ? await prisma.serviceTicket.count({
        where: {
          serialNumber: { in: serialNumbers },
          status: { notIn: ['Zgjidhur', 'Mbyllur'] }
        }
      }) : 0;

      res.render('instalimet/index', {
        pageTitle: 'Qendra e Instalimeve - KRONEER',
        installations,
        activeTickets,
        dashboardSummary: buildInstallationSummary(installations, activeTickets, openProblemCount),
        statuses,
        filters: { status: status || '', search: search || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e instalimeve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen instalimet.');
      res.redirect('/paneli');
    }
  }

  static async getLiveDashboard(req, res) {
    try {
      const { status, search } = req.query;
      const where = buildInstallationWhere(req.session.user, status, search);
      const dashboard = await loadLiveDashboard(where);
      res.set('Cache-Control', 'no-store');
      res.json({ ...dashboard, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Gabim në rifreskimin live të instalimeve:', err);
      res.status(500).json({ error: 'Nuk u rifreskua dashboard-i.' });
    }
  }

  static async getQrCode(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(404);

      const installation = await prisma.installation.findUnique({
        where: { id },
        select: { id: true, serialNumber: true }
      });
      if (!installation) return res.sendStatus(404);

      const token = generateLiftTrackingToken(installation.id, installation.serialNumber);
      const trackingUrl = `${req.protocol}://${req.get('host')}/track/lift/${token}`;
      const image = await QRCode.toBuffer(trackingUrl, {
        width: 220,
        margin: 1.5,
        color: { dark: '#0f172a', light: '#ffffff' }
      });

      return res.type('png').set('Cache-Control', 'private, max-age=3600').send(image);
    } catch (err) {
      console.error('Gabim në gjenerimin e QR-së së instalimit:', err);
      return res.status(500).send('Nuk u gjenerua QR kodi.');
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
      const decodedToken = decodeLiftTrackingToken(token);

      let installation = null;

      if (decodedToken) {
        const candidate = await prisma.installation.findUnique({
          where: { id: decodedToken.id },
          include: {
            project: { include: { customer: true, contract: true } },
            technician: true,
            checklistItems: { orderBy: { id: 'asc' } }
          }
        });
        if (candidate && verifyLiftTrackingToken(token, candidate.serialNumber)) {
          installation = candidate;
        }
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

      res.render('public/lift-tracking', { turnstileSiteKey: await require('../middleware/turnstile').getSiteKey(),
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
      const decodedToken = decodeLiftTrackingToken(token);

      let installation = null;
      if (decodedToken) {
        const candidate = await prisma.installation.findUnique({
          where: { id: decodedToken.id },
          include: { project: true }
        });
        if (candidate && verifyLiftTrackingToken(token, candidate.serialNumber)) {
          installation = candidate;
        }
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
      const elevator = await prisma.elevator.findFirst({
        where: {
          OR: [
            { model: installation.elevatorModel },
            { code: installation.elevatorModel }
          ]
        }
      });

      const fullDesc = `[Raportuar nga Portali Publik]\nPersoni: ${reporterName || 'Klient / Banor'}\nTelefoni: ${reporterPhone || 'I pacaktuar'}\nPërshkrimi: ${problemDescription.trim()}`;

      const ticket = await prisma.serviceTicket.create({
        data: {
          number: ticketNumber,
          customerId: installation.project.customerId,
          elevatorId: elevator?.id || null,
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


