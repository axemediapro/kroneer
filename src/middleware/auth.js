const prisma = require('../config/prisma');
const NotificationService = require('../services/notificationService');

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Ju lutem kyçuni për të hyrë në sistem.');
  return res.redirect('/kycu');
}

async function globalLocals(req, res, next) {
  try {
    res.locals.currentUser = req.session ? req.session.user : null;
    res.locals.currentPath = req.path;
    res.locals.flashSuccess = req.flash('success');
    res.locals.flashError = req.flash('error');

    // Merr cilësimet e kompanisë me cache të lehtë
    let settings = await prisma.companySettings.findFirst();
    if (!settings) {
      settings = {
        companyName: 'KRONEER',
        tagline: 'SISTEME LIFTSH',
        logoUrl: null,
        logoSvg: null,
        logoDarkBgUrl: null,
        logoDarkBgSvg: null,
        phone: '+383 (0) 38 500 600',
        email: 'info@kroneer-lifts.com',
        address: 'Bulevardi Dëshmorët e Kombit, Nr. 45, Prishtinë',
        currency: 'EUR',
        vatRate: 18
      };
    }
    res.locals.company = settings;

    // Njoftimet
    if (res.locals.currentUser) {
      res.locals.unreadNotifCount = await NotificationService.getUnreadCount(res.locals.currentUser.id);
      res.locals.recentNotifications = await NotificationService.getRecent(res.locals.currentUser.id, 5);
    } else {
      res.locals.unreadNotifCount = 0;
      res.locals.recentNotifications = [];
    }

    // Formatuesit e ndihmës në shqip
    res.locals.formatCurrency = (amount) => {
      const num = Number(amount) || 0;
      return '€' + num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  globalLocals
};
