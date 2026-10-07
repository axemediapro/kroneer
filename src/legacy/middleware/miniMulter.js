const fs = require('fs');
const path = require('path');

// Zëvendësim minimal i multer: përdor skedarët e parsuar nga ura Hono (req._files)
const call = (fn, ...args) => new Promise((resolve, reject) =>
  fn(...args, (err, val) => (err ? reject(err) : resolve(val))));

async function handle(opts, req, fieldName, max) {
  const { storage, fileFilter, limits = {} } = opts;
  const out = [];
  for (const raw of (req._files || []).filter((f) => f.fieldname === fieldName).slice(0, max)) {
    if (!raw.size) continue;
    if (limits.fileSize && raw.size > limits.fileSize) throw new Error('Skedari është shumë i madh.');
    const file = { fieldname: raw.fieldname, originalname: raw.originalname, mimetype: raw.mimetype, size: raw.size };
    if (fileFilter && !(await call(fileFilter, req, file))) continue;
    const buffer = Buffer.from(await raw.arrayBuffer());
    if (storage.memory) {
      file.buffer = buffer;
    } else {
      const dir = await call(storage.destination, req, file);
      file.filename = await call(storage.filename, req, file);
      file.destination = dir;
      file.path = path.join(dir, file.filename);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file.path, buffer);
    }
    out.push(file);
  }
  return out;
}

function multer(opts) {
  return {
    single: (name) => async (req, res, next) => {
      try { req.file = (await handle(opts, req, name, 1))[0]; } catch (e) { return next(e); }
      next();
    },
    array: (name, max = Infinity) => async (req, res, next) => {
      try { req.files = await handle(opts, req, name, max); } catch (e) { return next(e); }
      next();
    }
  };
}

multer.diskStorage = ({ destination, filename }) => ({ destination, filename });
multer.memoryStorage = () => ({ memory: true });

module.exports = multer;
