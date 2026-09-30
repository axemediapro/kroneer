/**
 * KRONEER Enterprise Security Middleware
 * Provides comprehensive HTTP security headers, rate limiting,
 * dotfile protection, path traversal protection, and request sanitization.
 */

// Simple in-memory Sliding Window Rate Limiter
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minutë default
    this.max = options.max || 100; // 100 kërkesa default
    this.message = options.message || 'Shumë kërkesa nga kjo adresë IP. Ju lutem provoni përsëri pas pak.';
    this.hits = new Map();

    // Pastrim periodik i rekordeve të vjetra çdo 5 minuta
    setInterval(() => {
      const now = Date.now();
      for (const [ip, data] of this.hits.entries()) {
        if (now - data.resetTime > this.windowMs) {
          this.hits.delete(ip);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      // Merr IP reale edhe prapa reverse proxy / Cloudflare / Nginx
      const ip = req.headers['cf-connecting-ip'] || 
                 req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                 req.socket.remoteAddress || 
                 '127.0.0.1';

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
          return res.status(429).json({
            success: false,
            error: this.message,
            retryAfter: Math.ceil((record.resetTime - now) / 1000)
          });
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

// 1. Rate Limiters të specializuara
const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 Minuta
  max: 15, // Max 15 tentativa kyçjeje
  message: 'Keni tejkaluar numrin e lejuar të tentativave të kyçjes. Ju lutem provoni përsëri pas 15 minutash.'
}).middleware();

const generalLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 Minutë
  max: 300, // 300 kërkesa / minutë
  message: 'Shumë kërkesa të njëpasnjëshme. Ju lutem ngadalësoni veprimet.'
}).middleware();

const publicReportLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 Orë
  max: 12, // Max 12 raportime defekti në orë për IP
  message: 'Keni dërguar shumë kërkesa raportimi. Nëse keni emergjencë, kontaktoni drejtpërdrejt në telefon.'
}).middleware();

// 2. HTTP Security Headers Middleware
function securityHeaders(req, res, next) {
  // Fsheh nënshkrimin e Express dhe Node
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Security Headers Standarde
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // HSTS për mbrojtje HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
}

// 3. Path Traversal & Malicious File Access Blocker
function blockMaliciousRequests(req, res, next) {
  const url = decodeURIComponent(req.originalUrl || req.url).toLowerCase();

  // Blloko dotfiles dhe skedarë të ndjeshëm
  const blockedPatterns = [
    /\/\.env/i,
    /\/\.git/i,
    /\/\.vscode/i,
    /\/\.continue/i,
    /\/schema\.prisma/i,
    /\/\.db/i,
    /\/\.sqlite/i,
    /\/package\.json/i,
    /\/package-lock\.json/i,
    /\/node_modules\//i,
    /\/src\//i,
    /\/config\//i,
    /\.log$/i,
    /\.sql$/i,
    /\.sh$/i,
    /\.bak$/i,
    /\.conf$/i,
    /\0/, // Null Byte
    /\.\.\//, // Path traversal Unix
    /\.\.\\/ // Path traversal Windows
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(url)) {
      console.warn(`[SECURITY WARNING] Bllokuar kërkesë e dyshimtë: ${req.method} ${req.originalUrl} nga IP: ${req.ip}`);
      return res.status(403).render('partials/error', {
        layout: 'layouts/public',
        pageTitle: 'Qasje e Ndaluar - 403',
        statusCode: 403,
        errorMessage: 'Kërkesa juaj u bllokua nga sistemi i sigurisë KRONEER.'
      });
    }
  }

  next();
}

// 4. Request Body / Query Sanitizer (Pastrimi i karaktereve të dëmshme)
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        // Hiq null-bytes dhe script tags të hapura
        req.body[key] = req.body[key]
          .replace(/\0/g, '')
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    }
  }
  next();
}

module.exports = {
  securityHeaders,
  blockMaliciousRequests,
  sanitizeInput,
  authLimiter,
  generalLimiter,
  publicReportLimiter
};
