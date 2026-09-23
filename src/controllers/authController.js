const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');

class AuthController {
  static getLogin(req, res) {
    if (req.session && req.session.user) {
      return res.redirect('/paneli');
    }
    res.render('auth/login', {
      pageTitle: 'Hyrja në Sistem - KRONEER',
      layout: false
    });
  }

  static async postLogin(req, res) {
    try {
      const { username, password, remember } = req.body;

      if (!username || !password) {
        req.flash('error', 'Ju lutem plotësoni të gjitha fushat e kërkuara.');
        return res.redirect('/kycu');
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: username.trim() },
            { email: username.trim() }
          ],
          isActive: true
        }
      });

      if (!user) {
        req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
        return res.redirect('/kycu');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
        return res.redirect('/kycu');
      }

      // Konfiguro sesionin
      req.session.user = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      };

      if (remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ditë
      } else {
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 ditë
      }

      await ActivityService.log({
        userId: user.id,
        userName: user.fullName,
        actionType: 'Kyçje',
        entityType: 'Përdorues',
        entityId: user.id,
        description: `Përdoruesi ${user.fullName} u kyç në sistem me sukses.`
      });

      req.flash('success', `Mirë se erdhe përsëri, ${user.fullName}!`);
      res.redirect('/paneli');
    } catch (err) {
      console.error('Gabim gjatë kyçjes:', err);
      req.flash('error', 'Ndodhi një problem gjatë kyçjes.');
      res.redirect('/kycu');
    }
  }

  static async logout(req, res) {
    if (req.session.user) {
      await ActivityService.log({
        userId: req.session.user.id,
        userName: req.session.user.fullName,
        actionType: 'Çkyçje',
        entityType: 'Përdorues',
        entityId: req.session.user.id,
        description: `Përdoruesi ${req.session.user.fullName} u çkyç nga sistemi.`
      });
    }

    req.session.destroy(() => {
      res.redirect('/kycu');
    });
  }
}

module.exports = AuthController;
