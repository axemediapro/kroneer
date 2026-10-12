const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');
const { normalizeSvgFile } = require('../middleware/upload');
const { invalidateCompanySettingsCache } = require('../middleware/auth');

// Renditja e modeleve nga "prindi" te "fëmija" (respekton varësitë e çelësave të huaj për restore/insert)
const BACKUP_MODEL_ORDER = [
  'user', 'companySettings', 'customer', 'elevator', 'elevatorOption', 'component', 'sparePart',
  'contact', 'opportunity', 'project', 'quotation', 'quotationItem', 'contract', 'elevatorConfiguration',
  'proforma', 'proformaItem', 'invoice', 'invoiceItem', 'payment', 'installation', 'installationChecklist',
  'handover', 'maintenanceContract', 'maintenanceVisit', 'serviceTicket', 'document', 'expense',
  'activity', 'notification'
];
// Renditja e kundërt (nga "fëmija" te "prindi") - përdoret për fshirjen e sigurt gjatë restore
const BACKUP_DELETE_ORDER = [...BACKUP_MODEL_ORDER].reverse();

// Kthen te ISO date-string -> Date object, në mënyrë rekursive (JSON.parse reviver)
function reviveDates(key, value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(value)) {
    return new Date(value);
  }
  return value;
}

class SettingsController {
  static async getIndex(req, res) {
    try {
      const tab = req.query.tab || 'kompania';

      let settings = await prisma.companySettings.findFirst();
      if (!settings) {
        settings = await prisma.companySettings.create({
          data: {
            companyName: 'KRONEER',
            tagline: 'Professional Elevator Solutions',
            address: 'Rruga Dëshmorët e Kombit, Nr. 45',
            city: 'Prishtinë',
            country: 'Kosovë',
            taxNumber: '330123456',
            businessNumber: '70123456',
            phone: '+383 38 500 600',
            email: 'info@kroneer-lifts.com',
            website: 'www.kroneer-lifts.com',
            bankName: 'Banka Kombëtare Tregtare (BKT)',
            iban: 'XK05 1901 0000 1234 5678',
            swift: 'BKTKXKPR',
            currency: 'EUR',
            vatRate: 18
          }
        });
      }

      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'asc' }
      });

      // Statistika të Sistemit
      const [
        customerCount,
        elevatorCount,
        quotationCount,
        contractCount,
        proformaCount,
        invoiceCount,
        paymentCount,
        expenseCount,
        projectCount,
        sparePartCount
      ] = await Promise.all([
        prisma.customer.count(),
        prisma.elevator.count(),
        prisma.quotation.count(),
        prisma.contract.count(),
        prisma.proforma.count(),
        prisma.invoice.count(),
        prisma.payment.count(),
        prisma.expense.count(),
        prisma.project.count(),
        prisma.sparePart.count()
      ]);

      const systemStats = {
        customerCount,
        elevatorCount,
        quotationCount,
        contractCount,
        proformaCount,
        invoiceCount,
        paymentCount,
        expenseCount,
        projectCount,
        sparePartCount,
        nodeVersion: process.version,
        platform: process.platform,
        uptime: Math.floor(process.uptime())
      };

      res.render('cilesimet/index', {
        pageTitle: 'Cilësimet e Sistemit - KRONEER',
        activeTab: tab,
        settings,
        users,
        systemStats
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e cilësimeve:', err);
      req.flash('error', 'Nuk u ngarkuan cilësimet.');
      res.redirect('/paneli');
    }
  }

  static async postUpdateUnits(req, res) {
    try {
      const list = [...new Set(String(req.body.units || '').split(/\r?\n|,/).map(u => u.trim().slice(0, 20)).filter(Boolean))];
      if (!list.length) {
        req.flash('error', 'Shtoni të paktën një njësi.');
        return res.redirect('/cilesimet');
      }
      const data = { units: list.join('\n') };
      const first = await prisma.companySettings.findFirst();
      if (first) await prisma.companySettings.update({ where: { id: first.id }, data });
      else await prisma.companySettings.create({ data });
      invalidateCompanySettingsCache();
      req.flash('success', 'Njësitë u ruajtën.');
    } catch (err) {
      console.error('Gabim te njësitë:', err);
      req.flash('error', 'Njësitë nuk u ruajtën.');
    }
    res.redirect('/cilesimet');
  }
  static async postUpdateTurnstile(req, res) {
    try {
      const siteKey = (req.body.turnstileSiteKey || '').trim();
      const secret = (req.body.turnstileSecretKey || '').trim();
      const data = { turnstileSiteKey: siteKey || null };
      if (secret) data.turnstileSecretKey = secret;
      if (req.body.clearSecret === '1') data.turnstileSecretKey = null;
      const first = await prisma.companySettings.findFirst();
      if (first) await prisma.companySettings.update({ where: { id: first.id }, data });
      else await prisma.companySettings.create({ data });
      req.flash('success', 'Çelësat e Cloudflare Turnstile u ruajtën.');
    } catch (err) {
      console.error('Gabim te Turnstile:', err);
      req.flash('error', 'Çelësat nuk u ruajtën.');
    }
    res.redirect('/cilesimet');
  }
  static async postUpdateCompany(req, res) {
    try {
      const {
        companyName, tagline, address, city, country,
        taxNumber, businessNumber, phone, email, website,
        bankName, iban, swift,
        bankName2, iban2, swift2,
        bankName3, iban3, swift3,
        currency, vatRate,
        quotePrefix, contractPrefix, proformaPrefix, invoicePrefix, projectPrefix, servicePrefix, paymentPrefix
      } = req.body;

      const first = await prisma.companySettings.findFirst();

      if (first) {
        await prisma.companySettings.update({
          where: { id: first.id },
          data: {
            companyName: companyName ? companyName.trim() : 'KRONEER',
            tagline: tagline ? tagline.trim() : 'Professional Elevator Solutions',
            address: address ? address.trim() : null,
            city: city ? city.trim() : null,
            country: country ? country.trim() : 'Kosovë',
            taxNumber: taxNumber ? taxNumber.trim() : null,
            businessNumber: businessNumber ? businessNumber.trim() : null,
            phone: phone ? phone.trim() : null,
            email: email ? email.trim() : null,
            website: website ? website.trim() : null,
            bankName: bankName ? bankName.trim() : null,
            iban: iban ? iban.trim() : null,
            swift: swift ? swift.trim() : null,
            bankName2: bankName2 ? bankName2.trim() : null,
            iban2: iban2 ? iban2.trim() : null,
            swift2: swift2 ? swift2.trim() : null,
            bankName3: bankName3 ? bankName3.trim() : null,
            iban3: iban3 ? iban3.trim() : null,
            swift3: swift3 ? swift3.trim() : null,
            currency: currency || 'EUR',
            vatRate: parseFloat(vatRate) || 18,
            quotePrefix: quotePrefix ? quotePrefix.trim() : 'KR-O',
            contractPrefix: contractPrefix ? contractPrefix.trim() : 'KR-K',
            proformaPrefix: proformaPrefix ? proformaPrefix.trim() : 'KR-PF',
            invoicePrefix: invoicePrefix ? invoicePrefix.trim() : 'KR-F',
            projectPrefix: projectPrefix ? projectPrefix.trim() : 'KR-PRJ',
            servicePrefix: servicePrefix ? servicePrefix.trim() : 'KR-SRV',
            paymentPrefix: paymentPrefix ? paymentPrefix.trim() : 'KR-PAG'
          }
        });
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Cilësime',
        entityId: first?.id,
        description: 'U përditësuan cilësimet e kompanisë dhe parametrat e sistemit KRONEER.'
      });

      invalidateCompanySettingsCache();

      const tab = req.body.returnTab || 'kompania';
      req.flash('success', 'Cilësimet u ruajtën me sukses.');
      res.redirect(`/cilesimet?tab=${tab}`);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së cilësimeve.');
      res.redirect('/cilesimet');
    }
  }

  static async postCreateUser(req, res) {
    try {
      const { username, password, fullName, email, role, phone } = req.body;
      const allowedRoles = ['ADMINISTRATOR', 'MENAXHER', 'MENAXHER_PROJEKTI', 'TEKNIK', 'SHITJE', 'FINANCE'];

      if (!username || !password || !fullName || !email) {
        req.flash('error', 'Ju lutem plotësoni të gjitha fushat e kërkuara (*).');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      if (password.trim().length < 6) {
        req.flash('error', 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      if (!allowedRoles.includes(role)) {
        req.flash('error', 'Roli i zgjedhur nuk është i vlefshëm.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: username.trim(), mode: 'insensitive' } },
            { email: { equals: email.trim(), mode: 'insensitive' } }
          ]
        }
      });

      if (existing) {
        req.flash('error', 'Ky përdorues ose email ekziston tashmë.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password.trim(), salt);

      const newUser = await prisma.user.create({
        data: {
          username: username.trim(),
          passwordHash,
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          phone: phone ? phone.trim() : null,
          isActive: true
        }
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Përdorues',
        entityId: newUser.id,
        description: `U shtua përdoruesi i ri "${newUser.fullName}" me rolin [${newUser.role}].`
      });

      req.flash('success', `Përdoruesi ${newUser.fullName} u krijua me sukses.`);
      res.redirect('/cilesimet?tab=perdoruesit');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk u krijua dot përdoruesi.');
      res.redirect('/cilesimet?tab=perdoruesit');
    }
  }

  static async postEditUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      const { fullName, email, phone, role, password } = req.body;
      const allowedRoles = ['ADMINISTRATOR', 'MENAXHER', 'MENAXHER_PROJEKTI', 'TEKNIK', 'SHITJE', 'FINANCE'];

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        req.flash('error', 'Përdoruesi nuk u gjet.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      if (role && !allowedRoles.includes(role)) {
        req.flash('error', 'Roli i zgjedhur nuk është i vlefshëm.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      if (password && password.trim() && password.trim().length < 6) {
        req.flash('error', 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      const updateData = {
        fullName: fullName ? fullName.trim() : user.fullName,
        email: email ? email.trim() : user.email,
        phone: phone ? phone.trim() : user.phone,
        role: role || user.role
      };

      if (password && password.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(password.trim(), salt);
      }

      await prisma.user.update({
        where: { id },
        data: updateData
      });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Përdorues',
        entityId: id,
        description: `U modifikuan të dhënat e përdoruesit "${updateData.fullName}".`
      });

      req.flash('success', `Të dhënat e përdoruesit ${updateData.fullName} u përditësuan me sukses.`);
      res.redirect('/cilesimet?tab=perdoruesit');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Ndodhi një gabim gjatë përditësimit të përdoruesit.');
      res.redirect('/cilesimet?tab=perdoruesit');
    }
  }

  static async postToggleUserStatus(req, res) {
    try {
      const id = parseInt(req.params.id);
      const user = await prisma.user.findUnique({ where: { id } });

      if (user && user.username !== 'admin') {
        await prisma.user.update({
          where: { id },
          data: { isActive: !user.isActive }
        });
        req.flash('success', `Statusi i përdoruesit ${user.fullName} u ndryshua me sukses.`);
      } else if (user && user.username === 'admin') {
        req.flash('error', 'Statusi i llogarisë kryesore admin nuk mund të çaktivizohet.');
      }

      res.redirect('/cilesimet?tab=perdoruesit');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Ndodhi një gabim gjatë ndryshimit të statusit.');
      res.redirect('/cilesimet?tab=perdoruesit');
    }
  }

  static async postDeleteUser(req, res) {
    try {
      const id = parseInt(req.params.id);
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        req.flash('error', 'Përdoruesi nuk u gjet.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      if (user.username === 'admin' || user.id === req.session.user?.id) {
        req.flash('error', 'Nuk mund të fshini llogarinë kryesore të administratorit ose llogarinë tuaj aktive me të cilën jeni kyçur.');
        return res.redirect('/cilesimet?tab=perdoruesit');
      }

      await prisma.user.delete({ where: { id } });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Përdorues',
        entityId: id,
        description: `U fshi përdoruesi "${user.fullName}" (${user.username}).`
      });

      req.flash('success', `Përdoruesi ${user.fullName} u fshi me sukses nga sistemi.`);
      res.redirect('/cilesimet?tab=perdoruesit');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Nuk mund të fshihet përdoruesi pasi ka regjistrime (aktivitete ose fushata) të lidhura në sistem.');
      res.redirect('/cilesimet?tab=perdoruesit');
    }
  }

  static async postUploadLogo(req, res) {
    try {
      const returnUrl = req.body.returnUrl || req.headers.referer || '/paneli';
      const variant = req.body.variant === 'dark_bg' ? 'dark_bg' : 'standard';

      if (!req.file) {
        req.flash('error', 'Ju lutem zgjidhni një skedar të vlefshëm logoje (SVG, PNG, JPG, WebP).');
        return res.redirect(returnUrl);
      }

      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      let svgContent = null;

      // Nëse është skedar SVG, e normalizojmë për shfaqje të përkryer pa deformim
      if (ext === '.svg' || req.file.mimetype.includes('svg')) {
        svgContent = normalizeSvgFile(filePath);
      }

      const logoUrl = `/uploads/logos/${req.file.filename}`;

      let company = await prisma.companySettings.findFirst();
      if (!company) {
        const createData = {
          companyName: 'KRONEER',
          tagline: 'Professional Elevator Solutions'
        };
        if (variant === 'dark_bg') {
          createData.logoDarkBgUrl = logoUrl;
          createData.logoDarkBgSvg = svgContent;
        } else {
          createData.logoUrl = logoUrl;
          createData.logoSvg = svgContent;
        }
        company = await prisma.companySettings.create({ data: createData });
      } else {
        // Fshijmë skedarin e vjetër përkatës nëse ekziston
        if (variant === 'dark_bg') {
          if (company.logoDarkBgUrl && company.logoDarkBgUrl.startsWith('/uploads/logos/')) {
            const oldFilename = path.basename(company.logoDarkBgUrl);
            const oldPath = path.join(__dirname, '../../public/uploads/logos', oldFilename);
            if (fs.existsSync(oldPath) && oldFilename !== req.file.filename) {
              try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
          }
          await prisma.companySettings.update({
            where: { id: company.id },
            data: {
              logoDarkBgUrl: logoUrl,
              logoDarkBgSvg: svgContent
            }
          });
        } else {
          if (company.logoUrl && company.logoUrl.startsWith('/uploads/logos/')) {
            const oldFilename = path.basename(company.logoUrl);
            const oldPath = path.join(__dirname, '../../public/uploads/logos', oldFilename);
            if (fs.existsSync(oldPath) && oldFilename !== req.file.filename) {
              try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
          }
          await prisma.companySettings.update({
            where: { id: company.id },
            data: {
              logoUrl: logoUrl,
              logoSvg: svgContent
            }
          });
        }
      }

      const variantTitle = variant === 'dark_bg' ? 'Logoja e Bardhë (për sfond të errët / Dark UI)' : 'Logoja Kryesore (për dokumente & sfond të bardhë)';

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Cilësime',
        entityId: company.id,
        description: `U ngarkua me sukses ${variantTitle} (${ext.toUpperCase().replace('.', '') || 'SVG'}) pa deformim.`
      });

      invalidateCompanySettingsCache();

      req.flash('success', `${variantTitle} u ngarkua dhe u përditësua me sukses në sistem!`);
      res.redirect(returnUrl);
    } catch (err) {
      console.error('Gabim gjatë ngarkimit të logos:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ngarkimit të logos: ' + (err.message || 'Procesi dështoi'));
      res.redirect(req.body.returnUrl || '/paneli');
    }
  }

  static async postDeleteLogo(req, res) {
    try {
      const returnUrl = req.body.returnUrl || req.headers.referer || '/paneli';
      const variant = req.body.variant === 'dark_bg' ? 'dark_bg' : (req.body.variant === 'all' ? 'all' : 'standard');
      const company = await prisma.companySettings.findFirst();

      if (!company) {
        req.flash('info', 'Nuk u gjetën cilësime të kompanisë.');
        return res.redirect(returnUrl);
      }

      if (variant === 'dark_bg') {
        if (company.logoDarkBgUrl) {
          if (company.logoDarkBgUrl.startsWith('/uploads/logos/')) {
            const oldFilename = path.basename(company.logoDarkBgUrl);
            const oldPath = path.join(__dirname, '../../public/uploads/logos', oldFilename);
            if (fs.existsSync(oldPath)) {
              try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
          }
          await prisma.companySettings.update({
            where: { id: company.id },
            data: {
              logoDarkBgUrl: null,
              logoDarkBgSvg: null
            }
          });
          req.flash('success', 'Logoja e bardhë për sfond të errët u fshi me sukses.');
        } else {
          req.flash('info', 'Nuk ka logo të bardhë të konfiguruar.');
        }
      } else if (variant === 'all') {
        // Fshi të dyja
        [company.logoUrl, company.logoDarkBgUrl].forEach(url => {
          if (url && url.startsWith('/uploads/logos/')) {
            const oldFilename = path.basename(url);
            const oldPath = path.join(__dirname, '../../public/uploads/logos', oldFilename);
            if (fs.existsSync(oldPath)) {
              try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
          }
        });
        await prisma.companySettings.update({
          where: { id: company.id },
          data: {
            logoUrl: null,
            logoSvg: null,
            logoDarkBgUrl: null,
            logoDarkBgSvg: null
          }
        });
        req.flash('success', 'Të gjitha logot e personalizuara u fshinë me sukses.');
      } else {
        // Standard
        if (company.logoUrl) {
          if (company.logoUrl.startsWith('/uploads/logos/')) {
            const oldFilename = path.basename(company.logoUrl);
            const oldPath = path.join(__dirname, '../../public/uploads/logos', oldFilename);
            if (fs.existsSync(oldPath)) {
              try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
            }
          }
          await prisma.companySettings.update({
            where: { id: company.id },
            data: {
              logoUrl: null,
              logoSvg: null
            }
          });
          req.flash('success', 'Logoja kryesore për dokumente u fshi me sukses.');
        } else {
          req.flash('info', 'Nuk ka logo kryesore të konfiguruar.');
        }
      }

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Fshirë',
        entityType: 'Cilësime',
        entityId: company.id,
        description: `U fshi logoja (${variant === 'dark_bg' ? 'Dark UI' : 'Standarde'}) e kompanisë.`
      });

      invalidateCompanySettingsCache();
      res.redirect(returnUrl);
    } catch (err) {
      console.error('Gabim gjatë fshirjes së logos:', err);
      req.flash('error', 'Ndodhi një gabim gjatë fshirjes së logos.');
      res.redirect(req.body.returnUrl || '/paneli');
    }
  }

  static async postUploadStamp(req, res) {
    try {
      const returnUrl = req.body.returnUrl || req.headers.referer || '/cilesimet?tab=kompania';

      if (!req.file) {
        req.flash('error', 'Ju lutem zgjidhni një skedar të vlefshëm për vulën dhe nënshkrimin (.PNG, .WebP, .SVG, .JPG).');
        return res.redirect(returnUrl);
      }

      const stampUrl = `/uploads/stamps/${req.file.filename}`;

      let company = await prisma.companySettings.findFirst();
      const initialHeight = req.body.stampHeight ? Math.max(30, Math.min(300, parseInt(req.body.stampHeight, 10))) : 80;
      if (!company) {
        company = await prisma.companySettings.create({
          data: {
            companyName: 'KRONEER',
            tagline: 'Professional Elevator Solutions',
            stampUrl,
            stampHeight: initialHeight
          }
        });
      } else {
        // Fshijmë skedarin e mëparshëm nëse ekziston
        if (company.stampUrl && company.stampUrl.startsWith('/uploads/stamps/')) {
          const oldFilename = path.basename(company.stampUrl);
          const oldPath = path.join(__dirname, '../../public/uploads/stamps', oldFilename);
          if (fs.existsSync(oldPath) && oldFilename !== req.file.filename) {
            try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
          }
        }
        await prisma.companySettings.update({
          where: { id: company.id },
          data: { 
            stampUrl,
            ...(req.body.stampHeight ? { stampHeight: initialHeight } : {})
          }
        });
      }

      invalidateCompanySettingsCache();

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Cilësime',
        entityId: company.id,
        description: 'U ngarkua me sukses vula dhe nënshkrimi zyrtar (.PNG) për dokumentet dhe faturat e KRONEER.'
      });

      req.flash('success', 'Vula dhe nënshkrimi zyrtar (.PNG) u ngarkua me sukses dhe do të shfaqet automatikisht në të gjitha faturat, ofertat dhe kontratat.');
      res.redirect(returnUrl);
    } catch (err) {
      console.error('Gabim gjatë ngarkimit të vulës/nënshkrimit:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ngarkimit të vulës: ' + (err.message || 'Dështoi'));
      res.redirect(req.body.returnUrl || '/cilesimet');
    }
  }

  static async postUpdateStampSize(req, res) {
    try {
      const returnUrl = req.body.returnUrl || req.headers.referer || '/cilesimet?tab=kompania';
      const height = Math.max(30, Math.min(300, parseInt(req.body.stampHeight, 10) || 80));

      let company = await prisma.companySettings.findFirst();
      if (!company) {
        company = await prisma.companySettings.create({
          data: {
            companyName: 'KRONEER',
            tagline: 'Professional Elevator Solutions',
            stampHeight: height
          }
        });
      } else {
        await prisma.companySettings.update({
          where: { id: company.id },
          data: { stampHeight: height }
        });
      }

      invalidateCompanySettingsCache();

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Cilësime',
        entityId: company.id,
        description: `U përditësua madhësia e vulës dhe nënshkrimit zyrtar në ${height}px.`
      });

      req.flash('success', `Madhësia e vulës dhe nënshkrimit u përditësua në ${height}px me sukses!`);
      res.redirect(returnUrl);
    } catch (err) {
      console.error('Gabim gjatë përditësimit të madhësisë së vulës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë ruajtjes së madhësisë së vulës.');
      res.redirect(req.body.returnUrl || '/cilesimet');
    }
  }

  static async postDeleteStamp(req, res) {
    try {
      const returnUrl = req.body.returnUrl || req.headers.referer || '/cilesimet?tab=kompania';
      const company = await prisma.companySettings.findFirst();

      if (company && company.stampUrl) {
        if (company.stampUrl.startsWith('/uploads/stamps/')) {
          const oldFilename = path.basename(company.stampUrl);
          const oldPath = path.join(__dirname, '../../public/uploads/stamps', oldFilename);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ }
          }
        }
        await prisma.companySettings.update({
          where: { id: company.id },
          data: { stampUrl: null }
        });

        invalidateCompanySettingsCache();

        await ActivityService.log({
          userId: req.session.user?.id,
          userName: req.session.user?.fullName,
          actionType: 'Fshirë',
          entityType: 'Cilësime',
          entityId: company.id,
          description: 'U hoq vula dhe nënshkrimi zyrtar i kompanisë nga dokumentet.'
        });

        req.flash('success', 'Vula dhe nënshkrimi zyrtar u hoqën me sukses nga dokumentet.');
      } else {
        req.flash('info', 'Nuk ka vulë të konfiguruar.');
      }

      res.redirect(returnUrl);
    } catch (err) {
      console.error('Gabim gjatë fshirjes së vulës:', err);
      req.flash('error', 'Ndodhi një gabim gjatë fshirjes së vulës.');
      res.redirect(req.body.returnUrl || '/cilesimet');
    }
  }

  // Eksporton krejt të dhënat e sistemit si një skedar .json të shkarkueshëm (Backup)
  static async getBackup(req, res) {
    try {
      const data = {};
      for (const model of BACKUP_MODEL_ORDER) {
        data[model] = await prisma[model].findMany();
      }

      const payload = {
        app: 'KRONEER ERP & CRM',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user?.fullName || 'Sistemi',
        data
      };

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Krijuar',
        entityType: 'Backup',
        description: 'U gjenerua një backup i plotë i të dhënave të sistemit (.json).'
      });

      const filename = `kroneer-backup-${new Date().toISOString().slice(0, 10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error('Gabim gjatë krijimit të backup-it:', err);
      req.flash('error', 'Ndodhi një gabim gjatë krijimit të backup-it.');
      res.redirect('/cilesimet?tab=sistemi');
    }
  }

  // Rikthen (Restore) krejt të dhënat e sistemit nga një skedar .json backup - FSHIN dhe RISHKRUAN çdo tabelë
  static async postRestore(req, res) {
    try {
      if (!req.file) {
        req.flash('error', 'Ju lutem ngarkoni një skedar backup .json.');
        return res.redirect('/cilesimet?tab=sistemi');
      }

      let payload;
      try {
        payload = JSON.parse(req.file.buffer.toString('utf8'), reviveDates);
      } catch (parseErr) {
        req.flash('error', 'Skedari i ngarkuar nuk është një JSON i vlefshëm.');
        return res.redirect('/cilesimet?tab=sistemi');
      }

      const backupData = payload && payload.data;
      if (!backupData || typeof backupData !== 'object') {
        req.flash('error', 'Struktura e skedarit të backup-it nuk njihet.');
        return res.redirect('/cilesimet?tab=sistemi');
      }

      await prisma.$transaction(async (tx) => {
        // Thyejmë varësinë ciklike opsionale Project <-> Contract përpara fshirjes
        await tx.project.updateMany({ data: { contractId: null } }).catch(() => {});

        for (const model of BACKUP_DELETE_ORDER) {
          await tx[model].deleteMany();
        }

        for (const model of BACKUP_MODEL_ORDER) {
          const rows = Array.isArray(backupData[model]) ? backupData[model] : [];
          if (rows.length === 0) continue;

          if (model === 'project') {
            // Ruajmë contractId origjinal, e vendosim më vonë (hapi 2) pas krijimit të Contract-ave
            for (const row of rows) {
              const { contractId, ...rest } = row;
              await tx.project.create({ data: rest });
            }
          } else {
            for (const row of rows) {
              await tx[model].create({ data: row });
            }
          }
        }

        // Hapi i dytë: rivendosim project.contractId nga backup-i origjinal
        const projectRows = Array.isArray(backupData.project) ? backupData.project : [];
        for (const row of projectRows) {
          if (row.contractId) {
            await tx.project.update({ where: { id: row.id }, data: { contractId: row.contractId } }).catch(() => {});
          }
        }
      }, { timeout: 120000 });

      await ActivityService.log({
        userId: req.session.user?.id,
        userName: req.session.user?.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Backup',
        description: `U rikthye (restore) baza e t\u00eb dh\u00ebnave nga skedari "${req.file.originalname}".`
      });

      req.flash('success', 'Të dhënat u rikthyen me sukses nga skedari i backup-it.');
      res.redirect('/cilesimet?tab=sistemi');
    } catch (err) {
      console.error('Gabim gjatë restore-it të backup-it:', err);
        req.flash('error', 'Ndodhi një gabim gjatë rikthimit të të dhënave. Asnjë ndryshim nuk u ruajt.');
      res.redirect('/cilesimet?tab=sistemi');
    }
  }

  static async getProfile(req, res) {
    try {
      const sessionUser = req.session.user;
      const profileUser = await prisma.user.findUnique({
        where: { id: sessionUser.id }
      });

      if (!profileUser) {
        req.flash('error', 'Llogaria nuk u gjet.');
        return res.redirect('/paneli');
      }

      const customer = await prisma.customer.findFirst({ where: { userId: profileUser.id } });
      res.render('cilesimet/profili', {
        customer,
        pageTitle: 'Cilësimet e Llogarisë - KRONEER',
        profileUser
      });
    } catch (err) {
      console.error('Gabim në ngarkimin e profilit:', err);
      req.flash('error', 'Nuk u ngarkuan cilësimet e llogarisë.');
      res.redirect('/paneli');
    }
  }

  static async postUpdateProfile(req, res) {
    try {
      const userId = req.session.user && req.session.user.id;
      if (!userId) {
        return res.redirect('/kycu');
      }

      const { fullName, email, phone, currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        req.flash('error', 'Llogaria nuk u gjet.');
        return res.redirect('/cilesimet');
      }

      const updateData = {
        fullName: (fullName || user.fullName).trim(),
        email: (email || user.email).trim(),
        phone: phone ? phone.trim() : null
      };

      if (newPassword && newPassword.trim()) {
        if (!currentPassword) {
          req.flash('error', 'Shkruani fjalëkalimin aktual për të ndryshuar fjalëkalimin.');
          return res.redirect('/cilesimet');
        }
        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) {
          req.flash('error', 'Fjalëkalimi aktual është i pasaktë.');
          return res.redirect('/cilesimet');
        }
        if (newPassword.trim().length < 6) {
          req.flash('error', 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere.');
          return res.redirect('/cilesimet');
        }
        const salt = await bcrypt.genSalt(10);
        updateData.passwordHash = await bcrypt.hash(newPassword.trim(), salt);
      }

      const emailTaken = await prisma.user.findFirst({
        where: { email: updateData.email, NOT: { id: userId } }
      });
      if (emailTaken) {
        req.flash('error', 'Ky email përdoret nga një llogari tjetër.');
        return res.redirect('/cilesimet');
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData
      });

      await prisma.employee.updateMany({
        where: { userId },
        data: {
          email: updated.email,
          phone: updated.phone
        }
      });

      req.session.user = {
        ...req.session.user,
        fullName: updated.fullName,
        email: updated.email
      };

      await ActivityService.log({
        userId,
        userName: updated.fullName,
        actionType: 'Ndryshuar',
        entityType: 'Përdorues',
        entityId: userId,
        description: `Përdoruesi ${updated.fullName} përditësoi të dhënat e llogarisë së vet.`
      });

      req.flash('success', 'Të dhënat e llogarisë suaj u ruajtën.');
      res.redirect('/cilesimet');
    } catch (err) {
      console.error('Gabim në ruajtjen e profilit:', err);
      req.flash('error', 'Nuk u ruajtën të dhënat e llogarisë.');
      res.redirect('/cilesimet');
    }
  }
}

module.exports = SettingsController;
