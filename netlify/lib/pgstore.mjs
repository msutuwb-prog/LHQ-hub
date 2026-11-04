/* The Hub's own storage on Postgres, with the same interface as a Netlify Blobs store (get, getWithMetadata, setJSON
   with onlyIfMatch / onlyIfNew, delete, list), so every handler in hub.mjs works unchanged once the data is moved here.
   An etag changes on every write; a conditional write that loses the race returns { modified: false }, as Blobs does. */
import crypto from "node:crypto";
import { q, one } from "./db.mjs";

const tag = () => crypto.randomBytes(8).toString("hex");
const like = p => String(p).replace(/[\\%_]/g, m => "\\" + m) + "%";

export const pgStore = {
  async get(key) { const r = await one("SELECT value FROM hub_kv WHERE key = $1", [key]); return r ? r.value : null; },
  async getWithMetadata(key) { const r = await one("SELECT value, etag FROM hub_kv WHERE key = $1", [key]); return r ? { data: r.value, etag: r.etag } : null; },
  async setJSON(key, value, o = {}) {
    const e = tag(), v = JSON.stringify(value);
    if (o.onlyIfNew) {
      const r = await q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING RETURNING etag", [key, v, e]);
      return r.length ? { modified: true, etag: e } : { modified: false };
    }
    if (o.onlyIfMatch) {
      const r = await q("UPDATE hub_kv SET value = $2, etag = $3, updated_at = now() WHERE key = $1 AND etag = $4 RETURNING etag", [key, v, e, o.onlyIfMatch]);
      return r.length ? { modified: true, etag: e } : { modified: false };
    }
    await q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, etag = EXCLUDED.etag, updated_at = now()", [key, v, e]);
    return { modified: true, etag: e };
  },
  async delete(key) { await q("DELETE FROM hub_kv WHERE key = $1", [key]); },
  async list({ prefix = "" } = {}) { return { blobs: (await q("SELECT key FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => ({ key: r.key })) }; },
  /* not in Blobs: every value under a prefix in one query (documents, history) */
  async getAll(prefix) { return (await q("SELECT value FROM hub_kv WHERE key LIKE $1 ORDER BY key", [like(prefix)])).map(r => r.value); }
};

/* Copy everything from a Blobs store into hub_kv, `size` keys per call (each request has a time limit): call again with
   from = next until more is false. Safe to run again: a key already here is left as it is unless `replace`. */
export async function moveFromBlobs(blobs, { replace = false, from = 0, size = 400 } = {}) {
  const list = (await blobs.list()).blobs.sort((a, b) => a.key.localeCompare(b.key));
  const end = Math.min(list.length, from + size);
  let copied = 0, kept = 0;
  for (let i = from; i < end; i += 25) {
    const part = list.slice(i, Math.min(i + 25, end));
    const vals = await Promise.all(part.map(b => blobs.get(b.key, { type: "json" }).catch(() => null)));
    for (let j = 0; j < part.length; j++) {
      if (vals[j] == null) continue;
      const r = replace
        ? await q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, etag = EXCLUDED.etag, updated_at = now() RETURNING key", [part[j].key, JSON.stringify(vals[j]), tag()])
        : await q("INSERT INTO hub_kv (key, value, etag) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING RETURNING key", [part[j].key, JSON.stringify(vals[j]), tag()]);
      r.length ? copied++ : kept++;
    }
  }
  return { keys: list.length, copied, kept, more: end < list.length, next: end < list.length ? end : null };
}
