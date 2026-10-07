import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { prisma } from '../../db.js';
import { render } from '../../lib/render.js';
import { flash, login, logout } from '../../lib/session.js';
import { logActivity } from '../../services/activity.js';
import { authLimiter, recordFailedLogin, clearLoginAttempts, isLockedOut, remainingLockoutSeconds } from '../../lib/security.js';

export const auth = new Hono();

auth.use('/kycu', authLimiter);

auth.get('/kycu', (c) => {
  if (c.get('session').user) return c.redirect('/paneli');
  return render(c, 'auth/login', { pageTitle: 'Hyrja në Sistem - KRONEER', layout: false });
});

auth.post('/kycu', async (c) => {
  try {
    const { username, password, remember } = await c.req.parseBody();
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      flash(c, 'error', 'Ju lutem plotësoni të gjitha fushat e kërkuara.');
      return c.redirect('/kycu');
    }
    const name = username.trim();

    if (isLockedOut(name)) {
      const mins = Math.ceil(remainingLockoutSeconds(name) / 60);
      flash(c, 'error', `Llogaria është bllokuar pas shumë tentativave të dështuara. Provoni përsëri pas ${mins} minutash.`);
      return c.redirect('/kycu');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: name, mode: 'insensitive' } },
          { email: { equals: name, mode: 'insensitive' } }
        ],
        isActive: true
      }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      recordFailedLogin(name);
      flash(c, 'error', 'Përdoruesi ose fjalëkalimi është i pasaktë.');
      return c.redirect('/kycu');
    }

    clearLoginAttempts(name);
    login(c, {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar
    }, !!remember);

    logActivity({
      userId: user.id,
      userName: user.fullName,
      actionType: 'Kyçje',
      entityType: 'Përdorues',
      entityId: user.id,
      description: `Përdoruesi ${user.fullName} u kyç në sistem me sukses.`
    });

    flash(c, 'success', `Mirë se erdhe përsëri, ${user.fullName}!`);
    return c.redirect('/paneli');
  } catch (err) {
    console.error('Gabim gjatë kyçjes:', err);
    flash(c, 'error', 'Ndodhi një problem gjatë kyçjes.');
    return c.redirect('/kycu');
  }
});

auth.get('/kycu/aktivizo', (c) => {
  const { email, code } = c.req.query();
  return render(c, 'auth/aktivizo', { pageTitle: 'Aktivizimi i Llogarisë - KRONEER', layout: false, email, code });
});

auth.post('/kycu/aktivizo', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email || '');
  const code = String(body.code || '');
  const password = String(body.password || '');
  const back = (withCode = true) =>
    c.redirect(`/kycu/aktivizo?email=${encodeURIComponent(email)}${withCode ? `&code=${encodeURIComponent(code)}` : ''}`);

  try {
    if (!email || !code || !password) {
      flash(c, 'error', 'Të gjitha fushat janë të detyrueshme.');
      return back();
    }
    if (password.length < 6) {
      flash(c, 'error', 'Fjalëkalimi duhet të ketë së paku 6 karaktere.');
      return back();
    }

    const user = await prisma.user.findFirst({ where: { email: email.trim(), verificationCode: code.trim() } });
    if (!user) {
      flash(c, 'error', 'Kodi i verifikimit është i pasaktë ose emaili nuk përputhet.');
      return back(false);
    }
    if (user.isVerified) {
      flash(c, 'error', 'Kjo llogari është aktivizuar tashmë. Ju lutem kyçuni.');
      return c.redirect('/kycu');
    }
    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      flash(c, 'error', 'Kodi i verifikimit ka skaduar. Ju lutem kontaktoni administratën.');
      return back(false);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        isVerified: true,
        isActive: true,
        verificationCode: null,
        verificationExpiry: null
      }
    });
    flash(c, 'success', 'Llogaria juaj u aktivizua me sukses! Tani mund të kyçeni.');
    return c.redirect('/kycu');
  } catch (err) {
    console.error('Gabim në aktivizim:', err);
    flash(c, 'error', 'Ndodhi një gabim gjatë aktivizimit.');
    return c.redirect('/kycu/aktivizo');
  }
});

auth.get('/dil', async (c) => {
  const user = c.get('session').user;
  if (user) {
    await logActivity({
      userId: user.id,
      userName: user.fullName,
      actionType: 'Çkyçje',
      entityType: 'Përdorues',
      entityId: user.id,
      description: `Përdoruesi ${user.fullName} u çkyç nga sistemi.`
    });
  }
  logout(c);
  return c.redirect('/kycu');
});
