const prisma = require('../config/prisma');

const REPORT_TABS = ['shitjet', 'lifta', 'financiar', 'projektet', 'mirembajtja', 'modernizimi'];

function getGroup(groups, key, value) {
  return groups.find(group => group[key] === value);
}

function getGroupCount(groups, key, value) {
  return getGroup(groups, key, value)?._count._all || 0;
}

function sumGroupCounts(groups) {
  return groups.reduce((sum, group) => sum + group._count._all, 0);
}

class ReportController {
  static async getIndex(req, res) {
    const requestedTab = req.query.tab || 'shitjet';
    const tab = REPORT_TABS.includes(requestedTab) ? requestedTab : 'shitjet';
    const renderReport = data => res.render('raportet/index', {
      pageTitle: 'Raportet Analitike - KRONEER',
      activeTab: tab,
      ...data
    });

    try {
      if (tab === 'shitjet') {
        const now = new Date();
        const currentQuarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const firstQuarterStart = new Date(currentQuarterStart.getFullYear(), currentQuarterStart.getMonth() - 9, 1);
        const quarterLabels = ['Jan-Mar', 'Prill-Qer', 'Kor-Sht', 'Tet-Dhj'];

        const [quoteGroups, quarterlyQuotes] = await Promise.all([
          prisma.quotation.groupBy({
            by: ['status'],
            _count: { _all: true },
            _sum: { total: true }
          }),
          prisma.quotation.findMany({
            where: { status: 'Pranuar', date: { gte: firstQuarterStart, lte: now } },
            select: { date: true, total: true }
          })
        ]);

        const wonGroup = getGroup(quoteGroups, 'status', 'Pranuar');
        const wonCount = wonGroup?._count._all || 0;
        const totalRevenue = wonGroup?._sum.total || 0;
        const totalCount = sumGroupCounts(quoteGroups);
        const quarterTotals = new Map();
        quarterlyQuotes.forEach(quote => {
          const quarter = Math.floor(quote.date.getMonth() / 3);
          const key = `${quote.date.getFullYear()}-${quarter}`;
          quarterTotals.set(key, (quarterTotals.get(key) || 0) + quote.total);
        });
        const quarterlySales = Array.from({ length: 4 }, (_, index) => {
          const start = new Date(firstQuarterStart.getFullYear(), firstQuarterStart.getMonth() + index * 3, 1);
          const quarter = Math.floor(start.getMonth() / 3);
          const key = `${start.getFullYear()}-${quarter}`;
          return {
            label: `Q${quarter + 1} ${start.getFullYear()}`,
            period: quarterLabels[quarter],
            value: quarterTotals.get(key) || 0
          };
        });
        const maxQuarterValue = Math.max(...quarterlySales.map(item => item.value), 0);
        quarterlySales.forEach(item => {
          item.heightPercent = maxQuarterValue ? Math.max(4, Math.round(item.value / maxQuarterValue * 72)) : 0;
        });

        return renderReport({
          sales: {
            totalRevenue,
            wonCount,
            lostCount: getGroupCount(quoteGroups, 'status', 'Refuzuar'),
            totalCount,
            conversionRate: totalCount ? Math.round(wonCount / totalCount * 100) : 0,
            avgSaleValue: wonCount ? Math.round(totalRevenue / wonCount) : 0
          },
          quarterlySales
        });
      }

      if (tab === 'lifta') {
        const [elevators, installationGroups] = await Promise.all([
          prisma.elevator.findMany({
            select: { code: true, model: true, type: true, capacityKg: true, personsCount: true, speed: true, basePrice: true },
            orderBy: { model: 'asc' }
          }),
          prisma.installation.groupBy({ by: ['status'], _count: { _all: true } })
        ]);
        const totalCount = sumGroupCounts(installationGroups);
        const installedCount = getGroupCount(installationGroups, 'status', 'Përfunduar');

        return renderReport({
          elevatorsReport: { elevators, installedCount, inProgressCount: totalCount - installedCount, totalCount }
        });
      }

      if (tab === 'financiar') {
        const [invoiceGroups, paymentTotals] = await Promise.all([
          prisma.invoice.groupBy({
            by: ['status'],
            _count: { _all: true },
            _sum: { total: true, balanceDue: true, vatAmount: true }
          }),
          prisma.payment.aggregate({ _sum: { amount: true } })
        ]);
        const overdueGroup = getGroup(invoiceGroups, 'status', 'E vonuar');

        return renderReport({
          financial: {
            totalInvoiced: invoiceGroups.reduce((sum, group) => sum + (group._sum.total || 0), 0),
            totalPaid: paymentTotals._sum.amount || 0,
            totalDebt: invoiceGroups.reduce((sum, group) => sum + (group._sum.balanceDue || 0), 0),
            overdueAmount: overdueGroup?._sum.balanceDue || 0,
            overdueCount: overdueGroup?._count._all || 0,
            totalVat: invoiceGroups.reduce((sum, group) => sum + (group._sum.vatAmount || 0), 0)
          }
        });
      }

      if (tab === 'projektet' || tab === 'modernizimi') {
        const projectGroups = await prisma.project.groupBy({
          by: ['lineOfBusiness', 'stage'],
          _count: { _all: true },
          _sum: { value: true }
        });
        const modernizationGroups = projectGroups.filter(group => group.lineOfBusiness === 'Modernizim');
        const groups = tab === 'modernizimi' ? modernizationGroups : projectGroups;
        const completed = groups.filter(group => group.stage === 'Përfunduar')
          .reduce((sum, group) => sum + group._count._all, 0);
        const total = sumGroupCounts(groups);

        if (tab === 'modernizimi') {
          return renderReport({
            modernizationReport: {
              total,
              active: total - completed,
              completed,
              totalValue: modernizationGroups.reduce((sum, group) => sum + (group._sum.value || 0), 0)
            }
          });
        }

        return renderReport({ projectsReport: { total, active: total - completed, completed } });
      }

      const [contractGroups, ticketGroups, completedVisits] = await Promise.all([
        prisma.maintenanceContract.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.serviceTicket.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.maintenanceVisit.count({ where: { status: 'E Përfunduar' } })
      ]);
      const openTickets = ['Hapur', 'Në proces', 'Caktuar']
        .reduce((sum, status) => sum + getGroupCount(ticketGroups, 'status', status), 0);
      const resolvedTickets = ['Zgjidhur', 'Mbyllur']
        .reduce((sum, status) => sum + getGroupCount(ticketGroups, 'status', status), 0);

      return renderReport({
        maintenanceReport: {
          total: sumGroupCounts(contractGroups),
          active: getGroupCount(contractGroups, 'status', 'Aktive'),
          expiring: getGroupCount(contractGroups, 'status', 'Skadon së shpejti'),
          openTickets,
          resolvedTickets,
          completedVisits
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
