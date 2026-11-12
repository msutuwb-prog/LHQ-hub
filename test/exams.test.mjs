/* Exams, targets and pace (site/exams.js) */
import test from "node:test";
import assert from "node:assert/strict";
await import("../site/examdata.js"); await import("../site/exams.js"); await import("../site/attn.js");
const E = globalThis.EXAMS, t = "2026-11-10";
test("timetables: the next series for each exam, dates only", () => {
  assert.equal(E.nextSeries("I", {}, t).name, "June 2027");
  assert.equal(E.nextSeries("L", {}, t).name, "March 2027");
  assert.deepEqual(E.subjects("m27", "P").map(s => s.code).sort(), ["0058", "0096", "0097"], "Primary Checkpoint: English, Maths, Science (no ESL)");
  assert.equal(E.firstPaper({ code: "0580", ex: "I" }, {}, t).a, "2027-04-28");
});
test("A Level: its own papers, or with the AS papers too", () => {
  const a = E.papersFor({ code: "9709", ex: "A", as: 0 }, {}, t).map(p => p.comp), both = E.papersFor({ code: "9709", ex: "A", as: 1 }, {}, t).map(p => p.comp);
  assert.deepEqual(a.sort(), ["32", "62"]); assert.ok(both.includes("12") && both.includes("32"));
});
test("a corrected date replaces Cambridge's", () => {
  assert.equal(E.firstPaper({ code: "0580", ex: "I" }, { examFix: { "j27|0580/12": { a: "2027-04-29" }, "j27|0580/22": { a: "2027-04-29" } } }, t).a, "2027-04-29");
});
test("grades and boundaries: A*–E, a–e for AS, 9–1, Checkpoint bands; LHQ's own %", () => {
  assert.equal(E.scale("I", "0580"), "igcse"); assert.equal(E.scale("I", "0980"), "nine"); assert.equal(E.scale("AS", "9709"), "as"); assert.equal(E.scale("L", "0862"), "cp");
  assert.equal(E.pctOf("High", "cp", {}), 60); assert.equal(E.pctOf("A", "al", { bands: { al: { A: 75 } } }), 75);
});
test("on track: the last 3 assessments against the target", () => {
  const w = [{ d: "1", p: 90 }, { d: "2", p: 79 }, { d: "3", p: 77 }, { d: "4", p: 76 }];
  const o = E.onTrack(w, 80); assert.equal(o.avg, 77); assert.equal(o.ok, false); assert.equal(o.below2, true);
  assert.equal(E.onTrack(w, 70).ok, true); assert.equal(E.onTrack([], 80).ok, null);
});
test("pace: topics needed by today to finish 4 weeks before the first paper", () => {
  const p = E.pace(12, 20, "2026-09-01", "2027-04-28", t); assert.equal(p.end, "2027-03-31"); assert.ok(p.need > 5 && p.need < 9); assert.equal(E.paceL({ diff: -2 }), "2 behind");
});
test("slipping: below the target twice running is a Watch line", () => {
  const it = { k: "a|m", st: "A", sub: "Maths" }, w = (d, sc) => ({ k: it.k, ty: "w", d, sc, mx: 10 });
  const L = globalThis.ATTN.slipping([it], [w("2026-11-01", 7), w("2026-11-05", 7.5)], t, { target: () => ({ g: "A", tp: 80 }) });
  assert.equal(L.length, 1); assert.equal(L[0].kind, "below"); assert.equal(L[0].level, "watch");
  assert.equal(globalThis.ATTN.slipping([it], [w("2026-11-01", 7), w("2026-11-05", 8.5)], t, { target: () => ({ g: "A", tp: 80 }) }).length, 0);
});
