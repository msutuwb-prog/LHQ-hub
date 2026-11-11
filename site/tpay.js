/* LHQ Hub › Tutor pay: a month's payslip worked out from the tutors' session logs, with the rows behind every line.
   Shared by the Hub (Director, or Admin with Tutor pay) and the server (confirming, the tutor's own payslips).

   kv lhq_pay (Director, or Tutor pay): {
     rules: see DEF,
     place: {"tutor key": [{p: 'full'|'part', from: 'YYYY-MM-DD'}]},
     items: {id: {id, tutor, m: 'YYYY-MM', kind: 'allowance'|'bonus'|'deduction'|'advance', label, amt, d, by, at}},
     slips: {"tutor key|YYYY-MM": {st: 'confirmed'|'signed', snap, by, at, sAt, q: {note, at}}} }

   What counts (agreed 30 Oct, 11 Nov):
   - A session is one log (one group: a class or a group is one session). Paid when at least one student was taught.
   - Not paid: no student came; cancelled (by the tutor, LHQ or the student: each shown on its own line).
   - Minutes lost: a late start or early finish against the timetable, beyond the grace minutes, as a share of the fee
     (fee ÷ session length × minutes). A settled dispute's minutes are added.
   - Held: a session a student disputed and LHQ hasn't settled. Paid on the payslip of the month it's settled.
   - Part-time: fee per session by type (in person, online; a class's programme rate replaces it); normal sessions up to the cap;
     after-hours (starting at or after the set time) and weekend sessions on top, at the same fee.
   - Full-time: salary by days of the month in that placement; weekday after-hours sessions get overtime; each weekend day taught
     gets transport, and lunch when the hours taught that day reach the set hours; minutes lost taken off at the in-person fee. */
(function(G){
  const DEF = {inp: 8000, onl: 7000, cap: 350000, after: '17:00', salary: 350000, transport: 10000, lunch: 5000, lunchH: 5, overtime: 6000, lenTerm: 50, lenHol: 45, grace: 5, progs: []};
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pad = n => String(n).padStart(2, '0');
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const wd = d => new Date(d + 'T00:00:00Z').getUTCDay();
  const dl = d => `${DAYS[wd(d)]} ${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}`;
  const ml = m => `${['January','February','March','April','May','June','July','August','September','October','November','December'][+m.slice(5) - 1]} ${m.slice(0, 4)}`;
  const dim = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();
  const n0 = n => Math.round(+n || 0).toLocaleString('en-US');
  const rules = pay => Object.assign({}, DEF, (pay && pay.rules) || {});
  const placeOn = (pay, tutor, d) => { const L = (((pay || {}).place || {})[nk(tutor)] || []).filter(x => x.from <= d).sort((a, b) => b.from.localeCompare(a.from)); return L.length ? L[0].p : null; };
  const placeNow = (pay, tutor, t) => placeOn(pay, tutor, t) || 'part';
  const short = s => String(s || '').trim().split(/\s+/)[0];

  /* the tutors with logs or a placement */
  function tutors(ctx){
    const S = new Map(); (ctx.entries || []).forEach(e => { if(e && !e.x && e.ty === 's' && e.tutor) S.set(nk(e.tutor), e.tutor); });
    (ctx.cards || []).forEach(c => (c.subjects || []).forEach(s => { if(s.tutor && !S.has(nk(s.tutor))) S.set(nk(s.tutor), s.tutor); }));
    Object.keys((ctx.pay || {}).place || {}).forEach(k => { if(!S.has(k)) S.set(k, k.replace(/\b\w/g, c => c.toUpperCase())); });
    return [...S.values()].sort();
  }

  /* one month's payslip */
  function month(ctx, tutor, m){
    const R = rules(ctx.pay), tn = nk(tutor), a = m + '-01', b = m + '-' + pad(dim(m)), t = ctx.t;
    const E = (ctx.entries || []).filter(e => e && !e.x && nk(e.tutor) === tn);
    const classes = ctx.classes || [], className = id => ((classes.find(c => c.id === id) || {}).name || '');
    const plan = (G.SCHED && ctx.cards) ? G.SCHED.sessions(ctx.cards, a, b, {tutor}) : [];
    /* sessions: one per log group */
    const groups = new Map();
    E.filter(e => e.ty === 's' && e.d >= a && e.d <= b).forEach(e => { const g = e.grp || e.id; if(!groups.has(g)) groups.set(g, []); groups.get(g).push(e); });
    const SES = [...groups.values()].map(L => {
      const e = L[0], p = plan.find(x => x.date === e.d && L.some(y => y.k === x.k));
      const taughtL = L.filter(x => x.a === 'attended' || x.a === 'late'), cf = L.map(x => x.cf).find(c => c && (c.s === 'disputed' || c.s === 'settled')) || null;
      const pa = p ? p.a : mins(e.t1), pb = p ? p.b : mins(e.t2), len = pa != null && pb != null && pb > pa ? pb - pa : R.lenTerm;
      const who = L.length > 1 ? (className(e.cls) || L.map(x => short(x.st)).join(', ')) : e.st;
      return {d: e.d, L, e, who, sub: e.sub, t1: e.t1 || (p ? p.s : ''), t2: e.t2 || (p ? p.e : ''), pa, pb, len, online: e.md === 'o' || /o$/.test(e.fmt || ''), cls: e.cls || '', cname: className(e.cls),
        taught: taughtL.length > 0, cancelled: !taughtL.length && L.some(x => x.a === 'cancelled'), cb: (L.find(x => x.cb) || {}).cb || '', cf, mk: !!e.mk};
    }).sort((x, y) => (x.d + (x.t1 || '')).localeCompare(y.d + (y.t1 || '')));
    const lostOf = s => { if(!s.taught) return {late: 0, early: 0, lost: 0};
      const late = s.pa != null && mins(s.t1) != null ? Math.max(0, mins(s.t1) - s.pa) : 0, early = s.pb != null && mins(s.t2) != null ? Math.max(0, s.pb - mins(s.t2)) : 0;
      let lost = late + early <= R.grace ? 0 : late + early; if(s.cf && s.cf.s === 'settled' && s.cf.out === 'lost') lost += +s.cf.lost || 0; return {late, early, lost}; };
    const isWkd = s => wd(s.d) === 0 || wd(s.d) === 6, isAft = s => (s.pa != null ? s.pa : mins(s.t1)) >= mins(R.after);
    const prog = s => s.cname ? (R.progs || []).find(x => x.name && nk(s.cname).includes(nk(x.name))) : null;
    const time = s => `${s.t1 || '?'}–${s.t2 || '?'}`, rowS = (s, v, extra) => ({t: `${s.who} · ${s.sub}`, s: `${dl(s.d)} · ${time(s)}${s.mk ? ' · make-up' : ''}${extra ? ' · ' + extra : ''}`, v});

    const lines = [], add = (id, grp, label, sub, amt, rows, extra) => lines.push(Object.assign({id, grp, label, sub, amt: Math.round(amt), rows}, extra || {}));
    const notPaid = SES.filter(s => !s.taught), held = SES.filter(s => s.taught && s.cf && s.cf.s === 'disputed'), paid = SES.filter(s => s.taught && !(s.cf && s.cf.s === 'disputed'));
    const placeOf = s => placeOn(ctx.pay, tutor, s.d) || 'part';
    const P = paid.filter(s => placeOf(s) === 'part'), F = paid.filter(s => placeOf(s) === 'full');
    let paidCount = paid.length;

    /* salary: by the days of the month in full-time placement */
    const fullDays = Array.from({length: dim(m)}, (_, i) => m + '-' + pad(i + 1)).filter(d => placeOn(ctx.pay, tutor, d) === 'full').length;
    if(fullDays) add('sal', 'salary', 'Salary', fullDays < dim(m) ? `${fullDays} of ${dim(m)} days full-time` : 'weekday sessions included', R.salary * fullDays / dim(m),
      [{t: ml(m), s: `${fullDays} of ${dim(m)} days · ${n0(R.salary)} a month`, v: n0(R.salary * fullDays / dim(m))}].concat(F.filter(s => !isWkd(s) && !isAft(s)).map(s => rowS(s, 'in salary'))));

    /* part-time: normal sessions up to the cap */
    if(P.length){
      const fee = s => { const pr = prog(s); return pr ? +pr.rate : s.online ? R.onl : R.inp; };
      const norm = P.filter(s => !isWkd(s) && !isAft(s)), top = P.filter(s => isWkd(s) || isAft(s));
      const inp = norm.filter(s => !prog(s) && !s.online), onl = norm.filter(s => !prog(s) && s.online), pg = norm.filter(s => prog(s));
      if(inp.length) add('inp', 'cap', 'In person', `${inp.length} × ${n0(R.inp)}`, inp.length * R.inp, inp.map(s => rowS(s, n0(R.inp))));
      if(onl.length) add('onl', 'cap', 'Online', `${onl.length} × ${n0(R.onl)}`, onl.length * R.onl, onl.map(s => rowS(s, n0(R.onl))));
      const byP = {}; pg.forEach(s => { const pr = prog(s); (byP[pr.name] = byP[pr.name] || {pr, L: []}).L.push(s); });
      Object.values(byP).forEach(({pr, L}) => add('prg:' + pr.name, 'cap', pr.name, `${L.length} × ${n0(pr.rate)} · programme rate`, L.length * pr.rate, L.map(s => rowS(s, n0(pr.rate)))));
      const sum = norm.reduce((x, s) => x + fee(s), 0);
      add('cap', 'capline', 'Up to the cap', `${n0(Math.min(sum, R.cap))} of ${n0(R.cap)}`, sum > R.cap ? R.cap - sum : 0,
        [{t: 'Normal sessions', s: `${norm.length} sessions`, v: n0(sum)}, {t: 'Cap', s: 'Settings › Tutor pay', v: n0(R.cap)}].concat(sum > R.cap ? [{t: 'Over the cap', s: 'not paid', v: '− ' + n0(sum - R.cap)}] : []), {sum, cap: R.cap});
      const aft = top.filter(s => !isWkd(s)), wk = top.filter(isWkd);
      if(aft.length) add('aft', 'top', 'After hours', `${aft.length} from ${R.after} · on top`, aft.reduce((x, s) => x + fee(s), 0), aft.map(s => rowS(s, n0(fee(s)))));
      if(wk.length) add('wkd', 'top', 'Weekend', `${wk.length} × fee · on top`, wk.reduce((x, s) => x + fee(s), 0), wk.map(s => rowS(s, n0(fee(s)))));
      const lostP = P.map(s => [s, lostOf(s)]).filter(([, l]) => l.lost);
      if(lostP.length || P.some(s => { const l = lostOf(s); return l.late + l.early > 0; })){
        const all = P.map(s => [s, lostOf(s)]).filter(([, l]) => l.late + l.early > 0 || l.lost);
        const amt = lostP.reduce((x, [s, l]) => x + fee(s) / s.len * l.lost, 0), mn = lostP.reduce((x, [, l]) => x + l.lost, 0);
        add('min', 'not', 'Minutes lost', `${mn} min · a share of each fee`, -amt, all.map(([s, l]) => rowS(s, l.lost ? '− ' + n0(fee(s) / s.len * l.lost) : '0',
          [l.late ? `${l.late} min late` : '', l.early ? `${l.early} min early` : '', s.cf && s.cf.s === 'settled' && s.cf.lost ? `${s.cf.lost} min from a settled dispute` : '', !l.lost ? `within ${R.grace}` : ''].filter(Boolean).join(' · '))), {mins: mn});
      }
    }
    /* full-time: overtime, weekend days, minutes lost */
    if(F.length){
      const ot = F.filter(s => !isWkd(s) && isAft(s));
      if(ot.length) add('ovt', 'top', 'Overtime', `${ot.length} weekday sessions from ${R.after} × ${n0(R.overtime)}`, ot.length * R.overtime, ot.map(s => rowS(s, n0(R.overtime))));
      const days = {}; F.filter(isWkd).forEach(s => { (days[s.d] = days[s.d] || []).push(s); });
      const D = Object.entries(days).sort(), hrs = L => L.reduce((x, s) => x + (s.pa != null && s.pb != null ? (s.pb - s.pa) : R.lenTerm), 0) / 60;
      if(D.length) add('trn', 'top', 'Transport', `${D.length} weekend day${D.length > 1 ? 's' : ''} × ${n0(R.transport)}`, D.length * R.transport, D.map(([d, L]) => ({t: dl(d), s: `${L.length} session${L.length > 1 ? 's' : ''} · ${hrs(L).toFixed(1)} h`, v: n0(R.transport)})));
      const LD = D.filter(([, L]) => hrs(L) >= R.lunchH);
      if(LD.length) add('lun', 'top', 'Lunch', `${LD.length} whole day${LD.length > 1 ? 's' : ''} (${R.lunchH} h+) × ${n0(R.lunch)}`, LD.length * R.lunch, LD.map(([d, L]) => ({t: dl(d), s: `${hrs(L).toFixed(1)} h taught`, v: n0(R.lunch)})));
      const lostF = F.map(s => [s, lostOf(s)]).filter(([, l]) => l.lost);
      if(lostF.length){ const mn = lostF.reduce((x, [, l]) => x + l.lost, 0);
        add('minf', 'not', 'Minutes lost', `${mn} min · at the in-person fee`, -lostF.reduce((x, [s, l]) => x + R.inp / s.len * l.lost, 0), lostF.map(([s, l]) => rowS(s, '− ' + n0(R.inp / s.len * l.lost), `${l.lost} min`)), {mins: mn}); }
    }
    /* not paid, held, and held sessions from earlier months settled this month */
    const np = (id, label, L) => { if(L.length) add(id, 'not', label, `${L.length} session${L.length > 1 ? 's' : ''}`, 0, L.map(s => rowS(s, '0'))); };
    np('nos', 'Student didn\'t come', notPaid.filter(s => !s.cancelled));
    np('can', 'Cancelled by the tutor', notPaid.filter(s => s.cancelled && (s.cb === 'tutor' || !s.cb)));
    np('canl', 'Cancelled by LHQ', notPaid.filter(s => s.cancelled && s.cb === 'lhq'));
    np('cans', 'Cancelled by the student', notPaid.filter(s => s.cancelled && s.cb === 'student'));
    const feeOf = s => placeOf(s) === 'full' ? 0 : (prog(s) ? +prog(s).rate : s.online ? R.onl : R.inp);
    if(held.length) add('held', 'held', 'Held', `${held.length} in dispute · paid once settled`, 0, held.map(s => rowS(s, n0(feeOf(s)), `"${(s.cf.note || '').slice(0, 60)}"`)), {owed: held.reduce((x, s) => x + feeOf(s), 0)});
    const late = (ctx.entries || []).filter(e => e && !e.x && e.ty === 's' && nk(e.tutor) === tn && e.d < a && e.cf && e.cf.s === 'settled' && e.cf.at && new Date(e.cf.at).toISOString().slice(0, 7) === m && (e.a === 'attended' || e.a === 'late'));
    const lateG = [...new Map(late.map(e => [e.grp || e.id, e])).values()];
    if(lateG.length){ const S2 = lateG.map(e => ({d: e.d, who: e.st, sub: e.sub, t1: e.t1, t2: e.t2, online: e.md === 'o', cname: className(e.cls), L: [e]}));
      paidCount += S2.length; add('set', 'top', 'Held, now settled', `${S2.length} from earlier months`, S2.reduce((x, s) => x + (placeOn(ctx.pay, tutor, s.d) === 'full' ? 0 : s.online ? R.onl : R.inp), 0), S2.map(s => rowS(s, n0(s.online ? R.onl : R.inp)))); }
    /* added by LHQ */
    const IT = Object.values((ctx.pay || {}).items || {}).filter(x => x && !x.del && nk(x.tutor) === tn && x.m === m).sort((x, y) => (x.d || '').localeCompare(y.d || ''));
    const KL = {allowance: 'Allowance', bonus: 'Bonus', deduction: 'Deduction', advance: 'Advance'};
    IT.forEach(x => add('it:' + x.id, 'other', x.label || KL[x.kind], `${KL[x.kind]}${x.d ? ' · ' + dl(x.d) : ''}`, ['deduction', 'advance'].includes(x.kind) ? -Math.abs(+x.amt) : Math.abs(+x.amt),
      [{t: x.label || KL[x.kind], s: `added by ${x.by || 'LHQ'}${x.at ? ' · ' + dl(new Date(x.at).toISOString().slice(0, 10)) : ''}${x.note ? ' · ' + x.note : ''}`, v: (['deduction', 'advance'].includes(x.kind) ? '− ' : '') + n0(x.amt)}], {item: x.id}));
    const total = Math.round(lines.reduce((x, l) => x + l.amt, 0));
    const slip = ((ctx.pay || {}).slips || {})[tn + '|' + m] || null;
    return {tutor, m, label: ml(m), place: fullDays === dim(m) ? 'full' : fullDays ? 'mixed' : (placeOn(ctx.pay, tutor, b) || (ctx.pay && ctx.pay.place && ctx.pay.place[tn] ? 'part' : 'unset')), lines, total, paid: paidCount, notPaid: notPaid.length, held: held.length, slip, R};
  }
  /* what to show: a confirmed payslip is frozen as it was confirmed */
  function shown(ctx, tutor, m){ const live = month(ctx, tutor, m); const s = live.slip; return s && s.snap ? Object.assign({}, s.snap, {slip: s, R: live.R, frozen: true}) : live; }
  G.TPAY = {DEF, rules, month, shown, tutors, placeOn, placeNow, nk, dl, ml, n0};
})(typeof window !== 'undefined' ? window : globalThis);
