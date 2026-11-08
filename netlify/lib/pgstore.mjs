/* The Hub's own storage on Postgres, with the same interface as a Netlify Blobs store (get, getWithMetadata, setJSON
   with onlyIfMatch / onlyIfNew, delete, list), so every handler in hub.mjs works unchanged.
   Keys are routed to their own tables:
     doc/<id>          -> documents   (type, number, student, dates and amounts as columns; the whole document in body)
     hist/<id>/<time>  -> doc_history (the previous version whenever a document is overwritten)
     trash/<id>        -> doc_trash   (Recently deleted)
     kv/lhq_spend, kv/lhq_income -> money (one row per entry; the whole list is put together when read)
     kv/lhq_students   -> students    (the Hub's record in info.hub)
     kv/lhq_logs       -> logs        (one row per logged line: session, SRA given or handed in, assessment marks)
     kv/lhq_treps      -> tutor_reports, kv/lhq_classes -> classes
     kv/lhq_settings, _templates, _counters, _repEdits, _tlinks, _budget -> settings (key hub:lhq_…)
     everything else   -> hub_kv      (index, lists, logs: each moves to its own table in a later step)
   An etag changes on every write; a conditional write that loses the race returns { modified: false }, as Blobs does. */
import crypto from "node:crypto";
import { q, one, tx } from "./db.mjs";

const tag = () => crypto.randomBytes(8).toString("hex");
const like = p => String(p).replace(/[\\%_]/g, m => "\\" + m) + "%";
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x);
const nk = v => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
const num = v => (v === "" || v == null || isNaN(Number(v))) ? null : Number(v);
const day = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : null;

/* each table: its key prefix, how to get the row id from a key and back, and the columns taken from the value */
const NS = [
  { prefix: "doc/", table: "documents", cols: d => ({
      type: d.type || "quote", number: d.number || null, student: d.student || null, student_key: nk(d.student || d.name),
      doc_date: day(d.date), due_date: day(d.dueDate), period_start: day(d.periodStart), period_end: day(d.periodEnd),
      total: num(d.total), received: num(d.receivedAmt), paid: num(d.paid), ref: d.ref || null,
      saved_at: num(d.savedAt) == null ? null : Math.round(num(d.savedAt)), saved_by: d.updatedBy || d.createdBy || null }),
    order: "saved_at DESC NULLS LAST, id" },
  { prefix: "hist/", table: "doc_history", cols: (v, id) => ({ doc_id: id.split("/")[0], at: Number(id.split("/")[1]) || 0 }), order: "id" },
  { prefix: "trash/", table: "doc_trash", cols: v => ({ deleted_at: num(v.deletedAt) == null ? null : Math.round(num(v.deletedAt)), deleted_by: v.deletedBy || null }), order: "id" }
];
const nsOf = key => NS.find(n => String(key).startsWith(n.prefix));
const KV = { table: "hub_kv" };

/* lists kept one row per entry: read as the whole {id: entry} list, written by saving only the entries that changed.
   money: entries are never removed (deleted ones stay marked), so the list only grows.
   students: the Hub keeps its own record per student in info.hub (and its key in info.hubKey); a record left out of the
   list (a student renamed to a new key) loses info.hub, while what the shared records keep about that student stays. */
const MONEY = kind => ({
  rows: T => T.q("SELECT id AS k, body FROM money WHERE kind = $1", [kind]),
  etag: T => T.one("SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag, count(*)::int AS n FROM money WHERE kind = $1", [kind]),
  put: (T, id, e) => T.q(`INSERT INTO money (id, kind, entry_date, cat, amount, del, added_by, body) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, entry_date = EXCLUDED.entry_date, cat = EXCLUDED.cat, amount = EXCLUDED.amount, del = EXCLUDED.del,
      added_by = EXCLUDED.added_by, body = EXCLUDED.body, rev = nextval('lhq_rev'), updated_at = now()`,
    [id, kind, day(e.date), e.cat || null, num(e.amount), !!e.del, e.by || null, JSON.stringify(e)]),
  drop: null, all: T => T.q("DELETE FROM money WHERE kind = $1", [kind])
});
const sid = k => "st" + crypto.createHash("sha256").update(nk(k)).digest("hex").slice(0, 16);
const STUDENTS = {
  rows: T => T.q("SELECT coalesce(info->>'hubKey', key) AS k, info->'hub' AS body FROM students WHERE info ? 'hub' AND NOT del"),
  etag: T => T.one("SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag, count(*)::int AS n FROM students WHERE info ? 'hub' AND NOT del"),
  put: (T, k, e) => T.q(`INSERT INTO students (id, key, name, level, school, info) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, level = EXCLUDED.level, school = EXCLUDED.school, del = false,
      info = students.info || jsonb_build_object('hub', EXCLUDED.info->'hub', 'hubKey', EXCLUDED.info->'hubKey')`,
    [sid(k), nk(k), String(e.name || k).trim() || k, e.level || null, e.school || null, JSON.stringify({ hub: e, hubKey: k })]),
  drop: (T, k) => T.q("UPDATE students SET info = info - 'hub' - 'hubKey' WHERE coalesce(info->>'hubKey', key) = $1", [k]),
  all: T => T.q("UPDATE students SET info = info - 'hub' - 'hubKey' WHERE info ? 'hub'")
};
/* tutors' logs and daily reports: {e: {id: entry}, …}. The entries are rows; whatever else sits next to e (the record of
   WhatsApp imports) is kept in settings as hub:lhq_logs:rest. Entries are never removed: a deleted one stays as {x: 1}. */
const skOf = e => nk(String(e.k || "").split("|")[0] || e.st) || null;
const ROWS = (table, cols) => ({
  rows: T => T.q(`SELECT id AS k, body FROM ${table} ORDER BY id`),
  etag: T => T.one(`SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag, count(*)::int AS n FROM ${table}`),
  put: (T, id, e) => { const c = cols(e), ks = Object.keys(c);
    return T.q(`INSERT INTO ${table} (id, ${ks.join(", ")}, body) VALUES ($1, ${ks.map((_, i) => "$" + (i + 2)).join(", ")}, $${ks.length + 2})
      ON CONFLICT (id) DO UPDATE SET ${ks.map(k => `${k} = EXCLUDED.${k}`).join(", ")}, body = EXCLUDED.body, rev = nextval('lhq_rev'), updated_at = now()`, [id, ...ks.map(k => c[k]), JSON.stringify(e)]); },
  drop: null, all: T => T.q(`DELETE FROM ${table}`)
});
const LOGS = ROWS("logs", e => ({ ty: e.ty || null, student_key: skOf(e), subject: e.sub || null, day: day(e.d), tutor: e.tutor || null, del: !!e.x, at: num(e.at) == null ? null : Math.round(num(e.at)), confirm: (e.cf && e.cf.s) || null }));
const TREPS = ROWS("tutor_reports", e => ({ tutor: e.tutor || null, day: day(e.d) }));
const CLASSES = ROWS("classes", e => ({ tutor: e.tutor || null, name: e.name || null, del: !!e.del }));
const MAPS = { "kv/lhq_spend": MONEY("spend"), "kv/lhq_income": MONEY("income"), "kv/lhq_students": STUDENTS, "kv/lhq_logs": LOGS, "kv/lhq_treps": TREPS, "kv/lhq_classes": CLASSES };
const WRAPPED = new Set(["kv/lhq_logs", "kv/lhq_treps"]);   // {e: {...}} with other fields beside e
const MAPLOCK = { "kv/lhq_spend": 4711100, "kv/lhq_income": 4711101, "kv/lhq_students": 4711102, "kv/lhq_logs": 4711103, "kv/lhq_treps": 4711104, "kv/lhq_classes": 4711105 };
const asTx = fn => tx(fn);
async function mapGet(key) {
  return asTx(async T => {
    const rows = await MAPS[key].rows(T), rest = WRAPPED.has(key) ? await T.one("SELECT value FROM settings WHERE key = $1 AND NOT del", ["hub:" + key.slice(3) + ":rest"]) : null;
    if (!rows.length && !rest) return null;
    const v = {}; rows.forEach(r => { v[r.k] = r.body; });
    const t = (await MAPS[key].etag(T)).etag;
    return WRAPPED.has(key) ? { v: Object.assign({}, rest ? rest.value : {}, { e: v }), etag: t + "-" + canon(rest ? rest.value : {}).length } : { v, etag: t };
  });
}
async function mapPut(key, value, mode, match) {
  const M = MAPS[key];
  return tx(async T => {
    await T.q("SELECT pg_advisory_xact_lock($1)", [MAPLOCK[key]]);
    const W = WRAPPED.has(key), rkey = "hub:" + key.slice(3) + ":rest";
    const restOf = async () => { const r = W ? await T.one("SELECT value FROM settings WHERE key = $1 AND NOT del", [rkey]) : null; return r ? r.value : {}; };
    const tagNow = async () => { const t = (await M.etag(T)).etag; return W ? t + "-" + canon(await restOf()).length : t; };
    const cur = await M.etag(T);
    if (mode === "new" && cur.n) return [];
    if (mode === "match" && (await tagNow()) !== match) return [];
    const old = new Map((await M.rows(T)).map(r => [r.k, canon(r.body)]));
    const whole = value && typeof value === "object" ? value : {}, next = W ? (whole.e && typeof whole.e === "object" ? whole.e : {}) : whole;
    for (const [k, e] of Object.entries(next)) if (e && typeof e === "object" && old.get(k) !== canon(e)) await M.put(T, k, e);
    if (M.drop) for (const k of old.keys()) if (!(k in next)) await M.drop(T, k);
    if (W) { const rest = Object.assign({}, whole); delete rest.e;
      await T.q("INSERT INTO settings (id, key, scope, value) VALUES ($1, $1, 'staff', $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, del = false", [rkey, JSON.stringify(rest)]); }
    return [{ etag: await tagNow() }];
  });
}

/* single values in the settings table: lists, messages, numbering, report edits, tutor links, budgets */
const SETTINGS = new Set(["kv/lhq_settings", "kv/lhq_templates", "kv/lhq_counters", "kv/lhq_repEdits", "kv/lhq_tlinks", "kv/lhq_budget", "kv/lhq_avail", "kv/lhq_cardack", "kv/lhq_makeups", "kv/lhq_reqs", "kv/lhq_clashes", "kv/lhq_moves", "kv/lhq_confirmer", "kv/lhq_sradone", "kv/lhq_sreports", "kv/lhq_notices", "kv/lhq_push", "kv/lhq_pushlog"]);
const skey = key => "hub:" + key.slice(3);
async function setGet(key) { return one("SELECT value AS v, ver::text AS etag FROM settings WHERE key = $1 AND NOT del", [skey(key)]); }
async function setPut(key, value, mode, match) {
  const k = skey(key), v = JSON.stringify(value);
  if (mode === "new") return q("INSERT INTO settings (id, key, scope, value) VALUES ($1, $1, 'staff', $2) ON CONFLICT (key) DO NOTHING RETURNING ver::text AS etag", [k, v]);
  if (mode === "match") return q("UPDATE settings SET value = $2, del = false WHERE key = $1 AND ver::text = $3 RETURNING ver::text AS etag", [k, v, match]);
  return q("INSERT INTO settings (id, key, scope, value) VALUES ($1, $1, 'staff', $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, del = false RETURNING ver::text AS etag", [k, v]);
}

async function rowGet(key) {
  if (MAPS[key]) return mapGet(key);
  if (SETTINGS.has(key)) return setGet(key);
  const n = nsOf(key);
  if (!n) return one("SELECT value AS v, etag FROM hub_kv WHERE key = $1", [key]);
  return one(`SELECT body AS v, etag FROM ${n.table} WHERE id = $1`, [key.slice(n.prefix.length)]);
}
async function rowPut(key, value, e, mode, match) {
  if (MAPS[key]) return mapPut(key, value, mode, match);
  if (SETTINGS.has(key)) return setPut(key, value, mode, match);
  const n = nsOf(key), v = JSON.stringify(value);
  if (!n) {
    if (mode === "new") return q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING RETURNING etag", [key, v, e]);
    if (mode === "match") return q("UPDATE hub_kv SET value = $2, etag = $3, updated_at = now() WHERE key = $1 AND etag = $4 RETURNING etag", [key, v, e, match]);
    return q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, etag = EXCLUDED.etag, updated_at = now() RETURNING etag", [key, v, e]);
  }
  const id = key.slice(n.prefix.length), c = Object.assign(n.cols(value || {}, id), { body: v, etag: e });
  if (n.table === "documents") c.rev = undefined;
  const ks = Object.keys(c).filter(k => c[k] !== undefined), vals = ks.map(k => c[k]);
  const ph = ks.map((_, i) => "$" + (i + 2)).join(", "), sets = ks.map(k => `${k} = EXCLUDED.${k}`).concat(n.table === "documents" ? ["rev = nextval('lhq_rev')", "updated_at = now()"] : []).join(", ");
  if (mode === "new") return q(`INSERT INTO ${n.table} (id, ${ks.join(", ")}) VALUES ($1, ${ph}) ON CONFLICT (id) DO NOTHING RETURNING etag`, [id, ...vals]);
  if (mode === "match") return q(`UPDATE ${n.table} SET ${ks.map((k, i) => `${k} = $${i + 2}`).join(", ")}${n.table === "documents" ? ", rev = nextval('lhq_rev'), updated_at = now()" : ""} WHERE id = $1 AND etag = $${ks.length + 2} RETURNING etag`, [id, ...vals, match]);
  return q(`INSERT INTO ${n.table} (id, ${ks.join(", ")}) VALUES ($1, ${ph}) ON CONFLICT (id) DO UPDATE SET ${sets} RETURNING etag`, [id, ...vals]);
}

export const pgStore = {
  async get(key) { const r = await rowGet(key); return r ? r.v : null; },
  async getWithMetadata(key) { const r = await rowGet(key); return r ? { data: r.v, etag: r.etag } : null; },
  async setJSON(key, value, o = {}) {
    const e = tag(), r = await rowPut(key, value, e, o.onlyIfNew ? "new" : o.onlyIfMatch ? "match" : "", o.onlyIfMatch);
    return r.length ? { modified: true, etag: r[0].etag || e } : { modified: false };
  },
  async delete(key) { if (MAPS[key]) { await tx(async T => { await MAPS[key].all(T); if (WRAPPED.has(key)) await T.q("UPDATE settings SET del = true WHERE key = $1", ["hub:" + key.slice(3) + ":rest"]); }); return; } if (SETTINGS.has(key)) { await q("UPDATE settings SET del = true WHERE key = $1", [skey(key)]); return; } const n = nsOf(key); if (!n) await q("DELETE FROM hub_kv WHERE key = $1", [key]); else await q(`DELETE FROM ${n.table} WHERE id = $1`, [key.slice(n.prefix.length)]); },
  async list({ prefix = "" } = {}) {
    const keys = [];
    for (const n of NS) {
      if (prefix && !(n.prefix.startsWith(prefix) || prefix.startsWith(n.prefix))) continue;
      const rest = prefix.startsWith(n.prefix) ? prefix.slice(n.prefix.length) : "";
      keys.push(...(await q(`SELECT id FROM ${n.table} WHERE id LIKE $1 ORDER BY id`, [like(rest)])).map(r => n.prefix + r.id));
    }
    keys.push(...(await q("SELECT key FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => r.key));
    for (const k of Object.keys(MAPS)) if (k.startsWith(prefix) && (await tx(T => MAPS[k].etag(T))).n) keys.push(k);
    for (const k of SETTINGS) if (k.startsWith(prefix) && await setGet(k)) keys.push(k);
    return { blobs: keys.sort().map(key => ({ key })) };
  },
  /* not in Blobs: every value under a prefix in one query (all documents, newest first) */
  async getAll(prefix) {
    const n = nsOf(prefix);
    if (n && prefix === n.prefix) return (await q(`SELECT body FROM ${n.table} ORDER BY ${n.order}`)).map(r => r.body);
    if (n) return (await q(`SELECT body FROM ${n.table} WHERE id LIKE $1 ORDER BY id`, [like(prefix.slice(n.prefix.length))])).map(r => r.body);
    const out = (await q("SELECT key, value FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => [r.key, r.value]);
    for (const k of Object.keys(MAPS)) if (k.startsWith(prefix)) { const m = await mapGet(k); if (m) out.push([k, m.v]); }
    for (const k of SETTINGS) if (k.startsWith(prefix)) { const m = await setGet(k); if (m) out.push([k, m.v]); }
    return out.sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
  }
};

/* Copy everything from a Blobs store into the database, `size` keys per call (each request has a time limit): call again
   with from = next until more is false. Safe to run again: a key already here is left as it is unless `replace`. */
/* the way back: copy everything in the database into Blobs (paged), so switching back loses nothing saved since */
export async function copyToBlobs(blobs, { from = 0, size = 400 } = {}) {
  const list = (await pgStore.list()).blobs.map(b => b.key).sort();
  const end = Math.min(list.length, from + size);
  let copied = 0;
  for (let i = from; i < end; i += 25) {
    const part = list.slice(i, Math.min(i + 25, end));
    const vals = await Promise.all(part.map(k => pgStore.get(k, { type: "json" }).catch(() => null)));
    for (let j = 0; j < part.length; j++) { if (vals[j] == null) continue; await blobs.setJSON(part[j], vals[j]); copied++; }
  }
  return { keys: list.length, copied, more: end < list.length, next: end < list.length ? end : null };
}

export async function moveFromBlobs(blobs, { replace = false, from = 0, size = 400 } = {}) {
  const list = (await blobs.list()).blobs.sort((a, b) => a.key.localeCompare(b.key));
  const end = Math.min(list.length, from + size);
  let copied = 0, kept = 0;
  for (let i = from; i < end; i += 25) {
    const part = list.slice(i, Math.min(i + 25, end));
    const vals = await Promise.all(part.map(b => blobs.get(b.key, { type: "json" }).catch(() => null)));
    for (let j = 0; j < part.length; j++) {
      if (vals[j] == null) continue;
      const r = await rowPut(part[j].key, vals[j], tag(), replace ? "" : "new");
      r.length ? copied++ : kept++;
    }
  }
  return { keys: list.length, copied, kept, more: end < list.length, next: end < list.length ? end : null };
}
