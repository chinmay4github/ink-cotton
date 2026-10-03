/**
 * Postgres connection settings from DATABASE_URL.
 * Hosted Postgres (Supabase, Railway, Neon...) needs TLS: enabled when the URL asks for it
 * (sslmode=require), when it points at Supabase, or when DATABASE_SSL=true.
 */
export function pgConfig(raw = process.env.DATABASE_URL ?? '') {
  const wantsSsl = /sslmode=(require|verify)/.test(raw) || /supabase\.(co|com)/.test(raw) || process.env.DATABASE_SSL === 'true';
  return {
    connectionString: raw.replace(/\?.*$/, ''),
    ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}
