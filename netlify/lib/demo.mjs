/* Made-up people and records for a preview (the test copy), matching the accounts mockup: Linga, Tadala, Chisomo's
   students, Grace (Linga's parent), five tutors. Never runs on the live site (see v2.mjs). Everything goes in through the
   same commands the app uses, as the person who would really do it, so the demo also proves the commands work.
   Dates are worked out from today, so the demo always looks current. */
import { one } from "./db.mjs";
import { writeTx, run } from "./records.mjs";
import { addDays, weekday } from "../../site/shared/calc.mjs";

const today = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);   // Lilongwe

/* in steps, so each request finishes well inside Netlify's time limit: 0 = people, students, groups, timetable;
   1-3 = one week of Chisomo's sessions each; 4 = confirmations, a make-up, requisitions, settings, pay. Call with step = next until more is false. */
const NAMES = { adm: "Catherine Mkwinda", chi: "Chisomo Banda", emm: "Emmanuel Mkumbwa", dic: "Dickson Phiri", may: "Mayamiko Goliati", mau: "Maureen Story", grace: "Grace Phiri",
  p_lin: "Linga Phiri", p_tad: "Tadala Chirwa", p_kka: "Kondwani Kalua", p_nat: "Natasha Banda", p_kkp: "Kondwani Kapalamula", p_lus: "Lusungu Nyirenda" };
export async function seedDemo(dir, step = 0) {
  if (await one("SELECT 1 FROM settings WHERE key = 'demo'")) return { ok: true, already: true };
  const T0 = today(), start = addDays(T0, -28), end = addDays(T0, 28);
  const P = {}, S = {}, G = {};
  if (step > 0) {   /* find what step 0 made */
    for (const [k, n] of Object.entries(NAMES)) P[k] = await one("SELECT * FROM people WHERE name = $1 ORDER BY created_at DESC LIMIT 1", [n]);
    for (const k of ["lin", "tad", "kka", "nat", "kkp", "lus"]) S[k] = (await one("SELECT id FROM students WHERE person_id = $1", [P["p_" + k].id])).id;
    const gq = async (tutor, subject, extra = "") => (await one(`SELECT id FROM groups WHERE tutor_id = $1 AND subject = $2 ${extra} ORDER BY created_at DESC LIMIT 1`, [P[tutor].id, subject])).id;
    Object.assign(G, { lin_p1: await gq("chi", "Pure Maths 1", "AND mode = 'in person'"), kka_im: await gq("chi", "IGCSE Maths", "AND kind = 'one'"), y10: await gq("chi", "IGCSE Maths", "AND kind = 'class'"), lus_p1: await gq("chi", "Pure Maths 1", "AND mode = 'online'") });
    if (step <= 3) return Object.assign(await weekOf(P, S, G, T0, step), { ok: true, step, more: true, next: step + 1 });
    return finish(dir, P, S, G, T0, start);
  }
  const person = async (key, name, role, extra = {}) => { const r = await run(dir, "person.save", Object.assign({ name, role }, extra)); P[key] = await one("SELECT * FROM people WHERE id = $1", [r.id]); };
  await person("adm", "Catherine Mkwinda", "admin", { also_tutor: true });
  for (const [k, n] of [["chi", "Chisomo Banda"], ["emm", "Emmanuel Mkumbwa"], ["dic", "Dickson Phiri"], ["may", "Mayamiko Goliati"], ["mau", "Maureen Story"]]) await person(k, n, "tutor");
  const student = async (key, name, level, extra = {}) => { await person("p_" + key, name, "student"); const r = await run(dir, "student.save", Object.assign({ name, level, person_id: P["p_" + key].id }, extra)); S[key] = r.id; };
  await student("lin", "Linga Phiri", "Year 12 · AS Level", { school: "Bishop Mackenzie International School" });
  await student("tad", "Tadala Chirwa", "Year 10 · IGCSE");
  await student("kka", "Kondwani Kalua", "Year 11 · IGCSE");
  await student("nat", "Natasha Banda", "Year 10 · IGCSE");
  await student("kkp", "Kondwani Kapalamula", "Year 10 · IGCSE");
  await student("lus", "Lusungu Nyirenda", "Year 12 · AS Level");
  await person("grace", "Grace Phiri", "parent", { email: "grace.phiri@example.com" });
  await run(dir, "guardian.link", { parent_id: P.grace.id, student_id: S.lin });

  const per = {};
  for (const k of Object.keys(S)) per[k] = (await run(dir, "period.save", k === "tad" ? { student_id: S[k], kind: "holiday", starts: addDays(T0, -17), ends: addDays(T0, -6), fee: 180000 } : { student_id: S[k], starts: start, ends: end, fee: 540000 })).id;
  const group = async (key, tutor, subject, students, days, from, to, extra = {}) => {
    G[key] = (await run(dir, "group.save", Object.assign({ tutor_id: P[tutor].id, subject }, extra))).id;
    await run(dir, "group.students", { group_id: G[key], add: students.map(s => ({ student_id: S[s], period_id: per[s] })) });
    const s0 = students[0] === "tad" ? addDays(T0, -17) : start, e0 = students[0] === "tad" ? addDays(T0, -6) : end;
    for (const d of days) await run(dir, "slot.save", { group_id: G[key], weekday: d, starts: from, ends: to, from_date: s0, to_date: e0 });
  };
  await group("lin_p1", "chi", "Pure Maths 1", ["lin"], [2, 4], "16:00", "16:50");
  await group("lin_ch", "emm", "Chemistry", ["lin"], [2, 4], "14:00", "14:50");
  await group("lin_ph", "dic", "Physics", ["lin"], [6], "09:00", "10:40");
  await group("kka_im", "chi", "IGCSE Maths", ["kka"], [1, 3], "14:00", "14:50");
  await group("y10", "chi", "IGCSE Maths", ["nat", "kkp"], [2, 3, 4], "15:00", "15:50", { kind: "class", name: "Year 10 Maths group" });
  await group("lus_p1", "chi", "Pure Maths 1", ["lus"], [3, 5], "16:00", "16:50", { mode: "online" });
  await group("tad_ma", "may", "IGCSE Maths", ["tad"], [1, 2, 3, 4, 5], "09:00", "09:45", { programme: "Holiday Tuition" });
  await group("tad_bi", "mau", "Biology", ["tad"], [1, 3, 5], "10:00", "10:45", { programme: "Holiday Tuition" });

  return { ok: true, step: 0, more: true, next: 1, people: Object.keys(P).length, students: Object.keys(S).length, groups: Object.keys(G).length };
}

/* one of the last three weeks of Chisomo's sessions, logged by Chisomo: mostly taught, a few absences, a short session */
async function weekOf(P, S, G, T0, week) {
  const chi = P.chi, topics = { lin_p1: ["Quadratics", "Functions", "Coordinate geometry", "Circular measure", "Trigonometry"], kka_im: ["Number", "Algebra", "Sequences"], y10: ["Ratio and proportion", "Fractions"], lus_p1: ["Functions", "Series"] };
  const slots = { lin_p1: [[2, 4], "16:00", "16:50", ["lin"]], kka_im: [[1, 3], "14:00", "14:50", ["kka"]], y10: [[2, 3, 4], "15:00", "15:50", ["nat", "kkp"]], lus_p1: [[3, 5], "16:00", "16:50", ["lus"]] };
  let n = (week - 1) * 12, made = 0; const seen = new Set();
  for (let d = addDays(T0, -21 + (week - 1) * 7); d < addDays(T0, -21 + week * 7) && d < T0; d = addDays(d, 1)) {
    for (const [g, [days, a, b, st]] of Object.entries(slots)) {
      if (!days.includes(weekday(d))) continue;
      n++; made++;
      const tp = topics[g][Math.floor(n / 5) % topics[g].length], absent = !seen.has(g) && ((g === "kka_im" && week !== 3) || (g === "y10" && week === 3)); seen.add(g);   // Kondwani K. misses one a week (weeks 1–2), Natasha one in week 3
      await run(chi, "session.log", { group_id: G[g], day: d, plan_start: a, plan_end: b, status: "done", topics: [tp], finished: n % 5 === 0 ? [tp] : [],
        actual_start: n % 11 === 0 ? addMin(a, 10) : a, actual_end: b, attendance: st.map((s, i) => ({ student_id: S[s], present: absent && i === 0 ? "absent" : "present" })) });
    }
  }
  return { sessions: made };
}

async function finish(dir, P, S, G, T0, start) {
  const chi = P.chi;
  /* Linga confirms most of her sessions, and says one isn't right */
  const linP = P.p_lin, att = await writeTx(T => T.q("SELECT a.id FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE a.student_id = $1 ORDER BY s.day", [S.lin]));
  for (let i = 0; i < att.length; i++) {
    if (i === att.length - 1) await run(linP, "attendance.dispute", { id: att[i].id, note: "We started 15 minutes late" });
    else await run(linP, "attendance.confirm", { id: att[i].id });
  }
  /* a make-up booked by Chisomo, waiting for Admin */
  const owed = await one("SELECT id FROM makeups WHERE student_id = $1 AND status = 'owed' AND NOT del LIMIT 1", [S.kka]);
  if (owed) await run(chi, "makeup.book", { id: owed.id, day: addDays(T0, 2), starts: "11:00", ends: "11:50" });
  /* requisitions */
  await run(P.emm, "requisition.add", { item: "Lab goggles", qty: "6", needed_by: addDays(T0, 4), why: "Practical on rates of reaction" });
  await run(P.dic, "requisition.add", { item: "Physics past papers, May/June 2023", qty: "3", needed_by: addDays(T0, 2), why: "Saturday double with Linga" });
  /* LHQ settings and pay: amounts LHQ hasn't given yet stay empty, so the payslip shows "not set" instead of a made-up number */
  await run(dir, "settings.set", { key: "session_lengths", value: { term: 50, holiday: 45 } });
  await run(dir, "settings.set", { key: "time_zone", value: "Africa/Blantyre" });
  await run(dir, "settings.set", { key: "pay_rules", value: { cap: 350000, afterHours: "17:00", weekendDays: [0, 6],
    part: { rates: { "in person": 8000, online: 7000 }, classRate: null, programmes: {} },
    full: { afterHoursFee: null, afterHoursPer: "session", weekend: [{ minHours: 0, label: "Transport", amount: null }, { minHours: 6, label: "Lunch", amount: null }] } } });
  await run(dir, "pay.profile.save", { tutor_id: chi.id, placement: "full", starts: addDays(start, -60), salary: 350000 });
  for (const k of ["emm", "dic", "may", "mau"]) await run(dir, "pay.profile.save", { tutor_id: P[k].id, placement: "part", starts: addDays(start, -60) });
  await run(dir, "settings.set", { key: "demo", value: { at: T0 } });
  return { ok: true, step: 4, more: false, next: null, sessions: (await one("SELECT count(*)::int n FROM sessions")).n };
}
const addMin = (t, m) => { const x = +t.slice(0, 2) * 60 + +t.slice(3, 5) + m; return String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0"); };
