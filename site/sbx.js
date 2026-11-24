/* LHQ Hub › the Sandbox (Mockups 20 and 20b, agreed 22 Nov). The Director's made-up LHQ: its own storage on the server ("sbx/") and on this
   device ("sbx:" keys, see store.js), a gold strip on every page, nothing sent, no activity recorded. Up to 500 people across all services,
   built from the Director's settings or from the Plan, with the real staff and tutors. "View as" shows it as one of them. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id), toast = m => window.hubToast ? hubToast(m) : alert(m);
  const on = () => !!(window.lhqSandbox && lhqSandbox()), asId = () => window.lhqSandboxAs ? lhqSandboxAs() : '';
  const rawGet = k => window.lhqRawGet ? lhqRawGet(k) : localStorage.getItem(k), rawSet = (k, v) => window.lhqRawSet ? lhqRawSet(k, v) : localStorage.setItem(k, v), rawDel = k => window.lhqRawDel ? lhqRawDel(k) : localStorage.removeItem(k);
  const realSession = () => { try{ return JSON.parse(rawGet('lhq_session') || 'null'); }catch(e){ return null; } };
  const isDirReal = () => ((realSession() || {}).me || {}).role === 'director';
  const MAX = 500;
  const DEF = {from: 'mine', n: 120, kids: 30, kidsTu: 20, multi: 20, kept: 85, perFam: 1.15, onTime: 85, inst: 30, months: 6, ass: []};
  const SET = () => { try{ return Object.assign({}, DEF, JSON.parse(rawGet('lhq_sbxset') || '{}')); }catch(e){ return Object.assign({}, DEF); } };
  const keep = o => rawSet('lhq_sbxset', JSON.stringify(o));
  /* the measures an assumption can move (Add a setting › Linked to a measure) */
  const MEAS = [['onTime', 'Payments on time', '%'], ['kept', 'Students kept each month', '%'], ['multi', 'In more than one programme', '%'], ['kidsTu', 'Activity children who also do tuition', '%'], ['n', 'Tuition students', ''], ['kids', 'Children in activities', '']];
  async function realApi(path, body){ const s = realSession(), h = {'content-type': 'application/json'}; if(s && s.token) h.authorization = 'Bearer ' + s.token;
    const r = await fetch('/api/hub/' + path, {method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'}); const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }
  async function sbxApi(body){ const s = realSession(), h = {'content-type': 'application/json', 'x-lhq-sbx': '1'}; if(s && s.token) h.authorization = 'Bearer ' + s.token;
    const r = await fetch('/api/hub/sbx', {method: 'POST', headers: h, body: JSON.stringify(body), cache: 'no-store'}); const j = await r.json().catch(() => ({})); if(!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }

  /* the Plan's year as Sandbox settings: tuition students, programme places and partner children */
  function fromPlan(v){ if(!window.PLAN || !/^y\d/.test(v)) return null; const [y, cs] = v.slice(1).split('-'); PLAN.load(); const M = PLAN.model(+y - 1, cs || 'exp'); if(!M || !M.streams) return null;
    let n = 0, places = 0, kids = 0, kept = 0, kn = 0; M.streams.forEach(r => { const s = r.s || {}; if(s.kind === 'tuition'){ n += r.studentsEnd || 0; kept += (+s.kept || 0); kn++; }
      else if(s.kind === 'prog' || s.kind === 'exam') places += (+s.runs || 0) * (+s.places || 0) * (+s.fill || 0) / 100; else if(s.kind === 'partner') kids += (+s.children || 0); });
    n = Math.round(n); kids = Math.round(kids) || 0; const tot = n + kids, f = tot > MAX ? MAX / tot : 1;
    return {n: Math.max(5, Math.round(n * f)), kids: Math.round(kids * f), multi: n ? Math.min(60, Math.round(places / n * 100)) : 0, kept: kn ? Math.round(Math.pow(Math.min(.99, kept / kn / 100), 1 / 4) * 100) : 85, scaled: f < 1}; }
  /* settings with the linked assumptions applied */
  function effective(o){ const e = Object.assign({}, o), P = o.from !== 'mine' ? fromPlan(o.from) : null; if(P) Object.assign(e, P);
    (o.ass || []).filter(a => a.link && a.m).forEach(a => { const k = a.m, v = +e[k] || 0; e[k] = MEAS.find(x => x[0] === k)[2] === '%' ? Math.max(0, Math.min(100, v + (+a.chg || 0))) : Math.max(0, Math.round(v * (1 + (+a.chg || 0) / 100))); });
    e.n = Math.max(1, Math.min(MAX, +e.n || 0)); e.kids = Math.max(0, Math.min(MAX - e.n, +e.kids || 0)); return e; }

  /* ---------- the strip ---------- */
  function strip(){ let el = $('sbxBar'); if(!on()){ if(el) el.remove(); document.documentElement.classList.remove('lhq-sbx'); return; }
    document.documentElement.classList.add('lhq-sbx');
    const as = (() => { try{ return JSON.parse(rawGet('lhq_sbxas') || 'null'); }catch(e){ return null; } })();
    if(!el){ el = document.createElement('div'); el.id = 'sbxBar'; document.body.prepend(el); }
    el.innerHTML = `<b>SANDBOX</b> · made-up data · nothing is sent${as ? ` · viewing as <b>${esc(as.name)}</b> <button data-sbxas="">Back to you</button>` : ''} <a href="index.html#set/sandbox">Sandbox</a> <button data-sbxleave>Leave</button>`; }
  const css = document.createElement('style');
  css.textContent = `#sbxBar{position:sticky;top:0;z-index:9998;background:#c9971a;color:#14213d;font:700 12.5px/1.35 Manrope,system-ui,sans-serif;text-align:center;padding:7px 12px;display:flex;flex-wrap:wrap;gap:6px 10px;justify-content:center;align-items:center}
    #sbxBar b{font-weight:800;letter-spacing:.03em}#sbxBar button,#sbxBar a{font:inherit;font-weight:800;background:rgba(255,255,255,.55);border:0;border-radius:8px;padding:3px 9px;color:#14213d;cursor:pointer;text-decoration:none}
    html.lhq-sbx.lhq-test body::before{display:none}.sbx-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}.sbx-g label{margin:0}.sbx-ass{display:inline-block;font-size:11px;font-weight:800;padding:2px 7px;border-radius:7px;background:var(--am-bg);color:var(--am)}
    .sbx-prog{height:8px;border-radius:5px;background:var(--line);overflow:hidden;margin:8px 0}.sbx-prog i{display:block;height:100%;background:#c9971a;width:0}`;
  document.head.appendChild(css);

  /* ---------- switching ---------- */
  function syncReset(){ ['lhq_syncBase', 'lhq_syncKv', 'lhq_syncRev', 'lhq_syncDirty', 'lhq_syncEpoch'].forEach(k => localStorage.removeItem(k)); }
  function wipeLocal(){ const ks = []; for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith('sbx:')) ks.push(k); } ks.forEach(rawDel); }
  /* room on the device (a phone keeps about 5 MB per site): while in the Sandbox the real Hub's copy here is let go (it's all on the server and
     comes back on Leave), and only one Sandbox copy is kept at a time (yours, or the person you're viewing as) */
  const KEEP = ['lhq_session', 'lhq_sbxmode', 'lhq_sbxas', 'lhq_sbxset', 'lhq_theme', 'lhq_lean'];
  function dropReal(){ if(rawGet('lhq_syncDirty') === 'true') return false; const ks = []; for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(k && k.startsWith('lhq_') && !KEEP.includes(k)) ks.push(k); } ks.forEach(rawDel); return true; }
  function dropOtherCopies(keepAs){ const ks = []; for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(!k || !k.startsWith('sbx:') || /:lhq_session$/.test(k)) continue; const a = /^sbx:(p[^:]*):/.exec(k); if((a ? a[1] : '') !== (keepAs || '')) ks.push(k); } ks.forEach(rawDel); }
  async function copyPlan(){ try{ const P = await realApi('plan'); if(P && P.plan) await sbxApi({action: 'kv', kv: {lhq_bplan: {items: P.plan}}}); }catch(e){} }
  async function enter(){ if(!dropReal()) return toast('Some changes are still saving. Try again in a moment.'); await copyPlan(); rawSet('lhq_sbxmode', '1'); rawDel('lhq_sbxas'); location.href = 'index.html#set/sandbox'; setTimeout(() => location.reload(), 50); }
  function leave(){ dropOtherCopies('\u0000'); rawDel('lhq_sbxmode'); rawDel('lhq_sbxas'); location.href = 'index.html#set/sandbox'; setTimeout(() => location.reload(), 50); }
  function viewAs(p){ dropOtherCopies(p ? p.id : ''); if(!p){ rawDel('lhq_sbxas'); location.href = 'index.html#set/sandbox'; return setTimeout(() => location.reload(), 50); }
    const s = realSession(); rawSet('lhq_sbxas', JSON.stringify({id: p.id, name: p.name}));
    rawSet('sbx:' + p.id + ':lhq_session', JSON.stringify(Object.assign({}, s, {me: Object.assign({}, p, {view: 'full'})})));
    location.href = 'index.html#home'; setTimeout(() => location.reload(), 50); }

  /* ---------- building ---------- */
  let BUSY = null, PPL = null, PPLbusy = false;
  async function build(o, more){
    if(BUSY) return; const e = effective(o); BUSY = {step: 'Getting your staff and tutors', pc: 2}; draw();
    try{
      const ppl = (await realApi('people', {action: 'list'})).people || [], act = ppl.filter(p => p.active !== false);
      const tutors = act.filter(p => p.tutor || p.role === 'tutor').map(p => p.name), admins = act.filter(p => ['director', 'admin'].includes(p.role)).map(p => p.name);
      const years = (typeof settingsKV === 'function' ? String(settingsKV().levels || '').split('\n') : []).map(x => x.trim()).filter(x => /^year|^reception/i.test(x));
      BUSY = {step: `Making ${e.n} students and ${e.kids} activity children`, pc: 6}; draw(); await new Promise(r => setTimeout(r, 60));
      if(!window.LHQDemo){ await loadScript('topics.js'); await loadScript('demo.js'); }
      const D = LHQDemo.build({seed: 11 + (o.months || 6), n: e.n, kids: e.kids, kidsTu: e.kidsTu, multi: e.multi, kept: e.kept, perFam: e.perFam, onTime: e.onTime, inst: e.inst, months: e.months, tutors: tutors.length ? tutors : null, admins: admins.length ? admins : null, years, progs: window.PROGS ? PROGS() : []});
      await sbxApi({action: 'clear'});
      const docs = D.docs, N = 300; for(let i = 0; i < docs.length; i += N){ BUSY = {step: `Saving documents · ${Math.min(i + N, docs.length)} of ${docs.length}`, pc: 10 + Math.round(i / docs.length * 70)}; draw(); await sbxApi({action: 'docs', docs: docs.slice(i, i + N)}); }
      const kv = Object.assign({}, D.kv); delete kv.lhq_bplan;   // the Plan stays the real one: the Sandbox is measured against it
      const K = Object.keys(kv); for(let i = 0; i < K.length; i++){ BUSY = {step: `Saving lists · ${i + 1} of ${K.length}`, pc: 80 + Math.round(i / K.length * 18)}; draw(); await sbxApi({action: 'kv', kv: {[K[i]]: kv[K[i]]}}); }
      await copyPlan(); o.info = {at: Date.now(), set: e, docs: docs.length, people: e.n + e.kids}; keep(o);
      dropReal(); rawSet('lhq_sbxmode', '1'); rawDel('lhq_sbxas'); wipeLocal(); BUSY = {step: 'Done. Opening the Sandbox…', pc: 100}; draw();
      setTimeout(() => { location.href = 'index.html#set/sandbox'; location.reload(); }, 600);
    }catch(err){ BUSY = null; toast(err.message); draw(); }
  }
  const draw = () => { if(window.hubApply) hubApply(); };

  /* ---------- Settings › Sandbox ---------- */
  function page(){
    if(!isDirReal()) return '<p class="empty">The Sandbox is for the Director.</p>';
    const o = SET(), e = effective(o), info = o.info || null, ppl = PPL || []; if(!PPL && !PPLbusy){ PPLbusy = true; realApi('people', {action: 'list'}).then(j => { PPL = j.people || []; draw(); }).catch(() => {}); }
    const num = (k, l, min, max, step, sfx) => `<label class="f"><span>${l}</span><input class="in" type="number" id="sx_${k}" min="${min}" max="${max}" step="${step || 1}" value="${esc(o[k])}" ${o.from !== 'mine' && ['n', 'kids', 'multi', 'kept'].includes(k) ? 'disabled' : ''}>${sfx ? `<small class="note" style="margin:2px 0 0">${sfx}</small>` : ''}</label>`;
    const PL = [['mine', 'My settings below']].concat([1, 2, 3, 4, 5].flatMap(y => [['exp', 'Expected'], ['low', 'Low'], ['high', 'High']].map(([c, l]) => ['y' + y + '-' + c, `The Plan · Year ${y} · ${l}`])));
    const P = o.from !== 'mine' ? fromPlan(o.from) : null;
    return `<h2 class="sec-h">Sandbox</h2><p class="sec-p">A made-up LHQ to try the Hub at any size: its own storage, a gold strip on every page, nothing sent. Your real documents and lists are never touched. Up to ${MAX} people.</p>
      ${BUSY ? `<div class="card pad"><b>${esc(BUSY.step)}</b><div class="sbx-prog"><i style="width:${BUSY.pc}%"></i></div><p class="note" style="margin:0">Keep this page open. ${e.n + e.kids > 250 ? 'At this size it takes a few minutes.' : ''}</p></div>` : `
      ${on() ? `<div class="card pad" style="margin-bottom:12px"><b>You're in the Sandbox</b><p class="note" style="margin:4px 0 8px">${info ? `${info.people} people · ${info.docs} documents · ${info.set.months} months · built ${new Date(info.at).toLocaleString('en-GB', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}` : 'Nothing built yet.'}</p>
        <label class="f"><span>View as</span><select class="in" id="sxAs"><option value="">You (Director)</option>${ppl.filter(p => p.active !== false && !['director', 'student', 'parent'].includes(p.role)).map(p => `<option value="${esc(p.id)}" ${asId() === p.id ? 'selected' : ''}>${esc(p.name)} · ${p.role === 'tutor' ? 'tutor' : (p.perms || []).includes('bdo') ? 'BDO' : (p.perms || []).includes('acct') ? 'accountant' : 'admin'}</option>`).join('')}</select></label>
        <div class="r2"><button class="btn" data-sxleave>Leave the Sandbox</button><button class="btn" data-sxclear>Clear</button></div></div>`
      : `<button class="btn n full" data-sxenter style="margin-bottom:12px">Open the Sandbox</button>`}
      <div class="h2">Build</div>
      <label class="f"><span>Build from</span><select class="in" id="sx_from">${PL.map(([v, l]) => `<option value="${v}" ${o.from === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${P ? `<p class="note">From the Plan: ${P.n} tuition students, ${P.kids} activity children, ${P.multi}% also in a programme, ${P.kept}% kept each month${P.scaled ? ` · scaled down to fit ${MAX}` : ''}.</p>` : ''}
      <div class="h2">People</div><div class="sbx-g">${num('n', 'Tuition students', 1, MAX, 1)}${num('kids', 'Children in activities', 0, MAX, 1)}${num('kidsTu', 'of them also in tuition', 0, 100, 1, '%')}${num('multi', 'In more than one programme', 0, 100, 1, '%')}${num('perFam', 'Children per family', 1, 2, .05)}</div>
      <div class="h2">Returning and payments</div><div class="sbx-g">${num('kept', 'Kept each month', 30, 99, 1, '%')}${num('onTime', 'Payments on time', 0, 100, 1, '%')}${num('inst', 'Paying in instalments', 0, 100, 1, '%')}<label class="f"><span>History</span><select class="in" id="sx_months">${[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => `<option ${+o.months === m ? 'selected' : ''} value="${m}">${m} months</option>`).join('')}</select></label></div>
      <p class="note">Years come from Years we teach, programmes from Programmes, tutors and staff are your real ones. Attendance, SRAs, enquiries, partners and costs use the usual demo rates.</p>
      <div class="h2">Your assumptions <button class="btn sm" data-sxadd>+ Add a setting</button></div>
      <div class="card one">${(o.ass || []).map((a, i) => `<div class="it"><span class="t"><b>${esc(a.name)} <span class="sbx-ass">Your assumption</span></b><small>${a.link && a.m ? `Moves ${esc((MEAS.find(x => x[0] === a.m) || [])[1] || a.m)} by ${+a.chg > 0 ? '+' : ''}${+a.chg}${(MEAS.find(x => x[0] === a.m) || [])[2] === '%' ? ' points' : '%'}` : 'Shown only'}${a.note ? ' · ' + esc(a.note) : ''}</small></span><button class="btn sm" data-sxdel="${i}">Remove</button></div>`).join('') || '<p class="empty">None. Example: "ARS done on time", linked to Students kept each month, +3.</p>'}</div>
      <p class="note">An assumption is never applied to the real Hub. The Hub later shows what really happened next to it.</p>
      <div class="card pad" style="margin-top:12px"><b>${e.n + e.kids} people</b> · ${e.n} in tuition, ${e.kids} in activities · ${e.months} months${(o.ass || []).some(a => a.link) ? ' · with your assumptions' : ''}
        <div class="r2" style="margin-top:10px"><button class="btn n" data-sxbuild>${info ? 'Rebuild' : 'Build'}</button>${info ? `<button class="btn" data-sxmonth>Add a month</button>` : ''}</div></div>`}`;
  }
  function addSheet(){ openSheet(`<div class="hx"><h3>Add a setting</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="sa_n" placeholder="ARS done on time"></label>
      <label class="f"><span>What it does</span><select class="in" id="sa_l"><option value="">Shown only</option><option value="1">Linked to a measure</option></select></label>
      <div class="r2"><label class="f"><span>Measure</span><select class="in" id="sa_m">${MEAS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><label class="f"><span>Moves it by</span><input class="in" id="sa_c" type="number" value="3"></label></div>
      <label class="f"><span>Note (optional)</span><input class="in" id="sa_note" placeholder="Why you think so"></label>
      <p class="note">For a % measure the change is in points (85% + 3 = 88%); for a count it's a % of it.</p><button class="btn n full" id="saGo">Add</button>`);
    $('saGo').onclick = () => { const n = $('sa_n').value.trim(); if(!n) return toast('Name it'); const o = SET(); o.ass = (o.ass || []).concat({name: n, link: !!$('sa_l').value, m: $('sa_m').value, chg: +$('sa_c').value || 0, note: $('sa_note').value.trim()}); keep(o); closeSheet(); draw(); }; }

  const readForm = () => { const o = SET(); ['n', 'kids', 'kidsTu', 'multi', 'perFam', 'kept', 'onTime', 'inst'].forEach(k => { const el = $('sx_' + k); if(el && !el.disabled) o[k] = +el.value; }); const m = $('sx_months'); if(m) o.months = +m.value; const f = $('sx_from'); if(f) o.from = f.value; return o; };
  document.addEventListener('change', e => { const id = e.target && e.target.id || ''; if(id === 'sxAs'){ const v = e.target.value, p = (PPL || []).find(x => x.id === v); return viewAs(p || null); }
    if(id.startsWith('sx_')){ const o = readForm(); if(o.n + o.kids > MAX) toast(`Up to ${MAX} people in all`); keep(o); if(id === 'sx_from') draw(); } });
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-sxenter],[data-sxleave],[data-sxclear],[data-sxbuild],[data-sxmonth],[data-sxadd],[data-sxdel],[data-sbxleave],[data-sbxas]'); if(!t) return; e.preventDefault(); const d = t.dataset;
    if('sxenter' in d) return enter(); if('sxleave' in d || 'sbxleave' in d) return leave(); if('sbxas' in d) return viewAs(null); if('sxadd' in d) return addSheet();
    if(d.sxdel != null){ const o = SET(); o.ass.splice(+d.sxdel, 1); keep(o); return draw(); }
    if('sxclear' in d){ if(!confirm('Clear the Sandbox? Your real Hub is not touched.')) return; return sbxApi({action: 'clear'}).then(() => { const o = SET(); delete o.info; keep(o); wipeLocal(); syncReset(); toast('Sandbox cleared'); setTimeout(() => location.reload(), 400); }).catch(err => toast(err.message)); }
    if('sxbuild' in d){ const o = readForm(); if(o.n + o.kids > MAX) return toast(`Up to ${MAX} people in all`); keep(o); return build(o); }
    if('sxmonth' in d){ const o = readForm(); if(o.months >= 24) return toast('24 months at most'); o.months = (+o.months || 6) + 1; keep(o); return build(o, true); } });
  /* in the Sandbox nothing leaves the Hub: WhatsApp and email links are stopped */
  document.addEventListener('click', e => { if(!on()) return; const a = e.target.closest && e.target.closest('a[href^="https://wa.me"],a[href^="mailto:"],a[href^="https://api.whatsapp"]'); if(a){ e.preventDefault(); e.stopPropagation(); toast('Sandbox: nothing is sent'); } }, true);
  const start = () => { strip(); };
  if(document.body) start(); else addEventListener('DOMContentLoaded', start);
  window.SBX = {page, on, strip};
})();
