/* LHQ Hub › tutor KPIs on screen: Tutors › KPIs (the Director, and Admin when switched on), one tutor's page with
   Week · Month · Term, the figures and what's behind each one, observations and the month's review; and the tutor's own
   My performance (Week · Month) when switched on. Rules in kpi.js. */
window.KPIUI = (function(){
  const K = () => window.KPI;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const st = {per: 'month', off: 0, tper: 'week', toff: 0, focus: null};
  const conf = () => K().conf(settingsKV());
  const may = () => isDir() || (conf().admin && can('tutors'));
  const terms = () => window.MIN ? MIN.terms() : (settingsKV().terms || []);
  function ctx(){
    const v = k => Object.values(store.get(k, {}) || {}), E = (store.get('lhq_logs', {e: {}}) || {}).e || {};
    return {cards: saved.filter(d => typeOf(d) === 'card'), entries: Object.values(E), treps: Object.values((store.get('lhq_treps', {e: {}}) || {}).e || {}), makeups: v('lhq_makeups'),
      sreports: store.get('lhq_sreports', {}) || {}, targets: store.get('lhq_targets', {}) || {}, kpi: store.get('lhq_kpi', {}) || {}, set: settingsKV(), t: HD.today()};
  }
  let memo = {};
  const cached = (key, fn) => { const sig = (window.sync && sync.ver ? sync.ver : '') + '|' + saved.length + '|' + JSON.stringify(store.get('lhq_kpi', {})).length + '|' + ((store.get('lhq_logs', {e:{}}) || {}).e ? Object.keys(store.get('lhq_logs', {e:{}}).e).length : 0);
    if(memo.sig !== sig) memo = {sig}; return memo[key] || (memo[key] = fn()); };
  const MK = {ok: '✓', bad: '!', rd: '✕', no: ''};
  const lvlBadge = s => s.lvl === 'short' ? `<span class="kp-st rd"><i>✕</i>Falling short</span>` : s.lvl === 'slip' ? `<span class="kp-st am"><i>!</i>Slipping</span>` : s.lvl === 'ok' ? `<span class="kp-st ok"><i>✓</i>Meeting</span>` : `<span class="kp-st no"><i></i>No sessions yet</span>`;

  /* ---------- the figures ---------- */
  function core(F, L, c, run, who){
    return K().CORE.map(([id, name]) => { const f = F[id], t = c.tg[id], good = f.v == null ? null : f.v >= t;
      return `<button class="kp-f" data-kd="${id}" ${f.n ? '' : 'disabled'}><b>${esc(name)}</b><span class="v">${f.v == null ? '–' : f.v + '%'}${good == null ? '' : `<span class="kp-st ${good ? 'ok' : 'am'}"><i>${good ? '✓' : '!'}</i></span>`}</span><span class="chev">${f.n ? '›' : ''}</span>
        ${f.v != null ? `<div class="kp-bar"><i style="width:${f.v}%"></i><em style="left:${t}%"></em>${L[id] != null ? `<u style="left:${L[id]}%"></u>` : ''}</div>` : ''}
        <small>${f.n ? `<span>${f.k} of ${f.n}</span>` : '<span>nothing yet</span>'}${f.n && f.n < 5 ? '<span class="kp-few">few</span>' : ''}<span>LHQ ${L[id] != null ? L[id] + '%' : '–'}</span><span>Target ${t}%</span>${run && run[id] >= 2 ? `<span class="kp-run">${run[id]} weeks running</span>` : ''}</small></button>`; }).join('');
  }
  function watched(F, L, who){
    return K().WATCH.map(([id, name]) => { const f = F[id] || {}, fb = K().FEEDBACK.includes(id), open = !(who === 'tutor' && fb) && (f.rows || []).length;
      const cnt = id === 'otr' ? 'students with a target' : id === 'agr' ? `${f.n || 0} students` : id === 'ren' ? 'periods ended' : id === 'ars' ? 'SRAs marked' : id === 'obs' ? f.note : `${f.n || 0} answers`;
      return `<button class="kp-f" ${open ? `data-kd="${id}"` : 'disabled'}><b>${esc(name)}</b><span class="v">${esc(f.few ? '–' : f.val || '–')}</span><span class="chev">${open ? '›' : ''}</span><small>${f.few ? '<span>Not enough answers yet</span>' : `<span>${esc(cnt)}</span>`}<span>LHQ ${esc(L[id] != null ? L[id] : '–')}</span></small></button>`; }).join('');
  }
  function page(M, who){
    const s = M.st, c = M.c, banner = s.lvl === 'short' ? 'rd' : s.lvl === 'slip' ? 'am' : s.lvl === 'ok' ? 'ok' : 'no';
    const pers = who === 'tutor' ? [['week','Week'],['month','Month']] : [['week','Week'],['month','Month'],['term','Term']], P = who === 'tutor' ? st.tper : st.per, off = who === 'tutor' ? st.toff : st.off;
    const rv = M.rev, rk = who === 'tutor' ? 'tperk' : 'perk';
    return `<div class="kp-ban ${banner}"><span class="kp-big">${{rd: '✕', am: '!', ok: '✓', no: '–'}[banner]}</span><span><b>${K().statusL(s)}</b><small>${esc(K().why(s))}${s.lvl === 'none' ? '' : ' · last 4 weeks'}</small></span></div>
      <div class="seg" style="margin-bottom:10px">${pers.map(([k, l]) => `<button class="${P === k ? 'on' : ''}" data-${rk}="${k}">${l}</button>`).join('')}</div>
      <div class="kp-nav"><button class="ib" data-koff="1">${ic('back', 16, 2.2)}</button><b>${esc(M.label)}</b><button class="ib" data-koff="-1" ${off ? '' : 'disabled'}>${ic('chev', 16, 2.2)}</button></div>
      <div class="h2">Core KPIs <em>${K().CORE.filter(([id]) => M.F[id].v != null && M.F[id].v >= c.tg[id]).length} of ${K().CORE.filter(([id]) => M.F[id].v != null).length}</em></div><div class="card">${core(M.F, M.L, c, s.run, who)}</div>
      <div class="h2">Watched <em>no targets</em></div><div class="card">${watched(M.F, M.L, who)}</div>
      ${who === 'dir' && isDir() ? '<button class="btn" data-kobs style="margin-bottom:6px">+ Observation</button>' : ''}
      ${review(M, who)}`;
  }
  const MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function review(M, who){
    const rv = M.rev, mL = MON[+M.m.slice(5, 7) - 1];
    if(who === 'tutor') return rv && rv.note ? `<div class="h2">${mL} review</div><div class="card pad"><p style="margin:0 0 8px">${esc(rv.note)}</p>${rv.focus && rv.focus.length ? `<p class="note" style="margin:0 0 10px">Focus: ${rv.focus.map(id => esc(K().NAMES[id])).join(' · ')}${rv.until ? ' · by ' + K().dl(rv.until) : ''}</p>` : ''}<button class="btn sm${rv.seen ? '' : ' n'}" data-kseen ${rv.seen ? 'disabled' : ''}>${rv.seen ? '✓ Seen' : 'Seen'}</button></div>` : '';
    if(!isDir()) return rv && rv.note ? `<div class="h2">${mL} review</div><div class="card pad"><p style="margin:0">${esc(rv.note)}</p></div>` : '';
    if(st.focus == null) st.focus = (rv && rv.focus) || [];
    return `<div class="h2">${mL} review</div><div class="card pad"><textarea class="in" id="kNote" rows="3" placeholder="Note to ${esc(M.name.split(' ')[0])}">${esc(rv ? rv.note : '')}</textarea>
      <div class="kp-lab">Focus on</div>${K().CORE.map(([id, n]) => `<button class="kp-tk${st.focus.includes(id) ? ' on' : ''}" data-kfocus="${id}"><i>✓</i>${esc(n)}</button>`).join('')}
      <div class="kp-row" style="margin-top:10px"><label class="f" style="margin:0;flex:1"><span>By</span><input class="in" type="date" id="kUntil" value="${esc(rv ? rv.until : '')}"></label><button class="btn n" id="kRevSave" style="align-self:flex-end">Save</button></div>
      ${rv && rv.note ? `<p class="note" style="margin:8px 0 0">${rv.seen ? '✓ Seen by ' + esc(M.name.split(' ')[0]) + ' · ' + K().dl(K().dayOf(rv.seen)) : conf().tutors ? '○ Not seen yet' : 'Tutors don\'t see KPIs yet'}</p>` : ''}</div>`;
  }

  /* ---------- the Director's pages ---------- */
  const tId = n => encodeURIComponent(n);
  function listPage(){
    if(!may()) return '<p class="empty">Not available.</p>';
    const C = ctx(), L = cached('list', () => K().tutors(C).map(n => ({n, s: K().status(C, n)}))), ord = {short: 0, slip: 1, ok: 2, none: 3};
    L.sort((a, b) => ord[a.s.lvl] - ord[b.s.lvl] || a.n.localeCompare(b.n));
    return `${crumb('#tutors', 'Tutors')}<div class="ph"><div class="tt"><h1>KPIs</h1><p>Last 4 weeks</p></div>${isDir() ? `<div class="acts"><a class="btn" href="#set/kpi">${ic('gear', 15)} Targets</a></div>` : ''}</div>
      <div class="card">${L.map(x => `<a class="it" href="#kpi/${tId(x.n)}"><span class="t"><b>${esc(x.n)}</b><small>${esc(K().why(x.s) || ' ')}</small></span>${lvlBadge(x.s)}<span class="chev">›</span></a>`).join('') || '<p class="empty">No tutors on cards.</p>'}</div>`;
  }
  let cur = null;
  function tutorPage(name){
    if(!may()) return '<p class="empty">Not available.</p>';
    const C = ctx(), c = K().conf(C.set);
    let r = K().range(st.per, C.t, terms()); for(let i = 0; i < st.off && r; i++) r = K().shift(r, -1, terms()); if(!r){ st.off = 0; r = K().range(st.per, C.t, terms()); }
    const key = name + '|' + st.per + '|' + st.off, F = cached('f' + key, () => K().figures(C, name, r)), L = cached('l' + st.per + st.off, () => K().lhq(C, r)), s = cached('s' + name, () => K().status(C, name));
    const subs = [...new Set(C.cards.flatMap(cd => (cd.subjects || []).filter(x => K().nk(x.tutor) === K().nk(name)).map(x => x.name)))];
    const m = C.t.slice(0, 7), rev = ((C.kpi.rev || {})[K().nk(name) + '|' + m]) || null;
    cur = {name, F, C};
    return `${crumb('#kpi', 'KPIs')}<div class="ph"><div class="tt"><h1>${esc(name)}</h1><p>${esc(subs.join(', '))} · ${F.students} student${F.students === 1 ? '' : 's'}</p></div></div>
      ${page({name, st: s, F, L, c, label: K().rangeL(r), rev, m}, 'dir')}`;
  }
  /* what's behind a figure */
  function drill(id, F, who, name){
    const f = F[id], rows = (f && f.rows) || [];
    openSheet(`<div class="hx"><div><h3>${esc(K().NAMES[id])}</h3><p class="note" style="margin:2px 0 0">${esc(name)}${f && f.n != null && K().CORE.some(c => c[0] === id) ? ` · ${f.k} of ${f.n}` : ''}</p></div><button class="ib" data-close>✕</button></div>
      <div class="card" style="margin:0">${rows.map(x => `<div class="it"><span class="kp-mk ${x.mk}">${MK[x.mk]}</span><span class="t"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${who === 'dir' && isDir() && x.left ? `<button class="btn sm" data-kleft="${esc(x.left)}">${x.mk === 'no' ? 'Undo' : 'Left'}</button>` : ''}${who === 'dir' && isDir() && x.obs ? `<button class="ib" data-kunobs="${esc(x.obs)}" aria-label="Remove">✕</button>` : ''}</div>`).join('') || '<p class="empty" style="padding:10px 16px">Nothing in this period.</p>'}</div>`);
    document.querySelectorAll('[data-kleft]').forEach(b => b.onclick = () => leftSheet(b.dataset.kleft, b.textContent === 'Undo'));
    document.querySelectorAll('[data-kunobs]').forEach(b => b.onclick = async () => { await post({action: 'unobs', id: b.dataset.kunobs}); closeSheet(); });
  }
  async function post(body){ try{ await hub.api('kpi', {method: 'POST', body: JSON.stringify(body)}); await hub.pull(); memo = {}; render(); toast('Saved'); return true; }catch(e){ toast(e.message); return false; } }
  function leftSheet(key, undo){
    if(undo) return post({action: 'left', key, why: ''}).then(closeSheet);
    openSheet(`<div class="hx"><h3>Why did they stop?</h3><button class="ib" data-close>✕</button></div><div class="card" style="margin:0">${['Finished exams','Moved','Other'].map(w => `<button class="it" data-kwhy="${w}"><span class="t"><b>${w}</b></span><span class="chev">›</span></button>`).join('')}</div><p class="note">Not counted against the tutor.</p>`);
    document.querySelectorAll('[data-kwhy]').forEach(b => b.onclick = async () => { await post({action: 'left', key, why: b.dataset.kwhy}); closeSheet(); });
  }
  function obsSheet(name, C){
    const from = K().add(C.t, -30), S = C.entries.filter(e => e && !e.x && e.ty === 's' && K().nk(e.tutor) === K().nk(name) && e.d >= from && e.a !== 'absent' && e.a !== 'cancelled').sort((a, b) => b.d.localeCompare(a.d)).slice(0, 40);
    const sc = {}, draw = () => {
      openSheet(`<div class="hx"><div><h3>Observation</h3><p class="note" style="margin:2px 0 0">${esc(name)}</p></div><button class="ib" data-close>✕</button></div>
        <label class="f"><span>Session</span><select class="in" id="kSes">${S.map((e, i) => `<option value="${i}">${esc(K().dl(e.d))} · ${esc(e.st)} · ${esc(e.sub)}${e.md === 'o' ? ' · online' : ''}</option>`).join('') || '<option value="">No sessions in the last 30 days</option>'}</select></label>
        ${K().CRIT.map(cr => `<div class="kp-crit"><span>${esc(cr)}</span><div class="kp-sc">${[1,2,3,4,5].map(n => `<button class="${sc[cr] === n ? 'on' : ''}" data-ksc="${esc(cr)}|${n}">${n}</button>`).join('')}</div></div>`).join('')}
        <label class="f"><span>Notes</span><textarea class="in" id="kObsN" rows="3"></textarea></label><button class="btn n full" id="kObsSave">Save</button>`);
      document.querySelectorAll('[data-ksc]').forEach(b => b.onclick = () => { const [cr, n] = b.dataset.ksc.split('|'); const nt = document.getElementById('kObsN').value, ss = document.getElementById('kSes').value; sc[cr] = sc[cr] === +n ? 0 : +n; draw(); document.getElementById('kObsN').value = nt; document.getElementById('kSes').value = ss; });
      document.getElementById('kObsSave').onclick = async () => { const e = S[+document.getElementById('kSes').value]; if(!e) return toast('Choose the session');
        if(await post({action: 'obs', tutor: name, d: e.d, st: e.st, sub: e.sub, md: e.md === 'o' ? 'online' : 'in person', c: sc, n: document.getElementById('kObsN').value})) closeSheet(); };
    };
    draw();
  }
  function bindDir(){
    document.querySelectorAll('[data-perk]').forEach(b => b.onclick = () => { st.per = b.dataset.perk; st.off = 0; render(); });
    document.querySelectorAll('[data-koff]').forEach(b => b.onclick = () => { st.off = Math.max(0, st.off + +b.dataset.koff); render(); });
    if(!cur) return;
    document.querySelectorAll('[data-kd]').forEach(b => b.onclick = () => drill(b.dataset.kd, cur.F, 'dir', cur.name));
    document.querySelectorAll('[data-kobs]').forEach(b => b.onclick = () => obsSheet(cur.name, cur.C));
    document.querySelectorAll('[data-kfocus]').forEach(b => b.onclick = () => { const id = b.dataset.kfocus; st.focus = st.focus.includes(id) ? st.focus.filter(x => x !== id) : st.focus.concat(id).slice(-2); const n = document.getElementById('kNote').value, u = document.getElementById('kUntil').value; render(); document.getElementById('kNote').value = n; document.getElementById('kUntil').value = u; });
    const sv = document.getElementById('kRevSave'); if(sv) sv.onclick = () => post({action: 'rev', tutor: cur.name, m: cur.C.t.slice(0, 7), note: document.getElementById('kNote').value, focus: st.focus, until: document.getElementById('kUntil').value});
  }
  const route = (a1) => { if(!a1){ cur = null; st.focus = null; return listPage(); } const n = decodeURIComponent(a1); if(!cur || cur.name !== n) st.focus = null; return tutorPage(n); };

  /* the Director's Home: who is falling short or slipping, and reviews to write after the 25th */
  function attention(){
    if(!may()) return [];
    const C = ctx(), L = cached('list', () => K().tutors(C).map(n => ({n, s: K().status(C, n)}))), out = [];
    L.filter(x => x.s.lvl === 'short').forEach(x => out.push({kind: 'kpi', col: 'var(--rd)', t: `${x.n}: falling short`, s: K().why(x.s), href: '#kpi/' + tId(x.n)}));
    const sl = L.filter(x => x.s.lvl === 'slip'); if(sl.length) out.push({kind: 'kpi', col: 'var(--am)', t: `${sl.length} tutor${sl.length > 1 ? 's' : ''} slipping`, s: sl.map(x => x.n).join(', '), href: '#kpi'});
    if(isDir() && +C.t.slice(8) >= 25){ const m = C.t.slice(0, 7), todo = L.filter(x => x.s.lvl !== 'none' && !((C.kpi.rev || {})[K().nk(x.n) + '|' + m] || {}).note); if(todo.length) out.push({kind: 'kpi', col: 'var(--muted)', t: `${todo.length} ${MON[+m.slice(5, 7) - 1]} review${todo.length > 1 ? 's' : ''} to write`, s: '', href: '#kpi'}); }
    return out;
  }

  /* ---------- the tutor's My performance (from the server) ---------- */
  let tdata = null, tkey = '';
  async function loadTutor(){ const k = st.tper + st.toff; if(tdata && tkey === k) return tdata; tdata = await hub.api(`kpi?per=${st.tper}&off=${st.toff}`); tkey = k; return tdata; }
  function tutorView(rerender){
    if(!tdata || tkey !== st.tper + st.toff){ loadTutor().then(rerender).catch(e => { tdata = {err: e.message}; rerender(); }); return '<p class="empty">Loading…</p>'; }
    if(tdata.err) return `<p class="empty">${esc(tdata.err)}</p>`;
    if(tdata.off) return '<p class="empty">Not available.</p>';
    return page({name: tdata.name, st: tdata.st, F: tdata.F, L: tdata.L, c: tdata.c, label: tdata.label, rev: tdata.rev, m: tdata.m}, 'tutor');
  }
  function bindTutor(rerender){
    document.querySelectorAll('[data-tperk]').forEach(b => b.onclick = () => { st.tper = b.dataset.tperk; st.toff = 0; rerender(); });
    document.querySelectorAll('[data-koff]').forEach(b => b.onclick = () => { st.toff = Math.max(0, st.toff + +b.dataset.koff); rerender(); });
    document.querySelectorAll('[data-kd]').forEach(b => b.onclick = () => tdata && drill(b.dataset.kd, tdata.F, 'tutor', tdata.name));
    document.querySelectorAll('[data-kseen]').forEach(b => b.onclick = async () => { try{ await hub.api('kpi', {method: 'POST', body: JSON.stringify({action: 'seen', m: tdata.m})}); tdata = null; rerender(); }catch(e){ toast(e.message); } });
  }
  const tutorOn = () => { try{ return !!(window.TEACH_KPI_ON); }catch(e){ return false; } };

  const css = document.createElement('style');
  css.textContent = `.kp-f{display:grid;grid-template-columns:minmax(0,1fr) auto 14px;gap:2px 10px;align-items:center;padding:11px 14px;border:0;border-top:1px solid var(--line2);width:100%;background:none;text-align:left;cursor:pointer;font:inherit;color:var(--ink)}
.card>.kp-f:first-child{border-top:0}.kp-f:hover:not(:disabled){background:var(--hover)}.kp-f:disabled{cursor:default}.kp-f b{font-size:14.5px}.kp-f .v{font-size:18px;font-weight:800;text-align:right;white-space:nowrap}.kp-f .chev{color:var(--muted)}
.kp-f small{grid-column:1/-1;color:var(--muted);font-size:12.5px;display:flex;gap:10px;flex-wrap:wrap}.kp-f .v .kp-st{margin-left:6px;vertical-align:2px}
.kp-bar{height:6px;border-radius:99px;background:var(--line2);position:relative;grid-column:1/-1;margin-top:4px}.kp-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--accent)}.kp-bar em{position:absolute;top:-3px;width:2px;height:12px;background:var(--gold)}.kp-bar u{position:absolute;top:-3px;width:2px;height:12px;background:var(--muted);opacity:.6}
.kp-few{font-size:11px;font-weight:800;padding:1px 6px;border-radius:6px;background:var(--am-bg);color:var(--am)}.kp-run{font-size:11px;font-weight:800;padding:1px 6px;border-radius:6px;background:var(--rd-bg);color:var(--rd)}
.kp-st{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:13px;white-space:nowrap}.kp-st i{width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-style:normal;font-size:11px;font-weight:900}
.kp-st.ok{color:var(--ok)}.kp-st.ok i{background:var(--ok);color:#fff}.kp-st.am{color:var(--am)}.kp-st.am i{background:var(--gold);color:#14213d}.kp-st.rd{color:var(--rd)}.kp-st.rd i{background:var(--rd);color:#fff}.kp-st.no{color:var(--muted)}.kp-st.no i{border:2px solid var(--muted)}
.kp-ban{display:flex;gap:12px;align-items:center;border-radius:16px;padding:12px 14px;margin-bottom:12px;border:1px solid var(--line)}.kp-ban.rd{background:var(--rd-bg)}.kp-ban.am{background:var(--am-bg)}.kp-ban.ok{background:var(--ok-bg)}.kp-ban.no{background:var(--surface2)}.kp-ban b{display:block;font-size:16px}.kp-ban small{color:var(--muted);font-size:12.5px}
.kp-big{font-size:20px;font-weight:900;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:none}.rd>.kp-big{background:var(--rd);color:#fff}.am>.kp-big{background:var(--gold);color:#14213d}.ok>.kp-big{background:var(--ok);color:#fff}.no>.kp-big{border:2px solid var(--muted);color:var(--muted)}
.kp-nav{display:flex;gap:8px;align-items:center;margin-bottom:12px;max-width:420px}.kp-nav b{flex:1;text-align:center;border:1px solid var(--line);border-radius:12px;padding:8px;background:var(--surface)}.kp-nav .ib:disabled{opacity:.3}
.kp-mk{flex:none;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900}.kp-mk.ok{background:var(--ok);color:#fff}.kp-mk.bad{background:var(--gold);color:#14213d}.kp-mk.rd{background:var(--rd);color:#fff}.kp-mk.no{border:2px solid var(--muted)}
.kp-lab{font-size:12px;font-weight:800;color:var(--muted);margin:10px 0 4px}.kp-tk{display:flex;gap:10px;align-items:center;padding:9px 2px;border:0;border-top:1px solid var(--line2);background:none;width:100%;text-align:left;font:inherit;font-size:14px;color:var(--ink);cursor:pointer}
.kp-tk i{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-style:normal;font-size:11px;font-weight:900;color:transparent;flex:none}.kp-tk.on i{background:var(--ok);border-color:var(--ok);color:#fff}
.kp-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.kp-crit{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line2);font-size:14px;flex-wrap:wrap}
.kp-sc{display:flex;gap:6px}.kp-sc button{width:38px;height:36px;border-radius:10px;border:1.5px solid var(--line);background:var(--surface);font:inherit;font-weight:800;cursor:pointer;color:var(--ink)}.kp-sc button.on{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}`;
  document.head.appendChild(css);
  return {route, bindDir, attention, tutorView, bindTutor, may, conf};
})();
