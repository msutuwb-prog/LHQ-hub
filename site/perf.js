/* LHQ Hub › Business › Performance report: any week, month, quarter, year or dates, with the sections chosen for who
   will read it (Director, Staff meeting, Partners, Board). A one-page summary first, then the detail, each figure
   compared with the period before and the same dates last year. Student names are left out when it leaves LHQ.
   Shown as a page at #perf, downloaded as an A4 PDF. Uses BIZ, INS and HD, and index.html's helpers. */
window.PERF = (function(){
  const KEY = 'lhq_perf';
  const SECTIONS = [['summary','One-page summary'],['trend','12-month trend'],['money','Money in, explained'],['spending','Spending'],['pl','Profit & loss'],
    ['pipeline','Quotes and conversion'],['sessions','Sessions and tutors'],['students','Students and renewals'],['marketing','Marketing return'],['other','Other money in and loans'],['pots','Pots']];
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

  function cfg(){ let c = {}; try{ c = JSON.parse(localStorage.getItem(KEY) || '{}'); }catch(e){}
    const a = AUD[c.aud] || AUD.director;
    return Object.assign({kind: 'month', at: B().thisMonth(), from: '', to: '', aud: 'director', s: a.s.slice(), anon: a.anon, money: a.money}, c); }
  const saveCfg = c => { try{ localStorage.setItem(KEY, JSON.stringify(c)); }catch(e){} };

  /* the dates a choice covers, the period before it, and the same dates last year */
  function range(c){
    const b = B(), t = today(); let from, to, label, prevF, prevT;
    if(c.kind === 'week'){ from = mondayOf(c.at || t); to = addDays(from, 6); label = `Week of ${fmtD(from)}`; }
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
    return `<table class="pf-t"><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${h}</th>`).join('')}</tr>${rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.c.map((v, i) => `<td${i ? ' class="r"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</table>${o.note ? `<p class="pf-n">${o.note}</p>` : ''}`;
  }
  function bars(list, total, fmt = Ms){
    const max = Math.max(1, ...list.map(x => x[1]));
    return list.map(([k, v, x]) => `<div class="pf-b"><div class="h"><b>${esc(k)}</b><span>${fmt(v)}${total ? ` · ${pc(v, total)}%` : ''}${x ? ' · ' + x : ''}</span></div><div class="tr"><i style="width:${v / max * 100}%"></i></div></div>`).join('') || '<p class="pf-n">Nothing in this period.</p>';
  }
  const sec = (title, body, cls = '') => `<section class="pf-s ${cls}"><h2>${title}</h2>${body}</section>`;
  const kp = (l, v, s) => `<div class="pf-k"><small>${l}</small><b>${v}</b><span>${s || ''}</span></div>`;
  const cmp = (n, p, l, good = 1) => `${ar(chg(n, p), good)} vs before · ${ar(chg(n, l), good)} vs last year`;

  function build(c){
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
      if(P.length) out.push(sec('Pots', table(['Pot', 'Share', 'Received', 'Spent', 'Difference'], P.map(pt => { const got = f.revenue * pt.p / 100, sp = sum(pt.cats || [], k => f.byCat[k] || 0);
        return {c: [esc(pt.n), pt.p + '%', M(got), M(sp), `<b style="color:${got - sp < 0 ? '#b42318' : '#1f7a4d'}">${got - sp < 0 ? '−' : ''}${M(Math.abs(got - sp))}</b>`]}; })), {note: 'Each pot\'s share of money in during this period, and what its spending categories cost.'}));
    }
    const head = `<header class="pf-h"><img src="logo.png" alt="LHQ" crossorigin="anonymous"><div><b>Performance report</b><span>${esc(R.label)}</span></div><div class="pf-m">${esc(AUD[c.aud] ? AUD[c.aud].n : 'Custom')}${anon ? ' · student names left out' : ''}<br>Prepared ${fmtD(today())} by ${esc(me().name || 'LHQ')}</div></header>`;
    return {html: `<div class="pf-paper">${head}${out.join('') || '<p class="pf-n">Choose at least one section.</p>'}<footer class="pf-f">LHQ Learning Solutions · Lilongwe · Confidential${anon ? '' : ' · contains student names, keep inside LHQ'}</footer></div>`, R};
  }

  /* ---------- the choice sheet ---------- */
  function sheet(){
    const b = B(), c = cfg(), tm = b.thisMonth();
    const qs = Array.from({length: 8}, (_, i) => b.shift(b.qOf(tm), -i)), ys = Array.from({length: 4}, (_, i) => 'fy' + (b.fyOf(tm) - i));
    const atFor = k => k === 'month' ? `<input class="in" type="month" id="pfAt" value="${esc(/^\d{4}-\d\d$/.test(c.at) ? c.at : tm)}" max="${tm}">`
      : k === 'quarter' ? `<select class="in" id="pfAt">${qs.map(q => `<option value="${q}" ${q === c.at ? 'selected' : ''}>${esc(b.periodLabel(q).replace(/ · to date$/, ''))}</option>`).join('')}</select>`
      : k === 'year' ? `<select class="in" id="pfAt">${ys.map(y => `<option value="${y}" ${y === c.at ? 'selected' : ''}>${esc(b.periodLabel(y).replace(/ · to date$/, ''))}</option>`).join('')}</select>`
      : k === 'week' ? `<input class="in" type="date" id="pfAt" value="${esc(/^\d{4}-\d\d-\d\d$/.test(c.at) ? c.at : today())}" max="${today()}">`
      : `<div class="r2"><input class="in" type="date" id="pfFrom" value="${esc(c.from || addDays(today(), -29))}"><input class="in" type="date" id="pfTo" value="${esc(c.to || today())}"></div>`;
    openSheet(`<div class="hx"><h3>Performance report</h3><button class="ib" data-close>✕</button></div>
      <div class="cap">Covering</div><div class="seg" id="pfKind">${[['week','Week'],['month','Month'],['quarter','Quarter'],['year','Year'],['custom','Dates']].map(([k, l]) => `<button class="${c.kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <div id="pfAtW" style="margin:10px 0 14px">${atFor(c.kind)}</div>
      <div class="cap">For</div><div class="chips" id="pfAud">${Object.entries(AUD).map(([k, a]) => `<button class="chip ${c.aud === k ? 'on' : ''}" data-a="${k}">${a.n}</button>`).join('')}</div>
      <div class="cap" style="margin-top:12px">Sections</div><div class="chips" id="pfSec">${SECTIONS.map(([k, l]) => `<button class="chip ${c.s.includes(k) ? 'on' : ''}" data-s="${k}">${l}</button>`).join('')}</div>
      <label class="chk" style="display:flex;gap:8px;align-items:center;margin:12px 0 4px"><input type="checkbox" id="pfAnon" ${c.anon ? 'checked' : ''}> Leave out student names</label>
      <label class="chk" style="display:flex;gap:8px;align-items:center;margin:0 0 12px"><input type="checkbox" id="pfMoney" ${c.money !== false ? 'checked' : ''}> Show money figures</label>
      <button class="btn n full" id="pfGo">Make the report</button>`);
    let kind = c.kind;
    document.querySelectorAll('#pfKind button').forEach(x => x.onclick = () => { kind = x.dataset.k; document.querySelectorAll('#pfKind button').forEach(y => y.classList.toggle('on', y === x)); $('pfAtW').innerHTML = atFor(kind); });
    document.querySelectorAll('#pfAud .chip').forEach(x => x.onclick = () => { const a = AUD[x.dataset.a]; document.querySelectorAll('#pfAud .chip').forEach(y => y.classList.toggle('on', y === x));
      document.querySelectorAll('#pfSec .chip').forEach(y => y.classList.toggle('on', a.s.includes(y.dataset.s))); $('pfAnon').checked = a.anon; $('pfMoney').checked = a.money; });
    document.querySelectorAll('#pfSec .chip').forEach(x => x.onclick = () => x.classList.toggle('on'));
    $('pfGo').onclick = () => {
      const aud = (document.querySelector('#pfAud .on') || {dataset: {}}).dataset.a || 'director';
      const n = {kind, aud, s: [...document.querySelectorAll('#pfSec .on')].map(x => x.dataset.s), anon: $('pfAnon').checked, money: $('pfMoney').checked};
      if(kind === 'custom'){ n.from = $('pfFrom').value; n.to = $('pfTo').value; n.at = ''; } else n.at = $('pfAt').value;
      if(!n.s.length){ toast('Choose at least one section'); return; }
      saveCfg(Object.assign(cfg(), n)); closeSheet();
      if(location.hash === '#perf') render(); else location.hash = '#perf';
    };
  }

  /* ---------- the page and the PDF ---------- */
  function page(){
    if(!can('pl')) return '<p class="empty">Only people who can see profit and loss can make performance reports.</p>';
    const c = cfg(), {html, R} = build(c);
    return `<div class="ph"><div class="tt"><h1>Performance report</h1><p>${esc(R.label)} · ${esc(AUD[c.aud] ? AUD[c.aud].n : 'Custom')}</p></div>
      <div class="acts"><button class="btn" id="pfChange">${ic('edit',16)} Change</button><button class="btn n" id="pfPdf">${ic('down',16,2.2)} Download PDF</button></div></div>
      <div class="pf-wrap">${html}</div><div id="pfStage" style="position:fixed;left:-10000px;top:0;width:794px"></div>`;
  }
  async function pdf(btn){
    const c = cfg(), {html, R} = build(c), stage = $('pfStage'); stage.innerHTML = html; btn.disabled = true; toast('Preparing the PDF…');
    try{
      if(document.fonts && document.fonts.ready) await document.fonts.ready;
      await Promise.all([...stage.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      const el = stage.firstElementChild, w = el.offsetWidth, h = el.offsetHeight;
      const blob = await (await lhqPdf())().set({margin: [10, 0, 12, 0], image: {type: 'jpeg', quality: 0.96},
        html2canvas: {scale: 2, useCORS: true, backgroundColor: '#ffffff', x: 0, y: 0, scrollX: 0, scrollY: 0, width: w, windowWidth: w},
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, pagebreak: {mode: ['css'], before: '.pf-s.first + .pf-s', avoid: ['.pf-t tr', '.pf-b', '.pf-ks', 'h2', 'h3', '.pf-chart', '.pf-hl li']}}).from(el).outputPdf('blob');
      const name = `LHQ Performance report_ ${R.label}_ ${AUD[c.aud] ? AUD[c.aud].n : 'Custom'}.pdf`.replace(/[\\/:*?"<>|]/g, '');
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
  return {page, bind, sheet, build, range, figs, AUD, SECTIONS};
})();
