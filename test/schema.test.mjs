/* Netlify applies netlify/database/migrations on deploy; the functions use schema.mjs elsewhere. They must match. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MIGRATIONS } from "../netlify/lib/schema.mjs";

test("every migration in schema.mjs has the same SQL in netlify/database/migrations", () => {
  const dir = new URL("../netlify/database/migrations/", import.meta.url), files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  assert.equal(files.length, MIGRATIONS.length);
  MIGRATIONS.forEach((m, i) => assert.equal(fs.readFileSync(new URL(files[i], dir), "utf8").replace(/^--.*\n/, "").trim(), m.sql.trim(), files[i]));
});
