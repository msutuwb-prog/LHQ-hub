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
.t-opts{display:grid;gap:8px}.t-opts.g2{grid-template-columns:1fr 1fr}.t-opts.g3{grid-template-columns:repeat(3,minmax(0,1fr))}.t-opts.g5{grid-template-columns:repeat(5,minmax(0,1fr))}
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
.cal-nav{display:flex;align-items:center;gap:8px;margin:0 0 12px;flex-wrap:wrap}.cal-nav b{flex:1;min-width:140px;text-align:center}.cal-t{flex:none;width:48px;font-weight:800;font-size:14px;line-height:1.2}.cal-t small{display:block;color:var(--muted);font-weight:600;font-size:12px}
.cal-m{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.cal-m .h{text-align:center;font-size:12px;font-weight:800;color:var(--muted)}.cal-d{border:1px solid var(--line2);background:var(--surface);border-radius:10px;min-height:52px;padding:5px;display:flex;flex-direction:column;align-items:center;text-decoration:none;color:var(--ink)}.cal-d.out{opacity:.4}.cal-d.now{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}.cal-d small{margin-top:auto;background:var(--accent);color:var(--onaccent);border-radius:99px;font-size:11px;font-weight:800;padding:0 7px}.cal-d small.cl{background:var(--rd);color:#fff}.cal-d small.cg{background:var(--am);color:#fff}
.t-pk{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-top:10px}
.t-pk .row{display:flex;align-items:center;gap:8px;font-weight:800}.t-pk .row span{flex:1}
.t-x{border:0;background:none;color:var(--muted);font-size:20px;line-height:1;padding:2px 6px;cursor:pointer}
.t-tl .tm{width:44px;flex:none;font-weight:800;font-size:13px;color:var(--muted)}
.t-ico{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex:none;font-weight:800}
.t-obl{border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:10px}.t-ob{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;border-top:1px solid var(--line2);background:none;font:inherit;color:var(--ink);text-align:left;cursor:pointer}.t-ob:first-child{border-top:0}.t-ob:hover{background:var(--hover)}
.t-obm{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:900;flex:none;font-size:13px}.t-obm.o2{background:var(--ok);color:#fff}.t-obm.o1{background:var(--am-bg);color:var(--am);box-shadow:inset 0 0 0 2px var(--am)}.t-obm.o0{background:var(--rd-bg);color:var(--rd);box-shadow:inset 0 0 0 2px var(--rd)}
.t-obt{display:flex;align-items:center;gap:10px;margin-bottom:10px}.t-obt b{font-size:16px}.t-obt span{flex:1;color:var(--brand);font-weight:800}
.t-ars{display:grid;grid-template-columns:auto auto 64px 1fr;gap:10px;align-items:center}.t-ars>span{color:var(--muted)}.t-ars>b{color:var(--brand);font-size:17px;text-align:right}.t-stp{display:flex;align-items:center;gap:6px}.t-stp button{width:42px;height:42px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-size:20px;font-weight:800;cursor:pointer}.t-stp b{min-width:46px;text-align:center;font-size:22px;color:var(--ink)}
.t-score{display:grid;grid-template-columns:1fr auto 1fr 56px;gap:8px;align-items:center}.t-score span{color:var(--muted)}.t-score b{color:var(--brand);font-size:17px;text-align:right}
.t-marks{display:grid;grid-template-columns:1fr 78px 56px;gap:8px;align-items:center}.t-marks .nm{font-weight:700}.t-marks b{text-align:right;color:var(--brand)}
.t-req{border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.t-sl{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-weight:900;flex:none}.t-sl.now{background:var(--rd-bg,rgba(180,35,24,.12));color:var(--rd)}.t-sl.watch{background:var(--am-bg);color:var(--am)}
.t-slg{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;padding:10px 0 2px}.t-slg.now{color:var(--rd)}.t-slg.watch{color:var(--am)}
.t-tl{color:var(--am);font-weight:800}.t-tl.lt{color:var(--brand)}
.t-told{background:var(--am-bg);color:var(--am);border-radius:12px;padding:9px 12px;margin-bottom:10px;font-weight:700;font-size:13px}
.t-banner{display:flex;gap:12px;align-items:center;background:var(--am-bg);color:var(--am);border-radius:14px;padding:12px 14px;margin-bottom:14px;font-weight:700;font-size:13.5px;text-decoration:none}
.t-banner b{display:block;color:var(--ink)}.t-banner.ok{background:var(--ok-bg);color:var(--ok)}
.t-warn{background:var(--am-bg);color:var(--am);border-radius:12px;padding:12px;font-weight:700;font-size:13.5px;margin:0 0 12px}
.t-warn .acts{margin-top:10px}
.t-segw{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:var(--surface);margin:0 0 14px}
.t-segw a{text-align:center;text-decoration:none;font-weight:700;padding:9px 0;color:var(--muted)}.t-segw a.on{background:var(--accent);color:var(--onaccent)}
.t-chips6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin-top:8px}
.t-chips6 button{min-width:0;overflow-wrap:anywhere;border:0;padding:5px 2px;text-align:center;line-height:1.25;font:inherit;font-size:10.5px;font-weight:800;border-radius:6px;cursor:pointer}
.t-chips6 button span{display:block;font-size:10px;opacity:.8}
.t-chips6 button.tag{white-space:normal;padding:5px 1px;letter-spacing:0;overflow:hidden}
.t-ses{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;margin:4px 0 10px}
.t-ses div{background:var(--bg);border-radius:12px;padding:10px 4px}.t-ses b{display:block;font-size:20px;color:var(--brand)}.t-ses small{color:var(--muted);font-size:11.5px;font-weight:700}
.t-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;font-size:13.5px}.t-kv span{color:var(--muted)}.t-kv b{font-weight:700;text-align:right}
.t-pbar{display:block;height:6px;border-radius:99px;background:var(--gr-bg);overflow:hidden;margin:6px 0 3px;position:relative}.t-pbar i{display:block;height:100%;background:var(--gold)}
.t-pbar b{position:absolute;top:0;bottom:0;width:2px;background:var(--ink);opacity:.55}
.t-w5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-top:10px}.t-w5 button{border:0;background:none;cursor:pointer;padding:4px 0;border-radius:8px;color:inherit;font:inherit}.t-w5 button:hover{background:var(--hover)}.t-w5 span{display:flex;gap:3px;justify-content:center;align-items:flex-end;height:74px}.t-w5 i{width:10px;border-radius:3px 3px 0 0}.t-w5 small{display:block;font-size:11px;color:var(--muted);text-align:center}
.t-w5 i.f,.t-lg i.f{background:var(--accent)}.t-w5 i.p,.t-lg i.p{background:var(--gold)}.t-lg{display:flex;gap:12px;font-size:11.5px;color:var(--muted);margin-top:4px}.t-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.t-tk{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);background:var(--surface);flex:none;cursor:pointer;color:#fff;font-weight:900}.t-tk.on{background:var(--ok);border-color:var(--ok)}.cal-d .t-star{position:absolute;top:2px;right:4px;font-style:normal;font-size:10px;color:var(--gold)}.cal-d{position:relative}
.t-sgrid{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(6,minmax(0,1fr));gap:4px;font-size:12px;align-items:center}
.t-sgrid .t-tl{cursor:pointer;border-radius:6px}.t-sgrid .t-tl:hover{background:var(--hover)}
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
      try{ const j = await hub.api('tutor'); data = {cards: j.cards || [], entries: j.entries || [], classes: j.classes || [], reports: j.reports || [], avail: j.avail || [], acks: j.acks || {}, gone: j.gone || [], ackFrom: j.ackFrom || 0, calLink: j.calLink || '', makeups: j.makeups || [], reqs: j.reqs || {}, clashes: j.clashes || [], says: j.says || null, sradone: j.sradone || {}, notices: j.notices || [], exam: j.exam || null, kpiOn: !!j.kpiOn, sx: j.sx || {}, tsee: !!j.tsee, asks: j.asks || [], obj: j.obj || {on: false, subs: [], L: {}}, fu: j.fu || [], at: Date.now()}; write(CK, data); err = ''; }
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
      const q = read(QK, []); q.push({t:'e', entries: list}); write(QK, q); if(!quiet) toast('Saved · sends when online'); return true; }
  }

  /* roster: one item per student + subject, from the newest tuition card */
  function items(){
    if(!data) return [];
    const by = new Map();
    data.cards.slice().sort((a, b) => (a.periodStart || a.date || '').localeCompare(b.periodStart || b.date || '')).forEach(c => (c.subjects || []).forEach(x => {
      const k = nk(c.student) + '|' + nk(x.name), was = by.get(k);
      let topics = []; try{ if(window.cardTopicNames) topics = cardTopicNames(cardFixPicks(JSON.parse(JSON.stringify(x)))); }catch(e){}
      const periods = (was ? was.periods : []).concat(c.periodStart && c.periodEnd ? [{a: c.periodStart, b: c.periodEnd, days: x.days || []}] : []);
      by.set(k, {k, st: c.student, sub: x.name, lv: c.level, days: x.days || [], times: x.times || {}, start: x.start || '', end: x.end || '', where: c.where || '',
        a: was ? was.a : (c.periodStart || ''), b: c.periodEnd || '', pa: c.periodStart || '', cap: parseFloat(x.sessions) || 0, card: c, x, topics: topics.length ? topics : (was ? was.topics : []), periods});
    }));
    return [...by.values()].sort((a, b) => a.st.localeCompare(b.st) || a.sub.localeCompare(b.sub));
  }
  const live = () => (data ? data.entries : []).filter(e => !e.x);
  const tStart = (it, d) => { const o = (it.times || {})[d]; return (o && o.s) || it.start || ''; };
  const tEnd = (it, d) => { const o = (it.times || {})[d]; return (o && o.s) ? (o.e || '') : it.end || ''; };
  const timeOf = (it, d) => { const s = tStart(it, d), e = tEnd(it, d); return s ? `${s}–${e}` : 'time TBC'; };
  const sras = () => SRA.build(items(), live(), today());
  const stuOf = k => k.split('|')[0];
  /* absence and late notices from students and parents (not undone) */
  const tolds = () => ((data && data.notices) || []).filter(n => n && !n.x);
  const noticeOf = (k, d) => tolds().find(n => n.k === k && n.d === d) || null;
  const toldL = n => n.kind === 'late' ? `about ${n.mins} min late` : `absent · ${String(n.why || '').toLowerCase()}`;
  const itemOf = k => items().find(i => i.k === k);
  const short = n => { const p = String(n || '').split(' '); return p[0] + (p[1] ? ' ' + p[1][0] + '.' : ''); };
  const hm = ms => { const d = new Date(ms || 0); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const isoOfMs = ms => HD.isoOf(new Date(ms || 0));
  const mins = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
  const hoursOf = e => e.t1 && e.t2 && mins(e.t2) > mins(e.t1) ? (mins(e.t2) - mins(e.t1)) / 60 : 1;
  const pct = (sc, mx) => { const s = parseFloat(sc), m = parseFloat(mx); return s >= 0 && m > 0 && s <= m ? Math.round(s / m * 100) + '%' : ''; };
  /* ARS (Active Recall Sheet): done from memory before every SRA, on paper; the Hub keeps the total, in ½ steps, out of the topic's objectives */
  const half = v => v == null || v === '' ? '–' : +v === .5 ? '½' : String(Math.floor(+v)) + (+v % 1 ? '½' : '');
  const aoOf = tk => { const L = live().filter(e => e.ty === 'r' && e.tk === tk && +e.ao > 0).sort((a, b) => (b.at || 0) - (a.at || 0) || (b.d || '').localeCompare(a.d || '')); return L.length ? String(L[0].ao) : ''; };
  /* ARS by objective (Director switch, per subject): tap what wasn't recalled, ✓ → ½ → ✕; the score is the objectives recalled, ½ counts half */
  const OBJ = () => (data && data.obj) || {on: false, subs: [], L: {}};
  const objOn = sub => { const o = OBJ(); return !!sub && o.on && (!(o.subs || []).length || o.subs.some(x => SCHED.nk(x) === SCHED.nk(sub))); };
  const defObj = tk => { const T = window.TOPICS || {}; for(const L of Object.keys(T)) for(const n of Object.keys(T[L])){ const c = ((T[L][n] || {}).topics || []).find(t => t && t.sub && SCHED.nk(t.t) === SCHED.nk(tk)); if(c) return c.sub.map(x => x.t); } return []; };
  const objList = (sub, tk) => { const v = (OBJ().L || {})[SCHED.nk(sub) + '|' + SCHED.nk(tk)]; return v && (v.l || []).length ? v.l : defObj(tk); };
  const OBM = ['✕', '½', '✓'];
  const omSync = a => { if(a.na || !objOn(a.osub)) return null; const L = objList(a.osub, a.otk); if(!L.length) return null;
    const o = {}; L.forEach(n => o[n] = a.om && a.om[n] != null ? +a.om[n] : 2); a.om = o; a.ao = String(L.length); a.ars = L.reduce((s, n) => s + o[n], 0) / 2; return L; };
  const arsHTML = (a, card = true) => { const L = omSync(a), p = !a.na && a.ars != null && +a.ao > 0 ? pct(a.ars, a.ao) : '';
    const edit = `<div class="cap">Objectives · ${esc(a.otk || '')}</div><textarea class="in" data-arsl rows="6" placeholder="One per line">${esc((a.otk ? objList(a.osub, a.otk) : []).join('\n'))}</textarea><p class="note" style="margin:6px 0 8px">Kept for the topic · every student</p><div style="display:flex;gap:8px"><button type="button" class="btn" style="flex:1" data-ars="edx">Cancel</button><button type="button" class="btn n" style="flex:1" data-ars="eds">Save objectives</button></div>`;
    const objs = L ? `<div class="cap">ARS <small style="text-transform:none;letter-spacing:0">· tap what wasn't recalled</small></div><div class="t-obl">${L.map((n, i) => `<button type="button" class="t-ob" data-ars="o${i}"><span class="t-obm o${a.om[n]}">${OBM[a.om[n]]}</span><span>${esc(n)}</span></button>`).join('')}</div>
      <div class="t-obt"><b>ARS ${half(a.ars)} / ${L.length}</b><span>${p}</span><button type="button" class="btn sm" data-ars="ed">${PEN()}</button></div>` : '';
    const num = `<div class="cap">ARS <small style="text-transform:none;letter-spacing:0">· recall before the SRA</small></div>${a.na ? '' : `<div class="t-ars"><div class="t-stp"><button type="button" data-ars="m" aria-label="Half a mark less">−</button><b>${half(a.ars)}</b><button type="button" data-ars="p" aria-label="Half a mark more">+</button></div><span>of</span><input class="in" data-arso inputmode="numeric" value="${esc(a.ao || '')}" placeholder="?" aria-label="ARS out of"><b>${p}</b></div><p class="note" style="margin:6px 0 10px">Out of: the topic's objectives · kept for the topic</p>${objOn(a.osub) && a.otk ? `<button type="button" class="btn sm" data-ars="ed" style="margin-bottom:10px">${ic('plus',14,2.4)} Add the objectives</button>` : ''}`}`;
    const naB = `<button type="button" role="checkbox" aria-checked="${!!a.na}" class="t-opt${a.na ? ' on' : ''}" data-ars="na"><span class="t-ind s"></span><span class="tx">No ARS handed in<small>The SRA marks still save</small></span></button>`;
    const inner = a.edObj ? edit : (objs || num) + naB;
    return card ? `<div class="card pad">${inner}</div>` : `<div style="margin-top:14px">${inner}</div>`; };
  const bindArs = (root, a, again) => { root.querySelectorAll('[data-ars]').forEach(b => b.onclick = async () => { const k = b.dataset.ars, mx = +a.ao > 0 ? +a.ao : 99;
      if(/^o\d+$/.test(k)){ const L = objList(a.osub, a.otk), n = L[+k.slice(1)]; if(n != null) a.om[n] = (a.om[n] + 2) % 3; }
      else if(k === 'ed') a.edObj = true; else if(k === 'edx') a.edObj = false;
      else if(k === 'eds'){ const t = root.querySelector('[data-arsl]'), l = (t ? t.value : '').split('\n').map(x => x.trim()).filter(Boolean);
        try{ await hub.api('tutor', {method: 'POST', body: JSON.stringify({action: 'obj', sub: a.osub, tk: a.otk, l})}); const o = OBJ(); o.L = o.L || {}; const key = SCHED.nk(a.osub) + '|' + SCHED.nk(a.otk); if(l.length) o.L[key] = {sub: a.osub, tk: a.otk, l}; else delete o.L[key]; if(data){ data.obj = o; write(CK, data); } a.edObj = false; a.om = null; toast('Objectives saved'); }catch(e){ toast(e.message); return; } }
      else if(k === 'na') a.na = !a.na; else if(k === 'p') a.ars = Math.min(mx, a.ars == null ? .5 : +a.ars + .5); else a.ars = Math.max(0, a.ars == null ? 0 : +a.ars - .5); again(); });
    const o = root.querySelector('[data-arso]'); if(o) o.onchange = () => { const v = parseInt(o.value, 10); a.ao = v > 0 ? String(Math.min(v, 40)) : ''; if(a.ars != null && +a.ao > 0) a.ars = Math.min(+a.ars, +a.ao); again(); }; };
  const arsOk = a => a.na || (a.ars != null && +a.ao > 0 && +a.ars <= +a.ao);
  const arsTo = (e, a) => { delete e.ars; delete e.ao; delete e.na; delete e.om; if(a.na) e.na = 1; else { const L = omSync(a); e.ars = +a.ars; e.ao = +a.ao; if(L) e.om = Object.assign({}, a.om); } return e; };
  const taught = a => a !== 'absent' && a !== 'cancelled';
  const weekEnd = t => addDays(t, (7 - HD.parseISO(t).getDay()) % 7);
  const weekStart = t => addDays(t, -((HD.parseISO(t).getDay() + 6) % 7));
  const isDay = (it, d) => SRA.isDay(it, d);
  const ref = x => [x.k, x.topic, x.stage].map(v => encodeURIComponent(v)).join('/');
  const unref = v => { const [k, topic, st] = String(v).split('/').map(decodeURIComponent); return sras().find(x => x.k === k && x.topic === topic && x.stage === +st); };
  const tutorRole = () => me().role === 'tutor';
  const todayRep = () => (data.reports || []).find(r => r.d === today());
  const ATT = [['attended','On time'],['late','Late'],['absent','Absent'],['cancelled','Cancelled']];
  /* assessment types (a 'w' entry's ak; none = Weekly) and the ones scheduled ahead (ty 'a') */
  const ATY = [['w','Weekly'],['m','Monthly'],['p','Past paper']], akN = k => k === 't' ? 'w' : k === 'k' ? 'p' : (k || 'w'), atyL = k => (ATY.find(x => x[0] === akN(k)) || ATY[0])[1];
  const scheduled = () => live().filter(e => e.ty === 'a');
  const schedOpen = (keys, d) => { const done = new Set(live().filter(e => e.ty === 'w' && e.sch).map(e => e.sch)); return scheduled().filter(a => keys.includes(a.k) && !done.has(a.ag || a.id) && a.d >= addDays(d, -3) && a.d <= addDays(d, 1)); };
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
  /* whether the student has confirmed: one line for a session (or a class: the least settled state among its students) */
  function cfText(G){
    const S = G.map(x => HD.cfState(x)).filter(Boolean); if(!S.length) return '';
    if(S.includes('disputed')){ const x = G.find(y => HD.cfState(y) === 'disputed'); return `! disputed: ${x.cf.note}`; }
    if(S.includes('waiting')){ const h = Math.max(1, Math.round(Math.max(...G.filter(y => HD.cfState(y) === 'waiting').map(HD.cfLeft)) / 36e5)); return `waiting for confirmation · confirms itself in ${h} h`; }
    if(S.includes('settled')){ const x = G.find(y => HD.cfState(y) === 'settled'); return x.cf.out === 'keep' ? '✓ settled: your times stand' : `✓ settled: ${x.cf.lost} min taken off`; }
    return '✓ confirmed';
  }
  function dayLogs(d){
    const E = live(), out = [], seen = new Set();
    E.filter(e => e.ty === 's' && e.d === d).forEach(e => { const g = e.grp || e.id; if(seen.has(g)) return; seen.add(g);
      const G = E.filter(x => x.ty === 's' && (x.grp || x.id) === g), c = Math.min(...G.map(x => x.c || x.at || 0)), at = Math.max(...G.map(x => x.at || 0));
      const cls = e.cls && (data.classes || []).find(x => x.id === e.cls);
      out.push({kind:'s', id:g, c, at, ic:'S', col:'bl', b:`${cls ? cls.name : G.map(x => short(x.st)).join(', ')} · ${e.sub}`, s:[e.t1 ? `${e.t1}–${e.t2 || ''}` : '', FMTL[e.fmt] || '', G.some(x => !taught(x.a)) ? G.map(x => taught(x.a) ? '' : short(x.st) + ' ' + ATTL[x.a].toLowerCase()).filter(Boolean).join(', ') : '', (e.tp || []).map(t => t + ((e.fin || []).includes(t) ? ' (finished)' : '')).join(', '), cfText(G)].filter(Boolean).join(' · ')}); });
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
    SRA.packs(sras(), t, 0).filter(p => !p.out && p.on <= t && p.on >= addDays(t, -3)).forEach(p => g.push({href:'#teach/sra/pack', b:`${short(p.st)} · take-home pack`, s:`${p.sub} · ${p.sheets.length} sheet${p.sheets.length === 1 ? '' : 's'} · ${p.on === t ? 'last session today' : 'last session ' + nice(p.on)} · not ticked as handed over`}));
    pendingWa().filter(w => w.d < t).forEach(w => g.push({href:'#teach/wa/' + encodeURIComponent(w.id), b:`${w.name} · ${atyL(w.ak).toLowerCase()} assessment`, s:`Given ${nice(w.d)} · marks not entered`}));
    return g;
  }
  /* weekly assessments given and waiting for marks, one per class sitting or student */
  function pendingWa(){
    const W = live().filter(e => e.ty === 'w'), by = new Map();
    W.forEach(e => { const g = e.wid || e.id; if(!by.has(g)) by.set(g, []); by.get(g).push(e); });
    return [...by.entries()].filter(([g, G]) => G.every(x => (x.sc == null || x.sc === '') && !x.abs)).map(([g, G]) => { const cls = G[0].cls && (data.classes || []).find(c => c.id === G[0].cls);
      return {id:g, G, d:G[0].d, sub:G[0].sub, tp:G[0].tp || [], mx:G[0].mx || '', ak:G[0].ak || 'w', name: cls ? cls.name : G.length > 1 ? G.map(x => short(x.st)).join(', ') : short(G[0].st)}; }).sort((a, b) => a.d.localeCompare(b.d));
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
  let form = null, editing = null, wform = null, mform = null, rform = null, aform = null;
  /* ---------- the tutor's schedule: new or changed cards, the calendar, unavailable times, the phone link ---------- */
  const myName = () => { try{ return (hub.session().me || {}).name || ''; }catch(e){ return ''; } };
  const DN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'}, DORDER = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  /* cards new to this tutor, cards whose lines for them changed, and cards they were taken off */
  function notices(){
    if(!data || !window.SCHED) return [];
    const me = myName(), acks = data.acks || {}, out = [];
    (data.cards || []).forEach(c => {
      const sig = SCHED.sigFor(c, me), a = acks[c.id];
      if(a && a.sig === sig && a.s !== 'gone') return;
      if(!a && Math.max(c.updatedAt || 0, c.savedAt || 0) < (data.ackFrom || 0)) return;   // already on their list before acknowledgements started
      const C = SCHED.checkCard(c, data.cards, {[SCHED.nk(me)]: data.avail || []}).filter(x => x.kind !== 'student');
      /* one line per kind of clash: "Already teaching then: Faith N., Thoko M. and 3 more (Mon 15:00, Wed 15:00)" */
      const busy = C.filter(x => x.kind === 'tutor'), un = C.filter(x => x.kind === 'unavailable'), who = [...new Set(busy.map(x => x.other))], when = [...new Set(busy.map(x => SCHED.DAYN[x.day] + ' ' + x.s))];
      const clash = un.map(x => ({text: x.text})).concat(busy.length ? [{text: `Already teaching then: ${who.slice(0, 3).map(short).join(', ')}${who.length > 3 ? ` and ${who.length - 3} more` : ''} (${when.join(', ')})`}] : []);
      out.push({kind: (a && a.s !== 'gone') || (c.createdAt || 0) < (data.ackFrom || 0) ? 'changed' : 'new', card: c, sig, lines: SCHED.linesFor(c, me), clash});
    });
    (data.gone || []).forEach(g => out.push({kind:'gone', card:{id:g.card, student:g.st, number:g.number}, lines:(g.subs || []).map(x => x + ' · no longer yours')}));
    return out;
  }
  /* a student (or parent) said a session wasn't right: the tutor answers first */
  const disputesMine = () => (data && data.entries || []).filter(e => e && !e.x && e.ty === 's' && e.cf && e.cf.s === 'disputed' && e.cf.step === 'tutor' && SCHED.nk(e.tutor) === SCHED.nk(myName()));
  const KIND = {late:'started', early:'ended', none:"didn't happen", other:''};
  function answersBlock(){
    const D = disputesMine(); if(!D.length) return '';
    return `<div class="h2">Needs you <em>${D.length}</em></div><div class="card" style="border-left:3px solid var(--gold)">${D.map(e => { const c = e.cf, who = short(c.from || e.st);
      const said = c.kind === 'late' ? `started ${c.t1 || 'late'}` : c.kind === 'early' ? `ended ${c.t2 || 'early'}` : c.kind === 'none' ? "didn't happen" : `“${c.note}”`;
      return `<div class="it" style="flex-wrap:wrap"><span class="ico" style="color:var(--am)">${ic('alert')}</span><span class="t"><b>${esc(who)}: ${esc(said)}</b><small>${esc(e.sub)} · ${nice(e.d)} · you logged ${esc(e.t1 || '')}${c.note && c.kind !== 'other' ? ' · “' + esc(c.note) + '”' : ''}</small></span>
        <span class="acts" style="width:100%;margin:8px 0 0 34px"><button class="btn sm n" data-tans="yes:${esc(e.id)}">Accept</button><button class="btn sm" data-tans="no:${esc(e.id)}">Keep mine</button></span></div>`; }).join('')}</div>`;
  }
  async function answer(id, accept, note){
    try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'answer', id, accept, note: note || ''})}); closeSheet(); toast(accept ? 'Accepted' : 'Kept'); await fetchData(); }catch(e){ toast(e.message); }
  }
  /* the bell */
  function bell(){
    if(!data) return {need: [], info: []};
    const need = [], info = [];
    disputesMine().forEach(e => need.push({t:`${short(e.cf.from || e.st)}: not right`, s:`${e.sub} · ${nice(e.d)}`, href:'#teach'}));
    notices().forEach(n => need.push({t:`${n.kind === 'new' ? 'New' : 'Changed'}: ${n.card.student}`, s:n.lines[0] || '', href:'#teach'}));
    (data.clashes || []).filter(c => !c.res || c.res.s !== 'together').forEach(c => need.push({t:`Clash · ${SCHED.DAYN[c.day]} ${c.members[0].s}`, s:c.members.map(m => m.st).join(', '), href:'#teach'}));
    (data.makeups || []).filter(m => m.status !== 'asked' && m.decidedAt && Date.now() - m.decidedAt < 7 * 864e5).forEach(m => info.push({t:`Make-up ${m.status === 'ok' ? 'confirmed' : 'declined'}`, s:`${m.st} · ${nice(m.d)} ${m.s}`, at:m.decidedAt, href:'#teach/makeups'}));
    tolds().filter(n => n.d >= today() && Date.now() - n.at < 7 * 864e5).forEach(n => info.push({t:`${short(n.name)}: ${n.kind === 'late' ? `about ${n.mins} min late` : "can't come"}`, s:`${n.sub} · ${n.d === today() ? 'today' : nice(n.d)} ${n.s}${n.why ? ' · ' + n.why.toLowerCase() : ''}`, at:n.at, href:'#teach'}));
    Object.values(data.reqs || {}).filter(v => v && v.at && Date.now() - v.at < 7 * 864e5).forEach(v => info.push({t:`${v.item}: ${v.s}`, s:v.note || '', at:v.at, href:'#teach'}));
    (data.entries || []).filter(e => e && e.cf && e.cf.agreed && e.cf.at && Date.now() - e.cf.at < 7 * 864e5 && SCHED.nk(e.tutor) === SCHED.nk(myName())).forEach(e => info.push({t:`${short(e.st)} agreed`, s:`${e.sub} · ${nice(e.d)}`, at:e.cf.at, href:'#teach'}));
    if(window.FUP) (data.fu || []).filter(f => !f.x && f.by < today() && !FUP.after(f, live())).forEach(f => need.push({t:`Follow-up overdue · ${short(f.st)}`, s:`${f.tk} · ${FUP.ACT[f.act]} · by ${nice(f.by)}`, href:'#teach/fu'}));
    return {need, info};
  }
  /* clashes on their cards: they have the final say */
  /* what students say: averages from students' daily reports, beside LHQ's, after 4 weeks; never single answers */
  function saysBlock(){
    const S0 = data.says; if(!S0 || (!S0.mine && !S0.opens && !S0.few)) return '';
    if(!S0.mine) return `<div class="h2">What students say</div><div class="card"><div class="it"><span class="ico">${ic('clock', 18)}</span><span class="t"><b>${S0.few ? 'Shows once 5 answers are in' : 'Shows from ' + nice(S0.opens)}</b><small>Averages only. Never single answers.</small></span></div></div>`;
    const M = S0.mine, A = S0.lhq || {}, f = (l, v, a, unit, gap) => `<div class="kpi"><small>${l}</small><b>${v}${unit}</b><span class="${v < a - gap ? 'dn' : v > a ? 'up' : 'fl'}">LHQ ${a}${unit}</span></div>`;
    return `<div class="h2">What students say <em>4 weeks</em></div><div class="kpis">${f('Sessions', M.rate, A.rate, '', .3)}${f('Prepared', M.prep, A.prep, '%', 10)}${f('Guides before', M.gb, A.gb, '%', 10)}${f('Topic', M.conf, A.conf, '', .3)}</div>
      <p class="note" style="margin:-8px 2px 14px">Averages of all your students, out of 5 where shown. Never single answers.</p>`;
  }
  function clashesBlock(){
    const C = (data.clashes || []).filter(c => !c.res || c.res.s !== 'together'); if(!C.length) return '';
    const KL = {group:'Together?', tutor:'Double-booked', student:'Student double-booked'};
    const row = c => `<div class="it" style="align-items:flex-start;flex-wrap:wrap"><span class="t" style="min-width:200px"><b style="white-space:normal">${SCHED.DAYN[c.day]} ${c.members[0].s} · ${esc(c.kind === 'group' ? c.sub : c.kind === 'student' ? c.st : 'two subjects')}</b><small>${KL[c.kind]} · ${c.members.map(m => esc(c.kind === 'group' ? m.st : c.kind === 'student' ? m.sub : `${m.st} (${m.sub})`)).join(', ')}</small>${c.res && c.res.s === 'admin' ? `<small>With LHQ</small>` : ''}</span>
      <span class="acts" style="margin-top:6px">${c.kind === 'group' ? `<button class="btn sm n" data-tclx="together:${esc(c.key)}">Together</button>` : ''}<button class="btn sm${c.kind === 'group' ? '' : ' n'}" data-tclmove="${esc(c.key)}">Move</button>${c.res ? '' : `<button class="btn sm" data-tclx="admin:${esc(c.key)}">Send to LHQ</button>`}</span></div>`;
    return `<div class="h2">Clashes to sort <em>${C.length}</em></div><div class="card">${C.slice(0, 4).map(row).join('')}${C.length > 4 ? `<details><summary class="it" style="cursor:pointer"><span class="t"><b>${C.length - 4} more</b></span></summary>${C.slice(4).map(row).join('')}</details>` : ''}</div>`;
  }
  async function clashDo(a, key, note){
    try{ await hub.api('clash', {method:'POST', body: JSON.stringify({action:a, key, note: note || ''})}); closeSheet(); await fetchData(); toast(a === 'together' ? 'Thanks: no longer a clash' : 'Sent to LHQ'); }catch(e){ toast(e.message); }
  }
  function noticesBlock(){
    const N = notices(); if(!N.length) return '';
    return `<div class="h2">New on your list <em>${N.length}</em></div><div class="card">${N.map(n => `<div class="it" style="align-items:flex-start;flex-wrap:wrap">
      <span class="t" style="min-width:200px"><b>${n.kind === 'new' ? 'New student' : n.kind === 'changed' ? 'Times changed' : 'Taken off your list'}: ${esc(n.card.student || '')}</b>
      ${n.lines.map(l => `<small>${esc(l)}</small>`).join('')}${(n.clash || []).map(x => `<small style="color:var(--rd);font-weight:700">! ${esc(x.text)}</small>`).join('')}
      ${n.kind !== 'gone' && (data.acks || {})[n.card.id] && data.acks[n.card.id].s === 'cant' ? `<small>“${esc(data.acks[n.card.id].note)}” · sent to LHQ</small>` : ''}</span>
      <span class="acts" style="margin-top:6px">${n.kind === 'gone' ? `<button class="btn sm n" data-tack="gone:${esc(n.card.id)}">OK</button>`
        : `<button class="btn sm n" data-tack="ok:${esc(n.card.id)}">Got it</button><button class="btn sm" data-tcant="${esc(n.card.id)}">Can't make this time</button>`}</span></div>`).join('')}</div>`;
  }
  async function ack(id, s, note){
    const n = notices().find(x => x.card.id === id);
    try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'ack', card:id, s, note: note || '', sig: n ? n.sig || '' : ''})}); await fetchData();
      toast(s === 'cant' ? 'Sent to LHQ: they\'ll find another time' : s === 'gone' ? 'Noted' : 'Thanks: it\'s in your calendar'); }
    catch(e){ toast(e.message); }
  }
  function cantSheet(id){
    const c = (data.cards || []).find(x => x.id === id); if(!c) return;
    openSheet(`<div class="hx"><h3>Can't make this time</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(c.student)} · ${SCHED.linesFor(c, myName()).map(esc).join(' · ')}</p>
      <label class="f"><span>What doesn't work, and what would</span><textarea class="in" id="tcantN" rows="3" placeholder="e.g. Tuesdays I teach at school until 15:00. Thursday 15:00 works."></textarea></label>
      <button class="btn n full" id="tcantGo">Send to LHQ</button>`);
    $('tcantGo').onclick = () => { const v = $('tcantN').value.trim(); if(!v){ toast('Say which times don\'t work'); return; } closeSheet(); ack(id, 'cant', v); };
  }

  /* the calendar: Week (a list by day), Day, Month; sessions from the cards, what was logged, unavailable times, clashes */
  let calView = 'week', calDate = '';
  const wkStart = d => { const x = HD.parseISO(d), k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return HD.isoOf(x); };
  function calEvents(from, to){
    const L = SCHED.sessions(data.cards, from, to, {tutor: myName()}), E = live().filter(e => e.ty === 's');
    (data.makeups || []).filter(m => m.status !== 'no' && m.d >= from && m.d <= to).forEach(m => L.push({date:m.d, day:SCHED.dayCode(m.d), s:m.s, e:m.e, a:mins(m.s), b:mins(m.e), tutor:m.tutor, student:m.st, sub:m.sub, k:m.k, where:'Make-up', mu:m}));
    L.sort((p, q) => p.date.localeCompare(q.date) || (p.a ?? 9999) - (q.a ?? 9999));
    const res = {}; (data.clashes || []).forEach(c => { if(c.res) res[c.key] = c.res; });
    const clash = new Map(); SCHED.clashes(L, res).forEach(c => { clash.set(c.a, c.kind); clash.set(c.b, c.kind); });
    return L.map(ev => { const lg = ev.mu ? null : E.find(e => e.k === ev.k && e.d === ev.date), un = SCHED.unavailable({x: data.avail || []}, 'x', ev.day, ev.a, ev.b).length;
      return Object.assign(ev, {log: lg, clash: clash.has(ev) || !!un, ck: un ? 'unavailable' : clash.get(ev) || '', un}); });
  }
  const evRow = ev => { const st = ev.log ? (ev.log.a === 'absent' ? 'absent' : ev.log.a === 'cancelled' ? 'cancelled' : 'had') : '';
    return `<a class="it" href="${ev.mu ? '#teach/makeups' : '#teach/log/' + encodeURIComponent(ev.k)}" style="${ev.clash ? 'border-left:3px solid ' + (ev.ck === 'group' ? 'var(--am)' : 'var(--rd)') : ev.mu && ev.mu.status === 'asked' ? 'border-left:3px dashed var(--am)' : ''}"><span class="cal-t">${ev.s || '?'}<small>${ev.e || ''}</small></span><span class="t"><b style="${st === 'absent' || st === 'cancelled' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(ev.student)} · ${esc(ev.sub)}</b><small>${ev.mu ? (ev.mu.status === 'asked' ? 'Make-up · waiting for LHQ' : 'Make-up · confirmed') : esc(ev.where || '')}${st ? ' · ' + {had:'✓ logged', absent:'student absent', cancelled:'cancelled'}[st] : ''}${!st && ev.k && noticeOf(ev.k, ev.date) ? ` · <span class="t-tl">${esc(toldL(noticeOf(ev.k, ev.date)))}</span>` : ''}${ev.clash ? ' · <span style="color:var(--rd);font-weight:700">' + (ev.un ? 'in your unavailable time' : 'clash') + '</span>' : ''}</small></span><span class="chev">›</span></a>`; };
  /* what a student chose to share: dates (by name) and busy times (no names) */
  const sxOf = st => ((data.sx || {})[nk(st)]) || {};
  const datesOn = (st, d) => (sxOf(st).dates || []).filter(x => d >= x.from && d <= (x.to || x.from));
  const busyHit = ev => (sxOf(ev.student).busy || []).find(b => b.d === ev.date && ev.a != null && mins(b.s) < ev.b && ev.a < mins(b.e));
  const askBtn = (ev, why) => ev.k ? `<button class="btn sm" type="button" data-taskmv="${esc(JSON.stringify({k: ev.k, d: ev.date, s: ev.s || '', st: ev.student, sub: ev.sub, why}))}">Ask LHQ to move</button>` : '';
  function sharedRows(x, L){
    const out = [], seen = new Set();
    [...new Set(items().map(it => it.st))].forEach(st => datesOn(st, x).forEach(dt => { const ev = L.find(e => nk(e.student) === nk(st)), key = st + dt.name; if(seen.has(key)) return; seen.add(key);
      const asked = ev && (data.asks || []).some(a => a.k === ev.k && a.d === x);
      out.push(`<div class="it" style="${ev && dt.busy ? 'border-left:3px solid var(--rd)' : ''}"><span class="cal-t" style="color:${ev && dt.busy ? 'var(--rd)' : 'var(--gold)'};font-size:16px">★</span><span class="t"><b>${esc(short(st))}: ${esc(dt.name)}</b><small>${esc(({exam: 'Exam paper', season: 'Exam season', school: 'School date', hol: 'Holiday', other: 'Their date'})[dt.type] || 'Their date')}${dt.busy ? ' · busy' : ''}${ev ? ' · ' + esc(ev.sub) + ' ' + (ev.s || '') + ' that day' : ''}</small></span>${ev && dt.busy ? (asked ? '<span class="note">Asked LHQ</span>' : askBtn(ev, dt.name)) : ''}</div>`); }));
    L.forEach(ev => { const b = busyHit(ev); if(!b) return; const asked = (data.asks || []).some(a => a.k === ev.k && a.d === x);
      out.push(`<div class="it" style="border-left:3px solid var(--rd)"><span class="cal-t" style="color:var(--rd)">${b.s}<small>${b.e}</small></span><span class="t"><b>${esc(short(ev.student))} busy</b><small>Overlaps ${esc(ev.sub)} ${ev.s} · told by ${esc(ev.student.split(' ')[0])}</small></span>${asked ? '<span class="note">Asked LHQ</span>' : askBtn(ev, 'busy ' + b.s + '–' + b.e)}</div>`); });
    return out.join('');
  }
  /* Plan my day (tutor): prepare before each session (SRAs to give and collect, dates the student shared), mark what's waiting, then the report */
  function tPlan(d, L){
    if(!L.length) return '';
    const nowM = d === today() ? new Date().getHours() * 60 + new Date().getMinutes() : -1, S = sras(), T0 = L.filter(e => e.a != null && !(e.log && ['absent','cancelled'].includes(e.log.a)) && !(e.mu && e.mu.status === 'no')).sort((p, q) => p.a - q.a), dn = (() => { try{ return JSON.parse(localStorage.getItem('lhq_tsteps') || '{}'); }catch(e){ return {}; } })(), out = [];
    if(!T0.length) return '';
    const T1 = T0.filter((e, i) => e.a > nowM && T0.findIndex(y => y.a === e.a && nk(y.student) === nk(e.student)) === i);
    T1.forEach(ev => { const give = S.filter(x => x.k === ev.k && x.giveOn === d && ['give','upcoming'].includes(x.status)), back = S.filter(x => x.k === ev.k && x.due === d && ['collect','late','given'].includes(x.status)), dt = datesOn(ev.student, d);
      out.push({a: ev.a - 15, b: ev.a - 5, t: 'Prepare: ' + short(ev.student), s: [give.length ? 'Give ' + give.map(x => x.topic + ' ' + (x.stage ? 'R' + x.stage : 'LD')).join(', ') : '', back.length ? 'Collect ' + back.map(x => x.topic + ' ' + (x.stage ? 'R' + x.stage : 'LD')).join(', ') : '', dt.length ? '★ ' + dt.map(x => x.name).join(', ') : ''].filter(Boolean).join(' · ') || 'Topic and notes for today'}); });
    const last = Math.max(...T0.map(e => e.b || e.a + 50)), mark = S.filter(x => x.status === 'in' && !x.score).length, wa = live().filter(e => e.ty === 'w' && (e.sc == null || e.sc === '')).length;
    if(mark + wa) out.push({a: last + 10, b: last + 40, t: 'Mark: ' + [wa ? wa + ' assessment' + (wa === 1 ? '' : 's') : '', mark ? mark + ' SRA' + (mark === 1 ? '' : 's') : ''].filter(Boolean).join(' · '), s: 'Waiting for marks'});
    out.push({a: last + (mark + wa ? 40 : 10), b: last + (mark + wa ? 55 : 25), t: 'Daily report', s: 'Before you leave'});
    const hhmm = m => SCHED.hhmm(Math.max(0, m)), key = (i, x) => d + '|' + x.t;
    return `<div class="h2">Plan my day <em>suggested</em></div><div class="card">${out.sort((p, q) => p.a - q.a).map((x, i) => `<div class="it"><span class="cal-t">${hhmm(x.a)}<small>${hhmm(x.b)}</small></span><span class="t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><button type="button" class="t-tk ${dn[key(i, x)] ? 'on' : ''}" data-ttk="${esc(key(i, x))}" aria-label="Done">${dn[key(i, x)] ? '✓' : ''}</button></div>`).join('')}</div>`;
  }
  function calPage(view, d){
    calView = ['day','week','month'].includes(view) ? view : calView; calDate = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : (calDate || today());
    const t = today(), go = (v, x) => `#teach/cal/${v}/${x}`;
    let from, to, title, prev, next;
    if(calView === 'day'){ from = to = calDate; title = `${WEEKDAY[HD.parseISO(calDate).getDay()]} ${nice(calDate)}`; prev = HD.addDays(calDate, -1); next = HD.addDays(calDate, 1); }
    else if(calView === 'week'){ from = wkStart(calDate); to = HD.addDays(from, 6); title = `Week of ${nice(from)}`; prev = HD.addDays(from, -7); next = HD.addDays(from, 7); }
    else { const x = HD.parseISO(calDate); from = HD.isoOf(new Date(x.getFullYear(), x.getMonth(), 1)); to = HD.isoOf(new Date(x.getFullYear(), x.getMonth() + 1, 0)); title = x.toLocaleDateString('en-GB', {month:'long', year:'numeric'}); prev = HD.isoOf(new Date(x.getFullYear(), x.getMonth() - 1, 1)); next = HD.isoOf(new Date(x.getFullYear(), x.getMonth() + 1, 1)); }
    const E = calEvents(from, to), byD = {}; E.forEach(e => (byD[e.date] = byD[e.date] || []).push(e));
    const nCl = E.filter(e => e.clash).length;
    const seg = `<div class="seg" style="margin-bottom:10px">${[['day','Day'],['week','Week'],['month','Month']].map(([k, l]) => `<a class="${calView === k ? 'on' : ''}" href="${go(k, calDate)}">${l}</a>`).join('')}</div>`;
    const nav = `<div class="cal-nav"><a class="btn sm" href="${go(calView, prev)}" aria-label="Earlier">‹</a><b>${title}</b><a class="btn sm" href="${go(calView, next)}" aria-label="Later">›</a>${(calView === 'day' ? calDate !== t : !(from <= t && t <= to)) ? `<a class="btn sm" href="${go(calView, t)}">Today</a>` : ''}</div>`;
    let body;
    if(calView === 'month'){
      const first = wkStart(from), cells = []; for(let x = first; x <= to || cells.length % 7; x = HD.addDays(x, 1)) cells.push(x);
      body = `<div class="cal-m">${DORDER.map(k => `<span class="h">${DN[k]}</span>`).join('')}${cells.map(x => { const L = byD[x] || [], out = x < from || x > to;
        return `<a class="cal-d${out ? ' out' : ''}${x === t ? ' now' : ''}" href="${go('day', x)}"><b>${+x.slice(8)}</b>${L.length ? `<small${L.some(e => e.clash || busyHit(e) || datesOn(e.student, x).some(y => y.busy)) ? ' class="cl"' : ''}>${L.length}</small>` : ''}${[...new Set(items().map(it => it.st))].some(st => datesOn(st, x).length) ? '<i class="t-star">★</i>' : ''}</a>`; }).join('')}</div>`;
    } else {
      const days = []; for(let x = from; x <= to; x = HD.addDays(x, 1)) days.push(x);
      const un = d => (data.avail || []).filter(u => u.d === SCHED.dayCode(d));
      body = days.map(x => { const L = byD[x] || [], U = un(x); if(calView === 'week' && !L.length && !U.length) return '';
        return `<div class="h2">${x === t ? 'Today · ' : ''}${WEEKDAY[HD.parseISO(x).getDay()]} ${nice(x)} <em>${L.length || ''}</em></div><div class="card">${L.map(evRow).join('')}${sharedRows(x, L)}${U.map(u => `<div class="it" style="opacity:.75"><span class="cal-t">${u.s}<small>${u.e}</small></span><span class="t"><b>Not available</b><small>${esc(u.note || '')}</small></span></div>`).join('') || (L.length ? '' : '<p class="empty">No sessions.</p>')}</div>`; }).join('') || '<p class="empty">No sessions this week.</p>';
    }
    return backHome() + head('Calendar', `Your sessions from your tuition cards${nCl ? ` · <b style="color:var(--rd)">${nCl} clash${nCl === 1 ? '' : 'es'}</b>` : ''}`, `<div class="acts"><a class="btn" href="#teach/avail">Times I can't teach</a></div>`) + seg + nav + body + (calView === 'day' ? tPlan(calDate, byD[calDate] || []) : '') +
      `<div class="h2">On your phone</div><div class="card pad"><p style="margin:0 0 8px">Your sessions, make-ups, SRAs to give and assessments you set, in Google Calendar or your iPhone. One way; your phone checks every few hours, so check the Hub for anything changed today.</p>
      <div class="acts"><a class="btn n" href="${'webcal://' + location.host + (data.calLink || '')}">Add to my calendar</a><button class="btn" data-tcallink>Copy the link</button></div>
      <p class="note" style="margin:8px 0 0">Google: Other calendars › From URL. iPhone: Settings › Calendar › Accounts › Add Subscribed Calendar. Keep it private.</p></div>`;
  }
  const halfHours = v => { let o = ''; for(let m = 6 * 60; m <= 21 * 60; m += 30){ const t = SCHED.hhmm(m); o += `<option${t === v ? ' selected' : ''}>${t}</option>`; } return o; };
  function availPage(){
    const L = (data.avail || []).slice().sort((a, b) => DORDER.indexOf(a.d) - DORDER.indexOf(b.d) || a.s.localeCompare(b.s));
    return back('#teach/cal', 'Calendar') + head("Times I can't teach", 'LHQ checks these before adding a session.') +
      `<div class="card">${L.map((u, i) => `<div class="it"><span class="t"><b>${DN[u.d]} ${u.s}–${u.e}</b><small>${esc(u.note || '')}</small></span><button class="btn sm" data-tavrm="${i}">Remove</button></div>`).join('') || '<p class="empty">None · any time in opening hours.</p>'}</div>
      <div class="h2">Add a time</div><div class="card pad"><div class="r2"><label class="f"><span>Day</span><select class="in" id="tavD">${DORDER.map(k => `<option value="${k}">${DN[k]}</option>`).join('')}<option value="wk">Mon–Fri</option></select></label><label class="f"><span>Note (optional)</span><input class="in" id="tavN" placeholder="e.g. at school"></label></div>
      <div class="r2"><label class="f"><span>From</span><select class="in" id="tavS">${halfHours('08:00')}</select></label><label class="f"><span>To</span><select class="in" id="tavE">${halfHours('13:00')}</select></label></div>
      <button class="btn n full" data-tavadd>Add</button></div>`;
  }
  async function saveAvail(L){ try{ const j = await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'avail', blocks: L})}); data.avail = j.avail; write(CK, data); render(); toast('Saved: LHQ will check these'); }catch(e){ toast(e.message); } }

  /* ---------- make-ups: book a time for a session owed; LHQ confirms or declines ---------- */
  const MUL = {asked:'Waiting for LHQ', ok:'Confirmed', no:'Declined'};
  function makeupsPage(){
    const I = items().map(it => ({it, S: sessions(it)})).filter(x => x.S.owed > 0), M = (data.makeups || []).slice().sort((a, b) => (a.d + a.s).localeCompare(b.d + b.s));
    const open = M.filter(m => m.status !== 'no' && m.d >= today()), past = M.filter(m => m.status === 'no' || m.d < today()).slice(-10).reverse();
    const row = m => `<div class="it" style="align-items:flex-start"><span class="cal-t">${m.s}<small>${m.e}</small></span><span class="t"><b>${esc(m.st)} · ${esc(m.sub)}</b><small>${WEEKDAY[HD.parseISO(m.d).getDay()]} ${nice(m.d)} · ${MUL[m.status]}${m.note ? ' · ' + esc(m.note) : ''}${m.why ? ' · ' + esc(m.why) : ''}</small></span>${m.status === 'asked' ? `<button class="btn sm" data-tmucancel="${esc(m.id)}">Take back</button>` : m.status === 'no' ? `<button class="btn sm" data-tmubook="${esc(m.k)}">Book again</button>` : ''}</div>`;
    return backHome() + head('Make-ups', 'Sessions owed') +
      `<div class="h2">Owed <em>${I.reduce((a, x) => a + x.S.owed, 0)}</em></div><div class="card">${I.map(({it, S}) => `<div class="it"><span class="t"><b>${esc(it.st)} · ${esc(it.sub)}</b><small>${S.owed} owed${(data.makeups || []).filter(m => m.k === it.k && m.status !== 'no' && m.d >= today()).length ? ' · ' + (data.makeups || []).filter(m => m.k === it.k && m.status !== 'no' && m.d >= today()).length + ' booked' : ''}</small></span><button class="btn sm n" data-tmubook="${esc(it.k)}">Book</button></div>`).join('') || '<p class="empty">No make-ups owed. ✓</p>'}</div>
      ${open.length ? `<div class="h2">Booked <em>${open.length}</em></div><div class="card">${open.map(row).join('')}</div>` : ''}
      ${past.length ? `<div class="h2">Earlier and declined</div><div class="card">${past.map(row).join('')}</div>` : ''}`;
  }
  function makeupSheet(k){
    const it = itemOf(k); if(!it) return;
    const len = (mins(it.end) - mins(it.start)) || 60, days = []; for(let i = 0; i < 21; i++) days.push(HD.addDays(today(), i));
    const opt = (v, l, on) => `<option value="${v}"${on ? ' selected' : ''}>${l}</option>`;
    openSheet(`<div class="hx"><h3>Book a make-up</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(it.st)} · ${esc(it.sub)} · ${sessions(it).owed} owed</p>
      <label class="f"><span>Day</span><select class="in" id="muD">${days.map((d, i) => opt(d, (i === 0 ? 'Today · ' : i === 1 ? 'Tomorrow · ' : '') + WEEKDAY[HD.parseISO(d).getDay()].slice(0, 3) + ' ' + nice(d), i === 1)).join('')}</select></label>
      <div class="r2"><label class="f"><span>Starts</span><select class="in" id="muS">${(() => { let o = ''; for(let m = 7 * 60; m <= 19 * 60; m += 30) o += opt(SCHED.hhmm(m), SCHED.hhmm(m), m === 14 * 60); return o; })()}</select></label>
      <label class="f"><span>Length</span><select class="in" id="muL">${[45, 50, 60, 90, 120].map(n => opt(n, n < 60 ? n + ' min' : n / 60 + ' h', n === len)).join('')}</select></label></div>
      <p class="note" id="muClash" style="color:var(--rd);font-weight:700;margin:0 0 10px"></p>
      <label class="f"><span>For (optional)</span><input class="in" id="muW" placeholder="e.g. Absent on Tuesday 3 Nov"></label>
      <button class="btn n full" id="muGo">Send to LHQ to confirm</button>`);
    const check = () => { const d = $('muD').value, a = mins($('muS').value), b = a + +$('muL').value, dc = SCHED.dayCode(d);
      const L = SCHED.sessions(data.cards, d, d, {tutor: myName()}).filter(e => SCHED.overlap(a, b, e.a, e.b)).map(e => `you teach ${e.student} then`);
      (data.makeups || []).filter(m => m.d === d && m.status !== 'no' && SCHED.overlap(a, b, mins(m.s), mins(m.e))).forEach(m => L.push(`another make-up (${m.st}) then`));
      (data.avail || []).filter(u => u.d === dc && SCHED.overlap(a, b, mins(u.s), mins(u.e))).forEach(u => L.push(`it's in your unavailable time ${u.s}–${u.e}`));
      $('muClash').textContent = L.length ? '! ' + L.join(' · ') : ''; };
    ['muD','muS','muL'].forEach(x => $(x).onchange = check); check();
    $('muGo').onclick = async () => { const s = $('muS').value, e = SCHED.hhmm(mins(s) + +$('muL').value);
      try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'makeup', k, d: $('muD').value, s, e, why: $('muW').value})}); closeSheet(); await fetchData(); toast('Sent: LHQ will confirm it'); }catch(err){ toast(err.message); } };
  }
  /* requisitions from the daily report, with LHQ's decision */
  function reqsBlock(){
    const R = Object.entries(data.reqs || {}).filter(([, v]) => v && v.at > Date.now() - 14 * 864e5).sort((a, b) => b[1].at - a[1].at);
    return R.length ? `<div class="h2">Your requisitions</div><div class="card">${R.map(([, v]) => `<div class="it"><span class="t"><b>${esc(v.item)}${v.qty && v.qty !== '1' ? ' × ' + esc(v.qty) : ''}</b><small>${{approved:'✓ Approved', declined:'Declined', bought:'✓ Bought'}[v.s] || v.s}${v.note ? ' · ' + esc(v.note) : ''}</small></span></div>`).join('')}</div>` : '';
  }

  function page(sub, a1, a2, a3){
    if(!data){ fetchData(); return head(homeName(), 'Getting your students…') + (err ? `<p class="empty">${err === 'offline' ? 'Offline · your students load when you are online.' : esc(err)}</p>` : ''); }
    data.reports = data.reports || [];
    if(!window.cardTopicNames) ensureLibs().then(() => { if(!form) render(); });
    if(Date.now() - (data.at || 0) > 60000 && !form) fetchData();
    if(sub !== 'log') form = null; if(sub !== 'wa') wform = null; if(sub !== 'marks') mform = null; if(sub !== 'report') rform = null;
    if(!['', undefined, 'student'].includes(sub)) editing = null;
    if(sub === 'cal') return calPage(a1, a2);
    if(sub === 'avail') return availPage();
    if(sub === 'makeups') return makeupsPage();
    if(sub === 'students') return students();
    if(sub === 'student') return studentPage(decodeURIComponent(a1 || ''));
    if(sub === 'sounds' && window.SOUNDS) return SOUNDS.page('#set/notifications');
    if(sub === 'log') return logPage(decodeURIComponent(a1 || ''), a2);
    if(sub === 'marks') return marksPage(!a1 ? '' : a1.startsWith('edit:') ? a1 : a2 ? [a1, a2, a3].map(encodeURIComponent).join('/') : 'stu:' + a1);
    if(sub === 'wa') return waPage(decodeURIComponent(a1 || ''));
    if(sub === 'assess') return assessPage(decodeURIComponent(a1 || ''));
    if(sub === 'pay') return window.TPAYUI ? TPAYUI.myPay() : '';
    if(sub === 'perf') return `<a class="crumb" href="#teach">‹ Home</a><div class="ph"><div class="tt"><h1>My performance</h1></div></div>${data && data.kpiOn && window.KPIUI ? KPIUI.tutorView(render) : '<p class="empty">Not available.</p>'}`;
    if(sub === 'sra') return sraPage(a1 || 'today');
    if(sub === 'fu') return fuPage();
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
    mk:{t:'Make-ups', d:'Owed for absences and cancellations', f:() => { const o = items().reduce((a, it) => a + sessions(it).owed, 0); return {href:'#teach/makeups', v:`${o} <small>owed</small>`, s: o ? 'Tap to book times' : 'None owed', warn: o}; }},
    sra:{t:'SRAs today', d:'To give and to collect today', f:() => { const T = SRA.today(sras(), today()); return {href:'#teach/sra', v:`${T.give.length} <small>to give</small>`, s:`${T.collect.length} to collect`}; }},
    collect:{t:'SRAs to collect', d:'Due back, marks still to enter', f:() => { const n = SRA.today(sras(), today()).collect.length; return {href:'#teach/sra', v:`${n} <small>due back</small>`, s:'marks still to enter', warn: n}; }},
    wam:{t:'Assessments to mark', d:'Given, marks not entered', f:() => { const P = pendingWa(); return {href:'#teach/wa', v:`${P.length} <small>waiting</small>`, s: P.length ? 'oldest given ' + nice(P[0].d) : 'all marked', warn: P.some(w => w.d < today())}; }},
    fu:{t:'Follow-ups', d:'Weak topics: reteach, retest, take-home', f:() => { const E = live(), t = today(), F = (data.fu || []).filter(f => !f.x && !FUP.after(f, E)), o = F.filter(f => f.by < t).length; return {href:'#teach/fu', v:`${F.length} <small>open</small>`, s: o ? o + ' overdue' : 'none overdue', warn: o}; }},
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
  /* students slipping: Act now and Watch (attn.js, the same rules LHQ uses) */
  function slipBlock(){
    if(!window.ATTN) return '';
    const L = ATTN.slipping(items().map(it => ({k: it.k, st: it.st, sub: it.sub, pa: it.pa})), live(), today(), {target: exTarget}); if(!L.length) return '';
    const row = x => `<a class="it" href="#teach/student/${encodeURIComponent(x.k)}"><span class="t-sl ${x.level}">${x.level === 'now' ? '!' : '↘'}</span><span class="t"><b>${esc(x.st)} · ${esc(x.what)}</b><small>${esc(x.sub)} · ${esc(x.detail)}</small></span><span class="chev">›</span></a>`;
    const now = L.filter(x => x.level === 'now'), w = L.filter(x => x.level === 'watch');
    return `<div class="h2">Needs attention <em>${L.length}</em></div><div class="card">${now.length ? `<div class="t-slg now">Act now</div>${now.map(row).join('')}` : ''}${w.length ? `<div class="t-slg watch">Watch</div>${w.map(row).join('')}` : ''}</div>`;
  }
  /* absent or late: what students and parents told LHQ, today and the next 7 days */
  function toldBlock(){
    const t = today(), L = tolds().filter(n => n.d >= t && n.d <= addDays(t, 7)).sort((a, b) => (a.d + a.s).localeCompare(b.d + b.s));
    if(!L.length) return '';
    return `<div class="h2">Absent or late <em>${L.length}</em></div><div class="card">${L.map(n => `<a class="it" href="#teach/log/${encodeURIComponent(n.k)}"><span class="cal-t">${n.d === t ? esc(n.s) : WEEKDAY[HD.parseISO(n.d).getDay()].slice(0, 3)}<small>${n.d === t ? 'today' : nice(n.d)}</small></span><span class="t"><b>${esc(n.name)}</b><small>${esc(n.sub)} · <span class="t-tl${n.kind === 'late' ? ' lt' : ''}">${esc(toldL(n))}</span>${n.note ? ' · “' + esc(n.note) + '”' : ''}</small></span><span class="chev">›</span></a>`).join('')}</div>`;
  }
  function home(){
    const t = today(), rep = todayRep(), G = gaps(), L = dayLogs(t), ed = editing === 'teach', q = read(QK, []).length;
    const acts = ed ? `<div class="acts"><button class="btn n" type="button" data-tedit="">Done</button></div>` : `<div class="acts"><button class="btn" type="button" data-tedit="teach" title="Edit cards" aria-label="Edit cards">${PEN()}</button>${logBtn()}</div>`;
    return head(homeName(), `${WEEKDAY[HD.parseISO(t).getDay()]} ${nice(t)}${q ? ` · ${q} save${q === 1 ? '' : 's'} waiting to send` : ''}`, acts) +
      (ed ? '<p class="note" style="margin:-6px 0 12px">Move, remove or add cards.</p>'
        : rep ? `<a class="t-banner ok" href="#teach/report"><span><b>Today's report is in</b>Sent at ${hm(rep.sent)}. You can still log; changes show as edited.</span></a>`
        : `<a class="t-banner" href="#teach/report"><span><b>Daily report due before you leave</b>Reminder between 4 and 5 pm${G.length ? ` · ${G.length} thing${G.length > 1 ? 's' : ''} still to log` : ''}</span></a>`) +
      (ed ? '' : answersBlock() + toldBlock() + slipBlock() + noticesBlock() + clashesBlock() + comingBlock()) + cardsBlock() + (ed ? '' : saysBlock() + reqsBlock() + `
      <div class="h2">Logged today <em>${L.length}</em></div>${timeline(L)}
      ${G.length ? `<div class="h2">Still to log <em>${G.length}</em></div>${gapCard(G)}` : ''}
      <div class="card">${[['#teach/cal','clock','Calendar','Your week from your tuition cards · clashes · times you can\'t teach'],['#teach/students','users','My students','Sessions had and remaining, make-ups'],['#teach/sra','restore','SRA tracker','Give, collect and print · next 7 days · by student'],['#exams','list','Exam timetable','Every Cambridge paper and its date'],...(data && data.kpiOn ? [['#teach/perf','rep','My performance','Your KPIs · Week and Month']] : []),['#teach/pay','cash','My pay','Payslips to check and sign'],['#teach/classes','users','Classes',`${(data.classes || []).length} official class${(data.classes || []).length === 1 ? '' : 'es'}`]].concat(tutorRole() ? [] : [['#teach/report','list','Daily report', rep ? 'Sent today' : 'Due before you leave']]).map(([h, i, b, s]) => `<a class="it" href="${h}"><span class="ico">${ic(i,18)}</span><span class="t"><b>${b}</b><small>${s}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('')}</div>`);
  }

  /* students and a student's page */
  const bar = S => `<span class="t-pbar"><i style="width:${S.planned ? Math.round(S.had / S.planned * 100) : 0}%"></i>${S.planned ? `<b style="left:${Math.round(S.expected / S.planned * 100)}%" title="Where they should be by today"></b>` : ''}</span>`;
  function students(){
    const I = items();
    return backHome() + head('My students', `${new Set(I.map(i => stuOf(i.k))).size} student${new Set(I.map(i => stuOf(i.k))).size === 1 ? '' : 's'} on your tuition cards`, `<div class="acts">${logBtn()}</div>`) +
      (I.length ? `<div class="card">${I.map(it => { const S = sessions(it); return `<a class="it" href="#teach/student/${encodeURIComponent(it.k)}" style="align-items:flex-start"><span class="t"><b>${esc(it.st)}</b><small>${esc(it.sub)} · ${S.had} of ${S.planned || '?'} had · ${S.remaining} left${S.owed ? ` · ${S.owed} make-up${S.owed > 1 ? 's' : ''} owed` : ''}</small>${bar(S)}</span>${S.behind ? `<span class="tag am">${S.behind} behind</span>` : '<span class="tag ok">On track</span>'}</a>`; }).join('')}</div><p class="note">Dark mark: where they should be today.</p>`
        : '<p class="empty">No students yet. They appear when LHQ puts you on a tuition card.</p>');
  }
  const SECS = {eff:'Effort', study:'Study and dates', target:'Target and exams', ses:'Sessions and make-ups', sra:'SRA scores by review', wa:'Assessments', logs:'Recent logs', topics:'Topics finished', time:'Timetable'};
  function studentPage(k){
    const it = itemOf(k); if(!it) return backHome() + '<p class="empty">That student isn\'t on your tuition cards.</p>';
    const S = sessions(it), ed = editing === 'tstudent', on = (myCards('tstudent') || ['target','eff','study','ses','sra','wa','time']).filter(x => SECS[x]);
    const L = sras().filter(x => x.k === k), byT = new Map(); L.forEach(x => { if(!byT.has(x.topic)) byT.set(x.topic, []); byT.get(x.topic).push(x); });
    const cell = x => { const p = x && x.score ? Math.round(x.score.sc / x.score.mx * 100) : null; return p == null ? '<span class="c" style="color:var(--muted)">·</span>' : `<span class="c ${p >= 75 ? 'ok' : p >= 60 ? 'am' : 'rd'}">${p}</span>`; };
    const W = live().filter(e => e.ty === 'w' && e.k === k && e.sc != null && e.sc !== '' && +e.mx > 0).sort((a, b) => a.d.localeCompare(b.d)).slice(-6);
    const xi = exInfo(k);
    const sxx = sxOf(it.st), SW = sxx.w || [], cur = SW[SW.length - 1], prv = SW[SW.length - 2], hmn = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
    const nuF = !!(cur && sxx.uses && !sxx.uses.focus && !SW.some(w => w.f)), nuP = !!(cur && sxx.uses && !sxx.uses.plan && !SW.some(w => w.p));
    const dlt = (a, b) => b == null ? '' : `${a >= b ? '▲' : '▼'} ${hmn(Math.abs(a - b))} on last week`, mx = Math.max(1, ...SW.map(w => Math.max(w.f, w.p)));
    const SEC = {
      eff: () => `<div style="margin:0">${window.STV ? STV.page(SCHED.nk(it.st), 'tutor') : ''}</div>`,
      study: () => `<div class="card pad" style="margin:0"><div class="cap">Study this week</div>${cur ? `<div class="mcs" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px"><button type="button" class="mc" data-tsx="f"><span class="l">Focus time</span><span class="v">${nuF ? '–' : hmn(cur.f)}<span class="mca">›</span></span><span class="s">${nuF ? 'Lean · not using Focus' : dlt(cur.f, prv && prv.f)}</span></button><button type="button" class="mc" data-tsx="p"><span class="l">Study planned</span><span class="v">${nuP ? '–' : hmn(cur.p)}<span class="mca">›</span></span><span class="s">${nuP ? 'Lean · not using Plan my day' : dlt(cur.p, prv && prv.p)}</span></button></div>
          <div class="it" style="padding:8px 0"><span class="t"><b>${esc(it.sub)}</b><small>Your subject · focus this week</small></span><b>${hmn((cur.bySub || {})[it.sub] || 0)}</b></div>
          <div class="t-w5">${SW.map((w, i) => `<button type="button" data-tsx="w${i}"><span><i style="height:${Math.round(w.f / mx * 70)}px" class="f"></i><i style="height:${Math.round(w.p / mx * 70)}px" class="p"></i></span><small>${+w.mon.slice(8)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+w.mon.slice(5, 7) - 1]}</small></button>`).join('')}</div>
          <div class="t-lg"><span><i class="f"></i>Focus</span><span><i class="p"></i>Planned</span></div>` : `<p class="note" style="margin:0">${sxx.hidden === 'student' ? esc(it.st.split(' ')[0]) + ' keeps these private.' : 'Off at LHQ.'}</p>`}
        ${(sxx.dates || []).length ? `<div class="cap" style="margin-top:12px">Dates ${esc(it.st.split(' ')[0])} shares</div>${sxx.dates.slice(0, 4).map(x => `<div class="it" style="padding:6px 0"><span style="color:${x.busy ? 'var(--rd)' : 'var(--gold)'}">★</span><span class="t"><b>${esc(x.name)}</b><small>${nice(x.from)}${x.to ? ' – ' + nice(x.to) : ''}${x.busy ? ' · busy' : ''}</small></span></div>`).join('')}` : ''}</div>`,
      target: () => xi ? `<div style="margin:0">${EXUI.block(xi, `data-textg="${esc(k)}"`, true).replace('class="card pad ex-blk"', 'class="card pad ex-blk" style="margin:0"')}</div>` : '<div class="card pad" style="margin:0"><p class="empty" style="margin:0">Loading…</p></div>',
      ses: () => `<div class="card pad" style="margin:0"><div class="cap">Sessions · ${it.pa ? nice(it.pa) : '?'} – ${it.b ? nice(it.b) : '?'}</div>
        <div class="t-ses"><div><b>${S.planned || '?'}</b><small>Planned</small></div><div><b>${S.had}</b><small>Had</small></div><div><b>${S.remaining}</b><small>Remaining</small></div></div>${bar(S)}
        <p class="note" style="margin:4px 0 12px">${S.behind ? `<b style="color:var(--am)">${S.behind} behind</b> where ${esc(it.st.split(' ')[0])} should be by today (${S.expected}).` : 'On track for today.'}</p>
        <div class="t-kv"><span>Missed · student absent</span><b>${S.absent}</b><span>Missed · cancelled</span><b>${S.cancelled}</b><span>Make-ups had</span><b>${S.made}</b><span>Make-ups owed</span><b>${S.owed}</b></div></div>`,
      sra: () => `<div class="card pad" style="margin:0"><div class="cap">SRA scores by review <small style="text-transform:none;letter-spacing:0">· %</small></div>
        ${byT.size ? `<div class="t-sgrid"><span></span>${['LD','R1','R2','R3','R4','R5'].map(h => `<span class="h">${h}</span>`).join('')}${[...byT.entries()].map(([t, X]) => `<span class="t t-tl" role="button" tabindex="0" data-ttop="${esc(JSON.stringify({k, tk: t}))}">${esc(t)} ›</span>${[0,1,2,3,4,5].map(i => cell(X.find(x => x.stage === i))).join('')}`).join('')}</div>
        ${window.FUP ? FUP.tutRetests(data.fu || [], live(), k) : ''}
        <p class="note">Lower than the review before: dropping. Tap a topic to follow it up.</p>${(n => n ? `<a class="it" href="#teach/fu" style="padding:8px 0"><span class="t"><b>Follow-ups</b><small>${n} open</small></span><span class="chev">›</span></a>` : '')((data.fu || []).filter(f => f.k === k && !f.x && !FUP.after(f, live())).length)}` : '<p class="empty" style="margin:0">No topics finished yet.</p>'}</div>`,
      wa: () => `<div class="card pad" style="margin:0"><div class="cap">Assessments</div>${W.length ? `<div style="display:flex;align-items:flex-end;gap:8px;height:90px">${W.map((e, i) => { const p = Math.round(e.sc / e.mx * 100); return `<div style="flex:1;text-align:center;font-size:11.5px;font-weight:800;color:var(--muted)" title="${nice(e.d)}"><div style="height:${Math.max(4, p * .7)}px;background:${i === W.length - 1 ? 'var(--gold)' : 'var(--bl-bg)'};border-radius:6px 6px 2px 2px;margin-bottom:4px"></div>${p}%</div>`; }).join('')}</div>` : '<p class="empty" style="margin:0">No marks yet.</p>'}</div>`,
      logs: () => { const E = live().filter(e => e.k === k && ['s','r','w'].includes(e.ty)).sort((a, b) => (b.d || '').localeCompare(a.d || '') || (b.at || 0) - (a.at || 0)).slice(0, 8);
        return `<div class="card pad" style="margin:0"><div class="cap">Recent logs</div>${E.map(e => `<div class="it"><span class="t"><b>${nice(e.d)} · ${e.ty === 's' ? 'Session · ' + (ATTL[e.a] || e.a) : e.ty === 'r' ? 'SRA ' + (e.h === 'm' ? 'not handed in' : 'marks ' + (e.sc ?? '') + '/' + (e.mx ?? '')) : 'Weekly assessment' + (e.sc != null && e.sc !== '' ? ' ' + e.sc + '/' + e.mx : ' given')}</b><small>${esc(e.ty === 's' ? [(e.tp || []).join(', '), cfText([e])].filter(Boolean).join(' · ') : e.ty === 'r' ? e.tk + ' · ' + SRA.label(e.rv) : (e.tp || []).join(', '))}</small></span></div>`).join('') || '<p class="empty" style="margin:0">Nothing logged yet.</p>'}</div>`; },
      topics: () => `<div class="card pad" style="margin:0"><div class="cap">Topics finished</div>${byT.size ? `<p style="margin:0;font-weight:700">${[...byT.keys()].map(esc).join(' · ')}</p>` : ''}<p class="note">${byT.size} of ${it.topics.length || '?'} topics</p></div>`,
      time: () => `<div class="card pad" style="margin:0"><div class="cap">Timetable</div><p style="margin:0;font-weight:700">${(it.days || []).map(d => DAYN[d] + ' ' + timeOf(it, d)).join(' · ') || 'Days to be confirmed'}</p><p class="note">${it.where ? esc(it.where) + ' · ' : ''}until ${it.b ? nice(it.b) : '?'}</p></div>`};
    const box = (x, i) => ed ? `<div class="t-sec ed"><div class="t-secctl"><b>${SECS[x]}</b><button type="button" data-tsmv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" data-tsmv="${i}|1" ${i < on.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button type="button" class="rm" data-tsrm="${x}" aria-label="Remove ${SECS[x]}">×</button></div>${SEC[x]()}</div>` : `<div class="t-sec">${SEC[x]()}</div>`;
    const off = Object.keys(SECS).filter(x => !on.includes(x));
    const acts = ed ? `<div class="acts"><button class="btn n" type="button" data-tedit="">Done</button></div>` : `<div class="acts"><button class="btn" type="button" data-tedit="tstudent" title="Edit sections" aria-label="Edit sections">${PEN()}</button>${logBtn(k)}</div>`;
    return back('#teach/students', 'My students') + head(esc(it.st), `${esc(it.sub)}${it.lv ? ' · ' + esc(it.lv) : ''}`, acts) + (ed ? '<p class="note" style="margin:-6px 0 12px">Applies to every student.</p>' : '') + on.map(box).join('') +
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
      t1: it0 ? tStart(it0, dow) : '', t2: it0 ? tEnd(it0, dow) : '', att: Object.fromEntries(M.map(m => { const n = noticeOf(m.k, t); return [m.k, n ? (n.kind === 'late' ? 'late' : 'absent') : 'attended']; })), mk: 0, tp: [], fin: [], q: '', open: false,
      give: SRA.build(items(), live(), t).filter(x => M.some(m => m.k === x.k) && x.status === 'give').map(ref), had: [], gb: 0, ga: 0, wa: 0, waTp: [], waMx: '', waOpen: false, wq: '', nt: '', n: '', waAk: 'w', waSch: ((schedOpen(M.map(m => m.k), t)[0] || {}).ag || '')};
  }
  function editForm(grp){
    const E = live().filter(e => e.ty === 's' && (e.grp || e.id) === grp); if(!E.length) return null; const e = E[0];
    const G = live().filter(x => x.ty === 'g' && x.grp === grp), W = live().filter(x => x.ty === 'w' && x.grp === grp);
    return {key: e.cls ? 'class:' + e.cls : E.length > 1 ? 'group' : e.k, grp, edit: true, ids: Object.fromEntries(E.map(x => [x.k, x.id])), d: e.d, keys: E.map(x => x.k), cls: e.cls || '', fmt: e.fmt || '1i', t1: e.t1 || '', t2: e.t2 || '', cb: (E.find(x => x.cb) || {}).cb || '',
      att: Object.fromEntries(E.map(x => [x.k, x.a])), mk: e.mk || 0, tp: e.tp || [], fin: e.fin || [], q: '', open: false, give: G.map(g => [g.k, g.tk, g.rv].map(encodeURIComponent).join('/')), had: G.map(g => g.id), gIds: Object.fromEntries(G.map(g => [[g.k, g.tk, g.rv].map(encodeURIComponent).join('/'), g.id])),
      gb: e.gb || 0, ga: e.ga || 0, wa: W.length ? 1 : 0, waTp: (W[0] || {}).tp || [], waMx: (W[0] || {}).mx || '', waAk: (W[0] || {}).ak || 'w', waSch: (W[0] || {}).sch || '', wIds: Object.fromEntries(W.map(x => [x.k, x.id])), waOpen: false, wq: '', nt: e.nt || '', n: e.n || ''};
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
      '<p class="empty" style="margin:0">No SRAs this week.</p>';
  }
  function logPage(key, eid){
    if(key.startsWith('edit:')){ if(!form || form.grp !== key.slice(5)) form = editForm(key.slice(5)); if(!form) return backHome() + '<p class="empty">That log isn\'t here any more.</p>'; }
    else if(!form || form.key !== key || form.edit) form = newForm(key || 'pick');
    const f = form, I = items(), C = data.classes || [], M = f.keys.map(itemOf).filter(Boolean), pickWho = !f.edit;
    const whoSel = `<select class="in" data-twho aria-label="Who">${f.key === 'pick' ? '<option value="pick">Choose…</option>' : ''}${C.length ? `<optgroup label="Classes">${C.map(c => `<option value="class:${c.id}" ${f.key === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Students">${I.map(it => `<option value="${esc(it.k)}" ${f.key === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</optgroup><option value="group" ${f.key === 'group' ? 'selected' : ''}>Several students (not a class)</option></select>`;
    const lockedNow = f.edit && Object.values(f.ids || {}).some(id => { const e = live().find(x => x.id === id); const st = e && HD.cfState(e); return st && st !== 'waiting'; });
    return backHome() + head(f.edit ? 'Edit session' : 'Log a session', f.edit ? nice(f.d) : 'Fill in what happened. Ticks and circles only.') + (lockedNow ? `<div class="card pad" style="border-left:3px solid var(--am)"><b>Confirmed</b><p class="note" style="margin:4px 0 0">Times and attendance are locked. Topics can change.</p></div>` : '') + `
      <div class="card pad"><label class="f" style="margin:0"><span>Who</span>${pickWho ? whoSel : `<input class="in" value="${esc(f.cls ? (C.find(c => c.id === f.cls) || {}).name || 'Class' : M.map(m => m.st + ' · ' + m.sub).join(', '))}" readonly>`}</label>
        ${f.key === 'group' && pickWho ? `<div class="t-opts" style="margin-top:10px">${I.map(it => tick('keys:' + it.k, f.keys.includes(it.k), esc(it.st), esc(it.sub))).join('')}</div>` : ''}</div>
      ${M.length ? `
      <div class="card pad"><div class="cap">Session type</div>${one('fmt', FMT, f.fmt, 'g2')}
        <div style="margin-top:8px">${tick('mk', f.mk, 'This was a make-up session')}</div>
        <div class="r2" style="margin-top:14px"><label class="f" style="margin:0"><span>Date</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label><span></span></div>
        <div class="r2" style="margin-top:10px"><label class="f" style="margin:0"><span>Started</span><input class="in" type="time" data-tin="t1" value="${esc(f.t1)}"></label><label class="f" style="margin:0"><span>Finished</span><input class="in" type="time" data-tin="t2" value="${esc(f.t2)}"></label></div></div>
      ${M.map(m => { const n = noticeOf(m.k, f.d); return n ? `<div class="t-told">${esc(short(m.st))} · told ${hm(n.at)} · ${esc(toldL(n))}${n.note ? ` · “${esc(n.note)}”` : ''}</div>` : ''; }).join('')}
      <div class="card pad"><div class="cap">Attendance</div><div class="t-att"><span></span>${ATT.map(a => `<span class="hd">${a[1]}</span>`).join('')}
        ${M.map(m => `<span class="nm">${esc(short(m.st))}</span>${ATT.map(([v, l]) => `<button type="button" role="radio" aria-label="${esc(short(m.st))} ${l}" aria-checked="${f.att[m.k] === v}" class="${f.att[m.k] === v ? 'on' : ''}" data-tset="att.${esc(m.k)}" data-v="${v}"><span class="t-ind c"></span></button>`).join('')}`).join('')}</div>
        ${M.some(m => f.att[m.k] === 'cancelled') ? `<div class="cap" style="margin-top:12px">Cancelled by</div>${one('cb', [['tutor','Me'],['lhq','LHQ'],['student','Student']], f.cb || '', 'g3')}` : ''}
        ${M.some(m => !taught(f.att[m.k])) ? '<p class="note">Absent or cancelled: a make-up is owed.</p>' : ''}</div>
      ${M.some(m => taught(f.att[m.k])) ? `
      <div class="card pad"><div class="cap">Topics covered</div>${topicPicker(f, 'tp', 'open', 'q', 'Choose topics')}
        ${f.tp.map(t => `<div class="t-pk"><div class="row"><span>${esc(t)}</span><button class="t-x" type="button" aria-label="Remove ${esc(t)}" data-ttog="tp:${esc(t)}">×</button></div><div style="margin-top:8px">${tick('fin:' + t, f.fin.includes(t), 'Finished this topic', f.fin.includes(t) ? 'Starts its SRAs: today, then 1, 3, 7, 14 days and a month' : '')}</div></div>`).join('')}</div>
      <div class="card pad"><div class="cap">SRAs handed out <small style="text-transform:none;letter-spacing:0">· from the SRA tracker</small></div>${sraGroups(f)}</div>
      <div class="card pad lm"><div class="cap">Guide</div><div class="t-opts">${tick('gb', f.gb, 'Guide handed before the session')}${tick('ga', f.ga, 'Guide handed after the session')}</div></div>
      <div class="card pad lm"><div class="cap">Assessment</div>${tick('wa', f.wa, 'Assessment given')}
        ${f.wa ? (SO => `${SO.length ? `<div class="cap" style="margin-top:12px">Which</div>${one('waSch', SO.map(a => [a.ag || a.id, `${atyL(a.ak)} · ${(a.tp || []).map(esc).join(', ') || esc(a.sub)}<small>${nice(a.d)}${a.s ? ' ' + a.s : ''}</small>`]).concat([['', 'Another one']]), f.waSch || '')}` : ''}
          ${f.waSch ? '' : `<div class="cap" style="margin-top:12px">Type</div>${one('waAk', ATY, akN(f.waAk), 'g2')}
          <div style="margin-top:12px"><label class="f" style="margin-bottom:6px"><span>Topics</span></label>${topicPicker(f, 'waTp', 'waOpen', 'wq', 'Choose topics')}${f.waTp.length ? `<p class="note">${f.waTp.map(esc).join(', ')}</p>` : ''}
          <label class="f" style="margin:12px 0 0"><span>Out of</span><input class="in" inputmode="decimal" data-tin="waMx" value="${esc(f.waMx)}" placeholder="e.g. 40"></label></div>`}`)(schedOpen(f.keys, f.d)) : ''}</div>` : ''}
      <div class="card pad lm"><label class="f"><span>Note for LHQ (optional)</span><textarea class="in" data-tin="nt" rows="2" style="min-height:0;height:72px">${esc(f.nt)}</textarea></label>
        <label class="f" style="margin:0"><span>Line for the parent (optional)</span><textarea class="in" data-tin="n" rows="2" maxlength="140" style="min-height:0;height:72px" placeholder="e.g. Much more confident with mole calculations this week.">${esc(f.n)}</textarea></label></div>
      <button class="lean-more" type="button" data-leanmore>+ More: guide, assessment, notes</button>
      <button class="btn n full" type="button" id="tSave">${f.edit ? 'Save changes' : 'Save log'}</button>${f.edit ? '<button class="btn rd full" type="button" id="tDel" style="margin-top:8px">Delete this log</button>' : ''}` : ''}`;
  }
  function saveLog(){
    const f = form, M = f.keys.map(itemOf).filter(Boolean);
    if(!M.length){ toast('Choose who the session was with'); return; }
    if(f.t1 && f.t2 && mins(f.t2) <= mins(f.t1)){ toast('The session finishes before it starts'); return; }
    if(f.waMx && !(parseFloat(f.waMx) > 0)){ toast('Check what the assessment is marked out of'); return; }
    if(f.keys.some(k => f.att[k] === 'cancelled') && !f.cb){ toast('Who cancelled?'); return; }
    const md = /o$/.test(f.fmt) ? 'o' : 'c', list = [];
    M.forEach(m => { const a = f.att[m.k] || 'attended', ok = taught(a);
      const e = {id: f.ids[m.k] || uid(), ty:'s', k:m.k, st:m.st, sub:m.sub, d:f.d, a, md, fmt:f.fmt, grp:f.grp};
      if(f.t1) e.t1 = f.t1; if(f.t2) e.t2 = f.t2; if(f.cls) e.cls = f.cls; if(f.mk) e.mk = 1; if(a === 'cancelled') e.cb = f.cb;
      const tn = noticeOf(m.k, f.d); if(tn && ((tn.kind === 'abs' && a === 'absent') || (tn.kind === 'late' && a === 'late'))) e.told = tn.id; else delete e.told;
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
      const sa = f.waSch ? scheduled().find(a => (a.ag || a.id) === f.waSch && a.k === m.k) || scheduled().find(a => (a.ag || a.id) === f.waSch) : null;
      list.push(Object.assign({}, o, {id: wIds[m.k] || uid(), ty:'w', k:m.k, st:m.st, sub:m.sub, d:f.d, tp: sa ? (sa.tp || []).slice() : f.waTp.slice(), mx: sa ? (sa.mx || '') : f.waMx, ak: sa ? (sa.ak || 'w') : (f.waAk || 'w'), wid:f.grp, grp:f.grp}, sa ? {sch: f.waSch} : {}, f.cls ? {cls:f.cls} : {})); });
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
        mform = {edit: e.id, k: e.k, sra: e.man ? 'man' : [e.k, e.tk, e.rv].map(encodeURIComponent).join('/'), tk: e.tk, rv: String(e.rv), h: e.h || 'o', sc: e.sc ?? '', mx: e.mx ?? '10', d: e.d, ars: e.ars ?? null, ao: e.ao ? String(e.ao) : aoOf(e.tk), na: !!e.na, om: e.om || null}; }
      else { const x = v && !v.startsWith('stu:') ? unref(v) : null, k0 = v.startsWith('stu:') ? v.slice(4) : ''; mform = {k: x ? x.k : k0, sra: x ? ref(x) : '', tk: '', rv: '', h: 'o', sc: '', mx: '10', d: today(), ars: null, ao: x ? aoOf(x.topic) : '', na: false}; }
    }
    const f = mform, out = L.filter(x => x.k === f.k && ['given','collect','late','home'].includes(x.status) || (f.edit && ref(x) === f.sra && x.k === f.k)), it = itemOf(f.k);
    return backHome() + head(f.edit ? 'Edit SRA marks' : 'SRA marks', 'For an SRA that has been handed in') + `
      <div class="card pad"><label class="f"><span>Student</span><select class="in" data-tmk aria-label="Student" ${f.edit ? 'disabled' : ''}><option value="">Choose…</option>${I.map(i => `<option value="${esc(i.k)}" ${f.k === i.k ? 'selected' : ''}>${esc(i.st)} · ${esc(i.sub)}</option>`).join('')}</select></label>
      ${f.k ? `<div class="cap">Which SRA</div><div class="t-opts">${out.map(x => `<button type="button" role="radio" aria-checked="${f.sra === ref(x)}" class="t-opt${f.sra === ref(x) ? ' on' : ''}" data-tset="sra" data-v="${esc(ref(x))}"><span class="t-ind c"></span><span class="tx">${esc(x.topic)} · ${x.label}<small>${x.status === 'home' ? `Take-home pack · do on ${nice(x.doOn)}` : `Given ${x.given ? nice(x.given.d) : '?'} · due back ${x.due === today() ? 'today' : nice(x.due)}${x.status === 'late' ? ' · late' : ''}`}</small></span></button>`).join('')}
        <button type="button" role="radio" aria-checked="${f.sra === 'man'}" class="t-opt${f.sra === 'man' ? ' on' : ''}" data-tset="sra" data-v="man"><span class="t-ind c"></span><span class="tx">Not in the list<small>Choose topic and review · LHQ checks</small></span></button></div>
        ${f.sra === 'man' ? `<div class="r2" style="margin-top:10px"><label class="f" style="margin:0"><span>Topic</span>${(tks => tks.length ? `<select class="in" data-tin="tk"><option value="">Choose…</option>${tks.map(t => `<option ${f.tk === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : `<input class="in" data-tin="tk" value="${esc(f.tk || '')}" placeholder="Type the topic" autocomplete="off">`)([...new Set((it ? it.topics : []).concat(L.filter(x => x.k === f.k).map(x => x.topic)))])}</label>
          <label class="f" style="margin:0"><span>Review</span><select class="in" data-tin="rv"><option value="">Choose…</option>${SRA.STAGES.map(s => `<option value="${s.n}" ${f.rv === String(s.n) ? 'selected' : ''}>${s.l}</option>`).join('')}</select></label></div>` : ''}` : ''}</div>
      ${f.sra ? `<div class="card pad"><div class="cap">Marks</div><div class="t-score"><input class="in" inputmode="decimal" data-tin="sc" data-tpc="mpc" value="${esc(f.sc)}" aria-label="Marks"><span>/</span><input class="in" inputmode="decimal" data-tin="mx" data-tpc="mpc" value="${esc(f.mx)}" aria-label="Out of"><b id="mpc">${pct(f.sc, f.mx)}</b></div>
        <label class="f" style="margin:14px 0 0"><span>Handed in on</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label>
        <p class="note">Change the date for an earlier SRA.</p></div>
        ${(() => { const tk0 = f.sra === 'man' ? f.tk : decodeURIComponent((f.sra.split('/')[1]) || ''); if(!f.ao && tk0) f.ao = aoOf(tk0); if(f.otk !== tk0) f.om = f.otk == null ? f.om : null; f.osub = it ? it.sub : ''; f.otk = tk0; return arsHTML(f); })()}
        <button class="btn n full" type="button" id="tmSave">${f.edit ? 'Save changes' : 'Save marks'}</button>${f.edit ? '<button class="btn rd full" type="button" id="tmDel" style="margin-top:8px">Delete this log</button>' : ''}` : ''}`;
  }
  function saveMarks(){
    const f = mform, it = itemOf(f.k); if(!it){ toast('Choose the student'); return; }
    let tk, rv; if(f.sra === 'man'){ tk = f.tk; rv = +f.rv; if(!tk || f.rv === ''){ toast('Choose the topic and review'); return; } } else { const [, a, b] = f.sra.split('/').map(decodeURIComponent); tk = a; rv = +b; }
    if(!pct(f.sc, f.mx)){ toast('Check the marks'); return; }
    if(!arsOk(f)){ toast(+f.ao > 0 ? 'Add the ARS score, or tick No ARS' : 'Add what the ARS is out of'); return; }
    const e = arsTo({id: f.edit || uid(), ty:'r', v:2, k:it.k, st:it.st, sub:it.sub, d:f.d, tk, rv, h:'o', sc:+f.sc, mx:+f.mx}, f); if(f.sra === 'man') e.man = 1;
    mform = null; saveEntries([e], true).then(ok => { if(ok){ toast('Marks saved · ' + pct(e.sc, e.mx) + (e.na ? ' · no ARS' : ' · ARS ' + pct(e.ars, e.ao))); location.hash = '#teach'; } });
  }

  /* ---------- logging: weekly assessment marks ---------- */
  function waPage(v){
    const P = pendingWa(), I = items(), C = data.classes || [];
    if(!wform){
      if(v.startsWith('edit:')){ const id = v.slice(5), G = live().filter(e => e.ty === 'w' && (e.wid || e.id) === id); if(!G.length) return backHome() + '<p class="empty">That log isn\'t here any more.</p>';
        wform = {pend: id, edit: true, key: G[0].cls ? 'class:' + G[0].cls : G[0].k, keys: G.map(x => x.k), ids: Object.fromEntries(G.map(x => [x.k, x.id])), tp: G[0].tp || [], d: G[0].d, mx: G[0].mx || '', ak: G[0].ak || 'w', marks: Object.fromEntries(G.map(x => [x.k, x.sc ?? ''])), abs: Object.fromEntries(G.map(x => [x.k, !!x.abs])), open: false, q: ''}; }
      else { const w = P.find(x => x.id === v); wform = w ? fromPending(w) : {pend: P.length ? '' : 'new', key: '', keys: [], ids: {}, tp: [], d: today(), mx: '', ak: 'w', marks: {}, abs: {}, open: false, q: ''}; }
    }
    const f = wform, cls = f.key.startsWith('class:') ? C.find(c => c.id === f.key.slice(6)) : null;
    const pick = !f.edit && P.length ? `<div class="card pad"><div class="cap">Which assessment</div><div class="t-opts">${P.map(w => `<button type="button" role="radio" aria-checked="${f.pend === w.id}" class="t-opt${f.pend === w.id ? ' on' : ''}" data-twpick="${esc(w.id)}"><span class="t-ind c"></span><span class="tx">${esc(w.name)} · ${atyL(w.ak)} · ${esc(w.sub)}<small>Given ${nice(w.d)} · ${w.tp.map(esc).join(', ') || 'topics not set'} · marks not entered</small></span></button>`).join('')}
      <button type="button" role="radio" aria-checked="${f.pend === 'new'}" class="t-opt${f.pend === 'new' ? ' on' : ''}" data-twpick="new"><span class="t-ind c"></span><span class="tx">Another one</span></button></div></div>` : '';
    if(!f.pend) return backHome() + head('Assessment marks') + pick;
    const fromP = f.pend !== 'new', M = f.keys.map(itemOf).filter(Boolean);
    return backHome() + head(f.edit ? 'Edit assessment' : 'Assessment marks', cls ? esc(cls.name) : M.length === 1 ? esc(M[0].st) : '') + pick + `
      ${fromP ? '' : `<div class="card pad"><label class="f" style="margin:0"><span>Who</span><select class="in" data-twwho aria-label="Who"><option value="">Choose…</option>${C.length ? `<optgroup label="Classes">${C.map(c => `<option value="class:${c.id}" ${f.key === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Students">${I.map(it => `<option value="${esc(it.k)}" ${f.key === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</optgroup></select></label></div>`}
      ${M.length ? `<div class="card pad"><div class="cap">${atyL(f.ak)} · ${esc(M[0].sub)}</div>${fromP || f.edit ? '' : `${one('ak', ATY, akN(f.ak), 'g2')}<div style="height:12px"></div>`}
        <label class="f" style="margin-bottom:6px"><span>Topics tested</span></label>${topicPicker(f, 'tp', 'open', 'q', 'Choose topics')}${f.tp.length ? `<p class="note">${f.tp.map(esc).join(', ')}</p>` : ''}
        <div class="r2" style="margin-top:14px"><label class="f" style="margin:0"><span>Date given</span><input class="in" type="date" data-tin="d" value="${f.d}" max="${today()}"></label><label class="f" style="margin:0"><span>Marks out of</span><input class="in" inputmode="decimal" data-tin="mx" data-twpc="1" value="${esc(f.mx)}" placeholder="e.g. 40"></label></div></div>
      <div class="card pad"><div class="cap">Marks</div><div class="t-marks">${M.map(m => `<span class="nm">${esc(short(m.st))}</span>${f.abs[m.k] ? '<span class="tag gr" style="justify-self:start">Absent</span>' : `<input class="in" inputmode="decimal" data-tin="marks.${esc(m.k)}" data-twpc="1" value="${esc(f.marks[m.k] ?? '')}" aria-label="${esc(short(m.st))} marks">`}<b data-twp="${esc(m.k)}">${f.abs[m.k] ? '' : pct(f.marks[m.k], f.mx)}</b>`).join('')}</div>
        ${M.length > 1 ? `<div class="cap" style="margin-top:14px">Didn't sit it</div><div class="t-opts">${M.map(m => tick('abs:' + m.k, f.abs[m.k], esc(m.st) + ' was absent')).join('')}</div>` : ''}</div>
      <button class="btn n full" type="button" id="twSave">${f.edit ? 'Save changes' : 'Save marks'}</button>` : ''}`;
  }
  function fromPending(w){ const G = w.G; return {pend: w.id, key: G[0].cls ? 'class:' + G[0].cls : G[0].k, keys: G.map(x => x.k), ids: Object.fromEntries(G.map(x => [x.k, x.id])), tp: w.tp.slice(), d: w.d, mx: w.mx, ak: w.ak, marks: {}, abs: {}, open: false, q: ''}; }
  function saveWa(){
    const f = wform, M = f.keys.map(itemOf).filter(Boolean); if(!M.length){ toast('Choose who sat it'); return; }
    if(!(parseFloat(f.mx) > 0)){ toast('Add what it was marked out of'); return; }
    const bad = M.find(m => !f.abs[m.k] && !pct(f.marks[m.k], f.mx)); if(bad){ toast(`Check ${short(bad.st)}'s marks`); return; }
    const wid = f.pend !== 'new' ? f.pend : 'w' + uid(), cls = f.key.startsWith('class:') ? f.key.slice(6) : '', now = Date.now();
    const list = M.map(m => { const o = live().find(x => x.id === f.ids[m.k]) || {};
      const e = Object.assign({}, o, {id: f.ids[m.k] || uid(), ty:'w', k:m.k, st:m.st, sub:m.sub, d:f.d, tp:f.tp.slice(), mx:+f.mx, ak: o.ak || f.ak || 'w', wid, md: today(), mc: o.mc || now}, cls ? {cls} : {});
      if(f.abs[m.k]){ e.abs = 1; delete e.sc; } else { e.sc = +f.marks[m.k]; delete e.abs; } return e; });
    wform = null; saveEntries(list, true).then(ok => { if(ok){ toast('Assessment marks saved'); location.hash = '#teach'; } });
  }

  /* ---------- scheduling an assessment: who, type, date, time, topics; it shows on the students' calendar and Practice ---------- */
  function assessPage(v){
    const I = items(), C = data.classes || [];
    if(!aform || aform.v !== v){
      const G = v && !v.startsWith('new') ? scheduled().filter(a => (a.ag || a.id) === v) : [];
      aform = G.length ? {v, ag: v, edit: true, keys: G.map(a => a.k), ids: Object.fromEntries(G.map(a => [a.k, a.id])), ak: G[0].ak || 'w', d: G[0].d, s: G[0].s || '', tp: (G[0].tp || []).slice(), mx: G[0].mx || '', cls: G[0].cls || '', open: false, q: '', att: {}, give: [], fmt: 'x', t1: 'x'}
        : {v, ag: 'a' + uid(), keys: v.startsWith('new:') ? [v.slice(4)] : [], ids: {}, ak: 'm', d: addDays(today(), 1), s: '', tp: [], mx: '', cls: '', open: false, q: '', att: {}, give: [], fmt: 'x', t1: 'x'};
    }
    const f = aform, M = f.keys.map(itemOf).filter(Boolean), sub0 = M[0] && M[0].sub, same = I.filter(it => !sub0 || nk(it.sub) === nk(sub0));
    return backHome() + head(f.edit ? 'Edit assessment' : 'Schedule an assessment') + `
      <div class="card pad"><div class="cap">Who</div>${C.length ? `<select class="in" data-tascls aria-label="Class" style="margin-bottom:10px"><option value="">Students…</option>${C.map(c => `<option value="${c.id}" ${f.cls === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
        <div class="t-opts">${same.map(it => tick('keys:' + it.k, f.keys.includes(it.k), esc(it.st), esc(it.sub))).join('')}</div></div>
      <div class="card pad"><div class="cap">Type</div>${one('ak', ATY, akN(f.ak), 'g2')}
        <div class="r2" style="margin-top:14px"><label class="f" style="margin:0"><span>Date</span><input class="in" type="date" data-tin="d" value="${f.d}" min="${today()}"></label><label class="f" style="margin:0"><span>Time</span><input class="in" type="time" data-tin="s" value="${esc(f.s)}"></label></div>
        ${M.length ? `<label class="f" style="margin:14px 0 6px"><span>Topics</span></label>${topicPicker(f, 'tp', 'open', 'q', 'Choose topics')}${f.tp.length ? `<p class="note">${f.tp.map(esc).join(', ')}</p>` : ''}` : ''}
        <label class="f" style="margin:12px 0 0"><span>Out of</span><input class="in" inputmode="decimal" data-tin="mx" value="${esc(f.mx)}" placeholder="e.g. 50"></label></div>
      <button class="btn n full" type="button" id="taSave">${f.edit ? 'Save' : 'Schedule'}</button>
      ${f.edit ? '<button class="btn full" type="button" id="taDel" style="margin-top:8px">Remove</button>' : ''}`;
  }
  function saveAssess(del){
    const f = aform, M = f.keys.map(itemOf).filter(Boolean), now = Date.now();
    if(!del){ if(!M.length){ toast('Choose who'); return; } if(new Set(M.map(m => nk(m.sub))).size > 1){ toast('One subject at a time'); return; } if(!/^\d{4}-\d{2}-\d{2}$/.test(f.d)){ toast('Choose the date'); return; } if(f.mx && !(parseFloat(f.mx) > 0)){ toast('Check Out of'); return; } }
    const list = M.map(m => Object.assign({id: f.ids[m.k] || uid(), ty:'a', k:m.k, st:m.st, sub:m.sub, d:f.d, s:f.s || '', ak:f.ak, tp:f.tp.slice(), mx:f.mx ? +f.mx : '', ag:f.ag}, f.cls ? {cls:f.cls} : {}, del ? {x:1} : {}))
      .concat(Object.entries(f.ids).filter(([k]) => !f.keys.includes(k)).map(([, id]) => Object.assign({}, live().find(e => e.id === id) || {id, ty:'a'}, {x:1})));
    aform = null; saveEntries(list, true).then(ok => { if(ok){ toast(del ? 'Removed' : f.edit ? 'Saved' : 'Scheduled'); location.hash = '#teach'; } });
  }
  /* coming up on Home: scheduled assessments in the next 14 days, one line each */
  /* targets, On track and exams for one of my subjects (exams.js, examsui.js; the pack comes with the tutor data) */
  const exInfo = k => { if(!window.EXUI || !data || !data.exam) return null; const it = itemOf(k); if(!it) return null;
    const w = live().filter(e => e.ty === 'w' && e.k === k && !e.abs && e.sc != null && e.sc !== '' && +e.mx > 0).map(e => ({d: e.d, p: Math.round(e.sc / e.mx * 100)}));
    return EXUI.info(k, data.exam, w); };
  const exTarget = k => { const i = exInfo(k); return i && i.c.g ? {g: i.c.g, tp: i.tp} : null; };
  function comingBlock(){
    const t = today(), by = new Map(); scheduled().filter(a => a.d >= t && a.d <= addDays(t, 14)).forEach(a => { const g = a.ag || a.id; if(!by.has(g)) by.set(g, []); by.get(g).push(a); });
    const L = [...by.entries()].sort((p, q) => (p[1][0].d + (p[1][0].s || '')).localeCompare(q[1][0].d + (q[1][0].s || '')));
    const nsb = v => String(v || '').trim().toLowerCase().replace(/^maths$/, 'mathematics');
    const TP = ((data.exam && data.exam.set && data.exam.set.topicals) || []).filter(x => x.d >= t && x.d <= addDays(t, 14)).map(x => ({x, its: items().filter(it => nsb(it.sub) === nsb(x.sub) && (!x.ex || ((exInfo(it.k) || {c: {}}).c.ex || x.ex) === x.ex))})).filter(y => y.its.length);
    const tps = TP.map(({x, its}) => `<div class="it"><span class="cal-t">${WEEKDAY[HD.parseISO(x.d).getDay()].slice(0, 3)}<small>${nice(x.d)}</small></span><span class="t"><b>${atyL(x.ak || 'm')} · ${esc(x.sub)}</b><small>${[x.tp, 'from LHQ', its.length + ' student' + (its.length === 1 ? '' : 's')].filter(Boolean).map(esc).join(' · ')}</small></span></div>`).join('');
    return `<div class="h2">Assessments <em><a href="#teach/assess" style="color:var(--brand);font-weight:800">Schedule</a></em></div>${tps ? `<div class="card">${tps}</div>` : ''}${L.length ? `<div class="card">${L.map(([g, G]) => { const a = G[0], cls = a.cls && (data.classes || []).find(c => c.id === a.cls);
      return `<a class="it" href="#teach/assess/${encodeURIComponent(g)}"><span class="cal-t">${WEEKDAY[HD.parseISO(a.d).getDay()].slice(0, 3)}<small>${nice(a.d)}</small></span><span class="t"><b>${atyL(a.ak)} · ${esc(a.sub)}</b><small>${cls ? esc(cls.name) : G.map(x => esc(short(x.st))).join(', ')}${a.s ? ' · ' + a.s : ''}${(a.tp || []).length ? ' · ' + a.tp.map(esc).join(', ') : ''}</small></span><span class="chev">›</span></a>`; }).join('')}</div>` : ''}`;
  }

  /* ---------- the SRA tracker ---------- */
  /* ---------- a student's topic: by objective, and a follow-up (Reteach next session, Retest, Take-home) ---------- */
  let fuf = null;
  const fuDef = (act, it) => act === 'reteach' ? SRA.nextDay(it || {days: []}, addDays(today(), 1)) : addDays(today(), act === 'take' ? 7 : 14);
  function topicSheet(k, tk){
    const it = itemOf(k); if(!it) return; const E = live(), t = today(), b0 = FUP.before(E, k, tk), L = objOn(it.sub) ? objList(it.sub, tk) : [], M = L.length ? FUP.mastery(E, k, tk, L) : [];
    const F = (data.fu || []).filter(f => f.k === k && SCHED.nk(f.tk) === SCHED.nk(tk) && !f.x).sort((a, b) => (b.at || 0) - (a.at || 0)), op = F.find(f => !FUP.after(f, E)), done = F.filter(f => f !== op);
    if(!fuf || fuf.k !== k || fuf.tk !== tk) fuf = {k, tk, act: 'retest', by: fuDef('retest', it), foc: ''};
    const ms = M.filter(m => m.c === 'g' || m.c === 'y').length, wk = M.filter(m => m.w).length;
    const mast = L.length ? `<div class="cap">By objective</div><div class="card">${M.map(m => `<div class="it"><span class="t-obm o${m.c === 'g' ? 2 : m.c === 'y' ? 1 : m.c === 'r' ? 0 : ''}" style="${m.c ? '' : 'border:2px solid var(--line)'}">${m.c === 'g' ? '✓' : m.c === 'y' ? '½' : m.c === 'r' ? '✕' : ''}</span><span class="t"><b>${esc(m.n)}</b><small>${m.s}</small></span></div>`).join('')}</div><p class="note" style="margin:-6px 0 12px">${ms} secure or developing · ${wk} weak · secure: recalled at the last 2 ARSs</p>` : '';
    const opB = op ? (() => { const need = op.act === 'retest' || (op.act === 'take' && !op.th);
      return `<div class="cap">Follow-up · ${FUP.ACT[op.act]}</div><div class="card">${FUP.detail(op, E, t)}</div>
        ${need ? `<div class="cap">${op.act === 'retest' ? 'Retest marks' : 'Take-home sheets · their own mark'}</div><div class="t-score"><input class="in" id="fuSc" inputmode="decimal" aria-label="Marks"><span>/</span><input class="in" id="fuMx" inputmode="decimal" value="10" aria-label="Out of"><b id="fuPc"></b></div>
          <button class="btn n full" type="button" id="fuRes" style="margin-top:12px">Save ${op.act === 'retest' ? 'retest' : 'take-home'} marks</button>` : `<p class="note">Closes with the next SRA on the topic.</p>`}
        <button class="btn full" type="button" id="fuDel" style="margin-top:8px">Remove this follow-up</button>
        <p class="note">${op.act === 'take' ? 'Take-home marks stand alone. ' : ''}Earlier SRA marks stay as they were.</p>`; })()
      : `<div class="cap">Follow up</div><div class="t-opts" role="radiogroup">${Object.entries(FUP.ACT).map(([a, l]) => `<button type="button" role="radio" aria-checked="${fuf.act === a}" class="t-opt${fuf.act === a ? ' on' : ''}" data-fuact="${a}"><span class="t-ind c"></span><span class="tx">${l}</span></button>`).join('')}</div>
        <label class="f" style="margin-top:10px"><span>${fuf.act === 'retest' ? 'Retest by' : fuf.act === 'reteach' ? 'Reteach on' : 'Check by'}</span><input class="in" type="date" id="fuBy" value="${fuf.by}" min="${t}"></label>
        ${M.some(m => m.w) ? `<div class="cap">Focus on</div><div class="chips">${M.filter(m => m.w).map(m => `<button class="chip${fuf.foc === m.n ? ' on' : ''}" data-fufoc="${esc(m.n)}">${esc(m.n)}</button>`).join('')}</div>` : `<label class="f"><span>Focus on (optional)</span><input class="in" id="fuFoc" value="${esc(fuf.foc)}" autocomplete="off"></label>`}
        <button class="btn n full" type="button" id="fuGo" ${b0 == null ? 'disabled' : ''}>Save</button><p class="note">${b0 == null ? 'Needs a marked SRA on the topic first.' : fuf.act === 'retest' ? 'The retest goes into the SRA tracker. Earlier SRA marks stay as they were.' : fuf.act === 'take' ? 'Take-home marks stand alone; the next SRA on the topic shows if it worked.' : 'The next SRA on the topic shows if it worked.'}</p>`;
    openSheet(`<div class="hx"><h3>${esc(tk)} · ${esc(short(it.st))}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(it.sub)} · latest SRA ${b0 == null ? '–' : b0 + '%'}</p>${mast}${opB}
      ${done.length ? `<div class="cap">Earlier follow-ups</div><div class="card">${done.map(f => { const l = FUP.line(f, E, t); return `<div class="it"><span class="t"><b>${FUP.ACT[f.act]}</b><small>${l.sub}${f.th ? ' · take-home ' + f.th.pc + '%' : ''}</small></span><b style="color:${l.s === 'worked' ? 'var(--ok)' : 'var(--am)'}">${l.s === 'worked' ? 'worked' : 'not yet'}</b></div>`; }).join('')}</div>` : ''}`);
    bindSheet();
    const post = async body => { try{ const j = await hub.api('tutor', {method: 'POST', body: JSON.stringify(Object.assign({action: 'fu'}, body))}); return j; }catch(e){ toast(e.message); return null; } };
    const again = () => { topicSheet(k, tk); };
    document.querySelectorAll('[data-fuact]').forEach(b => b.onclick = () => { fuf.act = b.dataset.fuact; fuf.by = fuDef(fuf.act, it); again(); });
    document.querySelectorAll('[data-fufoc]').forEach(b => b.onclick = () => { fuf.foc = fuf.foc === b.dataset.fufoc ? '' : b.dataset.fufoc; again(); });
    if($('fuBy')) $('fuBy').onchange = () => { fuf.by = $('fuBy').value || fuf.by; };
    if($('fuFoc')) $('fuFoc').oninput = () => { fuf.foc = $('fuFoc').value; };
    if($('fuGo')) $('fuGo').onclick = async () => { const j = await post({op: 'add', k, st: it.st, sub: it.sub, tk, act: fuf.act, by: fuf.by, foc: fuf.foc, before: b0}); if(!j) return; (data.fu = data.fu || []).push(j.f); write(CK, data); fuf = null; toast(FUP.ACT[j.f.act] + ' · by ' + nice(j.f.by)); again(); render(); };
    if($('fuSc')){ const up = () => $('fuPc').textContent = pct($('fuSc').value, $('fuMx').value); $('fuSc').oninput = up; $('fuMx').oninput = up; }
    if($('fuRes')) $('fuRes').onclick = async () => { const sc = $('fuSc').value.trim(), mx = $('fuMx').value.trim(); if(!pct(sc, mx)){ toast('Check the marks'); return; }
      const j = await post({op: 'res', id: op.id, pc: +sc / +mx * 100, d: t}); if(!j) return; data.fu = (data.fu || []).map(f => f.id === op.id ? j.f : f); write(CK, data); toast('Saved · ' + pct(sc, mx)); again(); render(); };
    if($('fuDel')) $('fuDel').onclick = async () => { const j = await post({op: 'del', id: op.id}); if(!j) return; data.fu = (data.fu || []).filter(f => f.id !== op.id); write(CK, data); toast('Removed'); again(); render(); };
  }
  function fuPage(){
    const E = live(), t = today(), rank = {overdue: 0, open: 1, not: 2, worked: 3}, F = (data.fu || []).filter(f => !f.x).map(f => Object.assign({l: FUP.line(f, E, t)}, f)).sort((a, b) => rank[a.l.s] - rank[b.l.s] || a.by.localeCompare(b.by));
    return back('#teach/sra', 'SRA tracker') + head('Follow-ups', 'Weak topics: reteach, retest, take-home') + `<div class="card">${F.map(f => `<button class="it" type="button" data-ttop="${esc(JSON.stringify({k: f.k, tk: f.tk}))}"><span class="t-obm o${f.l.s === 'worked' ? 2 : f.l.s === 'overdue' ? 0 : 1}">${f.l.s === 'worked' ? '✓' : f.l.s === 'not' ? '–' : '!'}</span><span class="t"><b>${esc(f.tk)} · ${esc(short(f.st))}</b><small>${f.l.sub}</small></span><span class="chev">›</span></button>`).join('') || '<p class="empty">None yet. Tap a topic on a student\'s page to follow it up.</p>'}</div><p class="note">A result closes it: the retest, or the next SRA on the topic. Overdue shows in Needs attention.</p>`;
  }
  function sraPage(tab){
    const L = sras().filter(x => !x.paused), t = today(), T = SRA.today(L, t);
    const tabs = `<div class="t-segw" role="tablist">${[['today','Today'],['week','7 days'],['students','By student'],['pack','Take-home']].map(([k, l]) => `<a role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" href="#teach/sra/${k}">${l}</a>`).join('')}</div>`;
    let body = '';
    if(tab === 'students'){
      const f = read('lhq_teach_sraw', ''), C = data.classes || [], I = items();
      const keys = f.startsWith('class:') ? (() => { const c = C.find(x => x.id === f.slice(6)); return c ? I.filter(it => c.stu.includes(stuOf(it.k)) && nk(it.sub) === nk(c.sub)).map(it => it.k) : []; })() : f ? [f] : I.map(it => it.k);
      const TAG = {in:['ok', x => Math.round(x.score.sc / x.score.mx * 100) + '%'], collect:['bl', () => 'due back'], late:['am', () => 'late'], given:['bl', x => 'back ' + HD.parseISO(x.due).getDate()], give:['am', () => 'today'], overdue:['rd', () => 'missed'], upcoming:['gr', x => nice(x.giveOn).replace(/ \d{4}$/, '')], after:['gr', () => 'next period'], pack:['gr', () => 'pack'], home:['bl', () => 'at home']};
      body = `<div class="card pad"><label class="f" style="margin:0"><span>Show</span><select class="in" data-tsraw aria-label="Show"><option value="">All students</option>${C.map(c => `<option value="class:${c.id}" ${f === 'class:' + c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}${I.map(it => `<option value="${esc(it.k)}" ${f === it.k ? 'selected' : ''}>${esc(it.st)} · ${esc(it.sub)}</option>`).join('')}</select></label></div>` +
        keys.map(k => { const it = itemOf(k); if(!it) return ''; const X = L.filter(x => x.k === k), byT = new Map(); X.forEach(x => { if(!byT.has(x.topic)) byT.set(x.topic, []); byT.get(x.topic).push(x); });
          return `<div class="h2">${esc(it.st)} <em>${esc(it.sub)}</em></div><div class="card">${[...byT.entries()].map(([tp, R]) => `<div class="it" style="display:block"><b style="display:block">${esc(tp)}</b><small style="color:var(--muted);font-size:12.5px">Learning Day ${nice(R[0].learnt)}</small>
            <div class="t-chips6">${R.sort((a, b) => a.stage - b.stage).map(x => `<button type="button" class="tag ${TAG[x.status][0]}" data-tsdet="${esc(ref(x))}" aria-label="${x.label}"><span>${x.stage ? 'R' + x.stage : 'LD'}</span>${TAG[x.status][1](x)}</button>`).join('')}</div></div>`).join('') || '<p class="empty">No topics finished yet.</p>'}</div>`; }).join('') +
        '<p class="note">LD · R1–R5 · green in · blue out · amber due · red missed</p>';
    } else if(tab === 'pack'){
      body = packTab();
    } else if(tab === 'week'){
      body = Array.from({length: 7}, (_, i) => addDays(t, i)).map((d, i) => { const g = L.filter(x => x.giveOn === d && ['upcoming','give'].includes(x.status)), late = i === 0 ? L.filter(x => x.status === 'overdue') : [];
        return `<div class="h2">${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : WEEKDAY[HD.parseISO(d).getDay()].slice(0, 3) + ' ' + nice(d)} <em>${g.length + late.length}</em></div><div class="card">${late.concat(g).map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${esc(x.sub)} · ${x.label}${x.giveOn !== x.doOn ? ` · give ${nice(x.giveOn)}, do on ${nice(x.doOn)}` : ` · do on ${nice(x.doOn)}`}</small></span>${x.status === 'overdue' ? `<button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button>` : i === 0 ? `<button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button>` : `<button class="btn sm" type="button" data-tgive="${ref(x)}" data-early="1">Give early</button>`}</div>`).join('') || '<p class="empty">None.</p>'}</div>`; }).join('') +
        '<p class="note">Given early, an SRA keeps its do-on day.</p>';
    } else {
      const O = L.filter(x => x.status === 'given');
      body = `<div class="h2">Give today <em>${T.give.length}</em></div><div class="card">${T.give.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · ARS + SRA · do on ${nice(x.doOn)}${x.status === 'overdue' ? ` · <span style="color:var(--rd);font-weight:800">was for ${nice(x.giveOn)}</span>` : ''}</small></span><button class="btn sm" type="button" data-tgive="${ref(x)}">Given</button></div>`).join('') || '<p class="empty">Nothing to hand out today.</p>'}
        ${T.give.length > 1 ? `<div class="it"><span class="t"><small>Or tick them in a session log</small></span><button class="btn sm n" type="button" data-tgiveall>All given</button></div>` : ''}</div>
        <div class="h2">To collect <em>${T.collect.length}</em></div><div class="card">${T.collect.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · given ${nice(x.given.d)}${x.moved ? ` · <span style="color:var(--am);font-weight:800">not handed in ${nice(x.moved)}, due again today</span>` : x.status === 'late' ? ' · <span style="color:var(--am);font-weight:800">late</span>' : ''}</small></span><button class="btn sm" type="button" data-tin="${ref(x)}">Handed in?</button></div>`).join('') || '<p class="empty">Nothing due back today.</p>'}</div>
        <div class="h2">Print for ${T.printDay === addDays(t, 1) ? 'tomorrow' : nice(T.printDay)} <em>${(n => n + (n === 1 ? ' copy' : ' copies'))(T.print.reduce((a, g) => a + g.students.length, 0))}</em></div>
        <div class="card">${T.print.map(g => `<div class="it"><span class="t"><b>${esc(g.topic)} · ${g.label}</b><small>${esc(g.sub)} · for ${g.students.map(s => esc(s.st.split(' ')[0])).join(', ')} · ARS + SRA · the sheet says "Do on ${nice(g.students[0].doOn)}"</small></span><span class="tag bl">× ${g.students.length}</span></div>`).join('') || '<p class="empty">Nothing to print yet.</p>'}</div>
        <p class="note" style="margin:-6px 2px 14px">Printing is manual for now.</p>
        ${(RT => RT.length ? `<div class="h2">Retests <em>${RT.length}</em></div><div class="card">${RT.map(f => `<button class="it" type="button" data-ttop="${esc(JSON.stringify({k: f.k, tk: f.tk}))}"><span class="t"><b>${esc(short(f.st))} · ${esc(f.tk)}</b><small>${esc(f.sub)} · by ${nice(f.by)}${f.by < t ? ' · <span style="color:var(--rd);font-weight:800">overdue</span>' : ''} · was ${f.before}%</small></span><span class="chev">›</span></button>`).join('')}</div>` : '')((data.fu || []).filter(f => !f.x && f.act === 'retest' && !f.res).sort((a, b) => a.by.localeCompare(b.by)))}
        <div class="h2">Out with students <em>${O.length}</em></div><div class="card">${O.map(x => `<div class="it"><span class="t"><b>${esc(short(x.st))} · ${esc(x.topic)}</b><small>${x.label} · given ${nice(x.given.d)} · due back ${nice(x.due)}</small></span></div>`).join('') || '<p class="empty">None.</p>'}</div>`;
    }
    return (tutorRole() ? '' : backHome()) + head('SRA tracker', 'When each SRA is given, done and collected', `<div class="acts"><a class="btn" href="#teach/fu">Follow-ups</a>${logBtn()}</div>`) + tabs + body;
  }
  /* ---------- the take-home pack: reviews after a student's last session, printed and handed over at that session ---------- */
  const packKey = p => encodeURIComponent(p.k + '|' + p.on);
  const packOf = key => { const [st, sub, on] = decodeURIComponent(key).split('|'); return SRA.packs(sras(), today(), 400).find(p => p.k === st + '|' + sub && p.on === on); };
  const outEntry = p => live().find(e => e.ty === 'p' && e.k === p.k && e.on === p.on);
  function packTab(){
    const t = today(), P = SRA.packs(sras(), t), sd = data.sradone || {};
    const soon = P.filter(p => !p.out && p.on >= t), late = P.filter(p => !p.out && p.on < t), done = P.filter(p => p.out);
    const sheet = x => `<div class="it"><span class="t"><b>${esc(x.topic)} · R${x.stage}</b><small>Do on ${WEEKDAY[HD.parseISO(x.doOn).getDay()].slice(0, 3)} ${nice(x.doOn)}${x.from ? ` · <span style="color:var(--am);font-weight:700">moved from ${nice(x.from)}</span>` : ''}</small></span></div>`;
    const card = p => { const id = packKey(p), said = p.sheets.filter(x => sd[[x.k, x.topic, x.stage].join('|')] || x.status === 'in').length;
      return `<div class="card pad"><div class="it" style="padding-top:0"><span class="t"><b>${esc(p.st)}</b><small>${esc(p.sub)} · last session ${p.on === t ? 'today' : WEEKDAY[HD.parseISO(p.on).getDay()].slice(0, 3) + ' ' + nice(p.on)}</small></span><b style="color:var(--brand)">${p.sheets.length} sheet${p.sheets.length === 1 ? '' : 's'}</b></div>
        ${p.out ? `<p class="note" style="margin:0 0 8px">${said} of ${p.sheets.length} done</p>` : `<div class="cap" style="margin-top:6px">Print</div>${p.sheets.map(sheet).join('')}`}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">${p.out ? '' : `<button class="btn sm" type="button" data-tpkprint="${id}">Print list</button>`}</div>
        <button type="button" role="checkbox" aria-checked="${!!p.out}" class="t-opt${p.out ? ' on' : ''}" data-tpkout="${id}"><span class="t-ind"></span><span class="tx">Pack handed over${p.out ? `<small>${nice(p.out.d)}${p.out.by && nk(p.out.by) !== nk(me().name) ? ' · ' + esc(p.out.by) : ''}</small>` : ''}</span></button></div>`; };
    return (late.length ? `<div class="h2">Not ticked yet <em>${late.length}</em></div>${late.map(card).join('')}` : '') +
      `<div class="h2">${soon.some(p => p.on === t) ? 'Last session today' : 'Next 7 days'} <em>${soon.length}</em></div>${soon.map(card).join('') || '<div class="card"><p class="empty">None.</p></div>'}` +
      (done.length ? `<div class="h2">Handed over <em>${done.length}</em></div>${done.map(card).join('')}` : '') +
      '';
  }
  const firstN = n => String(n || '').trim().split(/\s+/)[0];
  /* the A4 list that goes on top of the sheets: shown over the Hub with Print and Close (no pop-up, so it works on phones and installed apps) */
  function printPack(p){
    const WD = d => WEEKDAY[HD.parseISO(d).getDay()].slice(0, 3) + ' ' + nice(d);
    let el = document.getElementById('pkPrint');
    if(!el){ el = document.createElement('div'); el.id = 'pkPrint'; document.body.appendChild(el);
      const css = document.createElement('style'); css.textContent = `#pkPrint{position:fixed;inset:0;z-index:10000;background:#e3e7ee;overflow:auto;color:#14213d;font:14px/1.5 "Segoe UI",system-ui,sans-serif}#pkPrint[hidden]{display:none}
#pkPrint .bar{position:sticky;top:0;display:flex;gap:8px;justify-content:flex-end;padding:10px 16px;background:#e3e7ee}#pkPrint .bar button{font:inherit;font-weight:800;border-radius:10px;padding:9px 16px;cursor:pointer;border:1px solid #c5ccd6;background:#fff;color:#073763}#pkPrint .bar .p{background:#073763;color:#fff;border-color:#073763}
#pkPrint .pg{max-width:794px;margin:0 auto 24px;background:#fff;padding:44px 52px;box-shadow:0 8px 24px rgba(0,0,0,.15)}#pkPrint .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #073763;padding-bottom:12px;margin-bottom:16px;gap:16px}
#pkPrint .lg{font-weight:900;font-size:26px;color:#073763}#pkPrint .lg i{color:#f4b223;font-style:normal}#pkPrint .lg small{display:block;font-size:9px;letter-spacing:.12em;color:#6b7585}#pkPrint h1{margin:0;font-size:22px;color:#073763;text-align:right}
#pkPrint .sub{text-align:right;color:#3d4a63;font-weight:700}#pkPrint .sub small{display:block;color:#6b7585;font-weight:600;font-size:12.5px}#pkPrint table{width:100%;border-collapse:collapse}#pkPrint th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7585;border-bottom:1.5px solid #14213d;padding:6px}
#pkPrint td{border-bottom:1px solid #d5dae2;padding:9px 6px}#pkPrint td.bx span{display:inline-block;width:18px;height:18px;border:1.5px solid #14213d;border-radius:4px}#pkPrint .how{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px;font-size:12.5px}
#pkPrint .how div{border:1px solid #d5dae2;border-radius:8px;padding:10px 12px}#pkPrint .how b{display:block;color:#073763}
@media (max-width:700px){#pkPrint .pg{padding:22px 16px;margin:0 10px 16px}#pkPrint .how{grid-template-columns:1fr}#pkPrint .hd{flex-direction:column}#pkPrint h1,#pkPrint .sub{text-align:left}}
@media print{body>*:not(#pkPrint){display:none!important}#pkPrint{position:static;background:#fff;overflow:visible}#pkPrint .bar{display:none}#pkPrint .pg{box-shadow:none;margin:0;max-width:none}}`; document.head.appendChild(css); }
    el.innerHTML = `<div class="bar"><button type="button" data-pkx>Close</button><button type="button" class="p" data-pkp>Print</button></div><div class="pg"><div class="hd"><div class="lg">LHQ<i>.</i><small>LEARNING SOLUTIONS</small></div><div><h1>Your take-home pack</h1><div class="sub">${esc(p.st)} · ${esc(p.sub)}<small>From ${esc(me().name)} · ${WD(p.on)} ${p.on.slice(0, 4)}</small></div></div></div>
<p style="margin:0 0 14px;color:#3d4a63">One sheet on its day.</p>
<table><tr><th>Do on</th><th>Topic</th><th>Review</th><th>Done</th><th>Mark</th></tr>${p.sheets.map(x => `<tr><td><b>${WD(x.doOn)}</b></td><td>${esc(x.topic)}</td><td>Review ${x.stage}</td><td class="bx"><span></span></td><td style="color:#6b7585">____ / ____</td></tr>`).join('')}</table>
<div class="how"><div><b>Missed one?</b>Do it the next day.</div><div><b>LHQ Hub</b>Practice › Take-home</div><div><b>Back at LHQ?</b>Bring the sheets.</div></div></div>`;
    el.hidden = false; document.documentElement.classList.add('gs-open');
    const close = () => { el.hidden = true; document.documentElement.classList.remove('gs-open'); window.removeEventListener('hashchange', close); };
    el.querySelector('[data-pkx]').onclick = close; el.querySelector('[data-pkp]').onclick = () => window.print(); window.addEventListener('hashchange', close);
  }
  function sraSheet(x){
    const ST = {in:'Handed in', collect:'Due back today', late:'Late', given:'Out with the student', give:'Give today', overdue:'Missed · not handed out yet', upcoming:'Coming up', after:'After this tuition period · waits for the next one', pack:'In the take-home pack', home:'At home · in the take-home pack'};
    openSheet(`<div class="hx"><h3>${esc(short(x.st))} · ${esc(x.topic)} · ${x.label}</h3><button class="ib" data-close>✕</button></div>
      <div class="t-kv" style="margin-bottom:14px"><span>Learning Day</span><b>${nice(x.learnt)}</b><span>Do on</span><b>${nice(x.doOn)}</b><span>Give on</span><b>${nice(x.giveOn)}${x.giveOn !== x.doOn ? ' (no session that day)' : ''}</b><span>Status</span><b>${ST[x.status]}</b>${x.given ? `<span>Given</span><b>${nice(x.given.d)}</b><span>Due back</span><b>${nice(x.due)}</b>` : ''}${x.score ? `<span>Score</span><b>${x.score.sc}/${x.score.mx} · ${pct(x.score.sc, x.score.mx)}</b>` : ''}</div>
      ${['give','overdue'].includes(x.status) ? `<button class="btn n full" type="button" data-tgive="${ref(x)}">Mark as given today</button>` : x.status === 'upcoming' ? `<button class="btn n full" type="button" data-tgive="${ref(x)}" data-early="1">Give early, today</button>` : ['collect','late','given'].includes(x.status) ? `<button class="btn n full" type="button" data-tin="${ref(x)}">Handed in? Enter marks</button>` : x.status === 'home' ? `<a class="btn n full" href="#teach/marks/${ref(x)}">Brought back? Enter marks</a>` : x.pack ? `<a class="btn full" href="#teach/sra/pack">Take-home pack</a>` : ''}`);
    bindSheet();
  }
  function handInSheet(x){
    const nxt = SRA.nextDay(itemOf(x.k) || {days: []}, addDays(today(), 1));
    openSheet(`<div class="hx"><h3>${esc(short(x.st))} · ${esc(x.topic)} · ${x.label}</h3><button class="ib" data-close>✕</button></div><p class="sp">Given ${nice(x.given.d)} · due back ${nice(x.due)}</p>
      <div class="cap">Marks</div><div class="t-score"><input class="in" id="thSc" inputmode="decimal" aria-label="Marks"><span>/</span><input class="in" id="thMx" inputmode="decimal" value="10" aria-label="Out of"><b id="thPc"></b></div>
      <div id="thArs"></div>
      <button class="btn n full" type="button" id="thGo" style="margin-top:14px">Handed in · save marks</button>
      <button class="btn full" type="button" id="thNo" style="margin-top:8px">Not handed in · due ${nice(nxt)}</button>
      <p class="note">Not handed in: moves to the next session, marked late.</p>`);
    const up = () => $('thPc').textContent = pct($('thSc').value, $('thMx').value); $('thSc').oninput = up; $('thMx').oninput = up;
    const A = {ars: null, ao: aoOf(x.topic), na: false, osub: x.sub, otk: x.topic}, drawA = () => { const b = $('thArs'); if(!b) return; b.innerHTML = arsHTML(A, false); bindArs(b, A, drawA); }; drawA();
    const base = {ty:'r', v:2, k:x.k, st:x.st, sub:x.sub, d:today(), tk:x.topic, rv:x.stage};
    $('thGo').onclick = () => { const sc = $('thSc').value.trim(), mx = $('thMx').value.trim(); if(!pct(sc, mx)){ toast('Check the marks'); return; }
      if(!arsOk(A)){ toast(+A.ao > 0 ? 'Add the ARS score, or tick No ARS' : 'Add what the ARS is out of'); return; }
      saveEntries([arsTo(Object.assign({id: uid(), h:'o', sc:+sc, mx:+mx}, base), A)], true).then(ok => { if(ok){ closeSheet(); toast('Marks saved · ' + pct(sc, mx) + (A.na ? ' · no ARS' : ' · ARS ' + pct(A.ars, A.ao))); } }); };
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
      const q = read(QK, []).filter(x => !(x.t === 'r' && x.report.d === t)); q.push({t:'r', report}); write(QK, q); toast('Saved · sends when online'); }
    render(); scrollTo(0, 0);
  }

  /* ---------- classes ---------- */
  function classesPage(){
    const C = data.classes || [];
    return backHome() + head('Classes', 'Official classes that don\'t change. Everything else is one-to-one.', `<div class="acts"><button class="btn n" data-tclsnew>${ic('plus',16,2.4)} New class</button></div>`) +
      `<div class="card">${C.map(c => `<a class="it" href="#teach/class/${c.id}"><span class="t"><b>${esc(c.name)}</b><small>${esc(c.sub)} · ${c.stu.length} students · ${esc(c.mode)}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('') || '<p class="empty">No classes. Make one for students taught together.</p>'}</div>
      <p class="note">Finishing a topic starts SRAs for everyone present.</p>`;
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
      ${row('#teach/log/' + encodeURIComponent(k || 'pick'), 'S', 'bl', 'A session', 'Attendance, topics, SRAs, guide, assessment')}
      ${row('#teach/marks' + (k ? '/' + encodeURIComponent(k) : ''), 'R', 'ok', 'SRA marks', 'For an SRA handed in, today or earlier')}
      ${row('#teach/wa', 'A', 'am', 'Assessment marks', P ? `${P} waiting` : 'One student, or a class')}
      ${row('#teach/assess' + (k ? '/new:' + encodeURIComponent(k) : ''), '+', 'gr', 'Schedule an assessment', 'Weekly, monthly, past paper')}`);
    document.querySelectorAll('#sheet a.t-opt').forEach(a => a.addEventListener('click', () => { form = null; mform = null; wform = null; aform = null; closeSheet(); }));
  }

  /* ---------- taps ---------- */
  const setPath = (o, p, v) => { const k = p.split('.'); const last = k.pop(); const t = k.reduce((a, x) => (a[x] = a[x] ?? {}), o); t[last] = v; };
  const getPath = (o, p) => p.split('.').reduce((a, x) => a == null ? a : a[x], o);
  const curForm = () => location.hash.startsWith('#teach/log') ? form : location.hash.startsWith('#teach/marks') ? mform : location.hash.startsWith('#teach/wa') ? wform : location.hash.startsWith('#teach/assess') ? aform : location.hash.startsWith('#teach/report') ? rform : null;
  function giveEntries(L){ return L.map(x => ({id: uid(), ty:'g', k:x.k, st:x.st, sub:x.sub, d:today(), tk:x.topic, rv:x.stage})); }
  function bindSheet(){
    document.querySelectorAll('#sheet [data-tgive]').forEach(el => el.onclick = () => { const x = unref(el.dataset.tgive); if(!x) return; closeSheet(); saveEntries(giveEntries([x]), true).then(ok => ok && toast(el.dataset.early ? 'Given early · still done on its review day' : 'Marked as given')); });
    document.querySelectorAll('#sheet [data-tin]').forEach(el => el.onclick = () => { const x = unref(el.dataset.tin); if(x) handInSheet(x); });
  }
  function bind(){
    if(window.KPIUI && location.hash.startsWith('#teach/perf')) KPIUI.bindTutor(render);
    if(window.TPAYUI && location.hash.startsWith('#teach/pay')) TPAYUI.bind();
    document.querySelectorAll('[data-textg]').forEach(b => b.onclick = () => { const k = b.dataset.textg, it = itemOf(k), i = exInfo(k); if(!it || !i) return;
      EXUI.targetSheet({k, name: it.st, sub: it.sub, i, onSaved: async () => { await fetchData(); render(); }}); });
    const on = (sel, fn) => document.querySelectorAll('#main ' + sel).forEach(el => el.onclick = ev => fn(el, ev));
    on('[data-ttop]', el => { try{ const o = JSON.parse(el.dataset.ttop); topicSheet(o.k, o.tk); }catch(e){} });
    if(window.STV) STV.bind();
    // the report dot on the bar
    document.querySelectorAll('.t-dot').forEach(x => x.remove());
    if(data && tutorRole()){ const due = !todayRep(); document.querySelectorAll('a[href$="#teach/report"]').forEach(a => { if(a.closest('#main')) return; const d = document.createElement('span'); d.className = 't-dot' + (due ? '' : ' ok'); d.title = due ? 'Today\'s report is due' : 'Today\'s report is sent'; a.appendChild(d); }); }
    if(!data) return;
    on('[data-tlog]', el => chooser(el.dataset.tlog));
    on('[data-tmubook]', el => makeupSheet(el.dataset.tmubook));
    on('[data-tmucancel]', async el => { try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'makeup', id: el.dataset.tmucancel, cancel: true})}); await fetchData(); toast('Taken back'); }catch(e){ toast(e.message); } });
    on('[data-tack]', el => { const [s, id] = el.dataset.tack.split(':'); ack(id, s); });
    on('[data-tcant]', el => cantSheet(el.dataset.tcant));
    on('[data-tavrm]', el => { const L = (data.avail || []).slice().sort((a, b) => DORDER.indexOf(a.d) - DORDER.indexOf(b.d) || a.s.localeCompare(b.s)); L.splice(+el.dataset.tavrm, 1); saveAvail(L); });
    on('[data-tavadd]', () => { const d = $('tavD').value, s = $('tavS').value, e = $('tavE').value, n = $('tavN').value.trim(); if(!s || !e || s >= e){ toast('The time ends before it starts'); return; }
      saveAvail((data.avail || []).concat((d === 'wk' ? ['Mo','Tu','We','Th','Fr'] : [d]).map(x => ({d:x, s, e, note:n})))); });
    on('[data-tans]', el => { const [a, ...r] = el.dataset.tans.split(':'), id = r.join(':');
      if(a === 'yes') return answer(id, true);
      openSheet(`<div class="hx"><h3>Keep your times</h3><button class="ib" data-close>✕</button></div><label class="f"><span>Note (the student sees it)</span><input class="in" id="tansN" placeholder="e.g. We started at 14:00 with the past paper"></label><button class="btn n full" id="tansGo">Keep mine</button>`);
      $('tansGo').onclick = () => answer(id, false, $('tansN').value); });
    on('[data-tclx]', el => { const [a, ...k] = el.dataset.tclx.split(':'), key = k.join(':');
      if(a === 'together') return clashDo(a, key);
      openSheet(`<div class="hx"><h3>Send the clash to LHQ</h3><button class="ib" data-close>✕</button></div><label class="f"><span>Anything LHQ should know (optional)</span><input class="in" id="tclN" placeholder="e.g. Tadala can only do Tuesdays"></label><button class="btn n full" id="tclGo">Send to LHQ</button>`);
      $('tclGo').onclick = () => clashDo('admin', key, $('tclN').value); });
    on('[data-tclmove]', el => { const c = (data.clashes || []).find(x => x.key === el.dataset.tclmove); if(c) window.clashMove(c, {me: myName(), after: fetchData}); });
    if(window.SOUNDS && /^#teach\/sounds/.test(location.hash)) SOUNDS.bind();
    on('[data-taskmv]', el => { const {k, d, s: s0, st, sub: sb, why} = JSON.parse(el.dataset.taskmv);
      openSheet(`<div class="hx"><h3>Ask LHQ to move it</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(st)} · ${esc(sb)} · ${nice(d)} ${esc(s0)}</p><label class="f"><span>Why</span><input class="in" id="tAskW" value="${esc(why)}"></label><button class="btn n full" id="tAskGo">Send to LHQ</button><p class="note" style="margin-top:8px">LHQ moves it or keeps it, and you're told.</p>`);
      $('tAskGo').onclick = async () => { try{ await hub.api('tutor', {method: 'POST', body: JSON.stringify({action: 'askmove', k, d, s: s0, st, sub: sb, why: $('tAskW').value})}); (data.asks = data.asks || []).push({k, d}); closeSheet(); toast('Sent to LHQ'); render(); }catch(e){ toast(e.message); } }; });
    on('[data-ttk]', el => { let D = {}; try{ D = JSON.parse(localStorage.getItem('lhq_tsteps') || '{}'); }catch(e){} const id = el.dataset.ttk; if(D[id]) delete D[id]; else D[id] = Date.now(); try{ localStorage.setItem('lhq_tsteps', JSON.stringify(D)); }catch(e){} render(); });
    on('[data-tsx]', el => { const it = itemOf(decodeURIComponent((location.hash.split('/')[2]) || '')); if(!it) return; const x = sxOf(it.st), W = x.w || [], v = el.dataset.tsx, cur = W[W.length - 1] || {}, hmn = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
      const rows = v === 'f' ? (cur.rounds || []).map(r => `<div class="it"><span class="t"><b>${esc(r[1] || 'Focus')}</b><small>${nice(r[0])}</small></span><b>${r[2]} min</b></div>`).join('')
        : v === 'p' ? `<div class="it"><span class="t"><b>Study and Revision blocks</b><small>Week of ${nice(cur.mon)} · names and times stay private</small></span><b>${hmn(cur.p || 0)}</b></div>`
        : (w => `<div class="it"><span class="t"><b>Focus time</b><small>finished rounds</small></span><b>${hmn(w.f)}</b></div><div class="it"><span class="t"><b>Study planned</b><small>Study and Revision blocks</small></span><b>${hmn(w.p)}</b></div>${Object.entries(w.bySub || {}).map(([sb, m]) => `<div class="it"><span class="t">${esc(sb || 'No subject')}</span><b>${hmn(m)}</b></div>`).join('')}`)(W[+v.slice(1)] || {});
      openSheet(`<div class="hx"><h3>${v === 'f' ? 'Focus time · ' + hmn(cur.f || 0) : v === 'p' ? 'Study planned · ' + hmn(cur.p || 0) : 'Week of ' + nice((W[+v.slice(1)] || {}).mon || '')}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(it.st)}${v === 'f' ? ' · this week · subjects, not topics' : ''}</p><div class="card">${rows || '<p class="empty">None.</p>'}</div>`); });
    on('[data-tcallink]', async () => { const u = location.origin + (data.calLink || ''); try{ await navigator.clipboard.writeText(u); toast('Link copied'); }catch(e){ prompt('Copy this link:', u); } });
    on('[data-tgive]', el => { const x = unref(el.dataset.tgive); if(x) saveEntries(giveEntries([x]), true).then(ok => ok && toast(el.dataset.early ? 'Given early · still done on its review day · comes back after ' + nice(x.doOn) : 'Marked as given')); });
    on('[data-tpkprint]', el => { const p = packOf(el.dataset.tpkprint); if(p) printPack(p); });
    on('[data-tpkout]', el => { const p = packOf(el.dataset.tpkout); if(!p) return; const e0 = outEntry(p);
      const e = e0 ? Object.assign({}, e0, {x: 1}) : {id: uid(), ty: 'p', k: p.k, st: p.st, sub: p.sub, on: p.on, d: today(), n: p.sheets.length};
      saveEntries([e], true).then(ok => ok && toast(e0 ? 'Undone' : 'Handed over')); });
    on('#taSave', () => saveAssess(false));
    on('#taDel', () => { if(confirm('Remove this assessment?')) saveAssess(true); });
    const tcls = document.querySelector('#main [data-tascls]'); if(tcls && aform) tcls.onchange = () => { const c = (data.classes || []).find(x => x.id === tcls.value); aform.cls = c ? c.id : ''; if(c) aform.keys = items().filter(it => c.stu.includes(stuOf(it.k)) && nk(it.sub) === nk(c.sub)).map(it => it.k); render(); };
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
    if($('tmSave')){ $('tmSave').onclick = saveMarks; bindArs(document.getElementById('main'), mform, render); }
    if($('tmDel')) $('tmDel').onclick = () => { if(!confirm('Delete this log?')) return; const e = live().find(x => x.id === mform.edit); mform = null; saveEntries([Object.assign({}, e, {x:1})], true).then(() => { toast('Log deleted'); location.hash = '#teach'; }); };
    if($('twSave')) $('twSave').onclick = saveWa;
  }
  const isTutor = () => me().role === 'tutor' || !!me().tutor;
  /* search: what's in this tutor's account (students, topics, SRAs, logged sessions, classes, make-ups, assessments) */
  function searchGroups(){
    const I = items(), seen = new Set(), stuK = it => '#teach/student/' + encodeURIComponent(it.k), R = n => n ? 'R' + n : 'LD', E = live();
    const T = [], tk = new Set(); E.filter(e => e.ty === 's' && Array.isArray(e.tp)).forEach(e => e.tp.forEach(x => { const t = x.t || x, key = e.k + '|' + t; if(!tk.has(key) && typeof t === 'string'){ tk.add(key); T.push({t: t + ' · ' + short(e.st), s: e.sub + (x.f ? ' · finished ' + nice(e.d) : ''), href: '#teach/student/' + encodeURIComponent(e.k)}); } }));
    return [{g: 'Topics', items: T},
      {g: 'SRAs', items: sras().filter(x => x.status !== 'upcoming' || x.giveOn <= HD.addDays(today(), 7)).slice(0, 400).map(x => ({t: `${x.topic} ${R(x.stage)} · ${short(x.st)}`, s: `${x.sub} · ${x.status === 'in' && x.score ? 'handed in · ' + Math.round(x.score.sc / x.score.mx * 100) + '%' : x.status === 'give' ? 'give today' : 'do on ' + nice(x.doOn)}`, k: x.st, href: '#teach/sra/students'}))},
      {g: 'Sessions', items: E.filter(e => e.ty === 's').sort((a, b) => (b.d || '').localeCompare(a.d || '')).slice(0, 300).map(e => ({t: `${nice(e.d)} · ${short(e.st)}`, s: `${e.sub} · ${ATTL[e.a] || e.a || ''}${e.t1 ? ' · ' + e.t1 + '–' + (e.t2 || '') : ''}`, k: e.st + ' ' + e.d, href: '#teach/log/' + encodeURIComponent(e.k)}))},
      {g: 'Assessments', items: E.filter(e => e.ty === 'w' || e.ty === 'a').sort((a, b) => (b.d || '').localeCompare(a.d || '')).slice(0, 200).map(e => ({t: `${(window.MARKS ? MARKS.TY[MARKS.akN(e.ak)] : '') || 'Assessment'} · ${short(e.st)}`, s: `${e.sub} · ${nice(e.d)}${e.ty === 'w' && e.sc != null && e.sc !== '' && +e.mx ? ' · ' + Math.round(e.sc / e.mx * 100) + '%' : e.ty === 'a' ? ' · scheduled' : ''}`, href: '#teach/student/' + encodeURIComponent(e.k)}))},
      {g: 'Follow-ups', items: (data.fu || []).filter(f => !f.x).map(f => { const l = FUP.line(f, E, today()); return {t: `${FUP.ACT[f.act]} · ${f.tk} · ${short(f.st)}`, s: `${f.sub} · ${l.sub.replace(FUP.ACT[f.act] + ' · ', '')}`, k: 'follow up retest reteach take-home ' + f.st, href: '#teach/fu'}; })},
      {g: 'Classes', items: (data.classes || []).map(c => ({t: c.name, s: `${c.sub} · ${(c.stu || []).length} students`, href: '#teach/classes'}))},
      {g: 'Make-ups', items: (data.makeups || []).map(m => ({t: `Make-up · ${short(m.st)}`, s: `${m.sub} · ${nice(m.d)} ${m.s || ''} · ${m.status === 'ok' ? 'confirmed' : m.status === 'no' ? 'declined' : 'waiting'}`, href: '#teach/makeups'}))}];
  }
  return {page, bind, bell, isTutor, refresh: fetchData, items, sras, sessions, gaps, pendingWa, dayLogs, searchGroups};
})();
