require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const compression = require('compression');
const path = require('path');

const routes = require('./src/routes');
const { globalLocals } = require('./src/middleware/auth');
const { notFoundHandler, errorHandler } = require('./src/middleware/error');
const {
  securityHeaders,
  blockMaliciousRequests,
  sanitizeInput,
  generalLimiter,
  authLimiter
} = require('./src/middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// 1. Siguria e Nivelit të Serverit (Disable Server Fingerprints)
app.disable('x-powered-by');
app.set('trust proxy', 1); // Trust first proxy (Cloudflare, Nginx, Apache)

// 2. Security Headers & Malicious Request Filtering
app.use(securityHeaders);
app.use(blockMaliciousRequests);
app.use(generalLimiter);

// 3. Gzip / Deflate Compression për ngarkim ultra të shpejtë të aseteve dhe HTML
app.use(compression({
  threshold: 512, // Kompreso të gjitha përgjigjet > 512B
  level: 6
}));

// 4. Konfigurimi i EJS & Layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// 5. Body Parsers & Input Sanitization
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(sanitizeInput);
app.use(cookieParser(process.env.SESSION_SECRET || 'kroneer_cookie_secret_2026'));
app.use(methodOverride('_method'));

// 6. Shërbimi i skedarëve statikë me cache afatgjatë dhe ETags
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  immutable: true,
  etag: true,
  lastModified: true,
  dotfiles: 'ignore', // Refuzo dotfiles (.env, .git)
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.ejs')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
}));

// 7. Sesionet e Sigurta (Secure Cookies & Anti-Fixation)
app.use(
  session({
    name: '__kroneer_sid', // Emër i personalizuar për të fshehur 'connect.sid'
    secret: process.env.SESSION_SECRET || 'kroneer_enterprise_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd, // Aktivizo secure cookie në production me HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 orë
    }
  })
);

app.use(flash());

// 8. Variablat globale në pamje (res.locals)
app.use(globalLocals);

// 9. Rate limiting për rrugët e autentifikimit
app.use('/kycu', authLimiter);

// 10. Konfigurimi i Header-ave CDN / NO-CACHE për të gjitha rrugët dinamike
// Arkitektura: STATIC -> CACHE | DYNAMIC/API/AUTH -> NO-CACHE
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// 11. Rrugët e aplikacionit
app.use('/', routes);

// 12. Menaxhimi i gabimeve
app.use(notFoundHandler);
app.use(errorHandler);

// 12. Nisja e serverit
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  KRONEER — SISTEM I SIGURUAR PËR MENAXHIMIN E LIFTEVE`);
  console.log(`  Platforma aktive në: http://localhost:${PORT}`);
  console.log(`  Kyçja Demo: admin / admin123`);
  console.log(`====================================================`);
});
