/* LHQ Hub › the schedule: sessions worked out from the tuition cards, clashes, free times, and each tutor's version of a
   card (so a tutor is told only when their own lines change). Used by the tutor's calendar, the all-tutors calendar,
   the clash check when a card is saved, and the server's phone-calendar link. No storage of its own.
   A card subject: {name, tutor, days:['Tu','Th'], times:{Tu:{s,e}}, start, end}; the card: {student, periodStart, periodEnd, where}. */
(function(root){
  const DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'], DAYN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'};
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const mins = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  const hhmm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const dayCode = s => DAYC[parse(s).getDay()];
  const timesOf = (x, day) => { const o = (x.times || {})[day]; const s = (o && o.s) || x.start || '', e = (o && o.s) ? (o.e || '') : (x.end || ''); return {s, e}; };
  /* LHQ's opening hours, for suggesting free times */
  const OPEN = {Mo:['08:00','17:00'], Tu:['08:00','17:00'], We:['08:00','17:00'], Th:['08:00','17:00'], Fr:['08:00','17:00'], Sa:['08:00','17:00'], Su:['14:00','17:00']};

  /* the cards that count: not deleted, one per student + subject (the newest period wins where two overlap) */
  function current(cards){ return (cards || []).filter(c => c && (c.type || 'card') === 'card' && !c.del && c.periodStart && c.periodEnd); }

  /* every session on the cards between two dates (inclusive), optionally for one tutor or one student */
  function sessions(cards, from, to, o = {}){
    const out = [];
    current(cards).forEach(c => {
      if(c.periodEnd < from || c.periodStart > to) return;
      if(o.student && nk(c.student) !== nk(o.student)) return;
      (c.subjects || []).forEach(x => {
        if(!x.name) return;
        if(o.tutor && nk(x.tutor) !== nk(o.tutor)) return;
        const days = x.days || [];
        for(let d = c.periodStart < from ? from : c.periodStart; d <= (c.periodEnd > to ? to : c.periodEnd); d = addDays(d, 1)){
          const dc = dayCode(d); if(!days.includes(dc)) continue;
          const t = timesOf(x, dc);
          out.push({date:d, day:dc, s:t.s, e:t.e, a:mins(t.s), b:mins(t.e), tutor:x.tutor || '', student:c.student, sub:x.name, k:nk(c.student) + '|' + nk(x.name), card:c.id, number:c.number, where:c.where || ''});
        }
      });
    });
    return out.sort((p, q) => p.date.localeCompare(q.date) || (p.a ?? 9999) - (q.a ?? 9999));
  }
  const overlap = (a1, b1, a2, b2) => a1 != null && b1 != null && a2 != null && b2 != null && a1 < b2 && a2 < b1;

  /* sessions that overlap: the same tutor in two places, or a student with two subjects at once */
  function clashes(list){
    const by = {}, out = [];
    list.forEach(e => { (by[e.date] = by[e.date] || []).push(e); });
    Object.values(by).forEach(L => L.forEach((e, i) => L.slice(i + 1).forEach(f => {
      if(!overlap(e.a, e.b, f.a, f.b)) return;
      if(e.tutor && nk(e.tutor) === nk(f.tutor)) out.push({kind:'tutor', a:e, b:f});
      else if(nk(e.student) === nk(f.student)) out.push({kind:'student', a:e, b:f});
    })));
    return out;
  }
  /* a tutor's blocks of time they can't teach: [{d:'Mo', s:'08:00', e:'13:00', note}] */
  function unavailable(avail, tutor, day, a, b){
    return ((avail || {})[nk(tutor)] || []).filter(x => x && x.d === day && overlap(a, b, mins(x.s), mins(x.e)));
  }

  /* the clash check when a card is saved: each of its lines against the tutor's other cards, the student's other
     subjects, and the tutor's unavailable times; one line per problem, weekly (not per date) */
  function checkCard(card, allCards, avail){
    const others = current(allCards).filter(c => c.id !== card.id && c.periodEnd >= card.periodStart && c.periodStart <= card.periodEnd);
    const out = [], seen = new Set();
    const add = (key, x) => { if(!seen.has(key)){ seen.add(key); out.push(x); } };
    (card.subjects || []).forEach((x, i) => {
      (x.days || []).forEach(day => {
        const t = timesOf(x, day), a = mins(t.s), b = mins(t.e); if(a == null || b == null) return;
        if(x.tutor) unavailable(avail, x.tutor, day, a, b).forEach(u => add(`u|${i}|${day}`, {kind:'unavailable', sub:x.name, tutor:x.tutor, day, s:t.s, e:t.e, text:`${x.tutor} isn't available ${DAYN[day]} ${u.s}–${u.e}${u.note ? ' (' + u.note + ')' : ''}`}));
        // the student's other subjects on this card
        (card.subjects || []).forEach((y, j) => { if(j <= i || !(y.days || []).includes(day)) return; const u = timesOf(y, day);
          if(overlap(a, b, mins(u.s), mins(u.e))) add(`s|${i}|${j}|${day}`, {kind:'student', sub:x.name, day, s:t.s, e:t.e, text:`${card.student || 'The student'} has ${x.name} and ${y.name} at the same time on ${DAYN[day]}`}); });
        others.forEach(c => (c.subjects || []).forEach(y => {
          if(!(y.days || []).includes(day)) return; const u = timesOf(y, day); if(!overlap(a, b, mins(u.s), mins(u.e))) return;
          if(x.tutor && nk(y.tutor) === nk(x.tutor)) add(`t|${i}|${day}|${c.id}|${y.name}`, {kind:'tutor', sub:x.name, tutor:x.tutor, day, s:t.s, e:t.e, other:c.student, text:`${x.tutor} already teaches ${c.student} (${y.name}) ${DAYN[day]} ${u.s}–${u.e}`});
          else if(nk(c.student) === nk(card.student)) add(`o|${i}|${day}|${c.id}`, {kind:'student', sub:x.name, day, s:t.s, e:t.e, text:`${card.student} already has ${y.name} ${DAYN[day]} ${u.s}–${u.e} (${c.number || 'another card'})`});
        }));
      });
    });
    return out;
  }

  /* free times for a subject: days and start times (LHQ's hours, half-hour steps) when the tutor and the student are both free */
  function freeTimes(card, sub, allCards, avail, o = {}){
    const x = (card.subjects || []).find(y => y.name === sub) || {}, len = o.len || (mins(x.end) - mins(x.start)) || 60;
    const others = current(allCards).filter(c => c.id !== card.id && c.periodEnd >= card.periodStart && c.periodStart <= card.periodEnd);
    const busy = day => {
      const L = [];
      others.forEach(c => (c.subjects || []).forEach(y => { if(!(y.days || []).includes(day)) return; if((x.tutor && nk(y.tutor) === nk(x.tutor)) || nk(c.student) === nk(card.student)){ const u = timesOf(y, day); L.push([mins(u.s), mins(u.e)]); } }));
      (card.subjects || []).forEach(y => { if(y.name === sub || !(y.days || []).includes(day)) return; const u = timesOf(y, day); L.push([mins(u.s), mins(u.e)]); });
      ((avail || {})[nk(x.tutor)] || []).forEach(u => { if(u.d === day) L.push([mins(u.s), mins(u.e)]); });
      return L.filter(p => p[0] != null && p[1] != null);
    };
    const out = [];
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(day => {
      const [o1, o2] = OPEN[day].map(mins), B = busy(day), slots = [];
      for(let a = o1; a + len <= o2; a += 30) if(!B.some(([p, q]) => overlap(a, a + len, p, q))) slots.push(hhmm(a));
      if(slots.length) out.push({day, name:DAYN[day], slots});
    });
    return out;
  }

  /* what a tutor has been told about a card: their own lines only, so other tutors' changes don't bother them */
  function sigFor(card, tutor){
    const L = (card.subjects || []).filter(x => nk(x.tutor) === nk(tutor)).map(x => [x.name, (x.days || []).slice().sort(), (x.days || []).map(d => { const t = timesOf(x, d); return d + t.s + t.e; }).sort()]);
    return JSON.stringify([card.periodStart, card.periodEnd, L.sort((p, q) => String(p[0]).localeCompare(String(q[0])))]);
  }
  function linesFor(card, tutor){
    return (card.subjects || []).filter(x => nk(x.tutor) === nk(tutor)).map(x => `${x.name} · ${(x.days || []).map(d => { const t = timesOf(x, d); return DAYN[d] + (t.s ? ' ' + t.s + '–' + t.e : ''); }).join(', ') || 'days to be set'}`);
  }

  const api = {DAYC, DAYN, OPEN, nk, mins, hhmm, iso, parse, addDays, dayCode, timesOf, current, sessions, clashes, unavailable, overlap, checkCard, freeTimes, sigFor, linesFor};
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.SCHED = api;
})(typeof window !== 'undefined' ? window : globalThis);
