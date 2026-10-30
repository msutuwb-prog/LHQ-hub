/* Who sees what. Applied on the server, so a phone only ever receives what that person may see:
   a parent's phone never holds another family's records, a tutor's never holds LHQ's money.
   $1 is always the signed-in person's id. */

export const isDir = me => me.role === "director";
export const isStaff = me => me.role === "director" || me.role === "admin";
export const can = (me, k) => isDir(me) || (me.role === "admin" && (me.perms || []).includes(k));
export const teaches = me => me.role === "tutor" || !!me.also_tutor;
export const canPay = me => can(me, "tpay");

/* the building blocks */
const TG = `SELECT id FROM groups WHERE tutor_id = $1 AND NOT del`;                                         // groups I teach
const TS = `SELECT student_id FROM group_students WHERE NOT del AND group_id IN (${TG})`;                     // students I teach
const SS = `SELECT id FROM students WHERE person_id = $1 AND NOT del UNION SELECT student_id FROM guardians WHERE parent_id = $1 AND NOT del`;  // me, or my children
const SG = `SELECT group_id FROM group_students WHERE NOT del AND student_id IN (${SS})`;                     // my (children's) groups

/* one WHERE clause per table and person. Staff see all teaching records; money and pay depend on what the Director gave them. */
export function visible(table, me) {
  const staff = isStaff(me), tut = teaches(me), fam = me.role === "student" || me.role === "parent";
  const or = (...xs) => "(" + xs.filter(Boolean).join(" OR ") + ")";
  const none = "false";
  switch (table) {
    case "settings": return staff ? (canPay(me) ? "true" : "scope <> 'pay'") : "scope = 'all'";
    case "people": return staff ? "true" : or("id = $1", "role IN ('director','admin','tutor','bdo')",
      tut && `id IN (SELECT person_id FROM students WHERE id IN (${TS}))`, me.role === "parent" && `id IN (SELECT person_id FROM students WHERE id IN (${SS}))`);
    case "devices": return "person_id = $1";
    case "students": return staff ? "true" : or(tut && `id IN (${TS})`, fam && `id IN (${SS})`) .replace("()", none);
    case "guardians": return staff ? "true" : or(me.role === "parent" && "parent_id = $1", fam && `student_id IN (${SS})`) .replace("()", none);
    case "periods": return staff ? "true" : or(tut && `student_id IN (${TS})`, fam && `student_id IN (${SS})`) .replace("()", none);
    case "groups": return staff ? "true" : or(tut && `id IN (${TG})`, fam && `id IN (${SG})`) .replace("()", none);
    case "group_students": return staff ? "true" : or(tut && `group_id IN (${TG})`, fam && `student_id IN (${SS})`) .replace("()", none);
    case "slots": case "sessions": case "assessments": return staff ? "true" : or(tut && `group_id IN (${TG})`, fam && `group_id IN (${SG})`) .replace("()", none);
    case "attendance": return staff ? "true" : or(tut && `session_id IN (SELECT id FROM sessions WHERE group_id IN (${TG}))`, fam && `student_id IN (${SS})`) .replace("()", none);
    case "makeups": case "sras": return staff ? "true" : or(tut && `group_id IN (${TG})`, fam && `student_id IN (${SS})`) .replace("()", none);
    case "marks": return staff ? "true" : or(tut && `assessment_id IN (SELECT id FROM assessments WHERE group_id IN (${TG}))`, fam && `student_id IN (${SS})`) .replace("()", none);
    case "requisitions": return staff ? "true" : tut ? "tutor_id = $1" : none;
    case "events": return or("audience = 'lhq'", "owner_id = $1", staff && "audience = 'shared'",
      tut && `(audience = 'shared' AND student_id IN (${TS}))`, fam && `(audience = 'shared' AND student_id IN (${SS}))`);
    case "reports": return staff ? "true" : or("author_id = $1", tut && `(kind = 'student' AND student_id IN (${TS}))`, me.role === "parent" && `(kind = 'student' AND student_id IN (${SS}))`);
    case "feedback": return me.role === "student" ? `student_id IN (${SS})` : none;   // LHQ gets averages only (see v2 /feedback)
    case "pay_profiles": case "pay_items": return canPay(me) ? "true" : tut ? "tutor_id = $1" : none;
    case "payslips": return canPay(me) ? "true" : tut ? "(tutor_id = $1 AND status <> 'draft')" : none;
    case "activity": return isDir(me) || canPay(me) ? "true" : staff ? "area <> 'pay'" : "actor_id = $1";
    default: return none;   // setup_codes and anything new: nobody, until a rule is written for it
  }
}

/* columns some people mustn't receive, even on rows they can see */
const SECRET_PEOPLE = ["pw_salt", "pw_hash", "pin_salt", "pin_hash", "fails", "locked_until"];
export function redact(table, row, me) {
  if (table === "people") {
    const r = Object.assign({}, row); SECRET_PEOPLE.forEach(k => delete r[k]);
    if (!isStaff(me) && r.id !== me.id) return { id: r.id, rev: r.rev, ver: r.ver, del: r.del, name: r.name, role: r.role };
    return r;
  }
  if (table === "periods" && !(isStaff(me) || me.role === "parent")) { const r = Object.assign({}, row); delete r.fee; return r; }
  if (table === "students" && !isStaff(me) && me.role !== "parent" && me.role !== "student") { const r = Object.assign({}, row); r.info = {}; return r; }   // tutors don't get home contacts
  if (table === "requisitions" && !isStaff(me)) { const r = Object.assign({}, row); delete r.cost; return r; }
  return row;
}
