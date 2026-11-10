/* LHQ Hub › exams, targets and pace: one set of rules for the server, staff, tutors, students and parents.
   Timetables come from examdata.js (dates only). A student's subject has a target {g, ex, code, as} kept in kv lhq_targets
   under the subject key (student|subject); the exam and syllabus default from the tuition card's topic list.
   On track: the average of the last 3 marked assessments (never SRAs, self-marked sheets or practice) against the
   target's % (Settings › Grade boundaries). Pace: topics finished against the pace needed to finish every topic
   4 weeks before the student's first paper. */
(function(G){
  const EX = [['P','Primary Checkpoint'],['L','Lower Secondary Checkpoint'],['I','IGCSE'],['AS','AS Level'],['A','A Level']];
  const EXL = Object.fromEntries(EX), EXS = {P:'Primary Checkpoint', L:'Checkpoint', I:'IGCSE', AS:'AS', A:'A Level'};
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const NINE = code => /^09[7-9]\d$/.test(code) || code === '0772' || code === '0774';
  const GRADES = {cp:['Outstanding','High','Good','Aspiring','Basic'], igcse:['A*','A','B','C','D','E','F','G'], nine:['9','8','7','6','5','4','3','2','1'], as:['a','b','c','d','e'], al:['A*','A','B','C','D','E']};
  const BANDS = {cp:{Outstanding:80, High:60, Good:40, Aspiring:20, Basic:2}, igcse:{'A*':90, A:80, B:70, C:60, D:50, E:40, F:30, G:20},
    nine:{9:90, 8:80, 7:70, 6:60, 5:50, 4:40, 3:30, 2:20, 1:10}, as:{a:80, b:70, c:60, d:50, e:40}, al:{'A*':90, A:80, B:70, C:60, D:50, E:40}};
  const SCALES = [['al','A Level','A*–E'],['as','AS Level','a–e'],['igcse','IGCSE','A*–G'],['nine','IGCSE 9–1','9–1'],['cp','Checkpoint','Outstanding–Basic']];
  const scale = (ex, code) => ex === 'P' || ex === 'L' ? 'cp' : ex === 'AS' ? 'as' : ex === 'A' ? 'al' : NINE(String(code || '')) ? 'nine' : 'igcse';
  const bandsOf = (sc, set) => Object.assign({}, BANDS[sc], ((set || {}).bands || {})[sc] || {});
  const pctOf = (g, sc, set) => { const b = bandsOf(sc, set); return g in b ? Number(b[g]) : null; };
  const ms = d => Date.parse(d + 'T12:00:00Z'), addD = (d, n) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10), days = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);

  /* ---------- timetables ---------- */
  let memo = null;
  function rowsAll(set){
    const fix = (set || {}).examFix || {}, k = JSON.stringify(fix);
    if(memo && memo.k === k) return memo.r;
    const r = {}, S = (G.EXAMDATA || {series: {}}).series;
    Object.entries(S).forEach(([sr, s]) => { r[sr] = String(s.rows || '').split('\n').filter(Boolean).map(l => { const [d, cc, ex, name, ct] = l.split('|'), [a, b] = d.split('~'), [code, comp] = cc.split('/');
      const f = fix[sr + '|' + cc]; return {sr, a: f ? f.a : a, b: f ? f.b || '' : b || '', code, comp, ex, name, ct: ct || '', fixed: !!f}; }).sort((x, y) => x.a.localeCompare(y.a) || x.code.localeCompare(y.code) || x.comp.localeCompare(y.comp)); });
    memo = {k, r}; return r;
  }
  const seriesInfo = () => (G.EXAMDATA || {series: {}}).series;
  const lastDay = L => L.reduce((m, p) => (p.b || p.a) > m ? (p.b || p.a) : m, '');
  /* the series an exam has, earliest first: [{sr, name, loaded, end}] */
  function series(ex, set, t){
    const R = rowsAll(set), I = seriesInfo();
    return Object.keys(I).filter(sr => I[sr].exams.includes(ex)).map(sr => { const L = R[sr].filter(p => p.ex === ex); return {sr, name: I[sr].name, loaded: L.length > 0, first: L.length ? L[0].a : '', end: lastDay(L)}; })
      .filter(s => !t || !s.loaded || s.end >= t).sort((a, b) => (a.first || '9').localeCompare(b.first || '9') || a.sr.localeCompare(b.sr));
  }
  const nextSeries = (ex, set, t) => series(ex, set, t).find(s => s.loaded) || null;
  /* subjects in a series for one exam: [{code, ex, name, nine, papers}] */
  function subjects(sr, ex, set){
    const by = {}; (rowsAll(set)[sr] || []).filter(p => !ex || p.ex === ex).forEach(p => { const k = p.code + '|' + p.ex; (by[k] = by[k] || {code: p.code, ex: p.ex, name: p.name, nine: NINE(p.code), papers: []}).papers.push(p); });
    return Object.values(by).sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  }
  /* papers a choice sits: {code, ex, as} (A Level with as: the AS papers too) in the exam's next series, or a given one */
  function papersFor(c, set, t, sr){
    if(!c || !c.code || !c.ex) return [];
    const s = sr || ((nextSeries(c.ex, set, t) || {}).sr); if(!s) return [];
    return (rowsAll(set)[s] || []).filter(p => p.code === c.code && (p.ex === c.ex || (c.ex === 'A' && c.as && p.ex === 'AS')));
  }
  const firstPaper = (c, set, t) => { const P = papersFor(c, set, t).filter(p => (p.b || p.a) >= (t || '')); const w = P.filter(p => !p.b); return (w[0] || P[0] || null); };
  const label = (p, nine) => `${p.code}/${p.comp}${p.ct ? ' · ' + p.ct : ''}`;
  const subjName = s => s.name + (s.nine ? ' (9–1)' : '');

  /* ---------- the card's subject → exam and syllabus code ---------- */
  const LV = {'Primary (Year 6)': 'P', 'Lower Secondary (Years 7–9)': 'L', 'IGCSE': 'I', 'A Level': 'A'};
  function fromCard(x, topics){
    const list = String((x && x.list) || ''), i = list.indexOf('|'), lv = i > 0 ? list.slice(0, i) : '', name = i > 0 ? list.slice(i + 1) : '';
    const ex = LV[lv]; if(!ex) return null;
    const T = topics || G.TOPICS, code = T && T[lv] && T[lv][name] && String(T[lv][name].code || '').slice(0, 4);
    if(code && /^\d{4}$/.test(code)) return {ex, code, as: ex === 'A' ? 1 : 0};
    const s = Object.keys(seriesInfo()).flatMap(sr => subjects(sr, ex)).find(y => nk(y.name) === nk(name) || nk(y.name) === nk(x.name));
    return s ? {ex, code: s.code, as: ex === 'A' ? 1 : 0} : {ex, code: '', as: ex === 'A' ? 1 : 0};
  }
  /* a subject's choice: what LHQ (or the student) set, else what the card says */
  const choice = (k, targets, x, topics) => { const t = (targets || {})[k]; const c = fromCard(x, topics) || {}; return t && t.ex ? {ex: t.ex, code: t.code || (t.ex === c.ex ? c.code : ''), as: t.ex === 'A' ? (t.as == null ? 1 : t.as) : 0, g: t.g || '', by: t.by || '', at: t.at || 0} : Object.assign({g: '', by: '', at: 0}, c); };

  /* ---------- on track and pace ---------- */
  /* marks: [{d, p}] (assessments only); tp: the target's % */
  function onTrack(marks, tp){
    const L = (marks || []).filter(m => m && m.p != null).slice().sort((a, b) => String(a.d).localeCompare(String(b.d))), last = L.slice(-3);
    if(!last.length) return {n: 0, avg: null, ok: null, below2: false};
    const avg = Math.round(last.reduce((s, m) => s + m.p, 0) / last.length);
    return {n: last.length, avg, last: last.map(m => m.p), ok: tp == null ? null : avg >= tp, below2: tp != null && L.length >= 2 && L.slice(-2).every(m => m.p < tp)};
  }
  /* done of total topics; from: when tuition started; exam: the first paper; t: today */
  function pace(done, total, from, exam, t){
    if(!total || !exam || !from) return null;
    const end = addD(exam, -28), span = days(from, end);
    const need = span <= 0 || t >= end ? total : Math.max(0, Math.min(total, Math.round(total * days(from, t) / span)));
    return {done, total, need, diff: done - need, end};
  }
  const paceL = p => !p ? '' : p.diff > 0 ? `${p.diff} ahead` : p.diff < 0 ? `${-p.diff} behind` : 'on pace';

  G.EXAMS = {EX, EXL, EXS, GRADES, BANDS, SCALES, NINE, scale, bandsOf, pctOf, rowsAll, series, nextSeries, subjects, papersFor, firstPaper, label, subjName, fromCard, choice, onTrack, pace, paceL, days, addD, LV};
})(typeof window !== 'undefined' ? window : globalThis);
