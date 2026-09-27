require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const routes = require('./src/routes');
const { globalLocals } = require('./src/middleware/auth');
const { notFoundHandler, errorHandler } = require('./src/middleware/error');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip / Deflate Compression për ngarkim ultra të shpejtë të aseteve dhe HTML
app.use(compression({
  threshold: 512, // Kompreso të gjitha përgjigjet > 512B
  level: 6
}));

// Konfigurimi i EJS & Layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Middleware
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Shërbimi i skedarëve statikë me cache afatgjatë dhe ETags
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '30d',
  immutable: true,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.ejs')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  }
}));

// Sesionet
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'kroneer_default_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 orë
    }
  })
);

app.use(flash());

// Variablat globale në pamje (res.locals)
app.use(globalLocals);

// Rrugët e aplikacionit
app.use('/', routes);

// Menaxhimi i gabimeve
app.use(notFoundHandler);
app.use(errorHandler);

// Nisja e serverit
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  KRONEER — SISTEM PËR MENAXHIMIN E LIFTEVE`);
  console.log(`  Platforma aktive në: http://localhost:${PORT}`);
  console.log(`  Kyçja Demo: admin / admin123`);
  console.log(`====================================================`);
});
