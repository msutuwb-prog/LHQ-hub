/* LHQ Hub › cards you choose, on Business, Students, a student's page and Tutors.
   Each page has a library of cards; the pencil adds, removes and reorders them. Each person's choice is saved on
   their account (so it follows them to every device). A card's number opens the page that explains it.
   Uses INS, BIZ, HD and index.html's helpers. */
window.PC = (function(){
  const B = () => window.BIZ, I = () => window.INS;
  const ym = iso => String(iso || '').slice(0, 7);
  const sum = (L, f) => L.reduce((a, x) => a + (f ? f(x) : x), 0);
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const chg = (n, p) => p ? Math.round((n - p) / Math.abs(p) * 100) : null;
  const DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const tr = (p, word, good = 1) => p == null ? '' : `<div class="tr ${p === 0 ? 'fl' : (p > 0) === (good > 0) ? 'up' : 'dn'}">${p > 0 ? '▲' : p < 0 ? '▼' : ''} ${Math.abs(p)}% ${word}</div>`;
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;

  /* ---------- shared facts ---------- */
  const rawLogs = () => Object.values((store.get('lhq_logs', {e:{}}) || {}).e || {}).filter(e => e && !e.x);
  /* sessions a card subject should have had by a date: its days between the period start and that date, up to its total */
  function planned(card, x, until){
    if(!card || !card.periodStart || !(x.days || []).length) return 0;
    const end = card.periodEnd && card.periodEnd < until ? card.periodEnd : until; if(end < card.periodStart) return 0;
    let n = 0; for(let d = card.periodStart; d <= end; d = addDays(d, 1)) if(x.days.includes(DAYC[HD.parseISO(d).getDay()])) n++;
    const cap = parseFloat(x.sessions) || 0; return cap ? Math.min(cap, n) : n;
  }
  const curCards = () => { const t = today(); return HD.students().filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= t)).map(s => ({s, card: s.cur.card || s.lastCard})).filter(x => x.card); };

  /* the period before, over the same stretch while this one is still running (1–28 Oct against 1–28 Sep) */
  function vsBefore(period){
    const b = B(), kind = b.isM(period) ? 'month' : b.isQ(period) ? 'quarter' : 'year', R = PERF.range({kind, at: period});
    return {now: PERF.figs(R.from, R.to), prev: PERF.figs(R.prev.from, R.prev.to), word: R.live ? (kind === 'month' ? 'vs same days last month' : 'vs same stretch before') : 'vs before'};
  }
  /* ---------- the libraries ---------- */
  const LIB = {};
  /* Business: ctx = {period}; each card opens a Business section for the same period */
  LIB.biz = {
    money: {t:'Money in', ic:'cash', need:'pl', d:'Tuition and other money received, against the period before', f:({period}) => { const b = B(), f = b.figures(b.months(period)), V = vsBefore(period);
      return {href:`#biz/money/${period}`, v: mkShort(f.revenue), lines:[[f.other ? `${mkShort(f.inc)} tuition · ${mkShort(f.other)} other` : `${mkShort(f.invoiced)} invoiced`]], tr: tr(chg(V.now.revenue, V.prev.revenue), V.word)}; }},
    spending: {t:'Spending', ic:'box', need:'spend|pl', d:'What was spent, against the budget', f:({period}) => { const b = B(), ms = b.months(period), f = b.figures(ms), V = vsBefore(period), bud = sum(Object.values(b.budget()), num) * ms.length, top = Object.entries(f.byCat).sort((a, c) => c[1] - a[1])[0];
      return {href:`#biz/spending/${period}`, v: mkShort(f.exp), bar: bud && can('pl') ? Math.min(100, pc(f.exp, bud)) : null, lines:[[bud && can('pl') ? `${pc(f.exp, bud)}% of ${mkShort(bud)} budget` : top ? `Most on ${top[0]}` : 'Nothing recorded yet']], tr: can('pl') ? tr(chg(V.now.exp, V.prev.exp), V.word, -1) : ''}; }},
    profit: {t:'Profit', ic:'cash', need:'pl', d:'Money in less spending, and the margin', f:({period}) => { const b = B(), f = b.figures(b.months(period)), V = vsBefore(period);
      return {href:`#biz/pl/${period}`, v: (f.profit < 0 ? '−' : '') + mkShort(Math.abs(f.profit)), lines:[[f.revenue ? `${pc(f.profit, f.revenue)}% margin` : 'No money in yet']], tr: tr(chg(V.now.profit, V.prev.profit), V.word)}; }},
    owed: {t:'Owed to LHQ', ic:'alert', need:'money', d:'Unpaid balances: who, how much, how late', f:() => { const L = I().owedFacts(), late = L.filter(x => x.late > 0);
      return {href:'#biz/owed', v: mkShort(sum(L, x => x.st.balance)), lines:[[plural(L.length, 'invoice') + ' not fully paid'], late.length ? [`${late.length} late · ${mkShort(sum(late, x => x.now))}`, '', 'bad'] : ['Nothing late']]}; }},
    confirm: {t:'Costs to confirm', ic:'clock', need:'spend', d:'Repeating costs (rent, internet, salaries) waiting to be confirmed', f:({period}) => { const D = B().due();
      return {href:`#biz/spending/${period}`, v: String(D.length), lines:[[D.length ? `${mkShort(sum(D, d => num(d.last.amount)))} to confirm` : 'All confirmed'], D[0] ? [`Next: ${D[0].last.cat}`] : null].filter(Boolean)}; }},
    conv: {t:'Quotes → invoices', ic:'quote', need:'pl', d:'How many quotes became invoices in the period', f:({period}) => { const P = I().pipeFigures(B().months(period));
      return {href:`#biz/pipeline/${period}`, v: P.quoted.n ? pc(P.conv.n, P.quoted.n) + '%' : '–', lines:[[`${P.conv.n} of ${plural(P.quoted.n, 'quote')}`], [`${P.waiting.length} waiting now`]]}; }},
    waiting: {t:'Quotes waiting', ic:'quote', need:'pl', d:'Quotes sent with no invoice yet, oldest first', f:() => { const W = HD.students().filter(s => s.openQuote && !s.openQuote.lost).map(s => s.openQuote), old = W.reduce((m, q) => Math.max(m, q.date ? dayDiff(q.date, today()) : 0), 0);
      return {href:`#biz/pipeline`, v: String(W.length), lines:[[`Worth ${mkShort(sum(W, HD.total))}`], old ? [`Oldest: ${old} days`] : null].filter(Boolean)}; }},
    newstu: {t:'New students', ic:'users', need:'pl', d:'Students who joined in the period, and where they heard about LHQ', f:({period}) => { const b = B(), H = I().habits(b.months(period)), V = vsBefore(period), M = I().mkt(b.months(period)), top = M.rows.filter(x => x.n).sort((a, c) => c.n - a.n)[0];
      return {href:`#biz/marketing/${period}`, v: String(H.newStu), lines:[[top ? `Most from ${top.k}` : 'None yet']], tr: tr(chg(V.now.newS.length, V.prev.newS.length), V.word)}; }},
    renewal: {t:'Renewals', ic:'restore', need:'pl', d:'Of the tuition periods that ended, how many were renewed', f:({period}) => { const H = I().habits(B().months(period));
      return {href:`#biz/overview/${period}`, v: H.renewal != null ? H.renewal + '%' : '–', lines:[[H.stay ? `Students stay ${H.stay.toFixed(1)} months on average` : 'No periods ended yet']]}; }},
    sessions: {t:'Sessions taught', ic:'clock', need:'pl', d:'Sessions tutors logged, hours, and missed sessions', f:({period}) => { const S = I().sessFigures(B().months(period));
      return {href:`#biz/sessions/${period}`, v: String(S.taught), lines:[[`${Math.round(S.hours)} hours`], [`${S.missS + S.missT} missed`, '', S.missS + S.missT ? 'warn' : '']]}; }},
    makeups: {t:'Make-ups owed', ic:'clock', need:'pl', d:'Sessions owed to students now', f:() => { const S = I().sessFigures([B().thisMonth()]), n = S.owedCards.filter(c => I().facts() && HD.makeups(c).some(x => x.owed)).length;
      return {href:`#biz/sessions`, v: String(S.owed), lines:[[`for ${plural(n, 'student')}`]]}; }},
    topprog: {t:'Biggest programme', ic:'rep', need:'pl', d:'The programme that brought in the most', f:({period}) => { const ms = B().months(period), rows = I().facts().rows.filter(r => ms.includes(ym(r.date))), g = {}; rows.forEach(r => g[r.prog] = (g[r.prog] || 0) + r.amt); const top = Object.entries(g).sort((a, c) => c[1] - a[1])[0], tot = sum(rows, r => r.amt);
      return {href:`#biz/money/${period}`, v: top ? `<span style="font-size:.78em">${esc(top[0])}</span>` : '–', lines:[[top ? `${mkShort(top[1])} · ${pc(top[1], tot)}% of tuition` : 'No payments yet']]}; }},
    marketing: {t:'Marketing return', ic:'link', need:'pl', d:'The marketing channel that returned the most for its cost', f:({period}) => { const M = I().mkt(B().months(period)), best = M.paid.filter(x => x.spend > 0 && x.n > 0).sort((a, c) => c.ret - a.ret)[0];
      return {href:`#biz/marketing/${period}`, v: best ? best.ret.toFixed(1) + '×' : '–', lines:[[best ? esc(best.k) : 'Record marketing with a channel'], [`${mkShort(M.totalSpend)} spent`]]}; }},
    budget: {t:'Budget used', ic:'bank', need:'pl', d:'Spending against the monthly budgets', f:({period}) => { const b = B(), ms = b.months(period), f = b.figures(ms), bud = sum(Object.values(b.budget()), num) * ms.length, over = Object.entries(b.budget()).filter(([c, v]) => num(v) && (f.byCat[c] || 0) > num(v) * ms.length).length;
      return {href:`#biz/budgets/${period}`, v: bud ? pc(f.exp, bud) + '%' : '–', bar: bud ? Math.min(100, pc(f.exp, bud)) : null, lines:[[bud ? `${mkShort(bud - f.exp)} left` : 'No budgets yet'], over ? [`${plural(over, 'category', 'categories')} over`, '', 'bad'] : null].filter(Boolean)}; }},
    alloc: {t:'Allocations', ic:'bank', need:'pl', d:'What to move into each allocation this month', f:() => { const P = ((store.get('lhq_budget', {}) || {}).pots || {}).list || [], inM = B().figures([B().thisMonth()]).revenue;
      return {href:`#biz/allocations`, v: P.length ? mkShort(inM) : '–', lines:[[P.length ? `to split across ${plural(P.length, 'allocation')}` : 'Not set up yet'], P[0] ? [`${P[0].n}: ${mkShort(inM * P[0].p / 100)}`] : null].filter(Boolean)}; }},
    paytime: {t:'Paying on time', ic:'clock', need:'pl', d:'Days from invoice to payment, and how many pay on time', f:({period}) => { const H = I().habits(B().months(period));
      return {href:`#biz/owed`, v: H.onTime != null ? H.onTime + '%' : '–', lines:[[H.daysToPay != null ? `${H.daysToPay} days to pay on average` : 'Not enough paid yet'], H.late.length ? [`${plural(H.late.length, 'family', 'families')} often late`, '', 'warn'] : null].filter(Boolean)}; }},
    highlights: {t:'Highlights', ic:'rep', need:'pl', d:'The fastest growing subject, best channel and biggest spending rise', f:({period}) => ({href:`#biz/overview/${period}`, v: '<span style="font-size:.7em">See what changed</span>', lines:[['Growing, declining, busiest times']]})},
  };
  const BIZ_SECTIONS = [['overview','Highlights','pl'], ['money','Money in','pl'], ['owed','Owed to LHQ','money'], ['pipeline','Pipeline','pl'], ['sessions','Sessions','pl'], ['spending','Spending','spend|pl'],
    ['budgets','Budgets','pl'], ['allocations','Allocations','pl'], ['marketing','Marketing','pl'], ['charts','Charts','pl'], ['pl','Profit & loss','pl']];
  const DEF = {
    biz: () => can('pl') ? ['money','spending','profit','owed','conv','sessions','makeups','renewal'] : can('spend') ? ['spending','confirm'].concat(can('money') ? ['owed'] : []) : can('money') ? ['owed'] : [],
    students: () => ['active','new','ending'].concat(can('money') ? ['overdue'] : ['waiting']),
    student: () => ['attendance','sessions','makeups'].concat(can('money') ? ['payment'] : ['tests']),
    tutors: () => ['teaching','notutor','logged','quiet'],
  };

  /* Students list */
  LIB.students = {
    active: {t:'Active', ic:'users', d:'Students in a tuition period now', f:() => { const n = curCards().length; return {href:'#students/current', v: String(n), lines:[[`${plural(HD.students().length, 'student')} in total`]]}; }},
    new: {t:'New this month', ic:'plus', d:'Students whose first invoice is this month', f:() => { const m = ym(today()), n = HD.students().filter(s => ym(s.first) === m).length; return {href:'#students/new', v: String(n), lines:[['first invoice this month']]}; }},
    ending: {t:'Ending soon', ic:'clock', d:'Tuition periods ending in the next 7 days', f:() => { const L = HD.students().filter(s => s.status.k === 'ending'); return {href:'#students/ending', v: String(L.length), lines:[[L[0] ? `Next: ${L[0].name}` : 'None this week']]}; }},
    overdue: {t:'Overdue', ic:'alert', need:'money', d:'Students with a late payment', f:() => { const L = HD.students().filter(s => s.status.k === 'over'); return {href:'#students/over', v: String(L.length), lines:[[L.length ? 'payment overdue' : 'Nobody is late']]}; }},
    waiting: {t:'Quote sent', ic:'quote', d:'Families who have a quote and no invoice yet', f:() => { const L = HD.students().filter(s => s.status.k === 'quote'); return {href:'#students/quote', v: String(L.length), lines:[['waiting to start']]}; }},
    ended: {t:'Ended, not renewed', ic:'restore', d:'Students whose period ended with no new one', f:() => { const L = HD.students().filter(s => s.status.k === 'ended'); return {href:'#students/ended', v: String(L.length), lines:[['ask about the next period']]}; }},
    byprog: {t:'By programme', ic:'rep', d:'Students in a period now, by programme', f:() => { const g = {}; curCards().forEach(({s}) => { const p = I().progOf(s.level); g[p] = (g[p] || 0) + 1; }); const top = Object.entries(g).sort((a, c) => c[1] - a[1]);
      return {href:'#students/current', v: top[0] ? String(top[0][1]) : '0', lines: top.slice(0, 3).map(([k, v], i) => [i ? `${k}: ${v}` : k])}; }},
    missing: {t:'Details missing', ic:'edit', d:'Students without how they heard, district or a parent phone', f:() => { const L = HD.students().filter(s => !s.heard || !s.district || !s.phone); return {href:'#students/missing', v: String(L.length), lines:[[L.length ? 'add them so reports are complete' : 'Everyone is complete']]}; }},
  };
  /* A student's page: ctx = {s} (from HD.students()) */
  const stuLogs = s => rawLogs().filter(e => e.k && e.k.split('|')[0] === s.key);
  const inPeriod = (s, e) => { const p = s.cur && s.cur.inv; return !p || !p.periodStart || (e.d >= p.periodStart && e.d <= (p.periodEnd || '9999')); };
  LIB.student = {
    attendance: {t:'Attendance', ic:'users', d:'Sessions attended this tuition period', f:({s}) => { const E = stuLogs(s).filter(e => e.ty === 's' && inPeriod(s, e)), a = E.filter(e => e.a === 'attended' || e.a === 'late').length, held = E.filter(e => e.a !== 'cancelled').length;
      return {href:`#rep/student/${encodeURIComponent(s.key)}`, v: held ? pc(a, held) + '%' : '–', lines:[[`${a} of ${plural(held, 'session')} attended`], E.filter(e => e.a === 'late').length ? [`${E.filter(e => e.a === 'late').length} late`, '', 'warn'] : null].filter(Boolean)}; }},
    sessions: {t:'Sessions', ic:'clock', d:'Sessions logged against those planned so far this period', f:({s}) => { const c = s.cur && s.cur.card, t = today(), pl = c ? sum(c.subjects || [], x => planned(c, x, t)) : 0, done = stuLogs(s).filter(e => e.ty === 's' && inPeriod(s, e) && e.a !== 'cancelled' && e.a !== 'absent').length;
      return {href:`#rep/student/${encodeURIComponent(s.key)}`, v: `${done}<small> of ${pl}</small>`, lines:[[c ? 'planned so far' : 'No tuition card yet']], bar: pl ? Math.min(100, pc(done, pl)) : null}; }},
    makeups: {t:'Make-ups owed', ic:'restore', d:'Sessions owed to this student', f:({s}) => { const c = s.cur && s.cur.card, M = c ? HD.makeups(c).filter(x => x.owed) : [];
      return {href:`#rep/student/${encodeURIComponent(s.key)}`, v: String(sum(M, x => x.owed)), lines: M.length ? M.slice(0, 2).map(x => [`${x.sub}: ${x.owed}`]) : [['Nothing owed']]}; }},
    tests: {t:'Test scores', ic:'rep', d:'Average of topical tests this period, and the latest', f:({s}) => { const T = stuLogs(s).filter(e => e.sc !== '' && e.sc != null && num(e.mx) > 0 && inPeriod(s, e)).sort((a, c) => (a.d || '').localeCompare(c.d || '')), avg = T.length ? Math.round(sum(T, e => num(e.sc) / num(e.mx) * 100) / T.length) : null, last = T[T.length - 1];
      return {href:`#rep/student/${encodeURIComponent(s.key)}`, v: avg != null ? avg + '%' : '–', lines:[[last ? `Latest ${last.sub}: ${pc(num(last.sc), num(last.mx))}%` : 'No tests logged yet']]}; }},
    topics: {t:'Topics covered', ic:'list', d:'Topics tutors logged this period', f:({s}) => { const T = new Set(); stuLogs(s).filter(e => inPeriod(s, e)).forEach(e => (e.tp || []).forEach(x => T.add(e.sub + '|' + x)));
      return {href:`#rep/student/${encodeURIComponent(s.key)}`, v: String(T.size), lines:[['topics logged this period']]}; }},
    payment: {t:'Payment', ic:'cash', need:'money', d:'What is paid and owed on the current invoice', f:({s}) => { const inv = s.cur && s.cur.inv; if(!inv) return {v:'–', lines:[['No invoice yet']]}; const st = HD.invState(inv);
      return {href: openLink(inv), v: st.paidUp ? 'Paid' : mkShort(st.balance), lines:[[st.paidUp ? `${mkShort(st.total)} paid in full` : `owed of ${mkShort(st.total)}`], st.paidUp ? null : [st.text, '', st.over ? 'bad' : '']].filter(Boolean)}; }},
    since: {t:'With LHQ', ic:'user', d:'How long this student has been with LHQ', f:({s}) => { const months = s.first ? Math.max(1, Math.round(dayDiff(s.first, today()) / 30.4)) : 0;
      return {href:`#student/${encodeURIComponent(s.key)}/documents`, v: months ? `${months}<small> month${months === 1 ? '' : 's'}</small>` : '–', lines:[[plural(s.periods.length, 'tuition period')]]}; }},
  };
  /* Tutors */
  LIB.tutors = {
    teaching: {t:'Tutors teaching', ic:'user', d:'Tutors on current tuition cards', f:() => { const T = new Set(); let n = 0; curCards().forEach(({card}) => (card.subjects || []).forEach(x => { if(x.tutor){ T.add(x.tutor); n++; } }));
      return {href:'#tutors', v: String(T.size), lines:[[T.size ? `about ${Math.round(curCards().length / T.size * 10) / 10} students each` : 'None yet']]}; }},
    notutor: {t:'No tutor yet', ic:'alert', d:'Subjects on current cards without a tutor', f:() => { let n = 0; curCards().forEach(({card}) => (card.subjects || []).forEach(x => { if(!x.tutor) n++; }));
      return {href:'#tutors/none', v: String(n), lines:[[n ? 'subjects need a tutor' : 'Every subject has one', '', n ? 'warn' : '']]}; }},
    logged: {t:'Sessions logged', ic:'clock', d:'Sessions logged in the last 7 days, against those planned', f:() => { const t = today(), a = addDays(t, -6), E = rawLogs().filter(e => e.ty === 's' && e.d >= a && e.d <= t), pl = sum(curCards(), ({card}) => sum(card.subjects || [], x => planned(card, x, t) - planned(card, x, addDays(a, -1))));
      return {href:'#rep/tutor', v: `${E.length}<small> of ${pl}</small>`, lines:[['planned in the last 7 days']], bar: pl ? Math.min(100, pc(E.length, pl)) : null}; }},
    quiet: {t:'Not logging', ic:'alert', d:'Tutors with students now but no logs in the last 7 days', f:() => { const t = today(), a = addDays(t, -6), T = new Set(); curCards().forEach(({card}) => (card.subjects || []).forEach(x => x.tutor && T.add(x.tutor)));
      const active = new Set(rawLogs().filter(e => e.d >= a).map(e => (e.tutor || '').toLowerCase())), q = [...T].filter(n => !active.has(n.toLowerCase()));
      return {href:'#rep/tutor', v: String(q.length), lines: q.length ? [[q.slice(0, 2).join(', ') + (q.length > 2 ? ' …' : ''), '', 'warn']] : [['Everyone is logging']]}; }},
    contacts: {t:'Contacts missing', ic:'msg', need:'tutors|msgs', d:'Tutors without a WhatsApp number or email', f:() => { const I0 = settingsKV().tutorInfo || {}, T = new Set(); curCards().forEach(({card}) => (card.subjects || []).forEach(x => x.tutor && T.add(x.tutor)));
      const m = [...T].filter(n => !(I0[n] && (I0[n].phone || I0[n].email))); return {href:'#set/tutorinfo', v: String(m.length), lines:[[m.length ? m.slice(0, 2).join(', ') : 'Everyone can be reached']]}; }},
    makeups: {t:'Make-ups by tutor', ic:'restore', d:'Which tutors owe the most make-up sessions', f:() => { const g = {}; curCards().forEach(({card}) => HD.makeups(card).forEach(x => { if(x.owed && x.tutor) g[x.tutor] = (g[x.tutor] || 0) + x.owed; })); const top = Object.entries(g).sort((a, c) => c[1] - a[1]);
      return {href:'#rep/tutor', v: String(sum(top, x => x[1])), lines: top.length ? top.slice(0, 2).map(([k, v]) => [`${k}: ${v}`]) : [['None owed']]}; }},
  };

  /* ---------- choosing, saving ---------- */
  const okNeed = c => !c.need || c.need.split('|').some(k => can(k));
  function chosen(page){ const m = me().cards || {}, L = Array.isArray(m[page]) ? m[page] : DEF[page](); return L.filter(x => typeof x === 'object' ? x.k === 'chart' && can('pl') : LIB[page][x] && okNeed(LIB[page][x])); }
  async function save(page, list){
    const s = hub.session(); if(s && s.me){ s.me.cards = Object.assign({}, s.me.cards || {}, {[page]: list}); localStorage.setItem('lhq_session', JSON.stringify(s)); }
    render();
    try{ await hub.api('people', {method:'POST', body: JSON.stringify({action:'cards', page, cards: list})}); }catch(e){ toast('Couldn\'t save your cards online. They look like this on this device.'); }
  }
  let editing = '';

  /* ---------- drawing ---------- */
  function cardHTML(page, item, ctx, i, n){
    let def, r;
    if(typeof item === 'object'){ def = {t: item.n || 'Chart', ic:'rep'}; r = chartCard(item); r.href = `#biz/charts/p${i}`; }
    else { def = LIB[page][item]; try{ r = def.f(ctx) || {}; }catch(e){ console.error(e); r = {v:'–', lines:[["Couldn't work this out"]]}; } }
    const ed = editing === page, link = (href, html, cls) => ed || !href ? `<div class="${cls}">${html}</div>` : `<a class="mcl ${cls}" href="${href}">${html}<span class="mca">›</span></a>`;
    const ctl = ed ? `<div class="ctl"><button title="Move earlier" ${i === 0 ? 'disabled' : ''} data-pcmv="${page}:${i}:-1">${ic('back',15,2.2)}</button><button title="Move later" ${i === n - 1 ? 'disabled' : ''} data-pcmv="${page}:${i}:1">${ic('chev',15,2.2)}</button><button class="rm" title="Remove" data-pcrm="${page}:${i}">✕</button></div>` : '';
    return `<div class="mc${ed ? ' ed' : ''}"${!ed && r.href ? ` data-go="${r.href}" role="link" tabindex="0"` : ''} aria-label="${esc(def.t)}">${ctl}<span class="l">${ic(def.ic, 15, 2)}${esc(def.t)}</span>
      ${link(r.href, r.v, 'v')}${r.bar != null ? `<div class="bar"><i style="width:${r.bar}%"></i></div>` : ''}${(r.lines || []).map(([x, h, c]) => link(h || '', esc(x), 's' + (c ? ' ' + c : ''))).join('')}${r.spark || ''}${r.tr || ''}</div>`;
  }
  function chartCard(item){
    try{ const D = I().chartData(Object.assign({n: 12, over: 'm'}, item.c)), s = D.series.slice(0, 3);
      const last = s[0] ? s[0].vals[s[0].vals.length - 1] : 0;
      return {v: s[0] ? (['in','spend','profit'].includes(item.c.m) ? mkShort(last) : String(Math.round(last))) : '–', lines:[[s[0] ? `${s[0].name} · latest` : 'Nothing to show']],
        spark: s.length ? `<div class="pc-spark">${I().lineChart(D.labels, s, {h: 120, fmt: () => '', label: item.n}).replace(/style="min-width:520px"/, '').replace(/<div class="ins-leg">[\s\S]*?<\/div>/, '')}</div>` : ''}; }
    catch(e){ return {v:'–', lines:[['Chart unavailable']]}; }
  }
  /* the cards row for a page, with the pencil */
  function block(page, ctx, title){
    const L = chosen(page), ed = editing === page;
    const lib = Object.entries(LIB[page]).filter(([, c]) => okNeed(c));
    const head = `<div class="h2 pc-h">${title || ''}<button class="btn sm${ed ? ' n' : ''}" data-pcedit="${page}" title="${ed ? 'Done' : 'Choose cards'}" aria-label="${ed ? 'Done' : 'Choose cards'}">${ed ? 'Done' : ic('edit', 15)}</button></div>`;
    const grid = L.length ? `<div class="mcs pc-g">${L.map((x, i) => cardHTML(page, x, ctx, i, L.length)).join('')}</div>` : (ed ? '' : `<p class="note">No cards chosen. Tap the pencil to add some.</p>`);
    const add = ed ? `<div class="h2">Add a card</div><div class="card">${lib.map(([k, c]) => `<div class="it"><span class="ico">${ic(c.ic)}</span><span class="t"><b>${esc(c.t)}</b><small>${esc(c.d)}</small></span>${L.includes(k) ? '<span class="tag ok">Showing</span>' : `<button class="btn sm" data-pcadd="${page}:${k}" ${L.length >= 16 ? 'disabled' : ''}>+ Add</button>`}</div>`).join('')}
      ${page === 'biz' && can('pl') ? `<div class="it"><span class="ico">${ic('rep')}</span><span class="t"><b>A chart of your own</b><small>In Charts, set up a view and tap "Pin as a card".</small></span><a class="btn sm" href="#biz/charts">Charts</a></div>` : ''}</div>
      <p class="note">Only you see your choice, on any device.</p>` : '';
    return head + grid + add;
  }
  function bind(){
    const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(el); });
    on('[data-pcedit]', el => { editing = editing === el.dataset.pcedit ? '' : el.dataset.pcedit; render(); });
    on('[data-pcmv]', el => { const [p, i, d] = el.dataset.pcmv.split(':'), L = chosen(p).slice(), a = +i, b = a + +d; [L[a], L[b]] = [L[b], L[a]]; save(p, L); });
    on('[data-pcrm]', el => { const [p, i] = el.dataset.pcrm.split(':'), L = chosen(p).slice(); L.splice(+i, 1); save(p, L); });
    on('[data-pcadd]', el => { const [p, k] = el.dataset.pcadd.split(':'), L = chosen(p).slice(); if(!L.includes(k)) L.push(k); save(p, L); });
  }
  function pinChart(name, c){ const L = chosen('biz').slice(); if(L.length >= 16){ toast('Remove a card first: 16 at most'); return; } L.push({k:'chart', n: name, c}); save('biz', L); toast('Pinned to Business'); }
  return {block, bind, pinChart, chosen, planned, rawLogs, curCards, LIB, BIZ_SECTIONS, isEditing: p => editing === p};
})();
