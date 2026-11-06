/* LHQ Hub › the student daily report: the weekly questions and the figures made from the answers.
   Shared by the server (tutors' averages, checks) and the Hub (LHQ's flags and tables).
   Stored in kv lhq_sreports: {studentKey: {date: {at, ses: {subject: {tutor, rate, prep, conf, gb, na, sra}}, wk: {k, a}, note}}}.
   Tutors never receive this list: they get averages only, after 4 weeks. */
(function(G){
  /* one question a week, in turn; `bad` answers show on LHQ's Home */
  const QS = [
    {k:'ask',  q:'Do you feel comfortable asking your tutors questions?', o:['Yes','Sometimes','Not really'], bad:['Not really']},
    {k:'pace', q:'The pace of your sessions is…', o:['Too fast','About right','Too slow'], bad:['Too fast','Too slow']},
    {k:'und',  q:'How well do you understand what you are taught?', o:['Well','Partly','Not well'], bad:['Not well']},
    {k:'way',  q:'Is anything getting in the way of your studies?', o:['No','A little','Yes'], bad:['Yes']},
  ];
  const PREP = ['Yes','Partly','No'];
  const ms = iso => Date.parse(iso + 'T12:00:00Z');
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const monday = d => { const x = new Date(ms(d)); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); return iso(x.getTime()); };
  const addDays = (d, n) => iso(ms(d) + n * 864e5);
  const weekQ = d => { const n = Math.round(ms(monday(d)) / (7 * 864e5)); return QS[((n % QS.length) + QS.length) % QS.length]; };
  const qOf = k => QS.find(q => q.k === k);
  /* every session answer as one row: {st, d, sub, tutor, rate, prep, conf, gb, na, sra} */
  function rows(R){
    const out = [];
    Object.entries(R || {}).forEach(([st, days]) => Object.entries(days || {}).forEach(([d, r]) =>
      Object.entries((r && r.ses) || {}).forEach(([sub, a]) => out.push(Object.assign({st, d, sub}, a)))));
    return out;
  }
  function stats(L){
    const n = L.length; if(!n) return null;
    const avg = f => Math.round(L.reduce((a, x) => a + (+x[f] || 0), 0) / n * 10) / 10, pc = f => Math.round(L.filter(f).length / n * 100);
    return {n, rate: avg('rate'), prep: pc(x => x.prep === 'Yes'), gb: pc(x => x.gb), na: pc(x => x.na), sra: pc(x => x.sra), conf: avg('conf')};
  }
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  /* the last 4 weeks to `to`: everyone, and each tutor */
  function byTutor(R, to){
    const from = addDays(to, -27), L = rows(R).filter(x => x.d >= from && x.d <= to), g = {};
    L.forEach(x => { const k = x.tutor || ''; (g[k] = g[k] || []).push(x); });
    const tutors = {}; Object.entries(g).forEach(([k, l]) => { if(k) tutors[k] = stats(l); });
    return {from, to, all: stats(L), tutors};
  }
  /* the first day anyone reported: tutors' averages open 4 weeks after it */
  const first = R => rows(R).reduce((m, x) => !m || x.d < m ? x.d : m, '');
  const opensOn = R => { const f = first(R); return f ? addDays(f, 28) : ''; };
  /* answers to this week's question (or another week's, from its Monday) */
  function weekAnswers(R, d){
    const m = monday(d), q = weekQ(d), c = {}; q.o.forEach(o => c[o] = 0);
    Object.values(R || {}).forEach(days => Object.entries(days || {}).forEach(([day, r]) => { if(day >= m && day <= addDays(m, 6) && r && r.wk && r.wk.k === q.k && c[r.wk.a] != null) c[r.wk.a]++; }));
    return {q, counts: c};
  }
  /* LHQ's flags from the answers: tutors not prepared 3+ times in 30 days, guides missing twice in a week for one student,
     bad answers to the weekly question, and comments, in the last few days */
  function flags(R, t){
    const out = [], L = rows(R), m30 = addDays(t, -29), w = addDays(t, -6), d3 = addDays(t, -2);
    const prep = {}; L.filter(x => x.d >= m30 && (x.prep === 'No' || x.prep === 'Partly')).forEach(x => { (prep[x.tutor] = prep[x.tutor] || []).push(x); });
    Object.entries(prep).forEach(([tu, l]) => { if(tu && l.length >= 3) out.push({kind:'prep', tutor: tu, n: l.length, names: [...new Set(l.map(x => x.st))]}); });
    const gb = {}; L.filter(x => x.d >= w && !x.gb).forEach(x => { const k = x.tutor + '|' + x.st; (gb[k] = gb[k] || []).push(x); });
    Object.entries(gb).forEach(([k, l]) => { const [tu, st] = k.split('|'); if(tu && l.length >= 2) out.push({kind:'guide', tutor: tu, st, n: l.length}); });
    Object.entries(R || {}).forEach(([st, days]) => Object.entries(days || {}).forEach(([d, r]) => {
      if(!r || d < w) return;
      const q = r.wk && qOf(r.wk.k); if(q && q.bad.includes(r.wk.a)) out.push({kind:'week', st, d, q: q.q, a: r.wk.a});
      if(r.note && d >= d3) out.push({kind:'note', st, d, note: r.note});
    }));
    return out;
  }
  G.SREP = {QS, PREP, monday, addDays, weekQ, qOf, rows, stats, byTutor, first, opensOn, weekAnswers, flags, nk};
})(typeof window !== 'undefined' ? window : globalThis);
