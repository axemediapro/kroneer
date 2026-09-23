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

// Gzip Compression për përgjigje ultra të shpejta
app.use(compression());

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
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true
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
