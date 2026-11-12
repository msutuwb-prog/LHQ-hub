/* LHQ Hub › students and parents (Stage 2). A student sees their sessions (and confirms them with ✓ or ✕), their SRAs,
   their timetable and progress; a parent sees each of their children, the same counts, and their payments.
   Everything comes from /api/hub/family, which sends only this person's own children. Rendered by index.html at #me…  */
window.FAM = (function(){
  const CK = 'lhq_family';
  const read = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  /* ARS then SRA: the ARS tick is a guide for the student (kept on this device); the tutor records the ARS score from the sheet */
  const arsDone = id => !!(read('lhq_arsdone', {})[id]);
  const steps = x => `<span class="f-2s"><button type="button" class="${arsDone(x.id) ? 'on' : ''}" data-fars="${esc(x.id)}" aria-label="ARS done"><i>✓</i>ARS</button><button type="button" class="${x.done ? 'on' : ''}" data-fdone="${esc(x.id)}" aria-label="SRA done"><i>✓</i>SRA</button></span>`;
  const DAYN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'};
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const P = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const day = s => s ? `${WD[P(s).getDay()]} ${P(s).getDate()} ${MON[P(s).getMonth()]}` : '';
  const dshort = s => s ? `${P(s).getDate()} ${MON[P(s).getMonth()]}` : '';
  const mk = n => 'MWK ' + Math.round(+n || 0).toLocaleString('en-US');
  const firstN = n => String(n || '').trim().split(/\s+/)[0];
  const DLI = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  let perSel = 'tp';
  const sub = n => String(n || '').replace(/^Mathematics$/i, 'Maths');
  /* students choose Lean (the essentials; new students start here) or Full (cards, focus, habits, reviews, planning, school results) */
  const full = () => isParent() || ((((window.hub && hub.session && hub.session()) || {}).me || {}).view === 'full');
  /* Lean with features added one at a time (✎ on Home); Full is every feature on; parents always see everything */
  const FEAT = [['cards','Home cards','SRAs this week, topics dropping, countdowns'],['focus','Focus timer','Rounds of 25 or 50 min, minutes recorded'],['plan','Plan my day','Day, My week and Year views, study blocks'],['habits','Habits','Effort against the period before'],['review','Review and reflection','Week, month, term; two lines a week']];
  const has = f => full() || !!((((((window.hub && hub.session && hub.session()) || {}).me) || {}).feat) || {})[f];
  const nAdded = () => FEAT.filter(([f]) => has(f)).length;
  let data = read(CK, null), loading = null, err = '', kidI = +(read('lhq_family_kid', 0)) || 0;

  if(!document.getElementById('famCss')){ const st = document.createElement('style'); st.id = 'famCss'; st.textContent = `
.f-ok,.f-no{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--surface);font-weight:900;font-size:16px;display:grid;place-items:center;padding:0;cursor:pointer}
.f-ok{background:var(--ok);border-color:var(--ok);color:#fff}.f-no{color:var(--rd)}
.f-mk{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;border:2px solid var(--line);color:transparent}
.f-mk.ok{background:var(--ok);border-color:var(--ok);color:#fff}.f-mk.am{border-color:var(--am);color:var(--am);background:var(--am-bg)}.f-mk.rd{background:var(--rd);border-color:var(--rd);color:#fff}.f-mk.bl{border-color:var(--bl);color:var(--bl);background:var(--bl-bg)}
.f-bar{display:block;height:8px;border-radius:5px;background:var(--line2);position:relative;margin:7px 0 2px}.f-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--ok)}.f-bar b{position:absolute;top:-3px;width:3px;height:14px;border-radius:2px;background:var(--ink)}
.f-n{float:right;font-weight:800}
.f-cal a span i.o{background:var(--ok)}
.f-dayl{font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none}
.f-kids{display:flex;gap:6px;overflow-x:auto;padding:2px 0 10px}
.f-kid{flex:none;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 12px;font:inherit;font-weight:700;font-size:13px;display:flex;align-items:center;gap:7px;cursor:pointer;color:var(--ink)}
.f-kid.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.f-av{width:22px;height:22px;border-radius:50%;background:var(--bl-bg);color:var(--bl);display:grid;place-items:center;font-size:11px;font-weight:800}
.f-tick{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;background:none;padding:0;font-weight:900;color:transparent;cursor:pointer}
.f-tick.on{background:var(--ok);border-color:var(--ok);color:#fff}
.f-dl{display:flex;align-items:center;justify-content:center;gap:8px}.f-per{display:flex!important;width:100%;margin-bottom:10px}.f-per button{flex:1;padding-left:6px!important;padding-right:6px!important}
.f-big{font-size:28px;font-weight:800;color:var(--brand);font-variant-numeric:tabular-nums}.f-sch{margin-top:10px;border-top:1px solid var(--line2);padding-top:6px}.f-sch .row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:13.5px}.f-dli{flex:none;color:var(--muted)}
.f-2s{display:flex;gap:6px;flex:none;align-items:center}.f-2s button{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 10px 0 6px;border-radius:17px;border:1.5px solid var(--line);background:var(--surface);color:var(--muted);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.f-2s button i{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-style:normal;font-size:11px;color:transparent}.f-2s button.on{color:var(--ok);border-color:var(--ok)}.f-2s button.on i{background:var(--ok);border-color:var(--ok);color:#fff}
.f-pk{display:flex;align-items:center;gap:14px;padding:12px 14px;color:var(--ink);text-decoration:none}.f-pk .t{flex:1;min-width:0}.f-pk .t b{display:block}.f-pk .t small{color:var(--muted);font-size:12.5px}.f-ring{flex:none}
.f-day{width:40px;flex:none;text-align:center;line-height:1.1}.f-day small{display:block;font-size:10.5px;font-weight:800;color:var(--muted);text-transform:uppercase}.f-day b{font-size:18px;color:var(--brand)}
.f-sm{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12.5px;color:var(--muted);font-weight:700}.f-sm .in{width:58px;min-height:34px;padding:4px 8px;text-align:center}
.it .t b.f-aty{display:flex;align-items:center;gap:6px}.f-aty svg{flex:none}
.f-told{color:var(--am);font-weight:800}.f-told.lt{color:var(--brand)}
.f-seg{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:10px}.f-seg button{border:0;background:var(--bg);padding:10px 6px;font:inherit;font-weight:800;color:var(--muted);cursor:pointer}.f-seg button.on{background:var(--accent);color:var(--onaccent,#fff)}.f-seg button:disabled{opacity:.4;cursor:default}
.f-g2,.f-g4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.f-g2 .f-opt,.f-g4 .f-opt{width:100%;margin:0}
.f-wa{display:flex;justify-content:center;background:#1f8f4e!important;border-color:#1f8f4e!important;color:#fff!important;text-decoration:none}
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
  /* exams: targets, On track and the student's papers (exams.js, examsui.js) */
  const nsub = v => String(v || '').trim().toLowerCase().replace(/^maths$/, 'mathematics');
  const exInfo = (k, x) => window.EXUI && k.exam ? EXUI.info(x.k, k.exam, ((k.marks || {}).w || []).filter(m => m.sub === x.sub)) : null;
  const choices = k => { if(!k || !k.exam || !window.EXAMS) return [];
    const L = k.subjects.map(x => { const i = exInfo(k, x); return i && i.c.code ? {code: i.c.code, ex: i.c.ex, as: i.c.as, lhq: 1} : null; }).filter(Boolean);
    ((k.exam.myexams || {})[k.key] || []).forEach(c => { if(!L.some(y => y.code === c.code && y.ex === c.ex)) L.push(Object.assign({removable: !isParent()}, c)); });
    return L; };
  function mineCtx(){ const k = kid(); if(!k || isParent()) return null;
    return {mine: ((k.exam && k.exam.myexams || {})[k.key] || []).slice(), lhq: choices(k).filter(c => c.lhq),
      save: async list => { await hub.api('exams', {method:'POST', body: JSON.stringify({action:'myexams', st: k.key, list})}); await fetchData(); }}; }
  /* LHQ's topical dates for the student's subjects, beside the tutors' assessments */
  const comingOf = k => { const t = T(), end = HD.isoOf(new Date(HD.parseISO(t).getTime() + 14 * 864e5)), L = (k.coming || []).slice();
    ((k.exam && k.exam.set && k.exam.set.topicals) || []).filter(x => x.d >= t && x.d <= end).forEach(x => { const s0 = k.subjects.find(y => nsub(y.sub) === nsub(x.sub) && (!x.ex || ((exInfo(k, y) || {c: {}}).c.ex || x.ex) === x.ex)); if(s0) L.push({d: x.d, s: '', sub: s0.sub, ak: x.ak || 'm', tp: x.tp ? [x.tp] : [], lhq: 1}); });
    return L.sort((a, b) => (a.d + (a.s || '')).localeCompare(b.d + (b.s || ''))); };
  const T = () => (data && data.today) || HD.today();

  /* ---------- pieces ---------- */
  function sesRow(x){
    const pct = x.planned ? Math.min(100, Math.round(x.had / x.planned * 100)) : 0, mark = x.planned ? Math.round(x.expected / x.planned * 100) : 0, behind = x.behind >= 2;
    return `<a class="it" href="#me/subject/${encodeURIComponent(x.k)}"><span class="f-mk ${behind ? 'am' : 'ok'}">${behind ? '!' : '✓'}</span><span class="t"><b>${esc(sub(x.sub))} <span class="f-n">${x.had}/${x.planned || '?'}</span></b>
      <span class="f-bar"><i style="width:${pct}%"></i><b style="left:${mark}%"></b></span>${x.owed ? `<small>${x.owed} owed</small>` : ''}</span><span class="chev">›</span></a>`;
  }
  const confirmRow = e => `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(sub(e.sub))} · ${day(e.d).split(' ')[0]} ${esc(e.t1 || '')}</b><small>${esc(e.tutor)} · ${Math.max(1, Math.round(e.left / 36e5))} h left to check</small></span>
    <button class="f-ok" data-fcf="yes:${esc(e.id)}" aria-label="Yes, it happened">✓</button><button class="f-no" data-fcf="no:${esc(e.id)}" aria-label="Not right">✕</button></div>`;
  const answerRow = e => `<div class="it" style="flex-wrap:wrap"><span class="f-mk am">!</span><span class="t"><b>${esc(firstN(e.tutor))}: “${esc(e.cf.tutorNote)}”</b><small>${esc(sub(e.sub))} · ${day(e.d)} · kept ${esc(e.t1)}–${esc(e.t2)}</small></span>
    <span class="acts" style="width:100%;margin:8px 0 0 34px"><button class="btn sm n" data-frep="ok:${esc(e.id)}">OK</button><button class="btn sm" data-frep="no:${esc(e.id)}">Still not right</button></span></div>`;
  const STL = {waiting:'Waiting', confirmed:'Confirmed', auto:'Confirmed itself', disputed:'Not right', settled:'Settled'};
  const stMark = e => !e.st ? `<span class="f-mk am">!</span>` : ['confirmed','auto','settled'].includes(e.st) ? '<span class="f-mk ok">✓</span>' : e.st === 'disputed' ? '<span class="f-mk rd">!</span>' : '<span class="f-mk"></span>';
  const stText = e => e.a === 'absent' ? 'Absent · owed' : e.a === 'cancelled' ? 'Cancelled · owed' : e.st === 'disputed' ? ({tutor:'With your tutor', student:'Your tutor answered', lhq:'With LHQ'}[e.cf && e.cf.step] || 'Not right') : e.st === 'settled' ? 'Settled' + (e.cf && e.cf.lost ? ` · ${e.cf.lost} min off` : '') : e.st === 'waiting' ? `${Math.max(1, Math.round(e.left / 36e5))} h` : (STL[e.st] || '');
  const kidChips = () => kids().length > 1 ? `<div class="f-kids">${kids().map((k, i) => `<button class="f-kid ${k === kid() ? 'on' : ''}" data-fkid="${i}"><span class="f-av">${esc(k.name[0])}</span>${esc(firstN(k.name))}</button>`).join('')}</div>` : '';

  /* ---------- absence and late notices: "Can't come" on a session that hasn't started ---------- */
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const tm = v => { const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const open4 = (x, late) => x.date > T() || (x.date === T() && tm(x.s) != null && tm(x.s) + (late ? 15 : 0) > nowMin());
  const toldL = n => n.kind === 'late' ? `About ${n.mins} min late` : `Absent · ${n.why.toLowerCase()}`;
  function sesTell(x){
    const n = x.told, can = open4(x, n && n.kind === 'late');
    return `<div class="it"><span class="cal-t">${esc(x.s)}<small>${esc(x.e)}</small></span><span class="t"><b>${esc(sub(x.sub))}${x.mu ? ' · make-up' : ''}</b><small>${n ? `<span class="f-told${n.kind === 'late' ? ' lt' : ''}">${esc(toldL(n))}</span>` : esc(x.tutor)}</small></span>
      ${n ? (can ? `<button class="btn sm" data-funtell="${esc(n.id)}">Undo</button>` : '') : open4(x, true) ? `<button class="btn sm" data-ftell="${esc(x.date)}|${esc(x.sub)}|${esc(x.s)}">Can't come</button>` : ''}</div>`;
  }
  let NT = null;
  function tellSheet(){
    const f = NT, started = !open4({date: f.d, s: f.s}, false);
    if(started && f.kind !== 'late') f.kind = 'late';
    const opt = (on, attr, l) => `<button class="f-opt ${on ? 'on' : ''}" ${attr}><span class="f-tick ${on ? 'on' : ''}">✓</span>${l}</button>`;
    openSheet(`<div class="hx"><h3>${esc(sub(f.sub))} · ${f.d === T() ? 'today' : day(f.d)} ${esc(f.s)}</h3><button class="ib" data-close>✕</button></div>
      <div class="f-seg">${[['abs','Absent'],['late','Late'],['days','A few days']].map(([k, l]) => `<button class="${f.kind === k ? 'on' : ''}" data-ftk="${k}" ${started && k !== 'late' ? 'disabled' : ''}>${l}</button>`).join('')}</div>
      ${f.kind === 'late' ? `<div class="f-g4">${[10,15,30,45].map(m => opt(f.mins === m, `data-ftm="${m}"`, m + ' min')).join('')}</div>`
        : `${f.kind === 'days' ? `<div class="r2" style="margin:10px 0 4px"><label class="f" style="margin:0"><span>From</span><input class="in" type="date" id="ftFrom" value="${f.from}" min="${T()}"></label><label class="f" style="margin:0"><span>To</span><input class="in" type="date" id="ftTo" value="${f.to}" min="${T()}"></label></div>` : ''}
          <div class="f-g2">${['Sick','School event','Travel','Other'].map(w => opt(f.why === w, `data-ftw="${esc(w)}"`, w)).join('')}</div>`}
      <label class="f" style="margin-top:10px"><span>Note</span><input class="in" id="ftNote" value="${esc(f.note)}" maxlength="300"></label>
      <button class="btn n full" id="ftSend" ${(f.kind === 'late' ? f.mins : f.why) ? '' : 'disabled'}>Send</button>`);
    document.querySelectorAll('[data-ftk]').forEach(b => b.onclick = () => { f.kind = b.dataset.ftk; tellSheet(); });
    document.querySelectorAll('[data-ftw]').forEach(b => b.onclick = () => { f.why = b.dataset.ftw; tellSheet(); });
    document.querySelectorAll('[data-ftm]').forEach(b => b.onclick = () => { f.mins = +b.dataset.ftm; tellSheet(); });
    const keep = () => { f.note = $('ftNote').value; if($('ftFrom')){ f.from = $('ftFrom').value; f.to = $('ftTo').value; } };
    $('ftNote').oninput = keep; if($('ftFrom')){ $('ftFrom').onchange = keep; $('ftTo').onchange = keep; }
    $('ftSend').onclick = async () => { keep(); $('ftSend').disabled = true; const k = kid();
      const body = f.kind === 'days' ? {action:'notice', st:k.key, kind:'abs', why:f.why, from:f.from, to:f.to, note:f.note}
        : {action:'notice', st:k.key, kind:f.kind, why:f.why, mins:f.mins, d:f.d, sub:f.sub, s:f.s, note:f.note};
      const j = await post(body, 'Sent'); if(!j){ $('ftSend') && ($('ftSend').disabled = false); return; }
      const soon = f.kind !== 'days' && f.d === T() && tm(f.s) != null && tm(f.s) - nowMin() < 120;
      if(soon && k.lhqPhone){ const msg = `Hello LHQ, this is ${me().name}${isParent() ? ` (${firstN(k.name)}'s parent)` : ''}. ${isParent() ? firstN(k.name) : 'I'} ${f.kind === 'late' ? `will be about ${f.mins} min late for` : "can't come to"} ${f.sub} today at ${f.s}${f.kind === 'abs' ? ` (${f.why.toLowerCase()})` : ''}.${f.note ? ' ' + f.note : ''}`;
        openSheet(`<div class="hx"><h3>Sent</h3><button class="ib" data-close>✕</button></div><a class="btn n full f-wa" href="https://wa.me/${k.lhqPhone}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" data-close>WhatsApp LHQ</a><button class="btn full" style="margin-top:8px" data-close>Done</button>`); }
      NT = null; };
  }

  /* ---------- pages ---------- */
  function home(){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), today = k.week.filter(s => s.date === t), sraIn = k.sras.filter(x => x.due === t || x.status === 'late');
    const need = (repDue(k) ? [`<a class="it" href="#me/report"><span class="f-mk am">!</span><span class="t"><b>Today's report</b><small>${esc(k.report.ses.map(x => sub(x.sub)).join(', '))} · 2 min</small></span><span class="chev">›</span></a>`] : []).concat(k.toConfirm.map(confirmRow)).concat(k.answers.map(answerRow), isParent() ? [] : sraIn.map(x => `<a class="it" href="#me/practice"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))} · hand in ${x.due === t ? 'today' : 'late'}</small></span><span class="chev">›</span></a>`),
      isParent() ? [] : packOf(k).filter(x => x.doOn === t && !x.done).map(x => `<a class="it" href="#me/practice/pack"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} R${x.stage} today</b><small>${esc(sub(x.sub))} · take-home pack</small></span><span class="chev">›</span></a>`));
    if(window.FUP) FUP.famL(k).filter(f => !f.a && !(f.act === 'take' && f.th) && (f.by === t || f.by === HD.addDays(t, 1) || f.by < t)).forEach(f => need.push(`<button type="button" class="it" data-ffu="${esc(f.id)}"><span class="f-mk ${f.by < t ? 'rd' : 'am'}">!</span><span class="t"><b>${({retest: 'Retest', reteach: 'Reteach', take: 'Take-home sheets'})[f.act]} ${f.by === t ? 'today' : f.by < t ? 'was due ' + day(f.by) : 'tomorrow'}: ${esc(f.tk)}</b><small>${esc(sub(f.sub))}${f.foc ? ' · focus: ' + esc(f.foc) : ''}</small></span><span class="chev">›</span></button>`));
    const pay = isParent() ? owedLine() : '';
    return `<div class="ph"><div class="tt"><h1>Hi ${esc(firstN(me().name))}</h1><p>${isParent() && kids().length === 1 ? esc(firstN(k.name)) + ' · ' : ''}${day(t)}</p></div>${isParent() ? '' : '<div class="acts"><button class="ib" type="button" data-ffeat aria-label="Your Hub">✎</button></div>'}</div>${kidChips()}
      ${need.length ? `<div class="h2">Needs you <em>${need.length}</em></div><div class="card" style="border-left:3px solid var(--gold)">${need.join('')}</div>` : ''}
      <div class="h2">Today</div><div class="card">${today.map(sesTell).join('') || '<p class="empty">No sessions today.</p>'}</div>${window.SX && has('cards') ? SX.homeCards(k) : ''}${!full() && !nAdded() ? moreAsk() : ''}
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
    const row = x => `<div class="it">${isParent() ? `<span class="f-mk ${x.done ? 'ok' : ''}">${x.done ? '✓' : ''}</span>` : ''}<span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))}${x.pack ? ' · take-home pack' : x.due ? ' · hand in ' + (x.due === t ? 'today' : day(x.due)) : ''}</small></span>${isParent() ? '' : steps(x)}</div>`;
    return `<div class="ph"><div class="tt"><h1>Practice</h1></div>${isParent() || !window.SX || !has('focus') ? '' : '<div class="acts"><a class="btn" href="#me/focus">Focus</a></div>'}</div>${kidChips()}${packCard(k)}
      <div class="h2">Do today</div><div class="card">${doT.map(row).join('') || '<p class="empty">Nothing today. ✓</p>'}</div>${window.FUP ? FUP.famCard(k) : ''}
      ${inT.length ? `<div class="h2">Hand in</div><div class="card">${inT.map(x => `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(x.topic)} ${x.stage ? 'R' + x.stage : 'LD'}</b><small>${esc(sub(x.sub))} · ${x.status === 'late' ? 'late' : 'today'}</small></span></div>`).join('')}</div>` : ''}
      ${out.length ? `<div class="h2">You have</div><div class="card">${out.map(row).join('')}</div>` : ''}
      ${comingOf(k).length ? `<div class="h2">Coming up <em>assessments</em></div><div class="card">${comingOf(k).map(a => `<div class="it"><span class="f-day"><small>${DAYN[['Su','Mo','Tu','We','Th','Fr','Sa'][HD.parseISO(a.d).getDay()]]}</small><b>${HD.parseISO(a.d).getDate()}</b></span><span class="t"><b class="f-aty">${window.MARKS ? MARKS.ico(a.ak) : ''}<span>${esc((window.MARKS ? MARKS.TY[a.ak] : '') || 'Assessment')} · ${esc(sub(a.sub))}</span></b><small>${[a.s, (a.tp || []).join(', '), a.lhq ? 'from LHQ' : ''].filter(Boolean).map(esc).join(' · ')}</small></span></div>`).join('')}</div>` : ''}`;
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
      <span class="t"><b>${esc(x.topic)} · R${x.stage}</b><small>${esc(sub(x.sub))}${x.from ? ` · was ${day(x.from)}` : ''}${x.status === 'in' && x.score ? ` · ${x.score.sc}/${x.score.mx}` : ''}</small>
      ${(x.done || x.doOn <= t) && x.status !== 'in' ? (isParent() ? (x.self ? `<small>${x.self.sc}/${x.self.mx} <span class="f-self">self-marked</span></small>` : '')
        : `<span class="f-sm"><span>Mark</span><input class="in" inputmode="decimal" value="${x.self ? esc(x.self.sc) : ''}" placeholder="–" data-fself="${esc(x.id)}" aria-label="Your mark"><span>/ ${x.self ? x.self.mx : 10}</span>${x.self ? '<span class="f-self">self-marked</span>' : ''}</span>`) : ''}</span>
      ${isParent() ? `<span class="f-mk ${x.done ? 'ok' : ''}">${x.done ? '✓' : ''}</span>` : steps(x)}</div>`;
    const today = P.filter(x => x.doOn === t), next = P.filter(x => x.doOn > t), past = P.filter(x => x.doOn < t);
    return `<div class="ph"><div class="tt"><h1>Take-home pack</h1></div></div>${kidChips()}
      <div class="card f-pk">${ring(n, P.length)}<span class="t"><b>${n} of ${P.length} done</b><small>Last one ${day(P[P.length - 1].doOn)} · ${subs.map(x => esc(sub(x))).join(', ')}</small></span></div>
      ${today.length ? `<div class="h2">Today</div><div class="card">${today.map(row).join('')}</div>` : ''}
      ${next.length ? `<div class="h2">Next <em>${next.length}</em></div><div class="card">${(packAll ? next : next.slice(0, 4)).map(row).join('')}${next.length > 4 && !packAll ? `<button class="it f-all" data-fpkall>All ${next.length}</button>` : ''}</div>` : ''}
      ${past.length ? `<div class="h2">Earlier <em>${past.filter(x => x.done).length} of ${past.length} done</em></div><div class="card">${past.slice().reverse().map(row).join('')}</div>` : ''}
`;
  }
  function calendar(ym){
    const k = kid(); if(!k) return emptyNoKids();
    const t = T(), [y, m] = (ym || t.slice(0, 7)).split('-').map(Number), first = new Date(y, m - 1, 1), start = (first.getDay() + 6) % 7, nDays = new Date(y, m, 0).getDate();
    const iso = d => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, sel = route.args[2] || t;
    const by = {}; k.week.forEach(s => (by[s.date] = by[s.date] || []).push({k:'s', s})); k.makeups.forEach(s => (by[s.d] = by[s.d] || []).push({k:'s', s:{date:s.d, s:s.s, e:s.e, sub:s.sub, tutor:s.tutor, mu:1, told:s.told}}));
    k.sras.forEach(x => { [x.doOn, x.due].filter(Boolean).forEach(d => (by[d] = by[d] || []).push({k:'g', x})); });
    comingOf(k).forEach(a => (by[a.d] = by[a.d] || []).push({k:'a', a}));
    const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1), ymOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const L = by[sel] || [];
    return `<div class="ph"><div class="tt"><h1>Calendar</h1></div></div>${kidChips()}
      ${window.SPLAN && has('plan') ? `<div class="seg" style="display:flex;margin-bottom:12px">${[['Day','#me/day/' + sel],['Week','#me/week/' + sel],['Month',''],['Year','#me/year/' + sel]].map(([l, h]) => h ? `<a style="flex:1;text-align:center;text-decoration:none" href="${h}">${l}</a>` : `<a style="flex:1;text-align:center;text-decoration:none" class="on">${l}</a>`).join('')}</div>` : ''}
      <div class="cal-nav"><a class="btn sm" href="#me/calendar/${ymOf(prev)}">‹</a><b>${['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]} ${y}</b><a class="btn sm" href="#me/calendar/${ymOf(next)}">›</a></div>
      <div class="card pad"><div class="f-cal">${['M','T','W','T','F','S','S'].map(x => `<span>${x}</span>`).join('')}${Array(start).fill('<span></span>').join('')}
        ${Array.from({length: nDays}, (_, i) => { const d = iso(i + 1), E = by[d] || []; return `<a class="${d === sel ? 'on' : ''}" href="#me/calendar/${y}-${String(m).padStart(2, '0')}/${d}">${i + 1}<span>${E.filter(e => e.k === 's').slice(0, 3).map(() => '<i></i>').join('')}${E.some(e => e.k !== 's') ? '<i class="g"></i>' : ''}${window.SPLAN && SPLAN.hasOwn(k, d) ? '<i class="o"></i>' : ''}</span></a>`; }).join('')}</div></div>
      <div class="h2">${day(sel)}${window.SPLAN && has('plan') ? ` <a class="f-dayl" href="#me/day/${sel}">${isParent() ? 'Day ›' : 'Plan my day ›'}</a>` : ''}</div><div class="card">${window.SPLAN ? SPLAN.monthRows(k, sel, 1) : ''}${L.map(e => e.k === 's' ? sesTell(e.s)
        : e.k === 'a' ? `<div class="it"><span class="cal-t">${esc(e.a.s || '')}</span><span class="t"><b>${esc((window.MARKS ? MARKS.TY[MARKS.akN(e.a.ak)] : '') || 'Assessment')} · ${esc(sub(e.a.sub))}</b><small>${esc((e.a.tp || []).join(', '))}</small></span></div>`
        : `<div class="it"><span class="f-mk am">!</span><span class="t"><b>${esc(e.x.topic)} ${e.x.stage ? 'R' + e.x.stage : 'LD'}</b><small>${esc(sub(e.x.sub))} · ${e.x.doOn === sel ? 'do' : 'hand in'}</small></span></div>`).join('') || (window.SPLAN && SPLAN.hasOwn(k, sel) ? '' : '<p class="empty">Nothing.</p>')}${window.SPLAN ? SPLAN.monthRows(k, sel) : ''}</div>
`;
  }
  function progress(){
    const k = kid(); if(!k) return emptyNoKids();
    const B = window.MARKS ? MARKS.bySubject(k.marks || {}) : [], kOf = sb => (k.subjects.find(x => x.sub === sb) || {}).k;
    const marks = B.length ? `<div class="h2">Marks <em>assessments</em></div><div class="card">${B.map(x => { const kk = kOf(x.sub), tag = kk ? `a href="#me/subject/${encodeURIComponent(kk)}"` : 'div';
      return `<${tag} class="it"><span class="t"><b>${esc(sub(x.sub))}</b><small>${x.w.length ? x.w.length + ' marked' : 'SRAs only'}</small></span>${MARKS.spark(x.w)}${x.last != null ? `<span class="mk-big">${x.last}%${MARKS.change(x.diff)}</span>` : ''}</${tag.split(' ')[0]}>`; }).join('')}</div>` : '';
    const tg = k.exam && window.EXUI ? `<div class="h2">Targets</div><div class="card">${k.subjects.map(x => { const i = exInfo(k, x); return i ? EXUI.row(i, sub(x.sub), `data-fgo="#me/subject/${encodeURIComponent(x.k)}"`) : ''; }).join('')}</div>` : '';
    const R0 = window.FDOC ? FDOC.range(k, 'tp', T()) : null;
    const dlb = isParent() && window.FDOC ? `<div class="h2">Report</div><div class="seg f-per">${FDOC.PER.map(([p, l]) => `<button type="button" class="${perSel === p ? 'on' : ''}" data-fper="${p}">${l.replace('This tuition period', 'Tuition period')}</button>`).join('')}</div>
      <button class="btn n full f-dl" type="button" data-fdl="rep">${DLI} Download report</button><p class="note" style="margin:6px 2px 14px">${(R => esc(R.label) + ' · ' + FDOC.rangeL(R))(FDOC.range(k, perSel, T()))}</p>` : '';
    return `<div class="ph"><div class="tt"><h1>${isParent() ? 'Sessions' : 'Progress'}</h1>${R0 ? `<p>${esc(R0.label)} · ${FDOC.rangeL(R0)}</p>` : ''}</div><div class="acts"><a class="btn" href="#me/exams">${isParent() ? 'Exams' : 'My exams'}</a></div></div>${kidChips()}${tg}${isParent() && window.FUP ? FUP.famCard(k) : ''}${marks}${window.SX ? (W => `<div class="h2">${has('review') || has('habits') || has('focus') || has('plan') ? 'This week' : 'School'}</div><div class="card">${has('review') ? `<a class="it" href="#me/review"><span class="t"><b>Review</b><small>Week, month, term, year</small></span><span class="chev">›</span></a>` : ''}${has('habits') ? `<a class="it" href="#me/habits"><span class="t"><b>Habits</b><small>Attendance, SRAs on their day, reports</small></span><span class="chev">›</span></a>` : ''}<a class="it" href="#me/school"><span class="t"><b>School results</b></span><span class="chev">›</span></a>${has('focus') ? `<button class="it" style="width:100%" data-sxd="ftime"><span class="t"><b>Focus time</b><small>Finished rounds</small></span><b>${SX.hmin(W.focus)}</b><span class="chev">›</span></button>` : ''}${has('plan') ? `<div class="it"><span class="t"><b>Study planned</b><small>${isParent() ? 'Their own blocks: total only' : '<a href="#me/day">Plan in Day view</a>'}</small></span><b>${SX.hmin(W.study)}</b></div>` : ''}</div>`)(SX.weekTotals(k)) : ''}<div class="h2">Sessions <button class="btn sm" data-fhelp style="padding:2px 8px;border-radius:50%">?</button></div><div class="card">${k.subjects.map(sesRow).join('') || '<p class="empty">No tuition this period.</p>'}</div>${dlb}`;
  }
  function subject(kk){
    const k = kids().find(x => x.subjects.some(s => s.k === kk)) || kid(); if(!k) return emptyNoKids();
    const x = k.subjects.find(s => s.k === kk); if(!x) return `<p class="empty">Not found.</p>`;
    const L = k.sessions.filter(e => e.k === kk);
    const xi = exInfo(k, x);
    return `${crumb('#me/progress', isParent() ? 'Sessions' : 'Progress')}<div class="ph"><div class="tt"><h1>${esc(sub(x.sub))}</h1><p>${esc(x.tutor)} · until ${dshort(x.b)}</p></div></div>
      ${xi ? EXUI.block(xi, isParent() ? '' : `data-fextg="${esc(x.k)}"`, false) : ''}
      ${(M => M && (M.w.length || M.sra.length) ? `<div class="card pad"><b>Assessments</b><p class="note" style="margin:0 0 4px">% each time</p>${MARKS.line(M)}${MARKS.avgs(M)}</div>
        <div class="card pad"><b>SRA marks</b><p class="note" style="margin:0 0 8px">% at each review of a topic</p>${MARKS.grid(M)}${window.FUP ? FUP.famRetests(k, x.sub) : ''}</div>${window.FUP ? FUP.famCard(k, x.sub) : ''}` : '')(window.MARKS && MARKS.bySubject(k.marks || {}).find(m => m.sub === x.sub))}
      <div class="card pad"><div class="f-four"><div><b>${x.planned}</b><small>Planned</small></div><div><b>${x.had}</b><small>Had</small></div><div><b>${x.remaining}</b><small>Left</small></div><div><b>${x.owed}</b><small>Owed</small></div></div></div>
      ${window.REV ? REV.chart(k, x.sub) : ''}
      <div class="h2">${x.times.map(t => `${DAYN[t.d]} ${t.s}`).join(' · ')}</div>
      ${xi && xi.pace ? EXUI.block(xi, '', true).replace(/^[\s\S]*?(<div class="h2">Syllabus)/, '$1') : xi && xi.papers.length ? EXUI.block(xi, '', true).replace(/^[\s\S]*?(<div class="h2">Exams)/, '$1') : ''}
      <div class="card">${L.map(e => `<div class="it">${stMark(e)}<span class="t"><b>${day(e.d)}${e.mk ? ' · make-up' : ''}</b><small>${e.a === 'absent' || e.a === 'cancelled' ? '' : esc(e.t1) + '–' + esc(e.t2) + ' · '}${esc(stText(e))}</small></span>${k.canConfirm && e.st === 'waiting' ? `<button class="f-ok" data-fcf="yes:${esc(e.id)}">✓</button><button class="f-no" data-fcf="no:${esc(e.id)}">✕</button>` : ''}</div>`).join('') || '<p class="empty">No sessions logged yet.</p>'}</div>`;
  }
  function payments(){
    const t = T(), N = window.FDOC ? FDOC.nextPay(kids(), t) : null; if(!N) return '';
    const W = {invoice:'Invoice', receipt:'Receipt', quote:'Quote'}, TT = window.PAYPLAN ? PAYPLAN.TT : {}, inv = N.open[0] || N.inv;
    const F = N.first, sched = inv && inv.balance > 0.5 ? (inv.rows || [{short: 'Balance', amt: inv.balance, due: inv.due, paid: false}]) : [];
    const nx = F ? `<div class="card pad f-nx"><span class="note" style="display:block;margin:0">Next payment</span><div class="f-big">${mk(F.amt)}</div><span class="note" style="display:block;margin:2px 0 0;color:${F.p.over ? 'var(--rd)' : 'var(--muted)'}">${esc(F.what)} ${F.p.over ? 'overdue since' : 'due'} ${F.due ? day(F.due) : '–'}${kids().length > 1 ? ' · ' + esc(firstN(F.p.kid)) : ''}</span>
        ${sched.length > 1 || N.after.length ? `<div class="f-sch">${sched.map(r => `<div class="row"><span>${esc(r.short)} · ${dshort(r.due)}</span><b style="color:${r.paid ? 'var(--ok)' : 'var(--ink)'}">${r.paid ? '✓ ' : ''}${mk(r.amt)}</b></div>`).join('')}${N.after.map(x => `<div class="row"><span>${esc(x.l)} · ${dshort(x.d)}</span><span class="note" style="margin:0">${esc(x.note)}</span></div>`).join('')}</div>` : ''}
        ${N.owed - F.amt > 0.5 ? `<p class="note" style="margin:8px 0 0">${mk(N.owed)} owed in all</p>` : ''}</div>`
      : `<div class="card pad"><b>Nothing owed. ✓</b>${N.after.length ? `<div class="f-sch">${N.after.map(x => `<div class="row"><span>${esc(x.l)} · ${dshort(x.d)}</span><span class="note" style="margin:0">${esc(x.note)}</span></div>`).join('')}</div>` : ''}</div>`;
    return `<div class="ph"><div class="tt"><h1>Payments</h1>${N.tt && TT[N.tt] ? `<p>${esc(TT[N.tt])}</p>` : ''}</div></div>${nx}
      <div class="h2">History</div><div class="card">${N.all.map(p => `<div class="it"><span class="f-mk ${p.type === 'invoice' ? (p.balance > 0.5 ? (p.over ? 'rd' : 'am') : 'ok') : p.type === 'receipt' ? 'ok' : 'bl'}">${p.type === 'invoice' && p.balance > 0.5 ? '!' : p.type === 'quote' ? '' : '✓'}</span><span class="t"><b>${esc(p.number)} · ${mk(p.type === 'receipt' ? p.received : p.total)}</b><small>${W[p.type]} · ${day(p.date)}${kids().length > 1 ? ' · ' + esc(firstN(p.kid)) : ''}${p.type === 'invoice' ? (p.balance > 0.5 ? ` · ${mk(p.balance)} owed` : ' · paid') : ''}</small></span>${p.type === 'quote' ? '' : `<button class="ib f-dli" type="button" data-fdl="doc:${esc(p.id)}" aria-label="Download ${esc(p.number)}" title="Download">${DLI}</button>`}</div>`).join('') || '<p class="empty">Nothing yet.</p>'}</div>
      ${N.all.some(p => p.type !== 'quote') ? `<button class="btn n full f-dl" type="button" data-fdl="st" style="margin-top:4px">${DLI} Download statement</button>` : ''}
      <p class="note">To pay: ${esc((typeof settingsKV === 'function' && settingsKV().payHow) || 'see your invoice for LHQ\'s bank and mobile money details')}.</p>`;
  }

  function more(){
    return `<div class="ph"><div class="tt"><h1>More</h1></div></div><div class="card">
      <a class="it" href="#settings"><span class="t"><b>My account</b></span><span class="chev">›</span></a>
      <a class="it" href="#me/exams"><span class="t"><b>${isParent() ? 'Exams' : 'My exams'}</b></span><span class="chev">›</span></a>
      ${has('habits') ? `<a class="it" href="#me/habits"><span class="t"><b>Habits</b></span><span class="chev">›</span></a>` : ''}
      ${isParent() ? '' : `${has('focus') ? `<a class="it" href="#me/focus"><span class="t"><b>Focus</b></span><span class="chev">›</span></a>` : ''}
      <a class="it" href="#me/reminders"><span class="t"><b>Reminders</b></span><span class="chev">›</span></a>
      <a class="it" href="#me/sharing"><span class="t"><b>Sharing</b></span><span class="chev">›</span></a>
      <a class="it" href="#me/bar"><span class="t"><b>Edit the bar</b></span><span class="chev">›</span></a>`}
      <a class="it" href="#exams"><span class="t"><b>Exam timetable</b></span><span class="chev">›</span></a>
      <a class="it" href="#set/notifications"><span class="t"><b>Notifications</b></span><span class="chev">›</span></a>
      <a class="it" href="#me/callink"><span class="t"><b>Calendar link</b><small>Google Calendar or iPhone</small></span><span class="chev">›</span></a>
      <a class="it" href="#set/appearance"><span class="t"><b>Appearance</b><small>Theme, colour, text size${isParent() ? '' : ', Lean or Full'}</small></span><span class="chev">›</span></a>
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
    if(sub0 === 'exams'){ const k = kid(); if(!k) return emptyNoKids(); return kidChips() + EXUI.myExams(choices(k), crumb('#me/progress', isParent() ? 'Sessions' : 'Progress'), !isParent()); }
    if(sub0 === 'report') return report();
    if(window.SX){ const k = kid(); if(k){
      if(sub0 === 'habits') return kidChips() + SX.habits(k);
      if(window.SPLAN && ['day','week','year','blk','snooze'].includes(sub0)) return SPLAN.page(k, sub0, a1, route.args[2], route.args[3]);
      if(!isParent() && sub0 === 'focus') return SX.focusPage(k, a1 ? decodeURIComponent(a1) : '');
      if(!isParent() && sub0 === 'reminders') return SX.reminders();
      if(!isParent() && sub0 === 'bar') return SX.barPage();
      if(!isParent() && sub0 === 'sharing') return SX.sharing(k);
      if(sub0 === 'switch'){ kidI = Math.max(0, +a1 || 0); write('lhq_family_kid', kidI); setTimeout(() => { location.hash = '#me'; }, 0); return ''; }
      if(sub0 === 'callink') return calLink();
      if(window.SOUNDS && sub0 === 'sounds') return SOUNDS.page();
      if(window.REV && sub0 === 'review') return kidChips() + REV.page(k, a1, route.args[2]);
      if(window.REV && sub0 === 'school') return kidChips() + REV.school(k);
      if(window.REV && !isParent() && sub0 === 'reflect') return REV.reflect(k, a1); } }
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
    if(window.SX) SX.bind(kid());
    if(window.SPLAN) SPLAN.bind(kid());
    if(window.REV) REV.bind(kid());
    const calPost = async body => { try{ const r = await hub.api('family', {method: 'POST', body: JSON.stringify(Object.assign({action: 'calopt'}, body))}); data.cal = {link: r.link, inc: r.inc}; write(CK, data); render(); return r; }catch(e){ toast(e.message); } };
    document.querySelectorAll('[data-fcal]').forEach(b => b.onclick = () => { const id = b.dataset.fcal, on = !(((data.cal || {}).inc || {})[id]); calPost({inc: {[id]: on}}).then(r => r && toast('Saved · your calendar updates in a few hours')); });
    document.querySelectorAll('[data-fcallink]').forEach(b => b.onclick = async () => { try{ await navigator.clipboard.writeText(location.origin + ((data.cal || {}).link || '')); toast('Link copied'); }catch(e){ toast('Copy didn\'t work'); } });
    document.querySelectorAll('[data-fcalnew]').forEach(b => b.onclick = () => calPost({renew: 1}).then(r => r && toast('New link · add it again; the old one stops')));
    if(window.SOUNDS && /^#me\/sounds/.test(location.hash)) SOUNDS.bind();
    document.querySelectorAll('[data-fmore]').forEach(b => b.onclick = async () => { write('lhq_moreAsk', 1); if(b.dataset.fmore === '1'){ const s0 = hub.session(); if(s0 && s0.me){ s0.me.view = 'full'; localStorage.setItem('lhq_session', JSON.stringify(s0)); } try{ await hub.api('people', {method: 'POST', body: JSON.stringify({action: 'view', view: 'full'})}); }catch(e){} toast('Full · change it in Appearance'); } render(); if(window.LHQNav && LHQNav.refresh) LHQNav.refresh(); });
    document.querySelectorAll('[data-fgo]').forEach(b => b.onclick = () => { location.hash = b.dataset.fgo; });
    document.querySelectorAll('[data-fextg]').forEach(b => b.onclick = () => { const k = kid(), x = k && k.subjects.find(y => y.k === b.dataset.fextg); if(!x) return;
      EXUI.targetSheet({k: x.k, name: k.name, sub: sub(x.sub), i: exInfo(k, x), onSaved: async () => { await fetchData(); render(); }}); });
    document.querySelectorAll('[data-myrm]').forEach(b => b.onclick = async () => { const ctx = mineCtx(); if(!ctx) return; const [code, ex] = b.dataset.myrm.split('|');
      try{ await ctx.save(ctx.mine.filter(m => !(m.code === code && m.ex === ex))); toast('Removed'); render(); }catch(e){ toast(e.message); } });
    document.querySelectorAll('[data-fkid]').forEach(b => b.onclick = () => { kidI = +b.dataset.fkid; write('lhq_family_kid', kidI); render(); });
    document.querySelectorAll('[data-fcf]').forEach(b => b.onclick = () => { const [a, ...r] = b.dataset.fcf.split(':'), id = r.join(':');
      if(a === 'yes') post({action:'confirm', id}, 'Confirmed'); else notRight(id); });
    document.querySelectorAll('[data-frep]').forEach(b => b.onclick = () => { const [a, ...r] = b.dataset.frep.split(':');
      post({action:'reply', id: r.join(':'), ok: a === 'ok'}, a === 'ok' ? 'Done' : 'Sent to LHQ'); });
    document.querySelectorAll('[data-fper]').forEach(b => b.onclick = () => { perSel = b.dataset.fper; render(); });
    if(window.FUP && kid()) FUP.famBind(kid());
    document.querySelectorAll('[data-ffeat]').forEach(b => b.onclick = featSheet);
    document.querySelectorAll('[data-fdl]').forEach(b => b.onclick = async () => { if(!window.FDOC || b.disabled) return; const v = b.dataset.fdl, t = T(), who = me().name || '';
      b.disabled = true; toast('Preparing the PDF…');
      try{
        if(v === 'rep'){ const k = kid(), R = FDOC.range(k, perSel, t); await FDOC.pdf(FDOC.report(k, perSel, t, who), `LHQ Progress_ ${k.name}_ ${R.label} ${R.a} to ${R.b < t ? R.b : t}`); }
        else if(v === 'st') await FDOC.pdf(FDOC.statement(kids(), t, who), `LHQ Statement_ ${kids().map(k => firstN(k.name)).join(' and ')}_ ${t}`);
        else { const p = FDOC.payOf(kids()).find(x => x.id === v.slice(4)); if(p) await FDOC.pdf(FDOC.copy(p), `LHQ ${p.number}`); }
        toast('PDF downloaded');
      }catch(e){ console.error(e); toast('Couldn\'t make the PDF. Try again.'); }
      b.disabled = false; });
    document.querySelectorAll('[data-fars]').forEach(b => b.onclick = () => { const A = read('lhq_arsdone', {}), id = b.dataset.fars; if(A[id]) delete A[id]; else A[id] = Date.now(); write('lhq_arsdone', A); b.classList.toggle('on', !!A[id]); toast(A[id] ? 'ARS done · now the SRA' : 'ARS not done'); });
    document.querySelectorAll('[data-fdone]').forEach(b => b.onclick = async () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on);
      try{ await hub.api('family', {method:'POST', body: JSON.stringify({action:'done', id: b.dataset.fdone, done: on})}); const x = kids().flatMap(k => k.sras).find(s => s.id === b.dataset.fdone); if(x) x.done = on; write(CK, data); toast(on ? (arsDone(b.dataset.fdone) ? 'Done' : 'Done · next time, the ARS first') : 'Not done'); if(x && x.pack) render(); }
      catch(e){ b.classList.toggle('on', !on); toast(e.message); } });
    document.querySelectorAll('[data-ftell]').forEach(b => b.onclick = () => { const [d, sb, st] = b.dataset.ftell.split('|'); NT = {d, sub: sb, s: st, kind: 'abs', why: '', mins: 0, note: '', from: d, to: d}; tellSheet(); });
    document.querySelectorAll('[data-funtell]').forEach(b => b.onclick = () => post({action:'unnotice', st: kid().key, id: b.dataset.funtell}, 'Undone'));
    document.querySelectorAll('[data-fpkall]').forEach(b => b.onclick = () => { packAll = true; render(); });
    document.querySelectorAll('[data-fself]').forEach(inp => inp.onchange = async () => { const id = inp.dataset.fself, v = inp.value.trim();
      const j = await post({action:'selfmark', id, sc: v}, v ? 'Saved' : 'Removed');
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
  /* after 2 weeks on Lean, Home asks once */
  function featSheet(){
    openSheet(`<div class="hx"><h3>Your Hub</h3><button class="ib" data-close>✕</button></div><p class="sp">Add what you'll use. Take it off any time.</p><div class="card">${FEAT.map(([f, t0, s0]) => `<button type="button" class="it" style="width:100%" data-ffeatk="${f}"><span class="t"><b>${t0}</b><small>${s0}</small></span><span class="f-mk ${has(f) ? 'ok' : ''}">${has(f) ? '✓' : ''}</span></button>`).join('')}
      <div class="it"><span class="t"><b>School results</b><small>Always on</small></span><span class="f-mk ok">✓</span></div></div><p class="note">All on is Full. More › Appearance sets them all at once.</p>`);
    document.querySelectorAll('[data-ffeatk]').forEach(b => b.onclick = async () => { const f = b.dataset.ffeatk, on = !has(f), s0 = hub.session();
      if(s0 && s0.me){ const cur = s0.me.view === 'full' ? Object.fromEntries(FEAT.map(([x]) => [x, 1])) : Object.assign({}, s0.me.feat || {}); if(on) cur[f] = 1; else delete cur[f];
        if(FEAT.every(([x]) => cur[x])){ s0.me.view = 'full'; s0.me.feat = {}; } else { s0.me.view = 'lean'; s0.me.feat = cur; } localStorage.setItem('lhq_session', JSON.stringify(s0)); }
      featSheet(); render();
      try{ const j = await hub.api('people', {method: 'POST', body: JSON.stringify({action: 'feat', k: f, on})}); if(j && j.me && s0){ s0.me.view = j.me.view; s0.me.feat = j.me.feat; localStorage.setItem('lhq_session', JSON.stringify(s0)); } }catch(e){ toast('Saved on this device'); } });
  }
  function moreAsk(){ if(isParent()) return ''; let f = read('lhq_first', 0); if(!f){ f = Date.now(); write('lhq_first', f); } if(read('lhq_moreAsk', 0) || Date.now() - f < 14 * 864e5) return '';
    return `<div class="card pad" style="margin-top:12px"><b>Want to see more?</b><p class="note" style="margin:2px 0 10px">Your cards, focus timer, habits, reviews and planning.</p><div style="display:flex;gap:8px"><button class="btn n" style="flex:1" data-fmore="1">Show me</button><button class="btn" style="flex:1" data-fmore="0">Not now</button></div></div>`; }
  /* search: only what's in this account, for the child in view (parents switch child from here too) */
  function searchGroups(){
    const k = kid(); if(!k) return []; const G = [], R = n => n ? 'R' + n : 'LD', sk = sb => '#me/subject/' + encodeURIComponent((k.subjects.find(x => x.sub === sb) || {}).k || ''), me0 = isParent();
    if(me0 && kids().length > 1) G.push({g: 'Children', items: kids().map((c, i) => ({t: c.name, s: c === k ? 'in view' : 'switch to', href: '#me/switch/' + i}))});
    G.push({g: 'Subjects', items: k.subjects.map(x => ({t: sub(x.sub), s: (x.tutor || '') + (x.b ? ' · until ' + dshort(x.b) : ''), href: sk(x.sub)}))});
    const tp = new Map(); ((k.marks || {}).r || []).forEach(x => { if(!tp.has(x.sub + '|' + x.tk)) tp.set(x.sub + '|' + x.tk, x); }); (k.sras || []).forEach(x => { if(!tp.has(x.sub + '|' + x.topic)) tp.set(x.sub + '|' + x.topic, {sub: x.sub, tk: x.topic}); });
    G.push({g: 'Topics', items: [...tp.values()].map(x => ({t: x.tk, s: sub(x.sub), href: sk(x.sub)}))});
    G.push({g: 'SRAs', items: (k.sras || []).map(x => ({t: `${x.topic} ${R(x.stage)}`, s: `${sub(x.sub)} · ${x.done ? 'done' : 'do on ' + day(x.doOn)}${x.pack ? ' · take-home' : ''} · ARS then SRA`, href: x.pack ? '#me/practice/pack' : '#me/practice'}))
      .concat(((k.marks || {}).r || []).map(x => ({t: `${x.tk} ${R(x.rv)}`, s: `${sub(x.sub)} · ${day(x.d)} · SRA ${x.p}%${x.a != null && x.a >= 0 ? ' · ARS ' + x.a + '%' : ''}`, href: sk(x.sub)})))});
    G.push({g: 'Sessions', items: (k.week || []).map(s0 => ({t: `${day(s0.date)} · ${sub(s0.sub)}`, s: `${s0.s}–${s0.e} · ${s0.tutor || ''}`, href: me0 ? '#me/calendar/' + s0.date.slice(0, 7) + '/' + s0.date : '#me/day/' + s0.date}))
      .concat(((k.hist || {}).s || []).slice().reverse().slice(0, 200).map(x => ({t: `${day(x[0])} · ${sub(x[1])}`, s: x[2] === 'attended' ? 'came' : x[2], href: sk(x[1])})))});
    G.push({g: 'Assessments', items: comingOf(k).map(a => ({t: `${(window.MARKS ? MARKS.TY[MARKS.akN(a.ak)] : '') || 'Assessment'} · ${sub(a.sub)}`, s: `${day(a.d)} · coming up${(a.tp || []).length ? ' · ' + a.tp.join(', ') : ''}`, href: '#me/calendar/' + a.d.slice(0, 7) + '/' + a.d}))
      .concat(((k.marks || {}).w || []).slice().reverse().map(x => ({t: `${(window.MARKS ? MARKS.TY[MARKS.akN(x.ak)] : '') || 'Assessment'} · ${sub(x.sub)}`, s: `${day(x.d)} · ${x.p}%`, href: sk(x.sub)})))});
    if(window.EXUI && k.exam) G.push({g: 'Exam papers', items: k.subjects.flatMap(x => { const i = exInfo(k, x); return ((i && i.papers) || []).map(p => ({t: `${p.code || ''} · ${sub(x.sub)}`, s: `${p.n || ''} ${p.a ? day(p.a) : ''}`, k: (p.code || '').replace('/', ' '), href: '#me/exams'})); })});
    if(!me0) G.push({g: 'Your dates and blocks', items: ((k.sx || {}).plan || []).map(b => ({t: b.name || 'Block', s: b.all ? 'all day · ' + day(b.from) : `${b.s}–${b.e} · ${({once: day(b.from), daily: 'every day', weekdays: 'weekdays', days: 'chosen days'})[b.rep] || ''}`, href: '#me/blk/' + b.id + '/' + (b.all || b.rep === 'once' ? b.from : T())}))});
    if(me0){ const seen = new Set(); G.push({g: 'Payments', items: kids().flatMap(c => c.pay || []).filter(p => !seen.has(p.id) && seen.add(p.id)).map(p => ({t: `${p.number || ''} · ${firstN(p.student || k.name)}`, s: `${mk(p.total || p.amount || 0)}${p.type === 'invoice' ? (p.balance > 0.5 ? ' · balance ' + mk(p.balance) : ' · paid') : ''}`, k: (p.number || '').replace(/-/g, ' ') + ' ' + (p.total || p.amount || ''), href: '#me/payments'}))}); }
    const pages = [['#me','Home'],['#me/practice','Practice','sras ars take-home'],['#me/calendar','Calendar','month'],['#me/progress', me0 ? 'Sessions' : 'Progress','marks targets'],['#me/exams', me0 ? 'Exams' : 'My exams','timetable papers'],['#me/review','Review','week month term year went well lagged'],['#me/school','School results','mid-term end of term grades']]
      .concat(me0 ? [['#me/payments','Payments','invoices receipts statement balance next payment']] : [['#me/report','Today\'s report','daily'],['#me/reminders','Reminders','sra hour'],['#me/sharing','Sharing','tutors see'],['#me/bar','Edit the bar']])
      .concat(me0 ? [] : [has('focus') && ['#me/focus','Focus','timer pomodoro'], has('habits') && ['#me/habits','Habits'], has('plan') && ['#me/day','Day · Plan my day','schedule'], has('plan') && ['#me/week','My week','schedule blocks activities'], has('plan') && ['#me/year','Year'], ['#me/school','School results','marks report']].filter(Boolean))
      .concat([['#set/appearance','Appearance','theme dark colour text size lean full'],['#set/notifications','Notifications','quiet hours']]);
    G.push({g: 'Pages', items: pages.map(([h, t, kw]) => ({t, k: kw || '', href: h}))});
    return G.filter(g => g.items.length);
  }
  /* the private calendar link (Google Calendar or an iPhone): one way, LHQ Hub to the calendar */
  function calLink(){
    const c = (data && data.cal) || {inc: {}}, I = c.inc || {}, sw = (on, id) => `<button type="button" class="sp-sw ${on ? 'on' : ''}" data-fcal="${id}" aria-label="On or off" style="width:46px;height:28px;border-radius:99px;border:0;background:${on ? 'var(--ok)' : 'var(--line)'};position:relative;flex:none;cursor:pointer"><i style="position:absolute;top:3px;left:${on ? 21 : 3}px;width:22px;height:22px;border-radius:50%;background:#fff"></i></button>`;
    const row = (t, s0, r) => `<div class="it"><span class="t"><b>${t}</b>${s0 ? `<small>${s0}</small>` : ''}</span>${r}</div>`;
    return `${crumb('#me/more', 'More')}<div class="ph"><div class="tt"><h1>Calendar link</h1><p>Google Calendar or iPhone</p></div></div>
      <div class="card">${row(isParent() ? 'Sessions and make-ups' : 'LHQ sessions and make-ups', isParent() ? 'Every child' : '', '<span>🔒</span>')}
        ${isParent() ? row('Assessments', '', sw(I.as, 'as')) + row('Payment dates', 'Invoices with a balance', sw(I.pay, 'pay')) + row('Study blocks', 'Their own', '<span class="note">🔒 private</span>')
          : row('SRA days', 'Do on, ARS then SRA', sw(I.sra, 'sra')) + row('Assessments', '', sw(I.as, 'as')) + row('My blocks and activities', 'Only in your own calendar', sw(I.blk, 'blk')) + row('My dates', '', sw(I.dt, 'dt'))}</div>
      <a class="btn n full" href="${'webcal://' + location.host + (c.link || '')}">Add to Google Calendar</a>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1" data-fcallink>Copy the link</button><button class="btn" style="flex:1" data-fcalnew>New link</button></div>
      <p class="note" style="margin-top:10px">One way: LHQ Hub → your calendar. Google updates it every few hours. Google: Other calendars › From URL. iPhone: Settings › Calendar › Accounts › Add Subscribed Calendar. Keep it private; New link stops the old one.</p>`;
  }
  return {page, bind, bell, refresh: fetchData, mineCtx, steps, comingOf, sub, sesTell, full, has, FEAT, searchGroups};
})();
