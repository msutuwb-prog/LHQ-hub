/* LHQ Hub › Reviews (week, month, term, year) for a student, the private weekly reflection, school results
   (the student adds, LHQ checks), and each subject's school results against LHQ's assessments.
   Every figure opens the rows behind it; "went well" and "where you lagged" come from fixed rules. */
window.REV = (function(){
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const iso = t => new Date(t).toISOString().slice(0, 10), add = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x.getTime()); };
  const wdOf = d => new Date(d + 'T00:00:00Z').getUTCDay(), dl = d => `${WD[wdOf(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`, monOf = d => add(d, -((wdOf(d) + 6) % 7));
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const dur = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
  const esc = v => String(v == null ? '' : v).replace(/^Mathematics$/i, 'Maths').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const T = () => (window.HD ? HD.today() : iso(Date.now())), R = n => n ? 'R' + n : 'LD', avg = L => L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  const isParent = () => ((window.hub && hub.session && (hub.session() || {}).me) || {}).role === 'parent';
  const terms0 = L => { L = (L || []).filter(t => t && t[1] && t[2]).slice().sort((a, b) => a[1].localeCompare(b[1])); const dup = n => L.filter(x => x[0] === n).length > 1, sy = d => { const y = +d.slice(0, 4) - (+d.slice(5, 7) < 9 ? 1 : 0); return y + '–' + String(y + 1).slice(2); };
    return L.map(t => [dup(t[0]) ? `${t[0]} ${sy(t[1])}` : t[0], t[1], t[2]]); };
  const terms = k => terms0(k.terms && k.terms.length ? k.terms : (window.MIN ? MIN.terms() : []));
  const SCALES = {'A*–G': ['A*','A','B','C','D','E','F','G','U'], '9–1': ['9','8','7','6','5','4','3','2','1','U'], 'A–E': ['A*','A','B','C','D','E','U'], '%': []};
  const scaleOf = k => SCALES[k.scale] || SCALES['A*–G'];

  /* ---------- periods ---------- */
  function range(k, per, d){
    d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : T();
    if(per === 'week'){ const a = monOf(d); return {a, b: add(a, 6), pa: add(a, -7), pb: add(a, -1), l: `${dl(a)} – ${dl(add(a, 6))}`, pl: 'the week before', prev: add(a, -7), next: add(a, 7)}; }
    if(per === 'month'){ const a = d.slice(0, 8) + '01', e = iso(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)), pa = iso(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 2, 1)), pb = add(a, -1);
      return {a, b: e, pa, pb, l: `${['January','February','March','April','May','June','July','August','September','October','November','December'][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`, pl: 'the month before', prev: pa, next: add(e, 1)}; }
    if(per === 'term'){ const L = terms(k), i = L.findIndex(x => x[1] <= d && x[2] >= d), j = i >= 0 ? i : L.filter(x => x[1] <= d).length - 1, c = L[j], p = L[j - 1];
      if(c) return {a: c[1], b: c[2], pa: p ? p[1] : add(c[1], -90), pb: p ? p[2] : add(c[1], -1), l: c[0], pl: p ? p[0] : 'the term before', term: c, prevTerm: p, prev: p ? p[1] : add(c[1], -90), next: L[j + 1] ? L[j + 1][1] : add(c[2], 1)}; }
    const y0 = +d.slice(5, 7) >= 9 ? +d.slice(0, 4) : +d.slice(0, 4) - 1;
    return {a: y0 + '-09-01', b: (y0 + 1) + '-08-31', pa: (y0 - 1) + '-09-01', pb: y0 + '-08-31', l: `${y0}–${String(y0 + 1).slice(2)}`, pl: 'the year before', prev: (y0 - 1) + '-09-01', next: (y0 + 1) + '-09-01', year: y0};
  }

  /* ---------- figures, each with its rows ---------- */
  const blockOn = (b, d) => window.SPLAN ? SPLAN.blockOn(b, d) : false;
  function figs(k, a, b){
    const z = b > T() ? T() : b, H = k.hist || {s: [], r: []}, X = k.sx || {};
    const sr = (H.r || []).filter(r => r[0] >= a && r[0] <= z), as = ((k.marks || {}).w || []).filter(x => x.d >= a && x.d <= z && x.p != null);
    const fo = (X.focus || []).filter(x => x.d >= a && x.d <= z), ses = (H.s || []).filter(x => x[0] >= a && x[0] <= z && !(x[2] === 'cancelled' && x[4] !== 'student'));
    const blocks = []; if(!isParent()) for(let d = a; d <= z; d = add(d, 1)) (X.plan || []).filter(x => !x.all && (x.type === 'study' || x.type === 'rev') && blockOn(x, d)).forEach(x => {
      const s0 = mins(x.s), e0 = mins(x.e), done = fo.some(f => f.d === d && f.at && (t => t >= s0 && t <= e0 + 30)(new Date(f.at).getHours() * 60 + new Date(f.at).getMinutes()));
      blocks.push({d, x, m: e0 - s0, done}); });
    const came = x => x[2] === 'attended' || x[2] === 'late';
    return {sr, srOn: sr.filter(r => r[2] === 'o').length, as, asAvg: avg(as.map(x => x.p)), fo, foM: fo.reduce((s, x) => s + (x.m || 0), 0), blocks, plM: blocks.reduce((s, x) => s + x.m, 0), doM: blocks.filter(x => x.done).reduce((s, x) => s + x.m, 0), ses, came: ses.filter(came).length};
  }
  const fading = k => window.SX && SX.memory ? SX.memory(k).L.filter(x => x.drop) : [];
  function rules(k, A, B){
    const well = [], lag = [], pc = (n, d) => d ? Math.round(n / d * 100) : null;
    const s1 = pc(A.srOn, A.sr.length), s0 = pc(B.srOn, B.sr.length);
    if(s1 != null && s0 != null && s1 - s0 >= 5) well.push({t: 'SRAs on their day up', s: `${A.srOn} of ${A.sr.length} · ${s1}% (was ${s0}%)`, d: 'sra'}); else if(s1 != null && s0 != null && s0 - s1 >= 5) lag.push({t: 'Fewer SRAs on their day', s: `${A.srOn} of ${A.sr.length} · ${s1}% (was ${s0}%)`, d: 'sra'});
    else if(s1 === 100 && A.sr.length) well.push({t: 'Every SRA on its day', s: `${A.srOn} of ${A.sr.length}`, d: 'sra'});
    if(A.asAvg != null && B.asAvg != null && A.asAvg - B.asAvg >= 3) well.push({t: `Assessments up ${A.asAvg - B.asAvg} points`, s: `${A.asAvg}% (was ${B.asAvg}%)`, d: 'as'}); else if(A.asAvg != null && B.asAvg != null && B.asAvg - A.asAvg >= 3) lag.push({t: `Assessments down ${B.asAvg - A.asAvg} points`, s: `${A.asAvg}% (was ${B.asAvg}%)`, d: 'as'});
    if(A.foM > B.foM && A.foM) well.push({t: 'More focus time', s: `${dur(A.foM)} (was ${dur(B.foM)})`, d: 'fo'}); else if(B.foM - A.foM >= 30) lag.push({t: 'Less focus time', s: `${dur(A.foM)} (was ${dur(B.foM)})`, d: 'fo'});
    if(A.ses.length && A.came === A.ses.length) well.push({t: 'Every session attended', s: `${A.came} of ${A.ses.length}`, d: 'ses'}); else if(A.ses.length - A.came) lag.push({t: `${A.ses.length - A.came} session${A.ses.length - A.came === 1 ? '' : 's'} missed`, s: `${A.came} of ${A.ses.length} attended`, d: 'ses'});
    A.blocks.filter(x => !x.done && x.d < T()).slice(0, 2).forEach(x => lag.push({t: `${WD[wdOf(x.d)]}'s ${(x.x.name || 'study').toLowerCase()} not done`, s: `${x.x.s}–${x.x.e} · no focus round in it`, d: 'st', blk: x.x.id, day: x.d}));
    fading(k).slice(0, 2).forEach(x => lag.push({t: `${x.tk} dropping`, s: `${x.sub === 'Mathematics' ? 'Maths' : x.sub} · ${R(x.f.rv)} ${x.f.p}% → ${R(x.l.rv)} ${x.l.p}%`, d: 'fade', tk: x.tk, sub: x.sub}));
    return {well, lag};
  }

  /* ---------- the review page ---------- */
  let last = null;
  function page(k, per, d){
    per = ['week','month','term','year'].includes(per) ? per : 'week';
    const r = range(k, per, d), A = figs(k, r.a, r.b), B = figs(k, r.pa, r.pb), rr = rules(k, A, B); last = {k, r, A, B, rr, per};
    const pc = (n, dd) => dd ? Math.round(n / dd * 100) : null, up = (x, y) => x == null || y == null || x === y ? '' : x > y ? 'u' : 'dn';
    const fig = (id, l, v, s, cls) => `<button type="button" class="mc rv-f" data-rvd="${id}"><span class="l">${l}</span><span class="v">${v}<span class="mca">›</span></span><span class="s ${cls || ''}">${s}</span></button>`;
    const F = [fig('sra', 'SRAs on their day', A.sr.length ? `${A.srOn} of ${A.sr.length}` : '–', B.sr.length ? `was ${B.srOn} of ${B.sr.length}` : '', up(pc(A.srOn, A.sr.length), pc(B.srOn, B.sr.length))),
      fig('as', 'Assessments', A.asAvg == null ? '–' : A.asAvg + '%', B.asAvg == null ? `${A.as.length} marked` : `was ${B.asAvg}%`, up(A.asAvg, B.asAvg)),
      fig('fo', 'Focus time', dur(A.foM), `was ${dur(B.foM)}`, up(A.foM, B.foM)),
      ...(isParent() ? [] : [fig('st', 'Study done', A.plM ? `${dur(A.doM)} of ${dur(A.plM)}` : '–', A.blocks.filter(x => !x.done && x.d < T()).length ? `${A.blocks.filter(x => !x.done && x.d < T()).length} block${A.blocks.filter(x => !x.done && x.d < T()).length === 1 ? '' : 's'} not done` : 'planned blocks', A.blocks.some(x => !x.done && x.d < T()) ? 'dn' : '')]),
      fig('ses', 'Sessions', A.ses.length ? `${A.came} of ${A.ses.length}` : '–', 'attended', A.ses.length && A.came === A.ses.length ? 'u' : '')];
    const term = per === 'term' ? termRows(k, r) : per === 'year' ? yearRows(k, r) : '';
    return `<a class="crumb" href="#me/progress">‹ ${isParent() ? 'Sessions' : 'Progress'}</a><div class="ph"><div class="tt"><h1>Review</h1><p>${esc((k.name || '').split(' ')[0])} · ${esc(r.l)} · against ${esc(r.pl)}</p></div><div class="acts"><a class="btn sm" href="#me/review/${per}/${r.prev}">‹</a><a class="btn sm" href="#me/review/${per}/${r.next}">›</a></div></div>
      <div class="seg" style="display:flex;margin-bottom:12px">${[['week','Week'],['month','Month'],['term','Term'],['year','Year']].map(([v, l]) => `<a style="flex:1;text-align:center;text-decoration:none" class="${per === v ? 'on' : ''}" href="#me/review/${v}/${d || T()}">${l}</a>`).join('')}</div>
      <div class="mcs rv-mcs">${F.join('')}</div>${term}
      <div class="h2">Went well</div><div class="card">${rr.well.map((x, i) => `<button type="button" class="it" style="width:100%" data-rvw="w${i}"><span class="f-mk ok">✓</span><span class="t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="chev">›</span></button>`).join('') || '<p class="empty">Nothing stood out.</p>'}</div>
      <div class="h2">Where ${isParent() ? 'they' : 'you'} lagged</div><div class="card">${rr.lag.map((x, i) => `<button type="button" class="it" style="width:100%" data-rvw="l${i}"><span class="f-mk am">!</span><span class="t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="chev">›</span></button>`).join('') || '<p class="empty">Nothing.</p>'}</div>
      ${isParent() ? '' : `${rr.lag.some(x => x.d === 'fade' || x.d === 'st') ? `<div class="h2">What to adjust</div><div class="rv-adj">${rr.lag.filter(x => x.d === 'fade').map(x => `<button class="btn" data-rvadj="rev|${esc(x.tk)}|${esc(x.sub)}">+ Revision: ${esc(x.tk)}</button>`).join('')}${rr.lag.filter(x => x.d === 'st').map(x => `<button class="btn" data-rvadj="mv|${x.blk}|${x.day}">Move ${WD[wdOf(x.day)]}'s block</button>`).join('')}<a class="btn" href="#me/day">Plan my day</a></div>` : ''}
        ${per === 'week' ? `<a class="btn full" style="margin-top:12px" href="#me/reflect/${r.a}">Weekly reflection ›</a>` : ''}`}
      <p class="note">${isParent() ? 'Against their own past. Effort and marks LHQ records.' : 'Against your own past. From fixed rules LHQ sets.'}</p>`;
  }
  function termRows(k, r){
    const S = (k.sx || {}).school || [], subs = (k.subjects || []).map(x => x.sub);
    return `<div class="h2">This term by subject</div><div class="card">${subs.map(sb => { const sc = S.filter(x => x.term === r.l && x.sub === sb).sort((a, b) => a.kind.localeCompare(b.kind)).pop(), la = avg(((k.marks || {}).w || []).filter(x => x.sub === sb && x.d >= r.a && x.d <= r.b && x.p != null).map(x => x.p)),
      ss = ((k.hist || {}).s || []).filter(x => x[1] === sb && x[0] >= r.a && x[0] <= r.b && !(x[2] === 'cancelled' && x[4] !== 'student')), c = ss.filter(x => x[2] === 'attended' || x[2] === 'late').length, kk = (k.subjects.find(x => x.sub === sb) || {}).k;
      return `<a class="it" href="#me/subject/${encodeURIComponent(kk || '')}"><span class="t"><b>${esc(sb)}</b><small>School ${sc ? esc(sc.gr || '') + (sc.pc != null ? ' · ' + sc.pc + '%' : '') + (sc.ok ? '' : ' · LHQ checks') : '–'} · LHQ ${la == null ? '–' : la + '%'} · attended ${ss.length ? Math.round(c / ss.length * 100) + '%' : '–'}</small></span><span class="chev">›</span></a>`; }).join('')}</div>
      ${isParent() ? '' : '<a class="btn full" href="#me/school" style="margin-bottom:12px">School results</a>'}`;
  }
  function yearRows(k, r){
    const S = (k.sx || {}).school || [], L = terms(k).filter(t => t[1] >= r.a && t[1] <= r.b);
    return L.length ? `<div class="h2">School results by term</div><div class="card">${(k.subjects || []).map(x => `<div class="it"><span class="t"><b>${esc(x.sub)}</b><small>${L.map(t => { const v = S.filter(y => y.term === t[0] && y.sub === x.sub && y.kind === 'end')[0] || S.filter(y => y.term === t[0] && y.sub === x.sub)[0]; return esc(t[0]) + ' ' + (v ? esc(v.gr || (v.pc + '%')) : '–'); }).join(' · ')}</small></span></div>`).join('')}</div>` : '';
  }
  function drill(id){
    const {A, B, r} = last, sheet = (t, sub, how, rows, sum) => openSheet(`<div class="hx"><h3>${t}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(sub)}</p>${how ? `<p class="note" style="margin:-6px 0 10px">${how}</p>` : ''}<div class="card">${rows || '<p class="empty">None.</p>'}</div>${sum ? `<div class="card pad" style="display:flex;justify-content:space-between;font-weight:800">${sum}</div>` : ''}`);
    const row = (a, s, v, c) => `<div class="it"><span class="t"><b>${a}</b><small>${s}</small></span><b style="${c ? 'color:var(--' + c + ')' : ''};white-space:nowrap">${v}</b></div>`;
    if(id === 'sra') sheet(`SRAs on their day · ${A.srOn} of ${A.sr.length}`, r.l + ` · ${r.pl}: ${B.srOn} of ${B.sr.length}`, '', A.sr.slice().reverse().map(x => row(esc(x[1]), dl(x[0]), x[2] === 'o' ? 'on its day' : x[2] === 'l' ? 'late' : 'missed', x[2] === 'o' ? 'ok' : x[2] === 'l' ? 'am' : 'rd')).join(''));
    if(id === 'as') sheet(`Assessments · ${A.asAvg == null ? '–' : A.asAvg + '%'}`, r.l + (B.asAvg != null ? ` · ${r.pl}: ${B.asAvg}%` : ''), 'Weekly, monthly and past papers. SRAs never count.', A.as.slice().reverse().map(x => row(esc(x.sub), `${(window.MARKS ? MARKS.TY[MARKS.akN(x.ak)] : '') || 'Assessment'} · ${dl(x.d)}`, x.p + '%')).join(''));
    if(id === 'fo') sheet(`Focus time · ${dur(A.foM)}`, r.l + ` · ${r.pl}: ${dur(B.foM)}`, 'Finished focus rounds.', A.fo.slice().reverse().map(x => row(esc(x.sub || 'Focus'), dl(x.d), x.m + ' min')).join(''), `Total<span>${dur(A.foM)}</span>`);
    if(id === 'st') sheet(`Study done · ${dur(A.doM)} of ${dur(A.plM)}`, r.l, 'Done = a focus round finished in the block.', A.blocks.map(x => row(esc(x.x.name || 'Study'), `${dl(x.d)} · ${x.x.s}–${x.x.e}`, x.done ? 'done' : x.d < T() ? 'not done' : 'to come', x.done ? 'ok' : x.d < T() ? 'rd' : '')).join(''));
    if(id === 'ses') sheet(`Sessions · ${A.came} of ${A.ses.length}`, r.l, 'Sessions LHQ or the tutor cancelled aren\'t counted.', A.ses.slice().reverse().map(x => row(esc(x[1]), dl(x[0]), x[2] === 'attended' ? 'came' : x[2] === 'late' ? 'late' : x[2] === 'cancelled' ? 'cancelled' : 'absent', x[2] === 'attended' ? 'ok' : x[2] === 'late' ? 'am' : 'rd')).join(''));
  }
  function why(w){
    const {rr} = last, x = w[0] === 'w' ? rr.well[+w.slice(1)] : rr.lag[+w.slice(1)]; if(!x) return;
    if(x.d === 'fade') return openSheet(`<div class="hx"><h3>${esc(x.t)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(x.s)}</p><p class="note">Rule: the latest SRA mark is 10 points or more below the first.</p>`);
    drill(x.d);
  }

  /* ---------- the weekly reflection: private ---------- */
  function reflect(k, wk){
    wk = monOf(/^\d{4}-\d{2}-\d{2}$/.test(wk || '') ? wk : T()); const R0 = ((k.sx || {}).refl || {}), cur = R0[wk] || {}, earlier = Object.keys(R0).filter(x => x < wk).sort().reverse().slice(0, 8);
    return `<a class="crumb" href="#me/review/week/${wk}">‹ Review</a><div class="ph"><div class="tt"><h1>Weekly reflection</h1><p>${dl(wk)} – ${dl(add(wk, 6))} · private 🔒</p></div></div>
      <label class="f"><span>What went well?</span><textarea class="in" id="rfA" rows="3">${esc(cur.a || '')}</textarea></label>
      <label class="f"><span>What will you change?</span><textarea class="in" id="rfB" rows="3">${esc(cur.b || '')}</textarea></label>
      <button class="btn n full" data-rfsave="${wk}">Save</button>
      ${earlier.length ? `<div class="h2">Earlier</div><div class="card">${earlier.map(w => `<a class="it" href="#me/reflect/${w}"><span class="t"><b>${dl(w)} – ${dl(add(w, 6))}</b><small>${esc((R0[w].a || '').slice(0, 60))}</small></span><span class="chev">›</span></a>`).join('')}</div>` : ''}
      <p class="note">Only you see these. Not tutors, parents or LHQ.</p>`;
  }

  /* ---------- school results: the student adds, LHQ checks ---------- */
  let SF = null;
  function school(k){
    const L = terms(k).filter(x => x[1] <= T()), t = T(), cur = L.find(x => x[1] <= t && x[2] >= t) || L.filter(x => x[1] <= t).pop() || ['', '', ''];
    if(!SF || SF.k !== k.name) SF = {k: k.name, term: cur[0], kind: 'mid'};
    const S = (k.sx || {}).school || [], subs = [...new Set((k.subjects || []).map(x => x.sub).concat(S.filter(x => x.out).map(x => x.sub)))], sc = scaleOf(k);
    const get = sb => S.find(x => x.term === SF.term && x.kind === SF.kind && x.sub === sb);
    return `<a class="crumb" href="#me/progress">‹ ${isParent() ? 'Sessions' : 'Progress'}</a><div class="ph"><div class="tt"><h1>School results</h1><p>${esc((k.name || '').split(' ')[0])}${k.school ? ' · ' + esc(k.school) : ''}</p></div></div>
      <label class="f"><span>Term</span><select class="in" id="scT">${L.slice().reverse().map(x => `<option ${x[0] === SF.term ? 'selected' : ''}>${esc(x[0])}</option>`).join('')}</select></label>
      <div class="seg" style="display:flex;margin-bottom:12px">${[['mid','Mid-term'],['end','End of term']].map(([v, l]) => `<button style="flex:1" class="${SF.kind === v ? 'on' : ''}" data-sck="${v}">${l}</button>`).join('')}</div>
      <div class="card">${subs.map(sb => { const v = get(sb), lock = v && v.ok;
        return `<div class="it rv-sr"><span class="t"><b>${esc(sb)}</b><small>${v ? (v.ok ? '✓ LHQ' : '○ LHQ checks') : ''}${v && !k.subjects.some(x => x.sub === sb) ? ' · not at LHQ' : ''}</small></span>
          ${isParent() || lock ? `<b>${v ? esc(v.gr || '') + (v.pc != null ? ' · ' + v.pc + '%' : '') : '–'}</b>` : `<select class="in" data-scg="${esc(sb)}"><option value="">–</option><optgroup label="A*–G">${SCALES['A*–G'].map(g => `<option ${v && v.gr === g ? 'selected' : ''}>${g}</option>`).join('')}</optgroup><optgroup label="9–1">${SCALES['9–1'].slice(0, -1).map(g => `<option ${v && v.gr === g ? 'selected' : ''}>${g}</option>`).join('')}</optgroup></select><input class="in" data-scp="${esc(sb)}" inputmode="numeric" placeholder="%" value="${v && v.pc != null ? v.pc : ''}">`}</div>`; }).join('')}</div>
      ${isParent() ? '' : `<button class="btn full" data-scout style="margin-bottom:8px">+ A subject not at LHQ</button><button class="btn n full" data-scsave>Save</button><p class="note" style="margin-top:8px">% optional. Yours show "LHQ checks" until LHQ confirms.</p>`}`;
  }
  /* each subject: school results against LHQ's assessment average for the same term, and the target */
  function chart(k, sb){
    const S = ((k.sx || {}).school || []).filter(x => x.sub === sb && x.pc != null), L = terms(k);
    const pts = L.map(t => { const m = S.filter(x => x.term === t[0]).sort((a, b) => a.kind.localeCompare(b.kind)), la = avg(((k.marks || {}).w || []).filter(x => x.sub === sb && x.d >= t[1] && x.d <= t[2] && x.p != null).map(x => x.p));
      return m.length || la != null ? {t: t[0], sc: m.length ? m[m.length - 1] : null, la} : null; }).filter(Boolean).slice(-4);
    if(!pts.length) return '';
    const x0 = (k.subjects || []).find(x => x.sub === sb), xi = x0 && window.EXUI && k.exam ? EXUI.info(x0.k, k.exam, []) : null, tg = xi && xi.need != null ? xi.need : null;
    const W = 320, H = 150, y = p => H - 24 - (Math.max(30, Math.min(100, p)) - 30) / 70 * (H - 44), x = i => 40 + i * ((W - 70) / Math.max(1, pts.length - 1));
    return `<div class="h2">School and LHQ</div><div class="card pad"><svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block" role="img" aria-label="School results against LHQ assessments">
      ${tg != null ? `<line x1="20" x2="${W - 8}" y1="${y(tg)}" y2="${y(tg)}" stroke="var(--gold)" stroke-dasharray="5 4" stroke-width="2"/><text x="${W - 10}" y="${y(tg) - 5}" text-anchor="end" font-size="11" fill="var(--muted)">target ${tg}%</text>` : ''}
      <polyline points="${pts.filter(p => p.sc).map(p => x(pts.indexOf(p)) + ',' + y(p.sc.pc)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5"/><polyline points="${pts.filter(p => p.la != null).map(p => x(pts.indexOf(p)) + ',' + y(p.la)).join(' ')}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>
      ${pts.map((p, i) => `${p.sc ? `<circle cx="${x(i)}" cy="${y(p.sc.pc)}" r="6" fill="var(--accent)"/><text x="${x(i)}" y="${y(p.sc.pc) - 10}" text-anchor="middle" font-size="11.5" font-weight="800" fill="var(--ink)">${esc(p.sc.gr || '')}${p.sc.gr ? ' · ' : ''}${p.sc.pc}%</text>` : ''}${p.la != null ? `<rect x="${x(i) - 4}" y="${y(p.la) - 4}" width="8" height="8" fill="var(--muted)"/><text x="${x(i)}" y="${y(p.la) + 18}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${p.la}%</text>` : ''}<text x="${x(i)}" y="${H - 3}" text-anchor="middle" font-size="10" fill="var(--muted)">${esc(p.t)}</text>`).join('')}</svg>
      <div class="sx-lg" style="display:flex;gap:12px;font-size:11.5px;color:var(--muted)"><span>● School</span><span>■ LHQ assessments</span>${tg != null ? '<span style="color:var(--gold)">– – target</span>' : ''}</div></div>`;
  }
  /* LHQ: a student's school results (check the ones the student added, add from what parents send) */
  function lhqCard(st){
    const key = (window.SCHED ? SCHED.nk(st) : st.toLowerCase()), M = Object.values(((store.get('lhq_school', {}) || {})[key]) || {}).sort((a, b) => (b.at || 0) - (a.at || 0)), wait = M.filter(x => !x.ok);
    return `<div class="h2">School results${wait.length ? ` <em>${wait.length} to check</em>` : ''}</div><div class="card">${M.slice(0, 12).map(x => `<div class="it"><span class="f-mk ${x.ok ? 'ok' : ''}">${x.ok ? '✓' : ''}</span><span class="t"><b>${esc(x.sub)} · ${esc(x.gr || '')}${x.pc != null ? ' · ' + x.pc + '%' : ''}</b><small>${esc(x.term)} ${x.kind === 'end' ? 'end of term' : 'mid-term'} · ${x.role === 'student' ? 'from ' + esc(st.split(' ')[0]) : 'by ' + esc(x.by)}${x.out ? ' · not at LHQ' : ''}</small></span>${x.ok ? '' : `<button class="btn sm" data-sclhq="del|${esc(st)}|${x.id}">Remove</button><button class="btn sm n" data-sclhq="ok|${esc(st)}|${x.id}">✓</button>`}</div>`).join('') || '<p class="empty">None yet.</p>'}</div>
      <button class="btn full" data-scadd="${esc(st)}" style="margin-bottom:12px">+ School result</button>`;
  }
  function lhqAdd(st){
    const L = terms0(window.MIN ? MIN.terms() : []).filter(t => t[1] <= (window.HD ? HD.today() : '9999')).reverse(), subs = [...new Set(((window.HD && HD.students && (HD.students().find(x => SCHED.nk(x.name) === SCHED.nk(st)) || {}).subjects) || []))];
    openSheet(`<div class="hx"><h3>School result</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(st)} · from the report or the parents</p>
      <label class="f"><span>Term</span><select class="in" id="slT">${L.map(x => `<option>${esc(x[0])}</option>`).join('')}</select></label>
      <label class="f"><span>When</span><select class="in" id="slK"><option value="mid">Mid-term</option><option value="end">End of term</option></select></label>
      <label class="f"><span>Subject</span><input class="in" id="slS" list="slSL" value="${esc(subs[0] || '')}"><datalist id="slSL">${subs.map(x => `<option>${esc(x)}</option>`).join('')}</datalist></label>
      <div class="r2"><label class="f"><span>Grade</span><input class="in" id="slG" placeholder="e.g. B"></label><label class="f"><span>% (optional)</span><input class="in" id="slP" inputmode="numeric"></label></div>
      <button class="btn n full" id="slGo">Save</button>`);
    $('slGo').onclick = async () => { try{ await hub.api('school', {method: 'POST', body: JSON.stringify({st, row: {term: $('slT').value, kind: $('slK').value, sub: $('slS').value, gr: $('slG').value, pc: $('slP').value}})}); closeSheet(); await hub.pull(); toast('Saved'); render(); }catch(e){ toast(e.message); } };
  }

  /* ---------- taps ---------- */
  const CSS = `.rv-mcs{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.rv-mcs .mc{cursor:pointer;font:inherit;color:inherit;text-align:left}.rv-mcs .mc:hover{border-color:var(--muted)}.rv-mcs .mc:last-child:nth-child(odd){grid-column:1/-1}.rv-mcs .s.u{color:var(--ok);font-weight:700}.rv-mcs .s.dn{color:var(--am);font-weight:700}
.rv-adj{display:flex;flex-wrap:wrap;gap:6px}.rv-sr select{width:76px;flex:none}.rv-sr input{width:64px;flex:none;text-align:right}`;
  let cssOn = false; const css = () => { if(!cssOn){ cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); } };
  function bind(k){
    css();
    const on = (sel, f) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); f(el); });
    on('[data-rvd]', el => drill(el.dataset.rvd)); on('[data-rvw]', el => why(el.dataset.rvw));
    on('[data-rvadj]', el => { const [a, x, y] = el.dataset.rvadj.split('|'); if(!window.SPLAN) return;
      if(a === 'mv') SPLAN.editSheet(k, x, y);
      else { SPLAN.editSheet(k, '', T()); setTimeout(() => { if($('ebN')){ $('ebN').value = 'Revision: ' + x; } const b = document.querySelector('[data-et=rev]'); if(b) b.click(); setTimeout(() => { if($('ebN')) $('ebN').value = 'Revision: ' + x; if($('ebS')) $('ebS').value = y; }, 30); }, 30); } });
    on('[data-rfsave]', async el => { try{ await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'reflect', wk: el.dataset.rfsave, a: $('rfA').value, b: $('rfB').value})}); if(window.FAM && FAM.refresh) await FAM.refresh(); toast('Saved · only you see it'); render(); }catch(e){ toast(e.message); } });
    if($('scT')) $('scT').onchange = () => { SF.term = $('scT').value; render(); };
    on('[data-sck]', el => { SF.kind = el.dataset.sck; render(); });
    on('[data-scout]', () => { openSheet(`<div class="hx"><h3>A subject not at LHQ</h3><button class="ib" data-close>✕</button></div><label class="f"><span>Subject</span><input class="in" id="scN" placeholder="e.g. English"></label><button class="btn n full" id="scNGo">Add</button>`);
      $('scNGo').onclick = () => { const n = $('scN').value.trim(); if(!n) return; (k.sx.school = k.sx.school || []).push({term: SF.term, kind: SF.kind, sub: n, gr: '', pc: null, out: 1}); closeSheet(); render(); }; });
    on('[data-scsave]', async () => { const rows = []; document.querySelectorAll('[data-scg]').forEach(g => { const sb = g.dataset.scg, p = [...document.querySelectorAll('[data-scp]')].find(x => x.dataset.scp === sb); const pc = p ? p.value.trim() : ''; if(g.value || pc) rows.push({term: SF.term, kind: SF.kind, sub: sb, gr: g.value, pc, out: k.subjects.some(x => x.sub === sb) ? 0 : 1}); });
      if(!rows.length) return toast('Add a grade or a %');
      try{ for(const row of rows) await hub.api('family', {method: 'POST', body: JSON.stringify({action: 'school', row})}); if(window.FAM && FAM.refresh) await FAM.refresh(); toast('Saved · LHQ checks'); render(); }catch(e){ toast(e.message); } });
  }
  function bindLHQ(){
    document.querySelectorAll('[data-sclhq]').forEach(b => b.onclick = async () => { const [action, st, id] = b.dataset.sclhq.split('|'); try{ await hub.api('school', {method: 'POST', body: JSON.stringify({action, st, id})}); await hub.pull(); toast(action === 'ok' ? 'Checked' : 'Removed'); render(); }catch(e){ toast(e.message); } });
    document.querySelectorAll('[data-scadd]').forEach(b => b.onclick = () => lhqAdd(b.dataset.scadd));
  }
  return {page, reflect, school, chart, lhqCard, bind, bindLHQ, css, range};
})();
