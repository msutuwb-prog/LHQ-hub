/* A local copy of the Hub for the end-to-end run: the real site and the real /api/hub and /api/v2 handlers, on an empty
   test database, with Blobs kept in memory. Never point DATABASE_URL at anything but a local test database. */
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import pg from "pg";
const ROOT = new URL("../../site/", import.meta.url).pathname;
export async function start(port, url) {
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) throw new Error("Set DATABASE_URL to a local test database.");
  process.env.LHQ_SECRET = process.env.LHQ_SECRET || "SETUP123-and-the-rest-of-a-long-secret";
  const pool = new pg.Pool({ connectionString: url });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const db = await import("../../netlify/lib/db.mjs"); db._setPool(pool);
  const hubM = await import("../../netlify/functions/hub.mjs"); hubM._setDbMode(true);
  const v2 = (await import("../../netlify/functions/v2.mjs")).default;
  const blobs = new Map(); let n = 0;
  hubM._setStore({ get: async k => blobs.has(k) ? blobs.get(k).v : null, getWithMetadata: async k => blobs.has(k) ? { data: blobs.get(k).v, etag: blobs.get(k).e } : null,
    setJSON: async (k, v, o = {}) => { const c = blobs.get(k); if (o.onlyIfMatch && (!c || c.e !== o.onlyIfMatch)) return { modified: false }; if (o.onlyIfNew && c) return { modified: false }; blobs.set(k, { v, e: "e" + (++n) }); return { modified: true, etag: "e" + n }; },
    delete: async k => { blobs.delete(k); }, list: async ({ prefix = "" } = {}) => ({ blobs: [...blobs.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }) });
  const T = { html: "text/html", js: "text/javascript", css: "text/css", png: "image/png", json: "application/json", webmanifest: "application/manifest+json" };
  const srv = http.createServer(async (req, res) => {
    const up = req.url.split("?")[0];
    if (up.startsWith("/api/hub/") || up.startsWith("/api/v2/")) {
      const ch = []; for await (const c of req) ch.push(c);
      const r = await (up.startsWith("/api/hub/") ? hubM.default : v2)(new Request("http://x" + req.url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(ch) : undefined }), { deploy: { context: "deploy-preview" } });
      res.writeHead(r.status, Object.assign({ "content-type": "application/json" }, r.headers.get("content-encoding") ? { "content-encoding": r.headers.get("content-encoding") } : {})); res.end(Buffer.from(await r.arrayBuffer())); return;
    }
    if (up.startsWith("/api/")) { res.writeHead(404); res.end("{}"); return; }
    const f = path.join(ROOT, up === "/" ? "index.html" : decodeURIComponent(up));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": T[f.split(".").pop()] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(port, r));
  return { close: async () => { srv.close(); await pool.end(); }, pool };
}
