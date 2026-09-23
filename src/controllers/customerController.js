const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');

class CustomerController {
  static async getIndex(req, res) {
    try {
      const { search, type, city } = req.query;
      const where = {};

      if (search) {
        where.OR = [
          { companyName: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { contactPerson: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { code: { contains: search } }
        ];
      }

      if (type) {
        where.type = type;
      }

      if (city) {
        where.city = { contains: city };
      }

      const customers = await prisma.customer.findMany({
        where,
        include: {
          contacts: true,
          projects: true,
          quotations: true,
          invoices: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const typesList = [
        'Person fizik',
        'Kompani',
        'Ndërtues',
        'Kontraktor',
        'Arkitekt',
        'Zhvillues',
        'Institucion',
        'Menaxher prone'
      ];

      res.render('klientet/index', {
        pageTitle: 'Klientët (CRM) - KRONEER',
        customers,
        typesList,
        filters: { search: search || '', type: type || '', city: city || '' }
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e klientëve:', err);
      req.flash('error', 'Nuk u arritën të ngarkohen klientët.');
      res.redirect('/paneli');
    }
  }

  static getCreate(req, res) {
    const typesList = [
      'Person fizik',
      'Kompani',
      'Ndërtues',
      'Kontraktor',
      'Arkitekt',
      'Zhvillues',
      'Institucion',
      'Menaxher prone'
    ];
    res.render('klientet/krijo', {
      pageTitle: 'Regjistro Klient të Ri - KRONEER',
      typesList
    });
  }

  static async postCreate(req, res) {
    try {
      const {
        type, companyName, firstName, lastName, taxNumber, businessNumber,
        contactPerson, phone, email, website, country, city, address, postalCode, notes,
        buildingName, buildingAddress, floorsCount, elevatorsCount, architect, builderCompany, mainContractor
      } = req.body;

      const code = await NumberService.getNextNumber('customer');

      const customer = await prisma.customer.create({
        data: {
          code,
          type: type || 'Kompani',
          companyName: companyName ? companyName.trim() : (firstName ? `${firstName} ${lastName || ''}`.trim() : 'Klient pa emër'),
          firstName: firstName ? firstName.trim() : null,
          lastName: lastName ? lastName.trim() : null,
          taxNumber: taxNumber ? taxNumber.trim() : null,
          businessNumber: businessNumber ? businessNumber.trim() : null,
          contactPerson: contactPerson ? contactPerson.trim() : null,
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          website: website ? website.trim() : null,
          country: country || 'Kosovë',
          city: city ? city.trim() : null,
          address: address ? address.trim() : null,
          postalCode: postalCode ? postalCode.trim() : null,
          notes: notes ? notes.trim() : null,
          buildingName: buildingName ? buildingName.trim() : null,
          buildingAddress: buildingAddress ? buildingAddress.trim() : null,
          floorsCount: floorsCount ? parseInt(floorsCount) : 0,
          elevatorsCount: elevatorsCount ? parseInt(elevatorsCount) : 0,
          architect: architect ? architect.trim() : null,
          builderCompany: builderCompany ? builderCompany.trim() : null,
          mainContractor: mainContractor ? mainContractor.trim() : null
        }
      });

      // Nëse ka kontakt kryesor, regjistrohet automatikisht
      if (contactPerson || phone || email) {
        await prisma.contact.create({
          data: {
            customerId: customer.id,
            firstName: contactPerson || firstName || 'Kontakt',
            lastName: lastName || 'Kryesor',
            role: 'Përfaqësues Kryesor',
            phone: phone || null,
            email: email || null,
            isPrimary: true
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Klient',
        entityId: customer.id,
        description: `U regjistrua me sukses klienti i ri "${customer.companyName}" (${customer.code}).`
      });

      req.flash('success', `Klienti "${customer.companyName}" u krijua me sukses.`);
      res.redirect(`/klientet/${customer.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e klientit:', err);
      req.flash('error', 'Ndodhi një problem gjatë regjistrimit të klientit.');
      res.redirect('/klientet/krijo');
    }
  }

  // Krijim i shpejtë i klientit nga popup-e (p.sh. gjatë lëshimit të një fature) - kthen JSON
  static async postQuickCreate(req, res) {
    try {
      const {
        kind, firstName, lastName, companyName, contactPerson, phone, email,
        city, address, taxNumber, businessNumber, discountGroup, discountPercent
      } = req.body;

      const isIndivid = kind === 'individ';
      const resolvedCompanyName = isIndivid
        ? `${firstName || ''} ${lastName || ''}`.trim()
        : (companyName || '').trim();

      if (!resolvedCompanyName) {
        return res.status(400).json({ success: false, message: isIndivid ? 'Emri dhe Mbiemri janë të detyrueshëm.' : 'Emri i kompanisë/klientit është i detyrueshëm.' });
      }

      const code = await NumberService.getNextNumber('customer');

      const customer = await prisma.customer.create({
        data: {
          code,
          type: isIndivid ? 'Person fizik' : 'Kompani',
          companyName: resolvedCompanyName,
          firstName: isIndivid ? (firstName ? firstName.trim() : null) : null,
          lastName: isIndivid ? (lastName ? lastName.trim() : null) : null,
          contactPerson: contactPerson ? contactPerson.trim() : null,
          taxNumber: taxNumber ? taxNumber.trim() : null,
          businessNumber: businessNumber ? businessNumber.trim() : null,
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          country: 'Kosovë',
          city: city ? city.trim() : null,
          address: address ? address.trim() : null,
          discountGroup: discountGroup || 'Standard',
          discountPercent: discountPercent ? parseFloat(discountPercent) : 0
        }
      });

      if (contactPerson || phone || email) {
        await prisma.contact.create({
          data: {
            customerId: customer.id,
            firstName: contactPerson || firstName || 'Kontakt',
            lastName: lastName || 'Kryesor',
            role: 'Përfaqësues Kryesor',
            phone: phone || null,
            email: email || null,
            isPrimary: true
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Klient',
        entityId: customer.id,
        description: `U regjistrua me sukses klienti i ri "${customer.companyName}" (${customer.code}).`
      });

      res.json({ success: true, customer: { id: customer.id, code: customer.code, companyName: customer.companyName } });
    } catch (err) {
      console.error('Gabim në krijimin e shpejtë të klientit:', err);
      res.status(500).json({ success: false, message: 'Ndodhi një problem gjatë regjistrimit të klientit.' });
    }
  }

  static async getDetail(req, res) {
    try {
      const id = parseInt(req.params.id);
      const activeTab = req.query.tab || 'permbledhje';

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          contacts: true,
          opportunities: { orderBy: { createdAt: 'desc' } },
          quotations: {
            include: { items: true },
            orderBy: { createdAt: 'desc' }
          },
          contracts: {
            include: { elevator: true },
            orderBy: { createdAt: 'desc' }
          },
          proformas: {
            include: { items: true },
            orderBy: { createdAt: 'desc' }
          },
          invoices: {
            include: { items: true },
            orderBy: { createdAt: 'desc' }
          },
          payments: {
            orderBy: { date: 'desc' }
          },
          projects: {
            include: { installations: true },
            orderBy: { createdAt: 'desc' }
          },
          handovers: {
            orderBy: { handoverDate: 'desc' }
          },
          maintenanceContracts: {
            include: { elevator: true },
            orderBy: { createdAt: 'desc' }
          },
          serviceTickets: {
            include: { elevator: true },
            orderBy: { reportedDate: 'desc' }
          },
          documents: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!customer) {
        req.flash('error', 'Klienti nuk u gjet.');
        return res.redirect('/klientet');
      }

      // Llogaritjet e përgjithshme financiare të klientit
      const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalPaid = customer.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const balanceDue = Math.max(0, totalInvoiced - totalPaid);

      // Krijo timeline të aktiviteteve të kombinuara
      const timelineEvents = [];

      customer.quotations.forEach(q => {
        timelineEvents.push({
          date: q.createdAt,
          title: `U krijua oferta ${q.number}`,
          description: `Vlera: €${(q.total || 0).toLocaleString('de-DE')} • Statusi: ${q.status}`,
          type: 'quote',
          icon: 'file-text'
        });
      });

      customer.contracts.forEach(c => {
        timelineEvents.push({
          date: c.createdAt,
          title: `U nënshkrua kontrata ${c.number}`,
          description: `Vlera e plotë: €${(c.value || 0).toLocaleString('de-DE')}`,
          type: 'contract',
          icon: 'award'
        });
      });

      customer.invoices.forEach(inv => {
        timelineEvents.push({
          date: inv.createdAt || inv.date,
          title: `U lëshua fatura zyrtare ${inv.number}`,
          description: `Totali: €${(inv.total || 0).toLocaleString('de-DE')} • Statusi: ${inv.status}`,
          type: 'invoice',
          icon: 'file-check'
        });
      });

      customer.payments.forEach(p => {
        timelineEvents.push({
          date: p.date,
          title: `U regjistrua pagesa prej €${(p.amount || 0).toLocaleString('de-DE')}`,
          description: `Metoda: ${p.paymentMethod} • Ref: ${p.referenceNumber || '-'}`,
          type: 'payment',
          icon: 'credit-card'
        });
      });

      customer.projects.forEach(prj => {
        timelineEvents.push({
          date: prj.startDate || prj.createdAt,
          title: `U hap projekti ${prj.name}`,
          description: `Statusi aktual: ${prj.stage} • Lifta: ${prj.elevatorCount}`,
          type: 'project',
          icon: 'briefcase'
        });
      });

      customer.handovers.forEach(h => {
        timelineEvents.push({
          date: h.handoverDate,
          title: `U dorëzua lifti me procesverbal (SN: ${h.serialNumber})`,
          description: `Nënshkruar nga: ${h.clientSigneeName || 'Klienti'} dhe ${h.repSigneeName || 'KRONEER'}`,
          type: 'handover',
          icon: 'check-circle'
        });
      });

      timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

      res.render('klientet/profili', {
        pageTitle: `${customer.companyName} - Profili i Klientit`,
        customer,
        activeTab,
        totalInvoiced,
        totalPaid,
        balanceDue,
        timelineEvents
      });
    } catch (err) {
      console.error('Gabim në detajet e klientit:', err);
      req.flash('error', 'Nuk u arrit të hapet profili i klientit.');
      res.redirect('/klientet');
    }
  }

  static async getEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer) {
        req.flash('error', 'Klienti nuk u gjet.');
        return res.redirect('/klientet');
      }

      const typesList = [
        'Person fizik',
        'Kompani',
        'Ndërtues',
        'Kontraktor',
        'Arkitekt',
        'Zhvillues',
        'Institucion',
        'Menaxher prone'
      ];

      res.render('klientet/ndrysho', {
        pageTitle: `Ndrysho: ${customer.companyName} - KRONEER`,
        customer,
        typesList
      });
    } catch (err) {
      console.error(err);
      res.redirect('/klientet');
    }
  }

  static async postEdit(req, res) {
    try {
      const id = parseInt(req.params.id);
      const {
        type, companyName, firstName, lastName, taxNumber, businessNumber,
        contactPerson, phone, email, website, country, city, address, postalCode, notes,
        buildingName, buildingAddress, floorsCount, elevatorsCount, architect, builderCompany, mainContractor
      } = req.body;

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          type,
          companyName: companyName ? companyName.trim() : null,
          firstName: firstName ? firstName.trim() : null,
          lastName: lastName ? lastName.trim() : null,
          taxNumber: taxNumber ? taxNumber.trim() : null,
          businessNumber: businessNumber ? businessNumber.trim() : null,
          contactPerson: contactPerson ? contactPerson.trim() : null,
          phone: phone ? phone.trim() : null,
          email: email ? email.trim() : null,
          website: website ? website.trim() : null,
          country,
          city: city ? city.trim() : null,
          address: address ? address.trim() : null,
          postalCode: postalCode ? postalCode.trim() : null,
          notes: notes ? notes.trim() : null,
          buildingName: buildingName ? buildingName.trim() : null,
          buildingAddress: buildingAddress ? buildingAddress.trim() : null,
          floorsCount: floorsCount ? parseInt(floorsCount) : 0,
          elevatorsCount: elevatorsCount ? parseInt(elevatorsCount) : 0,
          architect: architect ? architect.trim() : null,
          builderCompany: builderCompany ? builderCompany.trim() : null,
          mainContractor: mainContractor ? mainContractor.trim() : null
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Klient',
        entityId: id,
        description: `Të dhënat e klientit "${updated.companyName}" u përditësuan me sukses.`
      });

      req.flash('success', 'Të dhënat e klientit u përditësuan me sukses.');
      res.redirect(`/klientet/${id}`);
    } catch (err) {
      console.error('Gabim në modifikimin e klientit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së ndryshimeve.');
      res.redirect(`/klientet/${req.params.id}`);
    }
  }

  static async postDelete(req, res) {
    try {
      const id = parseInt(req.params.id);
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (customer) {
        await prisma.customer.delete({ where: { id } });
        await ActivityService.log({
          userId: req.session.user?.id,
          userName: req.session.user?.fullName,
          actionType: 'Fshirë',
          entityType: 'Klient',
          entityId: id,
          description: `Klienti "${customer.companyName}" (${customer.code}) u fshi nga sistemi.`
        });
        req.flash('success', `Klienti "${customer.companyName}" u fshi.`);
      }
      res.redirect('/klientet');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Klienti nuk mund të fshihet pasi ka të dhëna të lidhura me të.');
      res.redirect('/klientet');
    }
  }

  static async getStatementPrint(req, res) {
    try {
      const id = parseInt(req.params.id);
      const [customer, company] = await Promise.all([
        prisma.customer.findUnique({
          where: { id },
          include: {
            invoices: { orderBy: { date: 'desc' } },
            payments: { orderBy: { date: 'desc' } },
            quotations: { orderBy: { date: 'desc' } },
            contracts: { orderBy: { createdAt: 'desc' } }
          }
        }),
        prisma.companySettings.findFirst()
      ]);

      if (!customer) {
        return res.status(404).send('Klienti nuk u gjet.');
      }

      const totalInvoiced = customer.invoices.reduce((s, i) => s + (i.total || 0), 0);
      const totalPaid = customer.payments.reduce((s, p) => s + (p.amount || 0), 0);
      const balanceDue = Math.max(0, totalInvoiced - totalPaid);

      res.render('klientet/pasqyra-print', {
        pageTitle: `Pasqyra_Financiare_${(customer.companyName || 'Klienti').replace(/[^a-zA-Z0-9]/g, '_')}`,
        customer,
        company: company || {},
        totalInvoiced,
        totalPaid,
        balanceDue,
        layout: 'layouts/print'
      });
    } catch (err) {
      console.error('Gabim në gjenerimin e pasqyrës financiare:', err);
      res.status(500).send('Gabim gjatë gjenerimit të pasqyrës.');
    }
  }
}

module.exports = CustomerController;
