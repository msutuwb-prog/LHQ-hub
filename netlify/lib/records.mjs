/* Reading and changing the shared records: the change feed every account syncs from, and running commands.
   Writes take one lock, so every change gets its rev in the order it was saved; reading the feed waits for any save
   in progress. That way a device asking "what changed since rev N" can never miss a change that was still being saved. */
import { tx } from "./db.mjs";
import { TABLES } from "./schema.mjs";
import { visible, redact } from "./access.mjs";
import { COMMANDS, Refused } from "./commands.mjs";

const LOCK = 4711002;
let PAGE = 1000;
export const _setPage = n => { PAGE = n; };
export const writeTx = fn => tx(async T => { await T.q("SELECT pg_advisory_xact_lock($1)", [LOCK]); return fn(T); });
const readTx = fn => tx(async T => { await T.q("SELECT pg_advisory_xact_lock_shared($1)", [LOCK]); return fn(T); });
const FEED = TABLES.filter(t => t !== "setup_codes");

/* everything this person may see that changed after `since` (0 = everything). If a table has more than a page,
   `cursor` stops at the last complete point and `more` is true: ask again with since = cursor. */
export async function changes(me, since = 0) {
  return readTx(async T => {
    const top = Number((await T.one("SELECT CASE WHEN is_called THEN last_value ELSE 0 END AS v FROM lhq_rev")).v);
    const out = {}; let cursor = top, more = false;
    for (const t of FEED) {
      const rows = await T.q(`SELECT * FROM ${t} WHERE $1::text IS NOT NULL AND rev > $2 AND rev <= $3 AND ${visible(t, me)} ORDER BY rev LIMIT ${PAGE}`, [me.id, since, top]);
      if (rows.length === PAGE) { more = true; cursor = Math.min(cursor, Number(rows[rows.length - 1].rev)); }
      if (rows.length) out[t] = rows.map(r => redact(t, r, me));
    }
    if (more) for (const t of Object.keys(out)) out[t] = out[t].filter(r => Number(r.rev) <= cursor);
    return { since, cursor, more, rows: out };
  });
}

/* run one command. op = an id the app makes for this attempt: if the same op arrives twice (a phone retrying
   after losing signal), the first result is returned and nothing happens twice. */
export async function run(me, name, args = {}, op = null) {
  const fn = COMMANDS[name];
  if (!fn) throw new Refused("Unknown command: " + name, 400);
  return writeTx(async T => {
    if (op) { const done = await T.one("SELECT result FROM ops WHERE op_id = $1", [String(op).slice(0, 80)]); if (done) return Object.assign({ again: true }, done.result); }
    const { out, log } = await fn(T, me, args || {});
    if (log) await T.q("INSERT INTO activity (id, actor_id, action, area, entity, entity_id, summary, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      ["ac" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), me.id, name, log.area || "teaching", log.entity || null, log.id || null, String(log.summary).slice(0, 500), JSON.stringify(log.data || {})]);
    const rev = Number((await T.one("SELECT last_value AS v FROM lhq_rev")).v);
    const result = Object.assign({ ok: true, rev }, out || {});
    if (op) await T.q("INSERT INTO ops (op_id, person_id, name, result) VALUES ($1, $2, $3, $4)", [String(op).slice(0, 80), me.id, name, JSON.stringify(result)]);
    return result;
  });
}
