import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { config } from '../config.js';

const DAY = 24 * 60 * 60 * 1000;

const sign = (body) => createHmac('sha256', config.sessionSecret).update(body).digest('base64url');

function decode(raw) {
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.e > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/**
 * Sesion i pa-gjendje (stateless) në cookie të nënshkruar: nuk kërkon asnjë
 * kërkesë në bazën e të dhënave për çdo faqe. Mbart edhe mesazhet flash.
 */
export async function session(c, next) {
  const data = decode(getCookie(c, config.cookieName)) || {};
  const state = {
    user: data.u || null,
    maxAge: data.m || DAY,
    incoming: data.f || {},
    outgoing: {},
    dirty: false
  };
  c.set('session', state);

  await next();

  const hasFlash = Object.keys(state.outgoing).length > 0;
  const hadFlash = Object.keys(state.incoming).length > 0;
  if (!state.dirty && !hasFlash && !hadFlash) return;
  if (!state.user && !hasFlash) return deleteCookie(c, config.cookieName, { path: '/' });
  const payload = { u: state.user, m: state.maxAge, e: data.e && !state.dirty ? data.e : Date.now() + state.maxAge, f: state.outgoing };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  setCookie(c, config.cookieName, `${body}.${sign(body)}`, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'Lax',
    path: '/',
    maxAge: Math.floor(state.maxAge / 1000)
  });
}

export const flash = (c, type, message) => {
  const s = c.get('session');
  (s.outgoing[type] ||= []).push(message);
};

export const login = (c, user, remember) => {
  const s = c.get('session');
  s.user = user;
  s.maxAge = remember ? 7 * DAY : DAY;
  s.dirty = true;
};

export const logout = (c) => {
  const s = c.get('session');
  s.user = null;
  s.dirty = true;
};