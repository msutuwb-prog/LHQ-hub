/* LHQ Hub › app feedback, announcements and staff reports (Mockups 13 and 14, agreed 19–22 Nov).
   Feedback: a box in the daily reports and Settings › Report a problem; the sender only sees "Received ✓"; the Director's inbox.
   Announcements: Normal to the bell; Important as a strip on every page until "Got it" (before a birthday strip: one at a time).
   Reports: admin's daily report (the Hub fills in the day, admin adds the rest) and the Director's weekly report (internal). */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), tday = () => iso(new Date());
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const nice = s => { const d = parse(s); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
  const hm = at => { const d = new Date(at); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const ago = at => { const m = Math.round((Date.now() - at) / 6e4); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : nice(iso(new Date(at))); };
  const first = n => String(n || '').split(' ')[0];
  const toast = m => window.hubToast ? hubToast(m) : alert(m);
  const me = () => { try{ return (hub.session() || {}).me || {}; }catch(e){ return {}; } };
  const isStaff = () => ['director','admin'].includes(me().role), isDir = () => me().role === 'director';
  const mayAnn = () => isStaff() || (me().perms || []).includes('ann');
  const rerender = () => { if(window.hubApply) hubApply(); };
  const $ = id => document.getElementById(id);
  const mkS = n => { n = Math.round(+n || 0); return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'm' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); };
  const VER = 'v72';
  const dev = () => { const u = navigator.userAgent; return [/iPhone|iPad/.test(u) ? 'iPhone' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Computer', /Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : ''].filter(Boolean).join(' · '); };

  /* ---------- the app box (in daily reports) ---------- */
  const TY = [['broke','Something broke'],['looks','Looks wrong'],['slow','Slow'],['idea','Idea']], TYS = {broke:'Broke', looks:'Looks wrong', slow:'Slow', idea:'Idea'};
  const BX = {};
  function box(pre, where){
    const s = BX[pre] = BX[pre] || {ty:'', where: where[0], note:''};
    return `<div class="cm-box" data-cmbox="${pre}"><div class="cm-hd">🛠 The app <small>optional · only LHQ</small></div>
      <div class="chips" style="margin:0 0 8px">${TY.map(([k, l]) => `<button type="button" class="chip ${s.ty === k ? 'on' : ''}" data-cmty="${pre}|${k}">${l}</button>`).join('')}</div>
      ${s.ty ? `<label class="f" style="margin:0 0 6px"><span>Where</span><select class="in" data-cmwh="${pre}">${where.map(w => `<option ${s.where === w ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
      <textarea class="in" data-cmnote="${pre}" rows="2" placeholder="What happened, or what would help" style="min-height:56px">${esc(s.note)}</textarea><p class="note" style="margin:4px 0 0">Sent with: ${esc(dev())} · Hub ${VER}</p>` : ''}</div>`;
  }
  async function flush(pre){
    const s = BX[pre]; if(!s || !s.ty || !s.note.trim()) return;
    try{ await hub.api('fb', {method:'POST', body: JSON.stringify({action:'add', from:'report', ty:s.ty, where:s.where, note:s.note, dev: dev(), ver: VER, page: pre})}); delete BX[pre]; }catch(e){}
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-cmty]'); if(!b) return; e.preventDefault(); const [pre, k] = b.dataset.cmty.split('|'), s = BX[pre]; if(!s) return; s.ty = s.ty === k ? '' : k;
    const el = document.querySelector(`[data-cmbox="${pre}"]`); if(el) el.outerHTML = box(pre, WH[pre] || ['Somewhere else']); });
  document.addEventListener('input', e => { const t = e.target; if(t.dataset && t.dataset.cmnote && BX[t.dataset.cmnote]) BX[t.dataset.cmnote].note = t.value; });
  document.addEventListener('change', e => { const t = e.target; if(t.dataset && t.dataset.cmwh && BX[t.dataset.cmwh]) BX[t.dataset.cmwh].where = t.value; });
  const WH = {};
  const boxFor = (pre, where) => { WH[pre] = where; return box(pre, where); };

  /* ---------- Report a problem (everyone, in Settings) ---------- */
  const PR = {ty:'broke', where:'', note:'', way:'', sent:false};
  function problemPage(){
    if(PR.sent) return `<h2 class="sec-h">Report a problem</h2><div class="card pad" style="text-align:center;background:var(--ok-bg);border-color:transparent"><b style="color:var(--ok);font-size:18px">Received ✓</b><p class="note" style="margin:6px 0 0">Thanks${me().name ? ', ' + esc(first(me().name)) : ''}. LHQ reads every report.</p></div><button class="btn" data-prnew style="margin-top:12px">Report something else</button>`;
    const role = me().role, where = role === 'parent' ? ['Home','Sessions','Payments','Calendar','Somewhere else'] : role === 'student' ? ['Home','Practice','Calendar','Progress','Report','Somewhere else'] : role === 'tutor' ? ['Home','Log a session','SRAs','Calendar','Report','My pay','Somewhere else'] : ['Home','Students','Documents','Business','Reports','Calendar','Settings','Somewhere else'];
    if(!PR.where) PR.where = where[0];
    return `<h2 class="sec-h">Report a problem</h2><p class="sec-p">Bugs, things that look wrong, ideas. LHQ reads every one.</p>
      <div class="chips">${TY.map(([k, l]) => `<button type="button" class="chip ${PR.ty === k ? 'on' : ''}" data-prty="${k}">${l}</button>`).join('')}</div>
      <label class="f"><span>Where</span><select class="in" id="prW">${where.map(w => `<option ${PR.where === w ? 'selected' : ''}>${w}</option>`).join('')}</select></label>
      <label class="f"><span>What happened</span><textarea class="in" id="prN" rows="4">${esc(PR.note)}</textarea></label>
      <div class="f"><span>How much does it get in your way?</span><div class="chips" style="margin:4px 0 0">${[['little','A little'],['lot','A lot'],['cant',"Can't use it"]].map(([k, l]) => `<button type="button" class="chip ${PR.way === k ? 'on' : ''}" data-prway="${k}">${l}</button>`).join('')}</div></div>
      <p class="note" style="margin:0 0 12px">Sent with: ${esc(dev())} · Hub ${VER} · ${esc(role === 'director' ? 'Director' : role)}</p>
      <button class="btn n full" id="prGo">Send to LHQ</button>`;
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-prty],[data-prway],#prGo,[data-prnew]'); if(!t) return; e.preventDefault();
    if($('prN')) PR.note = $('prN').value; if($('prW')) PR.where = $('prW').value;
    if(t.dataset.prty){ PR.ty = t.dataset.prty; return rerender(); }
    if(t.dataset.prway){ PR.way = t.dataset.prway; return rerender(); }
    if(t.hasAttribute('data-prnew')){ Object.assign(PR, {ty:'broke', note:'', way:'', sent:false}); return rerender(); }
    if(t.id === 'prGo'){ if(!PR.note.trim()) return toast('Say what happened');
      try{ await hub.api('fb', {method:'POST', body: JSON.stringify({action:'add', from:'more', ty:PR.ty, where:PR.where, note:PR.note, way:PR.way, dev: dev(), ver: VER, page: PR.where})}); PR.sent = true; rerender(); }catch(err){ toast(err.message); } }
  });

  /* ---------- the Director's inbox ---------- */
  let FB = null, fbAt = 0, FBT = 'new';
  async function loadFb(force){ if(!isDir() || (!force && FB && Date.now() - fbAt < 60000)) return; try{ FB = (await hub.api('fb')).items; fbAt = Date.now(); rerender(); }catch(e){} }
  const STL = {new:'New', look:'Looking at it', fixed:'Fixed', wont:"Won't fix"};
  function inbox(){
    loadFb(); if(!isDir()) return '<p class="empty">This page is for the Director.</p>';
    const L = FB || [], n = k => L.filter(x => x.st === k).length, F = FBT === 'all' ? L : L.filter(x => FBT === 'look' ? x.st === 'look' : FBT === 'fixed' ? ['fixed','wont'].includes(x.st) : x.st === 'new');
    const row = x => `<button class="it cm-fb" data-fbo="${esc(x.id)}"><span class="cm-ty ${x.ty}">${TYS[x.ty]}</span><span class="t"><b>${esc(x.note.slice(0, 90))}</b><small>${esc(first(x.byN))} · ${esc(x.role)} · ${esc(x.where || x.page)} · ${esc(x.dev || '')}${x.way === 'cant' ? ' · <b style="color:var(--rd);display:inline">can\'t use it</b>' : x.way === 'lot' ? ' · a lot' : ''} · ${ago(x.at)}</small></span>${x.st !== 'new' ? `<span class="tag ${x.st === 'fixed' ? 'ok' : x.st === 'look' ? 'am' : ''}">${STL[x.st]}</span>` : ''}</button>`;
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>App feedback</h1><p>From reports and "Report a problem"</p></div></div>
      <div class="seg" style="margin-bottom:12px">${[['new','New ' + n('new')],['look','Looking at it ' + n('look')],['fixed','Done ' + (n('fixed') + n('wont'))],['all','All']].map(([k, l]) => `<a href="#" class="${FBT === k ? 'on' : ''}" data-fbt="${k}">${l}</a>`).join('')}</div>
      <div class="card one">${F.map(row).join('') || `<p class="empty">${FB ? 'Nothing here. ✓' : 'Loading…'}</p>`}</div><p class="note">The sender only sees "Received ✓". Notes here stay with LHQ.</p>`;
  }
  function fbSheet(id){
    const x = (FB || []).find(y => y.id === id); if(!x) return; let st = x.st;
    const draw = () => { openSheet(`<div class="hx"><h3>${TYS[x.ty]} · ${esc(x.where || '')}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(x.byN)} · ${esc(x.role)} · ${esc(x.dev || '')} · Hub ${esc(x.ver || '')} · ${nice(iso(new Date(x.at)))} ${hm(x.at)}${x.way ? ' · ' + ({little:'a little', lot:'a lot', cant:"can't use it"})[x.way] : ''}</p>
      <div class="card pad" style="margin-bottom:12px">${esc(x.note)}</div>
      <div class="chips">${Object.entries(STL).map(([k, l]) => `<button type="button" class="chip ${st === k ? 'on' : ''}" data-fbs="${k}">${l}</button>`).join('')}</div>
      <label class="f"><span>Note · only LHQ sees it</span><input class="in" id="fbN" value="${esc(x.lhq || '')}"></label><button class="btn n full" id="fbGo">Save</button>`);
      document.querySelectorAll('#sheet [data-fbs]').forEach(b => b.onclick = () => { st = b.dataset.fbs; const n = $('fbN').value; draw(); $('fbN').value = n; });
      $('fbGo').onclick = async () => { try{ await hub.api('fb', {method:'POST', body: JSON.stringify({action:'st', id, st, note: $('fbN').value})}); closeSheet(); toast('Saved'); loadFb(true); }catch(e){ toast(e.message); } }; };
    draw();
  }
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-fbo],[data-fbt]'); if(!t) return; e.preventDefault(); if(t.dataset.fbo) fbSheet(t.dataset.fbo); else { FBT = t.dataset.fbt; rerender(); } });
  /* counts for the Director's reports */
  const fbStats = () => { const L = FB || [], t = tday(); return {today: L.filter(x => iso(new Date(x.at)) === t), open: L.filter(x => ['new','look'].includes(x.st)), fixedM: L.filter(x => x.st === 'fixed' && x.stAt && iso(new Date(x.stAt)).slice(0, 7) === t.slice(0, 7)), all: L}; };

  /* ---------- announcements ---------- */
  let AN = null, anAt = 0, ANALL = null;
  async function loadAnn(force){ if(!window.hub || !hub.session() || (!force && AN && Date.now() - anAt < 120000)) return; try{ const j = await hub.api('ann' + (mayAnn() && /^#ann/.test(location.hash) ? '?all=1' : '')); AN = j.items || []; if(j.all) ANALL = j.all; anAt = Date.now(); rerender(); if(window.lhqBellRefresh) lhqBellRefresh(); }catch(e){} }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') anAt = 0; });
  const stripAnn = () => (AN || []).find(a => a.imp && !a.got);
  function after(){
    loadAnn();
    const m = $('main'); if(!m || !hub.session()) return;
    const old = $('cmStrip'); if(old) old.remove();
    const a = stripAnn(); if(!a) return;
    const pf = $('pfStrip'); if(pf) pf.remove();   // one strip at a time: the announcement first, the birthday once it's read
    m.insertAdjacentHTML('afterbegin', `<div class="cm-strip" id="cmStrip">📣<span class="t">${esc(a.t)}</span><button class="btn sm" data-annread="${esc(a.id)}">Read</button></div>`);
    if(!a.seen){ a.seen = true; hub.api('ann', {method:'POST', body: JSON.stringify({action:'seen', id: a.id})}).catch(() => {}); }
  }
  function annSheet(id){
    const a = (AN || []).find(x => x.id === id); if(!a) return;
    openSheet(`<div class="hx"><h3>${a.imp ? '📣 ' : ''}${esc(a.t)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(a.byN)} · ${ago(a.at)}${a.until ? ' · until ' + nice(a.until) : ''}</p>${a.body ? `<div class="card pad" style="white-space:pre-wrap;margin-bottom:12px">${esc(a.body)}</div>` : ''}
      ${a.got ? '<p class="note">✓ Got it</p>' : `<button class="btn n full" data-anngot="${esc(a.id)}">Got it</button>`}`);
    if(!a.seen){ a.seen = true; hub.api('ann', {method:'POST', body: JSON.stringify({action:'seen', id})}).catch(() => {}); }
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-annread],[data-annopen],[data-anngot],[data-annnew],[data-anndel]'); if(!t) return; e.preventDefault();
    if(t.dataset.annread || t.dataset.annopen) return annSheet(t.dataset.annread || t.dataset.annopen);
    if(t.dataset.annnew != null) return annNew();
    if(t.dataset.anndel){ try{ await hub.api('ann', {method:'POST', body: JSON.stringify({action:'del', id: t.dataset.anndel})}); toast('Taken down'); loadAnn(true); location.hash = '#ann'; }catch(err){ toast(err.message); } return; }
    const a = (AN || []).find(x => x.id === t.dataset.annget || x.id === t.dataset.anngot); if(a){ a.got = true; a.seen = true; }
    closeSheet(); rerender();
    try{ await hub.api('ann', {method:'POST', body: JSON.stringify({action:'got', id: t.dataset.anngot})}); }catch(err){}
    if(window.lhqBellRefresh) lhqBellRefresh();
  });
  /* the bell: Important not yet "Got it" needs you; the rest is news */
  function bell(){ const L = AN || []; return {need: L.filter(a => a.imp && !a.got).map(a => ({t: '📣 ' + a.t, s: a.byN, href: '#annview/' + a.id})), info: L.filter(a => !a.imp || a.got).slice(0, 8).map(a => ({t: a.t, s: a.byN + ' · announcement', href: '#annview/' + a.id, at: a.at}))}; }
  function markAllSeen(){ const ids = (AN || []).filter(a => !a.seen).map(a => a.id); if(ids.length){ (AN || []).forEach(a => a.seen = true); hub.api('ann', {method:'POST', body: JSON.stringify({action:'seen', ids})}).catch(() => {}); } }
  const AUD = {all:'Everyone', staff:'Staff', tutors:'Tutors', students:'Students', parents:'Parents', fams:'Some families'};
  function annNew(){
    const st = {aud:'all', imp:false, email:false, fams:[], t:'', body:'', until:''};
    const keep = () => { st.t = $('anT').value; st.body = $('anB').value; st.until = $('anU').value; };
    const draw = () => { const S = window.HD ? HD.students().slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
      openSheet(`<div class="hx"><h3>New announcement</h3><button class="ib" data-close>✕</button></div>
        <label class="f"><span>Title</span><input class="in" id="anT" maxlength="120" value="${esc(st.t)}" placeholder="e.g. Centre closed on Friday"></label>
        <label class="f"><span>Message</span><textarea class="in" id="anB" rows="4">${esc(st.body)}</textarea></label>
        <div class="f"><span>To</span><div class="chips" style="margin:4px 0 0">${Object.entries(AUD).map(([k, l]) => `<button type="button" class="chip ${st.aud === k ? 'on' : ''}" data-ana="${k}">${l}</button>`).join('')}</div></div>
        ${st.aud === 'fams' ? `<div class="chips" style="max-height:160px;overflow:auto">${S.map(x => `<button type="button" class="chip ${st.fams.includes(x.key) ? 'on' : ''}" data-anf="${esc(x.key)}">${esc(x.name)}</button>`).join('')}</div>` : ''}
        <div class="f"><span>How</span><div class="chips" style="margin:4px 0 0"><button type="button" class="chip ${st.imp ? '' : 'on'}" data-ani="0">Normal · in the bell</button><button type="button" class="chip ${st.imp ? 'on' : ''}" data-ani="1">Important · a strip until "Got it"</button></div></div>
        <div class="r2"><label class="f"><span>Until (optional)</span><input class="in" type="date" id="anU" value="${esc(st.until)}"></label><div class="f"><span>Email too</span><div class="chips" style="margin:4px 0 0"><button type="button" class="chip ${st.email ? 'on' : ''}" data-ane>${st.email ? 'Yes' : 'No'}</button></div></div></div>
        <div class="r2"><button class="btn" id="anWa">Copy for WhatsApp</button><button class="btn n" id="anGo">Send</button></div>`);
      document.querySelectorAll('#sheet [data-ana]').forEach(b => b.onclick = () => { keep(); st.aud = b.dataset.ana; draw(); });
      document.querySelectorAll('#sheet [data-anf]').forEach(b => b.onclick = () => { keep(); const i = st.fams.indexOf(b.dataset.anf); if(i >= 0) st.fams.splice(i, 1); else st.fams.push(b.dataset.anf); draw(); });
      document.querySelectorAll('#sheet [data-ani]').forEach(b => b.onclick = () => { keep(); st.imp = b.dataset.ani === '1'; draw(); });
      document.querySelector('#sheet [data-ane]').onclick = () => { keep(); st.email = !st.email; draw(); };
      $('anWa').onclick = () => { keep(); const txt = `*${st.t}*${st.body ? '\n\n' + st.body : ''}\n\n${me().name}, LHQ Learning Solutions`; try{ navigator.clipboard.writeText(txt); toast('Copied · paste it into WhatsApp'); }catch(e){ toast('Copy not available here'); } };
      $('anGo').onclick = async () => { keep(); if(!st.t.trim()) return toast('Give it a title');
        try{ const j = await hub.api('ann', {method:'POST', body: JSON.stringify({action:'add', t: st.t, body: st.body, aud: st.aud, fams: st.fams, imp: st.imp, until: st.until, email: st.email})});
          closeSheet(); toast(`Sent to ${j.n}${j.email ? ` · emailed ${j.email.n} of ${j.email.of}${j.email.err ? ' (' + j.email.err + ')' : ''}` : ''}`); anAt = 0; loadAnn(true); }catch(e){ toast(e.message); } }; };
    draw();
  }
  function annPage(id){
    loadAnn(); if(!mayAnn()) return annMine();
    if(!ANALL && !annPage.asked){ annPage.asked = 1; anAt = 0; loadAnn(true); }
    const L = ANALL || [];
    if(id){ const a = L.find(x => x.id === id); if(!a) return `<a class="crumb" href="#ann">‹ Announcements</a><p class="empty">${ANALL ? 'Not found.' : 'Loading…'}</p>`;
      return `<a class="crumb" href="#ann">‹ Announcements</a><div class="ph"><div class="tt"><h1>${esc(a.t)}</h1><p>${a.imp ? 'Important' : 'Normal'} · ${AUD[a.aud]}${a.aud === 'fams' ? ' (' + a.fams.length + ')' : ''}${a.until ? ' · until ' + nice(a.until) : ''}${a.email ? ` · emailed ${a.email.n} of ${a.email.of}` : ''}</p></div><div class="acts"><button class="btn" data-anndel="${esc(a.id)}">Take down</button></div></div>
        ${a.body ? `<div class="card pad" style="white-space:pre-wrap">${esc(a.body)}</div>` : ''}
        <div class="kv3"><div><span>Seen</span><b>${a.seenN}</b><small>of ${a.n}</small></div><div><span>Got it</span><b>${a.gotN}</b><small>tapped</small></div><div><span>Emailed</span><b>${a.email ? a.email.n : '–'}</b><small>${a.email ? 'of ' + a.email.reach + ' with email' : 'not emailed'}</small></div></div>
        <div class="h2">Not seen yet <em>${a.notSeen.length}</em></div><div class="card one">${a.notSeen.map(p => `<div class="it"><span class="t"><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span></div>`).join('') || '<p class="empty">Everyone has seen it. ✓</p>'}</div>`; }
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Announcements</h1><p>${L.length} sent</p></div><div class="acts"><button class="btn n" data-annnew>+ New</button></div></div>
      <div class="card one">${L.map(a => `<a class="it" href="#ann/${esc(a.id)}"><span class="t"><b>${a.imp ? '📣 ' : ''}${esc(a.t)}</b><small>${AUD[a.aud]} · seen ${a.seenN} of ${a.n}${a.imp ? ` · got it ${a.gotN}` : ''} · ${ago(a.at)}${a.until && a.until < tday() ? ' · ended' : ''}</small></span></a>`).join('') || `<p class="empty">${ANALL ? 'None yet.' : 'Loading…'}</p>`}</div>`;
  }
  const annMine = () => `<div class="ph"><div class="tt"><h1>Announcements</h1></div></div><div class="card one">${(AN || []).map(a => `<button class="it" data-annopen="${esc(a.id)}" style="width:100%;text-align:left"><span class="t"><b>${a.imp ? '📣 ' : ''}${esc(a.t)}</b><small>${esc(a.byN)} · ${ago(a.at)}${a.got ? ' · ✓' : ''}</small></span></button>`).join('') || '<p class="empty">None.</p>'}</div>`;
  function annView(id){ loadAnn(); setTimeout(() => annSheet(id), 50); return annMine(); }

  /* ---------- staff reports ---------- */
  let RP = null, rpAt = 0;
  async function loadReps(force){ if(!isStaff() || (!force && RP && Date.now() - rpAt < 60000)) return; try{ RP = await hub.api('reps'); rpAt = Date.now(); rerender(); }catch(e){} }
  const myArep = d => ((RP && RP.areps) || []).find(r => r.by === me().id && r.d === (d || tday()));
  /* what the Hub fills in for a day, from LHQ's documents and the teaching records */
  function dayFacts(t){
    const docs = window.HD ? HD.load() : [], kv = k => (HD.store.get(k, null) || {});
    const rc = docs.filter(x => x.type === 'receipt' && x.date === t), inv = docs.filter(x => x.type === 'invoice' && x.date === t), qt = docs.filter(x => (x.type === 'quote' || !x.type) && x.date === t);
    const money = rc.reduce((a, r) => a + (+String(r.received || 0).replace(/[^\d.]/g, '') || 0), 0);
    const studs = window.HD ? HD.students().filter(s => s.firstInv === t).map(s => s.name) : [];
    const cards = docs.filter(x => x.type === 'card' && !x.del), S = window.SCHED ? SCHED.sessions(cards, t, t) : [];
    const L = Object.values((kv('lhq_logs').e) || {}).filter(e => e && !e.x && e.ty === 's' && e.d === t);
    const logged = S.filter(s => L.some(e => e.k === s.k)).length, missed = S.length - logged;
    const MU = Object.values(kv('lhq_makeups')).filter(m => m && m.at && iso(new Date(m.at)) === t);
    const tut = [...new Set(S.map(s => s.tutor).filter(Boolean))], R = Object.values((kv('lhq_treps').e) || {}).filter(r => r && r.d === t), miss = tut.filter(n => !R.some(r => String(r.tutor).toLowerCase() === n.toLowerCase()));
    return {money, pays: rc.length, invN: inv.length, qN: qt.length, studs, ses: S.length, logged, missed, mu: MU.length, trep: tut.length - miss.length, tut: tut.length, trMiss: miss};
  }
  const factRows = F => [['Money in', `MWK ${mkS(F.money)}`, `${F.pays} payment${F.pays === 1 ? '' : 's'}`, '#docs/receipt'], ['Sent', F.invN + F.qN, `${F.invN} invoice${F.invN === 1 ? '' : 's'} · ${F.qN} quote${F.qN === 1 ? '' : 's'}`, '#docs'], ['New students', F.studs.length, F.studs.slice(0, 3).join(', ') || 'none', '#students/new'],
    ['Sessions', `${F.logged}/${F.ses}`, `logged${F.missed ? ` · ${F.missed} not logged` : ''}`, '#calendar/day/' + tday()], ['Make-ups', F.mu, 'booked today', '#bookings'], ['Tutor reports', `${F.trep}/${F.tut}`, F.trMiss.length ? first(F.trMiss[0]) + (F.trMiss.length > 1 ? ` and ${F.trMiss.length - 1} more` : '') + ' missing' : 'all in', '#tutors']]
    .map(([l, v, s, h]) => `<a class="it" href="${h}"><span class="t"><b>${l}</b><small>${esc(s)}</small></span><b>${esc(v)}</b><span class="chev">›</span></a>`).join('');
  const AF = {enq:'', visits:'', issues:'', supplies:'', needs:''};
  function adminReport(){
    loadReps(); if(!isStaff()) return '';
    const t = tday(), F = dayFacts(t), sent = myArep(t);
    if(sent && !adminReport.edit) return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Today's report</h1><p>${nice(t)} · sent ${hm(sent.upd || sent.at)}</p></div><div class="acts"><button class="btn" data-arepedit>Change</button></div></div>
      <div class="card pad" style="background:var(--ok-bg);border-color:transparent"><b style="color:var(--ok)">Sent ✓</b></div>${arepView(sent)}`;
    if(sent && !AF._from){ Object.assign(AF, {enq: sent.enq || '', visits: sent.visits || '', issues: sent.issues, supplies: sent.supplies, needs: sent.needs, _from: 1}); }
    const J = window.TODAY && TODAY._jobsToday ? TODAY._jobsToday() : null;
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Today's report</h1><p>${nice(t)} · about 2 minutes</p></div></div>
      <div class="h2">From the Hub <em>filled in</em></div><div class="card one">${factRows(F)}${J ? `<div class="it"><span class="t"><b>Your Today list</b><small>${J.done} of ${J.total} done${J.moved ? ` · ${J.moved} moved` : ''}</small></span></div>` : ''}</div>
      <div class="h2">You add</div><div class="card pad">
        <div class="r2"><label class="f"><span>Enquiries handled</span><input class="in" id="arE" inputmode="numeric" value="${esc(AF.enq)}"></label><label class="f"><span>Of those, booked a visit</span><input class="in" id="arV" inputmode="numeric" value="${esc(AF.visits)}"></label></div>
        <label class="f"><span>Parent issues</span><textarea class="in" id="arI" rows="2">${esc(AF.issues)}</textarea></label>
        <label class="f"><span>Printing and supplies</span><textarea class="in" id="arS" rows="2">${esc(AF.supplies)}</textarea></label>
        <label class="f" style="margin:0"><span>Needs the Director</span><textarea class="in" id="arN" rows="2">${esc(AF.needs)}</textarea></label></div>
      ${boxFor('arep', ['Home','Students','Documents','Business','Calendar','Reports','Somewhere else'])}
      <button class="btn n full" id="arGo" style="margin-top:12px">Send</button>`;
  }
  function arepView(r){
    const F = r.hub || {}, rows = F.money != null ? factRows(F) : '';
    return `${rows ? `<div class="h2">From the Hub</div><div class="card one">${rows}${r.jobs ? `<div class="it"><span class="t"><b>Today list</b><small>${r.jobs.done} of ${r.jobs.total} done${r.jobs.moved ? ` · ${r.jobs.moved} moved` : ''}${(r.jobs.open || []).length ? ' · not done: ' + esc(r.jobs.open.join(', ')) : ''}</small></span></div>` : ''}</div>` : ''}
      <div class="h2">${esc(first(r.byN))} added</div><div class="card one">${(r.bdo ? [['Weekly report', `enquiries ${(r.hub || {}).enq || 0} · enrolled ${(r.hub || {}).enrolPct || 0}% · children ${(r.hub || {}).kids || 0}`], ['Meetings held', r.meet], ['Close to signing', r.close], ['Needs the Director', r.needs]] : [['Enquiries handled', `${r.enq || 0}${r.visits ? ` · ${r.visits} booked a visit` : ''}`], ['Parent issues', r.issues], ['Printing and supplies', r.supplies], ['Needs the Director', r.needs]]).filter(([, v]) => v).map(([l, v]) => `<div class="it"><span class="t"><b>${l}</b><small style="white-space:pre-wrap">${esc(v)}</small></span></div>`).join('') || '<p class="empty">Nothing added.</p>'}</div>`;
  }
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('#arGo,[data-arepedit],#drGo,[data-drup]'); if(!t) return; e.preventDefault();
    if(t.hasAttribute('data-arepedit')){ adminReport.edit = true; AF._from = 0; return rerender(); }
    if(t.id === 'arGo'){ Object.assign(AF, {enq: $('arE').value, visits: $('arV').value, issues: $('arI').value, supplies: $('arS').value, needs: $('arN').value});
      const J = window.TODAY && TODAY._jobsToday ? TODAY._jobsToday() : null;
      try{ await hub.api('reps', {method:'POST', body: JSON.stringify(Object.assign({kind:'a', hub: dayFacts(tday()), jobs: J}, AF))}); await flush('arep'); adminReport.edit = false; Object.keys(AF).forEach(k => AF[k] = ''); toast('Report sent'); loadReps(true); }catch(err){ toast(err.message); } return; }
    if(t.dataset.drup){ keepD(); const k = t.dataset.drup, st = t.dataset.drst; DF.up[k] = Object.assign({}, DF.up[k], {st}); return rerender(); }
    if(t.id === 'drGo'){ keepD(); try{ await hub.api('reps', {method:'POST', body: JSON.stringify({kind:'d', wk: wkOf(tday()), hub: weekFacts(), plan: DF.plan, dec: DF.dec, rel: DF.rel, qual: DF.qual, risks: DF.risks, up: DF.up})}); DF._sent = 1; toast('Saved · internal'); loadReps(true); }catch(err){ toast(err.message); } }
  });
  document.addEventListener('input', e => { const t = e.target; if(t.dataset && t.dataset.drupn){ DF.up[t.dataset.drupn] = Object.assign({st:'dec'}, DF.up[t.dataset.drupn], {note: t.value}); } });

  /* the Director's weekly report: internal, never part of the board report */
  const wkOf = s => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); };
  const DF = {plan:'', dec:'', rel:'', qual:'', risks:'', up:{}, wk:''};
  const keepD = () => ['plan','dec','rel','qual','risks'].forEach(k => { const el = $('dr_' + k); if(el) DF[k] = el.value; });
  function weekFacts(){ const w = wkOf(tday()), days = []; for(let i = 0; i < 7; i++){ const d = addD(w, i); if(d <= tday()) days.push(d); }
    const F = days.map(dayFacts), sum = k => F.reduce((a, x) => a + (x[k] || 0), 0);
    const active = window.HD ? HD.students().filter(s => s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= tday())).length : 0;
    return {money: sum('money'), pays: sum('pays'), ses: sum('ses'), logged: sum('logged'), newS: F.reduce((a, x) => a + x.studs.length, 0), active, trep: sum('trep'), tut: sum('tut')}; }
  function weeklyReport(){
    loadReps(); loadFb(); if(!isDir()) return '<p class="empty">This report is for the Director.</p>';
    const w = wkOf(tday()), saved = ((RP && RP.dreps) || []).find(r => r.wk === w);
    if(RP && DF.wk !== w){ Object.assign(DF, {plan:'', dec:'', rel:'', qual:'', risks:'', up:{}, wk:w}, saved ? {plan: saved.plan, dec: saved.dec, rel: saved.rel, qual: saved.qual, risks: saved.risks, up: Object.assign({}, saved.up)} : {}); }
    const W = weekFacts(), up = ((RP && RP.areps) || []).filter(r => r.d >= w && r.needs).map(r => ({k: r.id, r}));
    const fs = fbStats(), ta = (id, l, ph) => `<label class="f"><span>${l}</span><textarea class="in" id="dr_${id}" rows="2" placeholder="${ph || ''}">${esc(DF[id])}</textarea></label>`;
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>This week's report</h1><p>${nice(w)} – ${nice(addD(w, 6))} · internal · the board never sees this</p></div></div>
      <div class="h2">From the Hub <em>filled in</em></div><div class="card one">
        <a class="it" href="#students"><span class="t"><b>Students</b><small>${W.active} active · ${W.newS} new this week</small></span><span class="chev">›</span></a>
        <a class="it" href="#docs/receipt"><span class="t"><b>Money in</b><small>${W.pays} payments</small></span><b>MWK ${mkS(W.money)}</b><span class="chev">›</span></a>
        <a class="it" href="#calendar/week/${w}"><span class="t"><b>Sessions logged</b><small>${W.logged} of ${W.ses} so far</small></span><b>${W.ses ? Math.round(W.logged / W.ses * 100) : 0}%</b><span class="chev">›</span></a>
        <a class="it" href="#tutors"><span class="t"><b>Tutor reports</b><small>${W.trep} of ${W.tut} tutor-days</small></span><span class="chev">›</span></a>
        <a class="it" href="#feedback"><span class="t"><b>The app</b><small>${fs.open.length} open · ${fs.fixedM.length} fixed this month</small></span><span class="chev">›</span></a>
        <div class="it"><span class="t"><b>Progress on the plan</b><small>Plan against actual comes with Business › Plan</small></span></div></div>
      ${up.length ? `<div class="h2">Passed up by admin <em>${up.length}</em></div><div class="card one">${up.map(({k, r}) => { const u = DF.up[k] || {}; return `<div class="it" style="flex-wrap:wrap;align-items:flex-start"><span class="t" style="min-width:200px"><b>${esc(r.needs)}</b><small>${esc(first(r.byN))} · ${nice(r.d)}</small></span><span class="chips" style="margin:0"><button class="chip ${u.st === 'dec' ? 'on' : ''}" data-drup="${esc(k)}" data-drst="dec">Decided</button><button class="chip ${u.st === 'open' ? 'on' : ''}" data-drup="${esc(k)}" data-drst="open">Open</button></span>${u.st ? `<input class="in" data-drupn="${esc(k)}" value="${esc(u.note || '')}" placeholder="${u.st === 'dec' ? 'What was decided' : 'What happens next'}" style="flex-basis:100%;margin-top:6px">` : ''}</div>`; }).join('')}</div>` : ''}
      <div class="h2">You add</div><div class="card pad">${ta('plan', "Progress on the year's plan")}${ta('dec', 'Decisions, and why')}${ta('rel', 'Relationships', 'Schools, partners, families')}${ta('qual', 'Quality and people')}${ta('risks', 'Risks and opportunities')}</div>
      <button class="btn n full" id="drGo">${saved ? 'Save changes' : 'Save'}</button>${saved ? `<p class="note" style="margin-top:8px">Saved ${ago(saved.upd || saved.at)}.</p>` : ''}`;
  }
  /* Reports › Staff reports (Director): every admin report by day */
  function staffReports(d){
    loadReps(); if(!isStaff()) return '';
    d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : tday();
    const L = ((RP && RP.areps) || []).filter(r => r.d === d || (r.bdo && r.wk && r.wk <= d && d <= addD(r.wk, 6))), fs = fbStats();
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Staff reports</h1><p>${nice(d)}</p></div></div>
      <div class="cal-nav"><a class="btn sm" href="#sreps/${addD(d, -1)}">‹</a><b>${nice(d)}</b><a class="btn sm" href="#sreps/${addD(d, 1)}">›</a></div>
      ${isDir() ? `<div class="h2">The app <a class="btn sm" href="#feedback">Open</a></div><div class="kv3"><div><span>New today</span><b>${fs.today.length}</b><small>${fs.today.filter(x => x.way === 'cant').length} can't use it</small></div><div><span>Open</span><b>${fs.open.length}</b><small>${fs.open.length ? 'oldest ' + ago(Math.min(...fs.open.map(x => x.at))) : '–'}</small></div><div><span>Fixed</span><b>${fs.fixedM.length}</b><small>this month</small></div></div>` : ''}
      ${L.map(r => `<div class="h2">${esc(r.byN)} <em>sent ${hm(r.at)}</em></div>${arepView(r)}`).join('') || `<p class="empty">${RP ? 'No staff reports this day.' : 'Loading…'}</p>`}`;
  }
  /* admin's Today: "Send your daily report" ticks itself once sent */
  const arepJob = () => { if(!isStaff() || isDir()) return []; loadReps(); return !RP ? [{key:'arep', hold:true}] : !myArep() ? [{key:'arep', t:'Send your daily report', sub:'about 2 minutes', href:'#areport'}] : []; };

  const css = `.cm-box{border:1px dashed var(--line);border-radius:14px;padding:12px;background:var(--surface);margin-top:12px}.cm-hd{display:flex;align-items:center;gap:8px;font-weight:800;margin-bottom:8px}.cm-hd small{color:var(--muted);font-weight:700;margin-left:auto;font-size:11.5px}
    .cm-strip{display:flex;gap:8px;align-items:center;border-radius:12px;padding:9px 12px;font-size:14px;font-weight:700;margin-bottom:12px;background:var(--accent);color:var(--onaccent)}.cm-strip .t{flex:1;min-width:0}.cm-strip .btn{background:rgba(255,255,255,.16);border-color:transparent;color:var(--onaccent)}
    .cm-ty{flex:none;font-size:11px;font-weight:800;padding:3px 8px;border-radius:8px;background:var(--surface2);border:1px solid var(--line)}.cm-ty.broke{background:var(--rd-bg,#fdecea);color:var(--rd);border-color:transparent}.cm-ty.looks{background:var(--am-bg);color:var(--am);border-color:transparent}
    button.cm-fb{width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left;cursor:pointer}.card.one>button.cm-fb:first-child{border-top:0}
    .kv3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 14px}.kv3>div{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;min-width:0}.kv3 span{display:block;font-size:12px;color:var(--muted);font-weight:700}.kv3 b{font-size:20px}.kv3 small{display:block;font-size:12px;color:var(--muted)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  window.COMMS = {box: boxFor, flush, problemPage, inbox, annPage, annView, after, bell, markAllSeen, adminReport, weeklyReport, staffReports, arepJob, loadAnn};
})();
