/* The schedule worked out from tuition cards: sessions, clashes, the card check, free times, a tutor's version of a card */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/schedule.js");
const S = globalThis.SCHED;
const card = (id, student, subs, a = "2026-11-02", b = "2026-11-29") => ({ id, type: "card", number: "TC-" + id, student, periodStart: a, periodEnd: b, subjects: subs });
const thoko = card("1", "Thoko Banda", [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Tu", "Th"], start: "14:00", end: "15:00" }, { name: "Physics", tutor: "Chisomo Banda", days: ["Tu"], start: "15:00", end: "16:00" }]);
const linga = card("2", "Linga Shaba", [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Th"], times: { Th: { s: "14:30", e: "15:30" } }, start: "09:00", end: "10:00" }]);

test("sessions: every card day inside its period, with its own day's time", () => {
  const L = S.sessions([thoko, linga], "2026-11-02", "2026-11-08");
  assert.deepEqual(L.map(e => `${e.date} ${e.s}-${e.e} ${e.student} ${e.sub}`), [
    "2026-11-03 14:00-15:00 Thoko Banda Mathematics", "2026-11-03 15:00-16:00 Thoko Banda Physics",
    "2026-11-05 14:00-15:00 Thoko Banda Mathematics", "2026-11-05 14:30-15:30 Linga Shaba Mathematics"]);
  assert.equal(S.sessions([thoko], "2026-11-02", "2026-11-30", { tutor: "emmanuel  mkwamba" }).length, 8, "4 weeks × 2, one tutor");
  assert.equal(S.sessions([thoko], "2026-12-01", "2026-12-31").length, 0, "nothing after the period");
});

test("clashes: a tutor in two places at once", () => {
  const C = S.clashes(S.sessions([thoko, linga], "2026-11-02", "2026-11-08"));
  assert.equal(C.length, 1); assert.equal(C[0].kind, "tutor"); assert.equal(C[0].a.date, "2026-11-05");
});

test("the card check: the tutor's other cards, the student's own subjects, unavailable times", () => {
  const avail = { "chisomo banda": [{ d: "Tu", s: "08:00", e: "15:30", note: "at school" }] };
  const both = card("3", "Thoko Banda", [{ name: "Biology", tutor: "Emmanuel Mkwamba", days: ["Tu"], start: "14:30", end: "15:30" }, { name: "English", tutor: "Grace Chinyama", days: ["Tu"], start: "15:00", end: "16:00" }]);
  const out = S.checkCard(both, [thoko, linga, both], avail).map(x => x.kind + ": " + x.text);
  assert.ok(out.includes("tutor: Emmanuel Mkwamba already teaches Thoko Banda (Mathematics) Tue 14:00–15:00"), out.join("\n"));
  assert.ok(out.some(x => x.startsWith("student: Thoko Banda has Biology and English at the same time on Tue")), out.join("\n"));
  assert.ok(out.some(x => x.startsWith("student: Thoko Banda already has Physics Tue 15:00–16:00")), out.join("\n"));
  const un = S.checkCard(thoko, [thoko], avail).map(x => x.text);
  assert.deepEqual(un, ["Chisomo Banda isn't available Tue 08:00–15:30 (at school)"]);
  assert.deepEqual(S.checkCard(card("9", "Kettie Gondwe", [{ name: "Chemistry", tutor: "Peter Mvula", days: ["We"], start: "10:00", end: "11:00" }]), [thoko, linga], {}), [], "no clash, nothing said");
});

test("free times: when the tutor and the student are both free, inside LHQ's hours", () => {
  const nw = card("4", "Natasha Chirwa", [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Tu"], start: "14:00", end: "15:00" }]);
  const F = S.freeTimes(nw, "Mathematics", [thoko, linga, nw], { "emmanuel mkwamba": [{ d: "Mo", s: "08:00", e: "17:00" }] });
  const tu = F.find(x => x.day === "Tu").slots;
  assert.ok(!tu.includes("14:00") && !tu.includes("13:30") && tu.includes("15:00") && tu.includes("08:00"), tu.join(" "));
  assert.ok(!F.some(x => x.day === "Mo"), "Monday is unavailable all day");
  assert.deepEqual(F.find(x => x.day === "Su").slots, ["14:00", "14:30", "15:00", "15:30", "16:00"]);
});

test("a tutor's version of a card changes only with their own lines", () => {
  const before = S.sigFor(thoko, "Emmanuel Mkwamba");
  const otherTutorChanged = JSON.parse(JSON.stringify(thoko)); otherTutorChanged.subjects[1].start = "16:00";
  assert.equal(S.sigFor(otherTutorChanged, "Emmanuel Mkwamba"), before);
  const mine = JSON.parse(JSON.stringify(thoko)); mine.subjects[0].days = ["Tu", "Fr"];
  assert.notEqual(S.sigFor(mine, "Emmanuel Mkwamba"), before);
  assert.deepEqual(S.linesFor(thoko, "Emmanuel Mkwamba"), ["Mathematics · Tue 14:00–15:00, Thu 14:00–15:00"]);
});
