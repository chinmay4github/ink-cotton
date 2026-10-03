/* eslint-disable */
/**
 * Generates prisma/schema.prisma from the live `shop` schema in Postgres.
 *
 * database/schema.sql is the source of truth; Prisma is only used as a typed
 * client over it. Normally you would run `npx prisma db pull`; this script is a
 * dependency-free equivalent (only needs `pg`) for environments where Prisma's
 * schema-engine binary cannot be downloaded.
 *
 *   node prisma/pg-to-prisma.js && npx prisma generate
 */
require('dotenv/config');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'shop';

(async () => {
  const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
  const db = new Client({ connectionString: url });
  await db.connect();
  const q = async (sql, p = [SCHEMA]) => (await db.query(sql, p)).rows;

  const enums = await q(`
    SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = $1 GROUP BY t.typname ORDER BY t.typname`);
  const enumNames = new Set(enums.map((e) => e.name));

  const tables = (await q(`SELECT table_name FROM information_schema.tables
      WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name`)).map((r) => r.table_name);

  const cols = await q(`
    SELECT c.relname AS table, a.attname AS col, a.attnum AS pos, a.attnotnull AS notnull,
           format_type(a.atttypid, a.atttypmod) AS fmt, t.typname AS typ, et.typname AS elemtyp,
           pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS ident, a.attgenerated AS gen
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      LEFT JOIN pg_type et ON et.oid = t.typelem AND t.typcategory = 'A'
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE n.nspname = $1 AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`);

  const cons = await q(`
    SELECT c.conname, c.contype, cl.relname AS table, rf.relname AS ref_table, c.confdeltype,
           ARRAY(SELECT attname FROM unnest(c.conkey) WITH ORDINALITY k(n, o)
                   JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY o)::text[] AS cols,
           ARRAY(SELECT attname FROM unnest(c.confkey) WITH ORDINALITY k(n, o)
                   JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY o)::text[] AS ref_cols
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      LEFT JOIN pg_class rf ON rf.oid = c.confrelid
     WHERE n.nspname = $1 AND c.contype IN ('p','u','f')
     ORDER BY cl.relname, c.conname`);
  await db.end();

  const byTable = (arr) => arr.reduce((m, r) => ((m[r.table] ||= []).push(r), m), {});
  const colsBy = byTable(cols);
  const consBy = byTable(cons);
  const fks = cons.filter((c) => c.contype === 'f');

  const pk = (t) => (consBy[t] || []).find((c) => c.contype === 'p');
  const uniques = (t) => (consBy[t] || []).filter((c) => c.contype === 'u');
  const isUniqueCol = (t, col) =>
    (pk(t) && pk(t).cols.length === 1 && pk(t).cols[0] === col) ||
    uniques(t).some((u) => u.cols.length === 1 && u.cols[0] === col);

  const mapType = (c) => {
    const f = c.fmt;
    if (c.elemtyp) {
      const inner = mapType({ ...c, fmt: f.replace('[]', ''), typ: c.elemtyp, elemtyp: null });
      return { type: inner.type, attr: inner.attr, list: true };
    }
    if (enumNames.has(c.typ)) return { type: c.typ };
    let m;
    switch (c.typ) {
      case 'int8': return { type: 'BigInt' };
      case 'int4': return { type: 'Int' };
      case 'int2': return { type: 'Int', attr: '@db.SmallInt' };
      case 'bool': return { type: 'Boolean' };
      case 'text': return { type: 'String' };
      case 'citext': return { type: 'String', attr: '@db.Citext' };
      case 'jsonb': return { type: 'Json' };
      case 'inet': return { type: 'String', attr: '@db.Inet' };
      case 'date': return { type: 'DateTime', attr: '@db.Date' };
      case 'timestamptz': return { type: 'DateTime', attr: '@db.Timestamptz(6)' };
      case 'varchar': m = f.match(/\((\d+)\)/); return { type: 'String', attr: m ? `@db.VarChar(${m[1]})` : '@db.VarChar' };
      case 'bpchar': m = f.match(/\((\d+)\)/); return { type: 'String', attr: `@db.Char(${m ? m[1] : 1})` };
      case 'numeric': m = f.match(/\((\d+),(\d+)\)/); return { type: 'Decimal', attr: m ? `@db.Decimal(${m[1]}, ${m[2]})` : undefined };
      default: return { type: `Unsupported("${c.typ}")`, unsupported: true };
    }
  };

  const mapDefault = (c, t) => {
    if (c.ident) return '@default(autoincrement())';
    if (c.gen || !c.def) return '';
    const d = c.def;
    if (d === 'now()' || d === 'CURRENT_TIMESTAMP') return '@default(now())';
    if (d === 'true' || d === 'false') return `@default(${d})`;
    if (/^-?\d+(\.\d+)?$/.test(d)) return `@default(${d})`;
    if (/^'\{\}'::(text|character varying)\[\]$/.test(d)) return '@default([])';
    let m = d.match(/^'(.*)'::(jsonb|json)$/);
    if (m) return `@default(${JSON.stringify(m[1])})`;
    m = d.match(/^'(.*)'::([\w .]+)$/);
    if (m) return enumNames.has(c.typ) ? `@default(${m[1]})` : `@default(${JSON.stringify(m[1])})`;
    m = d.match(/^\((-?\d+(\.\d+)?)\)$/);
    if (m) return `@default(${m[1]})`;
    return `@default(dbgenerated(${JSON.stringify(d)}))`;
  };

  const singular = (s) => s.replace(/ies$/, 'y').replace(/ses$/, 's').replace(/s$/, '');
  const onDelete = { c: 'Cascade', n: 'SetNull', r: 'Restrict', a: null, d: 'SetDefault' };

  // relation field names
  const relName = (fk) => `${fk.table}_${fk.cols.join('_')}`;
  const childField = (fk) => {
    const col = fk.cols[0];
    return col.endsWith('_id') ? col.slice(0, -3) : `${col}_ref`;
  };
  const parentField = (fk) => {
    const sameChild = fks.filter((f) => f.table === fk.table && f.ref_table === fk.ref_table);
    const one = fk.cols.length === 1 && isUniqueCol(fk.table, fk.cols[0]);
    let base = one ? singular(fk.table) : fk.table;
    if (sameChild.length > 1 && !(one && fk.cols[0] === 'user_id')) base = `${fk.table}_by_${fk.cols.join('_')}`;
    if (fk.table === fk.ref_table) base = one ? 'child' : 'children';
    return base;
  };

  let out = `// AUTO-GENERATED from database/schema.sql by prisma/pg-to-prisma.js
// (equivalent to \`prisma db pull\`). Do not edit by hand - change the SQL, then regenerate.

generator client {
  provider     = "prisma-client"
  output       = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  schemas  = ["${SCHEMA}"]
}
`;

  for (const t of tables) {
    const lines = [];
    const p = pk(t);
    for (const c of colsBy[t]) {
      const ty = mapType(c);
      let type = ty.type + (ty.list ? '[]' : !c.notnull && !ty.list ? '?' : '');
      if (ty.unsupported && !c.notnull) type = ty.type + '?';
      const attrs = [];
      if (p && p.cols.length === 1 && p.cols[0] === c.col) attrs.push('@id');
      else if (isUniqueCol(t, c.col)) attrs.push('@unique');
      const def = mapDefault(c, t);
      if (def && !ty.unsupported) attrs.push(def);
      if (ty.attr) attrs.push(ty.attr);
      lines.push([c.col, type, attrs.join(' ')]);
    }
    for (const fk of fks.filter((f) => f.table === t)) {
      const optional = fk.cols.some((col) => !colsBy[t].find((c) => c.col === col).notnull);
      const od = onDelete[fk.confdeltype];
      lines.push([
        childField(fk),
        fk.ref_table + (optional ? '?' : ''),
        `@relation("${relName(fk)}", fields: [${fk.cols.join(', ')}], references: [${fk.ref_cols.join(', ')}]${od ? `, onDelete: ${od}` : ''})`,
      ]);
    }
    for (const fk of fks.filter((f) => f.ref_table === t)) {
      const one = fk.cols.length === 1 && isUniqueCol(fk.table, fk.cols[0]);
      lines.push([parentField(fk), fk.table + (one ? '?' : '[]'), `@relation("${relName(fk)}")`]);
    }
    const w1 = Math.max(...lines.map((l) => l[0].length));
    const w2 = Math.max(...lines.map((l) => l[1].length));
    out += `\nmodel ${t} {\n`;
    out += lines.map(([a, b, c]) => `  ${a.padEnd(w1)} ${b.padEnd(w2)} ${c}`.trimEnd()).join('\n') + '\n';
    if (p && p.cols.length > 1) out += `\n  @@id([${p.cols.join(', ')}])\n`;
    for (const u of uniques(t).filter((u) => u.cols.length > 1)) out += `  @@unique([${u.cols.join(', ')}], map: "${u.conname}")\n`;
    out += `  @@schema("${SCHEMA}")\n}\n`;
  }

  for (const e of enums) {
    out += `\nenum ${e.name} {\n${e.labels.map((l) => `  ${l}`).join('\n')}\n\n  @@schema("${SCHEMA}")\n}\n`;
  }

  fs.writeFileSync(path.join(__dirname, 'schema.prisma'), out);
  console.log(`schema.prisma written: ${tables.length} models, ${enums.length} enums`);
})().catch((e) => { console.error(e); process.exit(1); });
