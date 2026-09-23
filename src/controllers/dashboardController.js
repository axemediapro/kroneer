const prisma = require('../config/prisma');

class DashboardController {
  static async getIndex(req, res) {
    try {
      // 1. Statistikat financiare dhe operacionale në kohë reale
      const [
        totalPaymentsAgg,
        unpaidInvoicesAgg,
        activeQuotationsCount,
        activeProjectsCount,
        installingCount,
        maintenanceCount,
        recentActivities,
        recentTickets,
        recentQuotes
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
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),
        prisma.quotation.findMany({
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
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
        data: [42, 18, 14, 10, 8, 5, 3] // Përqindje / Vlera
      };

      // 4. Numërimet e etapave të Funnel-it të shitjes
      const [
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

      res.render('dashboard/index', {
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
      });
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
