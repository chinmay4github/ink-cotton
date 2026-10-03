/**
 * Runs before the API starts (see package.json "start"):
 *   1. creates the schema from database/schema.sql on an empty database,
 *   2. applies database/migrations/*.sql in order (each file is idempotent),
 *   3. seeds the demo catalogue when the database has no users and AUTO_SEED=true.
 * A Postgres advisory lock makes it safe when several API replicas boot at once.
 */
import 'dotenv/config';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { runSeed } from '../seed/seed';
import { pgConfig } from '../common/db-url';

const LOCK = 7_340_211;

function sqlDir() {
  const candidates = [process.env.SQL_DIR, resolve(__dirname, '../../../../database'), resolve(process.cwd(), '../../database'), resolve(process.cwd(), 'database')];
  const dir = candidates.find((d) => d && existsSync(join(d, 'schema.sql')));
  if (!dir) throw new Error(`database/schema.sql not found (looked in ${candidates.filter(Boolean).join(', ')})`);
  return dir;
}

async function main() {
  const db = new Client(pgConfig(process.env.DATABASE_URL));
  await db.connect();
  await db.query('SELECT pg_advisory_lock($1)', [LOCK]);
  try {
    const dir = sqlDir();
    const { rows } = await db.query(`SELECT to_regclass('shop.users') AS t`);
    if (!rows[0].t) {
      console.log('[migrate] empty database - creating schema');
      await db.query(readFileSync(join(dir, 'schema.sql'), 'utf8'));
    }
    const mdir = join(dir, 'migrations');
    for (const f of existsSync(mdir) ? readdirSync(mdir).filter((x) => x.endsWith('.sql')).sort() : []) {
      await db.query(readFileSync(join(mdir, f), 'utf8'));
      console.log(`[migrate] applied ${f}`);
    }
    const users = await db.query('SELECT count(*)::int AS n FROM shop.users');
    if (users.rows[0].n === 0 && process.env.AUTO_SEED === 'true') {
      console.log('[migrate] no users - seeding demo data');
      const prisma = new PrismaClient({ adapter: new PrismaPg(pgConfig(process.env.DATABASE_URL), { schema: 'shop' }) });
      try {
        await runSeed(prisma);
      } finally {
        await prisma.$disconnect();
      }
    }
  } finally {
    await db.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => undefined);
    await db.end();
  }
}

main().catch((e) => {
  console.error('[migrate] failed', e);
  process.exit(1);
});
