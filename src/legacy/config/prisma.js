const { PrismaClient } = require('@prisma/client');

globalThis.__prisma ||= new PrismaClient();

module.exports = globalThis.__prisma;
