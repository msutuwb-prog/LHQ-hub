/* LHQ Hub › Business: money in, spending, profit and loss, and budgets, for LHQ's financial year (July to June).
   Loaded by index.html before its main script; the page functions run later and use that script's helpers
   (esc, mk, ic, toast, openSheet, can, saved …).

   Who sees what (the server enforces the same):
     Director          everything, and sets the budgets
     admin + "spend"   records spending and sees the spending list (can change only what they recorded)
     admin + "pl"      sees profit and loss, budgets, and the Profit card on Home
   Money in = payments received (receipts), by the date on the receipt. */
window.BIZ = (function(){
  const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ONEOFF = ['Renovations','Purchases'];
  const NOT_COST = ['Loan repayment'];   // money going out that isn't a cost of running LHQ (paying back a loan)
  const INCOME_TYPES = ['Rent from tenant','Loan received','Owner investment','Grant or sponsorship','Refund received','Other income'];
  const NOT_INCOME = ['Loan received','Owner investment'];   // money in that isn't earned: never counted as revenue or profit
  const ym = iso => String(iso || '').slice(0, 7);
  const monthName = m => { const [y, n] = m.split('-').map(Number); return `${MONL[n - 1]} ${y}`; };
  const monShort = m => MONL[+m.slice(5) - 1].slice(0, 3);
  const addMonth = (m, k) => { let [y, n] = m.split('-').map(Number); n += k; while(n > 12){ n -= 12; y++; } while(n < 1){ n += 12; y--; } return `${y}-${String(n).padStart(2, '0')}`; };
  const fyOf = m => { const [y, n] = m.split('-').map(Number); return n >= 7 ? y : y - 1; };
  const fyMonths = fy => Array.from({length:12}, (_, i) => addMonth(`${fy}-07`, i));
  const fyLabel = fy => `July ${fy} – June ${fy + 1}`;
  const thisMonth = () => ym(today());
  const cats = () => { const L = lines(settingsKV().spendCats || DEFAULT_SPEND_CATS.join('\n')); return L.length ? L : DEFAULT_SPEND_CATS; };
  const methods = () => lines(settingsKV().methods);
  const channels = () => { const L = lines(settingsKV().heardFrom || DEFAULT_HEARD.join('\n')); return L.filter(x => !FREE_CHANNELS.includes(x)); };
  const payees = () => [...new Set(spendAll().map(e => (e.to || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 200);
  function guessChannel(what){
    const w = String(what || '').toLowerCase(), C = channels();
    const hit = [['instagram','Instagram'],['facebook','Facebook'],['tiktok','TikTok'],['whatsapp','WhatsApp'],['google','Google'],['flyer','Flyers or posters'],['poster','Flyers or posters'],['banner','Flyers or posters'],['study smart','Study Smart Session'],['school','Their school'],['radio','Radio or TV'],['tv','Radio or TV'],['event','An event'],['expo','An event']].find(([k]) => w.includes(k));
    return hit && C.includes(hit[1]) ? hit[1] : '';
  }
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  /* ---------- the figures ---------- */
  const spendAll = () => Object.values(store.get('lhq_spend', {}) || {}).filter(e => e && !e.del);
  const spendLive = () => spendAll().filter(e => !e.skip);
  const inPeriod = (e, months) => months.includes(ym(e.date));
  const budget = () => (store.get('lhq_budget', {}) || {}).m || {};
  const incomeAll = () => Object.values(store.get('lhq_income', {}) || {}).filter(e => e && !e.del);
  const incomeLive = () => incomeAll().filter(e => !e.skip);
  /* periods: 'YYYY-MM' a month · 'qYYYY-N' quarter N of the financial year starting July YYYY · 'fyYYYY' the financial year */
  const isQ = p => /^q\d{4}-[1-4]$/.test(p), isY = p => /^fy\d{4}$/.test(p), isM = p => /^\d{4}-\d{2}$/.test(p);
  const qOf = m => { const fy = fyOf(m), i = fyMonths(fy).indexOf(m); return `q${fy}-${Math.floor(i / 3) + 1}`; };
  const qMonths = q => { const [fy, n] = q.slice(1).split('-').map(Number); return fyMonths(fy).slice((n - 1) * 3, n * 3); };
  function months(period, all){   // the months of a period; a current one stops at this month unless `all`
    const cur = thisMonth(), cut = L => all ? L : L.filter(m => m <= cur);
    if(isY(period)) return cut(fyMonths(+period.slice(2)));
    if(isQ(period)) return cut(qMonths(period));
    return [period];
  }
  function periodLabel(p){
    if(isY(p)) return fyLabel(+p.slice(2)) + (+p.slice(2) === fyOf(thisMonth()) ? ' · to date' : '');
    if(isQ(p)){ const L = qMonths(p); return `Q${p.slice(-1)} · ${monShort(L[0])} – ${monShort(L[2])} ${L[2].slice(0, 4)}`; }
    return monthName(p);
  }
  function shift(p, k){   // the period k steps earlier (−) or later (+)
    if(isY(p)) return 'fy' + (+p.slice(2) + k);
    if(isQ(p)){ let [fy, n] = p.slice(1).split('-').map(Number); n += k; while(n > 4){ n -= 4; fy++; } while(n < 1){ n += 4; fy--; } return `q${fy}-${n}`; }
    return addMonth(p, k);
  }
  const lastYear = p => isY(p) ? shift(p, -1) : isQ(p) ? shift(p, -4) : addMonth(p, -12);
  function figures(ms){
    const rcts = saved.filter(d => d.type === 'receipt' && ms.includes(ym(d.date)));
    const inc = rcts.reduce((a, r) => a + num(r.received), 0);
    const invoiced = saved.filter(d => d.type === 'invoice' && ms.includes(ym(d.date))).reduce((a, i) => a + HD.total(i), 0);
    const all = spendLive().filter(e => inPeriod(e, ms)), sp = all.filter(e => !NOT_COST.includes(e.cat)), byCat = {};
    sp.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + num(e.amount));
    const exp = sp.reduce((a, e) => a + num(e.amount), 0), oneoff = ONEOFF.reduce((a, c) => a + (byCat[c] || 0), 0);
    const ins = incomeLive().filter(e => inPeriod(e, ms)), byType = {};
    ins.forEach(e => byType[e.cat] = (byType[e.cat] || 0) + num(e.amount));
    const other = ins.filter(e => !NOT_INCOME.includes(e.cat)).reduce((a, e) => a + num(e.amount), 0);
    const capital = ins.filter(e => NOT_INCOME.includes(e.cat)).reduce((a, e) => a + num(e.amount), 0);
    const repaid = all.filter(e => NOT_COST.includes(e.cat)).reduce((a, e) => a + num(e.amount), 0);
    const refunds = byCat['Refunds'] || 0;
    return {inc, other, revenue: inc + other, invoiced, exp, oneoff, byCat, byType, capital, repaid, refunds, profit: inc + other - exp, n: sp.length, list: all, income: ins};
  }
  function owed(){
    const st = saved.filter(d => d.type === 'invoice').map(i => HD.invState(i)).filter(s => s.balance > 0.005);
    const over = st.filter(s => s.over);
    return {amt: st.reduce((a, s) => a + s.balance, 0), n: st.length, overN: over.length, overAmt: over.reduce((a, s) => a + s.balance, 0)};
  }
  /* repeating costs (rent, internet, salaries): the next month's copy waits here for one tap */
  function due(key){
    const series = {};
    (key === 'lhq_income' ? incomeAll() : spendAll()).forEach(e => { const k = e.sid || e.id; (series[k] = series[k] || []).push(e); });
    const out = [], t = today(), cur = thisMonth();
    Object.entries(series).forEach(([sid, list]) => {
      list.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.at || 0) - (b.at || 0));
      const last = list[list.length - 1]; if(last.rep !== 'm') return;
      const day = +list[0].date.slice(8);   // the day it was first paid, so the 31st stays the 31st after a short month
      for(let m = addMonth(ym(last.date), 1), i = 0; m <= cur && i < 3; m = addMonth(m, 1), i++){
        const [y, n] = m.split('-').map(Number), dim = new Date(y, n, 0).getDate();
        const date = `${m}-${String(Math.min(day, dim)).padStart(2, '0')}`;
        if(date <= t) out.push({sid, last, date});
      }
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  const mayEdit = e => isDir() || (can('spend') && e.by === me().name);

  /* ---------- pieces ---------- */
  function periodBar(tab, period, extra){
    const cur = thisMonth(), base = isM(period) ? period : months(period, true).filter(m => m <= cur).pop() || months(period, true)[0];
    const next = shift(period, 1), nextOK = months(next, true)[0] <= cur;
    const opt = (k, l, to) => `<button class="${k ? 'on' : ''}" data-bzp="${tab}/${to}${extra ? '/' + extra : ''}">${l}</button>`;
    const go = p => `#biz/${tab}/${p}${extra ? '/' + encodeURIComponent(extra) : ''}`;
    return `<div class="bz-per"><div class="seg" style="margin:0">${opt(isM(period), 'Month', base)}${opt(isQ(period), 'Quarter', qOf(base))}${opt(isY(period), 'Year', 'fy' + fyOf(base))}</div>
      <div class="bz-nav"><a class="ib" href="${go(shift(period, -1))}" aria-label="Earlier">${ic('back',16,2.2)}</a><b>${periodLabel(period)}</b>${nextOK ? `<a class="ib" href="${go(next)}" aria-label="Later">${ic('chev',16,2.2)}</a>` : '<span class="ib" style="opacity:.3">' + ic('chev',16,2.2) + '</span>'}</div></div>`;
  }
  function chart(fy, period){
    const ms = fyMonths(fy), cur = thisMonth(), F = ms.map(m => m <= cur ? figures([m]) : null);
    const max = Math.max(1, ...F.filter(Boolean).map(f => Math.max(f.inc, f.exp)));
    const step = max > 20e6 ? 10e6 : max > 8e6 ? 5e6 : max > 2e6 ? 1e6 : 5e5, top = Math.ceil(max / step) * step;
    const W = 720, H = 220, pl = 46, pr = 8, pt = 12, pb = 26, cw = (W - pl - pr) / 12, bw = cw * .3;
    const x = i => pl + cw * i + cw / 2, y = v => pt + (H - pt - pb) * (1 - v / top);
    let g = '';
    for(let v = 0; v <= top; v += step) g += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line2)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${v >= 1e6 ? (v / 1e6) + 'M' : v ? (v / 1e3) + 'k' : 0}</text>`;
    ms.forEach((m, i) => {
      const f = F[i], sel = period === m;
      if(sel) g += `<rect x="${x(i) - cw / 2 + 2}" y="${pt - 4}" width="${cw - 4}" height="${H - pt - pb + 4}" rx="6" fill="var(--hover)"/>`;
      if(f){
        g += `<rect x="${x(i) - bw - 1}" y="${y(f.inc)}" width="${bw}" height="${Math.max(0, y(0) - y(f.inc))}" rx="3" fill="var(--inc)"><title>${monthName(m)}: ${mk(f.inc)} in</title></rect>`;
        g += `<rect x="${x(i) + 1}" y="${y(f.exp)}" width="${bw}" height="${Math.max(0, y(0) - y(f.exp))}" rx="3" fill="var(--exp)"><title>${monthName(m)}: ${mk(f.exp)} spent</title></rect>`;
      }
      g += `<a href="#biz/pl/${m}"><rect x="${x(i) - cw / 2}" y="0" width="${cw}" height="${H}" fill="transparent"/><text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${f ? 'var(--ink)' : 'var(--muted)'}" font-weight="${sel ? 800 : 500}">${monShort(m)}</text></a>`;
    });
    return `<div class="bz-scroll"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:540px" role="img" aria-label="Money in and spending by month, ${fyLabel(fy)}">${g}</svg></div>`;
  }
  const kpi = (l, v, s, cls = 'fl', href) => `<${href ? `a href="${href}"` : 'div'} class="kpi"><small>${l}</small><b>${v}</b>${s ? `<span class="${cls}">${s}</span>` : ''}</${href ? 'a' : 'div'}>`;
  const docsFor = (type, period) => `#docs/${type}/${isY(period) ? 'fy-' + period.slice(2) : isQ(period) ? 'q-' + period.slice(1) : 'm-' + period}`;
  const signed = v => (v < 0 ? '−' : '') + mk(Math.abs(v));

  /* ---------- profit and loss ---------- */
  function plView(period){
    const ms = months(period), f = figures(ms), fy = isY(period) ? +period.slice(2) : fyOf(isQ(period) ? qMonths(period)[0] : period);
    const live = months(period, true).includes(thisMonth()), o = owed();
    const prevP = shift(period, -1), prev = live ? null : figures(months(prevP));
    const toRec = live && can('spend') ? due().reduce((a, d) => a + num(d.last.amount), 0) : 0;
    const B = budget(), bTot = Object.values(B).reduce((a, v) => a + num(v), 0) * ms.length;
    const ch = prev && prev.exp ? Math.round((f.exp - prev.exp) / prev.exp * 100) : null;
    const rows = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
    const otherRows = Object.entries(f.byType).filter(([t]) => !NOT_INCOME.includes(t));
    const so = live ? ' so far' : '', pShort = isM(prevP) ? monShort(prevP) : isQ(prevP) ? 'Q' + prevP.slice(-1) : 'last year';
    return `<div class="kpis">
      ${kpi('Money in' + so, mkShort(f.revenue), f.other ? `${mkShort(f.inc)} tuition · ${mkShort(f.other)} other` : `${mkShort(f.invoiced)} invoiced`, 'fl', '#biz/money/' + period)}
      ${kpi('Spending' + so, mkShort(f.exp), toRec ? `+ ${mkShort(toRec)} repeating to confirm` : ch == null ? (f.oneoff ? `incl. ${mkShort(f.oneoff)} one-off` : (bTot ? `budget ${mkShort(bTot)}` : '')) : `${ch > 0 ? '▲' : '▼'} ${Math.abs(ch)}% vs ${pShort}`, toRec ? 'fl' : ch == null ? 'fl' : ch > 0 ? 'dn' : 'up', `#biz/spending/${period}`)}
      ${kpi('Profit' + so, (f.profit < 0 ? '−' : '') + mkShort(Math.abs(f.profit)), f.revenue ? `${pct(f.profit, f.revenue)}% margin` : '', f.profit >= 0 ? 'up' : 'dn')}
      ${kpi('Owed to LHQ', mkShort(o.amt), o.overN ? `${o.overN} overdue · ${mkShort(o.overAmt)}` : 'nothing overdue', o.overN ? 'dn' : 'fl', '#docs/invoice/unpaid')}</div>
    <div class="card pad"><div class="cap bz-cap">Money in and spending · ${fyLabel(fy)}<span class="bz-leg"><span><i style="background:var(--inc)"></i>Money in</span><span><i style="background:var(--exp)"></i>Spending</span></span></div>${chart(fy, isM(period) ? period : null)}<p class="note" style="margin:4px 0 0">Tap a month to see it.</p></div>
    <div class="card pad"><div class="cap">Profit and loss · ${periodLabel(period)}</div>
      <table class="bz-pl"><tr><td><b>Tuition</b> <small>payments received</small></td><td><b>${mk(f.inc)}</b></td></tr>
      ${otherRows.map(([t, v]) => `<tr><td><b>${esc(t)}</b></td><td><b>${mk(v)}</b></td></tr>`).join('')}
      ${otherRows.length ? `<tr class="sub2"><td>Money in</td><td>${mk(f.revenue)}</td></tr>` : ''}
      ${rows.map(([c, v]) => `<tr class="sub"><td><a href="#biz/cat/${period}/${encodeURIComponent(c)}">${esc(c)}</a>${ONEOFF.includes(c) ? ' <span class="tag gr">one-off</span>' : ''}</td><td>−${mk(v)}</td></tr>`).join('') || '<tr class="sub"><td colspan="2" style="color:var(--muted)">No spending recorded</td></tr>'}
      <tr class="sub2"><td>Total spending${bTot ? ` <small>budget ${mk(bTot)}</small>` : ''}</td><td>−${mk(f.exp)}</td></tr>
      <tr class="tot"><td>Profit</td><td>${signed(f.profit)}</td></tr>
      ${f.oneoff ? `<tr class="sub"><td>Profit without one-off costs</td><td>${signed(f.profit + f.oneoff)}</td></tr>` : ''}
      ${toRec ? `<tr class="sub"><td>Repeating costs not yet confirmed <a href="#biz/spending/${period}">confirm</a></td><td>−${mk(toRec)}</td></tr>` : ''}</table>
      ${f.capital || f.repaid ? `<div class="cap" style="margin-top:14px">Not counted in profit</div><table class="bz-pl">${Object.entries(f.byType).filter(([t]) => NOT_INCOME.includes(t)).map(([t, v]) => `<tr class="sub"><td>${esc(t)}</td><td>${mk(v)}</td></tr>`).join('')}${f.repaid ? `<tr class="sub"><td>Loan repayments</td><td>−${mk(f.repaid)}</td></tr>` : ''}</table>` : ''}
      ${live ? '<p class="note">This period is still going: costs paid at month end (such as salaries and tutor pay) are not all in yet, so profit looks higher than it will be.</p>' : ''}
      <p class="note">Salaries here are what was recorded in Spending. Tutor pay from session logs arrives with the tutor part.</p></div>
    ${!isM(period) ? monthTable(months(period)) : ''}`;
  }
  function monthTable(ms){
    return `<div class="card pad"><div class="cap">Month by month</div><div class="bz-scroll"><table class="bz-mt"><tr><th></th>${ms.map(m => `<th><a href="#biz/pl/${m}">${monShort(m)}</a></th>`).join('')}</tr>
      ${[['Money in', f => f.revenue], ['Spending', f => -f.exp], ['Profit', f => f.profit]].map(([l, fn]) => `<tr class="${l === 'Profit' ? 'tot' : ''}"><td>${l}</td>${ms.map(m => { const v = fn(figures([m])); return `<td>${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(1)}M</td>`; }).join('')}</tr>`).join('')}</table></div></div>`;
  }

  /* ---------- spending ---------- */
  let catF = '';
  function spendingView(period, cat){
    catF = cat || '';
    const ms = months(period), f = figures(ms), D = can('spend') ? due() : [];
    const list = f.list.filter(e => !catF || e.cat === catF).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || 0) - (a.at || 0));
    const present = Object.keys(f.byCat), max = Math.max(1, ...Object.values(f.byCat));
    return `${D.length ? `<div class="card pad" style="border-color:var(--gold)"><div class="cap">Repeating costs to confirm</div>
        ${D.map(d => `<div class="it bz-due"><span class="t"><b>${esc(String(d.last.what || d.last.cat).replace(new RegExp('\\b' + MONL[+d.last.date.slice(5, 7) - 1] + '\\b', 'g'), MONL[+d.date.slice(5, 7) - 1]))}</b><small>${nice(d.date)} · ${esc(d.last.cat)} · last time ${mk(num(d.last.amount))}</small></span>
          <div class="acts"><button class="btn sm n" data-bzok="${d.sid}|${d.date}">Paid ${mkShort(num(d.last.amount))}</button><button class="btn sm" data-bzchg="${d.sid}|${d.date}">Other amount</button><button class="btn sm" data-bzskip="${d.sid}|${d.date}">Skip</button></div></div>`).join('')}
        <p class="note">Rent, internet and salaries set to repeat come back here each month. Confirm when they are paid.</p></div>` : ''}
      <div class="chips"><a class="chip ${catF ? '' : 'on'}" href="#biz/spending/${period}">All <i>${f.list.length}</i></a>${present.map(c => `<a class="chip ${catF === c ? 'on' : ''}" href="#biz/spending/${period}/${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
      <div class="card">${list.map(e => `<${mayEdit(e) ? `button class="it" data-bzedit="${e.id}"` : 'div class="it"'}><span class="t"><b>${esc(e.what || e.cat)}</b><small>${[nice(e.date), e.cat, e.to, e.method, e.by ? 'by ' + first(e.by) : ''].filter(Boolean).map(esc).join(' · ')}</small></span>${e.rep === 'm' ? '<span class="tag bl">Monthly</span>' : ''}<b class="bz-amt">${mk(num(e.amount))}</b></${mayEdit(e) ? 'button' : 'div'}>`).join('') || `<p class="empty">No spending recorded for ${periodLabel(period)}${catF ? ' in ' + esc(catF) : ''}.</p>`}</div>
      ${present.length ? `<div class="card pad"><div class="cap bz-cap">By category <b>${mk(f.exp)}</b></div>${Object.entries(f.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="bz-hb"><span>${esc(c)}</span><span class="tr"><i style="width:${v / max * 100}%"></i></span><b>${mkShort(v)}</b></div>`).join('')}</div>` : ''}
      <button class="btn sm" data-bzcsv="${period}">${ic('box',15)} Download as a spreadsheet (CSV)</button>`;
  }

  /* ---------- budgets ---------- */
  function budgetView(period){
    const ms = months(period), f = figures(ms), B = budget(), C = cats(), multi = !isM(period);
    const tot = Object.values(B).reduce((a, v) => a + num(v), 0) * ms.length;
    const row = (c, s, b, link = true) => { const p = b ? s / b : 0, exact = b && Math.abs(p - 1) < .005, col = !b ? 'var(--muted)' : exact ? 'var(--ok)' : p > 1 ? 'var(--rd)' : p > .8 ? 'var(--gold)' : 'var(--ok)';
      return `<${link ? `a href="#biz/spending/${period}/${encodeURIComponent(c)}"` : 'div'} class="bz-bud"><div class="h"><b>${esc(c)}${ONEOFF.includes(c) ? ' <span class="tag gr">one-off</span>' : ''}</b><span>${mkShort(s)} of ${b ? mkShort(b) : 'no budget'}${exact ? ' <span class="tag ok">on budget</span>' : b && p > 1 ? ' <span class="tag rd">over</span>' : b && p > .8 ? ' <span class="tag am">80%+</span>' : ''}</span></div><div class="track"><i style="width:${b ? Math.min(100, p * 100) : 0}%;background:${col}"></i></div></${link ? 'a' : 'div'}>`; };
    const extra = Object.keys(f.byCat).filter(c => !C.includes(c));
    return `<p class="note" style="margin:-4px 0 12px">${multi ? `Spending in ${ms.length} month${ms.length === 1 ? '' : 's'} against ${ms.length} month${ms.length === 1 ? '' : 's'} of budget.` : `${periodLabel(period)}: spending against the monthly budget.`} Budgets repeat every month until they are changed.</p>
    ${Object.keys(B).length ? `<div class="card pad">${[...C, ...extra].map(c => row(c, f.byCat[c] || 0, num(B[c]) * ms.length)).join('')}</div>
      <div class="card pad"><div class="cap">Total</div>${row('All spending', f.exp, tot, false)}${multi ? '' : `<p class="note">${f.exp <= tot ? `${mk(tot - f.exp)} of this month's budget is left.` : `${mk(f.exp - tot)} over this month's budget.`}</p>`}</div>`
    : `<div class="card pad"><p class="empty" style="margin:0">No budgets yet.${isDir() ? ' Set a monthly amount for each category, then spending is measured against it here and in Profit & loss.' : ' The Director sets them.'}</p></div>`}
    ${isDir() ? `<button class="btn" data-bzbud>${ic('edit',16)} ${Object.keys(B).length ? 'Change budgets' : 'Set budgets'}</button>` : ''}`;
  }

  /* ---------- the page ---------- */
  const TABS = [['overview','Overview','pl'], ['money','Money in','pl'], ['pipeline','Pipeline','pl'], ['sessions','Sessions','pl'], ['spending','Spending','spend|pl'],
    ['budgets','Budgets & pots','pl'], ['marketing','Marketing','pl'], ['charts','Charts','pl'], ['pl','Profit & loss','pl']];
  const tabsFor = () => TABS.filter(([, , need]) => need.split('|').some(k => can(k)));
  function page(tab, period, cat){
    const T = tabsFor();
    if(!T.length) return `<div class="ph"><div class="tt"><h1>Business</h1></div></div><p class="empty">The Director hasn't given you access to Business.</p>`;
    if(tab === 'cat' && T.some(x => x[0] === 'spending')){ /* a spending category's own page */ }
    else if(!T.some(x => x[0] === tab)) tab = T[0][0];
    if(!period || !(isM(period) || isQ(period) || isY(period))) period = thisMonth();
    const fy = isY(period) ? +period.slice(2) : fyOf(isQ(period) ? qMonths(period)[0] : period);
    const body = tab === 'pl' ? plView(period) : tab === 'budgets' ? budgetView(period) + (window.INS ? INS.pots(period) : '') : tab === 'spending' ? (window.INS ? INS.spendTop(period) : '') + spendingView(period, cat)
      : window.INS ? INS.view(tab, period, cat) : '';
    return `<div class="ph"><div class="tt"><h1>Business</h1><p>Financial year ${fyLabel(fy)}${isDir() ? '' : ' · shared with you by the Director'}</p></div>
      <div class="acts">${can('pl') ? `<a class="btn" href="#perf">${ic('down',16,2.2)} Report</a>` : ''}${can('spend') ? `<button class="btn" data-bzin>${ic('plus',16,2.4)} Money in</button><button class="btn n" data-bznew>${ic('plus',16,2.4)} Spending</button>` : ''}</div></div>
      <div class="tabs">${T.map(([k, l]) => `<a class="${tab === k || (tab === 'cat' && k === 'spending') ? 'on' : ''}" href="#biz/${k}/${period}">${l}</a>`).join('')}</div>
      ${tab === 'charts' ? '' : periodBar(tab, period, tab === 'cat' ? cat : '')}
      ${body}`;
  }

  /* ---------- other money in: tenant rent, loans, owner investment, grants … ---------- */
  function incomeSheet(e, preset){
    const isNew = !e; e = e || Object.assign({id:uid(), date:today(), cat:'', amount:'', what:'', from:'', method:'', rep:''}, preset || {});
    openSheet(`<div class="hx"><h3>${isNew ? 'Record money in' : 'Money in'}</h3><button class="ib" data-close>✕</button></div>
      <p class="sp">Money that isn't a tuition payment (those come from receipts). ${isNew ? 'Any date works.' : `Recorded by ${esc(e.by || '')}.`}</p>
      <label class="f"><span>Type</span></label><div class="chips" id="inTypes">${INCOME_TYPES.map(c => `<button class="chip ${e.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <p class="note" id="inNote" style="margin:-6px 0 12px"></p>
      <div class="r2"><label class="f"><span>Amount (MKW)</span><input class="in" id="inAmt" inputmode="numeric" value="${e.amount ? Number(e.amount).toLocaleString('en-US') : ''}" placeholder="0"></label><label class="f"><span>Date</span><input class="in" id="inDate" type="date" value="${esc(e.date)}"></label></div>
      <label class="f"><span id="inFromL">From</span><input class="in" id="inFrom" value="${esc(e.from || '')}" placeholder="e.g. the tenant's name, the bank" autocomplete="off" list="inFroms"><datalist id="inFroms">${[...new Set(incomeAll().map(x => x.from).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <label class="f"><span>Note (optional)</span><input class="in" id="inWhat" value="${esc(e.what || '')}" placeholder="e.g. Shop rent for November" autocomplete="off"></label>
      <div class="r2"><label class="f"><span>Paid by</span><select class="in" id="inMethod"><option value="">Choose</option>${methods().map(m => `<option ${e.method === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="f"><span>Repeats</span><select class="in" id="inRep"><option value="">Once</option><option value="m" ${e.rep === 'm' ? 'selected' : ''}>Every month</option></select></label></div>
      <button class="btn n full" id="inSave">Save</button>${isNew ? '' : `<button class="btn rd full" id="inDel">${ic('bin',16)} Delete</button>`}`);
    const note = c => { $('inNote').textContent = c === 'Loan received' ? 'Borrowed money: shown in cash and pots, never as revenue or profit. Record repayments under Spending › Loan repayment, paid to the same lender.' : c === 'Owner investment' ? 'Money put in by the owner: not revenue or profit.' : ''; $('inFromL').textContent = c === 'Loan received' ? 'Lender' : 'From'; };
    document.querySelectorAll('#inTypes .chip').forEach(b => b.onclick = () => { document.querySelectorAll('#inTypes .chip').forEach(x => x.classList.toggle('on', x === b)); note(b.dataset.c); });
    note(e.cat);
    $('inAmt').oninput = ev => { const d = ev.target.value.replace(/[^\d]/g, ''); ev.target.value = d ? Number(d).toLocaleString('en-US') : ''; };
    $('inSave').onclick = () => {
      const c = (document.querySelector('#inTypes .chip.on') || {}).dataset, amt = num($('inAmt').value);
      if(!c){ toast('Choose the type'); return; } if(!amt){ toast('Enter the amount'); $('inAmt').focus(); return; }
      Object.assign(e, {cat:c.c, amount:amt, date:$('inDate').value || today(), from:$('inFrom').value.trim(), what:$('inWhat').value.trim(), method:$('inMethod').value, rep:$('inRep').value});
      delete e.skip; e.at = Date.now(); if(!e.by) e.by = me().name;
      const all = store.get('lhq_income', {}) || {}; all[e.id] = e; store.set('lhq_income', all);
      closeSheet(); toast(isNew ? `Recorded: ${mk(amt)} · ${c.c}` : 'Saved'); render();
    };
    if($('inDel')) $('inDel').onclick = () => { if(!confirm('Delete this?')) return; e.del = true; e.at = Date.now(); const all = store.get('lhq_income', {}) || {}; all[e.id] = e; store.set('lhq_income', all); closeSheet(); toast('Deleted'); render(); };
  }
  /* loans: what was borrowed from each lender, repaid (Spending › Loan repayment, paid to that lender) and left */
  function loans(){
    const L = {};
    incomeLive().filter(e => e.cat === 'Loan received').forEach(e => { const k = (e.from || 'Loan').trim(); (L[k] = L[k] || {lender:k, borrowed:0, repaid:0}).borrowed += num(e.amount); });
    spendLive().filter(e => e.cat === 'Loan repayment').forEach(e => { const k = (e.to || 'Loan').trim(); (L[k] = L[k] || {lender:k, borrowed:0, repaid:0}).repaid += num(e.amount); });
    return Object.values(L).map(x => Object.assign(x, {left: Math.max(0, x.borrowed - x.repaid)}));
  }

  /* ---------- recording ---------- */
  const uid = () => 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function saveEntry(e){
    const all = store.get('lhq_spend', {}) || {};
    e.at = Date.now(); if(!e.by) e.by = me().name;
    all[e.id] = e; store.set('lhq_spend', all);
  }
  function sheet(e, preset){
    const isNew = !e; e = e || Object.assign({id:uid(), date:today(), cat:'', amount:'', what:'', to:'', method:'', rep:''}, preset || {});
    const C = cats();
    openSheet(`<div class="hx"><h3>${isNew ? 'Record spending' : 'Spending'}</h3><button class="ib" data-close>✕</button></div>
      <p class="sp">${isNew ? 'Any date works, so earlier spending can be added too.' : `Recorded by ${esc(e.by || '')}${e.editedBy && e.editedBy !== e.by ? `, changed by ${esc(e.editedBy)}` : ''}.`}</p>
      <label class="f"><span>Category</span></label><div class="chips" id="bzCats">${[...C, ...(e.cat && !C.includes(e.cat) ? [e.cat] : [])].map(c => `<button class="chip ${e.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}<button class="chip" id="bzCatNew" type="button">+ New category</button></div>
      <div class="addrow" id="bzCatAdd" hidden style="margin:-6px 0 12px"><input class="in" id="bzCatName" placeholder="Name of the new category" autocomplete="off"><button class="btn sm" id="bzCatGo" type="button">Add</button></div>
      <label class="f" id="bzChanF" ${e.cat === 'Marketing' ? '' : 'hidden'}><span>Marketing channel <small style="font-weight:500">(matched with how new families heard about LHQ)</small></span><select class="in" id="bzChan"><option value="">Choose</option>${channels().map(x => `<option ${e.chan === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <div class="r2"><label class="f"><span>Amount (MKW)</span><input class="in" id="bzAmt" inputmode="numeric" value="${e.amount ? Number(e.amount).toLocaleString('en-US') : ''}" placeholder="0"></label><label class="f"><span>Date</span><input class="in" id="bzDate" type="date" value="${esc(e.date)}"></label></div>
      <label class="f"><span>What for</span><input class="in" id="bzWhat" value="${esc(e.what)}" placeholder="e.g. Printing SRA sheets" autocomplete="off"></label>
      <label class="f"><span>Paid to (optional)</span><input class="in" id="bzTo" value="${esc(e.to || '')}" placeholder="e.g. ESCOM, landlord, printer" autocomplete="off" list="bzPayees"><datalist id="bzPayees">${payees().map(x => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <div class="r2"><label class="f"><span>Paid by</span><select class="in" id="bzMethod"><option value="">Choose</option>${methods().map(m => `<option ${e.method === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="f"><span>Repeats</span><select class="in" id="bzRep"><option value="">Once</option><option value="m" ${e.rep === 'm' ? 'selected' : ''}>Every month</option></select></label></div>
      <button class="btn n full" id="bzSave">Save</button>${isNew ? '' : `<button class="btn rd full" id="bzDel">${ic('bin',16)} Delete</button>`}`);
    const pickCat = b => { document.querySelectorAll('#bzCats .chip[data-c]').forEach(x => x.classList.toggle('on', x === b)); $('bzChanF').hidden = !b || b.dataset.c !== 'Marketing'; if(b && b.dataset.c === 'Marketing' && !$('bzChan').value) $('bzChan').value = guessChannel($('bzWhat').value); };
    document.querySelectorAll('#bzCats .chip[data-c]').forEach(b => b.onclick = () => pickCat(b));
    $('bzCatNew').onclick = () => { $('bzCatAdd').hidden = false; $('bzCatName').focus(); };
    $('bzCatGo').onclick = () => { const n = $('bzCatName').value.trim(); if(!n) return;
      let b = [...document.querySelectorAll('#bzCats .chip[data-c]')].find(x => x.dataset.c.toLowerCase() === n.toLowerCase());
      if(!b){ $('bzCatNew').insertAdjacentHTML('beforebegin', `<button class="chip" data-c="${esc(n)}">${esc(n)}</button>`); b = $('bzCatNew').previousElementSibling; b.onclick = () => pickCat(b); }
      pickCat(b); $('bzCatAdd').hidden = true; $('bzCatName').value = ''; };
    $('bzCatName').onkeydown = ev => { if(ev.key === 'Enter'){ ev.preventDefault(); $('bzCatGo').click(); } };
    $('bzWhat').addEventListener('change', () => { if(!$('bzChanF').hidden && !$('bzChan').value) $('bzChan').value = guessChannel($('bzWhat').value); });
    $('bzAmt').oninput = ev => { const d = ev.target.value.replace(/[^\d]/g, ''); ev.target.value = d ? Number(d).toLocaleString('en-US') : ''; };
    document.querySelectorAll('#sheet [data-close]').forEach(b => b.onclick = closeSheet);
    $('bzSave').onclick = () => {
      const c = (document.querySelector('#bzCats .chip.on') || {}).dataset, amt = num($('bzAmt').value);
      if(!c){ toast('Choose a category'); return; }
      if(!amt){ toast('Enter the amount'); $('bzAmt').focus(); return; }
      if(!$('bzDate').value){ toast('Choose the date'); return; }
      Object.assign(e, {cat:c.c, amount:amt, date:$('bzDate').value, what:$('bzWhat').value.trim(), to:$('bzTo').value.trim(), method:$('bzMethod').value, rep:$('bzRep').value});
      if(c.c === 'Marketing') e.chan = $('bzChan').value || guessChannel(e.what); else delete e.chan;
      if(!cats().some(x => x.toLowerCase() === c.c.toLowerCase())){   // a new category joins the list for everyone
        const st = Object.assign({}, store.get('lhq_settings', {})); st.spendCats = [...cats(), c.c].join('\n'); store.set('lhq_settings', st); }
      delete e.skip; saveEntry(e); closeSheet(); toast(isNew ? `Recorded: ${mk(amt)} for ${c.c}` : 'Saved');
      const p = ym(e.date); if(route.page === 'biz' && route.args[1] !== p && !String(route.args[1] || '').startsWith('fy')) location.hash = `#biz/spending/${p}`; else render();
    };
    if($('bzDel')) $('bzDel').onclick = () => { if(!confirm('Delete this spending?')) return; e.del = true; saveEntry(e); closeSheet(); toast('Deleted'); render(); };
  }
  function csv(period){
    const ms = months(period), rows = spendLive().filter(e => inPeriod(e, ms)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const text = [['Date','Category','What for','Paid to','Paid by','Amount (MKW)','Recorded by'].map(q).join(','), ...rows.map(e => [e.date, e.cat, e.what, e.to, e.method, num(e.amount), e.by].map(q).join(','))].join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], {type:'text/csv'}));
    a.download = `LHQ-spending_${periodLabel(period).replace(/[^A-Za-z0-9–-]+/g, '-')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function budgetSheet(){
    const B = budget(), C = cats();
    openSheet(`<div class="hx"><h3>Monthly budgets</h3><button class="ib" data-close>✕</button></div><p class="sp">How much each category should cost in a month. Leave one-off categories empty if you don't plan for them.</p>
      ${C.map(c => `<label class="f bz-bf"><span>${esc(c)}</span><input class="in" data-bud="${esc(c)}" inputmode="numeric" value="${B[c] ? Number(B[c]).toLocaleString('en-US') : ''}" placeholder="0"></label>`).join('')}
      <p class="note" id="bzBudTot"></p><button class="btn n full" id="bzBudSave">Save budgets</button>`);
    const tot = () => { let t = 0; document.querySelectorAll('[data-bud]').forEach(i => t += num(i.value)); $('bzBudTot').textContent = `Total ${mk(t)} a month · ${mk(t * 12)} a year`; };
    document.querySelectorAll('[data-bud]').forEach(i => i.oninput = () => { const d = i.value.replace(/[^\d]/g, ''); i.value = d ? Number(d).toLocaleString('en-US') : ''; tot(); });
    tot(); document.querySelectorAll('#sheet [data-close]').forEach(b => b.onclick = closeSheet);
    $('bzBudSave').onclick = () => { const m = {}; document.querySelectorAll('[data-bud]').forEach(i => { const v = num(i.value); if(v) m[i.dataset.bud] = v; }); store.set('lhq_budget', {m, by:me().name, at:Date.now()}); closeSheet(); toast('Budgets saved'); render(); };
  }
  function bind(){
    const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = ev => fn(el, ev));
    on('[data-bznew]', () => sheet());
    on('[data-bzin]', () => incomeSheet());
    on('[data-inedit]', el => { const e = (store.get('lhq_income', {}) || {})[el.dataset.inedit]; if(e) incomeSheet(Object.assign({}, e)); });
    on('[data-inok]', el => { const [sid, date] = el.dataset.inok.split('|'), d = due('lhq_income').find(x => x.sid === sid && x.date === date); if(!d) return;
      const L = d.last, e = {id:uid(), sid, date, cat:L.cat, amount:L.amount, from:L.from || '', what:L.what || '', method:L.method || '', rep:'m', at:Date.now(), by:me().name};
      const all = store.get('lhq_income', {}) || {}; all[e.id] = e; store.set('lhq_income', all); toast(`Recorded: ${mk(num(e.amount))} · ${e.cat}`); render(); });
    if(window.INS) INS.bind();
    on('[data-bzedit]', el => { const e = (store.get('lhq_spend', {}) || {})[el.dataset.bzedit]; if(e) sheet(Object.assign({}, e)); });
    on('[data-bzp]', el => { location.hash = '#biz/' + el.dataset.bzp; });
    on('[data-bzcsv]', el => csv(el.dataset.bzcsv));
    on('[data-bzbud]', () => budgetSheet());
    const copyOf = (sid, date, extra) => { const d = due().find(x => x.sid === sid && x.date === date); if(!d) return null; const L = d.last;
      const from = MONL[+L.date.slice(5, 7) - 1], to = MONL[+date.slice(5, 7) - 1];
      return Object.assign({id:uid(), sid, date, cat:L.cat, amount:L.amount, what:String(L.what || '').replace(new RegExp('\\b' + from + '\\b', 'g'), to), to:L.to || '', method:L.method || '', rep:'m'}, extra || {}); };
    on('[data-bzok]', el => { const [sid, date] = el.dataset.bzok.split('|'), e = copyOf(sid, date); if(!e) return; saveEntry(e); toast(`Recorded: ${mk(num(e.amount))} for ${e.cat}`); render(); });
    on('[data-bzchg]', el => { const [sid, date] = el.dataset.bzchg.split('|'), e = copyOf(sid, date); if(e) sheet(null, e); });
    on('[data-bzskip]', el => { const [sid, date] = el.dataset.bzskip.split('|'), e = copyOf(sid, date, {skip:true, amount:0}); if(!e) return; saveEntry(e); toast('Skipped for this month. It comes back next month.'); render(); });
  }

  /* ---------- Home cards ---------- */
  function cardProfit(){
    const m = thisMonth(), f = figures([m]), p = figures([addMonth(m, -1)]);
    const tr = p.profit ? Math.round((f.profit - p.profit) / Math.abs(p.profit) * 100) : null;
    return `${L('#biz/pl', (f.profit < 0 ? '−' : '') + mkShort(Math.abs(f.profit)), 'v')}${L('#docs/receipt/m-' + m, `${mkShort(f.inc)} in`)}${L('#biz/spending/' + m, `${mkShort(f.exp)} spent`)}<div class="s">${f.inc ? pct(f.profit, f.inc) + '% margin' : 'Nothing received yet'}</div><div class="tr fl">So far this month</div>`;
  }
  function cardSpend(){
    const m = thisMonth(), f = figures([m]), B = budget(), b = Object.values(B).reduce((a, v) => a + num(v), 0), D = due().length;
    const top = Object.entries(f.byCat).sort((a, c) => c[1] - a[1])[0];
    return `${L('#biz/spending/' + m, `${mkShort(f.exp)} <small>spent</small>`, 'v')}${b && can('pl') ? `<div class="bar"><i style="width:${Math.min(100, pct(f.exp, b))}%"></i></div><div class="s">of ${mkShort(b)} budget</div>` : `<div class="s">${f.n} payment${f.n === 1 ? '' : 's'} recorded</div>`}${top ? L(`#biz/spending/${m}/${encodeURIComponent(top[0])}`, `Most on ${esc(top[0])}: ${mkShort(top[1])}`) : ''}${D ? L('#biz/spending/' + m, `${D} repeating cost${D === 1 ? '' : 's'} to confirm`, 's warn') : ''}`;
  }

  return {page, bind, cardProfit, cardSpend, figures, due, months, fyOf, thisMonth, monthName, monShort, addMonth, fyMonths, fyLabel, periodLabel, shift, lastYear,
    isM, isQ, isY, qOf, qMonths, cats, spendLive, incomeLive, budget, loans, ONEOFF, NOT_COST, NOT_INCOME, INCOME_TYPES, mayEdit, uid, saveEntry};
})();
