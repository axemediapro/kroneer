import 'dotenv/config';

const required = ['DATABASE_URL', 'SESSION_SECRET'];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Mungon variabla e mjedisit: ${k}`);
}
if (process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET duhet të ketë së paku 32 karaktere.');
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === 'production',
  sessionSecret: process.env.SESSION_SECRET,
  cookieName: '__kroneer_sid'
};