/* Take-home pack: reviews after a period's last session go home on paper when there's a break before the next period */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/schedule.js");
await import("../site/sra.js");
const S = globalThis.SCHED, R = globalThis.SRA;
const card = (id, student, subs, a, b) => ({ id, type: "card", number: "TC-" + id, student, periodStart: a, periodEnd: b, subjects: subs });
/* Tadala: holiday programme to Fri 11 Dec 2026, Maths Mon/Wed/Fri, Physics Wed/Fri */
const tadala = card("1", "Tadala Phiri", [{ name: "Mathematics", tutor: "Chisomo Banda", days: ["Mo", "We", "Fr"] }, { name: "Physics", tutor: "Peter Mvula", days: ["We", "Fr"] }], "2026-11-16", "2026-12-11");
const fin = (k, d, tp, sub) => ({ id: "s" + k + d, ty: "s", k, d, a: "present", fin: [tp], st: "Tadala Phiri", sub });
const E = [fin("tadala phiri|mathematics", "2026-12-07", "Quadratics", "Mathematics"), fin("tadala phiri|mathematics", "2026-12-02", "Vectors", "Mathematics"),
  fin("tadala phiri|physics", "2026-12-09", "Electricity", "Physics"), fin("tadala phiri|physics", "2026-12-04", "Waves", "Physics")];

test("pack: reviews after the last session, handed over that day, none lost", () => {
  const L = R.build(S.items([tadala], "2026-12-08", 45), E, "2026-12-08");
  const P = L.filter(x => x.pack);
  assert.ok(P.every(x => x.giveOn === "2026-12-11" && x.status === "pack"), "all handed over on the last session");
  assert.ok(P.every(x => x.doOn > "2026-12-11"), "only reviews after it");
  const q = P.filter(x => x.topic === "Quadratics").map(x => x.stage);
  assert.deepEqual(q, [3, 4, 5], "Quadratics R3 (14 Dec), R4, R5 go home; R1, R2 are given in sessions");
  assert.equal(L.filter(x => x.topic === "Quadratics" && x.stage === 2)[0].pack, undefined);
  const days = {}; P.forEach(x => { days[x.doOn] = (days[x.doOn] || 0) + 1; });
  assert.ok(Object.values(days).every(n => n <= 2), "at most 2 a day");
});

test("pack: spreading moves a third sheet a day earlier, not before the day after the hand-over", () => {
  /* three topics finished the same day in three subjects → three R4s on one day */
  const c = card("2", "Linga Mwale", ["Mathematics", "Physics", "Chemistry"].map(n => ({ name: n, tutor: "T", days: ["Mo", "We", "Fr"] })), "2026-11-16", "2026-12-11");
  const e = ["Mathematics", "Physics", "Chemistry"].map(n => ({ id: n, ty: "s", k: "linga mwale|" + n.toLowerCase(), d: "2026-12-04", a: "present", fin: ["T" + n], st: "Linga Mwale", sub: n }));
  const P = R.build(S.items([c], "2026-12-01", 45), e, "2026-12-01").filter(x => x.pack && x.stage === 4);
  assert.equal(P.length, 3);
  const moved = P.filter(x => x.from);
  assert.equal(moved.length, 1); assert.equal(moved[0].from, "2026-12-18"); assert.equal(moved[0].doOn, "2026-12-17");
});

test("pack: no pack when the next period carries straight on; a pack when there's a holiday", () => {
  const next = card("3", "Tadala Phiri", tadala.subjects, "2026-12-14", "2027-01-08");
  assert.equal(R.build(S.items([tadala, next], "2026-12-08", 45), E, "2026-12-08").filter(x => x.pack).length, 0, "renewed from Mon 14 Dec");
  const later = card("4", "Tadala Phiri", tadala.subjects, "2027-01-11", "2027-03-26");
  const P = R.build(S.items([tadala, later], "2026-12-08", 45), E, "2026-12-08").filter(x => x.pack);
  assert.ok(P.length > 0 && P.every(x => x.doOn < "2027-01-11"), "only reviews in the holiday; the rest are given in January as usual");
});

test("pack: handed over, then marked by the tutor when the student comes back", () => {
  const out = { id: "p1", ty: "p", k: "tadala phiri|mathematics", on: "2026-12-11", d: "2026-12-11", tutor: "Chisomo Banda", at: 1 };
  const L = R.build(S.items([tadala], "2026-12-20", 45), E.concat([out]), "2026-12-20").filter(x => x.pack && x.sub === "Mathematics");
  assert.ok(L.every(x => x.status === "home" && x.pack.out.by === "Chisomo Banda"));
  assert.ok(L.filter(x => x.sub === "Physics").length === 0);
  const mk = { id: "r1", ty: "r", v: 2, k: "tadala phiri|mathematics", tk: "Quadratics", rv: 3, d: "2027-01-12", sc: 8, mx: 10 };
  const M = R.build(S.items([tadala], "2027-01-12", 45), E.concat([out, mk]), "2027-01-12").find(x => x.topic === "Quadratics" && x.stage === 3);
  assert.equal(M.status, "in"); assert.deepEqual(M.score, { sc: 8, mx: 10 });
  const pk = R.packs(R.build(S.items([tadala], "2026-12-05", 45), E, "2026-12-05"), "2026-12-05");
  assert.equal(pk.length, 2, "both subjects show from 7 days before");
  assert.equal(R.packs(R.build(S.items([tadala], "2026-12-01", 45), E, "2026-12-01"), "2026-12-01").length, 0, "not yet 10 days before");
});
