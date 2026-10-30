/* Tutor pay rules (no database needed): node --test test/calc.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import { pay } from "../site/shared/calc.mjs";

const RULES = { cap: 350000, afterHours: "17:00", weekendDays: [0, 6],
  part: { rates: { "in person": 8000, online: 7000 }, classRate: null, programmes: { Marathon: { "in person": 10000, online: 9000 } } },
  full: { afterHoursFee: 5000, afterHoursPer: "session", weekend: [{ minHours: 0, label: "Transport", amount: 3000 }, { minHours: 6, label: "Lunch", amount: 4000 }] } };
const S = (day, a, b, x = {}) => Object.assign({ id: day + a, day, plan_start: a, plan_end: b, status: "done", per: 1, mode: "in person", kind: "one", anyPresent: true, held: false }, x);
const part = [{ placement: "part", starts: "2026-01-01" }], full = [{ placement: "full", starts: "2026-01-01", salary: 350000 }];

test("part-timer: rate by type, double counts 2, programme rate replaces the normal one", () => {
  const r = pay({ month: "2026-10", profiles: part, rules: RULES, sessions: [S("2026-10-05", "14:00", "14:50"), S("2026-10-06", "14:00", "14:50", { mode: "online" }), S("2026-10-07", "14:00", "15:40", { per: 2 }), S("2026-10-08", "14:00", "14:50", { programme: "Marathon" })] });
  assert.equal(r.net, 8000 + 7000 + 16000 + 10000);
});
test("part-timer: no-show and tutor-cancelled aren't paid; lost minutes aren't paid; disputed is held", () => {
  const r = pay({ month: "2026-10", profiles: part, rules: RULES, sessions: [S("2026-10-05", "14:00", "14:50", { anyPresent: false }), S("2026-10-06", "14:00", "14:50", { status: "missed" }),
    S("2026-10-07", "14:00", "14:50", { actual_start: "14:10", actual_end: "14:50" }), S("2026-10-08", "14:00", "14:50", { held: true })] });
  assert.equal(r.net, Math.round(8000 * 40 / 50));
  assert.ok(r.lines.some(l => l.kind === "held"));
  assert.ok(r.lines.some(l => /10 min short/.test(l.note || "")));
});
test("part-timer: normal sessions capped; after-hours and weekend paid on top at the same fee", () => {
  const sessions = []; for (let d = 1; d <= 31; d++) { const day = "2026-10-" + String(d).padStart(2, "0"), wd = new Date(day + "T00:00:00Z").getUTCDay(); if (wd && wd < 6) { sessions.push(S(day, "13:00", "13:50"), S(day, "14:00", "14:50"), S(day, "15:00", "15:50")); } }
  sessions.push(S("2026-10-05", "17:30", "18:20"), S("2026-10-10", "09:00", "09:50"));
  const r = pay({ month: "2026-10", profiles: part, rules: RULES, sessions });
  assert.equal(r.gross, 350000 + 8000 + 8000);
  assert.equal(r.off, 0, "the cap trims gross; it isn't a deduction");
});
test("full-timer: salary covers weekday sessions; after-hours fee; weekend allowances by hours", () => {
  const r = pay({ month: "2026-10", profiles: full, rules: RULES, sessions: [S("2026-10-05", "14:00", "14:50"), S("2026-10-05", "17:00", "17:50"),
    S("2026-10-10", "08:00", "11:00"), S("2026-10-10", "12:00", "15:30"), S("2026-10-11", "14:00", "15:00")] });
  assert.equal(r.net, 350000 + 5000 + (3000 + 4000) + 3000, "whole-day Saturday: transport and lunch; short Sunday: transport");
});
test("placement changes mid-month: salary by days; allowances, bonuses, deductions and advances", () => {
  const r = pay({ month: "2026-11", rules: RULES, sessions: [], profiles: [{ placement: "part", starts: "2026-01-01" }, { placement: "full", starts: "2026-11-16", salary: 300000, allowances: [{ label: "Transport", amount: 30000 }] }],
    items: [{ month: "2026-11", kind: "bonus", label: "Results", amount: 20000 }, { month: "2026-11", kind: "advance", label: "Advance", amount: 50000 }, { month: "2026-11", kind: "deduction", label: "Late", amount: 5000 }] });
  assert.equal(r.gross, 150000 + 15000 + 20000);
  assert.equal(r.off, 55000);
  assert.equal(r.net, r.gross - 55000);
});
test("amounts LHQ hasn't set show as missing instead of a guess", () => {
  const r = pay({ month: "2026-10", profiles: full, rules: Object.assign({}, RULES, { full: { weekend: [{ minHours: 0, label: "Transport", amount: null }] } }), sessions: [S("2026-10-10", "09:00", "10:00")] });
  assert.deepEqual(r.missing, ["Weekend Transport"]);
});
