/* LHQ Hub › tutor KPIs: one set of rules for the Director's pages and the tutor's My performance (server).
   Core KPIs (each with a target, Settings › Tutor KPIs): sessions taught as planned, started and finished on time, logged on the day,
   daily report sent, SRAs on their day and marked within 2 days, make-ups booked within 7 days.
   Watched (no target): students on track, assessments since they started, renewals, observation, and what students say.
   Status over the last 4 weeks: falling short when a KPI is below target `run` weeks running or `many` KPIs are below at once;
   slipping when any is below; else meeting.
   ctx: {cards, entries, treps (array), makeups (array), sreports, targets, kpi: {obs, rev, left}, set (settings), t (today)} */
(function(G){
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const ms = d => Date.parse(d + 'T12:00:00Z'), add = (d, n) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10), days = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
  const dayOf = at => at ? new Date(at + 2 * 3600e3).toISOString().slice(0, 10) : '';   // Malawi time
  const mins = s => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  const W3 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], M3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dl = d => { const x = new Date(ms(d)); return `${W3[x.getUTCDay()]} ${x.getUTCDate()} ${M3[x.getUTCMonth()]}`; };
  const CORE = [['ses','Sessions taught as planned',95],['ont','Started and finished on time',95],['log','Logged on the day',95],['rep','Daily report sent',100],['sra','SRAs on their day, marked in 2 days',90],['mku','Make-ups booked within 7 days',90]];
  const WATCH = [['otr','Students on track'],['agr','Assessments since they started'],['ars','ARS with SRAs'],['ren','Renewals'],['obs','Observation'],['rat','Session rating'],['pre','Came prepared'],['gui','Guide before the session']];
  const FEEDBACK = ['rat','pre','gui'];
  const CRIT = ['Prepared and on time','Explanations','Checks understanding','Student engagement','Uses SRAs and assessments','Time used well'];
  const conf = set => { const k = (set || {}).kpi || {}; return {tg: Object.assign({}, Object.fromEntries(CORE.map(c => [c[0], c[2]])), k.tg || {}), run: +k.run || 2, many: +k.many || 3, admin: !!k.admin, tutors: !!k.tutors}; };

  /* periods: week (Monday), month, term (school terms from Settings, else the month) */
  function range(type, d, terms){
    if(type === 'day') return {type, a: d, b: d};
    if(type === 'week'){ const w = new Date(ms(d)).getUTCDay(), a = add(d, -((w + 6) % 7)); return {type, a, b: add(a, 6)}; }
    if(type === 'term' && Array.isArray(terms) && terms.length){
      const L = terms.slice().sort((x, y) => x[1].localeCompare(y[1])), i = L.findIndex(x => x[1] <= d && x[2] >= d);
      const T = i >= 0 ? L[i] : L.filter(x => x[2] < d).pop() || L[0]; return {type, a: T[1], b: T[2], name: T[0]};
    }
    const a = d.slice(0, 8) + '01', e = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).toISOString().slice(0, 10); return {type: 'month', a, b: e};
  }
  function shift(r, n, terms){
    if(r.type === 'week') return range('week', add(r.a, 7 * n));
    if(r.type === 'term' && terms && terms.length){ const L = terms.slice().sort((x, y) => x[1].localeCompare(y[1])), i = L.findIndex(x => x[1] === r.a), T = L[i + n]; return T ? range('term', T[1], terms) : null; }
    const d = new Date(ms(r.a)); d.setUTCMonth(d.getUTCMonth() + n); return range('month', d.toISOString().slice(0, 10));
  }
  const rangeL = r => r.type === 'week' ? 'Week of ' + dl(r.a) : r.type === 'term' ? `${r.name} ${r.a.slice(0, 4)}` : ['January','February','March','April','May','June','July','August','September','October','November','December'][+r.a.slice(5, 7) - 1] + ' ' + r.a.slice(0, 4);

  /* everyone who teaches on a card */
  const tutors = ctx => [...new Set((ctx.cards || []).filter(c => c && !c.del && (c.type || 'card') === 'card').flatMap(c => (c.subjects || []).map(x => String(x.tutor || '').trim())).filter(Boolean))].sort();

  /* ---------- one tutor, one range: every figure with the rows behind it ---------- */
  function figures(ctx, tutor, r){
    const S = G.SCHED, t = ctx.t, tn = nk(tutor), e = r.b < t ? r.b : t, E = (ctx.entries || []).filter(x => x && !x.x);
    const mineE = E.filter(x => nk(x.tutor) === tn);
    const P = S.sessions(ctx.cards, r.a, e, {tutor}), logOf = p => E.find(x => x.ty === 's' && x.k === p.k && x.d === p.date && !x.mk);
    const out = {};
    const put = (id, ok, bad, rows, extra) => { out[id] = Object.assign({id, k: ok, n: ok + bad, v: ok + bad ? Math.round(ok / (ok + bad) * 100) : null, rows}, extra || {}); };
    const row = (mk, title, sub, href, sort) => ({mk, t: title, s: sub, href: href || '', sort: sort || ''});
    const who = p => `${dl(p.date)} · ${p.student}`;
    /* sessions taught as planned (a student's absence isn't counted) */
    { let ok = 0, bad = 0; const R = [];
      P.forEach(p => { const l = logOf(p); if(!l && p.date >= t) return; if(l && l.a === 'absent'){ R.push(row('no', who(p), 'Student absent · not counted', '', p.date)); return; }
        if(l && l.a !== 'cancelled'){ ok++; R.push(row('ok', who(p), `Taught${l.t1 ? ' · ' + l.t1 + '–' + (l.t2 || '') : ''}`, '', p.date)); }
        else { bad++; R.push(row('rd', who(p), l ? 'Cancelled' : 'Not logged', '', p.date)); } });
      put('ses', ok, bad, R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok') || y.sort.localeCompare(x.sort))); }
    /* started and finished on time (5 minutes either way) */
    { let ok = 0, bad = 0; const R = [];
      P.forEach(p => { const l = logOf(p); if(!l || l.a === 'absent' || l.a === 'cancelled' || !l.t1 || !l.t2 || p.a == null || p.b == null) return;
        const late = mins(l.t1) - p.a, early = p.b - mins(l.t2);
        if(late > 5 || early > 5){ bad++; R.push(row('bad', who(p), [late > 5 ? `started ${l.t1} · ${late} min late` : '', early > 5 ? `ended ${l.t2} · ${early} min early` : ''].filter(Boolean).join(' · '), '', p.date)); }
        else { ok++; R.push(row('ok', who(p), `${l.t1}–${l.t2}`, '', p.date)); } });
      put('ont', ok, bad, R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok') || y.sort.localeCompare(x.sort))); }
    /* logged on the day: every session they logged in the range, and planned ones never logged */
    { let ok = 0, bad = 0; const R = [], seen = new Set();
      mineE.filter(x => x.ty === 's' && x.d >= r.a && x.d <= e).forEach(l => { seen.add(l.k + '|' + l.d); const on = dayOf(l.c || l.at);
        if(on && on <= l.d){ ok++; R.push(row('ok', `${dl(l.d)} · ${l.st}`, 'logged on the day', '', l.d)); } else { bad++; R.push(row('bad', `${dl(l.d)} · ${l.st}`, on ? 'logged ' + dl(on) : 'logged later', '', l.d)); } });
      P.forEach(p => { if(p.date < t && !seen.has(p.k + '|' + p.date)){ bad++; R.push(row('rd', who(p), 'not logged', '', p.date)); } });
      put('log', ok, bad, R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok') || y.sort.localeCompare(x.sort))); }
    /* daily report sent on each day they taught */
    { let ok = 0, bad = 0; const R = [], D = new Set(P.map(p => p.date).concat(mineE.filter(x => x.ty === 's' && x.d >= r.a && x.d <= e).map(x => x.d)));
      const reps = (ctx.treps || []).filter(x => x && nk(x.tutor) === tn);
      [...D].sort().reverse().forEach(d => { const x = reps.find(y => y.d === d), on = x ? dayOf(x.sent || x.at) : '';
        if(!x && d >= t) return;
        if(x && on <= d){ ok++; R.push(row('ok', dl(d), 'sent ' + new Date((x.sent || x.at) + 2 * 3600e3).toISOString().slice(11, 16))); }
        else { bad++; R.push(row(x ? 'bad' : 'rd', dl(d), x ? 'sent ' + dl(on) : 'not sent')); } });
      put('rep', ok, bad, R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok'))); }
    /* SRAs given on their day, and marked within 2 days of coming back */
    { let ok = 0, bad = 0; const R = [];
      const its = S.items(ctx.cards, t).filter(it => nk(it.tutor) === tn);
      /* given on or before its do-on day counts (handed out early, or at the session before); one handed in counts as given */
      if(G.SRA && its.length) G.SRA.build(its, E, t).filter(x => x.stage > 0 && x.doOn >= r.a && x.doOn <= e && !['after','pack','home'].includes(x.status)).forEach(x => {
        const nm = `${x.topic} ${x.label} · ${x.st}`, g = x.given ? x.given.d : '', back = x.handed && x.handed.h !== 'm';
        if(!g && !back && x.doOn >= t) return;
        if(back && !g || g && g <= x.doOn){ ok++; R.push(row('ok', nm, g ? 'given ' + dl(g) : 'handed in', '', x.doOn)); }
        else { bad++; R.push(row(g ? 'bad' : 'rd', nm, `for ${dl(x.doOn)} · ${g ? 'given ' + dl(g) : 'not given'}`, '', x.doOn)); } });
      mineE.filter(x => x.ty === 'r' && x.v === 2 && x.h !== 'm' && x.d >= r.a && x.d <= e).forEach(x => { const on = dayOf(x.c || x.at), n = on ? days(x.d, on) : 9;
        const nm = `${x.tk} R${x.rv} · ${x.st}`;
        if(n <= 2){ ok++; R.push(row('ok', nm, n ? `marked ${n} day${n > 1 ? 's' : ''} after` : 'marked the same day', '', x.d)); }
        else { bad++; R.push(row('bad', nm, `back ${dl(x.d)} · marked ${dl(on)} · ${n} days`, '', x.d)); } });
      put('sra', ok, bad, R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok') || y.sort.localeCompare(x.sort))); }
    /* make-ups booked within 7 days of being owed */
    { let ok = 0, bad = 0; const R = [];
      const MU = (ctx.makeups || []).filter(m => m && m.status !== 'no');
      E.filter(x => x.ty === 's' && !x.mk && (x.a === 'absent' || x.a === 'cancelled') && x.d >= r.a && x.d <= e && P.some(p => p.k === x.k)).forEach(x => {
        const m = MU.filter(m => m.k === x.k && dayOf(m.at) >= x.d).sort((p, q) => (p.at || 0) - (q.at || 0))[0], n = m ? days(x.d, dayOf(m.at)) : null;
        if(m && n <= 7){ ok++; R.push(row('ok', x.st, `owed ${dl(x.d)} · booked ${dl(dayOf(m.at))}`, '', x.d)); }
        else if(!m && days(x.d, t) <= 7) return;
        else { bad++; R.push(row(m ? 'bad' : 'rd', x.st, `owed ${dl(x.d)} · ${m ? 'booked after ' + n + ' days' : 'not booked'}`, '', x.d)); } });
      put('mku', ok, bad, R); }

    /* ---------- watched ---------- */
    const its = S.items(ctx.cards, t).filter(it => nk(it.tutor) === tn), X = G.EXAMS;
    const pc = x => +x.mx > 0 && x.sc != null && x.sc !== '' ? Math.round(x.sc / x.mx * 100) : null;
    const marksOf = k => E.filter(x => x.ty === 'w' && x.k === k && !x.abs && pc(x) != null && x.d <= e).sort((p, q) => p.d.localeCompare(q.d));
    { const R = []; let ok = 0, n = 0;
      if(X) its.forEach(it => { const tg = (ctx.targets || {})[it.k]; if(!tg || !tg.g || !tg.ex) return; const tp = X.pctOf(tg.g, X.scale(tg.ex, tg.code), ctx.set || {}); const o = X.onTrack(marksOf(it.k).map(x => ({d: x.d, p: pc(x)})), tp); if(o.ok == null) return;
        n++; if(o.ok) ok++; R.push(row(o.ok ? 'ok' : 'bad', `${it.st} · ${it.sub}`, `${o.avg}% · target ${tg.g}`)); });
      out.otr = {id: 'otr', k: ok, n, val: n ? `${ok} of ${n}` : '–', num: n ? ok / n * 100 : null, rows: R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok'))}; }
    { const R = []; let sum = 0, n = 0;
      its.forEach(it => { const M = marksOf(it.k); if(M.length < 6) return; const f = M.slice(0, 3).reduce((s, x) => s + pc(x), 0) / 3, l = M.slice(-3).reduce((s, x) => s + pc(x), 0) / 3, dlt = Math.round(l - f);
        n++; sum += dlt; R.push(row(dlt >= 0 ? 'ok' : 'bad', `${it.st} · ${it.sub}`, `${Math.round(f)} → ${Math.round(l)}%`)); });
      out.agr = {id: 'agr', n, val: n ? `${sum / n >= 0 ? '+' : ''}${Math.round(sum / n)} pts` : '–', num: n ? sum / n : null, rows: R}; }
    { const R = []; let ok = 0, n = 0; const left = (ctx.kpi || {}).left || {};
      its.forEach(it => (it.periods || []).forEach(p => { if(!(p.b >= r.a && p.b <= e)) return; const key = it.k + '|' + p.b, lf = left[key];
        const ren = (it.periods || []).some(q => q.a > p.b);
        if(lf && !ren){ R.push(Object.assign(row('no', `${it.st} · ${it.sub}`, `ended ${dl(p.b)} · left: ${lf.why}`), {left: key})); return; }
        n++; if(ren) ok++; R.push(Object.assign(row(ren ? 'ok' : 'rd', `${it.st} · ${it.sub}`, `ended ${dl(p.b)} · ${ren ? 'renewed' : 'not renewed'}`), ren ? {} : {left: key})); }));
      out.ren = {id: 'ren', k: ok, n, val: n ? `${ok} of ${n}` : '–', num: n ? ok / n * 100 : null, rows: R}; }
    { const O = Object.values((ctx.kpi || {}).obs || {}).filter(o => o && nk(o.tutor) === tn).sort((a, b) => b.d.localeCompare(a.d)), inR = O.filter(o => o.d >= r.a && o.d <= e);
      const sc = o => { const v = Object.values(o.c || {}).map(Number).filter(x => x > 0); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
      const L = inR.length ? inR : O.slice(0, 1), avg = L.length ? L.reduce((s, o) => s + (sc(o) || 0), 0) / L.length : null;
      out.obs = {id: 'obs', n: L.length, val: avg != null ? avg.toFixed(1) + ' / 5' : '–', num: avg, note: inR.length ? `${inR.length} visit${inR.length > 1 ? 's' : ''}` : O.length ? 'last ' + dl(O[0].d) : 'none yet',
        rows: O.map(o => Object.assign(row(sc(o) >= 3.5 ? 'ok' : 'bad', `${dl(o.d)} · ${o.st || ''}${o.md ? ' · ' + o.md : ''}`, `${sc(o) != null ? sc(o).toFixed(1) + ' / 5' : ''}${o.n ? ' · ' + o.n : ''}`), {obs: o.id}))}; }
    { const L = G.SREP ? G.SREP.rows(ctx.sreports || {}).filter(x => nk(x.tutor) === tn && x.d >= r.a && x.d <= e) : [], st = G.SREP && L.length ? G.SREP.stats(L) : null;
      const R = L.sort((a, b) => b.d.localeCompare(a.d)).map(x => row(+x.rate >= 4 ? 'ok' : 'bad', `${dl(x.d)} · ${x.st}`, `${x.rate || '–'} · ${x.prep === 'Yes' ? 'prepared' : (x.prep || '').toLowerCase() + ' prepared'} · guide before ${x.gb ? '✓' : '✕'}`));
      out.rat = {id: 'rat', n: L.length, val: st ? String(st.rate) : '–', num: st ? st.rate : null, rows: R};
      out.pre = {id: 'pre', n: L.length, val: st ? st.prep + '%' : '–', num: st ? st.prep : null, rows: R};
      out.gui = {id: 'gui', n: L.length, val: st ? st.gb + '%' : '–', num: st ? st.gb : null, rows: R}; }
    /* ARS collected with the SRAs they marked (handed in) */
    { const R = []; let ok = 0, n = 0;
      mineE.filter(x => x.ty === 'r' && x.v === 2 && x.h !== 'm' && x.d >= r.a && x.d <= e).forEach(x => { const has = !x.na && +x.ao > 0 && x.ars != null && x.ars !== ''; n++; if(has) ok++;
        R.push(row(has ? 'ok' : 'bad', `${x.tk} ${x.rv ? 'R' + x.rv : 'LD'} · ${x.st}`, has ? `ARS ${x.ars}/${x.ao}` : 'no ARS', '', x.d)); });
      out.ars = {id: 'ars', k: ok, n, val: n ? `${ok} of ${n}` : '–', num: n ? ok / n * 100 : null, rows: R.sort((x, y) => (x.mk === 'ok') - (y.mk === 'ok') || y.sort.localeCompare(x.sort))}; }
    out.students = new Set(its.map(it => it.k.split('|')[0])).size;
    return out;
  }
  /* LHQ's figure: every tutor's counts added together (averages of the watched ones) */
  function lhq(ctx, r, all){
    const F = (all || tutors(ctx)).map(tu => figures(ctx, tu, r)), o = {};
    CORE.forEach(([id]) => { const k = F.reduce((s, f) => s + (f[id].k || 0), 0), n = F.reduce((s, f) => s + (f[id].n || 0), 0); o[id] = n ? Math.round(k / n * 100) : null; });
    ['otr','ren','ars'].forEach(id => { const k = F.reduce((s, f) => s + (f[id].k || 0), 0), n = F.reduce((s, f) => s + (f[id].n || 0), 0); o[id] = n ? Math.round(k / n * 100) + '%' : '–'; });
    const av = (id, fmt) => { const L = F.map(f => f[id]).filter(x => x.num != null); return L.length ? fmt(L.reduce((s, x) => s + x.num, 0) / L.length) : '–'; };
    o.agr = av('agr', v => (v >= 0 ? '+' : '') + Math.round(v) + ' pts'); o.obs = av('obs', v => v.toFixed(1));
    const SL = G.SREP ? G.SREP.rows(ctx.sreports || {}).filter(x => x.d >= r.a && x.d <= (r.b < ctx.t ? r.b : ctx.t)) : [], st = SL.length ? G.SREP.stats(SL) : null;
    o.rat = st ? String(st.rate) : '–'; o.pre = st ? st.prep + '%' : '–'; o.gui = st ? st.gb + '%' : '–';
    return o;
  }
  /* the status over the last 4 weeks, and which KPIs have been below 2+ weeks running */
  function status(ctx, tutor){
    const c = conf(ctx.set), t = ctx.t, f4 = figures(ctx, tutor, {type: 'w4', a: add(t, -27), b: t});
    const below = CORE.filter(([id]) => f4[id].v != null && f4[id].v < c.tg[id]).map(x => x[0]);
    const run = {}; CORE.forEach(([id]) => { let n = 0; for(let w = 0; w < 8; w++){ const f = figures(ctx, tutor, {type: 'wk', a: add(t, -7 * w - 6), b: add(t, -7 * w)})[id]; if(f.v != null && f.v < c.tg[id]) n++; else if(f.n || w > 0) break; } run[id] = n; });
    const longRun = CORE.filter(([id]) => run[id] >= c.run).map(x => x[0]);
    const n = CORE.filter(([id]) => f4[id].n > 0).length;
    const lvl = !n ? 'none' : longRun.length || below.length >= c.many ? 'short' : below.length ? 'slip' : 'ok';
    return {lvl, below, run, longRun, met: n - below.length, of: n};
  }
  const statusL = s => ({short: 'Falling short', slip: 'Slipping', ok: 'Meeting', none: 'No sessions yet'})[s.lvl];
  const NAMES = Object.fromEntries(CORE.concat(WATCH).map(x => [x[0], x[1]]));
  const why = s => s.lvl === 'short' && s.longRun.length ? s.longRun.map(id => NAMES[id]).join(', ') + ` · ${Math.max(...s.longRun.map(id => s.run[id]))} weeks running` : s.below.length ? s.below.map(id => NAMES[id]).join(', ') : s.lvl === 'none' ? '' : 'all ' + s.of + ' at target';

  G.KPI = {CORE, WATCH, FEEDBACK, CRIT, NAMES, conf, range, shift, rangeL, tutors, figures, lhq, status, statusL, why, dl, add, dayOf, nk};
})(typeof window !== 'undefined' ? window : globalThis);
