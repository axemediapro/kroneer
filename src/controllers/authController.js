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

      const cleanUsername = username.trim();

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: cleanUsername, mode: 'insensitive' } },
            { email: { equals: cleanUsername, mode: 'insensitive' } }
          ],
          isActive: true
        }
      });

      // Auto-bootstrap default Kroneer administrator if not found
      if (!user && (cleanUsername.toLowerCase() === 'kroneer' || cleanUsername.toLowerCase() === 'admin') && password === 'Kroneer#26') {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Kroneer#26', salt);
        user = await prisma.user.upsert({
          where: { username: 'Kroneer' },
          update: {
            passwordHash,
            isActive: true,
            role: 'ADMINISTRATOR'
          },
          create: {
            username: 'Kroneer',
            passwordHash,
            fullName: 'Administrator KRONEER',
            email: 'admin@kroneer-lifts.com',
            role: 'ADMINISTRATOR',
            phone: '+383 44 111 222',
            isActive: true
          }
        });
      }

      if (!user) {
        req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
        return res.redirect('/kycu');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        // Fallback check if user is Kroneer and enters the default password
        if ((user.username.toLowerCase() === 'kroneer' || user.username.toLowerCase() === 'admin') && password === 'Kroneer#26') {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash('Kroneer#26', salt);
          user = await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash }
          });
        } else {
          req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
          return res.redirect('/kycu');
        }
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
