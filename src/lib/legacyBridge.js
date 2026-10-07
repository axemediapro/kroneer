import { createRequire } from 'node:module';
import qs from 'qs';
import { render } from './render.js';
import { flash } from './session.js';

const require = createRequire(import.meta.url);
const { sanitizeInput } = require('../legacy/middleware/security.js');
const legacyRoutes = require('../legacy/routes/index.js');

const MAX_BODY = 2 * 1024 * 1024;
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf',
  json: 'application/json', html: 'text/html; charset=utf-8', txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8'
};

async function parseBody(c) {
  const type = c.req.header('content-type') || '';
  if (type.includes('multipart/form-data')) {
    const form = await c.req.parseBody({ all: true });
    const files = [];
    const fields = new URLSearchParams();
    for (const [name, value] of Object.entries(form)) {
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v instanceof File) files.push({ fieldname: name, originalname: v.name, mimetype: v.type, size: v.size, arrayBuffer: () => v.arrayBuffer() });
        else fields.append(name, v);
      }
    }
    return { body: qs.parse(fields.toString()), files };
  }
  if (Number(c.req.header('content-length') || 0) > MAX_BODY) {
    const err = new Error('Trupi i kërkesës është shumë i madh.');
    err.status = 413;
    throw err;
  }
  if (type.includes('application/json')) {
    return { body: await c.req.json().catch(() => ({})), files: [] };
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    return { body: qs.parse(await c.req.text(), { parameterLimit: 1000 }), files: [] };
  }
  return { body: {}, files: [] };
}

async function buildReq(c) {
  const st = c.get('session');
  const url = new URL(c.req.url);
  const headers = Object.fromEntries(c.req.raw.headers);
  const isRead = c.req.method === 'GET' || c.req.method === 'HEAD';
  const { body, files } = isRead ? { body: {}, files: [] } : await parseBody(c);

  const req = {
    method: c.req.method,
    path: url.pathname,
    originalUrl: url.pathname + url.search,
    params: c.req.param(),
    query: qs.parse(url.search.slice(1)),
    body,
    _files: files,
    headers,
    xhr: headers['x-requested-with'] === 'XMLHttpRequest',
    protocol: (headers['x-forwarded-proto'] || url.protocol.replace(':', '')).split(',')[0].trim(),
    get: (name) => headers[String(name).toLowerCase()],
    flash: (type, message) => {
      if (message !== undefined) flash(c, type, message);
      return [];
    },
    session: {
      get user() { return st.user; },
      set user(v) { st.user = v; st.dirty = true; },
      cookie: {},
      save: (cb) => cb && cb(),
      regenerate: (cb) => cb && cb(),
      destroy: (cb) => { st.user = null; st.dirty = true; if (cb) cb(); }
    }
  };
  sanitizeInput(req, null, () => {});
  return req;
}

function buildRes(c, resolve, reject) {
  let status = 200;
  const finish = (response) => { resolve(response); return res; };
  const res = {
    locals: {},
    status(code) { status = code; return res; },
    set(name, value) { c.header(name, String(value)); return res; },
    type(t) { c.header('Content-Type', MIME[t] || t); return res; },
    redirect(a, b) {
      const [code, location] = typeof a === 'number' ? [a, b] : [302, a];
      return finish(c.redirect(location, code));
    },
    json(data) { return finish(c.json(data, status)); },
    send(data) {
      if (typeof data === 'object' && !Buffer.isBuffer(data)) return res.json(data);
      if (typeof data === 'string' && !c.res.headers.has('Content-Type')) return finish(c.html(data, status));
      return finish(c.body(data, status));
    },
    sendStatus(code) { return finish(c.body(String(code), code)); },
    end() { return finish(c.body(null, status)); },
    clearCookie() { return res; },
    render(view, data = {}) {
      render(c, view, data, status).then(resolve, reject);
      return res;
    }
  };
  res.setHeader = res.header = res.set;
  return res;
}

function runChain(c, handlers) {
  return new Promise(async (resolve, reject) => {
    let req;
    try { req = await buildReq(c); } catch (e) { return reject(e); }
    const res = buildRes(c, resolve, reject);
    let i = 0;
    const next = (err) => {
      if (err) return reject(err);
      const handler = handlers[i++];
      if (!handler) return resolve(c.notFound());
      try {
        const out = handler(req, res, next);
        if (out && typeof out.catch === 'function') out.catch(reject);
      } catch (e) {
        reject(e);
      }
    };
    next();
  });
}

export function mountLegacyRoutes(app) {
  for (const { method, path, handlers } of legacyRoutes.routes) {
    const paths = path.endsWith('*') ? [path.slice(0, -1).replace(/\/$/, ''), path.slice(0, -1).replace(/\/?$/, '/*')] : [path];
    const handler = async (c) => {
      const st = c.get('session');
      const before = JSON.stringify(st.user);
      try {
        return await runChain(c, handlers);
      } finally {
        if (JSON.stringify(st.user) !== before) st.dirty = true;
      }
    };
    for (const p of paths) app.on(method === 'all' ? ['GET', 'POST', 'PUT', 'DELETE'] : method.toUpperCase(), p, handler);
  }
}
