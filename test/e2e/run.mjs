/* LHQ Hub end-to-end: the Director, an Admin and a tutor on three separate devices (browser contexts), working on the
   same Hub at the same time, through the real pages and the real server, on the database.
   Run:  DATABASE_URL=postgres://user:pass@localhost/test_db node test/e2e/run.mjs      (empties that database)
   Needs Playwright (require('playwright')). Prints each check and exits 1 if any fail. */
import { createRequire } from "node:module";
import { start } from "./server.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const PORT = 8931, U = `http://localhost:${PORT}/`;
const srv = await start(PORT, process.env.DATABASE_URL);
const results = []; let failed = 0;
const check = (ok, what, detail = "") => { results.push(`${ok ? "✓" : "✗"} ${what}${ok || !detail ? "" : "\n    " + detail}`); if (!ok) failed++; console.log(results[results.length - 1]); };
const sql = async (t, a = []) => (await srv.pool.query(t, a)).rows;
const browser = await chromium.launch(), errs = [];
const device = async (w = 412) => { const c = await browser.newContext({ viewport: { width: w, height: 900 } }); const p = await c.newPage(); p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept()); return p; };
const api = (p, path, body, method) => p.evaluate(async ([path, body, method]) => { try { return await hub.api(path, body ? { method: "POST", body: JSON.stringify(body) } : { method: method || "GET" }); } catch (e) { return { error: e.message, status: e.status }; } }, [path, body, method]);
const pull = p => p.evaluate(async () => { await hub.pull(); });
const go = async (p, h, wait = 1200) => { await p.goto(U + h); await p.waitForTimeout(wait); };
const text = (p, sel = "main") => p.innerText(sel);
const signInWithCode = async (p, code, password) => {
  await go(p, "", 800);
  return p.evaluate(async ([code, password]) => {
    const post = async (path, b) => (await fetch("/api/hub/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
    const a = await post("code", { code }); const s = await post("password", { ticket: a.ticket, password });
    localStorage.setItem("lhq_session", JSON.stringify(s)); return !!s.token;
  }, [code, password]);
};
const VIEW = process.env.E2E_VIEW === "full" ? "full" : "lean";
const iso = d => d.toISOString().slice(0, 10), today = iso(new Date()), addD = n => iso(new Date(Date.now() + n * 864e5));
const money = n => "MKW " + Math.round(n).toLocaleString("en-US");

try {
  /* 1. The Director sets up the Hub and moves it onto the database */
  const D = await device(1280);
  await go(D, "", 1500);
  await D.fill("#hubSc", "SETUP123"); await D.fill("#hubNm", "Wanangwa Msutu"); await D.fill("#hubP1", "Lilongwe-2026!"); await D.click("[data-k=go]"); await D.waitForTimeout(2500);
  check((await text(D)).includes("Good"), "Director sets up the Hub and lands on Home");
  await api(D, "sync", { kv: { lhq_settings: { levels: "Year 10 · IGCSE\nYear 11 · IGCSE" } } });
  const mv = await api(D, "store", { action: "move" }); const use = await api(D, "store", { action: "use", to: "db" });
  check(use.using === "db", "the Hub is switched onto the database", JSON.stringify(use).slice(0, 200));

  /* 2. The Director adds an Admin and a tutor; each chooses a password on their own device */
  const ad = await api(D, "people", { action: "add", name: "Catherine Mkwinda", role: "admin" });
  const tu = await api(D, "people", { action: "add", name: "Emmanuel Mkwamba", role: "tutor" });
  check(!!(ad.code && tu.code), "Director adds an Admin and a tutor and gets their setup codes", JSON.stringify([ad, tu]).slice(0, 200));
  const A = await device(412), Tt = await device(412);
  check(await signInWithCode(A, ad.code, "Office#2026x"), "Admin chooses a password with the setup code");
  check(await signInWithCode(Tt, tu.code, "Tutor#2026xy"), "Tutor chooses a password with the setup code");
  if (VIEW === "full") for (const p of [D, A, Tt]) await p.evaluate(async () => { const r = await hub.api("people", { method: "POST", body: JSON.stringify({ action: "view", view: "full" }) }); const s = hub.session(); s.me = Object.assign(s.me, { view: "full" }); localStorage.setItem("lhq_session", JSON.stringify(s)); return r; });
  check((await D.evaluate(() => (hub.session().me || {}).view || "lean")) === VIEW, `everyone sees the ${VIEW} view`);
  await go(A, "", 2000); check((await text(A)).includes("Good"), "Admin's Hub opens on Home");
  await go(Tt, "", 2500); check(Tt.url().includes("#teach"), "the tutor's Hub opens on Teaching");

  /* 3. Admin enrols a student: quote → invoice → payment → tuition card naming the tutor */
  const st = "Linga Shaba", key = "linga shaba";
  const base = { student: st, name: "Mrs Shaba", level: "Year 11 · IGCSE", phone: "0991 234 567", items: [{ desc: "Mathematics", days: "2", sessions: "8", cost: "15000" }], periodStart: addD(-3), periodEnd: addD(25), total: 120000 };
  const q1 = await api(A, "sync", { upserts: [{ doc: Object.assign({ id: "e2eq1", type: "quote", number: "Q-1001", date: addD(-6), dueDate: addD(20) }, base) }], kv: { lhq_students: { [key]: { name: st, level: "Year 11 · IGCSE", phone: "0991 234 567", heard: "Facebook" } } } });
  const i1 = await api(A, "sync", { upserts: [{ doc: Object.assign({ id: "e2ei1", type: "invoice", number: "INV-0001", date: addD(-4), dueDate: addD(-1), ref: "Q-1001", paid: "" }, base) }] });
  check(!q1.error && !i1.error, "Admin saves a quote and turns it into an invoice", JSON.stringify([q1, i1]).slice(0, 200));
  await pull(D); await go(D, "#biz/owed", 1500);
  check((await text(D)).includes(st), "the unpaid invoice shows in the Director's Owed to LHQ", (await text(D)).slice(0, 300));
  await go(D, "", 1500); const homeBefore = await text(D, ".mcs");
  const r1 = await api(A, "sync", { upserts: [{ doc: Object.assign({ id: "e2er1", type: "receipt", number: "RCT-0001", date: today, ref: "INV-0001", received: "120000", receivedAmt: 120000, method: "Airtel Money", receivedBy: "Catherine Mkwinda" }, base) },
    { doc: Object.assign({ id: "e2ei1", type: "invoice", number: "INV-0001", date: addD(-4), dueDate: addD(-1), ref: "Q-1001", paid: "120000" }, base) }] });
  const c1 = await api(A, "sync", { upserts: [{ doc: Object.assign({ id: "e2ec1", type: "card", number: "TC-0001", date: today, ref: "INV-0001", where: "LHQ Centre",
    subjects: [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Tu", "Th"], start: "14:00", end: "15:00", perWeek: "2", sessions: "8" }] }, base) }] });
  check(!r1.error && !c1.error, "Admin records the payment and makes the tuition card", JSON.stringify([r1, c1]).slice(0, 200));
  await pull(D); await go(D, "", 1500); const homeAfter = await text(D, ".mcs");
  const recv = t => { const m = /(?:Money this month|Money in)\s*MKW\s*([\d.,]+)(k|M)?/i.exec(t.replace(/\s+/g, " ")); return m ? +m[1].replace(/,/g, "") * (m[2] === "M" ? 1e6 : m[2] === "k" ? 1e3 : 1) : NaN; };
  check(recv(homeAfter) - (recv(homeBefore) || 0) === 120000, "the Director's Home shows the MKW 120,000 received", `before ${recv(homeBefore)} after ${recv(homeAfter)}`);
  await go(D, "#biz/owed", 1500);
  check(!(await text(D)).includes(st), "the paid invoice leaves Owed to LHQ");
  await go(D, "#student/" + encodeURIComponent(key), 1500);
  const sp = await text(D); check(sp.includes("RCT-0001") || sp.includes("Paid"), "the student's page shows the payment", sp.slice(0, 300));

  /* 4. The tutor sees the new student and logs today's session; the Director and Admin see it */
  await Tt.evaluate(async () => { try { await TUT.refresh(); } catch (e) {} }); await go(Tt, "#teach", 2000);
  const its = await Tt.evaluate(() => TUT.items().map(x => x.k));
  check(its.includes("linga shaba|mathematics"), "the tutor sees only the student on their card", JSON.stringify(its));
  const lg = await api(Tt, "tutor", { action: "entries", entries: [{ id: "e2es1x", ty: "s", k: "linga shaba|mathematics", st, sub: "Mathematics", d: today, a: "present", t1: "14:00", t2: "15:00", tp: ["Quadratics"], c: Date.now() },
    { id: "e2es2x", ty: "s", k: "linga shaba|mathematics", st, sub: "Mathematics", d: addD(-2), a: "present", t1: "14:00", t2: "15:00", tp: ["Algebra"], c: Date.now() - 3 * 3600e3 }] });
  check(lg.ok, "the tutor logs two sessions", JSON.stringify(lg).slice(0, 200));
  await Tt.evaluate(async () => { try { await TUT.refresh(); } catch (e) {} }); await go(Tt, "#teach", 2000);
  check(/waiting for confirmation/.test(await text(Tt)), "the tutor sees the session waiting for confirmation");
  await pull(A); await go(A, "#sessions", 1500);
  check(/Linga Shaba · Mathematics[\s\S]{0,80}2 of 8 had/.test(await text(A)), "Admin's Sessions page counts 2 of 8 had for Linga", (await text(A)).slice(0, 400));
  check((await api(A, "confirm", { action: "confirm", id: "e2es1x", how: "By phone" })).status === 403, "Admin doesn't confirm for the family: students do");

  /* 5. Stand-ins for Stage 2: the student confirms one and disputes the other; the Director settles it; the tutor can't change a confirmed one */
  const { pgStore } = await import("../../netlify/lib/pgstore.mjs");
  const LG = await pgStore.get("kv/lhq_logs", { type: "json" });
  LG.e.e2es1x.cf = { s: "confirmed", by: st, at: Date.now() };
  LG.e.e2es2x.cf = { s: "disputed", by: st, from: st, at: Date.now(), note: "Started 15 minutes late", lost: 15 };
  await pgStore.setJSON("kv/lhq_logs", LG);
  const rows = await sql("SELECT id, confirm FROM logs WHERE id IN ('e2es1x','e2es2x') ORDER BY id");
  check(JSON.stringify(rows) === JSON.stringify([{ id: "e2es1x", confirm: "confirmed" }, { id: "e2es2x", confirm: "disputed" }]), "the database has one confirmed and one disputed", JSON.stringify(rows));
  await pull(D); await go(D, "", 1500);
  check(/Started 15 minutes late/.test(await text(D)), "the dispute shows in the Director's Needs attention");
  await go(D, "#confirm/e2es2x", 1500); await D.click('[data-cfout="lost"]'); await D.fill("#cfLost", "15"); await D.fill("#cfNote", "Agreed with both"); await D.click('[data-cfdo="settle"]'); await D.waitForTimeout(1500);
  await Tt.evaluate(async () => { try { await TUT.refresh(); } catch (e) {} }); await go(Tt, "#teach", 2000);
  const tv = await text(Tt), old = await Tt.evaluate(d => TUT.dayLogs(d).map(x => x.s).join(" | "), addD(-2));
  check(/✓ confirmed/.test(tv) && /15 min taken off/.test(old), "the tutor sees today's session confirmed and the earlier one settled with 15 min off", tv.slice(0, 300) + " || " + old);
  check((await api(Tt, "confirm", { action: "confirm", id: "e2es1x", how: "me" })).status === 403, "a tutor can't confirm their own session");
  const lock = await api(Tt, "tutor", { action: "entries", entries: [{ id: "e2es1x", ty: "s", k: "linga shaba|mathematics", st, sub: "Mathematics", d: today, a: "absent", t1: "14:00", t2: "15:00" }] });
  check(lock.status === 409, "the tutor can't change a confirmed session", JSON.stringify(lock).slice(0, 200));

  /* 5b. A clash: a second student in the same subject at the same time. The tutor teaches them together on Tuesdays and moves Thursday */
  const c2 = await api(A, "sync", { upserts: [{ doc: Object.assign({}, base, { id: "e2ec2", type: "card", number: "TC-0002", date: today, student: "Tadala Phiri", where: "LHQ Centre",
    subjects: [{ name: "Mathematics", tutor: "Emmanuel Mkwamba", days: ["Tu", "Th"], start: "14:00", end: "15:00", perWeek: "2", sessions: "8" }] }) }] });
  check(!c2.error, "Admin makes a second card at the same time", JSON.stringify(c2).slice(0, 200));
  await Tt.evaluate(async () => { try { await TUT.refresh(); } catch (e) {} }); await go(Tt, "#teach", 2000);
  check(/Clashes to sort/.test(await text(Tt)) && /Tue 14:00 · Mathematics[\s\S]{0,40}Linga Shaba, Tadala Phiri/.test(await text(Tt)), "the tutor sees the clash on their Home");
  await Tt.locator('[data-tclx^="together:group|emmanuel mkwamba|Tu|"]').click(); await Tt.waitForTimeout(2000);
  check(!/Tue 14:00/.test((await text(Tt)).split("Clashes to sort")[1] || ""), "Teaching them together: Tuesday is no longer a clash");
  await Tt.locator('[data-tclmove^="group|emmanuel mkwamba|Th|"]').click(); await Tt.waitForTimeout(800);
  await Tt.locator('[data-mvpick]', { hasText: "Tadala" }).click(); await Tt.waitForTimeout(1500);
  await Tt.locator('[data-mvto^="Th "]').first().click(); await Tt.waitForTimeout(2500);
  const tad = (await sql("SELECT body FROM documents WHERE id = 'e2ec2'"))[0].body.subjects[0];
  check(tad.times && tad.times.Th && tad.times.Th.s !== "14:00" && tad.days.join() === "Tu,Th", "the tutor moves Tadala's Thursday to a free time, keeping two days a week", JSON.stringify(tad));
  check(!/Clashes to sort/.test(await text(Tt)), "no clashes left for the tutor");
  await pull(A); await go(A, "", 1500);
  check(/Tell the family: Tadala Phiri/.test(await text(A)), "Admin is asked to tell Tadala's family");

  /* 6. Admin records spending; the Director's Business shows it; the tutor can't open money */
  const spOk = await api(A, "sync", { kv: { lhq_spend: { e2esp1: { date: today, cat: "Stationery", amount: 45000, what: "Printer paper", method: "Cash", at: Date.now() } } } });
  check(!spOk.error, "Admin records MKW 45,000 of stationery", JSON.stringify(spOk).slice(0, 200));
  await pull(D); await go(D, "#biz/spending", 1500);
  check(/Printer paper|Stationery/.test(await text(D)), "the Director's Spending shows it");
  check((await api(Tt, "state")).status === 403, "the tutor can't open LHQ's documents or money");

  /* 6b. A make-up and a requisition: the tutor books and asks, LHQ decides, the cost lands in Spending */
  const mu = await api(Tt, "tutor", { action: "makeup", k: "linga shaba|mathematics", d: today, s: "16:00", e: "17:00", why: "Missed Tuesday" });
  check(mu.ok, "the tutor books a make-up", JSON.stringify(mu).slice(0, 200));
  await pull(A); await go(A, "#bookings", 1200); await A.locator('[data-mu^="ok:"]').first().click(); await A.waitForTimeout(1500);
  const muRow = await sql("SELECT value FROM settings WHERE key = 'hub:lhq_makeups'");
  check(muRow.length && Object.values(muRow[0].value).some(m => m.status === "ok" && m.decidedBy === "Catherine Mkwinda"), "Admin confirms it on the Make-ups page");
  const rp = await api(Tt, "tutor", { action: "report", report: { d: today, req: [{ item: "Graph paper", qty: "2", by: "", for: "Linga Shaba" }], flag: null, comment: "", rate: 4, gaps: 0, hours: 1 } });
  check(rp.ok, "the tutor asks for graph paper in the daily report", JSON.stringify(rp).slice(0, 200));
  await pull(A); const rk = (await A.evaluate(() => reqList().map(r => r.key)))[0];
  check((await api(A, "req", { key: rk, action: "approve" })).status === 403, "Admin can't approve a requisition");
  await pull(D); await go(D, "#reqs", 1200); await D.locator('[data-rq^="approve:"]').first().click(); await D.waitForTimeout(1500);
  await pull(A); await go(A, "#reqs", 1200); await A.locator('[data-rq^="bought:"]').first().click(); await A.waitForTimeout(400);
  await A.fill("#rqC", "4500"); await A.click("#rqGo"); await A.waitForTimeout(1800);
  const bought = await sql("SELECT amount, body->>'what' AS what FROM money WHERE kind = 'spend' AND body->>'what' LIKE 'Graph paper%'");
  check(bought.length === 1 && +bought[0].amount === 4500, "the Director approves, Admin marks it bought, and MKW 4,500 is in Spending", JSON.stringify(bought));
  const tv2 = await api(Tt, "tutor", null, "GET");
  check(Object.values(tv2.reqs || {}).some(v => v.s === "bought") && (tv2.makeups || []).some(m => m.status === "ok"), "the tutor sees the make-up confirmed and the paper bought");

  /* 7. Activity: the Director sees who did what */
  await go(D, "#activity", 2500); const av = await text(D);
  const want = [["Catherine Mkwinda", /Made receipt RCT-0001 · Linga Shaba · MKW 120,000/], ["Emmanuel Mkwamba", /Logged 2 sessions/], ["Emmanuel Mkwamba", /Teaching them together: Linga Shaba and Tadala Phiri/],
    ["Emmanuel Mkwamba", /Moved Tadala Phiri's Mathematics from Thu 14:00–15:00/], ["Wanangwa Msutu", /Settled Linga Shaba/], ["Catherine Mkwinda", /Recorded spending · Stationery · MKW 45,000/]];
  const actRows = await sql("SELECT a.summary, coalesce(p.name, a.data->>'who') who FROM activity a LEFT JOIN people p ON p.id = a.actor_id");
  for (const [who, re] of want) check(actRows.some(r => r.who === who && re.test(r.summary)) && re.test(av), `Activity: ${who} · ${re.source.replace(/\\/g, "")}`);

  /* 8. Two devices saving at the same moment: nothing lost */
  const both = await Promise.all([api(A, "sync", { upserts: [{ doc: Object.assign({ id: "e2eq2", type: "quote", number: "Q-1002", date: today }, base, { student: "Tadala Phiri" }) }] }),
    api(D, "sync", { upserts: [{ doc: Object.assign({ id: "e2eq3", type: "quote", number: "Q-1002", date: today }, base, { student: "Kettie Gondwe" }) }] })]);
  const nums = (await sql("SELECT number FROM documents WHERE id IN ('e2eq2','e2eq3') ORDER BY number")).map(r => r.number);
  check(both.every(x => !x.error) && nums.length === 2 && nums[0] !== nums[1], "two quotes saved at once with the same number both survive, with different numbers", JSON.stringify(nums));

  check(errs.length === 0, "no errors on any page", errs.slice(0, 5).join(" | "));
} catch (e) {
  check(false, "the run stopped: " + e.message, e.stack.split("\n").slice(1, 3).join(" "));
}
await browser.close(); await srv.close();
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
