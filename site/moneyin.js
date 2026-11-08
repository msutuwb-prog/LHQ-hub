/* LHQ Hub › Business › Money in, for any period: a day, a week, a month, a quarter or a school term (or holiday),
   a half-year or the financial year (1 September – 31 August).
   Tuition comes from receipts (a payment is split across its invoice's subjects, as in INS.facts); other money in
   from Record money in. Each section is a card chosen with the pencil (PC, page 'money').
   Period keys in the address: dYYYY-MM-DD day · wYYYY-MM-DD week (Monday) · YYYY-MM month · qFY-N quarter ·
   tYYYY-MM-DD school term or holiday (its first day) · hFY-N half-year · fyFY year (FY = the year it starts). */
window.MIN = (function(){
  /* ---------- dates, as 'YYYY-MM-DD' in UTC so nothing shifts ---------- */
  const D = s => new Date(s + 'T00:00:00Z'), iso = d => d.toISOString().slice(0, 10);
  const add = (s, n) => iso(new Date(D(s).getTime() + n * 864e5)), diff = (a, b) => Math.round((D(b) - D(a)) / 864e5), wd = s => D(s).getUTCDay();
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'], M3 = MON.map(m => m.slice(0, 3)), W3 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayL = s => `${W3[wd(s)]} ${+s.slice(8)} ${M3[+s.slice(5, 7) - 1]}`, dayLY = s => dayL(s) + ' ' + s.slice(0, 4), dm = s => `${+s.slice(8)} ${M3[+s.slice(5, 7) - 1]}`;
  const monS = s => M3[+s.slice(5, 7) - 1], monL = s => MON[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
  const monStart = s => s.slice(0, 7) + '-01', monEnd = s => iso(new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7), 0)));
  const addMon = (s, n) => { const d = D(monStart(s)); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
  const weekStart = s => add(s, -((wd(s) + 6) % 7));
  const fyStart = s => { const y = +s.slice(0, 4); return (+s.slice(5, 7) >= 9 ? y : y - 1) + '-09-01'; };
  const fyName = s => { const y = +fyStart(s).slice(0, 4); return `${y}/${String(y + 1).slice(2)}`; };
  const T = () => today();

  /* ---------- school terms (Settings › School terms); holidays are the gaps between them ---------- */
  const DEFAULT_TERMS = [['Term 1','2024-09-02','2024-12-13'],['Term 2','2025-01-13','2025-04-04'],['Term 3','2025-04-22','2025-07-04'],
    ['Term 1','2025-09-01','2025-12-12'],['Term 2','2026-01-12','2026-04-03'],['Term 3','2026-04-20','2026-07-03'],['Term 1','2026-09-01','2026-12-11'],['Term 2','2027-01-11','2027-04-02'],['Term 3','2027-04-19','2027-07-02']];
  const terms = () => { const L = settingsKV().terms; return (Array.isArray(L) && L.length ? L : DEFAULT_TERMS).filter(t => t && t[1] && t[2] && t[1] <= t[2]).slice().sort((a, b) => a[1].localeCompare(b[1])); };
  const holName = s => { const m = +s.slice(5, 7); return m === 12 || m === 1 ? 'Christmas holiday' : m >= 3 && m <= 5 ? 'Easter holiday' : m >= 6 && m <= 8 ? 'Summer holiday' : 'Holiday'; };
  let calMemo = {};
  function CAL(){
    const L = terms(), k = JSON.stringify(L); if(calMemo.k === k) return calMemo.c;
    const c = []; L.forEach((t, i) => { c.push([t[0], t[1], t[2]]); const n = L[i + 1]; if(n && diff(t[2], n[1]) > 1) c.push([holName(add(t[2], 1)), add(t[2], 1), add(n[1], -1)]);
      else if(!n && +t[2].slice(5, 7) >= 6 && +t[2].slice(5, 7) <= 8){ const e = t[2].slice(0, 4) + '-08-31'; if(diff(t[2], e) > 1) c.push([holName(add(t[2], 1)), add(t[2], 1), e]); } });
    calMemo = {k, c}; return c;
  }
  const isHol = n => /holiday/i.test(n || '');

  /* ---------- periods ---------- */
  const TYPES = [['day','Day'],['week','Week'],['month','Month'],['q','Quarter'],['half','Half-year'],['year','Year']];
  function periodOf(type, d){
    if(type === 'day') return {type, start:d, end:d};
    if(type === 'week'){ const s = weekStart(d); return {type, start:s, end:add(s, 6)}; }
    if(type === 'month') return {type, start:monStart(d), end:monEnd(d)};
    if(type === 'q'){ const f = fyStart(d), k = Math.floor(((+d.slice(5, 7) + 3) % 12) / 3), s = addMon(f, k * 3); return {type, start:s, end:monEnd(addMon(s, 2)), n:k + 1}; }
    if(type === 'half'){ const f = fyStart(d), k = ((+d.slice(5, 7) + 3) % 12) < 6 ? 0 : 1, s = addMon(f, k * 6); return {type, start:s, end:monEnd(addMon(s, 5)), n:k + 1}; }
    if(type === 'term'){ const C = CAL(); if(!C.length) return periodOf('q', d); let i = C.findIndex(c => c[1] <= d && c[2] >= d); if(i < 0){ i = C.findIndex(c => c[1] > d); if(i < 0) i = C.length - 1; } return {type, start:C[i][1], end:C[i][2], i, name:C[i][0]}; }
    const f = fyStart(d); return {type:'year', start:f, end:monEnd(addMon(f, 11))};
  }
  function key(p){
    const fy = () => fyStart(p.start).slice(0, 4);
    return p.type === 'day' ? 'd' + p.start : p.type === 'week' ? 'w' + p.start : p.type === 'month' ? p.start.slice(0, 7) : p.type === 'q' ? `q${fy()}-${p.n}` : p.type === 'half' ? `h${fy()}-${p.n}` : p.type === 'term' ? 't' + p.start : 'fy' + fy();
  }
  function parse(k){
    k = String(k || ''); let m;
    if((m = k.match(/^d(\d{4}-\d{2}-\d{2})$/))) return periodOf('day', m[1]);
    if((m = k.match(/^w(\d{4}-\d{2}-\d{2})$/))) return periodOf('week', m[1]);
    if((m = k.match(/^(\d{4}-\d{2})$/))) return periodOf('month', m[1] + '-01');
    if((m = k.match(/^q(\d{4})-([1-4])$/))) return periodOf('q', addMon(m[1] + '-09-01', (m[2] - 1) * 3));
    if((m = k.match(/^h(\d{4})-([12])$/))) return periodOf('half', addMon(m[1] + '-09-01', (m[2] - 1) * 6));
    if((m = k.match(/^t(\d{4}-\d{2}-\d{2})$/))) return periodOf('term', m[1]);
    if((m = k.match(/^fy(\d{4})$/))) return periodOf('year', m[1] + '-09-01');
    return null;
  }
  const ok = k => !!parse(k);
  function shift(p, n){
    if(p.type === 'day') return periodOf('day', add(p.start, n));
    if(p.type === 'week') return periodOf('week', add(p.start, 7 * n));
    if(p.type === 'month') return periodOf('month', addMon(p.start, n));
    if(p.type === 'q') return periodOf('q', addMon(p.start, 3 * n));
    if(p.type === 'half') return periodOf('half', addMon(p.start, 6 * n));
    if(p.type === 'term'){ const C = CAL(), c = C[p.i + n]; return c ? periodOf('term', c[1]) : null; }
    return periodOf('year', addMon(p.start, 12 * n));
  }
  /* a day compares with the same weekday a week before; a term with the term before (a holiday with the holiday before) */
  function before(p){
    if(p.type === 'day') return periodOf('day', add(p.start, -7));
    if(p.type === 'term'){ const C = CAL(); for(let j = p.i - 1; j >= 0; j--) if(isHol(C[j][0]) === isHol(p.name)) return periodOf('term', C[j][1]); return null; }
    return shift(p, -1);
  }
  function lastYear(p){
    if(p.type === 'day') return null;
    if(p.type === 'week') return periodOf('week', add(p.start, -364));
    if(p.type === 'term'){ const t = add(p.start, -365), c = CAL().find(c => c[0] === p.name && Math.abs(diff(c[1], t)) <= 60); return c ? periodOf('term', c[1]) : null; }
    return shift(p, p.type === 'month' ? -12 : p.type === 'q' ? -4 : p.type === 'half' ? -2 : -1);
  }
  const live = p => p.start <= T() && p.end >= T();
  const endOf = p => p.end < T() ? p.end : T();
  /* a comparison with an unfinished period stops at the same point ("by this Tuesday last week") */
  const cut = (c, p) => { if(!c || (first() && c.end < first())) return null; if(!live(p)) return c; return Object.assign({}, c, {end: add(c.start, Math.min(diff(p.start, T()), diff(c.start, c.end)))}); };
  function label(p, short){
    const now = live(p) && p.type !== 'day' ? ' · to date' : '';
    if(p.type === 'day') return short ? dayL(p.start) : dayLY(p.start) + (p.start === T() ? ' · today' : '');
    if(p.type === 'week') return short ? 'Week of ' + dm(p.start) : `Week of ${dayL(p.start)} ${p.start.slice(0, 4)}` + (live(p) ? ' · this week' : '');
    if(p.type === 'month') return short ? `${monS(p.start)} ${p.start.slice(0, 4)}` : monL(p.start) + now;
    if(p.type === 'q') return short ? `Q${p.n} ${fyName(p.start)}` : `Q${p.n} · ${monS(p.start)} – ${monS(p.end)} ${p.end.slice(0, 4)}` + now;
    if(p.type === 'term') return short ? `${p.name} ${p.start.slice(0, 4)}` : `${p.name} · ${dm(p.start)}${p.start.slice(0, 4) !== p.end.slice(0, 4) ? ' ' + p.start.slice(0, 4) : ''} – ${dm(p.end)} ${p.end.slice(0, 4)}` + now;
    if(p.type === 'half') return short ? `${p.n === 1 ? 'First' : 'Second'} half ${fyName(p.start)}` : `${p.n === 1 ? 'First' : 'Second'} half · ${monS(p.start)} ${p.start.slice(0, 4)} – ${monS(p.end)} ${p.end.slice(0, 4)}` + now;
    return short ? fyName(p.start) : `September ${p.start.slice(0, 4)} – August ${p.end.slice(0, 4)}` + now;
  }
  const word = p => p.type === 'term' ? (isHol(p.name) ? 'holiday' : 'term') : p.type === 'q' ? 'quarter' : p.type === 'half' ? 'half-year' : p.type;
  const compL = (c, p) => !c ? '' : c.type === 'day' ? dayL(c.start) : c.type === 'week' ? 'week of ' + dm(c.start) : c.type === 'month' ? MON[+c.start.slice(5, 7) - 1] + (c.start.slice(0, 4) !== p.start.slice(0, 4) ? ' ' + c.start.slice(0, 4) : '') : label(c, true);
  /* the Business period the other sections understand */
  const std = k => { if(BIZ.isM(k) || BIZ.isQ(k) || BIZ.isY(k)) return k; const p = parse(k); return p ? (p.type === 'half' ? BIZ.qOf(p.start.slice(0, 7)) : p.start.slice(0, 7)) : BIZ.thisMonth(); };

  /* ---------- the records ---------- */
  const UP = s => String(s || '').trim().toUpperCase();
  let memo = {};
  function data(){
    const F = INS.facts(); if(memo.F === F) return memo;
    const pays = F.rcts.filter(r => num(r.received) > 0 && r.date).map(r => { const inv = F.invByNo.get(UP(r.ref)), w = inv || r, nm = w.student || w.name || 'Unknown';
      let part = ''; if(inv){ const tot = HD.total(inv), prev = num(r.prevPaid); part = prev > 0.5 ? (prev + num(r.received) >= tot - 0.5 ? 'balance' : 'part') : num(r.received) >= tot - 0.5 ? 'in full' : 'part'; }
      return {d: r.date.slice(0, 10), a: num(r.received), r, k: sk(nm), name: nm, part}; }).sort((a, b) => a.d.localeCompare(b.d));
    const firstPay = {}; pays.forEach(x => { if(!firstPay[x.k]) firstPay[x.k] = x.d; });
    const rows = F.rows.filter(r => r.date).map(r => Object.assign({}, r, {d: r.date.slice(0, 10)}));
    const order = {}; DIMS.forEach(([dd]) => { if(dd === 'nr') return; const g = {}; rows.forEach(r => g[r[dd]] = (g[r[dd]] || 0) + r.amt); order[dd] = Object.entries(g).sort((a, b) => b[1] - a[1]).map(x => x[0]); });
    order.nr = ['Returning', 'New'];
    memo = {F, pays, rows, firstPay, order, first: pays[0] ? pays[0].d : null}; return memo;
  }
  const first = () => data().first;
  const inP = (x, p) => x.d >= p.start && x.d <= endOf(p);
  const paysIn = p => data().pays.filter(x => inP(x, p));
  const rowsIn = p => data().rows.filter(x => inP(x, p));
  const otherIn = p => BIZ.incomeLive().filter(e => e.date && e.date >= p.start && e.date <= endOf(p)).sort((a, b) => b.date.localeCompare(a.date));
  const sum = (L, f) => L.reduce((t, x) => t + (f ? f(x) : x.a), 0);
  const DIMS = [['prog','Programme'],['sub','Subject'],['level','Level'],['tutor','Tutor'],['school','School'],['nr','New or returning']];
  const dimOf = (r, dd, p) => dd === 'nr' ? (data().firstPay[r.stu] >= p.start ? 'New' : 'Returning') : r[dd];
  function groups(p, dd){ const g = {}; rowsIn(p).forEach(r => { const k = dimOf(r, dd, p), y = g[k] = g[k] || {k, a:0, stu:new Set()}; y.a += r.amt; y.stu.add(r.stu); }); return Object.values(g).sort((a, b) => b.a - a.a); }
  const COLS = ['var(--inc)','#1a74b0','#2c7a4b','#a85a14','#7a3f8f','#9aa3b2'];
  const colOf = (k, dd) => k === 'New' && dd === 'nr' ? 'var(--gold)' : k === 'Others' ? COLS[5] : COLS[Math.min(Math.max(0, (data().order[dd] || []).indexOf(k)), 4)];
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const arrow = (a, b) => b == null ? '' : !b ? (a ? '<span class="up">▲ new</span>' : '<span class="fl">no change</span>') : Math.round(a) === Math.round(b) ? '<span class="fl">no change</span>' : `<span class="${a > b ? 'up' : 'dn'}">${a > b ? '▲' : '▼'} ${a > b && a >= b * 10 ? (a / b).toFixed(0) + '×' : Math.abs(pct(a, b)) + '%'}</span>`;
  const short = n => mkShort(n).replace('MKW ', '');

  /* ---------- this device's choices ---------- */
  const LS = (k, v) => { try{ if(v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){} return null; };
  const st = {dim: LS('lhq_mi_dim') || 'prog', ct: LS('lhq_mi_ct') || 'bars', qm: LS('lhq_mi_qm') || 'q', more: false};
  if(!DIMS.some(x => x[0] === st.dim)) st.dim = 'prog';
  const dimName = () => DIMS.find(x => x[0] === st.dim)[1];
  const go = p => { if(p) location.hash = '#biz/money/' + key(p); };

  /* ---------- the period bar ---------- */
  function bar(k){
    const p = parse(k) || periodOf('month', T()), tk = p.type === 'term' ? 'q' : p.type, prev = shift(p, -1), next = shift(p, 1);
    const prevOK = prev && (!first() || prev.end >= first()), nextOK = next && next.start <= T();
    return `<div class="bz-per mi-per"><div class="seg mi-types" role="tablist" aria-label="Period">${TYPES.map(([t, l]) => `<button role="tab" aria-selected="${tk === t}" class="${tk === t ? 'on' : ''}" data-mi="type" data-v="${t}">${t === 'q' && (p.type === 'term' || (p.type !== 'q' && st.qm === 'term')) ? 'Term' : l}</button>`).join('')}</div>
      <div class="bz-nav"><button class="ib" data-mi="go" data-v="${prevOK ? key(prev) : ''}" ${prevOK ? '' : 'disabled'} aria-label="Earlier">${ic('back',16,2.2)}</button>
        <button class="mi-pick" data-mi="pick" aria-haspopup="dialog">${esc(label(p, true))} ▾</button>
        <button class="ib" data-mi="go" data-v="${nextOK ? key(next) : ''}" ${nextOK ? '' : 'disabled'} aria-label="Later">${ic('chev',16,2.2)}</button></div></div>
      ${tk === 'q' || !live(p) ? `<div class="mi-sub">${tk === 'q' ? `<div class="seg sm"><button class="${p.type === 'q' ? 'on' : ''}" data-mi="qm" data-v="q">Quarters</button><button class="${p.type === 'term' ? 'on' : ''}" data-mi="qm" data-v="term">Terms</button></div>` : ''}${live(p) ? '' : `<button class="mi-lk" data-mi="go" data-v="${key(periodOf(p.type, T()))}">${p.type === 'day' ? 'Today' : 'This ' + word(p)}</button>`}</div>` : ''}`;
  }

  /* ---------- the sections ---------- */
  function ctx(k){
    const p = parse(k) || periodOf('month', T()), bF = before(p), b = cut(bF, p), yF = lastYear(p), y = cut(yF, p);
    const L = paysIn(p), Tt = sum(L), Lb = b ? paysIn(b) : [];
    return {p, bF, b, yF, y, L, T: Tt, Tb: sum(Lb), Ty: y ? sum(paysIn(y)) : 0};
  }
  const secs = {};
  secs.total = c => { const {p, b, bF, y, yF, L, T: Tt, Tb, Ty} = c, O = otherIn(p), nStu = new Set(L.map(x => x.k)).size, so = live(p) && p.type !== 'day';
    const tile = (a, lbl, val) => `<button class="kpi mi-kpi" data-mi="${a}"><small>${lbl}</small><b>${val}</b></button>`;
    return `<section class="card pad mi-hero"><div class="cap">Tuition received${so ? ' · so far' : ''}</div><div class="mi-big">${mk(Tt)}</div>
      <div class="mi-cmp">${b ? `<button data-mi="go" data-v="${key(bF)}">${arrow(Tt, Tb)} vs ${esc(compL(b, p))} <small>(${mkShort(Tb)})</small> ›</button>` : ''}
        ${y ? `<button data-mi="go" data-v="${key(yF)}">${arrow(Tt, Ty)} vs same ${word(p)} last year <small>(${mkShort(Ty)})</small> ›</button>` : ''}</div>
      <div class="mi-trio">${tile('receipts', 'Payments', L.length)}${tile('students', 'Students', nStu)}${tile('other', 'Other money in', short(sum(O, e => num(e.amount))))}</div></section>`; };
  secs.payments = c => { const {p, L, T: Tt} = c, few = !['day','week'].includes(p.type), R = L.slice().reverse(), shown = few ? R.slice(0, 6) : R;
    const days = {}; shown.forEach(x => (days[x.d] = days[x.d] || []).push(x));
    return `<section class="card mi-cash" id="miCash"><div class="mi-wk"><span>${L.length} payment${L.length === 1 ? '' : 's'}${few && L.length > 6 ? ' · latest' : ''}</span><span>${mk(Tt)}</span></div>
      ${Object.entries(days).map(([d, X]) => (p.type !== 'day' ? `<button class="mi-wk mi-wkb" data-mi="go" data-v="d${d}"><span>${dayL(d)} ›</span><span>${mk(sum(X))}</span></button>` : '') + X.map(payRow).join('')).join('') || '<p class="empty" style="padding:12px 16px">Nothing came in.</p>'}
      ${few && L.length > 6 ? `<button class="mi-more" data-mi="receipts" data-v="">All ${L.length} ›</button>` : ''}</section>`; };
  const payRow = x => `<a class="it" href="${openLink(x.r)}"><span class="mi-mk">✓</span><span class="t"><b>${esc(x.name)}${x.part ? ' · ' + x.part : ''}</b><small>${[x.r.number, x.r.method].filter(Boolean).map(esc).join(' · ')}</small></span><b class="bz-amt">${mk(x.a)}</b></a>`;
  secs.where = c => { const {p, b, T: Tt} = c, G = groups(p, st.dim), Gb = b ? groups(b, st.dim) : [], pa = k => (Gb.find(g => g.k === k) || {a:0}).a, shown = st.more ? G : G.slice(0, 6);
    return `<section class="card pad"><div class="cap">By ${dimName().toLowerCase()} <button class="mi-capb" data-mi="receipts" data-v="">${mk(Tt)} ›</button></div>
      ${Tt ? `<div class="mi-stack">${G.map(g => `<button data-mi="group" data-v="${esc(g.k)}" style="flex:${g.a};background:${colOf(g.k, st.dim)}" title="${esc(g.k)} · ${mkShort(g.a)}" aria-label="${esc(g.k)}"></button>`).join('')}</div>` : ''}
      <div class="chips mi-dims">${DIMS.map(([k, l]) => `<button class="chip ${st.dim === k ? 'on' : ''}" data-mi="dim" data-v="${k}">${l}</button>`).join('')}</div>
      <div>${shown.map(g => `<button class="mi-sbar" data-mi="group" data-v="${esc(g.k)}"><span><b><i class="mi-dot" style="background:${colOf(g.k, st.dim)}"></i>${esc(g.k)}</b><small>${g.stu.size} student${g.stu.size === 1 ? '' : 's'} · ${Tt ? Math.round(g.a / Tt * 100) : 0}%</small></span><span class="mi-amt">${mkShort(g.a)}<small>${b ? arrow(g.a, pa(g.k)) : ''}</small></span><span class="mi-ch">›</span><span class="mi-tr"><i style="width:${Math.max(2, g.a / G[0].a * 100)}%;background:${colOf(g.k, st.dim)}"></i></span></button>`).join('') || '<p class="empty">No tuition came in.</p>'}
        ${G.length > 6 ? `<button class="mi-more" data-mi="more">${st.more ? 'Fewer' : `${G.length - 6} more`}</button>` : ''}</div></section>`; };
  secs.changed = c => { const {p, b, bF, T: Tt, Tb} = c; if(!b) return `<section class="card pad"><div class="cap">What changed</div><p class="empty">Nothing before this.</p></section>`;
    const G = groups(p, st.dim), Gb = groups(b, st.dim), keys = [...new Set(G.map(g => g.k).concat(Gb.map(g => g.k)))], val = (L, k) => (L.find(g => g.k === k) || {a:0}).a;
    const mv = keys.map(k => ({k, d: val(G, k) - val(Gb, k), was: val(Gb, k)})).filter(x => Math.abs(x.d) >= 1000).sort((x, z) => Math.abs(z.d) - Math.abs(x.d)).slice(0, 5);
    return `<section class="card pad"><div class="cap">Since ${esc(compL(b, p))} <button class="mi-capb" data-mi="go" data-v="${key(bF)}">${Tt >= Tb ? '+ ' : '− '}${mkShort(Math.abs(Tt - Tb))} ›</button></div>
      ${mv.map(x => `<button class="mi-row" data-mi="group" data-v="${esc(x.k)}"><span><span class="${x.d > 0 ? 'up' : 'dn'}">${x.d > 0 ? '▲' : '▼'}</span> ${esc(x.k)}${x.was ? '' : ' · new'}</span><b class="${x.d > 0 ? 'up' : 'dn'}">${x.d > 0 ? '+' : '−'} ${mkShort(Math.abs(x.d))}</b></button>`).join('') || '<p class="empty">No change.</p>'}</section>`; };
  secs.newret = c => { const {p, L, T: Tt} = c, G = groups(p, 'nr'), n = G.find(g => g.k === 'New') || {a:0, stu:new Set()}, r = G.find(g => g.k === 'Returning') || {a:0, stu:new Set()}, nStu = new Set(L.map(x => x.k)).size;
    const early = first() && diff(first(), p.start) < 91;
    return `<section class="card pad"><div class="cap">New or returning</div>
      ${early ? `<p class="note" style="margin:0 0 8px">Records start ${dayLY(first())}.</p>` : `${Tt ? `<div class="mi-stack" style="height:18px;margin:4px 0 8px">${r.a ? `<button data-mi="nr" data-v="Returning" style="flex:${r.a};background:var(--inc)" aria-label="Returning"></button>` : ''}${n.a ? `<button data-mi="nr" data-v="New" style="flex:${n.a};background:var(--gold)" aria-label="New"></button>` : ''}</div>` : ''}
      <button class="mi-row" data-mi="nr" data-v="Returning"><span><i class="mi-dot" style="background:var(--inc)"></i>Returning · ${r.stu.size}</span><b>${mkShort(r.a)}</b></button>
      <button class="mi-row" data-mi="nr" data-v="New"><span><i class="mi-dot" style="background:var(--gold)"></i>New · ${n.stu.size}</span><b>${mkShort(n.a)}</b></button>`}
      <button class="mi-row" data-mi="students" data-v="amount"><span>Average per student</span><b>${mkShort(nStu ? Tt / nStu : 0)}</b></button></section>`; };
  secs.chart = c => `<section class="card pad"><div class="cap mi-ctcap"><span>${chartTitle(c.p)}</span><div class="seg sm mi-ct">${[['bars','<path d="M3 17V9M8 17V4M13 17v-6M18 17V7"/>','Bars'],['run','<path d="M2 17l5-4 4 2 7-10"/>','Running total']].map(([k, d, l]) => `<button class="${st.ct === k ? 'on' : ''}" data-mi="ct" data-v="${k}" aria-label="${l}" title="${l}"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg></button>`).join('')}</div></div>
      <div class="mi-chart" id="miChart">${st.ct === 'run' ? runChart(c.p) : barChart(c.p)}<div class="mi-tip" id="miTip"></div></div>
      ${st.ct === 'run' ? runLegend(c.p) : `<div class="mi-leg">${chartKeys(c.p).map(k => `<button data-mi="${k === 'Others' ? 'more' : 'group'}" data-v="${esc(k)}"><i class="mi-dot" style="background:${colOf(k, st.dim)}"></i>${esc(k)}</button>`).join('')}</div>`}</section>`;
  secs.other = c => { const O = otherIn(c.p), D = live(c.p) ? BIZ.due('lhq_income') : [], tot = sum(O, e => num(e.amount));
    return `<section class="card" id="miOther"><div class="mi-wk"><span>Other money in</span><span>${mk(tot)}</span></div>
      ${D.map(d => `<div class="it"><span class="t"><b>${esc(d.last.cat)}${d.last.from ? ' · ' + esc(d.last.from) : ''}</b><small>${dayL(d.date)} · to confirm</small></span><button class="btn sm n" data-inok="${d.sid}|${d.date}">Received</button></div>`).join('')}
      ${O.map(e => `<${BIZ.mayEdit(e) ? `button class="it" data-inedit="${e.id}"` : 'div class="it"'}><span class="t"><b>${esc(e.cat)}${e.from ? ' · ' + esc(e.from) : ''}</b><small>${[dayL(e.date), e.what].filter(Boolean).map(esc).join(' · ')}</small></span>${BIZ.NOT_INCOME.includes(e.cat) ? '<span class="tag gr">not income</span>' : ''}<b class="bz-amt">${mk(num(e.amount))}</b></${BIZ.mayEdit(e) ? 'button' : 'div'}>`).join('') || (D.length ? '' : '<p class="empty" style="padding:4px 16px 14px">None.</p>')}</section>`; };
  secs.loans = () => { const L = BIZ.loans().filter(x => x.borrowed); if(!L.length) return '';
    return `<section class="card pad"><div class="cap">Loans <b>${mkShort(sum(L, x => x.left))} left</b></div>${L.map(x => `<div class="bz-bud" style="border-top:0"><div class="h"><b>${esc(x.lender)}</b><span>${mkShort(x.repaid)} of ${mkShort(x.borrowed)}</span></div><div class="track"><i style="width:${x.borrowed ? Math.round(x.repaid / x.borrowed * 100) : 0}%;background:var(--ok)"></i></div></div>`).join('')}</section>`; };
  secs.heard = c => { const {p, L} = c, by = {}; L.forEach(x => { const s = data().F.byStu.get(x.k) || {}, h = s.heard || 'Not recorded'; by[h] = by[h] || {k:h, a:0, stu:new Set(), n:0}; by[h].a += x.a; if(!by[h].stu.has(x.k)){ by[h].stu.add(x.k); if(data().firstPay[x.k] >= p.start) by[h].n++; } });
    const G = Object.values(by).sort((a, b) => b.a - a.a);
    return `<section class="card pad"><div class="cap">How they heard</div>${G.map(g => `<button class="mi-row" data-mi="heard" data-v="${esc(g.k)}"><span>${esc(g.k)} · ${g.stu.size}${g.n ? ` <small class="up">${g.n} new</small>` : ''}</span><b>${mkShort(g.a)}</b></button>`).join('') || '<p class="empty">Nobody paid.</p>'}</section>`; };

  /* the cards the pencil chooses from */
  const LIB = {
    total: {t:'Total', ic:'cash', d:'Tuition received, against before and last year'},
    payments: {t:'Payments', ic:'receipt', d:'Each payment, by day'},
    where: {t:'Where it came from', ic:'rep', d:'By programme, subject, level, tutor, school'},
    changed: {t:'What changed', ic:'rep', d:'The biggest rises and falls'},
    newret: {t:'New or returning', ic:'users', d:'First-time payers and the rest'},
    chart: {t:'Chart', ic:'rep', d:'Bars or a running total'},
    heard: {t:'How they heard', ic:'link', d:'Where paying students came from'},
    other: {t:'Other money in', ic:'cash', d:'Rent, grants, refunds, loans received'},
    loans: {t:'Loans', ic:'bank', d:'Left to repay'},
  };
  Object.entries(LIB).forEach(([k, v]) => v.sec = cx => secs[k](cx));
  const DEF = () => ['total','payments','where','changed','newret','chart','other','loans'];

  /* ---------- charts: what's inside the period; tap a bar to open it ---------- */
  function buckets(p){
    const clip = q => ({type:q.type, start:q.start < p.start ? p.start : q.start, end:q.end > p.end ? p.end : q.end}), out = [];
    if(p.type === 'day'){ for(let i = 13; i >= 0; i--){ const d = add(p.start, -i); out.push({p:periodOf('day', d), l:String(+d.slice(8))}); } return out; }
    if(p.type === 'week'){ for(let i = 0; i < 7; i++){ const d = add(p.start, i); out.push({p:periodOf('day', d), l:W3[wd(d)]}); } return out; }
    if(p.type === 'month'){ for(let d = p.start; d <= p.end; d = add(d, 1)) out.push({p:periodOf('day', d), l:+d.slice(8) % 5 === 1 || d === p.end ? String(+d.slice(8)) : ''}); return out; }
    if(p.type === 'q' || p.type === 'term'){ for(let w = weekStart(p.start); w <= p.end; w = add(w, 7)){ const f = periodOf('week', w); out.push({p:f, c:clip(f), l:dm(w < p.start ? p.start : w)}); } return out; }
    for(let m = p.start; m <= p.end; m = addMon(m, 1)) out.push({p:periodOf('month', m), l:monS(m)}); return out;
  }
  const inB = b => b.c || b.p;
  const chartTitle = p => ({day:'Last 14 days', week:'Each day', month:'Each day', q:'Each week', term:'Each week', half:'Each month', year:'Each month'})[p.type] + (st.ct === 'run' ? ' · running total' : ' · by ' + dimName().toLowerCase());
  function chartKeys(p){ const pr = {}; groups({start:p.type === 'day' ? add(p.start, -13) : p.start, end:p.end}, st.dim).forEach(g => pr[g.k] = g.a);
    const ks = Object.keys(pr).sort((a, b) => pr[b] - pr[a]), top = ks.slice(0, 5); return ks.length > 5 ? top.concat('Others') : top; }
  const niceMax = v => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1) / 2))), s = [1, 2, 2.5, 5, 10].map(m => m * e).find(x => x * 2 >= v) || 10 * e; return s * 2; };
  const dims = () => { const n = innerWidth < 600, w = innerWidth >= 1000; return {n, W: n ? 340 : w ? 860 : 560, H: n ? 220 : 210, L: 46, Bt: 24}; };
  function barChart(p){
    const B = buckets(p), keys = chartKeys(p), {n: narrow, W, H, L, Bt} = dims(), cw = (W - L - 6) / B.length, bw = Math.max(2, cw * (B.length > 20 ? .72 : .62));
    const data_ = B.map(b => { const G = groups(inB(b), st.dim), t = sum(G); return {b, t, v: keys.map(k => k === 'Others' ? sum(G.filter(g => !keys.includes(g.k))) : (G.find(g => g.k === k) || {a:0}).a), fut: inB(b).start > T()}; });
    const max = niceMax(Math.max(1, ...data_.map(d => d.t))), y = v => (H - Bt) - v / max * (H - Bt - 10), step = B.length > 16 ? 1 : Math.ceil(B.length / (narrow ? 5 : 8));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chartTitle(p))}">`;
    [0, max / 2, max].forEach(t => { s += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line2)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${t ? short(t) : '0'}</text>`; });
    data_.forEach((d, i) => { const x = L + 3 + i * cw + (cw - bw) / 2, sel = p.type === 'day' && d.b.p.start === p.start; let acc = 0;
      s += `<g class="col${sel ? ' sel' : ''}${d.fut ? ' fut' : ''}" data-i="${i}" ${d.fut ? '' : 'tabindex="0" role="button"'} aria-label="${esc(label(d.b.p, true))}, ${mkShort(d.t)}"><rect x="${L + 3 + i * cw}" y="0" width="${cw}" height="${H - Bt}" fill="transparent"/>`;
      if(d.fut) s += `<rect x="${x}" y="${H - Bt - 2}" width="${bw}" height="2" fill="var(--line)"/>`;
      d.v.forEach((v, j) => { if(!v) return; const y0 = y(acc), y1 = y(acc + v); acc += v; s += `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1 - (j ? 1 : 0))}" fill="${colOf(keys[j], st.dim)}" rx="${bw > 6 ? 2 : 0}"/>`; });
      if(sel) s += `<rect x="${x - 3}" y="${y(d.t) - 4}" width="${bw + 6}" height="${(H - Bt) - y(d.t) + 4}" fill="none" stroke="var(--gold)" stroke-width="2" rx="4"/>`;
      s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${sel ? 'var(--ink)' : 'var(--muted)'}" font-weight="${sel ? 800 : 500}">${i % step === 0 || sel ? esc(d.b.l) : ''}</text></g>`; });
    return s + '</svg>';
  }
  function runData(p){
    const B = buckets(p), W = {start: inB(B[0]).start, end: inB(B[B.length - 1]).end};
    let cmp;
    if(p.type === 'day') cmp = [{w:{start:add(W.start, -14), end:add(W.end, -14)}, l:'14 days before', go:periodOf('day', add(p.start, -14))}, {w:{start:add(W.start, -364), end:add(W.end, -364)}, l:'Same days last year', go:periodOf('day', add(p.start, -364))}];
    else { const b = before(p), y = lastYear(p); cmp = [b && {w:b, l:compL(b, p).replace(/^./, c => c.toUpperCase()), go:b}, y && {w:y, l:'Same ' + word(p) + ' last year', go:y}]; }
    cmp = cmp.map(c => c && (!first() || c.w.end >= first()) ? c : null);
    const P = data().pays, upTo = (w, o) => { const e = add(w.start, o), E = e < w.end ? e : w.end; return sum(P.filter(x => x.d >= w.start && x.d <= E && x.d <= T())); };
    const offs = B.map(b => diff(W.start, inB(b).end));
    return {B, cmp, cur: B.map((b, i) => inB(b).start > T() ? null : upTo(W, offs[i])), lines: cmp.map(c => c ? B.map((b, i) => upTo(c.w, offs[i])) : null)};
  }
  function runChart(p){
    const R = runData(p), n = R.B.length, {n: narrow, W, H, L, Bt} = dims(), cw = (W - L - 6) / n;
    const all = R.cur.filter(v => v != null).concat(...R.lines.filter(Boolean)), max = niceMax(Math.max(1, ...all)), y = v => (H - Bt) - v / max * (H - Bt - 10), x = i => L + 3 + i * cw + cw / 2;
    const path = a => 'M' + (L + 3) + ' ' + y(0) + a.map((v, i) => v == null ? '' : ` L${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(chartTitle(p))}">`;
    [0, max / 2, max].forEach(t => { s += `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line2)"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${t ? short(t) : '0'}</text>`; });
    if(R.lines[1]) s += `<path d="${path(R.lines[1])}" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round"/>`;
    if(R.lines[0]) s += `<path d="${path(R.lines[0])}" fill="none" stroke="var(--muted)" stroke-width="1.6" opacity=".75"/>`;
    const last = R.cur.reduce((a, v, i) => v == null ? a : i, 0);
    s += `<path d="${path(R.cur)} L${x(last)} ${y(0)} Z" fill="var(--inc)" opacity=".08"/><path d="${path(R.cur)}" fill="none" stroke="var(--inc)" stroke-width="2.6" stroke-linejoin="round"/><circle cx="${x(last)}" cy="${y(R.cur[last] || 0)}" r="4.5" fill="var(--inc)" stroke="var(--surface)" stroke-width="2"/>`;
    const step = n > 16 ? 1 : Math.ceil(n / (narrow ? 5 : 8));
    R.B.forEach((b, i) => { const fut = R.cur[i] == null, sel = p.type === 'day' && b.p.start === p.start;
      s += `<g class="col${fut ? ' fut' : ''}${sel ? ' sel' : ''}" data-i="${i}" ${fut ? '' : 'tabindex="0" role="button"'} aria-label="${esc(label(b.p, true))}, ${mkShort(R.cur[i] || 0)} so far"><rect x="${L + 3 + i * cw}" y="0" width="${cw}" height="${H - Bt}" fill="transparent"/>`;
      if(sel) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(R.cur[i])}" y2="${H - Bt}" stroke="var(--gold)" stroke-width="2"/>`;
      s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${sel ? 'var(--ink)' : 'var(--muted)'}" font-weight="${sel ? 800 : 500}">${i % step === 0 || sel ? esc(b.l) : ''}</text></g>`; });
    return s + '</svg>';
  }
  function runLegend(p){
    const R = runData(p), last = R.cur.reduce((a, v, i) => v == null ? a : i, 0), now = R.cur[last] || 0, c0 = R.cmp[0], then = R.lines[0] ? R.lines[0][last] : null;
    const lg = [`<button data-mi="receipts" data-v=""><i class="mi-ln" style="border-color:var(--inc)"></i>${p.type === 'day' ? 'These 14 days' : 'This ' + word(p)} · ${mkShort(now)}</button>`]
      .concat(R.cmp.map((c, j) => c ? `<button data-mi="go" data-v="${key(c.go)}"><i class="mi-ln" style="border-color:var(--muted);${j ? 'border-top-style:dotted' : 'opacity:.75'}"></i>${esc(c.l)} · ${mkShort(R.lines[j][R.lines[j].length - 1])}</button>` : ''));
    const pace = c0 && then != null ? (Math.round(now) === Math.round(then) ? `Level with ${c0.l.toLowerCase()}` : `${now > then ? 'Ahead of' : 'Behind'} ${esc(c0.l.toLowerCase())} by ${mkShort(Math.abs(now - then))}`) : '';
    return `<div class="mi-leg">${lg.join('')}</div>${pace ? `<button class="mi-lk" data-mi="go" data-v="${key(c0.go)}"><span class="${now >= then ? 'up' : 'dn'}">${now >= then ? '▲' : '▼'}</span> ${pace} ›</button>` : ''}`;
  }
  function wireChart(p){
    const box = document.getElementById('miChart'), tip = document.getElementById('miTip'); if(!box) return;
    const B = buckets(p), keys = chartKeys(p), R = st.ct === 'run' ? runData(p) : null;
    const place = g => { tip.style.display = 'block'; const r = box.getBoundingClientRect(), gr = g.getBoundingClientRect(); let left = gr.left - r.left + gr.width / 2 - tip.offsetWidth / 2; tip.style.left = Math.max(0, Math.min(left, r.width - tip.offsetWidth)) + 'px'; };
    box.querySelectorAll('.col:not(.fut)').forEach(g => {
      const i = +g.dataset.i, b = B[i];
      const show = () => {
        if(R) tip.innerHTML = `<b>To ${esc(dayL(inB(b).end > T() ? T() : inB(b).end))}</b><div><span><i class="mi-dot" style="background:var(--inc)"></i>${p.type === 'day' ? 'These days' : 'This ' + word(p)}</span><span>${mkShort(R.cur[i])}</span></div>` + R.cmp.map((c, j) => c ? `<div><span><i class="mi-dot" style="background:var(--muted)"></i>${esc(c.l)}</span><span>${mkShort(R.lines[j][i])}</span></div>` : '').join('');
        else { const G = groups(inB(b), st.dim), t = sum(G), part = b.c && (b.c.start !== b.p.start || b.c.end !== b.p.end);
          tip.innerHTML = `<b>${esc(label(b.p, true))} · ${mkShort(t)}</b>${part ? `<div><span class="note">${dm(b.c.start)} – ${dm(b.c.end)}</span></div>` : ''}` + (t ? keys.map(k => { const v = k === 'Others' ? sum(G.filter(x => !keys.includes(x.k))) : (G.find(x => x.k === k) || {a:0}).a; return v ? `<div><span><i class="mi-dot" style="background:${colOf(k, st.dim)}"></i>${esc(k)}</span><span>${mkShort(v)}</span></div>` : ''; }).join('') : '<div><span>Nothing</span></div>'); }
        place(g); };
      g.addEventListener('mouseenter', show); g.addEventListener('focus', show);
      g.addEventListener('mouseleave', () => tip.style.display = 'none'); g.addEventListener('blur', () => tip.style.display = 'none');
      g.addEventListener('click', () => { tip.style.display = 'none'; go(b.p); });
      g.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(b.p); } });
    });
  }

  /* ---------- sheets ---------- */
  const sheet = (title, sub, body) => openSheet(`<div class="hx"><div><h3>${title}</h3>${sub ? `<p class="note" style="margin:2px 0 0">${sub}</p>` : ''}</div><button class="ib" data-close>✕</button></div>${body}`);
  const kv = (a, v, l, val) => a ? `<button data-mi="${a}" data-v="${esc(v)}"><span>${l}</span><b>${val}</b><i>›</i></button>` : `<div><span>${l}</span><b>${val}</b></div>`;
  const stuName = k => { const s = data().F.byStu.get(k); return s ? s.name : (data().pays.find(x => x.k === k) || {}).name || k; };
  function groupSheet(p, k, dd){
    const bF = before(p), b = cut(bF, p), R = rowsIn(p).filter(r => dimOf(r, dd, p) === k), Rb = b ? rowsIn(b).filter(r => dimOf(r, dd, b) === k) : [];
    const a = sum(R, r => r.amt), ab = sum(Rb, r => r.amt), Tt = sum(paysIn(p)), by = {};
    R.forEach(r => { by[r.stu] = by[r.stu] || {k:r.stu, a:0, n:new Set()}; by[r.stu].a += r.amt; by[r.stu].n.add(r.rid); });
    const list = Object.values(by).sort((x, z) => z.a - x.a), was = new Set(Rb.map(r => r.stu)), gone = [...was].filter(s => !by[s]);
    sheet(esc(k), `${esc(label(p, true))} · ${DIMS.find(x => x[0] === dd)[1].toLowerCase()}`, `<div class="mi-kv">${kv('receipts', dd + '|' + k, 'Received', mkShort(a))}${kv('', '', 'Share', (Tt ? Math.round(a / Tt * 100) : 0) + '%')}${b ? kv('go', key(bF), 'vs ' + esc(compL(b, p)), arrow(a, ab) || '–') : kv('', '', 'Before', '–')}</div>
      <div class="card" style="margin:0 0 12px">${list.map(x => { const nw = b && !was.has(x.k); return `<a class="it" href="${stuLink(x.k)}"><span class="mi-mk${nw ? ' new' : ''}">${nw ? '+' : '✓'}</span><span class="t"><b>${esc(stuName(x.k))}</b><small>${x.n.size} payment${x.n.size === 1 ? '' : 's'}${nw ? ' · new' : ''}</small></span><b class="bz-amt">${mkShort(x.a)}</b></a>`; }).join('') || '<p class="empty" style="padding:10px 16px">Nobody.</p>'}</div>
      ${gone.length ? `<div class="h2">Paid in ${esc(compL(b, p))}, not now <em>${gone.length}</em></div><div class="card" style="margin:0 0 12px">${gone.map(s => `<a class="it" href="${stuLink(s)}"><span class="mi-mk gone"></span><span class="t"><b>${esc(stuName(s))}</b></span></a>`).join('')}</div>` : ''}`);
  }
  function receiptsSheet(p, filter){
    const [dd, k] = filter ? filter.split(/\|(.*)/) : [];
    const ids = k != null ? new Set(rowsIn(p).filter(r => dimOf(r, dd, p) === k).map(r => r.rid)) : null;
    const L = paysIn(p).filter(x => !ids || ids.has(x.r.id)).reverse();
    sheet(`Receipts · ${esc(label(p, true))}`, (k ? esc(k) + ' · ' : '') + `${L.length} · ${mk(sum(L))}`, `<div class="card" style="margin:0">${L.map(x => `<a class="it" href="${openLink(x.r)}"><span class="t"><b>${esc(x.r.number || '')} · ${esc(x.name)}</b><small>${[dayL(x.d), x.part, x.r.method].filter(Boolean).map(esc).join(' · ')}</small></span><b class="bz-amt">${mk(x.a)}</b></a>`).join('') || '<p class="empty" style="padding:10px 16px">None.</p>'}</div>`);
  }
  function studentsSheet(p, order){
    const by = {}; paysIn(p).forEach(x => { by[x.k] = by[x.k] || {k:x.k, name:x.name, a:0, n:0}; by[x.k].a += x.a; by[x.k].n++; });
    const L = Object.values(by).sort(order === 'amount' ? (a, b) => b.a - a.a : (a, b) => a.name.localeCompare(b.name)), Tt = sum(L);
    sheet(`Students · ${esc(label(p, true))}`, `${L.length} · average ${mkShort(L.length ? Tt / L.length : 0)}`, `<div class="seg" style="margin-bottom:10px"><button class="${order === 'amount' ? '' : 'on'}" data-mi="students" data-v="name">A–Z</button><button class="${order === 'amount' ? 'on' : ''}" data-mi="students" data-v="amount">Highest</button></div>
      <div class="card" style="margin:0">${L.map(x => `<a class="it" href="${stuLink(x.k)}"><span class="t"><b>${esc(x.name)}</b><small>${x.n} payment${x.n === 1 ? '' : 's'}</small></span><b class="bz-amt">${mkShort(x.a)}</b></a>`).join('') || '<p class="empty" style="padding:10px 16px">Nobody paid.</p>'}</div>`);
  }
  function heardSheet(p, src){
    const by = {}; paysIn(p).filter(x => ((data().F.byStu.get(x.k) || {}).heard || 'Not recorded') === src).forEach(x => { by[x.k] = by[x.k] || {k:x.k, name:x.name, a:0}; by[x.k].a += x.a; });
    const L = Object.values(by).sort((a, b) => b.a - a.a);
    sheet(esc(src), esc(label(p, true)), `<div class="card" style="margin:0">${L.map(x => { const n = data().firstPay[x.k] >= p.start; return `<a class="it" href="${stuLink(x.k)}"><span class="mi-mk${n ? ' new' : ''}">${n ? '+' : '✓'}</span><span class="t"><b>${esc(x.name)}</b><small>${n ? 'New' : 'Returning'}</small></span><b class="bz-amt">${mkShort(x.a)}</b></a>`; }).join('') || '<p class="empty" style="padding:10px 16px">Nobody.</p>'}</div>`);
  }
  /* the picker: a calendar for days and weeks, a list for the rest, each with its total */
  function pickSheet(p, month){
    const P = data().pays, dayT = d => sum(P.filter(x => x.d === d));
    if(p.type === 'day' || p.type === 'week'){
      const m0 = month || monStart(p.start), rows = []; for(let w = weekStart(m0); w <= monEnd(m0); w = add(w, 7)) rows.push(w);
      const inner = d => { const t = dayT(d); return `<b>${+d.slice(8)}</b><small>${t ? short(t) : ''}</small>`; };
      const cls = d => `mi-cd${d.slice(0, 7) !== m0.slice(0, 7) ? ' out' : ''}${d === p.start && p.type === 'day' ? ' on' : ''}${d > T() ? ' fut' : ''}`;
      const head = `<div class="mi-cal${p.type === 'week' ? ' w8' : ''}">${['M','T','W','T','F','S','S'].map(x => `<span class="mi-dh">${x}</span>`).join('')}${p.type === 'week' ? '<span class="mi-dh">Week</span>' : ''}`;
      const body = rows.map(w => p.type === 'week'
        ? `<button class="mi-wrow${w === p.start ? ' on' : ''}" ${w > T() ? 'disabled' : `data-mi="go" data-v="w${w}"`}>${[0,1,2,3,4,5,6].map(i => `<span class="${cls(add(w, i))}">${inner(add(w, i))}</span>`).join('')}<span class="mi-wt">${short(sum(P.filter(x => x.d >= w && x.d <= add(w, 6))))}</span></button>`
        : [0,1,2,3,4,5,6].map(i => { const d = add(w, i); return `<button class="${cls(d)}" ${d > T() ? 'disabled' : `data-mi="go" data-v="d${d}"`}>${inner(d)}</button>`; }).join('')).join('');
      const pm = addMon(m0, -1), nm = addMon(m0, 1);
      return sheet(p.type === 'day' ? 'Choose a day' : 'Choose a week', '', `<div class="mi-calh"><button class="ib" data-mi="cal" data-v="${pm}" ${first() && monEnd(pm) < first() ? 'disabled' : ''} aria-label="Month before">${ic('back',16,2.2)}</button><b>${monL(m0)}</b><button class="ib" data-mi="cal" data-v="${nm}" ${nm > T() ? 'disabled' : ''} aria-label="Month after">${ic('chev',16,2.2)}</button></div>${head}${body}</div>`);
    }
    const L = []; let q = periodOf(p.type, T()), guard = 0;
    while(q && guard++ < 80 && (!first() ? L.length < 12 : q.end >= first())){ L.push(q); q = shift(q, -1); }
    const byY = {}; L.forEach(x => (byY[fyName(x.start)] = byY[fyName(x.start)] || []).push(x));
    sheet('Choose ' + (p.type === 'term' ? 'a term or holiday' : p.type === 'q' ? 'a quarter' : p.type === 'half' ? 'a half-year' : p.type === 'year' ? 'a year' : 'a month'), '', `<div class="mi-list">${Object.entries(byY).map(([yy, X]) => (p.type === 'year' ? '' : `<div class="mi-gh">${yy}</div>`) + X.map(x => `<button class="${x.start === p.start ? 'on' : ''}" data-mi="go" data-v="${key(x)}"><span>${x.start === p.start ? '✓ ' : ''}${esc(label(x))}</span><span>${mkShort(sum(paysIn(x)))}</span></button>`).join('')).join('')}</div>`);
  }

  /* ---------- the page ---------- */
  let cur = null;
  function view(k){
    const c = ctx(k); cur = c;
    if(window.PC && PC.isEditing('money')) return PC.sections('money', c);
    const L = window.PC ? PC.chosen('money') : DEF();
    return L.map(s => { try{ return secs[s] ? secs[s](c) : ''; }catch(e){ console.error(e); return ''; } }).join('') || '<p class="note">Nothing chosen.</p>';
  }
  function bind(){ if(cur && !(window.PC && PC.isEditing('money'))) wireChart(cur.p); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-mi]'); if(!t || t.disabled || !cur) return;
    const a = t.dataset.mi, v = t.dataset.v, p = cur.p; e.preventDefault();
    if(a === 'go'){ if(v) { closeSheet(); location.hash = '#biz/money/' + v; } return; }
    if(a === 'type'){ const ty = v === 'q' ? (st.qm === 'term' ? 'term' : 'q') : v, at = live(p) ? T() : p.start; return go(periodOf(ty, at > T() ? T() : at)); }
    if(a === 'qm'){ st.qm = v; LS('lhq_mi_qm', v); return go(periodOf(v === 'term' ? 'term' : 'q', live(p) ? T() : p.start)); }
    if(a === 'pick') return pickSheet(p);
    if(a === 'cal') return pickSheet(p, v);
    if(a === 'dim'){ st.dim = v; st.more = false; LS('lhq_mi_dim', v); return render(); }
    if(a === 'ct'){ st.ct = v; LS('lhq_mi_ct', v); return render(); }
    if(a === 'more'){ st.more = !st.more; return render(); }
    if(a === 'group') return groupSheet(p, v, st.dim);
    if(a === 'nr') return groupSheet(p, v, 'nr');
    if(a === 'heard') return heardSheet(p, v);
    if(a === 'students') return studentsSheet(p, v);
    if(a === 'receipts'){ const cash = document.getElementById('miCash'); if(!v && cash && ['day','week'].includes(p.type)){ closeSheet(); return cash.scrollIntoView({behavior:'smooth'}); } return receiptsSheet(p, v); }
    if(a === 'other'){ const o = document.getElementById('miOther'); if(o) return o.scrollIntoView({behavior:'smooth', block:'center'}); return toast('Add "Other money in" with the pencil'); }
  });
  const css = document.createElement('style');
  css.textContent = `.mi-per .seg{margin:0}.mi-per .seg.mi-types{grid-auto-columns:auto}.mi-types button{padding:9px 13px;white-space:nowrap}
@media (max-width:600px){.mi-per .seg.mi-types{display:grid;grid-auto-flow:row;grid-template-columns:repeat(3,minmax(0,1fr));width:100%}.mi-per .bz-nav{max-width:none;margin-left:0}}
.mi-per .bz-nav{flex:1 1 280px;max-width:420px}.mi-pick{flex:1;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 12px;font-weight:800;font-size:14px;color:var(--ink);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mi-pick:hover{background:var(--hover)}
.mi-per .ib:disabled{opacity:.3}.mi-sub{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:-4px 0 14px}.mi-sub .seg{margin:0}.seg.sm button{padding:6px 12px;font-size:13px}
.mi-lk{border:0;background:none;color:var(--brand);font-weight:800;cursor:pointer;padding:6px;font-size:14px;text-align:left}[data-theme=dark] .mi-lk{color:var(--gold)}
.mi-hero .cap,.mi-ctcap{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.mi-big{font-size:32px;font-weight:800;color:var(--brand);line-height:1.1;margin-top:2px;overflow-wrap:anywhere}[data-theme=dark] .mi-big{color:var(--ink)}
.mi-cmp{display:flex;flex-direction:column;align-items:flex-start;gap:2px;margin-top:6px}.mi-cmp button{border:0;background:none;padding:2px 0;font:inherit;font-size:14px;color:var(--muted);cursor:pointer;text-align:left}.mi-cmp button:hover{color:var(--ink)}
.mi-cmp .up,.mi-row .up,.mi-amt .up,.mi-lk .up{color:var(--ok);font-weight:800}.mi-cmp .dn,.mi-row .dn,.mi-amt .dn,.mi-lk .dn{color:var(--rd);font-weight:800}.mi-cmp .fl,.mi-amt .fl{color:var(--muted)}
.mi-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.mi-kpi{text-align:left;cursor:pointer;font:inherit;color:var(--ink)}.mi-kpi:hover{border-color:var(--muted)}.mi-kpi small{display:block;font-size:12px;color:var(--muted);font-weight:700}.mi-kpi b{font-size:18px;overflow-wrap:anywhere}
.mi-capb{border:0;background:none;padding:2px 6px;margin:-2px -6px;border-radius:8px;font-weight:800;font-size:14px;color:var(--ink);cursor:pointer;letter-spacing:0;text-transform:none}.mi-capb:hover{background:var(--hover)}
.card .cap:has(.mi-capb){display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
.mi-stack{display:flex;height:26px;border-radius:10px;overflow:hidden;margin:12px 0;gap:2px;background:var(--line2)}.mi-stack button{border:0;padding:0;cursor:pointer;height:100%;min-width:3px}.mi-stack button:hover{filter:brightness(1.15)}
.mi-dims{margin:0 0 6px}.mi-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:0}
.mi-sbar{display:grid;grid-template-columns:minmax(0,1fr) auto 14px;gap:4px 12px;align-items:center;padding:10px 6px;border:0;border-top:1px solid var(--line2);width:100%;background:none;text-align:left;cursor:pointer;border-radius:10px;font:inherit;color:var(--ink)}
.mi-sbar:first-child{border-top:0}.mi-sbar:hover,.mi-row:hover{background:var(--hover)}.mi-sbar b{display:block}.mi-sbar small{display:block;color:var(--muted);font-size:12.5px}
.mi-amt{text-align:right;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.mi-amt small{display:block;font-size:12px}.mi-ch{grid-row:1/3;grid-column:3;color:var(--muted)}
.mi-tr{grid-column:1/3;height:8px;border-radius:99px;background:var(--line2);overflow:hidden}.mi-tr i{display:block;height:100%;border-radius:99px}
.mi-more{border:0;background:none;color:var(--brand);font-weight:800;padding:10px 6px;cursor:pointer;font:inherit;font-weight:800}[data-theme=dark] .mi-more{color:var(--gold)}.mi-cash .mi-more{padding:10px 16px}
.mi-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 6px;border:0;border-top:1px solid var(--line2);font:inherit;font-size:14px;width:100%;background:none;text-align:left;cursor:pointer;border-radius:10px;color:var(--ink)}.mi-row:first-of-type{border-top:0}.mi-row b{white-space:nowrap}
.mi-wk{display:flex;justify-content:space-between;gap:10px;padding:10px 16px 6px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);border:0;border-top:1px solid var(--line2);width:100%;background:none;font-family:inherit}
.card>.mi-wk:first-child{border-top:0}.mi-wkb{cursor:pointer}.mi-wkb:hover{background:var(--hover);color:var(--ink)}
.mi-mk{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;font-size:11px;font-weight:900;flex:none;background:var(--ok);color:#fff}.mi-mk.new{background:none;border:2px solid var(--gold);color:var(--gold)}.mi-mk.gone{background:none;border:2px solid var(--muted)}
.mi-ctcap{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}.mi-ct{margin:0}.mi-ct button{display:inline-flex;align-items:center;justify-content:center;min-width:40px;padding:5px 10px}
.mi-chart{position:relative}.mi-chart svg{display:block;width:100%;height:auto;max-height:300px}.mi-chart .col{cursor:pointer}.mi-chart .col:hover rect,.mi-chart .col.sel rect{filter:brightness(1.12)}.mi-chart .fut{opacity:.4;cursor:default}
.mi-tip{position:absolute;top:-8px;transform:translateY(-100%);pointer-events:none;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);border-radius:12px;padding:10px 12px;font-size:13px;min-width:180px;z-index:3;display:none}.mi-tip b{display:block;margin-bottom:4px}.mi-tip div{display:flex;justify-content:space-between;gap:12px}
.mi-leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px}.mi-leg button{border:0;background:none;padding:4px 6px;border-radius:8px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink)}.mi-leg button:hover{background:var(--hover)}
.mi-ln{display:inline-block;width:18px;height:0;border-top:3px solid;vertical-align:middle;margin-right:6px}
.mi-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:6px 0 14px}.mi-kv>*{background:var(--surface2);border:1px solid var(--line2);border-radius:12px;padding:10px;text-align:left;position:relative;font:inherit;color:var(--ink);min-width:0}
.mi-kv>button{cursor:pointer}.mi-kv>button:hover{border-color:var(--muted)}.mi-kv span{display:block;font-size:12px;color:var(--muted);font-weight:700;padding-right:12px}.mi-kv b{font-size:16px}.mi-kv i{position:absolute;right:8px;top:8px;font-style:normal}
.mi-kv .up{color:var(--ok)}.mi-kv .dn{color:var(--rd)}.mi-kv .fl{color:var(--muted)}
.mi-list button{border:0;background:none;width:100%;text-align:left;padding:10px 6px;border-top:1px solid var(--line2);display:flex;justify-content:space-between;gap:10px;cursor:pointer;border-radius:10px;font:inherit;font-weight:700;color:var(--ink)}.mi-list button:hover{background:var(--hover)}.mi-list button.on{color:var(--brand)}[data-theme=dark] .mi-list button.on{color:var(--gold)}.mi-list button span:last-child{white-space:nowrap}
.mi-gh{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:12px 6px 4px}
.mi-calh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.mi-calh .ib:disabled{opacity:.3}
.mi-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.mi-cal.w8{grid-template-columns:repeat(7,minmax(0,1fr)) 52px}.mi-dh{text-align:center;font-size:12px;font-weight:800;color:var(--muted);padding:4px 0}
.mi-cd{border:1px solid var(--line2);background:var(--surface);border-radius:10px;padding:6px 1px;min-height:46px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;color:var(--ink);font:inherit;min-width:0}button.mi-cd:hover{background:var(--hover)}
.mi-cd b{font-size:14px}.mi-cd small{font-size:10px;color:var(--ok);font-weight:800}.mi-cd.out{opacity:.45}.mi-cd.fut{opacity:.3;cursor:default}.mi-cd.on{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold)}
.mi-wrow{grid-column:1/-1;display:grid;grid-template-columns:repeat(7,minmax(0,1fr)) 52px;gap:4px;border:0;background:none;padding:2px;border-radius:12px;cursor:pointer;font:inherit}.mi-wrow:hover{background:var(--hover)}.mi-wrow.on{box-shadow:0 0 0 2px var(--gold)}.mi-wrow:disabled{opacity:.35;cursor:default}
.pc-ctl{display:flex;gap:2px;flex:none}.pc-ctl .ib:disabled{opacity:.3}
.mi-wt{align-self:center;font-weight:800;font-size:11.5px;text-align:right;white-space:nowrap;color:var(--ink)}
@media (max-width:520px){.mi-big{font-size:28px}.mi-kpi b{font-size:16px}.mi-kv b{font-size:14px}}`;
  document.head.appendChild(css);
  return {ok, parse, key, label: k => { const p = parse(k); return p ? label(p) : ''; }, bar, view, bind, std, LIB, DEF, terms, DEFAULT_TERMS, CAL, periodOf, before, lastYear, shift};
})();
