/* LHQ Hub › Settings › Move pilot data (Director only).
   1. On the live Hub: copy the pilot group (chosen students, their cards, tutors and accounts) into a file.
   2. On the test site: add that file.
   3. At launch, on the test site: put what the pilot made into a file.
   4. On the live Hub: add that file.
   The file is gzipped and locked with AES-GCM under a passphrase (PBKDF2, 250,000 rounds): it holds names, marks and password hashes. */
window.MOVE = (function(){
  const ST = {pick: new Set(), q: '', busy: ''};
  const isTest = () => document.documentElement.classList.contains('lhq-test');
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u => { let s = ''; for(let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function key(pass, salt){ const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']); }
  async function lock(obj, pass){ const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await key(pass, salt), pako.gzip(enc.encode(JSON.stringify(obj)))));
    return {app: 'LHQ Hub move', v: 1, dir: obj.dir, at: obj.at, salt: b64(salt), iv: b64(iv), data: b64(data)}; }
  async function unlock(env, pass){ const k = await key(pass, unb64(env.salt));
    const raw = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64(env.iv)}, k, unb64(env.data)); return JSON.parse(dec.decode(pako.ungzip(new Uint8Array(raw)))); }
  const passOk = (a, b) => !a || a.length < 10 ? 'Use a passphrase of 10 characters or more.' : a !== b ? 'The two passphrases differ.' : '';
  const day = () => HD.today();
  function page(){
    const test = isTest(), S = HD.students().slice().sort((a, b) => a.name.localeCompare(b.name)), q0 = ST.q.toLowerCase();
    const list = S.filter(s => !q0 || s.name.toLowerCase().includes(q0)).slice(0, 60);
    const passF = id => `<label class="f"><span>Passphrase</span><input class="in" type="password" id="${id}1" autocomplete="new-password"></label><label class="f"><span>Again</span><input class="in" type="password" id="${id}2" autocomplete="new-password"></label>`;
    const addF = (id, from) => `<label class="f"><span>Passphrase</span><input class="in" type="password" id="${id}P" autocomplete="off"></label><input type="file" id="${id}F" accept=".lhqmove,.json" hidden><button class="btn n" id="${id}Go" ${ST.busy ? 'disabled' : ''}>Add a file from ${from}</button>`;
    return `<h2 class="sec-h">Move pilot data</h2><p class="sec-p">${test ? 'This is the test site.' : 'This is the live Hub.'} Files are locked with a passphrase: keep it apart from the file.</p>
      ${ST.busy ? `<div class="card pad"><b>${esc(ST.busy)}</b><p class="note" style="margin:4px 0 0">Keep this page open.</p></div>` : ''}
      ${test ? `<div class="card pad"><div class="cap">2 · Add the pilot group</div><p class="note" style="margin:0 0 10px">The file made on the live Hub: the students, their cards and documents, their tutors and their accounts (same passwords). Turn the pilot on first (Demo data).</p>${addF('mvA', 'the live Hub')}</div>
        <div class="card pad"><div class="cap">3 · At launch: move the pilot back</div><p class="note" style="margin:0 0 10px">Accounts with their passwords, session logs, SRA and ARS marks, follow-ups, objectives, school results, plans, focus and reports. Documents and money stay with the live Hub.</p>${passF('mvB')}<button class="btn n" id="mvBGo" ${ST.busy ? 'disabled' : ''}>Make the file</button></div>`
      : `<div class="card pad"><div class="cap">1 · Copy the pilot group to the test site</div><p class="note" style="margin:0 0 10px">Tick the pilot students. Their tutors, parents and accounts come with them.</p>
          <input class="in" id="mvQ" placeholder="Find a student" value="${esc(ST.q)}" autocomplete="off" style="margin-bottom:8px"><div class="chips" style="margin-bottom:10px">${list.map(s => `<button class="chip${ST.pick.has(s.name) ? ' on' : ''}" data-mvs="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>
          <p class="note" style="margin:0 0 10px">${ST.pick.size} chosen${ST.pick.size ? ': ' + [...ST.pick].map(esc).join(', ') : ''}</p>${passF('mvC')}<button class="btn n" id="mvCGo" ${ST.busy || !ST.pick.size ? 'disabled' : ''}>Make the file</button></div>
        <div class="card pad"><div class="cap">4 · At launch: add the pilot back</div><p class="note" style="margin:0 0 10px">The file made on the test site. Nothing here is deleted; for anything in both, the newer copy wins.</p>${addF('mvD', 'the test site')}</div>`}
      <p class="note">Phone notifications and calendar links can't move: after a move, people allow notifications again and copy their calendar link again.</p>`;
  }
  async function make(dir, pass, students){
    ST.busy = 'Making the file…'; render();
    try{ const j = await hub.api('move', {method: 'POST', body: JSON.stringify({op: 'export', dir, students})});
      const env = await lock(j, pass), name = `LHQ-${dir === 'live-to-test' ? 'pilot-group' : 'pilot-back'}_${day()}.lhqmove`;
      const blob = new Blob([JSON.stringify(env)], {type: 'application/json'}), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(`File made: ${j.people.length} accounts, ${Object.keys(j.kv).length} lists${j.docs.length ? `, ${j.docs.length} documents` : ''}`); }
    catch(e){ toast(e.message); }
    ST.busy = ''; render();
  }
  async function add(file, pass, want){
    let env; try{ env = JSON.parse(await file.text()); }catch(e){ toast('That isn\'t a move file'); return; }
    if(!env || env.app !== 'LHQ Hub move'){ toast('That isn\'t a move file'); return; }
    if(env.dir !== want){ toast(want === 'live-to-test' ? 'That file is for the live Hub, not here.' : 'That file is for the test site, not here.'); return; }
    let d; try{ d = await unlock(env, pass); }catch(e){ toast('Wrong passphrase'); return; }
    const logs = ((d.kv.lhq_logs || {}).e) ? Object.keys(d.kv.lhq_logs.e).length : 0;
    const sum = `${d.people.length} accounts, ${d.students.length} students, ${logs} log lines, ${Object.keys(d.kv).length} lists${d.docs.length ? `, ${d.docs.length} documents` : ''}`;
    if(!confirm(`Add from the file made ${new Date(env.at).toLocaleString('en-GB')}?\n\n${sum}\n\nNothing is deleted. For anything in both, the newer copy wins.`)) return;
    const post = body => hub.api('move', {method: 'POST', body: JSON.stringify(Object.assign({op: 'import', dir: want}, body))});
    try{
      ST.busy = 'Adding accounts…'; render(); await post({part: 'people', people: d.people, students: d.students, guardians: d.guardians});
      const K = Object.keys(d.kv); for(let i = 0; i < K.length; i++){ ST.busy = `Adding lists · ${i + 1} of ${K.length}`; render(); await post({part: 'kv', key: K[i], value: d.kv[K[i]]}); }
      for(let i = 0; i < d.docs.length; i += 40){ ST.busy = `Adding documents · ${Math.min(i + 40, d.docs.length)} of ${d.docs.length}`; render(); await post({part: 'docs', docs: d.docs.slice(i, i + 40)}); }
      await post({part: 'done', summary: sum}); ST.busy = ''; await hub.pull(); await HD.refreshPeople(); toast('Added · ' + sum); render();
    }catch(e){ ST.busy = ''; render(); toast(e.message + ' · add the file again: nothing doubles'); }
  }
  function bind(){
    document.querySelectorAll('[data-mvs]').forEach(b => b.onclick = () => { const n = b.dataset.mvs; ST.pick.has(n) ? ST.pick.delete(n) : ST.pick.add(n); render(); });
    const qi = $('mvQ'); if(qi){ qi.oninput = () => { ST.q = qi.value; const at = qi.selectionStart; render(); const n = $('mvQ'); if(n){ n.focus(); n.setSelectionRange(at, at); } }; }
    if($('mvCGo')) $('mvCGo').onclick = () => { const e = passOk($('mvC1').value, $('mvC2').value); if(e){ toast(e); return; } make('live-to-test', $('mvC1').value, [...ST.pick]); };
    if($('mvBGo')) $('mvBGo').onclick = () => { const e = passOk($('mvB1').value, $('mvB2').value); if(e){ toast(e); return; } make('test-to-live', $('mvB1').value); };
    [['mvA', 'live-to-test'], ['mvD', 'test-to-live']].forEach(([id, want]) => { const go = $(id + 'Go'), f = $(id + 'F'); if(!go) return;
      go.onclick = () => { if(!$(id + 'P').value){ toast('Type the passphrase first'); return; } f.click(); };
      f.onchange = () => { const file = f.files[0], pass = $(id + 'P').value; f.value = ''; if(file) add(file, pass, want); }; });
  }
  return {page, bind, _lock: lock, _unlock: unlock};
})();
