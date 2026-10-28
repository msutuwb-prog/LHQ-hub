/* LHQ Hub › Teaching: the tutor's own part of the Hub. Today (sessions, SRAs to give, collect and print), the session
   log with "Finished this topic", classes, and the SRA tracker. A tutor sees only the students on their tuition cards
   (the server sends only those). Saves go straight to LHQ; without a connection they wait on the phone and go later.
   Rendered by index.html at #teach…; uses SRA (sra.js) and, for topic names, card.js + topics.js (loaded on first use). */
window.TUT = (function(){
  const CK = 'lhq_teach', QK = 'lhq_teach_q';
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const DAYN = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'}, DAYC = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const read = (k, d) => { try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } };
  const write = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  let data = read(CK, null), loading = null, libs = null, err = '';

  /* ---------- data ---------- */
  function ensureLibs(){
    if(window.cardTopicNames) return Promise.resolve();
    if(libs) return libs;
    const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return libs = load('topics.js').then(() => load('card.js')).catch(() => {});
  }
  async function fetchData(){
    if(loading) return loading;
    loading = (async () => {
      await flush();
      try{ const j = await hub.api('tutor'); data = {cards: j.cards || [], entries: j.entries || [], classes: j.classes || [], at: Date.now()}; write(CK, data); err = ''; }
      catch(e){ err = navigator.onLine ? e.message : 'offline'; }
      loading = null; render();
    })();
    return loading;
  }
  async function flush(){
    const q = read(QK, []); if(!q.length) return;
    try{
      const ent = q.filter(x => x.t === 'e').flatMap(x => x.entries);
      if(ent.length) await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'entries', entries: ent})});
      for(const c of q.filter(x => x.t === 'c')) await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls: c.cls})});
      write(QK, []);
    }catch(e){}
  }
  addEventListener('online', () => { if(read(QK, []).length) fetchData(); });
  async function saveEntries(list){
    data.entries = data.entries.filter(e => !list.some(x => x.id === e.id)).concat(list.map(e => Object.assign({}, e, {tutor: me().name, at: Date.now()})));
    write(CK, data); render();
    try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'entries', entries: list})}); return true; }
    catch(e){ if(navigator.onLine && !/fetch|network/i.test(e.message)){ toast(e.message); return false; }
      const q = read(QK, []); q.push({t:'e', entries: list}); write(QK, q); toast('Saved on this device. It goes to LHQ when you are back online.'); return true; }
  }

  /* roster: one item per student + subject, from the newest tuition card */
  function items(){
    if(!data) return [];
    const by = new Map();
    data.cards.slice().sort((a, b) => (a.periodStart || a.date || '').localeCompare(b.periodStart || b.date || '')).forEach(c => (c.subjects || []).forEach(x => {
      const k = nk(c.student) + '|' + nk(x.name), was = by.get(k);
      let topics = []; try{ if(window.cardTopicNames) topics = cardTopicNames(cardFixPicks(JSON.parse(JSON.stringify(x)))); }catch(e){}
      by.set(k, {k, st: c.student, sub: x.name, lv: c.level, days: x.days || [], times: x.times || {}, start: x.start || '', end: x.end || '', where: c.where || '',
        a: was ? was.a : (c.periodStart || ''), b: c.periodEnd || '', card: c, x, topics: topics.length ? topics : (was ? was.topics : [])});
    }));
    return [...by.values()].sort((a, b) => a.st.localeCompare(b.st) || a.sub.localeCompare(b.sub));
  }
  const live = () => (data ? data.entries : []).filter(e => !e.x);
  const timeOf = (it, d) => { const o = (it.times || {})[d]; return o && o.s ? `${o.s}–${o.e || ''}` : it.start ? `${it.start}–${it.end || ''}` : 'time TBC'; };
  const sras = () => SRA.build(items(), live(), today());
  const whereCode = w => /online/i.test(w || '') ? 'o' : /home/i.test(w || '') ? 'h' : 'c';

  /* ---------- small pieces ---------- */
  const chip = (attrs, on, t) => `<button type="button" class="chip${on ? ' on' : ''}" ${attrs}>${t}</button>`;
  const seg = (key, opts, cur) => `<div class="seg" data-tseg="${key}">${opts.map(([v, l]) => `<button type="button" class="${String(cur) === String(v) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const head = (t, s, acts = '') => `<div class="ph"><div class="tt"><h1>${t}</h1><p>${s}</p></div>${acts}</div>`;
  const back = (h, l) => `<a class="crumb" href="${h}">${ic('back',16,2.2)} ${l}</a>`;
  const stuOf = k => k.split('|')[0];
  const ref = x => [x.k, x.topic, x.stage].map(v => encodeURIComponent(v)).join('/');

  /* ---------- pages ---------- */
  function page(sub, a1, a2){
    if(!data){ fetchData(); return head('Teaching', 'Getting your students…') + (err ? `<p class="empty">${err === 'offline' ? 'No connection. Your students appear once you are online.' : esc(err)}</p>` : ''); }
    if(!window.cardTopicNames) ensureLibs().then(render);
    if(Date.now() - (data.at || 0) > 60000) fetchData();
    if(sub === 'students') return students();
    if(sub === 'log') return logPage(decodeURIComponent(a1 || ''), a2);
    if(sub === 'sra') return sraPage(a1 || 'week');
    if(sub === 'classes') return classesPage();
    if(sub === 'class') return classPage(a1);
    return home();
  }
  function home(){
    const t = today(), dow = DAYC[new Date().getDay()], I = items(), L = live();
    const todays = I.filter(it => SRA.isDay(it, t)).sort((a, b) => timeOf(a, dow).localeCompare(timeOf(b, dow)));
    const T = SRA.today(sras(), t), q = read(QK, []).length;
    const logged = it => L.some(e => e.ty === 's' && e.k === it.k && e.d === t);
    const row = it => `<div class="it"><span class="t"><b>${esc(it.st)} · ${esc(it.sub)}</b><small>${esc(timeOf(it, dow))}${it.where ? ' · ' + esc(it.where) : ''}</small></span>${logged(it) ? '<span class="tag ok">Logged</span>' : `<a class="btn sm n" href="#teach/log/${encodeURIComponent(it.k)}">Log</a>`}</div>`;
    const giveRows = T.give.map(x => `<div class="it"><span class="t"><b>${esc(x.st)} · ${esc(x.topic)}</b><small>${esc(x.sub)} · ${x.label} · do on ${nice(x.doOn)}${x.status === 'overdue' ? ` · <span style="color:var(--rd);font-weight:700">was for ${nice(x.giveOn)}</span>` : ''}</small></span><button class="btn sm" data-tgive="${ref(x)}">Given</button></div>`).join('');
    const collRows = T.collect.map(x => `<div class="it"><span class="t"><b>${esc(x.st)} · ${esc(x.topic)}</b><small>${x.label} · given ${nice(x.given.d)}${x.status === 'late' ? ' · <span style="color:var(--am);font-weight:700">late</span>' : ''}</small></span><button class="btn sm" data-tin="${ref(x)}">Handed in?</button></div>`).join('');
    return head('Teaching', `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]} ${nice(t)}${q ? ` · ${q} save${q === 1 ? '' : 's'} waiting to send` : ''}`, `<div class="acts"><button class="btn n" data-tlogpick>${ic('plus',16,2.4)} Log a session</button></div>`) + `
      <div class="pc-g mcs" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        <a class="mc" href="#teach/students"><span class="l">${ic('users',15,2)}My students</span><div class="v">${new Set(I.map(i => stuOf(i.k))).size}</div><div class="s">${I.length} subject${I.length === 1 ? '' : 's'}</div></a>
        <a class="mc" href="#teach/sra"><span class="l">${ic('restore',15,2)}SRA tracker</span><div class="v">${T.give.length}</div><div class="s">to give today · ${T.collect.length} to collect</div></a>
        <a class="mc" href="#teach/classes"><span class="l">${ic('users',15,2)}Classes</span><div class="v">${(data.classes || []).length}</div><div class="s">official classes</div></a></div>
      <div class="h2">Today's sessions <em>${todays.length}</em></div><div class="card">${todays.map(row).join('') || '<p class="empty">No sessions on your timetable today.</p>'}</div>
      <div class="h2">SRAs to give today <em>${T.give.length}</em></div><div class="card">${giveRows || '<p class="empty">Nothing to hand out today.</p>'}${T.give.length > 1 ? `<div class="it"><span class="t"></span><button class="btn sm n" data-tgiveall>All given</button></div>` : ''}</div>
      <div class="h2">To collect <em>${T.collect.length}</em></div><div class="card">${collRows || '<p class="empty">Nothing due back today.</p>'}</div>
      <div class="h2">Print for ${T.printDay === SRA.add(t, 1) ? 'tomorrow' : nice(T.printDay)} <em>${(n => n + (n === 1 ? ' copy' : ' copies'))(T.print.reduce((a, g) => a + g.students.length, 0))}</em></div>
      <div class="card">${T.print.map(g => `<div class="it"><span class="t"><b>${esc(g.topic)} · ${g.label}</b><small>${esc(g.sub)} · ${g.students.map(s => esc(s.st.split(' ')[0])).join(', ')}</small></span><span class="tag bl">× ${g.students.length}</span></div>`).join('') || '<p class="empty">Nothing to print yet.</p>'}</div>
      <p class="note">SRAs come from the topics you mark as finished when you log a session.</p>`;
  }
  function students(){
    const I = items(), byS = new Map(); I.forEach(it => { const s = stuOf(it.k); if(!byS.has(s)) byS.set(s, []); byS.get(s).push(it); });
    return back('#teach', 'Teaching') + head('My students', `${byS.size} student${byS.size === 1 ? '' : 's'} on your tuition cards`) + [...byS.values()].map(L => `<div class="card pad"><b style="font-size:16px">${esc(L[0].st)}</b><small style="display:block;color:var(--muted)">${esc(L[0].lv || '')}</small>
      ${L.map(it => `<div class="it"><span class="t"><b>${esc(it.sub)}</b><small>${(it.days || []).map(d => DAYN[d]).join(', ') || 'days TBC'} · ${esc(timeOf(it, (it.days || [])[0]))}${it.b ? ' · until ' + nice(it.b) : ''}</small></span><a class="btn sm n" href="#teach/log/${encodeURIComponent(it.k)}">Log session</a></div>`).join('')}</div>`).join('') || '<p class="empty">No students yet. They appear when LHQ puts you on a tuition card.</p>';
  }

  /* the session log, for one student or a class */
  let form = null;
  function logPage(key, eid){
    const cls = key.startsWith('class:') ? (data.classes || []).find(c => c.id === key.slice(6)) : null;
    const I = items(), it = cls ? null : I.find(x => x.k === key);
    if(!cls && !it) return back('#teach', 'Teaching') + '<p class="empty">That student isn\'t on your tuition cards.</p>';
    const members = cls ? I.filter(x => cls.stu.includes(stuOf(x.k)) && nk(x.sub) === nk(cls.sub)) : [it];
    if(!form || form.key !== key || (eid && form.id !== eid)){
      const ex = eid ? live().find(e => e.id === eid) : null;
      form = ex ? {key, id: ex.id, d: ex.d, a: ex.a, mk: ex.mk || 0, md: ex.md || 'c', tp: ex.tp || [], fin: ex.fin || [], sc: ex.sc ?? '', mx: ex.mx ?? '', n: ex.n || '', att: {}}
        : {key, d: today(), a: 'attended', mk: 0, md: whereCode((cls ? cls.mode : (it.where || ''))), tp: [], fin: [], sc: '', mx: '', n: '', att: Object.fromEntries(members.map(m => [m.k, 'attended']))};
    }
    const f = form, used = live().filter(e => members.some(m => m.k === e.k)).flatMap(e => e.tp || []);
    const done = new Set(live().filter(e => members.some(m => m.k === e.k)).flatMap(e => e.fin || []));
    const choices = [...new Set(members.flatMap(m => m.topics).concat(used, f.tp))].filter(Boolean);
    const taught = cls ? true : f.a !== 'absent' && f.a !== 'cancelled';
    return back('#teach', 'Teaching') + head(cls ? 'Log a class session' : 'Log a session', cls ? `${esc(cls.name)} · ${esc(cls.sub)} · ${members.length} students` : `${esc(it.st)} · ${esc(it.sub)}`) + `
      <div class="card pad"><label class="f"><span>Session date</span><input class="in" type="date" id="tD" value="${f.d}" max="${today()}"></label>
      ${cls ? `<div class="cap" style="margin-top:6px">Attendance</div>${members.map(m => `<div style="padding:8px 0;border-top:1px solid var(--line2)"><b style="display:block;margin-bottom:6px">${esc(m.st)}</b>${seg('att:' + m.k, [['attended','Here'],['late','Late'],['absent','Absent']], f.att[m.k] || 'attended')}</div>`).join('')}`
        : `<div class="cap" style="margin-top:6px">Attendance</div>${seg('a', [['attended','Attended'],['late','Late'],['absent','Student absent'],['cancelled',"I couldn't teach"]], f.a)}
        ${taught ? '' : '<p class="note" style="margin-top:6px">A make-up session is owed. When you teach it, log it as a make-up.</p>'}`}
      ${taught ? `<div class="cap" style="margin-top:14px">Session</div>${seg('mk', [[0,'Regular'],[1,'Make-up']], f.mk)}` : ''}
      <div class="cap" style="margin-top:14px">Where</div>${seg('md', [['c','At LHQ'],['o','Online'],['h',"Student's home"]], f.md)}</div>
      ${taught ? `<div class="card pad"><div class="cap">Topics covered</div><div class="chips">${choices.map(t => chip(`data-ttp="${esc(t)}"`, f.tp.includes(t), esc(t) + (done.has(t) ? ' ✓' : ''))).join('') || '<p class="note" style="margin:0">Add the topic below.</p>'}</div>
        <div class="addrow" style="margin-top:8px"><input class="in" id="tNewTp" placeholder="Another topic"><button class="btn sm" id="tAddTp">Add</button></div>
        ${f.tp.length ? `<div class="cap" style="margin-top:14px">Finished today? <span style="text-transform:none;letter-spacing:0;font-weight:600">Starts its SRAs: today, then 1, 3, 7, 14 days and a month</span></div><div class="chips">${f.tp.map(t => chip(`data-tfin="${esc(t)}"`, f.fin.includes(t), (f.fin.includes(t) ? 'Finished: ' : '') + esc(t))).join('')}</div>` : ''}</div>
      ${cls ? '' : `<div class="card pad"><div class="cap">Topical assessment today?</div>${seg('test', [[0,'No'],[1,'Yes, enter the score']], f.sc !== '' || f._test ? 1 : 0)}
        ${f.sc !== '' || f._test ? `<div class="r2" style="margin-top:10px"><label class="f"><span>Score</span><input class="in" id="tSc" inputmode="decimal" value="${esc(f.sc)}"></label><label class="f"><span>Out of</span><input class="in" id="tMx" inputmode="decimal" value="${esc(f.mx)}"></label></div>` : ''}</div>`}` : ''}
      <div class="card pad"><label class="f" style="margin:0"><span>One line for the parent (optional)</span><textarea class="in" id="tN" rows="2" maxlength="140" style="min-height:0;height:72px" placeholder="e.g. Much more confident with mole calculations this week.">${esc(f.n)}</textarea></label></div>
      <button class="btn n full" id="tSave">Save</button>${f.id ? '<button class="btn rd full" id="tDel" style="margin-top:8px">Delete this entry</button>' : ''}`;
  }
  function saveLog(){
    const f = form, key = f.key, cls = key.startsWith('class:') ? (data.classes || []).find(c => c.id === key.slice(6)) : null, I = items();
    const members = cls ? I.filter(x => cls.stu.includes(stuOf(x.k)) && nk(x.sub) === nk(cls.sub)) : I.filter(x => x.k === key);
    if(f.sc !== '' && !(parseFloat(f.mx) > 0)){ toast('Enter what the score was out of'); return; }
    if(f.sc !== '' && parseFloat(f.sc) > parseFloat(f.mx)){ toast('The score is higher than the total'); return; }
    const list = members.map(m => { const a = cls ? (f.att[m.k] || 'attended') : f.a, taught = a !== 'absent' && a !== 'cancelled';
      const e = {id: cls ? (f.ids && f.ids[m.k]) || uid() : f.id || uid(), ty: 's', k: m.k, st: m.st, sub: m.sub, d: f.d, a, md: f.md};
      if(cls) e.cls = cls.id;
      if(taught){ e.tp = f.tp.slice(); if(f.fin.length) e.fin = f.fin.filter(t => f.tp.includes(t)); if(+f.mk) e.mk = 1; if(!cls && f.sc !== ''){ e.sc = +f.sc; e.mx = +f.mx; } }
      if(f.n) e.n = f.n; return e; });
    saveEntries(list).then(ok => { if(!ok) return; const n = list.reduce((a, e) => a + (e.fin || []).length, 0); toast(n ? `Saved · SRAs scheduled for ${n} topic${n === 1 ? '' : 's'}` : 'Saved'); form = null; location.hash = '#teach'; });
  }

  /* SRA tracker */
  function sraPage(tab){
    const L = sras().filter(x => !x.paused), t = today();
    const tabs = `<div class="tabs"><a class="${tab === 'week' ? 'on' : ''}" href="#teach/sra/week">Next 7 days</a><a class="${tab === 'students' ? 'on' : ''}" href="#teach/sra/students">By student</a></div>`;
    let body = '';
    if(tab === 'students'){
      const by = new Map(); L.forEach(x => { const k = x.k + '\u0001' + x.topic; if(!by.has(k)) by.set(k, []); by.get(k).push(x); });
      const ST = {after: ['gr', 'next period'], in: ['ok', '✓'], give: ['am', 'today'], overdue: ['rd', '!'], collect: ['bl', 'due back'], late: ['am', 'late'], given: ['bl', 'given'], upcoming: ['gr', '']};
      body = [...by.values()].sort((a, b) => a[0].st.localeCompare(b[0].st)).map(R => `<div class="it"><span class="t"><b>${esc(R[0].st)} · ${esc(R[0].topic)}</b><small>${esc(R[0].sub)} · learnt ${nice(R[0].learnt)}</small>
        <span style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${R.map(x => `<span class="tag ${ST[x.status][0]}" title="${x.label}: do on ${nice(x.doOn)}">${x.stage === 0 ? 'LD' : 'R' + x.stage}${x.score ? ' ' + Math.round(x.score.sc / x.score.mx * 100) + '%' : ST[x.status][1] ? ' ' + ST[x.status][1] : ' ' + nice(x.doOn)}</span>`).join('')}</span></span></div>`).join('');
      body = `<div class="card">${body || '<p class="empty">No topics marked finished yet.</p>'}</div><p class="note">LD = Learning Day SRA, R1–R5 = reviews 1–5.</p>`;
    } else {
      const days = Array.from({length: 7}, (_, i) => SRA.add(t, i));
      body = days.map(d => { const g = L.filter(x => x.giveOn === d && ['upcoming','give'].includes(x.status)); const late = d === t ? L.filter(x => x.status === 'overdue') : [];
        return `<div class="h2">${d === t ? 'Today' : d === SRA.add(t, 1) ? 'Tomorrow' : nice(d)} <em>${g.length + late.length}</em></div><div class="card">${late.concat(g).map(x => `<div class="it"><span class="t"><b>${esc(x.st)} · ${esc(x.topic)}</b><small>${esc(x.sub)} · ${x.label}${x.giveOn !== x.doOn ? ` · give ${nice(x.giveOn)}, do on ${nice(x.doOn)}` : ''}</small></span>${x.status === 'overdue' ? '<span class="tag rd">not given yet</span>' : ''}</div>`).join('') || '<p class="empty">None.</p>'}</div>`; }).join('');
    }
    return back('#teach', 'Teaching') + head('SRA tracker', 'When each SRA is given, done and collected') + tabs + body;
  }

  /* classes */
  function classesPage(){
    const C = data.classes || [];
    return back('#teach', 'Teaching') + head('Classes', 'Official classes that don’t change. Everything else is one-to-one.', `<div class="acts"><button class="btn n" data-tclsnew>${ic('plus',16,2.4)} New class</button></div>`) +
      `<div class="card">${C.map(c => `<a class="it" href="#teach/class/${c.id}"><span class="t"><b>${esc(c.name)}</b><small>${esc(c.sub)} · ${c.stu.length} students · ${esc(c.mode)}</small></span><span class="chev">${ic('chev',16,2)}</span></a>`).join('') || '<p class="empty">No classes. Create one when the same students are taught a topic together, in person or online.</p>'}</div>
      <p class="note">Finishing a topic in a class starts its SRAs for every student who was there.</p>`;
  }
  function classPage(id){
    const c = (data.classes || []).find(x => x.id === id); if(!c) return back('#teach/classes', 'Classes') + '<p class="empty">Class not found.</p>';
    const I = items(), M = I.filter(x => c.stu.includes(stuOf(x.k)) && nk(x.sub) === nk(c.sub));
    return back('#teach/classes', 'Classes') + head(esc(c.name), `${esc(c.sub)} · ${esc(c.mode)}`, `<div class="acts"><a class="btn n" href="#teach/log/${encodeURIComponent('class:' + c.id)}">Log class session</a></div>`) +
      `<div class="card">${M.map(m => `<div class="it"><span class="t"><b>${esc(m.st)}</b><small>${esc(m.lv || '')}</small></span></div>`).join('')}</div>
      <div class="acts"><button class="btn" data-tclsedit="${c.id}">${ic('edit',15)} Change students</button><button class="btn rd" data-tclsdel="${c.id}">Remove class</button></div>`;
  }
  function classSheet(id){
    const c = id ? (data.classes || []).find(x => x.id === id) : null, I = items();
    const subs = [...new Set(I.map(i => i.sub))].sort();
    let sub = c ? c.sub : subs[0] || '', pick = new Set(c ? c.stu : []);
    const draw = () => { const S = I.filter(i => nk(i.sub) === nk(sub));
      $('tcStu').innerHTML = S.map(i => chip(`data-tcs="${esc(stuOf(i.k))}"`, pick.has(stuOf(i.k)), esc(i.st))).join('') || '<p class="note">None of your students take this subject.</p>';
      document.querySelectorAll('[data-tcs]').forEach(b => b.onclick = () => { const k = b.dataset.tcs; pick.has(k) ? pick.delete(k) : pick.add(k); draw(); }); };
    openSheet(`<div class="hx"><h3>${c ? 'Change class' : 'New class'}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>Name</span><input class="in" id="tcN" value="${esc(c ? c.name : '')}" placeholder="e.g. Year 11 Chemistry, Saturday group"></label>
      <label class="f"><span>Subject</span><select class="in" id="tcSub">${subs.map(s => `<option ${s === sub ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <div class="cap">How it's taught</div>${seg('cm', [['in person','In person'],['online','Online']], c ? c.mode : 'in person')}
      <div class="cap" style="margin-top:12px">Students</div><div class="chips" id="tcStu"></div>
      <button class="btn n full" id="tcGo" style="margin-top:14px">Save class</button>`);
    let mode = c ? c.mode : 'in person';
    document.querySelectorAll('[data-tseg="cm"] button').forEach(b => b.onclick = () => { mode = b.dataset.v; document.querySelectorAll('[data-tseg="cm"] button').forEach(x => x.classList.toggle('on', x === b)); });
    $('tcSub').onchange = e => { sub = e.target.value; pick = new Set(); draw(); };
    draw();
    $('tcGo').onclick = async () => {
      const cls = {id: c ? c.id : undefined, name: $('tcN').value.trim(), sub, mode, stu: [...pick]};
      try{ const r = await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls})}); data.classes = (data.classes || []).filter(x => x.id !== r.cls.id).concat(r.cls); write(CK, data); closeSheet(); toast('Class saved'); location.hash = '#teach/class/' + r.cls.id; }
      catch(e){ toast(e.message); }
    };
  }
  function handInSheet(x){
    let h = 'o';
    openSheet(`<div class="hx"><h3>${esc(x.st)} · ${esc(x.topic)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${x.label} · given ${nice(x.given.d)}</p>
      ${seg('h', [['o','Handed in'],['l','Handed in late'],['m','Not handed in']], h)}
      <div class="r2" id="tHs" style="margin-top:12px"><label class="f"><span>Score</span><input class="in" id="thSc" inputmode="decimal"></label><label class="f"><span>Out of</span><input class="in" id="thMx" inputmode="decimal" value="10"></label></div>
      <p class="note" id="tHn" hidden>It moves to the next session day.</p><button class="btn n full" id="thGo">Save</button>`);
    document.querySelectorAll('[data-tseg="h"] button').forEach(b => b.onclick = () => { h = b.dataset.v; document.querySelectorAll('[data-tseg="h"] button').forEach(y => y.classList.toggle('on', y === b)); $('tHs').hidden = h === 'm'; $('tHn').hidden = h !== 'm'; });
    $('thGo').onclick = () => {
      const sc = $('thSc').value.trim(), mx = $('thMx').value.trim();
      if(h !== 'm' && sc !== '' && (!(parseFloat(mx) > 0) || parseFloat(sc) > parseFloat(mx))){ toast('Check the score'); return; }
      const e = {id: uid(), ty: 'r', v: 2, k: x.k, st: x.st, sub: x.sub, d: today(), tk: x.topic, rv: x.stage, h};
      if(h !== 'm' && sc !== ''){ e.sc = +sc; e.mx = +mx; }
      if(h === 'm'){ e.ty = 'g'; e.id = uid(); e.d = today(); delete e.h; delete e.v; }   // not handed in: given again, due the next session day
      saveEntries([e]).then(ok => { if(ok){ closeSheet(); toast(h === 'm' ? 'Moved to the next session day' : 'Saved'); } });
    };
  }

  /* ---------- taps ---------- */
  function bind(){
    const on = (sel, fn) => document.querySelectorAll(sel).forEach(el => el.onclick = ev => fn(el, ev));
    const L = () => sras();
    const find = v => { const [k, topic, st] = v.split('/').map(decodeURIComponent); return L().find(x => x.k === k && x.topic === topic && x.stage === +st); };
    on('[data-tgive]', el => { const x = find(el.dataset.tgive); if(x) saveEntries([{id: uid(), ty: 'g', k: x.k, st: x.st, sub: x.sub, d: today(), tk: x.topic, rv: x.stage}]).then(ok => ok && toast('Marked as given')); });
    on('[data-tgiveall]', () => { const G = SRA.today(L(), today()).give; saveEntries(G.map(x => ({id: uid(), ty: 'g', k: x.k, st: x.st, sub: x.sub, d: today(), tk: x.topic, rv: x.stage}))).then(ok => ok && toast(`${G.length} marked as given`)); });
    on('[data-tin]', el => { const x = find(el.dataset.tin); if(x) handInSheet(x); });
    on('[data-tlogpick]', () => { const I = items(), C = data.classes || [];
      openSheet(`<div class="hx"><h3>Log a session</h3><button class="ib" data-close>✕</button></div>${C.length ? `<div class="cap">Classes</div><div class="card">${C.map(c => `<a class="it" href="#teach/log/${encodeURIComponent('class:' + c.id)}"><span class="t"><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></span></a>`).join('')}</div>` : ''}
        <div class="cap">Students</div><div class="card">${I.map(it => `<a class="it" href="#teach/log/${encodeURIComponent(it.k)}"><span class="t"><b>${esc(it.st)}</b><small>${esc(it.sub)}</small></span></a>`).join('')}</div>`); });
    on('[data-tclsnew]', () => classSheet());
    on('[data-tclsedit]', el => classSheet(el.dataset.tclsedit));
    on('[data-tclsdel]', async el => { if(!confirm('Remove this class? Its logged sessions stay.')) return; try{ await hub.api('tutor', {method:'POST', body: JSON.stringify({action:'class', cls:{id: el.dataset.tclsdel, del: true}})}); data.classes = data.classes.filter(c => c.id !== el.dataset.tclsdel); write(CK, data); location.hash = '#teach/classes'; }catch(e){ toast(e.message); } });
    // the log form
    if($('tSave')){
      const f = form, keep = () => { if($('tD')) f.d = $('tD').value || today(); if($('tSc')) f.sc = $('tSc').value.trim(); if($('tMx')) f.mx = $('tMx').value.trim(); if($('tN')) f.n = $('tN').value.trim(); };
      document.querySelectorAll('[data-tseg]').forEach(s => s.querySelectorAll('button').forEach(b => b.onclick = () => { keep(); const k = s.dataset.tseg, v = b.dataset.v;
        if(k.startsWith('att:')) f.att[k.slice(4)] = v; else if(k === 'test'){ f._test = v === '1'; if(v === '0'){ f.sc = ''; f.mx = ''; } } else f[k] = k === 'mk' ? +v : v; render(); }));
      on('[data-ttp]', el => { keep(); const t = el.dataset.ttp; f.tp = f.tp.includes(t) ? f.tp.filter(x => x !== t) : f.tp.concat(t); f.fin = f.fin.filter(x => f.tp.includes(x)); render(); });
      on('[data-tfin]', el => { keep(); const t = el.dataset.tfin; f.fin = f.fin.includes(t) ? f.fin.filter(x => x !== t) : f.fin.concat(t); render(); });
      if($('tAddTp')){ const addTp = () => { keep(); const v = $('tNewTp').value.trim(); if(v && !f.tp.includes(v)) f.tp.push(v); render(); }; $('tAddTp').onclick = addTp; $('tNewTp').onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); addTp(); } }; }
      $('tSave').onclick = () => { keep(); saveLog(); };
      if($('tDel')) $('tDel').onclick = () => { if(!confirm('Delete this entry?')) return; const e = live().find(x => x.id === f.id); saveEntries([Object.assign({}, {id: e.id, k: e.k, st: e.st, sub: e.sub, d: e.d, ty: e.ty, x: 1})]).then(() => { form = null; location.hash = '#teach'; }); };
    }
  }
  const isTutor = () => me().role === 'tutor' || !!me().tutor;
  return {page, bind, isTutor, refresh: fetchData, items, sras};
})();
