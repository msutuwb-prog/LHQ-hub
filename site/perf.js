/* LHQ Hub › Business › Performance report: any week, month, quarter, year or dates, with the sections chosen for who
   will read it (Director, Staff meeting, Partners, Board). A one-page summary first, then the detail, each figure
   compared with the period before and the same dates last year. Student names are left out when it leaves LHQ.
   Shown as a page at #perf, downloaded as an A4 PDF. Uses BIZ, INS and HD, and index.html's helpers. */
window.PERF = (function(){
  const KEY = 'lhq_perf';   // + '_' + kind for the other reports
  const SECTIONS = [['summary','One-page summary'],['trend','12-month trend'],['money','Money in, explained'],['spending','Spending'],['pl','Profit & loss'],
    ['pipeline','Quotes and conversion'],['sessions','Sessions and tutors'],['students','Students and renewals'],['marketing','Marketing return'],['other','Other money in and loans'],['pots','Allocations']];
  const AUD = {
    director: {n: 'Director', s: SECTIONS.map(x => x[0]), anon: false, money: true},
    staff: {n: 'Staff meeting', s: ['summary','trend','pipeline','sessions','students','marketing'], anon: false, money: false},
    partners: {n: 'Partners', s: ['summary','trend','money','sessions','students','marketing'], anon: true, money: true},
    board: {n: 'Board', s: ['summary','trend','money','spending','pl','pipeline','sessions','students','marketing','other','pots'], anon: true, money: true}};
  const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const B = () => window.BIZ;
  const sum = (L, f) => L.reduce((a, x) => a + (f ? f(x) : x), 0);
  const grp = (L, k, v) => { const o = {}; L.forEach(x => { const q = k(x); o[q] = (o[q] || 0) + v(x); }); return o; };
  const srt = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const chg = (n, p) => p ? Math.round((n - p) / Math.abs(p) * 100) : null;
  const UP = s => String(s || '').trim().toUpperCase();
  const lastDay = m => { const [y, n] = m.split('-').map(Number); return m + '-' + String(new Date(y, n, 0).getDate()).padStart(2, '0'); };
  const yearBack = iso => { const [y, m, d] = iso.split('-'); const t = `${+y - 1}-${m}-${d}`; return m === '02' && d === '29' ? `${+y - 1}-02-28` : t; };
  const mondayOf = iso => addDays(iso, -((HD.parseISO(iso).getDay() + 6) % 7));
  const fmtD = iso => { const d = HD.parseISO(iso); return `${d.getDate()} ${MONL[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

  let rk = 'business';   // the report on screen
  const kkey = k => k === 'business' ? KEY : KEY + '_' + k;
  function cfg(k = rk){ let c = {}; try{ c = JSON.parse(localStorage.getItem(kkey(k)) || '{}'); }catch(e){}
    const K = KINDS[k], A = K.AUD, a = A[c.aud] || A[Object.keys(A)[0]];
    return Object.assign({kind: K.dflt || 'month', at: B().thisMonth(), from: '', to: '', aud: Object.keys(A)[0], s: a.s.slice(), anon: a.anon, money: a.money}, c); }
  const saveCfg = (c, k = rk) => { try{ localStorage.setItem(kkey(k), JSON.stringify(c)); }catch(e){} };

  /* the dates a choice covers, the period before it, and the same dates last year */
  function range(c){
    const b = B(), t = today(); let from, to, label, prevF, prevT;
    if(c.kind === 'period'){ const st = HD.students().find(x => x.key === c.stu), inv = st && st.cur && st.cur.inv;
      if(inv && inv.periodStart){ from = inv.periodStart; to = inv.periodEnd || t; label = `Tuition period ${fmtD(from)} – ${fmtD(to)}`; prevT = addDays(from, -1); const pv = st.periods[1] && st.periods[1].inv; prevF = pv && pv.periodStart ? pv.periodStart : addDays(prevT, -HD.dayDiff(from, to)); }
      else { from = addDays(t, -29); to = t; label = 'Last 30 days'; } }
    else if(c.kind === 'week'){ from = mondayOf(c.at || t); to = addDays(from, 6); label = `Week of ${fmtD(from)}`; }
    else if(c.kind === 'custom'){ from = c.from || addDays(t, -29); to = c.to || t; if(to < from) [from, to] = [to, from]; label = `${fmtD(from)} – ${fmtD(to)}`; }
    else {
      const p = c.kind === 'month' ? (c.at || b.thisMonth()) : c.kind === 'quarter' ? (c.at || b.qOf(b.thisMonth())) : (c.at || 'fy' + b.fyOf(b.thisMonth()));
      const ms = b.months(p, true), pp = b.months(b.shift(p, -1), true);
      from = ms[0] + '-01'; to = lastDay(ms[ms.length - 1]); prevF = pp[0] + '-01'; prevT = lastDay(pp[pp.length - 1]); label = b.periodLabel(p).replace(/ · to date$/, '');
    }
    const live = to > t; if(live) to = t;
    const len = HD.dayDiff(from, to);
    if(!prevF){ prevT = addDays(from, -1); prevF = addDays(prevT, -len); }
    else if(live){ prevT = addDays(prevF, len) < prevT ? addDays(prevF, len) : prevT; }
    return {from, to, label: label + (live ? ' (to date)' : ''), live, prev: {from: prevF, to: prevT}, ly: {from: yearBack(from), to: yearBack(to)}};
  }

  /* every figure for a stretch of dates */
  function figs(from, to){
    const b = B(), F = INS.facts(), inR = d => d && d >= from && d <= to;
    const rows = F.rows.filter(r => inR(r.date)), tuition = sum(rows, r => r.amt);
    const spAll = b.spendLive().filter(e => inR(e.date)), sp = spAll.filter(e => !b.NOT_COST.includes(e.cat)), byCat = grp(sp, e => e.cat, e => num(e.amount));
    const inc = b.incomeLive().filter(e => inR(e.date)), other = sum(inc.filter(e => !b.NOT_INCOME.includes(e.cat)), e => num(e.amount)), capital = sum(inc.filter(e => b.NOT_INCOME.includes(e.cat)), e => num(e.amount));
    const exp = sum(sp, e => num(e.amount)), revenue = tuition + other;
    const quotes = saved.filter(d => (d.type || 'quote') === 'quote' && inR(d.date)), invRef = new Set(F.invs.filter(i => i.ref).map(i => UP(i.ref)));
    const conv = quotes.filter(q => invRef.has(UP(q.number)));
    const invs = F.invs.filter(i => inR(i.date));
    const newS = F.S.filter(s => { const i = F.invs.find(x => x.id === F.firstInv.get(s.key)); return i && inR(i.date); });
    const active = F.S.filter(s => s.periods.some(p => (p.inv.periodStart || p.inv.date || '') <= to && (p.inv.periodEnd || '9999') >= to)).length;
    const X = F.sess.filter(e => inR(e.d)), taught = X.filter(e => e.a === 'attended' || e.a === 'late');
    const ended = []; F.S.forEach(s => s.periods.forEach((p, i) => { const e = p.inv.periodEnd; if(e && inR(e) && e < today()) ended.push({s, renewed: i > 0, prog: INS.progOf(p.inv.level)}); }));
    const paid = invs.map(i => ({i, st: HD.invState(i), r: F.rcts.filter(r => UP(r.ref) === UP(i.number)).sort((a, c) => (a.date || '').localeCompare(c.date || ''))})).filter(x => x.st.paidUp && x.r.length);
    const grace = num(HD.settings.graceDays);
    return {rows, tuition, other, capital, revenue, exp, profit: revenue - exp, byCat, spAll, inc, invoiced: sum(invs, HD.total), nInv: invs.length,
      quotes, conv, lost: quotes.filter(q => q.lost), quoted: sum(quotes, HD.total), newS, active, X, taught: taught.length, hours: sum(taught, e => e.hrs),
      missS: X.filter(e => e.a === 'absent').length, missT: X.filter(e => e.a === 'cancelled').length, made: taught.filter(e => e.mk).length,
      byMode: grp(taught, e => e.mode, () => 1), byTutor: grp(taught, e => e.tutor, e => e.hrs), tutorN: grp(taught, e => e.tutor, () => 1),
      ended, renewed: ended.filter(x => x.renewed).length, refunds: byCat['Refunds'] || 0,
      onTime: paid.length ? pc(paid.filter(x => !x.i.dueDate || x.r[x.r.length - 1].date <= HD.addDays(x.i.dueDate, grace)).length, paid.length) : null,
      days: paid.length ? Math.round(sum(paid, x => Math.max(0, HD.dayDiff(x.i.date, x.r[x.r.length - 1].date))) / paid.length) : null,
      discounts: sum(invs, i => sum(i.items || [], it => num(it.sessions) * num(it.cost)) - HD.total(i)),
      mktSpend: grp(sp.filter(e => e.cat === 'Marketing'), e => e.chan || 'No channel recorded', e => num(e.amount))};
  }

  /* ---------- drawing ---------- */
  const LIT = {'--inc':'#073763','--exp':'#f4b223','--line2':'#e8ebf0','--muted':'#6b7585','--rd':'#b42318','--ok':'#1f7a4d','--gold':'#f4b223','--bl':'#073763','--gr-bg':'#f1f3f6'};
  const lit = h => h.replace(/var\((--[a-z0-9-]+)\)/g, (m, v) => LIT[v] || '#6b7585');
  const ar = (p, good = 1) => p == null ? '<i class="fl">–</i>' : p === 0 ? '<i class="fl">0%</i>' : `<i class="${(p > 0) === (good > 0) ? 'up' : 'dn'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</i>`;
  const M = v => mk(v), Ms = v => (v < 0 ? '−' : '') + mkShort(Math.abs(v));
  function table(head, rows, o = {}){
    return `<table class="pf-t${rows.length <= 12 ? ' sm' : ''}"><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${h}</th>`).join('')}</tr>${rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.c.map((v, i) => `<td${i ? ' class="r"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</table>${o.note ? `<p class="pf-n">${o.note}</p>` : ''}`;
  }
  function bars(list, total, fmt = Ms){
    const max = Math.max(1, ...list.map(x => x[1]));
    return list.map(([k, v, x]) => `<div class="pf-b"><div class="h"><b>${esc(k)}</b><span>${fmt(v)}${total ? ` · ${pc(v, total)}%` : ''}${x ? ' · ' + x : ''}</span></div><div class="tr"><i style="width:${v / max * 100}%"></i></div></div>`).join('') || '<p class="pf-n">Nothing in this period.</p>';
  }
  const sec = (title, body, cls = '') => `<section class="pf-s ${cls}"><h2>${title}</h2>${body}</section>`;
  const kp = (l, v, s) => `<div class="pf-k"><small>${l}</small><b>${v}</b><span>${s || ''}</span></div>`;
  const cmp = (n, p, l, good = 1) => `${ar(chg(n, p), good)} vs before · ${ar(chg(n, l), good)} vs last year`;

  function buildBusiness(c){
    const R = range(c), f = figs(R.from, R.to), p = figs(R.prev.from, R.prev.to), l = figs(R.ly.from, R.ly.to), b = B(), F = INS.facts();
    const has = k => c.s.includes(k), money = c.money !== false, anon = !!c.anon;
    const who = k => { const s = F.byStu.get(k); return anon ? 'A family' : (s ? s.name : k); };
    const out = [];
    /* the one-page summary */
    if(has('summary')){
      const hi = [];
      const prog = srt(grp(f.rows, r => r.prog, r => r.amt))[0];
      if(money){
        const d = chg(f.revenue, p.revenue); if(d != null) hi.push(`Money in was ${Ms(f.revenue)}, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d)}% on the period before${l.revenue ? ` and ${f.revenue >= l.revenue ? 'up' : 'down'} ${Math.abs(chg(f.revenue, l.revenue))}% on the same dates last year` : ''}.`);
        if(f.revenue) hi.push(`Profit was ${Ms(f.profit)}, a ${pc(f.profit, f.revenue)}% margin.`);
        if(prog) hi.push(`${esc(prog[0])} brought in the most: ${Ms(prog[1])}, ${pc(prog[1], f.tuition)}% of tuition.`);
        const up = srt(Object.fromEntries(Object.keys(f.byCat).map(k => [k, f.byCat[k] - (p.byCat[k] || 0)])))[0]; if(up && up[1] > 0) hi.push(`${esc(up[0])} spending rose the most, by ${Ms(up[1])}.`);
      }
      hi.push(`${f.newS.length} new student${f.newS.length === 1 ? '' : 's'} joined; ${f.active} ${f.active === 1 ? 'was' : 'were'} in a tuition period at the end.`);
      if(f.quotes.length) hi.push(`${pc(f.conv.length, f.quotes.length)}% of quotes became invoices (${f.conv.length} of ${f.quotes.length}).`);
      if(f.ended.length) hi.push(`${pc(f.renewed, f.ended.length)}% of tuition periods that ended were renewed.`);
      hi.push(`Tutors logged ${f.taught} sessions (${Math.round(f.hours)} hours); ${f.missS + f.missT} were missed.`);
      out.push(sec('Summary', `<div class="pf-ks">${money ? kp('Money in', Ms(f.revenue), cmp(f.revenue, p.revenue, l.revenue)) + kp('Spending', Ms(f.exp), cmp(f.exp, p.exp, l.exp, -1)) + kp('Profit', Ms(f.profit), `${f.revenue ? pc(f.profit, f.revenue) + '% margin · ' : ''}${ar(chg(f.profit, p.profit))} vs before`) : ''}
        ${kp('New students', f.newS.length, cmp(f.newS.length, p.newS.length, l.newS.length))}${kp('Students in a period', f.active, `${ar(chg(f.active, p.active))} vs before`)}
        ${kp('Quotes → invoices', f.quotes.length ? pc(f.conv.length, f.quotes.length) + '%' : '–', `${f.conv.length} of ${f.quotes.length}`)}${kp('Sessions taught', f.taught, `${Math.round(f.hours)} h · ${ar(chg(f.taught, p.taught))} vs before`)}
        ${kp('Renewals', f.ended.length ? pc(f.renewed, f.ended.length) + '%' : '–', `${f.renewed} of ${f.ended.length} periods that ended`)}${money ? '' : kp('Make-ups owed now', INS.sessFigures([b.thisMonth()]).owed, '')}</div>
        <h3>Highlights</h3><ul class="pf-hl">${hi.map(h => `<li>${h}</li>`).join('')}</ul>
        <p class="pf-n">"Before" is ${fmtD(R.prev.from)} – ${fmtD(R.prev.to)}. "Last year" is ${fmtD(R.ly.from)} – ${fmtD(R.ly.to)}.</p>`, 'first'));
    }
    if(has('trend')){
      const end = R.to.slice(0, 7), Ms12 = Array.from({length: 12}, (_, i) => b.addMonth(end, i - 11)), fg = Ms12.map(m => b.figures([m]));
      const series = money ? [{name: 'Money in', col: '#073763', vals: fg.map(x => x.revenue)}, {name: 'Spending', col: '#f4b223', vals: fg.map(x => x.exp)}, {name: 'Profit', col: '#2c7a4b', vals: fg.map(x => x.profit)}]
        : [{name: 'New students', col: '#073763', vals: Ms12.map(m => figs(m + '-01', lastDay(m)).newS.length)}, {name: 'Sessions taught ÷ 10', col: '#f4b223', vals: Ms12.map(m => Math.round(figs(m + '-01', lastDay(m)).taught / 10))}];
      out.push(sec('Last 12 months', '<div class="pf-chart">' + lit(INS.lineChart(Ms12.map(m => b.monShort(m)), series, money ? {label: 'Trend'} : {fmt: v => Math.round(v), fmtTip: v => v, label: 'Trend'})).replace(/width="100%" style="min-width:520px"/, 'width="714" height="228"') + '</div>'));
    }
    if(has('money') && money){
      const D = (key, title) => { const now = grp(f.rows, r => r[key], r => r.amt), bef = grp(p.rows, r => r[key], r => r.amt);
        return `<div><h3>${title}</h3>` + table(['', 'Amount', 'Share', 'vs before'], srt(now).slice(0, 10).map(([k, v]) => ({c: [esc(k), M(v), pc(v, f.tuition) + '%', ar(chg(v, bef[k] || 0))]}))) + '</div>'; };
      out.push(sec('Money in, explained', `<p class="pf-n">Tuition received ${M(f.tuition)}. Each payment is split across its invoice's subjects in proportion to their amounts.</p>
        <div class="pf-2">${D('prog', 'By programme')}${D('sub', 'By subject')}</div><div class="pf-2">${D('tutor', 'By tutor')}${D('mode', 'Online or in person')}</div>
        <div class="pf-2">${D('district', 'By district')}${D('school', 'By school')}</div><div class="pf-2">${D('newRet', 'New or returning')}${D('source', 'How they heard')}</div>`));
    }
    if(has('spending') && money){
      const bud = b.budget(), mf = Math.max(1, Math.round(HD.dayDiff(R.from, R.to) / 30.4)), cats = [...new Set([...Object.keys(f.byCat), ...Object.keys(p.byCat)])].sort((a, c) => (f.byCat[c] || 0) - (f.byCat[a] || 0));
      out.push(sec('Spending', table(['Category', 'This period', 'Before', 'Change', 'Budget'], cats.map(k => ({c: [esc(k), M(f.byCat[k] || 0), M(p.byCat[k] || 0), ar(chg(f.byCat[k] || 0, p.byCat[k] || 0), -1), num(bud[k]) ? M(num(bud[k]) * mf) : '–']})).concat([{cls: 'tot', c: ['Total', M(f.exp), M(p.exp), ar(chg(f.exp, p.exp), -1), M(sum(Object.values(bud), num) * mf)]}]),
        {note: `Spending is ${f.revenue ? pc(f.exp, f.revenue) + '% of money in' : 'not yet covered by money in'}${f.active ? `, about ${Ms(f.exp / f.active)} per student in a period` : ''}. Budgets are the monthly budget × ${mf} month${mf === 1 ? '' : 's'}.`})));
    }
    if(has('pl') && money){
      out.push(sec('Profit & loss', table(['', 'This period', 'Before', 'Last year'], [
        {c: ['Tuition received', M(f.tuition), M(p.tuition), M(l.tuition)]}, {c: ['Other money in', M(f.other), M(p.other), M(l.other)]}, {cls: 'sub', c: ['Money in', M(f.revenue), M(p.revenue), M(l.revenue)]},
        {c: ['Spending', '−' + M(f.exp), '−' + M(p.exp), '−' + M(l.exp)]}, {cls: 'tot', c: ['Profit', (f.profit < 0 ? '−' : '') + M(Math.abs(f.profit)), (p.profit < 0 ? '−' : '') + M(Math.abs(p.profit)), (l.profit < 0 ? '−' : '') + M(Math.abs(l.profit))]},
        {c: ['Margin', f.revenue ? pc(f.profit, f.revenue) + '%' : '–', p.revenue ? pc(p.profit, p.revenue) + '%' : '–', l.revenue ? pc(l.profit, l.revenue) + '%' : '–']}],
        {note: `Invoiced in this period: ${M(f.invoiced)} on ${f.nInv} invoices. Loans and owner investment (${M(f.capital)}) and loan repayments are not counted in profit.`})));
    }
    if(has('pipeline')){
      const reasons = srt(grp(f.lost, q => q.lost.reason || 'Other', () => 1));
      const waiting = F.S.filter(s => s.openQuote && !s.openQuote.lost).map(s => s.openQuote);
      out.push(sec('Quotes and conversion', `<div class="pf-ks">${kp('Quotes made', f.quotes.length, money ? Ms(f.quoted) : '')}${kp('Became invoices', f.quotes.length ? pc(f.conv.length, f.quotes.length) + '%' : '–', `${f.conv.length} of ${f.quotes.length} · before ${p.quotes.length ? pc(p.conv.length, p.quotes.length) + '%' : '–'}`)}${kp('Lost', f.lost.length, reasons.length ? 'main reason: ' + esc(reasons[0][0]) : '')}${kp('Waiting now', waiting.length, money ? Ms(sum(waiting, HD.total)) + ' quoted' : '')}</div>
        ${reasons.length ? '<h3>Why families didn\'t go ahead</h3>' + bars(reasons, f.lost.length, v => v + ' famil' + (v === 1 ? 'y' : 'ies')) : ''}
        ${!anon && waiting.length ? '<h3>Quotes waiting now</h3>' + table(['Student', 'Quote', 'Sent'].concat(money ? ['Amount'] : []), waiting.slice(0, 12).map(q => ({c: [esc(q.student || q.name), esc(q.number), nice(q.date)].concat(money ? [M(HD.total(q))] : [])}))) : ''}`));
    }
    if(has('sessions')){
      const S = INS.sessFigures([b.thisMonth()]), tut = srt(f.byTutor);
      out.push(sec('Sessions and tutors', `<div class="pf-ks">${kp('Sessions taught', f.taught, `${Math.round(f.hours)} h · ${f.made} make-ups`)}${kp('Missed', f.missS + f.missT, `${f.missS} student absent · ${f.missT} tutor couldn't teach`)}${kp('Make-ups owed now', S.owed, '')}${money ? kp('Refunded', Ms(f.refunds), 'for sessions not made up') : ''}</div>
        <h3>Where sessions happened</h3>${bars(['At LHQ', 'Online', 'At home'].map(k => [k, f.byMode[k] || 0]), f.taught, v => v + ' sessions')}
        <h3>Tutors</h3>${table(['Tutor', 'Sessions', 'Hours', 'Hours a week'], tut.map(([k, h]) => ({c: [esc(k), f.tutorN[k] || 0, Math.round(h), (h / Math.max(1, (HD.dayDiff(R.from, R.to) + 1) / 7)).toFixed(1)]})), {note: 'From tutors\' session logs. Sessions that weren\'t logged aren\'t counted.'})}`));
    }
    if(has('students')){
      const byP = {}; f.ended.forEach(x => { const o = byP[x.prog] = byP[x.prog] || [0, 0]; o[0]++; if(x.renewed) o[1]++; });
      const late = {}; F.invs.filter(i => i.date >= R.from && i.date <= R.to && i.dueDate).forEach(i => { const r = F.rcts.filter(x => UP(x.ref) === UP(i.number)).sort((a, c) => (a.date || '').localeCompare(c.date || '')).pop(); if(r && r.date > HD.addDays(i.dueDate, num(HD.settings.graceDays))){ const k = sk(i.student || i.name); late[k] = (late[k] || 0) + 1; } });
      out.push(sec('Students and renewals', `<div class="pf-ks">${kp('New students', f.newS.length, `${ar(chg(f.newS.length, p.newS.length))} vs before`)}${kp('Renewed', f.ended.length ? pc(f.renewed, f.ended.length) + '%' : '–', `${f.renewed} of ${f.ended.length} periods that ended`)}${kp('Paid on time', f.onTime != null ? f.onTime + '%' : '–', f.days != null ? `${f.days} days to pay on average` : '')}${money ? kp('Discounts given', Ms(f.discounts), '') : ''}</div>
        <div class="pf-2"><div><h3>New students by programme</h3>${bars(srt(grp(f.newS, s => INS.progOf(s.level), () => 1)), f.newS.length, v => v)}</div><div><h3>New students by district</h3>${bars(srt(grp(f.newS, s => s.district || 'Not recorded', () => 1)), f.newS.length, v => v)}</div></div>
        ${Object.keys(byP).length ? '<h3>Renewals by programme</h3>' + table(['Programme', 'Ended', 'Renewed', 'Rate'], Object.entries(byP).map(([k, o]) => ({c: [esc(k), o[0], o[1], pc(o[1], o[0]) + '%']}))) : ''}
        ${Object.keys(late).length ? (anon ? `<p class="pf-n">${Object.keys(late).length} famil${Object.keys(late).length === 1 ? 'y' : 'ies'} paid at least one invoice late.</p>` : '<h3>Paid late</h3>' + table(['Family', 'Late invoices'], srt(late).slice(0, 8).map(([k, n]) => ({c: [esc(who(k)), n]})))) : ''}`));
    }
    if(has('marketing')){
      const nb = grp(f.newS, s => s.heard || 'Not recorded', () => 1), keys = [...new Set([...Object.keys(nb), ...Object.keys(f.mktSpend)])].sort((a, c) => (nb[c] || 0) - (nb[a] || 0));
      const paidBy = k => sum(F.rows.filter(r => f.newS.some(s => (s.heard || 'Not recorded') === k && s.key === r.stu)), r => r.amt);
      out.push(sec('Marketing return', table(['Channel', 'New students'].concat(money ? ['Spent', 'They\'ve paid', 'Return'] : []), keys.map(k => { const sp = f.mktSpend[k] || 0, pd = paidBy(k);
        return {c: [esc(k) + (FREE_CHANNELS.includes(k) ? ' <i class="fl">word of mouth</i>' : ''), nb[k] || 0].concat(money ? [sp ? M(sp) : '–', M(pd), sp ? (pd / sp).toFixed(1) + '×' : '–'] : [])}; })),
        {note: 'Return = what the new students from a channel have paid so far ÷ what the channel cost in this period.'}));
    }
    if(has('other') && money){
      const loans = b.loans().filter(x => x.borrowed);
      out.push(sec('Other money in and loans', (f.inc.length ? table(['Date', 'Type', 'From', 'Amount'], f.inc.sort((a, c) => (a.date || '').localeCompare(c.date || '')).map(e => ({c: [nice(e.date), esc(e.cat) + (b.NOT_INCOME.includes(e.cat) ? ' <i class="fl">not income</i>' : ''), esc(e.from || ''), M(num(e.amount))]}))) : '<p class="pf-n">No other money in this period.</p>')
        + (loans.length ? '<h3>Loans</h3>' + table(['Lender', 'Borrowed', 'Repaid', 'Left'], loans.map(x => ({c: [esc(x.lender), M(x.borrowed), M(x.repaid), M(x.left)]}))) : '')));
    }
    if(has('pots') && money){
      const P = ((store.get('lhq_budget', {}) || {}).pots || {}).list || [];
      if(P.length) out.push(sec('Allocations', table(['Allocation', 'Share', 'Received', 'Spent', 'Difference'], P.map(pt => { const got = f.revenue * pt.p / 100, sp = sum(pt.cats || [], k => f.byCat[k] || 0);
        return {c: [esc(pt.n), pt.p + '%', M(got), M(sp), `<b style="color:${got - sp < 0 ? '#b42318' : '#1f7a4d'}">${got - sp < 0 ? '−' : ''}${M(Math.abs(got - sp))}</b>`]}; })), {note: 'Each allocation\'s share of money in during this period, and what its spending categories cost.'}));
    }
    return paper('Business report', c, R, out);
  }
  function paper(title, c, R, out, sub){
    const K = KINDS[rk], anon = !!c.anon;
    const head = `<header class="pf-h"><img src="logo.png" alt="LHQ" crossorigin="anonymous"><div><b>${esc(title)}</b><span>${sub ? esc(sub) + ' · ' : ''}${esc(R.label)}</span></div><div class="pf-m">${esc(K.AUD[c.aud] ? K.AUD[c.aud].n : 'Custom')}${anon ? ' · names left out' : ''}<br>Prepared ${fmtD(today())} by ${esc(me().name || 'LHQ')}</div></header>`;
    return {html: `<div class="pf-paper">${head}${out.join('') || '<p class="pf-n">Choose at least one section.</p>'}<footer class="pf-f">LHQ Learning Solutions · Lilongwe · ${c.aud === 'parent' ? 'learnhqes@gmail.com · +265 992 525 250' : 'Confidential' + (anon ? '' : ' · contains student names, keep inside LHQ')}</footer></div>`, R};
  }

  /* ---------- shared facts for the teaching reports ---------- */
  const DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const logsIn = (from, to) => (window.PC ? PC.rawLogs() : []).filter(e => e.d >= from && e.d <= to);
  const plannedIn = (card, x, from, to) => window.PC ? Math.max(0, PC.planned(card, x, to) - PC.planned(card, x, addDays(from, -1))) : 0;
  /* every card subject that runs during the dates: {s, card, inv, x, k: student|subject} */
  function subjIn(from, to){
    const out = [];
    HD.students().forEach(s => s.periods.forEach(p => { const c = p.card, inv = p.inv; if(!c) return;
      const a = c.periodStart || inv.periodStart || inv.date || '', z = c.periodEnd || inv.periodEnd || '9999';
      if(a > to || z < from) return;
      (c.subjects || []).forEach(x => x.name && out.push({s, card: c, inv, x, k: s.key + '|' + sk(x.name)})); }));
    return out;
  }
  const isTaught = e => e.a === 'attended' || e.a === 'late';
  const testPc = e => e.sc !== '' && e.sc != null && num(e.mx) > 0 ? num(e.sc) / num(e.mx) * 100 : null;
  const avg = L => L.length ? Math.round(sum(L) / L.length) : null;
  const pcs = v => v == null ? '–' : v + '%';

  /* ---------- Tuition report: how teaching is going overall ---------- */
  function buildTuition(c){
    const R = range(c), anon = !!c.anon, has = k => c.s.includes(k), t = today();
    const SJ = subjIn(R.from, R.to), E = logsIn(R.from, R.to), S = E.filter(e => e.ty === 's');
    const pl = sum(SJ, j => plannedIn(j.card, j.x, R.from, R.to < t ? R.to : t)), done = S.filter(isTaught).length;
    const absent = S.filter(e => e.a === 'absent').length, cant = S.filter(e => e.a === 'cancelled').length, made = S.filter(e => isTaught(e) && +e.mk).length;
    const studs = new Set(SJ.map(j => j.s.key)), name = k => anon ? 'A student' : ((HD.students().find(s => s.key === k) || {}).name || k);
    const prevE = logsIn(R.prev.from, R.prev.to).filter(e => e.ty === 's'), prevSJ = subjIn(R.prev.from, R.prev.to);
    const prevPl = sum(prevSJ, j => plannedIn(j.card, j.x, R.prev.from, R.prev.to)), prevDone = prevE.filter(isTaught).length;
    const tests = E.map(testPc).filter(v => v != null), out = [];
    if(has('summary')){
      out.push(sec('Summary', `<div class="pf-ks">${kp('Students taught', studs.size, `${SJ.length} subject${SJ.length === 1 ? '' : 's'}`)}${kp('Sessions delivered', `${done} of ${pl}`, `${pcs(pc(done, pl))} of planned · before ${prevE.length && prevPl ? pcs(pc(prevDone, prevPl)) : 'no logs'}`)}
        ${kp('Missed', absent + cant, `${absent} student absent · ${cant} tutor couldn't teach`)}${kp('Test average', pcs(avg(tests)), `${tests.length} test${tests.length === 1 ? '' : 's'}`)}</div>
        <p class="pf-n">"Planned" counts each subject's days on its tuition card between the dates (up to its number of sessions). "Delivered" is what tutors logged as attended or late, make-ups included (${made}).</p>`, 'first'));
    }
    if(has('delivery')){
      const bySub = {}; SJ.forEach(j => { const o = bySub[j.x.name] = bySub[j.x.name] || {st: new Set(), pl: 0, done: 0, miss: 0, T: []}; o.st.add(j.s.key); o.pl += plannedIn(j.card, j.x, R.from, R.to < t ? R.to : t); });
      S.forEach(e => { const o = bySub[e.sub]; if(!o) return; if(isTaught(e)) o.done++; else o.miss++; });
      E.forEach(e => { const o = bySub[e.sub], v = testPc(e); if(o && v != null) o.T.push(v); });
      out.push(sec('Delivery by subject', table(['Subject', 'Students', 'Planned', 'Delivered', 'Rate', 'Missed', 'Test avg'], srt(Object.fromEntries(Object.entries(bySub).map(([k, o]) => [k, o.st.size]))).map(([k]) => { const o = bySub[k];
        return {c: [esc(k), o.st.size, o.pl, o.done, `<b style="color:${pc(o.done, o.pl) >= 90 ? '#1f7a4d' : pc(o.done, o.pl) >= 70 ? '#7a5400' : '#b42318'}">${pcs(pc(o.done, o.pl))}</b>`, o.miss, pcs(avg(o.T))]}; }))));
      const wk = []; for(let d = mondayOf(R.from); d <= R.to; d = addDays(d, 7)) wk.push(d);
      if(wk.length > 1 && wk.length <= 26){ const ser = [{name: 'Planned', col: '#9aa3b2', vals: wk.map(w => sum(SJ, j => plannedIn(j.card, j.x, w, addDays(w, 6) < t ? addDays(w, 6) : t)))}, {name: 'Delivered', col: '#073763', vals: wk.map(w => S.filter(e => isTaught(e) && e.d >= w && e.d <= addDays(w, 6)).length)}];
        out.push(`<div class="pf-chart">${lit(INS.lineChart(wk.map(w => nice(w)), ser, {bars: true, fmt: v => Math.round(v), h: 200, label: 'Sessions by week'})).replace(/width="100%" style="min-width:520px"/, 'width="714" height="198"')}</div>`); }
    }
    if(has('programmes')){
      const g = {}; [...studs].forEach(k => { const st = HD.students().find(s => s.key === k); const p = INS.progOf(st && st.level); g[p] = (g[p] || 0) + 1; });
      const md = {}; S.filter(isTaught).forEach(e => { const m = e.md === 'o' ? 'Online' : e.md === 'h' ? 'At home' : 'At LHQ'; md[m] = (md[m] || 0) + 1; });
      out.push(sec('Students and where they learn', `<div class="pf-2"><div><h3>Students by programme</h3>${bars(srt(g), studs.size, v => v)}</div><div><h3>Sessions by place</h3>${bars(srt(md), done, v => v + ' sessions')}</div></div>`));
    }
    if(has('missed')){
      const owed = []; HD.students().forEach(s => { const cd = s.cur && s.cur.card; if(cd) HD.makeups(cd).filter(x => x.owed).forEach(x => owed.push([s.key, x])); });
      out.push(sec('Missed sessions and make-ups', `<div class="pf-ks">${kp('Student absent', absent)}${kp("Tutor couldn't teach", cant)}${kp('Make-ups taught', made)}${kp('Make-ups owed now', sum(owed, o => o[1].owed))}</div>
        ${owed.length ? '<h3>Make-ups owed now</h3>' + table(['Student', 'Subject', 'Tutor', 'Owed'], owed.sort((a, b) => b[1].owed - a[1].owed).slice(0, 20).map(([k, x]) => ({c: [esc(name(k)), esc(x.sub), esc(x.tutor || '–'), x.owed]}))) : ''}`));
    }
    if(has('topics')){
      const T = {}; E.forEach(e => (e.tp || []).forEach(x => { (T[e.sub] = T[e.sub] || new Set()).add(x); }));
      out.push(sec('Topics covered', Object.keys(T).length ? table(['Subject', 'Topics logged'], srt(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.size]))).map(([k, n]) => ({c: [esc(k), n]})), {note: 'Different topics tutors logged in their session entries during the dates.'}) : '<p class="pf-n">No topics logged in these dates.</p>'));
    }
    if(has('renewals')){
      const until = addDays(t, 30), L = HD.students().filter(s => s.cur && s.cur.inv.periodEnd && s.cur.inv.periodEnd >= t && s.cur.inv.periodEnd <= until);
      out.push(sec('Renewals in the next 30 days', L.length ? table(['Student', 'Period ends', 'Renewed'], L.sort((a, b) => a.cur.inv.periodEnd.localeCompare(b.cur.inv.periodEnd)).map(s => ({c: [esc(anon ? 'A student' : s.name), nice(s.cur.inv.periodEnd), s.status.k === 'renewed' || s.periods[0] && s.periods[0].inv.periodStart > t ? 'Yes' : 'Not yet']}))) : '<p class="pf-n">No tuition periods end in the next 30 days.</p>'));
    }
    if(has('gaps')){
      const noT = SJ.filter(j => !j.x.tutor && (j.card.periodEnd || '9999') >= t), noTime = SJ.filter(j => (j.x.days || []).length && !j.x.start && !(j.x.times && Object.keys(j.x.times).length) && (j.card.periodEnd || '9999') >= t);
      out.push(sec('Gaps to fix', (noT.length || noTime.length) ? table(['Student', 'Subject', 'What is missing'], noT.map(j => ({c: [esc(name(j.s.key)), esc(j.x.name), 'No tutor']})).concat(noTime.map(j => ({c: [esc(name(j.s.key)), esc(j.x.name), 'No session time']})))) : '<p class="pf-n">Every current subject has a tutor and a time.</p>'));
    }
    return paper('Tuition report', c, R, out);
  }

  /* ---------- Tutor report ---------- */
  const tutorList = () => { const T = new Set(); HD.students().forEach(s => s.periods.forEach(p => p.card && (p.card.subjects || []).forEach(x => x.tutor && T.add(x.tutor)))); return [...T].sort(); };
  function buildTutor(c){
    const R = range(c), has = k => c.s.includes(k), t = today(), end = R.to < t ? R.to : t, anon = !!c.anon;
    const SJ = subjIn(R.from, R.to).filter(j => j.x.tutor), E = logsIn(R.from, R.to);
    const T = c.tutor ? [c.tutor] : tutorList(), own = c.aud === 'tutor' && c.tutor;
    const lw = s => (s || '').toLowerCase();
    const of = n => { const J = SJ.filter(j => lw(j.x.tutor) === lw(n)), keys = new Set(J.map(j => j.k)), L = E.filter(e => keys.has(e.k.split('|')[0] + '|' + sk(e.sub)) || lw(e.tutor) === lw(n)), S = L.filter(e => e.ty === 's');
      const delay = S.filter(e => e.at).map(e => Math.max(0, HD.dayDiff(e.d, HD.isoOf(new Date(e.at)))));
      return {n, J, L, S, studs: new Set(J.map(j => j.s.key)).size, pl: sum(J, j => plannedIn(j.card, j.x, R.from, end)), done: S.filter(isTaught).length, cant: S.filter(e => e.a === 'cancelled').length, absent: S.filter(e => e.a === 'absent').length,
        hrs: sum(S.filter(isTaught), e => { const m = String(j0(J, e).mins || '1 hour'); return (/min/i.test(m) ? parseFloat(m) / 60 : parseFloat(m) || 1); }), delay: delay.length ? Math.round(sum(delay) / delay.length * 10) / 10 : null, late: delay.filter(d => d > 2).length,
        tests: avg(L.map(testPc).filter(v => v != null)), owed: sum(HD.students(), s => { const cd = s.cur && s.cur.card; return cd ? sum(HD.makeups(cd).filter(x => lw(x.tutor) === lw(n)), x => x.owed) : 0; })}; };
    const j0 = (J, e) => (J.find(j => j.k === e.k.split('|')[0] + '|' + sk(e.sub)) || {x: {}}).x;
    const D = T.map(of), out = [];
    if(has('summary')){
      out.push(sec(own ? 'Your summary' : 'Summary', table(['Tutor', 'Students', 'Planned', 'Logged', 'Rate', "Couldn't teach", 'Hours', 'Days to log', 'Test avg'],
        D.sort((a, b) => b.pl - a.pl).map(d => ({c: [esc(d.n), d.studs, d.pl, d.done, `<b style="color:${pc(d.done, d.pl) >= 90 ? '#1f7a4d' : pc(d.done, d.pl) >= 70 ? '#7a5400' : '#b42318'}">${pcs(pc(d.done, d.pl))}</b>`, d.cant, Math.round(d.hrs), d.delay == null ? '–' : d.delay, pcs(d.tests)]})),
        {note: '"Planned" comes from the days on each tuition card. "Rate" is sessions logged as taught against planned: a low rate means sessions were missed or not logged. "Days to log" is the average time between a session and its log.'}), 'first'));
    }
    if(has('students')) D.forEach(d => { if(!d.J.length) return;
      out.push(sec(`${esc(d.n)}: students`, table(['Student', 'Subject', 'Planned', 'Taught', 'Absent', 'Test avg', 'Last log'], d.J.filter((j, i, a) => a.findIndex(y => y.k === j.k) === i).map(j0 => { const same = d.J.filter(y => y.k === j0.k), j = Object.assign({}, j0, {pl: sum(same, y => plannedIn(y.card, y.x, R.from, end))}); const L = d.L.filter(e => e.k.split('|')[0] + '|' + sk(e.sub) === j.k), S = L.filter(e => e.ty === 's'), last = L.map(e => e.d).sort().pop();
        return {c: [esc(anon ? 'A student' : j.s.name), esc(j.x.name), j.pl, S.filter(isTaught).length, S.filter(e => e.a === 'absent').length, pcs(avg(L.map(testPc).filter(v => v != null))), last ? nice(last) : '<b style="color:#b42318">none</b>']}; })))); });
    if(has('logging')){
      const late = D.flatMap(d => d.S.filter(e => e.at && HD.dayDiff(e.d, HD.isoOf(new Date(e.at))) > 2).map(e => [d.n, e]));
      out.push(sec('Logging', `<div class="pf-ks">${kp('Logs in these dates', sum(D, d => d.S.length))}${kp('Logged over 2 days late', late.length)}${kp('Tutors with no logs', D.filter(d => d.pl && !d.S.length).length)}${kp('Make-ups owed now', sum(D, d => d.owed))}</div>
        ${D.filter(d => d.pl && !d.S.length).length ? `<p class="pf-n">No logs at all from: ${D.filter(d => d.pl && !d.S.length).map(d => esc(d.n)).join(', ')}.</p>` : ''}`));
    }
    if(has('makeups')){
      const rows = []; HD.students().forEach(s => { const cd = s.cur && s.cur.card; if(cd) HD.makeups(cd).filter(x => x.owed && T.some(n => lw(n) === lw(x.tutor))).forEach(x => rows.push({c: [esc(x.tutor), esc(anon ? 'A student' : s.name), esc(x.sub), x.missT ? `${x.missT} tutor` : '', x.owed]})); });
      out.push(sec('Make-ups owed', rows.length ? table(['Tutor', 'Student', 'Subject', 'Not taught by tutor', 'Owed'], rows) : '<p class="pf-n">No make-up sessions owed.</p>'));
    }
    return paper(own ? `Tutor report · ${c.tutor}` : 'Tutor report', c, R, out, c.tutor && !own ? c.tutor : '');
  }

  /* ---------- Student report ---------- */
  function buildStudent(c){
    const st = HD.students().find(x => x.key === c.stu);
    if(!st) return {html: '<div class="pf-paper"><p class="pf-n">Choose a student.</p></div>', R: range(c)};
    const R = range(c), has = k => c.s.includes(k), t = today(), end = R.to < t ? R.to : t;
    const SJ = subjIn(R.from, R.to).filter(j => j.s.key === st.key), E = logsIn(R.from, R.to).filter(e => e.k && e.k.split('|')[0] === st.key), S = E.filter(e => e.ty === 's');
    const pl = sum(SJ, j => plannedIn(j.card, j.x, R.from, end)), done = S.filter(isTaught).length, held = S.filter(e => e.a !== 'cancelled').length;
    const tests = E.filter(e => testPc(e) != null).sort((a, b) => a.d.localeCompare(b.d)), out = [];
    const subs = [...new Set(SJ.map(j => j.x.name))];
    if(has('summary')){
      out.push(sec(esc(st.name), `<p style="margin:0 0 8px">${esc([st.level, st.school].filter(Boolean).join(' · '))}</p>
        <div class="pf-ks">${kp('Attendance', held ? pcs(pc(S.filter(isTaught).length, held)) : '–', `${S.filter(isTaught).length} of ${held} sessions`)}${kp('Sessions', `${done} of ${pl}`, 'taught of planned so far')}${kp('Test average', pcs(avg(tests.map(testPc))), `${tests.length} test${tests.length === 1 ? '' : 's'}`)}${kp('Subjects', subs.length, subs.join(', '))}</div>
        <h3>Subjects and tutors</h3>${table(['Subject', 'Tutor', 'Days and times'], SJ.filter((j, i, a) => a.findIndex(y => y.x.name === j.x.name) === i).map(j => ({c: [esc(j.x.name), esc(j.x.tutor || 'To be confirmed'), esc((j.x.days || []).map(d => ({Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'})[d] || d).join(', ') + (j.x.start ? ' · ' + j.x.start + '–' + (j.x.end || '') : ''))]})))}`, 'first'));
    }
    if(has('attendance')){
      out.push(sec('Attendance by subject', table(['Subject', 'Planned', 'Attended', 'Late', 'Absent', "Tutor couldn't teach", 'Make-ups'], subs.map(n => { const X = S.filter(e => e.sub === n), J = SJ.filter(j => j.x.name === n);
        return {c: [esc(n), sum(J, j => plannedIn(j.card, j.x, R.from, end)), X.filter(e => e.a === 'attended').length, X.filter(e => e.a === 'late').length, X.filter(e => e.a === 'absent').length, X.filter(e => e.a === 'cancelled').length, X.filter(e => isTaught(e) && +e.mk).length]}; }))));
    }
    if(has('topics')){
      const T = {}; E.forEach(e => (e.tp || []).forEach(x => { (T[e.sub] = T[e.sub] || []).includes(x) || T[e.sub].push(x); }));
      out.push(sec('Topics covered', Object.keys(T).length ? Object.entries(T).map(([k, L]) => `<h3>${esc(k)} · ${L.length}</h3><p style="margin:0">${L.map(esc).join(' · ')}</p>`).join('') : '<p class="pf-n">No topics logged yet in these dates.</p>'));
    }
    if(has('tests')){
      const bySub = subs.filter(n => tests.some(e => e.sub === n)).map(n => { const L = tests.filter(e => e.sub === n), v = L.map(testPc); return {n, L, v, avg: avg(v), first: Math.round(v[0]), last: Math.round(v[v.length - 1]), best: Math.round(Math.max(...v))}; });
      const wk = []; if(tests.length) for(let d = mondayOf(tests[0].d); d <= tests[tests.length - 1].d; d = addDays(d, 7)) wk.push(d);
      const series = bySub.map((x, i) => { let lastV = null; return {name: x.n, col: ['#073763','#f4b223','#1a74b0','#2c7a4b','#a85a14'][i % 5], vals: wk.map(w => { const v = x.L.filter(e => e.d >= w && e.d <= addDays(w, 6)).map(testPc); if(v.length) lastV = Math.round(sum(v) / v.length); return lastV == null ? 0 : lastV; })}; });
      out.push(sec('Test scores', tests.length ? table(['Subject', 'Tests', 'Average', 'First', 'Latest', 'Best'], bySub.map(x => ({c: [esc(x.n), x.L.length, `<b>${x.avg}%</b>`, x.first + '%', `${x.last}% ${x.last > x.first ? '<i class="up">▲</i>' : x.last < x.first ? '<i class="dn">▼</i>' : ''}`, x.best + '%']})))
        + (wk.length > 1 ? `<h3>Weekly average</h3><div class="pf-chart">${lit(INS.lineChart(wk.map(w => nice(w)), series, {fmt: v => Math.round(v) + '%', fmtTip: v => v + '%', h: 190, label: 'Test scores'})).replace(/width="100%" style="min-width:520px"/, 'width="714" height="188"')}</div>` : '')
        + (c.aud === 'internal' ? '<h3>Every test</h3>' + table(['Date', 'Subject', 'Score', '%'], tests.map(e => ({c: [nice(e.d), esc(e.sub), `${e.sc} / ${e.mx}`, `${Math.round(testPc(e))}%`]}))) : '')
        : '<p class="pf-n">No tests logged yet in these dates.</p>'));
    }
    if(has('comments')){
      const C = E.filter(e => e.ty === 'c').sort((a, b) => b.d.localeCompare(a.d)), notes = S.filter(e => e.n).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 8);
      out.push(sec("Tutors' comments", (C.length ? C.slice(0, 6).map(e => `<h3>${esc(e.sub)} · ${nice(e.d)}</h3>${[['Doing well', e.cs], ['To work on', e.ci], ['Next', e.cn]].filter(x => x[1]).map(([l, v]) => `<p style="margin:2px 0"><b>${l}:</b> ${esc(String(v).replace(/^\s*(next( steps?)?|to work on|doing well)\s*:\s*/i, ''))}</p>`).join('')}`).join('') : '')
        + (notes.length ? '<h3>From session logs</h3>' + notes.map(e => `<p style="margin:2px 0"><b>${nice(e.d)} · ${esc(e.sub)}:</b> ${esc(e.n)}</p>`).join('') : '') || '<p class="pf-n">No comments yet in these dates.</p>'));
    }
    if(has('next') && (c.next || '').trim()) out.push(sec('Next steps', `<p style="margin:0;white-space:pre-wrap">${esc(c.next.trim())}</p>`));
    if(has('payments') && c.money !== false && can('money')){
      const I0 = st.periods.map(p => p.inv).filter(i => (i.date || '') <= R.to && (i.periodEnd || i.date || '') >= R.from);
      out.push(sec('Payments', I0.length ? table(['Invoice', 'Tuition period', 'Total', 'Paid', 'Balance'], I0.map(i => { const x = HD.invState(i); return {c: [esc(i.number), esc(range0(i)), M(x.total), M(x.paid), x.balance > 0.005 ? `<b>${M(x.balance)}</b>` : 'Paid']}; })) : '<p class="pf-n">No invoices in these dates.</p>'));
    }
    return paper('Student report', c, R, out);
  }
  const range0 = i => i.periodStart ? `${nice(i.periodStart)} – ${nice(i.periodEnd || '')}` : '';

  /* ---------- the four reports ---------- */
  const KINDS = {
    business: {t: 'Business report', d: 'Money in, spending, profit, pipeline and marketing, for the Director, a staff meeting, partners or the board.', need: 'pl', SECTIONS, AUD, build: buildBusiness},
    tuition: {t: 'Tuition report', d: 'How teaching is going: sessions delivered against planned, missed sessions, make-ups, tests, renewals and gaps.', need: 'pl|cards|students',
      SECTIONS: [['summary','Summary'],['delivery','Delivery by subject'],['programmes','Students and where they learn'],['missed','Missed sessions and make-ups'],['topics','Topics covered'],['renewals','Renewals coming'],['gaps','Gaps to fix']],
      AUD: {director: {n: 'Director', s: ['summary','delivery','programmes','missed','topics','renewals','gaps'], anon: false, money: false}, staff: {n: 'Staff meeting', s: ['summary','delivery','missed','renewals','gaps'], anon: false, money: false}, partners: {n: 'Partners', s: ['summary','delivery','programmes','topics'], anon: true, money: false}}, build: buildTuition},
    tutor: {t: 'Tutor report', d: 'Each tutor’s students, sessions logged against planned, how promptly they log, test results and make-ups owed.', need: 'pl|tutors',
      SECTIONS: [['summary','Summary'],['students','Each tutor’s students'],['logging','Logging'],['makeups','Make-ups owed']],
      AUD: {director: {n: 'Director', s: ['summary','students','logging','makeups'], anon: false, money: false}, tutor: {n: 'The tutor’s own copy', s: ['summary','students','makeups'], anon: false, money: false}}, build: buildTutor, pick: 'tutor'},
    student: {t: 'Student report', d: 'One student: attendance, sessions, topics covered, test scores, tutors’ comments, next steps and (for LHQ) payments.', need: 'pl|students|cards', dflt: 'period',
      SECTIONS: [['summary','Summary'],['attendance','Attendance'],['topics','Topics covered'],['tests','Test scores'],['comments','Tutors’ comments'],['next','Next steps'],['payments','Payments']],
      AUD: {parent: {n: 'Parent', s: ['summary','attendance','topics','tests','comments','next'], anon: false, money: false}, internal: {n: 'Inside LHQ', s: ['summary','attendance','topics','tests','comments','next','payments'], anon: false, money: true}}, build: buildStudent, pick: 'student'},
  };
  const okK = k => KINDS[k] && KINDS[k].need.split('|').some(x => can(x));
  function build(c){ return KINDS[rk].build(c); }

  /* ---------- the choice sheet ---------- */
  function sheet(){
    const b = B(), K = KINDS[rk], c = cfg(), tm = b.thisMonth(), A = K.AUD;
    const qs = Array.from({length: 8}, (_, i) => b.shift(b.qOf(tm), -i)), ys = Array.from({length: 4}, (_, i) => 'fy' + (b.fyOf(tm) - i));
    const atFor = k => k === 'month' ? `<input class="in" type="month" id="pfAt" value="${esc(/^\d{4}-\d\d$/.test(c.at) ? c.at : tm)}" max="${tm}">`
      : k === 'quarter' ? `<select class="in" id="pfAt">${qs.map(q => `<option value="${q}" ${q === c.at ? 'selected' : ''}>${esc(b.periodLabel(q).replace(/ · to date$/, ''))}</option>`).join('')}</select>`
      : k === 'year' ? `<select class="in" id="pfAt">${ys.map(y => `<option value="${y}" ${y === c.at ? 'selected' : ''}>${esc(b.periodLabel(y).replace(/ · to date$/, ''))}</option>`).join('')}</select>`
      : k === 'week' ? `<input class="in" type="date" id="pfAt" value="${esc(/^\d{4}-\d\d-\d\d$/.test(c.at) ? c.at : today())}" max="${today()}">`
      : k === 'period' ? '<p class="note" style="margin:0">The student’s current tuition period.</p>'
      : `<div class="r2"><input class="in" type="date" id="pfFrom" value="${esc(c.from || addDays(today(), -29))}"><input class="in" type="date" id="pfTo" value="${esc(c.to || today())}"></div>`;
    const kinds = (rk === 'student' ? [['period','This period']] : []).concat([['week','Week'],['month','Month'],['quarter','Quarter'],['year','Year'],['custom','Dates']]);
    const pick = K.pick === 'tutor' ? `<label class="f"><span>Tutor</span><select class="in" id="pfWho"><option value="">All tutors</option>${tutorList().map(n => `<option ${n === c.tutor ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`
      : K.pick === 'student' ? `<label class="f"><span>Student</span><select class="in" id="pfWho">${HD.students().slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${esc(s.key)}" ${s.key === c.stu ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : '';
    openSheet(`<div class="hx"><h3>${esc(K.t)}</h3><button class="ib" data-close>✕</button></div>${pick}
      <div class="cap">Covering</div><div class="seg" id="pfKind" style="flex-wrap:wrap">${kinds.map(([k, l]) => `<button class="${c.kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <div id="pfAtW" style="margin:10px 0 14px">${atFor(c.kind)}</div>
      <div class="cap">For</div><div class="chips" id="pfAud">${Object.entries(A).map(([k, a]) => `<button class="chip ${c.aud === k ? 'on' : ''}" data-a="${k}">${a.n}</button>`).join('')}</div>
      <div class="cap" style="margin-top:12px">Sections</div><div class="chips" id="pfSec">${K.SECTIONS.map(([k, l]) => `<button class="chip ${c.s.includes(k) ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
      ${rk === 'student' ? `<label class="f" style="margin-top:10px"><span>Next steps (written by you, shown if the section is ticked)</span><textarea class="in" id="pfNext" rows="3" placeholder="e.g. Two past papers a week before the mocks">${esc(c.next || '')}</textarea></label>` : ''}
      ${rk === 'student' ? '' : `<label class="chk" style="display:flex;gap:8px;align-items:center;margin:12px 0 4px"><input type="checkbox" id="pfAnon" ${c.anon ? 'checked' : ''}> Leave out student names</label>`}
      ${rk === 'business' ? `<label class="chk" style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="pfMoney" ${c.money !== false ? 'checked' : ''}> Show money figures</label>` : ''}
      <button class="btn n full" id="pfGo" style="margin-top:10px">Make the report</button>`);
    let kind = c.kind;
    document.querySelectorAll('#pfKind button').forEach(x => x.onclick = () => { kind = x.dataset.k; document.querySelectorAll('#pfKind button').forEach(y => y.classList.toggle('on', y === x)); $('pfAtW').innerHTML = atFor(kind); });
    document.querySelectorAll('#pfAud .chip').forEach(x => x.onclick = () => { const a = A[x.dataset.a]; document.querySelectorAll('#pfAud .chip').forEach(y => y.classList.toggle('on', y === x));
      document.querySelectorAll('#pfSec .chip').forEach(y => y.classList.toggle('on', a.s.includes(y.dataset.s))); if($('pfAnon')) $('pfAnon').checked = a.anon; if($('pfMoney')) $('pfMoney').checked = a.money; });
    document.querySelectorAll('#pfSec .chip').forEach(x => x.onclick = () => x.classList.toggle('on'));
    $('pfGo').onclick = () => {
      const aud = (document.querySelector('#pfAud .on') || {dataset: {}}).dataset.a || Object.keys(A)[0];
      const n = {kind, aud, s: [...document.querySelectorAll('#pfSec .on')].map(x => x.dataset.s), anon: $('pfAnon') ? $('pfAnon').checked : false, money: $('pfMoney') ? $('pfMoney').checked : A[aud].money};
      if(kind === 'custom'){ n.from = $('pfFrom').value; n.to = $('pfTo').value; n.at = ''; } else if($('pfAt')) n.at = $('pfAt').value;
      if($('pfWho')) n[K.pick === 'tutor' ? 'tutor' : 'stu'] = $('pfWho').value;
      if($('pfNext')) n.next = $('pfNext').value;
      if(K.pick === 'tutor' && aud === 'tutor' && !n.tutor){ toast('Choose the tutor for their own copy'); return; }
      if(!n.s.length){ toast('Choose at least one section'); return; }
      saveCfg(Object.assign(cfg(), n)); closeSheet();
      const h = '#rep/' + rk + (rk === 'student' && n.stu ? '/' + encodeURIComponent(n.stu) : '');
      if(location.hash === h) render(); else location.hash = h;
    };
  }

  /* ---------- the pages and the PDF ---------- */
  function hub(){
    const K = Object.entries(KINDS).filter(([k]) => okK(k));
    return `<div class="ph"><div class="tt"><h1>Reports</h1><p>Reports to download or send. Live numbers are on Business.</p></div></div>
      <div class="rp-grid">${K.map(([k, x]) => `<a class="card pad rp-c" href="#rep/${k}"><b>${esc(x.t)}</b><span>${esc(x.d)}</span><i>${ic('chev',16,2.2)}</i></a>`).join('')}
      <a class="card pad rp-c" href="reports.html"><b>Parent progress reports</b><span>The weekly, two-weekly and monthly reports sent to parents from tutors’ logs.</span><i>${ic('chev',16,2.2)}</i></a></div>
      ${K.length ? '' : '<p class="note">Ask the Director for access to the LHQ reports.</p>'}`;
  }
  function page(kind, arg){
    if(!kind) return hub();
    if(!KINDS[kind]) kind = 'business';
    if(!okK(kind)) return `${crumb('#reports', 'Reports', 'rep/')}<p class="empty">You don't have access to the ${esc(KINDS[kind].t.toLowerCase())}.</p>`;
    rk = kind; const K = KINDS[kind];
    if(kind === 'student' && arg){ const c0 = cfg(); if(c0.stu !== arg){ c0.stu = arg; c0.kind = 'period'; saveCfg(c0); } }
    const c = cfg();
    if(kind === 'student' && !c.stu){ const s0 = HD.students().find(s => s.cur) || HD.students()[0]; if(s0){ c.stu = s0.key; saveCfg(c); } }
    const {html, R} = build(c);
    return `${crumb('#reports', 'Reports', 'rep/' + kind)}<div class="ph"><div class="tt"><h1>${esc(K.t)}</h1><p>${esc(R.label)} · ${esc(K.AUD[c.aud] ? K.AUD[c.aud].n : 'Custom')}</p></div>
      <div class="acts"><button class="btn" id="pfChange">${ic('edit',16)} Change</button><button class="btn n" id="pfPdf">${ic('down',16,2.2)} Download PDF</button></div></div>
      <div class="pf-wrap">${html}</div><div id="pfStage" style="position:fixed;left:-10000px;top:0;width:794px"></div>`;
  }
  async function pdf(btn){
    const c = cfg(), K = KINDS[rk], {html, R} = build(c), stage = $('pfStage'); stage.innerHTML = html; btn.disabled = true; toast('Preparing the PDF…');
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all([...stage.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      const el = stage.firstElementChild, w = el.offsetWidth;
      const blob = await (await lhqPdf())().set({margin: [10, 0, 12, 0], image: {type: 'jpeg', quality: 0.96},
        html2canvas: {scale: 2, useCORS: true, backgroundColor: '#ffffff', x: 0, y: 0, scrollX: 0, scrollY: 0, width: w, windowWidth: w},
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, pagebreak: {mode: ['css'], before: rk === 'business' ? '.pf-s.first + .pf-s' : [], avoid: ['.pf-t.sm', '.pf-t tr', '.pf-b', '.pf-ks', 'h2', 'h3', '.pf-chart', '.pf-hl li']}}).from(el).outputPdf('blob');
      const who = rk === 'student' ? ((HD.students().find(s => s.key === c.stu) || {}).name || '') : rk === 'tutor' ? (c.tutor || 'All tutors') : (K.AUD[c.aud] || {}).n || '';
      const name = `LHQ ${K.t}_ ${who ? who + '_ ' : ''}${R.label}.pdf`.replace(/[\\/:*?"<>|]/g, '');
      const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
      toast('PDF downloaded');
    }catch(e){ console.error(e); toast('Couldn\'t make the PDF. Try again.'); }
    finally{ stage.innerHTML = ''; btn.disabled = false; }
  }
  function fit(){ const w = document.querySelector('.pf-wrap'), p = w && w.querySelector('.pf-paper'); if(!p) return; p.style.zoom = Math.min(1, (w.clientWidth - 8) / 794); }
  function bind(){
    fit(); if(!window._pfFit){ window._pfFit = 1; addEventListener('resize', fit); }
    if($('pfChange')) $('pfChange').onclick = sheet;
    if($('pfPdf')) $('pfPdf').onclick = () => pdf($('pfPdf'));
  }
  return {page, bind, sheet, build, range, figs, KINDS, okK};
})();
