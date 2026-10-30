/* Every change to the shared records is a named command. Each one checks who may do it, changes the rows in one
   transaction and leaves a line in the activity log. The app never writes rows directly.
   A handler gets (T, me, a): T = the open transaction, me = the signed-in person, a = the arguments.
   It returns {out, log}: out goes back to the app, log becomes the activity line ({summary, area?, entity?, id?, data?}). */
import { newId } from "./db.mjs";
import { isDir, isStaff, can, teaches, canPay } from "./access.mjs";
import { pay as calcPay, addDays, monthOf, daysIn } from "../../site/shared/calc.mjs";

export class Refused extends Error { constructor(msg, status = 403) { super(msg); this.status = status; } }
const no = (msg, status = 403) => { throw new Refused(msg, status); };
const need = (ok, msg = "You can't do that.") => { if (!ok) no(msg); };
const str = (v, max = 200) => v == null ? null : String(v).trim().slice(0, max) || null;
const date = v => { const s = String(v || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) no("A date is missing or isn't a date.", 400); return s; };
const time = v => { const s = String(v || ""); if (!/^\d{2}:\d{2}$/.test(s)) no("A time is missing or isn't a time (HH:MM).", 400); return s; };
const num = (v, msg = "A number is missing.") => { const n = Number(v); if (v === "" || v == null || !isFinite(n)) no(msg, 400); return n; };
const oneOf = (v, list, msg) => { if (!list.includes(v)) no(msg || "That choice isn't allowed.", 400); return v; };
const ids = v => (Array.isArray(v) ? v : []).map(String);
export const nk = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/* the SRA schedule (agreed): the learning day, then 1, 3, 7, 14 days and a month later */
export const SRA_GAPS = [0, 1, 3, 7, 14, 30];

/* ---------- lookups used for permission checks ---------- */
const groupOf = async (T, id) => (await T.one("SELECT * FROM groups WHERE id = $1 AND NOT del", [id])) || no("That group doesn't exist.", 404);
const myStudentIds = async (T, me) => (await T.q("SELECT id FROM students WHERE person_id = $1 AND NOT del UNION SELECT student_id AS id FROM guardians WHERE parent_id = $1 AND NOT del", [me.id])).map(r => r.id);
const tutorOf = (me, g) => isStaff(me) || (teaches(me) && g.tutor_id === me.id);
const mustTeach = (me, g) => need(tutorOf(me, g), "Only the group's tutor (or LHQ Admin) can do that.");
async function teachesStudent(T, me, sid) {
  if (isStaff(me)) return true;
  return !!(await T.one("SELECT 1 FROM group_students gs JOIN groups g ON g.id = gs.group_id WHERE gs.student_id = $1 AND g.tutor_id = $2 AND NOT gs.del AND NOT g.del", [sid, me.id]));
}
/* update with the version the app last saw: if someone changed it since, refuse instead of overwriting */
async function upd(T, table, id, ver, set) {
  const keys = Object.keys(set), vals = keys.map(k => set[k]);
  const sql = `UPDATE ${table} SET ${keys.map((k, i) => `${k} = $${i + 3}`).join(", ")} WHERE id = $1${ver != null ? ` AND ver = $2` : ` AND $2::int IS NULL`} RETURNING *`;
  const r = await T.one(sql, [id, ver == null ? null : Number(ver), ...vals.map(v => v !== null && typeof v === "object" ? JSON.stringify(v) : v)]);
  if (!r) { const cur = await T.one(`SELECT ver FROM ${table} WHERE id = $1`, [id]); no(cur ? "Someone changed this while you were editing. It has been reloaded: check it and save again." : "That record doesn't exist.", cur ? 409 : 404); }
  return r;
}
async function ins(T, table, row) {
  row.id = row.id || newId(table.slice(0, 2));
  const keys = Object.keys(row);
  return T.one(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => "$" + (i + 1)).join(", ")}) RETURNING *`, keys.map(k => row[k] !== null && typeof row[k] === "object" ? JSON.stringify(row[k]) : row[k]));
}
const sname = async (T, id) => ((await T.one("SELECT name FROM students WHERE id = $1", [id])) || {}).name || "a student";
const pname = async (T, id) => ((await T.one("SELECT name FROM people WHERE id = $1", [id])) || {}).name || "someone";

/* ---------- the commands ---------- */
export const COMMANDS = {

  /* ===== people and students (LHQ) ===== */
  async "person.save"(T, me, a) {
    const role = oneOf(a.role, ["director", "admin", "tutor", "student", "parent", "bdo"], "Unknown role.");
    need(["admin", "bdo", "director"].includes(role) ? isDir(me) : (can(me, "tutors") || can(me, "students")), "Only Wanangwa can add or change Admin, BDO and Director accounts.");
    const name = str(a.name, 80) || no("Add the person's name.", 400);
    const row = { name, role, email: str(a.email, 120), phone: str(a.phone, 30), also_tutor: !!a.also_tutor && ["admin", "director"].includes(role) };
    if (role === "admin") row.perms = Array.isArray(a.perms) ? a.perms.map(String) : ["quotes", "receipts", "cards", "delete", "restore", "students", "tutors", "msgs", "classes", "spend"];
    let r;
    if (a.id && await T.one("SELECT 1 FROM people WHERE id = $1", [a.id])) r = await upd(T, "people", a.id, a.ver, row);
    else r = await ins(T, "people", Object.assign({ id: a.id || undefined, username: await freeUsername(T, name) }, row));
    return { out: { id: r.id, username: r.username }, log: { summary: `${a.id ? "Changed" : "Added"} ${name} (${role})`, entity: "people", id: r.id, area: "people" } };
  },
  async "student.save"(T, me, a) {
    need(can(me, "students") || can(me, "cards"), "Only LHQ Admin can add or change students.");
    const name = str(a.name, 80) || no("Add the student's name.", 400);
    const row = { name, level: str(a.level), school: str(a.school), exam: str(a.exam), info: a.info && typeof a.info === "object" ? a.info : {} };
    if (a.person_id !== undefined) row.person_id = a.person_id || null;
    let r;
    if (a.id) r = await upd(T, "students", a.id, a.ver, row);
    else { const key = nk(a.key || name); if (await T.one("SELECT 1 FROM students WHERE key = $1", [key])) no("There is already a student with that name. Add a second name or initial.", 409); r = await ins(T, "students", Object.assign({ key }, row)); }
    return { out: { id: r.id }, log: { summary: `${a.id ? "Changed" : "Added"} student ${name}`, entity: "students", id: r.id } };
  },
  async "guardian.link"(T, me, a) {
    need(can(me, "students"), "Only LHQ Admin can link parents.");
    const p = await T.one("SELECT * FROM people WHERE id = $1 AND role = 'parent'", [a.parent_id]) || no("That parent account doesn't exist.", 404);
    const cur = await T.one("SELECT * FROM guardians WHERE parent_id = $1 AND student_id = $2", [a.parent_id, a.student_id]);
    if (cur) await upd(T, "guardians", cur.id, null, { del: !!a.remove });
    else if (!a.remove) await ins(T, "guardians", { parent_id: a.parent_id, student_id: a.student_id });
    return { out: { ok: true }, log: { summary: `${a.remove ? "Unlinked" : "Linked"} ${p.name} ${a.remove ? "from" : "to"} ${await sname(T, a.student_id)}`, entity: "guardians" } };
  },
  async "period.save"(T, me, a) {
    need(can(me, "students") || can(me, "cards"), "Only LHQ Admin can set tuition periods.");
    const row = { student_id: a.student_id, kind: oneOf(a.kind || "term", ["term", "holiday", "programme"]), programme: str(a.programme), starts: date(a.starts), ends: date(a.ends), invoice_id: str(a.invoice_id), card_id: str(a.card_id) };
    if (row.ends < row.starts) no("The period ends before it starts.", 400);
    if (a.fee !== undefined) { need(can(me, "quotes") || can(me, "money"), "You can't set fees."); row.fee = a.fee === null ? null : num(a.fee); }
    const r = a.id ? await upd(T, "periods", a.id, a.ver, row) : await ins(T, "periods", row);
    return { out: { id: r.id }, log: { summary: `Tuition period ${row.starts} to ${row.ends} for ${await sname(T, row.student_id)}`, entity: "periods", id: r.id } };
  },

  /* ===== teaching groups and the timetable ===== */
  async "group.save"(T, me, a) {
    const tutor = a.tutor_id || (teaches(me) && !isStaff(me) ? me.id : null);
    need(isStaff(me) ? (can(me, "classes") || can(me, "cards")) : (teaches(me) && tutor === me.id), "Only LHQ Admin, or the tutor for their own class, can do that.");
    if (a.id && !isStaff(me)) mustTeach(me, await groupOf(T, a.id));
    const row = { tutor_id: tutor, kind: oneOf(a.kind || "one", ["one", "class"]), name: str(a.name, 60), subject: str(a.subject, 60) || no("Add the subject.", 400),
      mode: oneOf(a.mode || "in person", ["in person", "online"]), programme: str(a.programme, 60), topics: Array.isArray(a.topics) ? a.topics.map(x => String(x).slice(0, 120)) : [] };
    if (row.kind === "class" && !row.name) no("Give the class a name.", 400);
    const r = a.id ? await upd(T, "groups", a.id, a.ver, row) : await ins(T, "groups", row);
    return { out: { id: r.id }, log: { summary: `${a.id ? "Changed" : "Set up"} ${row.kind === "class" ? "class " + row.name : row.subject + " one-to-one"} (${await pname(T, tutor)})`, entity: "groups", id: r.id } };
  },
  async "group.students"(T, me, a) {
    const g = await groupOf(T, a.group_id); mustTeach(me, g);
    for (const x of a.add || []) {
      need(await teachesStudent(T, me, x.student_id) || isStaff(me), "You can only add your own students. LHQ Admin places new students.");
      const cur = await T.one("SELECT * FROM group_students WHERE group_id = $1 AND student_id = $2", [g.id, x.student_id]);
      const row = { del: false, period_id: x.period_id || null, target: str(x.target, 10) };
      if (cur) await upd(T, "group_students", cur.id, null, row); else await ins(T, "group_students", Object.assign({ group_id: g.id, student_id: x.student_id }, row));
    }
    for (const sid of ids(a.remove)) { const cur = await T.one("SELECT * FROM group_students WHERE group_id = $1 AND student_id = $2", [g.id, sid]); if (cur) await upd(T, "group_students", cur.id, null, { del: true }); }
    return { out: { ok: true }, log: { summary: `Changed who is in ${g.name || g.subject}`, entity: "groups", id: g.id } };
  },
  async "slot.save"(T, me, a) {
    const g = await groupOf(T, a.group_id); mustTeach(me, g);
    const row = { group_id: g.id, weekday: num(a.weekday), starts: time(a.starts), ends: time(a.ends), per: a.per === 2 ? 2 : 1, from_date: date(a.from_date), to_date: date(a.to_date), del: !!a.del };
    if (row.weekday < 0 || row.weekday > 6 || row.ends <= row.starts) no("Check the day and the times.", 400);
    const r = a.id ? await upd(T, "slots", a.id, a.ver, row) : await ins(T, "slots", row);
    return { out: { id: r.id }, log: { summary: `${row.del ? "Removed" : "Set"} a timetable slot for ${g.name || g.subject}`, entity: "slots", id: r.id } };
  },
  async "settings.set"(T, me, a) {
    const key = str(a.key, 40) || no("Which setting?", 400), scope = key === "pay_rules" ? "pay" : (a.scope === "staff" ? "staff" : "all");
    need(scope === "pay" ? canPay(me) : isDir(me) || (isStaff(me) && ["terms", "closed"].includes(key)), "Only Wanangwa can change that setting.");
    const cur = await T.one("SELECT * FROM settings WHERE key = $1", [key]);
    const value = JSON.stringify(a.value === undefined ? null : a.value);   // jsonb: a plain text or number value must be sent as JSON too
    if (cur) await upd(T, "settings", cur.id, a.ver ?? null, { value, scope }); else await ins(T, "settings", { key, scope, value });
    return { out: { ok: true }, log: { summary: `Changed the setting "${key}"`, entity: "settings", area: scope === "pay" ? "pay" : "teaching" } };
  },

  /* ===== a session: the tutor logs it, each student confirms it ===== */
  async "session.log"(T, me, a) {
    const g = await groupOf(T, a.group_id); mustTeach(me, g);
    const status = oneOf(a.status || "done", ["done", "missed", "cancelled"], "A session is taught, missed or cancelled.");
    if (status === "cancelled") need(isStaff(me), "Only LHQ cancels a session. A tutor who can't come logs it as missed.");
    const day = date(a.day), row = { group_id: g.id, day, plan_start: time(a.plan_start), plan_end: time(a.plan_end), per: a.per === 2 ? 2 : 1, status,
      reason: str(a.reason), actual_start: a.actual_start ? time(a.actual_start) : null, actual_end: a.actual_end ? time(a.actual_end) : null,
      topics: (a.topics || []).map(String), finished: (a.finished || []).map(String), note: str(a.note, 1000), makeup_id: a.makeup_id || null, logged_by: me.id, logged_at: new Date().toISOString() };
    const members = (await T.q("SELECT student_id FROM group_students WHERE group_id = $1 AND NOT del", [g.id])).map(r => r.student_id);
    const cur = a.id ? await T.one("SELECT * FROM sessions WHERE id = $1", [a.id]) : await T.one("SELECT * FROM sessions WHERE group_id = $1 AND day = $2 AND plan_start = $3 AND NOT del", [g.id, day, row.plan_start]);
    const s = cur ? await upd(T, "sessions", cur.id, a.ver ?? null, row) : await ins(T, "sessions", Object.assign({ id: a.id || undefined }, row));
    const given = new Map((a.attendance || []).map(x => [x.student_id, oneOf(x.present || "present", ["present", "late", "absent"])]));
    const who = row.makeup_id ? [(await T.one("SELECT student_id FROM makeups WHERE id = $1", [row.makeup_id]) || no("That make-up doesn't exist.", 404)).student_id] : members;
    for (const sid of who) {
      const present = status === "done" ? (given.get(sid) || "present") : "absent";
      const att = await T.one("SELECT * FROM attendance WHERE session_id = $1 AND student_id = $2", [s.id, sid]);
      if (att) {
        const changed = att.present !== present;
        await upd(T, "attendance", att.id, null, { present, del: false, confirm: att.confirm === "disputed" && changed ? "fixed" : changed ? "pending" : att.confirm });
      } else await ins(T, "attendance", { session_id: s.id, student_id: sid, present });
      /* make-ups: any missed session is owed, whoever missed it (agreed); logging it as taught takes the debt away again */
      const owed = await T.one("SELECT * FROM makeups WHERE owed_session_id = $1 AND student_id = $2 AND NOT del", [s.id, sid]);
      if (present === "absent" && !row.makeup_id && !owed) await ins(T, "makeups", { student_id: sid, group_id: g.id, owed_session_id: s.id, per: row.per, why: status === "cancelled" ? "LHQ cancelled" : status === "missed" ? (row.reason || "Missed") : "Absent" });
      if (present !== "absent" && owed && owed.status === "owed") await upd(T, "makeups", owed.id, null, { del: true });
    }
    if (row.makeup_id && status === "done") { const m = await T.one("SELECT * FROM makeups WHERE id = $1", [row.makeup_id]); await upd(T, "makeups", m.id, null, { status: "done", made_up_session_id: s.id }); }
    /* topics finished today start the SRA schedule for every student who was there */
    if (status === "done") for (const topic of row.finished) for (const sid of who) {
      if ((given.get(sid) || "present") === "absent") continue;
      for (let i = 0; i < SRA_GAPS.length; i++) {
        if (await T.one("SELECT 1 FROM sras WHERE student_id = $1 AND group_id = $2 AND topic = $3 AND review = $4", [sid, g.id, topic, i])) continue;
        await ins(T, "sras", { student_id: sid, group_id: g.id, topic, review: i, due: addDays(day, SRA_GAPS[i]) });
      }
    }
    return { out: { id: s.id }, log: { summary: `${status === "done" ? "Logged" : status === "missed" ? "Logged as missed" : "Cancelled"}: ${g.name || g.subject} on ${day} ${row.plan_start}`, entity: "sessions", id: s.id } };
  },
  async "attendance.confirm"(T, me, a) {
    const att = await T.one("SELECT * FROM attendance WHERE id = $1", [a.id]) || no("Not found.", 404);
    need((await myStudentIds(T, me)).includes(att.student_id) && me.role === "student", "Only the student confirms their own session.");
    if (!["pending", "fixed"].includes(att.confirm)) no("This one is already answered.", 409);
    await upd(T, "attendance", att.id, null, { confirm: "confirmed" });
    return { out: { ok: true }, log: { summary: `${await sname(T, att.student_id)} confirmed a session`, entity: "attendance", id: att.id } };
  },
  async "attendance.dispute"(T, me, a) {
    const att = await T.one("SELECT * FROM attendance WHERE id = $1", [a.id]) || no("Not found.", 404);
    need((await myStudentIds(T, me)).includes(att.student_id) && me.role === "student", "Only the student can say what was wrong.");
    const note = str(a.note, 500) || no("Say what was wrong, so your tutor can fix it.", 400);
    await upd(T, "attendance", att.id, null, { confirm: "disputed", dispute_note: note });
    return { out: { ok: true }, log: { summary: `${await sname(T, att.student_id)} said a session log isn't right: "${note}"`, entity: "attendance", id: att.id } };
  },
  /* the tutor answers: fix the log (then log the session again), or keep it, which sends it to Admin to settle */
  async "attendance.answer"(T, me, a) {
    const att = await T.one("SELECT a.*, s.group_id FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE a.id = $1", [a.id]) || no("Not found.", 404);
    mustTeach(me, await groupOf(T, att.group_id));
    if (att.confirm !== "disputed") no("There is nothing to answer here.", 409);
    await upd(T, "attendance", att.id, null, { confirm: a.keep ? "kept" : "fixed", tutor_note: str(a.note, 500) });
    return { out: { ok: true }, log: { summary: a.keep ? `Tutor kept their log for ${await sname(T, att.student_id)}: sent to Admin to settle` : `Tutor corrected the log for ${await sname(T, att.student_id)}`, entity: "attendance", id: att.id } };
  },
  async "attendance.settle"(T, me, a) {
    need(isStaff(me), "Only LHQ Admin settles differences.");
    const att = await T.one("SELECT a.*, s.group_id, s.per FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE a.id = $1", [a.id]) || no("Not found.", 404);
    const present = a.present ? oneOf(a.present, ["present", "late", "absent"]) : att.present;
    await upd(T, "attendance", att.id, null, { confirm: "settled", present, settle_note: str(a.note, 500), settled_by: me.id });
    const owed = await T.one("SELECT * FROM makeups WHERE owed_session_id = $1 AND student_id = $2 AND NOT del", [att.session_id, att.student_id]);
    if (present === "absent" && !owed) await ins(T, "makeups", { student_id: att.student_id, group_id: att.group_id, owed_session_id: att.session_id, per: att.per, why: "Settled by LHQ" });
    if (present !== "absent" && owed && owed.status === "owed") await upd(T, "makeups", owed.id, null, { del: true });
    return { out: { ok: true }, log: { summary: `Settled ${await sname(T, att.student_id)}'s session: ${present}${a.note ? ` ("${str(a.note, 120)}")` : ""}`, entity: "attendance", id: att.id } };
  },

  /* ===== make-ups: the tutor books, Admin confirms (the Director can step in) ===== */
  async "makeup.book"(T, me, a) {
    const m = await T.one("SELECT * FROM makeups WHERE id = $1 AND NOT del", [a.id]) || no("That make-up doesn't exist.", 404);
    mustTeach(me, await groupOf(T, m.group_id));
    if (!["owed", "declined", "booked"].includes(m.status)) no("This make-up is already settled.", 409);
    await upd(T, "makeups", m.id, null, { status: "booked", day: date(a.day), starts: time(a.starts), ends: time(a.ends), booked_by: me.id });
    return { out: { ok: true }, log: { summary: `Booked a make-up for ${await sname(T, m.student_id)} on ${a.day} ${a.starts}: waiting for Admin`, entity: "makeups", id: m.id } };
  },
  async "makeup.decide"(T, me, a) {
    need(isStaff(me), "Admin confirms make-ups.");
    const m = await T.one("SELECT * FROM makeups WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    if (m.status !== "booked") no("This make-up isn't waiting for a decision.", 409);
    await upd(T, "makeups", m.id, null, { status: a.ok ? "confirmed" : "declined", decided_by: me.id, decide_note: str(a.note, 300) });
    return { out: { ok: true }, log: { summary: `${a.ok ? "Confirmed" : "Declined"} ${await sname(T, m.student_id)}'s make-up on ${m.day}`, entity: "makeups", id: m.id } };
  },
  async "makeup.waive"(T, me, a) {
    need(isStaff(me), "Only LHQ can decide a make-up isn't owed.");
    const m = await T.one("SELECT * FROM makeups WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    await upd(T, "makeups", m.id, null, { status: "waived", decided_by: me.id, decide_note: str(a.note, 300) || no("Say why it isn't owed.", 400) });
    return { out: { ok: true }, log: { summary: `Make-up not owed for ${await sname(T, m.student_id)}: ${a.note}`, entity: "makeups", id: m.id } };
  },

  /* ===== SRAs, assessments ===== */
  async "sra.update"(T, me, a) {
    const x = await T.one("SELECT * FROM sras WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    mustTeach(me, await groupOf(T, x.group_id));
    const set = { status: oneOf(a.status, ["due", "given", "in", "marked", "missed", "moved"]) };
    if (a.back) set.back = date(a.back);
    if (a.due) set.due = date(a.due);
    if (set.status === "marked") { set.score = num(a.score, "Add the score."); set.out_of = num(a.out_of, "Add what it's out of."); set.self_marked = false; set.marked_by = me.id; }
    await upd(T, "sras", x.id, a.ver ?? null, set);
    return { out: { ok: true }, log: { summary: `SRA ${x.topic} review ${x.review} for ${await sname(T, x.student_id)}: ${set.status}${set.score != null ? ` ${set.score}/${set.out_of}` : ""}`, entity: "sras", id: x.id } };
  },
  async "sra.self"(T, me, a) {
    const x = await T.one("SELECT * FROM sras WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    need(me.role === "student" && (await myStudentIds(T, me)).includes(x.student_id), "Only the student marks their own.");
    if (x.status === "marked" && !x.self_marked) no("Your tutor has already marked this one.", 409);
    await upd(T, "sras", x.id, null, { status: "marked", self_marked: true, score: num(a.score), out_of: num(a.out_of) });
    return { out: { ok: true }, log: { summary: `Self-marked SRA ${x.topic} review ${x.review}`, entity: "sras", id: x.id } };
  },
  async "assessment.save"(T, me, a) {
    const g = await groupOf(T, a.group_id); mustTeach(me, g);
    const row = { group_id: g.id, day: date(a.day), kind: str(a.kind, 40) || no("What kind of assessment?", 400), topics: (a.topics || []).map(String), out_of: a.out_of == null ? null : num(a.out_of), set_by: me.id, del: !!a.del };
    const r = a.id ? await upd(T, "assessments", a.id, a.ver ?? null, row) : await ins(T, "assessments", row);
    return { out: { id: r.id }, log: { summary: `${a.del ? "Removed" : a.id ? "Changed" : "Scheduled"} ${row.kind} for ${g.name || g.subject} on ${row.day}`, entity: "assessments", id: r.id } };
  },
  async "marks.save"(T, me, a) {
    const as = await T.one("SELECT * FROM assessments WHERE id = $1 AND NOT del", [a.assessment_id]) || no("Not found.", 404);
    mustTeach(me, await groupOf(T, as.group_id));
    for (const m of a.marks || []) {
      const cur = await T.one("SELECT * FROM marks WHERE assessment_id = $1 AND student_id = $2", [as.id, m.student_id]);
      const row = { score: m.absent ? null : num(m.score), absent: !!m.absent };
      if (cur) await upd(T, "marks", cur.id, null, row); else await ins(T, "marks", Object.assign({ assessment_id: as.id, student_id: m.student_id }, row));
    }
    return { out: { ok: true }, log: { summary: `Entered marks for ${as.kind} on ${as.day}`, entity: "assessments", id: as.id } };
  },

  /* ===== requisitions: tutor asks, Director decides, Admin buys ===== */
  async "requisition.add"(T, me, a) {
    need(teaches(me), "Requisitions come from tutors.");
    const r = await ins(T, "requisitions", { tutor_id: me.id, item: str(a.item, 120) || no("What do you need?", 400), qty: str(a.qty, 20), needed_by: a.needed_by ? date(a.needed_by) : null, why: str(a.why, 300) });
    return { out: { id: r.id }, log: { summary: `Asked for ${r.item}${r.qty ? " × " + r.qty : ""}`, entity: "requisitions", id: r.id } };
  },
  async "requisition.decide"(T, me, a) {
    need(isDir(me), "Only Wanangwa approves requisitions.");
    const r = await T.one("SELECT * FROM requisitions WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    if (r.status !== "asked") no("This one is already decided.", 409);
    await upd(T, "requisitions", r.id, null, { status: a.ok ? "approved" : "declined", decided_by: me.id, decide_note: str(a.note, 300) });
    return { out: { ok: true }, log: { summary: `${a.ok ? "Approved" : "Declined"}: ${r.item} (${await pname(T, r.tutor_id)})`, entity: "requisitions", id: r.id } };
  },
  async "requisition.bought"(T, me, a) {
    need(can(me, "spend"), "Recording what it cost needs Spending access.");
    const r = await T.one("SELECT * FROM requisitions WHERE id = $1 AND NOT del", [a.id]) || no("Not found.", 404);
    if (r.status !== "approved") no("Only an approved requisition can be bought.", 409);
    await upd(T, "requisitions", r.id, null, { status: "bought", cost: num(a.cost, "Add what it cost."), bought_by: me.id });
    return { out: { ok: true }, log: { summary: `Bought: ${r.item} for MK ${Number(a.cost).toLocaleString("en-GB")}`, entity: "requisitions", id: r.id, area: "money" } };
  },

  /* ===== calendar events, daily reports, feedback ===== */
  async "event.save"(T, me, a) {
    const audience = oneOf(a.audience || "me", ["me", "shared", "lhq"]);
    if (audience === "lhq") need(isStaff(me), "Only LHQ adds events for everyone.");
    if (a.student_id && !isStaff(me)) need(me.role === "student" || me.role === "parent" ? (await myStudentIds(T, me)).includes(a.student_id) : await teachesStudent(T, me, a.student_id), "That isn't your student.");
    if (a.id) { const cur = await T.one("SELECT * FROM events WHERE id = $1", [a.id]) || no("Not found.", 404); need(cur.owner_id === me.id || (isStaff(me) && cur.audience === "lhq"), "Only whoever added it can change it."); }
    const row = { owner_id: me.id, student_id: a.student_id || null, audience, kind: str(a.kind, 30) || "other", title: str(a.title, 120) || no("Give it a name.", 400), day: date(a.day), at: a.at ? time(a.at) : null, info: a.info && typeof a.info === "object" ? a.info : {}, del: !!a.del };
    const r = a.id ? await upd(T, "events", a.id, a.ver ?? null, row) : await ins(T, "events", row);
    return { out: { id: r.id }, log: { summary: `${row.del ? "Removed" : a.id ? "Changed" : "Added"} "${row.title}" on ${row.day}`, entity: "events", id: r.id } };
  },
  async "report.save"(T, me, a) {
    const kind = oneOf(a.kind, ["tutor", "student"]);
    if (kind === "tutor") need(teaches(me), "Daily reports are for tutors."); else need(me.role === "student", "Only students write their daily report.");
    const sid = kind === "student" ? (await myStudentIds(T, me))[0] : null, day = date(a.day);
    const cur = await T.one("SELECT * FROM reports WHERE author_id = $1 AND kind = $2 AND day = $3", [me.id, kind, day]);
    if (cur && cur.sent_at && !a.edit) no("This report is already sent.", 409);
    const row = { body: a.body && typeof a.body === "object" ? a.body : {}, sent_at: a.send ? new Date().toISOString() : (cur ? cur.sent_at : null) };
    const r = cur ? await upd(T, "reports", cur.id, null, row) : await ins(T, "reports", Object.assign({ author_id: me.id, student_id: sid, kind, day }, row));
    return { out: { id: r.id }, log: a.send ? { summary: `Sent the ${kind === "tutor" ? "daily" : "student"} report for ${day}`, entity: "reports", id: r.id } : null };
  },
  async "feedback.add"(T, me, a) {
    need(me.role === "student", "Feedback comes from students.");
    const sid = (await myStudentIds(T, me))[0] || no("No student record.", 404);
    const s = await T.one("SELECT s.id, g.tutor_id FROM sessions s JOIN groups g ON g.id = s.group_id JOIN attendance at ON at.session_id = s.id AND at.student_id = $2 WHERE s.id = $1", [a.session_id, sid]) || no("That isn't one of your sessions.", 404);
    const rating = a.rating == null ? null : Math.max(1, Math.min(5, Math.round(num(a.rating))));
    await ins(T, "feedback", { student_id: sid, session_id: s.id, tutor_id: s.tutor_id, rating, prepared: a.prepared == null ? null : !!a.prepared, on_time: a.on_time == null ? null : !!a.on_time, note: str(a.note, 500) });
    return { out: { ok: true }, log: null };   // private: not in the activity log
  },

  /* ===== tutor pay ===== */
  async "pay.profile.save"(T, me, a) {
    need(canPay(me), "Only Wanangwa (or Admin with Tutor pay) sets pay.");
    const row = { tutor_id: a.tutor_id, placement: oneOf(a.placement, ["full", "part"], "Full-time or part-time?"), starts: date(a.starts),
      salary: a.salary == null || a.salary === "" ? null : num(a.salary), rates: a.rates && typeof a.rates === "object" ? a.rates : {},
      allowances: Array.isArray(a.allowances) ? a.allowances.map(x => ({ label: String(x.label || "Allowance").slice(0, 40), amount: x.amount == null || x.amount === "" ? null : Number(x.amount) })) : [] };
    const cur = await T.one("SELECT * FROM pay_profiles WHERE tutor_id = $1 AND starts = $2", [row.tutor_id, row.starts]);
    const r = a.id || cur ? await upd(T, "pay_profiles", a.id || cur.id, a.ver ?? null, row) : await ins(T, "pay_profiles", row);
    return { out: { id: r.id }, log: { summary: `${await pname(T, row.tutor_id)}: ${row.placement === "full" ? "full-time" : "part-time"} from ${row.starts}`, entity: "pay_profiles", id: r.id, area: "pay" } };
  },
  async "pay.item.save"(T, me, a) {
    const kind = oneOf(a.kind, ["allowance", "bonus", "deduction", "advance"]);
    need(kind === "bonus" ? isDir(me) : canPay(me), kind === "bonus" ? "Only Wanangwa gives bonuses." : "Only Wanangwa (or Admin with Tutor pay) can do that.");
    const row = { tutor_id: a.tutor_id, month: /^\d{4}-\d{2}$/.test(a.month) ? a.month : no("Which month?", 400), kind, label: str(a.label, 80) || no("Say what it's for.", 400), amount: Math.abs(num(a.amount)), added_by: me.id, del: !!a.del };
    const slip = await T.one("SELECT status FROM payslips WHERE tutor_id = $1 AND month = $2", [row.tutor_id, row.month]);
    if (slip && slip.status !== "draft") no("That month's payslip is already confirmed.", 409);
    const r = a.id ? await upd(T, "pay_items", a.id, a.ver ?? null, row) : await ins(T, "pay_items", row);
    return { out: { id: r.id }, log: { summary: `${row.del ? "Removed" : "Added"} ${kind} "${row.label}" for ${await pname(T, row.tutor_id)} (${row.month})`, entity: "pay_items", id: r.id, area: "pay" } };
  },
  async "payslip.draft"(T, me, a) {
    need(canPay(me), "Only Wanangwa (or Admin with Tutor pay) works out pay.");
    const month = /^\d{4}-\d{2}$/.test(a.month) ? a.month : no("Which month?", 400);
    const cur = await T.one("SELECT * FROM payslips WHERE tutor_id = $1 AND month = $2", [a.tutor_id, month]);
    if (cur && cur.status !== "draft") no("That payslip is already confirmed.", 409);
    const p = await payFor(T, a.tutor_id, month);
    const row = { lines: p.lines, gross: p.gross, off: p.off, net: p.net };
    const r = cur ? await upd(T, "payslips", cur.id, null, row) : await ins(T, "payslips", Object.assign({ tutor_id: a.tutor_id, month }, row));
    return { out: { id: r.id, missing: p.missing, net: p.net }, log: { summary: `Worked out ${await pname(T, a.tutor_id)}'s pay for ${month}: MK ${p.net.toLocaleString("en-GB")}`, entity: "payslips", id: r.id, area: "pay" } };
  },
  async "payslip.confirm"(T, me, a) {
    need(canPay(me), "Only Wanangwa (or Admin with Tutor pay) confirms pay.");
    const s = await T.one("SELECT * FROM payslips WHERE id = $1", [a.id]) || no("Not found.", 404);
    if (s.status !== "draft") no("Already confirmed.", 409);
    const p = await payFor(T, s.tutor_id, s.month);
    if (p.missing.length) no("Some amounts aren't set yet: " + p.missing.join(", ") + ".", 400);
    await upd(T, "payslips", s.id, null, { lines: p.lines, gross: p.gross, off: p.off, net: p.net, status: "confirmed", confirmed_by: me.id, confirmed_at: new Date().toISOString() });
    return { out: { ok: true }, log: { summary: `Confirmed ${await pname(T, s.tutor_id)}'s payslip for ${s.month}: MK ${p.net.toLocaleString("en-GB")}`, entity: "payslips", id: s.id, area: "pay" } };
  },
  async "payslip.sign"(T, me, a) {
    const s = await T.one("SELECT * FROM payslips WHERE id = $1", [a.id]) || no("Not found.", 404);
    need(s.tutor_id === me.id, "Only the tutor signs their own payslip.");
    if (s.status !== "confirmed") no(s.status === "signed" ? "Already signed." : "This payslip isn't confirmed yet.", 409);
    await upd(T, "payslips", s.id, null, { status: "signed", signed_at: new Date().toISOString() });
    return { out: { ok: true }, log: { summary: `Signed the payslip for ${s.month}`, entity: "payslips", id: s.id, area: "pay" } };
  },
};

/* ---------- helpers ---------- */
async function freeUsername(T, name) {
  const base = nk(name).replace(/[^a-z ]/g, "").split(" ").filter(Boolean).join(".") || "user";
  let u = base, i = 2;
  while (await T.one("SELECT 1 FROM people WHERE username = $1", [u])) u = base + i++;
  return u;
}
/* everything the pay rules need for one tutor and month, from the shared records */
export async function payFor(T, tutorId, month) {
  const first = month + "-01", last = month + "-" + String(daysIn(month)).padStart(2, "0");
  const [profiles, items, rulesRow, sessions] = await Promise.all([
    T.q("SELECT * FROM pay_profiles WHERE tutor_id = $1 AND NOT del", [tutorId]),
    T.q("SELECT * FROM pay_items WHERE tutor_id = $1 AND month = $2 AND NOT del", [tutorId, month]),
    T.one("SELECT value FROM settings WHERE key = 'pay_rules'"),
    T.q(`SELECT s.*, to_char(s.day, 'YYYY-MM-DD') AS day, to_char(s.plan_start, 'HH24:MI') AS plan_start, to_char(s.plan_end, 'HH24:MI') AS plan_end,
          to_char(s.actual_start, 'HH24:MI') AS actual_start, to_char(s.actual_end, 'HH24:MI') AS actual_end,
          g.kind, g.mode, g.programme, g.subject, coalesce(g.name, g.subject) AS label,
          EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id AND NOT a.del AND a.present <> 'absent') AS "anyPresent",
          EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = s.id AND NOT a.del AND a.confirm IN ('disputed','kept')) AS held
        FROM sessions s JOIN groups g ON g.id = s.group_id
        WHERE g.tutor_id = $1 AND s.day BETWEEN $2 AND $3 AND NOT s.del`, [tutorId, first, last])]);
  const P = profiles.map(p => Object.assign({}, p, { starts: typeof p.starts === "string" ? p.starts : isoDate(p.starts) }));
  return calcPay({ month, profiles: P, sessions, items, rules: rulesRow ? rulesRow.value : {} });
}
const isoDate = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export { monthOf };
