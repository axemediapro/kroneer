const prisma = require('../config/prisma');

class ReportController {
  static async getIndex(req, res) {
    const tab = req.query.tab || 'shitjet';

    try {
      // 1. RAPORTI I SHITJEVE
      const quotes = await prisma.quotation.findMany();
      const wonQuotes = quotes.filter(q => q.status === 'Pranuar');
      const lostQuotes = quotes.filter(q => q.status === 'Refuzuar');
      const totalQuotesVal = wonQuotes.reduce((s, q) => s + (q.total || 0), 0);
      const conversionRate = quotes.length > 0 ? Math.round((wonQuotes.length / quotes.length) * 100) : 0;
      const avgSaleValue = wonQuotes.length > 0 ? Math.round(totalQuotesVal / wonQuotes.length) : 0;

      // 2. RAPORTI I LIFTVE
      const elevators = await prisma.elevator.findMany();
      const installations = await prisma.installation.findMany();
      const installedCount = installations.filter(i => i.status === 'Përfunduar').length;
      const inProgressCount = installations.filter(i => i.status !== 'Përfunduar').length;

      // 3. RAPORTI FINANCIAR
      const invoices = await prisma.invoice.findMany();
      const payments = await prisma.payment.findMany();
      const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      const totalDebt = invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
      const overdueInvoices = invoices.filter(i => i.status === 'E vonuar');
      const overdueAmount = overdueInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
      const totalVat = invoices.reduce((s, i) => s + (i.vatAmount || 0), 0);

      // 4. RAPORTI I PROJEKTEVE
      const projects = await prisma.project.findMany();
      const activeProjects = projects.filter(p => p.stage !== 'Përfunduar').length;
      const completedProjects = projects.filter(p => p.stage === 'Përfunduar').length;

      // 5. RAPORTI I MIRËMBAJTJES & SERVISIT
      const maintenanceContracts = await prisma.maintenanceContract.findMany();
      const activeMaintenance = maintenanceContracts.filter(m => m.status === 'Aktive').length;
      const expiringMaintenance = maintenanceContracts.filter(m => m.status === 'Skadon së shpejti').length;
      const tickets = await prisma.serviceTicket.findMany();
      const openTickets = tickets.filter(t => t.status === 'Hapur' || t.status === 'Në proces' || t.status === 'Caktuar').length;
      const resolvedTickets = tickets.filter(t => t.status === 'Zgjidhur' || t.status === 'Mbyllur').length;
      const visits = await prisma.maintenanceVisit.findMany();

      res.render('raportet/index', {
        pageTitle: 'Raportet Analitike - KRONEER',
        activeTab: tab,
        sales: {
          totalRevenue: totalQuotesVal,
          wonCount: wonQuotes.length,
          lostCount: lostQuotes.length,
          totalCount: quotes.length,
          conversionRate,
          avgSaleValue
        },
        elevatorsReport: {
          elevators,
          installedCount,
          inProgressCount,
          totalCount: installations.length
        },
        financial: {
          totalInvoiced,
          totalPaid,
          totalDebt,
          overdueAmount,
          overdueCount: overdueInvoices.length,
          totalVat
        },
        projectsReport: {
          total: projects.length,
          active: activeProjects,
          completed: completedProjects
        },
        maintenanceReport: {
          total: maintenanceContracts.length,
          active: activeMaintenance,
          expiring: expiringMaintenance,
          openTickets,
          resolvedTickets,
          visitsCount: visits.length
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e raporteve:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen raportet.');
      res.redirect('/paneli');
    }
  }
}

module.exports = ReportController;
