const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

function getStartAndEndOfDay(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end, dateObj: d };
}

class EmployeeController {
  // 1. Lista Kryesore e Puntorëve
  static async getIndex(req, res) {
    try {
      const { kerko, departamenti, statusi } = req.query;

      const where = {};
      if (statusi && statusi !== 'te-gjitha') {
        where.status = statusi;
      }
      if (departamenti && departamenti !== 'te-gjitha') {
        where.department = departamenti;
      }
      if (kerko && kerko.trim()) {
        const q = kerko.trim();
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { position: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } }
        ];
      }

      const [employees, allEmployeesCount, todayAttendances] = await Promise.all([
        prisma.employee.findMany({
          where,
          include: {
            user: true,
            attendances: {
              where: {
                date: {
                  gte: getStartAndEndOfDay().start,
                  lte: getStartAndEndOfDay().end
                }
              },
              take: 1,
              orderBy: { id: 'desc' }
            }
          },
          orderBy: [{ status: 'asc' }, { firstName: 'asc' }]
        }),
        prisma.employee.count(),
        prisma.attendance.findMany({
          where: {
            date: {
              gte: getStartAndEndOfDay().start,
              lte: getStartAndEndOfDay().end
            }
          }
        })
      ]);

      // Statistika të përgjithshme sot
      const stats = {
        total: allEmployeesCount,
        active: employees.filter(e => e.status === 'Aktiv').length,
        workingNow: todayAttendances.filter(a => a.status === 'Në Punë').length,
        onBreakNow: todayAttendances.filter(a => a.status === 'Në Pauzë').length,
        completedToday: todayAttendances.filter(a => a.status === 'Përfunduar').length
      };

      const departments = [
        'Instalime & Montim',
        'Mirëmbajtje & Servis',
        'Inxhinieri & Projektim',
        'Shitje & Menaxhim',
        'Administratë & Financa',
        'Logjistikë & Magazinë'
      ];

      res.render('puntoret/index', {
        pageTitle: 'Puntorët & Stafi - KRONEER',
        employees,
        stats,
        departments,
        filters: {
          kerko: kerko || '',
          departamenti: departamenti || 'te-gjitha',
          statusi: statusi || 'te-gjitha'
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e listës së puntorëve:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ngarkimit të puntorëve.');
      res.redirect('/paneli');
    }
  }

  // 2. Faqja e Regjistrimit të Puntorit
  static async getCreate(req, res) {
    try {
      const [nextCode, users, managers] = await Promise.all([
        NumberService.getNextNumber('employee'),
        prisma.user.findMany({
          where: { isActive: true },
          include: { employee: true },
          orderBy: { fullName: 'asc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        })
      ]);

      // Përdoruesit e papërdorur nga puntorë të tjerë
      const availableUsers = users.filter(u => !u.employee);

      const departments = [
        'Instalime & Montim',
        'Mirëmbajtje & Servis',
        'Inxhinieri & Projektim',
        'Shitje & Menaxhim',
        'Administratë & Financa',
        'Logjistikë & Magazinë'
      ];

      const positions = [
        'Kryeteknik Montimi',
        'Teknik Montimi i Lifteve',
        'Inxhinier Elektrik / Mekanik',
        'Teknik Mirëmbajtjeje & Servisi',
        'Ndihmës Teknik',
        'Menaxher Projekti & Kantieri',
        'Përfaqësues Shitjesh',
        'Zyrtar Financiar',
        'Shofer / Logjistikë',
        'Drejtor Teknik'
      ];

      res.render('puntoret/krijo', {
        pageTitle: 'Regjistro Puntor të Ri - KRONEER',
        nextCode,
        availableUsers,
        managers,
        departments,
        positions
      });
    } catch (err) {
      console.error('Gabim në hapjen e faqes së krijimit të puntorit:', err);
      req.flash('error', 'Nuk u arrit të hapet forma e regjistrimit.');
      res.redirect('/puntoret');
    }
  }

  // 3. Ruajtja e Puntorit të Ri
  static async postCreate(req, res) {
    try {
      const {
        firstName, lastName, personalNumber, email, phone,
        position, department, status,
        shiftStart, shiftEnd, breakMinutes,
        hourlyRate, monthlySalary, hireDate, notes, userId, managerId
      } = req.body;

      if (!firstName || !lastName || !position) {
        req.flash('error', 'Ju lutem plotësoni fushat e detyrueshme (Emri, Mbiemri, Pozita).');
        return res.redirect('/puntoret/krijo');
      }

      const code = await NumberService.getNextNumber('employee');

      const employee = await prisma.employee.create({
        data: {
          code,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          personalNumber: personalNumber ? personalNumber.trim() : null,
          email: email ? email.trim() : null,
          phone: phone ? phone.trim() : null,
          position: position.trim(),
          department: department || 'Instalime & Montim',
          status: status || 'Aktiv',
          shiftStart: shiftStart || '08:00',
          shiftEnd: shiftEnd || '17:00',
          breakMinutes: parseInt(breakMinutes) || 60,
          hourlyRate: parseFloat(hourlyRate) || 0,
          monthlySalary: parseFloat(monthlySalary) || 0,
          hireDate: hireDate ? new Date(hireDate) : new Date(),
          notes: notes ? notes.trim() : null,
          userId: userId ? parseInt(userId) : null,
          managerId: managerId ? parseInt(managerId) : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Puntor',
        entityId: employee.id,
        description: `U regjistrua puntori i ri ${employee.firstName} ${employee.lastName} (${employee.code}) - ${employee.position}.`
      });

      req.flash('success', `Puntori ${employee.firstName} ${employee.lastName} u regjistrua me sukses!`);
      res.redirect(`/puntoret/${employee.id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e puntorit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së puntorit.');
      res.redirect('/puntoret/krijo');
    }
  }

  // 4. Detajet & Profili i Puntorit me Historikun, Keshin & Bonuset
  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { muaji, viti } = req.query;

      const now = new Date();
      const selectedYear = parseInt(viti) || now.getFullYear();
      const selectedMonth = parseInt(muaji) || (now.getMonth() + 1);

      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

      const [employee, activeProjects] = await Promise.all([
        prisma.employee.findUnique({
          where: { id },
          include: {
            user: true,
            manager: true,
            attendances: {
              where: {
                date: {
                  gte: startOfMonth,
                  lte: endOfMonth
                }
              },
              orderBy: { date: 'desc' }
            },
            transactions: {
              include: {
                project: true,
                intervention: true
              },
              orderBy: { date: 'desc' }
            },
            projectMemberships: {
              include: {
                project: {
                  include: { customer: true }
                }
              },
              orderBy: { assignedAt: 'desc' }
            },
            interventionAssignments: {
              include: {
                intervention: {
                  include: {
                    project: true,
                    projectManager: true
                  }
                }
              },
              orderBy: { id: 'desc' },
              take: 20
            }
          }
        }),
        prisma.project.findMany({
          where: { stage: { not: 'Përfunduar' } },
          orderBy: { name: 'asc' }
        })
      ]);

      if (!employee) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect('/puntoret');
      }

      // Regjistrimi i sotëm
      const todayAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId: id,
          date: {
            gte: getStartAndEndOfDay().start,
            lte: getStartAndEndOfDay().end
          }
        },
        orderBy: { id: 'desc' }
      });

      // Statistikat mujore të puntorit
      const totalDaysWorked = employee.attendances.filter(a => a.checkIn).length;
      const totalWorkedHours = employee.attendances.reduce((acc, a) => acc + (a.workedHours || 0), 0);
      const totalOvertimeMinutes = employee.attendances.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0);
      const totalBreakMinutes = employee.attendances.reduce((acc, a) => acc + (a.totalBreakMinutes || 0), 0);
      const avgHoursPerDay = totalDaysWorked > 0 ? (totalWorkedHours / totalDaysWorked).toFixed(1) : '0';

      // Statistikat Financiare (Bonuse & Kesh)
      const totalBonuses = employee.transactions
        .filter(t => t.type === 'BONUS')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalCashAdvances = employee.transactions
        .filter(t => t.type === 'KESH_AVANC' || t.type === 'PAGESE_KESH')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalDeductions = employee.transactions
        .filter(t => t.type === 'ZBRITJE')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const baseSalary = employee.monthlySalary || 0;
      const netPayableEstimated = Math.max(0, baseSalary + totalBonuses - totalCashAdvances - totalDeductions);

      const stats = {
        totalDaysWorked,
        totalWorkedHours: totalWorkedHours.toFixed(1),
        totalOvertimeHours: (totalOvertimeMinutes / 60).toFixed(1),
        totalBreakHours: (totalBreakMinutes / 60).toFixed(1),
        avgHoursPerDay,
        totalBonuses,
        totalCashAdvances,
        totalDeductions,
        baseSalary,
        netPayableEstimated
      };

      res.render('puntoret/detajet', {
        pageTitle: `${employee.firstName} ${employee.lastName} (${employee.code}) - KRONEER`,
        employee,
        todayAttendance,
        activeProjects,
        stats,
        selectedMonth,
        selectedYear
      });
    } catch (err) {
      console.error('Gabim në hapjen e profilit të puntorit:', err);
      req.flash('error', 'Nuk u arrit të hapet profili i puntorit.');
      res.redirect('/puntoret');
    }
  }

  // 5. Faqja e Editimit të Puntorit
  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [employee, users, managers] = await Promise.all([
        prisma.employee.findUnique({
          where: { id },
          include: { user: true, manager: true }
        }),
        prisma.user.findMany({
          where: { isActive: true },
          include: { employee: true },
          orderBy: { fullName: 'asc' }
        }),
        prisma.user.findMany({
          where: { isActive: true, role: { in: ['MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } },
          orderBy: { fullName: 'asc' }
        })
      ]);

      if (!employee) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect('/puntoret');
      }

      // Përdoruesit e lirë ose përdoruesi aktual i këtij puntori
      const availableUsers = users.filter(u => !u.employee || u.employee.id === id);

      const departments = [
        'Instalime & Montim',
        'Mirëmbajtje & Servis',
        'Inxhinieri & Projektim',
        'Shitje & Menaxhim',
        'Administratë & Financa',
        'Logjistikë & Magazinë'
      ];

      const positions = [
        'Kryeteknik Montimi',
        'Teknik Montimi i Lifteve',
        'Inxhinier Elektrik / Mekanik',
        'Teknik Mirëmbajtjeje & Servisi',
        'Ndihmës Teknik',
        'Menaxher Projekti & Kantieri',
        'Përfaqësues Shitjesh',
        'Zyrtar Financiar',
        'Shofer / Logjistikë',
        'Drejtor Teknik'
      ];

      res.render('puntoret/ndrysho', {
        pageTitle: `Ndrysho ${employee.firstName} ${employee.lastName} - KRONEER`,
        employee,
        availableUsers,
        managers,
        departments,
        positions
      });
    } catch (err) {
      console.error('Gabim në hapjen e editimit të puntorit:', err);
      req.flash('error', 'Nuk u arrit të hapet faqja e editimit.');
      res.redirect('/puntoret');
    }
  }

  // 6. Ruajtja e Ndryshimeve të Puntorit
  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        firstName, lastName, personalNumber, email, phone,
        position, department, status,
        shiftStart, shiftEnd, breakMinutes,
        hourlyRate, monthlySalary, hireDate, notes, userId, managerId
      } = req.body;

      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect('/puntoret');
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          firstName: firstName ? firstName.trim() : existing.firstName,
          lastName: lastName ? lastName.trim() : existing.lastName,
          personalNumber: personalNumber !== undefined ? personalNumber.trim() : existing.personalNumber,
          email: email !== undefined ? email.trim() : existing.email,
          phone: phone !== undefined ? phone.trim() : existing.phone,
          position: position ? position.trim() : existing.position,
          department: department || existing.department,
          status: status || existing.status,
          shiftStart: shiftStart || existing.shiftStart,
          shiftEnd: shiftEnd || existing.shiftEnd,
          breakMinutes: parseInt(breakMinutes) || existing.breakMinutes,
          hourlyRate: parseFloat(hourlyRate) >= 0 ? parseFloat(hourlyRate) : existing.hourlyRate,
          monthlySalary: parseFloat(monthlySalary) >= 0 ? parseFloat(monthlySalary) : existing.monthlySalary,
          hireDate: hireDate ? new Date(hireDate) : existing.hireDate,
          notes: notes !== undefined ? notes.trim() : existing.notes,
          userId: userId ? parseInt(userId) : null,
          managerId: managerId ? parseInt(managerId) : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Puntor',
        entityId: id,
        description: `U përditësuan të dhënat e puntorit ${updated.firstName} ${updated.lastName} (${updated.code}).`
      });

      req.flash('success', `Të dhënat e puntorit ${updated.firstName} ${updated.lastName} u përditësuan me sukses.`);
      res.redirect(`/puntoret/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e ndryshimeve të puntorit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së të dhënave.');
      res.redirect(`/puntoret/${req.params.id}/ndrysho`);
    }
  }

  // 7. Fshirja e Puntorit
  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const employee = await prisma.employee.findUnique({ where: { id } });

      if (!employee) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect('/puntoret');
      }

      await prisma.employee.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Puntor',
        entityId: id,
        description: `Puntori ${employee.firstName} ${employee.lastName} (${employee.code}) u fshi nga sistemi.`
      });

      req.flash('success', `Puntori ${employee.firstName} ${employee.lastName} u fshi me sukses.`);
      res.redirect('/puntoret');
    } catch (err) {
      console.error('Gabim gjatë fshirjes së puntorit:', err);
      req.flash('error', 'Nuk mund të fshihet puntori.');
      res.redirect('/puntoret');
    }
  }

  // =========================================================================
  // 8. Paneli i Prezencës & Orarit të Punës (Attendance Software Dashboard)
  // =========================================================================
  static async getAttendanceDashboard(req, res) {
    try {
      const { data, departamenti, puntoriId } = req.query;

      const dateTarget = data ? new Date(data) : new Date();
      const { start, end } = getStartAndEndOfDay(dateTarget);

      const whereEmployee = { status: 'Aktiv' };
      if (departamenti && departamenti !== 'te-gjitha') {
        whereEmployee.department = departamenti;
      }
      if (puntoriId && puntoriId !== 'te-gjitha') {
        whereEmployee.id = parseInt(puntoriId);
      }

      const [employees, allActiveEmployees, attendancesToday] = await Promise.all([
        prisma.employee.findMany({
          where: whereEmployee,
          include: {
            user: true,
            attendances: {
              where: {
                date: { gte: start, lte: end }
              },
              take: 1,
              orderBy: { id: 'desc' }
            }
          },
          orderBy: { firstName: 'asc' }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        prisma.attendance.findMany({
          where: {
            date: { gte: start, lte: end }
          },
          include: { employee: true },
          orderBy: { checkIn: 'desc' }
        })
      ]);

      // Bashkimi i të dhënave për tabelën e ditës
      const liveEmployeeBoard = employees.map(emp => {
        const att = emp.attendances && emp.attendances[0] ? emp.attendances[0] : null;
        return {
          employee: emp,
          attendance: att,
          status: att ? att.status : 'Pa Regjistrim'
        };
      });

      // Statistika të ditës
      const workingCount = attendancesToday.filter(a => a.status === 'Në Punë').length;
      const onBreakCount = attendancesToday.filter(a => a.status === 'Në Pauzë').length;
      const completedCount = attendancesToday.filter(a => a.status === 'Përfunduar').length;
      const totalHoursDone = attendancesToday.reduce((acc, a) => acc + (a.workedHours || 0), 0);
      const totalOvertimeMin = attendancesToday.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0);

      const departments = [
        'Instalime & Montim',
        'Mirëmbajtje & Servis',
        'Inxhinieri & Projektim',
        'Shitje & Menaxhim',
        'Administratë & Financa',
        'Logjistikë & Magazinë'
      ];

      // Gjej nëse përdoruesi i kyçur aktual ka lidhje me një puntor
      let currentLoggedEmployee = null;
      if (req.session.user) {
        currentLoggedEmployee = await prisma.employee.findFirst({
          where: { userId: req.session.user.id }
        });
      }

      res.render('puntoret/prezenca', {
        pageTitle: 'Prezenca & Orari i Punës (Attendance) - KRONEER',
        liveEmployeeBoard,
        attendancesToday,
        allActiveEmployees,
        currentLoggedEmployee,
        selectedDate: dateTarget.toISOString().split('T')[0],
        departments,
        stats: {
          totalActive: allActiveEmployees.length,
          workingCount,
          onBreakCount,
          completedCount,
          notCheckedIn: Math.max(0, allActiveEmployees.length - (workingCount + onBreakCount + completedCount)),
          totalHoursDone: totalHoursDone.toFixed(1),
          totalOvertimeHours: (totalOvertimeMin / 60).toFixed(1)
        },
        filters: {
          data: data || dateTarget.toISOString().split('T')[0],
          departamenti: departamenti || 'te-gjitha',
          puntoriId: puntoriId || 'te-gjitha'
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e panelit të prezencës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë hapjes së modulit të prezencës.');
      res.redirect('/paneli');
    }
  }

  // 9. Veprimi: Nis Punën (Clock In)
  static async postClockIn(req, res) {
    try {
      const { employeeId, location, notes } = req.body;
      const empId = parseInt(employeeId);

      if (!empId) {
        req.flash('error', 'Ju lutem zgjidhni puntorin.');
        return res.redirect(req.get('referer') || '/prezenca');
      }

      const employee = await prisma.employee.findUnique({ where: { id: empId } });
      if (!employee) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect(req.get('referer') || '/prezenca');
      }

      const { start, end } = getStartAndEndOfDay();
      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: empId,
          date: { gte: start, lte: end }
        }
      });

      const now = new Date();

      if (existing) {
        if (existing.status === 'Në Punë' || existing.status === 'Në Pauzë') {
          req.flash('error', `${employee.firstName} ${employee.lastName} tashmë e ka nisur punën sot.`);
          return res.redirect(req.get('referer') || '/prezenca');
        }
        // Nëse ishte i përfunduar dhe dëshiron të rinisë
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkIn: existing.checkIn || now,
            checkOut: null,
            status: 'Në Punë',
            location: location || existing.location || 'Zyra Qendrore',
            notes: notes ? (existing.notes ? `${existing.notes} | ${notes}` : notes) : existing.notes
          }
        });
      } else {
        await prisma.attendance.create({
          data: {
            employeeId: empId,
            date: now,
            checkIn: now,
            status: 'Në Punë',
            location: location || 'Zyra Qendrore',
            notes: notes || null
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Prezencë',
        entityType: 'Puntor',
        entityId: empId,
        description: `${employee.firstName} ${employee.lastName} nisi punën më ${now.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })} (${location || 'Zyra Qendrore'}).`
      });

      req.flash('success', `U regjistrua nisja e punës për ${employee.firstName} ${employee.lastName} në orën ${now.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}.`);
      res.redirect(req.get('referer') || '/prezenca');
    } catch (err) {
      console.error('Gabim në nisjen e punës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë regjistrimit të nisjes së punës.');
      res.redirect(req.get('referer') || '/prezenca');
    }
  }

  // 10. Veprimi: Nis Pauzën (Start Break)
  static async postStartBreak(req, res) {
    try {
      const { employeeId } = req.body;
      const empId = parseInt(employeeId);

      const { start, end } = getStartAndEndOfDay();
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: empId,
          date: { gte: start, lte: end }
        },
        include: { employee: true }
      });

      if (!attendance || attendance.status !== 'Në Punë') {
        req.flash('error', 'Puntori duhet të jetë aktiv në punë për të nisur pauzën.');
        return res.redirect(req.get('referer') || '/prezenca');
      }

      const now = new Date();
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          breakStart: now,
          status: 'Në Pauzë'
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Prezencë',
        entityType: 'Puntor',
        entityId: empId,
        description: `${attendance.employee.firstName} ${attendance.employee.lastName} nisi pauzën në orën ${now.toLocaleTimeString('sq-AL', { hour: '2-digit', minute: '2-digit' })}.`
      });

      req.flash('success', `${attendance.employee.firstName} ${attendance.employee.lastName} nisi pauzën.`);
      res.redirect(req.get('referer') || '/prezenca');
    } catch (err) {
      console.error('Gabim në nisjen e pauzës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë nisjes së pauzës.');
      res.redirect(req.get('referer') || '/prezenca');
    }
  }

  // 11. Veprimi: Përfundo Pauzën (End Break / Resume Work)
  static async postEndBreak(req, res) {
    try {
      const { employeeId } = req.body;
      const empId = parseInt(employeeId);

      const { start, end } = getStartAndEndOfDay();
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: empId,
          date: { gte: start, lte: end }
        },
        include: { employee: true }
      });

      if (!attendance || attendance.status !== 'Në Pauzë') {
        req.flash('error', 'Puntori nuk është aktualisht në pauzë.');
        return res.redirect(req.get('referer') || '/prezenca');
      }

      const now = new Date();
      let additionalBreakMin = 0;
      if (attendance.breakStart) {
        additionalBreakMin = Math.max(1, Math.round((now.getTime() - new Date(attendance.breakStart).getTime()) / 60000));
      }

      const totalBreakMinutes = (attendance.totalBreakMinutes || 0) + additionalBreakMin;

      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          breakEnd: now,
          breakStart: null,
          totalBreakMinutes,
          status: 'Në Punë'
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Prezencë',
        entityType: 'Puntor',
        entityId: empId,
        description: `${attendance.employee.firstName} ${attendance.employee.lastName} përfundoi pauzën (${additionalBreakMin} min).`
      });

      req.flash('success', `${attendance.employee.firstName} ${attendance.employee.lastName} u kthye në punë (Pauza zgjati: ${additionalBreakMin} min).`);
      res.redirect(req.get('referer') || '/prezenca');
    } catch (err) {
      console.error('Gabim në përfundimin e pauzës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë përfundimit të pauzës.');
      res.redirect(req.get('referer') || '/prezenca');
    }
  }

  // 12. Veprimi: Përfundo Punën (Clock Out)
  static async postClockOut(req, res) {
    try {
      const { employeeId, notes } = req.body;
      const empId = parseInt(employeeId);

      const { start, end } = getStartAndEndOfDay();
      const attendance = await prisma.attendance.findFirst({
        where: {
          employeeId: empId,
          date: { gte: start, lte: end }
        },
        include: { employee: true }
      });

      if (!attendance || !attendance.checkIn) {
        req.flash('error', 'Nuk u gjet regjistrim aktiv i hyrjes për këtë puntor sot.');
        return res.redirect(req.get('referer') || '/prezenca');
      }

      const now = new Date();
      let totalBreak = attendance.totalBreakMinutes || 0;

      // Nëse ishte ende në pauzë kur preku Clock Out, mbyll pauzën
      if (attendance.status === 'Në Pauzë' && attendance.breakStart) {
        const extraBreak = Math.max(1, Math.round((now.getTime() - new Date(attendance.breakStart).getTime()) / 60000));
        totalBreak += extraBreak;
      }

      const checkInTime = new Date(attendance.checkIn);
      const totalSpanMinutes = Math.max(0, Math.round((now.getTime() - checkInTime.getTime()) / 60000));
      const workedMin = Math.max(0, totalSpanMinutes - totalBreak);
      const workedHours = parseFloat((workedMin / 60).toFixed(2));
      const overtimeMin = workedMin > (8 * 60) ? workedMin - (8 * 60) : 0;

      await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: now,
          breakStart: null,
          breakEnd: attendance.breakEnd || now,
          totalBreakMinutes: totalBreak,
          workedMinutes: workedMin,
          workedHours,
          overtimeMinutes: overtimeMin,
          status: 'Përfunduar',
          notes: notes ? (attendance.notes ? `${attendance.notes} | ${notes}` : notes) : attendance.notes
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Prezencë',
        entityType: 'Puntor',
        entityId: empId,
        description: `${attendance.employee.firstName} ${attendance.employee.lastName} përfundoi turnin: ${workedHours} orë pune, ${totalBreak} min pauzë.`
      });

      req.flash('success', `${attendance.employee.firstName} ${attendance.employee.lastName} përfundoi punën me sukses (${workedHours} orë pune).`);
      res.redirect(req.get('referer') || '/prezenca');
    } catch (err) {
      console.error('Gabim në përfundimin e punës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë mbylljes së orarit të punës.');
      res.redirect(req.get('referer') || '/prezenca');
    }
  }

  // 13. Regjistrimi / Modifikimi Manual i Prezencës nga Administratori
  static async postManualAttendance(req, res) {
    try {
      const { employeeId, date, checkIn, checkOut, totalBreakMinutes, status, location, notes } = req.body;
      const empId = parseInt(employeeId);

      if (!empId || !date) {
        req.flash('error', 'Ju lutem plotësoni puntorin dhe datën.');
        return res.redirect('/prezenca');
      }

      const targetDate = new Date(date);
      const { start, end } = getStartAndEndOfDay(targetDate);

      let checkInDate = null;
      let checkOutDate = null;

      if (checkIn) {
        const [h, m] = checkIn.split(':');
        checkInDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), parseInt(h), parseInt(m), 0);
      }
      if (checkOut) {
        const [h, m] = checkOut.split(':');
        checkOutDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), parseInt(h), parseInt(m), 0);
      }

      const breakMin = parseInt(totalBreakMinutes) || 0;
      let workedMin = 0;
      let workedHours = 0;
      let overtimeMin = 0;

      if (checkInDate && checkOutDate) {
        const totalSpan = Math.max(0, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 60000));
        workedMin = Math.max(0, totalSpan - breakMin);
        workedHours = parseFloat((workedMin / 60).toFixed(2));
        overtimeMin = workedMin > (8 * 60) ? workedMin - (8 * 60) : 0;
      }

      const existing = await prisma.attendance.findFirst({
        where: {
          employeeId: empId,
          date: { gte: start, lte: end }
        }
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkIn: checkInDate || existing.checkIn,
            checkOut: checkOutDate || existing.checkOut,
            totalBreakMinutes: breakMin,
            workedMinutes: workedMin,
            workedHours,
            overtimeMinutes: overtimeMin,
            status: status || (checkOutDate ? 'Përfunduar' : (checkInDate ? 'Në Punë' : 'Pa Regjistrim')),
            location: location || existing.location,
            notes: notes || existing.notes
          }
        });
      } else {
        await prisma.attendance.create({
          data: {
            employeeId: empId,
            date: targetDate,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            totalBreakMinutes: breakMin,
            workedMinutes: workedMin,
            workedHours,
            overtimeMinutes: overtimeMin,
            status: status || (checkOutDate ? 'Përfunduar' : 'Në Punë'),
            location: location || 'Zyra Qendrore',
            notes: notes || null
          }
        });
      }

      req.flash('success', 'Të dhënat e prezencës u ruajtën me sukses!');
      res.redirect('/prezenca');
    } catch (err) {
      console.error('Gabim në ruajtjen manuale të prezencës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes manuale.');
      res.redirect('/prezenca');
    }
  }

  // 14. Fshirja e një Regjistrimi të Prezencës
  static async postDeleteAttendance(req, res) {
    try {
      const id = parseInt(req.params.id);
      await prisma.attendance.delete({ where: { id } });
      req.flash('success', 'Regjistrimi i prezencës u fshi.');
      res.redirect(req.get('referer') || '/prezenca');
    } catch (err) {
      console.error('Gabim në fshirjen e prezencës:', err);
      req.flash('error', 'Nuk u arrit të fshihet regjistrimi.');
      res.redirect(req.get('referer') || '/prezenca');
    }
  }

  // 15. Raporti Zyrtar Mujor i Prezencës për Printim / PDF
  static async getAttendancePrint(req, res) {
    try {
      const { muaji, viti, departamenti } = req.query;

      const now = new Date();
      const selectedYear = parseInt(viti) || now.getFullYear();
      const selectedMonth = parseInt(muaji) || (now.getMonth() + 1);

      const startOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      const endOfMonth = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);

      const whereEmp = { status: 'Aktiv' };
      if (departamenti && departamenti !== 'te-gjitha') {
        whereEmp.department = departamenti;
      }

      const [company, employees] = await Promise.all([
        prisma.companySettings.findFirst(),
        prisma.employee.findMany({
          where: whereEmp,
          include: {
            attendances: {
              where: {
                date: { gte: startOfMonth, lte: endOfMonth }
              },
              orderBy: { date: 'asc' }
            }
          },
          orderBy: { firstName: 'asc' }
        })
      ]);

      const monthNames = [
        'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
        'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
      ];

      // Përmbledhje për çdo puntor
      const employeeSummaries = employees.map(emp => {
        const daysWorked = emp.attendances.filter(a => a.checkIn).length;
        const totalWorkedH = emp.attendances.reduce((acc, a) => acc + (a.workedHours || 0), 0);
        const totalOvertimeM = emp.attendances.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0);
        const totalBreakM = emp.attendances.reduce((acc, a) => acc + (a.totalBreakMinutes || 0), 0);
        return {
          employee: emp,
          daysWorked,
          totalHours: totalWorkedH.toFixed(1),
          overtimeHours: (totalOvertimeM / 60).toFixed(1),
          breakHours: (totalBreakM / 60).toFixed(1),
          salaryEstimated: emp.monthlySalary ? emp.monthlySalary : (emp.hourlyRate ? (emp.hourlyRate * totalWorkedH).toFixed(2) : 0)
        };
      });

      res.render('puntoret/print-raport', {
        pageTitle: `Raporti_Prezences_${monthNames[selectedMonth - 1]}_${selectedYear}`,
        company: company || {},
        employeeSummaries,
        selectedMonth,
        selectedYear,
        monthName: monthNames[selectedMonth - 1],
        departamenti: departamenti || 'Të gjitha departamentet',
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në gjenerimin e raportit të printimit:', err);
      res.status(500).send('Gabim gjatë përgatitjes së raportit të prezencës.');
    }
  }

  // =========================================================================
  // 16. Menaxhimi i Keshit & Bonuseve (Cash Advance & Bonuses)
  // =========================================================================
  static async postAddTransaction(req, res) {
    try {
      const {
        employeeId,
        type, // 'KESH_AVANC', 'PAGESE_KESH', 'BONUS', 'ZBRITJE'
        category,
        amount,
        title,
        notes,
        date,
        projectId,
        interventionId,
        paymentMethod
      } = req.body;

      const empId = parseInt(employeeId);
      const parsedAmount = parseFloat(amount);

      if (!empId || !parsedAmount || parsedAmount <= 0) {
        req.flash('error', 'Ju lutem plotësoni puntorin dhe një shumë valide më të madhe se 0.');
        return res.redirect(req.get('referer') || `/puntoret/${empId}`);
      }

      const employee = await prisma.employee.findUnique({ where: { id: empId } });
      if (!employee) {
        req.flash('error', 'Puntori nuk u gjet.');
        return res.redirect('/puntoret');
      }

      // Gjenerimi i numrit serik sipas llojit
      const isBonus = type === 'BONUS';
      const number = await NumberService.getNextNumber(isBonus ? 'employee_bonus' : 'employee_cash');

      const defaultTitle = isBonus
        ? `Bonus për ${employee.firstName} ${employee.lastName} (${category || 'Performancë'})`
        : `Pagesë Kesh / Avancë për ${employee.firstName} ${employee.lastName}`;

      const transaction = await prisma.employeeTransaction.create({
        data: {
          number,
          employeeId: empId,
          type: type || 'KESH_AVANC',
          category: category || (isBonus ? 'Bonus Projekti / Montimi' : 'Avancë Terreni'),
          amount: parsedAmount,
          currency: 'EUR',
          date: date ? new Date(date) : new Date(),
          title: title ? title.trim() : defaultTitle,
          notes: notes ? notes.trim() : null,
          status: 'Paguar',
          paymentMethod: paymentMethod || 'Para në dorë (Cash)',
          projectId: projectId ? parseInt(projectId) : null,
          interventionId: interventionId ? parseInt(interventionId) : null,
          recordedBy: req.session.user?.fullName || 'Administrator'
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Pagesë',
        entityType: 'Puntor',
        entityId: empId,
        description: `U regjistrua ${isBonus ? 'Bonus' : 'Kesh/Avancë'} prej ${parsedAmount}€ (${transaction.number}) për ${employee.firstName} ${employee.lastName}.`
      });

      req.flash('success', `${isBonus ? 'Bonusi' : 'Keshi/Avanca'} prej ${parsedAmount}€ (${transaction.number}) u regjistrua me sukses për ${employee.firstName} ${employee.lastName}!`);
      res.redirect(req.get('referer') || `/puntoret/${empId}`);
    } catch (err) {
      console.error('Gabim në shtimin e transaksionit të keshit/bonusit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë regjistrimit të transaksionit.');
      res.redirect(req.get('referer') || '/puntoret');
    }
  }

  // 17. Fshirja e një Transaksioni Kesh / Bonus
  static async postDeleteTransaction(req, res) {
    try {
      const id = parseInt(req.params.id);
      const transaction = await prisma.employeeTransaction.findUnique({
        where: { id },
        include: { employee: true }
      });

      if (!transaction) {
        req.flash('error', 'Transaksioni nuk u gjet.');
        return res.redirect(req.get('referer') || '/puntoret');
      }

      await prisma.employeeTransaction.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Puntor',
        entityId: transaction.employeeId,
        description: `U fshi transaksioni ${transaction.number} (${transaction.amount}€) i puntorit ${transaction.employee?.firstName} ${transaction.employee?.lastName}.`
      });

      req.flash('success', `Transaksioni ${transaction.number} u fshi me sukses.`);
      res.redirect(req.get('referer') || `/puntoret/${transaction.employeeId}`);
    } catch (err) {
      console.error('Gabim në fshirjen e transaksionit:', err);
      req.flash('error', 'Nuk u arrit të fshihet transaksioni.');
      res.redirect(req.get('referer') || '/puntoret');
    }
  }

  // 18. Dëftesë / Fletëpagesë Zyrtare Kesh & Bonuse për Printim
  static async getTransactionReceipt(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [transaction, company] = await Promise.all([
        prisma.employeeTransaction.findUnique({
          where: { id },
          include: {
            employee: true,
            project: { include: { customer: true } },
            intervention: true
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!transaction) {
        req.flash('error', 'Transaksioni nuk u gjet.');
        return res.redirect('/puntoret');
      }

      res.render('puntoret/deftese-kesh', {
        pageTitle: `Deftese_${transaction.number}`,
        transaction,
        company: company || {},
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e dëftesës:', err);
      res.status(500).send('Gabim gjatë përgatitjes së dëftesës për printim.');
    }
  }

  // 19. Pasqyra e Përgjithshme e Keshit & Bonuseve (Faqja e dedikuar)
  static async getCashAndBonusesOverview(req, res) {
    try {
      const { tipi, puntoriId, muaji, viti } = req.query;

      const where = {};
      if (tipi && tipi !== 'te-gjitha') {
        where.type = tipi;
      }
      if (puntoriId && puntoriId !== 'te-gjitha') {
        where.employeeId = parseInt(puntoriId);
      }

      const [transactions, employees, projects] = await Promise.all([
        prisma.employeeTransaction.findMany({
          where,
          include: {
            employee: true,
            project: { include: { customer: true } },
            intervention: true
          },
          orderBy: { date: 'desc' }
        }),
        prisma.employee.findMany({
          where: { status: 'Aktiv' },
          orderBy: { firstName: 'asc' }
        }),
        prisma.project.findMany({
          where: { stage: { not: 'Përfunduar' } },
          orderBy: { name: 'asc' }
        })
      ]);

      // Llogaritjet globale
      const totalCash = transactions
        .filter(t => t.type === 'KESH_AVANC' || t.type === 'PAGESE_KESH')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalBonus = transactions
        .filter(t => t.type === 'BONUS')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalDeduction = transactions
        .filter(t => t.type === 'ZBRITJE')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      res.render('puntoret/kesh-bonuse', {
        pageTitle: 'Kesh & Bonuset e Punëtorëve - KRONEER',
        transactions,
        employees,
        projects,
        stats: {
          totalCount: transactions.length,
          totalCash,
          totalBonus,
          totalDeduction,
          grandTotal: totalCash + totalBonus
        },
        filters: {
          tipi: tipi || 'te-gjitha',
          puntoriId: puntoriId || 'te-gjitha'
        }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e pasqyrës së keshit & bonuseve:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ngarkimit.');
      res.redirect('/puntoret');
    }
  }
}

module.exports = EmployeeController;

