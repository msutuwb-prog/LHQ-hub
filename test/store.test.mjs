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
  const r1 = await one("SELECT type, number, student_key, received, saved_by FROM documents WHERE id = 'r1'");
  assert.deepEqual(r1, { type: "receipt", number: "RCT-0001", student_key: "thoko banda", received: 240000, saved_by: "Wanangwa Msutu" }, "the receipt is in the documents table, with its columns");
  assert.ok(!blobs.has("doc/r1"), "and not in Blobs"); assert.equal(JSON.stringify(blobs.get("index").v), blobDoc);
  const rows = (await pool.query("SELECT id, kind, cat, amount::float, entry_date::text FROM money ORDER BY id")).rows;
  assert.deepEqual(rows, [{ id: "s1", kind: "spend", cat: "Rentals", amount: 300000, entry_date: "2026-10-02" }, { id: "s2", kind: "spend", cat: "Utilities", amount: 45000, entry_date: "2026-11-03" }], "spending: one row per entry, merged");
  assert.ok(!(await one("SELECT 1 FROM hub_kv WHERE key = 'kv/lhq_spend'")));
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.docs.length, 3); assert.equal(st.j.kv.lhq_settings.levels.split("\n").length, 2);
  const d = await call("state?since=" + (st.j.rev - 1) + "&epoch=" + st.j.epoch, null, DIR, "GET");
  assert.equal(d.j.delta, true);
});

test("documents, their history and the deleted bin are in their own tables", async () => {
  assert.equal((await one("SELECT count(*)::int n FROM documents")).n, 3);
  assert.equal((await one("SELECT count(*)::int n FROM hub_kv WHERE key LIKE 'doc/%'")).n, 0);
  const i1 = await one("SELECT type, total FROM documents WHERE id = 'i1'"); assert.deepEqual(i1, { type: "invoice", total: 240000 });
  await call("sync", { upserts: [{ doc: { id: "i1", type: "invoice", number: "INV-0001", student: "Thoko Banda", total: 260000 } }] }, DIR);
  assert.equal((await one("SELECT total FROM documents WHERE id = 'i1'")).total, 260000, "an edit updates the columns");
  assert.ok((await one("SELECT count(*)::int n FROM doc_history WHERE doc_id = 'i1'")).n >= 1, "the old version is kept");
  const del = await call("sync", { deletes: [{ id: "q1" }] }, DIR); assert.equal(del.status, 200);
  assert.ok(await one("SELECT 1 FROM doc_trash WHERE id = 'q1'"), "deleted goes to the bin"); assert.ok(!(await one("SELECT 1 FROM documents WHERE id = 'q1'")));
  const back = await call("restore", { id: "q1" }, DIR); assert.equal(back.status, 200, JSON.stringify(back.j));
  assert.ok(await one("SELECT 1 FROM documents WHERE id = 'q1'"), "restored");
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
  assert.equal((await one("SELECT count(*)::int n FROM doc_history WHERE doc_id = 'q1'")).n >= 9, true);
});

test("migration 3 moves documents already copied into hub_kv (step 1) into their tables", async () => {
  const { MIGRATIONS } = await import("../netlify/lib/schema.mjs");
  const sql = MIGRATIONS[2].sql, moveSql = sql.slice(sql.indexOf("INSERT INTO documents"));
  await pool.query("INSERT INTO hub_kv (key, value, etag) VALUES ('doc/old1', $1, 'e1'), ('hist/old1/1700000000000', $2, 'e2'), ('trash/old2', $3, 'e3')",
    [JSON.stringify({ id: "old1", type: "invoice", number: "INV-0900", student: "  Kondwani   GONDWE ", total: "350000", date: "2026-09-14", savedAt: 1700000000001 }),
     JSON.stringify({ id: "old1", total: 300000 }), JSON.stringify({ id: "old2", type: "quote", deletedAt: 1700000000002, deletedBy: "Catherine" })]);
  await pool.query(moveSql);
  const d = await one("SELECT type, number, student_key, total, doc_date::text, saved_at FROM documents WHERE id = 'old1'");
  assert.deepEqual(d, { type: "invoice", number: "INV-0900", student_key: "kondwani gondwe", total: 350000, doc_date: "2026-09-14", saved_at: 1700000000001 });
  assert.deepEqual(await one("SELECT doc_id, at FROM doc_history WHERE id = 'old1/1700000000000'"), { doc_id: "old1", at: 1700000000000 });
  assert.deepEqual(await one("SELECT deleted_by FROM doc_trash WHERE id = 'old2'"), { deleted_by: "Catherine" });
  assert.equal((await one("SELECT count(*)::int n FROM hub_kv WHERE key ~ '^(doc|hist|trash)/'")).n, 0);
});

test("spending: an edit changes one row, a delete is kept as deleted, and the list reads back whole", async () => {
  const before = (await one("SELECT rev FROM money WHERE id = 's1'")).rev;
  await call("sync", { kv: { lhq_spend: { s2: { date: "2026-11-03", cat: "Utilities", amount: 50000, at: 20 }, s1: { date: "2026-10-02", cat: "Rentals", amount: 300000, by: "Wanangwa Msutu", at: 5 } } } }, DIR);
  assert.equal((await one("SELECT amount::float a FROM money WHERE id = 's2'")).a, 50000);
  assert.equal((await one("SELECT rev FROM money WHERE id = 's1'")).rev, before, "an unchanged entry isn't rewritten");
  await call("sync", { kv: { lhq_spend: { s2: { date: "2026-11-03", cat: "Utilities", amount: 50000, at: 30, del: true } } } }, DIR);
  assert.equal((await one("SELECT del FROM money WHERE id = 's2'")).del, true);
  const st = await call("state", null, DIR, "GET");
  assert.deepEqual(Object.keys(st.j.kv.lhq_spend).sort(), ["s1", "s2"]); assert.equal(st.j.kv.lhq_spend.s2.del, true);
  const inc = await call("sync", { kv: { lhq_income: { i1: { date: "2026-11-01", cat: "Rent from tenant", amount: 200000, at: 40 } } } }, DIR);
  assert.equal(inc.status, 200); assert.equal((await one("SELECT kind FROM money WHERE id = 'i1'")).kind, "income");
});

test("migration 4 moves spending and other money already in hub_kv into rows", async () => {
  const { MIGRATIONS } = await import("../netlify/lib/schema.mjs");
  const sql = MIGRATIONS[3].sql, moveSql = sql.slice(sql.indexOf("INSERT INTO money"));
  await pool.query("INSERT INTO hub_kv (key, value, etag) VALUES ('kv/lhq_income', $1, 'e9')", [JSON.stringify({ x1: { date: "2026-09-28", cat: "Loan", amount: "1200000", by: "Wanangwa Msutu" }, x2: { date: "bad", amount: "n/a", del: true } })]);
  await pool.query(moveSql);
  assert.deepEqual(await one("SELECT kind, cat, amount::float a, entry_date::text d FROM money WHERE id = 'x1'"), { kind: "income", cat: "Loan", a: 1200000, d: "2026-09-28" });
  assert.deepEqual(await one("SELECT entry_date, amount, del FROM money WHERE id = 'x2'"), { entry_date: null, amount: null, del: true });
  assert.ok(!(await one("SELECT 1 FROM hub_kv WHERE key = 'kv/lhq_income'")));
});

test("students: the Hub's record goes to the students table; a rename moves it; lists go to settings", async () => {
  await call("sync", { kv: { lhq_students: { "thoko banda": { name: "Thoko Banda", level: "Year 11 · IGCSE", phone: "0991 000 111" }, "natasha chirwa": { name: "Natasha Chirwa" } } } }, DIR);
  const t = await one("SELECT name, level, info->'hub'->>'phone' AS phone FROM students WHERE key = 'thoko banda'");
  assert.deepEqual(t, { name: "Thoko Banda", level: "Year 11 · IGCSE", phone: "0991 000 111" });
  await call("sync", { kv: { lhq_students: { "thoko phiri": { name: "Thoko Phiri", level: "Year 11 · IGCSE", phone: "0991 000 111" }, "natasha chirwa": { name: "Natasha Chirwa" } } } }, DIR);
  const st = await call("state", null, DIR, "GET");
  assert.deepEqual(Object.keys(st.j.kv.lhq_students).sort(), ["natasha chirwa", "thoko phiri"], "the old key is gone from the Hub's list");
  assert.ok(await one("SELECT 1 FROM students WHERE key = 'thoko banda'"), "but the student row stays for the shared records");
  assert.ok(await one("SELECT 1 FROM settings WHERE key = 'hub:lhq_settings'"), "lists are in settings");
  await call("sync", { kv: { lhq_settings: { levels: "Year 10 · IGCSE" } } }, DIR);
  assert.equal((await call("state", null, DIR, "GET")).j.kv.lhq_settings.levels, "Year 10 · IGCSE");
  assert.equal((await one("SELECT count(*)::int n FROM hub_kv WHERE key IN ('kv/lhq_settings', 'kv/lhq_students')")).n, 0);
});

test("migration 5 moves students and lists already in hub_kv", async () => {
  const { MIGRATIONS } = await import("../netlify/lib/schema.mjs");
  await pool.query("INSERT INTO hub_kv (key, value, etag) VALUES ('kv/lhq_students', $1, 'e1'), ('kv/lhq_templates', $2, 'e2')",
    [JSON.stringify({ "linga  shaba": { name: "Linga Shaba", school: "Bishop Mackenzie" } }), JSON.stringify({ emailSubject: "Hello {name}" })]);
  await pool.query(MIGRATIONS[4].sql);
  assert.deepEqual(await one("SELECT key, school, info->>'hubKey' AS hk FROM students WHERE key = 'linga shaba'"), { key: "linga shaba", school: "Bishop Mackenzie", hk: "linga  shaba" });
  assert.equal((await one("SELECT value->>'emailSubject' AS s FROM settings WHERE key = 'hub:lhq_templates'")).s, "Hello {name}");
});

test("tutors' logs: a tutor's lines become rows; two tutors saving at once both land; staff read them back", async () => {
  const mkTutor = async (name, pw) => {
    const add = await call("people", { action: "add", name, role: "tutor" }, DIR); assert.equal(add.status, 200, JSON.stringify(add.j));
    const c = await call("code", { code: add.j.code }); const p = await call("password", { ticket: c.j.ticket, password: pw }); return p.j.token;
  };
  const EM = await mkTutor("Emmanuel Mkwamba", "Maths!2026x"), CH = await mkTutor("Chisomo Banda", "Physics!2026x");
  // tuition cards that name them, so the students are theirs
  await call("sync", { upserts: [{ doc: { id: "tc1", type: "card", number: "TC-0001", student: "Thoko Banda", subjects: [{ name: "Mathematics", tutor: "Emmanuel Mkwamba" }] } },
    { doc: { id: "tc2", type: "card", number: "TC-0002", student: "Natasha Chirwa", subjects: [{ name: "Physics", tutor: "Chisomo Banda" }] } }] }, DIR);
  const e1 = { id: "e1aaaa", ty: "s", k: "thoko banda|mathematics", st: "Thoko Banda", sub: "Mathematics", d: "2026-11-04", a: "present" };
  const e2 = { id: "e2bbbb", ty: "s", k: "natasha chirwa|physics", st: "Natasha Chirwa", sub: "Physics", d: "2026-11-04", a: "late" };
  const [r1, r2] = await Promise.all([call("tutor", { action: "entries", entries: [e1] }, EM), call("tutor", { action: "entries", entries: [e2] }, CH)]);
  assert.equal(r1.status, 200, JSON.stringify(r1.j)); assert.equal(r2.status, 200, JSON.stringify(r2.j));
  const rows = (await pool.query("SELECT id, ty, student_key, subject, day::text, tutor FROM logs WHERE id IN ('e1aaaa', 'e2bbbb') ORDER BY id")).rows;
  assert.deepEqual(rows, [{ id: "e1aaaa", ty: "s", student_key: "thoko banda", subject: "Mathematics", day: "2026-11-04", tutor: "Emmanuel Mkwamba" },
    { id: "e2bbbb", ty: "s", student_key: "natasha chirwa", subject: "Physics", day: "2026-11-04", tutor: "Chisomo Banda" }]);
  const mine = await call("tutor", null, EM, "GET");
  assert.deepEqual(mine.j.entries.map(e => e.id).sort(), ["e1aaaa", "l1"], "a tutor sees only their own students' lines (including the copied one)");
  const st = await call("state", null, DIR, "GET");
  assert.ok(st.j.kv.lhq_logs.e.e1aaaa && st.j.kv.lhq_logs.e.e2bbbb, "staff see both");
  const rep = await call("tutor", { action: "report", report: { d: "2026-11-04", comment: "Good day", rate: 4 } }, EM);
  assert.equal(rep.status, 200); assert.ok(await one("SELECT 1 FROM tutor_reports WHERE tutor = 'Emmanuel Mkwamba' AND day = '2026-11-04'"));
  const cl = await call("tutor", { action: "class", cls: { name: "Year 11 Maths", sub: "Mathematics", stu: ["thoko banda", "thoko banda"] } }, EM);
  assert.equal(cl.status, 400, "a class needs two of the tutor's students");
  // staff import keeps the record of imports beside the entries
  await call("sync", { kv: { lhq_logs: { e: { e3cccc: { id: "e3cccc", ty: "s", k: "thoko banda|mathematics", st: "Thoko Banda", sub: "Mathematics", d: "2026-11-03", tutor: "Emmanuel Mkwamba", at: 9 } }, imports: [{ t: "Emmanuel Mkwamba", n: 1 }] } } }, DIR);
  const st2 = await call("state", null, DIR, "GET");
  assert.equal(Object.keys(st2.j.kv.lhq_logs.e).length, 4); assert.equal(st2.j.kv.lhq_logs.imports.length, 1);
});

test("migration 6 moves tutors' logs, classes and daily reports already in hub_kv", async () => {
  const { MIGRATIONS } = await import("../netlify/lib/schema.mjs");
  const sql = MIGRATIONS[5].sql, moveSql = sql.slice(sql.indexOf("INSERT INTO logs"));
  await pool.query("INSERT INTO hub_kv (key, value, etag) VALUES ('kv/lhq_logs', $1, 'a'), ('kv/lhq_classes', $2, 'b'), ('kv/lhq_treps', $3, 'c')", [
    JSON.stringify({ e: { m1: { id: "m1", ty: "r", k: "linga shaba|biology", sub: "Biology", d: "2026-10-30", tutor: "Peter Mvula", tk: "Cells", rv: 1, sc: 8, mx: 10 }, m2: { id: "m2", x: 1 } }, imports: [{ t: "Peter Mvula" }] }),
    JSON.stringify({ c1: { id: "c1", name: "Year 10 Bio", tutor: "Peter Mvula", stu: ["a", "b"] } }),
    JSON.stringify({ e: { t1: { id: "t1", d: "2026-10-30", tutor: "Peter Mvula", comment: "ok" } } })]);
  await pool.query(moveSql);
  assert.deepEqual(await one("SELECT ty, student_key, day::text, del FROM logs WHERE id = 'm1'"), { ty: "r", student_key: "linga shaba", day: "2026-10-30", del: false });
  assert.equal((await one("SELECT del FROM logs WHERE id = 'm2'")).del, true);
  assert.ok(await one("SELECT 1 FROM classes WHERE id = 'c1' AND name = 'Year 10 Bio'"));
  assert.ok(await one("SELECT 1 FROM tutor_reports WHERE id = 't1'"));
  assert.equal((await one("SELECT value->'imports'->0->>'t' AS t FROM settings WHERE key = 'hub:lhq_logs:rest'")).t, "Peter Mvula");
});

test("confirming a logged session: on the student's behalf, a dispute, settling it; tutors' re-saves keep it", async () => {
  const tok = (await call("signin", { id: "emmanuel.mkwamba", password: "Maths!2026x" })).j.token;
  const c0 = await call("confirm", { action: "confirm", id: "e1aaaa" }, DIR);
  assert.equal(c0.status, 400, "LHQ has to say how it was confirmed");
  assert.equal((await call("confirm", { action: "confirm", id: "e1aaaa", how: "x" }, tok)).status, 403, "a tutor can't confirm their own session");
  const c1 = await call("confirm", { action: "confirm", id: "e1aaaa", how: "By phone with Mrs Banda" }, DIR);
  assert.equal(c1.status, 200, JSON.stringify(c1.j)); assert.equal(c1.j.entry.cf.s, "confirmed");
  assert.equal((await one("SELECT confirm FROM logs WHERE id = 'e1aaaa'")).confirm, "confirmed");
  // the tutor edits the session later from an older copy: the confirmation stays
  const ed = await call("tutor", { action: "entries", entries: [{ id: "e1aaaa", ty: "s", k: "thoko banda|mathematics", st: "Thoko Banda", sub: "Mathematics", d: "2026-11-04", a: "late" }] }, tok);
  assert.equal(ed.status, 200); const row = await one("SELECT confirm, body->>'a' AS a FROM logs WHERE id = 'e1aaaa'");
  assert.deepEqual(row, { confirm: "confirmed", a: "late" });
  // a dispute on another session, then settling it
  assert.equal((await call("confirm", { action: "settle", id: "e3cccc", out: "keep" }, DIR)).status, 409, "only a disputed session can be settled");
  const d = await call("confirm", { action: "dispute", id: "e3cccc", from: "Mrs Banda", note: "Started 20 minutes late", t1: "14:20", t2: "15:30", lost: 20 }, DIR);
  assert.equal(d.status, 200); assert.equal(d.j.entry.cf.lost, 20);
  assert.equal((await call("confirm", { action: "confirm", id: "e3cccc", how: "x" }, DIR)).status, 409, "a disputed session is settled, not confirmed");
  const s2 = await call("confirm", { action: "settle", id: "e3cccc", out: "lost", lost: 20, note: "Agreed with both" }, DIR);
  assert.equal(s2.j.entry.cf.s, "settled"); assert.equal(s2.j.entry.cf.lost, 20); assert.equal(s2.j.entry.cf.note, "Started 20 minutes late");
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.kv.lhq_logs.e.e3cccc.cf.s, "settled", "staff devices get it through the usual sync");
  assert.equal((await call("confirm", { action: "confirm", id: "nope", how: "x" }, DIR)).status, 404);
});

test("activity: every save leaves a line, in words, by whom; Admin doesn't see what they can't open", async () => {
  const r = await call("activity", null, DIR, "GET");
  assert.equal(r.status, 200, JSON.stringify(r.j));
  const S = r.j.rows.map(x => x.summary);
  const has = (re, msg) => assert.ok(S.some(x => re.test(x)), msg + "\n" + S.slice(0, 40).join("\n"));
  has(/^Made receipt RCT-0001 · Thoko Banda · MKW 240,000$/, "a new receipt");
  has(/^Edited invoice INV-0001 · Thoko Banda · MKW 260,000$/, "an edit");
  has(/^Deleted quote Q-0001 · Thoko Banda$/, "a delete, by name");
  has(/^Restored quote Q-0001/, "a restore");
  has(/^Recorded spending · Utilities · MKW 45,000/, "spending recorded");
  has(/^Deleted spending · Utilities/, "spending deleted");
  has(/^Added student Natasha Chirwa$/, "a student added");
  has(/^Changed levels$|^Changed Year & level$/, "a list changed");
  has(/^Logged a session · Thoko Banda · Mathematics · Wed 4 Nov$/, "a tutor's log, in their name");
  has(/^Sent the daily report for Wed 4 Nov/, "a daily report");
  has(/^Confirmed Thoko Banda · Mathematics · Wed 4 Nov with Emmanuel Mkwamba for the family \(By phone with Mrs Banda\)$/, "a confirmation");
  has(/^Settled Thoko Banda · Mathematics · Tue 3 Nov with Emmanuel Mkwamba: 20 min taken off$/, "a settlement");
  const tutorLine = r.j.rows.find(x => /^Logged a session · Thoko/.test(x.summary));
  assert.equal(tutorLine.who, "Emmanuel Mkwamba");
  const f = await call("activity?area=money", null, DIR, "GET");
  assert.ok(f.j.rows.length && f.j.rows.every(x => x.area === "money"), "filter by type");
  const w = await call("activity?who=" + encodeURIComponent("Emmanuel Mkwamba"), null, DIR, "GET");
  assert.ok(w.j.rows.length && w.j.rows.every(x => x.who === "Emmanuel Mkwamba"), "filter by person");
  const tok = (await call("signin", { id: "emmanuel.mkwamba", password: "Maths!2026x" })).j.token;
  assert.equal((await call("activity", null, tok, "GET")).status, 403, "tutors don't see the Activity page");
});

test("tutor's times: unavailable blocks, Got it / Can't make this time, taken off a card, and the phone calendar link", async () => {
  const tok = (await call("signin", { id: "emmanuel.mkwamba", password: "Maths!2026x" })).j.token;
  const av = await call("tutor", { action: "avail", blocks: [{ d: "Mo", s: "08:00", e: "13:00", note: "at school" }, { d: "Xx", s: "1", e: "2" }] }, tok);
  assert.deepEqual(av.j.avail, [{ d: "Mo", s: "08:00", e: "13:00", note: "at school" }], "bad blocks are dropped");
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await call("sync", { upserts: [{ doc: { id: "tc9", type: "card", number: "TC-0009", student: "Linga Shaba", periodStart: day(-3), periodEnd: day(25), where: "LHQ Centre",
    subjects: [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], start: "14:00", end: "15:00" }] } }] }, DIR);
  let g = await call("tutor", null, tok, "GET");
  assert.ok(g.j.cards.some(c => c.id === "tc9")); assert.equal(g.j.acks.tc9, undefined, "not acknowledged yet");
  assert.equal((await call("tutor", { action: "ack", card: "tc9", s: "cant" }, tok)).status, 400, "can't make it needs a reason");
  const ok = await call("tutor", { action: "ack", card: "tc9", s: "cant", note: "Mondays I'm at school", sig: "v1" }, tok);
  assert.equal(ok.status, 200); assert.equal(ok.j.ack.st, "Linga Shaba");
  const st = await call("state", null, DIR, "GET");
  assert.equal(st.j.kv.lhq_cardack["tc9|emmanuel mkwamba"].s, "cant", "staff see it"); assert.equal(st.j.kv.lhq_avail["emmanuel mkwamba"][0].note, "at school");
  // the card goes to another tutor: Emmanuel is told once
  await call("sync", { upserts: [{ doc: { id: "tc9", type: "card", number: "TC-0009", student: "Linga Shaba", periodStart: day(-3), periodEnd: day(25), subjects: [{ name: "Mathematics", tutor: "Chisomo Banda", days: ["Tu"], start: "14:00", end: "15:00" }] } }] }, DIR);
  g = await call("tutor", null, tok, "GET");
  assert.deepEqual(g.j.gone.map(x => x.card), ["tc9"]);
  await call("tutor", { action: "ack", card: "tc9", s: "gone" }, tok);
  assert.deepEqual((await call("tutor", null, tok, "GET")).j.gone, [], "told once");
  assert.equal((await call("tutor", { action: "ack", card: "nope", s: "ok" }, tok)).status, 404);
  // the phone calendar link
  const link = g.j.calLink; assert.match(link, /^\/api\/hub\/cal\/p\w+\.[a-f0-9]{24}\.ics$/);
  await call("sync", { upserts: [{ doc: { id: "tc10", type: "card", number: "TC-0010", student: "Kettie Gondwe", periodStart: day(-1), periodEnd: day(6), subjects: [{ name: "Physics", tutor: "Emmanuel Mkwamba", days: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"], start: "16:00", end: "17:00" }] } }] }, DIR);
  const r = await hub(new Request("http://x" + link), {}); const ics = await r.text();
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type"), /text\/calendar/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 8, "a week of Kettie's sessions, nobody else's");
  assert.match(ics, /SUMMARY:Kettie Gondwe · Physics/); assert.match(ics, /DTSTART:\d{8}T140000Z/, "16:00 in Malawi is 14:00 UTC");
  assert.equal((await hub(new Request("http://x" + link.replace(/\.[a-f0-9]{24}\./, ".000000000000000000000000.")), {})).status, 404, "a wrong signature gets nothing");
});

test("make-ups: a tutor books, LHQ confirms or declines; requisitions: the Director approves, Admin marks bought into Spending", async () => {
  const tok = (await call("signin", { id: "emmanuel.mkwamba", password: "Maths!2026x" })).j.token;
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  assert.equal((await call("tutor", { action: "makeup", k: "natasha chirwa|physics", d: day(2), s: "10:00", e: "11:00" }, tok)).status, 403, "only their own students");
  assert.equal((await call("tutor", { action: "makeup", k: "thoko banda|mathematics", d: day(-5), s: "10:00", e: "11:00" }, tok)).status, 400, "not in the past");
  const m = await call("tutor", { action: "makeup", k: "thoko banda|mathematics", d: day(2), s: "10:00", e: "11:00", why: "Absent on Tuesday" }, tok);
  assert.equal(m.status, 200, JSON.stringify(m.j)); assert.equal(m.j.makeup.status, "asked"); assert.equal(m.j.makeup.st, "Thoko Banda");
  assert.equal((await call("makeup", { id: m.j.makeup.id, decision: "ok" }, tok)).status, 403, "a tutor can't confirm their own");
  assert.equal((await call("makeup", { id: m.j.makeup.id, decision: "no" }, DIR)).status, 400, "declining needs a reason");
  const ok = await call("makeup", { id: m.j.makeup.id, decision: "ok" }, DIR); assert.equal(ok.j.makeup.status, "ok");
  assert.equal((await call("tutor", { action: "makeup", id: m.j.makeup.id, cancel: true }, tok)).status, 409, "a confirmed one can't be taken back by the tutor");
  const g = await call("tutor", null, tok, "GET"); assert.equal(g.j.makeups[0].status, "ok", "the tutor sees the decision");
  // requisitions
  const rep = await call("tutor", { action: "report", report: { d: day(0), req: [{ item: "Printer paper", qty: "5" }, { item: "Markers", qty: "1" }] } }, tok);
  const key0 = rep.j.report.id + "#0", key1 = rep.j.report.id + "#1";
  assert.equal((await call("req", { key: key0, action: "bought", cost: 45000 }, DIR)).status, 409, "approve first");
  assert.equal((await call("req", { key: key0, action: "approve" }, tok)).status, 403);
  assert.equal((await call("req", { key: key0, action: "approve" }, DIR)).j.req.s, "approved");
  assert.equal((await call("req", { key: key1, action: "decline" }, DIR)).status, 400, "declining needs a reason");
  await call("req", { key: key1, action: "decline", note: "We have some in the office" }, DIR);
  const b = await call("req", { key: key0, action: "bought", cost: 45000, cat: "Stationery" }, DIR);
  assert.equal(b.status, 200, JSON.stringify(b.j)); assert.equal(b.j.req.s, "bought");
  const sp = await one("SELECT cat, amount::float a, body->>'what' w FROM money WHERE id = $1", [b.j.req.spend]);
  assert.deepEqual(sp, { cat: "Stationery", a: 45000, w: "Printer paper × 5 (requisition from Emmanuel Mkwamba)" }, "the cost is in Spending");
  const g2 = await call("tutor", null, tok, "GET");
  assert.equal(g2.j.reqs[key1].s, "declined"); assert.equal(g2.j.reqs[key0].s, "bought", "the tutor sees both decisions");
  assert.equal((await call("sync", { kv: { lhq_reqs: { x: 1 } } }, (await call("signin", { id: "chisomo.banda", password: "Physics!2026x" })).j.token)).status, 403);
});

test.after(async () => { await pool.end(); });
