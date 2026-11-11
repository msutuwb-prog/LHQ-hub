/* LHQ Hub › follow-ups on weak topics (Reteach next session, Retest, Take-home) and a topic's objectives over its ARSs.
   Before = the latest SRA mark on the topic when the follow-up was set. After = the retest, or for reteach and take-home the next SRA on the topic.
   Take-home sheets keep their own mark and never change an SRA. Earlier SRA marks never change. Worked = up 10 points or more. */
window.FUP = (function(){
  const ACT = {reteach: 'Reteach next session', retest: 'Retest', take: 'Take-home'};
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pc = e => e && e.sc !== '' && e.sc != null && +e.mx > 0 ? Math.round(+e.sc / +e.mx * 100) : null;
  const marked = (E, k, tk) => E.filter(e => e && !e.x && e.ty === 'r' && e.k === k && nk(e.tk) === nk(tk) && e.h !== 'm' && pc(e) != null).sort((a, b) => a.d.localeCompare(b.d) || (a.at || 0) - (b.at || 0));
  const before = (E, k, tk) => { const L = marked(E, k, tk); return L.length ? pc(L[L.length - 1]) : null; };
  function after(f, E){
    if(f.act === 'retest') return f.res ? {pc: f.res.pc, d: f.res.d, src: 'Retest'} : null;
    const L = marked(E, f.k, f.tk).filter(e => e.d > f.set); return L.length ? {pc: pc(L[0]), d: L[0].d, src: 'Next SRA on the topic', e: L[0]} : null;
  }
  const worked = (f, E) => { const a = after(f, E); return !!a && a.pc - f.before >= 10; };
  function state(f, E, t){ const a = after(f, E); return a ? (a.pc - f.before >= 10 ? 'worked' : 'not') : f.by < t ? 'overdue' : 'open'; }
  /* each objective over the student's ARSs on the topic: secure (recalled at the last 2), weak (missed at the last), developing, or not yet */
  function mastery(E, k, tk, L){
    const A = E.filter(e => e && !e.x && e.ty === 'r' && e.k === k && nk(e.tk) === nk(tk) && e.om && !e.na).sort((a, b) => a.d.localeCompare(b.d) || (a.at || 0) - (b.at || 0));
    return L.map(n => { const V = A.filter(e => e.om[n] != null).map(e => +e.om[n]), l = V[V.length - 1], p = V[V.length - 2];
      if(!V.length) return {n, s: 'not yet', c: ''};
      if(l === 0) return {n, s: p === 0 ? 'weak · missed twice' : 'weak', c: 'r', w: 1};
      if(l === 2 && p === 2) return {n, s: 'secure', c: 'g'};
      return {n, s: l === 1 ? 'developing · ½ last time' : V.length === 1 ? 'developing · recalled once' : 'developing', c: 'y'}; });
  }
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dl = d => { const x = new Date(d + 'T00:00:00Z'); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
  const addD = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const first = n => String(n || '').split(' ')[0];
  const MK = {worked: ['ok', '✓'], not: ['am', '–'], overdue: ['rd', '!'], open: ['am', '!']};
  const line = (f, E, t) => { const s = state(f, E, t), a = after(f, E);
    return {s, a, sub: `${ACT[f.act]} · ${a ? f.before + '% → ' + a.pc + '%' : (s === 'overdue' ? 'overdue · ' : 'by ') + dl(f.by)}`}; };
  /* one follow-up, from start to result */
  function detail(f, E, t){
    const a = after(f, E), s = state(f, E, t), r = (l, m, v, c) => `<div class="sf-dl ${c || ''}"><span>${l}</span><b>${v}</b><small>${m}</small></div>`;
    return r('Started', `${dl(f.set)} · latest SRA on the topic`, f.before + '%', 'y') + r(f.act === 'retest' ? 'Retest by' : 'By', dl(f.by) + (f.foc ? ' · focus: ' + esc(f.foc) : ''), a ? 'done' : s === 'overdue' ? 'overdue' : 'open', !a && s === 'overdue' ? 'r' : '')
      + (f.th ? r('Take-home sheets', `${dl(f.th.d)} · their own mark · doesn't change any SRA`, f.th.pc + '%') : '')
      + (a ? r(a.src, `${dl(a.d)} · ${f.tutor ? 'marked by ' + esc(first(f.tutor)) : ''}`, a.pc + '%', a.pc - f.before >= 10 ? '' : 'y') : '');
  }

  /* ---------- Director: Reports › Follow-ups ---------- */
  let last = null;
  function data(){
    const t = HD.today(), from = addD(t, -91), F = Object.values(store.get('lhq_fu', {}) || {}).filter(f => f && !f.x && f.set >= from);
    const E = Object.values(((store.get('lhq_logs', {e: {}}) || {}).e) || {}).filter(e => e && !e.x);
    return {t, F, E, open: F.filter(f => !after(f, E)), closed: F.filter(f => after(f, E))};
  }
  function page(){
    const D = last = data(), ov = D.open.filter(f => f.by < D.t), wk = D.closed.filter(f => worked(f, D.E));
    const byA = Object.keys(ACT).map(k => ({k, L: D.closed.filter(f => f.act === k)})).filter(x => x.L.length);
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Follow-ups</h1><p>LHQ · last 3 months</p></div></div>
      <div class="sf-kv" style="grid-template-columns:repeat(2,minmax(0,1fr))"><button data-fud="open"><span>Open</span><b>${D.open.length}</b><small style="display:block;color:var(--muted);font-size:12px">${ov.length} overdue</small></button><button data-fud="closed"><span>Worked</span><b>${D.closed.length ? `${wk.length} of ${D.closed.length}` : '–'}</b><small style="display:block;color:var(--muted);font-size:12px">up 10 points or more</small></button></div>
      <div class="h2">By action</div><div class="card">${byA.map(x => `<button class="sf-row" data-fua="${x.k}"><span><b>${ACT[x.k]}</b><small>${x.L.length} closed</small></span><b>${x.L.filter(f => worked(f, D.E)).length} of ${x.L.length}</b><span class="chev">›</span></button>`).join('') || '<p class="empty">None closed yet.</p>'}</div>
      <div class="h2">Open <em>${D.open.length}</em></div><div class="card">${D.open.sort((a, b) => a.by.localeCompare(b.by)).map(f => { const l = line(f, D.E, D.t); return `<button class="sf-row" data-fuo="${esc(f.id)}"><span><b>${esc(f.tk)} · ${esc(f.st)}</b><small>${l.sub} · ${esc(f.tutor)}</small></span><span class="${l.s === 'overdue' ? 'dn' : ''}">${l.s === 'overdue' ? 'overdue' : ''}</span><span class="chev">›</span></button>`; }).join('') || '<p class="empty">None open.</p>'}</div>
      <p class="note">Tutors set these from a student's topic. Take-home sheets keep their own mark.</p>`;
  }
  const sheet = (t, sub, body) => openSheet(`<div class="hx"><h3>${t}</h3><button class="ib" data-close>✕</button></div>${sub ? `<p class="sp">${sub}</p>` : ''}<div class="card">${body || '<p class="empty">Nothing here.</p>'}</div>`);
  const rowF = (f, D) => { const l = line(f, D.E, D.t); return `<button class="sf-row" data-fuo="${esc(f.id)}"><span><b>${esc(f.tk)} · ${esc(first(f.st))}</b><small>${l.sub} · ${esc(f.tutor)}</small></span><span class="${l.s === 'overdue' ? 'dn' : ''}">${l.s === 'worked' ? 'worked' : l.s === 'not' ? 'not yet' : l.s}</span><span class="chev">›</span></button>`; };
  function one(id){ const D = last || data(), f = D.F.find(x => x.id === id) || Object.values(store.get('lhq_fu', {}) || {}).find(x => x && x.id === id); if(!f) return;
    const a = after(f, D.E); sheet(`${esc(f.tk)} · ${esc(first(f.st))}`, `${esc(f.sub)} · ${ACT[f.act]} · ${esc(f.tutor)}${a ? ` · ${a.pc - f.before >= 0 ? '+' : ''}${a.pc - f.before} points` : ''}`, detail(f, D.E, D.t)); }
  function bind(){
    const D = last || data();
    document.querySelectorAll('[data-fud]').forEach(b => b.onclick = () => { const k = b.dataset.fud;
      if(k === 'open') sheet(`Open · ${D.open.length}`, 'Waiting for the result', D.open.map(f => rowF(f, D)).join(''));
      else sheet(`Worked · ${D.closed.filter(f => worked(f, D.E)).length} of ${D.closed.length}`, 'Closed · worked = up 10 points or more', D.closed.map(f => rowF(f, D)).join(''));
      bindRows(); });
    document.querySelectorAll('[data-fua]').forEach(b => b.onclick = () => { const k = b.dataset.fua, L = D.closed.filter(f => f.act === k);
      sheet(`${ACT[k]} · ${L.filter(f => worked(f, D.E)).length} of ${L.length} worked`, 'Closed · worked = up 10 points or more', L.map(f => rowF(f, D)).join('')); bindRows(); });
    bindRows();
  }
  const bindRows = () => document.querySelectorAll('[data-fuo]').forEach(b => b.onclick = () => one(b.dataset.fuo));
  /* Needs attention: follow-ups past their date with no result */
  function overdue(){ const D = data(); return D.open.filter(f => f.by < D.t); }
  return {ACT, before, after, worked, state, mastery, line, detail, page, bind, overdue, marked, pc};
})();
