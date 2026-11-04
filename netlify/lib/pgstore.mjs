/* The Hub's own storage on Postgres, with the same interface as a Netlify Blobs store (get, getWithMetadata, setJSON
   with onlyIfMatch / onlyIfNew, delete, list), so every handler in hub.mjs works unchanged.
   Keys are routed to their own tables:
     doc/<id>          -> documents   (type, number, student, dates and amounts as columns; the whole document in body)
     hist/<id>/<time>  -> doc_history (the previous version whenever a document is overwritten)
     trash/<id>        -> doc_trash   (Recently deleted)
     kv/lhq_spend, kv/lhq_income -> money (one row per entry; the whole list is put together when read)
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

/* lists kept one row per entry: read as the whole {id: entry} list, written by saving only the entries that changed */
const MAPS = { "kv/lhq_spend": "spend", "kv/lhq_income": "income" };
async function mapGet(key) {
  const rows = await q("SELECT id, body FROM money WHERE kind = $1 ORDER BY id", [MAPS[key]]);
  if (!rows.length) return null;
  const v = {}; rows.forEach(r => { v[r.id] = r.body; });
  const t = await one("SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag FROM money WHERE kind = $1", [MAPS[key]]);
  return { v, etag: t.etag };
}
async function mapPut(key, value, mode, match) {
  const kind = MAPS[key];
  return tx(async T => {
    await T.q("SELECT pg_advisory_xact_lock(4711100)");
    const cur = await T.one("SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag, count(*)::int AS n FROM money WHERE kind = $1", [kind]);
    if (mode === "new" && cur.n) return [];
    if (mode === "match" && cur.etag !== match) return [];
    const old = new Map((await T.q("SELECT id, body FROM money WHERE kind = $1", [kind])).map(r => [r.id, canon(r.body)]));
    for (const [id, e] of Object.entries(value || {})) {
      if (!e || typeof e !== "object" || old.get(id) === canon(e)) continue;
      await T.q(`INSERT INTO money (id, kind, entry_date, cat, amount, del, added_by, body) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, entry_date = EXCLUDED.entry_date, cat = EXCLUDED.cat, amount = EXCLUDED.amount, del = EXCLUDED.del,
          added_by = EXCLUDED.added_by, body = EXCLUDED.body, rev = nextval('lhq_rev'), updated_at = now()`,
        [id, kind, day(e.date), e.cat || null, num(e.amount), !!e.del, e.by || null, JSON.stringify(e)]);
    }
    return [{ etag: (await T.one("SELECT coalesce(max(rev), 0)::text || '-' || count(*)::text AS etag FROM money WHERE kind = $1", [kind])).etag }];
  });
}

async function rowGet(key) {
  if (MAPS[key]) return mapGet(key);
  const n = nsOf(key);
  if (!n) return one("SELECT value AS v, etag FROM hub_kv WHERE key = $1", [key]);
  return one(`SELECT body AS v, etag FROM ${n.table} WHERE id = $1`, [key.slice(n.prefix.length)]);
}
async function rowPut(key, value, e, mode, match) {
  if (MAPS[key]) return mapPut(key, value, mode, match);
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
  async delete(key) { if (MAPS[key]) { await q("DELETE FROM money WHERE kind = $1", [MAPS[key]]); return; } const n = nsOf(key); if (!n) await q("DELETE FROM hub_kv WHERE key = $1", [key]); else await q(`DELETE FROM ${n.table} WHERE id = $1`, [key.slice(n.prefix.length)]); },
  async list({ prefix = "" } = {}) {
    const keys = [];
    for (const n of NS) {
      if (prefix && !(n.prefix.startsWith(prefix) || prefix.startsWith(n.prefix))) continue;
      const rest = prefix.startsWith(n.prefix) ? prefix.slice(n.prefix.length) : "";
      keys.push(...(await q(`SELECT id FROM ${n.table} WHERE id LIKE $1 ORDER BY id`, [like(rest)])).map(r => n.prefix + r.id));
    }
    keys.push(...(await q("SELECT key FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => r.key));
    for (const [k, kind] of Object.entries(MAPS)) if (k.startsWith(prefix) && await one("SELECT 1 FROM money WHERE kind = $1 LIMIT 1", [kind])) keys.push(k);
    return { blobs: keys.sort().map(key => ({ key })) };
  },
  /* not in Blobs: every value under a prefix in one query (all documents, newest first) */
  async getAll(prefix) {
    const n = nsOf(prefix);
    if (n && prefix === n.prefix) return (await q(`SELECT body FROM ${n.table} ORDER BY ${n.order}`)).map(r => r.body);
    if (n) return (await q(`SELECT body FROM ${n.table} WHERE id LIKE $1 ORDER BY id`, [like(prefix.slice(n.prefix.length))])).map(r => r.body);
    const out = (await q("SELECT key, value FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => [r.key, r.value]);
    for (const k of Object.keys(MAPS)) if (k.startsWith(prefix)) { const m = await mapGet(k); if (m) out.push([k, m.v]); }
    return out.sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
  }
};

/* Copy everything from a Blobs store into the database, `size` keys per call (each request has a time limit): call again
   with from = next until more is false. Safe to run again: a key already here is left as it is unless `replace`. */
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
