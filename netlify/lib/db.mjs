/* The database connection, transactions and migrations.
   On Netlify: Netlify Database (Postgres) gives the connection through @netlify/database (NETLIFY_DB_URL).
   Anywhere else (another Postgres such as Neon directly, or the tests): set DATABASE_URL. */
import { MIGRATIONS } from "./schema.mjs";
import crypto from "node:crypto";
import pg from "pg";

let pool = null, ready = null;
export function _setPool(p) { plainDates(pg.types); pool = p; ready = null; pool_isTest = true; }

/* dates and times come back as the text Postgres stores ('2026-10-30', '16:00:00'), never as JavaScript dates
   that shift with the server's time zone */
function plainDates(types) { [1082, 1083, 1266].forEach(oid => types.setTypeParser(oid, v => v)); types.setTypeParser(1700, v => v == null ? v : Number(v)); types.setTypeParser(20, v => v == null ? v : Number(v)); }
async function getPool() {
  if (pool) return pool;
  plainDates(pg.types);
  try { plainDates((await import("@neondatabase/serverless")).types); } catch {}
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (url && !process.env.NETLIFY_DB_URL) {
    pool = new pg.Pool({ connectionString: url, max: 3, ssl: /sslmode=require|neon\.tech/.test(url) ? { rejectUnauthorized: true } : undefined });
  } else {
    const { getDatabase } = await import("@netlify/database");
    pool = getDatabase().pool;
  }
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
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await c.query(m.sql);
      await c.query("INSERT INTO lhq_migrations (id, name) VALUES ($1, $2)", [m.id, m.name]);
    }
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK").catch(() => {}); throw e; }
  finally { c.release(); }
}
/* On Netlify, Netlify applies the migrations itself on every deploy (netlify/database/migrations, generated from
   schema.mjs: see test/schema.test.mjs), so the functions never change tables. Anywhere else (another Postgres, tests)
   the functions run them on first use. */
export const netlifyApplies = () => !!process.env.NETLIFY_DB_URL && !pool_isTest;
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
