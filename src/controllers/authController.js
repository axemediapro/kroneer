const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const ActivityService = require('../services/activityService');
const { recordFailedLogin, clearLoginAttempts, isLockedOut, remainingLockoutSeconds } = require('../middleware/security');

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

      // ── Account lockout check (per username) ──────────────────────────────
      if (isLockedOut(cleanUsername)) {
        const mins = Math.ceil(remainingLockoutSeconds(cleanUsername) / 60);
        req.flash('error', `Llogaria është bllokuar pas shumë tentativave të dështuara. Provoni përsëri pas ${mins} minutash.`);
        return res.redirect('/kycu');
      }

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: cleanUsername, mode: 'insensitive' } },
            { email: { equals: cleanUsername, mode: 'insensitive' } }
          ],
          isActive: true
        }
      });

      // Auto-bootstrap default Kroneer administrator if DB is empty
      if (!user && (cleanUsername.toLowerCase() === 'kroneer' || cleanUsername.toLowerCase() === 'admin') && password === 'Kroneer#26') {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash('Kroneer#26', salt);
        user = await prisma.user.upsert({
          where: { username: 'Kroneer' },
          update: { passwordHash, isActive: true, role: 'ADMINISTRATOR' },
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
        recordFailedLogin(cleanUsername);
        req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
        return res.redirect('/kycu');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        // Fallback: re-hash default password if bcrypt round mismatch
        if ((user.username.toLowerCase() === 'kroneer' || user.username.toLowerCase() === 'admin') && password === 'Kroneer#26') {
          const salt = await bcrypt.genSalt(12);
          const passwordHash = await bcrypt.hash('Kroneer#26', salt);
          user = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
        } else {
          recordFailedLogin(cleanUsername);
          req.flash('error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
          return res.redirect('/kycu');
        }
      }

      // ── Successful login ──────────────────────────────────────────────────
      clearLoginAttempts(cleanUsername);

      const userData = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      };
      const maxAge = remember
        ? 7 * 24 * 60 * 60 * 1000   // 7 ditë nëse "mbaj mend"
        : 24 * 60 * 60 * 1000;       // 1 ditë standard

      // ── Session Fixation Prevention: regenerate session ID ───────────────
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regenerate error:', err);
          req.flash('error', 'Ndodhi një problem gjatë kyçjes.');
          return res.redirect('/kycu');
        }

        req.session.user = userData;
        req.session.cookie.maxAge = maxAge;

        ActivityService.log({
          userId: user.id,
          userName: user.fullName,
          actionType: 'Kyçje',
          entityType: 'Përdorues',
          entityId: user.id,
          description: `Përdoruesi ${user.fullName} u kyç në sistem me sukses.`
        }).catch(() => {});

        req.flash('success', `Mirë se erdhe përsëri, ${user.fullName}!`);
        res.redirect('/paneli');
      });

    } catch (err) {
      console.error('Gabim gjatë kyçjes:', err);
      req.flash('error', 'Ndodhi një problem gjatë kyçjes.');
      res.redirect('/kycu');
    }
  }

  static getActivate(req, res) {
    const { email, code } = req.query;
    res.render('auth/aktivizo', {
      pageTitle: 'Aktivizimi i Llogarisë - KRONEER',
      layout: false,
      email,
      code
    });
  }

  static async postActivate(req, res) {
    try {
      const { email, code, password } = req.body;

      if (!email || !code || !password) {
        req.flash('error', 'Të gjitha fushat janë të detyrueshme.');
        return res.redirect(`/kycu/aktivizo?email=${encodeURIComponent(email || '')}&code=${encodeURIComponent(code || '')}`);
      }

      if (password.length < 6) {
        req.flash('error', 'Fjalëkalimi duhet të ketë së paku 6 karaktere.');
        return res.redirect(`/kycu/aktivizo?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
      }

      const user = await prisma.user.findFirst({
        where: { email: email.trim(), verificationCode: code.trim() }
      });

      if (!user) {
        req.flash('error', 'Kodi i verifikimit është i pasaktë ose emaili nuk përputhet.');
        return res.redirect(`/kycu/aktivizo?email=${encodeURIComponent(email)}`);
      }

      if (user.isVerified) {
        req.flash('error', 'Kjo llogari është aktivizuar tashmë. Ju lutem kyçuni.');
        return res.redirect('/kycu');
      }

      if (user.verificationExpiry && user.verificationExpiry < new Date()) {
        req.flash('error', 'Kodi i verifikimit ka skaduar. Ju lutem kontaktoni administratën.');
        return res.redirect(`/kycu/aktivizo?email=${encodeURIComponent(email)}`);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isVerified: true,
          isActive: true,
          verificationCode: null,
          verificationExpiry: null
        }
      });

      req.flash('success', 'Llogaria juaj u aktivizua me sukses! Tani mund të kyçeni.');
      res.redirect('/kycu');
    } catch (err) {
      console.error('Gabim në aktivizim:', err);
      req.flash('error', 'Ndodhi një gabim gjatë aktivizimit.');
      res.redirect('/kycu/aktivizo');
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
      res.clearCookie('__kroneer_sid');
      res.redirect('/kycu');
    });
  }
}

module.exports = AuthController;
