import { PrismaClient } from '@prisma/client';

// Klient i përbashkët me kodin legacy (src/legacy)
globalThis.__prisma ||= new PrismaClient();
export const prisma = globalThis.__prisma;
