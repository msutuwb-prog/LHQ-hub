// LHQ Hub shared records (api/v2): the one set of records every account works from (Postgres, see netlify/lib).
// Runs alongside api/hub, which keeps doing documents, sign-in and the current tutor area until each step moves over.
//
//   GET  /api/v2/health                public: is the database on? (yes/no, no records)
//   GET  /api/v2/me                    who I am, as the records know me
//   GET  /api/v2/changes?since=N       everything I may see that changed after rev N (0 = all): how every device syncs
//   POST /api/v2/cmd {name, args, op}  change something (see netlify/lib/commands.mjs for every command and who may run it)
//   GET  /api/v2/feedback              students' feedback as averages per tutor (Director only; single answers never leave)
//   GET  /api/v2/pay?tutor=&month=     a tutor's pay for a month, worked out now (Director or Admin with Tutor pay)
//   POST /api/v2/import                copy people, students, cards, classes and logs from the current Hub (Director)
//   POST /api/v2/demo                  fill a preview with the mockup's made-up people (Director, previews only)
import { personFrom } from "./hub.mjs";
import { one, q } from "../lib/db.mjs";
import { changes, run, writeTx } from "../lib/records.mjs";
import { Refused, payFor } from "../lib/commands.mjs";
import { isDir, canPay, redact } from "../lib/access.mjs";
import { importFromBlobs } from "../lib/importer.mjs";
import { seedDemo } from "../lib/demo.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ error: msg }, status);

/* the person in the records for whoever signed in. Staff and tutors come from the current sign-in (Blobs) until step 2. */
let auth = personFrom;
export const _setAuth = f => { auth = f; };
async function whoAmI(req, context) {
  const p = await auth(req, context);
  if (!p) return null;
  const want = { name: p.name, role: p.role, perms: JSON.stringify(p.role === "admin" ? (p.perms || []) : []), also_tutor: !!p.tutor && p.role !== "tutor" };
  let me = await one("SELECT * FROM people WHERE id = $1", [p.id]);
  if (!me || me.name !== want.name || me.role !== want.role || JSON.stringify(me.perms) !== want.perms || me.also_tutor !== want.also_tutor) {
    me = await writeTx(T => T.one(`INSERT INTO people (id, name, role, perms, also_tutor, status) VALUES ($1, $2, $3, $4, $5, 'pin')
      ON CONFLICT (id) DO UPDATE SET name = $2, role = $3, perms = $4, also_tutor = $5 RETURNING *`, [p.id, want.name, want.role, want.perms, want.also_tutor]));
  }
  if (me.del || me.status === "off") return null;
  return me;
}

export default async (req, context) => {
  const url = new URL(req.url), path = url.pathname.replace(/^\/api\/v2\/?/, "").replace(/\/$/, "");
  const preview = ((context && context.deploy && context.deploy.context) || "production") !== "production";
  try {
    /* public: is the database switched on? (no records, just yes or no) */
    if (req.method === "GET" && path === "health") {
      try { const r = await one("SELECT count(*)::int AS n FROM people"); return json({ database: "on", tables: "ready", people: r.n, preview }); }
      catch (e) { return json({ database: e && e.name === "MissingDatabaseConnectionError" ? "off" : "error", detail: e && e.name === "MissingDatabaseConnectionError" ? "Netlify Database isn't set up for this site yet." : String(e.message || e).slice(0, 200), preview }, 503); }
    }
    const me = await whoAmI(req, context);
    if (!me) return fail("Please sign in again.", 401);
    if (req.method === "GET" && path === "me") return json({ me: redact("people", me, me) });
    if (req.method === "GET" && path === "changes") return json(await changes(me, Math.max(0, Number(url.searchParams.get("since")) || 0)));
    if (req.method === "POST" && path === "cmd") {
      const b = await req.json().catch(() => ({}));
      return json(await run(me, String(b.name || ""), b.args || {}, b.op || null));
    }
    if (req.method === "GET" && path === "feedback") {
      if (!isDir(me)) return fail("Students' feedback is for Wanangwa, as averages.", 403);
      const rows = await q(`SELECT tutor_id, count(*)::int AS n, round(avg(rating)::numeric, 1)::float AS rating,
          round(100.0 * avg(CASE WHEN prepared THEN 1 WHEN prepared = false THEN 0 END))::int AS prepared,
          round(100.0 * avg(CASE WHEN on_time THEN 1 WHEN on_time = false THEN 0 END))::int AS on_time
        FROM feedback WHERE NOT del GROUP BY tutor_id HAVING count(*) >= 3`);
      return json({ tutors: rows, note: "Tutors with fewer than 3 answers aren't shown, so no single answer can be worked out." });
    }
    if (req.method === "GET" && path === "pay") {
      if (!canPay(me)) return fail("Only Wanangwa (or Admin with Tutor pay) sees pay.", 403);
      const month = url.searchParams.get("month") || "";
      if (!/^\d{4}-\d{2}$/.test(month)) return fail("Which month?");
      return json(await writeTx(T => payFor(T, url.searchParams.get("tutor"), month)));
    }
    if (req.method === "POST" && path === "import") {
      if (!isDir(me)) return fail("Only Wanangwa can copy the Hub into the new records.", 403);
      const b = await req.json().catch(() => ({}));
      return json(await importFromBlobs(me, { preview, part: Math.max(0, Number(b.part) || 0) }));
    }
    if (req.method === "POST" && path === "demo") {
      if (!isDir(me)) return fail("Only Wanangwa can do that.", 403);
      if (!preview) return fail("Made-up data only goes into a preview, never into LHQ's real records.", 403);
      const b = await req.json().catch(() => ({}));
      return json(await seedDemo(me, Math.max(0, Math.min(4, Number(b.step) || 0))));
    }
    return fail("Not found.", 404);
  } catch (e) {
    if (e instanceof Refused) return fail(e.message, e.status);
    if (e && e.name === "MissingDatabaseConnectionError") return fail("The shared records' database isn't switched on yet in Netlify (Extensions › Database).", 503);
    console.error(e);
    return fail("Something went wrong on the server. Try again.", 500);
  }
};

export const config = { path: "/api/v2/*" };
