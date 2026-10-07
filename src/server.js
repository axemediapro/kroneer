import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { Hono } from 'hono';
import { config } from './config.js';
import { session } from './lib/session.js';
import { renderError } from './lib/render.js';
import { generalLimiter, securityHeaders, blockSensitivePaths, csrfOriginCheck } from './lib/security.js';
import { auth } from './modules/auth/routes.js';
import { dashboard } from './modules/dashboard/routes.js';

const app = new Hono();

app.use(blockSensitivePaths);
app.use(securityHeaders);
app.use(generalLimiter);
app.use(compress());

// Asete statike: cache afatgjatë, pa sesion, pa bazë të dhënash
const staticCache = async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=2592000, immutable');
};
for (const dir of ['css', 'js', 'vendor', 'images']) {
  app.use(`/${dir}/*`, staticCache, serveStatic({ root: './public' }));
}
app.use('/uploads/*', serveStatic({ root: './public' }));
app.get('/favicon.ico', (c) => c.body(null, 204));

// Faqet dinamike: sesion + mbrojtje CSRF, asnjëherë të cache-uara
app.use(async (c, next) => {
  await next();
  c.header('Cache-Control', 'private, no-store');
});
app.use(session);
app.use(csrfOriginCheck);

app.get('/', (c) => c.redirect(c.get('session').user ? '/paneli' : '/kycu'));
app.route('/', auth);
app.route('/', dashboard);

app.notFound((c) =>
  renderError(c, 404, 'Faqja nuk u gjet - 404', 'Faqja që kërkuat nuk ekziston ose mund të jetë zhvendosur.',
    c.get('session')?.user ? 'layouts/main' : 'layouts/public'));

app.onError((err, c) => {
  console.error('Gabim në server:', err);
  return renderError(c, 500, 'Gabim i brendshëm i sistemit - 500',
    'Ndodhi një problem i papritur gjatë procesimit të kërkesës.', 'layouts/main');
});

serve({ fetch: app.fetch, port: config.port }, ({ port }) => {
  console.log(`KRONEER v2 po dëgjon në http://localhost:${port}`);
});
