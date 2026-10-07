import { getConnInfo } from '@hono/node-server/conninfo';
import { renderError } from './render.js';

const clientIp = (c) =>
  c.req.header('cf-connecting-ip') ||
  c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
  getConnInfo(c).remote.address ||
  '127.0.0.1';

// ─── Rate limiter (dritare fikse për IP) ────────────────────────────────────
export function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, r] of hits) if (now > r.reset) hits.delete(ip);
  }, 5 * 60 * 1000).unref();

  return async (c, next) => {
    const ip = clientIp(c);
    const now = Date.now();
    let r = hits.get(ip);
    if (!r || now > r.reset) hits.set(ip, (r = { count: 0, reset: now + windowMs }));
    r.count++;
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - r.count)));
    if (r.count > max) {
      c.header('Retry-After', String(Math.ceil((r.reset - now) / 1000)));
      if (c.req.header('accept')?.includes('application/json')) {
        return c.json({ success: false, error: message }, 429);
      }
      return renderError(c, 429, 'Kërkesa të tepërta - 429', message, 'layouts/public');
    }
    await next();
  };
}

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Shumë kërkesa të njëpasnjëshme. Ngadalësoni veprimet.'
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Keni tejkaluar numrin e tentativave të kyçjes. Provoni përsëri pas 15 minutash.'
});

export const publicReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  message: 'Keni dërguar shumë raporte. Nëse keni emergjencë, kontaktoni drejtpërdrejt në telefon.'
});

// ─── Bllokim i llogarisë pas tentativave të dështuara ───────────────────────
const attempts = new Map();
const THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const key = (u) => u.toLowerCase().trim();

export const recordFailedLogin = (username) => {
  const k = key(username);
  const rec = attempts.get(k) || { count: 0, lockedUntil: 0 };
  if (++rec.count >= THRESHOLD) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
    rec.count = 0;
  }
  attempts.set(k, rec);
};
export const clearLoginAttempts = (username) => attempts.delete(key(username));
export const isLockedOut = (username) => Date.now() < (attempts.get(key(username))?.lockedUntil || 0);
export const remainingLockoutSeconds = (username) =>
  Math.max(0, Math.ceil(((attempts.get(key(username))?.lockedUntil || 0) - Date.now()) / 1000));

// ─── Header-at e sigurisë ───────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

export async function securityHeaders(c, next) {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()');
  c.header('Content-Security-Policy', CSP);
  if (new URL(c.req.url).protocol === 'https:' || c.req.header('x-forwarded-proto') === 'https') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

// ─── Mbrojtje CSRF: kërkesat që ndryshojnë të dhëna duhet të vijnë nga i njëjti origin ─
export async function csrfOriginCheck(c, next) {
  const method = c.req.method;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const origin = c.req.header('origin') || c.req.header('referer');
    if (origin) {
      const host = c.req.header('x-forwarded-host') || c.req.header('host');
      let ok = false;
      try { ok = new URL(origin).host === host; } catch { /* origin i pavlefshëm */ }
      if (!ok) return c.text('Kërkesa u refuzua (origin i pavlefshëm).', 403);
    }
  }
  await next();
}

// ─── Skedarë dhe shtigje të ndjeshme ────────────────────────────────────────
const BLOCKED = [
  /\/\.(env|git|vscode|continue)/i, /\/schema\.prisma/i, /\/package(-lock)?\.json/i,
  /\/node_modules\//i, /\/src\//i, /\/prisma\//i,
  /\.(log|sql|sh|bak|conf|db|sqlite)$/i, /\0/, /\.\.[\\/]/
];

export async function blockSensitivePaths(c, next) {
  let path = c.req.path;
  try { path = decodeURIComponent(path); } catch { /* mbetet si është */ }
  if (BLOCKED.some((re) => re.test(path))) {
    console.warn(`[SECURITY] Bllokuar: ${c.req.method} ${path}`);
    return renderError(c, 403, 'Qasje e Ndaluar - 403', 'Kërkesa u bllokua nga sistemi i sigurisë KRONEER.', 'layouts/public');
  }
  await next();
}
