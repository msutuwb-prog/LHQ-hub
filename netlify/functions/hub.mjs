// LHQ Hub: sign-in and shared storage (Netlify Functions + Netlify Blobs).
//
// Needs one environment variable in Netlify: LHQ_SECRET (a long random string, used to sign sign-in tokens).
//
// Storage (store "lhq-hub", strong consistency):
//   people            [{id, name, role, perms, tutor, home, active, salt, hash, pv}]
//                     role: director (one, full access) | admin (only what the Director allows in perms) | tutor
//                     pv = PIN version; changing a PIN signs that person out everywhere
//   fails/<id>        {n, until}                                           (wrong-PIN counter for that person)
//   index             {rev, epoch, docs:{id:{type, number, savedAt, r}}, gone:{id:r}, kvr:{key:r}, floor}
//                     one small file used for numbering and change checks. r = the rev a document (or setting list) last
//                     changed at, so a device that already has rev N is sent only what changed after N (see state()).
//                     epoch changes when the whole store is replaced (demo data, emptying a preview): devices then reload everything.
//   doc/<id>          the saved quote / invoice / receipt / card
//   hist/<id>/<time>  the previous version whenever a document is overwritten
//   trash/<id>        deleted documents (Recently deleted: can be restored for 30 days)
//   kv/<key>          shared settings, message templates, numbering, report edits, tutor logs,
//                     spending (lhq_spend: {id:{date, cat, amount, what, to, method, rep, sid, by, at, del}}), other money in
//                     (lhq_income: same shape, cat = Rent from tenant | Loan | Loan repayment | Owner investment | Grant | Refund received | Other) and budgets (lhq_budget)

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import * as A from "../lib/auth.mjs";
import { pgStore, moveFromBlobs as copyBlobs, copyToBlobs } from "../lib/pgstore.mjs";
import { one, q } from "../lib/db.mjs";

/* With the shared records' database switched on, people and sign-in live there (username or email + password, see
   netlify/lib/auth.mjs); everything below keeps using getPeople/putPeople/whoIs and doesn't notice.
   Without it, the original Blobs list and PINs are used, exactly as before. */
let testDb = false;
export const _setDbMode = v => { testDb = v; };
const envGet = k => { try { return (globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(k)) || process.env[k]; } catch { return process.env[k]; } };
const dbMode = () => testDb || !!(envGet("NETLIFY_DB_URL") || envGet("DATABASE_URL") || envGet("NETLIFY_DATABASE_URL"));
let moved = false;

let testStore = null;
export const _setStore = s => { testStore = s; };
// Deploy previews (and branch deploys) get their own storage, so trying things there never touches LHQ's real documents
let site = "production";
/* a separate test site (its own Netlify account, e.g. lhqhub-test) sets LHQ_TEST=yes: it then behaves as a test copy (demo data, the gold strip) */
const testSite = () => { try { return String((globalThis.Netlify && Netlify.env.get("LHQ_TEST")) || process.env.LHQ_TEST || "").toLowerCase() === "yes"; } catch { return false; } };
const isPreview = () => site !== "production" || testSite();
const blobs = () => testStore || getStore({ name: isPreview() ? "lhq-hub-preview" : "lhq-hub", consistency: "strong" });
/* One system: once the Director has copied the Hub into the database and switched to it (Settings › Shared records), every
   document, list, money entry and tutor log is read and written there. Until then, and if it is ever switched back,
   Netlify Blobs are used as before. The switch is a setting, so it can be undone without a new deploy. */
let storeOnDb = false;
const store = () => storeOnDb ? pgStore : blobs();
async function usesDbStore() {
  if (!dbMode()) return false;
  try { const r = await one("SELECT value FROM settings WHERE key = 'hub_store' AND NOT del"); return !!r && r.value === "db"; } catch { return false; }
}

/* compare two values whatever order their keys come in (the database keeps keys in its own order) */
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);

const KV_KEYS = ["lhq_settings", "lhq_templates", "lhq_counters", "lhq_repEdits", "lhq_logs", "lhq_tlinks", "lhq_students", "lhq_spend", "lhq_budget", "lhq_income", "lhq_classes", "lhq_treps", "lhq_avail", "lhq_cardack", "lhq_makeups", "lhq_reqs", "lhq_clashes", "lhq_moves", "lhq_confirmer", "lhq_sradone", "lhq_sreports"];

/* ---------- roles and permissions ---------- */
const PERMS = ["quotes", "receipts", "cards", "delete", "restore", "students", "money", "tpay", "tutors", "msgs", "numbering", "backup", "classes", "moveclass", "spend", "pl"];
const ADMIN_DEFAULT = ["quotes", "receipts", "cards", "delete", "restore", "students", "tutors", "msgs", "classes"];
const TYPE_PERM = { quote: "quotes", invoice: "quotes", receipt: "receipts", card: "cards" };
// settings fields: lists and wording can be given to admins; everything else (bank, contact, payment rules) is the Director's
const LIST_FIELDS = ["subjects", "levels", "methods", "includes", "tutors", "grades", "gradeBasis", "sessionLengths", "spendCats", "heardFrom", "districts"];
/* Business: who may read each part. Spending goes to whoever records it or sees profit and loss; budgets with profit and loss. */
const KV_READ = { lhq_spend: p => can(p, "spend") || can(p, "pl"), lhq_income: p => can(p, "spend") || can(p, "pl"), lhq_budget: p => can(p, "pl"),
  lhq_sreports: p => isDirector(p) || can(p, "tutors") };   // students' daily reports: never tutors (they get averages only)
const MERGED = ["lhq_spend", "lhq_income"];   // recorded on several devices at once: merged entry by entry
/* Spending is recorded on several devices at once, so entries are merged one by one (newest wins) instead of the whole list being replaced.
   Deleting marks an entry del:true, so a device that hasn't heard about it yet can't bring it back. */
function mergeSpend(old, v, me) {
  const out = Object.assign({}, old || {});
  Object.entries(v || {}).forEach(([id, e]) => {
    if (!e || typeof e !== "object" || canon(e) === canon(out[id])) return;
    if (out[id] && (e.at || 0) < (out[id].at || 0)) return;
    const was = out[id];
    out[id] = Object.assign({}, e, { by: was ? was.by : me.name }, was ? { editedBy: me.name } : {});
  });
  return out;
}
/* Tutors' logs arrive from tutors' own sign-ins and from LHQ admin importing WhatsApp logs at the same time:
   merged entry by entry (newest "at" wins; a deleted entry stays as {x:1} so it can't come back) */
function mergeLogs(old, v) {
  const o = old && typeof old === "object" ? old : {}, n = v && typeof v === "object" ? v : {};
  const e = Object.assign({}, o.e || {});
  Object.entries(n.e || {}).forEach(([id, x]) => { if (!x || typeof x !== "object") return;
    if (!e[id] || (x.at || 0) >= (e[id].at || 0)) e[id] = e[id] && e[id].cf && !x.cf ? Object.assign({}, x, { cf: e[id].cf }) : x; });   // a confirmation is only changed through /confirm
  const seen = new Set(), imports = [...(o.imports || []), ...(n.imports || [])].filter(i => { const k = canon(i); if (seen.has(k)) return false; seen.add(k); return true; }).slice(-200);
  return Object.assign({}, o, n, { e, imports });
}
const TRASH_DAYS = 30;
// the editor's built-in values: a device saving settings for the first time sends these, which is not a change
const SETTINGS_DEFAULT = { email: "learnhqes@gmail.com", phone: "265 992 525 250", bank: "National Bank of Malawi", accname: "LearnHQ Tutoring and Training",
  branch: "Gateway", accno: "1007401201", popphone: "0992 525 250", mobile: "0992 520 520", rate: "15000", validDays: "30", dueDays: "0", graceDays: "3" };
const isDirector = p => p && p.role === "director";
const can = (p, k) => isDirector(p) || (p && p.role === "admin" && (p.perms || []).includes(k));
const staff = p => p && (p.role === "director" || p.role === "admin");
/* people saved before roles existed: the first admin becomes the Director, other admins get the admin defaults */
function migrate(list) {
  let changed = false;
  if (!list.some(p => p.role)) {
    let dir = false;
    list.forEach(p => {
      if (p.admin && !dir) { p.role = "director"; dir = true; }
      else if (p.admin) { p.role = "admin"; p.perms = ADMIN_DEFAULT.slice(); }
      else { p.role = "tutor"; p.perms = []; }
      changed = true;   // "admin" is kept so the app before roles still works during the switch-over
    });
  }
  return changed;
}
const PREFIX = { quote: "Q", invoice: "INV", receipt: "RCT", card: "TC" };
const TOKEN_DAYS = 120;
const MAX_FAILS = 5, LOCK_MIN = 15;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);
const b64 = b => Buffer.from(b).toString("base64url");
const secret = () => process.env.LHQ_SECRET || (testStore ? "test-secret" : "");

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + "." + crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}
function unsign(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
}
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString("hex");
const pinOk = pin => /^\d{4,6}$/.test(String(pin || ""));
const pub = p => Object.assign({ id: p.id, name: p.name, role: p.role, admin: staff(p), tutor: !!p.tutor, perms: isDirector(p) ? PERMS.slice() : (p.perms || []), active: p.active !== false, home: p.home || null, cards: p.cards || {}, view: p.view === "full" ? "full" : "lean", nav: Array.isArray(p.nav) ? p.nav : null, seen: p.seen || 0 },
  p.auth === "password" ? { auth: "password", username: p.username, email: p.email, status: p.status, hasPw: p.hasPw, locked: !!p.locked, codeUntil: p.codeUntil || null, children: p.children || undefined } : { auth: "pin" });

async function getPeople() {
  if (dbMode()) {
    if (!moved) { await A.moveFromBlobs((await store().get("people", { type: "json" })) || []); moved = true; }
    return A.listPeople();
  }
  const list = (await store().get("people", { type: "json" })) || [];
  if (migrate(list)) await putPeople(list);
  return list;
}
async function putPeople(list) { list.forEach(p => { p.admin = p.role === "director" || p.role === "admin"; }); if (dbMode()) return A.savePeople(list); await store().setJSON("people", list); }
function newToken(p) { return sign({ p: p.id, v: p.pv || 1, exp: Date.now() + TOKEN_DAYS * 864e5 }); }

async function whoIs(req) {
  if (dbMode()) { if (!moved) await getPeople(); return A.personFromToken((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")); }
  const t = unsign((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (!t || t.exp < Date.now()) return null;
  const list = await getPeople(), p = list.find(x => x.id === t.p);
  if (!p || p.active === false || (p.pv || 1) !== t.v) return null;
  if (!p.seen || Date.now() - p.seen > 10 * 60000) { p.seen = Date.now(); await putPeople(list); }   // "last seen", at most every 10 minutes
  return p;
}

async function getIndex() {
  const r = await store().getWithMetadata("index", { type: "json" });
  return r ? { data: r.data, etag: r.etag } : { data: { rev: 0, docs: {} }, etag: null };
}
const parseNum = (type, n) => {
  const m = String(n || "").trim().match(/^(Q|INV|RCT|TC)-?(\d+)$/i);
  if (m) return { type: { Q: "quote", INV: "invoice", RCT: "receipt", TC: "card" }[m[1].toUpperCase()], n: +m[2] };
  const p = parseInt(n, 10); return isNaN(p) ? null : { type: type || "quote", n: p };
};
const fmtNum = (type, n) => PREFIX[type] + "-" + String(n).padStart(4, "0");

async function readAll(prefix) {
  const s = store();
  if (s.getAll) return s.getAll(prefix);
  const { blobs } = await s.list({ prefix });
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const part = await Promise.all(blobs.slice(i, i + 25).map(b => s.get(b.key, { type: "json" })));
    out.push(...part.filter(Boolean));
  }
  return out;
}

/* ---------------- handlers ---------------- */
async function people(req) {
  if (dbMode()) {
    /* a device still showing the old PIN screen (kept from before the update) gets told to refresh, instead of an empty list */
    if (!new URL(req.url).searchParams.get("v")) return json({ error: "LHQ Hub has been updated to passwords. Refresh this page (or close it and open it again) to sign in." });
    const list = await getPeople(); return json({ setup: list.length === 0, preview: isPreview(), mode: "password" });   // no names: nobody's name is shown before they sign in
  }
  const list = await getPeople();
  return json({ setup: list.length === 0, preview: isPreview(), people: list.filter(p => p.active !== false).map(p => ({ id: p.id, name: p.name, role: p.role, admin: staff(p), tutor: !!p.tutor })) });
}

async function setup(req) {
  if (dbMode()) { const b = await req.json().catch(() => ({})); return json(await A.firstDirector(Object.assign(b, { ua: req.headers.get("user-agent") || "" }))); }
  const { name, pin, code } = await req.json().catch(() => ({}));
  if ((await getPeople()).length) return fail("LHQ Hub is already set up. Sign in instead.", 409);
  if (String(code || "").trim() !== secret().slice(0, 8)) return fail("That setup code is wrong. It's the first 8 characters of LHQ_SECRET in Netlify.", 403);
  if (!String(name || "").trim()) return fail("Add your name.");
  if (!pinOk(pin)) return fail("Choose a PIN of 4 to 6 digits.");
  const salt = crypto.randomBytes(16).toString("hex");
  const p = { id: "p" + crypto.randomBytes(5).toString("hex"), name: String(name).trim(), role: "director", perms: [], tutor: false, active: true, salt, hash: hashPin(pin, salt), pv: 1 };
  await putPeople([p]);
  return json({ token: newToken(p), me: pub(p) });
}

/* the Director forgot their PIN: the setup code (first 8 characters of LHQ_SECRET) sets a new one */
async function recover(req) {
  const { code, pin } = await req.json().catch(() => ({}));
  // the setup code can't be guessed by trying many times: 5 wrong tries lock it for 15 minutes
  const s = store(), f = (await s.get("fails/_recover", { type: "json" })) || { n: 0, until: 0 };
  if (f.until > Date.now()) return fail(`Too many wrong setup codes. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} minutes.`, 429);
  const want = Buffer.from(secret().slice(0, 8)), got = Buffer.from(String(code || "").trim());
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    f.n = (f.n || 0) + 1; if (f.n >= MAX_FAILS) { f.n = 0; f.until = Date.now() + LOCK_MIN * 60000; }
    await s.setJSON("fails/_recover", f);
    return fail("That setup code is wrong.", 403);
  }
  await s.delete("fails/_recover");
  if (!pinOk(pin)) return fail("Choose a PIN of 4 to 6 digits.");
  const list = await getPeople(), p = list.find(isDirector);
  if (!p) return fail("There is no Director yet.", 404);
  p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(pin, p.salt); p.pv = (p.pv || 1) + 1; p.active = true;
  await putPeople(list); await store().delete("fails/" + p.id);
  return json({ token: newToken(p), me: pub(p) });
}

async function login(req) {
  if (dbMode()) return fail("Sign in with your username or email and your password.", 410);
  const { id, pin } = await req.json().catch(() => ({}));
  const s = store(), p = (await getPeople()).find(x => x.id === id && x.active !== false);
  if (!p) return fail("That person can't sign in. Ask LHQ admin.", 403);
  const f = (await s.get("fails/" + id, { type: "json" })) || { n: 0, until: 0 };
  if (f.until > Date.now()) return fail(`Too many wrong PINs. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} minutes.`, 429);
  const a = Buffer.from(hashPin(pin, p.salt)), b = Buffer.from(p.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    f.n = (f.n || 0) + 1;
    if (f.n >= MAX_FAILS) { f.n = 0; f.until = Date.now() + LOCK_MIN * 60000; }
    await s.setJSON("fails/" + id, f);
    return fail(f.until > Date.now() ? `Too many wrong PINs. Try again in ${LOCK_MIN} minutes.` : "Wrong PIN.", 401);
  }
  if (f.n || f.until) await s.delete("fails/" + id);
  return json({ token: newToken(p), me: pub(p) });
}

async function state(req, me) {
  if (!staff(me)) return fail("Only LHQ admin can open documents.", 403);
  const q = new URL(req.url).searchParams, since = Number(q.get("since"));
  const { data: cur } = await getIndex();
  if (q.has("since") && since >= (cur.floor || 0) && q.get("epoch") === String(cur.epoch || "") && since <= cur.rev) return delta(cur, since, me);
  const [{ data: idx }, docs, kvs] = await Promise.all([getIndex(), readAll("doc/"), Promise.all(KV_KEYS.map(k => store().get("kv/" + k, { type: "json" })))]);
  const kv = {}; KV_KEYS.forEach((k, i) => { if (kvs[i] != null && (!KV_READ[k] || KV_READ[k](me))) kv[k] = kvs[i]; });
  docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return json({ rev: idx.rev, epoch: idx.epoch || "", docs, kv, me: pub(me) });
}
/* only what changed after rev `since` */
async function delta(idx, since, me) {
  const s = store(), ids = Object.entries(idx.docs || {}).filter(([, m]) => (m.r || 0) > since).map(([id]) => id);
  const docs = (await Promise.all(ids.map(id => s.get("doc/" + id, { type: "json" })))).filter(Boolean);
  // a save that has updated the index but not yet written its document: keep the device at `since` so it asks again
  const late = docs.length < ids.length || docs.some(d => (idx.docs[d.id] || {}).savedAt !== d.savedAt);
  const gone = Object.entries(idx.gone || {}).filter(([, r]) => r > since).map(([id]) => id);
  const kv = {}, hide = [];
  for (const k of KV_KEYS) {
    if (KV_READ[k] && !KV_READ[k](me)) { hide.push(k); continue; }
    if (((idx.kvr || {})[k] || 0) > since) { const v = await s.get("kv/" + k, { type: "json" }); if (v != null) kv[k] = v; }
  }
  return json({ delta: true, rev: late ? since : idx.rev, epoch: idx.epoch || "", docs, gone, kv, hide, me: pub(me) });
}

async function rev(req, me) { const { data } = await getIndex(); return json({ rev: data.rev, epoch: data.epoch || "", me: pub(me) }); }
const GONE_KEEP = 3000;
function markGone(idx, id, r) { const g = idx.gone = idx.gone || {}; g[id] = r; const ks = Object.keys(g); if (ks.length > GONE_KEEP) { ks.sort((a, b) => g[a] - g[b]).slice(0, ks.length - GONE_KEEP).forEach(k => { idx.floor = Math.max(idx.floor || 0, g[k]); delete g[k]; }); } }

const SKIP_DIFF = ["savedAt", "updatedAt", "updatedBy", "createdBy", "total", "receivedAmt", "log"];
function changedKeys(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  return [...keys].filter(k => !SKIP_DIFF.includes(k) && canon((a || {})[k] ?? "") !== canon((b || {})[k] ?? ""));
}
/* what this save is allowed to do; returns a message for the first thing that isn't */
async function checkSync(me, upserts, deletes, kv) {
  if (isDirector(me)) return null;
  const s = store();
  for (const u of upserts) {
    const d = u && u.doc; if (!d) continue;
    const need = TYPE_PERM[d.type || "quote"];
    if (can(me, need)) continue;
    // saving a receipt also updates the amount paid on its invoice
    const old = await s.get("doc/" + d.id, { type: "json" });
    if (old && can(me, "receipts") && changedKeys(old, d).every(k => k === "paid")) continue;
    if (old && changedKeys(old, d).every(k => /^(sentAt|sentTo|waSentAt|waSentTo)$/.test(k))) continue;   // recording that it was sent
    return "You don't have permission to save " + (d.type === "card" ? "tuition cards" : d.type + "s") + ".";
  }
  if (deletes.length && !can(me, "delete")) return "You don't have permission to delete documents.";
  for (const [k, v] of kv) {
    const old = (await s.get("kv/" + k, { type: "json" })) || {};
    if (k === "lhq_settings") {
      const ch = changedKeys(Object.assign({}, SETTINGS_DEFAULT, old), Object.assign({}, SETTINGS_DEFAULT, v));
      if (ch.some(f => !LIST_FIELDS.includes(f) && f !== "tutorInfo")) return "Only the Director can change bank, contact and payment details.";
      if (ch.includes("tutorInfo") && !(can(me, "tutors") || can(me, "msgs"))) return "You don't have permission to change tutors' contacts.";
      // a new spending category can be added while recording spending; a new district while adding a student
      const quick = ch.every(f => (f === "spendCats" && can(me, "spend")) || (f === "districts" && (can(me, "students") || can(me, "quotes"))) || (f === "tutorInfo" && can(me, "tutors")) || (f === "tutors" && can(me, "tutors")));
      if (ch.length && !can(me, "msgs") && !quick) return "You don't have permission to change the lists.";
    } else if (k === "lhq_templates") {
      if (changedKeys(old, v).length && !can(me, "msgs")) return "You don't have permission to change the messages.";
    } else if (k === "lhq_counters") {
      // saving a document moves its series forward; setting numbers by hand needs Numbering
      const down = Object.keys(old).some(t => (v || {})[t] < old[t]);
      if (down && !can(me, "numbering")) return "You don't have permission to change numbering.";
    } else if (MERGED.includes(k)) {
      const ch = Object.keys(v || {}).filter(id => canon(v[id]) !== canon(old[id]) && (!old[id] || (v[id].at || 0) >= (old[id].at || 0)));
      if (ch.length && !can(me, "spend")) return "You don't have permission to record spending.";
      if (ch.some(id => old[id] && old[id].by !== me.name)) return "You can only change spending you recorded. Ask the Director to change the others.";
    } else if (["lhq_makeups", "lhq_reqs", "lhq_treps", "lhq_clashes", "lhq_moves", "lhq_confirmer", "lhq_sradone", "lhq_sreports"].includes(k)) {
      if (changedKeys(old, v).length) return "Make-ups, requisitions, clashes and tutors' reports change through their own buttons.";
    } else if (k === "lhq_avail" || k === "lhq_cardack") {
      if (changedKeys(old, v).length && !can(me, "tutors")) return "You don't have permission to change tutors' times.";
    } else if (k === "lhq_budget") {
      if (changedKeys(old, v).length) return "Only the Director can set budgets.";
    } else if (k === "lhq_students") {
      const ch = changedKeys(old, v);
      const onlyNew = ch.every(key => !(key in old));
      if (ch.length && !can(me, "students") && !(onlyNew && can(me, "quotes"))) return "You don't have permission to change student details.";
    }
  }
  return null;
}
function logEntry(old, d, me, now) {
  const log = (old && old.log) || [];
  const add = e => { const last = log[log.length - 1]; if (last && last.a === e.a && last.by === e.by && e.a === "edited" && now - last.at < 30 * 60000) last.at = now; else log.push(e); };
  if (!old) add({ a: "created", by: me.name, at: now, from: d.from || "" });
  else {
    const ch = changedKeys(old, d);
    if (d.sentAt && d.sentAt !== old.sentAt) add({ a: "emailed", by: me.name, at: now, to: d.sentTo || "" });
    if (d.waSentAt && d.waSentAt !== old.waSentAt) add({ a: "whatsapp", by: me.name, at: now, to: d.waSentTo || "" });
    const real = ch.filter(k => !/^(sentAt|sentTo|waSentAt|waSentTo)$/.test(k));
    if (real.length === 1 && real[0] === "paid") add({ a: "paid", by: me.name, at: now, amount: d.paid });
    else if (real.length) add({ a: "edited", by: me.name, at: now });
  }
  return log.slice(-40);
}

async function sync(req, me) {
  if (!staff(me)) return fail("Only LHQ admin can save documents.", 403);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Nothing to save.");
  const s = store(), now = Date.now();
  const upserts = Array.isArray(body.upserts) ? body.upserts : [], deletes = Array.isArray(body.deletes) ? body.deletes : [];
  // students' daily reports change only through the student's own Send, never through a save (not even the Director's)
  const kvIn = body.kv && typeof body.kv === "object" ? Object.entries(body.kv).filter(([k]) => KV_KEYS.includes(k) && k !== "lhq_sreports") : [];
  const denied = await checkSync(me, upserts, deletes, kvIn);
  if (denied) return json({ error: denied, denied: true }, 403);
  const r = await writeDocs(me, upserts, deletes, kvIn);
  return r.error ? fail(r.error, 409) : json(r);
}
/* save documents (and shared lists) safely, with history and Activity: used by sync and by a tutor moving a session */
async function writeDocs(me, upserts, deletes = [], kvIn = []) {
  const s = store(), now = Date.now();
  const remap = {}, conflicts = [], saved = []; let kvOld = {};
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: idx, etag } = await getIndex();
    const docs = idx.docs || {};
    const writes = [];
    for (const u of upserts) {
      const d = u && u.doc; if (!d || !d.id) continue;
      const type = d.type || "quote", prev = docs[d.id];
      // a number already used by another document gets the next free one
      const p = parseNum(type, d.number);
      if (p && p.type === type) {
        const taken = Object.entries(docs).some(([id, x]) => id !== d.id && x.type === type && String(x.number).toUpperCase() === String(d.number).toUpperCase());
        if (taken) {
          let max = 0; Object.values(docs).forEach(x => { const q = parseNum(x.type, x.number); if (q && q.type === type && q.n > max) max = q.n; });
          d.number = fmtNum(type, max + 1); remap[d.id] = d.number;
        }
      }
      if (prev && u.base != null && prev.savedAt !== u.base && prev.savedAt !== d.savedAt) conflicts.push({ id: d.id, number: d.number, by: prev.by || "" });
      d.updatedBy = me.name; d.updatedAt = now;
      if (!prev) d.createdBy = d.createdBy || me.name;
      d.savedAt = d.savedAt || now;
      docs[d.id] = { type, number: d.number, savedAt: d.savedAt, by: me.name, r: (idx.rev || 0) + 1 };
      if (idx.gone) delete idx.gone[d.id];
      writes.push({ d, prev: !!prev });
    }
    for (const x of deletes) { if (x && x.id && docs[x.id]) { delete docs[x.id]; markGone(idx, x.id, (idx.rev || 0) + 1); writes.push({ del: x.id }); } }
    // setting lists are written before the index moves on, so a device that sees the new rev also finds them
    const merged = {}; kvOld = {};
    for (const [k, v] of kvIn) {
      const old = await s.get("kv/" + k, { type: "json" }); kvOld[k] = old;
      if (MERGED.includes(k)) { const m = mergeSpend(old, v, me); merged[k] = m; await s.setJSON("kv/" + k, m); }
      else if (k === "lhq_logs" || k === "lhq_treps") { const m = mergeLogs(old, v); merged[k] = m; await s.setJSON("kv/" + k, m); }
      else if (k === "lhq_classes") { const m = mergeSpend(old, v, me); merged[k] = m; await s.setJSON("kv/" + k, m); }
      else await s.setJSON("kv/" + k, v);
      (idx.kvr = idx.kvr || {})[k] = (idx.rev || 0) + 1;
    }
    idx.docs = docs; idx.rev = (idx.rev || 0) + 1; idx.at = now; if (!idx.epoch) idx.epoch = crypto.randomBytes(6).toString("hex");
    const res = await s.setJSON("index", idx, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (res && res.modified === false) { Object.keys(remap).forEach(k => delete remap[k]); conflicts.length = 0; continue; }   // someone else saved at the same moment: redo
    for (const w of writes) {
      if (w.del) { const old = await s.get("doc/" + w.del, { type: "json" }); if (old) await s.setJSON("trash/" + w.del, Object.assign(old, { deletedBy: me.name, deletedAt: now })); await s.delete("doc/" + w.del); continue; }
      const old = w.prev ? await s.get("doc/" + w.d.id, { type: "json" }) : null;
      if (old) { if (old.createdBy) w.d.createdBy = old.createdBy; await s.setJSON(`hist/${w.d.id}/${now}`, old); }
      w.d.log = logEntry(old, w.d, me, now);
      await s.setJSON("doc/" + w.d.id, w.d); saved.push(w.d);
    }
    await syncActivity(me, writes, kvIn, kvOld, merged);
    return { rev: idx.rev, epoch: idx.epoch, remap, conflicts, saved, kv: merged };
  }
  return { error: "Too many saves at once. Try again." };
}

/* ---------- Activity: one line for everything done in the Hub, by whom (database on). Never stops a save if it fails. ---------- */
const WORDT = { quote: "quote", invoice: "invoice", receipt: "receipt", card: "tuition card" };
const money = n => "MKW " + Math.round(Number(n) || 0).toLocaleString("en-US");
const dayL = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || "")); if (!m) return d || ""; const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][t.getUTCDay()]} ${+m[3]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]}`; };
const docName = d => `${WORDT[d.type || "quote"] || "document"} ${d.number || ""}`.trim() + (d.student || d.name ? " · " + (d.student || d.name) : "");
async function act(me, area, action, summary, entity, entityId, data) {
  if (!dbMode() || !me) return;
  try { await q("INSERT INTO activity (id, actor_id, action, area, entity, entity_id, summary, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    ["ac" + crypto.randomBytes(8).toString("hex"), me.id && /^p/.test(me.id) ? me.id : null, action, area, entity || null, entityId || null, String(summary).slice(0, 300), JSON.stringify(Object.assign({ who: me.name }, data || {}))]); }
  catch (e) { console.error("activity", e.message); }
}
const AREA_SEE = { documents: () => true, students: () => true, teaching: () => true, sessions: () => true, people: () => true, settings: () => true,
  money: p => can(p, "spend") || can(p, "pl"), budgets: p => can(p, "pl"), pay: p => isDirector(p) };
async function activityList(req, me) {
  if (!staff(me)) return fail("Only LHQ admin can see activity.", 403);
  if (!dbMode()) return json({ rows: [], off: true });
  const u = new URL(req.url).searchParams, from = u.get("from") || "1970-01-01", area = u.get("area") || "", who = u.get("who") || "", before = u.get("before") || "";
  const areas = Object.keys(AREA_SEE).filter(a => AREA_SEE[a](me) && (!area || area.split(",").includes(a)));
  const rows = await q(`SELECT a.id, a.action, a.area, a.entity, a.entity_id, a.summary, a.created_at, coalesce(p.name, a.data->>'who', 'LHQ Hub') AS who, p.role
    FROM activity a LEFT JOIN people p ON p.id = a.actor_id
    WHERE NOT a.del AND a.area = ANY($1) AND a.created_at >= $2::timestamptz AND ($3 = '' OR coalesce(p.name, a.data->>'who') = $3) AND ($4 = '' OR a.created_at < $4::timestamptz)
    ORDER BY a.created_at DESC, a.id LIMIT 300`, [areas, from, who, before]);
  const people = (await q(`SELECT DISTINCT coalesce(p.name, a.data->>'who') AS n FROM activity a LEFT JOIN people p ON p.id = a.actor_id WHERE a.area = ANY($1) AND NOT a.del ORDER BY 1`, [areas])).map(r => r.n).filter(Boolean);
  // who did how much in the period (all of them, not only the rows sent), for Who was active
  const counts = (await q(`SELECT coalesce(p.name, a.data->>'who') AS who, p.role, count(*)::int AS n FROM activity a LEFT JOIN people p ON p.id = a.actor_id
    WHERE NOT a.del AND a.area = ANY($1) AND a.created_at >= $2::timestamptz GROUP BY 1, 2 ORDER BY n DESC LIMIT 2000`, [areas, from])).filter(r => r.who);
  return json({ rows, people, areas, counts });
}

/* what a save did, in words: documents, money, students, lists, logs imported */
async function syncActivity(me, writes, kvIn, kvOld, merged) {
  if (!dbMode()) return;
  for (const w of writes) {
    if (w.del) { const t = await store().get("trash/" + w.del, { type: "json" }).catch(() => null); await act(me, "documents", "doc.delete", `Deleted ${t ? docName(t) : w.del}`, "documents", w.del); continue; }
    const d = w.d, l0 = (d.log || [])[(d.log || []).length - 1] || {}, last = l0.at === d.updatedAt ? l0 : { a: w.prev ? "edited" : "created" }, amt = d.type === "receipt" ? d.receivedAmt : d.total;
    const verb = { created: "Made", edited: "Edited", emailed: "Emailed", whatsapp: "Sent on WhatsApp", paid: "Recorded a payment on" }[last.a] || "Saved";
    const action = "doc." + (last.a || "save");
    if (last.a === "edited" && await one("SELECT 1 FROM activity WHERE entity_id = $1 AND action = 'doc.edited' AND data->>'who' = $2 AND created_at > now() - interval '30 minutes'", [d.id, me.name]).catch(() => null)) continue;
    await act(me, "documents", action, `${verb} ${docName(d)}${amt ? " · " + money(amt) : ""}${last.to ? " to " + last.to : ""}`, "documents", d.id);
  }
  for (const [k] of kvIn) {
    const old = kvOld[k] || {}, now = merged[k] || (await store().get("kv/" + k, { type: "json" })) || {};
    if (k === "lhq_spend" || k === "lhq_income") {
      const word = k === "lhq_spend" ? "spending" : "money in";
      for (const [id, e] of Object.entries(now)) {
        if (canon(e) === canon(old[id])) continue;
        const v = !old[id] ? "Recorded" : e.del && !old[id].del ? "Deleted" : "Edited";
        await act(me, "money", "money." + v.toLowerCase(), `${v} ${word} · ${e.cat || ""} · ${money(e.amount)}${e.what ? " · " + e.what : ""}${e.date ? " · " + dayL(e.date) : ""}`, "money", id);
      }
    } else if (k === "lhq_students") {
      const ch = Object.keys(now).filter(x => canon(now[x]) !== canon(old[x]));
      for (const x of ch.slice(0, 10)) await act(me, "students", old[x] ? "student.edit" : "student.add", `${old[x] ? "Updated the details of" : "Added student"} ${(now[x] || {}).name || x}`, "students", x);
    } else if (k === "lhq_settings") {
      const ch = Object.keys(Object.assign({}, old, now)).filter(f => canon(old[f]) !== canon(now[f]));
      if (ch.length) await act(me, "settings", "settings.edit", `Changed ${ch.map(f => ({ levels: "Year & level", spendCats: "spending categories", heardFrom: "how families hear about LHQ", methods: "payment methods", tutors: "tutors on cards", tutorInfo: "tutors' contacts", openHours: "opening hours" }[f] || String(f).replace(/([A-Z])/g, " $1").toLowerCase())).join(", ")}`, "settings", k);
    } else if (k === "lhq_templates") { if (canon(old) !== canon(now)) await act(me, "settings", "messages.edit", "Changed the message wording", "settings", k); }
    else if (k === "lhq_budget") { if (canon(old) !== canon(now)) await act(me, "budgets", "budget.edit", "Changed the budgets", "settings", k); }
    else if (k === "lhq_logs") {
      const n = Object.keys(now.e || {}).filter(id => !(old.e || {})[id]).length;
      if (n) await act(me, "teaching", "logs.import", `Added ${n} log line${n === 1 ? "" : "s"} for tutors (from WhatsApp)`, "logs", null);
    } else if (k === "lhq_classes") { if (canon(old) !== canon(now)) await act(me, "teaching", "classes.edit", "Changed the classes", "classes", null); }
  }
}

/* LHQ confirms or declines a make-up a tutor booked */
async function decideMakeup(req, me) {
  if (!can(me, "tutors")) return fail("You don't have permission to confirm make-ups.", 403);
  const b = await req.json().catch(() => ({})), id = String(b.id || ""), cur = ((await store().get("kv/lhq_makeups", { type: "json" })) || {})[id];
  if (!cur) return fail("That make-up isn't booked.", 404);
  if (!["ok", "no"].includes(b.decision)) return fail("Confirm or decline.");
  if (b.decision === "no" && !String(b.note || "").trim()) return fail("Say why, so the tutor can book another time.");
  const v = Object.assign({}, cur, { status: b.decision, note: String(b.note || "").trim().slice(0, 300), decidedBy: me.name, decidedAt: Date.now() });
  await writeKv("lhq_makeups", old => Object.assign({}, old || {}, { [id]: v }));
  await act(me, "teaching", "makeup." + (b.decision === "ok" ? "confirm" : "decline"), `${b.decision === "ok" ? "Confirmed" : "Declined"} the make-up · ${cur.st} · ${cur.sub} with ${cur.tutor} · ${dayL(cur.d)} ${cur.s}–${cur.e}${v.note ? " · " + v.note : ""}`, "makeups", id);
  return json({ ok: true, makeup: v });
}
/* Requisitions from tutors' daily reports: the Director approves or declines; whoever records spending marks it bought
   with its cost, and the cost goes into Spending */
async function decideReq(req, me) {
  const b = await req.json().catch(() => ({})), key = String(b.key || ""), [rid, i] = key.split("#");
  const rep = (((await store().get("kv/lhq_treps", { type: "json" })) || {}).e || {})[rid], item = rep && (rep.req || [])[+i];
  if (!item) return fail("That requisition isn't in the tutors' reports.", 404);
  const cur = ((await store().get("kv/lhq_reqs", { type: "json" })) || {})[key] || {}, now = Date.now();
  let v;
  if (b.action === "approve" || b.action === "decline") {
    if (!isDirector(me)) return fail("Only the Director approves requisitions.", 403);
    if (cur.s === "bought") return fail("It was already bought.", 409);
    if (b.action === "decline" && !String(b.note || "").trim()) return fail("Say why, so the tutor knows.");
    v = { s: b.action === "approve" ? "approved" : "declined", note: String(b.note || "").trim().slice(0, 300), by: me.name, at: now };
  } else if (b.action === "bought") {
    if (!can(me, "spend")) return fail("You don't have permission to record spending.", 403);
    if (cur.s !== "approved") return fail("Only an approved requisition can be marked bought.", 409);
    const cost = Math.round(+b.cost || 0); if (!(cost > 0)) return fail("Enter what it cost.");
    const sid = "rq" + crypto.randomBytes(5).toString("hex"), day = new Date(now + 2 * 3600e3).toISOString().slice(0, 10);
    const entry = { date: day, cat: String(b.cat || "Stationery").slice(0, 40), amount: cost, what: `${item.item}${item.qty && item.qty !== "1" ? " × " + item.qty : ""} (requisition from ${rep.tutor})`, method: String(b.method || "Cash").slice(0, 30), by: me.name, at: now, req: key };
    await writeKv("lhq_spend", old => mergeSpend(old, { [sid]: entry }, me));
    v = Object.assign({}, cur, { s: "bought", cost, spend: sid, boughtBy: me.name, boughtAt: now });
    await act(me, "money", "money.recorded", `Recorded spending · ${entry.cat} · ${money(cost)} · ${entry.what}`, "money", sid);
  } else return fail("Unknown action.");
  v = Object.assign({ tutor: rep.tutor, item: item.item, qty: item.qty, d: rep.d }, v);
  await writeKv("lhq_reqs", old => Object.assign({}, old || {}, { [key]: v }));
  await act(me, "teaching", "req." + b.action, `${{ approve: "Approved", decline: "Declined", bought: "Bought" }[b.action]} ${item.item}${item.qty && item.qty !== "1" ? " × " + item.qty : ""} for ${rep.tutor}${v.note ? " · " + v.note : ""}${b.action === "bought" ? " · " + money(v.cost) : ""}`, "reqs", key);
  return json({ ok: true, req: v });
}

/* Clashes on the tuition cards, week by week. The tutor has the final say: they teach the students together, move one of
   their own sessions to a free time (only if the number of sessions stays the same, because the invoice was based on it),
   or send it to LHQ. Admin and the Director can do the same, and may change the number. A move tells Admin to tell the family. */
async function sched() { await import("../../site/schedule.js"); return globalThis.SCHED; }
const mwToday = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);   // Malawi, UTC+2
async function clashState() {
  const S = await sched(), cards = (await readAll("doc/")).filter(d => d && d.type === "card");
  const [res, moves, avail] = await Promise.all(["lhq_clashes", "lhq_moves", "lhq_avail"].map(k => store().get("kv/" + k, { type: "json" })));
  const set = (await store().get("kv/lhq_settings", { type: "json" })) || {};
  return { S, cards, res: res || {}, moves: moves || {}, avail: avail || {}, open: set.openHours || null, list: S.weekClashes(cards, mwToday()) };
}
const involves = (c, name) => c.members.some(m => nk(m.tutor) === nk(name));
function moveOptions(S, st, m) {
  const card = st.cards.find(c => c.id === m.card), x = card && (card.subjects || []).find(y => nk(y.name) === nk(m.sub) && nk(y.tutor) === nk(m.tutor));
  if (!x) return null;
  const n0 = S.planned(card, x), len = m.b - m.a, free = S.freeTimes(card, x.name, st.cards, st.avail, { len, open: st.open });
  const days = free.filter(f => f.day === m.day || !(x.days || []).includes(f.day)).map(f => {
    const nd = f.day === m.day ? x.days : x.days.map(z => z === m.day ? f.day : z);
    return { day: f.day, name: f.name, slots: f.slots.filter(t => !(f.day === m.day && t === m.s)), planned: S.planned(card, x, nd) };
  }).filter(f => f.slots.length);
  return { card, x, n0, len, days };
}
async function clashAction(req, me) {
  const b = await req.json().catch(() => ({})), st = await clashState(), S = st.S, now = Date.now(), isStaff = can(me, "tutors");
  if (b.action === "told") {
    if (!isStaff) return fail("Only LHQ can mark a family told.", 403);
    const mv = st.moves[b.id]; if (!mv) return fail("That move isn't here.", 404);
    await writeKv("lhq_moves", old => Object.assign({}, old, { [b.id]: Object.assign({}, mv, { told: { by: me.name, at: now } }) }));
    await act(me, "teaching", "clash.told", `Told the family: ${mv.st}'s ${mv.sub} moved to ${S.DAYN[mv.to.day]} ${mv.to.s}`, "documents", mv.card);
    return json({ ok: true });
  }
  const c = st.list.find(x => x.key === b.key);
  if (!c) return fail("That clash has already been sorted (or the card changed).", 404);
  if (!isStaff && !involves(c, me.name)) return fail("That clash isn't on your cards.", 403);
  const text = S.clashText(c);
  if (b.action === "together" || b.action === "admin" || b.action === "reopen") {
    if (b.action === "together" && c.kind !== "group") return fail("Only students in the same subject can be taught together.");
    if (b.action === "reopen" && !isStaff) return fail("Only LHQ can reopen a clash.", 403);
    const v = b.action === "reopen" ? null : { s: b.action, by: me.name, at: now, note: String(b.note || "").trim().slice(0, 300) };
    await writeKv("lhq_clashes", old => { const o = Object.assign({}, old); if (v) o[c.key] = v; else delete o[c.key]; return o; });
    await act(me, "teaching", "clash." + b.action, b.action === "together" ? `Teaching them together: ${text}` : b.action === "admin" ? `Sent a clash to LHQ: ${text}${v.note ? " · " + v.note : ""}` : `Reopened a clash: ${text}`, "documents", c.members[0].card);
    return json({ ok: true });
  }
  const m = c.members.find(x => x.k === b.k && x.day === c.day);
  if (!m) return fail("Choose which session to move.");
  if (!isStaff && nk(m.tutor) !== nk(me.name)) return fail("You can only move your own sessions.", 403);
  const o = moveOptions(S, st, m); if (!o) return fail("That session isn't on the card any more.", 404);
  if (b.action === "free") return json({ n0: o.n0, len: o.len, from: { day: m.day, s: m.s, e: m.e }, days: o.days });
  if (b.action !== "move") return fail("Unknown action.");
  const to = b.to || {}, opt = o.days.find(f => f.day === to.day);
  if (!opt || !opt.slots.includes(to.s)) return fail("That time isn't free any more. Choose another.", 409);
  if (opt.planned !== o.n0 && !isStaff) return fail(`That would change ${m.st}'s ${m.sub} from ${o.n0} to ${opt.planned} sessions, and the invoice was based on ${o.n0}. Send it to LHQ instead.`, 409);
  const e = S.hhmm(S.mins(to.s) + o.len), card = JSON.parse(JSON.stringify(o.card)), x = card.subjects.find(y => nk(y.name) === nk(m.sub) && nk(y.tutor) === nk(m.tutor));
  const times = Object.assign({}, x.times || {});
  if (to.day === m.day) times[m.day] = { s: to.s, e };
  else { x.days = x.days.map(z => z === m.day ? to.day : z); delete times[m.day]; times[to.day] = { s: to.s, e }; }
  x.times = times; delete card.log;
  const w = await writeDocs(me, [{ doc: card }]); if (w.error) return fail(w.error, 409);
  if (nk(m.tutor) === nk(me.name)) await writeKv("lhq_cardack", old => Object.assign({}, old, { [`${card.id}|${nk(me.name)}`]: { s: "ok", sig: S.sigFor(card, me.name), at: now, note: "moved it themselves" } }));
  const id = "mv" + crypto.randomBytes(5).toString("hex");
  const mv = { id, card: card.id, number: card.number, st: m.st, sub: m.sub, tutor: m.tutor, from: { day: m.day, s: m.s, e: m.e }, to: { day: to.day, s: to.s, e }, n0: o.n0, n1: opt.planned, by: me.name, at: now, told: null };
  await writeKv("lhq_moves", old => Object.assign({}, old, { [id]: mv }));
  await act(me, "teaching", "clash.move", `Moved ${m.st}'s ${m.sub} from ${S.DAYN[m.day]} ${m.s}–${m.e} to ${S.DAYN[to.day]} ${to.s}–${e} (${opt.planned} session${opt.planned === 1 ? "" : "s"}) to sort a clash`, "documents", card.id);
  return json({ ok: true, move: mv });
}
/* the clashes a tutor is part of, with any answer */
async function tutorClashes(me) {
  const st = await clashState();
  return st.list.filter(c => involves(c, me.name)).map(c => Object.assign({ text: st.S.clashText(c), res: st.res[c.key] || null }, c));
}

/* ---------- Students and parents (Stage 2) ----------
   A student sees their own sessions, SRAs and timetable; a parent sees each of their children, and their payments.
   The student confirms their sessions (✓ or ✕); where LHQ switches it on for a child, the parent does instead.
   "Not right" goes to the tutor first (Accept, or Keep mine with a note), back to the student, and only then to LHQ. */
const CF_MS = 48 * 3600e3;
const firstName = n => String(n || "").trim().split(/\s+/)[0];
const cfState = (e, now = Date.now()) => !e || e.x || e.ty !== "s" || e.a === "absent" || e.a === "cancelled" ? null : e.cf && e.cf.s ? e.cf.s : now - (e.c || e.at || 0) >= CF_MS ? "auto" : "waiting";
async function familyOf(me) {
  if (!dbMode()) return [];
  const rows = me.role === "student" ? await q("SELECT id, key, name, level FROM students WHERE person_id = $1 AND NOT del", [me.id])
    : me.role === "parent" ? await q("SELECT s.id, s.key, s.name, s.level FROM guardians g JOIN students s ON s.id = g.student_id WHERE g.parent_id = $1 AND NOT g.del AND NOT s.del ORDER BY s.name", [me.id]) : [];
  return rows.map(r => ({ id: r.id, key: nk(r.name), name: r.name, level: r.level || "" }));
}
const lite = e => ({ id: e.id, d: e.d, t1: e.t1 || "", t2: e.t2 || "", a: e.a || "", sub: e.sub, tutor: e.tutor || "", k: e.k, mk: !!e.mk, tp: e.tp || [], st: cfState(e), cf: e.cf ? { s: e.cf.s, step: e.cf.step || null, kind: e.cf.kind || null, t1: e.cf.t1 || "", t2: e.cf.t2 || "", note: e.cf.note || "", tutorNote: e.cf.tutorNote || "", by: e.cf.by || "", out: e.cf.out || null, lost: e.cf.lost || 0, agreed: !!e.cf.agreed } : null, left: Math.max(0, (e.c || e.at || 0) + CF_MS - Date.now()) });
async function familyData(me) {
  const kids = await familyOf(me);
  if (!kids.length) return { kids: [] };
  await import("../../site/schedule.js"); await import("../../site/sra.js"); const S = globalThis.SCHED, SR = globalThis.SRA;
  const t = mwToday(), docs = (await readAll("doc/")).filter(d => d && !d.del), cards = docs.filter(d => d.type === "card");
  const [logs, conf, done, moves, mus, sreps] = await Promise.all(["lhq_logs", "lhq_confirmer", "lhq_sradone", "lhq_moves", "lhq_makeups", "lhq_sreports"].map(k => store().get("kv/" + k, { type: "json" })));
  await import("../../site/sreport.js"); const SP = globalThis.SREP;
  const E = Object.values((logs && logs.e) || {}).filter(e => e && !e.x);
  const items = S.items(cards, t);
  return { kids: kids.map(kid => {
    const mineK = k => String(k || "").split("|")[0] === kid.key;
    const its = items.filter(it => nk(it.st) === kid.key);
    const confirmer = (conf || {})[kid.key] === "parent" ? "parent" : "student";
    const ent = E.filter(e => mineK(e.k));
    const subjects = its.map(it => { const T = S.tally(it, ent, t, e => cfState(e)); return { k: it.k, sub: it.sub, tutor: it.tutor, days: it.days, times: it.days.map(d => Object.assign({ d }, S.timesOf(it.x, d))), pa: it.pa, b: it.b, cap: it.cap,
      planned: T.planned, expected: T.expected, had: T.had, owed: T.owed, remaining: T.remaining, behind: T.behind, confirmed: T.confirmed, waiting: T.waiting, disputed: T.disputed }; });
    const since = S.addDays(t, -60);
    const sessions = ent.filter(e => e.ty === "s" && e.d >= since).sort((a, b) => (b.d + (b.t1 || "")).localeCompare(a.d + (a.t1 || ""))).map(lite);
    const canConfirm = me.role === confirmer;
    const toConfirm = canConfirm ? sessions.filter(e => e.st === "waiting") : [];
    const answers = canConfirm ? sessions.filter(e => e.st === "disputed" && e.cf && e.cf.step === "student") : [];
    const sras = SR.build(its.map(it => ({ k: it.k, days: it.days, a: it.pa, b: it.b, st: it.st, sub: it.sub })), ent, t)
      .filter(x => x.given && x.status !== "in").map(x => ({ id: [x.k, x.topic, x.stage].join("|"), sub: x.sub, topic: x.topic, label: x.label, stage: x.stage, doOn: x.doOn, due: x.due, status: x.status, done: !!(done || {})[[x.k, x.topic, x.stage].join("|")] }));
    const week = S.sessions(cards, t, S.addDays(t, 13), { student: kid.name }).map(e => ({ date: e.date, s: e.s, e: e.e, sub: e.sub, tutor: e.tutor, where: e.where }));
    const changes = Object.values(moves || {}).filter(m => m && nk(m.st) === kid.key && Date.now() - m.at < 30 * 864e5).sort((a, b) => b.at - a.at).map(m => ({ sub: m.sub, from: m.from, to: m.to, at: m.at, by: m.by }));
    const makeups = Object.values(mus || {}).filter(m => m && nk(m.st) === kid.key && m.status === "ok" && m.d >= t).map(m => ({ d: m.d, s: m.s, e: m.e, sub: m.sub, tutor: m.tutor }));
    let pay = null;
    if (me.role === "parent") {
      const mine = docs.filter(d => nk(d.student) === kid.key && ["invoice", "receipt", "quote"].includes(d.type || "quote"));
      const num = v => Number(String(v || "").replace(/[^\d.-]/g, "")) || 0;
      pay = mine.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 30).map(d => { const total = num(d.total), paid = d.type === "invoice" ? num(d.paid) : 0;
        return { id: d.id, type: d.type || "quote", number: d.number, date: d.date, total, received: num(d.received), paid, balance: d.type === "invoice" ? Math.max(0, total - paid) : 0, due: d.dueDate || d.validUntil || "", over: d.type === "invoice" && total - paid > 0.5 && (d.dueDate || "9") < t }; });
    }
    /* today's report (students only): today's sessions from the card and confirmed make-ups, what was sent, and this week's question if not yet answered */
    let report = null;
    if (me.role === "student") {
      const ses = week.filter(s => s.date === t).map(s => ({ sub: s.sub, tutor: s.tutor, s: s.s, e: s.e }))
        .concat(makeups.filter(m => m.d === t).map(m => ({ sub: m.sub, tutor: m.tutor, s: m.s, e: m.e })));
      const uniq = []; ses.sort((a, b) => a.s.localeCompare(b.s)).forEach(x => { if (!uniq.some(y => y.sub === x.sub)) uniq.push(x); });
      const mineR = (sreps || {})[kid.key] || {}, mon = SP.monday(t);
      const wkDone = Object.entries(mineR).some(([d, r]) => d >= mon && d !== t && r && r.wk);
      const q = SP.weekQ(t);
      if (uniq.length) report = { date: t, ses: uniq, sent: mineR[t] || null, wk: wkDone ? null : { k: q.k, q: q.q, o: q.o } };
    }
    /* marks: weekly assessments and SRA scores, as percentages, for the charts on Progress */
    const pcOf = e => Number(e.mx) > 0 && e.sc != null && e.sc !== "" && !isNaN(Number(e.sc)) ? Math.max(0, Math.min(100, Math.round(Number(e.sc) / Number(e.mx) * 100))) : null;
    const marks = { w: ent.filter(e => e.ty === "w" && !e.abs && pcOf(e) != null).map(e => ({ sub: e.sub, d: e.d, p: pcOf(e) })),
      r: ent.filter(e => e.ty === "r" && e.tk && pcOf(e) != null).map(e => ({ sub: e.sub, tk: e.tk, rv: Number(e.rv) || 0, p: pcOf(e), d: e.d })) };
    return Object.assign({}, kid, { confirmer, canConfirm, subjects, sessions, toConfirm, answers, sras, week, changes, makeups, pay, report, marks });
  }) };
}
async function familyGet(me) {
  if (!["student", "parent"].includes(me.role)) return fail("This part is for students and parents.", 403);
  return json(Object.assign({ me: pub(me), today: mwToday(), now: Date.now() }, await familyData(me)));
}
async function familyPost(req, me) {
  if (!["student", "parent"].includes(me.role)) return fail("This part is for students and parents.", 403);
  const b = await req.json().catch(() => ({})), now = Date.now(), kids = await familyOf(me);
  const txt = (v, n) => String(v || "").trim().slice(0, n), hm = v => /^\d{1,2}:\d{2}$/.test(String(v || "")) ? v : "";
  if (b.action === "done") {   // the student ticks an SRA done (their tutor's Handed in is what counts)
    if (me.role !== "student") return fail("Only the student ticks SRAs done.", 403);
    const id = String(b.id || ""); if (!kids.some(k => id.split("|")[0] === k.key)) return fail("That SRA isn't yours.", 403);
    await writeKv("lhq_sradone", old => { const o = Object.assign({}, old); if (b.done) o[id] = { at: now }; else delete o[id]; return o; });
    return json({ ok: true });
  }
  if (b.action === "report") {   // the student's daily report: three answers a session, what they got, this week's question, a note for LHQ
    if (me.role !== "student") return fail("Students send their own report.", 403);
    await import("../../site/sreport.js"); const SP = globalThis.SREP;
    const fd = await familyData(me), kid = fd.kids && fd.kids[0], rep = kid && kid.report;
    if (!rep) return fail("You have no sessions today.", 409);
    const ses = {}, a0 = b.ses && typeof b.ses === "object" ? b.ses : {};
    for (const x of rep.ses) {
      const a = a0[x.sub] || {}, rate = Number(a.rate), conf = Number(a.conf);
      if (![1, 2, 3, 4, 5].includes(rate) || ![1, 2, 3, 4, 5].includes(conf) || !SP.PREP.includes(a.prep)) return fail(`Answer the three questions for ${x.sub}.`);
      ses[x.sub] = { tutor: x.tutor || "", rate, prep: a.prep, conf, gb: !!a.gb, na: !!a.na, sra: !!a.sra };
    }
    let wk = rep.sent && rep.sent.wk || null;
    if (rep.wk) { if (!rep.wk.o.includes(b.wk)) return fail("Answer this week's question."); wk = { k: rep.wk.k, a: b.wk }; }
    const row = { at: now, ses, wk, note: txt(b.note, 1000) };
    await writeKv("lhq_sreports", old => { const o = Object.assign({}, old); o[kid.key] = Object.assign({}, o[kid.key], { [rep.date]: row }); return o; });
    await act(me, "sessions", "report.sent", `${kid.name} sent ${rep.sent ? "a change to " : ""}the report for ${dayL(rep.date)}`, "sreports", kid.key);
    return json({ ok: true, sent: row });
  }
  const cur = await store().get("kv/lhq_logs", { type: "json" }), e0 = cur && cur.e && cur.e[String(b.id || "")];
  if (!e0 || e0.x || e0.ty !== "s") return fail("That session isn't in the logs.", 404);
  const kid = kids.find(k => String(e0.k || "").split("|")[0] === k.key);
  if (!kid) return fail("That session isn't yours.", 403);
  const conf = (await store().get("kv/lhq_confirmer", { type: "json" })) || {};
  if (me.role !== ((conf[kid.key] === "parent") ? "parent" : "student")) return fail(me.role === "parent" ? `${firstName(kid.name)} confirms their own sessions.` : "Your parent confirms your sessions.", 403);
  const st = cfState(e0, now); let cf, line;
  const what = `${e0.sub} · ${dayL(e0.d)}${e0.tutor ? " with " + e0.tutor : ""}`;
  if (b.action === "confirm") {
    if (st !== "waiting") return fail(st === "auto" ? "That session has already confirmed itself." : "That session has already been answered.", 409);
    cf = { s: "confirmed", by: me.name, at: now }; line = `Confirmed ${kid.name}'s ${what}`;
  } else if (b.action === "dispute") {
    if (st !== "waiting" && st !== "auto") return fail("That session has already been answered.", 409);
    if (st === "auto" && now - (e0.c || e0.at || 0) > 7 * 864e5) return fail("Sessions older than a week can't be changed here. Ask LHQ.", 409);
    const kind = ["late", "early", "none", "other"].includes(b.kind) ? b.kind : "other";
    if (kind === "other" && !txt(b.note, 300)) return fail("Say what happened.");
    cf = { s: "disputed", step: "tutor", by: me.name, from: me.name, at: now, kind, t1: hm(b.t1), t2: hm(b.t2), note: txt(b.note, 300) };
    line = `Said ${kid.name}'s ${what} wasn't right (${{ late: "started late", early: "ended early", none: "didn't happen", other: "other" }[kind]})`;
  } else if (b.action === "reply") {   // after the tutor kept their times: fine, or still not right (goes to LHQ)
    if (!(e0.cf && e0.cf.s === "disputed" && e0.cf.step === "student")) return fail("Nothing to answer here.", 409);
    cf = b.ok ? Object.assign({}, e0.cf, { s: "confirmed", agreed: true, by: me.name, at: now, step: null }) : Object.assign({}, e0.cf, { step: "lhq", at: now });
    line = b.ok ? `Agreed with the tutor about ${kid.name}'s ${what}` : `Sent ${kid.name}'s ${what} to LHQ to settle`;
  } else return fail("Unknown action.");
  const next = await writeKv("lhq_logs", old => { const o = old || { e: {} }, e = Object.assign({}, o.e); e[e0.id] = Object.assign({}, e[e0.id], { cf, at: now }); return Object.assign({}, o, { e }); });
  await act(me, "sessions", "session." + b.action, line, "logs", e0.id);
  return json({ ok: true, entry: lite(next.e[e0.id]) });
}
/* LHQ chooses who confirms a child's sessions: the student (default) or the parent */
async function setConfirmer(req, me) {
  if (!can(me, "tutors") && !can(me, "students")) return fail("You can't change this.", 403);
  const b = await req.json().catch(() => ({})), key = nk(b.key || ""); if (!key) return fail("Which student?");
  await writeKv("lhq_confirmer", old => { const o = Object.assign({}, old); if (b.who === "parent") o[key] = "parent"; else delete o[key]; return o; });
  await act(me, "students", "confirmer", `${b.who === "parent" ? "The parent" : "The student"} confirms ${b.name || key}'s sessions`, "students", key);
  return json({ ok: true });
}

/* Confirming a logged session. A session a tutor logged counts (for reports and pay) once it is confirmed: by the student
   or a parent (stage 2), by LHQ on their behalf (saying how), or on its own 48 hours after it was logged with no reply.
   A dispute holds it until LHQ settles it: the tutor's times stand, or the minutes lost are taken off. */
const CONFIRM_HOURS = 48;
async function confirmSession(req, me) {
  if (!can(me, "tutors")) return fail("You don't have permission to settle sessions.", 403);
  const b = await req.json().catch(() => ({})), id = String(b.id || ""), now = Date.now();
  if ((b.action === "confirm" || b.action === "dispute") && !(me.role === "student" || me.role === "parent")) return fail("Students confirm their own sessions. Until they have accounts, sessions confirm themselves 48 hours after the tutor logs them.", 403);

  const txt = (v, n) => String(v || "").trim().slice(0, n), hm = v => /^\d{1,2}:\d{2}$/.test(String(v || "")) ? v : "";
  const cur = await store().get("kv/lhq_logs", { type: "json" }), e0 = cur && cur.e && cur.e[id];
  if (!e0 || e0.x || e0.ty !== "s") return fail("That session isn't in the logs.", 404);
  if (e0.a === "absent" || e0.a === "cancelled") return fail("A missed session has nothing to confirm.");
  const was = e0.cf && e0.cf.s;
  let cf;
  // LHQ oversees: it settles disputes. Confirming and disputing is the student's (or, where LHQ allows it, a parent's) from Stage 2;
  // until then a session confirms itself 48 hours after it was logged.
  if (b.action === "confirm") {
    if (was === "disputed") return fail("This session is disputed: settle it instead.", 409);
    if (!txt(b.how, 200)) return fail("Say how it was confirmed, e.g. by phone with the parent.");
    cf = { s: "confirmed", by: me.name, at: now, how: txt(b.how, 200), onBehalf: true };
  } else if (b.action === "dispute") {
    if (was === "settled") return fail("This session was already settled.", 409);
    if (!txt(b.note, 500)) return fail("Say what was different.");
    cf = { s: "disputed", by: me.name, at: now, onBehalf: true, from: txt(b.from, 60) || "the student", note: txt(b.note, 500), t1: hm(b.t1), t2: hm(b.t2), lost: Math.max(0, Math.min(600, Math.round(+b.lost || 0))) };
  } else if (b.action === "settle") {
    if (was !== "disputed") return fail("Only a disputed session can be settled.", 409);
    const lost = b.out === "keep" ? 0 : Math.max(0, Math.min(600, Math.round(+b.lost || 0)));
    cf = Object.assign({}, e0.cf, { s: "settled", by: me.name, at: now, out: b.out === "keep" ? "keep" : "lost", lost, note2: txt(b.note, 500), disputedBy: e0.cf.by, disputedAt: e0.cf.at });
  } else return fail("Unknown action.");
  const next = await writeKv("lhq_logs", old => { const o = old || { e: {} }, e = Object.assign({}, o.e); e[id] = Object.assign({}, e[id], { cf, at: now }); return Object.assign({}, o, { e }); });
  const what = `${e0.st} · ${e0.sub} · ${dayL(e0.d)}${e0.tutor ? " with " + e0.tutor : ""}`;
  await act(me, "sessions", "session." + b.action, b.action === "confirm" ? `Confirmed ${what} for the family (${cf.how})` : b.action === "dispute" ? `Recorded a dispute: ${what} · ${cf.from}: "${cf.note}"`
    : `Settled ${what}: ${cf.out === "keep" ? "the tutor's times stand" : cf.lost + " min taken off"}`, "logs", id);
  return json({ ok: true, entry: next.e[id] });
}

/* Moving the Hub into the database (Director only): see where things are, copy, check, then switch (and back, if ever needed) */
async function countKeys(s) {
  const L = (await s.list()).blobs.map(b => b.key), c = p => L.filter(k => k.startsWith(p)).length;
  return { all: L.length, docs: c("doc/"), history: c("hist/"), deleted: c("trash/"), lists: c("kv/"), index: L.includes("index") };
}
async function docTotals(s) {
  const docs = s.getAll ? await s.getAll("doc/") : await Promise.all((await s.list({ prefix: "doc/" })).blobs.map(b => s.get(b.key, { type: "json" })));
  const t = {}; docs.filter(Boolean).forEach(d => { const k = d.type || "quote"; t[k] = t[k] || { n: 0, amount: 0 }; t[k].n++; t[k].amount += Number(d.total || d.receivedAmt || 0) || 0; });
  return t;
}
async function hubStore(req, me) {
  if (!isDirector(me)) return fail("Only the Director can move the Hub's storage.", 403);
  if (!dbMode()) return fail("The database isn't switched on for this site.", 410);
  const b = await req.json().catch(() => ({}));
  const status = async () => {
    const [onBlobs, onDb] = await Promise.all([countKeys(blobs()), countKeys(pgStore)]);
    const [tb, td] = await Promise.all([docTotals(blobs()), docTotals(pgStore)]);
    const same = JSON.stringify(Object.keys(tb).sort().map(k => [k, tb[k].n, Math.round(tb[k].amount)])) === JSON.stringify(Object.keys(td).sort().map(k => [k, (td[k] || {}).n, Math.round((td[k] || {}).amount || 0)]));
    return { using: storeOnDb ? "db" : "blobs", blobs: onBlobs, db: onDb, totals: { blobs: tb, db: td }, match: same && onBlobs.all === onDb.all };
  };
  if (b.action === "move") {
    if (storeOnDb && !b.replace) return fail("The Hub already uses the database. Moving again would overwrite newer work.", 409);
    const r = await copyBlobs(blobs(), { replace: !!b.replace, from: Math.max(0, +b.from || 0) });
    return json(r.more ? { moved: r, more: true, next: r.next } : Object.assign({ moved: r }, await status()));
  }
  if (b.action === "back") {   // before switching back: copy the database into the old storage, so nothing saved since is lost
    const r = await copyToBlobs(blobs(), { from: Math.max(0, +b.from || 0) });
    return json(r.more ? { back: r, more: true, next: r.next } : Object.assign({ back: r }, await status()));
  }
  if (b.action === "use") {
    const to = b.to === "db" ? "db" : "blobs";
    if (to === "db" && !(await pgStore.get("index"))) return fail("Copy the Hub into the database first.", 409);
    await q("INSERT INTO settings (id, key, scope, value) VALUES ('set_hub_store', 'hub_store', 'staff', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, del = false", [JSON.stringify(to)]);
    storeOnDb = to === "db";
    return json(await status());
  }
  return json(await status());
}

/* Preview only: replace everything with demo data, or empty it. Never on the live site. */
async function wipe(keepPeople) {
  const s = store();
  for (const prefix of ["doc/", "hist/", "trash/", "kv/", "fails/"]) { const { blobs } = await s.list({ prefix }); for (const b of blobs) await s.delete(b.key); }
  await s.delete("index");
  const list = (await getPeople()).filter(p => keepPeople(p));
  await putPeople(list);
  return list;
}
async function demo(req, me) {
  if (!isPreview()) return fail("Demo data only works on a preview, never on the live site.", 403);
  if (!isDirector(me)) return fail("Only the Director can load demo data.", 403);
  const b = await req.json().catch(() => null);
  if (!b || !Array.isArray(b.docs)) return fail("No demo data was sent.");
  const list = await wipe(p => p.id === me.id);
  for (const x of b.people || []) {
    if (list.some(p => p.name.toLowerCase() === String(x.name).toLowerCase())) continue;
    const salt = crypto.randomBytes(16).toString("hex");
    list.push({ id: "p" + crypto.randomBytes(5).toString("hex"), name: String(x.name), role: x.role === "admin" ? "admin" : "tutor", perms: x.role === "admin" ? (Array.isArray(x.perms) ? x.perms.filter(k => PERMS.includes(k)) : ADMIN_DEFAULT.slice()) : [], tutor: true, active: x.active !== false, salt, hash: hashPin(x.pin || "1111", salt), pv: 1, seen: x.seen || 0 });
  }
  await putPeople(list);
  const s = store(), docs = {}, now = Date.now();
  for (let i = 0; i < b.docs.length; i += 20) await Promise.all(b.docs.slice(i, i + 20).map(d => { docs[d.id] = { type: d.type || "quote", number: d.number, savedAt: d.savedAt || now, by: d.updatedBy || "" }; return s.setJSON("doc/" + d.id, d); }));
  for (const d of b.trash || []) await s.setJSON("trash/" + d.id, d);
  for (const [k, v] of Object.entries(b.kv || {})) if (KV_KEYS.includes(k)) await s.setJSON("kv/" + k, v);
  Object.values(docs).forEach(m => { m.r = now; });
  await s.setJSON("index", { rev: now, docs, at: now, epoch: crypto.randomBytes(6).toString("hex") });
  return json({ ok: true, docs: b.docs.length, people: list.map(pub) });
}
async function reset(req, me) {
  if (!isPreview()) return fail("This only works on a preview, never on the live site.", 403);
  if (!isDirector(me)) return fail("Only the Director can empty the preview.", 403);
  const list = await wipe(p => p.id === me.id);
  await store().setJSON("index", { rev: Date.now(), docs: {}, at: Date.now(), epoch: crypto.randomBytes(6).toString("hex") });
  return json({ ok: true, people: list.map(pub) });
}

/* Recently deleted: list (older than 30 days are removed for good) and restore */
async function trash(req, me) {
  if (!can(me, "restore")) return fail("You don't have permission to restore documents.", 403);
  const s = store(), all = await readAll("trash/"), keep = [];
  for (const d of all) {
    if (Date.now() - (d.deletedAt || 0) > TRASH_DAYS * 864e5) await s.delete("trash/" + d.id);
    else keep.push({ id: d.id, type: d.type || "quote", number: d.number, student: d.student || d.name || "", deletedBy: d.deletedBy || "", deletedAt: d.deletedAt || 0 });
  }
  keep.sort((a, b) => b.deletedAt - a.deletedAt);
  return json({ trash: keep });
}
async function restore(req, me) {
  if (!can(me, "restore")) return fail("You don't have permission to restore documents.", 403);
  const { id } = await req.json().catch(() => ({}));
  const s = store(), d = await s.get("trash/" + id, { type: "json" });
  if (!d) return fail("That document is no longer in Recently deleted.", 404);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: idx, etag } = await getIndex(), docs = idx.docs || {}, type = d.type || "quote", now = Date.now();
    let note = "";
    if (Object.entries(docs).some(([k, x]) => k !== d.id && x.type === type && String(x.number).toUpperCase() === String(d.number).toUpperCase())) {
      let max = 0; Object.values(docs).forEach(x => { const q = parseNum(x.type, x.number); if (q && q.type === type && q.n > max) max = q.n; });
      note = d.number; d.number = fmtNum(type, max + 1);
    }
    delete d.deletedBy; delete d.deletedAt;
    d.savedAt = now; (d.log = d.log || []).push({ a: "restored", by: me.name, at: now, was: note });
    docs[d.id] = { type, number: d.number, savedAt: now, by: me.name, r: (idx.rev || 0) + 1 };
    if (idx.gone) delete idx.gone[d.id];
    idx.docs = docs; idx.rev = (idx.rev || 0) + 1; idx.at = now; if (!idx.epoch) idx.epoch = crypto.randomBytes(6).toString("hex");
    const res = await s.setJSON("index", idx, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (res && res.modified === false) continue;
    await s.setJSON("doc/" + d.id, d); await s.delete("trash/" + d.id);
    await act(me, "documents", "doc.restore", `Restored ${docName(d)}${note ? " (was " + note + ")" : ""}`, "documents", d.id);
    return json({ ok: true, doc: d, rev: idx.rev, renumbered: note });
  }
  return fail("Too many saves at once. Try again.", 409);
}

async function managePeople(req, me) {
  const b = await req.json().catch(() => ({}));
  if (dbMode()) {
    if (b.action === "mypin" || b.action === "pin") return fail("PINs are replaced by passwords. Use a setup code instead.", 410);
    if (["add", "code", "unlock", "outall", "email", "username", "off", "on", "students", "link"].includes(b.action)) {
      if (!staff(me)) return fail("Only LHQ admin can manage people.", 403);
      const r = await A.manage(me, b);
      return json(Object.assign({ ok: true }, r, b.action === "students" ? {} : { people: (await A.peopleForStaff(me)).map(pub) }));
    }
    if (b.action === "list") { if (!staff(me)) return fail("Only LHQ admin can manage people.", 403); return json({ people: (await A.peopleForStaff(me)).map(pub) }); }
  }
  const list = await getPeople();
  const find = id => list.find(p => p.id === id);
  if (b.action === "mypin") {
    const p = find(me.id);
    if (hashPin(b.current, p.salt) !== p.hash) return fail("Your current PIN is wrong.", 401);
    if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
    p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(b.pin, p.salt); p.pv = (p.pv || 1) + 1;
    await putPeople(list); return json({ ok: true, token: newToken(p), people: list.map(pub) });
  }
  if (b.action === "view") {   // what each person sees: lean (the default) or full
    const p = find(me.id); p.view = b.view === "full" ? "full" : "lean";
    await putPeople(list); return json({ ok: true, me: pub(p) });
  }
  if (b.action === "nav") {   // what each person keeps in the bar and sidebar (after Home): up to 3 places, or null for the default
    const p = find(me.id), OK = ["students", "docs", "business", "reports", "calendar", "tutors", "activity", "teach", "settings"];
    p.nav = Array.isArray(b.nav) ? [...new Set(b.nav.filter(x => OK.includes(x)))].slice(0, 3) : null;
    await putPeople(list); return json({ ok: true, me: pub(p) });
  }
  if (b.action === "home") {   // each person's own Home cards
    const p = find(me.id); p.home = Array.isArray(b.cards) ? b.cards.filter(x => typeof x === "string").slice(0, 6) : null;
    await putPeople(list); return json({ ok: true, me: pub(p) });
  }
  if (b.action === "cards") {   // each person's own cards on Business, Students, a student's page, Tutors
    const page = String(b.page || "");
    if (!/^(biz|students|student|tutors|teach|tstudent)$/.test(page)) return fail("Unknown page.");
    const ok = x => typeof x === "string" ? x.length <= 40 : x && typeof x === "object" && JSON.stringify(x).length <= 600;
    const chosen = Array.isArray(b.cards) ? b.cards.filter(ok).slice(0, 16) : null;
    const p = find(me.id); p.cards = Object.assign({}, p.cards || {}, { [page]: chosen });
    if (JSON.stringify(p.cards).length > 8000) return fail("Too many cards.");
    await putPeople(list); return json({ ok: true, me: pub(p) });
  }
  if (!staff(me)) return fail("Only LHQ admin can manage people.", 403);
  if (b.action === "list") return json({ people: list.map(pub) });
  const D = isDirector(me);
  // admins with the "tutors" permission look after tutors only; everything else is the Director's
  const mayTouch = p => D ? true : (can(me, "tutors") && p.role === "tutor");
  if (b.action === "add") {
    const role = D && b.role === "admin" ? "admin" : "tutor";
    if (!D && !can(me, "tutors")) return fail("Only the Director can add people.", 403);
    if (!String(b.name || "").trim()) return fail("Add a name.");
    if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
    if (list.some(p => p.name.toLowerCase() === String(b.name).trim().toLowerCase())) return fail("Someone with that name already exists.");
    const salt = crypto.randomBytes(16).toString("hex");
    list.push({ id: "p" + crypto.randomBytes(5).toString("hex"), name: String(b.name).trim(), role, perms: role === "admin" ? ADMIN_DEFAULT.slice() : [], tutor: role === "tutor" ? true : !!b.tutor, active: true, salt, hash: hashPin(b.pin, salt), pv: 1 });
  } else {
    const p = find(b.id); if (!p) return fail("Person not found.", 404);
    if (p.id === me.id) return fail("Change your own PIN under My account.");
    if (isDirector(p)) return fail("Nobody can change the Director's account.", 403);
    if (!mayTouch(p)) return fail("Only the Director can change this person.", 403);
    if (b.action === "access") {   // Director: role, teaching, permissions
      if (!D) return fail("Only the Director can change permissions.", 403);
      if (b.role) { if (!["admin", "tutor"].includes(b.role)) return fail("Unknown role."); if (b.role !== p.role) p.perms = b.role === "admin" ? ADMIN_DEFAULT.slice() : []; p.role = b.role; }
      if (Array.isArray(b.perms)) p.perms = p.role === "admin" ? b.perms.filter(x => PERMS.includes(x)) : [];
      if (typeof b.tutor === "boolean") p.tutor = p.role === "tutor" ? true : b.tutor;
      if (b.name && String(b.name).trim()) p.name = String(b.name).trim();
    } else if (b.action === "pin") {
      if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
      p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(b.pin, p.salt); p.pv = (p.pv || 1) + 1;
      await store().delete("fails/" + p.id);
    } else if (b.action === "off") { p.active = false; p.pv = (p.pv || 1) + 1; }
    else if (b.action === "on") { p.active = true; }
    else if (b.action === "remove") {
      if (!D) return fail("Only the Director can remove accounts.", 403);
      list.splice(list.indexOf(p), 1);
    }
    else return fail("Unknown action.");
  }
  await putPeople(list);
  return json({ ok: true, people: list.map(pub) });
}

/* ---------- the tutor area: a tutor sees only their own students' tuition cards and logs ---------- */
const nk = v => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const isTutor = p => p && (p.role === "tutor" || p.tutor);
async function tutorData(me) {
  const mine = n => nk(n) === nk(me.name);
  const cards = (await readAll("doc/")).filter(d => d.type === "card" && (d.subjects || []).some(x => mine(x.tutor)))
    .map(c => ({ id: c.id, number: c.number, date: c.date, student: c.student, level: c.level, exam: c.exam, school: c.school, where: c.where,
      periodStart: c.periodStart, periodEnd: c.periodEnd, period: c.period, cardNote: c.cardNote, savedAt: c.savedAt, updatedAt: c.updatedAt || c.savedAt, createdAt: ((c.log || [])[0] || {}).at || c.savedAt, subjects: (c.subjects || []).filter(x => mine(x.tutor)) }));
  const keys = new Set(); cards.forEach(c => c.subjects.forEach(x => keys.add(nk(c.student) + "|" + nk(x.name))));
  const [logs, classes, reps] = await Promise.all(["lhq_logs", "lhq_classes", "lhq_treps"].map(k => store().get("kv/" + k, { type: "json" })));
  const entries = Object.values((logs && logs.e) || {}).filter(e => e && (keys.has(e.k) || mine(e.tutor)));
  const cls = Object.values(classes || {}).filter(c => c && !c.del && mine(c.tutor));
  const since = new Date(Date.now() - 100 * 864e5).toISOString().slice(0, 10);
  const reports = Object.values((reps && reps.e) || {}).filter(r => r && mine(r.tutor) && (r.d || "") >= since);
  return { cards, keys, entries, classes: cls, reports };
}
/* write one shared key safely when several tutors save at once, then tell staff devices it changed */
async function writeKv(k, change) {
  const s = store();
  for (let i = 0; i < 6; i++) {
    const r = await s.getWithMetadata("kv/" + k, { type: "json" });
    const next = change(r ? r.data : null);
    const res = await s.setJSON("kv/" + k, next, r ? { onlyIfMatch: r.etag } : { onlyIfNew: true });
    if (res && res.modified === false) continue;
    for (let j = 0; j < 6; j++) {
      const { data: idx, etag } = await getIndex();
      (idx.kvr = idx.kvr || {})[k] = (idx.rev || 0) + 1; idx.rev = (idx.rev || 0) + 1; idx.at = Date.now(); if (!idx.epoch) idx.epoch = crypto.randomBytes(6).toString("hex");
      const w = await s.setJSON("index", idx, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      if (!(w && w.modified === false)) break;
    }
    return next;
  }
  throw new Error("Too many saves at once. Try again.");
}
async function tutorGet(me) {
  if (!isTutor(me)) return fail("This part is for tutors.", 403);
  const d = await tutorData(me), x = await tutorExtras(me, d);
  return json(Object.assign({ me: pub(me), cards: d.cards, entries: d.entries, classes: d.classes, reports: d.reports, now: Date.now() }, x));
}
/* A private calendar link per tutor (for Google Calendar or an iPhone): their LHQ sessions from two weeks ago to twelve
   weeks ahead, rebuilt every time the phone asks. The link carries a signature instead of a sign-in. */
const calSig = id => crypto.createHmac("sha256", secret()).update("cal:" + id).digest("hex").slice(0, 24);
const calPath = id => `/api/hub/cal/${id}.${calSig(id)}.ics`;
async function calFeed(path) {
  const m = /^cal\/([\w-]{3,40})\.([a-f0-9]{24})\.ics$/.exec(path);
  if (!m || !crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(calSig(m[1])))) return new Response("Not found", { status: 404 });
  const p = (await getPeople()).find(x => x.id === m[1] && x.active !== false);
  if (!p) return new Response("Not found", { status: 404 });
  await import("../../site/schedule.js"); const S = globalThis.SCHED;
  const cards = (await readAll("doc/")).filter(d => d.type === "card");
  const t0 = new Date(Date.now() - 14 * 864e5), t1 = new Date(Date.now() + 84 * 864e5), day = d => d.toISOString().slice(0, 10);
  const L = S.sessions(cards, day(t0), day(t1), { tutor: p.name }).filter(e => e.a != null && e.b != null);
  const esc = v => String(v || "").replace(/[\\;,]/g, x => "\\" + x).replace(/\n/g, "\\n");
  const utc = (date, mins) => { const [y, mo, d] = date.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1, d, 0, mins) - 2 * 3600e3);   // Malawi is UTC+2 all year
    return t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); };
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = L.map(e => ["BEGIN:VEVENT", `UID:${e.card}-${e.k.replace(/[^a-z0-9]/g, "")}-${e.date}@lhq-hub`, `DTSTAMP:${now}`, `DTSTART:${utc(e.date, e.a)}`, `DTEND:${utc(e.date, e.b)}`,
    `SUMMARY:${esc(e.student + " · " + e.sub)}`, `LOCATION:${esc(e.where || "LHQ")}`, `DESCRIPTION:${esc("LHQ tuition · " + (e.number || "") + "\nCheck LHQ Hub for any change made today.")}`, "END:VEVENT"].join("\r\n"));
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LHQ Learning Solutions//LHQ Hub//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc("LHQ · " + p.name)}`, "X-WR-TIMEZONE:Africa/Blantyre", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", ...ev, "END:VCALENDAR"].join("\r\n") + "\r\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" } });
}

/* a tutor's own unavailable times, what they've acknowledged, and cards they've been taken off (to be told once) */
async function tutorExtras(me, d) {
  const mk = nk(me.name);
  let [av, ack] = await Promise.all(["lhq_avail", "lhq_cardack"].map(k => store().get("kv/" + k, { type: "json" })));
  /* cards saved before acknowledgements started count as already acknowledged, so nobody is told about every student at once */
  if (!ack || !ack._from) ack = await writeKv("lhq_cardack", old => Object.assign({}, old || {}, { _from: (old && old._from) || Date.now() }));
  const acks = {}, gone = [], mine = new Set(d.cards.map(c => c.id));
  Object.entries(ack || {}).forEach(([k, v]) => { const [cid, t] = k.split("|"); if (t !== mk || !v || typeof v !== "object") return; acks[cid] = v; if (!mine.has(cid) && v.s !== "gone") gone.push(Object.assign({ card: cid }, v)); });
  const [mu, rq] = await Promise.all(["lhq_makeups", "lhq_reqs"].map(k => store().get("kv/" + k, { type: "json" })));
  const makeups = Object.values(mu || {}).filter(x => x && nk(x.tutor) === mk);
  const reqs = {}; Object.entries(rq || {}).forEach(([k, v]) => { if (v && nk(v.tutor) === mk) reqs[k] = v; });
  const sd = (await store().get("kv/lhq_sradone", { type: "json" })) || {}, sradone = {};
  Object.keys(sd).forEach(k => { if (d.keys.has(k.split("|").slice(0, 2).join("|"))) sradone[k] = sd[k]; });
  /* what students say: this tutor's averages beside LHQ's, over the last 4 weeks, only once reports are 4 weeks old and with 5+ answers */
  await import("../../site/sreport.js"); const SP = globalThis.SREP;
  const R = (await store().get("kv/lhq_sreports", { type: "json" })) || {}, tday = mwToday(), opens = SP.opensOn(R);
  let says = { opens: opens || null };
  if (opens && opens <= tday) { const B = SP.byTutor(R, tday), mine = Object.entries(B.tutors).find(([k]) => nk(k) === mk); says = mine && mine[1].n >= 5 ? { mine: mine[1], lhq: B.all, from: B.from } : { few: true }; }
  return { avail: (av || {})[mk] || [], acks, gone, ackFrom: ack._from, calLink: calPath(me.id), makeups, reqs, clashes: await tutorClashes(me), sradone, says };
}
async function tutorPost(req, me) {
  if (!isTutor(me)) return fail("This part is for tutors.", 403);
  const b = await req.json().catch(() => ({}));
  const d = await tutorData(me), now = Date.now();
  if (b.action === "entries") {
    const list = (Array.isArray(b.entries) ? b.entries : []).slice(0, 200);
    for (const e of list) {
      if (!e || typeof e !== "object" || !/^[\w-]{4,40}$/.test(String(e.id || ""))) return fail("An entry couldn't be read.");
      if (!d.keys.has(e.k)) return fail("That student isn't on your tuition cards.", 403);
      if (JSON.stringify(e).length > 4000) return fail("An entry is too long.");
    }
    const prev = {}; d.entries.forEach(e => prev[e.id] = e);
    // a session that is confirmed (by the student, or by itself after 48 hours) or settled can't be changed by the tutor
    const locked = e => e && e.ty === "s" && !e.x && e.a !== "absent" && e.a !== "cancelled" && ((e.cf && e.cf.s) || now - (e.c || e.at || 0) >= 48 * 3600e3);
    const same = (p, e) => ["a", "t1", "t2", "d", "k", "x"].every(f => String(p[f] ?? "") === String(e[f] ?? ""));
    const stuck = list.find(e => locked(prev[e.id]) && !same(prev[e.id], e));
    if (stuck) return fail(`${stuck.st || "That"} session on ${dayL(prev[stuck.id].d)} is confirmed, so its times and attendance can't change. Ask LHQ if something is wrong.`, 409);
    const add = {}; list.forEach(e => { if (prev[e.id] && nk(prev[e.id].tutor) && nk(prev[e.id].tutor) !== nk(me.name)) return; add[e.id] = Object.assign({}, e, { tutor: me.name, at: now, via: "hub" }); });
    const before = await store().get("kv/lhq_logs", { type: "json" });
    await writeKv("lhq_logs", old => mergeLogs(old, { e: add }));
    const fresh = Object.values(add).filter(e => !((before && before.e) || {})[e.id]), edits = Object.keys(add).length - fresh.length;
    const TY = { s: "session", g: "SRA given", r: "SRA marked", w: "assessment mark" }, cnt = {};
    fresh.forEach(e => { const t = TY[e.ty] || "line"; cnt[t] = (cnt[t] || 0) + 1; });
    const sess = fresh.filter(e => e.ty === "s"), first = sess[0] || fresh[0];
    if (fresh.length === 1 && first) await act(me, "teaching", "log.add", `Logged a ${TY[first.ty] || "line"} · ${first.st} · ${first.sub} · ${dayL(first.d)}`, "logs", first.id);
    else if (fresh.length) await act(me, "teaching", "log.add", `Logged ${Object.entries(cnt).map(([t, n]) => n + " " + t + (n === 1 ? "" : "s")).join(", ")}${sess.length ? " · " + [...new Set(sess.map(e => e.st))].slice(0, 4).join(", ") : ""}`, "logs", first.id);
    if (edits) await act(me, "teaching", "log.edit", `Changed ${edits} logged line${edits === 1 ? "" : "s"}`, "logs", null);
    return json({ ok: true, saved: Object.values(add) });
  }
  if (b.action === "report") {   // the tutor's daily report: one per tutor per day, sent again replaces it
    const r = b.report || {}, d0 = String(r.d || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d0)) return fail("The report needs a date.");
    const stuKeys = new Set([...d.keys].map(k => k.split("|")[0]));
    const txt = (v, n) => String(v || "").trim().slice(0, n);
    const req = (Array.isArray(r.req) ? r.req : []).slice(0, 20).map(q => ({ item: txt(q.item, 200), qty: txt(q.qty, 10), by: /^\d{4}-\d{2}-\d{2}$/.test(q.by || "") ? q.by : "", for: stuKeys.has(nk(q.for)) ? nk(q.for) : "" })).filter(q => q.item);
    const f = r.flag || {}, flag = stuKeys.has(nk(f.st)) ? { st: nk(f.st), why: (Array.isArray(f.why) ? f.why : []).map(w => txt(w, 30)).slice(0, 6), text: txt(f.text, 500) } : null;
    const rep = { id: "r" + nk(me.name).replace(/[^a-z0-9]/g, "") + d0.replace(/-/g, ""), d: d0, tutor: me.name, req, flag, comment: txt(r.comment, 1500), rate: [1, 2, 3, 4, 5].includes(+r.rate) ? +r.rate : 0, gaps: Math.max(0, Math.min(99, +r.gaps || 0)), hours: Math.max(0, Math.min(24, +r.hours || 0)), sent: now, at: now };
    rep.id = rep.id.slice(0, 40);
    await writeKv("lhq_treps", old => mergeLogs(old, { e: { [rep.id]: rep } }));
    await act(me, "teaching", "report.send", `Sent the daily report for ${dayL(d0)}${rep.req.length ? " · asked for " + rep.req.map(x => x.item).join(", ") : ""}${rep.flag ? " · flagged a student" : ""}`, "tutor_reports", rep.id);
    return json({ ok: true, report: rep });
  }
  if (b.action === "avail") {   // the times this tutor can't teach: [{d, s, e, note}]
    const ok = t => /^\d{2}:\d{2}$/.test(String(t || ""));
    const L = (Array.isArray(b.blocks) ? b.blocks : []).slice(0, 40).filter(x => x && ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].includes(x.d) && ok(x.s) && ok(x.e) && x.s < x.e)
      .map(x => ({ d: x.d, s: x.s, e: x.e, note: String(x.note || "").trim().slice(0, 80) }));
    await writeKv("lhq_avail", old => Object.assign({}, old || {}, { [nk(me.name)]: L }));
    await act(me, "teaching", "avail.save", L.length ? `Set the times they can't teach: ${L.map(x => `${x.d} ${x.s}–${x.e}`).join(", ")}` : "Cleared the times they can't teach", "avail", nk(me.name));
    return json({ ok: true, avail: L });
  }
  if (b.action === "ack") {   // "Got it", "Can't make this time", or "seen" for a card they were taken off
    const cid = String(b.card || ""), s0 = ["ok", "cant", "gone"].includes(b.s) ? b.s : "", key = cid + "|" + nk(me.name);
    const card = d.cards.find(c => c.id === cid), prev = ((await store().get("kv/lhq_cardack", { type: "json" })) || {})[key];
    if (!s0 || (!card && !(s0 === "gone" && prev))) return fail("That card isn't on your list.", 404);
    if (s0 === "cant" && !String(b.note || "").trim()) return fail("Say which times don't work for you.");
    const v = { s: s0, sig: String(b.sig || "").slice(0, 2000), at: now, note: String(b.note || "").trim().slice(0, 500), st: card ? card.student : (prev || {}).st, subs: card ? card.subjects.map(x => x.name) : (prev || {}).subs || [], number: card ? card.number : (prev || {}).number };
    await writeKv("lhq_cardack", old => Object.assign({}, old || {}, { [key]: v }));
    if (s0 === "cant") await act(me, "teaching", "card.cant", `Can't make the times on ${v.number || "a tuition card"} · ${v.st}: "${v.note}"`, "documents", cid);
    if (s0 === "ok") await act(me, "teaching", "card.ok", `Acknowledged ${v.number || "a tuition card"} · ${v.st}`, "documents", cid);
    return json({ ok: true, ack: v });
  }
  if (b.action === "answer") {   // a student (or parent) said a session wasn't right: Accept, or Keep mine with a note
    const cur = await store().get("kv/lhq_logs", { type: "json" }), e0 = cur && cur.e && cur.e[String(b.id || "")];
    if (!e0 || e0.x || e0.ty !== "s" || nk(e0.tutor) !== nk(me.name)) return fail("That session isn't yours.", 404);
    if (!(e0.cf && e0.cf.s === "disputed" && e0.cf.step === "tutor")) return fail("Nothing to answer here.", 409);
    const now = Date.now(), c0 = e0.cf, note = String(b.note || "").trim().slice(0, 300);
    let patch;
    if (b.accept) {
      patch = { cf: Object.assign({}, c0, { s: "confirmed", agreed: true, step: null, by: me.name, at: now, was: { t1: e0.t1 || "", t2: e0.t2 || "", a: e0.a || "" } }) };
      if (c0.kind === "late" || c0.kind === "early") { if (c0.t1) patch.t1 = c0.t1; if (c0.t2) patch.t2 = c0.t2; }
      if (c0.kind === "none") patch.a = "cancelled";
    } else {
      if (!note) return fail("Add a note for the student.");
      patch = { cf: Object.assign({}, c0, { step: "student", tutorNote: note, tutorAt: now }) };
    }
    const next = await writeKv("lhq_logs", old => { const o = old || { e: {} }, e = Object.assign({}, o.e); e[e0.id] = Object.assign({}, e[e0.id], patch, { at: now }); return Object.assign({}, o, { e }); });
    await act(me, "sessions", b.accept ? "session.accept" : "session.keep", `${b.accept ? "Accepted" : "Kept their times on"} ${e0.st}'s ${e0.sub} · ${dayL(e0.d)}${b.accept ? "" : `: "${note}"`}`, "logs", e0.id);
    return json({ ok: true, entry: next.e[e0.id] });
  }
  if (b.action === "makeup") {   // book a make-up for one of their students, or take back one LHQ hasn't decided yet
    const hmOk = t => /^\d{2}:\d{2}$/.test(String(t || "")), id = /^[\w-]{4,40}$/.test(String(b.id || "")) ? b.id : "mu" + crypto.randomBytes(5).toString("hex");
    const cur = ((await store().get("kv/lhq_makeups", { type: "json" })) || {})[id];
    if (cur && nk(cur.tutor) !== nk(me.name)) return fail("That make-up belongs to another tutor.", 403);
    if (b.cancel) {
      if (!cur) return fail("That make-up isn't booked.", 404);
      if (cur.status === "ok") return fail("LHQ already confirmed it: ask LHQ to move or cancel it.", 409);
      await writeKv("lhq_makeups", old => { const o = Object.assign({}, old); delete o[id]; return o; });
      await act(me, "teaching", "makeup.cancel", `Took back the make-up request · ${cur.st} · ${cur.sub} · ${dayL(cur.d)}`, "makeups", id);
      return json({ ok: true });
    }
    if (!d.keys.has(String(b.k || ""))) return fail("That student isn't on your tuition cards.", 403);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.d || "")) || b.d < new Date(Date.now() - 864e5).toISOString().slice(0, 10)) return fail("Choose a day from today on.");
    if (!hmOk(b.s) || !hmOk(b.e) || b.s >= b.e) return fail("Check the start and end times.");
    if (cur && cur.status === "ok") return fail("LHQ already confirmed it: ask LHQ to move it.", 409);
    const [st, sub] = String(b.k).split("|"), card = d.cards.find(c => nk(c.student) === st && c.subjects.some(x => nk(x.name) === sub));
    const v = { id, k: b.k, st: card ? card.student : st, sub: card ? card.subjects.find(x => nk(x.name) === sub).name : sub, tutor: me.name, d: b.d, s: b.s, e: b.e, why: String(b.why || "").trim().slice(0, 200), status: "asked", at: now, by: me.name };
    await writeKv("lhq_makeups", old => Object.assign({}, old || {}, { [id]: v }));
    await act(me, "teaching", "makeup.book", `Asked for a make-up · ${v.st} · ${v.sub} · ${dayL(v.d)} ${v.s}–${v.e}${v.why ? " · " + v.why : ""}`, "makeups", id);
    return json({ ok: true, makeup: v });
  }
  if (b.action === "class") {
    const c = b.cls || {}, id = /^[\w-]{4,40}$/.test(String(c.id || "")) ? c.id : "cl" + crypto.randomBytes(5).toString("hex");
    const stuKeys = new Set([...d.keys].map(k => k.split("|")[0]));
    const stu = [...new Set((Array.isArray(c.stu) ? c.stu : []).map(nk).filter(k => stuKeys.has(k)))];
    const cur = (await store().get("kv/lhq_classes", { type: "json" })) || {};
    if (cur[id] && nk(cur[id].tutor) !== nk(me.name)) return fail("That class belongs to another tutor.", 403);
    if (!c.del && !String(c.name || "").trim()) return fail("Give the class a name.");
    if (!c.del && stu.length < 2) return fail("A class needs at least two of your students.");
    const cls = c.del ? Object.assign({}, cur[id] || {}, { id, del: true, at: now }) : { id, name: String(c.name).trim().slice(0, 60), sub: String(c.sub || "").trim().slice(0, 60), mode: c.mode === "online" ? "online" : "in person", stu, tutor: me.name, at: now };
    await writeKv("lhq_classes", old => Object.assign({}, old || {}, { [id]: Object.assign({}, cls, { by: (old && old[id] && old[id].by) || me.name }) }));
    await act(me, "teaching", c.del ? "class.remove" : "class.save", `${c.del ? "Removed" : cur[id] ? "Changed" : "Made"} the class ${cls.name || (cur[id] || {}).name || ""}`, "classes", id);
    return json({ ok: true, cls });
  }
  return fail("Unknown action.");
}

/* for the shared records (api/v2): whoever is signed in, any role. Until sign-in moves to the database (step 2),
   the people list in Blobs stays the source of who can sign in. */
export async function personFrom(req, context) {
  site = (context && context.deploy && context.deploy.context) || "production";
  if (!secret()) return null;
  return await whoIs(req);
}

/* for the email and WhatsApp functions: only someone signed in to LHQ Hub as Director or admin may send */
export async function staffFrom(req, context) {
  site = (context && context.deploy && context.deploy.context) || "production";
  if (!secret()) return null;
  const me = await whoIs(req);
  return me && staff(me) ? me : null;
}

export default async (req, context) => {
  site = (context && context.deploy && context.deploy.context) || "production";
  if (!secret()) return fail("LHQ Hub isn't set up yet: add LHQ_SECRET in Netlify's environment variables.", 500);
  storeOnDb = await usesDbStore();
  const path = new URL(req.url).pathname.replace(/^\/api\/hub\/?/, "").replace(/\/$/, "");
  try {
    if (req.method === "GET" && path === "people") return await people(req);
    if (req.method === "POST" && path === "setup") return await setup(req);
    if (req.method === "POST" && path === "login") return await login(req);
    if (req.method === "POST" && path === "recover") return await recover(req);
    if (req.method === "GET" && /^cal\//.test(path)) return await calFeed(path);
    /* sign-in with a password (database on) */
    const ua = req.headers.get("user-agent") || "", ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "";
    if (req.method === "POST" && ["signin", "code", "dircode", "password"].includes(path)) {
      if (!dbMode()) return fail("Passwords arrive with the shared records' database.", 410);
      const b = await req.json().catch(() => ({}));
      if (path === "signin") return json(await A.signIn(Object.assign({}, b, { ua })));
      if (path === "code") return json(await A.useCode({ code: b.code, ip }));
      if (path === "dircode") return json(await A.directorCode({ code: b.code, ip }));
      return json(await A.choosePassword(Object.assign({}, b, { ua })));
    }
    const me = await whoIs(req);
    if (!me) return fail("Please sign in again.", 401);
    if (req.method === "GET" && path === "state") return await state(req, me);
    if (req.method === "GET" && path === "rev") return await rev(req, me);
    if (req.method === "GET" && path === "tutor") return await tutorGet(me);
    if (req.method === "POST" && path === "tutor") return await tutorPost(req, me);
    if (req.method === "POST" && path === "sync") return await sync(req, me);
    if (req.method === "POST" && path === "people") return await managePeople(req, me);
    if (req.method === "POST" && path === "account") { if (!dbMode()) return fail("Not available yet.", 410); return json(await A.account(me, await req.json().catch(() => ({})), ua)); }
    if (req.method === "GET" && path === "trash") return await trash(req, me);
    if (req.method === "POST" && path === "restore") return await restore(req, me);
    if (req.method === "POST" && path === "demo") return await demo(req, me);
    if (req.method === "POST" && path === "reset") return await reset(req, me);
    if (req.method === "POST" && path === "store") return await hubStore(req, me);
    if (req.method === "POST" && path === "confirm") return await confirmSession(req, me);
    if (req.method === "POST" && path === "makeup") return await decideMakeup(req, me);
    if (req.method === "POST" && path === "req") return await decideReq(req, me);
    if (req.method === "POST" && path === "clash") return await clashAction(req, me);
    if (req.method === "GET" && path === "family") return await familyGet(me);
    if (req.method === "POST" && path === "family") return await familyPost(req, me);
    if (req.method === "POST" && path === "confirmer") return await setConfirmer(req, me);
    if (req.method === "GET" && path === "activity") return await activityList(req, me);
    return fail("Not found.", 404);
  } catch (e) {
    if (e instanceof A.AuthError) return json(Object.assign({ error: e.message }, e.extra), e.status);
    console.error(e);
    return fail("Something went wrong on the server. Try again.", 500);
  }
};

export const config = { path: "/api/hub/*" };
