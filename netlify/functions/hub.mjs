// LHQ Hub: sign-in and shared storage (Netlify Functions + Netlify Blobs).
//
// Needs one environment variable in Netlify: LHQ_SECRET (a long random string, used to sign sign-in tokens).
//
// Storage (store "lhq-hub", strong consistency):
//   people            [{id, name, admin, tutor, active, salt, hash, pv}]   (pv = PIN version; changing a PIN signs that person out everywhere)
//   fails/<id>        {n, until}                                           (wrong-PIN counter for that person)
//   index             {rev, docs:{id:{type, number, savedAt}}}             (one small file used for numbering and change checks)
//   doc/<id>          the saved quote / invoice / receipt / card
//   hist/<id>/<time>  the previous version whenever a document is overwritten
//   trash/<id>        deleted documents (kept, never shown)
//   kv/<key>          shared settings, message templates, numbering, report edits, tutor logs

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

let testStore = null;
export const _setStore = s => { testStore = s; };
const store = () => testStore || getStore({ name: "lhq-hub", consistency: "strong" });

const KV_KEYS = ["lhq_settings", "lhq_templates", "lhq_counters", "lhq_repEdits", "lhq_logs", "lhq_tlinks"];
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
const pub = p => ({ id: p.id, name: p.name, admin: !!p.admin, tutor: !!p.tutor, active: p.active !== false });

async function getPeople() { return (await store().get("people", { type: "json" })) || []; }
async function putPeople(list) { await store().setJSON("people", list); }
function newToken(p) { return sign({ p: p.id, v: p.pv || 1, exp: Date.now() + TOKEN_DAYS * 864e5 }); }

async function whoIs(req) {
  const t = unsign((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""));
  if (!t || t.exp < Date.now()) return null;
  const p = (await getPeople()).find(x => x.id === t.p);
  if (!p || p.active === false || (p.pv || 1) !== t.v) return null;
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
  return json({ setup: list.length === 0, people: list.filter(p => p.active !== false).map(pub) });
}

async function setup(req) {
  const { name, pin, code } = await req.json().catch(() => ({}));
  if ((await getPeople()).length) return fail("LHQ Hub is already set up. Sign in instead.", 409);
  if (String(code || "").trim() !== secret().slice(0, 8)) return fail("That setup code is wrong. It's the first 8 characters of LHQ_SECRET in Netlify.", 403);
  if (!String(name || "").trim()) return fail("Add your name.");
  if (!pinOk(pin)) return fail("Choose a PIN of 4 to 6 digits.");
  const salt = crypto.randomBytes(16).toString("hex");
  const p = { id: "p" + crypto.randomBytes(5).toString("hex"), name: String(name).trim(), admin: true, tutor: false, active: true, salt, hash: hashPin(pin, salt), pv: 1 };
  await putPeople([p]);
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
  if (!me.admin) return fail("Only LHQ admin can open documents.", 403);
  const [{ data: idx }, docs, kvs] = await Promise.all([getIndex(), readAll("doc/"), Promise.all(KV_KEYS.map(k => store().get("kv/" + k, { type: "json" })))]);
  const kv = {}; KV_KEYS.forEach((k, i) => { if (kvs[i] != null) kv[k] = kvs[i]; });
  docs.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return json({ rev: idx.rev, docs, kv, me: pub(me) });
}

async function rev(req, me) { const { data } = await getIndex(); return json({ rev: data.rev, me: pub(me) }); }

async function sync(req, me) {
  if (!me.admin) return fail("Only LHQ admin can save documents.", 403);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Nothing to save.");
  const s = store(), now = Date.now();
  const upserts = Array.isArray(body.upserts) ? body.upserts : [], deletes = Array.isArray(body.deletes) ? body.deletes : [];
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
      docs[d.id] = { type, number: d.number, savedAt: d.savedAt || now, by: me.name };
      writes.push({ d, prev: !!prev });
    }
    for (const x of deletes) { if (x && x.id && docs[x.id]) { delete docs[x.id]; writes.push({ del: x.id }); } }
    const kv = body.kv && typeof body.kv === "object" ? Object.entries(body.kv).filter(([k]) => KV_KEYS.includes(k)) : [];
    idx.docs = docs; idx.rev = (idx.rev || 0) + 1; idx.at = now;
    const res = await s.setJSON("index", idx, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (res && res.modified === false) { Object.keys(remap).forEach(k => delete remap[k]); conflicts.length = 0; continue; }   // someone else saved at the same moment: redo
    for (const w of writes) {
      if (w.del) { const old = await s.get("doc/" + w.del, { type: "json" }); if (old) await s.setJSON("trash/" + w.del, Object.assign(old, { deletedBy: me.name, deletedAt: now })); await s.delete("doc/" + w.del); continue; }
      if (w.prev) { const old = await s.get("doc/" + w.d.id, { type: "json" }); if (old) { if (old.createdBy) w.d.createdBy = old.createdBy; await s.setJSON(`hist/${w.d.id}/${now}`, old); } }
      await s.setJSON("doc/" + w.d.id, w.d); saved.push(w.d);
    }
    for (const [k, v] of kv) await s.setJSON("kv/" + k, v);
    return json({ rev: idx.rev, remap, conflicts, saved });
  }
  return fail("Too many saves at once. Try again.", 409);
}

async function managePeople(req, me) {
  const b = await req.json().catch(() => ({}));
  const list = await getPeople();
  const find = id => list.find(p => p.id === id);
  const admins = () => list.filter(p => p.admin && p.active !== false).length;
  if (b.action === "mypin") {
    const p = find(me.id);
    if (hashPin(b.current, p.salt) !== p.hash) return fail("Your current PIN is wrong.", 401);
    if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
    p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(b.pin, p.salt); p.pv = (p.pv || 1) + 1;
    await putPeople(list); return json({ ok: true, token: newToken(p), people: list.map(pub) });
  }
  if (!me.admin) return fail("Only LHQ admin can manage people.", 403);
  if (b.action === "list") return json({ people: list.map(pub) });
  if (b.action === "add") {
    if (!String(b.name || "").trim()) return fail("Add a name.");
    if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
    if (list.some(p => p.name.toLowerCase() === String(b.name).trim().toLowerCase())) return fail("Someone with that name already exists.");
    const salt = crypto.randomBytes(16).toString("hex");
    list.push({ id: "p" + crypto.randomBytes(5).toString("hex"), name: String(b.name).trim(), admin: !!b.admin, tutor: !!b.tutor, active: true, salt, hash: hashPin(b.pin, salt), pv: 1 });
  } else {
    const p = find(b.id); if (!p) return fail("Person not found.", 404);
    if (b.action === "update") {
      if (p.id === me.id && p.admin && !b.admin) return fail("You can't remove your own admin role.");
      if (b.name) p.name = String(b.name).trim(); p.admin = !!b.admin; p.tutor = !!b.tutor;
    } else if (b.action === "pin") {
      if (!pinOk(b.pin)) return fail("Choose a PIN of 4 to 6 digits.");
      p.salt = crypto.randomBytes(16).toString("hex"); p.hash = hashPin(b.pin, p.salt); p.pv = (p.pv || 1) + 1;
      await store().delete("fails/" + p.id);
    } else if (b.action === "off") {
      if (p.id === me.id) return fail("You can't switch yourself off.");
      if (p.admin && admins() <= 1) return fail("LHQ Hub needs at least one admin.");
      p.active = false; p.pv = (p.pv || 1) + 1;
    } else if (b.action === "on") { p.active = true; }
    else return fail("Unknown action.");
  }
  await putPeople(list);
  return json({ ok: true, people: list.map(pub) });
}

export default async (req) => {
  if (!secret()) return fail("LHQ Hub isn't set up yet: add LHQ_SECRET in Netlify's environment variables.", 500);
  const path = new URL(req.url).pathname.replace(/^\/api\/hub\/?/, "").replace(/\/$/, "");
  try {
    if (req.method === "GET" && path === "people") return await people(req);
    if (req.method === "POST" && path === "setup") return await setup(req);
    if (req.method === "POST" && path === "login") return await login(req);
    const me = await whoIs(req);
    if (!me) return fail("Please sign in again.", 401);
    if (req.method === "GET" && path === "state") return await state(req, me);
    if (req.method === "GET" && path === "rev") return await rev(req, me);
    if (req.method === "POST" && path === "sync") return await sync(req, me);
    if (req.method === "POST" && path === "people") return await managePeople(req, me);
    return fail("Not found.", 404);
  } catch (e) {
    console.error(e);
    return fail("Something went wrong on the server. Try again.", 500);
  }
};

export const config = { path: "/api/hub/*" };
