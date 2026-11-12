/* LHQ Hub › a student's figures for staff, the same whether the student uses Lean or Full.
   Effort (Habits) for the week, 4 weeks or term against the period before; topics dropping; SRAs on their day; follow-ups; On pace; school results;
   their own time (focus and study totals) when they use those features. Tutors see their own subjects only, and focus and study only with
   the Director's switch on and the student not hiding them. The weekly reflection is never shown. */
window.STV = (function(){
  const C = {}, per = {}, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const FEATN = {cards: 'Home cards', focus: 'Focus', plan: 'Plan my day', habits: 'Habits', review: 'Review'};
  async function load(key){
    if(C[key] && (C[key].busy || Date.now() - C[key].at < 5 * 60e3)) return;
    C[key] = Object.assign(C[key] || {}, {busy: true});
    try{ const j = await hub.api('stuview?k=' + encodeURIComponent(key)); C[key] = {k: j.k, at: Date.now()}; }
    catch(e){ C[key] = {err: e.message, at: Date.now()}; }
    if(typeof render === 'function') render();
  }
  const viewL = k => k.view === 'full' ? 'Full' : Object.keys(k.feat || {}).length ? `Lean · ${Object.keys(k.feat).length} added` : 'Lean';
  const uses = (k, f) => k.view === 'full' || !!(k.feat || {})[f];
  const tag = key => { const c = C[key]; return c && c.k && c.k.account ? `<span class="stv-tag" title="${c.k.view === 'full' ? 'Every feature' : esc(Object.keys(c.k.feat || {}).map(f => FEATN[f]).join(', ') || 'The essentials')}">${viewL(c.k)}</span>` : ''; };
  const pc = o => o.n ? Math.round(o.k / o.n * 100) : null;
  function page(key, who){
    const c = C[key]; if(!c || c.busy && !c.k){ load(key); return '<div class="card pad"><p class="empty" style="margin:0">Loading…</p></div>'; }
    if(c.err) return `<div class="card pad"><p class="empty" style="margin:0">${esc(c.err)}</p></div>`;
    if(Date.now() - c.at > 5 * 60e3) load(key);
    css(); SX.css();
    const k = c.k, t = HD.today(), hp = per[key] || 'w', r = SX.range(k, hp, t), A = SX.habitRows(k, r.a, r.b), B = SX.habitRows(k, r.pa, r.pb);
    const M = SX.memory(k), CS = SX.cons(k, HD.addDays(t, -27), t), P = SX.exI(k).filter(o => o.i.pace), onP = P.filter(o => o.i.pace.diff >= 0).length;
    const F = window.FUP ? FUP.famL(k) : [], fo = F.filter(f => !f.a).length, fw = F.filter(f => f.a && f.a.pc - f.before >= 10).length;
    const SR = (k.school || []), sOpen = SR.filter(x => !x.ok).length;
    const W = SX.weekTotals(k), tile = (d, l, v, s0) => `<button type="button" class="mc" data-stvd="${d}"><span class="l">${l}</span><span class="v">${v}<span class="mca">›</span></span><span class="s">${s0}</span></button>`;
    const habs = (who === 'tutor' ? SX.HAB.filter(([id]) => id !== 'rep') : SX.HAB).map(([id, l]) => { const a = A[id], b = B[id], p = id === 'ass' ? null : pc(a), q = id === 'ass' ? null : pc(b), d = p != null && q != null ? p - q : null;
      return `<button class="sx-hb" data-stvh="${id}"><span>${l}<small>${id === 'ass' ? `${a.n} sat` : a.n ? `${a.k} of ${a.n}` : 'none yet'}</small></span><b>${id === 'ass' ? a.n : p == null ? '–' : p + '%'}</b><span class="${d == null || d === 0 ? '' : d > 0 ? 'u' : 'd'}">${d == null || d === 0 ? '=' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d)}</span></button>`; }).join('');
    const own = k.own === 'off' ? '<div class="card pad"><b>Focus and study</b><p class="note" style="margin:0">Off · Settings › Teaching</p></div>'
      : k.own === 'hidden' ? `<div class="card pad"><b>Focus and study</b><p class="note" style="margin:0">${esc((k.name || '').split(' ')[0])} keeps these private</p></div>`
      : `<div class="mcs" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${uses(k, 'focus') || W.focus ? tile('ftime', 'Focus this week', SX.hmin(W.focus), 'finished rounds') : tile('lean|focus', 'Focus this week', '–', 'Not using Focus')}${uses(k, 'plan') || W.study ? `<div class="mc"><span class="l">Study planned</span><span class="v">${SX.hmin(W.study)}</span><span class="s">this week · total only</span></div>` : tile('lean|plan', 'Study planned', '–', 'Not using Plan my day')}</div>`;
    LAST = {key, k, A, r};
    return `<div class="stv"><div class="h2" style="display:flex;justify-content:space-between;align-items:center">Effort <span class="seg">${[['w','Week'],['w4','4 weeks'],['term','Term']].map(([v, l]) => `<button class="${hp === v ? 'on' : ''}" data-stvp="${v}">${l}</button>`).join('')}</span></div>
      <div class="card">${habs}</div><p class="note" style="margin:-4px 2px 12px">${esc(r.l)} · against ${esc(r.pl)} · from LHQ's records${who === 'tutor' ? ' · your subjects' : ''}</p>
      <div class="h2">SRAs</div><div class="mcs" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${tile('mem', 'Topics dropping', M.L.length ? M.fading : '–', M.L.length ? `of ${M.L.length} · 10+ below the first` : 'after two reviews')}${tile('cons', 'SRAs on their day', CS.n ? `${CS.on} of ${CS.n}` : '–', 'last 4 weeks')}</div>
      ${F.length ? `<div class="card"><button type="button" class="it" style="width:100%" data-stvd="fu"><span class="t"><b>Follow-ups</b><small>${fo} open · ${fw} worked</small></span><span class="chev">›</span></button></div>` : ''}
      ${who !== 'tutor' && (P.length || SR.length) ? `<div class="h2">Exams</div><div class="mcs" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">${P.length ? tile('pace', 'On pace', `${onP} of ${P.length}`, P.filter(o => o.i.pace.diff < 0).map(o => esc(o.x.sub)).join(', ') || 'all subjects') : ''}${SR.length ? tile('school', 'School results', SR.length, sOpen ? `${sOpen} for LHQ to check` : 'all checked') : ''}</div>` : ''}
      ${who === 'tutor' ? '' : `<div class="h2">Their own time</div>${own}`}
      <p class="note">${k.account ? `${esc((k.name || '').split(' ')[0])} uses ${viewL(k)}. ` : 'No student account yet. '}The same figures in Lean or Full. Their reflection stays theirs.</p></div>`;
  }
  let LAST = null;
  function bind(){
    if(!LAST || !document.querySelector('.stv')) return; const {key, k} = LAST;
    document.querySelectorAll('[data-stvp]').forEach(b => b.onclick = () => { per[key] = b.dataset.stvp; render(); });
    document.querySelectorAll('[data-stvh]').forEach(b => b.onclick = () => { const id = b.dataset.stvh, a = LAST.A[id], l = SX.HAB.find(x => x[0] === id)[1];
      SX.sheet(`${l}${id === 'ass' ? ` · ${a.n}` : a.n ? ` · ${a.k} of ${a.n}` : ''}`, LAST.r.l, '', a.rows.slice().reverse().map(x => SX.row(esc(x[0]), x[1], esc(x[2]), x[3])).join('')); });
    document.querySelectorAll('[data-stvd]').forEach(b => b.onclick = () => { const d = b.dataset.stvd;
      if(d.startsWith('lean|')){ const f = d.split('|')[1]; SX.sheet(f === 'focus' ? 'Focus' : 'Study planned', `${esc((k.name || '').split(' ')[0])} isn't using this`, `${esc((k.name || '').split(' ')[0])} uses ${viewL(k)}. It counts from the day ${f === 'focus' ? 'the Focus timer' : 'Plan my day'} is added (✎ on Home).`, ''); return; }
      if(d === 'fu'){ openSheet(`<div class="hx"><h3>Follow-ups</h3><button class="ib" data-close>✕</button></div>${FUP.famCard(k)}`); FUP.famBind(k); return; }
      if(d === 'school'){ SX.sheet(`School results · ${(k.school || []).length}`, 'Added by the student · LHQ checks', '', (k.school || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0)).map(x => SX.row(esc(`${x.term || ''} · ${x.sub || ''}`), x.ok ? 'LHQ checked' : 'LHQ checks', esc(x.pc != null && x.pc !== '' ? x.pc + '%' : x.gr || ''), x.ok ? '' : 'y')).join('')); return; }
      SX.drill(d, k); });
  }
  function css(){ if(document.getElementById('stvCss')) return; const s = document.createElement('style'); s.id = 'stvCss';
    s.textContent = '.stv-tag{display:inline-block;font-size:11.5px;font-weight:800;padding:2px 7px;border-radius:7px;background:var(--surface2);border:1px solid var(--line);color:var(--muted);vertical-align:2px;margin-left:6px;white-space:nowrap}.stv .seg button{padding:5px 9px;font-size:12.5px}'; document.head.appendChild(s); }
  const drop = key => { delete C[key]; };
  return {page, bind, load, tag, drop, viewL};
})();
