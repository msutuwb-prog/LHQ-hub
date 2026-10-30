/* Sign-in with passwords (database on), through the real /api/hub handler.
   Run: DATABASE_URL=postgres://user:pass@localhost/test_db node --test test/auth.test.mjs   (empties that database) */
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import crypto from "node:crypto";
process.env.LHQ_SECRET = "SETUP123-and-the-rest-of-a-long-secret";
const { _setPool, q, one } = await import("../netlify/lib/db.mjs");
const hubMod = await import("../netlify/functions/hub.mjs"), hub = hubMod.default;
const v2 = (await import("../netlify/functions/v2.mjs")).default;

const URL = process.env.DATABASE_URL;
if (!URL || !/localhost|127\.0\.0\.1/.test(URL)) throw new Error("Set DATABASE_URL to a local test database.");
const pool = new pg.Pool({ connectionString: URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
_setPool(pool); hubMod._setDbMode(true);

/* the current Hub's Blobs, with the Director and a tutor on PINs */
const blobs = new Map();
const salt = "abc", pinHash = pin => crypto.scryptSync(String(pin), salt, 32).toString("hex");
blobs.set("people", [{ id: "pdir", name: "Wanangwa Msutu", role: "director", perms: [], salt, hash: pinHash("2468"), pv: 1, active: true },
  { id: "pchi", name: "Chisomo Banda", role: "tutor", perms: [], tutor: true, salt, hash: pinHash("2580"), pv: 1, active: true },
  { id: "pcat", name: "Catherine Mkwinda", role: "admin", perms: ["quotes", "students", "tutors"], tutor: true, salt, hash: pinHash("1111"), pv: 1, active: true }]);
hubMod._setStore({ get: async k => blobs.get(k) ?? null, setJSON: async (k, v) => { blobs.set(k, v); return { modified: true }; }, delete: async k => blobs.delete(k),
  list: async ({ prefix }) => ({ blobs: [...blobs.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }), getWithMetadata: async k => blobs.has(k) ? { data: blobs.get(k), etag: "1" } : null });

const call = async (path, body, token, method = "POST") => {
  const r = await hub(new Request("http://x/api/hub/" + path, { method, headers: Object.assign({ "content-type": "application/json", "user-agent": "Mozilla/5.0 (Linux; Android 14; Mobile) Chrome/130" }, token ? { authorization: "Bearer " + token } : {}), body: method === "POST" ? JSON.stringify(body || {}) : undefined }), {});
  return { status: r.status, j: await r.json() };
};
const signIn = async (id, password, keep) => call("signin", { id, password, keep });
const firstPw = async (id, pin, pw) => { const a = await signIn(id, pin); assert.ok(a.j.needPassword, JSON.stringify(a.j)); const b = await call("password", { ticket: a.j.ticket, password: pw }); assert.equal(b.status, 200, JSON.stringify(b.j)); return b.j.token; };
let DIR, CHI;

test("before signing in, nobody's name is shown", async () => {
  const r = await call("people?v=2", null, null, "GET");
  assert.equal(r.j.mode, "password"); assert.equal(r.j.people, undefined);
  const old = await call("people", null, null, "GET");
  assert.match(old.j.error, /Refresh/, "an old screen kept on a device is told to refresh");
});

test("staff move from their PIN: once with the PIN, then a password; the PIN stops working", async () => {
  const u = await one("SELECT username, status FROM people WHERE id = 'pchi'");
  assert.equal(u.username, "chisomo.banda"); assert.equal(u.status, "pin");
  const a = await signIn("chisomo.banda", "2580");
  assert.equal(a.j.needPassword, true); assert.equal(a.j.token, undefined, "no session from a PIN alone");
  const weak = await call("password", { ticket: a.j.ticket, password: "chisomo2026" });
  assert.equal(weak.status, 400); assert.match(weak.j.error, /name/);
  const ok = await call("password", { ticket: a.j.ticket, password: "Maths#2026", email: "chisomo@example.com" });
  assert.equal(ok.status, 200); CHI = ok.j.token;
  assert.equal((await signIn("chisomo.banda", "2580")).status, 401, "the PIN no longer works");
  assert.equal((await signIn("CHISOMO@example.com", "Maths#2026")).status, 200, "email works too, any case");
  assert.equal((await signIn("Chisomo  Banda", "Maths#2026")).status, 200, "the full name works too");
  DIR = await firstPw("wanangwa.msutu", "2468", "Director!2026");
});

test("wrong passwords: the same message for an unknown user, a countdown, then a 15-minute lock", async () => {
  const unknown = await signIn("nobody.here", "whatever1");
  const wrong = await signIn("chisomo.banda", "wrong-pass1");
  assert.equal(unknown.j.error, wrong.j.error, "doesn't say which was wrong");
  await signIn("chisomo.banda", "wrong-pass2");
  const third = await signIn("chisomo.banda", "wrong-pass3");
  assert.match(third.j.error, /2 tries left/);
  await signIn("chisomo.banda", "wrong-pass4");
  const fifth = await signIn("chisomo.banda", "wrong-pass5");
  assert.equal(fifth.status, 429); assert.equal(fifth.j.locked, true);
  assert.equal((await signIn("chisomo.banda", "Maths#2026")).status, 429, "locked even with the right password");
  const people = (await call("people", { action: "list" }, DIR)).j.people;
  assert.equal(people.find(p => p.id === "pchi").locked, true, "People & access shows the lock");
  assert.equal((await call("people", { action: "unlock", id: "pchi" }, DIR)).status, 200);
  assert.equal((await signIn("chisomo.banda", "Maths#2026")).status, 200);
});

test("LHQ adds a student: a setup code, used once, to choose a password", async () => {
  const add = await call("people", { action: "add", name: "Linga Phiri", role: "student" }, DIR);
  assert.equal(add.status, 200, JSON.stringify(add.j)); assert.match(add.j.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/); assert.equal(add.j.username, "linga.phiri");
  assert.ok(await one("SELECT 1 FROM students WHERE person_id = $1", [add.j.id]), "linked to a student record");
  assert.equal((await signIn("linga.phiri", "anything1")).status, 403, "can't sign in before setting up");
  const c = await call("code", { code: add.j.code.toLowerCase() });
  assert.equal(c.status, 200); assert.equal(c.j.person.name, "Linga Phiri"); assert.equal(c.j.first, true);
  const pw = await call("password", { ticket: c.j.ticket, password: "Study!2027", keep: true });
  assert.equal(pw.status, 200); assert.ok(pw.j.expires - Date.now() > 29 * 864e5, "kept signed in for 30 days");
  assert.equal((await call("code", { code: add.j.code })).status, 403, "a code works once");
  const st = await call("state", null, pw.j.token, "GET");
  assert.equal(st.status, 403, "a student can't open LHQ's documents");
  assert.equal((await call("people", { action: "list" }, pw.j.token)).status, 403, "or the people list");
  const me = await (await v2(new Request("http://x/api/v2/me", { headers: { authorization: "Bearer " + pw.j.token } }), {})).json();
  assert.equal(me.me.role, "student");
});

test("not ticking 'keep me signed in' lasts 12 hours", async () => {
  const r = await signIn("linga.phiri", "Study!2027", false);
  assert.ok(r.j.expires - Date.now() <= 12 * 3600e3 + 1000);
});

test("a parent is linked to their children and sees only them", async () => {
  const lin = await one("SELECT id FROM students WHERE name = 'Linga Phiri'");
  assert.equal((await call("people", { action: "add", name: "Grace Phiri", role: "parent" }, DIR)).status, 400, "needs a child");
  const add = await call("people", { action: "add", name: "Grace Phiri", role: "parent", children: [lin.id], email: "grace@example.com" }, DIR);
  const c = await call("code", { code: add.j.code }), pw = await call("password", { ticket: c.j.ticket, password: "Family-2026" });
  const ch = await (await v2(new Request("http://x/api/v2/changes?since=0", { headers: { authorization: "Bearer " + pw.j.token } }), {})).json();
  assert.deepEqual(ch.rows.students.map(s => s.name), ["Linga Phiri"]);
  assert.equal((await signIn("grace@example.com", "Family-2026")).status, 200);
});

test("a new code replaces the old one; an expired code doesn't work", async () => {
  const p = await one("SELECT id FROM people WHERE username = 'linga.phiri'");
  const a = (await call("people", { action: "code", id: p.id }, DIR)).j.code, b = (await call("people", { action: "code", id: p.id }, DIR)).j.code;
  assert.equal((await call("code", { code: a })).status, 403, "the older code stopped working");
  await q("UPDATE setup_codes SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
  const r = await call("code", { code: b }); assert.equal(r.status, 403); assert.match(r.j.error, /expired/);
});

test("signed-in devices: listed, and each can be signed out", async () => {
  const one1 = (await signIn("chisomo.banda", "Maths#2026", true)).j.token, two = (await signIn("chisomo.banda", "Maths#2026")).j.token;
  const d = (await call("account", { action: "devices" }, one1)).j.devices;
  assert.ok(d.length >= 2); assert.equal(d.filter(x => x.me).length, 1); assert.match(d[0].label, /Chrome on Android phone/);
  assert.equal((await call("account", { action: "others" }, one1)).status, 200);
  assert.equal((await call("state", null, two, "GET")).status, 401, "the other device is signed out");
  assert.equal((await call("people", { action: "home", cards: ["money"] }, one1)).status, 200, "this one still works");
});

test("switching an account off signs it out everywhere; on again lets them sign in", async () => {
  const p = await one("SELECT id FROM people WHERE username = 'grace.phiri'"), t = (await signIn("grace.phiri", "Family-2026")).j.token;
  await call("people", { action: "off", id: p.id }, DIR);
  assert.equal((await call("account", { action: "devices" }, t)).status, 401);
  assert.equal((await signIn("grace.phiri", "Family-2026")).status, 403);
  await call("people", { action: "on", id: p.id }, DIR);
  assert.equal((await signIn("grace.phiri", "Family-2026")).status, 200);
});

test("who may add whom", async () => {
  const cat = await firstPw("catherine.mkwinda", "1111", "Office#2026");
  assert.equal((await call("people", { action: "add", name: "New Tutor", role: "tutor" }, cat)).status, 200, "Admin with 'tutors' adds tutors");
  assert.equal((await call("people", { action: "add", name: "Another Admin", role: "admin" }, cat)).status, 403, "but not Admin");
  assert.equal((await call("people", { action: "code", id: "pdir" }, cat)).status, 403, "or touch the Director");
  assert.equal((await call("people", { action: "add", name: "Some One", role: "tutor" }, (await signIn("chisomo.banda", "Maths#2026")).j.token)).status, 403, "tutors can't add anyone");
});

test("the current Hub's own people actions still work on the database", async () => {
  const cat = (await signIn("catherine.mkwinda", "Office#2026")).j.token;
  const r = await call("people", { action: "access", id: "pcat", perms: ["quotes", "spend"] }, DIR);
  assert.equal(r.status, 200);
  assert.deepEqual(r.j.people.find(p => p.id === "pcat").perms, ["quotes", "spend"]);
  assert.deepEqual((await one("SELECT perms FROM people WHERE id = 'pcat'")).perms, ["quotes", "spend"]);
  assert.equal((await call("people", { action: "home", cards: ["money", "owed"] }, cat)).j.me.home.length, 2);
  assert.equal((await call("people", { action: "pin", id: "pchi", pin: "1234" }, DIR)).status, 410, "PINs are retired");
});

test("the Director's forgotten password: the setup code from LHQ_SECRET", async () => {
  assert.equal((await call("dircode", { code: "WRONG123" })).status, 403);
  const c = await call("dircode", { code: "SETUP123" });
  assert.equal(c.status, 200); assert.equal(c.j.person.role, "director");
  const pw = await call("password", { ticket: c.j.ticket, password: "NewDirector#1" });
  assert.equal(pw.status, 200);
  assert.equal((await call("state", null, DIR, "GET")).status, 401, "the old sessions are signed out");
  assert.equal((await signIn("wanangwa.msutu", "NewDirector#1")).status, 200);
});

test("my account: change password and email", async () => {
  const t = (await signIn("chisomo.banda", "Maths#2026")).j.token;
  assert.equal((await call("account", { action: "password", current: "nope", password: "Algebra#99" }, t)).status, 401);
  assert.equal((await call("account", { action: "password", current: "Maths#2026", password: "Algebra#99" }, t)).status, 200);
  assert.equal((await call("account", { action: "email", email: "grace@example.com" }, t)).status, 400, "someone else's email");
  assert.equal((await signIn("chisomo.banda", "Algebra#99")).status, 200);
});

test("wrong setup codes are counted too: 10 in 15 minutes wait", async () => {
  for (let i = 0; i < 10; i++) await call("code", { code: "AAAA-AAA" + "BCDEFGHJKM"[i] });
  const r = await call("code", { code: "AAAA-AAAZ" });
  assert.equal(r.status, 429);
});

test("a name two people share needs the username", async () => {
  await q("DELETE FROM settings WHERE key = 'code_fails'");   // the test before locked wrong codes for a while
  const DIRt = (await signIn("wanangwa.msutu", "NewDirector#1")).j.token;
  const a = await call("people", { action: "add", name: "Tiwonge Banda", role: "tutor" }, DIRt), b = await call("people", { action: "add", name: "Tiwonge Banda", role: "tutor" }, DIRt);
  for (const x of [a, b]) { const c = await call("code", { code: x.j.code }); await call("password", { ticket: c.j.ticket, password: "Teach#2026x" }); }
  assert.equal((await signIn("Tiwonge Banda", "Teach#2026x")).status, 401);
  assert.equal((await signIn(b.j.username, "Teach#2026x")).status, 200);
});
