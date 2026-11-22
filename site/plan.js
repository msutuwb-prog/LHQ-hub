/* LHQ Hub › Business › Plan (Mockups 17, 17b, 17c; agreed 22 Nov): streams with their own measures (in-person, online and partners never added together),
   measures that work forward, a year's income and profit that work backward, profit always worked out from costs, five years, the year planner,
   partners and children in activities, schools, who sees it, and the monthly board report. Every figure opens what's behind it. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), tday = () => iso(new Date());
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], MOL = ['January','February','March','April','May','June','July','August','September','October','November','December'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const nice = s => { const d = parse(s); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
  const first = n => String(n || '').split(' ')[0];
  const inits = n => String(n || '').split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const M = n => { n = Math.round(+n || 0); const a = Math.abs(n), s = n < 0 ? '−' : ''; return s + (a >= 1e9 ? (Math.round(a / 1e8) / 10) + 'bn' : a >= 1e6 ? (Math.round(a / 1e5) / 10) + 'm' : a >= 1e3 ? Math.round(a / 1e3) + 'k' : String(a)); };
  const MW = n => 'MWK ' + Math.round(+n || 0).toLocaleString('en-GB');
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const toast = m => window.hubToast ? hubToast(m) : alert(m);
  const me = () => { try{ return (hub.session() || {}).me || {}; }catch(e){ return {}; } };
  const isDir = () => me().role === 'director';
  const rerender = () => { if(window.hubApply) hubApply(); };
  const $ = id => document.getElementById(id);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- data ---------- */
  let D = null, at = 0, busy = false;
  async function load(force){ if(busy || (!force && D && Date.now() - at < 60000) || !window.hub || !hub.session()) return; busy = true;
    try{ D = await hub.api('plan'); at = Date.now(); rerender(); }catch(e){ D = D || {err: e.message}; } finally{ busy = false; } }
  const items = () => (D && D.plan) || {};
  const conf = () => Object.assign({fy: fyOf(tday()), cap: 180, junLeave: 25, low: 85, high: 115, grow: {enq: 45, fee: 8, enrol: 2, kept: 1, partners: 40, places: 30}, comm: 25000, bdoShare: 50, vis: {}}, items().conf || {});
  const streams = () => Object.values(items()).filter(x => /^s:/.test(x.id)).sort((a, b) => (a.ord || 0) - (b.ord || 0) || a.name.localeCompare(b.name));
  const costs = () => Object.values(items()).filter(x => /^c:/.test(x.id)).sort((a, b) => a.name.localeCompare(b.name));
  const planItems = () => Object.values(items()).filter(x => /^i:/.test(x.id));
  const target = y => items()['t:' + y] || {};
  async function put(key, id, rec, extra){ try{ await hub.api('plan', {method:'POST', body: JSON.stringify(Object.assign({action:'put', key, id, rec}, extra || {}))}); await load(true); return true; }catch(e){ toast(e.message); return false; } }
  async function del(key, id){ try{ await hub.api('plan', {method:'POST', body: JSON.stringify({action:'del', key, id})}); await load(true); return true; }catch(e){ toast(e.message); return false; } }
  const fyOf = d => { const p = parse(d); return p.getMonth() >= 8 ? p.getFullYear() : p.getFullYear() - 1; };   // September to August
  const fyL = y => `${y}/${String(y + 1).slice(2)}`;
  const fyMonths = y => Array.from({length: 12}, (_, i) => { const m = (8 + i) % 12, yy = y + (8 + i >= 12 ? 1 : 0); return yy + '-' + pad(m + 1); });

  /* ---------- the model: a year's income and costs from the measures (working forward) ---------- */
  const MODE = {inp:'In-person', onl:'Online', none:''}, KIND = {tuition:'Weekly tuition', prog:'Programme', exam:'Exam prep', partner:'Partners'};
  function model(n, cs = 'exp', ov){   // n: years after Year 1 (0..4); ov: measures to try (stream id → changes; _g → growth changes)
    const C = conf(), G = Object.assign({}, C.grow, (ov && ov._g) || {}), cf = cs === 'low' ? C.low / 100 : cs === 'high' ? C.high / 100 : 1;
    const S = streams().filter(s => s.status !== 'planned' || cs === 'high' || s.conf), out = {streams: [], inc: 0, cost: 0, months: Array(12).fill(0), costM: Array(12).fill(0)};
    const yr = (v, g) => v * Math.pow(1 + (g || 0) / 100, n);
    let inpStudents = 0;
    S.forEach(s0 => { const s = Object.assign({}, s0, ((ov || {})[s0.id]) || {}), r = {s, inc: 0, cost: 0, studentsEnd: 0, monthly: Array(12).fill(0)};
      if(s.kind === 'tuition'){
        const enq = yr(+s.enqM || 0, G.enq) * cf, enrol = Math.min(95, (+s.enrol || 0) + n * (+G.enrol || 0)) / 100, keptT = Math.min(99, (+s.kept || 0) + n * (+G.kept || 0)) / 100, keptM = Math.pow(keptT || 0.0001, 1 / 4), fee = yr(+s.fee || 0, G.fee);
        let st = n === 0 ? (+s.students0 || 0) : model(n - 1, cs, ov).streams.find(x => x.s.id === s.id)?.studentsEnd || 0;
        for(let i = 0; i < 12; i++){ st = st * keptM + enq * enrol; if(i === 9) st *= 1 - (+C.junLeave || 0) / 100; r.monthly[i] = st * fee; }
        r.studentsEnd = st; r.students = st; r.inc = r.monthly.reduce((a, b) => a + b, 0);
        r.cost = r.monthly.reduce((a, x, i) => a + (fee ? x / fee : 0), 0) * (+s.ses || 8) * yr(+s.rate || 0, G.fee);
        if(s.mode === 'inp') inpStudents += st;
      } else if(s.kind === 'prog' || s.kind === 'exam'){
        const places = yr(+s.places || 0, G.places) * cf, inc = (+s.runs || 1) * places * (+s.fill || 100) / 100 * yr(+s.feePlace || 0, G.fee);
        const mo = (s.months || '').split(',').map(x => +x).filter(x => x >= 1 && x <= 12); const per = mo.length ? mo : [1];
        per.forEach(m => r.monthly[(m + 3) % 12] += inc / per.length); r.inc = inc; r.cost = (+s.runs || 1) * (+s.costRun || 0) * Math.pow(1 + (G.places || 0) / 100, n);
      } else if(s.kind === 'partner'){
        const ch = yr(+s.children || 0, G.partners) * cf, full = ch * (+s.feeChild || 0) * 12;
        r.inc = s.arr === 'partner' ? full * (+s.comm || 0) / 100 : full; r.cost = s.arr === 'partner' ? 0 : full * (+s.share || 0) / 100; r.children = ch;
        for(let i = 0; i < 12; i++) r.monthly[i] = r.inc / 12;
      }
      r.monthly.forEach((v, i) => out.months[i] += v); out.inc += r.inc; out.cost += r.cost; out.streams.push(r);
    });
    const centres = Math.max(+C.centres || 1, n === 0 ? 1 : Math.ceil(inpStudents / (+C.cap || 180)));
    out.centres = centres; out.inp = inpStudents;
    out.lines = [{k:'tutor', name:'Tutor pay', why:'sessions × pay rules', amt: out.streams.filter(r => r.s.kind === 'tuition').reduce((a, r) => a + r.cost, 0)},
      {k:'prog', name:'Programme costs', why:'runs × cost a run', amt: out.streams.filter(r => ['prog','exam'].includes(r.s.kind)).reduce((a, r) => a + r.cost, 0)},
      {k:'pshare', name:'Partner shares', why:'their % of fees LHQ collects', amt: out.streams.filter(r => r.s.kind === 'partner').reduce((a, r) => a + r.cost, 0)}];
    costs().forEach(c => { let a = (+c.monthly || 0) * 12 * Math.pow(1 + (G.fee || 0) / 100 * 0.6, n); if(c.kind === 'rent') a *= centres; if(c.kind === 'staff') a *= Math.max(1, Math.pow(1 + (G.enq || 0) / 100 * 0.5, n)); out.lines.push({k:c.id, name:c.name, why:{staff:'people plan', rent:'per centre' + (centres > 1 ? ` × ${centres}` : ''), mkt:'planner items and running', materials:'materials and printing', other:''}[c.kind] || '', amt:a, c}); });
    if(n === 0){ const mk = planItems().filter(i => fyOf(i.d1 || tday()) === C.fy && +i.cost).reduce((a, i) => a + (+i.cost || 0), 0); if(mk) out.lines.push({k:'items', name:'Planner items', why:'the cost of each item in the planner', amt: mk}); }
    const tuitionNew = out.streams.filter(r => r.s.kind === 'tuition').reduce((a, r) => a + yr(+r.s.enqM || 0, G.enq) * cf * 12 * (+r.s.enrol || 0) / 100, 0);
    if(+C.comm && +C.bdoShare) out.lines.push({k:'comm', name:'BDO commission', why:`${C.bdoShare}% of enrolments × ${MW(C.comm)}`, amt: tuitionNew * C.bdoShare / 100 * C.comm});
    out.cost = out.lines.reduce((a, l) => a + l.amt, 0); out.profit = out.inc - out.cost; out.margin = pc(out.profit, out.inc);
    out.byMode = {inp: out.streams.filter(r => r.s.mode === 'inp').reduce((a, r) => a + r.inc, 0), onl: out.streams.filter(r => r.s.mode === 'onl').reduce((a, r) => a + r.inc, 0), part: out.streams.filter(r => r.s.kind === 'partner').reduce((a, r) => a + r.inc, 0)};
    out.byMode.other = out.inc - out.byMode.inp - out.byMode.onl - out.byMode.part;
    return out;
  }

  /* ---------- actual figures from the Hub (never typed) ---------- */
  function actuals(y){
    const ms = fyMonths(y), from = ms[0] + '-01', to = ms[11] + '-31', docs = window.HD ? HD.load() : [], kv = k => (HD.store.get(k, null) || {});
    const R = docs.filter(x => x.type === 'receipt' && !x.del && x.date >= from && x.date <= to), inv = docs.filter(x => x.type === 'invoice');
    const L = Object.values((kv('lhq_logs').e) || {}).filter(e => e && !e.x && e.ty === 's'), onlBy = {};
    L.forEach(e => { const st = String(e.k || '').split('|')[0], o = onlBy[st] = onlBy[st] || [0, 0]; o[e.md === 'o' || /o$/.test(e.fmt || '') ? 1 : 0]++; });
    const S = streams(), nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const tag = r => { const i = inv.find(x => x.number && (x.number === r.ref || x.number === r.invoice)) || null, txt = nk([r.what, r.notes, ...((i && i.items) || []).map(x => x.desc || x.name || '')].join(' '));
      const st = nk(r.student), o = onlBy[st] || [0, 0], mode = o[1] > o[0] ? 'onl' : 'inp';
      const m = S.find(s => s.match && s.match.split(',').some(w => w.trim() && txt.includes(nk(w)))) || S.find(s => s.kind === 'tuition' && s.mode === mode) || S.find(s => s.kind === 'tuition');
      return {r, s: m, mode, why: m && m.match && m.match.split(',').some(w => w.trim() && txt.includes(nk(w))) ? `"${m.match}" on the invoice` : `${mode === 'onl' ? 'most sessions online' : 'sessions in person'}`}; };
    const T = R.map(tag), amt = r => +String(r.received || 0).replace(/[^\d.]/g, '') || 0;
    const byS = {}; T.forEach(t => { const k = t.s ? t.s.id : '_'; (byS[k] = byS[k] || {amt: 0, L: []}).amt += amt(t.r); byS[k].L.push(t); });
    const sp = Object.values(kv('lhq_spend')).filter(e => e && !e.del && e.date >= from && e.date <= to), C = costs(), byC = {}, other = {amt: 0, L: []};
    sp.forEach(e => { const c = C.find(c => (c.cats || []).some(k => nk(k) === nk(e.cat))); const o = c ? (byC[c.id] = byC[c.id] || {amt: 0, L: []}) : other; o.amt += +String(e.amount || 0).replace(/[^\d.]/g, '') || 0; o.L.push(e); });
    const slips = Object.entries((kv('lhq_pay').slips) || {}).filter(([k, v]) => ms.includes(k.split('|')[1]) && v && ['confirmed','signed'].includes(v.st)), tp = slips.reduce((a, [, v]) => a + (+((v.snap || {}).total) || 0), 0);
    const inc = T.reduce((a, t) => a + amt(t.r), 0), cost = Object.values(byC).reduce((a, x) => a + x.amt, 0) + other.amt + tp;
    const enq = Object.values((D && D.enq) || {}).filter(e => (e.d || '') >= from && (e.d || '') <= to);
    return {inc, cost, profit: inc - cost, byS, byC, other, tp, slips, receipts: T, amt, enq, ms, mon: ms.map(m => T.filter(t => (t.r.date || '').startsWith(m)).reduce((a, t) => a + amt(t.r), 0))};
  }
  /* the plan up to today: the months gone, plus the part of this month gone */
  function planToDate(mod, y){ const ms = fyMonths(y), t = tday(), cur = t.slice(0, 7), i = ms.indexOf(cur); if(t > ms[11] + '-31') return mod.inc; if(i < 0) return 0;
    const dim = new Date(+cur.slice(0, 4), +cur.slice(5), 0).getDate(); return mod.months.slice(0, i).reduce((a, b) => a + b, 0) + mod.months[i] * (+t.slice(8) / dim); }

  /* ---------- working backward: what a year's income and profit need ---------- */
  function solve(n, T, P, locks){
    const L = locks || {}, base = model(n, 'exp');
    const tryX = x => { const ov = {_g: {}}; const C = conf().grow;
      if(!L.enq) ov._g.enq = n ? (Math.pow(Math.pow(1 + C.enq / 100, n) * x, 1 / n) - 1) * 100 : C.enq;
      streams().forEach(s => { const o = {};
        if(n === 0 && !L.enq && s.kind === 'tuition') o.enqM = (+s.enqM || 0) * x;
        if(L.enq && !L.enrol && s.kind === 'tuition') o.enrol = Math.min(95, (+s.enrol || 0) * x);
        if(L.enq && L.enrol && !L.fee && s.kind === 'tuition') o.fee = (+s.fee || 0) * x;
        if(!L.places && ['prog','exam'].includes(s.kind)) o.places = (+s.places || 0) * x;
        if(!L.partners && s.kind === 'partner') o.children = (+s.children || 0) * x;
        ov[s.id] = o; });
      return {ov, m: model(n, 'exp', ov)}; };
    let lo = 0.05, hi = 400, best = tryX(1);
    if(T && best.m.inc < T || T && best.m.inc > T){ for(let k = 0; k < 40; k++){ const x = (lo + hi) / 2, r = tryX(x); if(r.m.inc < T) lo = x; else hi = x; best = r; } }
    const m = best.m, need = {}, tut = m.streams.filter(r => r.s.kind === 'tuition');
    need.students = tut.reduce((a, r) => a + r.studentsEnd, 0); need.centres = m.centres; need.tutors = Math.ceil(tut.reduce((a, r) => a + r.studentsEnd * (+r.s.ses || 8), 0) / (+conf().tutorSes || 60));
    const prof = m.profit, gapP = P ? P - prof : 0, feeUp = gapP > 0 && m.inc ? Math.round(gapP / m.inc * 1000) / 10 : 0;
    return {m, base, need, gapP, feeUp, ov: best.ov, reach: T ? m.inc >= T * 0.995 : true};
  }

  /* ---------- pages ---------- */
  const TABS = [['','Overview'],['streams','Streams'],['costs','Costs'],['five','Five years'],['planner','Planner'],['partners','Partners'],['schools','Schools']];
  let CS = 'exp';
  const head = (t, sub, acts) => `<div class="ph"><div class="tt"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
  const tabs = on => `<div class="pl-tabs">${TABS.filter(([k]) => mayTab(k)).map(([k, l]) => `<a class="${on === k ? 'on' : ''}" href="#plan${k ? '/' + k : ''}">${l}</a>`).join('')}${isDir() ? `<a href="#plan/who" class="${on === 'who' ? 'on' : ''}">👁 Who sees</a>` : ''}</div>`;
  const vis = () => (D && D.vis) || {};
  const mayTab = k => isDir() || (k === 'planner' ? (vis().planner || true) : ['partners','schools'].includes(k) ? (vis().pp || (me().perms || []).includes('bdo')) : (vis().streams || vis().costs) && (k !== 'costs' || vis().costs));
  const mayEdit = () => isDir() || vis().edit;
  const row = (t, sub, v, vs, href, extra) => `<${href ? `a href="${href}"` : 'div'} class="it">${extra || ''}<span class="t"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span>${v != null ? `<span class="pl-v">${v}${vs ? `<small>${vs}</small>` : ''}</span>` : ''}${href ? '<span class="chev">›</span>' : ''}</${href ? 'a' : 'div'}>`;
  const caseSeg = () => `<div class="seg" style="margin-bottom:12px">${[['low','Low'],['exp','Expected'],['high','High']].map(([k, l]) => `<a href="#" class="${CS === k ? 'on' : ''}" data-plcs="${k}">${l}</a>`).join('')}</div>`;

  function page(sub, a1, a2){
    load(); if(window.TODAY) TODAY.loadJobs && 0;
    if(!D) return head('Plan', 'Loading…');
    if(D.err && !D.plan) return head('Plan', '') + `<p class="empty">${esc(D.err)}</p>`;
    sub = sub || '';
    if(sub === 'stream') return streamPage(a1);
    if(sub === 'year') return yearPage(+a1);
    if(sub === 'item') return itemPage(a1);
    if(sub === 'partner') return partnerPage(a1);
    if(sub === 'fig') return figPage(a1, a2);
    if(!mayTab(sub === 'who' ? 'costs' : sub)) return `<a class="crumb" href="#biz">‹ Business</a>` + head('Plan', '') + tabs(sub) + '<p class="empty">The Director hasn\'t shared this part of the plan with you.</p>';
    const body = {'' : overview, streams: streamsPage, costs: costsPage, five: fivePage, planner: () => plannerPage(a1, a2), partners: partnersPage, schools: schoolsPage, who: whoPage}[sub];
    return `<a class="crumb" href="#biz">‹ Business</a>` + (body ? body() : overview());
  }
  function overview(){
    const C = conf(), y = C.fy;
    if(!streams().length) return head('Plan', `Year 1 · ${fyL(y)} · Sep to Aug`) + tabs('') + (isDir() ? `<div class="card pad"><b>Start the plan</b><p class="note" style="margin:6px 0 12px">The Hub fills in the streams from today's students, fees and sessions, and the running costs from Spending. Change any of it after.</p><button class="btn n" data-plseed>Start from today's figures</button></div>` : '<p class="empty">The Director hasn\'t started the plan yet.</p>');
    const m = model(0, CS), A = actuals(y), toDate = planToDate(model(0, 'exp'), y), T = target(y), P = planItems().filter(i => fyOf(i.d1 || tday()) === y);
    const slip = P.filter(isSlipping), done = P.filter(i => i.status === 'done'), tot = m.inc || 1;
    return head('Plan', `Year 1 · ${fyL(y)} · Sep to Aug`) + tabs('') + caseSeg() + `
      <div class="card one">${row('Income', `so far ${M(A.inc)} · plan to date ${M(toDate)}`, M(m.inc), A.inc >= toDate * 0.97 ? '<span class="up">on plan</span>' : '<span class="warn">behind</span>', '#plan/fig/inc')}
      ${row('Costs', 'from pay, spending and the plan', M(m.cost), `so far ${M(A.cost)}`, '#plan/costs')}
      ${row('Profit', `worked out · ${m.margin}% of income`, M(m.profit), `so far ${M(A.profit)}`, '#plan/fig/profit')}
      ${T.inc ? row('Target you set', `income ${M(T.inc)}${T.prof ? ' · profit ' + M(T.prof) : ''}`, m.inc >= T.inc ? '<span class="up">on track</span>' : '<span class="red">' + (solve(0, T.inc).reach ? 'stretch' : 'not reachable') + '</span>', 'see Five years', '#plan/year/0') : ''}</div>
      <div class="h2">Where income comes from <em>${M(m.inc)}</em></div>
      <div class="pl-split">${[['inp','c1','In-person'],['onl','c2','Online'],['part','c3','Partners'],['other','c4','Other']].filter(([k]) => m.byMode[k] > 1).map(([k, c]) => `<i class="${c}" style="width:${m.byMode[k] / tot * 100}%"></i>`).join('')}</div>
      <div class="pl-lg">${[['inp','c1','In-person'],['onl','c2','Online'],['part','c3','Partners'],['other','c4','Other']].filter(([k]) => m.byMode[k] > 1).map(([k, c, l]) => `<span><i class="${c}"></i>${l} ${M(m.byMode[k])} · ${pc(m.byMode[k], tot)}%</span>`).join('')}</div>
      <div class="card one">${row(`Planner · ${done.length} of ${P.length} done`, slip.length ? `${slip.length} slipping` : 'none slipping', null, null, '#plan/planner', `<span class="td-mk ${slip.length ? 'am' : 'ok'}">${slip.length ? '!' : '✓'}</span>`)}
        ${brokenAssumptions().map(b => row(b.t, b.s, null, null, b.href, '<span class="td-mk am">!</span>')).join('')}</div>`;
  }
  /* an assumption the actual figures break (enquiries that enrol, students kept) */
  function brokenAssumptions(){
    const out = [], E = Object.values((D && D.enq) || {}), y = conf().fy, ms = fyMonths(y), E1 = E.filter(e => (e.d || '') >= ms[0]);
    if(E1.length >= 8){ const en = E1.filter(e => e.stage === 'enrolled').length, a = pc(en, E1.length), s = streams().find(x => x.kind === 'tuition'); if(s && Math.abs(a - s.enrol) >= 3) out.push({t:'1 assumption broken', s:`Enquiries that enrol ${a}% (plan ${s.enrol}%)`, href:'#plan/stream/' + s.id}); }
    return out;
  }
  function figPage(k){
    const y = conf().fy, A = actuals(y), m = model(0, 'exp');
    if(k === 'inc'){ return `<a class="crumb" href="#plan">‹ Plan</a>` + head(`Income so far · ${M(A.inc)}`, `<span class="pl-src h">Hub</span> ${A.receipts.length} receipts · 1 Sep – ${nice(tday())}`) +
      `<div class="card one">${streams().map(s => { const x = A.byS[s.id] || {amt: 0, L: []}; return row(esc(s.name) + (s.mode !== 'none' ? ' · ' + MODE[s.mode].toLowerCase() : ''), `${x.L.length} receipt${x.L.length === 1 ? '' : 's'}`, M(x.amt), null, '#plan/fig/s/' + s.id); }).join('')}${A.byS._ ? row('Not matched to a stream', `${A.byS._.L.length} receipts`, M(A.byS._.amt), null, '#plan/fig/s/_') : ''}<div class="it pl-tot"><span class="t"><b>Total</b></span><span class="pl-v">${M(A.inc)}</span></div></div>
      <div class="card one">${row('Plan to today', 'from the Expected case', M(planToDate(m, y)))}</div>`; }
    if(k === 's'){ const id = arguments[1], x = A.byS[id] || {L: []}, s = streams().find(z => z.id === id);
      return `<a class="crumb" href="#plan/fig/inc">‹ Income so far</a>` + head(s ? esc(s.name) : 'Not matched', `${x.L.length} receipts · how each was matched`) + `<div class="card one">${x.L.map(t => `<a class="it" href="doc.html#d=${encodeURIComponent(t.r.id)}"><span class="t"><b>${esc(t.r.number || '')} · ${esc(t.r.student || '')}</b><small>${nice(t.r.date)} · ${esc(t.why)}</small></span><span class="pl-v">${M(A.amt(t.r))}</span><span class="chev">›</span></a>`).join('') || '<p class="empty">None.</p>'}</div>`; }
    if(k === 'profit') return `<a class="crumb" href="#plan">‹ Plan</a>` + head('Profit', 'Income − costs, worked out') + `<div class="card one">${row('Income · plan', '', M(m.inc), null, '#plan/streams')}${row('Costs · plan', '', '− ' + M(m.cost), null, '#plan/costs')}<div class="it pl-tot"><span class="t"><b>Profit</b><small>${m.margin}% of income</small></span><span class="pl-v">${M(m.profit)}</span></div></div>
      <div class="card one">${row('Income so far', '', M(A.inc), null, '#plan/fig/inc')}${row('Costs so far', 'spending + payslips approved', '− ' + M(A.cost), null, '#plan/costs')}<div class="it pl-tot"><span class="t"><b>Profit so far</b></span><span class="pl-v">${M(A.profit)}</span></div></div>`;
    if(k === 'c'){ const id = arguments[1], x = id === 'tp' ? null : A.byC[id] || (id === '_' ? A.other : {L: []});
      if(id === 'tp') return `<a class="crumb" href="#plan/costs">‹ Costs</a>` + head('Tutor pay so far · ' + M(A.tp), 'Payslips approved or received') + `<div class="card one">${A.slips.map(([k2, v]) => `<a class="it" href="#pay/${encodeURIComponent(k2.split('|')[0])}/${k2.split('|')[1]}"><span class="t"><b>${esc((v.snap || {}).tutor || k2.split('|')[0])}</b><small>${k2.split('|')[1]}</small></span><span class="pl-v">${M((v.snap || {}).total)}</span><span class="chev">›</span></a>`).join('') || '<p class="empty">None approved yet.</p>'}</div>`;
      return `<a class="crumb" href="#plan/costs">‹ Costs</a>` + head(id === '_' ? 'Spending not matched to a cost line' : esc((costs().find(c => c.id === id) || {}).name || ''), `${x.L.length} payments`) + `<div class="card one">${x.L.map(e => row(esc(e.what || e.cat), `${nice(e.date)} · ${esc(e.cat || '')}`, M(+String(e.amount).replace(/[^\d.]/g, '') || 0), null, '#biz/spending')).join('') || '<p class="empty">None.</p>'}</div>`; }
    return '';
  }
  function streamsPage(){
    const m = model(0, CS), A = actuals(conf().fy), G = {inp: [], onl: [], part: [], other: []};
    m.streams.forEach(r => (r.s.kind === 'partner' ? G.part : r.s.mode === 'inp' ? G.inp : r.s.mode === 'onl' ? G.onl : G.other).push(r));
    const planned = streams().filter(s => s.status === 'planned' && !s.conf && CS !== 'high');
    const sec = (l, L) => L.length ? `<div class="h2">${l} <em>${M(L.reduce((a, r) => a + r.inc, 0))}</em></div><div class="card one">${L.map(r => { const x = A.byS[r.s.id] || {amt: 0};
      return row(esc(r.s.name), streamLine(r), M(r.inc), `${M(x.amt)} so far`, '#plan/stream/' + r.s.id, r.s.status === 'planned' ? '<span class="tag am" style="margin-right:4px">Planned</span>' : ''); }).join('')}</div>` : '';
    return head('Streams', `Year 1 · ${CS === 'exp' ? 'Expected' : CS === 'low' ? 'Low' : 'High'} · plan / so far`, mayEdit() ? '<button class="btn n" data-plsnew>+ Add a stream</button>' : '') + tabs('streams') + caseSeg() +
      sec('In-person · ' + (conf().centre || 'Area 47'), G.inp) + sec('Online', G.onl) + sec('Partners', G.part) + sec('Other', G.other) +
      `<div class="card one"><div class="it pl-tot"><span class="t"><b>Total</b></span><span class="pl-v">${M(m.inc)}</span></div></div>` +
      (planned.length ? `<div class="h2">Planned · High case only <em>${planned.length}</em></div><div class="card one">${planned.map(s => row(esc(s.name), 'counts in High until confirmed', null, null, '#plan/stream/' + s.id)).join('')}</div>` : '');
  }
  const streamLine = r => { const s = r.s; return s.kind === 'tuition' ? `${Math.round(r.studentsEnd)} students by Aug · ${M(s.fee)} a month` : s.kind === 'partner' ? `${s.arr === 'partner' ? 'Partner collects · ' + s.comm + '% to LHQ' : 'LHQ collects · ' + s.share + '% to partner'} · ${Math.round(r.children)} children` : `${s.runs} run${s.runs == 1 ? '' : 's'} · ${s.places} places · ${s.fill}% filled`; };
  /* a stream's measures: change one and see the year move (working forward) */
  const TRY = {};
  const FIELDS = {tuition: [['students0','Students now','Hub'],['enqM','Enquiries a month','Hub'],['enrol','Enquiries that enrol (%)','Mixed'],['kept','Students kept term to term (%)','Hub'],['fee','Fee a month (MWK)','You'],['ses','Sessions a month a student','Hub'],['rate','Tutor pay a session (MWK)','Hub']],
    prog: [['runs','Runs a year','You'],['places','Places a run','You'],['fill','Filled (%)','Mixed'],['feePlace','Fee a place (MWK)','You'],['costRun','Cost a run (MWK)','You'],['months','Months it runs (1–12, commas)','You']],
    exam: [['runs','Courses a year','You'],['places','Learners a course','You'],['fill','Filled (%)','Mixed'],['feePlace','Fee a learner (MWK)','You'],['costRun','Cost a course (MWK)','You'],['months','Months (1–12, commas)','You']],
    partner: [['children','Children','Hub'],['feeChild','Fee a child a month (MWK)','You'],['share','Partner\'s share when LHQ collects (%)','You'],['comm','LHQ\'s commission when the partner collects (%)','You']]};
  const SRC = {Hub:'h', You:'y', Mixed:'m'};
  function streamPage(id){
    const s = streams().find(x => x.id === id); if(!s) return `<a class="crumb" href="#plan/streams">‹ Streams</a><p class="empty">Not found.</p>`;
    const t = TRY[id] || {}, base = model(0, 'exp'), tried = Object.keys(t).length ? model(0, 'exp', {[id]: t}) : null, A = actuals(conf().fy), x = A.byS[id] || {amt: 0, L: []};
    const F = FIELDS[s.kind] || [];
    const rB = base.streams.find(r => r.s.id === id) || {}, rT = tried ? tried.streams.find(r => r.s.id === id) || {} : null;
    return `<a class="crumb" href="#plan/streams">‹ Streams</a>` + head(esc(s.name), `${KIND[s.kind]}${s.mode !== 'none' ? ' · ' + MODE[s.mode] : ''} · ${s.status === 'planned' ? 'planned' : 'running'}`, mayEdit() ? `<button class="btn" data-plsedit="${id}">Edit</button>` : '') +
      `<div class="card one">${F.map(([k, l, src]) => `<div class="it"><span class="t"><b>${l}</b><small><span class="pl-src ${SRC[src]}">${src}</span>${src !== 'You' && hubHint(s, k) ? ' ' + hubHint(s, k) : ''}</small></span>${mayEdit() ? `<span class="pl-step"><button data-plst="${id}|${k}|-1">−</button><input class="in" data-plsv="${id}|${k}" value="${esc(t[k] != null ? t[k] : s[k] != null ? s[k] : '')}"><button data-plst="${id}|${k}|1">+</button></span>` : `<span class="pl-v">${esc(s[k])}</span>`}</div>`).join('')}</div>
      ${tried ? `<div class="pl-alert ok"><b>${Object.entries(t).map(([k, v]) => `${(F.find(f => f[0] === k) || [, k])[1]}: ${s[k]} → ${v}`).join(' · ')}</b>
        <table class="pl-t"><tr><td>${s.kind === 'tuition' ? 'Students by August' : s.kind === 'partner' ? 'Children' : 'Income this stream'}</td><td>${s.kind === 'tuition' ? `${Math.round(rB.studentsEnd)} → ${Math.round(rT.studentsEnd)}` : s.kind === 'partner' ? `${Math.round(rB.children)} → ${Math.round(rT.children)}` : `${M(rB.inc)} → ${M(rT.inc)}`}</td></tr><tr><td>Income · year</td><td>${M(base.inc)} → ${M(tried.inc)}</td></tr><tr><td>Costs</td><td>${M(base.cost)} → ${M(tried.cost)}</td></tr><tr><td>Profit</td><td>${M(base.profit)} → ${M(tried.profit)} · ${tried.margin}%</td></tr></table></div>
        ${capWarn(base, tried)}<div class="r2"><button class="btn" data-plundo="${id}">Undo</button><button class="btn n" data-plkeep="${id}">Keep</button></div>` : ''}
      <div class="h2">So far this year <em>${M(x.amt)}</em></div><div class="card one">${row(`${x.L.length} receipts`, 'how each was matched', null, null, '#plan/fig/s/' + id)}</div>`;
  }
  const capWarn = (b, t) => { const c = conf(), cap = (+c.cap || 180) * Math.max(1, +c.centres || 1); return t.inp > cap ? `<div class="pl-alert am"><b>Capacity</b>${Math.round(t.inp)} in-person students; the centre${(+c.centres || 1) > 1 ? 's hold' : ' holds'} about ${cap}. ${t.centres > (+c.centres || 1) ? 'A new centre is needed.' : ''}</div>` : ''; };
  function hubHint(s, k){
    if(!window.HD) return ''; const t = tday();
    if(k === 'students0'){ const n = HD.students().filter(x => x.cur && (!x.cur.inv.periodEnd || x.cur.inv.periodEnd >= t)).length; return `now ${n} active`; }
    if(k === 'enqM'){ const E = Object.values((D && D.enq) || {}).filter(e => (e.d || '') >= addD(t, -90)); return E.length ? `last 3 months: ${Math.round(E.length / 3)} a month` : 'log enquiries to fill this'; }
    if(k === 'enrol'){ const E = Object.values((D && D.enq) || {}).filter(e => (e.d || '') >= addD(t, -120)); return E.length >= 5 ? `actual ${pc(E.filter(e => e.stage === 'enrolled').length, E.length)}%` : ''; }
    if(k === 'rate'){ const R = ((HD.store.get('lhq_pay', {}) || {}).rules) || {}; return R.inp ? `pay rules: ${M(s.mode === 'onl' ? R.onl : R.inp)}` : ''; }
    return '';
  }
  function costsPage(){
    const m = model(0, CS), A = actuals(conf().fy), sh = m.byMode, tot = m.inc || 1;
    return head('Costs', 'Year 1 · plan · what drives each line', mayEdit() ? '<button class="btn n" data-plcnew>+ Add a cost</button>' : '') + tabs('costs') + caseSeg() +
      `<div class="card one">${m.lines.map(l => row(esc(l.name), esc(l.why), M(l.amt), l.k === 'tutor' ? `${M(A.tp)} so far` : l.c && A.byC[l.c.id] ? `${M(A.byC[l.c.id].amt)} so far` : '', l.c ? (mayEdit() ? `#plan/costs` : null) : l.k === 'tutor' ? '#plan/fig/c/tp' : null, l.c ? `<button class="pl-ed" data-plcedit="${l.c.id}">✎</button>` : '')).join('')}<div class="it pl-tot"><span class="t"><b>Costs</b></span><span class="pl-v">${M(m.cost)}</span></div></div>
      <div class="card one"><div class="it pl-tot"><span class="t"><b>Profit</b><small>${M(m.inc)} − ${M(m.cost)}</small></span><span class="pl-v">${M(m.profit)}<small>${m.margin}% of income</small></span></div></div>
      ${A.other.L.length ? `<div class="card one">${row('Spending not matched to a cost line', `${A.other.L.length} payments · add its category to a cost line`, M(A.other.amt), null, '#plan/fig/c/_')}</div>` : ''}
      <div class="h2">Shared costs</div><div class="card one">${row('Split by income share', `Staff, rent, marketing → in-person ${pc(sh.inp, tot)}% · online ${pc(sh.onl, tot)}% · partners ${pc(sh.part, tot)}%`)}</div><p class="note">Setting the split yourself: release 3.</p>`;
  }
  function fivePage(){
    const C = conf(), Y = [0, 1, 2, 3, 4].map(n => ({n, y: C.fy + n, m: model(n, CS), T: target(C.fy + n)})), mx = Math.max(...Y.map(x => Math.max(x.m.inc, x.T.inc || 0)), 1);
    return head('Five years', `${fyL(C.fy)} to ${fyL(C.fy + 4)} · rolls on each September`) + tabs('five') + caseSeg() +
      `<div class="pl-path">${Y.map(x => `<div><i style="height:${Math.max(2, x.m.inc / mx * 100)}%"></i>${x.T.inc ? `<i class="t" style="height:${x.T.inc / mx * 100}%"></i>` : ''}</div>`).join('')}</div><div class="pl-pl">${Y.map(x => `<span>Y${x.n + 1}</span>`).join('')}</div>
      <div class="pl-lg" style="margin-bottom:10px"><span><i class="c1"></i>Plan</span><span><i style="border:2px dashed var(--gold)"></i>Your target</span></div>
      ${Y.map(x => { const s = x.T.inc ? solve(x.n, x.T.inc, x.T.prof) : null, gap = x.T.inc ? x.T.inc - x.m.inc : 0;
        return `<a class="pl-yr" href="#plan/year/${x.n}"><div class="row"><b>Y${x.n + 1} · ${fyL(x.y)}</b>${x.T.inc ? (gap <= 0 ? '<span class="tag ok">on plan</span>' : x.n === 0 && !s.reach ? '<span class="tag rd">not reachable</span>' : `<span class="tag am">${M(gap)} short</span>`) : '<span class="tag">set a target</span>'}</div>
          <div class="pl-mini"><div><span>Income${x.T.inc ? ' · target / plan' : ''}</span><b>${x.T.inc ? M(x.T.inc) + ' / ' : ''}${M(x.m.inc)}</b></div><div><span>Profit${x.T.prof ? ' · target / plan' : ''}</span><b>${x.T.prof ? M(x.T.prof) + ' / ' : ''}${M(x.m.profit)}</b><small>${x.m.margin}%</small></div><div><span>Students</span><b>${Math.round(x.m.streams.filter(r => r.s.kind === 'tuition').reduce((a, r) => a + r.studentsEnd, 0))}</b></div><div><span>Centres</span><b>${x.m.centres}</b></div></div></a>`; }).join('')}`;
  }
  let LK = {};
  function yearPage(n){
    const C = conf(), y = C.fy + n, T = target(y), base = model(n, 'exp');
    const s = T.inc ? solve(n, T.inc, T.prof, LK) : null;
    const lev = [['enq','Enquiries a month'],['enrol','Enquiries that enrol'],['fee','Fee a month'],['places','Programme places'],['partners','Partner children']];
    return `<a class="crumb" href="#plan/five">‹ Five years</a>` + head(`Y${n + 1} · ${fyL(y)}`, 'Type income and profit · the Hub works out what it takes') +
      `<div class="r2"><label class="f"><span>Income (MWK)</span><input class="in pl-big" id="plTi" inputmode="numeric" value="${T.inc ? Math.round(T.inc).toLocaleString('en-GB') : ''}" placeholder="e.g. 800,000,000"></label><label class="f"><span>Profit (MWK)</span><input class="in pl-big" id="plTp" inputmode="numeric" value="${T.prof ? Math.round(T.prof).toLocaleString('en-GB') : ''}" placeholder="optional"></label></div>
      ${mayEdit() ? '<button class="btn n full" id="plTgo">Work it out</button>' : ''}
      ${s ? (() => { const grow = base.inc ? s.m.inc / Math.max(1, model(Math.max(0, n - 1), 'exp').inc) : 0, prevA = n === 0 ? actuals(C.fy - 1).inc : 0;
        const notR = !s.reach || (n === 0 && T.inc > base.inc * 3);
        return `<div class="pl-alert ${notR ? 'rd' : T.inc > base.inc * 1.15 ? 'am' : 'ok'}" style="margin-top:12px"><b>${notR ? `Not reachable ${n === 0 ? 'this year' : 'by then'}` : T.inc > base.inc * 1.15 ? `A stretch: ${M(T.inc - base.inc)} above the plan` : 'Within reach of the plan'}</b>${n === 0 && notR ? `The year has ${12 - Math.max(0, fyMonths(y).indexOf(tday().slice(0, 7)))} months left. The High case reaches ${M(model(0, 'high').inc)}.` : `Plan: ${M(base.inc)}.`}${grow > 1.6 && n ? ` About ×${Math.round(grow * 10) / 10} on the year before.` : ''} You can keep the target either way.</div>
          <div class="h2">What it takes · by stream</div><div class="card one">${s.m.streams.map(r => { const b = base.streams.find(z => z.s.id === r.s.id) || {}; return row(esc(r.s.name) + (r.s.mode !== 'none' ? ' · ' + MODE[r.s.mode].toLowerCase() : ''), r.s.kind === 'tuition' ? `${Math.round(b.studentsEnd || 0)} → ${Math.round(r.studentsEnd)} students` : r.s.kind === 'partner' ? `${Math.round(b.children || 0)} → ${Math.round(r.children)} children` : `${M(b.inc)} → ${M(r.inc)}`, M(r.inc)); }).join('')}
            <div class="it pl-tot"><span class="t"><b>Income</b></span><span class="pl-v">${M(s.m.inc)} ${s.reach ? '✓' : ''}</span></div>${row('Costs', 'from pay rules, centres, staff', M(s.m.cost))}<div class="it pl-tot"><span class="t"><b>Profit</b></span><span class="pl-v">${M(s.m.profit)} · ${s.m.margin}% ${T.prof ? (s.m.profit >= T.prof ? '✓' : '') : ''}</span></div></div>
          ${T.prof && s.gapP > 0 ? `<div class="pl-alert am"><b>Profit ${M(s.gapP)} short</b>Costs would have to fall by ${M(s.gapP)}, or fees rise about ${s.feeUp}% on top, or more group sessions.</div>` : ''}
          <div class="h2">What has to change · 🔒 = you won't change it</div><div class="card one">${lev.map(([k, l]) => `<div class="it"><button class="pl-lock ${LK[k] ? 'on' : ''}" data-pllk="${k}">${LK[k] ? '🔒' : '🔓'}</button><span class="t"><b>${l}</b></span><span class="pl-v">${levText(k, base, s)}</span></div>`).join('')}
            ${row('Centres', `about ${C.cap} students each`, `${base.centres} → ${s.m.centres}`)}${row('Tutors', 'sessions ÷ about ' + (C.tutorSes || 60) + ' a tutor a month', `→ ${s.need.tutors}`)}</div>
          ${s.m.centres > base.centres ? `<div class="pl-alert am"><b>Cash before the fees come in</b>${s.m.centres - base.centres} new centre${s.m.centres - base.centres === 1 ? '' : 's'}: set-up and hiring come first. Plan a fund or loan in Reserves (release 3).</div>` : ''}
          ${isDir() ? `<div class="r2"><button class="btn" data-plhigh="${n}">Save as High case</button><button class="btn n" data-pluse="${n}">Use these</button></div><p class="note" style="margin-top:8px">Nothing changes until "Use these".</p>` : ''}`; })() : ''}`;
  }
  const levText = (k, b, s) => { const st = (ov, x) => x; const t0 = streams().find(x => x.kind === 'tuition') || {}, o = (s.ov || {})[t0.id] || {}, g = (s.ov || {})._g || {};
    if(k === 'enq') return g.enq != null && g.enq !== conf().grow.enq ? `+${conf().grow.enq}% → +${Math.round(g.enq)}% a year` : o.enqM ? `${Math.round(t0.enqM)} → ${Math.round(o.enqM)}` : '–';
    if(k === 'enrol') return o.enrol ? `${t0.enrol}% → ${Math.round(o.enrol)}%` : `${t0.enrol || 0}%`;
    if(k === 'fee') return o.fee ? `${M(t0.fee)} → ${M(o.fee)}` : `${M(t0.fee || 0)} · +${conf().grow.fee}% a year`;
    if(k === 'places'){ const p = streams().find(x => ['prog','exam'].includes(x.kind)); return p && (s.ov[p.id] || {}).places ? `${p.places} → ${Math.round(s.ov[p.id].places)} a run` : '–'; }
    if(k === 'partners'){ const p = streams().find(x => x.kind === 'partner'); return p && (s.ov[p.id] || {}).children ? `${p.children} → ${Math.round(s.ov[p.id].children)}` : '–'; }
    return ''; };

  /* ---------- the year planner (Mockup 17c) ---------- */
  const AREA = {terms:['📚','Terms and exams'], prog:['🎓','Programmes'], mkt:['🤝','Partners and marketing'], people:['👥','People'], growth:['📈','Growth and money']};
  const isSlipping = i => i.status !== 'done' && ((i.d2 || i.d1) < tday() || (i.steps || []).some(s => !s.done && s.by && s.by < tday()));
  const stCls = i => i.status === 'done' ? 'ok' : isSlipping(i) ? 'am' : i.status === 'planned' ? 'pl' : '';
  let PV = 'month', PF = 'all';
  function plannerPage(view, d){
    PV = ['month','term','year','list'].includes(view) ? view : (PV || (innerWidth < 700 ? 'month' : 'month'));
    const C = conf(), t = tday(), cur = /^\d{4}-\d{2}/.test(d || '') ? d.slice(0, 7) : t.slice(0, 7);
    const L = planItems().filter(i => PF === 'all' || (PF === 'mine' ? i.owner === me().id : PF === 'slip' ? isSlipping(i) : i.area === PF));
    const nav = (l, p, n) => `<div class="pl-nav"><a class="btn sm" href="#plan/planner/${PV}/${p}">‹</a><b>${l}</b><a class="btn sm" href="#plan/planner/${PV}/${n}">›</a></div>`;
    const top = head('Year planner', `${fyL(C.fy)} · ${planItems().length} item${planItems().length === 1 ? '' : 's'}`, mayEdit() ? '<button class="btn n" data-plinew>+ Add</button>' : '') + tabs('planner') +
      `<div class="seg" style="margin-bottom:8px">${['month','term','year','list'].map(k => `<a class="${PV === k ? 'on' : ''}" href="#plan/planner/${k}/${cur}">${k[0].toUpperCase() + k.slice(1)}</a>`).join('')}</div>
      <div class="chips">${[['all','All'],['mine','Mine'],['slip','Slipping']].concat(Object.entries(AREA).map(([k, [ic]]) => [k, ic])).map(([k, l]) => `<button class="chip ${PF === k ? 'on' : ''}" data-plpf="${k}">${l}</button>`).join('')}</div>`;
    if(PV === 'month'){
      const ym = cur, p = parse(ym + '-01'), dim = new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate(), a = ym + '-01', z = ym + '-' + pad(dim);
      const M0 = L.filter(i => i.d1 <= z && (i.d2 || i.d1) >= a).sort((x, y2) => (x.status === 'done') - (y2.status === 'done') || x.d1.localeCompare(y2.d1));
      const pos = s => Math.max(0, Math.min(100, (Math.max(s, a) === a && s < a ? 0 : (+s.slice(8) - 1) / dim * 100)));
      const prevM = iso(new Date(p.getFullYear(), p.getMonth() - 1, 1)).slice(0, 7), nextM = iso(new Date(p.getFullYear(), p.getMonth() + 1, 1)).slice(0, 7);
      const card = i => { const l = i.d1 < a ? 0 : pos(i.d1), r = (i.d2 || i.d1) > z ? 100 : ((+(i.d2 || i.d1).slice(8)) / dim * 100), S = i.steps || [], sd = S.filter(s => s.done).length, own = ((D.people || []).find(x => x.id === i.owner) || {}).name;
        return `<a class="pl-pi" href="#plan/item/${esc(i.id)}"><div class="r1"><span class="ic">${(AREA[i.area] || ['📌'])[0]}</span><span class="t"><b>${esc(i.name)}</b><small>${(AREA[i.area] || [, ''])[1]} · ${i.d2 && i.d2 !== i.d1 ? `${nice(i.d1)} → ${nice(i.d2)}` : nice(i.d1)}</small></span>${own ? `<span class="pl-av">${inits(own)}</span>` : ''}</div>
          <div class="pl-trk"><i class="${stCls(i)}" style="left:${l}%;width:${Math.max(3, r - l)}%"></i>${t >= a && t <= z ? `<em style="left:${(+t.slice(8) - 0.5) / dim * 100}%"></em>` : ''}</div>
          <div class="r3"><span class="st ${stCls(i) === 'ok' ? 'ok' : stCls(i) === 'am' ? 'bad' : 'no'}"><i>${stCls(i) === 'ok' ? '✓' : stCls(i) === 'am' ? '!' : ''}</i> ${i.status === 'done' ? 'Done' : isSlipping(i) ? 'Slipping' : i.status === 'planned' ? 'Planned' : 'On time'}${S.length ? ` · ${sd} of ${S.length} steps` : ''}</span><span>${+i.cost ? M(i.cost) : ''}</span></div></a>`; };
      return top + nav(`${MOL[p.getMonth()]} ${p.getFullYear()}`, prevM, nextM) + `<div class="pl-sum"><span><b>${M0.length}</b>this month</span><span><b class="up">${M0.filter(i => i.status === 'done').length}</b>done</span><span><b class="warn">${M0.filter(isSlipping).length}</b>slipping</span></div>` +
        (M0.map(card).join('') || `<p class="empty">Nothing in the plan this month.${mayEdit() ? ' Tap + Add.' : ''}</p>`) + (M0.length ? '<p class="note">Gold mark = today</p>' : '');
    }
    const ms = fyMonths(C.fy);
    let cols, l0, prev, next, title;
    if(PV === 'term'){ const T3 = [[0, 4], [4, 7], [7, 12]], i = ms.indexOf(cur), ti = Math.max(0, T3.findIndex(([a, b]) => i >= a && i < b)); cols = ms.slice(T3[ti][0], T3[ti][1]); title = `Term ${ti + 1} · ${MO[+cols[0].slice(5) - 1]} – ${MO[+cols[cols.length - 1].slice(5) - 1]}`; prev = ms[T3[Math.max(0, ti - 1)][0]]; next = ms[T3[Math.min(2, ti + 1)][0]]; }
    else { cols = ms; title = fyL(C.fy); prev = cur; next = cur; }
    if(PV === 'list'){ const by = {}; L.slice().sort((a, b) => a.d1.localeCompare(b.d1)).forEach(i => (by[i.d1.slice(0, 7)] = by[i.d1.slice(0, 7)] || []).push(i));
      return top + Object.entries(by).map(([k, A]) => `<div class="h2">${MOL[+k.slice(5) - 1]} <em>${A.length} · ${A.filter(i => i.status === 'done').length} done</em></div><div class="card one">${A.map(i => row(esc(i.name), `${(AREA[i.area] || [, ''])[1]} · ${first(((D.people || []).find(x => x.id === i.owner) || {}).name || '')} · ${nice(i.d1)}${+i.cost ? ' · ' + M(i.cost) : ''}`, null, null, '#plan/item/' + i.id, `<span class="td-mk ${stCls(i) === 'ok' ? 'ok' : stCls(i) === 'am' ? 'am' : ''}">${stCls(i) === 'ok' ? '✓' : stCls(i) === 'am' ? '!' : ''}</span>`)).join('')}</div>`).join('') || '<p class="empty">No items yet.</p>'; }
    const a = cols[0] + '-01', z = cols[cols.length - 1] + '-31', n = cols.length, posOf = s => { const i = cols.indexOf(s.slice(0, 7)); if(i < 0) return s < a ? 0 : n; const dim = new Date(+s.slice(0, 4), +s.slice(5, 7), 0).getDate(); return i + (+s.slice(8) - 1) / dim; };
    const tpos = posOf(t);
    const wide = PV === 'year';
    const rows = Object.entries(AREA).map(([k, [ic, l]]) => { const A = L.filter(i => i.area === k && i.d1 <= z && (i.d2 || i.d1) >= a); if(!A.length) return '';
      return `<div class="pl-ag">${ic} ${l}</div>` + A.map(i => { const s = posOf(i.d1 < a ? a : i.d1), e = posOf((i.d2 || i.d1) > z ? z : (i.d2 || i.d1)) + 0.04; return `<div class="pl-br${wide ? ' w' : ''}">${wide ? `<span class="pl-ln">${esc(i.name)}</span>` : ''}<div class="pl-lane"><a class="pl-bt ${stCls(i)}" href="#plan/item/${esc(i.id)}" style="left:${Math.min(s / n * 100, 100 - (wide ? 7 : 24))}%;width:${Math.max(wide ? 7 : 24, (e - s) / n * 100)}%">${esc(wide ? (i.d2 && i.d2 !== i.d1 ? MO[+i.d1.slice(5, 7) - 1] + ' – ' + MO[+i.d2.slice(5, 7) - 1] : nice(i.d1).slice(4)) : i.name)}${isSlipping(i) ? ' ⚠' : i.status === 'done' ? ' ✓' : ''}</a></div></div>`; }).join(''); }).join('');
    return top + (PV === 'term' ? nav(title, prev, next) : `<div class="pl-nav"><b>${title}</b></div>`) + `<div class="pl-tz${wide ? ' w' : ''}"><div class="pl-mh${wide ? ' w' : ''}">${wide ? '<span></span>' : ''}<div class="pl-cols" style="grid-template-columns:repeat(${n},1fr)">${cols.map(c => `<span class="${c === t.slice(0, 7) ? 'now' : ''}"><b class="l">${MO[+c.slice(5) - 1]}</b><b class="s">${MO[+c.slice(5) - 1][0]}</b></span>`).join('')}</div></div>
      <div class="pl-body">${tpos > 0 && tpos < n ? `<div class="pl-tod${wide ? ' w' : ''}" style="--x:${tpos / n}"><b>Today</b></div>` : ''}${rows || '<p class="empty">Nothing in the plan for these months.</p>'}</div></div>
      <div class="pl-lg" style="margin-top:14px"><span>Green ✓ done</span><span>Gold ⚠ slipping</span><span>Dashed · planned</span><span>Gold line · today</span></div>`;
  }
  function itemPage(id){
    const i = planItems().find(x => x.id === id); if(!i) return `<a class="crumb" href="#plan/planner">‹ Planner</a><p class="empty">${D ? 'Not found, or removed.' : 'Loading…'}</p>`;
    const P = D.people || [], own = (P.find(x => x.id === i.owner) || {}).name || '', S = i.steps || [], sp = Object.values((HD.store.get('lhq_spend', {}) || {})).filter(e => e && !e.del && e.plan === i.id);
    const E = Object.values((D && D.enq) || {}).filter(e => e.item === i.id || (e.src && i.tag && e.src === i.tag)), mine = S.some(s => s.who === me().id);
    return `<a class="crumb" href="#plan/planner">‹ Planner</a>` + head(esc(i.name), `${(AREA[i.area] || ['', ''])[0]} ${(AREA[i.area] || ['', ''])[1]} · ${i.d2 && i.d2 !== i.d1 ? nice(i.d1) + ' → ' + nice(i.d2) : nice(i.d1)}${own ? ' · ' + esc(own) : ''} · ${i.status === 'done' ? 'Done' : isSlipping(i) ? 'Slipping' : i.status === 'planned' ? 'Planned' : 'On time'}`, mayEdit() ? `<button class="btn" data-pliedit="${esc(i.id)}">Edit</button>` : '') +
      (i.desc ? `<p class="pl-desc">${esc(i.desc)}</p>` : '') +
      `<div class="kv3"><div><span>Cost</span><b>${+i.cost ? M(i.cost) : '–'}</b><small>${sp.length} payment${sp.length === 1 ? '' : 's'} linked</small></div><div><span>Aim</span><b>${esc(i.aim || '–')}</b><small>${esc(i.aimWhat || '')}</small></div><div><span>Result</span><b>${E.length || (i.d2 || i.d1) < tday() ? E.length : '–'}</b><small>${E.length ? 'enquiries tagged' : (i.d2 || i.d1) < tday() ? 'enquiries tagged' : 'after ' + nice(i.d2 || i.d1)}</small></div></div>
      <div class="h2">Steps <em>${S.filter(s => s.done).length} of ${S.length}</em></div><div class="card one">${S.map((s, k) => { const w = (P.find(x => x.id === s.who) || {}).name; const may = mayEdit() || s.who === me().id;
        return `<div class="it"><${may ? 'button' : 'span'} class="td-mk ${s.done ? 'ok' : s.by && s.by < tday() ? 'am' : ''}" ${may ? `data-plstep="${esc(i.id)}|${k}"` : ''}>${s.done ? '✓' : s.by && s.by < tday() ? '!' : ''}</${may ? 'button' : 'span'}><span class="t"><b>${esc(s.t)}</b><small>${esc(w ? first(w) : 'no one yet')}${s.done ? ' · done ' + nice(iso(new Date(s.done))) : s.by ? ' · by ' + nice(s.by) + (s.by === tday() ? ' · on their Today list' : '') : ''}</small></span></div>`; }).join('') || '<p class="empty">No steps.</p>'}</div>
      <div class="h2">Linked</div><div class="card one">${row(`Spending · ${M(sp.reduce((a, e) => a + (+String(e.amount).replace(/[^\d.]/g, '') || 0), 0))}`, sp.length ? sp.map(e => esc(e.what || e.cat) + ' ' + M(+String(e.amount).replace(/[^\d.]/g, '') || 0)).join(' · ') : 'Record a payment and choose this item', null, null, '#biz/spending')}
        ${row(`Enquiries tagged "${esc(i.tag || i.name)}"`, `counted by the Hub · ${E.length} so far`, null, null, '#enq')}${row('Calendar · ' + nice(i.d1), '', null, null, '#calendar/day/' + i.d1)}${i.hist && i.hist.length ? row('Changes', i.hist.slice(-1).map(h => esc(h)).join(''), null, null, null) : ''}</div>`;
  }
  function itemSheet(id){
    const i = id ? planItems().find(x => x.id === id) : null, P = (D.people || []).filter(p => ['director','admin'].includes(p.role) || p.tutor || p.role === 'tutor');
    const st = i ? JSON.parse(JSON.stringify(i)) : {name:'', area:'mkt', owner: me().id, d1: tday(), d2: '', status:'confirmed', cost:'', aim:'', aimWhat:'enquiries', desc:'', steps: []};
    const keep = () => { ['name','d1','d2','cost','aim','desc'].forEach(k => { const el = $('pi_' + k); if(el) st[k] = el.value; }); document.querySelectorAll('#sheet [data-pis]').forEach(el => { const [k, f] = el.dataset.pis.split('|'); if(st.steps[+k]) st.steps[+k][f] = el.value; }); };
    const draw = () => { openSheet(`<div class="hx"><h3>${i ? esc(i.name) : 'Add to the plan'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="pi_name" value="${esc(st.name)}" placeholder="e.g. Open day"></label>
      <label class="f"><span>What it is (optional)</span><textarea class="in" id="pi_desc" rows="2">${esc(st.desc)}</textarea></label>
      <div class="r2"><label class="f"><span>Starts</span><input class="in" type="date" id="pi_d1" value="${esc(st.d1)}"></label><label class="f"><span>Ends</span><input class="in" type="date" id="pi_d2" value="${esc(st.d2)}"></label></div>
      <div class="f"><span>Area</span><div class="chips" style="margin:4px 0 0">${Object.entries(AREA).map(([k, [ic, l]]) => `<button type="button" class="chip ${st.area === k ? 'on' : ''}" data-pia="${k}">${ic} ${l}</button>`).join('')}</div></div>
      <div class="f"><span>Owner</span><select class="in" id="pi_owner">${P.map(p => `<option value="${esc(p.id)}" ${st.owner === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="f"><span>Status</span><div class="chips" style="margin:4px 0 0">${[['planned','Planned'],['confirmed','Confirmed'],['done','Done']].map(([k, l]) => `<button type="button" class="chip ${st.status === k ? 'on' : ''}" data-pistat="${k}">${l}</button>`).join('')}</div></div>
      <div class="r2"><label class="f"><span>Cost (MWK)</span><input class="in" id="pi_cost" inputmode="numeric" value="${esc(st.cost)}"></label><label class="f"><span>Aim (e.g. 12 enquiries)</span><input class="in" id="pi_aim" value="${esc(st.aim)}"></label></div>
      <div class="f"><span>Steps</span>${st.steps.map((s, k) => `<div class="r2" style="margin-bottom:6px;grid-template-columns:1.4fr 1fr 1fr auto"><input class="in" data-pis="${k}|t" value="${esc(s.t)}" placeholder="Step"><select class="in" data-pis="${k}|who"><option value="">Who…</option>${P.map(p => `<option value="${esc(p.id)}" ${s.who === p.id ? 'selected' : ''}>${esc(first(p.name))}</option>`).join('')}</select><input class="in" type="date" data-pis="${k}|by" value="${esc(s.by || '')}"><button type="button" class="btn sm" data-pisrm="${k}">✕</button></div>`).join('')}<button type="button" class="btn sm" data-pisadd>+ Step</button></div>
      ${i ? `<div class="r2"><button class="btn" data-picopy>Copy</button><button class="btn" data-pinext>Move to next year</button></div><div class="r2" style="margin-top:8px"><button class="btn" data-pidel style="color:var(--rd)">Remove</button><button class="btn n" id="piGo">Save</button></div><p class="note" style="margin-top:8px">Moving dates moves its steps on Today lists and calendars. Remove can be undone for 10 seconds.</p>` : '<button class="btn n full" id="piGo">Add</button>'}`);
      const on = (sel, f) => document.querySelectorAll('#sheet ' + sel).forEach(b => b.onclick = () => { keep(); st.owner = $('pi_owner').value; f(b); draw(); });
      on('[data-pia]', b => st.area = b.dataset.pia); on('[data-pistat]', b => st.status = b.dataset.pistat); on('[data-pisadd]', () => st.steps.push({t:'', who:'', by:''})); on('[data-pisrm]', b => st.steps.splice(+b.dataset.pisrm, 1));
      const save = async (rec, newId) => { rec.steps = (rec.steps || []).filter(s => s.t && s.t.trim()); if(!rec.name.trim()) return toast('Give it a name'); if(!rec.d2 || rec.d2 < rec.d1) rec.d2 = rec.d2 && rec.d2 >= rec.d1 ? rec.d2 : '';
        if(i && !newId && (i.d1 !== rec.d1 || i.owner !== rec.owner)) rec.hist = (i.hist || []).concat(`${i.d1 !== rec.d1 ? `moved from ${nice(i.d1)}` : 'owner changed'} by ${first(me().name)} · ${nice(tday())}`).slice(-10);
        if(i && !newId && i.d1 !== rec.d1){ const sh = Math.round((parse(rec.d1) - parse(i.d1)) / 864e5); rec.steps.forEach(s => { if(s.by && !s.done) s.by = addD(s.by, sh); }); }
        if(await put('lhq_bplan', newId || (i ? i.id : uid('i:')), rec)){ closeSheet(); toast(i && !newId ? 'Saved' : 'Added to the plan'); syncSteps(); } };
      $('piGo').onclick = () => { keep(); st.owner = $('pi_owner').value; save(Object.assign({}, st)); };
      const cp = document.querySelector('#sheet [data-picopy]'); if(cp) cp.onclick = () => { keep(); save(Object.assign({}, st, {name: st.name + ' (copy)', status:'planned', steps: st.steps.map(s => Object.assign({}, s, {done: 0}))}), uid('i:')); };
      const nx = document.querySelector('#sheet [data-pinext]'); if(nx) nx.onclick = () => { keep(); const sh = d => d ? (+d.slice(0, 4) + 1) + d.slice(4) : ''; save(Object.assign({}, st, {d1: sh(st.d1), d2: sh(st.d2), steps: st.steps.map(s => Object.assign({}, s, {by: sh(s.by), done: 0})), status:'planned'})); };
      const dl = document.querySelector('#sheet [data-pidel]'); if(dl) dl.onclick = () => { closeSheet(); undoable(i); };
    };
    draw();
  }
  /* remove, with 10 seconds to undo */
  function undoable(i){
    const bar = document.createElement('div'); bar.className = 'pl-undo'; bar.innerHTML = `<span>Removed "${esc(i.name)}"</span><button class="btn sm">Undo</button>`; document.body.appendChild(bar);
    let gone = false; const tm = setTimeout(async () => { gone = true; bar.remove(); await del('lhq_bplan', i.id); location.hash = '#plan/planner'; }, 10000);
    bar.querySelector('button').onclick = () => { if(gone) return; clearTimeout(tm); bar.remove(); toast('Kept'); };
  }
  /* each step with a person and a day goes onto their Today list (a job from the Director, linked to the item) */
  async function syncSteps(){ /* steps show on Today lists through the jobs: added when the step has a person and a day */
    if(!window.TODAY || !isDir()) return;
    for(const i of planItems()) for(const [k, s] of (i.steps || []).entries()){ if(!s.who || !s.by || s.done || s.job) continue;
      try{ const j = await hub.api('jobs', {method:'POST', body: JSON.stringify({action:'add', what: `${s.t} · ${i.name}`, to: s.who, d: s.by})}); s.job = j.id; await hub.api('plan', {method:'POST', body: JSON.stringify({action:'put', key:'lhq_bplan', id: i.id, rec: i})}); }catch(e){} }
  }
  /* ---------- partners and schools ---------- */
  const partners = () => Object.values((D && D.partners) || {}).filter(p => p.kind !== 'school'), schoolRecs = () => Object.values((D && D.partners) || {}).filter(p => p.kind === 'school'), kids = () => Object.values((D && D.kids) || {}).filter(k => !k.del);
  let PBY = 'p';
  function partnersPage(){
    const P = partners(), K = kids(), moved = K.filter(k => k.moved), money = partnerMoney();
    return head('Partners', `${P.length} partner${P.length === 1 ? '' : 's'} · ${K.length} children · ${moved.length} moved into tuition`, isDir() || (me().perms || []).includes('bdo') ? '<button class="btn n" data-plpnew>+ Partner</button>' : '') + tabs('partners') +
      `<div class="seg" style="margin-bottom:12px"><a href="#" class="${PBY === 'p' ? 'on' : ''}" data-plpby="p">By partner</a><a href="#" class="${PBY === 'a' ? 'on' : ''}" data-plpby="a">By activity</a></div>` +
      (PBY === 'p' ? `<div class="card one">${P.map(p => { const k = K.filter(x => x.partner === p.id), mv = k.filter(x => x.moved).length, mo = money[p.id] || {fees: 0};
          return row(esc(p.name), `${p.arr === 'partner' ? 'Partner collects · ' + (p.comm || 0) + '% to LHQ' : 'LHQ collects · ' + (p.share || 0) + '% to partner'} · ${k.length} children`, M(p.arr === 'partner' ? mo.fees * (p.comm || 0) / 100 : mo.fees), `${mv} → tuition`, '#plan/partner/' + p.id); }).join('') || '<p class="empty">No partners yet.</p>'}</div>`
        : (() => { const A = {}; P.forEach(p => (p.acts || []).forEach(a => { const k = a.name.split('·')[0].trim().toLowerCase(); (A[k] = A[k] || {name: a.name.split('·')[0].trim(), L: []}).L.push({p, a}); }));
          return `<div class="card one">${Object.values(A).map(x => row(esc(x.name), x.L.map(y => esc(y.p.name)).join(' · '), K.filter(k => x.L.some(y => y.a.id === k.act)).length + ' children')).join('') || '<p class="empty">No activities yet.</p>'}</div>`; })()) +
      `<div class="h2">Into tuition</div><div class="kv3"><div><span>Moved</span><b>${moved.length}</b><small>${pc(moved.length, K.length)}% of ${K.length}</small></div><div><span>Tuition from them</span><b>${M(movedTuition())}</b><small>this year</small></div><div><span>Plan</span><b>${(streams().find(s => s.kind === 'partner') || {}).toTuition || '–'}${(streams().find(s => s.kind === 'partner') || {}).toTuition ? '%' : ''}</b><small>by Aug</small></div></div>
      <div class="h2">Money</div><div class="card one">${row('Fees collected by LHQ', '', M(Object.values(money).reduce((a, x) => a + (x.lhq ? x.fees : 0), 0)))}${row('Paid to partners', 'their share of fees LHQ collects', M(Object.values(money).reduce((a, x) => a + (x.lhq ? x.fees * x.share / 100 : 0), 0)))}${row('Commission received', 'partners who collect', M(Object.values(money).reduce((a, x) => a + (!x.lhq ? x.fees * x.comm / 100 : 0), 0)))}</div>`;
  }
  /* fees of children in activities, from the receipts that name the activity or partner */
  function partnerMoney(){
    const out = {}, docs = window.HD ? HD.load() : [], y = conf().fy, from = fyMonths(y)[0] + '-01', nk = s => String(s || '').toLowerCase();
    partners().forEach(p => { const fees = docs.filter(x => x.type === 'receipt' && !x.del && (x.date || '') >= from && nk([x.what, x.notes, x.student].join(' ')).includes(nk(p.name).split(' ')[0])).reduce((a, r) => a + (+String(r.received || 0).replace(/[^\d.]/g, '') || 0), 0);
      const est = kids().filter(k => k.partner === p.id).reduce((a, k) => a + (+((p.acts || []).find(x => x.id === k.act) || {}).fee || 0) * Math.max(1, monthsSince(k.since)), 0);
      out[p.id] = {fees: fees || est, lhq: p.arr !== 'partner', share: +p.share || 0, comm: +p.comm || 0, est: !fees}; });
    return out;
  }
  const monthsSince = d => { if(!d) return 1; const a = parse(d), b = new Date(); return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1); };
  function movedTuition(){ const docs = window.HD ? HD.load() : [], from = fyMonths(conf().fy)[0] + '-01', nk = s => String(s || '').trim().toLowerCase();
    const names = new Set(kids().filter(k => k.moved).map(k => nk(k.name))); return docs.filter(x => x.type === 'receipt' && !x.del && (x.date || '') >= from && names.has(nk(x.student))).reduce((a, r) => a + (+String(r.received || 0).replace(/[^\d.]/g, '') || 0), 0); }
  function partnerPage(id){
    const p = partners().find(x => x.id === id); if(!p) return `<a class="crumb" href="#plan/partners">‹ Partners</a><p class="empty">Not found.</p>`;
    const K = kids().filter(k => k.partner === id), mv = K.filter(k => k.moved), mo = partnerMoney()[id] || {fees: 0}, may = isDir() || (me().perms || []).includes('bdo');
    return `<a class="crumb" href="#plan/partners">‹ Partners</a>` + head(esc(p.name), `${p.since ? 'Since ' + nice(p.since).slice(4) : ''}${p.renew ? ' · renews ' + nice(p.renew) : ''}${p.contact ? ' · ' + esc(p.contact) : ''}`, may ? `<button class="btn" data-plpedit="${esc(id)}">Edit</button>` : '') +
      `<div class="card one">${row('Money', p.arr === 'partner' ? `Partner collects · ${p.comm || 0}% to LHQ` : `LHQ collects · ${p.share || 0}% to the partner`)}</div>
      <div class="kv3"><div><span>Children</span><b>${K.length}</b></div><div><span>Into tuition</span><b>${mv.length}</b><small>${pc(mv.length, K.length)}%</small></div><div><span>Fees · year</span><b>${M(mo.fees)}</b><small>${p.arr === 'partner' ? M(mo.fees * (p.comm || 0) / 100) + ' to LHQ' : M(mo.fees * (p.share || 0) / 100) + ' to them'}${mo.est ? ' · estimated' : ''}</small></div></div>
      <div class="h2">Activities ${may ? '<button class="btn sm" data-planew="' + esc(id) + '">+ Activity</button>' : ''}</div><div class="card one">${(p.acts || []).map(a => row(esc(a.name), `${K.filter(k => k.act === a.id).length} children · ${M(a.fee)} a month`)).join('') || '<p class="empty">None yet.</p>'}</div>
      <div class="h2">Children ${may || me().role === 'admin' ? '<button class="btn sm" data-plknew="' + esc(id) + '">+ Child</button>' : ''}</div><div class="card one">${K.map(k => `<button class="it" data-plkid="${esc(k.id)}" style="width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit"><span class="t"><b>${esc(k.name)}</b><small>${esc(((p.acts || []).find(a => a.id === k.act) || {}).name || '')}${k.school ? ' · ' + esc(k.school) : ''}${k.moved ? ' · in tuition ✓' : ''}</small></span><span class="chev">›</span></button>`).join('') || '<p class="empty">No children yet.</p>'}</div>
      <div class="h2">Contact log ${may ? '<button class="btn sm" data-pllog="' + esc(id) + '">+ Add</button>' : ''}</div><div class="card one">${(p.log || []).slice().reverse().map(l => row(nice(l.d) + ' · ' + esc(l.kind || 'note'), esc(l.t))).join('') || '<p class="empty">Nothing yet.</p>'}</div>`;
  }
  function partnerSheet(id){
    const p = id ? partners().find(x => x.id === id) : null, st = p ? JSON.parse(JSON.stringify(p)) : {name:'', contact:'', arr:'lhq', share: 40, comm: 10, since: tday(), renew: '', acts: [], log: []};
    const keep = () => ['name','contact','share','comm','since','renew'].forEach(k => { const el = $('pp_' + k); if(el) st[k] = el.value; });
    const draw = () => { openSheet(`<div class="hx"><h3>${p ? 'Partner' : 'New partner'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="pp_name" value="${esc(st.name)}"></label><label class="f"><span>Contact person and phone</span><input class="in" id="pp_contact" value="${esc(st.contact)}"></label>
      <div class="f"><span>Who collects the fees</span><div class="chips" style="margin:4px 0 0"><button type="button" class="chip ${st.arr === 'lhq' ? 'on' : ''}" data-ppa="lhq">LHQ collects, pays their share</button><button type="button" class="chip ${st.arr === 'partner' ? 'on' : ''}" data-ppa="partner">Partner collects, pays LHQ commission</button></div></div>
      <div class="r2">${st.arr === 'lhq' ? `<label class="f"><span>Their share (%)</span><input class="in" id="pp_share" inputmode="numeric" value="${esc(st.share)}"></label>` : `<label class="f"><span>LHQ's commission (%)</span><input class="in" id="pp_comm" inputmode="numeric" value="${esc(st.comm)}"></label>`}<span></span></div>
      <div class="r2"><label class="f"><span>Since</span><input class="in" type="date" id="pp_since" value="${esc(st.since)}"></label><label class="f"><span>Renews</span><input class="in" type="date" id="pp_renew" value="${esc(st.renew)}"></label></div>
      <button class="btn n full" id="ppGo">Save</button>`);
      document.querySelectorAll('#sheet [data-ppa]').forEach(b => b.onclick = () => { keep(); st.arr = b.dataset.ppa; draw(); });
      $('ppGo').onclick = async () => { keep(); if(!st.name.trim()) return toast('Give the partner a name'); if(await put('lhq_partners', p ? p.id : uid('pt'), st)){ closeSheet(); toast('Saved'); } }; };
    draw();
  }
  function schoolsPage(){
    const S = window.HD ? HD.students() : [], R = HD.store.get('lhq_students', {}) || {}, t = tday(), act = S.filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= t)), A = actuals(conf().fy);
    const by = {}; act.forEach(s => { const sc = ((R[s.key] || {}).school || s.school || 'School not set').trim(), o = by[sc] = by[sc] || {n: 0, inp: 0, onl: 0, amt: 0, L: []}; o.n++; o.L.push(s); });
    A.receipts.forEach(t2 => { const k = String(t2.r.student || '').trim().toLowerCase(), sc = ((R[k] || {}).school || 'School not set').trim(); if(by[sc]){ by[sc].amt += A.amt(t2.r); by[sc][t2.mode]++; } });
    const K = kids(), kb = {}; K.forEach(k => { const sc = (k.school || 'School not set').trim(); (kb[sc] = kb[sc] || []).push(k); });
    return head('Schools', `${act.length} students · from the student profiles`) + tabs('schools') +
      `<div class="card one">${Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([sc, o]) => { const sr = schoolRecs().find(x => String(x.name).toLowerCase() === sc.toLowerCase()), lv = sr && (sr.log || []).filter(l => l.kind === 'visit').slice(-1)[0]; return row(esc(sc), `${o.L.slice(0, 3).map(s => esc(first(s.name))).join(', ')}${o.n > 3 ? ' and ' + (o.n - 3) + ' more' : ''}${lv ? ' · visited ' + nice(lv.d) : ''}`, o.n, M(o.amt), sc === 'School not set' ? '#students/missing' : null, sc !== 'School not set' && (isDir() || (me().perms || []).includes('bdo')) ? `<button class="pl-ed" data-schlog="${esc(sc)}" title="Contact log">✎</button>` : ''); }).join('') || '<p class="empty">No active students.</p>'}</div>
      ${Object.keys(kb).length ? `<div class="h2">Partner children by school <em>${K.length}</em></div><div class="card one">${Object.entries(kb).map(([sc, L]) => row(esc(sc), L.slice(0, 4).map(k => esc(first(k.name))).join(', ') + (L.some(k => k.moved) ? ` · ${L.filter(k => k.moved).length} now in tuition` : ''), L.length)).join('')}</div>` : ''}
      <p class="note">Set a student's school on their details page. Your share of each school: release 3.</p>`;
  }
  function whoPage(){
    if(!isDir()) return '';
    const C = conf(), V = C.vis || {}, P = (D.people || []).filter(p => p.role !== 'director' && ['admin'].includes(p.role));
    const sw = (pid, k, l, sub) => `<div class="it"><span class="t"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span><button class="lp-sw${(V[pid] || {})[k] ? ' on' : ''}" data-plvis="${esc(pid)}|${k}" role="switch" aria-checked="${!!(V[pid] || {})[k]}"></button></div>`;
    return head('Who sees the plan', 'Director only, unless you add someone') + tabs('who') + `<div class="card one">${row(esc(me().name), 'Director · everything', 'All')}</div>` +
      P.map(p => `<div class="h2">${esc(p.name)} <em>${(p.perms || []).includes('bdo') ? 'BDO' : ''}${(p.perms || []).includes('acct') ? ((p.perms || []).includes('bdo') ? ' and accountant' : 'accountant') : ''}</em></div><div class="card one">${sw(p.id, 'pp', 'Partners and schools')}${sw(p.id, 'planner', 'Planner', 'their own items always show')}${sw(p.id, 'streams', 'Streams and Five years', 'read only')}${sw(p.id, 'costs', 'Costs and profit')}${sw(p.id, 'edit', 'Change measures and targets')}</div>`).join('');
  }

  /* ---------- start the plan from today's figures ---------- */
  async function seed(){
    const t = tday(), S = HD.students().filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= t)), L = Object.values((HD.store.get('lhq_logs', {e:{}}) || {}).e || {}).filter(e => e && !e.x && e.ty === 's' && e.d >= addD(t, -60));
    const onl = new Set(), by = {}; L.forEach(e => { const st = String(e.k || '').split('|')[0], o = by[st] = by[st] || [0, 0]; o[e.md === 'o' || /o$/.test(e.fmt || '') ? 1 : 0]++; }); Object.entries(by).forEach(([k, o]) => { if(o[1] > o[0]) onl.add(k); });
    const nO = S.filter(s => onl.has(s.key)).length, nI = S.length - nO, docs = HD.load(), rc = docs.filter(x => x.type === 'receipt' && x.date >= addD(t, -90)), inc3 = rc.reduce((a, r) => a + (+String(r.received || 0).replace(/[^\d.]/g, '') || 0), 0);
    const fee = S.length ? Math.round(inc3 / 3 / S.length / 1000) * 1000 : 80000, R = ((HD.store.get('lhq_pay', {}) || {}).rules) || {}, ses = L.length && S.length ? Math.max(4, Math.round(L.length / 2 / S.length)) : 8;
    const spend = Object.values(HD.store.get('lhq_spend', {}) || {}).filter(e => e && !e.del && e.date >= addD(t, -90)), cats = {}; spend.forEach(e => { cats[e.cat || 'Other'] = (cats[e.cat || 'Other'] || 0) + (+String(e.amount || 0).replace(/[^\d.]/g, '') || 0); });
    const recs = [['lhq_bplan', 'conf', {fy: fyOf(t), cap: 180, centres: 1, centre: 'Area 47', junLeave: 25, low: 85, high: 115, grow: {enq: 30, fee: 8, enrol: 2, kept: 1, partners: 40, places: 30}, comm: 25000, bdoShare: 50, tutorSes: 60, vis: {}}],
      ['lhq_bplan', 's:inp', {name:'Weekly tuition', kind:'tuition', mode:'inp', status:'running', students0: nI, enqM: Math.max(4, Math.round(nI / 4)), enrol: 35, kept: 86, fee, ses, rate: +R.inp || 8000, ord: 1}],
      ['lhq_bplan', 's:onl', {name:'Weekly tuition', kind:'tuition', mode:'onl', status:'running', students0: nO, enqM: Math.max(1, Math.round(nO / 4)), enrol: 30, kept: 82, fee: Math.round(fee * 0.85 / 1000) * 1000, ses, rate: +R.onl || 7000, ord: 2}],
      ['lhq_bplan', 's:ft', {name:'Fast Track', kind:'prog', mode:'inp', status:'running', runs: 2, places: 12, fill: 70, feePlace: 180000, costRun: 900000, months: '1,7', match: 'fast track', ord: 3}],
      ['lhq_bplan', 's:mar', {name:'IGCSE Marathon', kind:'prog', mode:'inp', status:'running', runs: 1, places: 20, fill: 90, feePlace: 180000, costRun: 1200000, months: '4', match: 'marathon', ord: 4}],
      ['lhq_bplan', 's:par', {name:'Partner activities', kind:'partner', mode:'none', status:'running', arr:'lhq', children: kids().length || 0, feeChild: 8000, share: 45, comm: 10, toTuition: 20, ord: 5}],
      ['lhq_bplan', 'c:staff', {name:'Staff pay', kind:'staff', monthly: 700000, cats: ['Salaries','Staff pay','Wages']}],
      ['lhq_bplan', 'c:rent', {name:'Rent and running', kind:'rent', monthly: Math.round(((cats['Rent'] || 0) + (cats['Utilities'] || 0) + (cats['Internet'] || 0)) / 3) || 350000, cats: ['Rent','Utilities','Internet','Electricity','Water']}],
      ['lhq_bplan', 'c:mkt', {name:'Marketing', kind:'mkt', monthly: Math.round((cats['Marketing'] || 0) / 3) || 100000, cats: ['Marketing','Advertising']}],
      ['lhq_bplan', 'c:mat', {name:'Materials and printing', kind:'materials', monthly: Math.round(((cats['Printing'] || 0) + (cats['Stationery'] || 0) + (cats['Materials'] || 0)) / 3) || 50000, cats: ['Printing','Stationery','Materials']}]];
    for(const [k, id, r] of recs){ try{ await hub.api('plan', {method:'POST', body: JSON.stringify({action:'put', key:k, id, rec:r})}); }catch(e){ toast(e.message); return; } }
    await load(true); toast('Plan started · change any figure');
  }
  /* add or change a stream or a cost line */
  function streamSheet(id){
    const s = id ? streams().find(x => x.id === id) : null, st = s ? Object.assign({}, s) : {name:'', kind:'tuition', mode:'inp', status:'planned'};
    const draw = () => { const F = FIELDS[st.kind] || [];
      openSheet(`<div class="hx"><h3>${s ? 'Stream' : 'New stream'}</h3><button class="ib" data-close>✕</button></div>
        <label class="f"><span>Name</span><input class="in" id="ss_name" value="${esc(st.name)}" placeholder="e.g. IELTS course"></label>
        <div class="f"><span>Kind</span><div class="chips" style="margin:4px 0 0">${Object.entries(KIND).map(([k, l]) => `<button type="button" class="chip ${st.kind === k ? 'on' : ''}" data-ssk="${k}">${l}</button>`).join('')}</div></div>
        ${st.kind !== 'partner' ? `<div class="f"><span>Where</span><div class="chips" style="margin:4px 0 0">${[['inp','In-person'],['onl','Online']].map(([k, l]) => `<button type="button" class="chip ${st.mode === k ? 'on' : ''}" data-ssm="${k}">${l}</button>`).join('')}</div></div>` : ''}
        <div class="f"><span>Status</span><div class="chips" style="margin:4px 0 0">${[['running','Running'],['planned','Planned · High case only'],['confirmed','Confirmed']].map(([k, l]) => `<button type="button" class="chip ${(st.conf ? 'confirmed' : st.status) === k ? 'on' : ''}" data-sss="${k}">${l}</button>`).join('')}</div></div>
        ${F.map(([k, l]) => `<label class="f"><span>${l}</span><input class="in" id="ss_${k}" value="${esc(st[k] != null ? st[k] : '')}"></label>`).join('')}
        <label class="f"><span>Words that mark its receipts (optional, commas)</span><input class="in" id="ss_match" value="${esc(st.match || '')}" placeholder="e.g. ielts"></label>
        <button class="btn n full" id="ssGo">Save</button>${s ? '<button class="btn full" id="ssDel" style="margin-top:8px;color:var(--rd)">Remove</button>' : ''}`);
      const keep = () => { st.name = $('ss_name').value; st.match = $('ss_match').value; F.forEach(([k]) => { const v = $('ss_' + k).value; st[k] = k === 'months' ? v : v === '' ? '' : +String(v).replace(/[^\d.]/g, ''); }); };
      document.querySelectorAll('#sheet [data-ssk]').forEach(b => b.onclick = () => { keep(); st.kind = b.dataset.ssk; if(st.kind === 'partner') st.mode = 'none'; else if(st.mode === 'none') st.mode = 'inp'; draw(); });
      document.querySelectorAll('#sheet [data-ssm]').forEach(b => b.onclick = () => { keep(); st.mode = b.dataset.ssm; draw(); });
      document.querySelectorAll('#sheet [data-sss]').forEach(b => b.onclick = () => { keep(); st.status = b.dataset.sss === 'confirmed' ? 'planned' : b.dataset.sss; st.conf = b.dataset.sss === 'confirmed'; draw(); });
      $('ssGo').onclick = async () => { keep(); if(!st.name.trim()) return toast('Give it a name'); if(await put('lhq_bplan', s ? s.id : uid('s:'), st)){ closeSheet(); toast('Saved'); } };
      if($('ssDel')) $('ssDel').onclick = async () => { if(await del('lhq_bplan', s.id)){ closeSheet(); location.hash = '#plan/streams'; } }; };
    draw();
  }
  function costSheet(id){
    const c = id ? costs().find(x => x.id === id) : null, st = c ? Object.assign({}, c) : {name:'', kind:'other', monthly:'', cats: []};
    const draw = () => { openSheet(`<div class="hx"><h3>${c ? 'Cost line' : 'New cost line'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="cs_name" value="${esc(st.name)}"></label>
      <div class="f"><span>Kind</span><div class="chips" style="margin:4px 0 0">${[['staff','Staff'],['rent','Rent and running · per centre'],['mkt','Marketing'],['materials','Materials'],['other','Other']].map(([k, l]) => `<button type="button" class="chip ${st.kind === k ? 'on' : ''}" data-csk="${k}">${l}</button>`).join('')}</div></div>
      <label class="f"><span>A month (MWK)</span><input class="in" id="cs_monthly" inputmode="numeric" value="${esc(st.monthly)}"></label>
      <label class="f"><span>Spending categories that count here (commas)</span><input class="in" id="cs_cats" value="${esc((st.cats || []).join(', '))}"></label>
      <button class="btn n full" id="csGo">Save</button>${c ? '<button class="btn full" id="csDel" style="margin-top:8px;color:var(--rd)">Remove</button>' : ''}`);
      const keep = () => { st.name = $('cs_name').value; st.monthly = +String($('cs_monthly').value).replace(/[^\d.]/g, '') || 0; st.cats = $('cs_cats').value.split(',').map(x => x.trim()).filter(Boolean); };
      document.querySelectorAll('#sheet [data-csk]').forEach(b => b.onclick = () => { keep(); st.kind = b.dataset.csk; draw(); });
      $('csGo').onclick = async () => { keep(); if(!st.name.trim()) return toast('Give it a name'); if(await put('lhq_bplan', c ? c.id : uid('c:'), st)){ closeSheet(); toast('Saved'); } };
      if($('csDel')) $('csDel').onclick = async () => { if(await del('lhq_bplan', c.id)) closeSheet(); }; };
    draw();
  }
  function kidSheet(pid, kid){
    const p = partners().find(x => x.id === pid) || partners().find(x => x.id === (kid && kid.partner)), k = kid || {name:'', parent:'', phone:'', school:'', year:'', act: ((p && p.acts) || [])[0]?.id || '', partner: pid, since: tday(), src: 'partner'};
    const st = Object.assign({}, k);
    openSheet(`<div class="hx"><h3>${kid ? esc(kid.name) : 'Child in an activity'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="kd_name" value="${esc(st.name)}"></label><div class="r2"><label class="f"><span>Parent</span><input class="in" id="kd_parent" value="${esc(st.parent)}"></label><label class="f"><span>Phone</span><input class="in" id="kd_phone" value="${esc(st.phone)}"></label></div>
      <div class="r2"><label class="f"><span>School</span><input class="in" id="kd_school" value="${esc(st.school)}"></label><label class="f"><span>Year</span><input class="in" id="kd_year" value="${esc(st.year)}"></label></div>
      <label class="f"><span>Activity</span><select class="in" id="kd_act">${((p && p.acts) || []).map(a => `<option value="${esc(a.id)}" ${st.act === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="f"><span>Since</span><input class="in" type="date" id="kd_since" value="${esc(st.since)}"></label>
      <button class="btn n full" id="kdGo">Save</button>${kid && !kid.moved ? '<button class="btn full" id="kdMove" style="margin-top:8px">Move into tuition → admin</button><p class="note" style="margin-top:6px">Becomes an enquiry "Ready to enrol", source kept. When admin adds the student, the partner gets the credit.</p>' : kid && kid.moved ? '<p class="note" style="margin-top:8px">In tuition ✓</p>' : ''}`);
    const keep = () => ['name','parent','phone','school','year','act','since'].forEach(f => st[f] = $('kd_' + f).value);
    $('kdGo').onclick = async () => { keep(); if(!st.name.trim()) return toast('Give the child\'s name'); if(await put('lhq_kids', kid ? kid.id : uid('kd'), st)){ closeSheet(); toast('Saved'); } };
    if($('kdMove')) $('kdMove').onclick = async () => { keep(); const eid = uid('en');
      const ok = await put('lhq_enq', eid, {who: st.parent || st.name, phone: st.phone, st: st.name, for: 'tuition', year: st.year, school: st.school, src: 'BDO partner · ' + (p ? p.name : ''), srcOwner: 'bdo', partner: pid, kid: kid.id, stage: 'ready', d: tday(), lock: false});
      if(ok && await put('lhq_kids', kid.id, Object.assign({}, st, {moved: tday(), enq: eid}))){ closeSheet(); toast('Sent to admin to enrol'); } };
  }
  function actSheet(pid){
    const p = partners().find(x => x.id === pid); if(!p) return;
    openSheet(`<div class="hx"><h3>New activity · ${esc(p.name)}</h3><button class="ib" data-close>✕</button></div><label class="f"><span>Activity</span><input class="in" id="ac_n" placeholder="e.g. Chess · Saturdays"></label><label class="f"><span>Fee a child a month (MWK)</span><input class="in" id="ac_f" inputmode="numeric"></label><button class="btn n full" id="acGo">Add</button>`);
    $('acGo').onclick = async () => { const n = $('ac_n').value.trim(); if(!n) return toast('Name the activity'); const r = JSON.parse(JSON.stringify(p)); r.acts = (r.acts || []).concat({id: uid('ac'), name: n, fee: +String($('ac_f').value).replace(/[^\d]/g, '') || 0}); if(await put('lhq_partners', p.id, r)){ closeSheet(); toast('Added'); } };
  }
  function logSheet(pid){
    const p = partners().find(x => x.id === pid); if(!p) return;
    openSheet(`<div class="hx"><h3>Contact log · ${esc(p.name)}</h3><button class="ib" data-close>✕</button></div><div class="chips">${['meeting','call','visit','message'].map((k, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-lgk="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><label class="f"><span>What happened</span><textarea class="in" id="lg_t" rows="3"></textarea></label><button class="btn n full" id="lgGo">Add</button>`);
    let kind = 'meeting'; document.querySelectorAll('#sheet [data-lgk]').forEach(b => b.onclick = () => { kind = b.dataset.lgk; document.querySelectorAll('#sheet [data-lgk]').forEach(x => x.classList.toggle('on', x === b)); });
    $('lgGo').onclick = async () => { const t = $('lg_t').value.trim(); if(!t) return toast('Say what happened'); const r = JSON.parse(JSON.stringify(p)); r.log = (r.log || []).concat({d: tday(), kind, t, by: me().name}).slice(-200); if(await put('lhq_partners', p.id, r)){ closeSheet(); toast('Added'); } };
  }

  /* ---------- the monthly board report (Mockup 14) ---------- */
  const BSEC = [['sum','Summary','You'],['ask','Decisions needed from the board','You'],['stu','Students','Hub'],['money','Money: plan against actual','Hub'],['streams','Streams','Hub'],['quality','Teaching quality','Hub'],['part','Partners and enquiries','Hub'],['planner','The year planner','Hub'],['goals','Goals for the year','Hub'],['last',"Last month's priorities",'You'],['next',"Next month's priorities",'You'],['risks','Risks','You'],['five','Five years','Hub']];
  function boardData(ym){
    const y = fyOf(ym + '-15'), m = model(0, 'exp'), A = actuals(y), ms = fyMonths(y), i = ms.indexOf(ym), t = tday();
    const pm = i >= 0 ? m.months[i] : 0, am = i >= 0 ? A.mon[i] : 0, S = window.HD ? HD.students() : [], act = S.filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= (ym + '-28'))).length;
    const L = Object.values((HD.store.get('lhq_logs', {e:{}}) || {}).e || {}).filter(e => e && !e.x && e.ty === 's' && (e.d || '').startsWith(ym)), del = L.filter(e => !['absent','cancelled'].includes(e.a)).length;
    const E = Object.values((D && D.enq) || {}).filter(e => (e.d || '').startsWith(ym)), P = planItems().filter(x => x.d1 <= ym + '-31' && (x.d2 || x.d1) >= ym + '-01');
    return {ym, pm, am, act, newS: S.filter(s => (s.firstInv || '').startsWith(ym)).length, ses: L.length, del, enq: E.length, enr: E.filter(e => e.stage === 'enrolled').length, kids: kids().length, moved: kids().filter(k => k.moved && k.moved.startsWith(ym)).length,
      itemsDone: P.filter(x => x.status === 'done').length, itemsN: P.length, slip: P.filter(isSlipping).map(x => x.name), inc: m.inc, A, m,
      five: [0, 1, 2, 3, 4].map(n => ({y: conf().fy + n, inc: model(n, 'exp').inc, T: target(conf().fy + n).inc || 0}))};
  }
  function boardPage(ym){
    load(); if(!isDir()) return '<p class="empty">The board report is the Director\'s.</p>';
    if(!D) return head('Board', 'Loading…');
    const B = (D.board) || {}, t = tday();
    if(!ym) return `<a class="crumb" href="#biz">‹ Business</a>` + head('Board', 'Monthly reports · approved ones are kept here') +
      `<div class="card one">${row(`${MOL[+t.slice(5, 7) - 1]} report`, B['b' + t.slice(0, 7)] ? (B['b' + t.slice(0, 7)].st === 'ok' ? 'approved ✓' : 'draft') : 'not started · drafted by the Hub', null, null, '#board/' + t.slice(0, 7))}</div>
        <div class="h2">Archive</div><div class="card one">${Object.values(B).filter(b => b.st === 'ok').sort((a, b) => b.id.localeCompare(a.id)).map(b => row(MOL[+b.id.slice(6, 8) - 1] + ' ' + b.id.slice(1, 5), 'approved ' + nice(iso(new Date(b.okAt || b.upd))), null, null, '#board/' + b.id.slice(1))).join('') || '<p class="empty">None approved yet.</p>'}</div>`;
    const r = B['b' + ym] || {}, X = r.st === 'ok' && r.snap ? r.snap : boardData(ym), ed = r.st !== 'ok', mon = MOL[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);
    const txt = (k, ph) => ed ? `<textarea class="in" data-bdf="${k}" rows="3" placeholder="${ph || ''}">${esc(r[k] || '')}</textarea>` : `<p class="pl-desc" style="white-space:pre-wrap">${esc(r[k] || '–')}</p>`;
    const hubSec = k => { const x = X;
      if(k === 'stu') return `<table class="pl-t2"><tr><td>Active students</td><td>${x.act}</td></tr><tr><td>New this month</td><td>${x.newS}</td></tr></table>`;
      if(k === 'money') return `<table class="pl-t2"><tr><th></th><th>Plan</th><th>Actual</th></tr><tr><td>Income · ${MO[+ym.slice(5) - 1]}</td><td>${M(x.pm)}</td><td>${M(x.am)}</td></tr><tr><td>Income · year so far</td><td>${M(planToDate(x.m || model(0, 'exp'), fyOf(ym + '-15')))}</td><td>${M((x.A || {}).inc)}</td></tr><tr><td>Profit · year plan</td><td>${M((x.m || {}).profit)}</td><td>${M((x.A || {}).profit)}</td></tr></table>`;
      if(k === 'streams') return `<table class="pl-t2"><tr><th>Stream</th><th>Plan · year</th><th>So far</th></tr>${((x.m || {}).streams || []).map(rr => `<tr><td>${esc(rr.s.name)}${rr.s.mode !== 'none' ? ' · ' + MODE[rr.s.mode].toLowerCase() : ''}</td><td>${M(rr.inc)}</td><td>${M((((x.A || {}).byS || {})[rr.s.id] || {}).amt)}</td></tr>`).join('')}</table>`;
      if(k === 'quality') return `<table class="pl-t2"><tr><td>Sessions logged</td><td>${x.ses}</td></tr><tr><td>Delivered as planned</td><td>${pc(x.del, x.ses)}%</td></tr></table>`;
      if(k === 'part') return `<table class="pl-t2"><tr><td>Enquiries</td><td>${x.enq}</td></tr><tr><td>Enrolled</td><td>${x.enr} (${pc(x.enr, x.enq)}%)</td></tr><tr><td>Children in activities</td><td>${x.kids}</td></tr><tr><td>Moved into tuition</td><td>${x.moved}</td></tr></table>`;
      if(k === 'planner') return `<p class="pl-desc">${x.itemsDone} of ${x.itemsN} items this month done.${x.slip.length ? ' Slipping: ' + x.slip.map(esc).join(', ') + '.' : ''}</p>`;
      if(k === 'goals'){ const T = target(fyOf(ym + '-15')); return `<table class="pl-t2"><tr><th>Goal</th><th>Target</th><th>Plan</th><th></th></tr><tr><td>Income</td><td>${T.inc ? M(T.inc) : '–'}</td><td>${M(x.inc)}</td><td>${T.inc ? (x.inc >= T.inc ? '<span class="dot g"></span>' : x.inc >= T.inc * 0.9 ? '<span class="dot a"></span>' : '<span class="dot r"></span>') : ''}</td></tr><tr><td>Income this month</td><td></td><td>${M(x.pm)}</td><td>${x.am >= x.pm ? '<span class="dot g"></span>' : x.am >= x.pm * 0.9 ? '<span class="dot a"></span>' : '<span class="dot r"></span>'}</td></tr></table><p class="note">Green on or ahead · amber within 10% · red further off.</p>`; }
      if(k === 'five') return `<table class="pl-t2"><tr><th>Year</th><th>Plan</th><th>Target</th></tr>${x.five.map(f => `<tr><td>${fyL(f.y)}</td><td>${M(f.inc)}</td><td>${f.T ? M(f.T) : '–'}</td></tr>`).join('')}</table>`;
      return ''; };
    const risks = r.risks || [];
    const sec = ([k, l, src], i) => `<div class="pl-bs"><div class="pl-bsh"><b>${i + 1} · ${l}</b><span class="pl-src ${src === 'Hub' ? 'h' : 'y'}">${src === 'Hub' ? 'Drafted by the Hub' : 'You write'}</span></div>${
      src === 'Hub' ? hubSec(k) : k === 'last' ? (ed ? `${(r.last || []).map((p, j) => `<div class="pl-pri"><input class="in" data-bdl="${j}" value="${esc(p.t)}"><span class="chips" style="margin:0">${['done','partly','not'].map(s => `<button class="chip ${p.st === s ? 'on' : ''}" data-bdls="${j}|${s}">${s === 'not' ? 'Not' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</span></div>`).join('')}<button class="btn sm" data-bdladd>+ Priority</button>` : (r.last || []).map(p => `<p class="pl-desc">${p.st === 'done' ? '✓' : p.st === 'partly' ? '◐' : '✕'} ${esc(p.t)}</p>`).join('') || '<p class="pl-desc">–</p>')
      : k === 'risks' ? `<table class="pl-t2"><tr><th>Risk</th><th>How likely</th><th>How serious</th></tr>${risks.map((x, j) => `<tr><td>${ed ? `<input class="in" data-bdr="${j}|t" value="${esc(x.t)}">` : esc(x.t)}</td><td>${ed ? `<select class="in" data-bdr="${j}|l">${['Low','Medium','High'].map(v => `<option ${x.l === v ? 'selected' : ''}>${v}</option>`).join('')}</select>` : x.l}</td><td>${ed ? `<select class="in" data-bdr="${j}|s">${['Low','Medium','High'].map(v => `<option ${x.s === v ? 'selected' : ''}>${v}</option>`).join('')}</select>` : x.s}</td></tr>`).join('')}</table>${ed ? '<button class="btn sm" data-bdradd>+ Risk</button>' : ''}`
      : txt(k, k === 'sum' ? 'The month in a few lines' : k === 'ask' ? 'What the board needs to decide' : k === 'next' ? 'One per line' : '')}</div>`;
    return `<div class="no-print"><a class="crumb" href="#board">‹ Board</a></div>` + head(`Board report · ${mon}`, r.st === 'ok' ? `Approved ${nice(iso(new Date(r.okAt)))} · archived` : 'Draft · the Hub drafts most of it · you write the rest',
      `${ed ? '<button class="btn" data-bdsave>Save</button><button class="btn n" data-bdok>Approve</button>' : ''}<button class="btn" data-bdpdf>PDF</button>`) +
      `<div class="pl-board">${BSEC.map(sec).join('')}</div>`;
  }
  const BF = {};
  function boardRec(ym){ const r = Object.assign({}, ((D && D.board) || {})['b' + ym] || {}); document.querySelectorAll('[data-bdf]').forEach(el => r[el.dataset.bdf] = el.value);
    r.last = (r.last || []).map((p, j) => Object.assign({}, p, {t: (document.querySelector(`[data-bdl="${j}"]`) || {}).value ?? p.t}));
    r.risks = (r.risks || []).map((x, j) => ({t: (document.querySelector(`[data-bdr="${j}|t"]`) || {}).value ?? x.t, l: (document.querySelector(`[data-bdr="${j}|l"]`) || {}).value ?? x.l, s: (document.querySelector(`[data-bdr="${j}|s"]`) || {}).value ?? x.s}));
    return r; }
  const curBoardYm = () => (location.hash.match(/^#board\/(\d{4}-\d{2})/) || [])[1];
  /* the 25th: a reminder until this month's report is approved */
  function boardDue(){ if(!isDir()) return []; if(!D) return +tday().slice(8) >= 25 ? [{key:'board', hold:true}] : []; const t = tday(); if(+t.slice(8) < 25) return []; const r = ((D.board) || {})['b' + t.slice(0, 7)]; return r && r.st === 'ok' ? [] : [{key:'board', t:`${MOL[+t.slice(5, 7) - 1]} board report`, sub:'drafted by the Hub · approve and download', href:'#board/' + t.slice(0, 7)}]; }

  /* ---------- events ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-plcs],[data-plseed],[data-plsnew],[data-plsedit],[data-plst],[data-plundo],[data-plkeep],[data-plcnew],[data-plcedit],#plTgo,[data-pllk],[data-plhigh],[data-pluse],[data-plpf],[data-plinew],[data-pliedit],[data-plstep],[data-plpnew],[data-plpedit],[data-plpby],[data-plknew],[data-plkid],[data-planew],[data-pllog],[data-plvis],[data-bdsave],[data-bdok],[data-bdpdf],[data-bdladd],[data-bdls],[data-bdradd]');
    if(!t) return; e.preventDefault(); const ds = t.dataset;
    if(ds.plcs){ CS = ds.plcs; return rerender(); }
    if(t.hasAttribute('data-plseed')) return seed();
    if(t.hasAttribute('data-plsnew')) return streamSheet(null);
    if(ds.plsedit) return streamSheet(ds.plsedit);
    if(ds.plst){ const [id, k, d] = ds.plst.split('|'), s = streams().find(x => x.id === id), T = TRY[id] = TRY[id] || {}, cur = +(T[k] != null ? T[k] : s[k]) || 0, step = ['fee','feePlace','costRun','rate','feeChild'].includes(k) ? 5000 : ['enrol','kept','fill','share','comm'].includes(k) ? 5 : 1; T[k] = Math.max(0, cur + step * +d); if(+T[k] === +s[k]) delete T[k]; return rerender(); }
    if(ds.plundo){ delete TRY[ds.plundo]; return rerender(); }
    if(ds.plkeep){ const id = ds.plkeep, s = streams().find(x => x.id === id); if(await put('lhq_bplan', id, Object.assign({}, s, TRY[id]))){ delete TRY[id]; toast('Kept · the plan updates'); } return; }
    if(t.hasAttribute('data-plcnew')) return costSheet(null);
    if(ds.plcedit){ e.stopPropagation(); return costSheet(ds.plcedit); }
    if(t.id === 'plTgo'){ const n = +location.hash.split('/')[2] || 0, y = conf().fy + n, v = x => +String($(x).value || '').replace(/[^\d.]/g, '') || 0; if(await put('lhq_bplan', 't:' + y, {inc: v('plTi'), prof: v('plTp')})) toast('Worked out'); return; }
    if(ds.pllk){ LK[ds.pllk] = !LK[ds.pllk]; return rerender(); }
    if(ds.plhigh || ds.pluse){ const n = +(ds.plhigh || ds.pluse), T = target(conf().fy + n), s = solve(n, T.inc, T.prof, LK);
      if(ds.plhigh){ const C = conf(), r = Math.round(s.m.inc / Math.max(1, model(n, 'exp').inc) * 100); if(await put('lhq_bplan', 'conf', Object.assign({}, items().conf, {high: Math.max(C.high, r)}))) toast(`High case set to ${Math.max(C.high, r)}% of Expected`); return; }
      const C = Object.assign({}, items().conf); if(s.ov._g && s.ov._g.enq != null && n) C.grow = Object.assign({}, C.grow, {enq: Math.round(s.ov._g.enq)});
      if(n > 0 && s.m.centres > (+C.centres || 1)) {}
      await put('lhq_bplan', 'conf', C);
      if(n === 0) for(const st of streams()){ const o = s.ov[st.id]; if(o && Object.keys(o).length) await put('lhq_bplan', st.id, Object.assign({}, st, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k === 'fee' ? Math.round(v / 1000) * 1000 : Math.round(v * 10) / 10])))); }
      toast('The plan now uses these'); return; }
    if(ds.plpf){ PF = ds.plpf; return rerender(); }
    if(t.hasAttribute('data-plinew')) return itemSheet(null);
    if(ds.pliedit) return itemSheet(ds.pliedit);
    if(ds.plstep){ const [id, k] = ds.plstep.split('|'), i = JSON.parse(JSON.stringify(planItems().find(x => x.id === id))); i.steps[+k].done = i.steps[+k].done ? 0 : Date.now(); if(i.steps.every(s => s.done) && i.status !== 'done' && mayEdit()) i.status = 'done'; await put('lhq_bplan', id, i); return; }
    if(t.hasAttribute('data-plpnew')) return partnerSheet(null);
    if(ds.plpedit) return partnerSheet(ds.plpedit);
    if(ds.plpby){ PBY = ds.plpby; return rerender(); }
    if(ds.plknew) return kidSheet(ds.plknew, null);
    if(ds.plkid) return kidSheet(null, kids().find(k => k.id === ds.plkid));
    if(ds.planew) return actSheet(ds.planew);
    if(ds.pllog) return logSheet(ds.pllog);
    if(ds.plvis){ const [pid, k] = ds.plvis.split('|'), C = JSON.parse(JSON.stringify(items().conf || {})); C.vis = C.vis || {}; C.vis[pid] = Object.assign({}, C.vis[pid], {[k]: (C.vis[pid] || {})[k] ? 0 : 1}); await put('lhq_bplan', 'conf', C); return; }
    const ym = curBoardYm();
    if(t.hasAttribute('data-bdladd') || ds.bdls || t.hasAttribute('data-bdradd')){ const r = boardRec(ym);
      if(t.hasAttribute('data-bdladd')) r.last = (r.last || []).concat({t:'', st:''}); if(ds.bdls){ const [j, s] = ds.bdls.split('|'); r.last[+j].st = s; } if(t.hasAttribute('data-bdradd')) r.risks = (r.risks || []).concat({t:'', l:'Medium', s:'Medium'});
      await put('lhq_board', 'b' + ym, r); return; }
    if(t.hasAttribute('data-bdsave')){ if(await put('lhq_board', 'b' + ym, boardRec(ym))) toast('Saved'); return; }
    if(t.hasAttribute('data-bdok')){ const r = boardRec(ym), X = boardData(ym); r.st = 'ok'; r.okAt = Date.now(); r.snap = JSON.parse(JSON.stringify(Object.assign({}, X, {A: {inc: X.A.inc, profit: X.A.profit, byS: Object.fromEntries(Object.entries(X.A.byS).map(([k, v]) => [k, {amt: v.amt}]))}, m: {inc: X.m.inc, profit: X.m.profit, months: X.m.months, streams: X.m.streams.map(z => ({s: {id: z.s.id, name: z.s.name, mode: z.s.mode}, inc: z.inc}))}})));
      if(await put('lhq_board', 'b' + ym, r)) toast('Approved · archived on the Board page'); return; }
    if(t.hasAttribute('data-bdpdf')){ document.documentElement.classList.add('pl-printing'); setTimeout(() => { window.print(); document.documentElement.classList.remove('pl-printing'); }, 100); return; }
  });
  document.addEventListener('change', e => { const t = e.target; if(t.dataset && t.dataset.plsv){ const [id, k] = t.dataset.plsv.split('|'), s = streams().find(x => x.id === id), T = TRY[id] = TRY[id] || {}; T[k] = k === 'months' ? t.value : +String(t.value).replace(/[^\d.]/g, '') || 0; if(String(T[k]) === String(s[k])) delete T[k]; rerender(); } });

  const css = `.pl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.pl-tabs a{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:6px 10px;font-weight:800;font-size:12.5px;color:var(--muted);text-decoration:none}.pl-tabs a.on{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}
    .pl-v{text-align:right;font-weight:800;white-space:nowrap}.pl-v small{display:block;font-weight:700;color:var(--muted);font-size:11.5px}.it.pl-tot{background:var(--surface2,var(--bg))}
    .up{color:var(--ok)!important}.warn{color:var(--am)!important}.red{color:var(--rd)!important}
    .pl-split{display:flex;height:14px;border-radius:99px;overflow:hidden;margin:4px 0 6px;background:var(--line)}.pl-split i{display:block;height:100%}.c1{background:var(--accent)}.c2{background:var(--gold,#f4b223)}.c3{background:var(--ok)}.c4{background:var(--muted)}
    .pl-lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--muted);margin:0 0 12px}.pl-lg span{display:inline-flex;align-items:center;gap:5px}.pl-lg i{width:12px;height:8px;border-radius:4px;display:inline-block}
    .pl-src{font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:6px;white-space:nowrap}.pl-src.h{background:var(--ok-bg);color:var(--ok)}.pl-src.y{background:var(--am-bg);color:var(--am)}.pl-src.m{background:var(--surface2,var(--bg));color:var(--muted);border:1px solid var(--line)}
    .pl-step{display:flex;align-items:center;gap:4px}.pl-step button{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--surface);font-weight:900;cursor:pointer;color:var(--ink)}.pl-step input{width:86px;text-align:center;padding:6px;font-weight:800}
    .pl-alert{border-radius:14px;padding:11px 13px;font-size:13.5px;margin:0 0 12px}.pl-alert b{display:block;margin-bottom:2px}.pl-alert.ok{background:var(--ok-bg)}.pl-alert.am{background:var(--am-bg)}.pl-alert.rd{background:var(--rd-bg,#fdecea)}
    .pl-t{width:100%;border-collapse:collapse;margin-top:6px}.pl-t td{padding:5px 2px;border-top:1px solid rgba(0,0,0,.06);font-size:13.5px}.pl-t td:last-child{text-align:right;font-weight:800}
    .pl-t2{width:100%;border-collapse:collapse;font-size:13.5px}.pl-t2 td,.pl-t2 th{padding:6px 4px;border-top:1px solid var(--line);text-align:left}.pl-t2 th{font-size:11.5px;color:var(--muted);border-top:0}.pl-t2 td+td{text-align:right;font-weight:700}.pl-t2 .in{padding:5px 8px}
    .pl-path{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;align-items:end;height:130px;margin:8px 0 4px}.pl-path div{display:flex;align-items:flex-end;justify-content:center;gap:3px;height:100%}.pl-path i{width:34%;border-radius:5px 5px 0 0;background:var(--accent);display:block}.pl-path i.t{background:transparent;border:2px dashed var(--gold,#f4b223);border-bottom:0}
    .pl-pl{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;font-size:11px;font-weight:800;color:var(--muted);text-align:center;margin-bottom:6px}
    .pl-yr{display:block;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:var(--ink)}.pl-yr .row{display:flex;justify-content:space-between;align-items:center}
    .pl-mini{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:8px}.pl-mini div{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:6px 8px;min-width:0}.pl-mini span{display:block;font-size:10.5px;color:var(--muted);font-weight:700}.pl-mini b{font-size:13.5px}.pl-mini small{display:block;font-size:11px;color:var(--muted)}
    @media(max-width:520px){.pl-mini{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .pl-big{font-size:20px!important;font-weight:800}.pl-lock{width:30px;height:30px;border-radius:9px;border:1px solid var(--line);background:var(--surface);display:grid;place-items:center;font-size:14px;flex:none;cursor:pointer}.pl-lock.on{background:var(--accent);border-color:var(--accent)}
    .pl-ed{border:1px solid var(--line);background:var(--surface);border-radius:8px;width:28px;height:28px;cursor:pointer;margin-right:4px;color:var(--ink)}
    .pl-nav{display:flex;align-items:center;justify-content:space-between;margin:4px 0 10px}.pl-nav b{font-size:16px}
    .pl-sum{display:flex;gap:6px;margin-bottom:12px}.pl-sum span{flex:1;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:7px 9px;font-size:11.5px;color:var(--muted);font-weight:700}.pl-sum b{display:block;font-size:17px;color:var(--ink)}
    .pl-pi{display:block;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:11px 13px;margin-bottom:10px;text-decoration:none;color:var(--ink)}.pl-pi .r1{display:flex;align-items:center;gap:9px}.pl-pi .ic{width:32px;height:32px;border-radius:10px;background:var(--bg);border:1px solid var(--line);display:grid;place-items:center;font-size:15px;flex:none}.pl-pi .t{flex:1;min-width:0}.pl-pi .t b{display:block}.pl-pi .t small{display:block;color:var(--muted);font-size:12px}
    .pl-av{width:26px;height:26px;border-radius:50%;background:var(--accent);color:var(--onaccent);display:grid;place-items:center;font-size:10.5px;font-weight:800;flex:none}
    .pl-trk{position:relative;height:8px;border-radius:99px;background:var(--line);margin:10px 0 6px}.pl-trk i{position:absolute;top:0;bottom:0;border-radius:99px;background:var(--accent)}.pl-trk i.ok{background:var(--ok)}.pl-trk i.am{background:var(--gold,#f4b223)}.pl-trk i.pl{background:transparent;border:1.5px dashed var(--muted)}.pl-trk em{position:absolute;top:-4px;width:2px;height:16px;border-radius:2px;background:var(--gold,#f4b223)}
    .pl-pi .r3{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);font-weight:700}
    .pl-tz{position:relative}.pl-mh{margin-bottom:6px}.pl-mh.w{display:grid;grid-template-columns:var(--lw,160px) 1fr}.pl-cols{display:grid}.pl-cols span{text-align:center;font-size:12px;font-weight:800;color:var(--muted)}.pl-cols span.now{color:var(--ink)}.pl-cols .s{display:none}
    .pl-body{position:relative;padding-bottom:22px}.pl-tod{position:absolute;top:0;bottom:0;left:calc(var(--x) * 100%);width:2px;background:var(--gold,#f4b223);z-index:1}.pl-tod.w{left:calc(var(--lw,160px) + (100% - var(--lw,160px)) * var(--x))}.pl-tod b{position:absolute;bottom:-20px;left:-18px;font-size:10px;font-weight:800;color:var(--am);background:var(--am-bg);padding:1px 6px;border-radius:6px}
    .pl-ag{font-size:12px;font-weight:800;color:var(--muted);margin:12px 0 6px}.pl-br{margin-bottom:6px;position:relative;z-index:2}.pl-br.w{display:grid;grid-template-columns:var(--lw,160px) 1fr;align-items:center}.pl-ln{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px}
    .pl-lane{position:relative;height:32px}.pl-bt{position:absolute;top:0;height:30px;display:flex;align-items:center;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:0 8px;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);text-decoration:none}
    .pl-bt.ok{background:var(--ok-bg);border-color:transparent;border-left-color:var(--ok)}.pl-bt.am{background:var(--am-bg);border-color:transparent;border-left-color:var(--gold,#f4b223)}.pl-bt.pl{border-style:dashed}
    @media(max-width:600px){.pl-tz.w{--lw:92px}.pl-mh.w .pl-cols .l{display:none}.pl-mh.w .pl-cols .s{display:inline}.pl-tz.w .pl-ln{font-size:11px}.pl-tz.w .pl-bt{font-size:11px;padding:0 4px}.pl-tod.w b{display:none}}
    .pl-desc{font-size:14px;line-height:1.5;margin:0 0 12px}
    .pl-undo{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--ink);color:var(--bg);border-radius:12px;padding:8px 10px 8px 14px;display:flex;gap:12px;align-items:center;z-index:99;font-weight:700;font-size:14px}
    .pl-bs{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px}.pl-bsh{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}.pl-pri{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.pl-pri .in{flex:1;min-width:160px}
    .dot{display:inline-block;width:10px;height:10px;border-radius:50%}.dot.g{background:#16a34a}.dot.a{background:#f4b223}.dot.r{background:#dc2626}
    @media print{html.pl-printing body *{visibility:hidden}html.pl-printing #main,html.pl-printing #main *{visibility:visible}html.pl-printing #main{position:absolute;left:0;top:0;width:100%}html.pl-printing .no-print,html.pl-printing .acts,html.pl-printing .crumb,html.pl-printing #cmStrip{display:none!important}html.pl-printing .pl-bs{break-inside:avoid}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  window.PLAN = {page, boardPage, load, boardDue, model, actuals, partners: () => partners(), schools: () => schoolRecs(), kids: () => kids(), data: () => D};
})();
