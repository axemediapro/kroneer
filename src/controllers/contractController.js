const QRCode = require('qrcode');
const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const ContractTokenService = require('../services/contractTokenService');

class ContractController {
  static async getIndex(req, res) {
    try {
      const { search, status } = req.query;
      const where = {};

      if (status) where.status = status;
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } },
          { customer: { firstName: { contains: search } } }
        ];
      }

      const contracts = await prisma.contract.findMany({
        where,
        include: {
          customer: true,
          elevator: true,
          quotation: true,
          projects: true
        },
        orderBy: { createdAt: 'desc' }
      });

      res.render('kontratat/index', {
        pageTitle: 'Kontratat - KRONEER',
        contracts,
        filters: { search: search || '', status: status || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e kontratave:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen kontratat.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const { quotationId, customerId } = req.query;
      const [customers, elevators, company] = await Promise.all([
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' }, orderBy: { model: 'asc' } }),
        prisma.companySettings.findFirst()
      ]);

      let selectedQuotation = null;
      let selectedCustomer = null;

      if (quotationId) {
        selectedQuotation = await prisma.quotation.findUnique({
          where: { id: parseInt(quotationId) },
          include: { customer: true, configurations: { include: { elevator: true } }, items: true }
        });
        if (selectedQuotation) {
          selectedCustomer = selectedQuotation.customer;
        }
      } else if (customerId) {
        selectedCustomer = await prisma.customer.findUnique({
          where: { id: parseInt(customerId) }
        });
      }

      const nextNumber = await NumberService.getNextNumber('contract');

      res.render('kontratat/krijo', {
        pageTitle: 'Krijo Kontratë të Re - KRONEER',
        customers,
        elevators,
        company: company || {},
        selectedQuotation,
        selectedCustomer,
        nextNumber
      });
    } catch (err) {
      console.error('Gabim në hapjen e formës së kontratës:', err);
      req.flash('error', 'Nuk u arrit të hapet forma e kontratës.');
      res.redirect('/kontratat');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        customerId, elevatorId, quotationId, value, status,
        deliveryDate, installationDate, warrantyMonths, paymentTerms,
        contractTitle, preambleText,
        article1Title, article1Text,
        article2Title, article2Text,
        article3Title, article3Text,
        article4Title, article4Text,
        article5Title, article5Text,
        article6Title, article6Text,
        specialTerms, closingTerms, notes
      } = req.body;

      const contractNumber = await NumberService.getNextNumber('contract');
      const val = parseFloat(value) || 0;
      const parsedDelivery = deliveryDate ? new Date(deliveryDate) : new Date(Date.now() + 42 * 24 * 60 * 60 * 1000);
      const parsedInstallation = installationDate ? new Date(installationDate) : new Date(Date.now() + 63 * 24 * 60 * 60 * 1000);

      const contract = await prisma.contract.create({
        data: {
          number: contractNumber,
          customerId: parseInt(customerId),
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          quotationId: quotationId ? parseInt(quotationId) : null,
          value: val,
          status: status || 'Aktive',
          deliveryDate: parsedDelivery,
          installationDate: parsedInstallation,
          warrantyMonths: parseInt(warrantyMonths) || 24,
          paymentTerms: paymentTerms || '',
          contractTitle: contractTitle || 'KONTRATË PËR FURNIZIMIN, MONTIMIN DHE MIRËMBAJTJEN E SISTEMEVE TË LIFTEVE',
          preambleText: preambleText || null,
          article1Title: article1Title || 'NENI 1: OBJEKTI I KONTRATËS',
          article1Text: article1Text || null,
          article2Title: article2Title || 'NENI 2: VLERA E KONTRATËS DHE KUSHTET E PAGESËS',
          article2Text: article2Text || null,
          article3Title: article3Title || 'NENI 3: AFATET E EKZEKUTIMIT DHE GARANCIA',
          article3Text: article3Text || null,
          article4Title: article4Title || 'NENI 4: MIRËMBAJTJA & SHËRBIMI',
          article4Text: article4Text || null,
          maintenanceTerms: article4Text || 'Mirëmbajtje falas gjatë periudhës së garancisë sipas standardit EN 13015.',
          article5Title: article5Title || 'NENI 5: DETYRIMET DHE PËRGJEGJËSITË E PALËVE',
          article5Text: article5Text || null,
          article6Title: article6Title || 'NENI 6: KUSHTET E VEÇANTA & DISPOZITAT PËRFUNDIMTARE',
          article6Text: article6Text || null,
          specialTerms: specialTerms || null,
          closingTerms: closingTerms || null,
          notes: notes || null
        }
      });

      // Krijo projekt automatik nëse nuk ekziston
      const customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      const projectNumber = await NumberService.getNextNumber('project');
      const project = await prisma.project.create({
        data: {
          number: projectNumber,
          name: `${customer?.buildingName || customer?.companyName || 'Objekti'} — Instalimi i Liftit`,
          customerId: parseInt(customerId),
          contractId: contract.id,
          elevatorCount: customer?.elevatorsCount || 1,
          floorsCount: customer?.floorsCount || 5,
          value: val,
          stage: 'Planifikim',
          startDate: new Date(),
          targetCompletionDate: parsedInstallation
        }
      });

      await prisma.contract.update({
        where: { id: contract.id },
        data: { projectId: project.id }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Kontratë',
        entityId: contract.id,
        description: `U krijua kontrata e re ${contract.number} me vlerë ${val.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Kontrata ${contract.number} u krijua me sukses!`);
      res.redirect(`/kontratat/${contract.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e kontratës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë krijimit të kontratës.');
      res.redirect('/kontratat/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const contract = await prisma.contract.findUnique({
        where: { id },
        include: {
          customer: true,
          elevator: true,
          quotation: { include: { items: true, configurations: { include: { elevator: true } } } },
          projects: { include: { installations: true } },
          proformas: true,
          invoices: true
        }
      });

      if (!contract) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/kontratat');
      }

      const company = await prisma.companySettings.findFirst();

      const token = ContractTokenService.generateToken(contract);
      const publicUrl = `${req.protocol}://${req.get('host')}/p/kontrata/${token}`;
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 256,
        margin: 1,
        color: { dark: '#020617', light: '#ffffff' }
      });

      res.render('kontratat/detajet', {
        pageTitle: `Kontrata ${contract.number} - KRONEER`,
        contract,
        company: company || {},
        publicUrl,
        encryptedToken: token,
        qrCodeDataUrl
      });
    } catch (err) {
      console.error(err);
      res.redirect('/kontratat');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [contract, customers, elevators, company] = await Promise.all([
        prisma.contract.findUnique({
          where: { id },
          include: {
            customer: true,
            elevator: true,
            quotation: { include: { items: true } }
          }
        }),
        prisma.customer.findMany({ orderBy: { companyName: 'asc' } }),
        prisma.elevator.findMany({ where: { status: 'Aktiv' }, orderBy: { model: 'asc' } }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/kontratat');
      }

      const statuses = ['Aktive', 'E Nënshkruar', 'E Përfunduar', 'Anuluar'];

      res.render('kontratat/ndrysho', {
        pageTitle: `Ndrysho Kontratën ${contract.number} - KRONEER`,
        contract,
        customers,
        elevators,
        company: company || {},
        statuses
      });
    } catch (err) {
      console.error('Gabim në hapjen e editimit të kontratës:', err);
      req.flash('error', 'Nuk u arrit të hapet faqja e editimit të kontratës.');
      res.redirect('/kontratat');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        customerId, elevatorId, value, status,
        deliveryDate, installationDate, warrantyMonths, paymentTerms,
        contractTitle, preambleText,
        article1Title, article1Text,
        article2Title, article2Text,
        article3Title, article3Text,
        article4Title, article4Text,
        article5Title, article5Text,
        article6Title, article6Text,
        specialTerms, closingTerms, notes
      } = req.body;

      const existing = await prisma.contract.findUnique({ where: { id } });
      if (!existing) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/kontratat');
      }

      const val = parseFloat(value) || 0;
      const parsedDelivery = deliveryDate ? new Date(deliveryDate) : existing.deliveryDate;
      const parsedInstallation = installationDate ? new Date(installationDate) : existing.installationDate;

      await prisma.contract.update({
        where: { id },
        data: {
          customerId: customerId ? parseInt(customerId) : existing.customerId,
          elevatorId: elevatorId ? parseInt(elevatorId) : null,
          value: val,
          status: status || existing.status,
          deliveryDate: parsedDelivery,
          installationDate: parsedInstallation,
          warrantyMonths: parseInt(warrantyMonths) || existing.warrantyMonths,
          paymentTerms: paymentTerms || existing.paymentTerms,
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
          maintenanceTerms: article4Text || existing.maintenanceTerms,
          article5Title: article5Title !== undefined ? article5Title : existing.article5Title,
          article5Text: article5Text !== undefined ? article5Text : existing.article5Text,
          article6Title: article6Title !== undefined ? article6Title : existing.article6Title,
          article6Text: article6Text !== undefined ? article6Text : existing.article6Text,
          specialTerms: specialTerms !== undefined ? specialTerms : existing.specialTerms,
          closingTerms: closingTerms !== undefined ? closingTerms : existing.closingTerms,
          notes: notes !== undefined ? notes : existing.notes
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Kontratë',
        entityId: id,
        description: `U modifikuan të dhënat dhe tekstet e kontratës ${existing.number}.`
      });

      req.flash('success', `Kontrata ${existing.number} dhe tekstet e saj u përditësuan me sukses.`);
      res.redirect(`/kontratat/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e ndryshimeve të kontratës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve të kontratës.');
      res.redirect(`/kontratat/${req.params.id}/ndrysho`);
    }
  }

  static async postUpdateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      const contract = await prisma.contract.update({
        where: { id },
        data: { status }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Kontratë',
        entityId: id,
        description: `Statusi i kontratës ${contract.number} u ndryshua në '${status}'.`
      });

      req.flash('success', `Statusi i kontratës u ndryshua në "${status}".`);
      res.redirect(`/kontratat/${id}`);
    } catch (err) {
      console.error('Gabim në përditësimin e statusit të kontratës:', err);
      req.flash('error', 'Nuk u arrit të ndryshohet statusi.');
      res.redirect(`/kontratat/${req.params.id}`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const contract = await prisma.contract.findUnique({ where: { id } });

      if (!contract) {
        req.flash('error', 'Kontrata nuk u gjet.');
        return res.redirect('/kontratat');
      }

      await prisma.contract.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Kontratë',
        entityId: id,
        description: `Kontrata ${contract.number} u fshi nga sistemi.`
      });

      req.flash('success', `Kontrata ${contract.number} u fshi me sukses.`);
      res.redirect('/kontratat');
    } catch (err) {
      console.error('Gabim gjatë fshirjes së kontratës:', err);
      req.flash('error', 'Kontrata nuk mund të fshihet pasi mund të ketë fatura ose projekte të lidhura.');
      res.redirect(`/kontratat/${req.params.id}`);
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [contract, company] = await Promise.all([
        prisma.contract.findUnique({
          where: { id },
          include: {
            customer: true,
            elevator: true,
            quotation: { include: { items: true, configurations: { include: { elevator: true } } } }
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        return res.status(404).send('Kontrata nuk u gjet.');
      }

      const token = ContractTokenService.generateToken(contract);
      const publicUrl = `${req.protocol}://${req.get('host')}/p/kontrata/${token}`;
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#020617', light: '#ffffff' }
      });

      res.render('kontratat/print', {
        pageTitle: `Kontrata_${contract.number}`,
        contract,
        company: company || {},
        publicUrl,
        qrCodeDataUrl,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim gjatë hapjes së formatit të printimit.');
    }
  }

  static async getPublicDetail(req, res) {
    try {
      const { token } = req.params;
      const payload = ContractTokenService.verifyAndDecryptToken(token);

      if (!payload || !payload.id) {
        return res.status(404).render('partials/error', {
          pageTitle: 'Kontrata nuk u gjet - KRONEER',
          statusCode: 404,
          errorMessage: 'Linku i kësaj kontrate është i pavlefshëm, i pasaktë ose ka skaduar.',
          layout: 'layouts/public'
        });
      }

      const [contract, company] = await Promise.all([
        prisma.contract.findUnique({
          where: { id: payload.id },
          include: {
            customer: true,
            elevator: true,
            quotation: { include: { items: true, configurations: { include: { elevator: true } } } },
            projects: { include: { installations: true } },
            invoices: true
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!contract) {
        return res.status(404).render('partials/error', {
          pageTitle: 'Kontrata nuk u gjet - KRONEER',
          statusCode: 404,
          errorMessage: 'Kontrata e kërkuar nuk u gjet në sistemin tonë zyrtar.',
          layout: 'layouts/public'
        });
      }

      const publicUrl = `${req.protocol}://${req.get('host')}/p/kontrata/${token}`;
      const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#020617', light: '#ffffff' }
      });

      res.render('kontratat/publik', {
        pageTitle: `Kontrata Zyrtare ${contract.number} — KRONEER`,
        contract,
        company: company || {},
        publicUrl,
        qrCodeDataUrl,
        layout: 'layouts/public'
      });
    } catch (err) {
      console.error('Gabim në pamjen publike të kontratës:', err);
      res.status(500).render('partials/error', {
        pageTitle: 'Gabim në sistem - KRONEER',
        statusCode: 500,
        errorMessage: 'Ndodhi një gabim gjatë hapjes së kontratës publike.',
        layout: 'layouts/public'
      });
    }
  }
}

module.exports = ContractController;

