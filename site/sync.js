/* LHQ Hub sync: sign-in, and keeping this device's copy in step with LHQ's online storage.
   Load this before the page's own script. The page keeps working from localStorage as before;
   this file signs the person in, fills localStorage from the server, and uploads every change. */
(function(){
  'use strict';
  const API = '/api/hub/';
  const DOCS = 'lhq_saved';
  const KV = ['lhq_settings','lhq_templates','lhq_counters','lhq_repEdits','lhq_logs','lhq_tlinks','lhq_students','lhq_spend','lhq_budget','lhq_income'];
  const PRIVATE = ['lhq_spend','lhq_budget','lhq_income'];   // only sent to people allowed to see them; removed here when that changes
  const SESSION = 'lhq_session', BASE = 'lhq_syncBase', KVHASH = 'lhq_syncKv', REV = 'lhq_syncRev', DIRTY = 'lhq_syncDirty', EPOCH = 'lhq_syncEpoch';
  const ls = window.localStorage;
  const rawSet = ls.setItem.bind(ls), rawGet = ls.getItem.bind(ls), rawDel = ls.removeItem.bind(ls);
  const get = (k, d) => { try{ const v = rawGet(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const put = (k, v) => { try{ rawSet(k, JSON.stringify(v)); }catch(e){} };
  const session = () => get(SESSION, null);
  const hash = s => { let h = 5381; for(let i=0;i<s.length;i++) h = (h*33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + s.length; };

  /* ---------- watch the page's own saves ---------- */
  let pushTimer = null, pushing = false;
  const protoSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v){
    protoSet.call(this, k, v);       // this storage (sessionStorage writes stay in sessionStorage)
    if(this === ls && (k === DOCS || KV.includes(k)) && session()){ put(DIRTY, true); schedulePush(); }
  };
  function schedulePush(ms){ clearTimeout(pushTimer); pushTimer = setTimeout(push, ms == null ? 700 : ms); }

  async function api(path, opts){
    const s = session(), headers = {'content-type':'application/json'};
    if(s && s.token) headers.authorization = 'Bearer ' + s.token;
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
    let r; try{ r = await fetch(API + path, Object.assign({headers, cache:'no-store', signal:ctl.signal}, opts || {})); } finally { clearTimeout(tm); }
    let j = {}; try{ j = await r.json(); }catch(e){}
    if(r.status === 401 && path !== 'login' && session()){ signedOut('Please sign in again.'); throw new Error('signed out'); }
    if(!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Try again.'), {status:r.status, denied:!!j.denied});
    return j;
  }

  function changes(){
    const base = get(BASE, {}), docs = get(DOCS, []), seen = {};
    const upserts = [], deletes = [];
    docs.forEach(d => { if(!d || !d.id) return; seen[d.id] = 1; if(base[d.id] !== (d.savedAt || 0)) upserts.push({doc:d, base: base[d.id] == null ? null : base[d.id]}); });
    Object.keys(base).forEach(id => { if(!seen[id]) deletes.push({id, base:base[id]}); });
    const hashes = get(KVHASH, {}), kv = {};
    KV.forEach(k => { const v = rawGet(k); if(v != null && hashes[k] !== hash(v)) kv[k] = JSON.parse(v); });
    return {upserts, deletes, kv};
  }

  async function push(){
    if(pushing){ schedulePush(1500); return; }
    if(!session() || !navigator.onLine){ status(navigator.onLine ? '' : 'offline'); return; }
    const c = changes();
    if(!c.upserts.length && !c.deletes.length && !Object.keys(c.kv).length){ put(DIRTY, false); status('ok'); return; }
    pushing = true; status('saving');
    try{
      const r = await api('sync', {method:'POST', body:JSON.stringify(c)});
      const base = get(BASE, {}), hashes = get(KVHASH, {});
      c.deletes.forEach(x => delete base[x.id]);
      (r.saved || []).forEach(d => base[d.id] = d.savedAt || 0);
      Object.keys(c.kv).forEach(k => hashes[k] = hash(rawGet(k) || ''));
      // spending is merged on the server with what other devices recorded: keep the merged copy
      // (anything recorded here while this save was on its way stays, and goes up next time)
      Object.entries(r.kv || {}).forEach(([k, v]) => {
        let cur = {}; try{ cur = JSON.parse(rawGet(k) || '{}') || {}; }catch(e){}
        const m = Object.assign({}, v); Object.entries(cur).forEach(([id, e]) => { if(e && (!m[id] || (e.at || 0) > (m[id].at || 0))) m[id] = e; });
        put(k, m); hashes[k] = hash(JSON.stringify(v));
      });
      // fill in what the server added (who saved it, and any renumbering)
      const byId = {}; (r.saved || []).forEach(d => byId[d.id] = d);
      const docs = get(DOCS, []).map(d => byId[d.id] ? Object.assign(d, {number:byId[d.id].number, updatedBy:byId[d.id].updatedBy, createdBy:byId[d.id].createdBy}) : d);
      put(DOCS, docs); put(BASE, base); put(KVHASH, hashes);
      // if only this save happened since the last download, this device is up to date; otherwise fetch what others changed
      const before = get(REV, null);
      if(r.epoch && get(EPOCH, null) != null && r.epoch !== get(EPOCH, null)){ rawDel(REV); setTimeout(() => pull().catch(() => {}), 300); }
      else if(before != null && r.rev === before + 1) put(REV, r.rev);
      else setTimeout(() => pull().catch(() => {}), 300);
      if(r.epoch) put(EPOCH, r.epoch);
      const after = changes();
      put(DIRTY, !!(after.upserts.length || after.deletes.length || Object.keys(after.kv).length));
      Object.entries(r.remap || {}).forEach(([id, n]) => { if(window.hubRemap) window.hubRemap(id, n); note(`Saved as ${n}: the number you had was just used on another device.`); });
      (r.conflicts || []).forEach(x => note(`${x.number}: ${x.by || 'someone'} also changed this. Your version was saved; theirs is kept in the history.`));
      status('ok');
    }catch(e){
      window.hub && (window.hub.lastError = String(e && e.message || e));
      if(e.denied){
        // the server refused: this person isn't allowed to make that change, so undo it here
        note(e.message + ' Your change was undone.');
        put(DIRTY, false);
        try{ const st = await api('state'); apply(st, true); if(window.hubApply) window.hubApply(); status('ok'); }catch(err){ status('offline'); }
      }
      else if(e.message !== 'signed out'){ status('offline'); schedulePush(30000); }
    }finally{ pushing = false; }
  }

  /* ---------- bring the server's copy down ---------- */
  function apply(st, discard){
    const base = {}, hashes = {};
    const local = get(DOCS, []), server = st.docs || [], ids = {};
    server.forEach(d => { ids[d.id] = 1; base[d.id] = d.savedAt || 0; });
    // documents saved on this device that never reached the server stay, and upload next
    const keepLocal = discard ? [] : local.filter(d => d && d.id && !ids[d.id] && !(get(BASE, {})[d.id] != null));
    put(DOCS, keepLocal.concat(server).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0)));
    KV.forEach(k => { if(st.kv && st.kv[k] != null){ put(k, st.kv[k]); hashes[k] = hash(rawGet(k)); } else if(PRIVATE.includes(k)) rawDel(k); });
    put(BASE, base); put(KVHASH, hashes); put(REV, st.rev); put(EPOCH, st.epoch || '');
  }
  /* only what changed since this device's last download */
  function applyDelta(st){
    const base = get(BASE, {}), hashes = get(KVHASH, {}), byId = new Map(get(DOCS, []).filter(d => d && d.id).map(d => [d.id, d]));
    (st.docs || []).forEach(d => { byId.set(d.id, d); base[d.id] = d.savedAt || 0; });
    (st.gone || []).forEach(id => { byId.delete(id); delete base[id]; });
    put(DOCS, [...byId.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)));
    Object.entries(st.kv || {}).forEach(([k, v]) => { if(!KV.includes(k)) return; put(k, v); hashes[k] = hash(rawGet(k)); });
    (st.hide || []).forEach(k => { rawDel(k); delete hashes[k]; });
    put(BASE, base); put(KVHASH, hashes); put(REV, st.rev); put(EPOCH, st.epoch || '');
  }
  async function pull(opts){
    if(get(DIRTY, false) && get(REV, null) != null){ await push(); if(get(DIRTY, false)) throw new Error('offline'); }
    const known = get(REV, null);
    const st = await api(known != null && get(EPOCH, null) != null ? `state?since=${encodeURIComponent(known)}&epoch=${encodeURIComponent(get(EPOCH, ''))}` : 'state');
    const mine = session(); if(mine && st.me){ mine.me = st.me; put(SESSION, mine); }
    const firstTime = known == null;
    const localOnly = firstTime ? get(DOCS, []).filter(d => d && d.id && !(st.docs || []).some(x => x.id === d.id)) : [];
    if(st.delta) applyDelta(st); else apply(st);
    if(window.hubApply) window.hubApply();
    if(localOnly.length) offerUpload(localOnly.length, st.docs.length === 0);
    else if(get(DIRTY, false)) schedulePush(200);
    status('ok');
    return st;
  }
  async function check(){
    if(!session() || !navigator.onLine || pushing) return;
    try{
      const r = await api('rev');
      const mine = session();
      if(mine && r.me && JSON.stringify(r.me) !== JSON.stringify(mine.me)){ mine.me = r.me; put(SESSION, mine); if(window.hubMe) window.hubMe(); }
      if(get(DIRTY, false)){ schedulePush(100); return; }
      if(r.epoch !== undefined && get(EPOCH, null) != null && r.epoch !== get(EPOCH, null)) rawDel(REV);   // the store was replaced: reload everything
      if(r.rev !== get(REV, null)) await pull();
    }catch(e){}
  }

  /* ---------- small UI ---------- */
  const css = `
  .hub-ov{position:fixed;inset:0;z-index:1000;background:#f5f6f8;display:flex;flex-direction:column;align-items:center;overflow:auto;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d}
  .hub-box{width:100%;max-width:440px;padding:28px 18px 40px}
  .hub-box img{height:44px;display:block;margin:6px 0 30px}
  .hub-box h2{font-size:22px;margin:0 0 4px;color:#073763;text-align:center}.hub-box p.s{color:#6b7585;text-align:center;margin:0 0 20px}
  .hub-who{display:grid;gap:10px}
  .hub-who button,.hub-btn{font:inherit;color:#14213d;text-align:left;background:#fff;border:1px solid #e4e7ec;border-radius:16px;padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
  .hub-who small{display:block;color:#6b7585;font-size:12.5px}
  .hub-pin{display:flex;gap:10px;justify-content:center;margin:20px 0}.hub-pin span{width:46px;height:54px;border-radius:12px;border:1px solid #e4e7ec;background:#fff;display:grid;place-items:center;font-size:24px;color:#073763}
  .hub-kp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:300px;margin:0 auto}.hub-kp button{font:inherit;font-size:21px;font-weight:600;height:56px;border-radius:14px;border:1px solid #e4e7ec;background:#fff;color:#14213d;cursor:pointer}
  .hub-err{color:#b42318;text-align:center;min-height:22px;margin:10px 0 0;font-weight:600}
  .hub-link{display:block;margin:16px auto 0;background:none;border:0;color:#073763;font:inherit;font-weight:700;cursor:pointer}
  .hub-in{width:100%;font:inherit;font-size:16px;padding:12px 14px;border:1px solid #e4e7ec;border-radius:12px;background:#fff;margin:6px 0 14px}
  .hub-go{width:100%;font:inherit;font-weight:800;padding:14px;border-radius:14px;border:0;background:#073763;color:#fff;cursor:pointer}
  .hub-go:disabled{opacity:.5}
  .hub-acct{display:inline-flex;align-items:center;gap:7px}
  .hub-dot{width:8px;height:8px;border-radius:50%;background:#9aa3b0;display:inline-block}
  .hub-dot.ok{background:#2fa36b}.hub-dot.saving{background:#f4b223}.hub-dot.offline{background:#d94a3d}
  .hub-banner{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:999;background:#073763;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;max-width:94vw;box-shadow:0 10px 30px rgba(0,0,0,.2);font:14px/1.4 system-ui,sans-serif}
  .hub-banner button{font:inherit;font-weight:800;border:0;border-radius:10px;padding:8px 12px;cursor:pointer;background:#f4b223;color:#073763;white-space:nowrap}
  .hub-banner button.x{background:transparent;color:#fff;opacity:.7}
  .hub-dlg{border:0;border-radius:18px;padding:0;max-width:560px;width:94vw;color:#14213d}
  .hub-dlg::backdrop{background:rgba(7,25,45,.45)}
  .hub-dlg .hd{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #eef0f3}.hub-dlg .hd b{font-size:17px}
  .hub-dlg .bd{padding:14px 18px 18px;max-height:70vh;overflow:auto}
  .hub-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #eef0f3}.hub-row:first-child{border-top:0}.hub-row div{flex:1}.hub-row small{display:block;color:#6b7585}
  .hub-row button,.hub-sm{font:inherit;font-size:13px;font-weight:700;border:1px solid #e4e7ec;background:#fff;color:#073763;border-radius:10px;padding:7px 10px;cursor:pointer}
  .hub-sm.navy{background:#073763;color:#fff;border-color:#073763}
  .hub-chk{display:flex;gap:16px;margin:2px 0 12px}.hub-chk label{display:flex;gap:6px;align-items:center;font-weight:600}
  .hub-off{opacity:.55}
  .hub-ov,.hub-dlg{font-family:Manrope,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  [data-theme=dark] .hub-ov{background:#0d1420;color:#e8edf4}
  [data-theme=dark] .hub-err{color:#ff8a80}
  [data-theme=dark] .hub-box h2,[data-theme=dark] .hub-link{color:#f4b223}
  [data-theme=dark] .hub-who button,[data-theme=dark] .hub-btn,[data-theme=dark] .hub-pin span,[data-theme=dark] .hub-kp button,[data-theme=dark] .hub-in,[data-theme=dark] .hub-row button,[data-theme=dark] .hub-sm{background:#151e2c;border-color:#253246;color:#e8edf4}
  [data-theme=dark] .hub-pin span{color:#f4b223}
  [data-theme=dark] .hub-go{background:#f4b223;color:#0d1420}
  [data-theme=dark] .hub-dlg{background:#151e2c;color:#e8edf4}
  [data-theme=dark] .hub-dlg .hd,[data-theme=dark] .hub-row{border-color:#253246}
  [data-theme=dark] .hub-who small,[data-theme=dark] .hub-row small,[data-theme=dark] .hub-box p.s{color:#93a0b3}`;
  const LOGO = () => window.lhqTheme ? window.lhqTheme.logo() : 'logo.png';
  function el(html){ const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function note(msg){ if(!msg) return; if(window.hubToast) window.hubToast(msg); else console.log(msg); }

  let statusEl = null;
  function status(s){
    if(!statusEl) return;
    const dot = statusEl.querySelector('.hub-dot'); dot.className = 'hub-dot ' + (s || '');
    statusEl.title = s === 'ok' ? 'Everything is saved online' : s === 'saving' ? 'Saving online…' : s === 'offline' ? 'Offline: changes are kept on this device and upload when you are back online' : '';
  }
  function mountAccount(){
    const bar = document.querySelector('.topbar .actions') || document.querySelector('.topbar');
    const s = session(); if(!bar || !s || document.getElementById('hubAcct')) return;
    statusEl = el(`<button class="ghost hub-acct" id="hubAcct" type="button"><span class="hub-dot"></span><span>${esc((s.me && s.me.name || '').split(' ')[0] || 'Account')}</span></button>`);
    if(bar.classList.contains('actions')) bar.insertBefore(statusEl, bar.firstChild); else bar.appendChild(statusEl);
    statusEl.onclick = () => { location.href = 'index.html#set/account'; };
    status(get(DIRTY, false) ? 'saving' : 'ok');
  }

  /* sign in */
  let pinBuf = '', chosen = null, people = [];
  function overlay(){ let o = document.getElementById('hubOv'); if(!o){ o = el('<div class="hub-ov" id="hubOv"><div class="hub-box"></div></div>'); document.body.appendChild(o); } return o.querySelector('.hub-box'); }
  async function showSignIn(msg){
    const box = overlay();
    box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ Learning Solutions"><p class="s">Loading…</p>`;
    try{
      const r = await fetch(API + 'people', {cache:'no-store'}).then(r => r.json());
      if(r.error){ box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ"><h2>LHQ Hub isn't ready</h2><p class="s">${esc(r.error)}</p>`; return; }
      if(r.setup) return showSetup();
      people = r.people || [];
      box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ Learning Solutions"><h2>Who's signing in?</h2><p class="s">${esc(msg || 'Each person has their own PIN.')}</p>
        <div class="hub-who">${people.map(p => `<button type="button" data-id="${p.id}"><span><b>${esc(p.name)}</b><small>${[{director:'Director',admin:'Admin',tutor:'Tutor'}[p.role] || (p.admin?'Admin':'Tutor'), p.tutor && p.role !== 'tutor' ? 'Tutor' : ''].filter(Boolean).join(' + ')}</small></span><span>›</span></button>`).join('')}</div>`;
      box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { chosen = people.find(p => p.id === b.dataset.id); pinBuf = ''; showPin(); });
    }catch(e){
      box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ"><h2>No connection</h2><p class="s">LHQ Hub needs the internet to sign in. Check your connection and try again.</p><button class="hub-go" onclick="location.reload()">Try again</button>`;
    }
  }
  function showPin(err){
    const box = overlay();
    box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ Learning Solutions"><h2>Hello ${esc(chosen.name.split(' ')[0])}</h2><p class="s">Enter your PIN</p>
      <div class="hub-pin">${[0,1,2,3,4,5].slice(0, Math.max(4, pinBuf.length)).map(i => `<span>${pinBuf.length > i ? '•' : ''}</span>`).join('')}</div>
      <div class="hub-kp">${[1,2,3,4,5,6,7,8,9,'back',0,'ok'].map(k => `<button type="button" data-k="${k}">${k==='back'?'⌫':k==='ok'?'✓':k}</button>`).join('')}</div>
      <p class="hub-err">${esc(err || '')}</p><button class="hub-link" type="button" id="hubNotMe">Not ${esc(chosen.name.split(' ')[0])}?</button>${chosen.role === 'director' ? '<button class="hub-link" type="button" id="hubForgot" style="font-weight:600;margin-top:6px">Forgot your PIN?</button>' : ''}`;
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => key(b.dataset.k));
    box.querySelector('#hubNotMe').onclick = () => showSignIn();
    const fg = box.querySelector('#hubForgot'); if(fg) fg.onclick = () => showRecover();
  }
  async function key(k){
    if(k === 'back'){ pinBuf = pinBuf.slice(0, -1); return showPin(); }
    if(k !== 'ok'){ if(pinBuf.length < 6) pinBuf += k; return showPin(); }
    if(pinBuf.length < 4) return showPin('Your PIN has 4 to 6 digits.');
    try{
      const r = await fetch(API + 'login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({id:chosen.id, pin:pinBuf})}).then(async r => ({ok:r.ok, j:await r.json()}));
      if(!r.ok){ pinBuf = ''; return showPin(r.j.error); }
      signedIn(r.j);
    }catch(e){ pinBuf = ''; showPin('No connection. Try again.'); }
  }
  function showRecover(err){
    const box = overlay();
    box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ"><h2>Set a new PIN</h2><p class="s">As Director, use the setup code (the first 8 characters of LHQ_SECRET in Netlify) to choose a new PIN.</p>
      <label>Setup code<input class="hub-in" id="rcCode" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label>New PIN<input class="hub-in" id="rcPin1" inputmode="numeric" type="password" maxlength="6"></label>
      <label>New PIN again<input class="hub-in" id="rcPin2" inputmode="numeric" type="password" maxlength="6"></label>
      <button class="hub-go" id="rcGo">Set PIN and sign in</button><p class="hub-err">${esc(err || '')}</p><button class="hub-link" type="button" id="rcBack">Back</button>`;
    box.querySelector('#rcBack').onclick = () => showPin();
    box.querySelector('#rcGo').onclick = async () => {
      const a = box.querySelector('#rcPin1').value, b = box.querySelector('#rcPin2').value;
      if(a !== b) return showRecover('The two PINs don\'t match.');
      try{
        const r = await fetch(API + 'recover', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({code:box.querySelector('#rcCode').value, pin:a})}).then(async r => ({ok:r.ok, j:await r.json()}));
        if(!r.ok) return showRecover(r.j.error);
        signedIn(r.j);
      }catch(e){ showRecover('No connection. Try again.'); }
    };
  }
  function showSetup(err){
    const box = overlay();
    box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ Learning Solutions"><h2>Set up LHQ Hub</h2><p class="s">You're the first person here, so you'll be the admin. Enter the setup code from LHQ, your name, and a PIN of 4 to 6 digits.</p>
      <label>Setup code<input class="hub-in" id="hubCode" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label>Your name<input class="hub-in" id="hubName" autocomplete="name"></label>
      <label>PIN<input class="hub-in" id="hubPin1" inputmode="numeric" type="password" maxlength="6"></label>
      <label>PIN again<input class="hub-in" id="hubPin2" inputmode="numeric" type="password" maxlength="6"></label>
      <button class="hub-go" id="hubSetupGo">Create my admin account</button><p class="hub-err">${esc(err || '')}</p>`;
    box.querySelector('#hubSetupGo').onclick = async () => {
      const code = box.querySelector('#hubCode').value.trim(), name = box.querySelector('#hubName').value.trim(), a = box.querySelector('#hubPin1').value, b = box.querySelector('#hubPin2').value;
      if(a !== b) return showSetup('The two PINs don\'t match.');
      try{
        const r = await fetch(API + 'setup', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({code, name, pin:a})}).then(async r => ({ok:r.ok, j:await r.json()}));
        if(!r.ok) return showSetup(r.j.error);
        signedIn(r.j);
      }catch(e){ showSetup('No connection. Try again.'); }
    };
  }
  async function signedIn(j){
    put(SESSION, {token:j.token, me:j.me});
    const box = overlay(); box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ"><h2>Welcome, ${esc(j.me.name.split(' ')[0])}</h2><p class="s">Getting LHQ's documents…</p>`;
    if(!j.me.admin){ box.innerHTML = `<img class="lhq-logo" src="${LOGO()}" alt="LHQ"><h2>Hello ${esc(j.me.name.split(' ')[0])}</h2><p class="s">The tutor part of LHQ Hub is coming next. For now, keep using the session-log link LHQ sent you on WhatsApp.</p><button class="hub-go" id="hubOut">Sign out</button>`; box.querySelector('#hubOut').onclick = signOut; return; }
    try{ await pull(); }catch(e){}
    document.getElementById('hubOv')?.remove();
    mountAccount();
    if(window.hubReady) window.hubReady();
  }
  function signedOut(msg){ rawDel(SESSION); showSignIn(msg); }

  /* account menu, PIN change, people */
  function dialog(title, html){
    let d = document.getElementById('hubDlg');
    if(!d){ d = el('<dialog class="hub-dlg" id="hubDlg"></dialog>'); document.body.appendChild(d); }
    d.innerHTML = `<div class="hd"><b>${esc(title)}</b><button class="hub-sm" type="button" onclick="this.closest('dialog').close()">✕</button></div><div class="bd">${html}</div>`;
    if(!d.open) d.showModal();
    return d.querySelector('.bd');
  }
  function accountMenu(){
    const s = session(), me = s && s.me || {}, dirty = get(DIRTY, false);
    const bd = dialog(me.name || 'Account', `
      <p style="margin:0 0 12px;color:#6b7585">${[me.admin?'Admin':'', me.tutor?'Tutor':''].filter(Boolean).join(' + ')} · ${dirty ? (navigator.onLine ? 'Saving changes online…' : 'Offline: changes will upload when you\'re back online') : 'Everything is saved online'}</p>
      ${me.admin ? `<button class="hub-btn" style="width:100%;margin-bottom:8px" id="hubPeople"><span><b>People &amp; access</b><small style="display:block;color:#6b7585">Add people, reset PINs, switch someone off</small></span><span>›</span></button>` : ''}
      <button class="hub-btn" style="width:100%;margin-bottom:8px" id="hubMyPin"><span><b>Change my PIN</b></span><span>›</span></button>
      <button class="hub-btn" style="width:100%;color:#b42318" id="hubSignOut"><span><b>Sign out</b><small style="display:block;color:#6b7585">Removes LHQ's documents from this device</small></span><span>›</span></button>`);
    if(me.admin) bd.querySelector('#hubPeople').onclick = peopleDlg;
    bd.querySelector('#hubMyPin').onclick = myPinDlg;
    bd.querySelector('#hubSignOut').onclick = signOut;
  }
  function signOut(){
    if(get(DIRTY, false) && !confirm('Some changes haven\'t uploaded yet. Sign out anyway? They will be lost.')) return;
    [SESSION, BASE, KVHASH, REV, DIRTY, EPOCH, DOCS, 'lhq_draft', ...KV].forEach(k => rawDel(k));
    location.reload();
  }
  function myPinDlg(){
    const bd = dialog('Change my PIN', `<label>Current PIN<input class="hub-in" id="hp0" inputmode="numeric" type="password" maxlength="6"></label>
      <label>New PIN (4 to 6 digits)<input class="hub-in" id="hp1" inputmode="numeric" type="password" maxlength="6"></label>
      <label>New PIN again<input class="hub-in" id="hp2" inputmode="numeric" type="password" maxlength="6"></label>
      <button class="hub-go" id="hpGo">Change PIN</button><p class="hub-err" id="hpErr"></p>`);
    bd.querySelector('#hpGo').onclick = async () => {
      const [a,b,c] = ['hp0','hp1','hp2'].map(i => bd.querySelector('#'+i).value);
      if(b !== c){ bd.querySelector('#hpErr').textContent = 'The new PINs don\'t match.'; return; }
      try{ const r = await api('people', {method:'POST', body:JSON.stringify({action:'mypin', current:a, pin:b})}); const s = session(); s.token = r.token; put(SESSION, s); document.getElementById('hubDlg').close(); note('PIN changed. You stay signed in here; other devices will ask for the new PIN.'); }
      catch(e){ bd.querySelector('#hpErr').textContent = e.message; }
    };
  }
  async function peopleDlg(){
    const bd = dialog('People & access', '<p style="color:#6b7585">Loading…</p>');
    let list = [];
    const me = session().me;
    const draw = (err) => {
      bd.innerHTML = `<div>${list.map(p => `<div class="hub-row ${p.active?'':'hub-off'}"><div><b>${esc(p.name)}</b><small>${[p.admin?'Admin':'', p.tutor?'Tutor':''].filter(Boolean).join(' + ') || 'No role'}${p.active?'':' · switched off'}</small></div>
          ${p.id===me.id?'<small>You</small>':`<button data-a="pin" data-id="${p.id}">Reset PIN</button><button data-a="role" data-id="${p.id}">Roles</button><button data-a="${p.active?'off':'on'}" data-id="${p.id}">${p.active?'Switch off':'Switch on'}</button>`}</div>`).join('')}</div>
        <h3 style="margin:18px 0 6px;font-size:15px">Add a person</h3>
        <input class="hub-in" id="npName" placeholder="Full name">
        <div class="hub-chk"><label><input type="checkbox" id="npAdmin"> Admin</label><label><input type="checkbox" id="npTutor" checked> Tutor</label></div>
        <input class="hub-in" id="npPin" inputmode="numeric" maxlength="6" placeholder="Their first PIN (4 to 6 digits)">
        <button class="hub-go" id="npGo">Add person</button>
        <p class="hub-err">${esc(err || '')}</p>
        <p style="color:#6b7585;font-size:13px">Tell each person their PIN yourself. They can change it under their name, top right.</p>`;
      bd.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
        const p = list.find(x => x.id === b.dataset.id), a = b.dataset.a;
        let body = {id:p.id};
        if(a === 'pin'){ const pin = prompt(`New PIN for ${p.name} (4 to 6 digits)`); if(!pin) return; body = {action:'pin', id:p.id, pin}; }
        else if(a === 'role'){ const admin = confirm(`Should ${p.name} be an admin? OK = yes, Cancel = no`); const tutor = confirm(`Should ${p.name} be a tutor? OK = yes, Cancel = no`); body = {action:'update', id:p.id, name:p.name, admin, tutor}; }
        else { if(a === 'off' && !confirm(`Switch off ${p.name}? They are signed out everywhere straight away.`)) return; body = {action:a, id:p.id}; }
        try{ const r = await api('people', {method:'POST', body:JSON.stringify(body)}); list = r.people; draw(); note(a==='pin'?`New PIN set for ${p.name}`:'Saved'); }catch(e){ draw(e.message); }
      });
      bd.querySelector('#npGo').onclick = async () => {
        const body = {action:'add', name:bd.querySelector('#npName').value, admin:bd.querySelector('#npAdmin').checked, tutor:bd.querySelector('#npTutor').checked, pin:bd.querySelector('#npPin').value};
        try{ const r = await api('people', {method:'POST', body:JSON.stringify(body)}); list = r.people; draw(); note(`${body.name.trim()} added`); }catch(e){ draw(e.message); }
      };
    };
    try{ list = (await api('people', {method:'POST', body:JSON.stringify({action:'list'})})).people; draw(); }catch(e){ draw(e.message); }
  }

  /* first sign-in on a device that already has documents */
  function offerUpload(n, serverEmpty){
    if(document.getElementById('hubUp')) return;
    const b = el(`<div class="hub-banner" id="hubUp"><span>${serverEmpty ? `This device has <b>${n}</b> saved document${n===1?'':'s'}. Upload ${n===1?'it':'them'} to LHQ Hub so every device sees ${n===1?'it':'them'}?` : `<b>${n}</b> document${n===1?'':'s'} on this device ${n===1?'is':'are'} not in LHQ Hub yet.`}</span><button type="button">Upload</button><button type="button" class="x">Later</button></div>`);
    document.body.appendChild(b);
    b.querySelector('button').onclick = async () => { b.remove(); await push(); note(`${n} document${n===1?'':'s'} uploaded`); };
    b.querySelector('.x').onclick = () => b.remove();
  }

  /* ---------- start ---------- */
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  window.addEventListener('DOMContentLoaded', () => {
    if(location.protocol === 'file:') return;           // opened as a file: works on this device only, as before
    setInterval(check, 60000);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') check(); });
    window.addEventListener('online', () => { if(!session()) return; status('saving'); schedulePush(1000); setTimeout(() => { if(get(DIRTY, false)) push(); }, 5000); });
    window.addEventListener('offline', () => { if(session()) status('offline'); });
    if(!session()){ showSignIn(); return; }
    mountAccount();
    if(window.hubReady) window.hubReady();
    // this device already has LHQ's documents: only fetch them again if something changed
    if(get(REV, null) == null) pull().catch(() => status('offline'));
    else check().then(() => { if(!navigator.onLine) status('offline'); });
  });
  window.hub = {push, pull, session, changes, api, signOut};
})();
