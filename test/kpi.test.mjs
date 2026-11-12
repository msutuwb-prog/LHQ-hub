/* Tutor KPIs (site/kpi.js) */
import test from "node:test";
import assert from "node:assert/strict";
for (const f of ["schedule", "sra", "examdata", "exams", "sreport", "kpi"]) await import(`../site/${f}.js`);
const K = globalThis.KPI, t = "2026-11-10";
const card = { id: "c1", type: "card", student: "Ruth Banda", periodStart: "2026-10-01", periodEnd: "2026-12-11", subjects: [{ name: "Physics", tutor: "Peter Mvula", days: ["Tu", "Th"], start: "14:00", end: "14:50" }] };
const k = "ruth banda|physics", at = (d, h = 15) => Date.parse(d + `T${String(h - 2).padStart(2, "0")}:00:00Z`);
const s = (d, x = {}) => Object.assign({ id: "s" + d, ty: "s", k, st: "Ruth Banda", sub: "Physics", d, a: "attended", t1: "14:00", t2: "14:50", tutor: "Peter Mvula", c: at(d), at: at(d) }, x);
const ctx = (entries, extra = {}) => Object.assign({ cards: [card], entries, treps: [], makeups: [], sreports: {}, targets: {}, kpi: {}, set: {}, t }, extra);
const r = { a: "2026-11-02", b: "2026-11-08" }, r0 = r;   // Tue 3, Thu 5
test("sessions taught as planned: a student's absence isn't counted; a missing log counts against", () => {
  const f = K.figures(ctx([s("2026-11-03"), s("2026-11-05", { a: "absent" })]), "Peter Mvula", r).ses;
  assert.equal(f.k, 1); assert.equal(f.n, 1);
  assert.equal(K.figures(ctx([s("2026-11-03")]), "Peter Mvula", r).ses.n, 2, "Thursday not logged");
});
test("on time: 5 minutes either way", () => {
  const f = K.figures(ctx([s("2026-11-03", { t1: "14:04" }), s("2026-11-05", { t1: "14:10" })]), "Peter Mvula", r).ont;
  assert.equal(f.k, 1); assert.equal(f.n, 2);
});
test("logged on the day; daily report sent that day", () => {
  const E = [s("2026-11-03"), s("2026-11-05", { c: at("2026-11-06"), at: at("2026-11-06") })];
  const f = K.figures(ctx(E, { treps: [{ tutor: "Peter Mvula", d: "2026-11-03", sent: at("2026-11-03", 17) }, { tutor: "Peter Mvula", d: "2026-11-05", sent: at("2026-11-06", 9) }] }), "Peter Mvula", r);
  assert.equal(f.log.k, 1); assert.equal(f.log.n, 2); assert.equal(f.rep.k, 1); assert.equal(f.rep.n, 2);
});
test("make-ups booked within 7 days", () => {
  const E = [s("2026-11-03", { a: "cancelled" }), s("2026-11-05")];
  const fm = K.figures(ctx(E, { makeups: [{ k, status: "ok", at: at("2026-11-06") }] }), "Peter Mvula", r).mku; assert.equal(fm.k, 1, JSON.stringify(fm.rows));
  assert.equal(K.figures(ctx(E), "Peter Mvula", r).mku.n, 0, "still within 7 days: waiting");
  assert.equal(K.figures(ctx(E, { t: "2026-11-12" }), "Peter Mvula", r).mku.n, 1, "not booked after 7 days counts against");
});
test("status: below target 2 weeks running is falling short", () => {
  const E = []; for (const d of ["2026-10-27", "2026-10-29", "2026-11-03", "2026-11-05"]) E.push(s(d, { c: at(K.add(d, 1)), at: at(K.add(d, 1)) }));
  const st = K.status(ctx(E, { t: "2026-11-08" }), "Peter Mvula");
  assert.equal(st.lvl, "short"); assert.ok(st.longRun.includes("log"));
});
test("periods: week from Monday, month, and terms from Settings", () => {
  assert.deepEqual([K.range("week", t).a, K.range("week", t).b], ["2026-11-09", "2026-11-15"]);
  assert.equal(K.range("term", t, [["Term 1", "2026-09-01", "2026-12-11"]]).a, "2026-09-01");
  assert.equal(K.shift(K.range("month", t), -1).a, "2026-10-01");
});
test("watched: ARS collected with the SRAs a tutor marked", () => {
  const r = (d, x) => Object.assign({ id: "r" + d + JSON.stringify(x), ty: "r", v: 2, k, st: "Ruth Banda", sub: "Physics", d, tk: "Forces", rv: 1, h: "o", sc: 7, mx: 10, tutor: "Peter Mvula", at: at(d) }, x);
  const f = K.figures(ctx([s("2026-11-03"), r("2026-11-03", { ars: 4.5, ao: 6 }), r("2026-11-05", { na: 1 }), r("2026-11-05", { h: "m", sc: "" })]), "Peter Mvula", r0).ars;
  assert.equal(f.k, 1); assert.equal(f.n, 2, "not handed in doesn't count");
});
