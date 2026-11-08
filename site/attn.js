/* LHQ Hub › students slipping: one set of rules for the tutor's Home and LHQ's Needs attention.
   Act now: absent 2+ times in the last 14 days, attendance under 85% this period (6+ sessions logged), the last 2 SRAs not handed in.
   Watch: a topic's last 3 SRA scores each 3+ points lower than the one before; the last 3 assessment marks each lower.
   Lines clear themselves when the cause is gone (the 14 days pass, an SRA is handed in, a mark goes up).
   items: [{k, st, sub, tutor, pa}] · entries: tutors' logs · t: today (YYYY-MM-DD). */
(function(G){
  const ms = d => Date.parse(d + 'T12:00:00Z'), add = (d, n) => new Date(ms(d) + n * 864e5).toISOString().slice(0, 10);
  const pc = e => Number(e.mx) > 0 && e.sc != null && e.sc !== '' && !isNaN(+e.sc) ? Math.round(+e.sc / +e.mx * 100) : null;
  const TIMES = ['', 'once', 'twice', '3 times', '4 times', '5 times'];
  function slipping(items, entries, t){
    const out = [], E = (entries || []).filter(e => e && !e.x);
    (items || []).forEach(it => {
      const mine = E.filter(e => e.k === it.k), push = (level, kind, what, detail, extra) => out.push(Object.assign({k: it.k, st: it.st, sub: it.sub, tutor: it.tutor || '', level, kind, what, detail}, extra || {}));
      /* attendance */
      const S = mine.filter(e => e.ty === 's' && e.a !== 'cancelled' && (!it.pa || e.d >= it.pa) && e.d <= t);
      const abs = S.filter(e => e.a === 'absent' && e.d > add(t, -14)), told = abs.filter(e => e.told).length;
      const rate = S.length >= 6 ? Math.round(S.filter(e => e.a !== 'absent').length / S.length * 100) : null;
      if(abs.length >= 2) push('now', 'abs', `absent ${TIMES[abs.length] || abs.length + ' times'}`, `${told ? `${told} told · ` : ''}last 2 weeks${rate != null ? ` · ${rate}% attendance` : ''}`, {n: abs.length, told});
      else if(rate != null && rate < 85) push('now', 'att', `${rate}% attendance`, `${S.filter(e => e.a === 'absent').length} of ${S.length} missed this period`, {rate});
      /* SRAs not handed in: the last 2 hand-in records */
      const R = mine.filter(e => e.ty === 'r' && e.v === 2).sort((a, b) => (a.d || '').localeCompare(b.d || '') || (a.at || 0) - (b.at || 0));
      const last2 = R.slice(-2);
      if(last2.length === 2 && last2.every(e => e.h === 'm') && last2[1].d > add(t, -21)) push('now', 'sra', '2 SRAs not handed in', last2.map(e => `${e.tk} R${e.rv}`).join(', '));
      /* SRA scores dropping on a topic */
      const byT = {}; R.filter(e => e.h !== 'm' && pc(e) != null).forEach(e => { (byT[e.tk] = byT[e.tk] || {})[e.rv] = {p: pc(e), d: e.d}; });
      Object.entries(byT).forEach(([tk, rv]) => { const L = Object.keys(rv).map(Number).sort((a, b) => a - b).map(n => rv[n]).slice(-3);
        if(L.length === 3 && L[1].p <= L[0].p - 3 && L[2].p <= L[1].p - 3 && L[2].d > add(t, -30)) push('watch', 'drop', `${tk} SRAs dropping`, L.map(x => x.p).join(' → ') + '%', {topic: tk}); });
      /* assessments falling */
      const W = mine.filter(e => e.ty === 'w' && !e.abs && pc(e) != null).sort((a, b) => (a.d || '').localeCompare(b.d || '')).slice(-3);
      if(W.length === 3 && pc(W[1]) < pc(W[0]) && pc(W[2]) < pc(W[1]) && W[2].d > add(t, -45)) push('watch', 'fall', 'assessments falling', W.map(pc).join(' → ') + '%');
    });
    return out.sort((a, b) => (a.level === 'now' ? 0 : 1) - (b.level === 'now' ? 0 : 1) || a.st.localeCompare(b.st));
  }
  G.ATTN = {slipping};
})(typeof window !== 'undefined' ? window : globalThis);
