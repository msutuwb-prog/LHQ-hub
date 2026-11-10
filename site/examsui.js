/* LHQ Hub › exams on screen, for everyone: the Exam timetable (exam, then series; search across all), My exams,
   a subject's target block (target, On track, last 3, days to the exams, pace) and the sheet to set a target.
   Rules live in exams.js; staff read kv lhq_targets / lhq_myexams from the store, tutors and families get an exam pack
   ({targets, myexams, subs, set}) from the server. Saving goes to /api/hub/exams. */
window.EXUI = (function(){
  const E = () => window.EXAMS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dl = d => { const x = new Date(d + 'T12:00:00Z'); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
  const dly = d => dl(d) + ' ' + d.slice(0, 4);
  const when = p => p.b && p.b !== p.a ? `${dl(p.a)} – ${dl(p.b)}` : dl(p.a);
  /* papers of one syllabus on the same day (Core and Extended) as one line */
  const grp = P => { const out = []; P.forEach(p => { const g = out.find(x => x.p.code === p.code && x.p.a === p.a && x.p.b === p.b && x.p.ex === p.ex); if(g) g.L.push(p); else out.push({p, L: [p]}); }); return out; };
  const glabel = g => `${g.p.code}/${g.L.map(p => p.comp + (p.ct ? ' ' + p.ct : '')).join(' · ')}`;
  const T = () => window.today ? today() : new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
  const setOf = () => (window.settingsKV ? settingsKV() : {}) || {};

  /* ---------- a subject: target, on track, exams, pace ---------- */
  /* pack: {targets, subs, set}; k: student|subject; w: that subject's marked assessments [{d, p}] */
  function info(k, pack, w){
    const ex = E(), set = Object.assign({}, setOf(), (pack && pack.set) || {}), tg = ((pack && pack.targets) || {})[k], s = ((pack && pack.subs) || {})[k] || {}, card = s.card || null, t = T();
    const c = tg && tg.ex ? {ex: tg.ex, code: tg.code || (card && card.ex === tg.ex ? card.code : ''), as: tg.ex === 'A' ? (tg.as == null ? 1 : +tg.as) : 0, g: tg.g || '', by: tg.by || '', at: tg.at || 0}
      : Object.assign({g: '', by: '', at: 0}, card || {});
    const sc = c.ex ? ex.scale(c.ex, c.code) : null, tp = c.g && sc ? ex.pctOf(c.g, sc, set) : null, ot = ex.onTrack(w || [], tp);
    const first = c.code ? ex.firstPaper(c, set, t) : null, papers = c.code ? ex.papersFor(c, set, t) : [];
    const pc = first ? ex.pace(s.done || 0, s.topics || 0, s.from || '', first.a, t) : null;
    return {k, c, sc, tp, ot, first, papers, days: first ? ex.days(t, first.a) : null, pace: pc, set};
  }
  const STAT = i => !i.c.g ? `<span class="ex-st no"><i></i>No target</span>` : i.ot.ok == null ? `<span class="ex-st no"><i></i>No marks yet</span>`
    : i.ot.ok ? `<span class="ex-st ok"><i>✓</i>On track</span>` : `<span class="ex-st bad"><i>!</i>Below ${esc(i.c.g)}</span>`;
  const examName = c => !c.ex ? 'Exam not set' : `${E().EXS[c.ex]}${c.ex === 'A' ? (c.as ? ' + AS' : '') : ''}${c.code ? ' ' + c.code : ''}`;
  /* the block on a subject's page; setAttr: the button's data attribute when this person may change it */
  function block(i, setAttr, full){
    const pb = i.pace;
    return `<div class="card pad ex-blk"><div class="ex-row"><span><span class="ex-cap">Target</span><span class="ex-g">${i.c.g ? esc(i.c.g) : '—'}${i.tp != null ? ` <small>· ${i.tp}%</small>` : ''}</span></span>${STAT(i)}</div>
      <div class="ex-kv"><div><span>Last 3</span><b>${i.ot.avg != null ? i.ot.avg + '%' : '–'}</b></div><div><span>Exams</span><b>${i.days != null ? (i.days > 0 ? i.days + ' days' : 'now') : '–'}</b></div><div><span>Pace</span><b>${pb ? E().paceL(pb) : '–'}</b></div></div>
      <p class="ex-sub">${esc(examName(i.c))}${i.first ? ' · ' + dly(i.first.a) : ''}</p>
      ${setAttr ? `<button class="btn sm" ${setAttr} style="margin-top:10px">${i.c.g ? 'Change target' : 'Set target'}</button>` : ''}</div>
      ${full && pb ? `<div class="h2">Syllabus</div><div class="card pad"><div class="ex-row"><b>${pb.done} of ${pb.total} topics</b><span class="ex-st ${pb.diff >= 0 ? 'ok' : 'bad'}"><i>${pb.diff >= 0 ? '✓' : '!'}</i>${E().paceL(pb)}</span></div><div class="ex-bar"><i style="width:${Math.min(100, pb.done / pb.total * 100)}%"></i><em style="left:${Math.min(100, pb.need / pb.total * 100)}%"></em></div></div>` : ''}
      ${full && i.papers.length ? `<div class="h2">Exams</div><div class="card">${grp(i.papers).map(g => { const p = g.p; return `<div class="it"><span class="t"><b>${esc(glabel(g))}</b><small>${p.ex === 'AS' && i.c.ex === 'A' ? 'AS · ' : ''}${when(p)}${p.b ? '' : ' ' + p.a.slice(0, 4)}</small></span>${(p.b || p.a) >= T() ? `<span class="ex-dd">${Math.max(0, E().days(T(), p.a))} d</span>` : ''}</div>`; }).join('')}</div>` : ''}`;
  }
  /* one line in a list (LHQ's Marks tab, a tutor's students) */
  const row = (i, label, attr) => `<${attr ? `button class="it" ${attr}` : 'div class="it"'}><span class="ex-gr">${i.c.g ? esc(i.c.g) : '—'}</span><span class="t"><b>${esc(label)}${i.ot.avg != null ? ' · ' + i.ot.avg + '%' : ''}</b><small>${[examName(i.c), i.days != null ? (i.days > 0 ? i.days + ' days' : 'sitting now') : '', i.pace ? E().paceL(i.pace) : ''].filter(Boolean).map(esc).join(' · ')}</small></span>${STAT(i)}${attr ? '<span class="chev">›</span>' : ''}</${attr ? 'button' : 'div'}>`;

  /* ---------- the sheet to set a target ---------- */
  function targetSheet(o){   // o: {k, name, sub, i, onSaved}
    const st = {ex: o.i.c.ex || 'I', code: o.i.c.code || '', as: o.i.c.ex === 'A' ? o.i.c.as : 1, g: o.i.c.g || ''};
    const draw = () => {
      const ex = E(), sr = ex.nextSeries(st.ex, setOf(), T()) || ex.series(st.ex, setOf())[0], subs = sr ? ex.subjects(sr.sr, st.ex, setOf()) : [];
      if(st.code && !subs.some(s => s.code === st.code)) subs.unshift({code: st.code, name: 'Syllabus', ex: st.ex});
      const sc = ex.scale(st.ex, st.code), G = ex.GRADES[sc]; if(st.g && !G.includes(st.g)) st.g = '';
      openSheet(`<div class="hx"><h3>${esc(o.sub)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(o.name)}</p>
        <div class="ex-lab">Exam</div><div class="ex-pick">${ex.EX.map(([k, l]) => `<button class="${st.ex === k ? 'on' : ''}" data-exx="${k}">${esc(k === 'L' ? 'Lower Secondary' : k === 'P' ? 'Primary' : ex.EXS[k])}</button>`).join('')}</div>
        <label class="f"><span>Syllabus</span><select class="in" id="exCode"><option value="">Choose…</option>${subs.map(s => `<option value="${s.code}" ${s.code === st.code ? 'selected' : ''}>${esc(ex.subjName(s))} · ${s.code}</option>`).join('')}</select></label>
        ${st.ex === 'A' ? `<button class="f-opt ex-opt ${st.as ? 'on' : ''}" data-exas><span class="ex-tk ${st.as ? 'on' : ''}">✓</span>AS papers too</button>` : ''}
        <div class="ex-lab">Target</div><div class="ex-grades">${G.map(g => `<button class="${st.g === g ? 'on' : ''}" data-exg="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        ${o.i.c.by ? `<p class="note">Set by ${esc(o.i.c.by)}</p>` : ''}
        <button class="btn n full" id="exSave">Save</button>${o.i.c.g || o.i.c.by ? '<button class="btn full" id="exClear" style="margin-top:8px">Clear</button>' : ''}`);
      document.querySelectorAll('[data-exx]').forEach(b => b.onclick = () => { if(st.ex !== b.dataset.exx){ st.ex = b.dataset.exx; st.code = ''; } draw(); });
      document.querySelectorAll('[data-exg]').forEach(b => b.onclick = () => { st.g = st.g === b.dataset.exg ? '' : b.dataset.exg; draw(); });
      document.querySelectorAll('[data-exas]').forEach(b => b.onclick = () => { st.as = st.as ? 0 : 1; draw(); });
      const cs = document.getElementById('exCode'); if(cs) cs.onchange = () => { st.code = cs.value; draw(); };
      const save = async clear => { try{ await hub.api('exams', {method: 'POST', body: JSON.stringify(Object.assign({action: 'target', k: o.k, name: o.name, sub: o.sub}, clear ? {g: '', ex: ''} : st))}); closeSheet(); toast(clear ? 'Cleared' : 'Saved'); o.onSaved && o.onSaved(); }catch(e){ toast(e.message); } };
      document.getElementById('exSave').onclick = () => { if(!st.code) return toast('Choose the syllabus'); save(false); };
      const cl = document.getElementById('exClear'); if(cl) cl.onclick = () => save(true);
    };
    draw();
  }

  /* ---------- the timetable: exam, then series; search covers every exam ---------- */
  const tt = {exam: null, sr: '', q: '', open: '', withAS: true};
  try{ Object.assign(tt, JSON.parse(localStorage.getItem('lhq_tt') || '{}'), {q: '', open: ''}); }catch(e){}
  const keep = () => { try{ localStorage.setItem('lhq_tt', JSON.stringify({exam: tt.exam, withAS: tt.withAS})); }catch(e){} };
  let mineCtx = null;   // students: {mine: [{code, ex, as}], lhq: [{code, ex}], save(list)}
  const isMine = (s, M) => (M || []).some(m => m.code === s.code && (m.ex === s.ex || (s.ex === 'AS' && m.ex === 'A' && m.as)));
  function subjRow(s, sr){
    const ex = E(), k = s.code + '|' + s.ex, op = tt.open === k + '|' + sr, P = s.ex === 'A' && tt.withAS ? ex.papersFor({code: s.code, ex: 'A', as: 1}, setOf(), '', sr) : s.papers;
    const M = mineCtx, mine = M && isMine(s, M.mine), lhq = M && isMine(s, M.lhq);
    return `<button class="it" data-ttopen="${k}|${sr}"><span class="t"><b>${esc(ex.subjName(s))}</b><small>${s.code} · ${ex.EXL[s.ex]}</small></span>${mine || lhq ? '<span class="ex-st ok"><i>✓</i></span>' : ''}<span class="chev">${op ? '⌃' : '›'}</span></button>
      ${op ? `<div class="ex-pp">${grp(P).map(g => `<div class="ex-row ex-pl"><span>${esc(glabel(g))}${g.p.ex === 'AS' && s.ex === 'A' ? ' <span class="ex-as">AS</span>' : ''}</span><b>${when(g.p)}</b></div>`).join('')}
        ${M ? (lhq ? '<span class="ex-note">✓ From LHQ</span>' : `<button class="btn sm${mine ? '' : ' n'}" data-ttmine="${k}">${mine ? '✓ In My exams' : '+ My exams'}</button>`) : ''}</div>` : ''}`;
  }
  function timetableList(){
    const ex = E(), set = setOf(), q = tt.q.trim().toLowerCase(), hit = s => !q || (s.name + ' ' + s.code).toLowerCase().includes(q);
    const S = ex.series(tt.exam, set, T()), cur = S.find(s => s.sr === tt.sr) || S.find(s => s.loaded) || S[0];
    if(!cur) return '<p class="empty">No series.</p>';
    const here = cur.loaded ? ex.subjects(cur.sr, tt.exam, set).filter(hit) : [];
    const other = q ? ex.EX.map(([k]) => k).filter(k => k !== tt.exam).flatMap(k => { const n = ex.nextSeries(k, set, T()); return n ? ex.subjects(n.sr, k, set).filter(hit).map(s => [s, n.sr]) : []; }) : [];
    return (cur.loaded ? (here.length ? `<div class="card">${here.map(s => subjRow(s, cur.sr)).join('')}</div>` : `<p class="empty">Nothing in ${esc(ex.EXL[tt.exam])}.</p>`) : `<p class="empty">Cambridge hasn't published ${esc(cur.name)} yet.</p>`)
      + (other.length ? `<div class="h2">Other exams</div><div class="card">${other.slice(0, 40).map(([s, sr]) => subjRow(s, sr)).join('')}</div>` : '');
  }
  function timetable(back){
    const ex = E(), set = setOf();
    if(!tt.exam){ tt.exam = 'I'; }
    const S = ex.series(tt.exam, set, T()); if(!S.some(s => s.sr === tt.sr)) tt.sr = (S.find(s => s.loaded) || S[0] || {}).sr || '';
    return `${back || ''}<div class="ph"><div class="tt"><h1>Exam timetable</h1><p>Zone ${esc((window.EXAMDATA || {}).zone || '3')} · Malawi</p></div>${mineCtx ? '<div class="acts"><a class="btn" href="#me/exams">My exams</a></div>' : ''}</div>
      <div class="ex-exs">${ex.EX.map(([k, l]) => `<button class="${tt.exam === k ? 'on' : ''}" data-ttex="${k}">${k === 'P' ? 'Primary<small>Checkpoint</small>' : k === 'L' ? 'Lower Secondary<small>Checkpoint</small>' : esc(l)}</button>`).join('')}</div>
      <div class="chips">${S.map(s => `<button class="chip${tt.sr === s.sr ? ' on' : ''}" data-ttsr="${s.sr}">${esc(s.name)}${s.loaded ? '' : ' · soon'}</button>`).join('')}${tt.exam === 'A' ? `<button class="chip${tt.withAS ? ' on' : ''}" data-ttas>+ AS papers</button>` : ''}</div>
      <input class="in ex-q" id="ttQ" placeholder="Subject or code" value="${esc(tt.q)}" autocomplete="off">
      <div id="ttList">${timetableList()}</div>`;
  }
  function bindTimetable(rerender){
    const list = () => { const el = document.getElementById('ttList'); if(el){ el.innerHTML = timetableList(); bindRows(); } };
    const bindRows = () => {
      document.querySelectorAll('[data-ttopen]').forEach(b => b.onclick = () => { tt.open = tt.open === b.dataset.ttopen ? '' : b.dataset.ttopen; list(); });
      document.querySelectorAll('[data-ttmine]').forEach(b => b.onclick = async () => { if(!mineCtx) return; const [code, exk] = b.dataset.ttmine.split('|');
        const M = mineCtx.mine.slice(), i = M.findIndex(m => m.code === code && m.ex === exk);
        if(i >= 0) M.splice(i, 1); else M.push({code, ex: exk, as: exk === 'A' && tt.withAS ? 1 : 0});
        try{ await mineCtx.save(M); mineCtx.mine = M; list(); toast(i >= 0 ? 'Removed' : 'Added to My exams'); }catch(e){ toast(e.message); } });
    };
    document.querySelectorAll('[data-ttex]').forEach(b => b.onclick = () => { tt.exam = b.dataset.ttex; tt.sr = ''; tt.open = ''; keep(); rerender(); });
    document.querySelectorAll('[data-ttsr]').forEach(b => b.onclick = () => { tt.sr = b.dataset.ttsr; tt.open = ''; rerender(); });
    document.querySelectorAll('[data-ttas]').forEach(b => b.onclick = () => { tt.withAS = !tt.withAS; keep(); rerender(); });
    const q = document.getElementById('ttQ'); if(q) q.oninput = () => { tt.q = q.value; list(); };
    bindRows();
  }
  const setMine = ctx => { mineCtx = ctx; };

  /* ---------- My exams: every paper of the student's subjects (LHQ's and the ones they added), by month ---------- */
  function myExams(choices, back, canAdd){   // choices: [{code, ex, as, name?, lhq?, removable?}]
    const ex = E(), set = setOf(), t = T(), P = [];
    choices.forEach(c => ex.papersFor(c, set, t).forEach(p => P.push({c, p})));
    P.sort((a, b) => a.p.a.localeCompare(b.p.a) || a.p.code.localeCompare(b.p.code));
    const up = P.filter(e => (e.p.b || e.p.a) >= t), first = up.find(e => !e.p.b) || up[0], byM = {};
    const G = []; up.forEach(e => { const g = G.find(x => x.c === e.c && x.p.code === e.p.code && x.p.a === e.p.a && x.p.b === e.p.b && x.p.ex === e.p.ex); if(g) g.L.push(e.p); else G.push({c: e.c, p: e.p, L: [e.p]}); });
    G.forEach(e => { const m = MON[+e.p.a.slice(5, 7) - 1] + ' ' + e.p.a.slice(0, 4); (byM[m] = byM[m] || []).push(e); });
    const nm = c => { const s = Object.keys((window.EXAMDATA || {}).series || {}).flatMap(sr => ex.subjects(sr, c.ex, set)).find(y => y.code === c.code); return s ? ex.subjName(s) : c.code; };
    return `${back || ''}<div class="ph"><div class="tt"><h1>My exams</h1><p>${choices.length} subject${choices.length === 1 ? '' : 's'}</p></div><div class="acts"><a class="btn" href="#exams">${canAdd ? '+ Add' : 'Timetable'}</a></div></div>
      ${first ? `<div class="card pad ex-cd"><span class="n">${Math.max(0, ex.days(t, first.p.a))}</span><span><b>days to the first paper</b><small>${esc(nm(first.c))} · ${dly(first.p.a)}</small></span></div>` : ''}
      <div class="h2">Subjects</div><div class="card">${choices.map(c => `<div class="it"><span class="t"><b>${esc(nm(c))}</b><small>${c.code ? c.code + ' · ' : ''}${esc(ex.EXL[c.ex] || 'Exam not set')}${c.ex === 'A' ? (c.as ? ' + AS' : ' only') : ''}${c.lhq ? ' · LHQ' : ''}</small></span>${c.removable ? `<button class="ib" data-myrm="${c.code}|${c.ex}" aria-label="Remove">✕</button>` : ''}</div>`).join('') || '<p class="empty">None yet.</p>'}</div>
      ${Object.entries(byM).map(([m, L]) => `<div class="h2">${m}</div><div class="card">${L.map(e => `<div class="it"><span class="t"><b>${esc(nm(e.c))}</b><small>${esc(glabel(e))}${e.p.ex === 'AS' && e.c.ex === 'A' ? ' · AS' : ''}</small></span><b class="ex-when">${when(e.p)}</b></div>`).join('')}</div>`).join('') || (choices.length ? '<p class="empty">No dates yet for these.</p>' : '')}`;
  }

  /* ---------- staff: an exam pack built from the store (cards, logs, targets) ---------- */
  let libs = null;
  function ensureLibs(after){
    if(window.TOPICS && window.cardTopicNames) return true;
    if(!libs){ const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
      libs = load('topics.js').then(() => load('card.js')).then(() => after && after()).catch(() => {}); }
    return false;
  }
  function staffPack(items, entries){
    const subs = {};
    items.forEach(it => { const fin = new Set(); (entries || []).forEach(e => { if(e.k === it.k && e.ty === 's' && !e.x) (e.fin || []).forEach(f => fin.add(f)); });
      let n = 0; try{ if(window.cardTopicNames) n = cardTopicNames(JSON.parse(JSON.stringify(it.x))).length; }catch(e){}
      subs[it.k] = {card: E().fromCard(it.x), topics: n, done: fin.size, from: ((it.periods || [])[0] || {}).a || it.pa || ''}; });
    return {targets: store.get('lhq_targets', {}) || {}, myexams: store.get('lhq_myexams', {}) || {}, subs, set: {}};
  }

  const css = document.createElement('style');
  css.textContent = `.ex-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.ex-cap{display:block;font-size:12px;font-weight:700;color:var(--muted)}.ex-g{font-size:28px;font-weight:800;line-height:1.1;color:var(--brand)}.ex-g small{font-size:14px;color:var(--muted);font-weight:700}[data-theme=dark] .ex-g{color:var(--ink)}
.ex-st{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:13px;white-space:nowrap}.ex-st i{width:18px;height:18px;border-radius:50%;display:inline-grid;place-items:center;font-style:normal;font-size:11px;font-weight:900}
.ex-st.ok{color:var(--ok)}.ex-st.ok i{background:var(--ok);color:#fff}.ex-st.bad{color:var(--am)}.ex-st.bad i{background:var(--gold);color:#14213d}.ex-st.no{color:var(--muted)}.ex-st.no i{border:2px solid var(--muted)}
.ex-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.ex-kv div{background:var(--surface2);border:1px solid var(--line2);border-radius:12px;padding:8px 10px;min-width:0}.ex-kv span{display:block;font-size:11.5px;color:var(--muted);font-weight:700}.ex-kv b{font-size:16px;overflow-wrap:anywhere}
.ex-sub{margin:10px 0 0;font-size:12.5px;color:var(--muted)}
.ex-bar{height:10px;border-radius:99px;background:var(--line2);position:relative;margin:10px 0 2px}.ex-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--accent)}.ex-bar em{position:absolute;top:-4px;width:3px;height:18px;border-radius:2px;background:var(--gold)}
.ex-gr{flex:none;display:inline-grid;place-items:center;min-width:34px;height:30px;padding:0 6px;border-radius:9px;background:var(--surface2);border:1px solid var(--line);font-weight:800;white-space:nowrap;font-size:13px}
.ex-exs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.ex-exs button{flex:1 1 auto;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:8px 10px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;color:var(--ink);line-height:1.15;white-space:nowrap}
.ex-exs button small{display:block;font-size:10.5px;font-weight:700;color:var(--muted)}.ex-exs button.on{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}.ex-exs button.on small{color:inherit;opacity:.8}
.ex-q{margin-bottom:12px;width:100%}.ex-pp{padding:0 14px 12px}.ex-pl{padding:7px 0;border-top:1px solid var(--line2);font-size:14px}.ex-pl b{white-space:nowrap}.ex-pp .btn{margin-top:8px}.ex-note{display:inline-block;margin-top:8px;font-weight:800;font-size:13px;color:var(--ok)}
.ex-cd{display:flex;gap:12px;align-items:center}.ex-cd .n{font-size:28px;font-weight:800;color:var(--brand)}[data-theme=dark] .ex-cd .n{color:var(--gold)}.ex-cd small{display:block;color:var(--muted);font-size:12.5px}.ex-dd{flex:none;font-size:12px;font-weight:800;color:var(--muted);white-space:nowrap}.ex-as{font-size:11px;font-weight:800;padding:1px 6px;border-radius:6px;border:1px solid var(--line);color:var(--muted)}.ex-when{white-space:nowrap;font-size:13.5px}
.ex-lab{font-size:12px;font-weight:800;color:var(--muted);margin:12px 0 6px}.ex-pick,.ex-grades{display:flex;flex-wrap:wrap;gap:6px}.ex-pick button,.ex-grades button{min-width:46px;min-height:40px;padding:6px 12px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);font:inherit;font-weight:800;cursor:pointer;color:var(--ink)}
.ex-pick button.on,.ex-grades button.on{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}
.ex-opt{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:11px 12px;margin:6px 0;font:inherit;font-weight:700;color:var(--ink);cursor:pointer}
.ex-tk{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-size:11px;font-weight:900;color:transparent}.ex-tk.on{background:var(--ok);border-color:var(--ok);color:#fff}`;
  document.head.appendChild(css);
  return {info, block, row, STAT, targetSheet, timetable, bindTimetable, setMine, myExams, staffPack, ensureLibs, examName, dl, dly, when};
})();
