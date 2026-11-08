/* LHQ Hub › spaced review (SRA) schedule. One schedule, worked out the same way for tutors, students, parents and LHQ.
   A topic's Learning Day is the session where the tutor marked it finished. Its SRAs are on the Learning Day itself and
   then 1, 3, 7 and 14 days and a month later ("do on"). An SRA for a day with no session is handed out at the session
   before ("give on"). SRAs come back at the first session after they are given and after their do-on day; one not handed in moves to the
   next session day and shows as late, it isn't counted as missed.
   Works on plain data so any page can use it: entries (tutors' logs) and roster items ({k, days, card period}). */
(typeof window !== "undefined" ? window : globalThis).SRA = (function(){
  const STAGES = [{n: 0, l: 'Learning Day', d: 0}, {n: 1, l: 'Review 1', d: 1}, {n: 2, l: 'Review 2', d: 3}, {n: 3, l: 'Review 3', d: 7}, {n: 4, l: 'Review 4', d: 14}, {n: 5, l: 'Review 5', m: 1}];
  const DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const iso = dt => dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const add = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const addMonth = s => { const d = parse(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d); };
  const dow = s => DAYC[parse(s).getDay()];
  const label = n => (STAGES[n] || {}).l || 'Review ' + n;

  /* is this a session day for the item? (its days, inside its tuition period) */
  const isDay = (it, d) => (it.days || []).includes(dow(d)) && (!it.a || d >= it.a) && (!it.b || d <= it.b);
  const prevDay = (it, d, floor) => { for(let x = d, i = 0; i < 62; i++, x = add(x, -1)){ if(x < floor) return floor; if(isDay(it, x)) return x; } return floor; };
  const nextDay = (it, d) => { for(let x = d, i = 0; i < 62; i++, x = add(x, 1)) if(isDay(it, x)) return x; return d; };

  /* Take-home pack: a period that ends with a real break (no next period, or the next one starts more than 9 days after
     the last session) sends every review dated after the last session home on paper, handed over at that last session.
     A period: {a, b, days}; an item may carry all its periods (it.periods), else its own a/pa, b and days. */
  const BREAK = 9, PER_DAY = 2;
  const periodsOf = it => (it.periods && it.periods.length ? it.periods : [{a: it.pa || it.a, b: it.b, days: it.days}]).filter(p => p && p.b).slice().sort((p, q) => String(p.a || '').localeCompare(String(q.a || '')));
  const onDay = (p, d) => (p.days || []).includes(dow(d)) && (!p.a || d >= p.a) && d <= p.b;
  function packFor(it, learnt){
    const P = periodsOf(it), i = P.findIndex(p => (!p.a || learnt >= p.a) && learnt <= p.b); if(i < 0) return null;
    const p = P[i]; let last = null;
    for(let x = p.b, n = 0; n < 400 && (!p.a || x >= p.a); n++, x = add(x, -1)) if(onDay(p, x)){ last = x; break; }
    if(!last || last < learnt) last = learnt;
    const N = P.slice(i + 1).find(q => q.a > p.b); let first = null;
    if(N) for(let x = N.a, n = 0; n < 400 && x <= N.b; n++, x = add(x, 1)) if(onDay(N, x)){ first = x; break; }
    if(first && first <= add(last, BREAK)) return null;   // carries on straight into the next period: SRAs are given as usual
    return {on: last, until: first};
  }
  /* at most 2 sheets a day for one student across all subjects: extras move a day earlier (never on or before the hand-over day), else later */
  function spread(list){
    const by = {}; list.filter(x => x.pack).forEach(x => { const s = String(x.st || '').toLowerCase(); (by[s] = by[s] || []).push(x); });
    Object.values(by).forEach(L => {
      const cnt = {}; L.sort((p, q) => p.doOn.localeCompare(q.doOn) || p.sub.localeCompare(q.sub) || p.topic.localeCompare(q.topic) || p.stage - q.stage);
      L.forEach(x => {
        let d = x.doOn;
        if((cnt[d] || 0) >= PER_DAY){
          let e = d; while(e > add(x.pack.on, 1) && (cnt[e] || 0) >= PER_DAY) e = add(e, -1);
          if((cnt[e] || 0) >= PER_DAY){ e = d; while((cnt[e] || 0) >= PER_DAY) e = add(e, 1); }
          x.from = d; x.doOn = d = e;
        }
        cnt[d] = (cnt[d] || 0) + 1;
      });
    });
    return list;
  }

  /* build every SRA for these roster items from these log entries */
  function build(items, entries, today){
    const byK = new Map(items.map(it => [it.k, it])), out = [];
    const live = entries.filter(e => e && !e.x);
    // Learning Days: the first attended session where a topic was marked finished
    const LD = new Map();
    live.filter(e => e.ty === 's' && Array.isArray(e.fin) && e.fin.length && e.a !== 'absent' && e.a !== 'cancelled')
      .sort((a, b) => a.d.localeCompare(b.d)).forEach(e => e.fin.forEach(t => { const key = e.k + '\u0001' + t; if(!LD.has(key)) LD.set(key, {k: e.k, topic: t, d: e.d, st: e.st, sub: e.sub}); }));
    const outs = new Map();    // packs handed over (ty 'p'): by k + the last session's day
    live.filter(e => e.ty === 'p' && e.k && e.on).forEach(e => outs.set(e.k + '\u0001' + e.on, e));
    const marks = new Map();   // given (ty 'g') and handed in (ty 'r') by k + topic + stage
    live.filter(e => e.ty === 'g' || (e.ty === 'r' && e.v === 2)).sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || 0) - (b.at || 0)).forEach(e => { const key = e.k + '\u0001' + e.tk + '\u0001' + e.rv; const m = marks.get(key) || {}; if(e.ty === 'g') m.g = e; else m.r = e; marks.set(key, m); });   // the latest wins
    LD.forEach(x => {
      const it = byK.get(x.k) || {k: x.k, days: [], st: x.st, sub: x.sub};
      const pk = packFor(it, x.d);
      STAGES.forEach(S => {
        const doOn = S.m ? addMonth(x.d) : add(x.d, S.d);
        const m = marks.get(x.k + '\u0001' + x.topic + '\u0001' + S.n) || {};
        /* in the take-home pack: after the last session, before any next period, and not given on its own */
        if(pk && S.n > 0 && doOn > pk.on && (!pk.until || doOn < pk.until) && !m.g){
          const o = outs.get(x.k + '\u0001' + pk.on) || null, r = m.r && m.r.h !== 'm' ? m.r : null;
          out.push({k: x.k, st: it.st || x.st, sub: it.sub || x.sub, topic: x.topic, stage: S.n, label: label(S.n), learnt: x.d, doOn, giveOn: pk.on, due: null,
            status: r ? 'in' : o ? 'home' : 'pack', pack: {on: pk.on, until: pk.until, out: o ? {d: o.d, by: o.tutor || '', at: o.at || 0} : null},
            score: r && r.sc != null && r.sc !== '' ? {sc: r.sc, mx: r.mx} : null, moved: null, given: null, handed: r, paused: false});
          return;
        }
        const giveOn = S.n === 0 ? x.d : isDay(it, doOn) ? doOn : prevDay(it, doOn, x.d);
        const after = !!(it.b && doOn > it.b && !m.g && !m.r);   // after the tuition period: waits for the next one
        // it comes back at the first session after it was given and after its do-on day (given early, it keeps its day)
        let st = 'upcoming', due = m.g ? nextDay(it, add(m.g.d > doOn ? m.g.d : doOn, 1)) : null, moved = null;
        if(m.r && m.r.h !== 'm') st = 'in';
        else if(m.g){ if(m.r && m.r.h === 'm' && m.r.d >= m.g.d){ moved = m.r.d; due = nextDay(it, add(m.r.d, 1)); } st = today > due || moved ? (today >= due ? 'late' : 'given') : today === due ? 'collect' : 'given'; }
        else if(after) st = 'after';
        else if(giveOn < today) st = 'overdue';
        else if(giveOn === today) st = 'give';
        out.push({k: x.k, st: it.st || x.st, sub: it.sub || x.sub, topic: x.topic, stage: S.n, label: label(S.n), learnt: x.d, doOn, giveOn, due, status: st,
          score: m.r && m.r.h !== 'm' && m.r.sc != null && m.r.sc !== '' ? {sc: m.r.sc, mx: m.r.mx} : null, moved, given: m.g || null, handed: m.r || null, paused: !!(it.b && it.b < today && !it.next)});
      });
    });
    return spread(out).sort((a, b) => a.giveOn.localeCompare(b.giveOn) || a.topic.localeCompare(b.topic) || a.stage - b.stage);
  }
  /* the packs: one per student + subject + last session, with its sheets in date order.
     soon = days ahead a pack shows before its hand-over day (to print in time); ended packs show until their last sheet. */
  function packs(list, t, soon = 7){
    const by = new Map();
    list.filter(x => x.pack).forEach(x => { const key = x.k + '\u0001' + x.pack.on; if(!by.has(key)) by.set(key, {k: x.k, st: x.st, sub: x.sub, on: x.pack.on, out: x.pack.out, sheets: []}); by.get(key).sheets.push(x); });
    return [...by.values()].map(p => { p.sheets.sort((a, b) => a.doOn.localeCompare(b.doOn) || a.stage - b.stage); p.end = p.sheets[p.sheets.length - 1].doOn; return p; })
      .filter(p => p.on <= add(t, soon) && p.end >= add(t, -7)).sort((a, b) => a.on.localeCompare(b.on) || a.st.localeCompare(b.st) || a.sub.localeCompare(b.sub));
  }
  /* what a tutor does today: hand out, collect, and print for the next session day */
  function today(list, t){
    const live = list.filter(x => !x.paused);
    const give = live.filter(x => x.status === 'give' || x.status === 'overdue');
    const collect = live.filter(x => x.status === 'collect' || x.status === 'late');
    const tomorrow = add(t, 1), next = live.filter(x => x.status === 'upcoming').map(x => x.giveOn).sort()[0];
    const printDay = next && next > t ? next : tomorrow;
    const print = live.filter(x => x.status === 'upcoming' && x.giveOn === printDay);
    const groups = {}; print.forEach(x => { const g = groups[x.topic + '\u0001' + x.stage] = groups[x.topic + '\u0001' + x.stage] || {topic: x.topic, stage: x.stage, label: x.label, sub: x.sub, students: []}; g.students.push(x); });
    return {give, collect, print: Object.values(groups), printDay};
  }
  return {STAGES, build, today, label, add, addMonth, isDay, nextDay, packs, packFor};
})();
