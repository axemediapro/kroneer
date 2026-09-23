const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class MaintenanceController {
  static async getIndex(req, res) {
    try {
      const { status, frequency, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (frequency) where.frequency = frequency;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { serialNumber: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const contracts = await prisma.maintenanceContract.findMany({
        where,
        include: {
          customer: true,
          elevator: true,
          technician: true,
          visits: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const frequencies = ['Mujore', 'Tremujore', 'Gjashtëmujore', 'Vjetore'];
      const statuses = ['Aktive', 'Skadon së shpejti', 'E skaduar', 'Anuluar'];

      res.render('mirembajtja/index', {
        pageTitle: 'Kontratat e Mirëmbajtjes - KRONEER',
        contracts,
        frequencies,
        statuses,
        filters: { status: status || '', frequency: frequency || '', search: search || '' }
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u arrit të ngarkohet moduli i mirëmbajtjes.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const [customers, elevators, technicians, company] = await Promise.all([
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' }, orderBy: { model: 'asc' } }),
        prisma.user.findMany({
          where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } }
        }),
        prisma.companySettings.findFirst()
      ]);

      const nextNumber = await NumberService.getNextNumber('maintenance');

      res.render('mirembajtja/krijo', {
        pageTitle: 'Krijo Kontratë Mirëmbajtjeje - KRONEER',
        customers,
        elevators,
        technicians,
        company: company || {},
        nextNumber
      });
    } catch (err) {
      console.error(err);
      res.redirect('/mirembajtja');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        customerId, elevatorId, serialNumber, startDate, endDate, frequency, priceAnnual, technicianId,
        contractTitle, preambleText,
        article1Title, article1Text,
        article2Title, article2Text,
        article3Title, article3Text,
        article4Title, article4Text,
        article5Title, article5Text,
        article6Title, article6Text,
        closingTerms, specialTerms, notes
      } = req.body;

      const number = await NumberService.getNextNumber('maintenance');

      const contract = await prisma.maintenanceContract.create({
        data: {
          number,
          customerId: parseInt(customerId),
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          serialNumber: serialNumber ? serialNumber.trim() : 'KR-SN-LIFT',
          startDate: startDate ? new Date(startDate) : new Date(),
          endDate: endDate ? new Date(endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          frequency: frequency || 'Mujore',
          priceAnnual: parseFloat(priceAnnual) || 0,
          technicianId: technicianId ? parseInt(technicianId) : null,
          contractTitle: contractTitle || 'KONTRATË PËR MIRËMBAJTJEN PERIODIKE DHE SERVISIMIN E LIFTEVE',
          preambleText: preambleText || null,
          article1Title: article1Title || 'NENI 1: OBJEKTI I MIRËMBAJTJES',
          article1Text: article1Text || null,
          article2Title: article2Title || 'NENI 2: ÇMIMI DHE KUSHTET E PAGESËS',
          article2Text: article2Text || null,
          article3Title: article3Title || 'NENI 3: KOHËZGJATJA DHE FREKUENCA E VIZITAVE',
          article3Text: article3Text || null,
          article4Title: article4Title || 'NENI 4: DETYRIMET E KOMPANISË & SHËRBIMI 24/7',
          article4Text: article4Text || null,
          article5Title: article5Title || 'NENI 5: DETYRIMET DHE PËRGJEGJËSITË E POROSITËSIT',
          article5Text: article5Text || null,
          article6Title: article6Title || 'NENI 6: KUSHTET E VEÇANTA & ZGJIDHJA E MOSMARRËVESHJEVE',
          article6Text: article6Text || null,
          closingTerms: closingTerms || null,
          specialTerms: specialTerms || null,
          status: 'Aktive',
          notes: notes ? notes.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Mirëmbajtje',
        entityId: contract.id,
        description: `U krijua kontrata e mirëmbajtjes ${contract.number} për liftin me numër serik ${contract.serialNumber}.`
      });

      req.flash('success', `Kontrata e mirëmbajtjes ${contract.number} u regjistrua me sukses.`);
      res.redirect(`/mirembajtja/${contract.id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u regjistrua kontrata.');
      res.redirect('/mirembajtja/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [contract, technicians, company] = await Promise.all([
        prisma.maintenanceContract.findUnique({
          where: { id },
          include: {
            customer: true,
            elevator: true,
            technician: true,
            visits: {
              include: { technician: true },
              orderBy: { visitDate: 'desc' }
            }
          }
        }),
        prisma.user.findMany({
          where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/mirembajtja');
      }

      res.render('mirembajtja/detajet', {
        pageTitle: `Kontrata e Mirëmbajtjes ${contract.number} - KRONEER`,
        contract,
        technicians,
        company: company || {}
      });
    } catch (err) {
      console.error(err);
      res.redirect('/mirembajtja');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [contract, customers, elevators, technicians, company] = await Promise.all([
        prisma.maintenanceContract.findUnique({
          where: { id },
          include: { customer: true, elevator: true, technician: true }
        }),
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' }, orderBy: { model: 'asc' } }),
        prisma.user.findMany({
          where: { role: { in: ['TEKNIK', 'MENAXHER_PROJEKTI', 'ADMINISTRATOR'] } }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        req.flash('error', 'Kontrata e mirëmbajtjes nuk u gjet.');
        return res.redirect('/mirembajtja');
      }

      const frequencies = ['Mujore', 'Tremujore', 'Gjashtëmujore', 'Vjetore'];
      const statuses = ['Aktive', 'Skadon së shpejti', 'E skaduar', 'Anuluar'];

      res.render('mirembajtja/ndrysho', {
        pageTitle: `Ndrysho Kontratën ${contract.number} - KRONEER`,
        contract,
        customers,
        elevators,
        technicians,
        company: company || {},
        frequencies,
        statuses
      });
    } catch (err) {
      console.error('Gabim në hapjen e editimit të kontratës së mirëmbajtjes:', err);
      req.flash('error', 'Nuk u arrit të hapet faqja e editimit.');
      res.redirect('/mirembajtja');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        customerId, elevatorId, serialNumber, startDate, endDate, frequency, priceAnnual, technicianId, status,
        contractTitle, preambleText,
        article1Title, article1Text,
        article2Title, article2Text,
        article3Title, article3Text,
        article4Title, article4Text,
        article5Title, article5Text,
        article6Title, article6Text,
        closingTerms, specialTerms, notes
      } = req.body;

      const existing = await prisma.maintenanceContract.findUnique({ where: { id } });
      if (!existing) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/mirembajtja');
      }

      await prisma.maintenanceContract.update({
        where: { id },
        data: {
          customerId: customerId ? parseInt(customerId) : existing.customerId,
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          serialNumber: serialNumber ? serialNumber.trim() : existing.serialNumber,
          startDate: startDate ? new Date(startDate) : existing.startDate,
          endDate: endDate ? new Date(endDate) : existing.endDate,
          frequency: frequency || existing.frequency,
          priceAnnual: parseFloat(priceAnnual) || existing.priceAnnual,
          technicianId: technicianId ? parseInt(technicianId) : null,
          status: status || existing.status,
          contractTitle: contractTitle !== undefined ? contractTitle : existing.contractTitle,
          preambleText: preambleText !== undefined ? preambleText : existing.preambleText,
          article1Title: article1Title !== undefined ? article1Title : existing.article1Title,
          article1Text: article1Text !== undefined ? article1Text : existing.article1Text,
          article2Title: article2Title !== undefined ? article2Title : existing.article2Title,
          article2Text: article2Text !== undefined ? article2Text : existing.article2Text,
          article3Title: article3Title !== undefined ? article3Title : existing.article3Title,
          article3Text: article3Text !== undefined ? article3Text : existing.article3Text,
          article4Title: article4Title !== undefined ? article4Title : existing.article4Title,
          article4Text: article4Text !== undefined ? article4Text : existing.article4Text,
          article5Title: article5Title !== undefined ? article5Title : existing.article5Title,
          article5Text: article5Text !== undefined ? article5Text : existing.article5Text,
          article6Title: article6Title !== undefined ? article6Title : existing.article6Title,
          article6Text: article6Text !== undefined ? article6Text : existing.article6Text,
          closingTerms: closingTerms !== undefined ? closingTerms : existing.closingTerms,
          specialTerms: specialTerms !== undefined ? specialTerms : existing.specialTerms,
          notes: notes !== undefined ? notes : existing.notes
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Mirëmbajtje',
        entityId: id,
        description: `U modifikuan të dhënat dhe tekstet e kontratës së mirëmbajtjes ${existing.number}.`
      });

      req.flash('success', `Kontrata e mirëmbajtjes ${existing.number} u përditësua me sukses.`);
      res.redirect(`/mirembajtja/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e ndryshimeve të kontratës së mirëmbajtjes:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve.');
      res.redirect(`/mirembajtja/${req.params.id}/ndrysho`);
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [contract, company] = await Promise.all([
        prisma.maintenanceContract.findUnique({
          where: { id },
          include: {
            customer: true,
            elevator: true,
            technician: true
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        return res.status(404).send('Kontrata e mirëmbajtjes nuk u gjet.');
      }

      res.render('mirembajtja/print', {
        pageTitle: `Kontrata_Mirembajtjes_${contract.number}`,
        contract,
        company: company || {},
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim gjatë hapjes së formatit të printimit.');
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const contract = await prisma.maintenanceContract.findUnique({ where: { id } });

      if (!contract) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/mirembajtja');
      }

      await prisma.maintenanceContract.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Mirëmbajtje',
        entityId: id,
        description: `Kontrata e mirëmbajtjes ${contract.number} u fshi nga sistemi.`
      });

      req.flash('success', `Kontrata e mirëmbajtjes ${contract.number} u fshi me sukses.`);
      res.redirect('/mirembajtja');
    } catch (err) {
      console.error('Gabim gjatë fshirjes:', err);
      req.flash('error', 'Kontrata nuk mund të fshihet.');
      res.redirect(`/mirembajtja/${req.params.id}`);
    }
  }

  static async postAddVisit(req, res) {
    try {
      const contractId = parseInt(req.params.id);
      const { technicianId, visitDate, findings, actionsTaken, clientSigned, notes } = req.body;

      await prisma.maintenanceVisit.create({
        data: {
          contractId,
          technicianId: technicianId ? parseInt(technicianId) : (req.session.user?.id || null),
          visitDate: visitDate ? new Date(visitDate) : new Date(),
          completedDate: new Date(),
          status: 'E Përfunduar',
          findings: findings ? findings.trim() : null,
          actionsTaken: actionsTaken ? actionsTaken.trim() : null,
          clientSigned: clientSigned === 'on' || clientSigned === true,
          notes: notes ? notes.trim() : null
        }
      });

      req.flash('success', 'Vizita e mirëmbajtjes u regjistrua me sukses.');
      res.redirect(`/mirembajtja/${contractId}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u regjistrua vizita.');
      res.redirect(`/mirembajtja/${req.params.id}`);
    }
  }
}

module.exports = MaintenanceController;

