/* Students slipping: the same rules for tutors and LHQ */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/attn.js");
const A = globalThis.ATTN, t = "2026-11-09";
const it = { k: "linga|maths", st: "Linga Mwale", sub: "Mathematics", tutor: "Chisomo Banda", pa: "2026-10-01" };
const s = (d, a, x = {}) => Object.assign({ id: "s" + d, ty: "s", k: it.k, d, a }, x);
test("act now: absent twice in 2 weeks (told ones counted and shown)", () => {
  const L = A.slipping([it], [s("2026-11-03", "absent", { told: "n1" }), s("2026-11-05", "absent"), s("2026-11-06", "attended")], t);
  assert.equal(L.length, 1); assert.equal(L[0].level, "now"); assert.equal(L[0].what, "absent twice"); assert.match(L[0].detail, /^1 told/);
  assert.equal(A.slipping([it], [s("2026-10-20", "absent"), s("2026-11-05", "absent")], t).length, 0, "only the last 14 days");
});
test("act now: attendance under 85% once 6 sessions are logged; 2 SRAs not handed in", () => {
  const E = ["10-05", "10-07", "10-12", "10-14", "10-19", "10-21", "10-26"].map((d, i) => s("2026-" + d, i < 2 ? "absent" : "attended"));
  const L = A.slipping([it], E, t); assert.ok(L.some(x => x.kind === "att" && x.rate === 71), JSON.stringify(L));
  const r = (d, rv, h) => ({ id: "r" + d, ty: "r", v: 2, k: it.k, d, tk: "Algebra", rv, h, sc: 5, mx: 10 });
  assert.ok(A.slipping([it], [r("2026-11-02", 1, "m"), r("2026-11-05", 2, "m")], t).some(x => x.kind === "sra"));
  assert.ok(!A.slipping([it], [r("2026-11-02", 1, "m"), r("2026-11-05", 2, "o")], t).some(x => x.kind === "sra"), "clears when one is handed in");
});
test("watch: SRA scores dropping 3+ each review; assessments falling 2 in a row", () => {
  const r = (rv, sc) => ({ id: "r" + rv, ty: "r", v: 2, k: it.k, d: "2026-11-0" + rv, tk: "Algebra", rv, h: "o", sc, mx: 20 });
  const L = A.slipping([it], [r(1, 16), r(2, 12), r(3, 9)], t); assert.equal(L[0].kind, "drop"); assert.equal(L[0].detail, "80 → 60 → 45%");
  assert.equal(A.slipping([it], [r(1, 16), r(2, 12), r(3, 12)], t).length, 0, "a flat last review isn't dropping");
  const w = (d, sc) => ({ id: "w" + d, ty: "w", k: it.k, d, sc, mx: 50 });
  assert.equal(A.slipping([it], [w("2026-10-20", 31), w("2026-10-27", 28), w("2026-11-03", 24)], t)[0].detail, "62 → 56 → 48%");
  assert.equal(A.slipping([it], [w("2026-10-20", 31), w("2026-10-27", 28), w("2026-11-03", 30)], t).length, 0);
});
