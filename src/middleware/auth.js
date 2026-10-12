const prisma = require('../config/prisma');
const NotificationService = require('../services/notificationService');
const { canAssignBonus, isFieldStaff } = require('./roles');

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Ju lutem kyçuni për të hyrë në sistem.');
  return res.redirect('/kycu');
}

let cachedSettings = null;
let cachedSettingsTime = 0;
const SETTINGS_CACHE_TTL = 3 * 60 * 1000; // 3 minuta cache

async function getCachedCompanySettings() {
  const now = Date.now();
  if (cachedSettings && (now - cachedSettingsTime < SETTINGS_CACHE_TTL)) {
    return cachedSettings;
  }
  try {
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = {
        companyName: 'KRONEER',
        tagline: 'Professional Elevator Solutions',
        logoUrl: null,
        logoSvg: null,
        logoDarkBgUrl: '/images/kroneer-logo-white.svg',
        logoDarkBgSvg: null,
        stampUrl: null,
        stampHeight: 80,
        phone: '+383 (0) 38 500 600',
        email: 'info@kroneer-lifts.com',
        address: 'Bulevardi Dëshmorët e Kombit, Nr. 45, Prishtinë',
        currency: 'EUR',
        vatRate: 18
      };
    }
    cachedSettings = settings;
    cachedSettingsTime = now;
    return settings;
  } catch (e) {
    return cachedSettings || {
      companyName: 'KRONEER',
      tagline: 'Professional Elevator Solutions',
      logoDarkBgUrl: '/images/kroneer-logo-white.svg'
    };
  }
}

function invalidateCompanySettingsCache() {
  cachedSettings = null;
  cachedSettingsTime = 0;
}

async function globalLocals(req, res, next) {
  try {
    res.locals.currentUser = req.session ? req.session.user : null;
    res.locals.currentPath = req.path;
  res.locals.navGroups = require('../config/nav').buildNav(req.session && req.session.user);
    res.locals.canAssignBonus = canAssignBonus(res.locals.currentUser);
    res.locals.isFieldStaff = isFieldStaff(res.locals.currentUser);
    res.locals.flashSuccess = req.flash('success');
    res.locals.flashError = req.flash('error');

    // Ekzekuto paralelisht marrjen e cilësimeve dhe njoftimeve me cache në memorie (0ms pritje)
    const [settings, notifData] = await Promise.all([
      getCachedCompanySettings(),
      res.locals.currentUser ? NotificationService.getUserSummary(res.locals.currentUser.id) : Promise.resolve({ unreadCount: 0, recent: [] })
    ]);

    res.locals.company = settings;
    res.locals.canCreateDocs = !!res.locals.currentUser && ['ADMINISTRATOR', 'MENAXHER', 'MENAXHER_PROJEKTI'].includes(res.locals.currentUser.role);
    res.locals.unitList = ((settings && settings.units) || 'copë\nshërbim\nm\nm²\nore\nkomplet\nkg').split(/\r?\n|,/).map(u => u.trim()).filter(Boolean);
    res.locals.unreadNotifCount = notifData.unreadCount || 0;
    res.locals.recentNotifications = notifData.recent || [];

    // Formatuesit e ndihmës në shqip
    res.locals.formatCurrency = (amount) => {
      const num = Number(amount) || 0;
      return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    };

    res.locals.formatDate = (dateString) => {
      if (!dateString) return '-';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    res.locals.formatDateTime = (dateString) => {
      if (!dateString) return '-';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    };

    res.locals.timeAgo = (dateString) => {
      if (!dateString) return '';
      const d = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now - d) / 1000);

      if (seconds < 60) return 'sapo tani';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `para ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `para ${hours} orëve`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'dje';
      if (days < 30) return `para ${days} ditësh`;
      const months = Math.floor(days / 30);
      return `para ${months} muajsh`;
    };

    next();
  } catch (err) {
    console.error('Gabim në ngarkimin e variablave globale:', err);
    next();
  }
}

module.exports = {
  isAuthenticated,
  globalLocals,
  invalidateCompanySettingsCache
};
