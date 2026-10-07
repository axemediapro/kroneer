import { Hono } from 'hono';
import { prisma } from '../../db.js';
import { render } from '../../lib/render.js';
import { flash } from '../../lib/session.js';
import { requireAuth, authorize } from '../../lib/roles.js';
import { ownedProjectsWhere } from '../../services/projectScope.js';

export const dashboard = new Hono();

const CACHE_TTL = 60 * 1000;
const adminCache = new Map();

const dayRange = () => {
  const d = new Date();
  return {
    start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0),
    end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  };
};

const customerBrief = { select: { companyName: true, firstName: true, lastName: true, code: true } };
const ACTIVE_QUOTES = ['Draft', 'Dërguar', 'Shikuar', 'Në negociatë', 'Pranuar'];
const INSTALLING = ['Në Instalim', 'Në Testim', 'Në Pritje'];

// ─── Paneli i punëtorit (TEKNIK) ────────────────────────────────────────────
async function workerDashboard(c) {
  const user = c.get('session').user;
  const title = 'Paneli i Punëtorit - KRONEER';
  try {
    const { start, end } = dayRange();
    const employee = user ? await prisma.employee.findFirst({ where: { userId: user.id } }) : null;

    const [myProjects, myInterventions, todayAttendance] = await Promise.all([
      prisma.project.findMany({
        where: ownedProjectsWhere(user),
        include: {
          customer: customerBrief,
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
        : [],
      employee
        ? prisma.attendance.findFirst({
            where: { employeeId: employee.id, date: { gte: start, lte: end } },
            orderBy: { id: 'desc' }
          })
        : null
    ]);

    const installingCount = myProjects.reduce(
      (sum, p) => sum + (p.installations || []).filter((i) => INSTALLING.includes(i.status)).length, 0);

    return render(c, 'dashboard/puntori', {
      pageTitle: title,
      employee,
      myProjects,
      myInterventions,
      todayAttendance,
      stats: {
        assignedCount: myProjects.length,
        activeCount: myProjects.filter((p) => p.stage !== 'Përfunduar').length,
        installingCount,
        interventionsCount: myInterventions.length
      }
    });
  } catch (err) {
    console.error('Gabim në ngarkimin e panelit të punëtorit:', err);
    flash(c, 'error', 'Nuk u arrit të ngarkohet paneli i projekteve tuaja.');
    return render(c, 'dashboard/puntori', {
      pageTitle: title,
      employee: null,
      myProjects: [],
      myInterventions: [],
      todayAttendance: null,
      stats: { assignedCount: 0, activeCount: 0, installingCount: 0, interventionsCount: 0 }
    });
  }
}

// ─── Paneli i menaxherit të projektit ───────────────────────────────────────
async function managerDashboard(c) {
  const user = c.get('session').user;
  const title = 'Paneli i Menaxherit të Projektit - KRONEER';
  try {
    const isAdmin = user.role === 'ADMINISTRATOR';
    const queryManager = c.req.query('managerId');
    const targetManagerId = isAdmin && queryManager ? parseInt(queryManager) : user.id;
    const allTeams = isAdmin && !queryManager;
    const { start, end } = dayRange();

    const [myProjects, allManagers] = await Promise.all([
      prisma.project.findMany({
        where: allTeams ? {} : ownedProjectsWhere({ id: targetManagerId, role: 'MENAXHER_PROJEKTI' }),
        include: {
          customer: true,
          teamMembers: { include: { employee: true } },
          interventions: {
            include: { teamWorkers: { include: { employee: true } } },
            orderBy: { date: 'desc' },
            take: 5
          },
          installations: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
        orderBy: { fullName: 'asc' }
      })
    ]);

    const memberIds = [...new Set(myProjects.flatMap((p) => (p.teamMembers || []).map((t) => t.employeeId)))];
    const teamFilter = {
      OR: [{ managerId: targetManagerId }, { id: { in: memberIds.length ? memberIds : [-1] } }]
    };

    const [myTeamEmployees, todayAttendances, myInterventions, recentTransactions] = await Promise.all([
      prisma.employee.findMany({
        where: allTeams ? { status: 'Aktiv' } : teamFilter,
        include: {
          manager: true,
          attendances: { where: { date: { gte: start, lte: end } }, take: 1, orderBy: { id: 'desc' } },
          transactions: { take: 5, orderBy: { date: 'desc' } },
          projectMemberships: { include: { project: true } }
        },
        orderBy: { firstName: 'asc' }
      }),
      prisma.attendance.findMany({ where: { date: { gte: start, lte: end } } }),
      prisma.intervention.findMany({
        where: allTeams ? {} : { projectManagerId: targetManagerId },
        include: {
          project: { include: { customer: true } },
          teamWorkers: { include: { employee: true } }
        },
        orderBy: { date: 'desc' },
        take: 8
      }),
      prisma.employeeTransaction.findMany({
        where: allTeams ? {} : { employee: teamFilter },
        include: { employee: true, project: true },
        orderBy: { date: 'desc' },
        take: 6
      })
    ]);

    const teamIds = new Set(myTeamEmployees.map((e) => e.id));
    const teamToday = todayAttendances.filter((a) => teamIds.has(a.employeeId));
    const sumOf = (types) => recentTransactions.filter((t) => types.includes(t.type)).reduce((s, t) => s + (t.amount || 0), 0);

    return render(c, 'menaxheri/index', {
      pageTitle: title,
      myProjects,
      myTeamEmployees,
      myInterventions,
      recentTransactions,
      allManagers,
      targetManagerId,
      isAdmin,
      stats: {
        totalTeamCount: myTeamEmployees.length,
        workingNowCount: teamToday.filter((a) => a.status === 'Në Punë').length,
        onBreakCount: teamToday.filter((a) => a.status === 'Në Pauzë').length,
        completedTodayCount: teamToday.filter((a) => a.status === 'Përfunduar').length,
        activeProjectsCount: myProjects.filter((p) => p.stage !== 'Përfunduar').length,
        interventionsCount: myInterventions.length,
        totalCashTeam: sumOf(['KESH_AVANC', 'PAGESE_KESH']),
        totalBonusTeam: sumOf(['BONUS'])
      }
    });
  } catch (err) {
    console.error('Gabim në ngarkimin e Panelit të Menaxherit:', err);
    flash(c, 'error', 'Ndodhi një gabim gjatë ngarkimit të panelit.');
    return render(c, 'menaxheri/index', {
      pageTitle: title,
      myProjects: [],
      myTeamEmployees: [],
      myInterventions: [],
      recentTransactions: [],
      allManagers: [],
      targetManagerId: 0,
      isAdmin: false,
      stats: {
        totalTeamCount: 0, workingNowCount: 0, onBreakCount: 0, completedTodayCount: 0,
        activeProjectsCount: 0, interventionsCount: 0, totalCashTeam: 0, totalBonusTeam: 0
      }
    });
  }
}

// ─── Paneli kryesor (ADMINISTRATOR, SHITJE, FINANCE) ────────────────────────
async function mainDashboard(c) {
  const role = c.get('session').user.role;
  const hit = adminCache.get(role);
  if (hit && Date.now() - hit.time < CACHE_TTL) return render(c, 'dashboard/index', hit.data);

  const pageTitle = 'Paneli Kryesor - KRONEER';
  try {
    const [
      payments, unpaid, activeQuotationsCount, activeProjectsCount, installingCount, maintenanceCount,
      recentActivities, recentTickets, recentQuotes,
      contacts, customers, opportunities, quotations, contracts, invoices, paymentsCount,
      projects, installations, handovers, maintenanceTotal
    ] = await Promise.all([
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.invoice.aggregate({ _sum: { balanceDue: true } }),
      prisma.quotation.count({ where: { status: { in: ACTIVE_QUOTES } } }),
      prisma.project.count({ where: { stage: { not: 'Përfunduar' } } }),
      prisma.installation.count({ where: { status: { in: INSTALLING } } }),
      prisma.maintenanceContract.count({ where: { status: { in: ['Aktive', 'Skadon së shpejti'] } } }),
      prisma.activity.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.serviceTicket.findMany({
        where: { status: { in: ['Hapur', 'Caktuar', 'Në proces'] } },
        include: { customer: customerBrief },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.quotation.findMany({ include: { customer: customerBrief }, orderBy: { createdAt: 'desc' }, take: 5 }),
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

    const data = {
      pageTitle,
      stats: {
        totalRevenue: payments._sum.amount || 0,
        activeQuotationsCount,
        activeProjectsCount,
        installingCount,
        unpaidBalance: unpaid._sum.balanceDue || 0,
        maintenanceCount
      },
      monthlySales: [32000, 41500, 38000, 49000, 52000, 68000, 74000, 59000, 71740, 0, 0, 0],
      elevatorTypesBreakdown: {
        labels: ['Lift pasagjerësh', 'Lift shtëpiak', 'Lift panoramik', 'Lift mallrash', 'Lift spitalor', 'Lift shërbimi', 'Platformë ngritëse'],
        data: [42, 18, 14, 10, 8, 5, 3]
      },
      funnelCounts: {
        contacts, customers, opportunities, quotations, contracts, invoices,
        payments: paymentsCount, projects, installations, handovers, maintenance: maintenanceTotal
      },
      recentActivities,
      recentTickets,
      recentQuotes
    };
    adminCache.set(role, { data, time: Date.now() });
    return render(c, 'dashboard/index', data);
  } catch (err) {
    console.error('Gabim në ngarkimin e Dashboard-it:', err);
    flash(c, 'error', 'Nuk u arrit të ngarkohen të dhënat e panelit.');
    return render(c, 'dashboard/index', {
      pageTitle,
      stats: { totalRevenue: 0, activeQuotationsCount: 0, activeProjectsCount: 0, installingCount: 0, unpaidBalance: 0, maintenanceCount: 0 },
      monthlySales: new Array(12).fill(0),
      elevatorTypesBreakdown: { labels: [], data: [] },
      funnelCounts: {},
      recentActivities: [],
      recentTickets: [],
      recentQuotes: []
    });
  }
}

dashboard.get('/paneli', requireAuth, (c) => {
  const role = c.get('session').user.role;
  if (role === 'MENAXHER_PROJEKTI') return managerDashboard(c);
  if (role === 'TEKNIK') return workerDashboard(c);
  return mainDashboard(c);
});

dashboard.get('/menaxheri', authorize('ADMINISTRATOR', 'MENAXHER_PROJEKTI'), managerDashboard);
