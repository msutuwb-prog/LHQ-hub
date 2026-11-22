/* Payment plans (site/payplan.js): in full, 50/50, and a fast track intake's set dates */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/payplan.js");
const P = globalThis.PAYPLAN;
test("paid in full has no instalments", () => { assert.equal(P.rows({ plan: "" }, 1000, "2026-11-11"), null); });
test("50/50: half at the start, half half-way through the tuition period", () => {
  const R = P.rows({ plan: "half", periodStart: "2026-09-01", periodEnd: "2026-12-11" }, 1350000, "2026-11-11");
  assert.equal(R.length, 2); assert.equal(R[0].amt, 675000); assert.equal(R[0].due, "2026-09-01"); assert.ok(R[1].due > "2026-10-01" && R[1].due < "2026-11-01");
  const nx = P.mark(R, 675000); assert.equal(nx.n, 2); assert.equal(nx.left, 675000); assert.equal(R[0].paid, true);
});
test("set dates: equal parts in date order, the last takes the rounding; part payments count in order", () => {
  const R = P.rows({ plan: "set", planD: ["2026-11-30", "2026-09-07", "2026-10-05"] }, 1000000, "2026-11-11");
  assert.deepEqual(R.map(r => r.due), ["2026-09-07", "2026-10-05", "2026-11-30"]);
  assert.equal(R[0].amt + R[1].amt + R[2].amt, 1000000); assert.equal(R[2].short, "3rd payment");
  const nx = P.mark(R, 400000); assert.equal(nx.n, 2); assert.equal(Math.round(nx.left), 266667);
  assert.equal(P.mark(R, 1000000), null);
});
