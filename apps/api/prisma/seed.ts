/* Demo data. Safe to re-run: wipes transactional/catalogue data, keeps lookups. */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { runSeed } from '../src/seed/seed';
import { pgConfig } from '../src/common/db-url';

const prisma = new PrismaClient({
  adapter: new PrismaPg(pgConfig(), { schema: 'shop' }),
});
runSeed(prisma)
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
