/* LHQ Hub › payment plans, shared by the document page, the Hub and the server (parents' Payments).
   An invoice is paid in full, in two halves (50/50: at the start and half-way through the tuition period),
   or on set dates (a fast track intake's payment dates, copied onto the invoice): equal parts, the last takes the rounding.
   Tuition types: Term to term (fees due on set dates each term), Fast track (the intake's dates), Holiday (before the first session). */
(function(G){
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const diff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  const r2 = n => Math.round(n * 100) / 100;
  const TT = {term: 'Term to term', fast: 'Fast track', hol: 'Holiday'};
  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  /* the instalments of an invoice-like document: [{n, label, short, amt, due}] or null when paid in full */
  function rows(d, total, today){
    if(d.plan === 'half'){
      const a1 = Math.round(total * 50) / 100, a2 = r2(total - a1), start = d.periodStart || d.date || today;
      const date1 = d.plan1 || start;
      let mid = add(date1, 14);
      if(d.periodStart && d.periodEnd){ const days = diff(d.periodStart, d.periodEnd) + 1, weeks = Math.round(days / 7); mid = weeks >= 2 ? add(d.periodStart, Math.floor(weeks / 2) * 7) : add(d.periodStart, Math.floor(days / 2)); }
      return [{n: 1, label: '1st instalment (50%)', short: '1st instalment', amt: a1, due: date1}, {n: 2, label: '2nd instalment (50%)', short: '2nd instalment', amt: a2, due: d.plan2 || mid}];
    }
    if(d.plan === 'set' && Array.isArray(d.planD) && d.planD.filter(Boolean).length){
      const D = d.planD.filter(Boolean).sort(), N = D.length, each = Math.floor(total / N * 100) / 100;
      return D.map((due, i) => ({n: i + 1, label: `${ORD[i] || (i + 1) + 'th'} payment (${i + 1} of ${N})`, short: `${ORD[i] || (i + 1) + 'th'} payment`, amt: i === N - 1 ? r2(total - each * (N - 1)) : each, due}));
    }
    return null;
  }
  /* which instalments are paid (payments count in order), and the next one with what is left on it */
  function mark(R, paid){
    if(!R) return null;
    let cum = 0, prev = 0, next = null;
    R.forEach(r => { prev = cum; cum = r2(cum + r.amt); r.paid = paid >= cum - 0.005; if(!r.paid && !next){ next = r; r.left = r2(cum - Math.max(paid, prev)); } });
    return next;
  }
  G.PAYPLAN = {TT, rows, mark, add, diff};
})(typeof window !== 'undefined' ? window : globalThis);
