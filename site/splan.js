/* LHQ Hub › a student's own time: Day (with Plan my day), My week, Year, adding activities and dates (Busy, shared),
   a study block's steps, suggested weeks. The SRA tracker decides what goes into study time; the student can change it.
   Uses the family data (k: one student): week (LHQ sessions), makeups, sras, coming (assessments), sx.plan (blocks and dates). */
window.SPLAN = (function(){
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const iso = t => new Date(t).toISOString().slice(0, 10), add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x.getTime()); };
  const wdOf = d => new Date(d + 'T00:00:00Z').getUTCDay(), dl = d => `${WD[wdOf(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`, monOf = d => add(d, -((wdOf(d) + 6) % 7));
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const dur = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
  const esc = v => String(v == null ? '' : v).replace(/^Mathematics$/i, 'Maths').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const T = () => (window.HD ? HD.today() : iso(Date.now())), R = n => n ? 'R' + n : 'LD';
  const isParent = () => ((window.hub && hub.session && (hub.session() || {}).me) || {}).role === 'parent';
  const rd = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }catch(e){ return d; } }, wr = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const BT = [['study','Study'],['rev','Revision'],['school','School'],['act','Activity'],['rest','Rest'],['other','Other']], DT = [['exam','Exam paper'],['season','Exam season'],['school','School date'],['hol','Holiday'],['other','Other']];
  const tyL = b => ((b.all ? DT : BT).find(x => x[0] === b.type) || ['', 'Other'])[1];
  const blockOn = (b, d) => { if(!b || !b.from) return false; if(b.all) return d >= b.from && d <= (b.to || b.from); if(d < b.from || (b.until && d > b.until)) return false; const w = wdOf(d);
    return b.rep === 'daily' ? true : b.rep === 'weekdays' ? w >= 1 && w <= 5 : b.rep === 'days' ? (b.days || []).includes(w) : d === b.from; };
  const plan = k => isParent() ? [] : ((k.sx || {}).plan || []);
  const post = async (body, msg) => { await hub.api('family', {method: 'POST', body: JSON.stringify(body)}); if(window.FAM && FAM.refresh) await FAM.refresh(); if(msg) toast(msg); render(); };

  /* ---------- what's on a day ---------- */
  function sessionsOn(k, d){
    const L = (k.week || []).filter(s => s.date === d).map(s => ({s: s.s, e: s.e, n: (window.FAM ? FAM.sub(s.sub) : s.sub), who: s.tutor || '', lhq: 1, raw: s}));
    (k.makeups || []).filter(m => m.d === d).forEach(m => L.push({s: m.s, e: m.e, n: (window.FAM ? FAM.sub(m.sub) : m.sub) + ' · make-up', who: m.tutor || '', lhq: 1}));
    return L.filter(x => mins(x.s) != null);
  }
  const blocksOn = (k, d) => plan(k).filter(b => !b.all && blockOn(b, d)).sort((a, b) => a.s.localeCompare(b.s));
  const datesOn = (k, d) => plan(k).filter(b => b.all && blockOn(b, d));
  const overlap = (k, d, b) => sessionsOn(k, d).find(s => mins(s.s) < mins(b.e) && mins(b.s) < mins(s.e));
  const sraDue = (k, d) => (k.sras || []).filter(x => x.doOn === d && !x.done);
  const sraLate = (k, d) => (k.sras || []).filter(x => x.doOn < d && !x.done && !x.pack && x.status !== 'in' && d === T());
  const assessSoon = (k, d) => (window.FAM ? FAM.comingOf(k) : (k.coming || [])).filter(a => a.d > d && a.d <= add(d, 2));
  const fading = k => window.SX && SX.memory ? SX.memory(k).L.filter(x => x.kept < 85) : [];

  /* ---------- Plan my day: the tracker's order, fitted into study blocks first, then free time ---------- */
  function tasks(k, d){
    const L = [], tl = x => `${x.topic} ${R(x.stage)}`;
    sraDue(k, d).forEach(x => L.push({kind: 'sra', m: 15, label: 'ARS + SRA: ' + tl(x), sub: x.sub, ref: x.id, why: 'due'}));
    sraLate(k, d).forEach(x => L.push({kind: 'sra', m: 15, label: 'ARS + SRA: ' + tl(x) + ' (late)', sub: x.sub, ref: x.id, why: 'late'}));
    assessSoon(k, d).forEach(a => L.push({kind: 'as', m: 30, label: 'Revise: ' + ((window.MARKS ? MARKS.TY[MARKS.akN(a.ak)] : '') || 'Assessment') + ' ' + (a.d === add(d, 1) ? 'tomorrow' : dl(a.d)), sub: a.sub, ref: a, why: 'as'}));
    fading(k).slice(0, wdOf(d) % 6 === 0 ? 2 : 1).forEach(x => L.push({kind: 'fade', m: 25, label: 'Focus: ' + x.tk, sub: x.sub, ref: x, why: 'fade'}));
    if(L.length) L.push({kind: 'wrap', m: 10, label: 'Wrap up', sub: '', why: 'wrap'});
    return L;
  }
  function freeTime(k, d){
    const wk = wdOf(d) >= 1 && wdOf(d) <= 5, B = blocksOn(k, d), school = B.filter(b => b.type === 'school');
    let a = wk ? Math.max(14 * 60, ...school.map(b => mins(b.e) + 30)) : 8 * 60; const z = 21 * 60;
    if(d === T()){ const n = new Date(), now = n.getHours() * 60 + n.getMinutes(); a = Math.max(a, Math.ceil((now + 5) / 5) * 5); }
    const busy = sessionsOn(k, d).map(s => [mins(s.s), mins(s.e) + 10]).concat(B.map(b => [mins(b.s), mins(b.e) + (b.type === 'act' || b.type === 'school' ? 30 : 0)]));
    const out = []; let cur = a;
    busy.filter(x => x[1] > a && x[0] < z).sort((p, q) => p[0] - q[0]).forEach(([s, e]) => { if(s - cur >= 15) out.push([cur, Math.min(s, z)]); cur = Math.max(cur, e); });
    if(z - cur >= 15) out.push([cur, z]);
    return out;
  }
  function autoPlan(k, d){
    const slots = blocksOn(k, d).filter(b => b.type === 'study' || b.type === 'rev').map(b => ({a: mins(b.s), z: mins(b.e), blk: b}))
      .concat(freeTime(k, d).map(([a, z]) => ({a, z})));
    const out = [];
    tasks(k, d).forEach(t => { const sl = slots.find(x => x.z - x.a >= t.m); if(!sl) return; out.push(Object.assign({}, t, {s: hm(sl.a), e: hm(sl.a + t.m), blk: sl.blk ? sl.blk.id : ''})); sl.a += t.m; });
    return out.sort((p, q) => p.s.localeCompare(q.s));
  }
  let PM = null;   // the suggestions being edited: {d, items}
  const why = (k, it) => { const x = it.ref;
    if(it.why === 'due' || it.why === 'late'){ const s = (k.sras || []).find(y => y.id === x) || {}; return [it.why === 'due' ? 'SRA due today' : 'SRA not done on its day', `${s.sub || ''} · do on ${s.doOn ? dl(s.doOn) : ''}`, 'ARS first (sheet closed, write what you remember), then the SRA. 15 min.']; }
    if(it.why === 'as') return ['Assessment soon', `${x.sub} · ${dl(x.d)}${x.s ? ' ' + x.s : ''}${(x.tp || []).length ? ' · ' + x.tp.join(', ') : ''}`, 'An assessment in the next 2 days gets 30 min on its topics.'];
    if(it.why === 'fade') return ['Fading topic', `${x.sub} · ${R(x.f.rv)} ${x.f.p}% → ${R(x.l.rv)} ${x.l.p}%`, 'Latest SRA mark well below the first. One focus round.'];
    if(it.why === 'mine') return ['Your choice', '', 'Not from the tracker.'];
    return ['Wrap up', '', 'Tick what you finished. 10 min.']; };

  /* ---------- Day ---------- */
  function rowTL(s, e, body, cls, attrs){ return `<div class="sp-tl ${cls || ''}"><span>${s}<br>${e}</span><div ${attrs || ''}>${body}</div></div>`; }
  function day(k, d){
    d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : T();
    const S = sessionsOn(k, d), B = blocksOn(k, d), D = datesOn(k, d), due = sraDue(k, d), late = sraLate(k, d), soon = assessSoon(k, d), mine = !isParent();
    const pm = PM && PM.d === d ? PM.items : null;
    const rows = S.map(x => ({t: x.s, h: rowTL(x.s, x.e, `<b>${esc(x.n)} 🔒</b><small>${esc(x.who)} · LHQ</small>`, 'l')}))
      .concat(B.map(b => { const o = overlap(k, d, b); return {t: b.s, h: rowTL(b.s, b.e, `<b>${esc(b.name || tyL(b))}</b><small>${esc(tyL(b))}${b.sub ? ' · ' + esc(b.sub) : ''}${b.busy ? ' · busy' : ''}${o ? ` · <span class="sp-red">overlaps ${esc(o.n)} ${o.s}</span>` : ''}</small>`, 'k-' + b.type + (o ? ' ov' : ''), mine ? `data-spgo="#me/blk/${b.id}/${d}"` : '')}; }))
      .concat((pm || []).filter(x => !x.blk).map(x => ({t: x.s, h: rowTL(x.s, x.e, `<b>${esc(x.label)}</b><small>${esc(x.sub || '')}${x.sub ? ' · ' : ''}suggested</small>`, 'sg', `data-sped="${pm.indexOf(x)}"`) + ''})))
      .sort((p, q) => p.t.localeCompare(q.t));
    const inB = (pm || []).filter(x => x.blk);
    return `<a class="crumb" href="#me/calendar/${d.slice(0, 7)}/${d}">‹ Calendar</a><div class="ph"><div class="tt"><h1>${dl(d)}</h1><p>${d === T() ? 'Today' : 'Day'}</p></div><div class="acts"><a class="btn sm" href="#me/day/${add(d, -1)}" aria-label="Day before">‹</a><a class="btn sm" href="#me/day/${add(d, 1)}" aria-label="Next day">›</a></div></div>
      ${views('day', d)}
      ${D.length ? `<div class="card">${D.map(b => `<a class="it" ${mine ? `href="#me/blk/${b.id}/${d}"` : ''}><span class="sp-star ${b.busy ? 'bz' : ''}">★</span><span class="t"><b>${esc(b.name)}</b><small>${esc(tyL(b))} · all day${b.busy ? ' · busy' : ''}</small></span>${mine ? '<span class="chev">›</span>' : ''}</a>`).join('')}</div>` : ''}
      ${due.length + late.length + soon.length ? `<div class="h2">Due</div><div class="card">${due.concat(late).map(x => `<div class="it"><span class="t"><b>${esc(x.topic)} ${R(x.stage)}</b><small>${esc(x.sub)}${x.doOn < d ? ' · late' : ' · do today'}</small></span>${mine && window.FAM ? FAM.steps(x) : ''}</div>`).join('')}
        ${soon.map(a => `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc((window.MARKS ? MARKS.TY[MARKS.akN(a.ak)] : '') || 'Assessment')} · ${esc(a.sub)}</b><small>${dl(a.d)}${a.s ? ' ' + a.s : ''}${(a.tp || []).length ? ' · ' + esc(a.tp.join(', ')) : ''}</small></span></div>`).join('')}</div>` : ''}
      <div class="h2">Schedule${mine && !pm ? ` <button class="sp-lnk" data-spplan="${d}">Plan my day ›</button>` : ''}</div>
      <div class="card pad sp-tls">${rows.map(r => r.h).join('') || '<p class="empty">Nothing planned.</p>'}</div>
      ${pm ? `${inB.length ? `<div class="h2">In your blocks</div><div class="card">${inB.map(x => `<button class="it" style="width:100%" data-sped="${pm.indexOf(x)}"><span class="t"><b>${esc(x.label)}</b><small>${x.s}–${x.e} · in ${esc((B.find(b => b.id === x.blk) || {}).name || 'Study')}</small></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
        ${pm.length ? '' : '<p class="note">Nothing due. Free time stays free.</p>'}
        <div class="row" style="gap:8px">${pm.some(x => !x.blk) ? `<button class="btn n" style="flex:1" data-spadd>Add ${pm.filter(x => !x.blk).length} block${pm.filter(x => !x.blk).length === 1 ? '' : 's'}</button>` : ''}<button class="btn" style="flex:1" data-spclear>Close</button></div>
        <p class="note" style="margin-top:8px">Tap a suggestion to change its time, swap or remove it. <button class="sp-lnk" data-sprules>How it's chosen</button></p>` : ''}
      ${mine ? `<button class="btn ${pm ? '' : 'n'} full" style="margin-top:10px" data-spnew="${d}">+ Add</button>` : `<p class="note">Their own blocks stay private.</p>`}`;
  }
  const views = (v, d) => `<div class="seg sp-vw">${[['day','Day','#me/day/' + d],['week','Week','#me/week/' + monOf(d)],['month','Month','#me/calendar/' + d.slice(0, 7) + '/' + d],['year','Year','#me/year/' + d]].map(([k, l, h]) => `<a class="${v === k ? 'on' : ''}" href="${h}">${l}</a>`).join('')}</div>`;

  /* editing a suggestion: time ±5, swap (from the tracker), remove, or give its time to the one before */
  function edSheet(k, i){
    const it = PM.items[i]; if(!it) return; const [h, s2, n] = why(k, it), free = PM.items.filter(x => !x.blk && x !== it), prev = PM.items.filter(x => (x.blk || '') === (it.blk || '') && x.e <= it.s).slice(-1)[0];
    const alt = tasks(k, add(PM.d, 0)).concat(sraDue(k, add(PM.d, 1)).map(x => ({kind: 'sra', m: 15, label: 'Early: ARS + SRA: ' + x.topic + ' ' + R(x.stage), sub: x.sub, ref: x.id, why: 'due'})))
      .concat(fading(k).slice(1, 4).map(x => ({kind: 'fade', m: 25, label: 'Focus: ' + x.tk, sub: x.sub, ref: x, why: 'fade'})))
      .filter(a => a.label !== it.label && !PM.items.some(x => x.label === a.label));
    openSheet(`<div class="hx"><h3>${esc(it.label)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${it.s}–${it.e} · ${dur(mins(it.e) - mins(it.s))}</p>
      <div class="card pad"><div class="sp-stp"><span>Start</span><button class="btn sm" data-spt="s|-5">−</button><b>${it.s}</b><button class="btn sm" data-spt="s|5">+</button></div>
        <div class="sp-stp"><span>End</span><button class="btn sm" data-spt="e|-5">−</button><b>${it.e}</b><button class="btn sm" data-spt="e|5">+</button></div></div>
      <div class="cap">Why</div><div class="card"><div class="it"><span class="t"><b>${esc(h)}</b><small>${esc(s2)}</small></span></div><p class="note" style="margin:0;padding:0 14px 10px">${esc(n)}</p></div>
      ${alt.length ? `<div class="cap">Swap to · from your tracker</div><div class="card">${alt.slice(0, 5).map((a, j) => `<button class="it" style="width:100%" data-spsw="${j}"><span class="t"><b>${esc(a.label)}</b><small>${esc(a.sub || '')}</small></span><span class="chev">›</span></button>`).join('')}</div>` : ''}
      <div class="cap">Something else</div><div class="card pad"><input class="in" id="spOwn" placeholder="e.g. Chemistry past paper"><button class="btn full" style="margin-top:8px" data-spown>Use this</button></div>
      ${prev ? `<button class="btn full" data-sprmg style="margin-top:4px">Remove · give ${dur(mins(it.e) - mins(it.s))} to ${esc(prev.label.replace(/^Focus: /, ''))}</button>` : ''}
      <button class="btn full rd" data-sprm style="margin-top:8px">Remove</button>`);
    const bound = () => { const same = PM.items.filter(x => (x.blk || '') === (it.blk || '') && x !== it), lo = Math.max(14 * 60 - 360, ...same.filter(x => x.e <= it.s).map(x => mins(x.e))), hi = Math.min(22 * 60, ...same.filter(x => x.s >= it.e).map(x => mins(x.s)));
      const B = it.blk ? blocksOn(k, PM.d).find(b => b.id === it.blk) : null; return B ? [Math.max(lo, mins(B.s)), Math.min(hi, mins(B.e))] : [lo, hi]; };
    document.querySelectorAll('[data-spt]').forEach(b => b.onclick = () => { const [f, v] = b.dataset.spt.split('|'), [lo, hi] = bound(), n2 = mins(it[f]) + +v;
      if(f === 's' && n2 >= lo && n2 <= mins(it.e) - 5) it.s = hm(n2); if(f === 'e' && n2 <= hi && n2 >= mins(it.s) + 5) it.e = hm(n2); PM.items.sort((p, q) => p.s.localeCompare(q.s)); render(); edSheet(k, PM.items.indexOf(it)); });
    document.querySelectorAll('[data-spsw]').forEach(b => b.onclick = () => { const a = alt[+b.dataset.spsw]; Object.assign(it, {kind: a.kind, label: a.label, sub: a.sub, ref: a.ref, why: a.why}); render(); edSheet(k, PM.items.indexOf(it)); });
    const own = document.querySelector('[data-spown]'); if(own) own.onclick = () => { const v = $('spOwn').value.trim(); if(!v) return; Object.assign(it, {kind: 'mine', label: v, sub: '', ref: null, why: 'mine'}); render(); closeSheet(); };
    const rm = document.querySelector('[data-sprm]'); if(rm) rm.onclick = () => { PM.items.splice(PM.items.indexOf(it), 1); closeSheet(); render(); };
    const rmg = document.querySelector('[data-sprmg]'); if(rmg) rmg.onclick = () => { prev.e = it.e; PM.items.splice(PM.items.indexOf(it), 1); closeSheet(); render(); };
  }
  const rulesSheet = () => openSheet(`<div class="hx"><h3>How Plan my day chooses</h3><button class="ib" data-close>✕</button></div><p class="sp">From your SRA tracker, in this order</p>
    <div class="card">${[['SRAs due today','ARS then SRA · 15 min each'],['SRAs not done on their day','15 min each'],['An assessment in the next 2 days','30 min on its topics'],['A fading topic','latest SRA mark well below the first · one focus round'],['Wrap up','10 min']].map((x, i) => `<div class="it"><span class="f-mk">${i + 1}</span><span class="t"><b>${x[0]}</b><small>${x[1]}</small></span></div>`).join('')}</div>
    <p class="note">Your Study and Revision blocks fill first, then free time from 14:00 (after school) to 21:00. Never over school, activities, LHQ sessions or the 30 min after an activity.</p>`);

  /* ---------- a block: its steps (study and revision), or its details ---------- */
  function block(k, id, d){
    const b = plan(k).find(x => x.id === id); d = d || T(); if(!b) return '<p class="empty">Not found.</p>';
    const head = `<a class="crumb" href="#me/day/${d}">‹ ${dl(d)}</a><div class="ph"><div class="tt"><h1>${esc(b.name || tyL(b))}</h1><p>${esc(tyL(b))}${b.all ? ' · ' + dl(b.from) + (b.to ? ' – ' + dl(b.to) : '') : ' · ' + b.s + '–' + b.e}${b.sub ? ' · ' + esc(b.sub) : ''}</p></div><div class="acts"><button class="btn sm" data-spedit="${b.id}">Edit</button></div></div>`;
    if(b.all || !(b.type === 'study' || b.type === 'rev')) { const o = !b.all && overlap(k, d, b);
      return head + `<div class="card">${[['Repeats', b.all ? (b.to ? 'from ' + dl(b.from) + ' to ' + dl(b.to) : 'one day') : ({once: 'once', daily: 'every day', weekdays: 'weekdays', days: (b.days || []).map(w => WD[w]).join(', ')})[b.rep]],
        ['Busy', b.busy ? 'yes · no sessions then' : 'no'], ['Shared', b.all ? ({sub: 'with that subject\'s tutor', all: 'with all your tutors', none: 'no one'})[b.sh] : b.sh === 'busy' ? 'tutors and LHQ see "Busy"' : 'no one'],
        ...(b.all ? [['Countdown on Home', b.cd ? 'yes' : 'no']] : [['Reminders', (b.rem || [0]).map(m => m ? m + ' min before' : 'at the start').join(', ')]])].map(r => `<div class="it"><span class="t">${r[0]}</span><b>${esc(r[1])}</b></div>`).join('')}</div>
        ${o ? `<div class="card pad sp-ovc"><b>Overlaps ${esc(o.n)} ${o.s}–${o.e}</b><p class="note" style="margin:2px 0 0">LHQ session 🔒 · tell LHQ in Can't come if you'll miss it</p></div>` : ''}`; }
    const P = autoPlan(k, d).filter(x => x.blk === b.id), dn = rd('lhq_steps', {}), key = i => d + '|' + b.id + '|' + i;
    const S = (k.sras || []);
    return head + `<div class="card">${P.map((x, i) => { const s = x.kind === 'sra' ? S.find(y => y.id === x.ref) : null;
      return `<div class="it"><span class="t"><b>${esc(x.label.replace(/^ARS \+ SRA: /, ''))}</b><small>${x.s}–${x.e}${x.sub ? ' · ' + esc(x.sub) : ''}${x.kind === 'sra' ? ' · ARS first, then the SRA' : ''}</small></span>${s && window.FAM ? FAM.steps(s) : `<button class="sp-tk ${dn[key(i)] ? 'on' : ''}" data-sptk="${key(i)}" aria-label="Done">${dn[key(i)] ? '✓' : ''}</button>`}</div>`; }).join('') || '<p class="empty">Nothing due. Use it for revision of your choice.</p>'}</div>
      ${P.length ? (f => f ? `<a class="btn n full" href="#me/focus/${f.kind === 'sra' ? encodeURIComponent(f.ref) : 'blk:' + b.id}">Start focus · ${esc(f.label.replace(/^ARS \+ SRA: |^Focus: /, ''))}</a>` : '')(P.find((x, i) => x.kind !== 'wrap' && !(x.kind === 'sra' ? (S.find(y => y.id === x.ref) || {}).done : dn[key(i)]))) : ''}
      <p class="note" style="margin-top:8px">Chosen by your SRA tracker. Ticks here are the same as in Practice.</p>`;
  }

  /* ---------- My week ---------- */
  function week(k, mon){
    mon = /^\d{4}-\d{2}-\d{2}$/.test(mon || '') ? monOf(mon) : monOf(T());
    const H0 = 6, H1 = 22, PX = 18, top = t => (mins(t) / 60 - H0) * PX, D7 = Array.from({length: 7}, (_, i) => add(mon, i));
    const all = D7.map(d => ({d, S: sessionsOn(k, d), B: blocksOn(k, d), D: datesOn(k, d)}));
    const tot = f => all.reduce((a, x) => a + x.B.filter(f).reduce((s, b) => s + mins(b.e) - mins(b.s), 0), 0);
    return `<a class="crumb" href="#me/calendar">‹ Calendar</a><div class="ph"><div class="tt"><h1>My week</h1><p>${dl(mon)} – ${dl(add(mon, 6))}</p></div><div class="acts"><a class="btn sm" href="#me/week/${add(mon, -7)}">‹</a><a class="btn sm" href="#me/week/${add(mon, 7)}">›</a></div></div>
      ${views('week', mon)}
      <div class="sp-wg"><div class="sp-tc">${Array.from({length: (H1 - H0) / 2}, (_, i) => `<span style="top:${i * 2 * PX}px">${String(H0 + i * 2).padStart(2, '0')}</span>`).join('')}</div>
        ${all.map(x => `<a class="sp-col" href="#me/day/${x.d}"><b class="${x.D.some(b => b.busy) ? 'bz' : ''} ${x.d === T() ? 'td' : ''}">${WD[wdOf(x.d)][0]}<small>${+x.d.slice(8)}</small></b><span style="height:${(H1 - H0) * PX}px">
          ${x.B.map(b => `<i class="k-${b.type}" style="top:${Math.max(0, top(b.s))}px;height:${Math.max(4, (mins(b.e) - mins(b.s)) / 60 * PX - 1)}px"></i>`).join('')}
          ${x.S.map(s => `<i class="k-l${x.B.some(b => b.busy && mins(b.s) < mins(s.e) && mins(s.s) < mins(b.e)) ? ' ov' : ''}" style="top:${Math.max(0, top(s.s))}px;height:${Math.max(4, (mins(s.e) - mins(s.s)) / 60 * PX - 1)}px"></i>`).join('')}
          ${x.D.length ? `<em class="${x.D.some(b => b.busy) ? 'bz' : ''}">★</em>` : ''}</span></a>`).join('')}</div>
      <div class="sp-lg"><span><i class="k-l"></i>LHQ 🔒</span><span><i class="k-study"></i>Study</span><span><i class="k-act"></i>Activity</span><span><i class="k-school"></i>School</span><span><i class="k-rest"></i>Rest</span><span>★ date</span></div>
      <div class="mcs sp-mcs">${[['tS', 'Study', dur(tot(b => b.type === 'study' || b.type === 'rev'))], ['tA', 'Activities', dur(tot(b => b.type === 'act'))], ['tL', 'LHQ', all.reduce((a, x) => a + x.S.length, 0)]].map(([id, l, v]) => `<button type="button" class="mc" data-spw="${id}|${mon}"><span class="l">${l}</span><span class="v">${v}<span class="mca">›</span></span></button>`).join('')}</div>
      <div class="row" style="gap:8px"><button class="btn n" style="flex:1" data-spnew="${T() >= mon && T() <= add(mon, 6) ? T() : mon}">+ Add</button><button class="btn" style="flex:1" data-spcopy="${mon}">Copy a day</button></div>
      <button class="btn full" style="margin-top:8px" data-spsug="${mon}">Suggested week</button>`;
  }
  function weekSheet(k, id, mon){
    const D7 = Array.from({length: 7}, (_, i) => add(mon, i)), rows = [];
    D7.forEach(d => { if(id === 'tL') sessionsOn(k, d).forEach(s => rows.push([s.n, dl(d), s.s + '–' + s.e]));
      else blocksOn(k, d).filter(b => id === 'tS' ? b.type === 'study' || b.type === 'rev' : b.type === 'act').forEach(b => rows.push([b.name || tyL(b), dl(d), b.s + '–' + b.e])); });
    openSheet(`<div class="hx"><h3>${({tS: 'Study', tA: 'Activities', tL: 'LHQ sessions'})[id]}</h3><button class="ib" data-close>✕</button></div><p class="sp">${dl(mon)} – ${dl(add(mon, 6))}</p><div class="card">${rows.map(r => `<div class="it"><span class="t"><b>${esc(r[0])}</b><small>${r[1]}</small></span><b>${r[2]}</b></div>`).join('') || '<p class="empty">None.</p>'}</div>`);
  }
  function copySheet(k, mon){
    const D7 = Array.from({length: 7}, (_, i) => add(mon, i)); let from = D7.find(d => blocksOn(k, d).some(b => b.rep === 'once')) || D7[0], to = [];
    const draw = () => { const once = blocksOn(k, from).filter(b => b.rep === 'once');
      openSheet(`<div class="hx"><h3>Copy a day</h3><button class="ib" data-close>✕</button></div><div class="cap">From</div><div class="sp-days">${D7.map(d => `<button class="${d === from ? 'on' : ''}" data-cpf="${d}">${WD[wdOf(d)]}<small>${+d.slice(8)}</small></button>`).join('')}</div>
        <p class="note">${once.length ? once.map(b => esc(b.name || tyL(b)) + ' ' + b.s).join(' · ') : 'No one-off blocks that day. Repeating blocks already repeat.'}</p>
        <div class="cap">To</div><div class="sp-days">${D7.filter(d => d !== from).map(d => `<button class="${to.includes(d) ? 'on' : ''}" data-cpt="${d}">${WD[wdOf(d)]}<small>${+d.slice(8)}</small></button>`).join('')}</div>
        <button class="btn n full" data-cpgo ${once.length && to.length ? '' : 'disabled'}>Copy ${once.length} block${once.length === 1 ? '' : 's'}</button>`);
      document.querySelectorAll('[data-cpf]').forEach(b => b.onclick = () => { from = b.dataset.cpf; to = to.filter(d => d !== from); draw(); });
      document.querySelectorAll('[data-cpt]').forEach(b => b.onclick = () => { const d = b.dataset.cpt; to = to.includes(d) ? to.filter(x => x !== d) : to.concat([d]); draw(); });
      const go = document.querySelector('[data-cpgo]'); if(go) go.onclick = async () => { try{ for(const d of to) for(const b of once) await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'block', block: Object.assign({}, b, {id: '', from: d})})}); closeSheet(); if(window.FAM && FAM.refresh) await FAM.refresh(); toast('Copied'); render(); }catch(e){ toast(e.message); } }; };
    draw();
  }
  /* suggested weeks, built around LHQ sessions and school: repeating blocks from this Monday */
  function suggest(k, mon, kind){
    const busyAt = (w, s, e) => { const d = add(mon, (w + 6) % 7); return sessionsOn(k, d).concat(blocksOn(k, d).map(b => ({s: b.s, e: b.e}))).some(x => mins(x.s) < mins(e) && mins(s) < mins(x.e)); };
    const T0 = {term: [[1,'19:00','20:00','rev','Revision'],[2,'19:00','20:00','rev','Revision'],[3,'19:00','21:00','study','Study'],[4,'19:00','20:00','rev','Revision'],[5,'19:00','21:00','rest','Rest'],[6,'11:00','13:00','study','Study'],[0,'17:00','17:30','other','Plan the week']],
      exam: [[1,'09:00','11:00','study','Past paper'],[2,'09:00','11:00','study','Past paper'],[3,'09:00','11:00','study','Study'],[4,'09:00','11:00','study','Past paper'],[5,'09:00','11:00','study','Study'],[1,'15:00','16:00','rev','Revision'],[3,'15:00','16:00','rev','Revision'],[6,'10:00','11:00','rev','Mixed review'],[0,'17:00','17:30','other','Plan the week']],
      hol: [[1,'10:00','11:00','rev','Revision'],[3,'10:00','11:00','rev','Revision'],[5,'10:00','11:00','rev','Revision'],[6,'10:00','12:00','rest','Rest']]}[kind];
    return T0.map(([w, s, e, type, name]) => { let a = mins(s), z = mins(e); for(let i = 0; i < 6 && busyAt(w, hm(a), hm(z)); i++){ a += 60; z += 60; } return {w, s: hm(a), e: hm(z), type, name}; }).filter(x => mins(x.e) <= 22 * 60);
  }
  function sugSheet(k, mon){
    let kind = 'term';
    const draw = () => { const L = suggest(k, mon, kind), D = [1, 2, 3, 4, 5, 6, 0];
      openSheet(`<div class="hx"><h3>Suggested week</h3><button class="ib" data-close>✕</button></div><p class="sp">Built around your LHQ sessions · repeats from ${dl(mon)}</p>
        <div class="seg" style="display:flex;margin-bottom:10px">${[['term','School term'],['exam','Exam season'],['hol','Holiday']].map(([v, l]) => `<button style="flex:1" class="${kind === v ? 'on' : ''}" data-sgk="${v}">${l}</button>`).join('')}</div>
        <div class="card">${D.map(w => { const S = sessionsOn(k, add(mon, (w + 6) % 7)), B = L.filter(x => x.w === w); return `<div class="it"><span class="sp-dy"><b>${WD[w]}</b></span><span class="t"><small>${S.map(s => s.s + ' ' + esc(s.n) + ' 🔒').join(' · ') || '–'}</small><b style="font-weight:700">${B.map(b => `${b.s} ${esc(b.name)} ${dur(mins(b.e) - mins(b.s))}`).join(' · ') || '–'}</b></span></div>`; }).join('')}</div>
        <button class="btn n full" data-sggo>Add these blocks</button><p class="note" style="margin-top:8px">Change or delete any of them after.</p>`);
      document.querySelectorAll('[data-sgk]').forEach(b => b.onclick = () => { kind = b.dataset.sgk; draw(); });
      document.querySelector('[data-sggo]').onclick = async () => { try{ for(const x of L) await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'block', block: {name: x.name, type: x.type, s: x.s, e: x.e, rep: 'days', days: [x.w], from: mon, rem: [0], foc: x.type === 'study' ? 1 : 0}})}); closeSheet(); if(window.FAM && FAM.refresh) await FAM.refresh(); toast('Added'); render(); }catch(e){ toast(e.message); } }; };
    draw();
  }

  /* ---------- Year ---------- */
  function year(k, d){
    d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : T();
    const y0 = +d.slice(5, 7) >= 9 ? +d.slice(0, 4) : +d.slice(0, 4) - 1, M = Array.from({length: 12}, (_, i) => { const m = (8 + i) % 12; return [i < 4 ? y0 : y0 + 1, m]; });
    const mark = {}; const put = (dd, c, l) => { (mark[dd] = mark[dd] || []).push([c, l]); };
    (window.FAM ? FAM.comingOf(k) : []).forEach(a => put(a.d, 'a', ((window.MARKS ? MARKS.TY[MARKS.akN(a.ak)] : '') || 'Assessment') + ' · ' + a.sub));
    (k.subjects || []).forEach(x => { const i = window.EXUI && k.exam ? EXUI.info(x.k, k.exam, []) : null; ((i && i.papers) || (i && i.first ? [i.first] : [])).forEach(p => put(p.a || p.d, 'x', (p.code || x.sub) + (p.n ? ' · ' + p.n : ''))); });
    plan(k).filter(b => b.all).forEach(b => { for(let dd = b.from; dd <= (b.to || b.from); dd = add(dd, 1)) put(dd, b.type === 'hol' ? 'h' : b.type === 'school' ? 's' : 'o', b.name); });
    if(window.MIN && MIN.terms) MIN.terms().forEach(t => { if(t[1]) put(t[1], 's', t[0] + ' starts'); });
    const mini = ([y, m], i) => { const f = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      return `<button type="button" class="sp-mm" data-spym="${y}-${String(m + 1).padStart(2, '0')}"><b>${MON[m]}${m === 0 || i === 0 ? ' ' + y : ''}</b><span class="sp-mg">${'<i></i>'.repeat(f)}${Array.from({length: n}, (_, j) => { const dd = `${y}-${String(m + 1).padStart(2, '0')}-${String(j + 1).padStart(2, '0')}`, c = (mark[dd] || [])[0]; return `<i class="${c ? 'y' + c[0] : ''}${dd === T() ? ' td' : ''}"></i>`; }).join('')}</span></button>`; };
    year.mark = mark;
    return `<a class="crumb" href="#me/calendar">‹ Calendar</a><div class="ph"><div class="tt"><h1>${y0}–${String(y0 + 1).slice(2)}</h1><p>September to August</p></div><div class="acts"><a class="btn sm" href="#me/year/${y0 - 1}-09-01">‹</a><a class="btn sm" href="#me/year/${y0 + 1}-09-01">›</a></div></div>
      ${views('year', d)}<div class="sp-yr">${M.map(mini).join('')}</div>
      <div class="sp-lg"><span><i class="yx"></i>Exam paper</span><span><i class="ya"></i>Assessment</span><span><i class="ys"></i>School</span><span><i class="yo"></i>Your date</span><span><i class="yh"></i>Holiday</span></div>`;
  }
  function monthSheet(ym){
    const M = year.mark || {}, L = Object.keys(M).filter(d => d.slice(0, 7) === ym).sort();
    openSheet(`<div class="hx"><h3>${MONL[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</h3><button class="ib" data-close>✕</button></div><div class="card">${L.flatMap(d => M[d].map(([c, l]) => `<a class="it" href="#me/day/${d}"><span class="t"><b>${esc(l)}</b><small>${dl(d)} · ${({x: 'Exam paper', a: 'Assessment', s: 'School', o: 'Your date', h: 'Holiday'})[c]}</small></span><span class="chev">›</span></a>`)).join('') || '<p class="empty">Nothing this month.</p>'}</div>
      <a class="btn full" href="#me/calendar/${ym}">Open the month</a>`);
    document.querySelectorAll('#sheet a').forEach(a => a.addEventListener('click', () => closeSheet()));
  }

  /* ---------- add or change: at a time, or all day ---------- */
  function editSheet(k, id, d){
    const old = id ? plan(k).find(x => x.id === id) : null;
    const b = old ? JSON.parse(JSON.stringify(old)) : {id: '', all: 0, name: '', type: 'study', sub: '', s: '19:00', e: '20:00', rep: 'once', days: [], from: d || T(), until: '', to: '', busy: 0, sh: 'busy', rem: [0], foc: 1, cd: 0};
    const subs = (k.subjects || []).map(x => x.sub);
    const draw = () => { const o = !b.all && b.s && b.e && b.e > b.s ? overlap(k, b.from, b) : null;
      openSheet(`<div class="hx"><h3>${old ? 'Change' : 'Add'}</h3><button class="ib" data-close>✕</button></div>
        <div class="seg" style="display:flex;margin-bottom:12px">${[[0, 'At a time'], [1, 'All day']].map(([v, l]) => `<button style="flex:1" class="${+!!b.all === v ? 'on' : ''}" data-ea="${v}">${l}</button>`).join('')}</div>
        <label class="f"><span>Name</span><input class="in" id="ebN" value="${esc(b.name)}" placeholder="${b.all ? 'e.g. School sports day' : 'e.g. Swimming'}"></label>
        <div class="sp-opts">${(b.all ? DT : BT).map(([v, l]) => `<button type="button" class="${b.type === v ? 'on' : ''}" data-et="${v}">${l}</button>`).join('')}</div>
        <label class="f"><span>Subject (optional)</span><select class="in" id="ebS"><option value="">–</option>${subs.map(x => `<option ${b.sub === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        ${b.all ? `<div class="r2"><label class="f"><span>From</span><input class="in" type="date" id="ebF" value="${esc(b.from)}"></label><label class="f"><span>To (optional)</span><input class="in" type="date" id="ebT" value="${esc(b.to || '')}"></label></div>`
          : `<div class="r2"><label class="f"><span>Start</span><input class="in" type="time" id="ebA" value="${esc(b.s)}"></label><label class="f"><span>End</span><input class="in" type="time" id="ebB" value="${esc(b.e)}"></label></div>
          <div class="r2"><label class="f"><span>Repeat</span><select class="in" id="ebR">${[['once','Once'],['daily','Every day'],['weekdays','Weekdays'],['days','Chosen days']].map(([v, l]) => `<option value="${v}" ${b.rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="f"><span>${b.rep === 'once' ? 'On' : 'From'}</span><input class="in" type="date" id="ebF" value="${esc(b.from)}"></label></div>
          ${b.rep === 'days' ? `<div class="sp-days">${[1, 2, 3, 4, 5, 6, 0].map(w => `<button type="button" class="${(b.days || []).includes(w) ? 'on' : ''}" data-ed="${w}">${WD[w]}</button>`).join('')}</div>` : ''}
          ${b.rep !== 'once' ? `<label class="f"><span>Until (optional)</span><input class="in" type="date" id="ebU" value="${esc(b.until || '')}"></label>` : ''}
          <div class="cap">Remind me</div><div class="sp-opts">${[[0, 'At the start'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '1 h']].map(([v, l]) => `<button type="button" class="${(b.rem || []).includes(v) ? 'on' : ''}" data-er="${v}">${(b.rem || []).includes(v) ? '✓ ' : ''}${l}</button>`).join('')}</div>`}
        <div class="card">${!b.all && (b.type === 'study' || b.type === 'rev') ? `<div class="it"><span class="t"><b>Start the focus timer</b><small>When the block begins</small></span>${sw(b.foc, 'foc')}</div>` : ''}
          <div class="it"><span class="t"><b>Busy</b><small>No sessions then</small></span>${sw(b.busy, 'busy')}</div>
          ${b.all ? `<div class="it"><span class="t"><b>Countdown on Home</b></span>${sw(b.cd, 'cd')}</div>` : `<div class="it"><span class="t"><b>Tell my tutors and LHQ</b><small>Shown as "Busy", not the name</small></span>${sw(b.busy && b.sh === 'busy', 'sh')}</div>`}</div>
        ${b.all ? `<div class="cap">Share with</div><div class="card">${[['sub', b.sub ? `Your ${esc(b.sub)} tutor` : 'That subject\'s tutor (choose a subject)'], ['all', 'All your tutors'], ['none', 'No one']].map(([v, l]) => `<div class="opt ${b.sh === v ? 'on' : ''}" data-es="${v}"><span class="rad"></span><span class="t">${l}</span></div>`).join('')}</div>` : ''}
        ${o ? `<div class="card pad sp-ovc"><b>Overlaps ${esc(o.n)} ${o.s}–${o.e}</b><p class="note" style="margin:2px 0 0">${dl(b.from)} · LHQ session 🔒</p></div>` : ''}
        <button class="btn n full" id="ebGo">Save</button>${old ? '<button class="btn rd full" id="ebDel" style="margin-top:8px">Delete</button>' : ''}`);
      const keep = () => { b.name = $('ebN').value; b.sub = $('ebS').value; if($('ebF')) b.from = $('ebF').value || b.from; if($('ebT')) b.to = $('ebT').value; if($('ebA')) b.s = $('ebA').value; if($('ebB')) b.e = $('ebB').value; if($('ebU')) b.until = $('ebU').value; };
      const on = (sel, f) => document.querySelectorAll(sel).forEach(x => x.onclick = () => { keep(); f(x); draw(); });
      on('[data-ea]', x => { b.all = +x.dataset.ea; b.type = b.all ? 'school' : 'study'; b.sh = b.all ? 'all' : 'busy'; b.busy = b.all ? 0 : b.busy; });
      on('[data-et]', x => { b.type = x.dataset.et; if(!b.all && b.type === 'act') b.busy = 1; });
      on('[data-ed]', x => { const w = +x.dataset.ed; b.days = (b.days || []).includes(w) ? b.days.filter(y => y !== w) : (b.days || []).concat([w]); });
      on('[data-er]', x => { const v = +x.dataset.er; b.rem = (b.rem || []).includes(v) ? b.rem.filter(y => y !== v) : (b.rem || []).concat([v]); });
      on('[data-es]', x => { b.sh = x.dataset.es; });
      on('[data-esw]', x => { const f = x.dataset.esw; if(f === 'sh') b.sh = b.sh === 'busy' ? 'none' : 'busy'; else b[f] = b[f] ? 0 : 1; if(f === 'busy' && !b.busy && !b.all) b.sh = 'none'; });
      if($('ebR')) $('ebR').onchange = () => { keep(); b.rep = $('ebR').value; draw(); };
      ['ebA', 'ebB', 'ebF'].forEach(i => { if($(i)) $(i).onchange = () => { keep(); draw(); }; });
      $('ebGo').onclick = async () => { keep(); if(!b.name && b.all) return toast('Give it a name'); if(b.all && b.sh === 'sub' && !b.sub) return toast('Choose the subject');
        try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'block', block: b})}); closeSheet(); if(window.FAM && FAM.refresh) await FAM.refresh(); toast(b.busy && (b.all ? b.sh !== 'none' : b.sh === 'busy') ? 'Saved · tutors and LHQ see "Busy"' : 'Saved'); render(); }catch(e){ toast(e.message); } };
      if($('ebDel')) $('ebDel').onclick = async () => { try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'unblock', id: b.id})}); closeSheet(); if(window.FAM && FAM.refresh) await FAM.refresh(); toast('Deleted'); location.hash = '#me/day/' + (d || T()); render(); }catch(e){ toast(e.message); } }; };
    draw();
  }
  const sw = (on, f) => `<button type="button" class="sp-sw ${on ? 'on' : ''}" data-esw="${f}" aria-label="On or off"><i></i></button>`;

  /* ---------- for the month calendar and Home ---------- */
  const monthRows = (k, d, all) => plan(k).filter(b => blockOn(b, d) && !!b.all === !!all).sort((a, b) => (a.all ? '' : a.s).localeCompare(b.all ? '' : b.s)).map(b => `<a class="it" href="#me/blk/${b.id}/${d}"><span class="cal-t">${b.all ? '★' : b.s}</span><span class="t"><b>${esc(b.name || tyL(b))}</b><small>${esc(tyL(b))}${b.all ? ' · all day' : ' · ' + b.s + '–' + b.e}${b.busy ? ' · busy' : ''}</small></span><span class="chev">›</span></a>`).join('');
  const hasOwn = (k, d) => plan(k).some(b => blockOn(b, d));
  function countdowns(k){
    const t = T(), L = [];
    (k.subjects || []).forEach(x => { const i = window.EXUI && k.exam ? EXUI.info(x.k, k.exam, []) : null; if(i && i.first && i.days >= 0) L.push({n: x.sub, s: (i.first.code || '') + ' · first paper', d: i.first.a, days: i.days}); });
    plan(k).filter(b => b.all && b.cd && b.from >= t).forEach(b => L.push({n: b.name, s: (DT.find(x => x[0] === b.type) || ['', ''])[1], d: b.from, days: Math.round((Date.parse(b.from) - Date.parse(t)) / 864e5)}));
    return L.sort((a, b) => a.days - b.days);
  }

  /* ---------- styles and taps ---------- */
  const CSS = `.sp-vw{display:flex;margin-bottom:12px}.sp-vw a{flex:1;text-align:center;text-decoration:none}.sp-lnk{border:0;background:none;color:var(--accent);font-weight:800;font-size:12.5px;cursor:pointer;padding:0;text-transform:none;letter-spacing:0;font-family:inherit}
.sp-tl{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center;padding:6px 0;border-top:1px solid var(--line2)}.sp-tl:first-child{border-top:0}.sp-tl>span{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;line-height:1.25}
.sp-tl>div{border-left:4px solid var(--line);padding:5px 10px;border-radius:7px;background:var(--surface2);min-width:0}.sp-tl>div[data-spgo],.sp-tl>div[data-sped]{cursor:pointer}.sp-tl>div[data-spgo]:hover,.sp-tl>div[data-sped]:hover{background:var(--hover)}.sp-tl small{display:block;color:var(--muted);font-size:12px}
.sp-tl.l>div{border-color:var(--accent)}.sp-tl.k-study>div,.sp-tl.k-rev>div{border-color:var(--ok)}.sp-tl.k-act>div{border-color:var(--gold)}.sp-tl.k-school>div{border-color:#9aa6b8}.sp-tl.k-rest>div{border-color:#b9a6ea}.sp-tl.ov>div{box-shadow:inset 0 0 0 1.5px var(--rd)}.sp-tl.sg>div{border-left-style:dashed;border-color:var(--ok);background:var(--ok-bg)}
.sp-red{color:var(--rd);font-weight:700}.sp-ovc{border-color:var(--rd)!important}.sp-ovc b{color:var(--rd)}.sp-star{width:28px;text-align:center;color:var(--gold);font-size:18px}.sp-star.bz{color:var(--rd)}
.sp-stp{display:grid;grid-template-columns:1fr auto 64px auto;gap:10px;align-items:center;padding:4px 0}.sp-stp b{text-align:center;font-variant-numeric:tabular-nums}
.sp-tk{width:30px;height:30px;border-radius:50%;border:2px solid var(--line);background:var(--surface);flex:none;cursor:pointer;color:#fff;font-weight:900}.sp-tk.on{background:var(--ok);border-color:var(--ok)}
.sp-opts{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.sp-opts button,.sp-days button{border:1.5px solid var(--line);background:var(--surface);border-radius:12px;padding:7px 11px;font-weight:700;cursor:pointer;color:var(--ink);font-family:inherit}.sp-opts button.on,.sp-days button.on{border-color:var(--accent);background:var(--accent);color:var(--onaccent)}
.sp-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:12px}.sp-days button{padding:6px 0;font-size:12px}.sp-days small{display:block;font-size:10.5px;opacity:.8}
.sp-sw{width:46px;height:28px;border-radius:99px;border:0;background:var(--line);position:relative;cursor:pointer;flex:none}.sp-sw i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .15s}.sp-sw.on{background:var(--ok)}.sp-sw.on i{left:21px}
.sp-wg{display:grid;grid-template-columns:22px repeat(7,minmax(0,1fr));gap:3px;margin-bottom:8px}.sp-tc{position:relative;margin-top:36px}.sp-tc span{position:absolute;font-size:9.5px;color:var(--muted)}
.sp-col{text-decoration:none;color:inherit;border-radius:8px;min-width:0}.sp-col:hover{background:var(--hover)}.sp-col b{display:block;text-align:center;font-size:12px;height:36px}.sp-col b small{display:block;font-size:10.5px;color:var(--muted)}.sp-col b.bz{color:var(--rd)}.sp-col b.td small{color:var(--accent);font-weight:800}
.sp-col>span{display:block;position:relative;background:var(--surface);border:1px solid var(--line2);border-radius:6px}.sp-col i{position:absolute;left:2px;right:2px;border-radius:3px}.sp-col em{position:absolute;top:-1px;right:2px;font-style:normal;font-size:10px;color:var(--gold)}.sp-col em.bz{color:var(--rd)}
i.k-l,.sp-lg i.k-l{background:var(--accent);z-index:2}i.k-l.ov{box-shadow:0 0 0 2px var(--rd)}i.k-study,i.k-rev{background:var(--ok)}i.k-act{background:var(--gold)}i.k-school{background:#9aa6b8}i.k-rest{background:#c7b8f0}i.k-other{background:var(--muted)}
.sp-lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11.5px;color:var(--muted);margin:4px 2px 12px}.sp-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px;position:static}
.sp-mcs{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:12px}.sp-mcs .mc{cursor:pointer;font:inherit;color:inherit;text-align:left}.sp-mcs .mc:hover{border-color:var(--muted)}
.sp-yr{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px}@media(min-width:700px){.sp-yr{grid-template-columns:repeat(4,minmax(0,1fr))}}.sp-mm{border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:7px;cursor:pointer;text-align:left;color:inherit;font:inherit;min-width:0}.sp-mm:hover{border-color:var(--muted)}.sp-mm b{font-size:12px}
.sp-mg{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:4px}.sp-mg i{aspect-ratio:1;border-radius:2px;background:var(--line2)}.sp-mg i.td{box-shadow:0 0 0 1.5px var(--ink)}
i.yx,.sp-mg i.yx{background:var(--rd)}i.ya,.sp-mg i.ya{background:var(--accent)}i.ys,.sp-mg i.ys{background:#7c8ba1}i.yo,.sp-mg i.yo{background:var(--gold)}i.yh,.sp-mg i.yh{background:var(--ok)}
.sp-dy{width:40px;flex:none}`;
  let cssOn = false; const css = () => { if(!cssOn){ cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); } };
  function bind(k){
    if(!k) return; css();
    const on = (sel, f) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); f(el); });
    on('[data-spgo]', el => { location.hash = el.dataset.spgo; });
    on('[data-spplan]', el => { PM = {d: el.dataset.spplan, items: autoPlan(k, el.dataset.spplan)}; render(); });
    on('[data-spclear]', () => { PM = null; render(); });
    on('[data-sped]', el => edSheet(k, +el.dataset.sped));
    on('[data-sprules]', rulesSheet);
    on('[data-spadd]', async () => { const L = PM.items.filter(x => !x.blk);
      try{ for(const x of L) await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'block', block: {name: x.label, type: x.kind === 'fade' || x.kind === 'as' ? 'rev' : 'study', sub: x.sub || '', s: x.s, e: x.e, rep: 'once', from: PM.d, rem: [0], foc: x.kind === 'wrap' ? 0 : 1}})});
        PM = null; if(window.FAM && FAM.refresh) await FAM.refresh(); toast(`Added ${L.length} block${L.length === 1 ? '' : 's'}`); render(); }catch(e){ toast(e.message); } });
    on('[data-spnew]', el => editSheet(k, '', el.dataset.spnew));
    on('[data-spedit]', el => editSheet(k, el.dataset.spedit, (location.hash.split('/')[3] || T())));
    on('[data-sptk]', el => { const D = rd('lhq_steps', {}), id = el.dataset.sptk; if(D[id]) delete D[id]; else D[id] = Date.now(); wr('lhq_steps', D); render(); });
    on('[data-spw]', el => { const [id, mon] = el.dataset.spw.split('|'); weekSheet(k, id, mon); });
    on('[data-spcopy]', el => copySheet(k, el.dataset.spcopy));
    on('[data-spsug]', el => sugSheet(k, el.dataset.spsug));
    on('[data-spym]', el => monthSheet(el.dataset.spym));
  }
  /* routes: day, week, year, blk; snooze from a notification */
  function page(k, sub0, a1, a2, a3){
    css();
    if(sub0 === 'day') return day(k, a1);
    if(sub0 === 'week') return week(k, a1);
    if(sub0 === 'year') return year(k, a1);
    if(sub0 === 'blk') return block(k, a1, a2);
    if(sub0 === 'snooze'){ hub.api('family', {method: 'POST', body: JSON.stringify({action: 'snooze', id: a1, m: +a2 || 10})}).then(r => toast(`Reminder in ${r.m} min`)).catch(e => toast(e.message)); setTimeout(() => { location.hash = '#me/day'; }, 50); return '<p class="empty">Snoozed.</p>'; }
    return '';
  }
  return {page, bind, monthRows, hasOwn, countdowns, autoPlan, blockOn, editSheet, css, dl};
})();
