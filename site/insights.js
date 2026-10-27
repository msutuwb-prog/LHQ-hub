/* LHQ Hub › Business insights: Overview, Money in, Pipeline, Sessions, Spending comparisons, a category's own page,
   Charts, Marketing return, and Pots (the budgeting tool that splits money in by percentage).
   Loaded by index.html after business.js; uses BIZ for periods and figures, HD for students and documents,
   and index.html's helpers (esc, mk, mkShort, num, nice, ic, openSheet, toast, render, store, can …).

   Where the numbers come from
     money in      payments received (receipts). A payment is split across its invoice's subjects in proportion to
                   their amounts; the invoice gives the level, the tuition card the tutor and where, the student's
                   record the school, area, district and how they heard about LHQ.
     sessions      tutors' session logs (only what tutors have logged is counted).
     spending      Business › Spending; other money in from Record money in. */
window.INS = (function(){
  const ym = iso => String(iso || '').slice(0, 7);
  const B = () => window.BIZ;
  const DIMS = [['prog','Programme'],['sub','Subject'],['level','Year & level'],['tutor','Tutor'],['school','School'],['area','Area'],['district','District'],['mode','Online / in person'],['newRet','New or returning'],['source','How they heard']];
  const DIM = Object.fromEntries(DIMS);
  const LOST_REASONS = ['Price','Timing / not now','Chose another tutor or centre','No response','Moved away','Other'];
  const COLORS = ['var(--inc)','#f4b223','#1a74b0','#2c7a4b','#a85a14','#7a3f8f','#9aa3b2'];
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const chg = (now, before) => before ? Math.round((now - before) / Math.abs(before) * 100) : null;
  const arrow = (p, good = 1) => p == null ? '<span class="fl">new</span>' : p === 0 ? '<span class="fl">no change</span>' : `<span class="${(p > 0) === (good > 0) ? 'up' : 'dn'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}%</span>`;
  const sum = (L, f) => L.reduce((a, x) => a + (f ? f(x) : x), 0);
  const groupSum = (L, key, val) => { const o = {}; L.forEach(x => { const k = key(x); o[k] = (o[k] || 0) + val(x); }); return o; };
  const sortObj = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const progOf = lv => { const l = String(lv || ''), y = +((l.match(/year\s*(\d+)/i) || [])[1] || 0);
    if(/\bIB\b/i.test(l)) return 'IB'; if(/IELTS/i.test(l)) return 'IELTS'; if(/\bSAT\b/i.test(l)) return 'SAT'; if(/college/i.test(l)) return 'College';
    if(/A Level|AS Level/i.test(l) || y >= 12) return 'AS & A Level'; if(/IGCSE/i.test(l) || y === 10 || y === 11) return 'IGCSE';
    if(y >= 7 && y <= 9) return 'Lower Secondary (Years 7–9)'; if(y >= 1 && y <= 6) return 'Primary (Years 1–6)'; return 'Other'; };
  const modeOf = w => !w ? 'Not set' : /online/i.test(w) ? 'Online' : /home/i.test(w) ? 'At home' : 'At LHQ';
  const minsOf = v => { const s = String(v || ''); const n = parseFloat(s) || 1; return /min/i.test(s) ? n : n * 60; };
  const UP = s => String(s || '').trim().toUpperCase();

  /* ---------- the facts, worked out once per change of data ---------- */
  let memo = {};
  function facts(){
    const lraw = localStorage.getItem('lhq_logs') || '', key = saved.length + ':' + (saved[0] && saved[0].savedAt) + ':' + lraw.length;
    if(memo.key === key && memo.saved === saved) return memo.f;
    const S = HD.students(), byStu = new Map(S.map(s => [s.key, s]));
    const invs = saved.filter(d => d.type === 'invoice'), rcts = saved.filter(d => d.type === 'receipt'), cards = saved.filter(d => d.type === 'card');
    const invByNo = new Map(invs.map(i => [UP(i.number), i])), rctByNo = new Map(rcts.map(r => [UP(r.number), r]));
    const cardByInv = new Map();
    cards.forEach(c => { let inv = invByNo.get(UP(c.ref)); if(!inv){ const r = rctByNo.get(UP(c.ref)); if(r) inv = invByNo.get(UP(r.ref)); } if(inv && !cardByInv.has(inv.id)) cardByInv.set(inv.id, c); });
    const firstInv = new Map();
    invs.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(i => { const k = sk(i.student || i.name); if(!firstInv.has(k)) firstInv.set(k, i.id); });
    const stuInfo = k => { const s = byStu.get(k) || {}; return {school: s.school || 'Not recorded', area: s.area || 'Not recorded', district: s.district || 'Not recorded', source: s.heard || 'Not recorded'}; };
    /* payments split across subjects */
    const rows = [];
    rcts.forEach(r => {
      const amt = num(r.received); if(!amt) return;
      const inv = invByNo.get(UP(r.ref)), k = sk((inv || r).student || (inv || r).name), info = stuInfo(k);
      if(!inv){ rows.push(Object.assign({date: r.date, amt, sub: 'No invoice', level: r.level || 'Not set', prog: progOf(r.level), tutor: 'Not known', mode: 'Not set', newRet: 'Returning', stu: k}, info)); return; }
      const card = cardByInv.get(inv.id), items = (inv.items || []).map(it => ({it, v: num(it.sessions) * num(it.cost)})).filter(x => x.v > 0), tot = sum(items, x => x.v);
      const newRet = firstInv.get(k) === inv.id ? 'New' : 'Returning';
      (items.length ? items : [{it: {desc: 'Tuition'}, v: 1}]).forEach(({it, v}) => {
        const subj = (card && (card.subjects || []).find(x => sk(x.name) === sk(it.desc))) || null;
        rows.push(Object.assign({date: r.date, amt: amt * (tot ? v / tot : 1), sub: it.desc || 'Tuition', level: inv.level || 'Not set', prog: progOf(inv.level),
          tutor: subj && subj.tutor ? subj.tutor : card ? 'No tutor yet' : 'No card yet', mode: modeOf(card && card.where), newRet, stu: k}, info));
      });
    });
    /* sessions from tutors' logs */
    const L = (store.get('lhq_logs', {e:{}}) || {}).e || {}, E = Object.values(L).filter(e => e && !e.x && e.ty === 's');
    const subInfo = new Map();
    cards.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(c => (c.subjects || []).forEach(x => subInfo.set(sk(c.student) + '|' + sk(x.name), {mins: minsOf(x.mins || '1 hour'), where: c.where, tutor: x.tutor || ''})));
    const sess = E.map(e => { const i = subInfo.get(e.k) || {mins: 60, where: '', tutor: e.tutor || ''};
      return {d: e.d, k: e.k, stu: e.k.split('|')[0], sub: e.sub || e.k.split('|')[1], tutor: e.tutor || i.tutor || 'Not known', a: e.a, mk: +e.mk || 0,
        mode: e.md === 'o' ? 'Online' : e.md === 'h' ? 'At home' : e.md === 'c' ? 'At LHQ' : modeOf(i.where), hrs: i.mins / 60}; });
    memo = {key, saved, f: {S, byStu, invs, rcts, cards, invByNo, cardByInv, firstInv, rows, sess}};
    return memo.f;
  }

  /* ---------- small drawing helpers ---------- */
  const kpi = (l, v, s, href) => `<${href ? `a href="${href}"` : 'div'} class="kpi"><small>${l}</small><b>${v}</b>${s ? `<span>${s}</span>` : ''}</${href ? 'a' : 'div'}>`;
  function shareRows(list, total, o = {}){
    const max = Math.max(1, ...list.map(x => x.v));
    return list.map(x => `<${x.href ? `a href="${x.href}"` : 'div'} class="ins-row"><div class="h"><b>${esc(x.k)}</b>${x.tag || ''}<span class="amt">${o.fmt ? o.fmt(x.v) : mkShort(x.v)}</span></div>
      <div class="ins-bar"><i style="width:${x.v / max * 100}%;background:${x.col || 'var(--inc)'}"></i></div>
      <div class="m">${[total ? pc(x.v, total) + '% of the total' : '', x.extra || ''].filter(Boolean).join(' · ')}</div></${x.href ? 'a' : 'div'}>`).join('') || '<p class="empty">Nothing in this period.</p>';
  }
  /* a line or bar chart: series [{name, col, vals[]}], labels[] */
  function lineChart(labels, series, o = {}){
    const W = 720, H = o.h || 230, pl = 52, pr = 10, pt = 14, pb = 28, n = labels.length;
    const all = series.flatMap(s => s.vals), max = Math.max(1, ...all), min = Math.min(0, ...all);
    const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); return Math.ceil(v / p) * p; }, top = nice(max), bot = min < 0 ? -nice(-min) : 0;
    const x = i => pl + (n <= 1 ? (W - pl - pr) / 2 : (W - pl - pr) * i / (n - 1)), y = v => pt + (H - pt - pb) * (1 - (v - bot) / (top - bot || 1));
    const fmt = o.fmt || (v => Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(Math.abs(v) >= 1e7 ? 0 : 1) + 'M' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + 'k' : Math.round(v));
    let g = '';
    for(let k = 0; k <= 4; k++){ const v = bot + (top - bot) * k / 4; g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line2)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" style="fill:var(--muted)">${fmt(v)}</text>`; }
    if(o.bars){
      const bw = Math.max(4, (W - pl - pr) / n * .6 / series.length);
      series.forEach((s, si) => s.vals.forEach((v, i) => { const cx = pl + (W - pl - pr) * (i + .5) / n - bw * series.length / 2 + si * bw;
        g += `<rect x="${cx}" y="${Math.min(y(v), y(0))}" width="${bw - 1}" height="${Math.abs(y(v) - y(0))}" rx="2" style="fill:${s.col}"><title>${esc(labels[i])}: ${esc(s.name)} ${mk(v)}</title></rect>`; }));
      labels.forEach((l, i) => { if(n <= 13 || i % Math.ceil(n / 12) === 0) g += `<text x="${pl + (W - pl - pr) * (i + .5) / n}" y="${H - 9}" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">${esc(l)}</text>`; });
      if(o.line != null) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(o.line)}" y2="${y(o.line)}" style="stroke:var(--rd)" stroke-dasharray="5 4"/><text x="${W - pr}" y="${y(o.line) - 4}" text-anchor="end" font-size="10.5" style="fill:var(--rd)">budget</text>`;
    } else {
      series.forEach(s => { g += `<polyline fill="none" style="stroke:${s.col}" stroke-width="2.4" stroke-linejoin="round" points="${s.vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>` + s.vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3" style="fill:${s.col}"><title>${esc(labels[i])}: ${esc(s.name)} ${o.fmtTip ? o.fmtTip(v) : mk(v)}</title></circle>`).join(''); });
      labels.forEach((l, i) => { if(n <= 13 || i % Math.ceil(n / 12) === 0) g += `<text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="10.5" style="fill:var(--muted)">${esc(l)}</text>`; });
    }
    const legend = series.length > 1 ? `<div class="ins-leg">${series.map(s => `<span><i style="background:${s.col}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `${legend}<div class="bz-scroll"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:520px" role="img" aria-label="${esc(o.label || 'Chart')}">${g}</svg></div>`;
  }
  /* the months of an earlier period to compare with: while a quarter or year is still running, only the same stretch of it */
  const pm = (period, k) => { const b = B(), ms = b.months(period), all = b.months(period, true), P = b.months(b.shift(period, k), true);
    return all.includes(b.thisMonth()) && !b.isM(period) ? P.slice(0, ms.length) : P; };
  const prevWord = period => (B().isY(period) ? 'last year' : 'previous') + (B().months(period, true).includes(B().thisMonth()) && !B().isM(period) ? ' (same months)' : '');
  const lastMonths = (end, n) => Array.from({length: n}, (_, i) => B().addMonth(end, i - n + 1));
  const endOf = period => B().months(period, true).filter(m => m <= B().thisMonth()).pop() || B().months(period, true)[0];

  /* ---------- Overview ---------- */
  function overview(period){
    const b = B(), F = facts(), ms = b.months(period), f = b.figures(ms), live = b.months(period, true).includes(b.thisMonth());
    /* a period still running is compared with the same stretch of the earlier one (first 4 months against first 4 months) */
    const same = P => { const all = b.months(P, true); return live && !b.isM(period) ? all.slice(0, ms.length) : all; };
    const prev = b.figures(same(b.shift(period, -1))), ly = b.isY(period) ? null : b.figures(same(b.lastYear(period)));
    const word = live && !b.isM(period) ? ' (same months)' : '';
    const cmp = (now, p, l, good = 1) => `${arrow(chg(now, p), good)} vs ${b.isY(period) ? 'last year' : 'previous'}${word}${l ? ` · ${arrow(chg(now, l), good)} vs last year` : ''}`;
    const rows = F.rows.filter(r => ms.includes(ym(r.date)));
    const top = sortObj(groupSum(rows, r => r.prog, r => r.amt))[0];
    const prevRows = F.rows.filter(r => pm(period, -1).includes(ym(r.date)));
    const subNow = groupSum(rows, r => r.sub, r => r.amt), subPrev = groupSum(prevRows, r => r.sub, r => r.amt);
    const prevTot = sum(Object.values(subPrev)), growing = sortObj(Object.fromEntries(Object.keys(subNow).filter(k => subPrev[k] > 0 && subPrev[k] >= prevTot * .03 && !/^(No invoice|Tuition)$/.test(k)).map(k => [k, chg(subNow[k], subPrev[k])])))[0];
    const P = pipeFigures(ms), Sx = sessFigures(ms), R = habits(ms);
    const catUp = sortObj(Object.fromEntries(Object.keys(f.byCat).map(c => [c, f.byCat[c] - (prev.byCat[c] || 0)])))[0];
    return `<div class="kpis">
      ${kpi('Money in' + (live ? ' so far' : ''), mkShort(f.revenue), cmp(f.revenue, prev.revenue, ly && ly.revenue), '#biz/money/' + period)}
      ${kpi('Spending' + (live ? ' so far' : ''), mkShort(f.exp), cmp(f.exp, prev.exp, ly && ly.exp, -1), '#biz/spending/' + period)}
      ${kpi('Profit' + (live ? ' so far' : ''), (f.profit < 0 ? '−' : '') + mkShort(Math.abs(f.profit)), `${f.revenue ? pc(f.profit, f.revenue) + '% margin · ' : ''}${arrow(chg(f.profit, prev.profit))}`, '#biz/pl/' + period)}
      ${kpi('New students', String(R.newStu), `${R.active} in a tuition period now`, '#students/new')}</div>
    <div class="card pad"><div class="cap">Money in and spending, last 12 months</div>${lineChart(lastMonths(endOf(period), 12).map(m => b.monShort(m)), [
      {name:'Money in', col:'var(--inc)', vals: lastMonths(endOf(period), 12).map(m => b.figures([m]).revenue)},
      {name:'Spending', col:'var(--exp)', vals: lastMonths(endOf(period), 12).map(m => b.figures([m]).exp)},
      {name:'Profit', col:'#2c7a4b', vals: lastMonths(endOf(period), 12).map(m => b.figures([m]).profit)}], {label:'Money in, spending and profit'})}</div>
    <div class="ins-grid">
      <a class="card pad ins-tile" href="#biz/money/${period}"><div class="cap">Biggest programme</div><b>${top ? esc(top[0]) : '–'}</b><span>${top ? `${mkShort(top[1])} · ${pc(top[1], f.inc)}% of tuition` : 'No payments yet'}</span></a>
      <a class="card pad ins-tile" href="#biz/money/${period}"><div class="cap">Fastest growing subject</div><b>${growing ? esc(growing[0]) : '–'}</b><span>${growing ? `▲ ${growing[1]}% vs ${prevWord(period)}` : 'Not enough to compare'}</span></a>
      <a class="card pad ins-tile" href="#biz/pipeline/${period}"><div class="cap">Quotes that became invoices</div><b>${P.quoted.n ? pc(P.conv.n, P.quoted.n) + '%' : '–'}</b><span>${P.conv.n} of ${P.quoted.n} · ${P.waiting.length} waiting now</span></a>
      <a class="card pad ins-tile" href="#biz/sessions/${period}"><div class="cap">Sessions taught</div><b>${Sx.taught}</b><span>${Math.round(Sx.hours)} hours · ${Sx.owed} make-up${Sx.owed === 1 ? '' : 's'} owed now</span></a>
      <a class="card pad ins-tile" href="#biz/marketing/${period}"><div class="cap">Best marketing channel</div><b>${R.bestChan ? esc(R.bestChan.k) : '–'}</b><span>${R.bestChan ? `${R.bestChan.ret.toFixed(1)}× its cost returned` : 'Record marketing channels to see this'}</span></a>
      <a class="card pad ins-tile" href="#biz/cat/${period}/${encodeURIComponent(catUp ? catUp[0] : '')}"><div class="cap">Biggest spending rise</div><b>${catUp && catUp[1] > 0 ? esc(catUp[0]) : '–'}</b><span>${catUp && catUp[1] > 0 ? `+${mkShort(catUp[1])} vs ${prevWord(period)}` : 'Nothing went up'}</span></a>
    </div>
    <div class="h2">Students and payments</div>
    <div class="card pad"><div class="ins-facts">
      <div><b>${R.renewal != null ? R.renewal + '%' : '–'}</b><small>of periods that ended were renewed</small></div>
      <div><b>${R.stay ? R.stay.toFixed(1) : '–'}</b><small>months a student stays, on average</small></div>
      <div><b>${R.perStu ? mkShort(R.perStu) : '–'}</b><small>money in per student a month</small></div>
      <div><b>${R.daysToPay != null ? R.daysToPay : '–'}</b><small>days from invoice to payment, on average</small></div>
      <div><b>${R.onTime != null ? R.onTime + '%' : '–'}</b><small>of invoices paid on time</small></div>
      <div><b>${mkShort(R.discounts)}</b><small>given in discounts</small></div>
    </div>
    ${R.renewByProg.length ? `<div class="cap" style="margin-top:14px">Renewals by programme</div>${shareRows(R.renewByProg.map(x => ({k: x.k, v: x.p, extra: `${x.r} of ${x.n} renewed`, col: x.p >= 75 ? 'var(--ok)' : x.p >= 50 ? 'var(--gold)' : 'var(--rd)'})), 0, {fmt: v => v + '%'})}` : ''}
    ${R.late.length ? `<div class="cap" style="margin-top:14px">Families often paying late</div>${R.late.map(x => `<a class="it" href="#student/${encodeURIComponent(x.k)}"><span class="t"><b>${esc(x.name)}</b><small>${x.n} of ${x.of} invoices paid after the due date</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('')}` : ''}
    <div class="cap" style="margin-top:14px">Busiest times (current tuition cards)</div>${busy()}
    </div>`;
  }
  /* renewals, stay, payment habits, discounts */
  function habits(ms){
    const F = facts(), b = B(), t = today(), from = ms[0] + '-01', to = ms[ms.length - 1] + '-31';
    const newStu = F.S.filter(s => { const i = F.invs.find(x => x.id === F.firstInv.get(s.key)); return i && ms.includes(ym(i.date)); }).length;
    const active = F.S.filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= t)).length;
    // renewal: periods that ended in this window, and whether a later invoice followed
    const ended = []; F.S.forEach(s => s.periods.forEach((p, i) => { const e = p.inv.periodEnd; if(e && e >= from && e <= to && e < t) ended.push({s, p, renewed: i > 0, prog: progOf(p.inv.level)}); }));
    const byProg = {}; ended.forEach(x => { const o = byProg[x.prog] = byProg[x.prog] || {n: 0, r: 0}; o.n++; if(x.renewed) o.r++; });
    const stays = F.S.filter(s => s.periods.length).map(s => { const P = s.periods.map(p => p.inv), a = P.map(i => i.periodStart || i.date).filter(Boolean).sort()[0], z = P.map(i => i.periodEnd || i.date).filter(Boolean).sort().pop(); return a && z ? Math.max(1, HD.dayDiff(a, z) / 30.4) : 1; });
    const paidInvs = F.invs.filter(i => ms.includes(ym(i.date))).map(i => ({i, st: HD.invState(i), r: F.rcts.filter(r => UP(r.ref) === UP(i.number)).sort((a, b) => (a.date || '').localeCompare(b.date || ''))})).filter(x => x.st.paidUp && x.r.length);
    const days = paidInvs.map(x => Math.max(0, HD.dayDiff(x.i.date, x.r[x.r.length - 1].date)));
    const onTime = paidInvs.filter(x => !x.i.dueDate || x.r[x.r.length - 1].date <= HD.addDays(x.i.dueDate, num(HD.settings.graceDays))).length;
    const lateBy = {}; F.invs.forEach(i => { const r = F.rcts.filter(x => UP(x.ref) === UP(i.number)).sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop(); if(!r || !i.dueDate) return;
      const k = sk(i.student || i.name), o = lateBy[k] = lateBy[k] || {k, name: i.student || i.name, n: 0, of: 0}; o.of++; if(r.date > HD.addDays(i.dueDate, num(HD.settings.graceDays))) o.n++; });
    const discounts = sum(F.invs.filter(i => ms.includes(ym(i.date))), i => { const st = sum(i.items || [], it => num(it.sessions) * num(it.cost)); return st - HD.total(i); });
    const revMonth = b.figures(ms).inc / Math.max(1, ms.length), perStu = active ? revMonth / active : 0;
    const ch = mkt(ms), best = ch.paid.filter(x => x.spend > 0 && x.n > 0 && x.k !== 'No channel recorded').sort((a, c) => c.ret - a.ret)[0];
    return {newStu, active, renewal: ended.length ? pc(ended.filter(x => x.renewed).length, ended.length) : null,
      renewByProg: Object.entries(byProg).map(([k, o]) => ({k, n: o.n, r: o.r, p: pc(o.r, o.n)})).sort((a, c) => c.n - a.n),
      stay: stays.length ? sum(stays) / stays.length : 0, perStu, daysToPay: days.length ? Math.round(sum(days) / days.length) : null,
      onTime: paidInvs.length ? pc(onTime, paidInvs.length) : null, late: Object.values(lateBy).filter(x => x.n >= 2).sort((a, c) => c.n - a.n).slice(0, 5), discounts, bestChan: best};
  }
  function busy(){
    const F = facts(), t = today(), DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'], NAME = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'}, grid = {};
    F.S.forEach(s => { const c = s.cur && s.cur.card; if(!c || (s.cur.inv.periodEnd && s.cur.inv.periodEnd < t)) return;
      (c.subjects || []).forEach(x => (x.days || []).forEach(d => { const h = String(x.start || '').slice(0, 2) || '??'; grid[d + h] = (grid[d + h] || 0) + 1; })); });
    const hours = [...new Set(Object.keys(grid).map(k => k.slice(2)))].filter(h => h !== '??').sort();
    if(!hours.length) return '<p class="empty" style="margin:0">Add start times on tuition cards to see this.</p>';
    const max = Math.max(...Object.values(grid));
    return `<div class="bz-scroll"><table class="ins-heat"><tr><th></th>${DAYS.map(d => `<th>${NAME[d]}</th>`).join('')}</tr>${hours.map(h => `<tr><th>${h}:00</th>${DAYS.map(d => { const v = grid[d + h] || 0; return `<td style="background:${v ? `rgba(244,178,35,${.15 + .85 * v / max})` : 'transparent'}" title="${v} session${v === 1 ? '' : 's'}">${v || ''}</td>`; }).join('')}</tr>`).join('')}</table></div><p class="note">Sessions a week starting at each hour, from current tuition cards.</p>`;
  }

  /* ---------- Money in, explained ---------- */
  let dim = 'prog', insAll = false;
  function money(period){
    const b = B(), F = facts(), ms = b.months(period), pms = pm(period, -1), pw = prevWord(period);
    const avgPs = [-1, -2, -3].map(k => pm(period, k));
    const rows = F.rows.filter(r => ms.includes(ym(r.date))), total = sum(rows, r => r.amt);
    const now = groupSum(rows, r => r[dim], r => r.amt), prev = groupSum(F.rows.filter(r => pms.includes(ym(r.date))), r => r[dim], r => r.amt);
    const avg3 = {}; avgPs.forEach(P => Object.entries(groupSum(F.rows.filter(r => P.includes(ym(r.date))), r => r[dim], r => r.amt)).forEach(([k, v]) => avg3[k] = (avg3[k] || 0) + v / 3));
    const stu = {}; rows.forEach(r => { (stu[r[dim]] = stu[r[dim]] || new Set()).add(r.stu); });
    const keys = [...new Set([...Object.keys(now), ...Object.keys(prev)])].sort((a, c) => (now[c] || 0) - (now[a] || 0));
    const list = keys.map(k => { const p = chg(now[k] || 0, prev[k] || 0), a = chg(now[k] || 0, avg3[k] || 0);
      const tag = p != null && p >= 10 && (a == null || a >= 0) ? '<span class="tag ok">growing</span>' : p != null && p <= -10 && (a == null || a < 0) ? '<span class="tag rd">declining</span>' : '';
      return {k, v: now[k] || 0, tag, extra: `${stu[k] ? stu[k].size + ' student' + (stu[k].size === 1 ? '' : 's') : 'no payments'} · ${arrow(p)} vs ${pw} · ${arrow(a)} vs 3-period average`}; });
    const f = b.figures(ms), D = b.due('lhq_income'), loans = b.loans().filter(x => x.borrowed);
    const other = f.income.slice().sort((a, c) => (c.date || '').localeCompare(a.date || ''));
    const grow = list.filter(x => x.tag.includes('growing')).length, dec = list.filter(x => x.tag.includes('declining'));
    return `<div class="kpis">
      ${kpi('Tuition received', mkShort(total), `${arrow(chg(total, sum(F.rows.filter(r => pms.includes(ym(r.date))), r => r.amt)))} vs ${pw}`, `#docs/receipt/${b.isY(period) ? 'fy-' + period.slice(2) : b.isQ(period) ? 'q-' + period.slice(1) : 'm-' + period}`)}
      ${kpi('Other money in', mkShort(f.other), f.capital ? `+ ${mkShort(f.capital)} loans or investment` : 'rent, grants, refunds received')}
      ${kpi('Biggest ' + DIM[dim].toLowerCase(), list[0] ? esc(list[0].k) : '–', list[0] ? `${pc(list[0].v, total)}% of tuition` : '')}
      ${kpi('Declining', String(dec.length), dec.length ? esc(dec.slice(0, 2).map(x => x.k).join(', ')) : `${grow} growing`)}</div>
    <div class="chips" style="margin-bottom:10px">${DIMS.map(([k, l]) => `<button class="chip ${dim === k ? 'on' : ''}" data-insdim="${k}">${l}</button>`).join('')}</div>
    <div class="card pad"><div class="cap bz-cap">Tuition by ${DIM[dim].toLowerCase()} · ${b.periodLabel(period)} <b>${mk(total)}</b></div>${shareRows(list, total)}
      <p class="note">A payment is split across the subjects on its invoice in proportion to their amounts. "Not recorded" means the student's details don't have it yet.</p></div>
    <div class="card pad"><div class="cap">Last 12 months by ${DIM[dim].toLowerCase()}</div>${trendChart(dim, endOf(period))}</div>
    <div class="h2">Other money in <em>${mk(f.other + f.capital)}</em></div>
    ${D.length ? `<div class="card pad" style="border-color:var(--gold)"><div class="cap">Repeating money in to confirm</div>${D.map(d => `<div class="it"><span class="t"><b>${esc(d.last.cat)}${d.last.from ? ' · ' + esc(d.last.from) : ''}</b><small>${nice(d.date)} · last time ${mk(num(d.last.amount))}</small></span><button class="btn sm n" data-inok="${d.sid}|${d.date}">Received ${mkShort(num(d.last.amount))}</button></div>`).join('')}</div>` : ''}
    <div class="card">${other.map(e => `<${b.mayEdit(e) ? `button class="it" data-inedit="${e.id}"` : 'div class="it"'}><span class="t"><b>${esc(e.cat)}${e.from ? ' · ' + esc(e.from) : ''}</b><small>${[nice(e.date), e.what, e.method, e.by ? 'by ' + first(e.by) : ''].filter(Boolean).map(esc).join(' · ')}</small></span>${b.NOT_INCOME.includes(e.cat) ? '<span class="tag gr">not income</span>' : ''}${e.rep === 'm' ? '<span class="tag bl">Monthly</span>' : ''}<b class="bz-amt">${mk(num(e.amount))}</b></${b.mayEdit(e) ? 'button' : 'div'}>`).join('') || `<p class="empty">Nothing recorded for ${b.periodLabel(period)}. Use "+ Money in" for rent from a tenant, a loan, a grant …</p>`}</div>
    ${loans.length ? `<div class="h2">Loans</div><div class="card pad">${loans.map(x => `<div class="bz-bud" style="border-top:0"><div class="h"><b>${esc(x.lender)}</b><span>${mkShort(x.repaid)} repaid of ${mkShort(x.borrowed)} · <b>${mkShort(x.left)} left</b></span></div><div class="track"><i style="width:${pc(x.repaid, x.borrowed)}%;background:var(--ok)"></i></div></div>`).join('')}<p class="note">Repayments are spending in the "Loan repayment" category, paid to the lender's name. Loans never count as revenue or profit.</p></div>` : ''}`;
  }
  function trendChart(d, end){
    const F = facts(), b = B(), M = lastMonths(end, 12), keys = sortObj(groupSum(F.rows.filter(r => M.includes(ym(r.date))), r => r[d], r => r.amt)).map(x => x[0]);
    const topK = keys.slice(0, 6), series = topK.map((k, i) => ({name: k, col: COLORS[i], vals: M.map(m => sum(F.rows.filter(r => ym(r.date) === m && r[d] === k), r => r.amt))}));
    if(keys.length > 6) series.push({name: 'Others', col: COLORS[6], vals: M.map(m => sum(F.rows.filter(r => ym(r.date) === m && !topK.includes(r[d])), r => r.amt))});
    return series.length ? lineChart(M.map(m => b.monShort(m)), series, {label: 'Tuition by ' + DIM[d]}) : '<p class="empty">No payments yet.</p>';
  }

  /* ---------- Pipeline ---------- */
  function pipeFigures(ms){
    const F = facts(), Q = saved.filter(d => (d.type || 'quote') === 'quote' && ms.includes(ym(d.date)));
    const inv = new Map(F.invs.filter(i => i.ref).map(i => [UP(i.ref), i]));
    const conv = Q.filter(q => inv.has(UP(q.number))), paid = conv.filter(q => HD.invState(inv.get(UP(q.number))).paidUp);
    const I = F.invs.filter(i => ms.includes(ym(i.date)));
    const waiting = F.S.filter(s => s.openQuote && !s.openQuote.lost).map(s => s.openQuote);
    return {quoted: {n: Q.length, v: sum(Q, HD.total)}, conv: {n: conv.length, v: sum(conv, q => HD.total(inv.get(UP(q.number))))}, paid: {n: paid.length},
      lost: Q.filter(q => q.lost), invoiced: {n: I.length, v: sum(I, HD.total)}, received: sum(F.rows.filter(r => ms.includes(ym(r.date))), r => r.amt), waiting};
  }
  const waLink = (phone, text) => phone ? `https://wa.me/${waNum(phone)}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  function pipeline(period){
    const b = B(), F = facts(), ms = b.months(period), P = pipeFigures(ms), t = today();
    const funnel = [['Quoted', P.quoted.v, `${P.quoted.n} quote${P.quoted.n === 1 ? '' : 's'}`, 'var(--bl)'], ['Invoiced', P.invoiced.v, `${P.invoiced.n} invoice${P.invoiced.n === 1 ? '' : 's'} (incl. renewals)`, 'var(--inc)'], ['Received', P.received, 'payments in this period', 'var(--ok)']];
    const fmax = Math.max(1, ...funnel.map(x => x[1]));
    const waiting = P.waiting.slice().sort((a, c) => (a.date || '').localeCompare(c.date || ''));
    const unpaid = F.invs.map(i => ({i, st: HD.invState(i)})).filter(x => x.st.balance > 0.005).sort((a, c) => (c.st.over ? 1 : 0) - (a.st.over ? 1 : 0));
    const ended = F.S.filter(s => s.status.k === 'ended' && !s.openQuote && s.cur && !(HD.studentRecords()[s.key] || {}).lost && HD.dayDiff(s.cur.inv.periodEnd, t) <= 90);
    const lostQ = saved.filter(d => (d.type || 'quote') === 'quote' && d.lost), lostS = Object.values(HD.studentRecords()).filter(r => r.lost);
    const reasons = groupSum([...lostQ.map(q => q.lost), ...lostS.map(r => r.lost)], l => l.reason || 'Other', () => 1);
    const M = lastMonths(endOf(period), 6), byM = M.map(m => pipeFigures([m]));
    const progs = {}; saved.filter(d => (d.type || 'quote') === 'quote' && M.includes(ym(d.date))).forEach(q => { const p = progOf(q.level), o = progs[p] = progs[p] || {n: 0, c: 0}; o.n++; if(F.invs.some(i => UP(i.ref) === UP(q.number))) o.c++; });
    const s = k => F.byStu.get(k) || {};
    const row = (title, sub, actions, href) => `<div class="it"><span class="t">${href ? `<a href="${href}" style="text-decoration:none;color:inherit">` : ''}<b>${esc(title)}</b><small>${esc(sub)}</small>${href ? '</a>' : ''}</span><div class="acts">${actions}</div></div>`;
    return `<div class="kpis">
      ${kpi('Quoted', mkShort(P.quoted.v), `${P.quoted.n} quotes`, '#docs/quote')}
      ${kpi('Became invoices', P.quoted.n ? pc(P.conv.n, P.quoted.n) + '%' : '–', `${P.conv.n} of ${P.quoted.n} · ${mkShort(P.conv.v)}`)}
      ${kpi('Waiting now', String(waiting.length), mkShort(sum(waiting, HD.total)) + ' quoted', '#docs/quote/waiting')}
      ${kpi('Lost', String(P.lost.length), P.lost.length ? 'in this period' : 'none marked lost')}</div>
    <div class="card pad"><div class="cap">Quoted, invoiced, received · ${b.periodLabel(period)}</div>
      ${funnel.map(([l, v, sub, col]) => `<div class="ins-row"><div class="h"><b>${l}</b><span class="amt">${mk(v)}</span></div><div class="ins-bar"><i style="width:${v / fmax * 100}%;background:${col}"></i></div><div class="m">${sub}</div></div>`).join('')}
      <p class="note">Of the ${P.quoted.n} quotes made in this period, ${P.conv.n} became invoices and ${P.paid.n} are paid in full.</p></div>
    <div class="h2">Follow up</div>
    <div class="card pad"><div class="cap">Quotes waiting · oldest first</div>
      ${waiting.map(q => { const st = s(sk(q.student || q.name)), days = q.date ? HD.dayDiff(q.date, t) : 0;
        return row(`${q.student || q.name} · ${q.number}`, `${mk(HD.total(q))} · sent ${days} day${days === 1 ? '' : 's'} ago${st.parent ? ' · ' + st.parent : ''}`,
          `<a class="btn sm g" target="_blank" rel="noopener" href="${waLink(st.phone || q.phone, `Hello ${q.name || ''}, this is LHQ Learning Solutions following up on quote ${q.number} for ${q.student || 'your child'}. Would you like us to go ahead? We're happy to answer any questions.`)}">${ic('wa',14)} Nudge</a>${can('quotes') ? `<a class="btn sm" href="doc.html#conv=invoice:${q.id}">Invoice</a><button class="btn sm" data-lost="q:${q.id}">Lost</button>` : ''}`, 'doc.html#d=' + q.id); }).join('') || '<p class="empty" style="margin:0">No quotes waiting.</p>'}</div>
    <div class="card pad"><div class="cap">Invoiced, not fully paid</div>
      ${unpaid.slice(0, 30).map(({i, st}) => { const so = s(sk(i.student || i.name));
        return row(`${i.student || i.name} · ${i.number}`, `${st.text} · ${mk(st.balance)} owed`, `<a class="btn sm g" target="_blank" rel="noopener" href="${waLink(so.phone || i.phone, `Hello ${i.name || ''}, a gentle reminder from LHQ Learning Solutions that ${mk(st.balance)} is due on invoice ${i.number} for ${i.student || 'your child'}. Thank you.`)}">${ic('wa',14)} Remind</a>${can('receipts') ? `<a class="btn sm" href="doc.html#conv=receipt:${i.id}">Payment</a>` : ''}`, 'doc.html#d=' + i.id); }).join('') || '<p class="empty" style="margin:0">Everything invoiced is paid.</p>'}</div>
    <div class="card pad"><div class="cap">Period ended, not renewed · last 90 days</div>
      ${ended.map(st => row(st.name, `ended ${nice(st.cur.inv.periodEnd)} · ${st.parent || ''}`, `<a class="btn sm g" target="_blank" rel="noopener" href="${waLink(st.phone, `Hello ${st.parent || ''}, ${st.name}'s tuition period at LHQ ended on ${nice(st.cur.inv.periodEnd)}. Would you like to continue for the next period? We'd love to keep going.`)}">${ic('wa',14)} Ask</a>${can('quotes') ? `<a class="btn sm" href="doc.html#renew=${st.cur.inv.id}">Renew</a>` : ''}${can('students') ? `<button class="btn sm" data-lost="s:${encodeURIComponent(st.key)}">Lost</button>` : ''}`, '#student/' + encodeURIComponent(st.key))).join('') || '<p class="empty" style="margin:0">Everyone whose period ended has renewed or been followed up.</p>'}</div>
    <div class="h2">Why people don't continue</div>
    <div class="card pad">${Object.keys(reasons).length ? shareRows(sortObj(reasons).map(([k, v]) => ({k, v, col: 'var(--rd)'})), sum(Object.values(reasons)), {fmt: v => v + (v === 1 ? ' family' : ' families')}) : '<p class="empty" style="margin:0">Mark quotes or students as lost, with a reason, and the reasons add up here.</p>'}</div>
    <div class="h2">Conversion over time</div>
    <div class="card pad">${lineChart(M.map(m => b.monShort(m)), [{name: '% of quotes invoiced', col: 'var(--inc)', vals: byM.map(x => x.quoted.n ? pc(x.conv.n, x.quoted.n) : 0)}], {fmt: v => Math.round(v) + '%', fmtTip: v => v + '%', h: 180, label: 'Conversion by month'})}
      ${Object.keys(progs).length ? `<div class="cap" style="margin-top:12px">By programme · last 6 months</div>${shareRows(Object.entries(progs).map(([k, o]) => ({k, v: pc(o.c, o.n), extra: `${o.c} of ${o.n} quotes`})), 0, {fmt: v => v + '%'})}` : ''}</div>`;
  }
  function lostSheet(what){
    const [kind, id] = [what.slice(0, 1), decodeURIComponent(what.slice(2))];
    openSheet(`<div class="hx"><h3>Mark as lost</h3><button class="ib" data-close>✕</button></div><p class="sp">Why didn't this family go ahead? It helps LHQ see what to change.</p>
      <div class="chips" id="lostR">${LOST_REASONS.map((r, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <label class="f"><span>Note (optional)</span><input class="in" id="lostN" autocomplete="off" placeholder="e.g. Will come back in January"></label>
      <button class="btn n full" id="lostGo">Save</button>`);
    document.querySelectorAll('#lostR .chip').forEach(b => b.onclick = () => document.querySelectorAll('#lostR .chip').forEach(x => x.classList.toggle('on', x === b)));
    $('lostGo').onclick = () => {
      const lost = {reason: document.querySelector('#lostR .on').dataset.r, note: $('lostN').value.trim(), at: Date.now(), by: me().name};
      if(kind === 'q'){ const all = store.get('lhq_saved', []), q = all.find(d => d.id === id); if(q){ q.lost = lost; q.savedAt = Date.now(); store.set('lhq_saved', all); } }
      else { const recs = HD.studentRecords(); recs[id] = Object.assign(recs[id] || {name: id}, {lost}); store.set('lhq_students', recs); }
      closeSheet(); toast('Marked as lost'); render();
    };
  }

  /* ---------- Sessions ---------- */
  function sessFigures(ms){
    const F = facts(), X = F.sess.filter(e => ms.includes(ym(e.d)));
    const taught = X.filter(e => e.a === 'attended' || e.a === 'late');
    const t = today(), owedCards = F.S.map(s => s.cur && s.cur.card).filter(c => c && !c.mu);
    const owed = sum(owedCards, c => sum(HD.makeups(c), x => x.owed));
    return {X, taught: taught.length, hours: sum(taught, e => e.hrs), made: taught.filter(e => e.mk).length, missS: X.filter(e => e.a === 'absent').length, missT: X.filter(e => e.a === 'cancelled').length, owed, owedCards};
  }
  function sessions(period){
    const b = B(), F = facts(), ms = b.months(period), S = sessFigures(ms), f = b.figures(ms);
    const taught = S.X.filter(e => e.a === 'attended' || e.a === 'late'), weeks = Math.max(1, ms.length * 4.33);
    const byMode = groupSum(taught, e => e.mode, () => 1), hrsMode = groupSum(taught, e => e.mode, e => e.hrs);
    const rate = num(HD.settings.rate) || 15000;
    const tut = {}; S.X.forEach(e => { const o = tut[e.tutor] = tut[e.tutor] || {k: e.tutor, n: 0, h: 0, miss: 0}; if(e.a === 'attended' || e.a === 'late'){ o.n++; o.h += e.hrs; } if(e.a === 'cancelled') o.miss++; });
    const t = today(), modeStu = groupSum(F.S.filter(s => s.cur && s.cur.card && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= t)), s => modeOf(s.cur.card.where), () => 1);
    const modeMoney = groupSum(F.rows.filter(r => ms.includes(ym(r.date))), r => r.mode, r => r.amt);
    const owedList = S.owedCards.map(c => ({c, m: HD.makeups(c).filter(x => x.owed)})).filter(x => x.m.length);
    return `<div class="kpis">
      ${kpi('Sessions taught', String(S.taught), `${Math.round(S.hours)} hours · ${S.made} make-up${S.made === 1 ? '' : 's'}`)}
      ${kpi('Missed', String(S.missS + S.missT), `${S.missS} student absent · ${S.missT} tutor couldn't teach`)}
      ${kpi('Make-ups owed now', String(S.owed), `worth about ${mkShort(S.owed * rate)}`)}
      ${kpi('Money lost', mkShort(f.refunds), 'refunds in this period', f.refunds ? `#biz/cat/${period}/Refunds` : '')}</div>
    <div class="card pad"><div class="cap">Online and in person</div><div class="ins-facts">
      ${['At LHQ', 'Online', 'At home'].map(m => `<div><small style="font-weight:800;color:var(--ink)">${m}</small><b>${byMode[m] || 0} <small>sessions</small></b><small>${Math.round(hrsMode[m] || 0)} hours<br>${modeStu[m] || 0} student${modeStu[m] === 1 ? '' : 's'} now<br>${mkShort(modeMoney[m] || 0)} paid</small></div>`).join('')}</div></div>
    <div class="card pad"><div class="cap">Tutors · ${b.periodLabel(period)}</div>
      ${shareRows(Object.values(tut).sort((a, c) => c.h - a.h).map(x => ({k: x.k, v: x.h, extra: `${x.n} sessions · about ${(x.h / weeks).toFixed(1)} h a week${x.miss ? ` · ${x.miss} not taught` : ''}`})), 0, {fmt: v => Math.round(v) + ' h'})}</div>
    ${owedList.length ? `<div class="card pad"><div class="cap">Make-ups owed now · most first</div>${owedList.sort((a, c) => sum(c.m, x => x.owed) - sum(a.m, x => x.owed)).slice(0, insAll ? 999 : 8).map(({c, m}) => `<a class="it" href="doc.html#d=${c.id}"><span class="t"><b>${esc(c.student)}</b><small>${m.map(x => `${esc(x.sub)}: ${x.owed}${x.tutor ? ' (' + esc(first(x.tutor)) + ')' : ''}`).join(' · ')}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('')}${owedList.length > 8 && !insAll ? `<button class="btn sm" data-insall style="margin-top:8px">Show all ${owedList.length}</button>` : ''}</div>` : ''}
    <div class="card pad"><div class="cap">Sessions by week, last 12 weeks</div>${weekChart()}</div>
    <p class="note">From tutors' session logs: ${S.X.length} entries in this period. Sessions that weren't logged aren't counted.</p>`;
  }
  function weekChart(){
    const F = facts(), t = today(), mon = HD.addDays(t, -((new Date().getDay() + 6) % 7)), W = Array.from({length: 12}, (_, i) => HD.addDays(mon, (i - 11) * 7));
    const vals = k => W.map(w => F.sess.filter(e => e.d >= w && e.d < HD.addDays(w, 7) && k(e)).length);
    return lineChart(W.map(w => nice(w)), [{name: 'Taught', col: 'var(--inc)', vals: vals(e => e.a === 'attended' || e.a === 'late')}, {name: 'Missed', col: 'var(--rd)', vals: vals(e => e.a === 'absent' || e.a === 'cancelled')}], {bars: true, fmt: v => Math.round(v), h: 190, label: 'Sessions by week'});
  }

  /* ---------- Spending: comparisons and forecast (top of the Spending tab) ---------- */
  function spendTop(period){
    const b = B(), ms = b.months(period), f = b.figures(ms), pp = b.shift(period, -1), p = b.figures(pm(period, -1)), F = facts(), part = b.months(period, true).includes(b.thisMonth()) && !b.isM(period) ? ' (same months)' : '';
    const cats = [...new Set([...Object.keys(f.byCat), ...Object.keys(p.byCat)])].map(c => ({c, now: f.byCat[c] || 0, before: p.byCat[c] || 0})).map(x => Object.assign(x, {d: x.now - x.before})).sort((a, c) => c.d - a.d);
    const live = ms.includes(b.thisMonth()) && b.isM(period);
    let fc = '';
    if(live){
      const [y, m] = period.split('-').map(Number), dim = new Date(y, m, 0).getDate(), left = (dim - new Date().getDate()) / dim;
      const dueAmt = sum(b.due(), d => num(d.last.amount));
      const prev3 = [1, 2, 3].map(k => b.figures([b.addMonth(period, -k)]).list.filter(e => !e.rep && !e.sid && !b.NOT_COST.includes(e.cat)).reduce((a, e) => a + num(e.amount), 0));
      const est = f.exp + dueAmt + sum(prev3) / 3 * left;
      fc = kpi('Month-end forecast', mkShort(est), `${mkShort(f.exp)} so far + ${mkShort(dueAmt)} repeating to confirm + usual pace`);
    }
    const active = F.S.filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= ms[ms.length - 1] + '-01')).length;
    const M = lastMonths(endOf(period), 12);
    return `<div class="kpis">
      ${kpi('Spending' + (live ? ' so far' : ''), mkShort(f.exp), `${arrow(chg(f.exp, p.exp), -1)} vs ${b.periodLabel(pp)}${part}`)}
      ${kpi('Spending ÷ money in', f.revenue ? pc(f.exp, f.revenue) + '%' : '–', 'of every kwacha that came in')}
      ${kpi('Cost per student', active ? mkShort(f.exp / active) : '–', `${active} students in a period`)}
      ${fc || kpi('Biggest category', cats.length ? esc(sortObj(f.byCat)[0] ? sortObj(f.byCat)[0][0] : '–') : '–', sortObj(f.byCat)[0] ? mkShort(sortObj(f.byCat)[0][1]) : '')}</div>
    <div class="card pad"><div class="cap">Compared with ${b.periodLabel(pp)}${part} · biggest rises first</div>
      ${cats.map(x => `<a class="ins-cmp" href="#biz/cat/${period}/${encodeURIComponent(x.c)}"><b>${esc(x.c)}</b><span>${mkShort(x.now)}</span><span class="fl">${mkShort(x.before)}</span><span class="${x.d > 0 ? 'dn' : x.d < 0 ? 'up' : 'fl'}">${x.d > 0 ? '▲ +' : x.d < 0 ? '▼ −' : ''}${x.d ? mkShort(Math.abs(x.d)) : 'same'}</span></a>`).join('') || '<p class="empty" style="margin:0">No spending yet.</p>'}
      <p class="note">Tap a category to see 12 months of it.</p></div>
    <div class="card pad"><div class="cap">Spending, last 12 months</div>${lineChart(M.map(m => b.monShort(m)), sortObj(groupSum(b.spendLive().filter(e => M.includes(ym(e.date)) && !b.NOT_COST.includes(e.cat)), e => e.cat, e => num(e.amount))).slice(0, 5).map(([c], i) => ({name: c, col: COLORS[i], vals: M.map(m => b.figures([m]).byCat[c] || 0)})), {bars: true, label: 'Top spending categories by month'})}</div>`;
  }
  /* a spending category's own page */
  function category(period, cat){
    const b = B(), M = lastMonths(endOf(period), 12), vals = M.map(m => b.figures([m]).byCat[cat] || 0), bud = num(b.budget()[cat]);
    const ms = b.months(period), now = b.figures(ms).byCat[cat] || 0, prev = b.figures(pm(period, -1)).byCat[cat] || 0;
    const L12 = b.spendLive().filter(e => e.cat === cat && M.includes(ym(e.date))), avg3 = sum(vals.slice(-4, -1)) / 3;
    const hi = Math.max(...vals), lo = Math.min(...vals.filter(v => v > 0).concat([0]));
    const payees = sortObj(groupSum(L12, e => (e.to || 'Not recorded').trim(), e => num(e.amount))).slice(0, 6);
    const rep = sum(L12.filter(e => e.rep || e.sid), e => num(e.amount)), list = b.spendLive().filter(e => e.cat === cat && ms.includes(ym(e.date))).sort((a, c) => (c.date || '').localeCompare(a.date || ''));
    return `<div class="ph" style="margin-top:-6px"><div class="tt"><h1 style="font-size:21px">${esc(cat)}</h1><p>${b.periodLabel(period)}</p></div></div>
    <div class="kpis">${kpi('This period', mkShort(now), `${arrow(chg(now, prev), -1)} vs ${prevWord(period)}`)}${kpi('3-month average', mkShort(avg3), `${arrow(chg(vals[vals.length - 1], avg3), -1)} this month vs average`)}${kpi('Highest month', mkShort(hi), b.monShort(M[vals.indexOf(hi)]) + ' · lowest ' + mkShort(lo))}${kpi('Repeating', pc(rep, sum(L12, e => num(e.amount))) + '%', `${mkShort(rep)} of ${mkShort(sum(L12, e => num(e.amount)))} in 12 months`)}</div>
    <div class="card pad"><div class="cap">Last 12 months${bud ? ' · budget ' + mkShort(bud) + ' a month' : ''}</div>${lineChart(M.map(m => b.monShort(m)), [{name: cat, col: 'var(--exp)', vals}], {bars: true, line: bud || null, label: cat + ' by month'})}</div>
    <div class="grid2"><div class="card pad"><div class="cap">Paid to · 12 months</div>${shareRows(payees.map(([k, v]) => ({k, v, col: 'var(--exp)'})), sum(L12, e => num(e.amount)))}</div>
    <div class="card"><div class="cap" style="padding-top:4px">Payments · ${b.periodLabel(period)}</div>${list.map(e => `<${b.mayEdit(e) ? `button class="it" data-bzedit="${e.id}"` : 'div class="it"'}><span class="t"><b>${esc(e.what || e.cat)}</b><small>${[nice(e.date), e.to, e.method].filter(Boolean).map(esc).join(' · ')}</small></span><b class="bz-amt">${mk(num(e.amount))}</b></${b.mayEdit(e) ? 'button' : 'div'}>`).join('') || '<p class="empty">None in this period.</p>'}</div></div>`;
  }

  /* ---------- Marketing return ---------- */
  function mkt(ms){
    const F = facts(), b = B(), newBy = {};
    F.S.forEach(s => { const i = F.invs.find(x => x.id === F.firstInv.get(s.key)); if(!i || !ms.includes(ym(i.date))) return; const k = s.heard || 'Not recorded'; (newBy[k] = newBy[k] || []).push(s); });
    const spend = groupSum(b.spendLive().filter(e => e.cat === 'Marketing' && ms.includes(ym(e.date))), e => e.chan || 'No channel recorded', e => num(e.amount));
    const paidBy = stus => sum(F.rows.filter(r => stus.some(s => s.key === r.stu)), r => r.amt);
    const renew = k => { const all = F.S.filter(s => (s.heard || 'Not recorded') === k && s.periods.some(p => p.inv.periodEnd && p.inv.periodEnd < today())); return all.length ? pc(all.filter(s => s.periods.length > 1).length, all.length) : null; };
    const keys = [...new Set([...Object.keys(newBy), ...Object.keys(spend)])];
    const rows = keys.map(k => { const st = newBy[k] || [], paid = paidBy(st), sp = spend[k] || 0; return {k, n: st.length, paid, spend: sp, cps: st.length && sp ? sp / st.length : null, ret: sp ? paid / sp : 0, renew: renew(k)}; });
    return {rows, free: rows.filter(x => FREE_CHANNELS.includes(x.k)), paid: rows.filter(x => !FREE_CHANNELS.includes(x.k) && x.k !== 'Not recorded' && x.k !== 'No channel recorded'), nochan: rows.find(x => x.k === 'No channel recorded'), none: rows.find(x => x.k === 'Not recorded'), totalSpend: sum(Object.values(spend)), newTotal: sum(Object.values(newBy), x => x.length)};
  }
  function marketing(period){
    const b = B(), ms = b.months(period), R = mkt(ms);
    const line = x => `<div class="ins-mk"><b>${esc(x.k)}</b><span><small>Spent</small>${x.spend ? mkShort(x.spend) : '–'}</span><span><small>New students</small>${x.n}</span><span><small>They've paid</small>${mkShort(x.paid)}</span><span><small>Cost / student</small>${x.cps ? mkShort(x.cps) : '–'}</span><span><small>Return</small>${x.spend ? `<b class="${x.ret >= 1 ? 'up' : 'dn'}">${x.ret.toFixed(1)}×</b>` : '–'}</span><span><small>Renew</small>${x.renew != null ? x.renew + '%' : '–'}</span></div>`;
    const recorded = R.newTotal ? pc(R.newTotal - (R.none ? R.none.n : 0), R.newTotal) : 100;
    return `<div class="kpis">${kpi('Marketing spend', mkShort(R.totalSpend), b.periodLabel(period), `#biz/cat/${period}/Marketing`)}${kpi('New students', String(R.newTotal), `${recorded}% say how they heard`, '#students/new')}
      ${kpi('Cost per new student', R.newTotal && R.totalSpend ? mkShort(R.totalSpend / Math.max(1, R.newTotal - sum(R.free, x => x.n))) : '–', 'paid channels')}${kpi('From word of mouth', String(sum(R.free, x => x.n)), 'friends, family, siblings · no cost')}</div>
    <div class="card pad"><div class="cap">Paid channels · ${b.periodLabel(period)}</div>${R.paid.sort((a, c) => c.ret - a.ret || c.n - a.n).map(line).join('') || '<p class="empty" style="margin:0">Record marketing spending with a channel, and students\' "how they heard", to see this.</p>'}</div>
    <div class="card pad"><div class="cap">Word of mouth</div>${R.free.map(line).join('') || '<p class="empty" style="margin:0">No new students from friends or siblings in this period.</p>'}</div>
    ${R.nochan ? `<div class="card pad"><div class="cap">Marketing spending with no channel</div><p class="note" style="margin:0">${mk(R.nochan.spend)} of marketing spending in this period doesn't say which channel it was for, so it can't be matched to students. Tap it in Spending to add the channel.</p></div>` : ''}
    ${R.none ? `<div class="card pad"><div class="cap">Not recorded</div>${line(R.none)}<p class="note">New students without "how they heard". It's now required for new students, so this shrinks over time.</p></div>` : ''}
    <p class="note">Return = what the new students from a channel have paid so far ÷ what the channel cost in this period. "Renew" = of all students from that channel whose period has ended, how many continued.</p>`;
  }

  /* ---------- Charts: one builder for everything ---------- */
  const CK = 'lhq_chart', CS = 'lhq_charts';
  const MEAS = {in: ['Money in (tuition)', DIMS.map(d => d[0])], spend: ['Spending', ['cat']], profit: ['Profit', []], enrol: ['New students', ['prog','level','school','area','district','source']], active: ['Students in a period', ['prog','level','school','area','district','mode']], sess: ['Sessions taught', ['tutor','mode','sub']]};
  const getC = () => { try{ return Object.assign({m: 'in', s: 'prog', inc: [], over: 'm', n: 12}, JSON.parse(localStorage.getItem(CK) || '{}')); }catch(e){ return {m: 'in', s: 'prog', inc: [], over: 'm', n: 12}; } };
  const setC = c => { try{ localStorage.setItem(CK, JSON.stringify(c)); }catch(e){} };
  function chartData(c){
    const b = B(), F = facts(), end = b.thisMonth(), M = lastMonths(end, c.n);
    const buckets = c.over === 'y' ? [...new Set(M.map(m => 'fy' + b.fyOf(m)))] : c.over === 'q' ? [...new Set(M.map(m => b.qOf(m)))] : M;
    const msOf = k => b.isM(k) ? [k] : b.months(k, true).filter(m => M.includes(m));
    const label = k => b.isM(k) ? b.monShort(k) + (k.endsWith('-01') || k === M[0] ? ' ' + k.slice(2, 4) : '') : b.isQ(k) ? 'Q' + k.slice(-1) + ' ' + String(+k.slice(1, 5)).slice(2) + '/' + String(+k.slice(1, 5) + 1).slice(2) : String(+k.slice(2)).slice(2) + '/' + String(+k.slice(2) + 1).slice(2);
    let items = [];   // {m: month, k: split value, v}
    if(c.m === 'in') items = F.rows.map(r => ({m: ym(r.date), k: r[c.s] || 'All', v: r.amt}));
    else if(c.m === 'spend') items = b.spendLive().filter(e => !b.NOT_COST.includes(e.cat)).map(e => ({m: ym(e.date), k: c.s === 'cat' ? e.cat : 'All', v: num(e.amount)}));
    else if(c.m === 'profit') items = M.map(m => ({m, k: 'Profit', v: b.figures([m]).profit}));
    else if(c.m === 'enrol') items = F.S.map(s => { const i = F.invs.find(x => x.id === F.firstInv.get(s.key)); if(!i) return null; return {m: ym(i.date), k: c.s === 'prog' ? progOf(i.level) : c.s === 'level' ? (i.level || 'Not set') : (s[c.s === 'source' ? 'heard' : c.s] || 'Not recorded'), v: 1}; }).filter(Boolean);
    else if(c.m === 'active') items = M.flatMap(m => F.S.filter(s => s.periods.some(p => (p.inv.periodStart || p.inv.date || '') <= m + '-31' && (p.inv.periodEnd || '9999') >= m + '-01')).map(s => ({m, k: c.s === 'prog' ? progOf(s.level) : c.s === 'level' ? (s.level || 'Not set') : c.s === 'mode' ? modeOf(s.cur && s.cur.card && s.cur.card.where) : (s[c.s] || 'Not recorded'), v: 1})));
    else if(c.m === 'sess') items = F.sess.filter(e => e.a === 'attended' || e.a === 'late').map(e => ({m: ym(e.d), k: e[c.s] || 'All', v: 1}));
    items = items.filter(x => M.includes(x.m));
    const allKeys = sortObj(groupSum(items, x => x.k, x => x.v)).map(x => x[0]);
    const keys = c.inc && c.inc.length ? allKeys.filter(k => c.inc.includes(k)) : allKeys.slice(0, 6);
    const per = (k, bk) => sum(items.filter(x => x.k === k && msOf(bk).includes(x.m)), x => x.v);
    const avgOver = c.m === 'active';   // students: average over a quarter or year, not added up
    const series = keys.map((k, i) => ({name: k, col: COLORS[i % COLORS.length], vals: buckets.map(bk => avgOver ? per(k, bk) / Math.max(1, msOf(bk).length) : per(k, bk))}));
    return {labels: buckets.map(label), series, allKeys};
  }
  function charts(){
    const c = getC(), meas = MEAS[c.m] || MEAS.in, splits = meas[1];
    if(splits.length && !splits.includes(c.s)) c.s = splits[0];
    const D = chartData(c), money = ['in', 'spend', 'profit'].includes(c.m), saves = (() => { try{ return JSON.parse(localStorage.getItem(CS) || '[]'); }catch(e){ return []; } })();
    const sel = (id, opts, v) => `<select class="in" id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    return `<div class="card pad ins-cb"><div class="r3">
      <label class="f"><span>Show</span>${sel('chM', Object.entries(MEAS).map(([k, v]) => [k, v[0]]), c.m)}</label>
      <label class="f"><span>Split by</span>${splits.length ? sel('chS', splits.map(k => [k, k === 'cat' ? 'Spending category' : DIM[k]]), c.s) : '<select class="in" disabled><option>Nothing to split</option></select>'}</label>
      <label class="f"><span>Over</span>${sel('chO', [['m','Months'],['q','Quarters'],['y','Financial years']], c.over)}</label></div>
      <div class="r2"><label class="f"><span>Period</span>${sel('chN', [[6,'Last 6 months'],[12,'Last 12 months'],[24,'Last 2 years'],[36,'Last 3 years']].map(([k, l]) => [String(k), l]), String(c.n))}</label>
      <div class="f"><span style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:5px">Saved views</span><div class="acts">${saves.map((s, i) => `<button class="chip" data-chload="${i}">${esc(s.name)}</button>`).join('')}<button class="chip" id="chSave">+ Save this view</button></div></div></div>
      ${D.allKeys.length > 1 && splits.length ? `<div class="cap">Include <small style="text-transform:none;letter-spacing:0;font-weight:600">(none ticked = the top 6)</small></div><div class="chips">${D.allKeys.slice(0, 24).map(k => `<button class="chip ${(c.inc || []).includes(k) ? 'on' : ''}" data-chinc="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}</div>
    <div class="card pad">${D.series.length ? lineChart(D.labels, D.series, {bars: c.over !== 'm' || D.labels.length <= 6, fmt: money ? undefined : v => Math.round(v), fmtTip: money ? undefined : v => Math.round(v * 10) / 10, label: meas[0]}) : '<p class="empty">Nothing to show for this choice.</p>'}
      ${D.series.length ? `<div class="bz-scroll"><table class="bz-mt"><tr><th></th>${D.labels.map(l => `<th>${esc(l)}</th>`).join('')}<th>Total</th></tr>${D.series.map(s => `<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${s.col};margin-right:6px"></i>${esc(s.name)}</td>${s.vals.map(v => `<td>${money ? mkShort(v).replace('MKW ', '') : Math.round(v * 10) / 10}</td>`).join('')}<td><b>${money ? mkShort(sum(s.vals)).replace('MKW ', '') : Math.round(sum(s.vals))}</b></td></tr>`).join('')}</table></div>` : ''}</div>`;
  }

  /* ---------- Pots: money in split by percentage ---------- */
  const POT_DEFAULT = [['Tutor pay & salaries', ['Salaries']], ['Rent & utilities', ['Rentals','Utilities','Communication']], ['Running costs', ['Stationery','Transportation','Maintenance']], ['Marketing', ['Marketing']], ['Growth & training', ['Trainings','Renovations','Purchases']], ['Tax reserve', []], ['Emergency reserve', []], ['Profit', []]];
  const potsCfg = () => (store.get('lhq_budget', {}) || {}).pots || null;
  function pots(period){
    if(!can('pl')) return '';
    const b = B(), P = potsCfg(), ms = b.months(period), f = b.figures(ms);
    if(!P || !P.list || !P.list.length) return `<div class="h2">Pots</div><div class="card pad"><p class="note" style="margin:0 0 10px">Pots split every kwacha that comes in by percentage: for example 40% for tutor pay and salaries, 15% for rent, 7% set aside for tax, 5% profit. Each spending category draws from a pot, so you see what's left in each, and how much to move into real accounts each month.</p>${isDir() ? '<button class="btn n" data-pots>Set up pots</button>' : '<p class="empty" style="margin:0">The Director sets them up.</p>'}</div>`;
    const income = ms2 => b.figures(ms2).revenue;
    const since = P.from || ms[0], allMs = []; for(let m = since; m <= b.thisMonth(); m = b.addMonth(m, 1)) allMs.push(m);
    const inAll = income(allMs), spentIn = (pot, M) => sum(pot.cats || [], c => b.figures(M).byCat[c] || 0);
    const thisM = b.thisMonth(), inThisM = income([thisM]);
    const rows = P.list.map(pt => { const per = f.revenue * pt.p / 100, sp = spentIn(pt, ms), bal = inAll * pt.p / 100 - spentIn(pt, allMs);
      return `<div class="bz-bud" style="border-top:1px solid var(--line2)"><div class="h"><b>${esc(pt.n)} <small style="font-weight:600;color:var(--muted)">${pt.p}%</small></b><span>${mkShort(sp)} spent of ${mkShort(per)} · <b style="color:${bal < 0 ? 'var(--rd)' : 'var(--ok)'}">${bal < 0 ? '−' : ''}${mkShort(Math.abs(bal))} left</b></span></div>
        <div class="track"><i style="width:${per ? Math.min(100, sp / per * 100) : 0}%;background:${sp > per ? 'var(--rd)' : sp > per * .8 ? 'var(--gold)' : 'var(--ok)'}"></i></div>
        <div class="m" style="font-size:12px;color:var(--muted);margin-top:4px">${(pt.cats || []).length ? 'Pays for: ' + esc(pt.cats.join(', ')) : 'Kept aside: nothing is paid from it'}${bal < 0 ? ' · <b style="color:var(--rd)">spending is ahead of what this pot has received</b>' : ''}</div></div>`; }).join('');
    const unmapped = Object.keys(f.byCat).filter(c => !P.list.some(pt => (pt.cats || []).includes(c)));
    return `<div class="h2">Pots <em>since ${b.monthName(since)}</em></div>
    <div class="card pad"><p class="note" style="margin:0 0 6px">Money in for ${b.periodLabel(period)}: ${mk(f.revenue)}, split by percentage. "Left" counts everything since the pots started.</p>${rows}
      ${unmapped.length ? `<p class="note" style="color:var(--am)">Not in any pot: ${esc(unmapped.join(', '))}. Add them to a pot.</p>` : ''}</div>
    <div class="card pad"><div class="cap">To move into real accounts for ${b.monthName(thisM)}</div><p class="note" style="margin:0 0 8px">From ${mk(inThisM)} received so far this month. Move these into separate accounts (savings, mobile money) so the money really is set aside.</p>
      ${P.list.map(pt => `<div class="it" style="padding:8px 0"><span class="t"><b>${esc(pt.n)}</b></span><b class="bz-amt">${mk(inThisM * pt.p / 100)}</b></div>`).join('')}</div>
    ${isDir() ? '<button class="btn" data-pots>' + ic('edit',16) + ' Change pots</button>' : ''}`;
  }
  function potsSheet(){
    const b = B(), P = potsCfg(), C = b.cats().filter(c => !b.NOT_COST.includes(c));
    let list = P && P.list && P.list.length ? JSON.parse(JSON.stringify(P.list)) : POT_DEFAULT.map(([n, cats]) => ({n, p: 0, cats: cats.filter(c => C.includes(c))}));
    const six = lastMonths(b.addMonth(b.thisMonth(), -1), 6), inc6 = b.figures(six).revenue, f6 = b.figures(six);
    const suggest = () => { list.forEach(pt => { pt.p = pt.cats.length && inc6 ? Math.round(sum(pt.cats, c => f6.byCat[c] || 0) / inc6 * 100) : pt.p; });
      const used = sum(list.filter(pt => pt.cats.length), pt => pt.p), rest = Math.max(0, 100 - used), free = list.filter(pt => !pt.cats.length);
      const share = {'Tax reserve': .35, 'Emergency reserve': .25, 'Profit': .4}; free.forEach(pt => { pt.p = Math.round(rest * (share[pt.n] != null ? share[pt.n] : 1 / free.length)); }); };
    const draw = () => {
      const tot = sum(list, pt => +pt.p || 0);
      $('potRows').innerHTML = list.map((pt, i) => `<div class="card pad" style="margin-bottom:8px"><div class="addrow"><input class="in" data-pn="${i}" value="${esc(pt.n)}"><input class="in" data-pp="${i}" value="${pt.p}" inputmode="numeric" style="max-width:80px;text-align:right"><span style="align-self:center;font-weight:800">%</span><button class="btn sm rd" data-pdel="${i}" title="Remove">✕</button></div>
        <div class="chips" style="margin:8px 0 0">${C.map(c => `<button class="chip ${pt.cats.includes(c) ? 'on' : ''}" data-pc="${i}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`).join('');
      $('potTot').innerHTML = `Total <b style="color:${tot === 100 ? 'var(--ok)' : 'var(--rd)'}">${tot}%</b>${tot === 100 ? '' : ' · it needs to come to 100%'}`;
      document.querySelectorAll('[data-pn]').forEach(el => el.oninput = () => { list[+el.dataset.pn].n = el.value; });
      document.querySelectorAll('[data-pp]').forEach(el => el.oninput = () => { list[+el.dataset.pp].p = num(el.value); const t = sum(list, pt => +pt.p || 0); $('potTot').innerHTML = `Total <b style="color:${t === 100 ? 'var(--ok)' : 'var(--rd)'}">${t}%</b>${t === 100 ? '' : ' · it needs to come to 100%'}`; });
      document.querySelectorAll('[data-pdel]').forEach(el => el.onclick = () => { list.splice(+el.dataset.pdel, 1); draw(); });
      document.querySelectorAll('[data-pc]').forEach(el => el.onclick = () => { const pt = list[+el.dataset.pc], c = el.dataset.c;
        list.forEach(x => { x.cats = x.cats.filter(y => y !== c); }); if(!el.classList.contains('on')) pt.cats.push(c); draw(); });
    };
    openSheet(`<div class="hx"><h3>Pots</h3><button class="ib" data-close>✕</button></div>
      <p class="sp">Each pot gets a share of every kwacha that comes in. Tap the spending categories each pot pays for (a category belongs to one pot). Pots with no categories are kept aside, like tax and profit.</p>
      <div class="note" style="margin:0 0 10px">Last 6 months: money in ${mk(inc6)}. ${inc6 ? 'What each category actually took: ' + esc(sortObj(f6.byCat).slice(0, 6).map(([c, v]) => `${c} ${pc(v, inc6)}%`).join(', ')) + '.' : ''}</div>
      <button class="btn sm" id="potSug">Suggest percentages from the last 6 months</button>
      <div id="potRows" style="margin-top:10px"></div>
      <div class="acts" style="margin:6px 0 12px"><button class="btn sm" id="potAdd">+ Add a pot</button><span id="potTot" style="align-self:center;margin-left:auto"></span></div>
      <label class="f"><span>Start counting from</span><input class="in" type="month" id="potFrom" value="${esc((P && P.from) || b.thisMonth())}"></label>
      <p class="note" style="margin:-4px 0 12px">I'm not an accountant: please check the tax reserve with yours. It depends on how LHQ is registered with MRA.</p>
      <button class="btn n full" id="potGo">Save pots</button>`);
    draw();
    $('potSug').onclick = () => { suggest(); draw(); };
    $('potAdd').onclick = () => { list.push({n: 'New pot', p: 0, cats: []}); draw(); };
    $('potGo').onclick = () => {
      const t = sum(list, pt => +pt.p || 0); if(t !== 100){ toast('The percentages need to add up to 100%'); return; }
      const cfg = Object.assign({}, store.get('lhq_budget', {}) || {}); cfg.pots = {from: $('potFrom').value || b.thisMonth(), list: list.map(pt => ({n: pt.n.trim() || 'Pot', p: +pt.p, cats: pt.cats}))}; cfg.at = Date.now(); cfg.by = me().name;
      store.set('lhq_budget', cfg); closeSheet(); toast('Pots saved'); render();
    };
  }

  /* ---------- routing and taps ---------- */
  function view(tab, period, cat){
    if(tab === 'overview') return overview(period);
    if(tab === 'money') return money(period);
    if(tab === 'pipeline') return pipeline(period);
    if(tab === 'sessions') return sessions(period);
    if(tab === 'marketing') return marketing(period);
    if(tab === 'charts') return charts();
    if(tab === 'cat') return category(period, cat || '');
    return '';
  }
  function bind(){
    const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = ev => fn(el, ev));
    on('[data-insdim]', el => { dim = el.dataset.insdim; render(); });
    on('[data-insall]', () => { insAll = true; render(); });
    on('[data-lost]', el => lostSheet(el.dataset.lost));
    on('[data-pots]', () => potsSheet());
    const ch = (id, k, f = v => v) => { const el = $(id); if(el) el.onchange = () => { const c = getC(); c[k] = f(el.value); if(k === 'm' || k === 's') c.inc = []; setC(c); render(); }; };
    ch('chM', 'm'); ch('chS', 's'); ch('chO', 'over'); ch('chN', 'n', Number);
    on('[data-chinc]', el => { const c = getC(), k = el.dataset.chinc; c.inc = (c.inc || []).includes(k) ? c.inc.filter(x => x !== k) : (c.inc || []).concat(k); setC(c); render(); });
    if($('chSave')) $('chSave').onclick = () => { const n = (prompt('Name this view, e.g. "IGCSE money in by subject"') || '').trim(); if(!n) return; let L = []; try{ L = JSON.parse(localStorage.getItem(CS) || '[]'); }catch(e){} L.push({name: n, c: getC()}); try{ localStorage.setItem(CS, JSON.stringify(L.slice(-12))); }catch(e){} toast('View saved on this device'); render(); };
    on('[data-chload]', el => { let L = []; try{ L = JSON.parse(localStorage.getItem(CS) || '[]'); }catch(e){} const v = L[+el.dataset.chload]; if(v){ setC(v.c); render(); } });
  }
  return {view, bind, spendTop, pots, facts, progOf, habits, sessFigures, pipeFigures, mkt, lineChart, shareRows, DIMS};
})();
