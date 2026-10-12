const prisma = require('../config/prisma');

const TEST_SECRET = '1x0000000000000000000000000000000AA';
const TEST_SITEKEY = '1x00000000000000000000AA';

async function getKeys() {
  let s = null;
  try {
    s = await prisma.companySettings.findFirst({ select: { turnstileSiteKey: true, turnstileSecretKey: true } });
  } catch (e) { /* DB unavailable: use env/test keys */ }
  return {
    siteKey: (s && s.turnstileSiteKey) || process.env.TURNSTILE_SITE_KEY || TEST_SITEKEY,
    secret: (s && s.turnstileSecretKey) || process.env.TURNSTILE_SECRET_KEY || TEST_SECRET
  };
}

async function getSiteKey() {
  return (await getKeys()).siteKey;
}

function verifyTurnstile(redirectTo) {
  return async (req, res, next) => {
    const token = req.body && req.body['cf-turnstile-response'];
    const fail = () => {
      req.flash('error', 'Verifikimi i sigurisë dështoi. Provoni përsëri.');
      return res.redirect(typeof redirectTo === 'function' ? redirectTo(req) : redirectTo);
    };
    if (!token) return fail();
    try {
      const { secret } = await getKeys();
      const body = new URLSearchParams({ secret, response: token, remoteip: req.ip || '' });
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
      const data = await r.json();
      if (!data.success) return fail();
      next();
    } catch (e) {
      return fail();
    }
  };
}

module.exports = { verifyTurnstile, getSiteKey };