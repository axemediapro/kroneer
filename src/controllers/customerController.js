const prisma = require('../config/prisma');
const NumberService = require('../services/numberService');
const ActivityService = require('../services/activityService');
const emailService = require('../services/emailService');
const bcrypt = require('bcryptjs');

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
        orderBy: { createdAt: 'desc' }
      });

      const typesList = [
        'Biznes',
        'Klient Privat'
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
      'Biznes',
      'Klient Privat'
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
        buildingName, buildingAddress, floorsCount, elevatorsCount, architect, builderCompany, mainContractor,
        discountGroup
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
          discountGroup: discountGroup || 'Standard',
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

      // Krijimi automatik i llogarisë së portalit për klientin
      let portalMessage = '';
      if (email) {
        const username = `klient_${customer.code.toLowerCase()}`;
        const existingUser = await prisma.user.findFirst({
          where: { OR: [{ email: email.trim() }, { username }] }
        });

        if (!existingUser) {
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          const passwordHash = await bcrypt.hash('FjalekalimIVlefshem123!', 10);
          
          const user = await prisma.user.create({
            data: {
              username,
              passwordHash,
              fullName: customer.companyName || `${customer.firstName} ${customer.lastName}`,
              email: email.trim(),
              role: 'KLIENT',
              isActive: false,
              isVerified: false,
              verificationCode,
              verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });

          await prisma.customer.update({
            where: { id: customer.id },
            data: { userId: user.id }
          });

          await emailService.sendVerificationEmail(email.trim(), user.fullName, verificationCode);
          portalMessage = ' Llogaria e portalit u krijua dhe emaili i aktivizimit u dërgua.';
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Klient',
        entityId: customer.id,
        description: `U regjistrua me sukses klienti i ri "${customer.companyName}" (${customer.code}).${portalMessage}`
      });

      req.flash('success', `Klienti "${customer.companyName}" u krijua me sukses.${portalMessage}`);
      res.redirect(`/klientet/${customer.id}`);
    } catch (err) {
      console.error('Gabim në krijimin e klientit:', err);
      req.flash('error', 'Ndodhi një problem gjatë regjistrimit të klientit.');
      res.redirect('/klientet/krijo');
    }
  }

  // Gjeokodim i kundërt (koordinata -> shtet, qytet, rrugë) për plotësimin automatik të adresës
  static async reverseGeocode(req, res) {
    try {
      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        return res.status(400).json({ success: false, message: 'Koordinata të pavlefshme.' });
      }
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=sq&zoom=18&lat=${lat}&lon=${lon}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'KRONEER-ERP/1.0' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return res.status(502).json({ success: false, message: 'Shërbimi i vendndodhjes nuk u përgjigj.' });
      const data = await r.json();
      const a = data.address || {};
      const countryMap = { 'XK': 'Kosovë', 'AL': 'Shqipëri', 'ME': 'Mal i Zi', 'MK': 'Maqedonia e Veriut' };
      const street = [a.road || a.pedestrian || a.footway || a.neighbourhood || '', a.house_number || ''].filter(Boolean).join(' ');
      return res.json({
        success: true,
        country: countryMap[(a.country_code || '').toUpperCase()] || null,
        city: a.city || a.town || a.municipality || a.village || a.county || '',
        address: street
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Nuk u arrit të gjendet adresa.' });
    }
  }

  // Krijon llogari portali (rol KLIENT) me përdoruesin = nr. i telefonit ose email-i.
  // Me email: dërgohet kodi i aktivizimit. Vetëm me telefon: llogaria hapet me fjalëkalim të përkohshëm.
  static async createPortalAccount(customer, { phone, email }) {
    try {
      const cleanEmail = (email || '').trim();
      const cleanPhone = (phone || '').trim();
      const phoneDigits = cleanPhone.replace(/[^\d+]/g, '');
      const username = phoneDigits || cleanEmail;
      if (!username) return null;

      const loginEmail = cleanEmail || `${phoneDigits.replace(/\D/g, '')}@klient.kroneer.local`;
      const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: loginEmail }] }
      });
      if (existing) return { created: false, message: 'Ekziston tashmë një llogari me këtë telefon/email.' };

      const fullName = customer.companyName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
      let tempPassword = null;
      let data;
      if (cleanEmail) {
        data = {
          passwordHash: await bcrypt.hash(require('crypto').randomBytes(12).toString('hex'), 10),
          isActive: false,
          isVerified: false,
          verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
          verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
      } else {
        tempPassword = require('crypto').randomBytes(5).toString('hex');
        data = { passwordHash: await bcrypt.hash(tempPassword, 10), isActive: true, isVerified: true };
      }

      const user = await prisma.user.create({
        data: { username, fullName, email: loginEmail, phone: cleanPhone || null, role: 'KLIENT', ...data }
      });
      await prisma.customer.update({ where: { id: customer.id }, data: { userId: user.id } });

      if (cleanEmail) {
        try { await emailService.sendVerificationEmail(cleanEmail, fullName, data.verificationCode); } catch (e) { console.error('Email aktivizimi dështoi:', e.message); }
      }
      return { created: true, username, tempPassword, emailSent: !!cleanEmail };
    } catch (err) {
      console.error('Gabim gjatë krijimit të llogarisë së klientit:', err);
      return null;
    }
  }

  // Krijim i shpejtë i klientit nga popup-e (p.sh. gjatë lëshimit të një fature) - kthen JSON
  static async postQuickCreate(req, res) {
    try {
      const {
        kind, firstName, lastName, companyName, contactPerson, phone, email,
        country, city, address, taxNumber, businessNumber, discountGroup, discountPercent
      } = req.body;

      const isIndivid = kind === 'individ';
      const resolvedCompanyName = isIndivid
        ? `${firstName || ''} ${lastName || ''}`.trim()
        : (companyName || '').trim();

      if (isIndivid && !(phone || '').trim()) {
        return res.status(400).json({ success: false, message: 'Numri i telefonit është i detyrueshëm për klientin individ.' });
      }

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
          country: country || 'Kosovë',
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

      const account = await CustomerController.createPortalAccount(customer, { phone, email });

      res.json({ success: true, customer: { id: customer.id, code: customer.code, companyName: customer.companyName }, account });
    } catch (err) {
      console.error('Gabim në krijimin e shpejtë të klientit:', err);
      res.status(500).json({ success: false, message: 'Ndodhi një problem gjatë regjistrimit të klientit.' });
    }
  }

  static async _logoCustomer(req) {
    const id = parseInt(req.params.id, 10);
    if (!id) return null;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) return null;
    const user = req.session.user || {};
    const allowed = ['ADMINISTRATOR', 'SHITJE'].includes(user.role) || (customer.userId && customer.userId === user.id);
    return allowed ? customer : null;
  }

  static async postUploadLogo(req, res) {
    const back = req.body.returnUrl && req.body.returnUrl.startsWith('/') ? req.body.returnUrl : `/klientet/${req.params.id}`;
    try {
      const customer = await CustomerController._logoCustomer(req);
      if (!customer) {
        if (req.file) require('fs').promises.unlink(req.file.path).catch(() => {});
        req.flash('error', 'Nuk keni leje ose klienti nuk u gjet.');
        return res.redirect('/paneli');
      }
      if (!req.file) {
        req.flash('error', req.uploadError || 'Zgjidhni një skedar JPG ose PNG.');
        return res.redirect(back);
      }
      await prisma.customer.update({ where: { id: customer.id }, data: { logoUrl: `/uploads/customers/${req.file.filename}` } });
      req.flash('success', 'Logo u ruajt.');
    } catch (err) {
      console.error('Gabim te logo e klientit:', err);
      req.flash('error', 'Logo nuk u ruajt.');
    }
    res.redirect(back);
  }

  static async postDeleteLogo(req, res) {
    const back = req.body.returnUrl && req.body.returnUrl.startsWith('/') ? req.body.returnUrl : `/klientet/${req.params.id}`;
    try {
      const customer = await CustomerController._logoCustomer(req);
      if (!customer) {
        req.flash('error', 'Nuk keni leje ose klienti nuk u gjet.');
        return res.redirect('/paneli');
      }
      await prisma.customer.update({ where: { id: customer.id }, data: { logoUrl: null } });
      req.flash('success', 'Logo u hoq.');
    } catch (err) {
      req.flash('error', 'Logo nuk u hoq.');
    }
    res.redirect(back);
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
          description: `Vlera: ${(q.total || 0).toLocaleString('de-DE')} € • Statusi: ${q.status}`,
          type: 'quote',
          icon: 'file-text'
        });
      });

      customer.contracts.forEach(c => {
        timelineEvents.push({
          date: c.createdAt,
          title: `U nënshkrua kontrata ${c.number}`,
          description: `Vlera e plotë: ${(c.value || 0).toLocaleString('de-DE')} €`,
          type: 'contract',
          icon: 'award'
        });
      });

      customer.invoices.forEach(inv => {
        timelineEvents.push({
          date: inv.createdAt || inv.date,
          title: `U lëshua fatura zyrtare ${inv.number}`,
          description: `Totali: ${(inv.total || 0).toLocaleString('de-DE')} € • Statusi: ${inv.status}`,
          type: 'invoice',
          icon: 'file-check'
        });
      });

      customer.payments.forEach(p => {
        timelineEvents.push({
          date: p.date,
          title: `U regjistrua pagesa prej ${(p.amount || 0).toLocaleString('de-DE')} €`,
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
        'Biznes',
        'Klient Privat'
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
        buildingName, buildingAddress, floorsCount, elevatorsCount, architect, builderCompany, mainContractor,
        discountGroup
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
          discountGroup: discountGroup || 'Standard',
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
  static async postCreatePortalAccounts(req, res) {
    try {
      const customers = await prisma.customer.findMany({
        where: { userId: null, email: { not: null, not: '' } }
      });

      let created = 0;
      for (const customer of customers) {
        const username = `klient_${customer.code.toLowerCase()}`;
        
        const existingUser = await prisma.user.findFirst({
          where: { OR: [{ email: customer.email }, { username }] }
        });
        
        if (!existingUser) {
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
          
          const passwordHash = await bcrypt.hash('FjalekalimIVlefshem123!', 10);
          
          const user = await prisma.user.create({
            data: {
              username,
              passwordHash,
              fullName: customer.companyName || `${customer.firstName} ${customer.lastName}`,
              email: customer.email,
              role: 'KLIENT',
              isActive: false,
              isVerified: false,
              verificationCode,
              verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          });

          await prisma.customer.update({
            where: { id: customer.id },
            data: { userId: user.id }
          });

          await emailService.sendVerificationEmail(customer.email, user.fullName, verificationCode);
          created++;
        }
      }

      req.flash('success', `U hapën llogaritë dhe u dërguan email-et e verifikimit për ${created} klientë.`);
      res.redirect('/klientet');
    } catch (err) {
      console.error('Gabim gjatë hapjes masive të llogarive:', err);
      req.flash('error', 'Ndodhi një gabim gjatë hapjes së llogarive.');
      res.redirect('/klientet');
    }
  }
}

module.exports = CustomerController;


