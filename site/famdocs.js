/* LHQ Hub › what a parent can download: a progress report for any period (tuition period, term, since joining),
   a statement of account (every invoice and receipt, a running balance, the payment dates and the next payment),
   and a copy of any invoice or receipt. Built from the family data; made into an A4 PDF in the browser. */
window.FDOC = (function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const nice = d => d ? `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '';
  const short = d => d ? `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}` : '';
  const mk = n => 'MWK ' + Math.round(+n || 0).toLocaleString('en-US');
  const avg = L => L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  const lab = (l, x) => !x ? '' : /^[A-Za-z ]{2,14}:/.test(String(x).trim()) ? String(x).trim() : l + String(x).trim();
  const pcs = v => v == null ? '–' : v + '%';
  const akN = k => k === 't' ? 'w' : k === 'k' ? 'p' : (k || 'w');
  const first = n => String(n || '').trim().split(/\s+/)[0];
  const add = (d, n) => window.PAYPLAN ? PAYPLAN.add(d, n) : d;
  const terms = k => (k.terms && k.terms.length ? k.terms : (window.MIN ? MIN.terms() : [])).filter(t => t && t[1] && t[2]).slice().sort((a, b) => a[1].localeCompare(b[1]));

  /* ---------- periods ---------- */
  const PER = [['tp', 'This tuition period'], ['term', 'This term'], ['all', 'Since joining']];
  function range(k, per, t){
    if(per === 'term'){ const T = terms(k), cur = T.find(x => x[1] <= t && x[2] >= t) || T.filter(x => x[1] <= t).pop(); if(cur) return {a: cur[1], b: cur[2], label: cur[0]}; }
    if(per === 'all'){ const H = (k.hist || {}).s || [], a = H.map(x => x[0]).concat(((k.marks || {}).w || []).map(x => x.d)).sort()[0] || t; return {a, b: t, label: 'Since joining'}; }
    const S = k.subjects || [], a = S.map(x => x.pa).filter(Boolean).sort()[0], b = S.map(x => x.b).filter(Boolean).sort().pop();
    return a ? {a, b: b || t, label: 'Tuition period'} : {a: add(t, -90), b: t, label: 'Last 3 months'};
  }
  const rangeL = R => `${short(R.a)} – ${nice(R.b)}`;

  /* ---------- the progress report ---------- */
  function model(k, R, t){
    const end = R.b < t ? R.b : t, inR = d => d >= R.a && d <= end, H = k.hist || {s: [], r: [], c: [], n: []}, M = k.marks || {w: [], r: []};
    const subs = [...new Set((k.subjects || []).map(x => x.sub).concat(H.s.filter(x => inR(x[0])).map(x => x[1])).concat(M.w.filter(x => inR(x.d)).map(x => x.sub)))].sort();
    const S = H.s.filter(x => inR(x[0]) && x[2] !== 'cancelled'), att = x => x[2] === 'attended' || x[2] === 'late';
    const W = M.w.filter(x => inR(x.d)), Rr = (M.r || []).filter(x => inR(x.d) && !x.self), RH = H.r.filter(x => inR(x[0]));
    const per = sub => { const s = S.filter(x => x[1] === sub), w = W.filter(x => x.sub === sub), r = Rr.filter(x => x.sub === sub), rh = RH.filter(x => x[1] === sub);
      const A = r.filter(x => x.a >= 0);
      return {sub, held: s.length, att: s.filter(att).length, wk: avg(w.filter(x => akN(x.ak) === 'w').map(x => x.p)), nW: w.filter(x => akN(x.ak) === 'w').length, mo: avg(w.filter(x => akN(x.ak) === 'm').map(x => x.p)), nM: w.filter(x => akN(x.ak) === 'm').length,
        pp: avg(w.filter(x => akN(x.ak) === 'p').map(x => x.p)), nP: w.filter(x => akN(x.ak) === 'p').length, on: rh.filter(x => x[2] === 'o').length, due: rh.length, ars: avg(A.map(x => x.a)), nA: A.length, nR: r.length,
        trend: (L => L.length > 1 ? L[L.length - 1] - L[0] : null)(w.filter(x => akN(x.ak) === 'w').sort((a, b) => a.d.localeCompare(b.d)).map(x => x.p)),
        topics: [...new Set(s.flatMap(x => x[3] || []))] }; };
    const P = subs.map(per).filter(x => x.held || x.nW || x.nM || x.nP || x.due);
    const A = Rr.filter(x => x.a >= 0);
    return {R, end, P, held: S.length, att: S.filter(att).length, wk: avg(W.filter(x => akN(x.ak) === 'w').map(x => x.p)), nW: W.filter(x => akN(x.ak) === 'w').length,
      mo: avg(W.filter(x => akN(x.ak) === 'm').map(x => x.p)), nM: W.filter(x => akN(x.ak) === 'm').length, pp: avg(W.filter(x => akN(x.ak) === 'p').map(x => x.p)), nP: W.filter(x => akN(x.ak) === 'p').length,
      on: RH.filter(x => x[2] === 'o').length, due: RH.length, ars: avg(A.map(x => x.a)), nA: A.length, nR: Rr.length,
      grid: window.MARKS ? MARKS.bySubject({w: [], r: Rr, p: []}) : [],
      cm: (H.c || []).filter(x => x.d <= end && x.d >= add(R.a, -21)), notes: (H.n || []).filter(x => inR(x.d))};
  }
  const head = (title, sub) => `<div class="fd-hd"><img src="logo.png" alt="LHQ Learning Solutions"><div class="fd-ttl"><b>${title}</b><span>${sub}</span></div></div><div class="fd-rule"></div>`;
  const fig = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
  const so = (n, few) => n ? (few && n < 3 ? `${n} so far` : `${n}`) : '';
  function cellG(c){ if(!c) return '<td class="na"></td>'; if(c.pk || c.self) return '<td class="na"></td>';
    const a = c.a >= 0 ? c.a : null, cl = a == null ? 'nv' : a >= 75 ? 'hi' : a >= 50 ? 'mid' : 'lo';
    return `<td class="${cl}"><b>${a == null ? '–' : a + '%'}</b><small>SRA ${c.p}</small></td>`; }
  function report(k, per, t, who){
    const R = range(k, per, t), m = model(k, R, t), N = first(k.name);
    const tr = v => v == null || Math.abs(v) < 3 ? '' : v > 0 ? ' <span class="up">▲</span>' : ' <span class="dn">▼</span>';
    const rows = m.P.map(x => `<tr><td><b>${esc(x.sub)}</b></td><td class="c">${x.held ? `${x.att}/${x.held}` : '–'}</td><td class="c">${x.wk != null ? x.wk + '%' + tr(x.trend) : '–'}</td><td class="c">${pcs(x.mo)}</td><td class="c">${pcs(x.pp)}</td><td class="c">${x.due ? `${x.on}/${x.due}` : '–'}</td><td class="c">${pcs(x.ars)}</td></tr>`).join('');
    const grids = m.grid.filter(g => g.sra.length).map(g => `<div class="fd-g"><h4>${esc(g.sub)}</h4><table><tr><th>Topic</th>${['LD','R1','R2','R3','R4','R5'].map(h => `<th>${h}</th>`).join('')}</tr>${g.sra.map(([tp, a]) => `<tr><td class="tp">${esc(tp)}</td>${a.map(cellG).join('')}</tr>`).join('')}</table></div>`).join('');
    const cms = m.P.map(x => { const c = m.cm.find(y => y.sub === x.sub); if(!c) return ''; return `<p><b>${esc(x.sub)} · ${short(c.d)}:</b> ${[lab('Doing well: ', c.cs), lab('To work on: ', c.ci), lab('Next: ', c.cn)].filter(Boolean).map(esc).join(' · ')}</p>`; }).join('')
      + m.notes.slice(0, 4).map(x => `<p><b>${esc(x.sub)} · ${short(x.d)}:</b> ${esc(x.n)}</p>`).join('');
    const tp = m.P.filter(x => x.topics.length).map(x => `<p><b>${esc(x.sub)}:</b> ${x.topics.map(esc).join(', ')}</p>`).join('');
    return `<div class="fd">${head('PROGRESS TO DATE', `${esc(R.label)} · ${rangeL(R)}`)}
      <span class="fd-stamp">Downloaded by ${esc(who || 'a parent')} · ${nice(t)} · not the monthly report</span>
      <div class="fd-who"><div><span>Student</span><b>${esc(k.name)}</b></div>${k.level ? `<div><span>Year</span><b>${esc(k.level)}</b></div>` : ''}<div><span>Up to</span><b>${nice(m.end)}</b></div></div>
      <h3>At a glance</h3><div class="fd-figs">${fig(m.held ? Math.round(m.att / m.held * 100) + '%' : '–', `Attendance${m.held ? ` · ${m.att} of ${m.held}` : ''}`)}${fig(pcs(m.wk), `Weekly assessments${m.nW ? ' · ' + so(m.nW, 1) : ''}`)}${fig(pcs(m.mo), `Monthly assessments${m.nM ? ' · ' + so(m.nM, 1) : ''}`)}
        ${fig(pcs(m.pp), `Past papers${m.nP ? ' · ' + m.nP : ''}`)}${fig(m.due ? `${m.on} / ${m.due}` : '–', 'SRAs on time')}${fig(pcs(m.ars), `ARS recall · ${m.nA} of ${m.nR} with an ARS`)}</div>
      ${m.P.length ? `<h3>By subject</h3><table class="fd-t"><tr><th>Subject</th><th class="c">Attended</th><th class="c">Weekly</th><th class="c">Monthly</th><th class="c">Past paper</th><th class="c">SRAs on time</th><th class="c">ARS</th></tr>${rows}</table>` : `<p class="fd-n">Nothing logged for ${esc(N)} in these dates yet.</p>`}
      ${grids ? `<h3>SRAs by topic <em>ARS recall, with the SRA mark below</em></h3><div class="fd-gs">${grids}</div>` : ''}
      ${tp ? `<h3>Topics covered</h3><div class="fd-p">${tp}</div>` : ''}
      ${cms ? `<h3>From the tutors</h3><div class="fd-p">${cms}</div>` : ''}
      <div class="fd-ft">Weekly and monthly assessments are LHQ's own, taken at LHQ; past papers are marked against Cambridge grade boundaries. An average from one or two marks is an early sign, not a grade. SRAs are spaced repetition reviews done at home; the ARS (Active Recall Sheet) is done from memory before each one and is not part of any grade. LHQ Learning Solutions · 0992 525 250 · learnhqes@gmail.com</div></div>`;
  }

  /* ---------- payments: next payment and what follows ---------- */
  function payOf(kids){ const seen = new Set(), all = []; kids.forEach(k => (k.pay || []).forEach(p => { if(!seen.has(p.id)){ seen.add(p.id); all.push(Object.assign({kid: k.name}, p)); } })); return all; }
  /* the dates after the open invoice that a parent should know about: term fees for term to term; the end of holiday tuition */
  function after(k, inv, t){
    if(!inv) return [];
    if(inv.tt === 'term'){ const T = terms(k), pd = (k.payDates || {}).term || {}, from = inv.pe || t;
      return T.filter(x => x[1] > from).slice(0, 2).map(x => ({l: `${x[0]} fees`, d: pd[x[1]] || x[1], note: 'invoice before'})); }
    if(inv.tt === 'hol' && inv.pe) return [{l: `Holiday tuition ends`, d: inv.pe, note: 'then nothing due'}];
    return [];
  }
  function nextPay(kids, t){
    const all = payOf(kids), open = all.filter(p => p.type === 'invoice' && p.balance > 0.5);
    const L = open.map(p => ({p, amt: p.next ? p.next.left : p.balance, due: p.next ? p.next.due : p.due, what: p.next ? p.next.short : 'Balance'})).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
    const inv = (L[0] && L[0].p) || all.filter(p => p.type === 'invoice').sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    const k = inv ? kids.find(x => x.name === inv.kid) || kids[0] : kids[0];
    return {all, open, first: L[0] || null, owed: open.reduce((s, p) => s + p.balance, 0), inv, tt: inv ? inv.tt : '', after: after(k || {}, inv, t)};
  }
  function statement(kids, t, who){
    const N = nextPay(kids, t), all = N.all.filter(p => p.type !== 'quote'), many = kids.length > 1;
    const ev = [], up = s => String(s || '').trim().toUpperCase();
    all.forEach(p => { if(p.type === 'invoice'){ ev.push({d: p.date, t: `Invoice ${p.number}${many ? ' · ' + first(p.kid) : ''}`, c: p.total, p: 0});
        /* paid without a receipt in the Hub (recorded on the invoice itself) */
        const rc = all.filter(x => x.type === 'receipt' && up(x.ref) === up(p.number)).reduce((s, x) => s + x.received, 0), extra = Math.round((p.paid - rc) * 100) / 100;
        if(extra > 0.5) ev.push({d: p.date, t: `Paid · recorded on ${p.number}`, c: 0, p: extra}); }
      else ev.push({d: p.date, t: `Receipt ${p.number}${p.ref ? ' · for ' + p.ref : ''}${many ? ' · ' + first(p.kid) : ''}`, c: 0, p: p.received}); });
    ev.sort((a, b) => (a.d || '').localeCompare(b.d || '') || b.c - a.c); let bal = 0;
    const paid = ev.reduce((s, e) => s + e.p, 0), a0 = ev.length ? ev[0].d : t;
    const sched = N.open.flatMap(p => (p.rows || [{short: 'Balance', amt: p.balance, due: p.due, paid: false}]).map(r => `<tr><td>${esc(r.short)}${many ? ' · ' + esc(first(p.kid)) : ''}</td><td>${r.due ? nice(r.due) : '–'}</td><td class="r">${mk(r.amt)}</td><td class="r">${r.paid ? '<span class="up">✓ paid</span>' : '<b>due</b>'}</td></tr>`))
      .concat(N.after.map(x => `<tr><td>${esc(x.l)}</td><td>${nice(x.d)}</td><td class="r fl" colspan="2">${esc(x.note)}</td></tr>`)).join('');
    const I = kids[0] && kids[0].payInfo || {};
    return `<div class="fd">${head('STATEMENT OF ACCOUNT', `${short(a0)} – ${nice(t)}`)}
      <div class="fd-who"><div><span>For</span><b>${esc(who || '')}</b></div><div><span>${many ? 'Students' : 'Student'}</span><b>${kids.map(k => esc(k.name)).join(', ')}</b></div>${N.tt ? `<div><span>Tuition</span><b>${esc((window.PAYPLAN ? PAYPLAN.TT : {})[N.tt] || '')}</b></div>` : ''}</div>
      <div class="fd-tot"><div><small>Paid</small><b>${mk(paid)}</b></div><div><small>Balance now</small><b>${mk(N.owed)}</b></div><div class="due"><small>Next payment</small><b>${N.first ? mk(N.first.amt) : 'Nothing due'}</b>${N.first && N.first.due ? `<small>${esc(N.first.what)} · due ${nice(N.first.due)}</small>` : ''}</div></div>
      <h3>Transactions</h3><table class="fd-t"><tr><th>Date</th><th>Details</th><th class="r">Charged</th><th class="r">Paid</th><th class="r">Balance</th></tr>${ev.map(e => { bal += e.c - e.p; return `<tr><td>${short(e.d)}</td><td>${esc(e.t)}</td><td class="r">${e.c ? mk(e.c) : ''}</td><td class="r">${e.p ? mk(e.p) : ''}</td><td class="r"><b>${mk(Math.max(0, bal))}</b></td></tr>`; }).join('') || '<tr><td colspan="5">No invoices yet.</td></tr>'}</table>
      ${sched ? `<h3>Payment dates</h3><table class="fd-t"><tr><th>Payment</th><th>Due</th><th class="r">Amount</th><th class="r"></th></tr>${sched}</table>` : ''}
      <h3>How to pay</h3><p class="fd-n" style="color:#1d2433">${[I.bank && `Bank: ${esc(I.bank)}${I.accname ? ', ' + esc(I.accname) : ''}${I.branch ? ', ' + esc(I.branch) + ' branch' : ''}${I.accno ? ', Acc. ' + esc(I.accno) : ''}`, I.mobile && `Mobile money: ${esc(I.mobile)} (include the withdrawal fee)`].filter(Boolean).join('<br>')}<br>Quote the invoice number with every payment.</p>
      <div class="fd-ft">LHQ Learning Solutions · Area 47, Sector 4, Lilongwe · ${esc(I.phone || '0992 525 250')} · ${esc(I.email || 'learnhqes@gmail.com')} · statement made ${nice(t)}</div></div>`;
  }
  /* a copy of one invoice or receipt */
  function copy(p, k){
    const inv = p.type === 'invoice', R = p.rows || [];
    const lines = (p.items || []).map(it => `<tr><td>${esc(it.d)}</td><td class="c">${it.n || ''}</td><td class="r">${it.c ? mk(it.c) : ''}</td><td class="r">${mk(it.n * it.c)}</td></tr>`).join('');
    return `<div class="fd">${head(inv ? 'INVOICE · COPY' : 'RECEIPT · COPY', `${esc(p.number)} · ${nice(p.date)}`)}
      <div class="fd-who"><div><span>Student</span><b>${esc(p.kid || (k && k.name) || '')}</b></div>${p.ps ? `<div><span>Tuition period</span><b>${short(p.ps)} – ${nice(p.pe || p.ps)}</b></div>` : ''}${p.ref ? `<div><span>${inv ? 'Quote' : 'For invoice'}</span><b>${esc(p.ref)}</b></div>` : ''}</div>
      ${inv && lines ? `<h3>Tuition</h3><table class="fd-t"><tr><th>Subject</th><th class="c">Sessions</th><th class="r">Cost</th><th class="r">Amount</th></tr>${lines}${p.disc > 0.5 ? `<tr><td colspan="3">Discount</td><td class="r">− ${mk(p.disc)}</td></tr>` : ''}</table>` : ''}
      <div class="fd-tot">${inv ? `<div><small>Total</small><b>${mk(p.total)}</b></div><div><small>Paid</small><b>${mk(p.paid)}</b></div><div class="due"><small>Balance</small><b>${mk(p.balance)}</b>${p.next ? `<small>${esc(p.next.short)} · due ${nice(p.next.due)}</small>` : p.balance > 0.5 && p.due ? `<small>due ${nice(p.due)}</small>` : ''}</div>`
        : `<div><small>Received</small><b>${mk(p.received)}</b></div>${p.prevPaid ? `<div><small>Paid before</small><b>${mk(p.prevPaid)}</b></div>` : ''}<div class="due"><small>Date</small><b>${nice(p.date)}</b></div>`}</div>
      ${R.length ? `<h3>Payment dates</h3><table class="fd-t">${R.map(r => `<tr><td>${esc(r.short)}</td><td>${nice(r.due)}</td><td class="r">${mk(r.amt)}</td><td class="r">${r.paid ? '<span class="up">✓ paid</span>' : 'due'}</td></tr>`).join('')}</table>` : ''}
      <div class="fd-ft">A copy from LHQ Hub, ${nice(new Date().toISOString().slice(0, 10))}. LHQ Learning Solutions · 0992 525 250 · learnhqes@gmail.com</div></div>`;
  }

  /* ---------- A4 and the PDF ---------- */
  const CSS = `.fd{width:794px;box-sizing:border-box;padding:40px 46px 30px;background:#fff;color:#1d2433;font:12.5px/1.45 "Plus Jakarta Sans","Segoe UI",system-ui,sans-serif}
.fd-hd{display:flex;justify-content:space-between;align-items:center;gap:16px}.fd-hd img{height:46px}.fd-ttl{text-align:right}.fd-ttl b{display:block;color:#073763;font-size:15px;letter-spacing:.1em}.fd-ttl span{color:#5f6b7d;font-size:12px}
.fd-rule{height:3px;background:#073763;margin:12px 0 10px}.fd-stamp{display:inline-block;font-size:11px;font-weight:700;color:#7a5400;background:#fdf3d8;border-radius:5px;padding:3px 8px}
.fd-who{display:flex;flex-wrap:wrap;gap:6px 28px;margin:12px 0 4px}.fd-who span{display:block;color:#6b7385;font-size:11px}.fd-who b{font-size:14px;color:#14213d}
.fd h3{margin:18px 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#073763}.fd h3 em{font-style:normal;text-transform:none;letter-spacing:0;color:#6b7385;font-weight:600}
.fd-figs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fd-figs div{border:1px solid #e3e7ee;border-radius:8px;padding:9px 11px}.fd-figs b{display:block;font-size:20px;color:#073763}.fd-figs small{color:#5f6b7d;font-size:11px}
.fd-t{width:100%;border-collapse:collapse;font-size:12px}.fd-t th{text-align:left;font-size:10.5px;color:#6b7385;font-weight:700;border-bottom:1.5px solid #c9d0db;padding:6px 5px}.fd-t td{border-bottom:1px solid #eef1f5;padding:6px 5px;vertical-align:top}
.fd .c{text-align:center}.fd .r{text-align:right}.fd .fl{color:#6b7385}.fd .up{color:#1f7a4d;font-weight:800}.fd .dn{color:#b42318;font-weight:800}
.fd-gs{display:grid;grid-template-columns:1fr 1fr;gap:12px 18px}.fd-g h4{margin:0 0 4px;font-size:12.5px;color:#14213d}.fd-g table{width:100%;border-collapse:separate;border-spacing:2px;table-layout:fixed;font-size:10px}.fd-g th{color:#6b7385;font-weight:700;font-size:9.5px}.fd-g th:first-child{width:34%;text-align:left}
.fd-g td{height:30px;border-radius:4px;text-align:center;line-height:1.1}.fd-g td b{display:block;font-size:10.5px}.fd-g td small{font-size:8.5px;opacity:.85}.fd-g td.tp{text-align:left;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:auto}
.fd-g .hi{background:#0b3a7a;color:#fff}.fd-g .mid{background:#7fa6d9;color:#0b2347}.fd-g .lo{background:#f3d38a;color:#5a3d00}.fd-g .nv{background:#eef1f5;color:#6b7385}.fd-g .na{box-shadow:inset 0 0 0 1px #e3e7ee}
.fd-p p{margin:3px 0}.fd-n{color:#6b7385;margin:4px 0}.fd-ft{margin-top:18px;border-top:1px solid #e3e7ee;padding-top:8px;color:#7a8494;font-size:10.5px}
.fd-tot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.fd-tot div{border-radius:8px;padding:10px 12px;background:#f4f6fa}.fd-tot div.due{background:#073763;color:#fff}.fd-tot b{display:block;font-size:17px}.fd-tot small{font-size:11px;opacity:.85}
.fd-wrap{overflow-x:auto;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12)}`;
  let cssOn = false; const ensureCss = () => { if(cssOn) return; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); cssOn = true; };
  async function pdf(html, name){
    ensureCss(); let st = document.getElementById('fdStage');
    if(!st){ st = document.createElement('div'); st.id = 'fdStage'; st.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px'; document.body.appendChild(st); }
    st.innerHTML = html;
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all([...st.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    const el = st.firstElementChild, w = el.offsetWidth;
    const blob = await (await window.lhqPdf())().set({margin: [8, 0, 10, 0], image: {type: 'jpeg', quality: 0.95}, html2canvas: {scale: 2, useCORS: true, backgroundColor: '#ffffff', x: 0, y: 0, scrollX: 0, scrollY: 0, width: w, windowWidth: w},
      jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'}, pagebreak: {mode: ['css'], avoid: ['tr', '.fd-figs', '.fd-g', '.fd-tot', 'h3', '.fd-p p']}}).from(el).outputPdf('blob');
    st.innerHTML = '';
    const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name.replace(/[\\/:*?"<>|]/g, '') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  return {PER, range, rangeL, report, statement, copy, nextPay, payOf, pdf, nice, short, mk, CSS};
})();
