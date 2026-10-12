const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const quotationCatalogService = require('../services/quotationCatalogService');

class QuotationController {
  static async getIndex(req, res) {
    try {
      const { status, search, customerId } = req.query;
      const where = {};

      if (status) where.status = status;
      if (customerId) where.customerId = parseInt(customerId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } },
          { customer: { firstName: { contains: search } } },
          { customer: { lastName: { contains: search } } },
          { notes: { contains: search } }
        ];
      }

      const quotations = await prisma.quotation.findMany({
        where,
        include: {
          customer: true,
          salesRep: true,
          items: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const statuses = ['Draft', 'Dërguar', 'Shikuar', 'Në negociatë', 'Pranuar', 'Refuzuar', 'Skaduar'];

      res.render('ofertat/index', {
        pageTitle: 'Ofertat - KRONEER',
        quotations,
        statuses,
        filters: { status: status || '', search: search || '', customerId: customerId || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e ofertave:', err);
      req.flash('error', 'Nuk u arrit të ngarkohen ofertat.');
      res.redirect('/paneli');
    }
  }

  static async getCreate(req, res) {
    try {
      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const elevators = await prisma.elevator.findMany({ where: { status: 'Aktiv' } });
      const users = await prisma.user.findMany({ where: { isActive: true } });
      const nextNumber = await NumberService.getNextNumber('quotation');

      const catalog = await quotationCatalogService.getCatalog(elevators);
      res.render('ofertat/krijo', {
        catalog,
        pageTitle: 'Krijo Ofertë të Re - KRONEER',
        customers,
        elevators,
        users,
        nextNumber
      });
    } catch (err) {
      console.error(err);
      res.redirect('/ofertat');
    }
  }

  static async postCreate(req, res) {
    try {
      const {
        customerId, date, validUntil, salesRepId, currency,
        paymentTerms, deliveryWeeks, installationWeeks, warrantyMonths, notes,
        items
      } = req.body;

      const number = await NumberService.getNextNumber('quotation');
      const custId = parseInt(customerId);

      let parsedItems = [];
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      }

      // Llogaritja e shumave
      let subtotal = 0;
      let totalDiscount = 0;
      let vatRate = 18;

      parsedItems.forEach(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const disc = parseFloat(item.discount) || 0;
        const itemTot = (qty * price) - disc;
        subtotal += (qty * price);
        totalDiscount += disc;
      });

      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
      const total = discountedSubtotal + vatAmount;

      const quotation = await prisma.quotation.create({
        data: {
          number,
          date: date ? new Date(date) : new Date(),
          validUntil: validUntil ? new Date(validUntil) : null,
          customerId: custId,
          salesRepId: req.session.user?.id || null,
          currency: currency || 'EUR',
          paymentTerms: paymentTerms || '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit',
          deliveryWeeks: parseInt(deliveryWeeks) || 6,
          installationWeeks: parseInt(installationWeeks) || 3,
          warrantyMonths: parseInt(warrantyMonths) || 24,
          notes: notes || '',
          subtotal,
          discount: totalDiscount,
          vatRate,
          vatAmount,
          total,
          status: 'Draft'
        }
      });

      // Shto artikujt
      if (parsedItems.length > 0) {
        for (const it of parsedItems) {
          const q = parseFloat(it.quantity) || 1;
          const up = parseFloat(it.unitPrice) || 0;
          const d = parseFloat(it.discount) || 0;
          await prisma.quotationItem.create({
            data: {
              quotationId: quotation.id,
              itemType: it.itemType || 'Lift',
              name: it.name || 'Artikull Lifti',
              description: it.description || '',
              quantity: q,
              unit: it.unit || 'copë',
              unitPrice: up,
              discount: d,
              vatRate: 18,
              total: (q * up) - d
            }
          });
        }
      } else {
        // Artikull standard nëse nuk u specifikua
        await prisma.quotationItem.create({
          data: {
            quotationId: quotation.id,
            itemType: 'Lift',
            name: 'Pajisje Lifti KRONEER & Shërbim Instalimi',
            description: 'Sistem i plotë i certifikuar EN 81-20/50',
            quantity: 1,
            unit: 'komplet',
            unitPrice: subtotal,
            discount: totalDiscount,
            vatRate: 18,
            total: subtotal - totalDiscount
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Ofertë',
        entityId: quotation.id,
        description: `U krijua oferta e re ${quotation.number} me vlerë ${total.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Oferta ${quotation.number} u ruajt me sukses.`);
      res.redirect(`/ofertat/${quotation.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e ofertës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë krijimit të ofertës.');
      res.redirect('/ofertat/krijo');
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: {
          customer: true,
          salesRep: true,
          items: true,
          configurations: true,
          contracts: true,
          proformas: true,
          invoices: true
        }
      });

      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      res.render('ofertat/detajet', {
        pageTitle: `Oferta ${quotation.number} - KRONEER`,
        quotation
      });
    } catch (err) {
      console.error(err);
      res.redirect('/ofertat');
    }
  }

  static async getPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: {
          customer: true,
          salesRep: true,
          items: true,
          configurations: true
        }
      });

      if (!quotation) {
        return res.status(404).send('Oferta nuk u gjet.');
      }

      const numMatch = (quotation.number || '').match(/\d+$/);
      const quoteNum = numMatch ? parseInt(numMatch[0], 10) : quotation.id;
      const formattedNum = String(quoteNum).padStart(2, '0');
      const docTitle = `KR-OFR-${formattedNum}`;

      res.render('ofertat/print', {
        pageTitle: docTitle,
        quotation,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Gabim në gjenerimin e pamjes së printimit.');
    }
  }

  static async getExportList(req, res) {
    try {
      const { customerId, status, search } = req.query;
      const where = {};

      if (status) where.status = status;
      if (customerId) where.customerId = parseInt(customerId);
      if (search) {
        where.OR = [
          { number: { contains: search } },
          { customer: { companyName: { contains: search } } }
        ];
      }

      const quotations = await prisma.quotation.findMany({
        where,
        include: {
          customer: true,
          items: true
        },
        orderBy: { date: 'desc' }
      });

      let customer = null;
      if (customerId) {
        customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      }

      const totalSubtotal = quotations.reduce((s, q) => s + (q.subtotal || 0), 0);
      const totalDiscount = quotations.reduce((s, q) => s + (q.discount || 0), 0);
      const totalAmount = quotations.reduce((s, q) => s + (q.total || 0), 0);

      res.render('ofertat/print-list', {
        pageTitle: customer ? `Ofertat_${customer.companyName.replace(/[^a-zA-Z0-9]/g, '_')}` : 'Raporti_i_Ofertave',
        quotations,
        customer,
        totalSubtotal,
        totalDiscount,
        totalAmount,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në eksportimin e listës së ofertave:', err);
      res.status(500).send('Gabim në gjenerimin e raportit.');
    }
  }

  static async postUpdateStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;

      const quotation = await prisma.quotation.update({
        where: { id },
        data: { status }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Ofertë',
        entityId: id,
        description: `Statusi i ofertës ${quotation.number} u ndryshua në "${status}".`
      });

      req.flash('success', `Statusi u përditësua në "${status}".`);
      res.redirect(`/ofertat/${id}`);
    } catch (err) {
      console.error(err);
      res.redirect('/ofertat');
    }
  }

  static async postDuplicate(req, res) {
    try {
      const id = parseInt(req.params.id);
      const original = await prisma.quotation.findUnique({
        where: { id },
        include: { items: true }
      });

      if (!original) {
        req.flash('error', 'Oferta origjinale nuk u gjet.');
        return res.redirect('/ofertat');
      }

      const newNumber = await NumberService.getNextNumber('quotation');

      const duplicated = await prisma.quotation.create({
        data: {
          number: newNumber,
          date: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          customerId: original.customerId,
          salesRepId: req.session.user?.id || original.salesRepId,
          currency: original.currency,
          paymentTerms: original.paymentTerms,
          deliveryWeeks: original.deliveryWeeks,
          installationWeeks: original.installationWeeks,
          warrantyMonths: original.warrantyMonths,
          notes: `Kopje nga oferta ${original.number}. ` + (original.notes || ''),
          subtotal: original.subtotal,
          discount: original.discount,
          vatRate: original.vatRate,
          vatAmount: original.vatAmount,
          total: original.total,
          status: 'Draft'
        }
      });

      for (const item of original.items) {
        await prisma.quotationItem.create({
          data: {
            quotationId: duplicated.id,
            itemType: item.itemType,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            vatRate: item.vatRate,
            total: item.total
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Ofertë',
        entityId: duplicated.id,
        description: `U duplikua oferta ${original.number} në ofertën e re ${duplicated.number}.`
      });

      req.flash('success', `Oferta u duplikua me sukses si ${duplicated.number}.`);
      res.redirect(`/ofertat/${duplicated.id}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u arrit të duplikohet oferta.');
      res.redirect('/ofertat');
    }
  }

  static async postConvertToContract(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [quotation, company] = await Promise.all([
        prisma.quotation.findUnique({
          where: { id },
          include: {
            customer: true,
            configurations: { include: { elevator: true } },
            items: true
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      const contractNumber = await NumberService.getNextNumber('contract');
      const deliveryDate = new Date(Date.now() + (quotation.deliveryWeeks || 6) * 7 * 24 * 60 * 60 * 1000);
      const installationDate = new Date(Date.now() + ((quotation.deliveryWeeks || 6) + (quotation.installationWeeks || 3)) * 7 * 24 * 60 * 60 * 1000);

      const elevator = quotation.configurations?.[0]?.elevator || null;
      const elevatorName = elevator ? elevator.model : (quotation.items?.[0]?.name || 'Sisteme Lifti KRONEER');
      const custName = quotation.customer.companyName || `${quotation.customer.firstName || ''} ${quotation.customer.lastName || ''}`.trim() || 'Klienti';
      const buildingName = quotation.customer.buildingName || 'Objekti i Porositësit';
      const compName = company?.companyName || 'KRONEER';

      const contract = await prisma.contract.create({
        data: {
          number: contractNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          elevatorId: elevator ? elevator.id : null,
          value: quotation.total,
          paymentTerms: quotation.paymentTerms,
          deliveryDate,
          installationDate,
          warrantyMonths: quotation.warrantyMonths || 24,
          maintenanceTerms: 'Mirëmbajtje falas gjatë periudhës së garancisë sipas standardit EN 13015 me shërbim emergjence 24/7.',
          status: 'Aktive',
          contractTitle: 'KONTRATË PËR FURNIZIMIN, MONTIMIN DHE MIRËMBAJTJEN E SISTEMEVE TË LIFTEVE',
          preambleText: `Kjo Kontratë lidhet ndërmjet ${compName} me seli në ${company?.address || 'Prishtinë'}, ${company?.city || 'Prishtinë'}, NUI: ${company?.taxNumber || '330123456'} (në vijim: "Shitësi / Kryesi i Punëve"), dhe ${custName} me seli në ${quotation.customer.address || '-'}, ${quotation.customer.city || 'Kosovë'}, NUI: ${quotation.customer.taxNumber || quotation.customer.businessNumber || '-'} (në vijim: "Blerësi / Porositësi").`,
          article1Title: 'NENI 1: OBJEKTI I KONTRATËS',
          article1Text: `Shitësi merr përsipër furnizimin me pajisje, transportin, montimin profesional, testimin dinamik dhe dorëzimin e plotë funksional të sistemit të liftit: ${elevatorName} për objektin "${buildingName}".`,
          article2Title: 'NENI 2: VLERA E KONTRATËS DHE KUSHTET E PAGESËS',
          article2Text: `Vlera totale e dakorduar kontraktuale është ${quotation.total.toLocaleString('de-DE', {minimumFractionDigits: 2})} € (përfshirë TVSH 18%). Kushtet e pagesës janë si vijon: ${quotation.paymentTerms || '30% Parapagim, 40% Para Instalimit, 20% Gjatë Instalimit, 10% Pas Dorëzimit'}.`,
          article3Title: 'NENI 3: AFATET E EKZEKUTIMIT DHE GARANCIA',
          article3Text: `Afati i dorëzimit të pajisjeve në kantier është deri më ${deliveryDate.toISOString().split('T')[0]}. Përfundimi i testimit dhe kolaudimit parashikohet më ${installationDate.toISOString().split('T')[0]}. Periudha e Garancisë Inxhinierike është ${quotation.warrantyMonths || 24} Muaj nga dita e nënshkrimit të Procesverbalit të Dorëzimit Teknik.`,
          article4Title: 'NENI 4: MIRËMBAJTJA & SHËRBIMI',
          article4Text: 'Mirëmbajtje falas gjatë periudhës së garancisë sipas standardit evropian EN 13015 me kontrolle periodike mujore dhe shërbim emergjence 24/7.',
          article5Title: 'NENI 5: DETYRIMET DHE PËRGJEGJËSITË E PALËVE',
          article5Text: '1. Shitësi obligohet të respektojë standardet më të larta të sigurisë EN 81-20/50.\n2. Porositësi obligohet të sigurojë pusin e liftit me dimensione të përcaktuara teknike, furnizim të rregullt elektrik 380V/50Hz në vendndodhje dhe qasje të lirë për montim.',
          article6Title: 'NENI 6: KUSHTET E VEÇANTA & DISPOZITAT PËRFUNDIMTARE',
          article6Text: 'Çdo modifikim bëhet me aneks-kontratë me shkrim. Mosmarrëveshjet do të zgjidhen me mirëkuptim ose në Gjykatën kompetente në Prishtinë. Kontrata hartohet në 2 kopje origjinale me fuqi të barabartë juridike.',
          closingTerms: 'Kjo kontratë hartohet në 2 (dy) kopje origjinale me fuqi të barabartë juridike, nga 1 (një) për secilën palë.'
        }
      });

      // Përditëso statusin e ofertës në Pranuar
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: { status: 'Pranuar' }
      });

      // Krijo automatikisht edhe projektin përkatës
      const projectNumber = await NumberService.getNextNumber('project');
      const project = await prisma.project.create({
        data: {
          number: projectNumber,
          name: `${quotation.customer.buildingName || quotation.customer.companyName} — Instalimi i Liftit`,
          customerId: quotation.customerId,
          contractId: contract.id,
          elevatorCount: quotation.customer.elevatorsCount || 1,
          floorsCount: quotation.customer.floorsCount || 5,
          value: contract.value,
          stage: 'Planifikim',
          startDate: new Date(),
          targetCompletionDate: contract.installationDate
        }
      });

      // Lidh kontratën me projektin
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
        description: `Oferta ${quotation.number} u konvertua në Kontratë (${contract.number}) dhe Projekt (${project.number}).`
      });

      req.flash('success', `Kontrata ${contract.number} dhe Projekti ${project.number} u krijuan me sukses!`);
      res.redirect(`/kontratat/${contract.id}`);
    } catch (err) {
      console.error('Gabim në konvertimin e ofertës në kontratë:', err);
      req.flash('error', 'Ndodhi një gabim gjatë konvertimit në kontratë.');
      res.redirect(`/ofertat/${req.params.id}`);
    }
  }

  static async postConvertToInvoice(req, res) {
    try {
      const id = parseInt(req.params.id);
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: { items: true, customer: true, configurations: true }
      });

      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      const invoiceNumber = await NumberService.getNextNumber('invoice');
      const vatRate = quotation.vatRate || 18;

      const invoice = await prisma.invoice.create({
        data: {
          number: invoiceNumber,
          quotationId: quotation.id,
          customerId: quotation.customerId,
          date: new Date(),
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          vatRate: vatRate,
          vatAmount: quotation.vatAmount,
          total: quotation.total,
          paidAmount: 0,
          balanceDue: quotation.total,
          status: 'Dërguar',
          notes: quotation.notes ? `Faturë e konvertuar nga oferta ${quotation.number}. Shënime: ${quotation.notes}` : `Faturë e lëshuar automatikisht nga oferta ${quotation.number}.`
        }
      });

      if (quotation.items && quotation.items.length > 0) {
        for (const it of quotation.items) {
          await prisma.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              name: it.name,
              description: it.description || '',
              quantity: it.quantity,
              unit: it.unit || 'copë',
              unitPrice: it.unitPrice,
              discount: it.discount || 0,
              vatRate: it.vatRate || vatRate,
              total: it.total
            }
          });
        }
      } else {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            name: `Sistem Lifti KRONEER (nga Oferta ${quotation.number})`,
            description: quotation.paymentTerms || '',
            quantity: 1,
            unitPrice: quotation.subtotal,
            discount: quotation.discount,
            vatRate: vatRate,
            total: quotation.subtotal - quotation.discount
          }
        });
      }

      // Përditëso statusin e ofertës nëse është në negociatë/draft
      if (['Draft', 'Dërguar', 'Shikuar', 'Në negociatë'].includes(quotation.status)) {
        await prisma.quotation.update({
          where: { id: quotation.id },
          data: { status: 'Pranuar' }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Faturë',
        entityId: invoice.id,
        description: `Oferta ${quotation.number} u konvertua në Faturë Zyrtare (${invoice.number}) me vlerë totale ${quotation.total.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Fatura ${invoice.number} u krijua me sukses nga oferta ${quotation.number}!`);
      res.redirect(`/faturat/${invoice.id}`);
    } catch (err) {
      console.error('Gabim në konvertimin e ofertës në faturë:', err);
      req.flash('error', 'Ndodhi një gabim gjatë krijimit të faturës nga oferta.');
      res.redirect(`/ofertat/${req.params.id}`);
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: {
          customer: true,
          salesRep: true,
          items: true
        }
      });

      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      const customers = await prisma.customer.findMany({ orderBy: { companyName: 'asc' } });
      const elevators = await prisma.elevator.findMany({ where: { status: 'Aktiv' } });
      const users = await prisma.user.findMany({ where: { isActive: true } });
      const statuses = ['Draft', 'Dërguar', 'Shikuar', 'Në negociatë', 'Pranuar', 'Refuzuar', 'Skaduar'];

      const catalog = await quotationCatalogService.getCatalog(elevators);
      res.render('ofertat/ndrysho', {
        catalog,
        pageTitle: `Ndrysho Ofertën ${quotation.number} - KRONEER`,
        quotation,
        customers,
        elevators,
        users,
        statuses
      });
    } catch (err) {
      console.error('Gabim gjatë ngarkimit të formës së editimit të ofertës:', err);
      req.flash('error', 'Nuk u arrit të hapet forma e editimit.');
      res.redirect('/ofertat');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        customerId, date, validUntil, salesRepId, currency, status,
        paymentTerms, deliveryWeeks, installationWeeks, warrantyMonths, notes,
        items
      } = req.body;

      const quotation = await prisma.quotation.findUnique({ where: { id } });
      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      let parsedItems = [];
      if (typeof items === 'string') {
        try { parsedItems = JSON.parse(items); } catch (e) { parsedItems = []; }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      }

      let subtotal = 0;
      let totalDiscount = 0;
      const vatRate = 18;

      parsedItems.forEach(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unitPrice) || 0;
        const disc = parseFloat(item.discount) || 0;
        subtotal += (qty * price);
        totalDiscount += disc;
      });

      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const vatAmount = Math.round(discountedSubtotal * (vatRate / 100) * 100) / 100;
      const total = discountedSubtotal + vatAmount;

      // Fshi artikujt ekzistues dhe shto të rinjtë
      await prisma.$transaction([
        prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
        prisma.quotation.update({
          where: { id },
          data: {
            customerId: parseInt(customerId),
            date: date ? new Date(date) : quotation.date,
            validUntil: validUntil ? new Date(validUntil) : null,
            salesRepId: salesRepId ? parseInt(salesRepId) : null,
            currency: currency || 'EUR',
            status: status || quotation.status,
            paymentTerms: paymentTerms || quotation.paymentTerms,
            deliveryWeeks: parseInt(deliveryWeeks) || 6,
            installationWeeks: parseInt(installationWeeks) || 3,
            warrantyMonths: parseInt(warrantyMonths) || 24,
            notes: notes || '',
            subtotal,
            discount: totalDiscount,
            vatRate,
            vatAmount,
            total
          }
        })
      ]);

      if (parsedItems.length > 0) {
        for (const it of parsedItems) {
          const q = parseFloat(it.quantity) || 1;
          const up = parseFloat(it.unitPrice) || 0;
          const d = parseFloat(it.discount) || 0;
          await prisma.quotationItem.create({
            data: {
              quotationId: id,
              itemType: it.itemType || 'Lift',
              name: it.name || 'Artikull Lifti',
              description: it.description || '',
              quantity: q,
              unit: it.unit || 'copë',
              unitPrice: up,
              discount: d,
              vatRate: 18,
              total: (q * up) - d
            }
          });
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Ofertë',
        entityId: id,
        description: `Oferta ${quotation.number} u modifikua. Vlera e re: ${total.toLocaleString('de-DE')} €.`
      });

      req.flash('success', `Oferta ${quotation.number} u përditësua me sukses.`);
      res.redirect(`/ofertat/${id}`);
    } catch (err) {
      console.error('Gabim në ruajtjen e ndryshimeve të ofertës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve.');
      res.redirect(`/ofertat/${req.params.id}/ndrysho`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const quotation = await prisma.quotation.findUnique({ where: { id } });

      if (!quotation) {
        req.flash('error', 'Oferta nuk u gjet.');
        return res.redirect('/ofertat');
      }

      await prisma.quotation.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Ofertë',
        entityId: id,
        description: `Oferta ${quotation.number} u fshi nga sistemi.`
      });

      req.flash('success', `Oferta ${quotation.number} u fshi me sukses.`);
      res.redirect('/ofertat');
    } catch (err) {
      console.error('Gabim gjatë fshirjes së ofertës:', err);
      req.flash('error', 'Oferta nuk mund të fshihet pasi mund të jetë e lidhur me kontrata ose projekte.');
      res.redirect('/ofertat');
    }
  }
}

module.exports = QuotationController;
