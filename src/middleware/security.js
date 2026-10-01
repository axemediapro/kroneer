/**
 * KRONEER Enterprise Security Middleware — v2 Hardened
 */

// ─── In-Memory Rate Limiter (Sliding Window) ───────────────────────────────
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000;
    this.max = options.max || 100;
    this.message = options.message || 'Shumë kërkesa. Provoni përsëri pas pak.';
    this.hits = new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.hits.entries()) {
        if (now - data.resetTime > this.windowMs) this.hits.delete(ip);
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      const ip = req.headers['cf-connecting-ip'] ||
                 req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                 req.socket.remoteAddress || '127.0.0.1';
      const now = Date.now();
      let record = this.hits.get(ip);
      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + this.windowMs };
        this.hits.set(ip, record);
      } else {
        record.count++;
      }
      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, this.max - record.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      if (record.count > this.max) {
        res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(429).json({ success: false, error: this.message });
        }
        return res.status(429).render('partials/error', {
          layout: 'layouts/public',
          pageTitle: 'Kërkesa të tepërta - 429',
          statusCode: 429,
          errorMessage: this.message
        });
      }
      next();
    };
  }
}

// ─── Per-Username Login Attempt Tracker (Account Lockout) ──────────────────
const loginAttempts = new Map();
const LOCKOUT_THRESHOLD = 5;          // tentativa dështuara
const LOCKOUT_DURATION  = 15 * 60 * 1000; // 15 minuta

setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of loginAttempts.entries()) {
    if (now > rec.lockedUntil + LOCKOUT_DURATION) loginAttempts.delete(key);
  }
}, 10 * 60 * 1000).unref();

function recordFailedLogin(username) {
  const key = username.toLowerCase().trim();
  const now = Date.now();
  let rec = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= LOCKOUT_THRESHOLD) {
    rec.lockedUntil = now + LOCKOUT_DURATION;
    rec.count = 0; // reset counter after lockout
  }
  loginAttempts.set(key, rec);
}

function clearLoginAttempts(username) {
  loginAttempts.delete(username.toLowerCase().trim());
}

function isLockedOut(username) {
  const rec = loginAttempts.get(username.toLowerCase().trim());
  if (!rec) return false;
  return Date.now() < rec.lockedUntil;
}

function remainingLockoutSeconds(username) {
  const rec = loginAttempts.get(username.toLowerCase().trim());
  if (!rec) return 0;
  return Math.max(0, Math.ceil((rec.lockedUntil - Date.now()) / 1000));
}

// ─── Rate Limiters ─────────────────────────────────────────────────────────
const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Keni tejkaluar numrin e tentativave të kyçjes. Provoni përsëri pas 15 minutash.'
}).middleware();

const generalLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: 'Shumë kërkesa të njëpasnjëshme. Ngadalësoni veprimet.'
}).middleware();

const publicReportLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 12,
  message: 'Keni dërguar shumë raporte. Nëse keni emergjencë, kontaktoni drejtpërdrejt në telefon.'
}).middleware();

// ─── HTTP Security Headers ─────────────────────────────────────────────────
function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');

  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  res.setHeader('Content-Security-Policy', csp);

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

// ─── Path Traversal & Sensitive File Blocker ──────────────────────────────
function blockMaliciousRequests(req, res, next) {
  const url = decodeURIComponent(req.originalUrl || req.url).toLowerCase();
  const blockedPatterns = [
    /\/\.env/i, /\/\.git/i, /\/\.vscode/i, /\/\.continue/i,
    /\/schema\.prisma/i, /\/\.db/i, /\/\.sqlite/i,
    /\/package\.json/i, /\/package-lock\.json/i,
    /\/node_modules\//i, /\/src\//i, /\/config\//i,
    /\.log$/i, /\.sql$/i, /\.sh$/i, /\.bak$/i, /\.conf$/i,
    /\0/, /\.\.\//, /\.\.\\/,
    // Extra: common attack probes
    /\bselect\b.*\bfrom\b/i,
    /\bunion\b.*\bselect\b/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(url)) {
      console.warn(`[SECURITY] Bllokuar: ${req.method} ${req.originalUrl} nga ${req.ip}`);
      return res.status(403).render('partials/error', {
        layout: 'layouts/public',
        pageTitle: 'Qasje e Ndaluar - 403',
        statusCode: 403,
        errorMessage: 'Kërkesa u bllokua nga sistemi i sigurisë KRONEER.'
      });
    }
  }
  next();
}

// ─── Deep Input Sanitizer ─────────────────────────────────────────────────
function sanitizeValue(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/\0/g, '')                                         // null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script tags
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')               // inline event handlers
    .replace(/javascript\s*:/gi, '')                            // javascript: URIs
    .replace(/vbscript\s*:/gi, '')                              // vbscript: URIs
    .replace(/data\s*:\s*text\/html/gi, '')                     // data:text/html URIs
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeValue(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

function sanitizeInput(req, res, next) {
  sanitizeObject(req.body);
  sanitizeObject(req.query);
  next();
}

module.exports = {
  securityHeaders,
  blockMaliciousRequests,
  sanitizeInput,
  authLimiter,
  generalLimiter,
  publicReportLimiter,
  recordFailedLogin,
  clearLoginAttempts,
  isLockedOut,
  remainingLockoutSeconds
};
