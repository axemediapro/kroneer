const prisma = require('../config/prisma');
const { ownedProjectsWhere } = require('../services/projectScope');

class OperationsHubController {
  static async getServiceMaintenance(req, res) {
    try {
      const tab = req.query.tab || 'pasqyra';
      const user = req.session.user;
      const scoped = user && (user.role === 'MENAXHER_PROJEKTI' || user.role === 'TEKNIK');

      const [
        tickets,
        contracts,
        recentVisits,
        spareParts,
        interventions,
        openTickets,
        urgentTickets,
        activeContracts,
        expiringContracts
      ] = await Promise.all([
        prisma.serviceTicket.findMany({
          include: { customer: true, elevator: true, technician: true },
          orderBy: { reportedDate: 'desc' },
          take: 50
        }),
        prisma.maintenanceContract.findMany({
          include: { customer: true, elevator: true, technician: true, visits: { orderBy: { visitDate: 'desc' } } },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        prisma.maintenanceVisit.findMany({
          include: {
            contract: { include: { customer: true, elevator: true } },
            technician: true
          },
          orderBy: { visitDate: 'desc' },
          take: 30
        }),
        prisma.sparePart.findMany({
          orderBy: { stockQty: 'asc' },
          take: 20
        }),
        prisma.intervention.findMany({
          where: {
            type: { in: ['Mirëmbajtje Periodike', 'Servis Urgjent', 'Riparim & Pjesë'] }
          },
          include: { project: { include: { customer: true } } },
          orderBy: { date: 'desc' },
          take: 20
        }),
        prisma.serviceTicket.count({
          where: { status: { in: ['Hapur', 'Caktuar', 'Në proces', 'Në pritje'] } }
        }),
        prisma.serviceTicket.count({
          where: {
            status: { in: ['Hapur', 'Caktuar', 'Në proces'] },
            priority: { in: ['Kritik', 'I lartë', 'Urgjent'] }
          }
        }),
        prisma.maintenanceContract.count({
          where: { status: 'Aktive' }
        }),
        prisma.maintenanceContract.count({
          where: { status: 'Skadon së shpejti' }
        })
      ]);

      // Calculate total contract annual value
      const totalContractValue = contracts.reduce((sum, c) => sum + (c.priceAnnual || 0), 0);
      const lowStockParts = spareParts.filter(p => p.stockQty <= p.minStockQty).length;

      res.render('operimi/servisi-mirembajtja', {
        pageTitle: 'Servisi & Mirëmbajtja (Qendra e Integruar) - KRONEER',
        tab,
        tickets,
        contracts,
        recentVisits,
        spareParts,
        interventions,
        stats: {
          totalTickets: tickets.length,
          openTickets,
          urgentTickets,
          activeContracts,
          expiringContracts,
          totalContractValue,
          recentVisitsCount: recentVisits.length,
          lowStockParts
        },
        scoped
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e qendrës së servisit dhe mirëmbajtjes:', err);
      req.flash('error', 'Nuk u ngarkua qendra e servisit dhe mirëmbajtjes.');
      res.redirect('/paneli');
    }
  }

  static async getModernization(req, res) {
    try {
      const user = req.session.user;
      const where = { lineOfBusiness: 'Modernizim' };

      if (user && (user.role === 'MENAXHER_PROJEKTI' || user.role === 'TEKNIK')) {
        Object.assign(where, ownedProjectsWhere(user));
      }

      const projects = await prisma.project.findMany({
        where,
        include: {
          customer: true,
          projectManager: true,
          teamMembers: { include: { employee: true } },
          installations: { select: { id: true, status: true, progressPercent: true, elevatorModel: true, serialNumber: true } },
          handovers: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const totalModernizationValue = projects.reduce((sum, p) => sum + (p.value || 0), 0);
      const activeModernizationCount = projects.filter(p => p.stage !== 'Përfunduar').length;
      const completedModernizationCount = projects.filter(p => p.stage === 'Përfunduar').length;

      res.render('operimi/modernizimi', {
        pageTitle: 'Modernizimi i Lifteve - KRONEER',
        projects,
        stats: {
          totalProjects: projects.length,
          activeProjects: activeModernizationCount,
          completedProjects: completedModernizationCount,
          totalValue: totalModernizationValue
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e projekteve të modernizimit:', err);
      req.flash('error', 'Nuk u ngarkuan projektet e modernizimit.');
      res.redirect('/paneli');
    }
  }
}

module.exports = OperationsHubController;
