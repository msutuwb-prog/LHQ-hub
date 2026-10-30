/* LHQ Hub: the numbers every account must agree on, worked out in one place.
   Used by the server (payslips, Director figures) and by the app (what a student, tutor or parent sees),
   so a student, their tutor and the Director can never see two different counts.
   Pure functions: no storage, no network. Dates are 'YYYY-MM-DD' strings in Lilongwe time; times are 'HH:MM'. */

export const mins = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const pad = n => String(n).padStart(2, "0");
export const iso = d => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
export const toDate = s => new Date(s + "T00:00:00Z");
export const weekday = s => toDate(s).getUTCDay();
export const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * 864e5));
export const monthOf = s => String(s).slice(0, 7);
export const daysIn = month => new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();

/* ---------- the timetable ---------- */
/* every planned session from the slots between two dates, skipping closed days (holidays LHQ sets) */
export function planned(slots, from, to, closed = []) {
  const out = [], shut = new Set(closed);
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (shut.has(d)) continue;
    const wd = weekday(d);
    slots.filter(s => !s.del && s.weekday === wd && s.from_date <= d && s.to_date >= d)
      .forEach(s => out.push({ day: d, starts: String(s.starts).slice(0, 5), ends: String(s.ends).slice(0, 5), per: s.per || 1 }));
  }
  return out;
}

/* ---------- one student's sessions in one subject ----------
   Agreed rules: 50 min in term, 45 in holidays (the slot carries the length); a double counts as 2;
   a session that ran short still counts as one session; any missed session is owed as a make-up, whoever missed it.
   plan:   the planned sessions (from planned())
   sess:   this group's sessions, each with this student's attendance: {day, plan_start, status, per, present, makeup_id}
   makeups: this student's make-ups in this group */
export function sessionCount(plan, sess, makeups, today) {
  const key = (d, t) => d + "|" + String(t).slice(0, 5);
  const byKey = new Map(sess.filter(s => !s.del && !s.makeup_id).map(s => [key(s.day, s.plan_start), s]));
  let had = 0, future = 0, missed = 0, absent = 0;
  for (const p of plan) {
    const s = byKey.get(key(p.day, p.starts)), n = p.per || 1;
    if (s && s.status === "done" && s.present !== "absent") had += n;
    else if (s && (s.status === "missed" || s.status === "cancelled" || s.present === "absent")) { missed += n; if (s.present === "absent") absent += n; }
    else if (p.day >= today) future += n;
    else missed += n;   // a past session nobody logged: owed until the tutor logs it
  }
  const live = (makeups || []).filter(m => !m.del);
  const madeUp = live.filter(m => m.status === "done").reduce((a, m) => a + (m.per || 1), 0);
  const waived = live.filter(m => m.status === "waived").reduce((a, m) => a + (m.per || 1), 0);
  const owed = Math.max(0, missed - madeUp - waived);
  const total = plan.reduce((a, p) => a + (p.per || 1), 0);
  return { plan: total, had: had + madeUp, owed, left: future + owed, absent, madeUp, waived, booked: live.filter(m => ["booked", "confirmed"].includes(m.status)).length };
}

/* ---------- tutor pay ----------
   rules (LHQ-wide, set by the Director; any amount left null shows as "not set" on the draft payslip):
     cap            part-timers' normal sessions in a month are capped at this (MK 350,000)
     afterHours     a session starting at or after this time is after hours ('17:00')
     weekendDays    [0, 6] (Sunday, Saturday)
     part.rates     {'in person': 8000, online: 7000}     per session, a double is 2
     part.classRate null = a class is paid as one session; a number = the class rate
     part.programmes {name: {'in person': n, online: n}}   a programme's rate replaces the normal one
     full.afterHoursFee  overtime for a full-timer's weekday session after hours; full.afterHoursPer 'session' | 'hour'
     full.weekend   [{minHours, label, amount}]: on a weekend day a full-timer gets every band whose minHours they reach
                    (e.g. Transport from 0 h, Lunch from 6 h: a whole-day Saturday gets both)
   A tutor's pay profile can replace any of part.rates / part.programmes / part.classRate for that tutor.

   What counts (agreed): a session is paid when it was taught and at least one student came. No-show: not paid.
   Tutor cancelled: not paid. A make-up is paid when it's taught. A session has to start and finish on time:
   the minutes lost to a late start or early finish are not paid. A session whose attendance is disputed
   and not yet settled is held, and paid on the payslip after it's settled.
   Part-timers: normal sessions up to the cap; after-hours and weekend sessions are paid on top, at the same session fee.
   Full-timers: salary (for part of a month, by days); weekday after-hours sessions get the overtime fee; weekend days get allowances by hours taught. */
export function pay({ month, profiles, sessions, items = [], rules }) {
  const lines = [], missing = new Set();
  const R = Object.assign({ cap: null, afterHours: "17:00", weekendDays: [0, 6], part: {}, full: {} }, rules || {});
  const prof = d => profiles.filter(p => !p.del && p.starts <= d).sort((a, b) => a.starts < b.starts ? 1 : -1)[0] || null;
  const days = daysIn(month), first = month + "-01", last = month + "-" + pad(days);
  const amt = (v, what) => { if (v == null || v === "") { missing.add(what); return 0; } return Number(v); };

  /* salary and monthly allowances, by the days each placement covered */
  const span = new Map();
  for (let d = first; d <= last; d = addDays(d, 1)) { const p = prof(d); if (p) span.set(p, (span.get(p) || 0) + 1); }
  for (const [p, n] of span) {
    const part = n / days, note = n < days ? ` (${n} of ${days} days)` : "";
    if (p.placement === "full") lines.push({ kind: "salary", label: "Salary" + note, amount: round(amt(p.salary, "Full-time salary") * part) });
    (p.allowances || []).forEach(a => lines.push({ kind: "allowance", label: a.label + note, amount: round(amt(a.amount, a.label) * part) }));
  }

  /* sessions */
  const isWeekend = d => (R.weekendDays || []).includes(weekday(d));
  const after = s => mins(s.plan_start) >= mins(R.afterHours);
  const taught = s => {
    const plan = mins(s.plan_end) - mins(s.plan_start);
    if (!s.actual_start || !s.actual_end) return { frac: 1, lost: 0, plan };
    const a = Math.max(mins(s.actual_start), mins(s.plan_start)), b = Math.min(mins(s.actual_end), mins(s.plan_end));
    const got = Math.max(0, b - a); return { frac: plan ? Math.min(1, got / plan) : 1, lost: Math.max(0, plan - got), plan };
  };
  let capped = 0; const capLines = [], weekendHours = new Map();
  const mine = sessions.filter(s => !s.del && monthOf(s.day) === month && s.status === "done");
  for (const s of mine.sort((a, b) => (a.day + a.plan_start).localeCompare(b.day + b.plan_start))) {
    const p = prof(s.day); if (!p) continue;
    const label = `${s.day} ${String(s.plan_start).slice(0, 5)} · ${s.label || s.subject || "Session"}`;
    if (!s.anyPresent) { lines.push({ kind: "session", label, note: "No student came: not paid", amount: 0, sid: s.id }); continue; }
    if (s.held) { lines.push({ kind: "held", label, note: "Being settled: paid once it's settled", amount: 0, sid: s.id }); continue; }
    const t = taught(s), per = s.per || 1, short = t.lost ? ` · ${t.lost} min short, not paid` : "";
    if (p.placement === "full") {
      if (isWeekend(s.day)) { weekendHours.set(s.day, (weekendHours.get(s.day) || 0) + t.plan * t.frac * per / 60); lines.push({ kind: "session", label, note: "Weekend: see allowance" + short, amount: 0, sid: s.id }); }
      else if (after(s)) {
        const fee = amt((R.full || {}).afterHoursFee, "Full-time after-hours fee"), hours = t.plan * t.frac * per / 60;
        lines.push({ kind: "overtime", label, note: "After hours" + short, amount: round((R.full || {}).afterHoursPer === "hour" ? fee * hours : fee * per * t.frac), sid: s.id });
      } else lines.push({ kind: "session", label, note: "In salary" + short, amount: 0, sid: s.id });
      continue;
    }
    const rates = Object.assign({}, (R.part || {}).rates, (p.rates || {}).rates);
    const progs = Object.assign({}, (R.part || {}).programmes, (p.rates || {}).programmes);
    const classRate = (p.rates || {}).classRate ?? (R.part || {}).classRate;
    let rate, why;
    if (s.programme && progs[s.programme] && progs[s.programme][s.mode] != null) { rate = progs[s.programme][s.mode]; why = s.programme; }
    else if (s.kind === "class" && classRate != null) { rate = classRate; why = "class"; }
    else { rate = amt(rates[s.mode], `Part-time rate (${s.mode})`); why = s.mode; }
    const value = round(rate * per * t.frac), extra = isWeekend(s.day) ? "weekend" : after(s) ? "after hours" : "";
    const line = { kind: "session", label, note: why + (per > 1 ? " · double" : "") + (extra ? " · " + extra + ", on top of the cap" : "") + short, amount: value, sid: s.id };
    if (extra) lines.push(line); else { capped += value; capLines.push(line); lines.push(line); }
  }
  /* the cap: normal part-time sessions above it are trimmed in one line, so every session still shows */
  const cap = R.cap == null ? null : Number(R.cap);
  if (cap != null && capped > cap) lines.push({ kind: "cap", label: `Monthly cap of ${cap.toLocaleString("en-GB")} on normal sessions`, amount: -(capped - cap) });
  /* full-timers' weekend allowances, per weekend day by hours taught */
  for (const [d, h] of [...weekendHours].sort()) {
    ((R.full || {}).weekend || []).filter(b => h >= (b.minHours || 0)).forEach(b => lines.push({ kind: "allowance", label: `${b.label} · ${d} (${round1(h)} h)`, amount: amt(b.amount, `Weekend ${b.label}`) }));
  }
  /* one-off items */
  items.filter(i => !i.del && i.month === month).forEach(i => lines.push({ kind: i.kind, label: i.label, amount: ["deduction", "advance"].includes(i.kind) ? -Number(i.amount) : Number(i.amount) }));
  const takenOff = l => l.kind === "deduction" || l.kind === "advance";
  const gross = round(lines.filter(l => !takenOff(l)).reduce((a, l) => a + l.amount, 0));   // the cap trims gross: it isn't a deduction
  const off = round(lines.filter(takenOff).reduce((a, l) => a - l.amount, 0)) + 0;
  return { month, lines, gross, off, net: round(gross - off), missing: [...missing] };
}
const round = n => Math.round(n);
const round1 = n => Math.round(n * 10) / 10;
