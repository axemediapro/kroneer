const prisma = require('../config/prisma');

let cachedDashboardData = null;
let cachedDashboardTime = 0;
const DASHBOARD_CACHE_TTL = 15 * 1000; // 15 sekonda cache për shpejtësi të menjëhershme

class DashboardController {
  static async getIndex(req, res) {
    try {
      const now = Date.now();
      if (cachedDashboardData && (now - cachedDashboardTime < DASHBOARD_CACHE_TTL)) {
        return res.render('dashboard/index', cachedDashboardData);
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

      cachedDashboardData = payload;
      cachedDashboardTime = now;

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
