/* LHQ Hub › spaced review (SRA) schedule. One schedule, worked out the same way for tutors, students, parents and LHQ.
   A topic's Learning Day is the session where the tutor marked it finished. Its SRAs are on the Learning Day itself and
   then 1, 3, 7 and 14 days and a month later ("do on"). An SRA for a day with no session is handed out at the session
   before ("give on"). SRAs come back at the first session after they are given and after their do-on day; one not handed in moves to the
   next session day and shows as late, it isn't counted as missed.
   Works on plain data so any page can use it: entries (tutors' logs) and roster items ({k, days, card period}). */
window.SRA = (function(){
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

  /* build every SRA for these roster items from these log entries */
  function build(items, entries, today){
    const byK = new Map(items.map(it => [it.k, it])), out = [];
    const live = entries.filter(e => e && !e.x);
    // Learning Days: the first attended session where a topic was marked finished
    const LD = new Map();
    live.filter(e => e.ty === 's' && Array.isArray(e.fin) && e.fin.length && e.a !== 'absent' && e.a !== 'cancelled')
      .sort((a, b) => a.d.localeCompare(b.d)).forEach(e => e.fin.forEach(t => { const key = e.k + '\u0001' + t; if(!LD.has(key)) LD.set(key, {k: e.k, topic: t, d: e.d, st: e.st, sub: e.sub}); }));
    const marks = new Map();   // given (ty 'g') and handed in (ty 'r') by k + topic + stage
    live.filter(e => e.ty === 'g' || (e.ty === 'r' && e.v === 2)).sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || 0) - (b.at || 0)).forEach(e => { const key = e.k + '\u0001' + e.tk + '\u0001' + e.rv; const m = marks.get(key) || {}; if(e.ty === 'g') m.g = e; else m.r = e; marks.set(key, m); });   // the latest wins
    LD.forEach(x => {
      const it = byK.get(x.k) || {k: x.k, days: [], st: x.st, sub: x.sub};
      STAGES.forEach(S => {
        const doOn = S.m ? addMonth(x.d) : add(x.d, S.d);
        const giveOn = S.n === 0 ? x.d : isDay(it, doOn) ? doOn : prevDay(it, doOn, x.d);
        const m = marks.get(x.k + '\u0001' + x.topic + '\u0001' + S.n) || {};
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
    return out.sort((a, b) => a.giveOn.localeCompare(b.giveOn) || a.topic.localeCompare(b.topic) || a.stage - b.stage);
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
  return {STAGES, build, today, label, add, addMonth, isDay, nextDay};
})();
