/* Tests for the shared records against a real Postgres.
   Run: DATABASE_URL=postgres://user:pass@localhost/lhq_test node --test test/
   The test database is emptied first: never point this at LHQ's real database. */
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import { _setPool, one, q } from "../netlify/lib/db.mjs";
import { run, changes } from "../netlify/lib/records.mjs";
import { seedDemo } from "../netlify/lib/demo.mjs";
import { importFromBlobs, _setBlobStore } from "../netlify/lib/importer.mjs";
import { sessionCount, planned, addDays } from "../site/shared/calc.mjs";
import v2, { _setAuth } from "../netlify/functions/v2.mjs";

const URL = process.env.DATABASE_URL;
if (!URL || !/localhost|127\.0\.0\.1/.test(URL)) throw new Error("Set DATABASE_URL to a local test database.");
const pool = new pg.Pool({ connectionString: URL });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
_setPool(pool);

const DIR = { id: "pdir", name: "Wanangwa Msutu", role: "director", perms: [] };
await q("SELECT 1");   // runs the migrations
await q("INSERT INTO people (id, name, role, status) VALUES ($1, $2, 'director', 'active')", [DIR.id, DIR.name]);
const dir = await one("SELECT * FROM people WHERE id = $1", [DIR.id]);
let seeded = await seedDemo(dir, 0);
while (seeded.more) seeded = await seedDemo(dir, seeded.next);
const who = async name => one("SELECT * FROM people WHERE name = $1", [name]);
const sid = async name => (await one("SELECT id FROM students WHERE name = $1", [name])).id;
const feed = async p => (await changes(p, 0)).rows;
const names = rows => (rows || []).map(r => r.name).sort();
const refused = async (p, name, args, status = 403) => { await assert.rejects(run(p, name, args), e => e.status === status || assert.fail(`${name}: got ${e.status} ${e.message}`)); };

test("migrations ran once and can run again", async () => {
  const m = await q("SELECT id FROM lhq_migrations");
  assert.equal(m.length, 1);
  const { migrate } = await import("../netlify/lib/db.mjs"); await migrate();
  assert.equal((await q("SELECT id FROM lhq_migrations")).length, 1);
});

test("the demo went in through the commands", async () => {
  assert.ok(seeded.sessions > 10, "sessions logged");
  assert.equal((await q("SELECT count(*)::int n FROM students"))[0].n, 6);
  assert.ok((await q("SELECT count(*)::int n FROM activity"))[0].n > 50, "every command left an activity line");
  assert.deepEqual(await seedDemo(dir), { ok: true, already: true });
});

test("a parent sees only their own child", async () => {
  const R = await feed(await who("Grace Phiri"));
  assert.deepEqual(names(R.students), ["Linga Phiri"]);
  assert.ok(R.groups.every(g => R.group_students.some(gs => gs.group_id === g.id)));
  const linId = await sid("Linga Phiri");
  assert.ok(R.group_students.length >= 3 && R.group_students.every(gs => gs.student_id === linId));
  for (const t of ["attendance", "sras", "makeups", "marks"]) assert.ok((R[t] || []).every(x => x.student_id === linId), t);
  assert.ok(!R.pay_profiles && !R.payslips && !R.requisitions && !R.feedback, "no pay, requisitions or feedback");
  assert.ok(R.periods.every(p => "fee" in p), "a parent sees what they pay");
  assert.ok(!(R.people || []).some(p => p.role === "student" && p.name !== "Linga Phiri"), "no other student's account");
});

test("a student in a class doesn't see classmates' records", async () => {
  const nat = await who("Natasha Banda"), R = await feed(nat), natId = await sid("Natasha Banda");
  assert.deepEqual(names(R.students), ["Natasha Banda"]);
  assert.ok(R.groups.some(g => g.name === "Year 10 Maths group"));
  assert.ok(R.group_students.every(gs => gs.student_id === natId), "only her own place in the class");
  assert.ok(R.attendance.every(a => a.student_id === natId), "only her own attendance");
  assert.ok(R.periods.every(p => !("fee" in p)), "students don't get fees");
});

test("a tutor sees only their own groups and students, and no money", async () => {
  const R = await feed(await who("Chisomo Banda"));
  assert.deepEqual(names(R.students), ["Kondwani Kalua", "Kondwani Kapalamula", "Linga Phiri", "Lusungu Nyirenda", "Natasha Banda"]);
  assert.equal(R.groups.length, 4);
  assert.ok(R.students.every(s => JSON.stringify(s.info) === "{}"), "no home contacts");
  assert.ok(R.periods.every(p => !("fee" in p)));
  assert.ok(!R.requisitions, "nobody else's requisitions");
  assert.equal(R.pay_profiles.length, 1, "only his own pay profile");
  assert.ok(!R.payslips, "no draft payslips");
  const E = await feed(await who("Emmanuel Mkumbwa"));
  assert.deepEqual(E.groups.map(g => g.subject), ["Chemistry"]);
  assert.equal(E.requisitions.length, 1);
});

test("nobody receives password or PIN hashes", async () => {
  for (const n of ["Wanangwa Msutu", "Catherine Mkwinda", "Chisomo Banda", "Grace Phiri", "Linga Phiri"]) {
    const R = await feed(await who(n));
    assert.ok((R.people || []).every(p => !("pw_hash" in p) && !("pin_hash" in p) && !("pw_salt" in p)), n);
    assert.ok(!R.setup_codes, n);
  }
});

test("Admin sees teaching but not pay unless given Tutor pay", async () => {
  const adm = await who("Catherine Mkwinda"), R = await feed(adm);
  assert.equal(R.students.length, 6);
  assert.ok(!R.pay_profiles, "no pay profiles");
  assert.ok(!(R.settings || []).some(s => s.key === "pay_rules"), "no pay rules");
  assert.ok((R.activity || []).every(a => a.area !== "pay"));
  await q("UPDATE people SET perms = perms || '[\"tpay\"]' WHERE id = $1", [adm.id]);
  const R2 = await feed(await who("Catherine Mkwinda"));
  assert.equal(R2.pay_profiles.length, 5);
  await q("UPDATE people SET perms = perms - 'tpay' WHERE id = $1", [adm.id]);
});

test("who may do what", async () => {
  const chi = await who("Chisomo Banda"), emm = await who("Emmanuel Mkumbwa"), adm = await who("Catherine Mkwinda"), lin = await who("Linga Phiri"), nat = await who("Natasha Banda");
  const linCh = (await one("SELECT id FROM groups WHERE subject = 'Chemistry'")).id;
  await refused(chi, "session.log", { group_id: linCh, day: "2026-10-01", plan_start: "14:00", plan_end: "14:50" });
  await refused(chi, "session.log", { group_id: (await one("SELECT id FROM groups WHERE name = 'Year 10 Maths group'")).id, day: "2026-10-01", plan_start: "15:00", plan_end: "15:50", status: "cancelled" });
  const linAtt = await one("SELECT id FROM attendance WHERE student_id = $1 AND confirm = 'confirmed' LIMIT 1", [await sid("Linga Phiri")]);
  await refused(nat, "attendance.confirm", { id: linAtt.id });
  const booked = await one("SELECT id FROM makeups WHERE status = 'booked'");
  await refused(chi, "makeup.decide", { id: booked.id, ok: true });
  const req = await one("SELECT id FROM requisitions WHERE item = 'Lab goggles'");
  await refused(adm, "requisition.decide", { id: req.id, ok: true });
  await refused(emm, "requisition.decide", { id: req.id, ok: true });
  await run(dir, "requisition.decide", { id: req.id, ok: true, note: "Buy locally" });
  await refused(chi, "requisition.bought", { id: req.id, cost: 21000 });
  await run(adm, "requisition.bought", { id: req.id, cost: 21000 });   // Admin has Spending by default
  await refused(adm, "pay.item.save", { tutor_id: chi.id, month: "2026-10", kind: "bonus", label: "Great term", amount: 20000 });
  await refused(chi, "pay.profile.save", { tutor_id: chi.id, placement: "full", starts: "2026-01-01", salary: 999999 });
  await refused(adm, "person.save", { name: "New Admin", role: "admin" });
  await refused(lin, "sra.update", { id: (await one("SELECT id FROM sras LIMIT 1")).id, status: "marked", score: 10, out_of: 10 });
  await refused(adm, "nonsense.command", {}, 400);
});

test("a change made on one device reaches exactly the right people", async () => {
  const chi = await who("Chisomo Banda"), grace = await who("Grace Phiri"), nat = await who("Natasha Banda"), emm = await who("Emmanuel Mkumbwa");
  const cur = {}; for (const p of [grace, nat, emm]) cur[p.id] = (await changes(p, 0)).cursor;
  const g = (await one("SELECT id FROM groups WHERE subject = 'Pure Maths 1' AND mode = 'in person'")).id, day = addDays(new Date().toISOString().slice(0, 10), 7);
  await run(chi, "session.log", { group_id: g, day, plan_start: "16:00", plan_end: "16:50", topics: ["Series"], attendance: [{ student_id: await sid("Linga Phiri"), present: "present" }] });
  const G = (await changes(grace, cur[grace.id])).rows, N = (await changes(nat, cur[nat.id])).rows, E = (await changes(emm, cur[emm.id])).rows;
  assert.equal(G.sessions.length, 1, "Grace sees Linga's new session");
  assert.equal(G.attendance.length, 1);
  assert.ok(!N.sessions && !N.attendance, "Natasha sees nothing of it");
  assert.ok(!E.sessions, "Emmanuel sees nothing of it");
});

test("a session: absent means a make-up is owed; booked, confirmed and taught clears it", async () => {
  const chi = await who("Chisomo Banda"), adm = await who("Catherine Mkwinda"), kka = await sid("Kondwani Kalua");
  const g = (await one("SELECT id FROM groups WHERE subject = 'IGCSE Maths' AND kind = 'one' AND tutor_id = $1", [chi.id])).id;
  const s = await run(chi, "session.log", { group_id: g, day: "2026-09-07", plan_start: "14:00", plan_end: "14:50", attendance: [{ student_id: kka, present: "absent" }] });
  const m = await one("SELECT * FROM makeups WHERE owed_session_id = $1", [s.id]);
  assert.equal(m.status, "owed");
  await run(chi, "session.log", { group_id: g, day: "2026-09-07", plan_start: "14:00", plan_end: "14:50", attendance: [{ student_id: kka, present: "present" }] });
  assert.equal((await one("SELECT del FROM makeups WHERE id = $1", [m.id])).del, true, "logged as there after all: no longer owed");
  const s2 = await run(chi, "session.log", { group_id: g, day: "2026-09-09", plan_start: "14:00", plan_end: "14:50", attendance: [{ student_id: kka, present: "absent" }] });
  const m2 = await one("SELECT * FROM makeups WHERE owed_session_id = $1", [s2.id]);
  await run(chi, "makeup.book", { id: m2.id, day: "2026-09-12", starts: "11:00", ends: "11:50" });
  await run(adm, "makeup.decide", { id: m2.id, ok: true });
  await run(chi, "session.log", { group_id: g, day: "2026-09-12", plan_start: "11:00", plan_end: "11:50", makeup_id: m2.id });
  assert.equal((await one("SELECT status FROM makeups WHERE id = $1", [m2.id])).status, "done");
});

test("the student confirms; a disagreement goes to the tutor, then to Admin", async () => {
  const chi = await who("Chisomo Banda"), adm = await who("Catherine Mkwinda"), lus = await who("Lusungu Nyirenda"), lusId = await sid("Lusungu Nyirenda");
  const g = (await one("SELECT id FROM groups WHERE mode = 'online'")).id;
  const s = await run(chi, "session.log", { group_id: g, day: "2026-09-04", plan_start: "16:00", plan_end: "16:50", attendance: [{ student_id: lusId, present: "absent" }] });
  const a = await one("SELECT * FROM attendance WHERE session_id = $1", [s.id]);
  assert.equal(a.confirm, "pending");
  await run(lus, "attendance.dispute", { id: a.id, note: "I was there, the link didn't work for the tutor" });
  await refused(lus, "attendance.confirm", { id: a.id }, 409);
  await run(chi, "attendance.answer", { id: a.id, keep: true, note: "Nobody joined" });
  await refused(chi, "attendance.settle", { id: a.id, present: "present" });
  await run(adm, "attendance.settle", { id: a.id, present: "present", note: "The meeting log shows Lusungu joined" });
  const after = await one("SELECT * FROM attendance WHERE id = $1", [a.id]);
  assert.equal(after.confirm, "settled"); assert.equal(after.present, "present");
  assert.equal((await one("SELECT del FROM makeups WHERE owed_session_id = $1", [s.id])).del, true, "settled as there: no make-up owed");
});

test("finishing a topic schedules the six SRA reviews", async () => {
  const chi = await who("Chisomo Banda"), kkp = await sid("Kondwani Kapalamula");
  const g = (await one("SELECT id FROM groups WHERE name = 'Year 10 Maths group'")).id;
  await run(chi, "session.log", { group_id: g, day: "2026-09-08", plan_start: "15:00", plan_end: "15:50", finished: ["Probability"],
    attendance: [{ student_id: kkp, present: "present" }, { student_id: await sid("Natasha Banda"), present: "absent" }] });
  const r = await q("SELECT to_char(due,'YYYY-MM-DD') due FROM sras WHERE topic = 'Probability' AND student_id = $1 ORDER BY review", [kkp]);
  assert.deepEqual(r.map(x => x.due), ["2026-09-08", "2026-09-09", "2026-09-11", "2026-09-15", "2026-09-22", "2026-10-08"]);
  assert.equal((await q("SELECT 1 FROM sras WHERE topic = 'Probability' AND student_id = $1", [await sid("Natasha Banda")])).length, 0, "not for a student who was absent");
});

test("saving from an old version is refused, not silently overwritten", async () => {
  const st = await one("SELECT * FROM students WHERE name = 'Tadala Chirwa'");
  await run(dir, "student.save", { id: st.id, ver: st.ver, name: st.name, level: "Year 11 · IGCSE" });
  await assert.rejects(run(dir, "student.save", { id: st.id, ver: st.ver, name: st.name, level: "Year 9" }), e => e.status === 409);
});

test("a command sent twice (phone retrying) happens once", async () => {
  const emm = await who("Emmanuel Mkumbwa"), before = (await q("SELECT count(*)::int n FROM requisitions"))[0].n;
  const a = await run(emm, "requisition.add", { item: "Beakers", qty: "4" }, "op-123");
  const b = await run(emm, "requisition.add", { item: "Beakers", qty: "4" }, "op-123");
  assert.equal(b.again, true); assert.equal(a.id, b.id);
  assert.equal((await q("SELECT count(*)::int n FROM requisitions"))[0].n, before + 1);
});

test("pay: worked out from the logs, confirmed, then the tutor sees and signs it", async () => {
  const chi = await who("Chisomo Banda"), month = new Date().toISOString().slice(0, 7);
  const d = await run(dir, "payslip.draft", { tutor_id: chi.id, month });
  const slip = await one("SELECT * FROM payslips WHERE id = $1", [d.id]);
  assert.ok(slip.lines.some(l => l.kind === "salary"), "full-timer: salary line");
  assert.ok(slip.lines.filter(l => l.kind === "session").every(l => l.amount === 0), "weekday sessions are in the salary");
  assert.ok(!(await feed(chi)).payslips, "the tutor doesn't see a draft");
  await run(dir, "payslip.confirm", { id: d.id });
  const C = (await feed(chi)).payslips; assert.equal(C.length, 1);
  await refused(await who("Emmanuel Mkumbwa"), "payslip.sign", { id: d.id });
  await run(chi, "payslip.sign", { id: d.id });
  assert.equal((await one("SELECT status FROM payslips WHERE id = $1", [d.id])).status, "signed");
  await refused(dir, "pay.item.save", { tutor_id: chi.id, month, kind: "bonus", label: "Late", amount: 1 }, 409);
});

test("students' feedback reaches LHQ only as averages", async () => {
  const lin = await who("Linga Phiri"), linId = await sid("Linga Phiri");
  const ss = await q("SELECT session_id FROM attendance WHERE student_id = $1 LIMIT 3", [linId]);
  for (const s of ss) await run(lin, "feedback.add", { session_id: s.session_id, rating: 4, prepared: true, on_time: false });
  assert.equal((await feed(lin)).feedback.length, 3, "Linga sees her own");
  for (const n of ["Chisomo Banda", "Catherine Mkwinda", "Wanangwa Msutu"]) assert.ok(!(await feed(await who(n))).feedback, n + " gets no single answers");
  _setAuth(async () => ({ id: dir.id, name: dir.name, role: "director", perms: [] }));
  const r = await (await v2(new Request("http://x/api/v2/feedback"), {})).json();
  assert.equal(r.tutors[0].rating, 4); assert.equal(r.tutors[0].on_time, 0);
  _setAuth(async () => ({ id: (await who("Chisomo Banda")).id, name: "Chisomo Banda", role: "tutor" }));
  assert.equal((await v2(new Request("http://x/api/v2/feedback"), {})).status, 403);
});

test("the API: sign-in from the current Hub, the feed, commands, previews only for demo data", async () => {
  _setAuth(async () => null);
  assert.equal((await v2(new Request("http://x/api/v2/me"), {})).status, 401);
  _setAuth(async () => ({ id: "pnew", name: "Joseph Nkhoma", role: "tutor", perms: [] }));
  const me = await (await v2(new Request("http://x/api/v2/me"), {})).json();
  assert.equal(me.me.name, "Joseph Nkhoma"); assert.equal(me.me.role, "tutor");
  const c = await (await v2(new Request("http://x/api/v2/changes?since=0"), {})).json();
  assert.ok(!c.rows.students, "a tutor with no groups sees no students");
  const r = await v2(new Request("http://x/api/v2/cmd", { method: "POST", body: JSON.stringify({ name: "requisition.add", args: { item: "Markers" } }) }), {});
  assert.equal(r.status, 200);
  const bad = await v2(new Request("http://x/api/v2/cmd", { method: "POST", body: JSON.stringify({ name: "requisition.decide", args: { id: "x", ok: true } }) }), {});
  assert.equal(bad.status, 403); assert.match((await bad.json()).error, /Wanangwa/);
  _setAuth(async () => ({ id: dir.id, name: dir.name, role: "director", perms: [] }));
  assert.equal((await v2(new Request("http://x/api/v2/demo", { method: "POST" }), { deploy: { context: "production" } })).status, 403);
});

test("session counts agree with the agreed rules", () => {
  const slots = [{ weekday: 2, starts: "16:00", ends: "16:50", per: 1, from_date: "2026-10-01", to_date: "2026-10-31" }, { weekday: 6, starts: "09:00", ends: "10:40", per: 2, from_date: "2026-10-01", to_date: "2026-10-31" }];
  const plan = planned(slots, "2026-10-01", "2026-10-31", ["2026-10-13"]);
  assert.equal(plan.reduce((a, p) => a + p.per, 0), 3 + 2 * 5, "4 Tuesdays minus the closed one, 5 Saturday doubles");
  const sess = [{ day: "2026-10-06", plan_start: "16:00", status: "done", present: "present" }, { day: "2026-10-03", plan_start: "09:00", status: "done", present: "absent", per: 2 }];
  const c = sessionCount(plan, sess, [{ status: "done", per: 1 }], "2026-10-15");
  assert.equal(c.had, 1 + 1, "one taught + one made up");
  assert.ok(c.owed >= 1, "absent double owed, minus the one made up; unlogged past sessions owed too");
});

test("the feed pages: a big first sync comes in parts and nothing is missed", async () => {
  const all = (await changes(dir, 0)).rows, total = Object.values(all).reduce((a, r) => a + r.length, 0);
  const { _setPage } = await import("../netlify/lib/records.mjs"); _setPage(50);
  let since = 0, got = 0, rounds = 0, seen = new Set();
  for (;;) { const c = await changes(dir, since); for (const [t, rows] of Object.entries(c.rows)) rows.forEach(r => { if (!seen.has(t + r.id + r.rev)) { seen.add(t + r.id + r.rev); got++; } }); since = c.cursor; rounds++; if (!c.more) break; assert.ok(rounds < 500); }
  _setPage(1000);
  assert.ok(rounds > 2, "came in parts"); assert.equal(got, total, "every row arrived once");
});

test("the current Hub copies into the records, and copying again adds nothing", async () => {
  /* the live Hub's own demo data (site/demo.js) stands in for LHQ's Blobs */
  const ctx = { window: {}, Date, Math, JSON }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new globalThis.URL("../site/demo.js", import.meta.url), "utf8"), ctx);
  const D = ctx.LHQDemo.build();
  const people = [{ name: "Wanangwa Msutu", role: "director" }].concat(D.people).map((p, i) => { const salt = "s" + i; return Object.assign({ id: "b" + i, salt, hash: crypto.scryptSync(String(p.pin || "1111"), salt, 32).toString("hex") }, p); });
  const blobs = { people, "kv/lhq_students": D.kv.lhq_students, "kv/lhq_classes": {}, "kv/lhq_logs": D.kv.lhq_logs };
  D.docs.forEach(d => { blobs["doc/" + d.id] = d; });
  _setBlobStore({ get: async k => blobs[k] ?? null, list: async ({ prefix }) => ({ blobs: Object.keys(blobs).filter(k => k.startsWith(prefix)).map(key => ({ key })) }) });
  const all = async () => { const t = {}; let r = { more: true, next: 0 }; while (r.more) { r = await importFromBlobs(dir, { part: r.next, size: 400 }); for (const [k, v] of Object.entries(r)) if (typeof v === "number" && !["part", "next", "logs"].includes(k)) t[k] = (t[k] || 0) + v; t.skipped = (t.skipped || []).concat(r.skipped); } return t; };
  const a = await all();
  assert.ok(a.students > 20 && a.groups > 20 && a.slots > 20 && a.sessions > 100 && a.sras > 50, JSON.stringify(a));
  const logged = Object.values(D.kv.lhq_logs.e).filter(e => e.ty === "s" && e.tutor);
  const inDb = (await q("SELECT count(*)::int n FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE s.logged_by LIKE 'b%'"))[0].n;
  assert.equal(inDb, logged.length - a.skipped.filter(x => x.startsWith("Log")).length, "one attendance row per session log");
  const absent = logged.filter(e => e.a === "absent").length;
  assert.ok((await q("SELECT count(*)::int n FROM makeups WHERE why LIKE '%old logs%'"))[0].n === absent, "absences became make-ups owed");
  const may = await one("SELECT status, pin_hash FROM people WHERE id = 'b10'");
  assert.equal(may.status, "off", "an inactive tutor stays off"); assert.ok(may.pin_hash, "PIN hash kept for the move to passwords");
  const b = await all();
  assert.equal((b.sessions || 0) + (b.students || 0) + (b.groups || 0) + (b.sras || 0), 0, "a second copy adds nothing");
});
