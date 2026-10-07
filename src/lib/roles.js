import { flash } from './session.js';

export const canAssignBonus = (u) => !!u && (u.role === 'ADMINISTRATOR' || u.role === 'MENAXHER_PROJEKTI');
export const isFieldStaff = (u) => !!u && (u.role === 'TEKNIK' || u.role === 'MENAXHER_PROJEKTI');

export async function requireAuth(c, next) {
  if (!c.get('session').user) {
    flash(c, 'error', 'Ju lutem kyçuni për të hyrë në sistem.');
    return c.redirect('/kycu');
  }
  await next();
}

export const authorize = (...allowed) => async (c, next) => {
  const user = c.get('session').user;
  if (!user) {
    flash(c, 'error', 'Ju lutem kyçuni për të vazhduar.');
    return c.redirect('/kycu');
  }
  if (user.role === 'ADMINISTRATOR' || allowed.includes(user.role)) return next();
  flash(c, 'error', 'Nuk keni autorizim për të hyrë në këtë seksion të sistemit.');
  return c.redirect('/paneli');
};

export async function denyFieldFromCrm(c, next) {
  if (isFieldStaff(c.get('session').user)) {
    flash(c, 'error', 'Nuk keni qasje te klientët, faturat dhe shitjet. Ky seksion është për zyrën.');
    return c.redirect('/paneli');
  }
  await next();
}