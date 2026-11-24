/* A new live Hub (24 Nov): an empty Supabase database and nothing in the old storage. The Director sets up with the code
   from LHQ_SECRET, and everything is kept in the database from the first save. */
process.env.LHQ_SECRET = "SETUP123-and-the-rest-of-a-long-secret";
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { _setPool, one } from "../netlify/lib/db.mjs";
import * as hubMod from "../netlify/functions/hub.mjs";
const hub = hubMod.default;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
_setPool(pool); hubMod._setDbMode(true);
const blobs = new Map();
hubMod._setStore({ get: async k => blobs.get(k) ?? null, setJSON: async (k, v) => { blobs.set(k, v); return { modified: true }; }, delete: async k => blobs.delete(k),
  list: async ({ prefix } = {}) => ({ blobs: [...blobs.keys()].filter(k => k.startsWith(prefix || "")).map(key => ({ key })) }), getWithMetadata: async k => blobs.has(k) ? { data: blobs.get(k), etag: "1" } : null });
const call = async (path, body, token, method = "POST") => {
  const r = await hub(new Request("http://x/api/hub/" + path, { method, headers: Object.assign({ "content-type": "application/json" }, token ? { authorization: "Bearer " + token } : {}), body: body ? JSON.stringify(body) : undefined }), {});
  return { status: r.status, j: await r.json() };
};
test("a new Hub: the Director sets up, and the first document is saved in the database", async () => {
  const s = await call("setup", { code: "SETUP123", name: "Wanangwa Msutu", password: "Director!2026", keep: true });
  assert.equal(s.status, 200, JSON.stringify(s.j)); const tok = s.j.token; assert.ok(tok);
  assert.equal((await one("SELECT value FROM settings WHERE key = 'hub_store'")).value, "db", "the database is chosen once, from the start");
  const d = { id: "dfresh1", type: "quote", number: "Q-0001", student: "Test Student", date: "2026-11-24", items: [], total: 1000, savedAt: Date.now() };
  const r = await call("sync", { upserts: [{ doc: d }], deletes: [], kv: {} }, tok);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.ok(await one("SELECT 1 FROM documents WHERE id = 'dfresh1'"), "in the documents table");
  assert.equal([...blobs.keys()].filter(k => k.startsWith("doc/")).length, 0, "nothing in the old storage");
});
