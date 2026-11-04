/* One system, step 1: the Hub's documents, lists, money and tutor logs move from Netlify Blobs into the database,
   through the real /api/hub handler. Run: DATABASE_URL=postgres://…/test_db npm test   (empties that database) */
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import crypto from "node:crypto";
process.env.LHQ_SECRET = "SETUP123-and-the-rest-of-a-long-secret";
const { _setPool, one } = await import("../netlify/lib/db.mjs");
const hubMod = await import("../netlify/functions/hub.mjs"), hub = hubMod.default;

const URL = process.env.DATABASE_URL;
if (!URL || !/localhost|127\.0\.0\.1/.test(URL)) throw new Error("Set DATABASE_URL to a local test database.");
const pool = new pg.Pool({ connectionString: URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
_setPool(pool); hubMod._setDbMode(true);

/* the current Hub's Blobs: the Director on a PIN, two documents, settings, spending and a tutor log */
const blobs = new Map(); let et = 0;
const salt = "abc", pinHash = pin => crypto.scryptSync(String(pin), salt, 32).toString("hex");
blobs.set("people", { v: [{ id: "pdir", name: "Wanangwa Msutu", role: "director", perms: [], salt, hash: pinHash("2468"), pv: 1, active: true }], e: "e0" });
const put = (k, v) => blobs.set(k, { v, e: "e" + (++et) });
put("doc/q1", { id: "q1", type: "quote", number: "Q-0001", student: "Thoko Banda", total: 240000, savedAt: 1 });
put("doc/i1", { id: "i1", type: "invoice", number: "INV-0001", student: "Thoko Banda", total: 240000, savedAt: 2 });
put("index", { rev: 2, epoch: "ep1", docs: { q1: { type: "quote", number: "Q-0001", savedAt: 1, r: 1 }, i1: { type: "invoice", number: "INV-0001", savedAt: 2, r: 2 } }, kvr: {} });
put("kv/lhq_settings", { levels: "Year 10 · IGCSE\nYear 11 · IGCSE" });
put("kv/lhq_spend", { s1: { date: "2026-10-02", cat: "Rentals", amount: 300000, by: "Wanangwa Msutu", at: 5 } });
put("kv/lhq_logs", { e: { l1: { id: "l1", ty: "s", d: "2026-11-02", st: "thoko banda", sub: "Mathematics", tutor: "Emmanuel Mkwamba", k: "thoko banda|mathematics" } } });
const mock = {
  get: async k => blobs.has(k) ? blobs.get(k).v : null,
  getWithMetadata: async k => blobs.has(k) ? { data: blobs.get(k).v, etag: blobs.get(k).e } : null,
  setJSON: async (k, v, o = {}) => { const c = blobs.get(k); if (o.onlyIfMatch && (!c || c.e !== o.onlyIfMatch)) return { modified: false }; if (o.onlyIfNew && c) return { modified: false }; put(k, v); return { modified: true, etag: blobs.get(k).e }; },
  delete: async k => { blobs.delete(k); },
  list: async ({ prefix = "" } = {}) => ({ blobs: [...blobs.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) })
};
hubMod._setStore(mock);

const call = async (path, body, token, method = "POST") => {
  const r = await hub(new Request("http://x/api/hub/" + path, { method, headers: Object.assign({ "content-type": "application/json", "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/130" }, token ? { authorization: "Bearer " + token } : {}), body: method === "POST" ? JSON.stringify(body || {}) : undefined }), {});
  return { status: r.status, j: await r.json() };
};
let DIR;
test("the Director signs in (PIN once, then a password)", async () => {
  await call("people?v=2", null, null, "GET");
  const a = await call("signin", { id: "wanangwa.msutu", password: "2468" });
  const b = await call("password", { ticket: a.j.ticket, password: "Director!2026" });
  assert.equal(b.status, 200, JSON.stringify(b.j)); DIR = b.j.token;
});

test("before the move, the Hub still reads Blobs", async () => {
  const s = await call("store", { action: "status" }, DIR);
  assert.equal(s.j.using, "blobs"); assert.equal(s.j.db.all, 0); assert.equal(s.j.blobs.docs, 2);
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.docs.length, 2);
});

test("switching before copying is refused", async () => {
  const r = await call("store", { action: "use", to: "db" }, DIR);
  assert.equal(r.status, 409);
});

test("copy: every key arrives, the document counts and totals match, and Blobs are left as they were", async () => {
  const before = blobs.size;
  const r = await call("store", { action: "move" }, DIR);
  assert.equal(r.status, 200, JSON.stringify(r.j));
  assert.equal(r.j.moved.copied, before); assert.equal(r.j.match, true, JSON.stringify(r.j.totals));
  assert.equal(blobs.size, before, "nothing removed from Blobs");
  const again = await call("store", { action: "move" }, DIR);
  assert.equal(again.j.moved.copied, 0, "running it again copies nothing twice"); assert.equal(again.j.moved.kept, before);
});

test("after switching, saves go to the database and Blobs stay untouched", async () => {
  const u = await call("store", { action: "use", to: "db" }, DIR);
  assert.equal(u.j.using, "db");
  const blobDoc = JSON.stringify(blobs.get("index").v);
  const s = await call("sync", { upserts: [{ doc: { id: "r1", type: "receipt", number: "RCT-0001", student: "Thoko Banda", receivedAmt: 240000 } }], kv: { lhq_spend: { s2: { date: "2026-11-03", cat: "Utilities", amount: 45000, at: 9 } } } }, DIR);
  assert.equal(s.status, 200, JSON.stringify(s.j));
  assert.ok(await one("SELECT 1 FROM hub_kv WHERE key = 'doc/r1'"), "the receipt is in the database");
  assert.ok(!blobs.has("doc/r1"), "and not in Blobs"); assert.equal(JSON.stringify(blobs.get("index").v), blobDoc);
  const spend = (await one("SELECT value FROM hub_kv WHERE key = 'kv/lhq_spend'")).value;
  assert.deepEqual(Object.keys(spend).sort(), ["s1", "s2"], "spending merged entry by entry");
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.docs.length, 3); assert.equal(st.j.kv.lhq_settings.levels.split("\n").length, 2);
  const d = await call("state?since=" + (st.j.rev - 1) + "&epoch=" + st.j.epoch, null, DIR, "GET");
  assert.equal(d.j.delta, true);
});

test("a number already taken gets the next one, on the database too", async () => {
  const s = await call("sync", { upserts: [{ doc: { id: "q2", type: "quote", number: "Q-0001", student: "Natasha Chirwa", total: 120000 } }] }, DIR);
  assert.equal(s.j.remap.q2, "Q-0002");
});

test("two saves at the same moment: neither is lost", async () => {
  const mk = i => call("sync", { upserts: [{ doc: { id: "c" + i, type: "quote", number: "Q-01" + i, student: "S" + i, total: 1 } }] }, DIR);
  const r = await Promise.all([1, 2, 3, 4].map(mk));
  r.forEach(x => assert.equal(x.status, 200, JSON.stringify(x.j)));
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.docs.filter(d => /^c\d$/.test(d.id)).length, 4);
});

test("switching back to Blobs works (nothing deleted either side)", async () => {
  const u = await call("store", { action: "use", to: "blobs" }, DIR);
  assert.equal(u.j.using, "blobs");
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.docs.length, 2, "Blobs as they were before the switch");
  await call("store", { action: "use", to: "db" }, DIR);
});

test("a big Hub is copied in parts, and the parts add up to everything", async () => {
  const { moveFromBlobs } = await import("../netlify/lib/pgstore.mjs");
  for (let i = 0; i < 9; i++) put("hist/q1/" + i, { id: "q1", v: i });
  let r = { more: true, next: 0 }, seen = 0;
  while (r.more) { r = await moveFromBlobs(mock, { from: r.next, size: 4 }); seen += r.copied + r.kept; }
  assert.equal(seen, blobs.size);
  assert.equal((await one("SELECT count(*)::int n FROM hub_kv WHERE key LIKE 'hist/q1/%'")).n >= 9, true);
});

test.after(async () => { await pool.end(); });
