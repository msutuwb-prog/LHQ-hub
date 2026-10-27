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
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  /* ---------- the figures ---------- */
  const spendAll = () => Object.values(store.get('lhq_spend', {}) || {}).filter(e => e && !e.del);
  const spendLive = () => spendAll().filter(e => !e.skip);
  const inPeriod = (e, months) => months.includes(ym(e.date));
  const budget = () => (store.get('lhq_budget', {}) || {}).m || {};
  function months(period){   // 'YYYY-MM' → that month; 'fyYYYY' → the financial year so far (or the whole of a past one)
    if(/^fy\d{4}$/.test(period)){ const fy = +period.slice(2), cur = thisMonth(); return fyMonths(fy).filter(m => m <= cur); }
    return [period];
  }
  function figures(ms){
    const rcts = saved.filter(d => d.type === 'receipt' && ms.includes(ym(d.date)));
    const inc = rcts.reduce((a, r) => a + num(r.received), 0);
    const invoiced = saved.filter(d => d.type === 'invoice' && ms.includes(ym(d.date))).reduce((a, i) => a + HD.total(i), 0);
    const sp = spendLive().filter(e => inPeriod(e, ms)), byCat = {};
    sp.forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + num(e.amount));
    const exp = sp.reduce((a, e) => a + num(e.amount), 0), oneoff = ONEOFF.reduce((a, c) => a + (byCat[c] || 0), 0);
    return {inc, invoiced, exp, oneoff, byCat, profit: inc - exp, n: sp.length, list: sp};
  }
  function owed(){
    const st = saved.filter(d => d.type === 'invoice').map(i => HD.invState(i)).filter(s => s.balance > 0.005);
    const over = st.filter(s => s.over);
    return {amt: st.reduce((a, s) => a + s.balance, 0), n: st.length, overN: over.length, overAmt: over.reduce((a, s) => a + s.balance, 0)};
  }
  /* repeating costs (rent, internet, salaries): the next month's copy waits here for one tap */
  function due(){
    const series = {};
    spendAll().forEach(e => { const k = e.sid || e.id; (series[k] = series[k] || []).push(e); });
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
  const tabsFor = () => [['pl','Profit & loss', can('pl')], ['spending','Spending', can('spend') || can('pl')], ['budgets','Budgets', can('pl')]].filter(x => x[2]);
  function periodBar(tab, period){
    const isY = period.startsWith('fy'), cur = thisMonth();
    const prev = isY ? 'fy' + (+period.slice(2) - 1) : addMonth(period, -1), next = isY ? 'fy' + (+period.slice(2) + 1) : addMonth(period, 1);
    const nextOK = isY ? +period.slice(2) + 1 <= fyOf(cur) : next <= cur;
    const label = isY ? `${fyLabel(+period.slice(2))}${+period.slice(2) === fyOf(cur) ? ' · to date' : ''}` : monthName(period);
    return `<div class="bz-per"><div class="seg" style="margin:0"><button class="${isY ? '' : 'on'}" data-bzp="${tab}/${isY ? (fyOf(cur) === +period.slice(2) ? cur : `${+period.slice(2) + 1}-06`) : period}">Month</button><button class="${isY ? 'on' : ''}" data-bzp="${tab}/fy${isY ? period.slice(2) : fyOf(period)}">Year</button></div>
      <div class="bz-nav"><a class="ib" href="#biz/${tab}/${prev}" aria-label="Earlier">${ic('back',16,2.2)}</a><b>${label}</b>${nextOK ? `<a class="ib" href="#biz/${tab}/${next}" aria-label="Later">${ic('chev',16,2.2)}</a>` : '<span class="ib" style="opacity:.3">' + ic('chev',16,2.2) + '</span>'}</div></div>`;
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
  const docsFor = (type, period) => `#docs/${type}/${period.startsWith('fy') ? 'fy-' + period.slice(2) : 'm-' + period}`;
  const signed = v => (v < 0 ? '−' : '') + mk(Math.abs(v));

  /* ---------- profit and loss ---------- */
  function plView(period){
    const isY = period.startsWith('fy'), ms = months(period), f = figures(ms), fy = isY ? +period.slice(2) : fyOf(period);
    const live = !isY && period === thisMonth(), o = owed();
    const prev = isY || live ? null : figures([addMonth(period, -1)]);
    const toRec = live && can('spend') ? due().reduce((a, d) => a + num(d.last.amount), 0) : 0;
    const B = budget(), bTot = Object.values(B).reduce((a, v) => a + num(v), 0) * ms.length;
    const ch = prev && prev.exp ? Math.round((f.exp - prev.exp) / prev.exp * 100) : null;
    const rows = Object.entries(f.byCat).sort((a, b) => b[1] - a[1]);
    return `<div class="kpis">
      ${kpi('Money in' + (live ? ' so far' : ''), mkShort(f.inc), `${mkShort(f.invoiced)} invoiced`, 'fl', docsFor('receipt', period))}
      ${kpi('Spending' + (live ? ' so far' : ''), mkShort(f.exp), toRec ? `+ ${mkShort(toRec)} repeating to confirm` : ch == null ? (f.oneoff ? `incl. ${mkShort(f.oneoff)} one-off` : (bTot ? `budget ${mkShort(bTot)}` : '')) : `${ch > 0 ? '▲' : '▼'} ${Math.abs(ch)}% vs ${monShort(addMonth(period, -1))}`, toRec ? 'fl' : ch == null ? 'fl' : ch > 0 ? 'dn' : 'up', `#biz/spending/${period}`)}
      ${kpi('Profit' + (live ? ' so far' : ''), (f.profit < 0 ? '−' : '') + mkShort(Math.abs(f.profit)), f.inc ? `${pct(f.profit, f.inc)}% margin` : '', f.profit >= 0 ? 'up' : 'dn')}
      ${kpi('Owed to LHQ', mkShort(o.amt), o.overN ? `${o.overN} overdue · ${mkShort(o.overAmt)}` : 'nothing overdue', o.overN ? 'dn' : 'fl', '#docs/invoice/unpaid')}</div>
    <div class="card pad"><div class="cap bz-cap">Money in and spending · ${fyLabel(fy)}<span class="bz-leg"><span><i style="background:var(--inc)"></i>Money in</span><span><i style="background:var(--exp)"></i>Spending</span></span></div>${chart(fy, isY ? null : period)}<p class="note" style="margin:4px 0 0">Tap a month to see it.</p></div>
    <div class="card pad"><div class="cap">Profit and loss · ${isY ? `${monShort(ms[0])} – ${monShort(ms[ms.length - 1])} ${ms[ms.length - 1].slice(0, 4)}` : monthName(period)}</div>
      <table class="bz-pl"><tr><td><b>Money in</b> <small>payments received</small></td><td><b>${mk(f.inc)}</b></td></tr>
      ${rows.map(([c, v]) => `<tr class="sub"><td><a href="#biz/spending/${period}/${encodeURIComponent(c)}">${esc(c)}</a>${ONEOFF.includes(c) ? ' <span class="tag gr">one-off</span>' : ''}</td><td>−${mk(v)}</td></tr>`).join('') || '<tr class="sub"><td colspan="2" style="color:var(--muted)">No spending recorded</td></tr>'}
      <tr class="sub2"><td>Total spending${bTot ? ` <small>budget ${mk(bTot)}</small>` : ''}</td><td>−${mk(f.exp)}</td></tr>
      <tr class="tot"><td>Profit</td><td>${signed(f.profit)}</td></tr>
      ${f.oneoff ? `<tr class="sub"><td>Profit without one-off costs</td><td>${signed(f.profit + f.oneoff)}</td></tr>` : ''}
      ${toRec ? `<tr class="sub"><td>Repeating costs not yet confirmed <a href="#biz/spending/${period}">confirm</a></td><td>−${mk(toRec)}</td></tr>` : ''}</table>
      ${live ? '<p class="note">This month is still going: costs paid at month end (such as salaries and tutor pay) are not in yet, so profit looks higher than it will be.</p>' : ''}
      <p class="note">Salaries here are what was recorded in Spending. Tutor pay from session logs arrives with step 2.</p></div>
    ${isY ? monthTable(fy) : ''}`;
  }
  function monthTable(fy){
    const cur = thisMonth(), ms = fyMonths(fy).filter(m => m <= cur);
    return `<div class="card pad"><div class="cap">Month by month</div><div class="bz-scroll"><table class="bz-mt"><tr><th></th>${ms.map(m => `<th><a href="#biz/pl/${m}">${monShort(m)}</a></th>`).join('')}</tr>
      ${[['Money in', f => f.inc], ['Spending', f => -f.exp], ['Profit', f => f.profit]].map(([l, fn]) => `<tr class="${l === 'Profit' ? 'tot' : ''}"><td>${l}</td>${ms.map(m => { const v = fn(figures([m])); return `<td>${v < 0 ? '−' : ''}${(Math.abs(v) / 1e6).toFixed(1)}M</td>`; }).join('')}</tr>`).join('')}</table></div></div>`;
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
      <div class="card">${list.map(e => `<${mayEdit(e) ? `button class="it" data-bzedit="${e.id}"` : 'div class="it"'}><span class="t"><b>${esc(e.what || e.cat)}</b><small>${[nice(e.date), e.cat, e.to, e.method, e.by ? 'by ' + first(e.by) : ''].filter(Boolean).map(esc).join(' · ')}</small></span>${e.rep === 'm' ? '<span class="tag bl">Monthly</span>' : ''}<b class="bz-amt">${mk(num(e.amount))}</b></${mayEdit(e) ? 'button' : 'div'}>`).join('') || `<p class="empty">No spending recorded for ${period.startsWith('fy') ? 'this year' : monthName(period)}${catF ? ' in ' + esc(catF) : ''}.</p>`}</div>
      ${present.length ? `<div class="card pad"><div class="cap bz-cap">By category <b>${mk(f.exp)}</b></div>${Object.entries(f.byCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="bz-hb"><span>${esc(c)}</span><span class="tr"><i style="width:${v / max * 100}%"></i></span><b>${mkShort(v)}</b></div>`).join('')}</div>` : ''}
      <button class="btn sm" data-bzcsv="${period}">${ic('box',15)} Download as a spreadsheet (CSV)</button>`;
  }

  /* ---------- budgets ---------- */
  function budgetView(period){
    const ms = months(period), f = figures(ms), B = budget(), C = cats(), isY = period.startsWith('fy');
    const tot = Object.values(B).reduce((a, v) => a + num(v), 0) * ms.length;
    const row = (c, s, b, link = true) => { const p = b ? s / b : 0, exact = b && Math.abs(p - 1) < .005, col = !b ? 'var(--muted)' : exact ? 'var(--ok)' : p > 1 ? 'var(--rd)' : p > .8 ? 'var(--gold)' : 'var(--ok)';
      return `<${link ? `a href="#biz/spending/${period}/${encodeURIComponent(c)}"` : 'div'} class="bz-bud"><div class="h"><b>${esc(c)}${ONEOFF.includes(c) ? ' <span class="tag gr">one-off</span>' : ''}</b><span>${mkShort(s)} of ${b ? mkShort(b) : 'no budget'}${exact ? ' <span class="tag ok">on budget</span>' : b && p > 1 ? ' <span class="tag rd">over</span>' : b && p > .8 ? ' <span class="tag am">80%+</span>' : ''}</span></div><div class="track"><i style="width:${b ? Math.min(100, p * 100) : 0}%;background:${col}"></i></div></${link ? 'a' : 'div'}>`; };
    const extra = Object.keys(f.byCat).filter(c => !C.includes(c));
    return `<p class="note" style="margin:-4px 0 12px">${isY ? `Spending in ${ms.length} month${ms.length === 1 ? '' : 's'} against ${ms.length} month${ms.length === 1 ? '' : 's'} of budget.` : `${monthName(period)}: spending against the monthly budget.`} Budgets repeat every month until they are changed.</p>
    ${Object.keys(B).length ? `<div class="card pad">${[...C, ...extra].map(c => row(c, f.byCat[c] || 0, num(B[c]) * ms.length)).join('')}</div>
      <div class="card pad"><div class="cap">Total</div>${row('All spending', f.exp, tot, false)}${isY ? '' : `<p class="note">${f.exp <= tot ? `${mk(tot - f.exp)} of this month's budget is left.` : `${mk(f.exp - tot)} over this month's budget.`}</p>`}</div>`
    : `<div class="card pad"><p class="empty" style="margin:0">No budgets yet.${isDir() ? ' Set a monthly amount for each category, then spending is measured against it here and in Profit & loss.' : ' The Director sets them.'}</p></div>`}
    ${isDir() ? `<button class="btn" data-bzbud>${ic('edit',16)} ${Object.keys(B).length ? 'Change budgets' : 'Set budgets'}</button>` : ''}`;
  }

  /* ---------- the page ---------- */
  function page(tab, period, cat){
    const T = tabsFor();
    if(!T.length) return `<div class="ph"><div class="tt"><h1>Business</h1></div></div><p class="empty">The Director hasn't given you access to Business.</p>`;
    if(!T.some(x => x[0] === tab)) tab = T[0][0];
    if(!period || !(/^\d{4}-\d{2}$/.test(period) || /^fy\d{4}$/.test(period))) period = thisMonth();
    const fy = period.startsWith('fy') ? +period.slice(2) : fyOf(period);
    return `<div class="ph"><div class="tt"><h1>Business</h1><p>Financial year ${fyLabel(fy)}${isDir() ? '' : ' · shared with you by the Director'}</p></div>${can('spend') ? `<button class="btn n" data-bznew>${ic('plus',16,2.4)} Record spending</button>` : ''}</div>
      <div class="tabs">${T.map(([k, l]) => `<a class="${tab === k ? 'on' : ''}" href="#biz/${k}/${period}">${l}</a>`).join('')}</div>
      ${periodBar(tab, period)}
      ${tab === 'pl' ? plView(period) : tab === 'budgets' ? budgetView(period) : spendingView(period, cat)}
      ${isDir() ? `<p class="note" style="margin-top:18px">Plans, projections and expansion come next. Who else sees Business: Settings › People & access › the admin's page.</p>` : ''}`;
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
      <label class="f"><span>Category</span></label><div class="chips" id="bzCats">${C.map(c => `<button class="chip ${e.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="r2"><label class="f"><span>Amount (MKW)</span><input class="in" id="bzAmt" inputmode="numeric" value="${e.amount ? Number(e.amount).toLocaleString('en-US') : ''}" placeholder="0"></label><label class="f"><span>Date</span><input class="in" id="bzDate" type="date" value="${esc(e.date)}"></label></div>
      <label class="f"><span>What for</span><input class="in" id="bzWhat" value="${esc(e.what)}" placeholder="e.g. Printing SRA sheets" autocomplete="off"></label>
      <label class="f"><span>Paid to (optional)</span><input class="in" id="bzTo" value="${esc(e.to || '')}" placeholder="e.g. ESCOM, landlord, printer" autocomplete="off"></label>
      <div class="r2"><label class="f"><span>Paid by</span><select class="in" id="bzMethod"><option value="">Choose</option>${methods().map(m => `<option ${e.method === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
        <label class="f"><span>Repeats</span><select class="in" id="bzRep"><option value="">Once</option><option value="m" ${e.rep === 'm' ? 'selected' : ''}>Every month</option></select></label></div>
      <button class="btn n full" id="bzSave">Save</button>${isNew ? '' : `<button class="btn rd full" id="bzDel">${ic('bin',16)} Delete</button>`}`);
    document.querySelectorAll('#bzCats .chip').forEach(b => b.onclick = () => { document.querySelectorAll('#bzCats .chip').forEach(x => x.classList.toggle('on', x === b)); });
    $('bzAmt').oninput = ev => { const d = ev.target.value.replace(/[^\d]/g, ''); ev.target.value = d ? Number(d).toLocaleString('en-US') : ''; };
    document.querySelectorAll('#sheet [data-close]').forEach(b => b.onclick = closeSheet);
    $('bzSave').onclick = () => {
      const c = (document.querySelector('#bzCats .chip.on') || {}).dataset, amt = num($('bzAmt').value);
      if(!c){ toast('Choose a category'); return; }
      if(!amt){ toast('Enter the amount'); $('bzAmt').focus(); return; }
      if(!$('bzDate').value){ toast('Choose the date'); return; }
      Object.assign(e, {cat:c.c, amount:amt, date:$('bzDate').value, what:$('bzWhat').value.trim(), to:$('bzTo').value.trim(), method:$('bzMethod').value, rep:$('bzRep').value});
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
    a.download = `LHQ-spending_${period.startsWith('fy') ? fyLabel(+period.slice(2)).replace(/ /g, '') : period}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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

  return {page, bind, cardProfit, cardSpend, figures, due, months, fyOf, thisMonth};
})();
