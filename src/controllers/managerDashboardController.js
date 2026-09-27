const prisma = require('../config/prisma');

function getStartAndEndOfDay() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

class ManagerDashboardController {
  // Paneli Ekskluziv i Menaxherit të Projektit
  static async getIndex(req, res) {
    try {
      const user = req.session.user;
      const managerId = user ? user.id : 0;
      const isAdmin = user && user.role === 'ADMINISTRATOR';

      // Nëse është Admin, mund të shikojë panelin për një menaxher të zgjedhur ose të gjithë
      const targetManagerId = (isAdmin && req.query.managerId) ? parseInt(req.query.managerId) : managerId;

      const { start, end } = getStartAndEndOfDay();

      // 1. Merr projektet e këtij menaxheri
      const projectWhere = isAdmin && !req.query.managerId ? {} : { projectManagerId: targetManagerId };

      const [myProjects, allManagers] = await Promise.all([
        prisma.project.findMany({
          where: projectWhere,
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

      // Mbledh ID-të e punëtorëve që bëjnë pjesë në ekipin e këtij menaxheri
      const projectMemberEmployeeIds = [];
      myProjects.forEach(p => {
        if (p.teamMembers) {
          p.teamMembers.forEach(tm => {
            if (!projectMemberEmployeeIds.includes(tm.employeeId)) {
              projectMemberEmployeeIds.push(tm.employeeId);
            }
          });
        }
      });

      // Kushti për punëtorët e ekipit:
      // A) Ose managerId është ky menaxher
      // B) Ose punëtori është caktuar në projektet e këtij menaxheri
      const employeeWhere = isAdmin && !req.query.managerId
        ? { status: 'Aktiv' }
        : {
            OR: [
              { managerId: targetManagerId },
              { id: { in: projectMemberEmployeeIds.length > 0 ? projectMemberEmployeeIds : [-1] } }
            ]
          };

      const [myTeamEmployees, todayAttendances, myInterventions, recentTransactions] = await Promise.all([
        prisma.employee.findMany({
          where: employeeWhere,
          include: {
            manager: true,
            attendances: {
              where: { date: { gte: start, lte: end } },
              take: 1,
              orderBy: { id: 'desc' }
            },
            transactions: {
              take: 5,
              orderBy: { date: 'desc' }
            },
            projectMemberships: {
              include: { project: true }
            }
          },
          orderBy: { firstName: 'asc' }
        }),
        prisma.attendance.findMany({
          where: { date: { gte: start, lte: end } }
        }),
        prisma.intervention.findMany({
          where: isAdmin && !req.query.managerId ? {} : { projectManagerId: targetManagerId },
          include: {
            project: { include: { customer: true } },
            teamWorkers: { include: { employee: true } }
          },
          orderBy: { date: 'desc' },
          take: 8
        }),
        prisma.employeeTransaction.findMany({
          where: isAdmin && !req.query.managerId
            ? {}
            : {
                employee: {
                  OR: [
                    { managerId: targetManagerId },
                    { id: { in: projectMemberEmployeeIds.length > 0 ? projectMemberEmployeeIds : [-1] } }
                  ]
                }
              },
          include: { employee: true, project: true },
          orderBy: { date: 'desc' },
          take: 6
        })
      ]);

      // Statistikat e Ekipit të Menaxherit
      const teamEmployeeIds = myTeamEmployees.map(e => e.id);
      const teamAttendancesToday = todayAttendances.filter(a => teamEmployeeIds.includes(a.employeeId));

      const workingNowCount = teamAttendancesToday.filter(a => a.status === 'Në Punë').length;
      const onBreakCount = teamAttendancesToday.filter(a => a.status === 'Në Pauzë').length;
      const completedTodayCount = teamAttendancesToday.filter(a => a.status === 'Përfunduar').length;

      // Totali i keshit dhe bonuseve të dhëna për ekipin e tij këtë muaj
      const totalCashTeam = recentTransactions
        .filter(t => t.type === 'KESH_AVANC' || t.type === 'PAGESE_KESH')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalBonusTeam = recentTransactions
        .filter(t => t.type === 'BONUS')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      res.render('menaxheri/index', {
        pageTitle: 'Paneli i Menaxherit të Projektit - KRONEER',
        myProjects,
        myTeamEmployees,
        myInterventions,
        recentTransactions,
        allManagers,
        targetManagerId,
        isAdmin,
        stats: {
          totalTeamCount: myTeamEmployees.length,
          workingNowCount,
          onBreakCount,
          completedTodayCount,
          activeProjectsCount: myProjects.filter(p => p.stage !== 'Përfunduar').length,
          interventionsCount: myInterventions.length,
          totalCashTeam,
          totalBonusTeam
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e Panelit të Menaxherit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ngarkimit të panelit.');
      return res.render('menaxheri/index', {
        pageTitle: 'Paneli i Menaxherit të Projektit - KRONEER',
        myProjects: [],
        myTeamEmployees: [],
        myInterventions: [],
        recentTransactions: [],
        allManagers: [],
        targetManagerId: 0,
        isAdmin: false,
        stats: {
          totalTeamCount: 0,
          workingNowCount: 0,
          onBreakCount: 0,
          completedTodayCount: 0,
          activeProjectsCount: 0,
          interventionsCount: 0,
          totalCashTeam: 0,
          totalBonusTeam: 0
        }
      });
    }
  }
}

module.exports = ManagerDashboardController;
