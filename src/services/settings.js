import { prisma } from '../db.js';

const TTL = 3 * 60 * 1000;
let cache = null;
let cachedAt = 0;

const DEFAULTS = {
  companyName: 'KRONEER',
  tagline: 'Professional Elevator Solutions',
  logoUrl: null,
  logoSvg: null,
  logoDarkBgUrl: '/images/kroneer-logo-white.svg',
  logoDarkBgSvg: null,
  stampUrl: null,
  stampHeight: 80,
  phone: '+383 (0) 38 500 600',
  email: 'info@kroneer-lifts.com',
  address: 'Bulevardi Dëshmorët e Kombit, Nr. 45, Prishtinë',
  currency: 'EUR',
  vatRate: 18
};

export async function getCompanySettings() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  try {
    cache = (await prisma.companySettings.findFirst()) || DEFAULTS;
    cachedAt = Date.now();
  } catch {
    cache ||= DEFAULTS;
  }
  return cache;
}

export const invalidateCompanySettings = () => {
  cache = null;
};

globalThis.__invalidateCompanySettings = invalidateCompanySettings;
