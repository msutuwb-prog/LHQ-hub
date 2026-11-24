/* LHQ Hub › people, enrolments and payments, counted apart (release 3a, agreed 22 Nov).
   People: each child once. Enrolments (the sale): each invoice for a programme and period, marked New (first with LHQ), Returning (same programme again)
   or Added (another programme for someone already with LHQ). Payments: receipts; one enrolment can have several. Children in partner activities are people too:
   a child moved into tuition is one person with two services. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), tday = () => iso(new Date());
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const amt = v => +String(v || 0).replace(/[^\d.]/g, '') || 0;
  const M = n => { n = Math.round(+n || 0); return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'm' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); };
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const MOL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const rerender = () => { if(window.hubApply) hubApply(); };
  const progs = () => window.PROGS ? PROGS() : [{id:'weekly', name:'Weekly tuition'}];
  /* which programme an invoice is for: the line's programme, else a programme named on a line, else weekly tuition */
  function progOf(inv){ const P = progs(), it = inv.items || [];
    const byId = it.map(x => x.prog).find(Boolean); if(byId && P.find(p => p.id === byId)) return byId;
    const txt = nk(it.map(x => x.desc).join(' ') + ' ' + (inv.notes || '')), hit = P.filter(p => p.id !== 'weekly' && p.type !== 'activity').find(p => txt.includes(nk(p.name)));
    return hit ? hit.id : (P.find(p => p.type === 'weekly') || P[0] || {}).id || 'weekly'; }
  let MEMO = {t: 0, v: null};   // one page draw asks many times (Families asks once per child): work it out once a moment
  function all(){
    if(MEMO.v && Date.now() - MEMO.t < 1500) return MEMO.v;
    const out = [];
    (window.HD ? HD.students() : []).forEach(s => {
      const P = (s.periods || []).filter(p => p.inv && !p.inv.del && !p.inv.credit).slice().sort((a, b) => String(a.inv.date || '').localeCompare(String(b.inv.date || '')));
      const seen = new Set();
      P.forEach((p, i) => { const pg = progOf(p.inv), kind = i === 0 ? 'new' : seen.has(pg) ? 'ret' : 'add'; seen.add(pg);
        out.push({s, inv: p.inv, prog: pg, d: p.inv.date || '', kind, total: amt(p.inv.total || p.inv.amount), paid: (p.receipts || []).reduce((a, r) => a + amt(r.received), 0), receipts: p.receipts || []}); });
    });
    MEMO = {t: Date.now(), v: out}; return out;
  }
  /* periods to look at */
  function ranges(){ const t = tday(), y = +t.slice(0, 4), m = +t.slice(5, 7), fy = m >= 9 ? y : y - 1, ym = (yy, mm) => yy + '-' + pad(mm);
    const lm = m === 1 ? ym(y - 1, 12) : ym(y, m - 1), term = m >= 9 ? [ym(y, 9), ym(y, 12)] : m <= 4 ? [ym(y, 1), ym(y, 4)] : [ym(y, 5), ym(y, 8)];
    return [['month', `This month · ${MOL[m - 1]}`, t.slice(0, 7) + '-01', t.slice(0, 7) + '-31'], ['last', `Last month · ${MOL[+lm.slice(5) - 1]}`, lm + '-01', lm + '-31'], ['term', 'This term', term[0] + '-01', term[1] + '-31'], ['fy', `This year · ${fy}/${String(fy + 1).slice(2)}`, fy + '-09-01', (fy + 1) + '-08-31'], ['all', 'All time', '0000', '9999']]; }
  let R = 'term', SHOW = '';
  function figures(a, z){
    const E = all().filter(e => e.d >= a && e.d <= z), people = new Map(); E.forEach(e => people.set(e.s.key, e.s));
    const docs = window.HD ? HD.load() : [], pays = docs.filter(x => x.type === 'receipt' && !x.del && (x.date || '') >= a && (x.date || '') <= z && amt(x.received) > 0);
    const K = window.PLAN ? PLAN.kids() : [], kidsIn = K.filter(k => (k.since || '') <= z), names = new Set([...people.values()].map(s => nk(s.name)));
    const reach = people.size + kidsIn.filter(k => !names.has(nk(k.name))).length, inc = pays.reduce((s, r) => s + amt(r.received), 0);
    return {E, people, pays, kidsIn, reach, inc, n: k => E.filter(e => e.kind === k)};
  }
  function page(){
    const RG = ranges(), r = RG.find(x => x[0] === R) || RG[2], F = figures(r[2], r[3]), P = progs(), NEW = F.n('new'), RET = F.n('ret'), ADD = F.n('add');
    const box = (k, l, v, s) => `<button class="en-k" data-ens="${k}"><span>${l}</span><b>${v}</b><small>${s}</small></button>`;
    const byP = P.map(p => { const L = F.E.filter(e => e.prog === p.id); return {p, L, ppl: new Set(L.map(e => e.s.key)).size, inc: L.reduce((s, e) => s + e.paid, 0)}; }).filter(x => x.L.length);
    const listFor = k => k === 'people' ? [...F.people.values()].map(s => ({t: s.name, s: s.level || '', h: '#student/' + encodeURIComponent(s.key)}))
      : k === 'kids' ? F.kidsIn.map(c => ({t: c.name, s: (c.moved ? 'also in tuition · ' : '') + (c.school || ''), h: '#plan/partner/' + c.partner}))
      : k === 'pays' ? F.pays.map(x => ({t: `${x.number || ''} · ${x.student || ''}`, s: `${x.date} · MWK ${amt(x.received).toLocaleString('en-GB')}`, h: 'doc.html#d=' + encodeURIComponent(x.id)}))
      : (k === 'enrol' ? F.E : F.n(k)).map(e => ({t: `${e.s.name} · ${(P.find(p => p.id === e.prog) || {}).name || 'Other'}`, s: `${{new:'New', ret:'Returning', add:'Added'}[e.kind]} · ${e.inv.number || ''} · ${e.d}`, h: 'doc.html#d=' + encodeURIComponent(e.inv.id)}));
    const L = SHOW ? listFor(SHOW) : null;
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>People and enrolments</h1><p>Each child counted once; each sign-up counted as a sale</p></div></div>
      <select class="in" id="enR" style="margin-bottom:12px">${RG.map(x => `<option value="${x[0]}" ${x[0] === R ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select>
      <div class="en-g">${box('people', 'Tuition students', F.people.size, 'people, each once')}${box('kids', 'Children in activities', F.kidsIn.length, F.kidsIn.filter(k => k.moved).length + ' also in tuition')}${box('people', 'Everyone reached', F.reach, 'no one counted twice')}
        ${box('enrol', 'Enrolments', F.E.length, 'the sales')}${box('new', 'New', NEW.length, 'first time with LHQ')}${box('ret', 'Returning', RET.length, 'same programme again')}${box('add', 'Added', ADD.length, 'another programme')}
        ${box('pays', 'Payments', F.pays.length, 'MWK ' + M(F.inc))}${box('enrol', 'Enrolments a person', F.people.size ? (Math.round(F.E.length / F.people.size * 10) / 10) : 0, '')}${box('pays', 'Income a person', 'MWK ' + M(F.people.size ? F.inc / F.people.size : 0), '')}${box('ret', 'Returning', pc(RET.length, F.E.length) + '%', 'of enrolments')}</div>
      ${L ? `<div class="h2">${esc({people:'People', kids:'Children in activities', enrol:'Enrolments', new:'New', ret:'Returning', add:'Added', pays:'Payments'}[SHOW])} <em>${L.length}</em> <button class="btn sm" data-ens="">Close</button></div><div class="card one">${L.slice(0, 200).map(x => `<a class="it" href="${x.h}"><span class="t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span><span class="chev">›</span></a>`).join('') || '<p class="empty">None.</p>'}</div>` : ''}
      <div class="h2">By programme</div><div class="card one">${byP.map(x => `<div class="it"><span class="t"><b>${esc(x.p.name)}</b><small>${x.ppl} people · ${x.L.length} enrolments · ${x.L.filter(e => e.kind === 'new').length} new · ${x.L.filter(e => e.kind === 'ret').length} returning · ${x.L.filter(e => e.kind === 'add').length} added</small></span><b>MWK ${M(x.inc)}</b></div>`).join('') || '<p class="empty">No enrolments in this period.</p>'}</div>
      <p class="note">An enrolment is an invoice for a programme and period; instalments are payments on the same enrolment. A child in an activity who also does tuition is one person.</p>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ens]'); if(!b) return; e.preventDefault(); SHOW = SHOW === b.dataset.ens ? '' : b.dataset.ens; rerender(); });
  document.addEventListener('change', e => { if(e.target && e.target.id === 'enR'){ R = e.target.value; SHOW = ''; rerender(); } });
  const st = document.createElement('style'); st.textContent = `.en-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 14px}.en-k{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-width:0}.en-k:hover{border-color:var(--accent)}.en-k span{display:block;font-size:12px;color:var(--muted);font-weight:700}.en-k b{display:block;font-size:22px}.en-k small{display:block;font-size:12px;color:var(--muted)}`; document.head.appendChild(st);
  window.ENROL = {all, page, progOf};
})();
