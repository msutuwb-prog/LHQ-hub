/* Copy what the current Hub keeps (Netlify Blobs) into the shared records, without changing the Blobs.
   Safe to run again: every record gets an id made from what it is (student + subject + tutor, group + day + time),
   so a second run adds only what is new and never doubles anything.
     people        -> people (their PIN hash comes too, so step 2 can let them sign in once with the old PIN)
     lhq_students  -> students (contacts go in info)
     tuition cards -> students, tuition periods, one-to-one groups and their timetable
     lhq_classes   -> class groups (members' one-to-one groups for that subject and tutor are folded into the class)
     lhq_logs      -> sessions with attendance, missed sessions as make-ups owed, SRA reviews, assessment marks */
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { writeTx } from "./records.mjs";
import { nk } from "./commands.mjs";

let blobStore = null;
export const _setBlobStore = s => { blobStore = s; };
const store = preview => blobStore || getStore({ name: preview ? "lhq-hub-preview" : "lhq-hub", consistency: "strong" });
const hid = (p, ...parts) => p + crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
const DN = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const hhmm = t => { const m = String(t || "").match(/^(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : null; };
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

async function readDocs(s) {
  const { blobs } = await s.list({ prefix: "doc/" });
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) out.push(...(await Promise.all(blobs.slice(i, i + 25).map(b => s.get(b.key, { type: "json" })))).filter(Boolean));
  return out;
}

/* in parts, so each request finishes well inside Netlify's time limit: part 0 = people, students, classes, cards;
   parts 1, 2, … = the logs, `size` at a time. The answer says whether there is more and which part is next. */
const LOG_TABLES = ["sessions", "attendance", "makeups", "assessments", "marks", "sras"];
export async function importFromBlobs(me, { preview = false, part = 0, size = 300 } = {}) {
  const s = store(preview);
  const [people, students, classes, logs, docs] = await Promise.all([
    s.get("people", { type: "json" }), s.get("kv/lhq_students", { type: "json" }), s.get("kv/lhq_classes", { type: "json" }), s.get("kv/lhq_logs", { type: "json" }), readDocs(s)]);
  const n = { people: 0, students: 0, periods: 0, groups: 0, slots: 0, sessions: 0, attendance: 0, makeups: 0, sras: 0, assessments: 0, skipped: [] };
  return writeTx(async T => {
    const add = async (table, row) => {
      if (part > 0 && !LOG_TABLES.includes(table)) return false;
      if (part === 0 && LOG_TABLES.includes(table)) return false;
      const keys = Object.keys(row);
      const r = await T.q(`INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((_, i) => "$" + (i + 1)).join(", ")}) ON CONFLICT DO NOTHING RETURNING id`,
        keys.map(k => row[k] !== null && typeof row[k] === "object" ? JSON.stringify(row[k]) : row[k]));
      if (r.length) n[table] = (n[table] || 0) + 1;
      return r.length > 0;
    };
    /* people */
    const tutorId = new Map();
    for (const p of people || []) {
      if (part > 0) { tutorId.set(nk(p.name), p.id); continue; }
      const role = ["director", "admin", "tutor"].includes(p.role) ? p.role : (p.admin ? "admin" : "tutor");
      let u = nk(p.name).replace(/[^a-z ]/g, "").split(" ").filter(Boolean).join(".") || "user", base = u, i = 2;
      while (await T.one("SELECT 1 FROM people WHERE username = $1 AND id <> $2", [u, p.id])) u = base + i++;
      await add("people", { id: p.id, name: p.name, role, username: u, perms: role === "admin" ? (p.perms || []) : [], also_tutor: !!p.tutor && role !== "tutor",
        status: p.active === false ? "off" : "pin", pin_salt: p.salt || null, pin_hash: p.hash || null });
      tutorId.set(nk(p.name), p.id);
    }
    /* students */
    const studentId = new Map(), known = new Map((await T.q("SELECT key, id FROM students")).map(r => [r.key, r.id]));
    const ensureStudent = async (name, extra = {}) => {
      const key = nk(name); if (!key) return null;
      if (studentId.has(key)) return studentId.get(key);
      const cur = known.has(key) ? { id: known.get(key) } : null;
      const id = cur ? cur.id : hid("st", key);
      if (!cur) await add("students", Object.assign({ id, key, name: String(name).trim() }, extra));
      studentId.set(key, id); return id;
    };
    for (const r of Object.values(students || {})) {
      if (!r || !r.name) continue;
      await ensureStudent(r.name, { level: r.level || null, school: r.school || null, info: { parent: r.parent || "", phone: r.phone || "", email: r.email || "", address: r.address || "", heard: r.heard || "", added: r.added || "" } });
    }
    /* classes first, so a student taught in a class isn't also given a one-to-one group for the same subject and tutor */
    const inClass = new Map();   // studentKey|subject|tutorId -> class group id
    for (const c of Object.values(classes || {})) {
      if (!c || c.del || !c.name) continue;
      const tid = tutorId.get(nk(c.tutor)); if (!tid) { n.skipped.push(`Class ${c.name}: tutor ${c.tutor} not found`); continue; }
      const gid = hid("gc", c.id);
      await add("groups", { id: gid, tutor_id: tid, kind: "class", name: c.name, subject: c.sub || c.name, mode: c.mode === "online" ? "online" : "in person" });
      for (const k of c.stu || []) { const sid = await ensureStudent(k); await add("group_students", { id: hid("gs", gid, sid), group_id: gid, student_id: sid }); inClass.set(k + "|" + nk(c.sub) + "|" + tid, gid); }
    }
    /* tuition cards: periods, one-to-one groups and the timetable */
    const groupFor = new Map();   // studentKey|subject|tutorId -> group id (for the logs)
    for (const d of docs.filter(x => x && x.type === "card" && !x.del)) {
      const sid = await ensureStudent(d.student, { level: d.level || null, school: d.school || null });
      if (!sid || !isDay(d.periodStart) || !isDay(d.periodEnd)) { n.skipped.push(`Card ${d.number || d.id}: no student or period dates`); continue; }
      const pid = hid("pe", d.id);
      await add("periods", { id: pid, student_id: sid, kind: /holiday/i.test(d.period || "") ? "holiday" : "term", starts: d.periodStart, ends: d.periodEnd, card_id: d.id, invoice_id: d.ref || null });
      for (const sub of d.subjects || []) {
        const tid = tutorId.get(nk(sub.tutor)); if (!tid) { if (sub.tutor) n.skipped.push(`${d.student} · ${sub.name}: tutor ${sub.tutor} not found`); continue; }
        const key = nk(d.student) + "|" + nk(sub.name) + "|" + tid;
        let gid = inClass.get(key);
        if (!gid) {
          gid = hid("go", key);
          await add("groups", { id: gid, tutor_id: tid, kind: "one", subject: sub.name, mode: /online/i.test(d.where || "") ? "online" : "in person" });
          await add("group_students", { id: hid("gs", gid, sid), group_id: gid, student_id: sid, period_id: pid, target: sub.grade || null });
        }
        groupFor.set(key, gid);
        const a = hhmm(sub.start), b = hhmm(sub.end);
        if (a && b && b > a) for (const day of sub.days || []) if (DN[day] != null)
          await add("slots", { id: hid("sl", gid, day, a, d.periodStart), group_id: gid, weekday: DN[day], starts: a, ends: b, per: 1, from_date: d.periodStart, to_date: d.periodEnd });
      }
    }
    /* logs: sessions, attendance, make-ups owed, SRA reviews, marks */
    const L = Object.values((logs && logs.e) || {}).filter(e => e && !e.x && isDay(e.d) && e.id).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const e of part === 0 ? [] : L.slice((part - 1) * size, part * size)) {
      const tid = tutorId.get(nk(e.tutor)), skey = nk(e.st), gid = tid && (groupFor.get(skey + "|" + nk(e.sub) + "|" + tid) || inClass.get(skey + "|" + nk(e.sub) + "|" + tid));
      const sid = studentId.get(skey) || known.get(skey);
      if (!gid || !sid) { n.skipped.push(`Log ${e.id}: no matching group`); continue; }
      if (e.ty === "s") {
        const wd = new Date(e.d + "T00:00:00Z").getUTCDay();
        const slot = await T.one("SELECT to_char(starts,'HH24:MI') a, to_char(ends,'HH24:MI') b FROM slots WHERE group_id = $1 AND weekday = $2 AND from_date <= $3 AND to_date >= $3 AND NOT del LIMIT 1", [gid, wd, e.d]) || { a: "00:00", b: "00:50" };
        const ssid = hid("se", gid, e.d, slot.a);
        await add("sessions", { id: ssid, group_id: gid, day: e.d, plan_start: slot.a, plan_end: slot.b, status: "done", topics: e.tp || [], logged_by: tid, logged_at: new Date(e.at || Date.now()).toISOString() });
        const present = e.a === "absent" ? "absent" : e.a === "late" ? "late" : "present";
        await add("attendance", { id: hid("at", ssid, sid), session_id: ssid, student_id: sid, present, confirm: "confirmed" });
        if (present === "absent") await add("makeups", { id: hid("mk", ssid, sid), student_id: sid, group_id: gid, owed_session_id: ssid, why: "Absent (from the old logs)" });
        if (e.sc != null && e.mx) {
          const aid = hid("as", gid, e.d);
          await add("assessments", { id: aid, group_id: gid, day: e.d, kind: "Weekly", topics: e.tp || [], out_of: Number(e.mx), set_by: tid });
          await add("marks", { id: hid("ma", aid, sid), assessment_id: aid, student_id: sid, score: Number(e.sc) });
        }
      } else if (e.ty === "r" && e.tk) {
        const rv = Math.max(0, Math.min(5, Number(e.rv) || 0));
        await add("sras", { id: hid("sr", sid, gid, e.tk, rv), student_id: sid, group_id: gid, topic: e.tk, review: rv, due: e.d,
          status: e.sc != null ? "marked" : e.h === "m" ? "missed" : "in", score: e.sc ?? null, out_of: e.mx ?? null, marked_by: e.sc != null ? tid : null });
      }
    }
    const more = part === 0 ? L.length > 0 : part * size < L.length;
    if (!more) await T.q("INSERT INTO activity (id, actor_id, action, area, summary, data) VALUES ($1, $2, 'import', 'teaching', $3, $4)",
      [hid("ac", "import", String(Date.now())), me.id, "Copied the current Hub into the shared records", JSON.stringify(Object.assign({}, n, { skipped: n.skipped.length }))]);
    n.skipped = n.skipped.slice(0, 50);
    return Object.assign(n, { part, more, next: more ? part + 1 : null, logs: L.length });
  });
}
