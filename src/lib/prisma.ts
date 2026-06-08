import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

export const prisma = new PrismaClient({
  log: isProd ? ['error'] : ['query', 'warn', 'error'],
});

export default prisma;
