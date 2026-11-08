/* LHQ Hub › students and parents (Stage 2). A student sees their sessions (and confirms them with ✓ or ✕), their SRAs,
   their timetable and progress; a parent sees each of their children, the same counts, and their payments.
   Everything comes from /api/hub/family, which sends only this person's own children. Rendered by index.html at #me…  */
window.FAM = (function(){
  const CK = 'lhq_family';
  const read = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const DAYN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'};
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const P = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const day = s => s ? `${WD[P(s).getDay()]} ${P(s).getDate()} ${MON[P(s).getMonth()]}` : '';
  const dshort = s => s ? `${P(s).getDate()} ${MON[P(s).getMonth()]}` : '';
  const mk = n => 'MKW ' + Math.round(+n || 0).toLocaleString('en-US');
  const firstN = n => String(n || '').trim().split(/\s+/)[0];
  const sub = n => String(n || '').replace(/^Mathematics$/i, 'Maths');
  let data = read(CK, null), loading = null, err = '', kidI = +(read('lhq_family_kid', 0)) || 0;

  if(!document.getElementById('famCss')){ const st = document.createElement('style'); st.id = 'famCss'; st.textContent = `
.f-ok,.f-no{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--surface);font-weight:900;font-size:16px;display:grid;place-items:center;padding:0;cursor:pointer}
.f-ok{background:var(--ok);border-color:var(--ok);color:#fff}.f-no{color:var(--rd)}
.f-mk{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;border:2px solid var(--line);color:transparent}
.f-mk.ok{background:var(--ok);border-color:var(--ok);color:#fff}.f-mk.am{border-color:var(--am);color:var(--am);background:var(--am-bg)}.f-mk.rd{background:var(--rd);border-color:var(--rd);color:#fff}.f-mk.bl{border-color:var(--bl);color:var(--bl);background:var(--bl-bg)}
.f-bar{display:block;height:8px;border-radius:5px;background:var(--line2);position:relative;margin:7px 0 2px}.f-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--ok)}.f-bar b{position:absolute;top:-3px;width:3px;height:14px;border-radius:2px;background:var(--ink)}
.f-n{float:right;font-weight:800}
.f-kids{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px}
.f-kid{flex:none;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 12px;font:inherit;font-weight:700;font-size:13px;display:flex;align-items:center;gap:7px;cursor:pointer;color:var(--ink)}
.f-kid.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.f-av{width:22px;height:22px;border-radius:50%;background:var(--bl-bg);color:var(--bl);display:grid;place-items:center;font-size:11px;font-weight:800}
.f-tick{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;background:none;padding:0;font-weight:900;color:transparent;cursor:pointer}
.f-tick.on{background:var(--ok);border-color:var(--ok);color:#fff}
.f-pk{display:flex;align-items:center;gap:14px;padding:12px 14px;color:var(--ink);text-decoration:none}.f-pk .t{flex:1;min-width:0}.f-pk .t b{display:block}.f-pk .t small{color:var(--muted);font-size:12.5px}.f-ring{flex:none}
.f-day{width:40px;flex:none;text-align:center;line-height:1.1}.f-day small{display:block;font-size:10.5px;font-weight:800;color:var(--muted);text-transform:uppercase}.f-day b{font-size:18px;color:var(--brand)}
.f-sm{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12.5px;color:var(--muted);font-weight:700}.f-sm .in{width:58px;min-height:34px;padding:4px 8px;text-align:center}
.f-self{font-size:11.5px;font-weight:800;color:var(--am)}.f-all{width:100%;border:0;background:none;color:var(--brand);font:inherit;font-weight:800;cursor:pointer;text-align:left}
.f-four{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;gap:4px}.f-four b{display:block;font-size:20px;color:var(--brand)}.f-four small{color:var(--muted);font-size:12px}
.f-opt{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:11px 12px;margin:6px 0;font:inherit;font-weight:700;color:var(--ink);cursor:pointer}
.f-opt.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.f-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}.f-cal span{font-size:11px;color:var(--muted);font-weight:700}
.f-cal a{border:1px solid var(--line2);background:var(--surface);border-radius:10px;padding:6px 0 5px;font-weight:700;font-size:13px;min-height:42px;display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;color:var(--ink)}
.f-cal a.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.f-cal a.mute{opacity:.4}
.f-rs{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:12px}
.f-rs .hd b{font-size:15.5px}.f-rs .hd small{color:var(--muted);font-size:12.5px;margin-left:6px}
.f-q{margin:10px 0 0}.f-ql{font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between}
.f-row{display:flex;gap:8px}.f-row button{flex:1;min-height:40px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);font:inherit;font-weight:800;color:var(--muted);cursor:pointer;padding:6px 4px}
.f-row button.on{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}
.f-got{display:flex;gap:14px;flex-wrap:wrap}.f-got button{display:inline-flex;align-items:center;gap:7px;border:0;background:none;padding:6px 2px;font:inherit;font-weight:700;font-size:13.5px;color:var(--ink);cursor:pointer}
.f-cfr{display:flex;align-items:center;gap:10px;background:var(--am-bg);border-radius:12px;padding:8px 10px;margin:4px 0 2px}.f-cfr span{flex:1;font-size:13px;font-weight:700}
.f-wk{border-color:var(--gold)}.f-wk .tg{font-size:10.5px;font-weight:800;color:var(--am);text-transform:uppercase;letter-spacing:.07em}
.f-cal i{width:5px;height:5px;border-radius:50%;background:var(--bl);display:inline-block;margin:0 1px}.f-cal i.g{background:var(--gold)}`; document.head.appendChild(st); }

  async function fetchData(){
    if(loading) return loading;
    loading = (async () => {
      try{ const j = await hub.api('family'); data = Object.assign(j, {at: Date.now()}); write(CK, data); err = ''; }
      catch(e){ err = navigator.onLine ? e.message : 'offline'; }
      loading = null; render(); if(window.lhqBellRefresh) lhqBellRefresh();
    })();
    return loading;
  }
  const me = () => (hub.session() || {}).me || {};
  const isParent = () => me().role === 'parent';
  const kids = () => (data && data.kids) || [];
  const kid = () => kids()[Math.min(kidI, Math.max(0, kids().length - 1))];
  const T = () => (data && data.today) || HD.today();

  /* ---------- pieces ---------- */
  function sesRow(x){
    const pct = x.planned ? Math.min(100, Math.round(x.had / x.planned * 100)) : 0, mark = x.planned ? Math.round(x.expected / x.planned * 100) : 0, behind = x.behind >= 2;
    return `<a class="it" href="#me/subject/${encodeURIComponent(x.k)}"><span class="f-mk ${behind ? 'am' : 'ok'}">${behind ? '!' : '✓'}</span><span class="t"><b>${esc(sub(x.sub))} <span class="f-n">${x.had}/${x.planned || '?'}</span></b>
      <span class="f-bar"><i style="width:${pct}%"></i><b style="left:${mark}%"></b></span>${x.owed ? `<small>${x.owed} owed</small>` : ''}</span><span class="chev">›</span></a>`;
  }
  const confirmRow = e => `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(sub(e.sub))} · ${day(e.d).split(' ')[0]} ${esc(e.t1 || '')}</b><small>${esc(e.tutor)} · ${Math.max(1, Math.round(e.left / 36e5))} h</small></span>
    <button class="f-ok" data-fcf="yes:${esc(e.id)}" aria-label="Yes, it happened">✓</button><button class="f-no" data-fcf="no:${esc(e.id)}" aria-label="Not right">✕</button></div>`;
  const answerRow = e => `<div class="it" style="flex-wrap:wrap"><span class="f-mk am">!</span><span class="t"><b>${esc(firstN(e.tutor))}: “${esc(e.cf.tutorNote)}”</b><small>${esc(sub(e.sub))} · ${day(e.d)} · kept ${esc(e.t1)}–${esc(e.t2)}</small></span>
    <span class="acts" style="width:100%;margin:8px 0 0 34px"><button class="btn sm n" data-frep="ok:${esc(e.id)}">OK</button><button class="btn sm" data-frep="no:${esc(e.id)}">Still not right</button></span></div>`;
  const STL = {waiting:'Waiting', confirmed:'Confirmed', auto:'Confirmed itself', disputed:'Not right', settled:'Settled'};
  const stMark = e => !e.st ? `<span class="f-mk am">!</span>` : ['confirmed','auto','settled'].includes(e.st) ? '<span class="f-mk ok">✓</span>' : e.st === 'disputed' ? '<span class="f-mk rd">!</span>' : '<span class="f-mk"></span>';
  const stText = e => e.a === 'absent' ? 'Absent · owed' : e.a === 'cancelled' ? 'Cancelled · owed' : e.st === 'disputed' ? ({tutor:'With your tutor', student:'Your tutor answered', lhq:'With LHQ'}[e.cf && e.cf.step] || 'Not right') : e.st === 'settled' ? 'Settled' + (e.cf && e.cf.lost ? ` · ${e.cf.lost} min off` : '') : e.st === 'waiting' ? `${Math.max(1, Math.round(e.left / 36e5))} h` : (STL[e.st] || '');
  const kidChips = () => kids().length > 1 ? `<div class="f-kids">${kids().map((k, i) => `<button class="f-kid ${k === kid() ? 'on' : ''}" data-fkid="${i}"><span class="f-av">${esc(k.name[0])}</span>${esc(firstN(k.name))}</button>`).join('')}</div>` : '';

  /* ---------- pages ---------- */
  function home(){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), today = k.week.filter(s => s.date === t), sraIn = k.sras.filter(x => x.due === t || x.status === 'late');
    const need = (repDue(k) ? [`<a class="it" href="#me/report"><span class="f-mk am">!</span><span class="t"><b>Today's report</b><small>${esc(k.report.ses.map(x => sub(x.sub)).join(', '))} · 2 min</small></span><span class="chev">›</span></a>`] : []).concat(k.toConfirm.map(confirmRow)).concat(k.answers.map(answerRow), isParent() ? [] : sraIn.map(x => `<a class="it" href="#me/practice"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))} · hand in ${x.due === t ? 'today' : 'late'}</small></span><span class="chev">›</span></a>`),
      isParent() ? [] : packOf(k).filter(x => x.doOn === t && !x.done).map(x => `<a class="it" href="#me/practice/pack"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} R${x.stage} today</b><small>${esc(sub(x.sub))} · take-home pack</small></span><span class="chev">›</span></a>`));
    const pay = isParent() ? owedLine() : '';
    return `<div class="ph"><div class="tt"><h1>Hi ${esc(firstN(me().name))}</h1><p>${isParent() && kids().length === 1 ? esc(firstN(k.name)) + ' · ' : ''}${day(t)}</p></div></div>${kidChips()}
      ${need.length ? `<div class="h2">Needs you <em>${need.length}</em></div><div class="card" style="border-left:3px solid var(--gold)">${need.join('')}</div>` : ''}
      <div class="h2">Today</div><div class="card">${today.map(s => `<a class="it" href="#me/calendar"><span class="cal-t">${esc(s.s)}<small>${esc(s.e)}</small></span><span class="t"><b>${esc(sub(s.sub))}</b><small>${esc(s.tutor)}</small></span><span class="chev">›</span></a>`).join('') || '<p class="empty">No sessions today.</p>'}</div>
      ${k.changes.length ? `<div class="h2">Changes</div><div class="card">${k.changes.slice(0, 3).map(c => `<div class="it"><span class="f-mk bl">i</span><span class="t"><b>${esc(sub(c.sub))} → ${DAYN[c.to.day]} ${esc(c.to.s)}</b><small>was ${DAYN[c.from.day]} ${esc(c.from.s)}</small></span></div>`).join('')}</div>` : ''}
      ${packCard(k, true)}<div class="h2">Sessions</div><div class="card">${k.subjects.map(sesRow).join('') || '<p class="empty">No tuition this period.</p>'}</div>${pay}`;
  }
  function owedLine(){
    const all = kids().flatMap(k => k.pay || []), owed = all.filter(p => p.type === 'invoice' && p.balance > 0.5), seen = new Set(), U = owed.filter(p => !seen.has(p.id) && seen.add(p.id));
    if(!U.length) return '';
    const sum = U.reduce((a, p) => a + p.balance, 0), next = U.map(p => p.due).filter(Boolean).sort()[0];
    return `<div class="h2">Payments</div><div class="card"><a class="it" href="#me/payments"><span class="f-mk ${U.some(p => p.over) ? 'rd' : 'am'}">!</span><span class="t"><b>${mk(sum)}</b><small>${U.some(p => p.over) ? 'Overdue' : next ? 'Due ' + day(next) : 'Owed'}</small></span><span class="chev">›</span></a></div>`;
  }
  function practice(tab){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), L = k.sras;
    const doT = L.filter(x => x.doOn === t), inT = L.filter(x => x.due === t || x.status === 'late'), out = L.filter(x => x.status === 'given' && x.doOn !== t);
    const row = x => `<div class="it">${isParent() ? `<span class="f-mk ${x.done ? 'ok' : ''}">${x.done ? '✓' : ''}</span>` : `<button class="f-tick ${x.done ? 'on' : ''}" data-fdone="${esc(x.id)}" aria-label="Done">✓</button>`}<span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))}${x.pack ? ' · take-home pack' : x.due ? ' · hand in ' + (x.due === t ? 'today' : day(x.due)) : ''}</small></span></div>`;
    return `<div class="ph"><div class="tt"><h1>Practice</h1></div></div>${kidChips()}${packCard(k)}
      <div class="h2">Do today</div><div class="card">${doT.map(row).join('') || '<p class="empty">Nothing today. ✓</p>'}</div>
      ${inT.length ? `<div class="h2">Hand in</div><div class="card">${inT.map(x => `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))} · ${x.status === 'late' ? 'late' : 'today'}</small></span></div>`).join('')}</div>` : ''}
      ${out.length ? `<div class="h2">You have</div><div class="card">${out.map(row).join('')}</div>` : ''}`;
  }
  /* ---------- the take-home pack: review sheets after the last session, by date ---------- */
  const ring = (n, N, sz = 60) => { const r = sz / 2 - 6, c = 2 * Math.PI * r, a = N ? c * n / N : 0;
    return `<svg class="f-ring" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="${sz/2}" cy="${sz/2}" r="${r}" fill="none" stroke="var(--ok)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${a} ${c}" transform="rotate(-90 ${sz/2} ${sz/2})"/><text x="50%" y="55%" text-anchor="middle" font-size="${sz > 56 ? 14 : 12.5}" font-weight="800" fill="var(--ink)">${n}/${N}</text></svg>`; };
  const packOf = k => (k.sras || []).filter(x => x.pack).sort((a, b) => a.doOn.localeCompare(b.doOn) || a.sub.localeCompare(b.sub));
  function packCard(k, small){
    const P = packOf(k); if(!P.length) return '';
    const t = T(), n = P.filter(x => x.done).length, nx = P.find(x => !x.done && x.doOn >= t) || P.find(x => !x.done);
    return `<a class="card f-pk" href="#me/practice/pack">${ring(n, P.length, small ? 52 : 60)}<span class="t"><b>Take-home pack</b><small>${nx ? `Next: ${esc(nx.topic)} R${nx.stage} · ${nx.doOn === t ? 'today' : day(nx.doOn)}` : 'All done ✓'}</small></span><span class="chev">›</span></a>`;
  }
  let packAll = false;
  function takeHome(){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), P = packOf(k), n = P.filter(x => x.done).length;
    if(!P.length) return `<div class="ph"><div class="tt"><h1>Take-home pack</h1></div></div>${kidChips()}<div class="card"><p class="empty">No take-home pack.</p></div>`;
    const subs = [...new Set(P.map(x => x.sub))];
    const row = x => `<div class="it" style="align-items:flex-start"><span class="f-day"><small>${DAYN[['Su','Mo','Tu','We','Th','Fr','Sa'][HD.parseISO(x.doOn).getDay()]].slice(0, 3)}</small><b>${HD.parseISO(x.doOn).getDate()}</b></span>
      <span class="t"><b>${esc(x.topic)} · R${x.stage}</b><small>${esc(sub(x.sub))}${x.from ? ` · moved from ${day(x.from)}` : ''}${x.status === 'in' && x.score ? ` · ${x.score.sc}/${x.score.mx} from your tutor` : ''}</small>
      ${(x.done || x.doOn <= t) && x.status !== 'in' ? (isParent() ? (x.self ? `<small>${x.self.sc}/${x.self.mx} <span class="f-self">self-marked</span></small>` : '')
        : `<span class="f-sm"><span>Mark</span><input class="in" inputmode="decimal" value="${x.self ? esc(x.self.sc) : ''}" placeholder="–" data-fself="${esc(x.id)}" aria-label="Your mark"><span>/ ${x.self ? x.self.mx : 10}</span>${x.self ? '<span class="f-self">self-marked</span>' : ''}</span>`) : ''}</span>
      ${isParent() ? `<span class="f-mk ${x.done ? 'ok' : ''}">${x.done ? '✓' : ''}</span>` : `<button class="f-tick ${x.done ? 'on' : ''}" data-fdone="${esc(x.id)}" aria-label="Done">✓</button>`}</div>`;
    const today = P.filter(x => x.doOn === t), next = P.filter(x => x.doOn > t), past = P.filter(x => x.doOn < t);
    return `<div class="ph"><div class="tt"><h1>Take-home pack</h1></div></div>${kidChips()}
      <div class="card f-pk">${ring(n, P.length)}<span class="t"><b>${n} of ${P.length} done</b><small>Last one ${day(P[P.length - 1].doOn)} · ${subs.map(x => esc(sub(x))).join(', ')}</small></span></div>
      ${today.length ? `<div class="h2">Today</div><div class="card">${today.map(row).join('')}</div>` : ''}
      ${next.length ? `<div class="h2">Next <em>${next.length}</em></div><div class="card">${(packAll ? next : next.slice(0, 4)).map(row).join('')}${next.length > 4 && !packAll ? `<button class="it f-all" data-fpkall>All ${next.length}</button>` : ''}</div>` : ''}
      ${past.length ? `<div class="h2">Earlier <em>${past.filter(x => x.done).length} of ${past.length} done</em></div><div class="card">${past.slice().reverse().map(row).join('')}</div>` : ''}
      <p class="note">${isParent() ? 'Sheets go home after the last session. Self-marked scores are kept out of averages.' : 'Do each sheet on its day. Missed one? Do it the next day. Your own marks show as self-marked.'}</p>`;
  }
  function calendar(ym){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), [y, m] = (ym || t.slice(0, 7)).split('-').map(Number), first = new Date(y, m - 1, 1), start = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate();
    const iso = d => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, sel = route.args[2] || t;
    const by = {}; k.week.forEach(s => (by[s.date] = by[s.date] || []).push({k:'s', s})); k.makeups.forEach(s => (by[s.d] = by[s.d] || []).push({k:'s', s:{date:s.d, s:s.s, e:s.e, sub:s.sub, tutor:s.tutor, mu:1}}));
    k.sras.forEach(x => { [x.doOn, x.due].filter(Boolean).forEach(d => (by[d] = by[d] || []).push({k:'g', x})); });
    const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1), ymOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const L = by[sel] || [];
    return `<div class="ph"><div class="tt"><h1>Calendar</h1></div></div>${kidChips()}
      <div class="cal-nav"><a class="btn sm" href="#me/calendar/${ymOf(prev)}">‹</a><b>${['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]} ${y}</b><a class="btn sm" href="#me/calendar/${ymOf(next)}">›</a></div>
      <div class="card pad"><div class="f-cal">${['M','T','W','T','F','S','S'].map(x => `<span>${x}</span>`).join('')}${Array(start).fill('<span></span>').join('')}
        ${Array.from({length: nDays}, (_, i) => { const d = iso(i + 1), E = by[d] || []; return `<a class="${d === sel ? 'on' : ''}" href="#me/calendar/${y}-${String(m).padStart(2, '0')}/${d}">${i + 1}<span>${E.filter(e => e.k === 's').slice(0, 3).map(() => '<i></i>').join('')}${E.some(e => e.k === 'g') ? '<i class="g"></i>' : ''}</span></a>`; }).join('')}</div></div>
      <div class="h2">${day(sel)}</div><div class="card">${L.map(e => e.k === 's' ? `<div class="it"><span class="cal-t">${esc(e.s.s)}<small>${esc(e.s.e)}</small></span><span class="t"><b>${esc(sub(e.s.sub))}${e.s.mu ? ' · make-up' : ''}</b><small>${esc(e.s.tutor)}</small></span></div>`
        : `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(e.x.topic)} ${e.x.stage ? 'R' + e.x.stage : 'LD'}</b><small>${esc(sub(e.x.sub))} · ${e.x.doOn === sel ? 'do' : 'hand in'}</small></span></div>`).join('') || '<p class="empty">Nothing.</p>'}</div>
`;
  }
  function progress(){
    const k = kid(); if(!k) return emptyNoKids();
    const B = window.MARKS ? MARKS.bySubject(k.marks || {}) : [], kOf = sb => (k.subjects.find(x => x.sub === sb) || {}).k;
    const marks = B.length ? `<div class="h2">Marks <em>weekly assessments</em></div><div class="card">${B.map(x => { const kk = kOf(x.sub), tag = kk ? `a href="#me/subject/${encodeURIComponent(kk)}"` : 'div';
      return `<${tag} class="it"><span class="t"><b>${esc(sub(x.sub))}</b><small>${x.w.length ? x.w.length + ' marked' : 'SRAs only'}</small></span>${MARKS.spark(x.w)}${x.last != null ? `<span class="mk-big">${x.last}%${MARKS.change(x.diff)}</span>` : ''}</${tag.split(' ')[0]}>`; }).join('')}</div>` : '';
    return `<div class="ph"><div class="tt"><h1>${isParent() ? 'Sessions' : 'Progress'}</h1></div></div>${kidChips()}${marks}<div class="h2">Sessions <button class="btn sm" data-fhelp style="padding:2px 8px;border-radius:50%">?</button></div><div class="card">${k.subjects.map(sesRow).join('') || '<p class="empty">No tuition this period.</p>'}</div>`;
  }
  function subject(kk){
    const k = kids().find(x => x.subjects.some(s => s.k === kk)) || kid(); if(!k) return emptyNoKids();
    const x = k.subjects.find(s => s.k === kk); if(!x) return `<p class="empty">Not found.</p>`;
    const L = k.sessions.filter(e => e.k === kk);
    return `${crumb('#me/progress', isParent() ? 'Sessions' : 'Progress')}<div class="ph"><div class="tt"><h1>${esc(sub(x.sub))}</h1><p>${esc(x.tutor)} · until ${dshort(x.b)}</p></div></div>
      ${(M => M && (M.w.length || M.sra.length) ? `<div class="card pad"><b>Weekly assessments</b><p class="note" style="margin:0 0 4px">% each time</p>${MARKS.line(M)}</div>
        <div class="card pad"><b>What ${isParent() ? 'they remember' : 'you remember'} (SRAs)</b><p class="note" style="margin:0 0 8px">% at each review of a topic</p>${MARKS.grid(M)}</div>` : '')(window.MARKS && MARKS.bySubject(k.marks || {}).find(m => m.sub === x.sub))}
      <div class="card pad"><div class="f-four"><div><b>${x.planned}</b><small>Planned</small></div><div><b>${x.had}</b><small>Had</small></div><div><b>${x.remaining}</b><small>Left</small></div><div><b>${x.owed}</b><small>Owed</small></div></div></div>
      <div class="h2">${x.times.map(t => `${DAYN[t.d]} ${t.s}`).join(' · ')}</div>
      <div class="card">${L.map(e => `<div class="it">${stMark(e)}<span class="t"><b>${day(e.d)}${e.mk ? ' · make-up' : ''}</b><small>${e.a === 'absent' || e.a === 'cancelled' ? '' : esc(e.t1) + '–' + esc(e.t2) + ' · '}${esc(stText(e))}</small></span>${k.canConfirm && e.st === 'waiting' ? `<button class="f-ok" data-fcf="yes:${esc(e.id)}">✓</button><button class="f-no" data-fcf="no:${esc(e.id)}">✕</button>` : ''}</div>`).join('') || '<p class="empty">No sessions logged yet.</p>'}</div>`;
  }
  function payments(){
    const all = []; const seen = new Set(); kids().forEach(k => (k.pay || []).forEach(p => { if(!seen.has(p.id)){ seen.add(p.id); all.push(Object.assign({kid: k.name}, p)); } }));
    const owed = all.filter(p => p.type === 'invoice' && p.balance > 0.5), sum = owed.reduce((a, p) => a + p.balance, 0);
    const W = {invoice:'Invoice', receipt:'Receipt', quote:'Quote'};
    return `<div class="ph"><div class="tt"><h1>Payments</h1></div></div>
      ${owed.length ? `<div class="card pad"><div style="font-size:26px;font-weight:800;color:var(--brand)">${mk(sum)}</div><p class="note" style="margin:2px 0 0">${owed.some(p => p.over) ? 'Overdue' : 'Due ' + day(owed.map(p => p.due).filter(Boolean).sort()[0])} · ${owed.map(p => esc(p.number)).join(', ')}</p></div>` : '<div class="card pad"><b>Nothing owed. ✓</b></div>'}
      <div class="h2">History</div><div class="card">${all.map(p => `<div class="it"><span class="f-mk ${p.type === 'invoice' ? (p.balance > 0.5 ? (p.over ? 'rd' : 'am') : 'ok') : p.type === 'receipt' ? 'ok' : 'bl'}">${p.type === 'invoice' && p.balance > 0.5 ? '!' : p.type === 'quote' ? '' : '✓'}</span><span class="t"><b>${esc(p.number)} · ${mk(p.type === 'receipt' ? p.received : p.total)}</b><small>${W[p.type]} · ${day(p.date)}${kids().length > 1 ? ' · ' + esc(firstN(p.kid)) : ''}${p.type === 'invoice' ? (p.balance > 0.5 ? ` · ${mk(p.balance)} owed` : ' · paid') : ''}</small></span></div>`).join('') || '<p class="empty">Nothing yet.</p>'}</div>
      <p class="note">To pay: ${esc((window.settingsKV && settingsKV().payHow) || 'see your invoice for LHQ\'s bank and mobile money details')}.</p>`;
  }
  function more(){
    return `<div class="ph"><div class="tt"><h1>More</h1></div></div><div class="card">
      <a class="it" href="#settings"><span class="t"><b>My account</b></span><span class="chev">›</span></a>
      <a class="it" href="tel:+265992525250"><span class="t"><b>Contact LHQ</b><small>0992 525 250</small></span><span class="chev">›</span></a></div>`;
  }
  const emptyNoKids = () => `<div class="ph"><div class="tt"><h1>Hi ${esc(firstN(me().name))}</h1></div></div>${!data ? `<p class="empty">${err === 'offline' ? 'Offline.' : err ? esc(err) : 'Loading…'}</p>` : '<p class="empty">Your account isn\'t linked to a student yet. Ask LHQ.</p>'}`;

  /* ---------- today's report (students) ---------- */
  const RS = {};   // answers being filled in, by date
  const hmNow = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  /* it opens once the day's first session has ended */
  const repOpen = k => !!(k && k.report && (k.report.sent || hmNow() >= (k.report.ses[0].e || '00:00')));
  const repDue = k => !isParent() && repOpen(k) && !k.report.sent;
  const seed = rep => { const s0 = rep.sent || {}, ses = {}; rep.ses.forEach(x => { const a = (s0.ses || {})[x.sub] || {}; ses[x.sub] = {rate: a.rate || 0, prep: a.prep || '', conf: a.conf || 0, gb: !!a.gb, na: !!a.na, sra: !!a.sra}; });
    return {ses, wk: s0.wk ? s0.wk.a : '', note: s0.note || '', edit: false}; };
  const repReady = (rep, st) => rep.ses.every(x => { const a = st.ses[x.sub]; return a.rate && a.prep && a.conf; }) && (!rep.wk || st.wk);
  function report(){
    const k = kid(), rep = k && k.report, back = `<a class="crumb" href="#me">‹ Home</a>`;
    if(isParent() || !rep) return back + '<p class="empty">No sessions today.</p>';
    const st = RS[rep.date] || (RS[rep.date] = seed(rep));
    if(rep.sent && !st.edit) return `${back}<div style="text-align:center;padding:40px 10px"><span class="f-mk ok" style="width:60px;height:60px;font-size:28px;margin:0 auto 12px">✓</span><h1 style="margin:0;color:var(--brand)">Sent</h1>
      <p class="note">Today's report · ${day(rep.date)}</p><button class="btn" data-frchg style="margin-top:10px">Change it</button></div>`;
    const E = encodeURIComponent, dots = (s, f, v) => `<div class="f-row">${[1, 2, 3, 4, 5].map(n => `<button class="${v === n ? 'on' : ''}" data-fr="${E(s)}|${f}|${n}">${n}</button>`).join('')}</div>`;
    const ses = rep.ses.map(x => { const a = st.ses[x.sub], tn = firstN(x.tutor) || 'Your tutor', cf = k.toConfirm.find(e => e.d === rep.date && e.sub === x.sub);
      return `<div class="f-rs"><div class="hd"><b>${esc(sub(x.sub))}</b><small>${esc(x.s)}–${esc(x.e)} · ${esc(tn)}</small></div>
        ${cf ? `<div class="f-cfr"><span>Happened as logged?</span><button class="f-ok" data-fcf="yes:${esc(cf.id)}" aria-label="Yes">✓</button><button class="f-no" data-fcf="no:${esc(cf.id)}" aria-label="Not right">✕</button></div>` : ''}
        <div class="f-q"><div class="f-ql">The session</div>${dots(x.sub, 'rate', a.rate)}</div>
        <div class="f-q"><div class="f-ql">${esc(tn)} was prepared</div><div class="f-row">${['Yes','Partly','No'].map(o => `<button class="${a.prep === o ? 'on' : ''}" data-fr="${E(x.sub)}|prep|${o}">${o}</button>`).join('')}</div></div>
        <div class="f-q"><div class="f-ql">How sure you are of today's topic</div>${dots(x.sub, 'conf', a.conf)}</div>
        <div class="f-q"><div class="f-ql">You got</div><div class="f-got">${[['gb','Guide before'],['na','Notes after'],['sra','SRA']].map(([g, l]) => `<button data-frg="${E(x.sub)}|${g}"><span class="f-tick ${a[g] ? 'on' : ''}">✓</span>${l}</button>`).join('')}</div></div></div>`; }).join('');
    const ok = repReady(rep, st);
    return `${back}<div class="ph"><div class="tt"><h1>Today's report</h1><p>${day(rep.date)} · 1 = poor, 5 = great</p></div></div>${ses}
      ${rep.wk ? `<div class="f-rs f-wk"><div class="tg">This week</div><div style="font-weight:700;margin:4px 0 8px">${esc(rep.wk.q)}</div><div class="f-row">${rep.wk.o.map(o => `<button class="${st.wk === o ? 'on' : ''}" data-fwk="${esc(o)}">${esc(o)}</button>`).join('')}</div></div>` : ''}
      <div class="f-q" style="margin-bottom:12px"><div class="f-ql">Anything else <span>LHQ only</span></div><textarea class="in" id="frNote" rows="3" placeholder="Optional" style="min-height:70px">${esc(st.note)}</textarea></div>
      <button class="btn n full" id="frSend" ${ok ? '' : 'disabled'}>Send</button><p class="note" style="text-align:center">Your tutors never see your answers.</p>`;
  }

  function page(sub0, a1, a2){
    if(!data || Date.now() - (data.at || 0) > 60000) fetchData();
    if(!data) return emptyNoKids();
    if(sub0 === 'practice') return a1 === 'pack' ? takeHome() : practice();
    if(sub0 === 'calendar') return calendar(a1);
    if(sub0 === 'progress' || sub0 === 'sessions') return progress();
    if(sub0 === 'subject') return subject(decodeURIComponent(a1 || ''));
    if(sub0 === 'payments' && isParent()) return payments();
    if(sub0 === 'more') return more();
    if(sub0 === 'report') return report();
    return home();
  }

  /* ---------- actions ---------- */
  async function post(body, ok){
    try{ const j = await hub.api('family', {method:'POST', body: JSON.stringify(body)}); closeSheet(); toast(ok); await fetchData(); return j; }
    catch(e){ toast(e.message); }
  }
  function notRight(id){
    const e = kids().flatMap(k => k.sessions).find(x => x.id === id); if(!e) return;
    let pick = 'late';
    const draw = () => { openSheet(`<div class="hx"><h3>What happened?</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(sub(e.sub))} · ${day(e.d)} · ${esc(e.t1)}–${esc(e.t2)}</p>
      ${[['late','Started late'],['early','Ended early'],['none',"Didn't happen"],['other','Other']].map(([k, l]) => `<button class="f-opt ${pick === k ? 'on' : ''}" data-fpick="${k}"><span class="f-tick ${pick === k ? 'on' : ''}">✓</span>${l}</button>`).join('')}
      ${pick === 'late' || pick === 'early' ? `<div class="r2"><label class="f"><span>Start</span><input class="in" id="fT1" value="${esc(e.t1)}" placeholder="14:20"></label><label class="f"><span>End</span><input class="in" id="fT2" value="${esc(e.t2)}" placeholder="15:00"></label></div>` : ''}
      <label class="f"><span>${pick === 'other' ? 'What?' : 'Note (optional)'}</span><input class="in" id="fNote"></label>
      <button class="btn n full" id="fSend">Send</button>`);
      document.querySelectorAll('[data-fpick]').forEach(b => b.onclick = () => { pick = b.dataset.fpick; draw(); });
      $('fSend').onclick = () => post({action:'dispute', id, kind:pick, t1: $('fT1') ? $('fT1').value.trim() : '', t2: $('fT2') ? $('fT2').value.trim() : '', note: $('fNote').value}, 'Sent to your tutor'); };
    draw();
  }
  function bind(){
    document.querySelectorAll('[data-fkid]').forEach(b => b.onclick = () => { kidI = +b.dataset.fkid; write('lhq_family_kid', kidI); render(); });
    document.querySelectorAll('[data-fcf]').forEach(b => b.onclick = () => { const [a, ...r] = b.dataset.fcf.split(':'), id = r.join(':');
      if(a === 'yes') post({action:'confirm', id}, 'Confirmed'); else notRight(id); });
    document.querySelectorAll('[data-frep]').forEach(b => b.onclick = () => { const [a, ...r] = b.dataset.frep.split(':');
      post({action:'reply', id: r.join(':'), ok: a === 'ok'}, a === 'ok' ? 'Done' : 'Sent to LHQ'); });
    document.querySelectorAll('[data-fdone]').forEach(b => b.onclick = async () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on);
      try{ await hub.api('family', {method:'POST', body: JSON.stringify({action:'done', id: b.dataset.fdone, done: on})}); const x = kids().flatMap(k => k.sras).find(s => s.id === b.dataset.fdone); if(x) x.done = on; write(CK, data); toast(on ? 'Done' : 'Not done'); if(x && x.pack) render(); }
      catch(e){ b.classList.toggle('on', !on); toast(e.message); } });
    document.querySelectorAll('[data-fpkall]').forEach(b => b.onclick = () => { packAll = true; render(); });
    document.querySelectorAll('[data-fself]').forEach(inp => inp.onchange = async () => { const id = inp.dataset.fself, v = inp.value.trim();
      const j = await post({action:'selfmark', id, sc: v}, v ? 'Mark saved · self-marked' : 'Mark removed');
      if(j && v){ const x = kids().flatMap(k => k.sras).find(s => s.id === id); if(x && !x.done) await hub.api('family', {method:'POST', body: JSON.stringify({action:'done', id, done: true})}).then(fetchData).catch(() => {}); } });
    /* today's report */
    const R0 = () => { const k = kid(); return k && k.report && RS[k.report.date]; };
    document.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => { const [s0, f, v] = b.dataset.fr.split('|'), st = R0(); if(!st) return; st.ses[decodeURIComponent(s0)][f] = f === 'prep' ? v : +v; render(); });
    document.querySelectorAll('[data-frg]').forEach(b => b.onclick = () => { const [s0, g] = b.dataset.frg.split('|'), st = R0(), a = st && st.ses[decodeURIComponent(s0)]; if(!a) return; a[g] = !a[g]; render(); });
    document.querySelectorAll('[data-fwk]').forEach(b => b.onclick = () => { const st = R0(); if(st){ st.wk = b.dataset.fwk; render(); } });
    if($('frNote')) $('frNote').oninput = e => { const st = R0(); if(st) st.note = e.target.value; };
    document.querySelectorAll('[data-frchg]').forEach(b => b.onclick = () => { const st = R0(); if(st){ st.edit = true; render(); } });
    if($('frSend')) $('frSend').onclick = async () => { const k = kid(), st = R0(); if(!st) return; $('frSend').disabled = true;
      const j = await post({action:'report', ses: st.ses, wk: st.wk, note: st.note}, 'Sent');
      if(j){ st.edit = false; } else $('frSend').disabled = false; };
    document.querySelectorAll('[data-fhelp]').forEach(b => b.onclick = () => openSheet(`<div class="hx"><h3>Sessions</h3><button class="ib" data-close>✕</button></div><p style="line-height:1.7"><b>7/16</b>: had of planned this period.<br>The bar's dark mark: where you should be by today.<br><b>!</b> behind · <b>✓</b> on track · <b>owed</b>: make-ups due.</p>`));
  }
  /* the bell: what needs this person, and news */
  function bell(){
    if(!data) return {need: [], info: []};
    const t = T(), need = [], info = [];
    kids().forEach(k => {
      const who = kids().length > 1 ? firstN(k.name) + ' · ' : '';
      k.toConfirm.forEach(e => need.push({t:`${who}${sub(e.sub)} · ${day(e.d).split(' ')[0]} ${e.t1}`, s:'Confirm', href:'#me'}));
      k.answers.forEach(e => need.push({t:`${who}${firstN(e.tutor)} answered`, s:`${sub(e.sub)} · ${day(e.d)}`, href:'#me'}));
      if(repDue(k)) need.push({t:"Today's report", s: k.report.ses.map(x => sub(x.sub)).join(', ') + ' · 2 min', href:'#me/report'});
      if(!isParent()) k.sras.filter(x => x.due === t || x.status === 'late').forEach(x => need.push({t:`${x.topic} ${x.stage ? 'R' + x.stage : 'LD'}`, s:'Hand in ' + (x.due === t ? 'today' : 'late'), href:'#me/practice'}));
      if(!isParent()) packOf(k).filter(x => x.doOn === t && !x.done).forEach(x => need.push({t:`${x.topic} R${x.stage} today`, s:'Take-home pack', href:'#me/practice/pack'}));
      k.changes.forEach(c => info.push({t:`${who}${sub(c.sub)} → ${DAYN[c.to.day]} ${c.to.s}`, s:'was ' + DAYN[c.from.day] + ' ' + c.from.s, at:c.at, href:'#me'}));
      k.makeups.forEach(m => info.push({t:`${who}Make-up: ${sub(m.sub)} ${day(m.d)} ${m.s}`, s:'Confirmed', at:0, href:'#me/calendar'}));
      k.sessions.filter(e => e.cf && e.cf.agreed).slice(0, 3).forEach(e => info.push({t:`${who}${sub(e.sub)} · ${day(e.d)}`, s:'Sorted with ' + firstN(e.tutor), at:0, href:'#me/subject/' + encodeURIComponent(e.k)}));
    });
    if(isParent()){ const seen = new Set(); kids().flatMap(k => k.pay || []).filter(p => p.type === 'invoice' && p.balance > 0.5 && !seen.has(p.id) && seen.add(p.id)).forEach(p => need.push({t:mk(p.balance), s:(p.over ? 'Overdue · ' : 'Due ') + day(p.due) + ' · ' + p.number, href:'#me/payments'})); }
    return {need, info};
  }
  return {page, bind, bell, refresh: fetchData};
})();
