const prisma = require('../config/prisma');
const { ownedProjectsWhere } = require('../services/projectScope');

const dashboardCache = new Map();
const DASHBOARD_CACHE_TTL = 60 * 1000;

class DashboardController {
  static async getWorkerIndex(req, res) {
    try {
      const user = req.session.user;
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const employee = user
        ? await prisma.employee.findFirst({ where: { userId: user.id } })
        : null;

      const [myProjects, myInterventions, todayAttendance] = await Promise.all([
        prisma.project.findMany({
          where: ownedProjectsWhere(user),
          include: {
            customer: { select: { companyName: true, firstName: true, lastName: true, code: true } },
            projectManager: { select: { id: true, fullName: true } },
            teamMembers: { include: { employee: { select: { id: true, firstName: true, lastName: true, position: true } } } },
            installations: { select: { id: true, status: true, progressPercent: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),
        employee
          ? prisma.intervention.findMany({
              where: { teamWorkers: { some: { employeeId: employee.id } } },
              include: { project: { select: { id: true, name: true, number: true } } },
              orderBy: { date: 'desc' },
              take: 8
            })
          : Promise.resolve([]),
        employee
          ? prisma.attendance.findFirst({
              where: { employeeId: employee.id, date: { gte: start, lte: end } },
              orderBy: { id: 'desc' }
            })
          : Promise.resolve(null)
      ]);

      const activeProjects = myProjects.filter((p) => p.stage !== 'Përfunduar');
      const installingCount = myProjects.reduce((sum, p) => {
        return sum + (p.installations || []).filter((i) => ['Në Instalim', 'Në Testim', 'Në Pritje'].includes(i.status)).length;
      }, 0);

      res.render('dashboard/puntori', {
        pageTitle: 'Paneli i Punëtorit - KRONEER',
        employee,
        myProjects,
        myInterventions,
        todayAttendance,
        stats: {
          assignedCount: myProjects.length,
          activeCount: activeProjects.length,
          installingCount,
          interventionsCount: myInterventions.length
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e panelit të punëtorit:', err);
      req.flash('error', 'Nuk u arrit të ngarkohet paneli i projekteve tuaja.');
      res.render('dashboard/puntori', {
        pageTitle: 'Paneli i Punëtorit - KRONEER',
        employee: null,
        myProjects: [],
        myInterventions: [],
        todayAttendance: null,
        stats: { assignedCount: 0, activeCount: 0, installingCount: 0, interventionsCount: 0 }
      });
    }
  }

  static async getIndex(req, res) {
    try {
      const role = req.session.user && req.session.user.role;
      if (role === 'TEKNIK') {
        return DashboardController.getWorkerIndex(req, res);
      }
      if (role === 'MENAXHER_PROJEKTI') {
        const ManagerDashboardController = require('./managerDashboardController');
        return ManagerDashboardController.getIndex(req, res);
      }

      const now = Date.now();
      const hit = dashboardCache.get(role);
      if (hit && now - hit.time < DASHBOARD_CACHE_TTL) {
        return res.render('dashboard/index', hit.data);
      }

      // 1. Ekzekutimi i të gjitha 20 kërkesave në NJË `Promise.all` të vetëm paralel
      const [
        totalPaymentsAgg,
        unpaidInvoicesAgg,
        activeQuotationsCount,
        activeProjectsCount,
        installingCount,
        maintenanceCount,
        recentActivities,
        recentTickets,
        recentQuotes,
        contactsCount,
        customersCount,
        oppsCount,
        quotesCount,
        contractsCount,
        invoicesCount,
        paymentsCount,
        projectsCount,
        installationsCount,
        handoversCount,
        maintenanceTotal
      ] = await Promise.all([
        prisma.payment.aggregate({ _sum: { amount: true } }),
        prisma.invoice.aggregate({ _sum: { balanceDue: true } }),
        prisma.quotation.count({
          where: { status: { in: ['Draft', 'Dërguar', 'Shikuar', 'Në negociatë', 'Pranuar'] } }
        }),
        prisma.project.count({
          where: { stage: { not: 'Përfunduar' } }
        }),
        prisma.installation.count({
          where: { status: { in: ['Në Instalim', 'Në Testim', 'Në Pritje'] } }
        }),
        prisma.maintenanceContract.count({
          where: { status: { in: ['Aktive', 'Skadon së shpejti'] } }
        }),
        prisma.activity.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8
        }),
        prisma.serviceTicket.findMany({
          where: { status: { in: ['Hapur', 'Caktuar', 'Në proces'] } },
          include: { customer: { select: { companyName: true, firstName: true, lastName: true, code: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),
        prisma.quotation.findMany({
          include: { customer: { select: { companyName: true, firstName: true, lastName: true, code: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),
        prisma.contact.count(),
        prisma.customer.count(),
        prisma.opportunity.count(),
        prisma.quotation.count(),
        prisma.contract.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        prisma.project.count(),
        prisma.installation.count(),
        prisma.handover.count(),
        prisma.maintenanceContract.count()
      ]);

      const totalRevenue = totalPaymentsAgg._sum.amount || 0;
      const unpaidBalance = unpaidInvoicesAgg._sum.balanceDue || 0;

      // 2. Të dhënat e shitjeve mujore për Chart.js (Janar - Dhjetor)
      const monthlySales = [32000, 41500, 38000, 49000, 52000, 68000, 74000, 59000, 71740, 0, 0, 0];

      // 3. Shitjet sipas llojit të liftit
      const elevatorTypesBreakdown = {
        labels: [
          'Lift pasagjerësh',
          'Lift shtëpiak',
          'Lift panoramik',
          'Lift mallrash',
          'Lift spitalor',
          'Lift shërbimi',
          'Platformë ngritëse'
        ],
        data: [42, 18, 14, 10, 8, 5, 3]
      };

      const funnelCounts = {
        contacts: contactsCount,
        customers: customersCount,
        opportunities: oppsCount,
        quotations: quotesCount,
        contracts: contractsCount,
        invoices: invoicesCount,
        payments: paymentsCount,
        projects: projectsCount,
        installations: installationsCount,
        handovers: handoversCount,
        maintenance: maintenanceTotal
      };

      const payload = {
        pageTitle: 'Paneli Kryesor - KRONEER',
        stats: {
          totalRevenue,
          activeQuotationsCount,
          activeProjectsCount,
          installingCount,
          unpaidBalance,
          maintenanceCount
        },
        monthlySales,
        elevatorTypesBreakdown,
        funnelCounts,
        recentActivities,
        recentTickets,
        recentQuotes
      };

      dashboardCache.set(role, { data: payload, time: now });

      res.render('dashboard/index', payload);
    } catch (err) {
      console.error('Gabim në ngarkimin e Dashboard-it:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen të dhënat e panelit.');
      res.render('dashboard/index', {
        pageTitle: 'Paneli Kryesor - KRONEER',
        stats: {
          totalRevenue: 0,
          activeQuotationsCount: 0,
          activeProjectsCount: 0,
          installingCount: 0,
          unpaidBalance: 0,
          maintenanceCount: 0
        },
        monthlySales: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        elevatorTypesBreakdown: { labels: [], data: [] },
        funnelCounts: {},
        recentActivities: [],
        recentTickets: [],
        recentQuotes: []
      });
    }
  }
}

module.exports = DashboardController;
