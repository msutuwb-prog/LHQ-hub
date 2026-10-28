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

let testStore = null;
export const _setStore = s => { testStore = s; };
// Deploy previews (and branch deploys) get their own storage, so trying things there never touches LHQ's real documents
let site = "production";
const isPreview = () => site !== "production";
const store = () => testStore || getStore({ name: isPreview() ? "lhq-hub-preview" : "lhq-hub", consistency: "strong" });

const KV_KEYS = ["lhq_settings", "lhq_templates", "lhq_counters", "lhq_repEdits", "lhq_logs", "lhq_tlinks", "lhq_students", "lhq_spend", "lhq_budget", "lhq_income"];

/* ---------- roles and permissions ---------- */
const PERMS = ["quotes", "receipts", "cards", "delete", "restore", "students", "money", "tpay", "tutors", "msgs", "numbering", "backup", "classes", "moveclass", "spend", "pl"];
const ADMIN_DEFAULT = ["quotes", "receipts", "cards", "delete", "restore", "students", "tutors", "msgs", "classes"];
const TYPE_PERM = { quote: "quotes", invoice: "quotes", receipt: "receipts", card: "cards" };
// settings fields: lists and wording can be given to admins; everything else (bank, contact, payment rules) is the Director's
const LIST_FIELDS = ["subjects", "levels", "methods", "includes", "tutors", "grades", "gradeBasis", "sessionLengths", "spendCats", "heardFrom", "districts"];
/* Business: who may read each part. Spending goes to whoever records it or sees profit and loss; budgets with profit and loss. */
const KV_READ = { lhq_spend: p => can(p, "spend") || can(p, "pl"), lhq_income: p => can(p, "spend") || can(p, "pl"), lhq_budget: p => can(p, "pl") };
const MERGED = ["lhq_spend", "lhq_income"];   // recorded on several devices at once: merged entry by entry
/* Spending is recorded on several devices at once, so entries are merged one by one (newest wins) instead of the whole list being replaced.
   Deleting marks an entry del:true, so a device that hasn't heard about it yet can't bring it back. */
function mergeSpend(old, v, me) {
  const out = Object.assign({}, old || {});
  Object.entries(v || {}).forEach(([id, e]) => {
    if (!e || typeof e !== "object" || JSON.stringify(e) === JSON.stringify(out[id])) return;
    if (out[id] && (e.at || 0) < (out[id].at || 0)) return;
    const was = out[id];
    out[id] = Object.assign({}, e, { by: was ? was.by : me.name }, was ? { editedBy: me.name } : {});
  });
  return out;
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
const pub = p => ({ id: p.id, name: p.name, role: p.role, admin: staff(p), tutor: !!p.tutor, perms: isDirector(p) ? PERMS.slice() : (p.perms || []), active: p.active !== false, home: p.home || null, seen: p.seen || 0 });

async function getPeople() {
  const list = (await store().get("people", { type: "json" })) || [];
  if (migrate(list)) await putPeople(list);
  return list;
}
async function putPeople(list) { list.forEach(p => { p.admin = p.role === "director" || p.role === "admin"; }); await store().setJSON("people", list); }
function newToken(p) { return sign({ p: p.id, v: p.pv || 1, exp: Date.now() + TOKEN_DAYS * 864e5 }); }

async function whoIs(req) {
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
  const s = store(), { blobs } = await s.list({ prefix });
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const part = await Promise.all(blobs.slice(i, i + 25).map(b => s.get(b.key, { type: "json" })));
    out.push(...part.filter(Boolean));
  }
  return out;
}

/* ---------------- handlers ---------------- */
async function people(req) {
  const list = await getPeople();
  return json({ setup: list.length === 0, preview: isPreview(), people: list.filter(p => p.active !== false).map(p => ({ id: p.id, name: p.name, role: p.role, admin: staff(p), tutor: !!p.tutor })) });
}

async function setup(req) {
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
  return [...keys].filter(k => !SKIP_DIFF.includes(k) && JSON.stringify((a || {})[k] ?? "") !== JSON.stringify((b || {})[k] ?? ""));
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
      const ch = Object.keys(v || {}).filter(id => JSON.stringify(v[id]) !== JSON.stringify(old[id]) && (!old[id] || (v[id].at || 0) >= (old[id].at || 0)));
      if (ch.length && !can(me, "spend")) return "You don't have permission to record spending.";
      if (ch.some(id => old[id] && old[id].by !== me.name)) return "You can only change spending you recorded. Ask the Director to change the others.";
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
  const kvIn = body.kv && typeof body.kv === "object" ? Object.entries(body.kv).filter(([k]) => KV_KEYS.includes(k)) : [];
  const denied = await checkSync(me, upserts, deletes, kvIn);
  if (denied) return json({ error: denied, denied: true }, 403);
  const remap = {}, conflicts = [], saved = [];
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
    const merged = {};
    for (const [k, v] of kvIn) {
      if (MERGED.includes(k)) { const m = mergeSpend(await s.get("kv/" + k, { type: "json" }), v, me); merged[k] = m; await s.setJSON("kv/" + k, m); }
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
    return json({ rev: idx.rev, epoch: idx.epoch, remap, conflicts, saved, kv: merged });
  }
  return fail("Too many saves at once. Try again.", 409);
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
    return json({ ok: true, doc: d, rev: idx.rev, renumbered: note });
  }
  return fail("Too many saves at once. Try again.", 409);
}

async function managePeople(req, me) {
  const b = await req.json().catch(() => ({}));
  const list = await getPeople();
  const find = id => list.find(p => p.id === id);
  if (b.action === "mypin") {
    const p = find(me.id);
    if (hashPin(b.current, p.salt) !== p.hash) return fail("Your current PIN is wrong.", 401);
    if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
    p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(b.pin, p.salt); p.pv = (p.pv || 1) + 1;
    await putPeople(list); return json({ ok: true, token: newToken(p), people: list.map(pub) });
  }
  if (b.action === "home") {   // each person's own Home cards
    const p = find(me.id); p.home = Array.isArray(b.cards) ? b.cards.filter(x => typeof x === "string").slice(0, 6) : null;
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
  const path = new URL(req.url).pathname.replace(/^\/api\/hub\/?/, "").replace(/\/$/, "");
  try {
    if (req.method === "GET" && path === "people") return await people(req);
    if (req.method === "POST" && path === "setup") return await setup(req);
    if (req.method === "POST" && path === "login") return await login(req);
    if (req.method === "POST" && path === "recover") return await recover(req);
    const me = await whoIs(req);
    if (!me) return fail("Please sign in again.", 401);
    if (req.method === "GET" && path === "state") return await state(req, me);
    if (req.method === "GET" && path === "rev") return await rev(req, me);
    if (req.method === "POST" && path === "sync") return await sync(req, me);
    if (req.method === "POST" && path === "people") return await managePeople(req, me);
    if (req.method === "GET" && path === "trash") return await trash(req, me);
    if (req.method === "POST" && path === "restore") return await restore(req, me);
    if (req.method === "POST" && path === "demo") return await demo(req, me);
    if (req.method === "POST" && path === "reset") return await reset(req, me);
    return fail("Not found.", 404);
  } catch (e) {
    console.error(e);
    return fail("Something went wrong on the server. Try again.", 500);
  }
};

export const config = { path: "/api/hub/*" };
