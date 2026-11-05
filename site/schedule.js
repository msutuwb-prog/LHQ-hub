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
  function clashes(list, res){
    const by = {}, out = [];
    list.forEach(e => { (by[e.date] = by[e.date] || []).push(e); });
    Object.values(by).forEach(L => L.forEach((e, i) => L.slice(i + 1).forEach(f => {
      if(!overlap(e.a, e.b, f.a, f.b)) return;
      if(e.tutor && nk(e.tutor) === nk(f.tutor)){ if(nk(e.sub) === nk(f.sub) && nk(e.student) !== nk(f.student)){ if(!together(res, e, f)) out.push({kind:'group', a:e, b:f}); } else out.push({kind:'tutor', a:e, b:f}); }
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
    return (card.subjects || []).filter(x => nk(x.tutor) === nk(tutor)).map(x => { const n = planned(card, x);
      return `${x.name} · ${(x.days || []).map(d => { const t = timesOf(x, d); return DAYN[d] + (t.s ? ' ' + t.s + '–' + t.e : ''); }).join(', ') || 'days to be set'}${n ? ` · ${n} session${n === 1 ? '' : 's'}, ${short(card.periodStart)} – ${short(card.periodEnd)}` : ''}`; });
  }

  /* how many sessions a subject line has in its card's period (a set number on the card caps it) */
  function planned(card, x, days){
    const D = days || x.days || [], a = card.periodStart, b = card.periodEnd; if(!a || !b || !D.length) return 0;
    let n = 0; for(let d = a; d <= b; d = addDays(d, 1)) if(D.includes(dayCode(d))) n++;
    const cap = parseFloat(x.sessions) || 0; return cap ? Math.min(cap, n) : n;
  }
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const short = s => { const d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; };

  /* a student's sessions in one subject this period: planned (from the card), expected by today, had, confirmed, waiting,
     disputed, missed and make-ups owed. it = {k, days, pa (period start), b (period end), cap}; entries = the logs;
     cf = a function giving a session's confirmation state (HD.cfState) */
  function tally(it, entries, t, cf){
    const a = it.pa, b = it.b, D = it.days || [];
    const count = until => { if(!a || !D.length) return 0; const end = b && b < until ? b : until; if(end < a) return 0;
      let n = 0; for(let d = a; d <= end; d = addDays(d, 1)) if(D.includes(dayCode(d))) n++; return it.cap ? Math.min(it.cap, n) : n; };
    const plannedN = count(b || addDays(t, 365)), expected = count(t);
    const taught = x => x !== 'absent' && x !== 'cancelled';
    const E = (entries || []).filter(e => !e.x && e.ty === 's' && e.k === it.k && (!a || e.d >= a) && (!b || e.d <= b)).sort((p, q) => (p.d + (p.t1 || '')).localeCompare(q.d + (q.t1 || '')));
    const T = E.filter(e => taught(e.a)), st = e => cf ? cf(e) : null;
    const had = T.length, made = T.filter(e => e.mk).length;
    const absent = E.filter(e => !e.mk && e.a === 'absent').length, cancelled = E.filter(e => !e.mk && e.a === 'cancelled').length;
    const used = had - made + absent + cancelled;
    return {planned: plannedN, expected, had, made, absent, cancelled, owed: Math.max(0, absent + cancelled - made), remaining: Math.max(0, plannedN - used), behind: Math.max(0, expected - used),
      confirmed: T.filter(e => ['confirmed','auto','settled'].includes(st(e))).length, waiting: T.filter(e => st(e) === 'waiting').length, disputed: T.filter(e => st(e) === 'disputed').length,
      lost: T.reduce((m, e) => m + (e.cf && e.cf.s === 'settled' ? +e.cf.lost || 0 : 0), 0), entries: E};
  }
  /* every student and subject on the current cards (the newest card for each), for the session counts */
  function items(cards, t){
    const by = new Map();
    current(cards).filter(c => c.periodEnd >= addDays(t, -14)).sort((p, q) => p.periodStart.localeCompare(q.periodStart)).forEach(c => (c.subjects || []).forEach(x => {
      if(!x.name) return; const k = nk(c.student) + '|' + nk(x.name);
      by.set(k, {k, st: c.student, sub: x.name, tutor: x.tutor || '', days: x.days || [], pa: c.periodStart, b: c.periodEnd, cap: parseFloat(x.sessions) || 0, card: c.id, number: c.number, x});
    }));
    return [...by.values()];
  }

  /* clashes to sort, week by week (not per date): one line per problem, with a key that changes when the times or the
     students change (so an answer is asked again). kind 'group': one tutor, the same subject, two or more students at
     once: maybe taught together. kind 'tutor': one tutor, two subjects at once. kind 'student': one student, two subjects at once. */
  function weekClashes(cards, t){
    const L = [];
    current(cards).filter(c => c.periodEnd >= t).forEach(c => (c.subjects || []).forEach(x => (x.days || []).forEach(day => {
      const tm = timesOf(x, day), a = mins(tm.s), b = mins(tm.e); if(a == null || b == null || !x.name) return;
      L.push({card: c.id, number: c.number, st: c.student, sub: x.name, tutor: x.tutor || '', day, s: tm.s, e: tm.e, a, b, k: nk(c.student) + '|' + nk(x.name), pa: c.periodStart, pb: c.periodEnd});
    })));
    const both = (p, q) => p.pa <= q.pb && q.pa <= p.pb && overlap(p.a, p.b, q.a, q.b);
    const id = m => m.k + '@' + m.day + m.s + '-' + m.e;
    const keyOf = (kind, who, day, M) => [kind, nk(who), day, M.map(id).sort().join('+')].join('|');
    const out = [], byT = {}, byS = {};
    L.forEach(m => { if(m.tutor) (byT[nk(m.tutor) + '|' + m.day] = byT[nk(m.tutor) + '|' + m.day] || []).push(m); (byS[nk(m.st) + '|' + m.day] = byS[nk(m.st) + '|' + m.day] || []).push(m); });
    Object.values(byT).forEach(G => {
      // the same subject: clusters of lines that overlap (a group of three is one question, not three)
      const subs = {}; G.forEach(m => (subs[nk(m.sub)] = subs[nk(m.sub)] || []).push(m));
      Object.values(subs).forEach(S => { const seen = new Set();
        S.forEach(m => { if(seen.has(m)) return; const C = [m]; seen.add(m);
          for(let i = 0; i < C.length; i++) S.forEach(n => { if(!seen.has(n) && both(C[i], n)){ seen.add(n); C.push(n); } });
          if(new Set(C.map(x => nk(x.st))).size > 1) out.push({kind: 'group', tutor: m.tutor, day: m.day, sub: m.sub, members: C.sort((p, q) => p.a - q.a || p.st.localeCompare(q.st)), key: keyOf('group', m.tutor, m.day, C)}); }); });
      // different subjects at once
      G.forEach((p, i) => G.slice(i + 1).forEach(q => { if(nk(p.sub) !== nk(q.sub) && both(p, q)) out.push({kind: 'tutor', tutor: p.tutor, day: p.day, members: [p, q], key: keyOf('tutor', p.tutor, p.day, [p, q])}); }));
    });
    Object.values(byS).forEach(G => G.forEach((p, i) => G.slice(i + 1).forEach(q => { if(nk(p.sub) !== nk(q.sub) && both(p, q)) out.push({kind: 'student', st: p.st, day: p.day, members: [p, q], key: keyOf('student', p.st, p.day, [p, q])}); })));
    return out.sort((p, q) => DAYC.indexOf(p.day) - DAYC.indexOf(q.day) || p.members[0].a - q.members[0].a);
  }
  /* whether two sessions on a date are a group the tutor said they teach together (res = the saved answers) */
  function together(res, e, f){
    const pre = 'group|' + nk(e.tutor) + '|' + e.day + '|', id = x => nk(x.student) + '|' + nk(x.sub) + '@' + x.day + x.s + '-' + x.e;
    return Object.entries(res || {}).some(([key, v]) => v && v.s === 'together' && key.startsWith(pre) && [e, f].every(x => key.slice(pre.length).split('+').includes(id(x))));
  }
  const andList = L => L.length > 1 ? L.slice(0, -1).join(', ') + ' and ' + L[L.length - 1] : L.join('');
  const clashText = c => c.kind === 'group' ? `${andList(c.members.map(m => m.st))} ${c.members.length === 2 ? 'both have' : 'all have'} ${c.sub} with ${c.tutor} ${DAYN[c.day]} ${c.members[0].s}`
    : c.kind === 'tutor' ? `${c.tutor} has ${c.members[0].st} (${c.members[0].sub}) and ${c.members[1].st} (${c.members[1].sub}) at once ${DAYN[c.day]} ${c.members[0].s}`
    : `${c.st} has ${c.members[0].sub} and ${c.members[1].sub} at once ${DAYN[c.day]} ${c.members[0].s}`;

  const api = {DAYC, DAYN, OPEN, nk, mins, hhmm, iso, parse, addDays, dayCode, timesOf, current, sessions, clashes, unavailable, overlap, checkCard, freeTimes, sigFor, linesFor, planned, short, tally, items, weekClashes, together, clashText};
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.SCHED = api;
})(typeof window !== 'undefined' ? window : globalThis);
