/* Signing in with a username or email and a password (agreed 30 October, see the sign-in mockup).
   - No self sign-up: LHQ adds the person and gives a one-time setup code (8 characters, 7 days); the person chooses their password with it.
   - Staff moving from PINs sign in once with their username and old PIN, then choose a password; the PIN stops working.
   - 5 wrong tries lock the account for 15 minutes. The message never says whether the username or the password was wrong.
   - Each signed-in device is a row in `devices`, so it can be listed and signed out on its own.
   - The Director's forgotten password: the first 8 characters of LHQ_SECRET, as before.
   The people list also lives here now: the current Hub's code reads and writes it through toOld/fromOld, so documents,
   permissions and Home cards keep working unchanged. */
import crypto from "node:crypto";
import { one, q, newId } from "./db.mjs";
import { writeTx } from "./records.mjs";

export const MAX_FAILS = 5, LOCK_MIN = 15, KEEP_DAYS = 30, SHORT_HOURS = 12, CODE_DAYS = 7;
const secret = () => process.env.LHQ_SECRET || "test-secret";
const b64 = b => Buffer.from(b).toString("base64url");
export function sign(payload) { const body = b64(JSON.stringify(payload)); return body + "." + crypto.createHmac("sha256", secret()).update(body).digest("base64url"); }
export function unsign(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
}
export class AuthError extends Error { constructor(msg, status = 400, extra = {}) { super(msg); this.status = status; this.extra = extra; } }
const no = (msg, status = 400, extra) => { throw new AuthError(msg, status, extra); };
const hash = (s, salt) => crypto.scryptSync(String(s), salt, 32).toString("hex");
const same = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const codeHash = c => crypto.createHmac("sha256", secret()).update("code:" + c).digest("hex");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O, 1/I/L
export const fmtCode = c => c.slice(0, 4) + "-" + c.slice(4);
const cleanCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const nk = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/* ---------- passwords ---------- */
export function pwProblem(pw, p) {
  pw = String(pw || "");
  if (pw.length < 8) return "Use at least 8 characters.";
  if (!/[0-9\W_]/.test(pw)) return "Add a number or a symbol.";
  const low = pw.toLowerCase(), names = [nk(p.name).split(" ")[0], String(p.username || "").split(".")[0]].filter(x => x && x.length > 2);
  if (names.some(n => low.includes(n))) return "Don't use your name in your password.";
  if (pw.length > 200) return "That password is too long.";
  return null;
}
const mkUsername = async (T, name) => {
  const base = nk(name).replace(/[^a-z ]/g, "").split(" ").filter(Boolean).join(".") || "user";
  let u = base, i = 2; while (await T.one("SELECT 1 FROM people WHERE username = $1", [u])) u = base + i++; return u;
};

/* ---------- the people list for the current Hub's code (old shape <-> rows) ---------- */
export function toOld(r) {
  return { id: r.id, name: r.name, role: r.role, perms: r.perms || [], tutor: r.role === "tutor" || !!r.also_tutor, active: r.status !== "off" && !r.del,
    home: (r.prefs || {}).home || null, cards: (r.prefs || {}).cards || {}, seen: r.last_seen ? new Date(r.last_seen).getTime() : 0, pv: r.pv || 1,
    admin: r.role === "director" || r.role === "admin", username: r.username || "", email: r.email || "", status: r.status, hasPw: !!r.pw_hash,
    locked: !!(r.locked_until && new Date(r.locked_until) > new Date()), salt: r.pin_salt, hash: r.pin_hash, auth: "password" };
}
export async function listPeople() { return (await q("SELECT * FROM people WHERE NOT del ORDER BY created_at")).map(toOld); }
/* the current Hub changed its list: write back what changed, add who's new, mark removed people deleted */
export async function savePeople(list) {
  return writeTx(async T => {
    const rows = await T.q("SELECT * FROM people WHERE NOT del"), byId = new Map(rows.map(r => [r.id, r])), keep = new Set();
    for (const p of list) {
      keep.add(p.id);
      const r = byId.get(p.id), prefs = Object.assign({}, r ? r.prefs : {}, { home: p.home || null, cards: p.cards || {} });
      const status = p.active === false ? "off" : (r && r.status !== "off" ? r.status : (r && r.pw_hash ? "active" : p.hash ? "pin" : "setup"));
      const set = { name: p.name, role: p.role, perms: JSON.stringify(p.role === "admin" ? (p.perms || []) : []), also_tutor: p.role !== "tutor" && !!p.tutor,
        prefs: JSON.stringify(prefs), status, pv: p.pv || 1, last_seen: p.seen ? new Date(p.seen).toISOString() : null };
      if (!r) {
        Object.assign(set, { id: p.id, username: await mkUsername(T, p.name), pin_salt: p.salt || null, pin_hash: p.hash || null, status: p.active === false ? "off" : p.hash ? "pin" : "setup" });
        const k = Object.keys(set); await T.q(`INSERT INTO people (${k.join(", ")}) VALUES (${k.map((_, i) => "$" + (i + 1)).join(", ")})`, k.map(x => set[x]));
        continue;
      }
      if (p.hash && p.hash !== r.pin_hash && !r.pw_hash) { set.pin_salt = p.salt; set.pin_hash = p.hash; }   // a PIN set the old way, before a password exists
      const changed = Object.keys(set).filter(k => JSON.stringify(k === "last_seen" ? (r[k] ? new Date(r[k]).toISOString() : null) : (typeof r[k] === "object" && r[k] !== null ? JSON.stringify(r[k]) : r[k])) !== JSON.stringify(set[k]));
      if (changed.length) await T.q(`UPDATE people SET ${changed.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`, [r.id, ...changed.map(k => set[k])]);
    }
    for (const r of rows) if (!keep.has(r.id)) { await T.q("UPDATE people SET del = true, status = 'off', pv = pv + 1, email = NULL WHERE id = $1", [r.id]); await T.q("UPDATE students SET person_id = NULL WHERE person_id = $1", [r.id]); }
  });
}
/* once: everyone in the current Hub's list (Blobs) comes over with their PIN, so they can sign in once with it */
export async function moveFromBlobs(blobPeople) {
  if (await one("SELECT 1 FROM settings WHERE key = 'people_moved'")) return false;
  await writeTx(async T => {
    if (await T.one("SELECT 1 FROM settings WHERE key = 'people_moved'")) return;
    for (const p of blobPeople || []) {
      const role = ["director", "admin", "tutor"].includes(p.role) ? p.role : (p.admin ? "admin" : "tutor");
      const r = await T.one("SELECT * FROM people WHERE id = $1", [p.id]);
      const base = { name: p.name, role, perms: JSON.stringify(role === "admin" ? (p.perms || []) : []), also_tutor: role !== "tutor" && !!p.tutor, pv: p.pv || 1,
        prefs: JSON.stringify({ home: p.home || null, cards: p.cards || {} }), last_seen: p.seen ? new Date(p.seen).toISOString() : null };
      if (!r) {
        const row = Object.assign({ id: p.id, username: await mkUsername(T, p.name), pin_salt: p.salt || null, pin_hash: p.hash || null, status: p.active === false ? "off" : p.hash ? "pin" : "setup" }, base);
        const k = Object.keys(row); await T.q(`INSERT INTO people (${k.join(", ")}) VALUES (${k.map((_, i) => "$" + (i + 1)).join(", ")})`, k.map(x => row[x]));
      } else if (!r.pw_hash) {
        await T.q("UPDATE people SET name = $2, role = $3, perms = $4, also_tutor = $5, pv = $6, prefs = $7, pin_salt = $8, pin_hash = $9, status = $10, username = coalesce(username, $11) WHERE id = $1",
          [p.id, base.name, role, base.perms, base.also_tutor, base.pv, base.prefs, p.salt || null, p.hash || null, p.active === false ? "off" : p.hash ? "pin" : r.status, await mkUsername(T, p.name)]);
      }
    }
    await T.q("INSERT INTO settings (id, key, scope, value) VALUES ($1, 'people_moved', 'staff', $2)", [newId("se"), JSON.stringify({ at: new Date().toISOString(), n: (blobPeople || []).length })]);
  });
  return true;
}

/* ---------- sessions and devices ---------- */
export function deviceLabel(ua = "") {
  const b = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const o = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "device";
  return `${b} on ${o}`;
}
async function newSession(T, p, keep, ua) {
  const d = newId("dv");
  await T.q("INSERT INTO devices (id, person_id, label, keep) VALUES ($1, $2, $3, $4)", [d, p.id, deviceLabel(ua), !!keep]);
  await T.q("UPDATE people SET fails = 0, locked_until = NULL, last_seen = now() WHERE id = $1", [p.id]);
  const exp = Date.now() + (keep ? KEEP_DAYS * 864e5 : SHORT_HOURS * 3600e3);
  return { token: sign({ p: p.id, v: p.pv || 1, d, exp }), keep: !!keep, expires: exp, device: d };
}
/* a signed-in request: the token, the person and the device must all still be good */
export async function personFromToken(token) {
  const t = unsign(token);
  if (!t || t.exp < Date.now() || t.k) return null;
  const r = await one("SELECT * FROM people WHERE id = $1", [t.p]);
  if (!r || r.del || r.status === "off" || (r.pv || 1) !== t.v) return null;
  if (t.d) {
    const d = await one("SELECT * FROM devices WHERE id = $1 AND person_id = $2", [t.d, r.id]);
    if (!d || d.revoked_at) return null;
    if (Date.now() - new Date(d.last_used).getTime() > 10 * 60000) {
      await q("UPDATE devices SET last_used = now() WHERE id = $1", [d.id]); await q("UPDATE people SET last_seen = now() WHERE id = $1", [r.id]);
    }
  } else if (!r.last_seen || Date.now() - new Date(r.last_seen).getTime() > 10 * 60000) await q("UPDATE people SET last_seen = now() WHERE id = $1", [r.id]);
  return Object.assign(toOld(r), { device: t.d || null });
}

/* ---------- signing in ---------- */
/* a username, an email, or the full name (as long as nobody else has the same name: then the username is needed) */
const findLogin = async (T, id) => {
  const v = String(id || "").trim().toLowerCase().replace(/\s+/g, " "); if (!v) return null;
  const exact = await T.one("SELECT * FROM people WHERE NOT del AND (lower(username) = $1 OR lower(email) = $1)", [v]);
  if (exact) return exact;
  const byName = await T.q("SELECT * FROM people WHERE NOT del AND lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) = $1", [v]);
  if (byName.length > 1) return null;   // two people with this name: only their usernames tell them apart
  if (byName.length === 1) return byName[0];
  return T.one("SELECT * FROM people WHERE NOT del AND lower(username) = $1", [v.replace(/ /g, ".")]);
};
const ticket = (p, k, extra = {}) => sign(Object.assign({ p: p.id, v: p.pv || 1, k, exp: Date.now() + 15 * 60000 }, extra));
const WRONG = "That username or email and password don't match.";

export async function signIn({ id, password, keep, ua }) {
  if (!String(id || "").trim() || !password) no("Type your username or email and your password.");
  /* a wrong try must be counted even though the answer is an error: so the transaction returns the error, and it's thrown after saving */
  const r = await writeTx(async T => {
    const p = await findLogin(T, id);
    if (!p) { hash(password, "x"); no(WRONG, 401); }   // same work either way, so timing doesn't tell whether the account exists
    if (p.status === "off") no("This account is switched off. Ask LHQ Admin.", 403);
    if (p.locked_until && new Date(p.locked_until) > new Date()) no(`Too many wrong passwords. Try again in ${Math.ceil((new Date(p.locked_until) - Date.now()) / 60000)} minutes, or ask LHQ Admin for a setup code.`, 429, { locked: true });
    if (p.status === "setup" && !p.pin_hash) no("This account isn't set up yet. Use \"First time here\" with the setup code LHQ gave you.", 403);
    const viaPin = !p.pw_hash && !!p.pin_hash;
    const ok = viaPin ? same(hash(password, p.pin_salt), p.pin_hash) : same(hash(password, p.pw_salt), p.pw_hash);
    if (!ok) {
      const n = (p.fails || 0) + 1;
      if (n >= MAX_FAILS) { await T.q("UPDATE people SET fails = 0, locked_until = now() + interval '15 minutes' WHERE id = $1", [p.id]); return { err: new AuthError(`Too many wrong passwords. Try again in ${LOCK_MIN} minutes, or ask LHQ Admin for a setup code.`, 429, { locked: true }) }; }
      await T.q("UPDATE people SET fails = $2 WHERE id = $1", [p.id, n]);
      const left = MAX_FAILS - n;
      return { err: new AuthError(WRONG + (left <= 2 ? ` ${left} ${left === 1 ? "try" : "tries"} left before a ${LOCK_MIN}-minute lock.` : ""), 401, { left }) };
    }
    if (viaPin) { await T.q("UPDATE people SET fails = 0 WHERE id = $1", [p.id]); return { needPassword: true, why: "pin", ticket: ticket(p, "pin"), person: brief(p) }; }
    return Object.assign({ me: toOld(p) }, await newSession(T, p, keep, ua));
  });
  if (r.err) throw r.err;
  return r;
}
const brief = p => ({ name: p.name, role: p.role, username: p.username, email: p.email || "" });

/* a setup code: from LHQ (first time, or a reset). Wrong codes are counted per connection: 10 wrong in 15 minutes waits 15 minutes. */
export async function useCode({ code, ip }) {
  const c = cleanCode(code);
  return writeTx(async T => {
    const key = "code_fails", row = await T.one("SELECT * FROM settings WHERE key = $1", [key]), all = (row && row.value) || {}, me = all[ip || "?"] || { n: 0, at: 0 };
    if (me.n >= 10 && Date.now() - me.at < LOCK_MIN * 60000) no(`Too many wrong codes. Try again in ${LOCK_MIN} minutes.`, 429);
    const s = c.length === 8 ? await T.one("SELECT s.*, p.name, p.role, p.username, p.email, p.pv, p.status AS pstatus, p.del AS pdel FROM setup_codes s JOIN people p ON p.id = s.person_id WHERE s.code_hash = $1 AND NOT s.del", [codeHash(c)]) : null;
    if (!s || s.used_at || new Date(s.expires_at) < new Date() || s.pdel || s.pstatus === "off") {
      const fresh = Date.now() - me.at > LOCK_MIN * 60000 ? { n: 0 } : me;
      all[ip || "?"] = { n: fresh.n + 1, at: Date.now() };
      Object.keys(all).forEach(k => { if (Date.now() - all[k].at > LOCK_MIN * 60000) delete all[k]; });
      if (row) await T.q("UPDATE settings SET value = $2 WHERE id = $1", [row.id, JSON.stringify(all)]); else await T.q("INSERT INTO settings (id, key, scope, value) VALUES ($1, $2, 'staff', $3)", [newId("se"), key, JSON.stringify(all)]);
      return { err: new AuthError(s && s.used_at ? "That code has already been used. Ask LHQ Admin for a new one." : s && new Date(s.expires_at) < new Date() ? "That code has expired. Ask LHQ Admin for a new one." : "That code doesn't work. Check it, or ask LHQ Admin for a new one.", 403) };
    }
    return { ticket: ticket({ id: s.person_id, pv: s.pv }, "code", { c: s.id }), person: brief(s), first: s.pstatus === "setup" };
  }).then(r => { if (r.err) throw r.err; return r; });
}

/* the Director's forgotten password */
export async function directorCode({ code, ip }) {
  return writeTx(async T => {
    const row = await T.one("SELECT * FROM settings WHERE key = 'recover_fails'"), f = (row && row.value) || { n: 0, until: 0 };
    if (f.until > Date.now()) no(`Too many wrong setup codes. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} minutes.`, 429);
    const ok = same(String(code || "").trim(), secret().slice(0, 8));
    const next = ok ? { n: 0, until: 0 } : (f.n + 1 >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MIN * 60000 } : { n: f.n + 1, until: 0 });
    if (row) await T.q("UPDATE settings SET value = $2 WHERE id = $1", [row.id, JSON.stringify(next)]); else await T.q("INSERT INTO settings (id, key, scope, value) VALUES ($1, 'recover_fails', 'staff', $2)", [newId("se"), JSON.stringify(next)]);
    if (!ok) return { err: new AuthError("That setup code is wrong. It's the first 8 characters of LHQ_SECRET in Netlify.", 403) };
    const p = await T.one("SELECT * FROM people WHERE role = 'director' AND NOT del ORDER BY created_at LIMIT 1");
    if (!p) no("There is no Director yet.", 404);
    return { ticket: ticket(p, "recover"), person: brief(p) };
  }).then(r => { if (r.err) throw r.err; return r; });
}

/* choose a password with a ticket (after a setup code, the old PIN, or the Director's code); signs in on this device */
export async function choosePassword({ ticket: tk, password, email, keep, ua }) {
  const t = unsign(tk);
  if (!t || !t.k || t.exp < Date.now()) no("That took too long. Start again.", 401);
  return writeTx(async T => {
    const p = await T.one("SELECT * FROM people WHERE id = $1 AND NOT del", [t.p]);
    if (!p || p.status === "off" || (p.pv || 1) !== t.v) no("That took too long. Start again.", 401);
    if (t.k === "code") { const s = await T.one("SELECT * FROM setup_codes WHERE id = $1", [t.c]); if (!s || s.used_at) no("That code has already been used. Ask LHQ Admin for a new one.", 403); }
    const bad = pwProblem(password, p); if (bad) no(bad);
    const em = email === undefined ? p.email : (String(email || "").trim() || null);
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) no("That email doesn't look right.");
    if (em && await T.one("SELECT 1 FROM people WHERE lower(email) = lower($1) AND id <> $2 AND NOT del", [em, p.id])) no("Someone else already signs in with that email.");
    const salt = crypto.randomBytes(16).toString("hex");
    await T.q("UPDATE people SET pw_salt = $2, pw_hash = $3, pin_salt = NULL, pin_hash = NULL, status = 'active', fails = 0, locked_until = NULL, email = $4, pv = pv + 1 WHERE id = $1", [p.id, salt, hash(password, salt), em]);
    if (t.k === "code") await T.q("UPDATE setup_codes SET used_at = now() WHERE id = $1", [t.c]);
    await T.q("UPDATE devices SET revoked_at = now() WHERE person_id = $1 AND revoked_at IS NULL", [p.id]);   // a new password: every other device signs in again
    await T.q("INSERT INTO activity (id, actor_id, action, area, entity, entity_id, summary) VALUES ($1, $2, 'password', 'people', 'people', $2, $3)",
      [newId("ac"), p.id, t.k === "pin" ? "Moved from PIN to a password" : t.k === "recover" ? "Set a new password with the Director's setup code" : "Chose a password with a setup code"]);
    const fresh = await T.one("SELECT * FROM people WHERE id = $1", [p.id]);
    return Object.assign({ me: toOld(fresh) }, await newSession(T, fresh, keep, ua));
  });
}

/* the first Director, when nobody exists yet */
export async function firstDirector({ name, username, password, code, keep, ua }) {
  if ((await q("SELECT 1 FROM people WHERE NOT del LIMIT 1")).length) no("LHQ Hub is already set up. Sign in instead.", 409);
  if (!same(String(code || "").trim(), secret().slice(0, 8))) no("That setup code is wrong. It's the first 8 characters of LHQ_SECRET in Netlify.", 403);
  if (!String(name || "").trim()) no("Add your name.");
  return writeTx(async T => {
    const p = { id: newId("p"), name: String(name).trim(), role: "director", username: String(username || "").trim().toLowerCase() || await mkUsername(T, name), pv: 1 };
    const bad = pwProblem(password, p); if (bad) no(bad);
    const salt = crypto.randomBytes(16).toString("hex");
    await T.q("INSERT INTO people (id, name, role, username, status, pw_salt, pw_hash) VALUES ($1, $2, 'director', $3, 'active', $4, $5)", [p.id, p.name, p.username, salt, hash(password, salt)]);
    const r = await T.one("SELECT * FROM people WHERE id = $1", [p.id]);
    return Object.assign({ me: toOld(r) }, await newSession(T, r, keep, ua));
  });
}

/* ---------- my account ---------- */
export async function account(me, b, ua) {
  const a = b.action;
  if (a === "devices") return { devices: (await q("SELECT id, label, keep, last_used, created_at FROM devices WHERE person_id = $1 AND revoked_at IS NULL ORDER BY last_used DESC", [me.id])).map(d => Object.assign(d, { me: d.id === me.device })) };
  return writeTx(async T => {
    const p = await T.one("SELECT * FROM people WHERE id = $1", [me.id]);
    if (a === "password") {
      if (p.pw_hash ? !same(hash(b.current, p.pw_salt), p.pw_hash) : !(p.pin_hash && same(hash(b.current, p.pin_salt), p.pin_hash))) no("Your current password isn't right.", 401);
      const bad = pwProblem(b.password, p); if (bad) no(bad);
      const salt = crypto.randomBytes(16).toString("hex");
      await T.q("UPDATE people SET pw_salt = $2, pw_hash = $3, pin_salt = NULL, pin_hash = NULL, status = 'active' WHERE id = $1", [p.id, salt, hash(b.password, salt)]);
      return { ok: true };
    }
    if (a === "firstpassword") {   // signed in with a PIN-era session: choose a password without the PIN again
      if (p.pw_hash) no("You already have a password. Change it under My account.", 409);
      const bad = pwProblem(b.password, p); if (bad) no(bad);
      const salt = crypto.randomBytes(16).toString("hex");
      await T.q("UPDATE people SET pw_salt = $2, pw_hash = $3, pin_salt = NULL, pin_hash = NULL, status = 'active', pv = pv + 1 WHERE id = $1", [p.id, salt, hash(b.password, salt)]);
      await T.q("UPDATE devices SET revoked_at = now() WHERE person_id = $1 AND revoked_at IS NULL", [p.id]);
      const fresh = await T.one("SELECT * FROM people WHERE id = $1", [p.id]);
      return Object.assign({ me: toOld(fresh) }, await newSession(T, fresh, !!b.keep, ua));
    }
    if (a === "email") {
      const em = String(b.email || "").trim() || null;
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) no("That email doesn't look right.");
      if (em && await T.one("SELECT 1 FROM people WHERE lower(email) = lower($1) AND id <> $2 AND NOT del", [em, p.id])) no("Someone else already signs in with that email.");
      await T.q("UPDATE people SET email = $2 WHERE id = $1", [p.id, em]); return { ok: true, me: toOld(Object.assign(p, { email: em })) };
    }
    if (a === "deviceout") { await T.q("UPDATE devices SET revoked_at = now() WHERE id = $1 AND person_id = $2", [b.id, p.id]); return { ok: true }; }
    if (a === "others") { await T.q("UPDATE devices SET revoked_at = now() WHERE person_id = $1 AND revoked_at IS NULL AND id <> $2", [p.id, me.device || ""]); return { ok: true }; }
    if (a === "signout") { if (me.device) await T.q("UPDATE devices SET revoked_at = now() WHERE id = $1", [me.device]); return { ok: true }; }
    no("Unknown action.");
  });
}

/* ---------- People & access: LHQ adds people and gives setup codes ---------- */
export const mayManage = (me, p) => me.role === "director" ? p.role !== "director" || p.id !== me.id
  : me.role === "admin" && (me.perms || []).includes("tutors") && ["tutor", "student", "parent"].includes(p.role);
async function makeCode(T, me, personId) {
  let c = ""; for (let i = 0; i < 8; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  await T.q("UPDATE setup_codes SET used_at = now() WHERE person_id = $1 AND used_at IS NULL", [personId]);   // only the newest code works
  const exp = new Date(Date.now() + CODE_DAYS * 864e5);
  await T.q("INSERT INTO setup_codes (id, person_id, code_hash, expires_at, made_by) VALUES ($1, $2, $3, $4, $5)", [newId("sc"), personId, codeHash(c), exp.toISOString(), me.id]);
  return { code: fmtCode(c), expires: exp.toISOString() };
}
export async function manage(me, b) {
  const a = b.action;
  if (a === "students") {   // for linking a parent to children, or a student account to their record
    if (!(me.role === "director" || (me.perms || []).includes("tutors") || (me.perms || []).includes("students"))) no("Not allowed.", 403);
    return { students: await q("SELECT s.id, s.name, s.level, s.person_id, (SELECT array_agg(g.parent_id) FROM guardians g WHERE g.student_id = s.id AND NOT g.del) AS parents FROM students s WHERE NOT s.del ORDER BY s.name") };
  }
  return writeTx(async T => {
    if (a === "add") {
      const role = String(b.role || "");
      if (!["student", "parent", "tutor", "admin", "bdo"].includes(role)) no("Choose a role.");
      if (!mayManage(me, { role })) no(["admin", "bdo"].includes(role) ? "Only Wanangwa can add Admin and BDO accounts." : "You can't add people.", 403);
      const name = String(b.name || "").trim().replace(/\s+/g, " ");
      if (!name.includes(" ")) no("Type the full name (first and last).");
      const email = String(b.email || "").trim() || null;
      if (email && await T.one("SELECT 1 FROM people WHERE lower(email) = lower($1) AND NOT del", [email])) no("Someone already signs in with that email.");
      const kids = role === "parent" ? (Array.isArray(b.children) ? b.children.map(String) : []) : [];
      if (role === "parent" && !kids.length) no("Tick at least one child.");
      const id = newId("p"), username = await mkUsername(T, name);
      await T.q("INSERT INTO people (id, name, role, username, email, status, perms) VALUES ($1, $2, $3, $4, $5, 'setup', $6)",
        [id, name, role, username, email, JSON.stringify(role === "admin" ? ["quotes", "receipts", "cards", "delete", "restore", "students", "tutors", "msgs", "classes", "spend"] : [])]);
      if (role === "student") {   // link to their student record: the one with the same name, or a new one
        const key = nk(name), s = b.student_id ? await T.one("SELECT * FROM students WHERE id = $1 AND NOT del", [b.student_id]) : await T.one("SELECT * FROM students WHERE key = $1 AND NOT del", [key]);
        if (s && s.person_id && s.person_id !== id) no(`${s.name} already has an account.`, 409);
        if (s) await T.q("UPDATE students SET person_id = $2 WHERE id = $1", [s.id, id]);
        else await T.q("INSERT INTO students (id, key, name, person_id) VALUES ($1, $2, $3, $4)", [newId("st"), key, name, id]);
      }
      for (const sid of kids) await T.q("INSERT INTO guardians (id, parent_id, student_id) VALUES ($1, $2, $3) ON CONFLICT (parent_id, student_id) DO UPDATE SET del = false", [newId("gu"), id, sid]);
      await T.q("INSERT INTO activity (id, actor_id, action, area, entity, entity_id, summary) VALUES ($1, $2, 'person.add', 'people', 'people', $3, $4)", [newId("ac"), me.id, id, `Added ${name} (${role}) · username ${username}`]);
      return Object.assign({ id, name, role, username }, await makeCode(T, me, id));
    }
    const p = await T.one("SELECT * FROM people WHERE id = $1 AND NOT del", [b.id]);
    if (!p) no("Person not found.", 404);
    if (p.id === me.id) no("Change your own sign-in under My account.");
    if (!mayManage(me, p)) no(p.role === "director" ? "Nobody can change the Director's account." : "Only Wanangwa can change this person.", 403);
    const log = s => T.q("INSERT INTO activity (id, actor_id, action, area, entity, entity_id, summary) VALUES ($1, $2, $3, 'people', 'people', $4, $5)", [newId("ac"), me.id, "person." + a, p.id, s]);
    if (a === "code") { const r = await makeCode(T, me, p.id); await log(`New setup code for ${p.name}`); return Object.assign({ name: p.name, username: p.username }, r); }
    if (a === "unlock") { await T.q("UPDATE people SET fails = 0, locked_until = NULL WHERE id = $1", [p.id]); await log(`Unlocked ${p.name}`); return { ok: true }; }
    if (a === "outall") { await T.q("UPDATE people SET pv = pv + 1 WHERE id = $1", [p.id]); await T.q("UPDATE devices SET revoked_at = now() WHERE person_id = $1 AND revoked_at IS NULL", [p.id]); await log(`Signed ${p.name} out of every device`); return { ok: true }; }
    if (a === "email") {
      const em = String(b.email || "").trim() || null;
      if (em && await T.one("SELECT 1 FROM people WHERE lower(email) = lower($1) AND id <> $2 AND NOT del", [em, p.id])) no("Someone else already signs in with that email.");
      await T.q("UPDATE people SET email = $2 WHERE id = $1", [p.id, em]); await log(`Changed ${p.name}'s email`); return { ok: true };
    }
    if (a === "username") {
      const u = String(b.username || "").trim().toLowerCase();
      if (!/^[a-z][a-z0-9.]{2,40}$/.test(u)) no("Usernames are lowercase letters, numbers and dots, e.g. kondwani.kalua.");
      if (await T.one("SELECT 1 FROM people WHERE username = $1 AND id <> $2", [u, p.id])) no("That username is taken.");
      await T.q("UPDATE people SET username = $2 WHERE id = $1", [p.id, u]); await log(`Changed ${p.name}'s username to ${u}`); return { ok: true };
    }
    if (a === "off" || a === "on") {
      await T.q("UPDATE people SET status = $2, pv = pv + $3 WHERE id = $1", [p.id, a === "off" ? "off" : p.pw_hash ? "active" : p.pin_hash ? "pin" : "setup", a === "off" ? 1 : 0]);
      await log(`${a === "off" ? "Switched off" : "Switched on"} ${p.name}`); return { ok: true };
    }
    no("Unknown action.");
  });
}
/* everyone, for People & access (staff only). Never hashes. */
export async function peopleForStaff(me) {
  const rows = await q(`SELECT p.*, (SELECT max(expires_at) FROM setup_codes s WHERE s.person_id = p.id AND s.used_at IS NULL AND NOT s.del AND s.expires_at > now()) AS code_until,
      (SELECT array_agg(st.name ORDER BY st.name) FROM guardians g JOIN students st ON st.id = g.student_id WHERE g.parent_id = p.id AND NOT g.del) AS children
    FROM people p WHERE NOT p.del ORDER BY p.name`);
  return rows.map(r => Object.assign(toOld(r), { salt: undefined, hash: undefined, codeUntil: r.code_until, children: r.children || [] }));
}
