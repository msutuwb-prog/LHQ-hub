/* LHQ Hub › the tutor's account. Home (cards you choose, what was logged today, what is still to log), logging through
   the day (a session, SRA marks, weekly assessment marks), the SRA tracker, the one-page daily report, students with
   sessions had and remaining, and official classes. A tutor sees only the students on their tuition cards (the server
   sends only those). Saves go straight to LHQ; without a connection they wait on the phone and go later.
   Rendered by index.html at #teach…; uses SRA (sra.js) and, for topic names, card.js + topics.js (loaded on first use). */
window.TUT = (function(){
  const CK = 'lhq_teach', QK = 'lhq_teach_q';
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const DAYN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'}, DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const WEEKDAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const read = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  let data = read(CK, null), loading = null, libs = null, err = '';

  /* ---------- the look: ticks and circles instead of pills ---------- */
  if(!document.getElementById('tutCss')){ const st = document.createElement('style'); st.id = 'tutCss'; st.textContent = `
.t-opts{display:grid;gap:8px}.t-opts.g2{grid-template-columns:1fr 1fr}.t-opts.g5{grid-template-columns:repeat(5,minmax(0,1fr))}
.t-opt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:11px 12px;min-height:46px;font:inherit;font-weight:600;font-size:14px;color:var(--ink);cursor:pointer}
.t-opt small{display:block;color:var(--muted);font-size:12px;font-weight:600}.t-opt .tx{flex:1;min-width:0}
.t-opt.on{border-color:var(--accent);background:var(--t-sel);font-weight:800}.t-opt.miss{border-color:var(--am)}
.t-opts.g5 .t-opt{justify-content:center;font-size:16px;padding:10px 0}.t-opts.g5 .t-ind{display:none}.t-opts.g5 .tx{flex:none}
.t-ind{flex:none;width:20px;height:20px;border:2px solid var(--line);display:grid;place-items:center;background:var(--surface)}
.t-ind.c{border-radius:50%}.t-ind.s{border-radius:6px}
.on>.t-ind.c{border-color:var(--accent);box-shadow:inset 0 0 0 4px var(--surface);background:var(--accent)}
.on>.t-ind.s{border-color:var(--accent);background:var(--accent)}
.on>.t-ind.s::after{content:"";width:9px;height:5px;border:2.5px solid var(--onaccent);border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}
:root{--t-sel:#eef3fa}:root[data-theme=dark]{--t-sel:rgba(244,178,35,.09)}
.t-grp{font-size:11.5px;font-weight:800;margin:12px 2px 6px;display:flex;align-items:center;gap:6px}.t-grp:first-child{margin-top:0}
.t-att{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,54px);align-items:center;gap:4px 2px}
.t-att .hd{font-size:9.5px;font-weight:800;color:var(--muted);text-align:center;text-transform:uppercase}
.t-att .nm{font-weight:700;font-size:14px;padding:6px 0}
.t-att button{border:0;background:none;display:grid;place-items:center;height:40px;padding:0;cursor:pointer}
.t-dd{border:1px solid var(--line);border-radius:12px;background:var(--surface)}
.t-dd>button{width:100%;display:flex;justify-content:space-between;align-items:center;border:0;background:none;padding:11px 12px;min-height:46px;font:inherit;font-weight:700;text-align:left;color:var(--ink);cursor:pointer}
.t-dd>button i{font-style:normal;color:var(--muted)}
.t-ddp{border-top:1px solid var(--line);padding:10px;display:grid;gap:6px;max-height:320px;overflow:auto}
.t-ddp .lbl{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:4px 2px 0}
.t-pk{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px}
.t-pk .row{display:flex;align-items:center;gap:8px;font-weight:800}.t-pk .row span{flex:1}
.t-x{border:0;background:none;color:var(--muted);font-size:20px;line-height:1;padding:2px 6px;cursor:pointer}
.t-tl .tm{width:44px;flex:none;font-weight:800;font-size:13px;color:var(--muted)}
.t-ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none;font-weight:800}
.t-score{display:grid;grid-template-columns:1fr auto 1fr 56px;gap:8px;align-items:center}.t-score span{color:var(--muted)}.t-score b{color:var(--brand);font-size:17px;text-align:right}
.t-marks{display:grid;grid-template-columns:1fr 78px 56px;gap:8px;align-items:center}.t-marks .nm{font-weight:700}.t-marks b{text-align:right;color:var(--brand)}
.t-req{border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.t-banner{display:flex;gap:12px;align-items:center;background:var(--am-bg);color:var(--am);border-radius:14px;padding:12px 14px;margin-bottom:14px;font-weight:700;font-size:13.5px;text-decoration:none}
.t-banner b{display:block;color:var(--ink)}.t-banner.ok{background:var(--ok-bg);color:var(--ok)}
.t-warn{background:var(--am-bg);color:var(--am);border-radius:12px;padding:12px;font-weight:700;font-size:13.5px;margin:0 0 12px}
.t-warn .acts{margin-top:10px}
.t-segw{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--surface);margin:0 0 14px}
.t-segw a{text-align:center;text-decoration:none;font-weight:700;padding:9px 0;color:var(--muted)}.t-segw a.on{background:var(--accent);color:var(--onaccent)}
.t-chips6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin-top:8px}
.t-chips6 button{border:0;padding:5px 2px;text-align:center;line-height:1.25;font:inherit;font-size:10.5px;font-weight:800;border-radius:6px;cursor:pointer}
.t-chips6 button span{display:block;font-size:10px;opacity:.8}
.t-ses{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin:4px 0 10px}
.t-ses div{background:var(--bg);border-radius:12px;padding:10px 4px}.t-ses b{display:block;font-size:20px;color:var(--brand)}.t-ses small{color:var(--muted);font-size:11.5px;font-weight:700}
.t-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13.5px}.t-kv span{color:var(--muted)}.t-kv b{font-weight:700;text-align:right}
.t-pbar{display:block;height:6px;border-radius:99px;background:var(--gr-bg);overflow:hidden;margin:6px 0 3px;position:relative}.t-pbar i{display:block;height:100%;background:var(--gold)}
.t-pbar b{position:absolute;top:0;bottom:0;width:2px;background:var(--ink);opacity:.55}
.t-sgrid{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(6,minmax(0,1fr));gap:4px;font-size:12px;align-items:center}
.t-sgrid .h{font-size:10px;font-weight:800;color:var(--muted);text-align:center}.t-sgrid .t{font-weight:700;font-size:12.5px}
.t-sgrid .c{text-align:center;border-radius:6px;padding:4px 0;font-weight:800}
.t-sec{margin-bottom:14px}.t-sec.ed{border:1.5px dashed var(--line);border-radius:18px;padding:8px}
.t-secctl{display:flex;gap:4px;margin:0 0 8px;align-items:center}.t-secctl b{flex:1;font-size:12.5px;color:var(--muted);padding-left:6px}
.t-secctl button,.mc .ctl button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--surface);padding:0;display:grid;place-items:center;color:var(--ink);font-weight:800;font-size:15px;cursor:pointer}
.t-secctl button.rm{color:var(--rd)}.t-secctl button:disabled{opacity:.3}
.hn-bar a{position:relative}.t-dot{position:absolute;top:7px;left:calc(50% + 7px);width:9px;height:9px;border-radius:50%;background:var(--gold);border:2px solid var(--surface)}.t-dot.ok{background:var(--ok)}
.hn-side .t-dot{left:auto;right:10px;top:50%;transform:translateY(-50%)}
`; document.head.appendChild(st); }

  /* ---------- data ---------- */
  function ensureLibs(){
    if(window.cardTopicNames) return Promise.resolve();
    if(libs) return libs;
    const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return libs = load('topics.js').then(() => load('card.js')).catch(() => {});
  }
  async function fetchData(){
    if(loading) return loading;
    loading = (async () => {
      await flush();
      try{ const j = await hub.api('tutor'); data = {cards: j.cards || [], entries: j.entries || [], classes: j.classes || [], reports: j.reports || [], at: Date.now()}; write(CK, data); err = ''; }
      catch(e){ err = navigator.onLine ? e.message : 'offline'; }
      loading = null; if(!form) render();
    })();
    return loading;
  }
  async function flush(){
    const q = read(QK, []); if(!q.length) return;
    try{
      const ent = q.filter(x => x.t === 'e').flatMap(x => x.entries);
      if(ent.length) await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'entries', entries: ent})});
      for(const c of q.filter(x => x.t === 'c')) await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls: c.cls})});
      for(const r of q.filter(x => x.t === 'r')) await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'report', report: r.report})});
      write(QK, []);
    }catch(e){}
  }
  addEventListener('online', () => { if(read(QK, []).length) fetchData(); });
  const offline = e => !navigator.onLine || /fetch|network/i.test(e.message);
  async function saveEntries(list, quiet){
    const now = Date.now();
    list = list.map(e => Object.assign({c: now}, e));
    data.entries = data.entries.filter(e => !list.some(x => x.id === e.id)).concat(list.map(e => Object.assign({}, e, {tutor: me().name, at: now})));
    write(CK, data); render();
    try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'entries', entries: list})}); return true; }
    catch(e){ if(!offline(e)){ toast(e.message); return false; }
      const q = read(QK, []); q.push({t:'e', entries: list}); write(QK, q); if(!quiet) toast('Saved on this device. It goes to LHQ when you are back online.'); return true; }
  }

  /* roster: one item per student + subject, from the newest tuition card */
  function items(){
    if(!data) return [];
    const by = new Map();
    data.cards.slice().sort((a, b) => (a.periodStart || a.date || '').localeCompare(b.periodStart || b.date || '')).forEach(c => (c.subjects || []).forEach(x => {
      const k = nk(c.student) + '|' + nk(x.name), was = by.get(k);
      let topics = []; try{ if(window.cardTopicNames) topics = cardTopicNames(cardFixPicks(JSON.parse(JSON.stringify(x)))); }catch(e){}
      by.set(k, {k, st: c.student, sub: x.name, lv: c.level, days: x.days || [], times: x.times || {}, start: x.start || '', end: x.end || '', where: c.where || '',
        a: was ? was.a : (c.periodStart || ''), b: c.periodEnd || '', pa: c.periodStart || '', cap: parseFloat(x.sessions) || 0, card: c, x, topics: topics.length ? topics : (was ? was.topics : [])});
    }));
    return [...by.values()].sort((a, b) => a.st.localeCompare(b.st) || a.sub.localeCompare(b.sub));
  }
  const live = () => (data ? data.entries : []).filter(e => !e.x);
  const tStart = (it, d) => { const o = (it.times || {})[d]; return (o && o.s) || it.start || ''; };
  const tEnd = (it, d) => { const o = (it.times || {})[d]; return (o && o.s) ? (o.e || '') : it.end || ''; };
  const timeOf = (it, d) => { const s = tStart(it, d), e = tEnd(it, d); return s ? `${s}–${e}` : 'time TBC'; };
  const sras = () => SRA.build(items(), live(), today());
  const stuOf = k => k.split('|')[0];
  const itemOf = k => items().find(i => i.k === k);
  const short = n => { const p = String(n || '').split(' '); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); };
  const hm = ms => { const d = new Date(ms || 0); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const isoOfMs = ms => HD.isoOf(new Date(ms || 0));
  const mins = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
  const hoursOf = e => e.t1 && e.t2 && mins(e.t2) > mins(e.t1) ? (mins(e.t2) - mins(e.t1)) / 60 : 1;
  const pct = (sc, mx) => { const s = parseFloat(sc), m = parseFloat(mx); return s >= 0 && m > 0 && s <= m ? Math.round(s / m * 100) + '%' : ''; };
  const taught = a => a !== 'absent' && a !== 'cancelled';
  const weekEnd = t => addDays(t, (7 - HD.parseISO(t).getDay()) % 7);
  const weekStart = t => addDays(t, -((HD.parseISO(t).getDay() + 6) % 7));
  const isDay = (it, d) => SRA.isDay(it, d);
  const ref = x => [x.k, x.topic, x.stage].map(v => encodeURIComponent(v)).join('/');
  const unref = v => { const [k, topic, st] = String(v).split('/').map(decodeURIComponent); return sras().find(x => x.k === k && x.topic === topic && x.stage === +st); };
  const tutorRole = () => me().role === 'tutor';
  const todayRep = () => (data.reports || []).find(r => r.d === today());
  const ATT = [['attended','On time'],['late','Late'],['absent','Absent'],['cancelled','Cancelled']];
  const FMT = [['1i','1-to-1 in person'],['1o','1-to-1 online'],['gi','Group in person'],['go','Group online']];
  const FMTL = Object.fromEntries(FMT), ATTL = Object.fromEntries(ATT);

  /* sessions per student this tuition period */
  function sessions(it){
    const t = today(), a = it.pa || it.a, b = it.b;
    const count = until => { if(!a || !(it.days || []).length) return 0; const end = b && b < until ? b : until; if(end < a) return 0;
      let n = 0; for(let d = a; d <= end; d = addDays(d, 1)) if(it.days.includes(DAYC[HD.parseISO(d).getDay()])) n++; return it.cap ? Math.min(it.cap, n) : n; };
    const planned = count(b || addDays(t, 365)), expected = count(t);
    const E = live().filter(e => e.ty === 's' && e.k === it.k && (!a || e.d >= a) && (!b || e.d <= b));
    const had = E.filter(e => taught(e.a)).length, made = E.filter(e => e.mk && taught(e.a)).length;
    const absent = E.filter(e => !e.mk && e.a === 'absent').length, cancelled = E.filter(e => !e.mk && e.a === 'cancelled').length;
    const used = had - made + absent + cancelled;
    return {planned, expected, had, made, absent, cancelled, owed: Math.max(0, absent + cancelled - made), remaining: Math.max(0, planned - used), behind: Math.max(0, expected - used)};
  }

  /* ---------- what was logged today, and what is still to log ---------- */
  function dayLogs(d){
    const E = live(), out = [], seen = new Set();
    E.filter(e => e.ty === 's' && e.d === d).forEach(e => { const g = e.grp || e.id; if(seen.has(g)) return; seen.add(g);
      const G = E.filter(x => x.ty === 's' && (x.grp || x.id) === g), c = Math.min(...G.map(x => x.c || x.at || 0)), at = Math.max(...G.map(x => x.at || 0));
      const cls = e.cls && (data.classes || []).find(x => x.id === e.cls);
      out.push({kind:'s', id:g, c, at, ic:'S', col:'bl', b:`${cls ? cls.name : G.map(x => short(x.st)).join(', ')} · ${e.sub}`, s:[e.t1 ? `${e.t1}–${e.t2 || ''}` : '', FMTL[e.fmt] || '', G.some(x => !taught(x.a)) ? G.map(x => taught(x.a) ? '' : short(x.st) + ' ' + ATTL[x.a].toLowerCase()).filter(Boolean).join(', ') : '', (e.tp || []).map(t => t + ((e.fin || []).includes(t) ? ' (finished)' : '')).join(', ')].filter(Boolean).join(' · ')}); });
    E.filter(e => e.ty === 'r' && e.v === 2 && e.d === d).forEach(e => out.push({kind:'r', id:e.id, c:e.c || e.at, at:e.at, ic:'R', col:'ok', b:`${short(e.st)} · SRA ${e.h === 'm' ? 'not handed in' : 'marks ' + (e.sc != null && e.sc !== '' ? e.sc + '/' + e.mx : '')}`, s:`${e.tk} · ${SRA.label(e.rv)}${e.man ? ' · not in the tracker' : ''}`}));
    const W = E.filter(e => e.ty === 'w' && (e.md === d || (e.d === d && !e.grp))); const ws = new Set();
    W.forEach(e => { const g = e.wid || e.id; if(ws.has(g)) return; ws.add(g); const G = W.filter(x => (x.wid || x.id) === g), done = G.some(x => x.sc != null && x.sc !== '' || x.abs);
      if(!done) return; out.push({kind:'w', id:g, c:Math.min(...G.map(x => x.mc || x.c || x.at || 0)), at:Math.max(...G.map(x => x.at || 0)), ic:'A', col:'am', b:`${G.length > 1 ? G.map(x => short(x.st)).join(', ') : short(e.st)} · weekly assessment marks`, s:`${(e.tp || []).join(', ') || e.sub} · out of ${e.mx || '?'}`}); });
    const gs = E.filter(e => e.ty === 'g' && e.d === d && !e.grp);
    if(gs.length) out.push({kind:'g', id:'g', c:Math.min(...gs.map(x => x.c || x.at || 0)), at:0, ic:'G', col:'gr', b:`SRAs handed out · ${gs.length}`, s:gs.map(x => short(x.st) + ' ' + x.tk + ' ' + (x.rv ? 'R' + x.rv : 'LD')).join(', ')});
    const rep = d === today() ? todayRep() : null;
    out.forEach(x => { if(rep && x.at > rep.sent && x.c < rep.sent) x.s += ' · edited ' + hm(x.at); });
    return out.sort((a, b) => a.c - b.c);
  }
  function gaps(){
    const t = today(), dow = DAYC[HD.parseISO(t).getDay()], I = items(), E = live(), g = [];
    const logged = it => E.some(e => e.ty === 's' && e.k === it.k && e.d === t);
    const due = I.filter(it => isDay(it, t) && !logged(it)), inCls = new Set();
    (data.classes || []).forEach(c => { const M = due.filter(it => c.stu.includes(stuOf(it.k)) && nk(it.sub) === nk(c.sub)); if(M.length >= 2){ M.forEach(m => inCls.add(m.k)); g.push({href:'#teach/log/' + encodeURIComponent('class:' + c.id), b:`${tStart(M[0], dow) || ''} ${c.name} · session not logged`.trim(), s:c.sub}); } });
    due.filter(it => !inCls.has(it.k)).forEach(it => g.push({href:'#teach/log/' + encodeURIComponent(it.k), b:`${tStart(it, dow) || ''} ${short(it.st)} · session not logged`.trim(), s:it.sub}));
    SRA.today(sras(), t).collect.forEach(x => g.push({href:'#teach/marks/' + ref(x), b:`${short(x.st)} · ${x.topic} ${x.label}`, s: x.status === 'late' ? 'Late · marks not entered' : 'SRA due back today · marks not entered'}));
    pendingWa().filter(w => w.d < t).forEach(w => g.push({href:'#teach/wa/' + encodeURIComponent(w.id), b:`${w.name} · weekly assessment`, s:`Given ${nice(w.d)} · marks not entered`}));
    return g;
  }
  /* weekly assessments given and waiting for marks, one per class sitting or student */
  function pendingWa(){
    const W = live().filter(e => e.ty === 'w'), by = new Map();
    W.forEach(e => { const g = e.wid || e.id; if(!by.has(g)) by.set(g, []); by.get(g).push(e); });
    return [...by.entries()].filter(([g, G]) => G.every(x => (x.sc == null || x.sc === '') && !x.abs)).map(([g, G]) => { const cls = G[0].cls && (data.classes || []).find(c => c.id === G[0].cls);
      return {id:g, G, d:G[0].d, sub:G[0].sub, tp:G[0].tp || [], mx:G[0].mx || '', name: cls ? cls.name : G.length > 1 ? G.map(x => short(x.st)).join(', ') : short(G[0].st)}; }).sort((a, b) => a.d.localeCompare(b.d));
  }

  /* ---------- small pieces ---------- */
  const head = (t, s, acts = '') => `<div class="ph"><div class="tt"><h1>${t}</h1>${s ? `<p>${s}</p>` : ''}</div>${acts}</div>`;
  const back = (h, l) => `<a class="crumb" href="${h}">${ic('back',16,2.2)} ${l}</a>`;
  const homeName = () => tutorRole() ? 'Home' : 'Teaching';
  const backHome = () => back('#teach', homeName());
  const one = (path, opts, cur, cls = '') => `<div class="t-opts ${cls}" role="radiogroup">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(v) === String(cur)}" class="t-opt${String(v) === String(cur) ? ' on' : ''}" data-tset="${path}" data-v="${esc(v)}"><span class="t-ind c"></span><span class="tx">${l}</span></button>`).join('')}</div>`;
  const tick = (key, on, label, sub = '', cls = '') => `<button type="button" role="checkbox" aria-checked="${!!on}" class="t-opt${on ? ' on' : ''} ${cls}" data-ttog="${esc(key)}"><span class="t-ind s"></span><span class="tx">${label}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
  const logBtn = (k = '') => `<button class="btn n" type="button" data-tlog="${esc(k)}">${ic('plus',16,2.4)} Log</button>`;
  const PEN = () => ic('edit', 16);

  /* ---------- pages ---------- */
  let form = null, editing = null, wform = null, mform = null, rform = null;
  function page(sub, a1, a2, a3){
    if(!data){ fetchData(); return head(homeName(), 'Getting your students…') + (err ? `<p class="empty">${err === 'offline' ? 'No connection. Your students appear once you are online.' : esc(err)}</p>` : ''); }
    data.reports = data.reports || [];
    if(!window.cardTopicNames) ensureLibs().then(() => { if(!form) render(); });
    if(Date.now() - (data.at || 0) > 60000 && !form) fetchData();
    if(sub !== 'log') form = null; if(sub !== 'wa') wform = null; if(sub !== 'marks') mform = null; if(sub !== 'report') rform = null;
    if(!['', undefined, 'student'].includes(sub)) editing = null;
    if(sub === 'students') return students();
    if(sub === 'student') return studentPage(decodeURIComponent(a1 || ''));
    if(sub === 'log') return logPage(decodeURIComponent(a1 || ''), a2);
    if(sub === 'marks') return marksPage(!a1 ? '' : a1.startsWith('edit:') ? a1 : a2 ? [a1, a2, a3].map(encodeURIComponent).join('/') : 'stu:' + a1);
    if(sub === 'wa') return waPage(decodeURIComponent(a1 || ''));
    if(sub === 'sra') return sraPage(a1 || 'today');
    if(sub === 'report') return reportPage();
    if(sub === 'classes') return classesPage();
    if(sub === 'class') return classPage(a1);
    return home();
  }

  /* Home: cards you choose, what was logged today, what is still to log */
  const CARDS = {
    week:{t:'This week', d:'Sessions logged against the timetable', f:() => { const t = today(), ws = weekStart(t), I = items(); let p = 0, d = 0, m = 0;
      for(let i = 0; i < 7; i++){ const day = addDays(ws, i); I.forEach(it => { if(!isDay(it, day)) return; p++; const e = live().find(x => x.ty === 's' && x.k === it.k && x.d === day); if(e){ if(taught(e.a)) d++; else m++; } }); }
      const left = Math.max(0, p - d - m); return {href:'#teach/students', v:`${d} <small>of ${p} sessions</small>`, bar: p ? Math.round(d / p * 100) : 0, s:`${m ? m + ' missed · ' : ''}${left} to come`, warn: m}; }},
    mk:{t:'Make-ups', d:'Owed for absences and cancellations', f:() => { const o = items().reduce((a, it) => a + sessions(it).owed, 0); return {href:'#teach/students', v:`${o} <small>owed</small>`, s: o ? 'Booking comes with the calendar' : 'None owed', warn: o}; }},
    sra:{t:'SRAs today', d:'To give and to collect today', f:() => { const T = SRA.today(sras(), today()); return {href:'#teach/sra', v:`${T.give.length} <small>to give</small>`, s:`${T.collect.length} to collect`}; }},
    collect:{t:'SRAs to collect', d:'Due back, marks still to enter', f:() => { const n = SRA.today(sras(), today()).collect.length; return {href:'#teach/sra', v:`${n} <small>due back</small>`, s:'marks still to enter', warn: n}; }},
    wam:{t:'Assessments to mark', d:'Weekly assessments given, marks not entered', f:() => { const P = pendingWa(); return {href:'#teach/wa', v:`${P.length} <small>waiting</small>`, s: P.length ? 'oldest given ' + nice(P[0].d) : 'all marked', warn: P.some(w => w.d < today())}; }},
    hours:{t:'Hours this month', d:'From the sessions you logged', f:() => { const m = today().slice(0, 7), seen = new Set(); let h = 0;
      live().filter(e => e.ty === 's' && taught(e.a) && (e.d || '').startsWith(m)).forEach(e => { const g = e.grp || e.id; if(seen.has(g)) return; seen.add(g); h += hoursOf(e); });
      return {href:'#teach/report', v:`${Math.round(h * 10) / 10} <small>h taught</small>`, s:'from logged sessions'}; }},
    reps:{t:'Daily reports', d:'Reports sent this month', f:() => { const m = today().slice(0, 7), sent = (data.reports || []).filter(r => r.d.startsWith(m)).length;
      const days = new Set(live().filter(e => e.ty === 's' && (e.d || '').startsWith(m)).map(e => e.d)); days.add(today()); return {href:'#teach/report', v:`${sent} <small>of ${days.size} days</small>`, s:'sent this month', warn: sent < days.size - (todayRep() ? 0 : 1)}; }},
    next:{t:'Next session', d:'Your next session today that isn\'t logged', f:() => { const t = today(), dow = DAYC[HD.parseISO(t).getDay()]; const L = items().filter(it => isDay(it, t) && !live().some(e => e.ty === 's' && e.k === it.k && e.d === t)).sort((a, b) => tStart(a, dow).localeCompare(tStart(b, dow)));
      return L.length ? {href:'#teach/log/' + encodeURIComponent(L[0].k), v:`${tStart(L[0], dow) || 'TBC'} <small>${esc(short(L[0].st))}</small>`, s:esc(L[0].sub)} : {href:'#teach/sra', v:'– <small>none left today</small>', s:'see the SRA tracker'}; }}
  };
  const cardLib = () => Object.keys(CARDS).concat(items().map(it => 'st:' + it.k));
  function cardOf(k){
    if(k.startsWith('st:')){ const it = itemOf(k.slice(3)); if(!it) return null; const S = sessions(it);
      return {t:`${it.st} · ${it.sub}`, d:'Sessions had and remaining for this student', r:{href:'#teach/student/' + encodeURIComponent(it.k), v:`${S.had} <small>of ${S.planned || '?'} had</small>`, bar: S.planned ? Math.round(S.had / S.planned * 100) : 0, mark: S.planned ? Math.round(S.expected / S.planned * 100) : null, s:`${S.remaining} left${S.owed ? ' · ' + S.owed + ' make-up' + (S.owed > 1 ? 's' : '') + ' owed' : ''}`, warn: S.behind}}; }
    const c = CARDS[k]; if(!c) return null; return {t:c.t, d:c.d, r:c.f()};
  }
  const myCards = page => { const c = (me().cards || {})[page]; return Array.isArray(c) ? c : null; };
  async function saveCards(page, list){
    const s = hub.session(); if(s && s.me){ s.me.cards = Object.assign({}, s.me.cards || {}, {[page]: list}); localStorage.setItem('lhq_session', JSON.stringify(s)); }
    render();
    try{ await hub.api('people', {method:'POST', body: JSON.stringify({action:'cards', page, cards: list})}); }catch(e){ toast('Couldn\'t save your cards online. They look like this on this device.'); }
  }
  const homeCards = () => (myCards('teach') || ['week','mk','sra','wam']).filter(k => cardOf(k));
  function cardsBlock(){
    const on = homeCards(), ed = editing === 'teach';
    const mc = (k, i) => { const c = cardOf(k), r = c.r, body = `<span class="l">${esc(c.t)}</span><div class="v">${r.v}</div>${r.bar != null ? `<span class="t-pbar"><i style="width:${r.bar}%"></i>${r.mark != null ? `<b style="left:${r.mark}%"></b>` : ''}</span>` : ''}<div class="s${r.warn ? ' warn' : ''}">${r.s}</div>`;
      return ed ? `<div class="mc ed"><div class="ctl"><button type="button" data-tcmv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Move earlier">‹</button><button type="button" data-tcmv="${i}|1" ${i < on.length - 1 ? '' : 'disabled'} aria-label="Move later">›</button><button type="button" class="rm" data-tcrm="${esc(k)}" aria-label="Remove ${esc(c.t)}">×</button></div>${body}</div>`
        : `<a class="mc" href="${r.href}">${body}</a>`; };
    const off = cardLib().filter(k => !on.includes(k));
    return `<div class="mcs" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${on.map(mc).join('')}</div>` + (ed ? `<div class="h2">Add a card <em>${off.length}</em></div><div class="card">${off.map(k => { const c = cardOf(k); return `<div class="it"><span class="t"><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span><button class="btn sm" type="button" data-tcadd="${esc(k)}">${ic('plus',14,2.4)} Add</button></div>`; }).join('') || '<p class="empty">Every card is on your Home.</p>'}</div>` : '');
  }
  const timeline = (L, tap = true) => L.length ? `<div class="card t-tl">${L.map(x => { const inner = `<span class="tm">${x.c && isoOfMs(x.c) === (x.d || today()) ? hm(x.c) : '–'}</span><span class="t-ico ${x.col}" aria-hidden="true">${x.ic}</span><span class="t"><b>${esc(x.b)}</b><small>${esc(x.s)}</small></span>`;
    const href = x.kind === 's' ? '#teach/log/' + encodeURIComponent('edit:' + x.id) : x.kind === 'r' ? '#teach/marks/' + encodeURIComponent('edit:' + x.id) : x.kind === 'w' ? '#teach/wa/' + encodeURIComponent('edit:' + x.id) : '#teach/sra';
    return tap ? `<a class="it" href="${href}">${inner}<span class="chev">${ic('chev',16,2)}</span></a>` : `<div class="it">${inner}</div>`; }).join('')}</div>` : '<div class="card pad"><p class="empty" style="margin:0">Nothing logged yet today.</p></div>';
  const gapCard = G => G.length ? `<div class="card">${G.map(x => `<a class="it" href="${x.href}"><span class="t"><b>${esc(x.b)}</b><small>${esc(x.s)}</small></span><span class="tag am">Log</span></a>`).join('')}</div>` : '';
  function home(){
    const t = today(), rep = todayRep(), G = gaps(), L = dayLogs(t), ed = editing === 'teach', q = read(QK, []).length;
    const acts = ed ? `<div class="acts"><button class="btn n" type="button" data-tedit="">Done</button></div>` : `<div class="acts"><button class="btn" type="button" data-tedit="teach" title="Edit cards" aria-label="Edit cards">${PEN()}</button>${logBtn()}</div>`;
    return head(homeName(), `${WEEKDAY[HD.parseISO(t).getDay()]} ${nice(t)}${q ? ` · ${q} save${q === 1 ? '' : 's'} waiting to send` : ''}`, acts) +
      (ed ? '<p class="note" style="margin:-6px 0 12px">Move or remove cards, or add one from the list below. Tap Done when finished.</p>'
        : rep ? `<a class="t-banner ok" href="#teach/report"><span><b>Today's report is in</b>Sent at ${hm(rep.sent)}. You can still log; changes show as edited.</span></a>`
        : `<a class="t-banner" href="#teach/report"><span><b>Daily report due before you leave</b>Reminder between 4 and 5 pm${G.length ? ` · ${G.length} thing${G.length > 1 ? 's' : ''} still to log` : ''}</span></a>`) +
      cardsBlock() + (ed ? '' : `
      <div class="h2">Logged today <em>${L.length}</em></div>${timeline(L)}
      ${G.length ? `<div class="h2">Still to log <em>${G.length}</em></div>${gapCard(G)}` : ''}
      <div class="card">${[['#teach/students','users','My students','Sessions had and remaining, make-ups'],['#teach/sra','restore','SRA tracker','Give, collect and print · next 7 days · by student'],['#teach/classes','users','Classes',`${(data.classes || []).length} official class${(data.classes || []).length === 1 ? '' : 'es'}`]].concat(tutorRole() ? [] : [['#teach/report','list','Daily report', rep ? 'Sent today' : 'Due before you leave']]).map(([h, i, b, s]) => `<a class="it" href="${h}"><span class="ico">${ic(i,18)}</span><span class="t"><b>${b}</b><small>${s}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('')}</div>`);
  }

  /* students and a student's page */
  const bar = S => `<span class="t-pbar"><i style="width:${S.planned ? Math.round(S.had / S.planned * 100) : 0}%"></i>${S.planned ? `<b style="left:${Math.round(S.expected / S.planned * 100)}%" title="Where they should be by today"></b>` : ''}</span>`;
  function students(){
    const I = items();
    return backHome() + head('My students', `${new Set(I.map(i => stuOf(i.k))).size} student${new Set(I.map(i => stuOf(i.k))).size === 1 ? '' : 's'} on your tuition cards`, `<div class="acts">${logBtn()}</div>`) +
      (I.length ? `<div class="card">${I.map(it => { const S = sessions(it); return `<a class="it" href="#teach/student/${encodeURIComponent(it.k)}" style="align-items:flex-start"><span class="t"><b>${esc(it.st)}</b><small>${esc(it.sub)} · ${S.had} of ${S.planned || '?'} had · ${S.remaining} left${S.owed ? ` · ${S.owed} make-up${S.owed > 1 ? 's' : ''} owed` : ''}</small>${bar(S)}</span>${S.behind ? `<span class="tag am">${S.behind} behind</span>` : '<span class="tag ok">On track</span>'}</a>`; }).join('')}</div><p class="note">The dark mark on each bar is where the student should be by today.</p>`
        : '<p class="empty">No students yet. They appear when LHQ puts you on a tuition card.</p>');
  }
  const SECS = {ses:'Sessions and make-ups', sra:'SRA scores by review', wa:'Weekly assessments', logs:'Recent logs', topics:'Topics finished', time:'Timetable'};
  function studentPage(k){
    const it = itemOf(k); if(!it) return backHome() + '<p class="empty">That student isn\'t on your tuition cards.</p>';
    const S = sessions(it), ed = editing === 'tstudent', on = (myCards('tstudent') || ['ses','sra','wa','time']).filter(x => SECS[x]);
    const L = sras().filter(x => x.k === k), byT = new Map(); L.forEach(x => { if(!byT.has(x.topic)) byT.set(x.topic, []); byT.get(x.topic).push(x); });
    const cell = x => { const p = x && x.score ? Math.round(x.score.sc / x.score.mx * 100) : null; return p == null ? '<span class="c" style="color:var(--muted)">·</span>' : `<span class="c ${p >= 75 ? 'ok' : p >= 60 ? 'am' : 'rd'}">${p}</span>`; };
    const W = live().filter(e => e.ty === 'w' && e.k === k && e.sc != null && e.sc !== '' && +e.mx > 0).sort((a, b) => a.d.localeCompare(b.d)).slice(-6);
    const SEC = {
      ses: () => `<div class="card pad" style="margin:0"><div class="cap">Sessions · ${it.pa ? nice(it.pa) : '?'} – ${it.b ? nice(it.b) : '?'}</div>
        <div class="t-ses"><div><b>${S.planned || '?'}</b><small>Planned</small></div><div><b>${S.had}</b><small>Had</small></div><div><b>${S.remaining}</b><small>Remaining</small></div></div>${bar(S)}
        <p class="note" style="margin:4px 0 12px">${S.behind ? `<b style="color:var(--am)">${S.behind} behind</b> where ${esc(it.st.split(' ')[0])} should be by today (${S.expected}).` : 'On track for today.'}</p>
        <div class="t-kv"><span>Missed · student absent</span><b>${S.absent}</b><span>Missed · cancelled</span><b>${S.cancelled}</b><span>Make-ups had</span><b>${S.made}</b><span>Make-ups owed</span><b>${S.owed}</b></div></div>`,
      sra: () => `<div class="card pad" style="margin:0"><div class="cap">SRA scores by review <small style="text-transform:none;letter-spacing:0">· %</small></div>
        ${byT.size ? `<div class="t-sgrid"><span></span>${['LD','R1','R2','R3','R4','R5'].map(h => `<span class="h">${h}</span>`).join('')}${[...byT.entries()].map(([t, X]) => `<span class="t">${esc(t)}</span>${[0,1,2,3,4,5].map(i => cell(X.find(x => x.stage === i))).join('')}`).join('')}</div>
        <p class="note">A score lower than the review before it on the same topic usually means the topic is being forgotten.</p>` : '<p class="empty" style="margin:0">No topics finished yet.</p>'}</div>`,
      wa: () => `<div class="card pad" style="margin:0"><div class="cap">Weekly assessments</div>${W.length ? `<div style="display:flex;align-items:flex-end;gap:8px;height:90px">${W.map((e, i) => { const p = Math.round(e.sc / e.mx * 100); return `<div style="flex:1;text-align:center;font-size:11.5px;font-weight:800;color:var(--muted)" title="${nice(e.d)}"><div style="height:${Math.max(4, p * .7)}px;background:${i === W.length - 1 ? 'var(--gold)' : 'var(--bl-bg)'};border-radius:6px 6px 2px 2px;margin-bottom:4px"></div>${p}%</div>`; }).join('')}</div>` : '<p class="empty" style="margin:0">No marks yet.</p>'}</div>`,
      logs: () => { const E = live().filter(e => e.k === k && ['s','r','w'].includes(e.ty)).sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.at || 0) - (a.at || 0)).slice(0, 8);
        return `<div class="card pad" style="margin:0"><div class="cap">Recent logs</div>${E.map(e => `<div class="it"><span class="t"><b>${nice(e.d)} · ${e.ty === 's' ? 'Session · ' + (ATTL[e.a] || e.a) : e.ty === 'r' ? 'SRA ' + (e.h === 'm' ? 'not handed in' : 'marks ' + (e.sc ?? '') + '/' + (e.mx ?? '')) : 'Weekly assessment' + (e.sc != null && e.sc !== '' ? ' ' + e.sc + '/' + e.mx : ' given')}</b><small>${esc(e.ty === 's' ? (e.tp || []).join(', ') : e.ty === 'r' ? e.tk + ' · ' + SRA.label(e.rv) : (e.tp || []).join(', '))}</small></span></div>`).join('') || '<p class="empty" style="margin:0">Nothing logged yet.</p>'}</div>`; },
      topics: () => `<div class="card pad" style="margin:0"><div class="cap">Topics finished</div>${byT.size ? `<p style="margin:0;font-weight:700">${[...byT.keys()].map(esc).join(' · ')}</p>` : ''}<p class="note">${byT.size} of ${it.topics.length || '?'} topics</p></div>`,
      time: () => `<div class="card pad" style="margin:0"><div class="cap">Timetable</div><p style="margin:0;font-weight:700">${(it.days || []).map(d => DAYN[d] + ' ' + timeOf(it, d)).join(' · ') || 'Days to be confirmed'}</p><p class="note">${it.where ? esc(it.where) + ' · ' : ''}until ${it.b ? nice(it.b) : '?'}</p></div>`};
    const box = (x, i) => ed ? `<div class="t-sec ed"><div class="t-secctl"><b>${SECS[x]}</b><button type="button" data-tsmv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" data-tsmv="${i}|1" ${i < on.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button type="button" class="rm" data-tsrm="${x}" aria-label="Remove ${SECS[x]}">×</button></div>${SEC[x]()}</div>` : `<div class="t-sec">${SEC[x]()}</div>`;
    const off = Object.keys(SECS).filter(x => !on.includes(x));
    const acts = ed ? `<div class="acts"><button class="btn n" type="button" data-tedit="">Done</button></div>` : `<div class="acts"><button class="btn" type="button" data-tedit="tstudent" title="Edit sections" aria-label="Edit sections">${PEN()}</button>${logBtn(k)}</div>`;
    return back('#teach/students', 'My students') + head(esc(it.st), `${esc(it.sub)}${it.lv ? ' · ' + esc(it.lv) : ''}`, acts) + (ed ? '<p class="note" style="margin:-6px 0 12px">Changes apply to every student\'s page.</p>' : '') + on.map(box).join('') +
      (ed && off.length ? `<div class="h2">Add a section <em>${off.length}</em></div><div class="card">${off.map(x => `<div class="it"><span class="t"><b>${SECS[x]}</b></span><button class="btn sm" type="button" data-tsadd="${x}">${ic('plus',14,2.4)} Add</button></div>`).join('')}</div>` : '');
  }

  /* ---------- logging: a session ---------- */
  function members(key){
    const I = items();
    if(key.startsWith('class:')){ const c = (data.classes || []).find(x => x.id === key.slice(6)); return c ? {cls:c, M: I.filter(x => c.stu.includes(stuOf(x.k)) && nk(x.sub) === nk(c.sub))} : {M: []}; }
    const it = I.find(x => x.k === key); return {M: it ? [it] : []};
  }
  function newForm(key){
    const t = today(), dow = DAYC[HD.parseISO(t).getDay()], {cls, M} = key === 'group' ? {M: []} : members(key);
    const it0 = M[0], online = /online/i.test((cls && cls.mode) || (it0 && it0.where) || '');
    return {key, grp: 'g' + uid(), ids:{}, d: t, keys: M.map(m => m.k), cls: cls ? cls.id : '', fmt: (cls || key === 'group') ? (online ? 'go' : 'gi') : (online ? '1o' : '1i'),
      t1: it0 ? tStart(it0, dow) : '', t2: it0 ? tEnd(it0, dow) : '', att: Object.fromEntries(M.map(m => [m.k, 'attended'])), mk: 0, tp: [], fin: [], q: '', open: false,
      give: SRA.build(items(), live(), t).filter(x => M.some(m => m.k === x.k) && x.status === 'give').map(ref), had: [], gb: 0, ga: 0, wa: 0, waTp: [], waMx: '', waOpen: false, wq: '', nt: '', n: ''};
  }
  function editForm(grp){
    const E = live().filter(e => e.ty === 's' && (e.grp || e.id) === grp); if(!E.length) return null; const e = E[0];
    const G = live().filter(x => x.ty === 'g' && x.grp === grp), W = live().filter(x => x.ty === 'w' && x.grp === grp);
    return {key: e.cls ? 'class:' + e.cls : E.length > 1 ? 'group' : e.k, grp, edit: true, ids: Object.fromEntries(E.map(x => [x.k, x.id])), d: e.d, keys: E.map(x => x.k), cls: e.cls || '', fmt: e.fmt || '1i', t1: e.t1 || '', t2: e.t2 || '',
      att: Object.fromEntries(E.map(x => [x.k, x.a])), mk: e.mk || 0, tp: e.tp || [], fin: e.fin || [], q: '', open: false, give: G.map(g => [g.k, g.tk, g.rv].map(encodeURIComponent).join('/')), had: G.map(g => g.id), gIds: Object.fromEntries(G.map(g => [[g.k, g.tk, g.rv].map(encodeURIComponent).join('/'), g.id])),
      gb: e.gb || 0, ga: e.ga || 0, wa: W.length ? 1 : 0, waTp: (W[0] || {}).tp || [], waMx: (W[0] || {}).mx || '', wIds: Object.fromEntries(W.map(x => [x.k, x.id])), waOpen: false, wq: '', nt: e.nt || '', n: e.n || ''};
  }
  function topicPicker(f, key, openKey, qKey, label){
    const M = f.keys.map(itemOf).filter(Boolean), E = live().filter(e => f.keys.includes(e.k));
    const all = [...new Set(M.flatMap(m => m.topics).concat(E.flatMap(e => e.tp || [])))].filter(Boolean);
    const rec = [...new Set(E.filter(e => e.ty === 's').sort((a, b) => (b.d || '').localeCompare(a.d || '')).flatMap(e => e.tp || []))].slice(0, 4);
    const picked = f[key], q = (f[qKey] || '').trim(), ql = q.toLowerCase(), row = t => tick(key + ':' + t, picked.includes(t), esc(t));
    const m = all.filter(t => t.toLowerCase().includes(ql)), r = q ? [] : rec, rest = m.filter(t => !r.includes(t));
    const list = (r.length ? `<div class="lbl">Recent</div>${r.map(row).join('')}<div class="lbl">All topics</div>` : '') + rest.map(row).join('') + (q && !all.some(t => t.toLowerCase() === ql) ? `<button type="button" class="btn sm" data-taddtp="${key}">${ic('plus',14,2.4)} Add “${esc(q)}”</button>` : !m.length ? '<p class="note">No topic matches.</p>' : '');
    return `<div class="t-dd"><button type="button" data-ttog="${openKey}" aria-expanded="${!!f[openKey]}"><span>${picked.length ? picked.length + ' topic' + (picked.length > 1 ? 's' : '') + ' chosen' : label}</span><i>${f[openKey] ? '▴' : '▾'}</i></button>
      ${f[openKey] ? `<div class="t-ddp"><input class="in" data-tq="${qKey}" placeholder="Search, or type a new topic" value="${esc(f[qKey] || '')}" autocomplete="off"><div data-tql="${qKey}">${list}</div></div>` : ''}</div>`;
  }
  function sraGroups(f){
    const t = today(), we = weekEnd(t), mine = sras().filter(x => f.keys.includes(x.k) && !x.paused);
    const had = new Set(f.edit ? Object.keys(f.gIds || {}) : []);
    const pick = mine.filter(x => ['give','overdue','upcoming'].includes(x.status) || had.has(ref(x)));
    const due = pick.filter(x => x.status === 'give' || (had.has(ref(x)) && x.giveOn === t)), miss = pick.filter(x => x.status === 'overdue'), up = pick.filter(x => !due.includes(x) && !miss.includes(x) && x.giveOn <= we);
    const row = (x, cls, sub) => tick('give:' + ref(x), f.give.includes(ref(x)), `${esc(short(x.st))} · ${esc(x.topic)} · ${x.label}`, sub, cls);
    const hadLd = new Set(Object.keys(f.gIds || {}).filter(r => r.endsWith('/0')).map(r => decodeURIComponent(r.split('/')[1])));
    const ld = f.fin.filter(tp => !hadLd.has(tp) && !mine.some(x => x.topic === tp && x.stage === 0));
    const backOn = x => nice(SRA.nextDay(itemOf(x.k) || {days: []}, addDays(x.doOn > t ? x.doOn : t, 1)));
    return (ld.length ? `<div class="t-grp">Starting today</div><div class="t-opts">${ld.map(tp => tick('ldoff:' + tp, !(f.ldOff || []).includes(tp), `${esc(tp)} · Learning Day`, 'For everyone here · the first SRA of the topic you just finished')).join('')}</div>` : '') + (due.length ? `<div class="t-grp">Due today</div><div class="t-opts">${due.map(x => row(x, '', 'Do on ' + nice(x.doOn))).join('')}</div>` : '') +
      (miss.length ? `<div class="t-grp"><span class="tag am">Missed</span> Should have gone out earlier</div><div class="t-opts">${miss.map(x => row(x, 'miss', 'Was for ' + nice(x.giveOn) + ' · do as soon as possible')).join('')}</div>` : '') +
      (up.length ? `<div class="t-grp">Coming up this week · give early if you need to</div><div class="t-opts">${up.map(x => row(x, '', 'Give on ' + nice(x.giveOn) + ' · do on ' + nice(x.doOn) + (f.give.includes(ref(x)) ? ' · due back ' + backOn(x) : ''))).join('')}</div>` : '') ||
      '<p class="empty" style="margin:0">No SRAs due for this week. Mark a topic finished to start its SRAs.</p>';
  }
  function logPage(key, eid){
    if(key.startsWith('edit:')){ if(!form || form.grp !== key.slice(5)) form = editForm(key.slice(5)); if(!form) return backHome() + '<p class="empty">That log isn\'t here any more.</p>'; }
    else if(!form || form.key !== key || form.edit) form = newForm(key || 'pick');
    const f = form, I = items(), C = data.classes || [], M = f.keys.map(itemOf).filter(Boolean), pickWho = !f.edit;
    const whoSel = `<select class="in" data-twho aria-label="Who">${f.key === 'pick' ? '<option value="pick">Choose…</option>' : ''}${C.length ? `<optgroup label="Classes">${C.map(c => `<option value="class:${c.id}" ${f.key === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Students">${I.map(it => `<option value="${esc(it.k)}" ${f.key === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</optgroup><option value="group" ${f.key === 'group' ? 'selected' : ''}>Several students (not a class)</option></select>`;
    return backHome() + head(f.edit ? 'Edit session' : 'Log a session', f.edit ? nice(f.d) : 'Fill in what happened. Ticks and circles only.') + `
      <div class="card pad"><label class="f" style="margin:0"><span>Who</span>${pickWho ? whoSel : `<input class="in" value="${esc(f.cls ? (C.find(c => c.id === f.cls) || {}).name || 'Class' : M.map(m => m.st + ' · ' + m.sub).join(', '))}" readonly>`}</label>
        ${f.key === 'group' && pickWho ? `<div class="t-opts" style="margin-top:10px">${I.map(it => tick('keys:' + it.k, f.keys.includes(it.k), esc(it.st), esc(it.sub))).join('')}</div>` : ''}</div>
      ${M.length ? `
      <div class="card pad"><div class="cap">Session type</div>${one('fmt', FMT, f.fmt, 'g2')}
        <div style="margin-top:8px">${tick('mk', f.mk, 'This was a make-up session')}</div>
        <div class="r2" style="margin-top:14px"><label class="f" style="margin:0"><span>Date</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label><span></span></div>
        <div class="r2" style="margin-top:10px"><label class="f" style="margin:0"><span>Started</span><input class="in" type="time" data-tin="t1" value="${esc(f.t1)}"></label><label class="f" style="margin:0"><span>Finished</span><input class="in" type="time" data-tin="t2" value="${esc(f.t2)}"></label></div></div>
      <div class="card pad"><div class="cap">Attendance</div><div class="t-att"><span></span>${ATT.map(a => `<span class="hd">${a[1]}</span>`).join('')}
        ${M.map(m => `<span class="nm">${esc(short(m.st))}</span>${ATT.map(([v, l]) => `<button type="button" role="radio" aria-label="${esc(short(m.st))} ${l}" aria-checked="${f.att[m.k] === v}" class="${f.att[m.k] === v ? 'on' : ''}" data-tset="att.${esc(m.k)}" data-v="${v}"><span class="t-ind c"></span></button>`).join('')}`).join('')}</div>
        ${M.some(m => !taught(f.att[m.k])) ? '<p class="note">A make-up is owed for an absence or a cancellation.</p>' : ''}</div>
      ${M.some(m => taught(f.att[m.k])) ? `
      <div class="card pad"><div class="cap">Topics covered</div>${topicPicker(f, 'tp', 'open', 'q', 'Choose topics')}
        ${f.tp.map(t => `<div class="t-pk"><div class="row"><span>${esc(t)}</span><button class="t-x" type="button" aria-label="Remove ${esc(t)}" data-ttog="tp:${esc(t)}">×</button></div><div style="margin-top:8px">${tick('fin:' + t, f.fin.includes(t), 'Finished this topic', f.fin.includes(t) ? 'Starts its SRAs: today, then 1, 3, 7, 14 days and a month' : '')}</div></div>`).join('')}</div>
      <div class="card pad"><div class="cap">SRAs handed out <small style="text-transform:none;letter-spacing:0">· from the SRA tracker</small></div>${sraGroups(f)}</div>
      <div class="card pad"><div class="cap">Guide</div><div class="t-opts">${tick('gb', f.gb, 'Guide handed before the session')}${tick('ga', f.ga, 'Guide handed after the session')}</div></div>
      <div class="card pad"><div class="cap">Weekly assessment</div>${tick('wa', f.wa, 'Weekly assessment given', f.wa ? 'Enter the marks later: + Log › Weekly assessment marks' : '')}
        ${f.wa ? `<div style="margin-top:12px"><label class="f" style="margin-bottom:6px"><span>Topics tested (optional now)</span></label>${topicPicker(f, 'waTp', 'waOpen', 'wq', 'Choose topics')}${f.waTp.length ? `<p class="note">${f.waTp.map(esc).join(', ')}</p>` : ''}
          <label class="f" style="margin:12px 0 0"><span>Marked out of (optional now)</span><input class="in" inputmode="decimal" data-tin="waMx" value="${esc(f.waMx)}" placeholder="e.g. 40"></label></div>` : ''}</div>` : ''}
      <div class="card pad"><label class="f"><span>Note for LHQ (optional)</span><textarea class="in" data-tin="nt" rows="2" style="min-height:0;height:72px">${esc(f.nt)}</textarea></label>
        <label class="f" style="margin:0"><span>Line for the parent (optional)</span><textarea class="in" data-tin="n" rows="2" maxlength="140" style="min-height:0;height:72px" placeholder="e.g. Much more confident with mole calculations this week.">${esc(f.n)}</textarea></label></div>
      <button class="btn n full" type="button" id="tSave">${f.edit ? 'Save changes' : 'Save log'}</button>${f.edit ? '<button class="btn rd full" type="button" id="tDel" style="margin-top:8px">Delete this log</button>' : ''}` : ''}`;
  }
  function saveLog(){
    const f = form, M = f.keys.map(itemOf).filter(Boolean);
    if(!M.length){ toast('Choose who the session was with'); return; }
    if(f.t1 && f.t2 && mins(f.t2) <= mins(f.t1)){ toast('The session finishes before it starts'); return; }
    if(f.waMx && !(parseFloat(f.waMx) > 0)){ toast('Check what the assessment is marked out of'); return; }
    const md = /o$/.test(f.fmt) ? 'o' : 'c', list = [];
    M.forEach(m => { const a = f.att[m.k] || 'attended', ok = taught(a);
      const e = {id: f.ids[m.k] || uid(), ty:'s', k:m.k, st:m.st, sub:m.sub, d:f.d, a, md, fmt:f.fmt, grp:f.grp};
      if(f.t1) e.t1 = f.t1; if(f.t2) e.t2 = f.t2; if(f.cls) e.cls = f.cls; if(f.mk) e.mk = 1;
      if(ok){ e.tp = f.tp.slice(); if(f.fin.length) e.fin = f.fin.filter(t => f.tp.includes(t)); if(f.gb) e.gb = 1; if(f.ga) e.ga = 1; }
      if(f.nt) e.nt = f.nt; if(f.n) e.n = f.n; list.push(e); });
    if(f.edit) Object.entries(f.ids).forEach(([k, id]) => { if(!f.keys.includes(k)){ const o = live().find(x => x.id === id); if(o) list.push(Object.assign({}, o, {x:1})); } });
    // SRAs handed out: an entry per SRA ticked; unticked ones from before are removed
    const gIds = f.gIds || {}; const present = new Set(M.filter(m => taught(f.att[m.k])).map(m => m.k));
    f.give.forEach(r => { const [k, tk, rv] = r.split('/').map(decodeURIComponent); if(!present.has(k)) return; const m = itemOf(k);
      list.push({id: gIds[r] || uid(), ty:'g', k, st:m.st, sub:m.sub, d:f.d, tk, rv:+rv, grp:f.grp}); });
    const hadLd = new Set(Object.keys(gIds).filter(r => r.endsWith('/0')).map(r => decodeURIComponent(r.split('/')[1])));
    f.fin.filter(tp => f.tp.includes(tp) && !hadLd.has(tp) && !(f.ldOff || []).includes(tp)).forEach(tp => M.filter(m => present.has(m.k)).forEach(m => {
      if(!list.some(e => e.ty === 'g' && e.k === m.k && e.tk === tp && e.rv === 0)) list.push({id: uid(), ty:'g', k:m.k, st:m.st, sub:m.sub, d:f.d, tk:tp, rv:0, grp:f.grp}); }));
    Object.entries(gIds).forEach(([r, id]) => { if(!f.give.includes(r)){ const o = live().find(x => x.id === id); if(o) list.push(Object.assign({}, o, {x:1})); } });
    // weekly assessment given: waits for marks
    const wIds = f.wIds || {};
    if(f.wa) M.filter(m => taught(f.att[m.k])).forEach(m => { const o = live().find(x => x.id === wIds[m.k]) || {};
      list.push(Object.assign({}, o, {id: wIds[m.k] || uid(), ty:'w', k:m.k, st:m.st, sub:m.sub, d:f.d, tp:f.waTp.slice(), mx:f.waMx, wid:f.grp, grp:f.grp}, f.cls ? {cls:f.cls} : {})); });
    else Object.values(wIds).forEach(id => { const o = live().find(x => x.id === id); if(o && (o.sc == null || o.sc === '')) list.push(Object.assign({}, o, {x:1})); });
    const fins = list.filter(e => e.ty === 's').reduce((a, e) => a + (e.fin || []).length, 0) ? f.fin.length : 0, gave = list.filter(e => e.ty === 'g' && !e.x && !(f.gIds && Object.values(f.gIds).includes(e.id))).length;
    form = null;
    saveEntries(list, true).then(ok => { if(!ok) return; toast([f.edit ? 'Changes saved' : 'Session logged', fins ? `SRAs scheduled for ${fins} topic${fins > 1 ? 's' : ''}` : '', gave ? `${gave} SRA${gave > 1 ? 's' : ''} handed out` : '', f.wa && !f.edit ? 'assessment waiting for marks' : ''].filter(Boolean).join(' · ')); location.hash = '#teach'; });
  }

  /* ---------- logging: SRA marks ---------- */
  function marksPage(v){
    const I = items(), L = sras();
    if(!mform){
      if(v.startsWith('edit:')){ const e = live().find(x => x.id === decodeURIComponent(v.slice(5))); if(!e) return backHome() + '<p class="empty">That log isn\'t here any more.</p>';
        mform = {edit: e.id, k: e.k, sra: e.man ? 'man' : [e.k, e.tk, e.rv].map(encodeURIComponent).join('/'), tk: e.tk, rv: String(e.rv), h: e.h || 'o', sc: e.sc ?? '', mx: e.mx ?? '10', d: e.d}; }
      else { const x = v && !v.startsWith('stu:') ? unref(v) : null, k0 = v.startsWith('stu:') ? v.slice(4) : ''; mform = {k: x ? x.k : k0, sra: x ? ref(x) : '', tk: '', rv: '', h: 'o', sc: '', mx: '10', d: today()}; }
    }
    const f = mform, out = L.filter(x => x.k === f.k && ['given','collect','late'].includes(x.status) || (f.edit && ref(x) === f.sra && x.k === f.k)), it = itemOf(f.k);
    return backHome() + head(f.edit ? 'Edit SRA marks' : 'SRA marks', 'For an SRA that has been handed in') + `
      <div class="card pad"><label class="f"><span>Student</span><select class="in" data-tmk aria-label="Student" ${f.edit ? 'disabled' : ''}><option value="">Choose…</option>${I.map(i => `<option value="${esc(i.k)}" ${f.k === i.k ? 'selected' : ''}>${esc(i.st)} · ${esc(i.sub)}</option>`).join('')}</select></label>
      ${f.k ? `<div class="cap">Which SRA</div><div class="t-opts">${out.map(x => `<button type="button" role="radio" aria-checked="${f.sra === ref(x)}" class="t-opt${f.sra === ref(x) ? ' on' : ''}" data-tset="sra" data-v="${esc(ref(x))}"><span class="t-ind c"></span><span class="tx">${esc(x.topic)} · ${x.label}<small>Given ${x.given ? nice(x.given.d) : '?'} · due back ${x.due === today() ? 'today' : nice(x.due)}${x.status === 'late' ? ' · late' : ''}</small></span></button>`).join('')}
        <button type="button" role="radio" aria-checked="${f.sra === 'man'}" class="t-opt${f.sra === 'man' ? ' on' : ''}" data-tset="sra" data-v="man"><span class="t-ind c"></span><span class="tx">Not in the list<small>Choose the topic and review yourself · LHQ will check it</small></span></button></div>
        ${f.sra === 'man' ? `<div class="r2" style="margin-top:10px"><label class="f" style="margin:0"><span>Topic</span><select class="in" data-tin="tk"><option value="">Choose…</option>${[...new Set((it ? it.topics : []).concat(L.filter(x => x.k === f.k).map(x => x.topic)))].map(t => `<option ${f.tk === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          <label class="f" style="margin:0"><span>Review</span><select class="in" data-tin="rv"><option value="">Choose…</option>${SRA.STAGES.map(s => `<option value="${s.n}" ${f.rv === String(s.n) ? 'selected' : ''}>${s.l}</option>`).join('')}</select></label></div>` : ''}` : ''}</div>
      ${f.sra ? `<div class="card pad"><div class="cap">Marks</div><div class="t-score"><input class="in" inputmode="decimal" data-tin="sc" data-tpc="mpc" value="${esc(f.sc)}" aria-label="Marks"><span>/</span><input class="in" inputmode="decimal" data-tin="mx" data-tpc="mpc" value="${esc(f.mx)}" aria-label="Out of"><b id="mpc">${pct(f.sc, f.mx)}</b></div>
        <label class="f" style="margin:14px 0 0"><span>Handed in on</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label>
        <p class="note">Change the date when you're entering marks for an earlier SRA.</p></div>
        <button class="btn n full" type="button" id="tmSave">${f.edit ? 'Save changes' : 'Save marks'}</button>${f.edit ? '<button class="btn rd full" type="button" id="tmDel" style="margin-top:8px">Delete this log</button>' : ''}` : ''}`;
  }
  function saveMarks(){
    const f = mform, it = itemOf(f.k); if(!it){ toast('Choose the student'); return; }
    let tk, rv; if(f.sra === 'man'){ tk = f.tk; rv = +f.rv; if(!tk || f.rv === ''){ toast('Choose the topic and review'); return; } } else { const [, a, b] = f.sra.split('/').map(decodeURIComponent); tk = a; rv = +b; }
    if(!pct(f.sc, f.mx)){ toast('Check the marks'); return; }
    const e = {id: f.edit || uid(), ty:'r', v:2, k:it.k, st:it.st, sub:it.sub, d:f.d, tk, rv, h:'o', sc:+f.sc, mx:+f.mx}; if(f.sra === 'man') e.man = 1;
    mform = null; saveEntries([e], true).then(ok => { if(ok){ toast('Marks saved · ' + pct(e.sc, e.mx)); location.hash = '#teach'; } });
  }

  /* ---------- logging: weekly assessment marks ---------- */
  function waPage(v){
    const P = pendingWa(), I = items(), C = data.classes || [];
    if(!wform){
      if(v.startsWith('edit:')){ const id = v.slice(5), G = live().filter(e => e.ty === 'w' && (e.wid || e.id) === id); if(!G.length) return backHome() + '<p class="empty">That log isn\'t here any more.</p>';
        wform = {pend: id, edit: true, key: G[0].cls ? 'class:' + G[0].cls : G[0].k, keys: G.map(x => x.k), ids: Object.fromEntries(G.map(x => [x.k, x.id])), tp: G[0].tp || [], d: G[0].d, mx: G[0].mx || '', marks: Object.fromEntries(G.map(x => [x.k, x.sc ?? ''])), abs: Object.fromEntries(G.map(x => [x.k, !!x.abs])), open: false, q: ''}; }
      else { const w = P.find(x => x.id === v); wform = w ? fromPending(w) : {pend: P.length ? '' : 'new', key: '', keys: [], ids: {}, tp: [], d: today(), mx: '', marks: {}, abs: {}, open: false, q: ''}; }
    }
    const f = wform, cls = f.key.startsWith('class:') ? C.find(c => c.id === f.key.slice(6)) : null;
    const pick = !f.edit && P.length ? `<div class="card pad"><div class="cap">Which assessment</div><div class="t-opts">${P.map(w => `<button type="button" role="radio" aria-checked="${f.pend === w.id}" class="t-opt${f.pend === w.id ? ' on' : ''}" data-twpick="${esc(w.id)}"><span class="t-ind c"></span><span class="tx">${esc(w.name)} · ${esc(w.sub)}<small>Given ${nice(w.d)} · ${w.tp.map(esc).join(', ') || 'topics not set'} · marks not entered</small></span></button>`).join('')}
      <button type="button" role="radio" aria-checked="${f.pend === 'new'}" class="t-opt${f.pend === 'new' ? ' on' : ''}" data-twpick="new"><span class="t-ind c"></span><span class="tx">Another assessment<small>Not ticked in a session</small></span></button></div></div>` : '';
    if(!f.pend) return backHome() + head('Weekly assessment marks', 'Choose the assessment') + pick;
    const fromP = f.pend !== 'new', M = f.keys.map(itemOf).filter(Boolean);
    return backHome() + head(f.edit ? 'Edit weekly assessment' : 'Weekly assessment marks', cls ? 'Same test for the whole class' : M.length === 1 ? 'For ' + esc(M[0].st) + ' only' : '') + pick + `
      ${fromP ? '' : `<div class="card pad"><label class="f" style="margin:0"><span>Who</span><select class="in" data-twwho aria-label="Who"><option value="">Choose…</option>${C.length ? `<optgroup label="Classes">${C.map(c => `<option value="class:${c.id}" ${f.key === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Students">${I.map(it => `<option value="${esc(it.k)}" ${f.key === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</optgroup></select></label></div>`}
      ${M.length ? `<div class="card pad"><div class="cap">The test · ${esc(M[0].sub)}</div>
        <label class="f" style="margin-bottom:6px"><span>Topics tested</span></label>${topicPicker(f, 'tp', 'open', 'q', 'Choose topics')}${f.tp.length ? `<p class="note">${f.tp.map(esc).join(', ')}</p>` : ''}
        <div class="r2" style="margin-top:14px"><label class="f" style="margin:0"><span>Date given</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label><label class="f" style="margin:0"><span>Marks out of</span><input class="in" inputmode="decimal" data-tin="mx" data-twpc="1" value="${esc(f.mx)}" placeholder="e.g. 40"></label></div></div>
      <div class="card pad"><div class="cap">Marks</div><div class="t-marks">${M.map(m => `<span class="nm">${esc(short(m.st))}</span>${f.abs[m.k] ? '<span class="tag gr" style="justify-self:start">Absent</span>' : `<input class="in" inputmode="decimal" data-tin="marks.${esc(m.k)}" data-twpc="1" value="${esc(f.marks[m.k] ?? '')}" aria-label="${esc(short(m.st))} marks">`}<b data-twp="${esc(m.k)}">${f.abs[m.k] ? '' : pct(f.marks[m.k], f.mx)}</b>`).join('')}</div>
        ${M.length > 1 ? `<div class="cap" style="margin-top:14px">Didn't sit it</div><div class="t-opts">${M.map(m => tick('abs:' + m.k, f.abs[m.k], esc(m.st) + ' was absent')).join('')}</div>` : ''}</div>
      <button class="btn n full" type="button" id="twSave">${f.edit ? 'Save changes' : 'Save marks'}</button>` : ''}`;
  }
  function fromPending(w){ const G = w.G; return {pend: w.id, key: G[0].cls ? 'class:' + G[0].cls : G[0].k, keys: G.map(x => x.k), ids: Object.fromEntries(G.map(x => [x.k, x.id])), tp: w.tp.slice(), d: w.d, mx: w.mx, marks: {}, abs: {}, open: false, q: ''}; }
  function saveWa(){
    const f = wform, M = f.keys.map(itemOf).filter(Boolean); if(!M.length){ toast('Choose who sat it'); return; }
    if(!(parseFloat(f.mx) > 0)){ toast('Add what it was marked out of'); return; }
    const bad = M.find(m => !f.abs[m.k] && !pct(f.marks[m.k], f.mx)); if(bad){ toast(`Check ${short(bad.st)}'s marks`); return; }
    const wid = f.pend !== 'new' ? f.pend : 'w' + uid(), cls = f.key.startsWith('class:') ? f.key.slice(6) : '', now = Date.now();
    const list = M.map(m => { const o = live().find(x => x.id === f.ids[m.k]) || {};
      const e = Object.assign({}, o, {id: f.ids[m.k] || uid(), ty:'w', k:m.k, st:m.st, sub:m.sub, d:f.d, tp:f.tp.slice(), mx:+f.mx, wid, md: today(), mc: o.mc || now}, cls ? {cls} : {});
      if(f.abs[m.k]){ e.abs = 1; delete e.sc; } else { e.sc = +f.marks[m.k]; delete e.abs; } return e; });
    wform = null; saveEntries(list, true).then(ok => { if(ok){ toast('Assessment marks saved'); location.hash = '#teach'; } });
  }

  /* ---------- the SRA tracker ---------- */
  function sraPage(tab){
    const L = sras().filter(x => !x.paused), t = today(), T = SRA.today(L, t);
    const tabs = `<div class="t-segw" role="tablist">${[['today','Today'],['week','Next 7 days'],['students','By student']].map(([k, l]) => `<a role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" href="#teach/sra/${k}">${l}</a>`).join('')}</div>`;
    let body = '';
    if(tab === 'students'){
      const f = read('lhq_teach_sraw', ''), C = data.classes || [], I = items();
      const keys = f.startsWith('class:') ? (() => { const c = C.find(x => x.id === f.slice(6)); return c ? I.filter(it => c.stu.includes(stuOf(it.k)) && nk(it.sub) === nk(c.sub)).map(it => it.k) : []; })() : f ? [f] : I.map(it => it.k);
      const TAG = {in:['ok', x => Math.round(x.score.sc / x.score.mx * 100) + '%'], collect:['bl', () => 'due back'], late:['am', () => 'late'], given:['bl', x => 'back ' + HD.parseISO(x.due).getDate()], give:['am', () => 'today'], overdue:['rd', () => 'missed'], upcoming:['gr', x => nice(x.giveOn).replace(/ \d{4}$/, '')], after:['gr', () => 'next period']};
      body = `<div class="card pad"><label class="f" style="margin:0"><span>Show</span><select class="in" data-tsraw aria-label="Show"><option value="">All students</option>${C.map(c => `<option value="class:${c.id}" ${f === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}${I.map(it => `<option value="${esc(it.k)}" ${f === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</select></label></div>` +
        keys.map(k => { const it = itemOf(k); if(!it) return ''; const X = L.filter(x => x.k === k), byT = new Map(); X.forEach(x => { if(!byT.has(x.topic)) byT.set(x.topic, []); byT.get(x.topic).push(x); });
          return `<div class="h2">${esc(it.st)} <em>${esc(it.sub)}</em></div><div class="card">${[...byT.entries()].map(([tp, R]) => `<div class="it" style="display:block"><b style="display:block">${esc(tp)}</b><small style="color:var(--muted);font-size:12.5px">Learning Day ${nice(R[0].learnt)}</small>
            <div class="t-chips6">${R.sort((a, b) => a.stage - b.stage).map(x => `<button type="button" class="tag ${TAG[x.status][0]}" data-tsdet="${esc(ref(x))}" aria-label="${x.label}"><span>${x.stage ? 'R' + x.stage : 'LD'}</span>${TAG[x.status][1](x)}</button>`).join('')}</div></div>`).join('') || '<p class="empty">No topics finished yet.</p>'}</div>`; }).join('') +
        '<p class="note">LD = Learning Day SRA, R1–R5 = reviews 1–5. Green: handed in with its score · blue: out or due back · amber: give today or late · red: missed · grey: coming up. Tap one for its dates.</p>';
    } else if(tab === 'week'){
      body = Array.from({length: 7}, (_, i) => addDays(t, i)).map((d, i) => { const g = L.filter(x => x.giveOn === d && ['upcoming','give'].includes(x.status)), late = i === 0 ? L.filter(x => x.status === 'overdue') : [];
        return `<div class="h2">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAY[HD.parseISO(d).getDay()].slice(0, 3) + ' ' + nice(d)} <em>${g.length + late.length}</em></div><div class="card">${late.concat(g).map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${esc(x.sub)} · ${x.label}${x.giveOn !== x.doOn ? ` · give ${nice(x.giveOn)}, do on ${nice(x.doOn)}` : ` · do on ${nice(x.doOn)}`}</small></span>${x.status === 'overdue' ? `<button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button>` : i === 0 ? `<button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button>` : `<button class="btn sm" type="button" data-tgive="${ref(x)}" data-early="1">Give early</button>`}</div>`).join('') || '<p class="empty">None.</p>'}</div>`; }).join('') +
        '<p class="note">"Give on" is the last session before the review day. Given early, an SRA keeps its do-on day and comes back at the first session after it.</p>';
    } else {
      const O = L.filter(x => x.status === 'given');
      body = `<div class="h2">Give today <em>${T.give.length}</em></div><div class="card">${T.give.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · do on ${nice(x.doOn)}${x.status === 'overdue' ? ` · <span style="color:var(--rd);font-weight:800">was for ${nice(x.giveOn)}</span>` : ''}</small></span><button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button></div>`).join('') || '<p class="empty">Nothing to hand out today.</p>'}
        ${T.give.length > 1 ? `<div class="it"><span class="t"><small>Or tick them in a session log</small></span><button class="btn sm n" type="button" data-tgiveall>All given</button></div>` : ''}</div>
        <div class="h2">To collect <em>${T.collect.length}</em></div><div class="card">${T.collect.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · given ${nice(x.given.d)}${x.moved ? ` · <span style="color:var(--am);font-weight:800">not handed in ${nice(x.moved)}, due again today</span>` : x.status === 'late' ? ' · <span style="color:var(--am);font-weight:800">late</span>' : ''}</small></span><button class="btn sm" type="button" data-tin="${ref(x)}">Handed in?</button></div>`).join('') || '<p class="empty">Nothing due back today.</p>'}</div>
        <div class="h2">Print for ${T.printDay === addDays(t, 1) ? 'tomorrow' : nice(T.printDay)} <em>${(n => n + (n === 1 ? ' copy' : ' copies'))(T.print.reduce((a, g) => a + g.students.length, 0))}</em></div>
        <div class="card">${T.print.map(g => `<div class="it"><span class="t"><b>${esc(g.topic)} · ${g.label}</b><small>${esc(g.sub)} · for ${g.students.map(s => esc(s.st.split(' ')[0])).join(', ')} · the sheet says "Do on ${nice(g.students[0].doOn)}"</small></span><span class="tag bl">× ${g.students.length}</span></div>`).join('') || '<p class="empty">Nothing to print yet.</p>'}</div>
        <p class="note" style="margin:-6px 2px 14px">Printing is manual for now. One-tap printing comes when the SRA files are uploaded.</p>
        <div class="h2">Out with students <em>${O.length}</em></div><div class="card">${O.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · given ${nice(x.given.d)} · due back ${nice(x.due)}</small></span></div>`).join('') || '<p class="empty">None.</p>'}</div>`;
    }
    return (tutorRole() ? '' : backHome()) + head('SRA tracker', 'When each SRA is given, done and collected', `<div class="acts">${logBtn()}</div>`) + tabs + body;
  }
  function sraSheet(x){
    const ST = {in:'Handed in', collect:'Due back today', late:'Late', given:'Out with the student', give:'Give today', overdue:'Missed · not handed out yet', upcoming:'Coming up', after:'After this tuition period · waits for the next one'};
    openSheet(`<div class="hx"><h3>${esc(short(x.st))} · ${esc(x.topic)} · ${x.label}</h3><button class="ib" data-close>✕</button></div>
      <div class="t-kv" style="margin-bottom:14px"><span>Learning Day</span><b>${nice(x.learnt)}</b><span>Do on</span><b>${nice(x.doOn)}</b><span>Give on</span><b>${nice(x.giveOn)}${x.giveOn !== x.doOn ? ' (no session that day)' : ''}</b><span>Status</span><b>${ST[x.status]}</b>${x.given ? `<span>Given</span><b>${nice(x.given.d)}</b><span>Due back</span><b>${nice(x.due)}</b>` : ''}${x.score ? `<span>Score</span><b>${x.score.sc}/${x.score.mx} · ${pct(x.score.sc, x.score.mx)}</b>` : ''}</div>
      ${['give','overdue'].includes(x.status) ? `<button class="btn n full" type="button" data-tgive="${ref(x)}">Mark as given today</button>` : x.status === 'upcoming' ? `<button class="btn n full" type="button" data-tgive="${ref(x)}" data-early="1">Give early, today</button>` : ['collect','late','given'].includes(x.status) ? `<button class="btn n full" type="button" data-tin="${ref(x)}">Handed in? Enter marks</button>` : ''}`);
    bindSheet();
  }
  function handInSheet(x){
    const nxt = SRA.nextDay(itemOf(x.k) || {days: []}, addDays(today(), 1));
    openSheet(`<div class="hx"><h3>${esc(short(x.st))} · ${esc(x.topic)} · ${x.label}</h3><button class="ib" data-close>✕</button></div><p class="sp">Given ${nice(x.given.d)} · due back ${nice(x.due)}</p>
      <div class="cap">Marks</div><div class="t-score"><input class="in" id="thSc" inputmode="decimal" aria-label="Marks"><span>/</span><input class="in" id="thMx" inputmode="decimal" value="10" aria-label="Out of"><b id="thPc"></b></div>
      <button class="btn n full" type="button" id="thGo" style="margin-top:14px">Handed in · save marks</button>
      <button class="btn full" type="button" id="thNo" style="margin-top:8px">Not handed in · due ${nice(nxt)}</button>
      <p class="note">Not handed in moves it to the next session day and shows it as late. It isn't counted as missed.</p>`);
    const up = () => $('thPc').textContent = pct($('thSc').value, $('thMx').value); $('thSc').oninput = up; $('thMx').oninput = up;
    const base = {ty:'r', v:2, k:x.k, st:x.st, sub:x.sub, d:today(), tk:x.topic, rv:x.stage};
    $('thGo').onclick = () => { const sc = $('thSc').value.trim(), mx = $('thMx').value.trim(); if(!pct(sc, mx)){ toast('Check the marks'); return; }
      saveEntries([Object.assign({id: uid(), h:'o', sc:+sc, mx:+mx}, base)], true).then(ok => { if(ok){ closeSheet(); toast('Marks saved · ' + pct(sc, mx)); } }); };
    $('thNo').onclick = () => saveEntries([Object.assign({id: uid(), h:'m'}, base)], true).then(ok => { if(ok){ closeSheet(); toast('Moved to ' + nice(nxt) + ' · not counted as missed'); } });
  }

  /* ---------- the daily report ---------- */
  function reportPage(){
    const t = today(), rep = todayRep(), G = gaps(), L = dayLogs(t);
    if(!rform) rform = rep && !rep._edit ? JSON.parse(JSON.stringify(Object.assign({req: [], flag: null, comment: '', rate: 0}, rep))) : {req: [{item:'', qty:'1', by:'', for:''}], flag: {st:'', why: [], text:''}, comment: '', rate: 0};
    const f = rform; f.flag = f.flag || {st:'', why: [], text:''}; const ro = rep && !f.change;
    const seen = new Set(); let h = 0; live().filter(e => e.ty === 's' && e.d === t && taught(e.a)).forEach(e => { const g = e.grp || e.id; if(seen.has(g)) return; seen.add(g); h += hoursOf(e); });
    const S = [...new Map(items().map(it => [stuOf(it.k), it.st])).entries()];
    const dis = ro ? 'disabled' : '';
    return (tutorRole() ? '' : backHome()) + head('Daily report', `${WEEKDAY[HD.parseISO(t).getDay()]} ${nice(t)} · one page`) +
      (rep ? `<div class="t-banner ok"><span><b>Sent at ${hm(rep.sent)}</b>${ro ? 'LHQ has it. You can change it and send it again.' : 'Sending again replaces the report LHQ has.'}</span></div>` : '') + `
      <div class="h2">Today so far <em>${Math.round(h * 10) / 10} h taught</em></div>${timeline(L, false)}${gapCard(G)}
      <div class="card pad"><div class="cap">Requisition <small style="text-transform:none;letter-spacing:0">· items you need from LHQ</small></div>
        ${f.req.map((q, i) => `<div class="t-req"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">Item ${i + 1}</b>${ro ? '' : `<button class="t-x" type="button" aria-label="Remove item ${i + 1}" data-trmreq="${i}">×</button>`}</div>
          <label class="f"><span>What do you need?</span><input class="in" data-tin="req.${i}.item" value="${esc(q.item)}" placeholder="e.g. 10 copies of the Algebra Review 2 SRA" ${dis}></label>
          <div class="r2"><label class="f" style="margin:0"><span>How many</span><input class="in" inputmode="numeric" data-tin="req.${i}.qty" value="${esc(q.qty)}" ${dis}></label><label class="f" style="margin:0"><span>Needed by</span><input class="in" type="date" data-tin="req.${i}.by" value="${esc(q.by)}" min="${t}" ${dis}></label></div>
          <label class="f" style="margin:10px 0 0"><span>For (optional)</span><select class="in" data-tin="req.${i}.for" ${dis}><option value="">General</option>${S.map(([k, n]) => `<option value="${esc(k)}" ${q.for === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>`).join('') || (ro ? '<p class="empty" style="margin:0">Nothing requested.</p>' : '')}
        ${ro ? '' : `<button class="btn full" type="button" data-taddreq>${ic('plus',14,2.4)} Add an item</button>`}</div>
      <div class="card pad"><div class="cap">Flag a student <small style="text-transform:none;letter-spacing:0">· LHQ only · optional</small></div>
        <select class="in" data-tflag aria-label="Student to flag" ${dis}><option value="">Nobody to flag</option>${S.map(([k, n]) => `<option value="${esc(k)}" ${f.flag.st === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
        ${f.flag.st ? `<div class="t-opts g2" style="margin-top:10px">${['Struggling','Not engaged','Absent again','Other'].map(w => tick('why:' + w, f.flag.why.includes(w), w)).join('')}</div><textarea class="in" style="margin-top:10px;min-height:0;height:72px" data-tin="flag.text" placeholder="${f.flag.why.includes('Other') ? 'Say what it is' : 'A few words (optional)'}" ${dis}>${esc(f.flag.text)}</textarea>` : ''}</div>
      <div class="card pad"><label class="f"><span>Overall comment</span><textarea class="in" data-tin="comment" style="min-height:0;height:84px" placeholder="How the day went, anything LHQ should know" ${dis}>${esc(f.comment)}</textarea></label>
        <div class="cap">How was today? <small style="text-transform:none;letter-spacing:0">· optional</small></div>${one('rate', [1,2,3,4,5].map(n => [n, n]), f.rate || '', 'g5')}<p class="note">1 = a hard day · 5 = a great day</p></div>
      ${ro ? `<button class="btn full" type="button" data-trchange>Change and send again</button>`
        : f.warn ? `<div class="t-warn">${G.length} thing${G.length > 1 ? 's' : ''} still to log. Sessions that aren't logged count as not taught.<div class="acts"><button class="btn" type="button" data-trnowarn>Go back</button><button class="btn n" type="button" data-trsend="force">Send anyway</button></div></div>`
        : `<button class="btn n full" type="button" data-trsend style="min-height:48px">${rep ? 'Send again' : "Send today's report"}</button>`}`;
  }
  async function sendReport(force){
    const f = rform, G = gaps(); if(G.length && !force){ f.warn = 1; render(); return; }
    const t = today(), seen = new Set(); let h = 0; live().filter(e => e.ty === 's' && e.d === t && taught(e.a)).forEach(e => { const g = e.grp || e.id; if(seen.has(g)) return; seen.add(g); h += hoursOf(e); });
    const report = {d: t, req: f.req.filter(q => q.item.trim()), flag: f.flag && f.flag.st ? f.flag : null, comment: f.comment, rate: f.rate || 0, gaps: G.length, hours: h};
    const local = Object.assign({id: 'local' + t, tutor: me().name, sent: Date.now(), at: Date.now()}, report);
    data.reports = (data.reports || []).filter(r => r.d !== t).concat(local); write(CK, data); rform = null;
    try{ const r = await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'report', report})}); data.reports = data.reports.filter(x => x.d !== t).concat(r.report); write(CK, data); toast('Report sent to LHQ'); }
    catch(e){ if(!offline(e)){ data.reports = data.reports.filter(x => x !== local); write(CK, data); toast(e.message); render(); return; }
      const q = read(QK, []).filter(x => !(x.t === 'r' && x.report.d === t)); q.push({t:'r', report}); write(QK, q); toast('Saved on this device. It goes to LHQ when you are back online.'); }
    render(); scrollTo(0, 0);
  }

  /* ---------- classes ---------- */
  function classesPage(){
    const C = data.classes || [];
    return backHome() + head('Classes', 'Official classes that don’t change. Everything else is one-to-one.', `<div class="acts"><button class="btn n" data-tclsnew>${ic('plus',16,2.4)} New class</button></div>`) +
      `<div class="card">${C.map(c => `<a class="it" href="#teach/class/${c.id}"><span class="t"><b>${esc(c.name)}</b><small>${esc(c.sub)} · ${c.stu.length} students · ${esc(c.mode)}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('') || '<p class="empty">No classes. Create one when the same students are taught a topic together, in person or online.</p>'}</div>
      <p class="note">Finishing a topic in a class starts its SRAs for every student who was there.</p>`;
  }
  function classPage(id){
    const c = (data.classes || []).find(x => x.id === id); if(!c) return back('#teach/classes', 'Classes') + '<p class="empty">Class not found.</p>';
    const I = items(), M = I.filter(x => c.stu.includes(stuOf(x.k)) && nk(x.sub) === nk(c.sub));
    return back('#teach/classes', 'Classes') + head(esc(c.name), `${esc(c.sub)} · ${esc(c.mode)}`, `<div class="acts"><a class="btn n" href="#teach/log/${encodeURIComponent('class:' + c.id)}">${ic('plus',16,2.4)} Log class session</a></div>`) +
      `<div class="card">${M.map(m => `<a class="it" href="#teach/student/${encodeURIComponent(m.k)}"><span class="t"><b>${esc(m.st)}</b><small>${esc(m.lv || '')}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('')}</div>
      <div class="acts"><button class="btn" data-tclsedit="${c.id}">${ic('edit',15)} Change students</button><button class="btn rd" data-tclsdel="${c.id}">Remove class</button></div>`;
  }
  function classSheet(id){
    const c = id ? (data.classes || []).find(x => x.id === id) : null, I = items();
    const subs = [...new Set(I.map(i => i.sub))].sort();
    let sub = c ? c.sub : subs[0] || '', pick = new Set(c ? c.stu : []), mode = c ? c.mode : 'in person';
    openSheet(`<div class="hx"><h3>${c ? 'Change class' : 'New class'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="tcN" value="${esc(c ? c.name : '')}" placeholder="e.g. Year 11 Chemistry, Saturday group"></label>
      <label class="f"><span>Subject</span><select class="in" id="tcSub">${subs.map(s => `<option ${s === sub ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <div class="cap">How it's taught</div><div id="tcMode"></div>
      <div class="cap" style="margin-top:12px">Students</div><div class="t-opts" id="tcStu"></div>
      <button class="btn n full" id="tcGo" style="margin-top:14px">Save class</button>`);
    const draw = () => { const S = I.filter(i => nk(i.sub) === nk(sub));
      $('tcMode').innerHTML = `<div class="t-opts g2">${[['in person','In person'],['online','Online']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${mode === v}" class="t-opt${mode === v ? ' on' : ''}" data-tcm="${v}"><span class="t-ind c"></span><span class="tx">${l}</span></button>`).join('')}</div>`;
      $('tcStu').innerHTML = S.map(i => `<button type="button" role="checkbox" aria-checked="${pick.has(stuOf(i.k))}" class="t-opt${pick.has(stuOf(i.k)) ? ' on' : ''}" data-tcs="${esc(stuOf(i.k))}"><span class="t-ind s"></span><span class="tx">${esc(i.st)}</span></button>`).join('') || '<p class="note">None of your students take this subject.</p>';
      document.querySelectorAll('[data-tcs]').forEach(b => b.onclick = () => { const k = b.dataset.tcs; pick.has(k) ? pick.delete(k) : pick.add(k); draw(); });
      document.querySelectorAll('[data-tcm]').forEach(b => b.onclick = () => { mode = b.dataset.tcm; draw(); }); };
    $('tcSub').onchange = e => { sub = e.target.value; pick = new Set(); draw(); };
    draw();
    $('tcGo').onclick = async () => {
      const cls = {id: c ? c.id : undefined, name: $('tcN').value.trim(), sub, mode, stu: [...pick]};
      try{ const r = await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls})}); data.classes = (data.classes || []).filter(x => x.id !== r.cls.id).concat(r.cls); write(CK, data); closeSheet(); toast('Class saved'); location.hash = '#teach/class/' + r.cls.id; }
      catch(e){ toast(e.message); }
    };
  }

  /* ---------- the Log chooser ---------- */
  function chooser(k){
    const P = pendingWa().length, it = k && itemOf(k);
    const row = (h, i, c, b, s) => `<a class="t-opt" href="${h}" style="margin-bottom:8px;text-decoration:none"><span class="t-ico ${c}" aria-hidden="true">${i}</span><span class="tx">${b}<small>${s}</small></span></a>`;
    openSheet(`<div class="hx"><h3>What are you logging?</h3><button class="ib" data-close>✕</button></div>${it ? `<p class="sp">${esc(it.st)} · ${esc(it.sub)}</p>` : ''}
      ${row('#teach/log/' + encodeURIComponent(k || 'pick'), 'S', 'bl', 'A session', 'Attendance, topics, SRAs, guide, weekly assessment given')}
      ${row('#teach/marks' + (k ? '/' + encodeURIComponent(k) : ''), 'R', 'ok', 'SRA marks', 'For an SRA handed in, today or earlier')}
      ${row('#teach/wa', 'A', 'am', 'Weekly assessment marks', P ? `${P} waiting for marks` : 'One student, or a whole class')}`);
    document.querySelectorAll('#sheet a.t-opt').forEach(a => a.addEventListener('click', () => { form = null; mform = null; wform = null; closeSheet(); }));
  }

  /* ---------- taps ---------- */
  const setPath = (o, p, v) => { const k = p.split('.'); const last = k.pop(); const t = k.reduce((a, x) => (a[x] = a[x] ?? {}), o); t[last] = v; };
  const getPath = (o, p) => p.split('.').reduce((a, x) => a == null ? a : a[x], o);
  const curForm = () => location.hash.startsWith('#teach/log') ? form : location.hash.startsWith('#teach/marks') ? mform : location.hash.startsWith('#teach/wa') ? wform : location.hash.startsWith('#teach/report') ? rform : null;
  function giveEntries(L){ return L.map(x => ({id: uid(), ty:'g', k:x.k, st:x.st, sub:x.sub, d:today(), tk:x.topic, rv:x.stage})); }
  function bindSheet(){
    document.querySelectorAll('#sheet [data-tgive]').forEach(el => el.onclick = () => { const x = unref(el.dataset.tgive); if(!x) return; closeSheet(); saveEntries(giveEntries([x]), true).then(ok => ok && toast(el.dataset.early ? 'Given early · still done on its review day' : 'Marked as given')); });
    document.querySelectorAll('#sheet [data-tin]').forEach(el => el.onclick = () => { const x = unref(el.dataset.tin); if(x) handInSheet(x); });
  }
  function bind(){
    const on = (sel, fn) => document.querySelectorAll('#main ' + sel).forEach(el => el.onclick = ev => fn(el, ev));
    // the report dot on the bar
    document.querySelectorAll('.t-dot').forEach(x => x.remove());
    if(data && tutorRole()){ const due = !todayRep(); document.querySelectorAll('a[href$="#teach/report"]').forEach(a => { if(a.closest('#main')) return; const d = document.createElement('span'); d.className = 't-dot' + (due ? '' : ' ok'); d.title = due ? 'Today\'s report is due' : 'Today\'s report is sent'; a.appendChild(d); }); }
    if(!data) return;
    on('[data-tlog]', el => chooser(el.dataset.tlog));
    on('[data-tgive]', el => { const x = unref(el.dataset.tgive); if(x) saveEntries(giveEntries([x]), true).then(ok => ok && toast(el.dataset.early ? 'Given early · still done on its review day · comes back after ' + nice(x.doOn) : 'Marked as given')); });
    on('[data-tgiveall]', () => { const G = SRA.today(sras(), today()).give; saveEntries(giveEntries(G), true).then(ok => ok && toast(`${G.length} marked as given`)); });
    on('[data-tin]', el => { const x = unref(el.dataset.tin); if(x) handInSheet(x); });
    on('[data-tsdet]', el => { const x = unref(el.dataset.tsdet); if(x) sraSheet(x); });
    const sw = document.querySelector('#main [data-tsraw]'); if(sw) sw.onchange = () => { write('lhq_teach_sraw', sw.value); render(); };
    on('[data-tclsnew]', () => classSheet());
    on('[data-tclsedit]', el => classSheet(el.dataset.tclsedit));
    on('[data-tclsdel]', async el => { if(!confirm('Remove this class? Its logged sessions stay.')) return; try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls:{id: el.dataset.tclsdel, del: true}})}); data.classes = data.classes.filter(c => c.id !== el.dataset.tclsdel); write(CK, data); location.hash = '#teach/classes'; }catch(e){ toast(e.message); } });
    // cards and sections
    on('[data-tedit]', el => { editing = el.dataset.tedit || null; render(); });
    on('[data-tcmv]', el => { const L = homeCards(), [i, d] = el.dataset.tcmv.split('|').map(Number); [L[i], L[i + d]] = [L[i + d], L[i]]; saveCards('teach', L); });
    on('[data-tcrm]', el => saveCards('teach', homeCards().filter(x => x !== el.dataset.tcrm)));
    on('[data-tcadd]', el => { saveCards('teach', homeCards().concat(el.dataset.tcadd)); toast('Card added'); });
    const secs = () => (myCards('tstudent') || ['ses','sra','wa','time']).filter(x => SECS[x]);
    on('[data-tsmv]', el => { const L = secs(), [i, d] = el.dataset.tsmv.split('|').map(Number); [L[i], L[i + d]] = [L[i + d], L[i]]; saveCards('tstudent', L); });
    on('[data-tsrm]', el => saveCards('tstudent', secs().filter(x => x !== el.dataset.tsrm)));
    on('[data-tsadd]', el => saveCards('tstudent', secs().concat(el.dataset.tsadd)));
    // forms: circles, ticks, typing
    const f = curForm(); if(!f) return;
    const ro = f === rform && todayRep() && !f.change;
    on('[data-tset]', el => { if(ro) return; const p = el.dataset.tset, v = el.dataset.v;
      if(p === 'rate') f.rate = +f.rate === +v ? 0 : +v; else if(p === 'sra'){ f.sra = v; } else if(p.startsWith('att.')) f.att[p.slice(4)] = v; else setPath(f, p, v);
      if(f === form && p === 'fmt' && /^1/.test(v) && f.keys.length > 1) toast('More than one student: choose a group type');
      render(); });
    on('[data-ttog]', el => { if(ro) return; const k = el.dataset.ttog, i = k.indexOf(':'), kind = i > 0 ? k.slice(0, i) : null, val = i > 0 ? k.slice(i + 1) : null;
      const flip = (arr, x) => arr.includes(x) ? arr.filter(y => y !== x) : arr.concat(x);
      if(kind === 'tp' || kind === 'waTp'){ f[kind] = flip(f[kind], val); if(kind === 'tp') f.fin = f.fin.filter(x => f.tp.includes(x)); }
      else if(kind === 'fin') f.fin = flip(f.fin, val);
      else if(kind === 'give') f.give = flip(f.give, val);
      else if(kind === 'ldoff') f.ldOff = flip(f.ldOff || [], val);
      else if(kind === 'keys'){ f.keys = flip(f.keys, val); f.att[val] = f.att[val] || 'attended'; if(f.keys.length > 1 && /^1/.test(f.fmt)) f.fmt = f.fmt === '1o' ? 'go' : 'gi'; f.give = [...new Set(f.give.concat(sras().filter(x => x.k === val && x.status === 'give').map(ref)))].filter(r => f.keys.includes(decodeURIComponent(r.split('/')[0]))); const it0 = itemOf(f.keys[0]), dow = DAYC[new Date().getDay()]; if(it0 && !f.t1){ f.t1 = tStart(it0, dow); f.t2 = tEnd(it0, dow); } }
      else if(kind === 'abs') f.abs[val] = !f.abs[val];
      else if(kind === 'why') f.flag.why = flip(f.flag.why, val);
      else { f[k] = typeof f[k] === 'boolean' ? !f[k] : f[k] ? 0 : 1; if(k === 'open' || k === 'waOpen'){ f[k === 'open' ? 'q' : 'wq'] = ''; } }
      render(); });
    document.querySelectorAll('#main [data-tin]').forEach(el => { const ev = el.tagName === 'SELECT' ? 'onchange' : 'oninput'; el[ev] = () => {
      const p = el.dataset.tin; if(p.startsWith('marks.')) f.marks[p.slice(6)] = el.value; else setPath(f, p, el.value);
      if(el.dataset.tpc) $(el.dataset.tpc).textContent = pct(f.sc, f.mx);
      if(el.dataset.twpc) document.querySelectorAll('#main [data-twp]').forEach(b => { const k = b.dataset.twp; b.textContent = f.abs[k] ? '' : pct(f.marks[k], f.mx); });
      if(el.dataset.tin === 'rv' || el.dataset.tin === 'tk') return; }; });
    document.querySelectorAll('#main [data-tq]').forEach(el => el.oninput = () => { const qk = el.dataset.tq, key = qk === 'q' ? 'tp' : 'waTp'; f[qk] = el.value;
      const box = document.querySelector(`#main [data-tql="${qk}"]`), tmp = document.createElement('div'); tmp.innerHTML = topicPicker(f, key, qk === 'q' ? 'open' : 'waOpen', qk, ''); const nb = tmp.querySelector(`[data-tql="${qk}"]`);
      if(box && nb){ box.innerHTML = nb.innerHTML; box.querySelectorAll('[data-ttog]').forEach(b => b.onclick = () => { const v = b.dataset.ttog.slice(key.length + 1); f[key] = f[key].includes(v) ? f[key].filter(x => x !== v) : f[key].concat(v); if(key === 'tp') f.fin = f.fin.filter(x => f.tp.includes(x)); render(); });
        box.querySelectorAll('[data-taddtp]').forEach(b => b.onclick = () => addTp(b)); } });
    const addTp = b => { const key = b.dataset.taddtp, qk = key === 'tp' ? 'q' : 'wq', v = (f[qk] || '').trim(); if(v && !f[key].includes(v)) f[key] = f[key].concat(v); f[qk] = ''; render(); };
    document.querySelectorAll('#main [data-taddtp]').forEach(b => b.onclick = () => addTp(b));
    const who = document.querySelector('#main [data-twho]'); if(who) who.onchange = () => { const v = who.value; const nf = newForm(v); form = Object.assign(nf, {nt: f.nt, n: f.n}); if(v === 'group'){ form.keys = []; form.att = {}; form.give = []; } location.hash !== '#teach/log/' + encodeURIComponent(v) ? history.replaceState(null, '', '#teach/log/' + encodeURIComponent(v)) : 0; render(); };
    const mk = document.querySelector('#main [data-tmk]'); if(mk) mk.onchange = () => { f.k = mk.value; f.sra = ''; render(); };
    const ww = document.querySelector('#main [data-twwho]'); if(ww) ww.onchange = () => { const v = ww.value, {M} = v ? members(v) : {M: []}; Object.assign(f, {key: v, keys: M.map(m => m.k), ids: {}, marks: {}, abs: {}, tp: []}); render(); };
    on('[data-twpick]', el => { const v = el.dataset.twpick, w = pendingWa().find(x => x.id === v); wform = w ? fromPending(w) : {pend:'new', key:'', keys:[], ids:{}, tp:[], d:today(), mx:'', marks:{}, abs:{}, open:false, q:''}; render(); });
    const fl = document.querySelector('#main [data-tflag]'); if(fl) fl.onchange = () => { f.flag = {st: fl.value, why: [], text: ''}; render(); };
    on('[data-taddreq]', () => { f.req.push({item:'', qty:'1', by:'', for:''}); render(); });
    on('[data-trmreq]', el => { f.req.splice(+el.dataset.trmreq, 1); render(); });
    on('[data-trsend]', el => sendReport(el.dataset.trsend === 'force'));
    on('[data-trnowarn]', () => { f.warn = 0; render(); });
    on('[data-trchange]', () => { f.change = 1; render(); });
    if($('tSave')) $('tSave').onclick = saveLog;
    if($('tDel')) $('tDel').onclick = () => { if(!confirm('Delete this log?')) return; const L = live().filter(e => (e.grp || e.id) === form.grp && ['s','g'].includes(e.ty) || (e.ty === 'w' && e.grp === form.grp && (e.sc == null || e.sc === ''))).map(e => Object.assign({}, e, {x:1})); form = null; saveEntries(L, true).then(() => { toast('Log deleted'); location.hash = '#teach'; }); };
    if($('tmSave')) $('tmSave').onclick = saveMarks;
    if($('tmDel')) $('tmDel').onclick = () => { if(!confirm('Delete this log?')) return; const e = live().find(x => x.id === mform.edit); mform = null; saveEntries([Object.assign({}, e, {x:1})], true).then(() => { toast('Log deleted'); location.hash = '#teach'; }); };
    if($('twSave')) $('twSave').onclick = saveWa;
  }
  const isTutor = () => me().role === 'tutor' || !!me().tutor;
  return {page, bind, isTutor, refresh: fetchData, items, sras, sessions, gaps, pendingWa, dayLogs};
})();
