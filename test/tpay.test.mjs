/* Tutor pay (site/tpay.js): a month's payslip from the session logs */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/schedule.js"); await import("../site/tpay.js");
const P = globalThis.TPAY;
const card = { id: "c1", type: "card", student: "Ruth Banda", periodStart: "2026-11-01", periodEnd: "2026-11-30", subjects: [{ name: "Physics", tutor: "Peter Mvula", days: ["Tu", "Th", "Sa"], start: "16:00", end: "16:50" }] };
const k = "ruth banda|physics";
let n = 0; const s = (d, x = {}) => Object.assign({ id: "s" + (++n), grp: "g" + n, ty: "s", k, st: "Ruth Banda", sub: "Physics", d, a: "attended", t1: "16:00", t2: "16:50", tutor: "Peter Mvula" }, x);
const ctx = (entries, pay = {}) => ({ cards: [card], entries, classes: [], pay, t: "2026-11-30" });
const line = (x, id) => x.lines.find(l => l.id === id);
test("part-time: in person, online, weekend on top; no-show and cancellations not paid", () => {
  const x = P.month(ctx([s("2026-11-03"), s("2026-11-05", { md: "o" }), s("2026-11-07"), s("2026-11-10", { a: "absent" }), s("2026-11-12", { a: "cancelled", cb: "lhq" })]), "Peter Mvula", "2026-11");
  assert.equal(line(x, "inp").amt, 8000); assert.equal(line(x, "onl").amt, 7000); assert.equal(line(x, "wkd").amt, 8000);
  assert.equal(line(x, "nos").rows.length, 1); assert.equal(line(x, "canl").rows.length, 1); assert.equal(x.total, 23000); assert.equal(x.paid, 3);
});
test("minutes lost beyond 5 minutes, as a share of the fee", () => {
  const x = P.month(ctx([s("2026-11-03", { t1: "16:12" }), s("2026-11-05", { t1: "16:04" })]), "Peter Mvula", "2026-11");
  const m = line(x, "min"); assert.equal(m.mins, 12); assert.equal(m.amt, -1920); assert.equal(m.rows.length, 2, "the one within grace is listed at 0");
});
test("held while disputed; the cap trims normal sessions only", () => {
  const E = [s("2026-11-03", { cf: { s: "disputed", note: "ended 16:20" } }), s("2026-11-05")];
  const x = P.month(ctx(E, { rules: { cap: 5000 } }), "Peter Mvula", "2026-11");
  assert.equal(line(x, "held").owed, 8000); assert.equal(line(x, "cap").amt, -3000); assert.equal(x.total, 5000);
});
test("full-time: salary by days, overtime, weekend transport and lunch", () => {
  const E = [s("2026-11-03"), s("2026-11-05", { t1: "17:00", t2: "17:50" }), ...["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"].map(h => s("2026-11-07", { t1: h, t2: h.slice(0, 2) + ":50" }))];
  const c2 = Object.assign({}, card, { subjects: [] });
  const x = P.month({ cards: [c2], entries: E, classes: [], pay: { place: { "peter mvula": [{ p: "part", from: "2026-01-01" }, { p: "full", from: "2026-11-16" }] } }, t: "2026-11-30" }, "Peter Mvula", "2026-11");
  assert.equal(line(x, "sal").amt, Math.round(350000 * 15 / 30), "16–30 Nov full-time");
  const y = P.month({ cards: [c2], entries: E, classes: [], pay: { place: { "peter mvula": [{ p: "full", from: "2026-01-01" }] } }, t: "2026-11-30" }, "Peter Mvula", "2026-11");
  assert.equal(line(y, "ovt").amt, 6000); assert.equal(line(y, "trn").amt, 10000); assert.equal(line(y, "lun").amt, 5000);
});
test("a class or group is one session; items added by LHQ", () => {
  const E = [s("2026-11-03", { grp: "G1" }), s("2026-11-03", { grp: "G1", k: "tadala|physics", st: "Tadala" })];
  const x = P.month(ctx(E, { items: { a: { id: "a", tutor: "Peter Mvula", m: "2026-11", kind: "advance", amt: 30000, label: "Advance" } } }), "Peter Mvula", "2026-11");
  assert.equal(line(x, "inp").amt, 8000); assert.equal(x.total, -22000);
});
