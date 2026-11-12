/* LHQ Hub › student extras: Home cards with a picture, the Focus timer, study blocks on a Day view, reminders, habits, the bar.
   Every figure opens what's behind it. Built from the family data (k: one student). */
window.SX = (function(){
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x.getTime()); };
  const wdOf = d => new Date(d + 'T00:00:00Z').getUTCDay();
  const dl = d => `${WD[wdOf(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`;
  const mondayOf = d => add(d, -((wdOf(d) + 6) % 7));
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const hmin = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
  const avg = L => L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  const read = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } };
  const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const isParent = () => (window.hub && hub.session && (hub.session() || {}).me || {}).role === 'parent';
  const T = () => (window.HD ? HD.today() : iso(Date.now()));
  const R = n => n === 0 ? 'LD' : 'R' + n;
  const esc = v => String(v == null ? '' : v).replace(/^Mathematics$/i, 'Maths').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const sheet = (t, sub, how, rows, sum) => openSheet(`<div class="hx"><h3>${t}</h3><button class="ib" data-close>✕</button></div>${sub ? `<p class="sp">${sub}</p>` : ''}${how ? `<p class="note" style="margin:-6px 0 10px">${how}</p>` : ''}<div class="card">${rows || '<p class="empty">Nothing here.</p>'}${sum ? `<div class="sx-sum">${sum}</div>` : ''}</div>`);
  const row = (a, s, v, c = '') => `<div class="sx-dl ${c}"><span>${a}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  const CSS = `.sx-pc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}.sx-pc>button{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:6px;min-height:112px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-width:0}.sx-pc>button:hover{border-color:var(--muted)}
.sx-pc .h{font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}.sx-pc .v{font-size:22px;font-weight:800;color:var(--brand);line-height:1.1}.sx-pc small{color:var(--muted);font-size:12px}.sx-pc .wide{grid-column:1/-1}.sx-pc .sx-up{color:var(--ok);font-weight:800}.sx-pc .sx-dn{color:var(--am);font-weight:800}
.sx-c7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center}.sx-c7 b{font-size:10.5px;color:var(--muted)}.sx-c7 i{font-style:normal;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:800;max-width:30px;margin:0 auto;width:100%}
.sx-c7 i.g,.sx-lg i.g{background:var(--ok);color:#fff}.sx-c7 i.y,.sx-lg i.y{background:#f3d38a;color:#5a3d00}.sx-c7 i.r,.sx-lg i.r{background:var(--rd-bg,#fde8e8);color:var(--rd);box-shadow:inset 0 0 0 1.5px var(--rd)}.sx-c7 i.n,.sx-lg i.n{background:var(--line2);color:var(--muted)}.sx-c7 i.p{visibility:hidden}
.sx-lg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11px;color:var(--muted);margin-top:8px}.sx-lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
.sx-dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:9px 14px;border-top:1px solid var(--line2);font-size:13.5px}.sx-dl:first-child{border-top:0}.sx-dl small{grid-column:1/-1;color:var(--muted);font-size:12px}.sx-dl b{white-space:nowrap}.sx-dl.g b{color:var(--ok)}.sx-dl.y b{color:var(--am)}.sx-dl.r b{color:var(--rd)}
.sx-sum{display:flex;justify-content:space-between;padding:10px 14px;background:var(--surface2);border-top:1px solid var(--line2);font-weight:800}
.sx-hb{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:10px 14px;border-top:1px solid var(--line2);cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font:inherit;color:var(--ink)}.sx-hb:first-child{border-top:0}.sx-hb:hover{background:var(--hover)}.sx-hb small{display:block;color:var(--muted);font-size:12px}.sx-hb b{font-variant-numeric:tabular-nums}.sx-hb .u{color:var(--ok);font-weight:800;font-size:12px}.sx-hb .d{color:var(--am);font-weight:800;font-size:12px}.sx-hb .chev{color:var(--muted)}
.sx-tm{text-align:center;padding:6px 0}.sx-rd{display:flex;gap:6px;justify-content:center;margin:6px 0 10px}.sx-rd i{width:28px;height:6px;border-radius:3px;background:var(--line2)}.sx-rd i.y{background:var(--accent)}
.sx-pill{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;background:var(--accent);color:var(--onaccent);border-radius:99px;padding:5px 12px;font-size:12.5px;font-weight:800;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.sx-day{position:relative;border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;margin-bottom:12px}.sx-day .hr{position:absolute;left:0;right:0;border-top:1px solid var(--line2);font-size:10.5px;color:var(--muted);padding-left:6px}
.sx-blk{position:absolute;left:46px;right:8px;border-radius:9px;padding:4px 8px;font-size:12px;line-height:1.25;overflow:hidden;border:0;text-align:left;font-family:inherit;cursor:pointer}.sx-blk b{display:block;font-size:12.5px}.sx-blk.l{background:var(--accent);color:var(--onaccent);cursor:default}.sx-blk.s{background:var(--ok-bg);color:var(--ok);box-shadow:inset 0 0 0 1.5px var(--ok)}.sx-blk.o{background:var(--surface2);color:var(--muted);box-shadow:inset 0 0 0 1.5px var(--line)}
.sx-bar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-bottom:12px}.sx-bar div{border:1.5px solid var(--line);border-radius:12px;padding:10px 2px;text-align:center;font-size:11px;font-weight:800;background:var(--surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sx-bar div.lk{background:var(--surface2);color:var(--muted)}.sx-bar div.on{border-color:var(--accent);color:var(--accent)}`;
  let cssOn = false; const css = () => { if(!cssOn){ cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); } return ''; };
  const ring = (n, N, sz = 60) => { const r = sz / 2 - 6, c = 2 * Math.PI * r, a = N ? c * n / N : 0; return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--line2)" stroke-width="7"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${a} ${c}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/><text x="50%" y="55%" text-anchor="middle" font-size="13" font-weight="800" fill="var(--ink)">${n}/${N}</text></svg>`; };

  /* ---------- figures (each with the rows behind it) ---------- */
  function memory(k){
    const by = {}; ((k.marks || {}).r || []).filter(x => !x.self && x.p != null).forEach(x => { (by[x.sub + '|' + x.tk] = by[x.sub + '|' + x.tk] || []).push(x); });
    const T0 = Object.values(by).filter(L => L.length > 1).map(L => { L.sort((a, b) => a.rv - b.rv || a.d.localeCompare(b.d)); const f = L[0], l = L[L.length - 1];
      return {sub: f.sub, tk: f.tk, f, l, chg: l.p - f.p, drop: l.p - f.p <= -10}; });
    return {L: T0.sort((a, b) => a.chg - b.chg), v: avg(T0.map(x => x.l.p)), fading: T0.filter(x => x.drop).length};
  }
  function focusTopics(k){
    const M = memory(k).L.slice(0, 3);
    if(M.length >= 3) return M;
    const last = {}; ((k.marks || {}).r || []).filter(x => !x.self).forEach(x => { const key = x.sub + '|' + x.tk; if(!last[key] || last[key].d < x.d) last[key] = x; });
    Object.values(last).sort((a, b) => a.p - b.p).forEach(x => { if(M.length < 3 && !M.some(y => y.tk === x.tk && y.sub === x.sub)) M.push({sub: x.sub, tk: x.tk, l: x, chg: null}); });
    return M;
  }
  const exI = k => window.EXUI && k.exam ? (k.subjects || []).map(x => ({x, i: EXUI.info(x.k, k.exam, ((k.marks || {}).w || []).filter(m => m.sub === x.sub))})).filter(o => o.i) : [];
  function cons(k, from, to){
    const H = ((k.hist || {}).r || []).filter(r => r[0] >= from && r[0] <= to);
    const days = []; for(let d = from; d <= to; d = add(d, 1)){ const L = H.filter(r => r[0] === d); days.push({d, n: L.length, on: L.filter(r => r[2] === 'o').length, late: L.filter(r => r[2] === 'l').length, miss: L.filter(r => r[2] === 'm').length}); }
    return {days, H, on: H.filter(r => r[2] === 'o').length, n: H.length};
  }
  const consGrid = C => `<div class="sx-c7">${['M','T','W','T','F','S','S'].map(h => `<b>${h}</b>`).join('')}${'<i class="p"></i>'.repeat((wdOf(C.days[0].d) + 6) % 7)}${C.days.map(x => `<i class="${!x.n ? 'n' : x.miss ? 'r' : x.late ? 'y' : 'g'}" title="${dl(x.d)}">${+x.d.slice(8)}</i>`).join('')}</div>
    <div class="sx-lg"><span><i class="g"></i>on their day</span><span><i class="y"></i>late</span><span><i class="r"></i>missed</span><span><i class="n"></i>none due</span></div>`;
  const focusLog = k => ((k.sx || {}).focus || []);
  const weekFocus = (k, mon) => focusLog(k).filter(x => x.d >= mon && x.d <= add(mon, 6));

  /* ---------- Home: cards with a picture ---------- */
  const CARDS = [['sras','SRAs this week'],['mem','Topics dropping'],['focus','Focus this week'],['pace','On pace'],['cons','SRAs on their day'],['count','Countdowns'],['ftime','Focus time']];
  function homeCards(k){
    if(isParent() || !k) return '';
    css(); const on = read('lhq_sxcards', CARDS.map(c => c[0])), t = T(), mon = mondayOf(t);
    const W = (k.sx || {}).wk || [], dn = W.filter(x => x.done).length, M = memory(k), F = focusTopics(k), P = exI(k).filter(o => o.i.pace), C = cons(k, add(t, -27), t);
    const first = exI(k).filter(o => o.i.first && o.i.days >= 0).sort((a, b) => a.i.days - b.i.days)[0], fm = weekFocus(k, mon).reduce((a, x) => a + x.m, 0), fl = weekFocus(k, add(mon, -7)).reduce((a, x) => a + x.m, 0);
    const html = {
      sras: `<span class="h">SRAs this week</span>${ring(dn, W.length)}<small>${W.length - dn ? W.length - dn + ' to go' : W.length ? 'All done' : 'None this week'}</small>`,
      mem: `<span class="h">Topics dropping</span><span class="v">${M.L.length ? M.fading : '–'}</span><small>${M.L.length ? `of ${M.L.length} · latest SRA 10+ below the first` : 'After two reviews of a topic'}</small>`,
      focus: `<span class="h">Focus this week</span><small style="color:var(--ink);font-weight:700">${F.map(x => esc(x.tk)).join(' · ') || '–'}</small><small>weakest first</small>`,
      pace: `<span class="h">On pace</span>${P.slice(0, 3).map(o => `<small class="${o.i.pace.diff >= 0 ? 'sx-up' : 'sx-dn'}">${esc(o.x.sub)} · ${EXAMS.paceL(o.i.pace)}</small>`).join('') || '<small>Set an exam to see it</small>'}`,
      cons: `<span class="h">SRAs on their day</span><div style="display:flex;align-items:baseline;gap:8px"><span class="v">${C.n ? Math.round(C.on / C.n * 100) + '%' : '–'}</span><small>${C.on} of ${C.n} · 4 weeks</small></div>${consGrid(C)}`,
      count: (C => `<span class="h">Countdowns</span>${C.slice(0, 3).map(c => `<span style="display:flex;justify-content:space-between;gap:6px;align-items:baseline"><small style="color:var(--ink);font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.n)}</small><b style="color:var(--brand)">${c.days}<small> d</small></b></span>`).join('') || '<small>No dates yet</small>'}`)(window.SPLAN ? SPLAN.countdowns(k) : []),
      ftime: `<span class="h">Focus time</span><span class="v">${hmin(fm)}</span><small>this week${fl || fm ? ` · ${fm >= fl ? '▲' : '▼'} ${hmin(Math.abs(fm - fl))}` : ''}</small>`};
    return `<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 2px 8px"><b style="font-size:12px;letter-spacing:.06em;color:var(--muted)">YOUR CARDS</b><button class="ib" data-sxpick aria-label="Choose cards">✎</button></div>
      <div class="sx-pc">${CARDS.filter(c => on.includes(c[0])).map(([id]) => `<button class="${id === 'cons' ? 'wide' : ''}" data-sxd="${id}">${html[id]}</button>`).join('')}</div>`;
  }
  function drill(id, k){
    const t = T(), mon = mondayOf(t);
    if(id === 'sras'){ const W = (k.sx || {}).wk || []; sheet('SRAs this week', `${dl(mon)} – ${dl(add(mon, 6))} · ${W.filter(x => x.done).length} of ${W.length} done`, '', W.sort((a, b) => a.doOn.localeCompare(b.doOn)).map(x => row(`${esc(x.topic)} ${R(x.stage)}`, `${esc(x.sub)} · do on ${dl(x.doOn)}`, x.done ? '✓ done' : x.doOn < t ? 'late' : 'to do', x.done ? 'g' : x.doOn < t ? 'y' : '')).join('')); }
    if(id === 'mem'){ const M = memory(k); sheet(`Topics dropping · ${M.fading}`, 'Each topic: latest SRA mark against the first', 'Dropping: 10 points or more below the first.', M.L.map(x => row(esc(x.tk), `${esc(x.sub)} · ${R(x.f.rv)} ${x.f.p}% → ${R(x.l.rv)} ${x.l.p}%`, (x.chg > 0 ? '+' : '') + x.chg + (x.drop ? ' · dropping' : ''), x.drop ? 'y' : 'g')).join(''), M.L.length ? `Latest SRA average<span>${M.v}%</span>` : ''); }
    if(id === 'focus'){ const F = focusTopics(k); sheet('Focus this week', 'The 3 topics needing most work', '', F.map((x, i) => row(esc(x.tk), `${esc(x.sub)} · ${x.chg != null ? `${x.chg > 0 ? '+' : ''}${x.chg} since the first · ` : ''}latest SRA ${R(x.l.rv)} ${x.l.p}%`, String(i + 1), 'y')).join('')); }
    if(id === 'pace'){ const P = exI(k).filter(o => o.i.pace); sheet('On pace', 'Topics finished against topics needed by today', 'To finish 4 weeks before the first paper.', P.map(o => row(esc(o.x.sub), `${o.i.pace.done} finished · ${o.i.pace.need} needed by today${o.i.first ? ' · first paper ' + dl(o.i.first.a) : ''}`, EXAMS.paceL(o.i.pace), o.i.pace.diff >= 0 ? 'g' : 'y')).join('')); }
    if(id === 'cons'){ const C = cons(k, add(t, -27), t); sheet(`SRAs on their day · ${C.n ? Math.round(C.on / C.n * 100) + '%' : '–'}`, `${C.on} of ${C.n} · ${dl(add(t, -27))} – ${dl(t)}`, '', `<div style="padding:12px 14px">${consGrid(C)}</div>` + C.H.filter(r => r[2] !== 'o').sort((a, b) => b[0].localeCompare(a[0])).map(r => row(esc(r[1]), dl(r[0]), r[2] === 'm' ? 'missed' : 'late', r[2] === 'm' ? 'r' : 'y')).join(''), `Late or missed<span>${C.n - C.on}</span>`); }
    if(id === 'count'){ const L = window.SPLAN ? SPLAN.countdowns(k) : []; sheet('Countdowns', 'From today', 'First papers from your subjects; your own dates with "Countdown on Home" on.', L.map(c => row(esc(c.n), `${esc(c.s)} · ${dl(c.d)}`, c.days + ' days')).join('')); }
    if(id === 'ftime'){ const L = weekFocus(k, mon), fl = weekFocus(k, add(mon, -7)).reduce((a, x) => a + x.m, 0); sheet(`Focus time · ${hmin(L.reduce((a, x) => a + x.m, 0))}`, `This week · last week ${hmin(fl)}`, 'Finished rounds only.', L.sort((a, b) => b.at - a.at).map(x => row(esc(x.sub || 'Focus') + (x.tk ? ' · ' + esc(x.tk) : ''), dl(x.d), x.m + ' min')).join(''), `Total<span>${hmin(L.reduce((a, x) => a + x.m, 0))}</span>`); }
  }
  function pickCards(){
    const on = read('lhq_sxcards', CARDS.map(c => c[0]));
    openSheet(`<div class="hx"><h3>Your cards</h3><button class="ib" data-close>✕</button></div><div class="card">${CARDS.map(([id, l]) => `<button class="it" data-sxcard="${id}" style="width:100%"><span class="f-mk ${on.includes(id) ? 'ok' : ''}">${on.includes(id) ? '✓' : ''}</span><span class="t"><b>${l}</b></span></button>`).join('')}</div>`);
    document.querySelectorAll('[data-sxcard]').forEach(b => b.onclick = () => { let L = read('lhq_sxcards', CARDS.map(c => c[0])); const id = b.dataset.sxcard; L = L.includes(id) ? L.filter(x => x !== id) : L.concat([id]); write('lhq_sxcards', L); pickCards(); render(); });
  }

  /* ---------- Focus timer ---------- */
  const FK = 'lhq_focus_run', LEN = {25: [25, 5, 15], 50: [50, 10, 20]};
  const st = () => read(FK, null), put = s => { write(FK, s); tick(); };
  const leftOf = s => !s ? 0 : s.run ? Math.max(0, Math.round((s.end - Date.now()) / 1000)) : s.left;
  const clock = s => { const v = leftOf(s); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
  function focusPage(k, sraId){
    css(); let s = st(); const len = read('lhq_focus_len', 25), t = T();
    const today = (k.sras || []).filter(x => x.doOn <= t && !x.done);
    if(sraId && /^blk:/.test(sraId) && (!s || !s.run)){ const b = ((k.sx || {}).plan || []).find(x => x.id === sraId.slice(4)); if(b){ s = {len, ph: 'work', round: 1, run: false, left: len * 60, sub: b.sub || '', tk: b.name || 'Study'}; write(FK, s); } }
    else if(sraId && (!s || !s.run)){ const x = (k.sras || []).find(y => y.id === sraId); if(x && (!s || s.sra !== sraId)){ s = {len, ph: 'work', round: 1, run: false, left: len * 60, sra: x.id, sub: x.sub, tk: `${x.topic} ${R(x.stage)}`}; write(FK, s); } }
    if(!s) s = {len, ph: 'work', round: 1, run: false, left: len * 60, sub: '', tk: ''};
    const tot = LEN[s.len][s.ph === 'work' ? 0 : s.ph === 'long' ? 2 : 1] * 60, frac = leftOf(s) / tot, r = 78, c = 2 * Math.PI * r;
    const W = weekFocus(k, mondayOf(t)), bySub = {}; W.forEach(x => { bySub[x.sub || 'Other'] = (bySub[x.sub || 'Other'] || 0) + x.m; });
    return `<a class="crumb" href="#me/practice">‹ Practice</a><div class="ph"><div class="tt"><h1>Focus</h1><p>${s.tk ? esc(s.tk) + ' · ' + esc(s.sub) : 'Choose what to work on'}</p></div></div>
      <div class="card pad"><div class="sx-tm"><svg width="180" height="180" viewBox="0 0 180 180"><circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--line2)" stroke-width="10"/><circle id="sxRing" cx="90" cy="90" r="${r}" fill="none" stroke="${s.ph === 'work' ? 'var(--accent)' : 'var(--ok)'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 90 90)"/><text id="sxClock" x="90" y="100" text-anchor="middle" font-size="34" font-weight="800" fill="var(--brand)">${clock(s)}</text></svg></div>
        <div class="sx-rd">${[1, 2, 3, 4].map(i => `<i class="${i < s.round || (i === s.round && s.ph !== 'work') ? 'y' : ''}"></i>`).join('')}</div>
        <p class="note" style="text-align:center;margin:0 0 12px">${s.ph === 'work' ? `Round ${s.round} of 4` : s.ph === 'long' ? 'Long break' : 'Break'}</p>
        <div style="display:flex;gap:8px"><button class="btn n" style="flex:1" data-sxf="${s.run ? 'pause' : 'start'}">${s.run ? 'Pause' : 'Start'}</button><button class="btn" style="flex:1" data-sxf="stop">Stop</button></div></div>
      <div class="h2">Length</div><div class="seg" style="display:flex">${[25, 50].map(v => `<button style="flex:1" class="${s.len === v ? 'on' : ''}" data-sxlen="${v}">${LEN[v].join(' · ')}</button>`).join('')}</div>
      ${today.length ? `<div class="h2">Work on</div><div class="card">${today.map(x => `<button class="it" style="width:100%" data-sxsra="${esc(x.id)}"><span class="f-mk ${s.sra === x.id ? 'ok' : ''}">${s.sra === x.id ? '✓' : ''}</span><span class="t"><b>${esc(x.topic)} ${R(x.stage)}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>` : ''}
      <div class="h2">This week</div><div class="card">${Object.entries(bySub).map(([sb, m]) => `<div class="it"><span class="t"><b>${esc(sb)}</b></span><b>${hmin(m)}</b></div>`).join('') || '<p class="empty">No focus rounds yet.</p>'}</div>`;
  }
  async function roundDone(s){
    try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'focus', m: s.len === 50 ? 50 : 25, sub: s.sub || '', tk: s.tk || '', d: T()})}); }catch(e){}
    if(s.sra) openSheet(`<div class="hx"><h3>Finished ${esc(s.tk)}?</h3><button class="ib" data-close>✕</button></div><button class="btn n full" id="sxDone">Yes, it's done</button><button class="btn full" data-close style="margin-top:8px">Not yet</button>`),
      setTimeout(() => { const b = $('sxDone'); if(b) b.onclick = async () => { try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'done', id: s.sra, done: true})}); toast('Done'); }catch(e){ toast(e.message); } closeSheet(); }; }, 0);
  }
  function tick(){
    const s = st(); let pill = document.getElementById('sxPill');
    if(s && s.run && leftOf(s) <= 0){
      const next = Object.assign({}, s);
      if(window.SOUNDS) SOUNDS.play(s.ph === 'work' ? 'focus' : 'brk');
      if(s.ph === 'work'){ roundDone(s); next.ph = s.round >= 4 ? 'long' : 'brk'; toast(s.round >= 4 ? 'Four rounds · long break' : 'Round done · break'); }
      else { next.ph = 'work'; next.round = s.ph === 'long' ? 1 : s.round + 1; toast('Back to work'); }
      const L = LEN[s.len][next.ph === 'work' ? 0 : next.ph === 'long' ? 2 : 1]; next.end = Date.now() + L * 60000; next.left = L * 60; write(FK, next);
      try{ if(navigator.vibrate) navigator.vibrate([200, 100, 200]); }catch(e){}
    }
    const s2 = st(), onPage = /^#me\/focus/.test(location.hash);
    if(s2 && s2.run && !onPage){ if(!pill){ pill = document.createElement('a'); pill.id = 'sxPill'; pill.className = 'sx-pill'; pill.href = '#me/focus'; css(); document.body.appendChild(pill); } pill.textContent = `● ${clock(s2)}`; }
    else if(pill) pill.remove();
    const c = document.getElementById('sxClock'); if(c && s2){ c.textContent = clock(s2); const tot = LEN[s2.len][s2.ph === 'work' ? 0 : s2.ph === 'long' ? 2 : 1] * 60, ring = document.getElementById('sxRing'); if(ring){ const cc = 2 * Math.PI * 78; ring.setAttribute('stroke-dasharray', `${cc * leftOf(s2) / tot} ${cc}`); } }
  }
  setInterval(tick, 1000);

  /* ---------- habits (student KPIs): compared only with themselves ---------- */
  let hPer = 'w4';
  function range(k, p, t){
    if(p === 'w') { const m = mondayOf(t); return {a: m, b: t, pa: add(m, -7), pb: add(m, -1), l: 'This week', pl: 'last week'}; }
    if(p === 'term' && (k.terms || window.MIN)){ const L = (k.terms && k.terms.length ? k.terms : MIN.terms()).filter(x => x[1] <= t).sort((a, b) => b[1].localeCompare(a[1])); if(L[0]) return {a: L[0][1], b: t, pa: L[1] ? L[1][1] : add(L[0][1], -90), pb: L[1] ? L[1][2] : add(L[0][1], -1), l: L[0][0], pl: L[1] ? L[1][0] : 'the term before'}; }
    return {a: add(t, -27), b: t, pa: add(t, -55), pb: add(t, -28), l: 'Last 4 weeks', pl: 'the 4 before'};
  }
  function habitRows(k, a, b){
    const H = k.hist || {s: [], r: []}, S = (H.s || []).filter(x => x[0] >= a && x[0] <= b), counted = S.filter(x => !(x[2] === 'cancelled' && x[4] !== 'student'));
    const att = x => x[2] === 'attended' || x[2] === 'late', Rr = (H.r || []).filter(x => x[0] >= a && x[0] <= b), M = ((k.marks || {}).r || []).filter(x => !x.self && x.d >= a && x.d <= b);
    const W = ((k.marks || {}).w || []).filter(x => x.d >= a && x.d <= b), PK = ((k.sx || {}).pk || []).filter(x => x.doOn >= a && x.doOn <= b && x.doOn < T());
    const sesDays = [...new Set(S.filter(att).map(x => x[0]))].filter(d => d < T()), rep = new Set((k.sx || {}).rep || []);
    const f = (L, ok) => ({n: L.length, k: L.filter(ok).length});
    return {
      att: Object.assign(f(counted, att), {rows: counted.map(x => [x[1], dl(x[0]), att(x) ? 'came' : x[2] === 'cancelled' ? 'cancelled' : 'absent', att(x) ? 'g' : 'r'])}),
      ont: Object.assign(f(S.filter(att), x => x[2] === 'attended'), {rows: S.filter(att).map(x => [x[1], dl(x[0]), x[2] === 'late' ? 'late' : 'on time', x[2] === 'late' ? 'y' : 'g'])}),
      sra: Object.assign(f(Rr, x => x[2] === 'o'), {rows: Rr.map(x => [x[1], dl(x[0]), x[2] === 'o' ? 'on its day' : x[2] === 'l' ? 'late' : 'missed', x[2] === 'o' ? 'g' : x[2] === 'l' ? 'y' : 'r'])}),
      ars: Object.assign(f(M, x => x.a >= 0), {rows: M.map(x => [`${x.tk} ${R(x.rv)}`, `${x.sub} · ${dl(x.d)}`, x.a >= 0 ? `ARS ${x.a}%` : 'no ARS', x.a >= 0 ? 'g' : 'y'])}),
      ass: Object.assign({n: W.length, k: W.length}, {rows: W.map(x => [x.sub, dl(x.d), x.p + '%', 'g'])}),
      pk: Object.assign(f(PK, x => x.done), {rows: PK.map(x => [`${x.topic} ${R(x.stage)}`, `${x.sub} · ${dl(x.doOn)}`, x.done ? 'done' : 'not done', x.done ? 'g' : 'r'])}),
      rep: Object.assign(f(sesDays, d => rep.has(d)), {rows: sesDays.map(d => ['Session day', dl(d), rep.has(d) ? 'sent' : 'not sent', rep.has(d) ? 'g' : 'r'])})};
  }
  const HAB = [['att','Sessions attended'],['ont','On time'],['sra','SRAs on their day'],['ars','ARS with every SRA'],['ass','Assessments sat'],['pk','Take-home sheets'],['rep','Daily report sent']];
  let lastH = null;
  function habits(k){
    css(); const t = T(), r = range(k, hPer, t), A = habitRows(k, r.a, r.b), B = habitRows(k, r.pa, r.pb); lastH = {A, r};
    const pc = o => o.n ? Math.round(o.k / o.n * 100) : null;
    const name = (k.name || '').split(' ')[0];
    return `<a class="crumb" href="#me/progress">‹ ${isParent() ? 'Sessions' : 'Progress'}</a><div class="ph"><div class="tt"><h1>Habits</h1><p>${esc(name)} · ${esc(r.l)} · against ${esc(r.pl)}</p></div></div>
      <div class="seg" style="display:flex;margin-bottom:12px">${[['w','Week'],['w4','4 weeks'],['term','Term']].map(([v, l]) => `<button style="flex:1" class="${hPer === v ? 'on' : ''}" data-sxhp="${v}">${l}</button>`).join('')}</div>
      <div class="card">${HAB.map(([id, l]) => { const a = A[id], b = B[id], p = id === 'ass' ? null : pc(a), q = id === 'ass' ? null : pc(b), dlt = p != null && q != null ? p - q : null;
        return `<button class="sx-hb" data-sxh="${id}"><span>${l}<small>${id === 'ass' ? `${a.n} sat` : a.n ? `${a.k} of ${a.n}` : 'none yet'}</small></span><b>${id === 'ass' ? a.n : p == null ? '–' : p + '%'}</b><span class="${dlt == null || dlt === 0 ? '' : dlt > 0 ? 'u' : 'd'}">${dlt == null || dlt === 0 ? '·' : (dlt > 0 ? '▲ ' : '▼ ') + Math.abs(dlt)}</span></button>`; }).join('')}</div>
      <p class="note">Against ${isParent() ? 'their' : 'your'} own ${esc(r.pl)}. Effort, not marks.</p>`;
  }

  /* ---------- Day view: LHQ's sessions (locked) and the student's study blocks ---------- */
  const BT = [['study','Study'],['rev','Revision'],['school','School'],['act','Activity'],['rest','Rest'],['other','Other']];
  const blockOn = (b, d) => { if(!b || !b.from || d < b.from || (b.until && d > b.until)) return false; const w = wdOf(d); return b.rep === 'daily' ? true : b.rep === 'weekdays' ? w >= 1 && w <= 5 : b.rep === 'days' ? (b.days || []).includes(w) : d === b.from; };
  function dayView(k, d){
    css(); d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : T();
    const ses = (k.week || []).filter(s => s.date === d).map(s => ({s: s.s, e: s.e, n: `${s.sub} · ${s.tutor || ''}`, l: 1}));
    const past = ((k.hist || {}).s || []).filter(x => x[0] === d && !ses.length).map(x => ({s: '', e: '', n: x[1], l: 1}));
    const B = isParent() ? [] : ((k.sx || {}).plan || []).filter(b => blockOn(b, d));
    const all = ses.concat(B.map(b => ({s: b.s, e: b.e, n: b.name || BT.find(x => x[0] === b.type)[1], sub: b.sub, b}))), H0 = 6, H1 = 22, PX = 46;
    const top = t => (mins(t) / 60 - H0) * PX;
    return `<a class="crumb" href="#me/calendar/${d.slice(0, 7)}/${d}">‹ Calendar</a><div class="ph"><div class="tt"><h1>${dl(d)}</h1><p>Day</p></div><div class="acts"><a class="btn sm" href="#me/day/${add(d, -1)}">‹</a><a class="btn sm" href="#me/day/${add(d, 1)}">›</a></div></div>
      <div class="sx-day" style="height:${(H1 - H0) * PX + 8}px">${Array.from({length: H1 - H0}, (_, i) => `<div class="hr" style="top:${i * PX + 4}px">${String(H0 + i).padStart(2, '0')}:00</div>`).join('')}
        ${all.filter(x => mins(x.s) != null).map(x => `<${x.b ? 'button' : 'div'} class="sx-blk ${x.l ? 'l' : x.b.type === 'study' || x.b.type === 'rev' ? 's' : 'o'}" ${x.b ? `data-sxblk="${esc(x.b.id)}"` : ''} style="top:${top(x.s) + 4}px;height:${Math.max(22, (mins(x.e) - mins(x.s)) / 60 * PX - 2)}px"><b>${esc(x.n)}${x.l ? ' 🔒' : ''}</b>${x.s}–${x.e}${x.sub ? ' · ' + esc(x.sub) : ''}</${x.b ? 'button' : 'div'}>`).join('')}</div>
      ${past.length ? `<p class="note">${past.map(x => esc(x.n)).join(', ')} · logged</p>` : ''}
      ${isParent() ? '' : `<button class="btn n full" data-sxblk="new:${d}">+ Block</button><p class="note" style="margin-top:8px">Private: others see the weekly study total only.</p>`}`;
  }
  function blockSheet(k, id){
    const isNew = id.startsWith('new:'), b = isNew ? {id: '', name: '', type: 'study', sub: '', s: '19:00', e: '20:00', rep: 'once', days: [], from: id.slice(4), until: ''} : Object.assign({}, ((k.sx || {}).plan || []).find(x => x.id === id));
    const draw = () => { openSheet(`<div class="hx"><h3>${isNew ? 'New block' : 'Block'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="sxbN" value="${esc(b.name)}" placeholder="e.g. Physics revision"></label>
      <div class="cap">Type</div><div class="t-opts g3" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:10px">${BT.map(([v, l]) => `<button type="button" class="btn sm ${b.type === v ? 'n' : ''}" data-sxbt="${v}">${l}</button>`).join('')}</div>
      <label class="f"><span>Subject (optional)</span><select class="in" id="sxbS"><option value="">–</option>${(k.subjects || []).map(x => `<option ${b.sub === x.sub ? 'selected' : ''}>${esc(x.sub)}</option>`).join('')}</select></label>
      <div class="r2"><label class="f"><span>Start</span><input class="in" type="time" id="sxbA" value="${esc(b.s)}"></label><label class="f"><span>End</span><input class="in" type="time" id="sxbB" value="${esc(b.e)}"></label></div>
      <label class="f"><span>Repeat</span><select class="in" id="sxbR">${[['once','Once'],['daily','Every day'],['weekdays','Weekdays'],['days','Chosen days']].map(([v, l]) => `<option value="${v}" ${b.rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${b.rep === 'days' ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">${[1, 2, 3, 4, 5, 6, 0].map(w => `<button type="button" class="btn sm ${(b.days || []).includes(w) ? 'n' : ''}" data-sxbd="${w}">${WD[w]}</button>`).join('')}</div>` : ''}
      ${b.rep !== 'once' ? `<label class="f"><span>Until (optional)</span><input class="in" type="date" id="sxbU" value="${esc(b.until)}"></label>` : ''}
      <button class="btn n full" id="sxbGo">Save</button>${isNew ? '' : '<button class="btn rd full" id="sxbDel" style="margin-top:8px">Delete</button>'}`);
      const keep = () => { b.name = $('sxbN').value; b.sub = $('sxbS').value; b.s = $('sxbA').value; b.e = $('sxbB').value; if($('sxbU')) b.until = $('sxbU').value; };
      document.querySelectorAll('[data-sxbt]').forEach(x => x.onclick = () => { keep(); b.type = x.dataset.sxbt; draw(); });
      document.querySelectorAll('[data-sxbd]').forEach(x => x.onclick = () => { keep(); const w = +x.dataset.sxbd; b.days = (b.days || []).includes(w) ? b.days.filter(y => y !== w) : (b.days || []).concat([w]); draw(); });
      $('sxbR').onchange = () => { keep(); b.rep = $('sxbR').value; draw(); };
      $('sxbGo').onclick = async () => { keep(); try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'block', block: b})}); closeSheet(); toast('Saved'); if(window.FAM && FAM.refresh) await FAM.refresh(); render(); }catch(e){ toast(e.message); } };
      if($('sxbDel')) $('sxbDel').onclick = async () => { try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'unblock', id: b.id})}); closeSheet(); toast('Deleted'); if(window.FAM && FAM.refresh) await FAM.refresh(); render(); }catch(e){ toast(e.message); } }; };
    draw();
  }

  /* ---------- Settings › Reminders ---------- */
  let remS = null;
  function reminders(){
    css(); if(!remS){ hub.api('push').then(r => { remS = r || {}; render(); }).catch(() => { remS = {}; render(); }); return '<p class="empty">Loading…</p>'; }
    const rem = ((remS.prefs || {}).rem) || {sra: 7, block: 1};
    return `<a class="crumb" href="#me/more">‹ More</a><div class="ph"><div class="tt"><h1>Reminders</h1><p>Times can change</p></div></div>
      <div class="card"><div class="it"><span class="t"><b>SRA days 🔒</b><small>Set by LHQ: always on</small></span><select class="in" id="sxRemS" style="width:110px">${Array.from({length: 17}, (_, i) => i + 5).map(h => `<option value="${h}" ${+rem.sra === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></div>
        <div class="it"><span class="t"><b>Study blocks</b><small>At the start of each block</small></span><button class="btn sm ${rem.block === 'off' ? '' : 'n'}" id="sxRemB">${rem.block === 'off' ? 'Off' : 'On'}</button></div>
        <div class="it"><span class="t"><b>Daily report 🔒</b><small>The hour after your last session</small></span></div>
        <div class="it"><span class="t"><b>Hand-in days 🔒</b><small>With the morning SRAs</small></span></div></div>
      <div class="card"><a class="it" href="#me/sounds"><span class="t"><b>Sounds</b><small>A different one for each kind, while LHQ Hub is open</small></span><span class="chev">›</span></a></div>
      <p class="note">Quiet hours and the rest: <a href="#set/notifications">Notifications</a>. iPhone: install the Hub first.</p>`;
  }
  async function saveRem(ch){ const rem = Object.assign({sra: 7, block: 1}, ((remS.prefs || {}).rem) || {}, ch); try{ const r = await hub.api('push', {method: 'POST', body: JSON.stringify(Object.assign({action: 'rem'}, rem))}); remS.prefs = Object.assign({}, remS.prefs, {rem: r.rem}); toast('Saved'); render(); }catch(e){ toast(e.message); } }

  /* ---------- Sharing: what tutors see of the student's own time ---------- */
  function sharing(k){
    css(); const X = k.sx || {}, swb = (on, id, dis) => `<button class="sp-sw ${on ? 'on' : ''}" ${dis ? 'disabled' : ''} data-sxsh="${id}" aria-label="On or off" style="width:46px;height:28px;border-radius:99px;border:0;background:${on ? 'var(--ok)' : 'var(--line)'};position:relative;flex:none"><i style="position:absolute;top:3px;left:${on ? 21 : 3}px;width:22px;height:22px;border-radius:50%;background:#fff"></i></button>`;
    return `<a class="crumb" href="#me/more">‹ More</a><div class="ph"><div class="tt"><h1>Sharing</h1><p>What your tutors see</p></div></div>
      <div class="h2">With your tutors</div><div class="card">
        ${X.tsee ? `<div class="it"><span class="t"><b>Focus and study totals</b><small>This week's focus time and study planned</small></span>${swb(!X.hide, 'tot')}</div>` : `<div class="it"><span class="t"><b>Focus and study totals</b><small>Off at LHQ</small></span><span class="note">Off</span></div>`}
        <a class="it" href="#me/week"><span class="t"><b>Your dates and busy times</b><small>You choose for each one when you add it</small></span><span class="chev">›</span></a>
        <div class="it"><span class="t"><b>Study blocks</b><small>Names and times</small></span><span class="note">🔒 private</span></div></div>
      <div class="h2">Always shared 🔒</div><div class="card">${['Sessions and attendance','SRAs, ARS and marks','Assessments'].map(a => `<div class="it"><span class="t">${a}</span><span>🔒</span></div>`).join('')}</div>`;
  }
  /* ---------- the bar: Home, Practice, two of their choice, More ---------- */
  const CHOICE = [['mcal','Calendar','index.html#me/calendar'],['mprog','Progress','index.html#me/progress'],['mfocus','Focus','index.html#me/focus'],['mrep','Report','index.html#me/report']];
  const isFull = () => ((((window.hub && hub.session && hub.session()) || {}).me || {}).view === 'full');
  const barPicks = () => { const p = read('lhq_sxbar', ['mcal', 'mprog']).filter(x => CHOICE.some(c => c[0] === x) && (x !== 'mfocus' || isFull())); return p.length === 2 ? p : ['mcal', 'mprog']; };
  function barPage(){
    css(); const P = barPicks();
    return `<a class="crumb" href="#me/more">‹ More</a><div class="ph"><div class="tt"><h1>Edit the bar</h1><p>Choose two</p></div></div>
      <div class="sx-bar"><div class="lk">Home 🔒</div><div class="lk">Practice 🔒</div>${P.map(p => `<div class="on">${CHOICE.find(c => c[0] === p)[1]}</div>`).join('')}<div class="lk">More 🔒</div></div>
      <div class="card">${CHOICE.filter(c => c[0] !== 'mfocus' || isFull()).map(([id, l]) => `<button class="it" style="width:100%" data-sxbar="${id}"><span class="f-mk ${P.includes(id) ? 'ok' : ''}">${P.includes(id) ? '✓' : ''}</span><span class="t"><b>${l}</b></span></button>`).join('')}</div>
      <div class="h2">Set by LHQ</div><div class="card">${['Today on Home','Home, Practice and More on the bar','SRA, hand-in and report reminders on','Sessions, SRAs and marks shared with LHQ'].map(a => `<div class="it"><span>🔒</span><span class="t">${a}</span></div>`).join('')}</div>`;
  }

  /* ---------- taps ---------- */
  function bind(k){
    if(!k) return;
    document.querySelectorAll('[data-sxd]').forEach(b => b.onclick = () => drill(b.dataset.sxd, k));
    const pk = document.querySelector('[data-sxpick]'); if(pk) pk.onclick = pickCards;
    document.querySelectorAll('[data-sxf]').forEach(b => b.onclick = () => { const s = st() || {len: read('lhq_focus_len', 25), ph: 'work', round: 1, left: read('lhq_focus_len', 25) * 60};
      if(b.dataset.sxf === 'start'){ s.run = true; s.end = Date.now() + leftOf(Object.assign({}, s, {run: false})) * 1000; put(s); }
      else if(b.dataset.sxf === 'pause'){ s.left = leftOf(s); s.run = false; put(s); }
      else { localStorage.removeItem(FK); tick(); }
      render(); });
    document.querySelectorAll('[data-sxlen]').forEach(b => b.onclick = () => { const v = +b.dataset.sxlen; write('lhq_focus_len', v); const s = st(); if(s && !s.run){ s.len = v; s.ph = 'work'; s.left = v * 60; write(FK, s); } render(); });
    document.querySelectorAll('[data-sxsra]').forEach(b => b.onclick = () => { const x = (k.sras || []).find(y => y.id === b.dataset.sxsra); if(!x) return; const s = st() || {len: read('lhq_focus_len', 25), ph: 'work', round: 1, run: false, left: read('lhq_focus_len', 25) * 60};
      Object.assign(s, {sra: x.id, sub: x.sub, tk: `${x.topic} ${R(x.stage)}`}); write(FK, s); render(); });
    document.querySelectorAll('[data-sxhp]').forEach(b => b.onclick = () => { hPer = b.dataset.sxhp; render(); });
    document.querySelectorAll('[data-sxh]').forEach(b => b.onclick = () => { const id = b.dataset.sxh, a = lastH.A[id], l = HAB.find(x => x[0] === id)[1];
      sheet(`${l}${id === 'ass' ? ` · ${a.n}` : a.n ? ` · ${a.k} of ${a.n}` : ''}`, lastH.r.l, '', a.rows.slice().reverse().map(x => row(esc(x[0]), x[1], esc(x[2]), x[3])).join('')); });
    document.querySelectorAll('[data-sxblk]').forEach(b => b.onclick = () => blockSheet(k, b.dataset.sxblk));
    if($('sxRemS')) $('sxRemS').onchange = () => saveRem({sra: +$('sxRemS').value});
    if($('sxRemB')) $('sxRemB').onclick = () => saveRem({block: (((remS.prefs || {}).rem) || {}).block === 'off' ? 1 : 'off'});
    document.querySelectorAll('[data-sxsh=tot]').forEach(b => b.onclick = async () => { const hide = !((k.sx || {}).hide); try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'sxp', hide})}); k.sx.hide = hide; toast(hide ? 'Tutors don\'t see your totals' : 'Tutors see your weekly totals'); render(); }catch(e){ toast(e.message); } });
    document.querySelectorAll('[data-sxbar]').forEach(b => b.onclick = () => { let P = barPicks(); const id = b.dataset.sxbar; if(P.includes(id)) return; P = [P[1], id]; write('lhq_sxbar', P); render(); if(window.LHQNav && LHQNav.refresh) LHQNav.refresh(); });
  }
  /* parents and tutors: the week's totals only */
  function weekTotals(k){ const mon = mondayOf(T()), f = weekFocus(k, mon).reduce((a, x) => a + x.m, 0), st0 = (k.sx || {}).study || 0; return {focus: f, study: st0}; }
  return {sharing, memory, homeCards, focusPage, habits, dayView, reminders, barPage, barPicks, CHOICE, bind, weekTotals, hmin, tick};
})();
