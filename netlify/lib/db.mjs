/* The database connection, transactions and migrations.
   DATABASE_URL only: LHQ's Supabase database (free, no hourly charge), or a local Postgres for the tests.
   Never Netlify Database: its hourly compute used up LHQ's credits twice. */
import { MIGRATIONS } from "./schema.mjs";
import crypto from "node:crypto";
import pg from "pg";

let pool = null, ready = null;
export function _setPool(p) { plainDates(pg.types); pool = p; ready = null; pool_isTest = true; }

/* dates and times come back as the text Postgres stores ('2026-10-30', '16:00:00'), never as JavaScript dates
   that shift with the server's time zone */
function plainDates(types) { [1082, 1083, 1266].forEach(oid => types.setTypeParser(oid, v => v)); types.setTypeParser(1700, v => v == null ? v : Number(v)); types.setTypeParser(20, v => v == null ? v : Number(v)); }
async function supabaseCa() {
  try { return (await import("./supabase-ca.mjs")).default || process.env.LHQ_DB_CA || ""; } catch { return process.env.LHQ_DB_CA || ""; }
}
async function getPool() {
  if (pool) return pool;
  plainDates(pg.types);
  /* Supabase only (agreed 24 Nov). Netlify Database bills every hour it's awake and twice used up LHQ's credits, so the Hub never
     connects to it, even when Netlify provides one: without DATABASE_URL it stops and says so. */
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL isn't set: the Hub only uses the Supabase database.");
  if (/\.supabase\.(com|co)\b/.test(url)) {
    /* Supabase: its certificates are signed by Supabase's own authority, so the Hub checks them against that
       (supabase-ca.mjs, a public certificate, in this folder). The sslmode in the address is taken out: it would override this. */
    const ca = await supabaseCa(), cs = url.replace(/([?&])sslmode=[^&]*(&|$)/, (m, a, b) => b ? a : "").replace(/[?&]$/, "");
    pool = new pg.Pool({ connectionString: cs, max: 3, ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true } });
  } else pool = new pg.Pool({ connectionString: url, max: 3, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: true } : undefined });
  return pool;
}

/* run the migrations that haven't run yet: once per cold start, under a lock so two functions starting together don't both do it */
export async function migrate() {
  const p = await getPool(), c = await p.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(4711001)");
    await c.query("CREATE TABLE IF NOT EXISTS lhq_migrations (id int PRIMARY KEY, name text NOT NULL, at timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await c.query("SELECT id FROM lhq_migrations")).rows.map(r => r.id));
    /* tables Netlify already made from netlify/database/migrations: record migration 1 as done instead of making them again */
    if (!done.has(1) && (await c.query("SELECT to_regclass('public.lhq_rev') AS t")).rows[0].t) { await c.query("INSERT INTO lhq_migrations (id, name) VALUES (1, $1)", [MIGRATIONS[0].name]); done.add(1); }
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await c.query(m.sql);
      await c.query("INSERT INTO lhq_migrations (id, name) VALUES ($1, $2)", [m.id, m.name]);
    }
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }
}
/* the functions run the migrations themselves on first use */
export const netlifyApplies = () => false;
let pool_isTest = false;
export async function db() {
  if (!ready) ready = (netlifyApplies() ? Promise.resolve() : migrate()).catch(e => { ready = null; throw e; });
  await ready;
  return getPool();
}

/* q`...` style is avoided on purpose: every query is text + params, so nothing typed by a person is ever pasted into SQL */
export async function q(text, params = []) { return (await (await db()).query(text, params)).rows; }
export async function one(text, params = []) { return (await q(text, params))[0] || null; }

/* a transaction: everything inside happens, or nothing does */
export async function tx(fn) {
  const p = await db(), c = await p.connect();
  const T = { q: async (t, a = []) => (await c.query(t, a)).rows, one: async (t, a = []) => (await c.query(t, a)).rows[0] || null };
  try {
    await c.query("BEGIN");
    const out = await fn(T);
    await c.query("COMMIT");
    return out;
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }
}

export const newId = (prefix = "x") => prefix + crypto.randomBytes(8).toString("hex");
