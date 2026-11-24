/* LHQ Hub › Today lists and calendar entries (Mockup 16, agreed 22 Nov).
   Today: jobs the Hub knows about (they tick themselves when done), your own jobs, and jobs the Director or an admin gave you.
   Calendar entries: meetings, leave (the Director approves), work, personal and reminders, beside the sessions. Private entries show to LHQ as "Busy".
   Server: /api/hub/jobs and /api/hub/cal (endpoint-only keys, so nobody's phone holds anyone else's list). */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const tday = () => iso(new Date());
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const nice = s => { const d = parse(s); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
  const hm = at => { const d = new Date(at); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const first = n => String(n || '').split(' ')[0];
  const toast = m => window.hubToast ? hubToast(m) : alert(m);
  const me = () => { try{ return (hub.session() || {}).me || {}; }catch(e){ return {}; } };
  const isStaff = () => ['director','admin'].includes(me().role);
  const isDir = () => me().role === 'director';
  const rerender = () => { if(window.hubApply) hubApply(); };
  const $ = id => document.getElementById(id);

  /* ---------- data ---------- */
  let J = null, C = null, jAt = 0, cAt = 0, jBusy = false, cBusy = false;
  async function loadJobs(force){
    if(jBusy || (!force && J && Date.now() - jAt < 60000) || !window.hub || !hub.session()) return;
    jBusy = true; try{ J = await hub.api('jobs'); jAt = Date.now(); rerender(); }catch(e){} finally{ jBusy = false; }
  }
  async function loadCal(force){
    if(cBusy || (!force && C && Date.now() - cAt < 60000) || !window.hub || !hub.session()) return;
    cBusy = true; try{ C = await hub.api('cal?all=' + (isStaff() ? 1 : 0)); cAt = Date.now(); rerender(); }catch(e){} finally{ cBusy = false; }
  }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ jAt = 0; cAt = 0; } });

  /* ---------- which jobs fall on a day (the same rules as the server) ---------- */
  const due = (j, d) => {
    if(!j || j.del || !j.d || d < j.d) return false;
    if(!j.rep) return !j.doneD || j.doneD === d;
    const wd = parse(d).getDay();
    if(j.rep === 'day') return true;
    if(j.rep === 'wkday') return wd >= 1 && wd <= 5;
    if(j.rep === 'week') return parse(j.d).getDay() === wd;
    if(j.rep === 'month'){ const want = +j.d.slice(8), dd = +d.slice(8), last = new Date(parse(d).getFullYear(), parse(d).getMonth() + 1, 0).getDate(); return want === dd || (want > last && dd === last); }
    return false;
  };
  const done = (j, d) => j.rep ? !!(j.done || {})[d] : !!j.doneD;
  const doneAt = (j, d) => j.rep ? (j.done || {})[d] : j.doneAt;
  const REPL = {'':'', day:'every day', wkday:'every weekday', week:'every week', month:'every month'};

  /* ---------- the Hub's own jobs: what's on the list today, and when each one went (it ticked itself) ---------- */
  const HK = 'lhq_hubjobs';
  function hubSnap(H, ready, scope = ''){
    const d = tday(); let S; try{ S = JSON.parse(localStorage.getItem(HK) || 'null'); }catch(e){}
    if(!S || S.d !== d || S.who !== me().id) S = {d, who: me().id, by:{}};
    if(ready){
      const now = Date.now(), keys = new Set(H.map(h => h.key));
      H.forEach(h => { if(h.hold) return; const o = S.by[h.key] || {}; S.by[h.key] = {t:h.t, sub:h.sub || '', href:h.href || '', at:o.at || now}; });
      Object.entries(S.by).forEach(([k, o]) => { if(k.startsWith(scope) && !keys.has(k) && !o.doneAt) o.doneAt = now; });
      try{ localStorage.setItem(HK, JSON.stringify(S)); }catch(e){}
    }
    return S;
  }

  /* ---------- the Today block on each person's Home ----------
     o.hub: [{key, t, sub, href}] the Hub's jobs for this person now; o.ready: the data behind them has loaded; o.add: may add jobs (parents can't) */
  function block(o = {}){
    loadJobs();
    const d = tday(), H = o.hub || [], scope = o.scope || '', S = hubSnap(H, o.ready !== false, scope);
    const L = ((J && J.mine) || []).filter(j => due(j, d));
    const hubOpen = H.filter(h => !h.hold), hubDone = Object.entries(S.by).filter(([k, x]) => k.startsWith(scope) && x.doneAt && !H.some(h => h.key === k)).map(([k, x]) => Object.assign({key:k}, x));
    const open = L.filter(j => !done(j, d)), fin = L.filter(j => done(j, d));
    const total = hubOpen.length + hubDone.length + L.length, nDone = hubDone.length + fin.length;
    const hubRow = h => h.html ? h.html : `<a class="it" href="${esc(h.href || '#')}"><span class="td-mk"></span><span class="t"><b>${esc(h.t)}</b><small>From the Hub${h.sub ? ' · ' + esc(h.sub) : ''}</small></span><span class="chev">›</span></a>`;
    const hubDoneRow = h => `<div class="it td-done"><span class="td-mk ok">✓</span><span class="t"><b>${esc(h.t)}</b><small>From the Hub · ticked itself ${hm(h.doneAt)}</small></span></div>`;
    const jobRow = j => { const ok = done(j, d), late = !j.rep && !ok && j.d < d, n = late ? diff(j.d, d) : 0;
      const src = j.by === me().id ? 'Mine' : 'From ' + first(j.byN);
      const sub = [src, ok ? 'done ' + hm(doneAt(j, d)) : late ? `from ${n === 1 ? 'yesterday' : nice(j.d)} · moved ${n === 1 ? 'once' : n + ' times'}` : j.tm ? 'by ' + j.tm : '', j.rep ? REPL[j.rep] : ''].filter(Boolean).join(' · ');
      return `<div class="it${ok ? ' td-done' : ''}"><button class="td-mk ${ok ? 'ok' : late ? 'am' : ''}" data-jtick="${esc(j.id)}" aria-label="${ok ? 'Not done' : 'Done'}">${ok ? '✓' : late ? '!' : ''}</button><button class="t td-open" data-job="${esc(j.id)}"><b>${esc(j.what)}</b><small>${esc(sub)}</small></button></div>`; };
    const rows = hubOpen.map(hubRow).concat(open.map(jobRow), hubDone.map(hubDoneRow), fin.map(jobRow));
    const pc = total ? Math.round(nDone / total * 100) : 0;
    return `<div class="h2">Today <span class="acts" style="align-items:center"><em>${total ? `${nDone} of ${total} done` : ''}</em>${isStaff() ? '<a class="btn sm" href="#team">Team</a>' : ''}</span></div>
      ${total ? `<div class="td-bar"><i style="width:${pc}%"></i></div>` : ''}
      <div class="card one">${rows.join('') || `<p class="empty">${J ? 'Nothing for today yet.' : 'Loading your list…'}</p>`}${o.add === false ? '' : `<button class="it td-add" data-jadd><span class="td-plus">+</span><span class="t"><b>Add a job</b></span></button>`}</div>`;
  }

  /* ---------- add or change a job ---------- */
  function jobSheet(id){
    const j = id ? ((J && (J.mine || []).concat(J.gave || [])) || []).find(x => x.id === id) : null;
    if(id && !j) return;
    const d = tday(), mine = !j || j.by === me().id, P = (J && J.people || []).filter(p => p.id !== me().id);
    const st = {to: j ? j.to : me().id, day: j ? j.d : d, tm: j ? j.tm || '' : '', rep: j ? j.rep || '' : ''};
    const who = id2 => id2 === me().id ? 'Me' : first((P.find(p => p.id === id2) || {}).name || (j && j.toN) || '');
    if(j && !mine){   // a job someone gave you: tick it, that's all
      return openSheet(`<div class="hx"><h3>${esc(j.what)}</h3><button class="ib" data-close>✕</button></div><p class="sp">From ${esc(j.byN)} · ${j.d === d ? 'today' : nice(j.d)}${j.tm ? ' · by ' + j.tm : ''}${j.rep ? ' · ' + REPL[j.rep] : ''}</p>
        <button class="btn n full" data-jtick="${esc(j.id)}" data-close>${done(j, d) ? 'Not done after all' : 'Done ✓'}</button>`);
    }
    const draw = () => {
      const staffP = P.filter(p => ['director','admin'].includes(p.role)), tut = P.filter(p => !['director','admin'].includes(p.role));
      openSheet(`<div class="hx"><h3>${j ? 'Change the job' : 'Add a job'}</h3><button class="ib" data-close>✕</button></div>
        <label class="f"><span>What</span><input class="in" id="jbW" maxlength="140" value="${esc(j ? j.what : '')}" placeholder="e.g. Print the Year 11 mock papers"></label>
        ${isStaff() ? `<label class="f"><span>For</span><select class="in" id="jbTo"><option value="${esc(me().id)}" ${st.to === me().id ? 'selected' : ''}>Me</option>${staffP.length ? `<optgroup label="Staff">${staffP.map(p => `<option value="${esc(p.id)}" ${st.to === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''}${tut.length ? `<optgroup label="Tutors">${tut.map(p => `<option value="${esc(p.id)}" ${st.to === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>` : ''}</select></label>` : ''}
        <div class="f"><span>When</span><div class="chips" style="margin:4px 0 0">${[[d, 'Today'], [addD(d, 1), 'Tomorrow']].map(([v, l]) => `<button type="button" class="chip ${st.day === v ? 'on' : ''}" data-jday="${v}">${l}</button>`).join('')}<input class="in" type="date" id="jbD" value="${esc(st.day)}" style="max-width:170px;padding:6px 10px"></div></div>
        <div class="r2"><label class="f"><span>By (optional)</span><input class="in" type="time" id="jbM" value="${esc(st.tm)}"></label><label class="f"><span>Repeats</span><select class="in" id="jbR">${Object.entries({'':'No', day:'Every day', wkday:'Weekdays', week:'Every week', month:'Every month'}).map(([v, l]) => `<option value="${v}" ${st.rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        <p class="note" id="jbN" style="margin:0 0 10px">${st.to !== me().id ? `${esc(who(st.to))} gets it on their Today list and in their bell. You see when they tick it.` : ''}</p>
        <button class="btn n full" id="jbGo">${j ? 'Save' : 'Add'}</button>
        ${j ? `<div class="r2" style="margin-top:8px"><button class="btn" data-jtick="${esc(j.id)}" data-close>${done(j, d) ? 'Not done' : 'Done ✓'}</button><button class="btn" id="jbDel" style="color:var(--rd)">Remove</button></div>` : ''}`);
      if($('jbTo')) $('jbTo').onchange = () => { st.what = $('jbW').value; st.to = $('jbTo').value; keep(); draw(); };
      document.querySelectorAll('#sheet [data-jday]').forEach(b => b.onclick = () => { st.what = $('jbW').value; st.day = b.dataset.jday; keep(); draw(); });
      if(st.what != null) $('jbW').value = st.what;
      $('jbGo').onclick = async () => { const what = $('jbW').value.trim(); if(!what) return toast('Say what the job is');
        try{ await hub.api('jobs', {method:'POST', body: JSON.stringify({action: j ? 'edit' : 'add', id: j && j.id, what, to: st.to, d: $('jbD').value || st.day, tm: $('jbM').value, rep: $('jbR').value})});
          closeSheet(); toast(j ? 'Saved' : st.to === me().id ? 'Added to your list' : `Sent to ${who(st.to)}`); loadJobs(true); }catch(e){ toast(e.message); } };
      if($('jbDel')) $('jbDel').onclick = async () => { try{ await hub.api('jobs', {method:'POST', body: JSON.stringify({action:'del', id: j.id})}); closeSheet(); toast('Removed'); loadJobs(true); }catch(e){ toast(e.message); } };
    };
    const keep = () => { st.tm = $('jbM') ? $('jbM').value : st.tm; st.rep = $('jbR') ? $('jbR').value : st.rep; };
    draw();
  }
  async function tick(id){
    const j = ((J && J.mine) || []).find(x => x.id === id); if(!j) return;
    const d = tday(), on = !done(j, d);
    // show it at once, then save
    if(j.rep){ j.done = Object.assign({}, j.done); if(on) j.done[d] = Date.now(); else delete j.done[d]; } else if(on){ j.doneD = d; j.doneAt = Date.now(); } else { delete j.doneD; delete j.doneAt; }
    rerender();
    try{ await hub.api('jobs', {method:'POST', body: JSON.stringify({action: on ? 'tick' : 'untick', id, d})}); if(on && window.SOUNDS && SOUNDS.play) SOUNDS.play('done'); }catch(e){ toast(e.message); loadJobs(true); }
  }

  /* ---------- the team today (Director and admins) ---------- */
  function teamPage(){
    loadJobs();
    if(!isStaff()) return '<p class="empty">This page is for LHQ admin.</p>';
    const d = tday(), T = (J && J.team) || [], G = (J && J.gave) || [];
    const TR = ((window.HD ? HD.store.get('lhq_treps', {e:{}}) : null) || {}).e || {};
    const repSent = n => Object.values(TR).some(r => r && r.d === d && String(r.tutor || '').toLowerCase() === String(n).toLowerCase());
    const away = p => { const A = (C && C.items || []).filter(x => x.by === p.id && x.kind === 'leave' && x.d <= d && (x.d2 || x.d) >= d && !(x.leave && x.leave.st === 'no')); return A.length; };
    const row = p => { const isT = p.role === 'tutor' || p.tutor, extra = [];
      if(isT && !['director','admin'].includes(p.role)) extra.push(repSent(p.name) ? 'daily report ✓' : 'daily report not sent yet');
      const a = away(p), ok = p.n && p.done === p.n;
      return `<div class="it"><span class="td-mk ${a ? '' : ok ? 'ok' : p.late ? 'am' : ''}">${a ? '' : ok ? '✓' : p.late ? '!' : ''}</span><span class="t"><b>${esc(p.name)} · ${esc(p.role === 'director' ? 'Director' : p.role === 'admin' ? ((p.perms || []).includes('acct') ? 'accountant' : 'admin') : 'tutor')}</b><small>${a ? 'Away today · in the calendar' : [p.n ? `${p.done} of ${p.n} done` : 'no jobs today', p.late ? `${p.late} moved from earlier` : '', ...extra].filter(Boolean).join(' · ')}</small></span></div>`; };
    const order = T.slice().sort((a, b) => (['director','admin'].includes(b.role) - ['director','admin'].includes(a.role)) || a.name.localeCompare(b.name));
    const gRow = j => { const ok = done(j, d), late = !j.rep && !ok && j.d < d;
      return `<div class="it"><span class="td-mk ${ok ? 'ok' : late ? 'am' : ''}">${ok ? '✓' : late ? '!' : ''}</span><button class="t td-open" data-job="${esc(j.id)}"><b>${esc(j.what)}</b><small>${esc(first(j.toN))} · ${ok ? 'done ' + hm(doneAt(j, d)) : late ? `from ${nice(j.d)} · not done` : j.tm ? 'by ' + j.tm : j.d > d ? nice(j.d) : 'today'}${j.rep ? ' · ' + REPL[j.rep] : ''}</small></button></div>`; };
    return `<a class="crumb" href="#home">‹ Home</a><div class="ph"><div class="tt"><h1>Team today</h1><p>${nice(d)} · ${hm(Date.now())}</p></div><div class="acts"><button class="btn n" data-jadd>+ Give a job</button></div></div>
      <div class="card one">${order.map(row).join('') || `<p class="empty">${J ? 'No one else yet.' : 'Loading…'}</p>`}</div>
      <div class="h2">Jobs you gave <em>${G.length || ''}</em></div><div class="card one">${G.map(gRow).join('') || '<p class="empty">None today.</p>'}</div>
      <p class="note">Each person's own jobs stay theirs: you see how many are done, not what they are.</p>`;
  }

  /* ---------- calendar entries ---------- */
  const KIND = {meet:'Meeting', leave:'Leave', work:'Work', personal:'Personal', rem:'Reminder'};
  const VIS = {me:'Only you see what it is · LHQ sees "Busy"', lhq:'LHQ sees it', inv:'With the people you invited'};
  function entriesOn(d, o = {}){
    loadCal();
    return ((C && C.items) || []).filter(x => x.d <= d && (x.d2 || x.d) >= d && (o.all || x.by === me().id || !x.busy) && (!o.who || x.by === o.who));
  }
  const pname = id => ((C && C.people) || []).find(p => p.id === id);
  function entryRow(x, o = {}){
    const mine = x.by === me().id, leave = x.kind === 'leave', st = leave && x.leave ? x.leave.st : '';
    const who = !mine ? (x.byN || '') : '';
    const title = x.busy ? `${esc(who)} · Busy` : `${who ? esc(who) + ' · ' : ''}${esc(leave ? (x.t && x.t !== 'Away' ? 'Away · ' + x.t : 'Away') : x.t)}`;
    const sub = x.busy ? 'Private' : [KIND[x.kind] || '', leave ? (st === 'ok' ? 'approved' : st === 'no' ? 'not approved' : 'waiting for the Director') : '', mine && !leave ? (x.vis === 'inv' ? `with ${((x.inv || []).map(i => first((pname(i) || {}).name)).filter(Boolean).join(', ')) || 'invited people'}` : x.vis === 'me' ? 'only you see what it is' : 'LHQ sees it') : '', x.na && !leave ? 'not available' : '', o.clash ? o.clash : ''].filter(Boolean).join(' · ');
    const tm = x.all ? `All day${x.d2 && x.d2 !== x.d ? `<small>to ${nice(x.d2).slice(4)}</small>` : ''}` : `${x.s}<small>${x.e || ''}</small>`;
    const act = mine ? `data-cent="${esc(x.id)}"` : (isDir() && leave && st === 'wait') ? `data-cleave="${esc(x.id)}"` : '';
    return `<${act ? 'button' : 'div'} class="it td-ent${x.busy ? ' busy' : ''}${leave ? ' lv' : ''}" ${act}><span class="cal-t">${tm}</span><span class="t"><b>${title}</b><small>${sub}</small></span>${leave && st === 'wait' ? '<span class="tag am">Waiting</span>' : ''}</${act ? 'button' : 'div'}>`;
  }
  /* rows for a calendar's day list: own entries (and, for LHQ with all, everyone's) */
  const calRows = (d, o) => entriesOn(d, o).sort((a, b) => (a.all ? '' : a.s).localeCompare(b.all ? '' : b.s)).map(x => entryRow(x)).join('');
  const calCount = (d, o) => entriesOn(d, o).length;
  /* is this person (by name) not available then? For flags on sessions and make-ups. */
  function naHit(name, d, a, b){
    if(!C) return null; const p = ((C.people) || []).find(q => String(q.name).toLowerCase() === String(name || '').toLowerCase()); if(!p) return null;
    const m = t => { const x = /^(\d{1,2}):(\d{2})/.exec(t || ''); return x ? +x[1] * 60 + +x[2] : null; };
    return (C.items || []).find(x => x.by === p.id && x.na && x.d <= d && (x.d2 || x.d) >= d && !(x.leave && x.leave.st === 'no') && (x.all || a == null || (m(x.s) < (b ?? a + 60) && m(x.e) > a))) || null;
  }
  function entrySheet(id, day){
    const x = id ? ((C && C.items) || []).find(y => y.id === id && y.by === me().id) : null;
    const fam = ['student','parent'].includes(me().role), P = ((C && C.people) || []).filter(p => p.id !== me().id);
    const st = x ? {kind:x.kind, t:x.t, d:x.d, d2:x.d2 || x.d, all:!!x.all, s:x.s || '09:00', e:x.e || '10:00', vis:x.vis, inv:(x.inv || []).slice(), na:!!x.na} : {kind:'meet', t:'', d: day || tday(), d2:'', all:false, s:'09:00', e:'10:00', vis:'lhq', inv:[], na:false};
    const keep = () => { st.t = $('ceT').value; st.d = $('ceD').value || st.d; st.d2 = $('ceD2').value; if($('ceS')){ st.s = $('ceS').value; st.e = $('ceE').value; } };
    const draw = () => {
      const leave = st.kind === 'leave';
      openSheet(`<div class="hx"><h3>${x ? 'Your entry' : 'New entry'}</h3><button class="ib" data-close>✕</button></div>
        <label class="f"><span>What</span><input class="in" id="ceT" maxlength="120" value="${esc(st.t)}" placeholder="${leave ? 'e.g. Family wedding' : 'e.g. Staff meeting'}"></label>
        <label class="f"><span>Kind</span><select class="in" id="ceK">${Object.entries(KIND).filter(([k]) => !(fam && k === 'leave')).map(([k, l]) => `<option value="${k}" ${st.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="r2"><label class="f"><span>${leave ? 'From' : 'Day'}</span><input class="in" type="date" id="ceD" value="${esc(st.d)}"></label><label class="f"><span>Until (optional)</span><input class="in" type="date" id="ceD2" value="${esc(st.d2 && st.d2 !== st.d ? st.d2 : '')}"></label></div>
        ${leave ? '' : `<div class="f"><div class="chips" style="margin:0"><button type="button" class="chip ${st.all ? 'on' : ''}" data-call>All day</button></div></div>
        ${st.all ? '' : `<div class="r2"><label class="f"><span>From</span><input class="in" type="time" id="ceS" value="${esc(st.s)}"></label><label class="f"><span>To</span><input class="in" type="time" id="ceE" value="${esc(st.e)}"></label></div>`}
        <div class="f"><span>Who sees it</span><div class="chips" style="margin:4px 0 0">${[['me','Only me'],['lhq','LHQ'],...(fam ? [] : [['inv','People I invite']])].map(([k, l]) => `<button type="button" class="chip ${st.vis === k ? 'on' : ''}" data-cv="${k}">${l}</button>`).join('')}</div>
          <p class="note" style="margin:6px 0 0">${st.vis === 'me' ? 'LHQ sees "Busy" at that time, not what it is.' : st.vis === 'inv' ? 'It goes onto their calendars too.' : fam ? 'LHQ sees it.' : 'The Director and admins see it.'}</p></div>
        ${st.vis === 'inv' ? `<select class="in" id="ceInv" style="margin-bottom:8px"><option value="">+ Invite someone…</option>${P.filter(p => !st.inv.includes(p.id)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>${st.inv.length ? `<div class="chips">${st.inv.map(id => `<button type="button" class="chip on" data-ci="${esc(id)}">${esc(first((P.find(p => p.id === id) || {}).name || ''))} ✕</button>`).join('')}</div>` : ''}` : ''}
        <button type="button" class="it td-na" data-cna style="width:100%;border:1px solid var(--line);border-radius:12px;margin-bottom:12px"><span class="td-mk ${st.na ? 'ok' : ''}">${st.na ? '✓' : ''}</span><span class="t"><b>I'm not available</b><small>Make-ups can't be booked then; sessions at that time show as a clash</small></span></button>`}
        ${leave ? `<p class="note" style="margin:0 0 12px">${isDir() ? 'Your leave is approved as you save it.' : 'Goes to the Director to approve. LHQ sees it; sessions those days are flagged to move.'}</p>` : ''}
        <button class="btn n full" id="ceGo">${x ? 'Save' : leave && !isDir() ? 'Ask for leave' : 'Save'}</button>
        ${x ? '<button class="btn full" id="ceDel" style="margin-top:8px;color:var(--rd)">Remove</button>' : ''}`);
      if($('ceK')) $('ceK').onchange = () => { keep(); st.kind = $('ceK').value; if(st.kind === 'leave'){ st.all = true; st.na = true; } draw(); };
      if($('ceInv')) $('ceInv').onchange = () => { keep(); if($('ceInv').value && !st.inv.includes($('ceInv').value)) st.inv.push($('ceInv').value); draw(); };
      document.querySelectorAll('#sheet [data-cv]').forEach(b => b.onclick = () => { keep(); st.vis = b.dataset.cv; draw(); });
      document.querySelectorAll('#sheet [data-ci]').forEach(b => b.onclick = () => { keep(); const i = st.inv.indexOf(b.dataset.ci); if(i >= 0) st.inv.splice(i, 1); else st.inv.push(b.dataset.ci); draw(); });
      const al = document.querySelector('#sheet [data-call]'); if(al) al.onclick = () => { keep(); st.all = !st.all; draw(); };
      const na = document.querySelector('#sheet [data-cna]'); if(na) na.onclick = () => { keep(); st.na = !st.na; draw(); };
      $('ceGo').onclick = async () => { keep();
        if(!st.all && st.kind !== 'leave' && st.e <= st.s) return toast('The end is before the start');
        try{ await hub.api('cal', {method:'POST', body: JSON.stringify({action: x ? 'edit' : 'add', id: x && x.id, kind: st.kind, t: st.t, d: st.d, d2: st.d2 || st.d, all: st.all, s: st.s, e: st.e, vis: st.vis, inv: st.inv, na: st.na})});
          closeSheet(); toast(st.kind === 'leave' && !isDir() ? 'Sent to the Director' : 'Saved'); loadCal(true); }catch(e){ toast(e.message); } };
      if($('ceDel')) $('ceDel').onclick = async () => { try{ await hub.api('cal', {method:'POST', body: JSON.stringify({action:'del', id: x.id})}); closeSheet(); toast('Removed'); loadCal(true); }catch(e){ toast(e.message); } };
    };
    draw();
  }
  function leaveSheet(id){
    const x = ((C && C.items) || []).find(y => y.id === id); if(!x) return;
    openSheet(`<div class="hx"><h3>Leave · ${esc(x.byN)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${nice(x.d)}${x.d2 && x.d2 !== x.d ? ' – ' + nice(x.d2) : ''}${x.t && x.t !== 'Away' ? ' · ' + esc(x.t) : ''}</p>
      <label class="f"><span>Note back (optional)</span><input class="in" id="lvN" maxlength="200"></label>
      <div class="r2"><button class="btn" id="lvNo">Not approved</button><button class="btn n" id="lvOk">Approve</button></div>`);
    const go = async ok => { try{ await hub.api('cal', {method:'POST', body: JSON.stringify({action:'leave', id, ok, note: $('lvN').value})}); closeSheet(); toast(ok ? 'Approved' : 'Not approved'); loadCal(true); }catch(e){ toast(e.message); } };
    $('lvOk').onclick = () => go(true); $('lvNo').onclick = () => go(false);
  }
  /* leave waiting for the Director, for Needs attention and the Director's Today */
  const leaveWaiting = () => { if(!isDir()) return []; loadCal(); return ((C && C.items) || []).filter(x => x.kind === 'leave' && x.leave && x.leave.st === 'wait' && x.by !== me().id); };

  /* ---------- everyone's calendar (Director and admins): one day, every person's entries ---------- */
  let EF = 'all';
  function everyonePage(d){
    loadCal(); if(!isStaff()) return '<p class="empty">This page is for LHQ admin.</p>';
    d = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : tday();
    const P = (C && C.people) || [], roleOf = id => (P.find(p => p.id === id) || {}).role;
    const L = entriesOn(d, {all:true}).filter(x => EF === 'all' || (EF === 'staff' ? ['director','admin'].includes(roleOf(x.by) || x.role) : EF === 'tutors' ? (roleOf(x.by) || x.role) === 'tutor' : EF === 'students' ? ['student','parent'].includes(x.role) : x.by === EF))
      .sort((a, b) => (a.kind === 'leave' ? '' : a.all ? '0' : a.s).localeCompare(b.kind === 'leave' ? '' : b.all ? '0' : b.s));
    let ses = ''; const DOCS = () => (window.HD ? HD.load() : []); if(window.SCHED){ const S = SCHED.sessions(DOCS().filter(x => x.type === 'card' && !x.del), d, d); if(S.length){ const tn = new Set(S.map(e => e.tutor).filter(Boolean)); ses = `<a class="it" href="#calendar/day/${d}"><span class="cal-t">${S[0].s || ''}<small>${S[S.length - 1].e || ''}</small></span><span class="t"><b>${S.length} session${S.length === 1 ? '' : 's'}</b><small>${tn.size} tutor${tn.size === 1 ? '' : 's'} · from the tuition cards</small></span><span class="chev">›</span></a>`; } }
    const lvRows = L.filter(x => x.kind === 'leave').map(x => { let n = 0; if(window.SCHED) n = SCHED.sessions(DOCS().filter(y => y.type === 'card' && !y.del), d, d).filter(e => String(e.tutor).toLowerCase() === String(x.byN).toLowerCase()).length; return entryRow(x, {clash: n ? `${n} session${n === 1 ? '' : 's'} to move` : ''}); });
    return `<a class="crumb" href="#calendar">‹ Calendar</a><div class="ph"><div class="tt"><h1>Everyone</h1><p>${nice(d)}</p></div><div class="acts"><button class="btn n" data-cnew="${d}">+ Entry</button></div></div>
      <div class="chips">${[['all','Everyone'],['staff','Staff'],['tutors','Tutors'],['students','Students']].map(([k, l]) => `<button class="chip ${EF === k ? 'on' : ''}" data-ef="${k}">${l}</button>`).join('')}<select class="in" data-efp style="max-width:180px;padding:5px 10px"><option value="">A person…</option>${P.map(p => `<option value="${esc(p.id)}" ${EF === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
      <div class="cal-nav"><a class="btn sm" href="#everyone/${addD(d, -1)}">‹</a><b>${nice(d)}</b><a class="btn sm" href="#everyone/${addD(d, 1)}">›</a>${d === tday() ? '' : `<a class="btn sm" href="#everyone/${tday()}">Today</a>`}</div>
      <div class="card one">${lvRows.join('')}${L.filter(x => x.kind !== 'leave').map(x => entryRow(x)).join('')}${EF === 'all' || EF === 'tutors' ? ses : ''}${!L.length && !ses ? `<p class="empty">${C ? 'Nothing in anyone\'s calendar.' : 'Loading…'}</p>` : ''}</div>
      <p class="note">Private entries show as "Busy" even here.</p>`;
  }

  /* ---------- one listener for every page ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-jtick],[data-job],[data-jadd],[data-cent],[data-cnew],[data-cleave],[data-ef]'); if(!t) return;
    if(t.dataset.jtick){ e.preventDefault(); e.stopPropagation(); tick(t.dataset.jtick); if(t.hasAttribute('data-close')) closeSheet(); return; }
    if(t.dataset.job){ e.preventDefault(); jobSheet(t.dataset.job); return; }
    if(t.hasAttribute('data-jadd')){ e.preventDefault(); if(!J) loadJobs(true); jobSheet(null); return; }
    if(t.dataset.cent){ e.preventDefault(); entrySheet(t.dataset.cent); return; }
    if(t.hasAttribute('data-cnew')){ e.preventDefault(); if(!C) loadCal(true); entrySheet(null, t.dataset.cnew || ''); return; }
    if(t.dataset.cleave){ e.preventDefault(); leaveSheet(t.dataset.cleave); return; }
    if(t.dataset.ef){ e.preventDefault(); EF = t.dataset.ef; rerender(); return; }
  });
  document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('[data-efp]'); if(s){ EF = s.value || 'all'; rerender(); } });

  const css = `.td-bar{height:6px;border-radius:99px;background:var(--line);margin:-4px 2px 10px;overflow:hidden}.td-bar i{display:block;height:100%;background:var(--ok);border-radius:99px}
    .td-mk{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;border:2px solid var(--line);color:transparent;background:none;padding:0;cursor:pointer}
    .td-mk.ok{background:var(--ok);border-color:var(--ok);color:#fff}.td-mk.am{border-color:var(--am);color:var(--am);background:var(--am-bg)}
    .it .td-open{flex:1;min-width:0;background:none;border:0;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}.it .td-open b{display:block}.it .td-open small{display:block}
    .td-done b{color:var(--muted)}.td-add{width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:var(--accent);cursor:pointer;text-align:left}
    .td-plus{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:900;border:2px dashed var(--accent);color:var(--accent)}
    button.td-ent{width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left;cursor:pointer}.td-ent.busy b{color:var(--muted)}.td-ent.lv{border-left:3px solid var(--am)}
    .card.one>button.td-ent:first-child{border-top:0}.cal-d .cal-e{display:block;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:2px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* for the daily report: how the day's list went (the Hub's jobs and your own) */
  function jobsToday(){
    const d = tday(), S = hubSnap([], false), L = ((J && J.mine) || []).filter(j => due(j, d)), hubAll = Object.entries(S.by || {}).filter(([k]) => k !== 'arep').map(([, v]) => v);
    const done0 = L.filter(j => done(j, d)), moved = L.filter(j => !j.rep && !done(j, d) && j.d < d).length;
    return {total: L.length + hubAll.length, done: done0.length + hubAll.filter(h => h.doneAt).length, moved, open: L.filter(j => !done(j, d)).map(j => j.what).concat(hubAll.filter(h => !h.doneAt).map(h => h.t))};
  }
  window.TODAY = {_jobsToday: jobsToday, block, loadJobs, loadCal, teamPage, everyonePage, entriesOn, calRows, calCount, entrySheet, leaveWaiting, naHit, jobSheet, _due: due};
})();
