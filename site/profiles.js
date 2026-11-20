/* LHQ Hub › profiles and birthdays.
   A student's profile is filled in by three people: LHQ (details, when enrolling), the student (about me, how I learn)
   and the parent (collection, health, photos, emergency contact). A tutor's by two: LHQ (subjects and levels, availability,
   placement and pay) and the tutor (details, bio, qualifications, topics less confident with).
   Stored in lhq_prof: "s:<student key>" and "p:<person name>", each section {…, at, by}; the server merges section by section.
   Birthdays come from the date of birth (a student's record, a person's details) and show on the day: a strip on every
   page, wishes from staff, and "Birthdays this week" on Home. Parents see none; students see only their tutors' and staff's. */
window.PROF = (function(){
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], HRS = [8, 10, 12, 14, 16, 18];
  const LV = ['Checkpoint','IGCSE','AS','A Level','IB','IELTS','SAT'];
  const BEST = ['Diagrams','Worked examples','Talking it through','Practice questions'], HARD = ['Long questions','Calculations','Remembering','Timing in exams'];
  const HOW = ['At LHQ','Online','Home visits'], CHK = [['id','ID copy'],['cv','CV'],['ref','References'],['police','Police clearance'],['contract','Contract signed']];
  const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const firstN = n => String(n || '').trim().split(/\s+/)[0];
  const meP = () => (window.HD && HD.me ? HD.me() : ((window.hub && hub.session && hub.session()) || {}).me) || {};
  const all = () => (window.HD && HD.store ? HD.store.get('lhq_prof', {}) : {}) || {};
  const todayISO = () => { const d = new Date(Date.now() + 2 * 3600e3); return d.toISOString().slice(0, 10); };
  const dobText = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}` : '';
  const dayMon = d => d ? `${+d.slice(8)} ${MON[+d.slice(5, 7) - 1]}` : '';
  const ageOn = (dob, d) => { const a = +d.slice(0, 4) - +dob.slice(0, 4); return d.slice(5) < dob.slice(5) ? a - 1 : a; };
  const nextBday = dob => { if(!/^\d{4}-\d{2}-\d{2}$/.test(dob || '')) return null; const t = todayISO(); let y = +t.slice(0, 4), on = y + dob.slice(4); if(on < t) on = (y + 1) + dob.slice(4);
    return {on, in: Math.round((Date.parse(on) - Date.parse(t)) / 864e5), age: ageOn(dob, on)}; };
  const done = (P, sec) => !!(P && P[sec] && P[sec].at);
  const toast = m => (window.hubToast || window.toast || (() => {}))(m);
  const rerender = () => { if(window.lhqRender) lhqRender(); else if(typeof render === 'function') render(); };

  /* ---------- what each section holds ---------- */
  const R = (k, l, opts) => [k, l, 'radio', opts];
  const SEC = {
    /* students */
    about:   {t:'About', fam:'About me', f:[['goals','What they want to study or do after school','text'],['interests','Interests','text'],['note','Anything else','text']]},
    learn:   {t:'How they learn', fam:'How I learn best', f:[['best','Understands best with','chips',BEST],['hard','Finds hard','chips',HARD],['note','Anything else the tutor should know','text']]},
    family:  {t:'Family and contacts', f:[['g2','Second parent or guardian','text'],['g2p','Their WhatsApp','tel'],['g2e','Their email','email'],R('pays','Who pays',[['1','First parent'],['2','Second parent'],['b','Both']]),R('reports','Reports go to',[['1','First parent'],['2','Second parent'],['b','Both']])]},
    emerg:   {t:'Emergency contact', f:[['n','Name','text'],['p','Phone','tel']]},
    collect: {t:'Collection', f:[R('mode','Who collects',[['named','Only people the parent names'],['alone','May leave on their own']]),['who','Names (and who they are)','text'],['note','Note','text']]},
    health:  {t:'Health and safety', f:[['t','Allergies, conditions or medicine a tutor should know about. Write "None" if nothing.','area']], note:'Only LHQ and the student\'s own tutors see this.'},
    avail:   {t:'Best times', f:[['times','Best days and times for sessions','text'],['note','Note','text']]},
    photo:   {t:'Photos on LHQ social media', f:[R('v','Photos on LHQ social media',[['name','Yes, with their name'],['noname','Yes, without their name'],['no','No photos']])]},
    bday:    {t:'Birthday', f:[['off','Don\'t announce my birthday','switch']]},
    /* tutors and staff */
    det:     {t:'Details', f:[['dob','Date of birth','date'],['phone','WhatsApp','tel'],['email','Email','email'],['area','Area','text'],['en','Emergency contact','text'],['ep','Their phone','tel']]},
    bio:     {t:'About', key:'about', f:[['bio','A short bio (families may see it later)','area']]},
    weak:    {t:'Topics less confident with', f:[['L','One per line · only LHQ sees this','lines']]},
    place:   {t:'Placement and pay', f:[R('type','Placement',[['pt','Part-time'],['ft','Full-time'],['vol','Volunteer']]),['from','From','date'],['inp','In person · MWK a session','num'],['onl','Online · MWK a session','num'],['cap','Monthly cap · MWK','num']]},
  };
  const PLACE = {pt:'Part-time', ft:'Full-time', vol:'Volunteer'};
  const money = n => n ? Number(n).toLocaleString('en-US') : '';

  /* ---------- one sheet that edits a section ---------- */
  let ctx = null;   // {mode:'lhq'|'self'|'fam', id, sec, k, next}
  function field([k, l, ty, o], v){
    const id = 'pf_' + k;
    if(ty === 'area') return `<label class="f"><span>${e(l)}</span><textarea class="in" id="${id}" rows="3">${e(v)}</textarea></label>`;
    if(ty === 'lines') return `<label class="f"><span>${e(l)}</span><textarea class="in" id="${id}" rows="5">${e((v || []).join('\n'))}</textarea></label>`;
    if(ty === 'chips') return `<div class="f"><span class="cap" style="display:block;margin-bottom:6px">${e(l)}</span><div class="chips" data-pfchips="${k}">${o.map(x => `<button type="button" class="chip ${(v || []).includes(x) ? 'on' : ''}" data-pfchip="${e(x)}">${e(x)}</button>`).join('')}</div></div>`;
    if(ty === 'radio') return `<div class="f"><span class="cap" style="display:block;margin-bottom:6px">${e(l)}</span><div class="chips" data-pfradio="${k}">${o.map(([val, t]) => `<button type="button" class="chip ${v === val ? 'on' : ''}" data-pfval="${e(val)}">${e(t)}</button>`).join('')}</div></div>`;
    if(ty === 'switch') return `<div class="toggle"><div class="t"><b>${e(l)}</b><small>Nobody sees a strip or a reminder on your birthday</small></div><button type="button" class="sw-t ${v ? 'on' : ''}" id="${id}" data-pfsw role="switch" aria-checked="${!!v}" aria-label="${e(l)}"></button></div>`;
    return `<label class="f"><span>${e(l)}</span><input class="in" id="${id}" type="${ty === 'num' ? 'text' : ty}" ${ty === 'num' ? 'inputmode="numeric"' : ty === 'tel' ? 'inputmode="tel"' : ''} value="${e(ty === 'num' ? money(v) : v)}"></label>`;
  }
  function readField([k, , ty]){
    const sh = document.getElementById('sheet');
    if(ty === 'chips') return [...sh.querySelectorAll(`[data-pfchips="${k}"] .chip.on`)].map(b => b.dataset.pfchip);
    if(ty === 'radio'){ const b = sh.querySelector(`[data-pfradio="${k}"] .chip.on`); return b ? b.dataset.pfval : ''; }
    const el = document.getElementById('pf_' + k); if(!el) return '';
    if(ty === 'switch') return el.classList.contains('on') ? 1 : 0;
    if(ty === 'lines') return el.value.split('\n').map(x => x.trim()).filter(Boolean);
    if(ty === 'num'){ const n = Number(String(el.value).replace(/[^\d.]/g, '')); return n > 0 ? Math.round(n) : 0; }
    return el.value.trim();
  }
  const SETUP = ['det','subs','avail','place','quals'];
  function openSec(c){
    ctx = c; const P = c.P || {}, S = SEC[c.sec], key = (S && S.key) || c.sec, cur = P[key] || {};
    const who = c.name ? e(firstN(c.name)) : '';
    let body = '';
    if(c.sec === 'subs') body = subsEd(cur);
    else if(c.sec === 'avail' && c.id && c.id.startsWith('p:')) body = availEd(cur);
    else if(c.sec === 'quals') body = qualsEd(cur, c.mode === 'lhq');
    else body = S.f.map(f => field(f, cur[f[0]])).join('') + (S.note ? `<p class="note">${e(S.note)}</p>` : '');
    const nx = c.setup ? SETUP[SETUP.indexOf(c.sec) + 1] : null;
    const title = c.sec === 'subs' ? 'Subjects and levels' : c.sec === 'quals' ? 'Qualifications and checks' : c.sec === 'avail' && c.id.startsWith('p:') ? 'Availability' : (c.mode === 'fam' && S.fam) || S.t;
    openSheet(`<div class="hx"><h3>${e(title)}</h3><button class="ib" data-close>✕</button></div>${who && c.mode === 'lhq' ? `<p class="sp">${who}${c.setup ? ` · step ${SETUP.indexOf(c.sec) + 1} of ${SETUP.length}` : ''}</p>` : ''}
      ${body}<button class="btn n full" id="pfGo">${nx ? 'Next · ' + ({subs:'Subjects and levels', avail:'Availability', place:'Placement and pay', quals:'Qualifications'})[nx] : c.setup ? 'Done' : 'Save'}</button>`);
    bindSheet();
  }
  function bindSheet(){
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('[data-pfchip]').forEach(b => b.onclick = () => b.classList.toggle('on'));
    sh.querySelectorAll('[data-pfval]').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); });
    sh.querySelectorAll('[data-pfsw],[data-pfchk]').forEach(b => b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-checked', b.classList.contains('on')); });
    sh.querySelectorAll('[data-pflv]').forEach(b => b.onclick = () => b.classList.toggle('on'));
    sh.querySelectorAll('[data-pfsub]').forEach(b => b.onclick = () => { b.classList.toggle('on'); const lv = sh.querySelector(`[data-pflvs="${b.dataset.pfsub}"]`); if(lv) lv.hidden = !b.classList.contains('on'); });
    sh.querySelectorAll('[data-wk] b').forEach(b => b.onclick = () => b.classList.toggle('on'));
    sh.querySelectorAll('[data-wkseg]').forEach(b => b.onclick = () => { sh.querySelectorAll('[data-wkseg]').forEach(x => x.classList.toggle('on', x === b)); sh.querySelectorAll('[data-wk]').forEach(g => g.hidden = g.dataset.wk !== b.dataset.wkseg); });
    const add = sh.querySelector('#pfAddSub'); if(add) add.onclick = () => { const n = (prompt('Which subject?') || '').trim(); if(!n) return; const L = readSubs(); L.push({n, lv: []}); sh.querySelector('#pfSubs').innerHTML = subsRows(L, n); bindSheet(); };
    document.getElementById('pfGo').onclick = save;
  }
  async function save(){
    const c = ctx, S = SEC[c.sec], key = (S && S.key) || c.sec;
    let x;
    if(c.sec === 'subs') x = {L: readSubs()};
    else if(c.sec === 'avail' && c.id.startsWith('p:')) x = readAvail();
    else if(c.sec === 'quals') x = readQuals(c.mode === 'lhq');
    else { x = {}; S.f.forEach(f => { x[f[0]] = readField(f); }); }
    try{
      if(c.mode === 'lhq'){
        const A = Object.assign({}, HD.store.get('lhq_prof', {})), P = Object.assign({}, A[c.id]);
        P[key] = Object.assign({}, P[key] || {}, x, {at: Date.now(), by: meP().name}); A[c.id] = P; HD.store.set('lhq_prof', A);
      } else {
        const r = await hub.api('prof', {method:'POST', body: JSON.stringify({sec: key, k: c.k || '', x})});
        if(c.P){ c.P[key] = r.x; }
        if(c.after) c.after(key, r.x);
      }
    }catch(err){ toast(err.message || 'Not saved. Try again.'); return; }
    if(c.sec === 'det' || c.sec === 'bday') B = null;   // birthdays: fetch again with the new date
    const nx = c.setup ? SETUP[SETUP.indexOf(c.sec) + 1] : null;
    if(nx){ const P2 = all()[c.id] || {}; openSec(Object.assign({}, c, {sec: nx, P: P2})); return; }
    closeSheet(); toast(c.setup ? `${firstN(c.name)}'s profile is set up` : 'Saved'); if(c.setup && location.hash.endsWith('/setup')) location.hash = location.hash.replace(/\/setup$/, ''); else rerender();
  }
  /* subjects and levels: LHQ's subject list, levels ticked per subject */
  function subjectList(){ let st = (HD.store.get('lhq_settings', {}) || {}); if(typeof withDefaults === 'function') st = withDefaults(st); return String(st.subjects || '').split('\n').map(x => x.trim()).filter(Boolean); }
  const subsRows = (L, open) => { const names = [...new Set(subjectList().concat(L.map(x => x.n)))];
    return names.map(n => { const m = L.find(x => nk(x.n) === nk(n)), on = !!m || nk(open) === nk(n);
      return `<button type="button" class="it ${on ? 'on' : ''}" data-pfsub="${e(n)}" style="border-left:0;border-right:0;border-bottom:0;background:none;width:100%;text-align:left"><span class="pf-tk">✓</span><span class="t"><b>${e(n)}</b></span></button>
        <div class="pf-lv" data-pflvs="${e(n)}" ${on ? '' : 'hidden'}>${LV.map(l => `<button type="button" class="${m && (m.lv || []).includes(l) ? 'on' : ''}" data-pflv="${e(l)}">${e(l)}</button>`).join('')}</div>`; }).join(''); };
  const subsEd = cur => `<p class="sp">What they teach. Tutors only see this; LHQ changes it.</p><div class="card" id="pfSubs">${subsRows(cur.L || [])}</div><button type="button" class="btn full" id="pfAddSub" style="margin-bottom:12px">+ Another subject</button>`;
  function readSubs(){ const sh = document.getElementById('sheet');
    return [...sh.querySelectorAll('[data-pfsub].on')].map(b => ({n: b.dataset.pfsub, lv: [...sh.querySelectorAll(`[data-pflvs="${CSS.escape(b.dataset.pfsub)}"] .on`)].map(x => x.dataset.pflv)})); }
  /* availability: a week grid for term time and holidays */
  const grid = (on, w, hid) => `<div class="pf-wk" data-wk="${w}" ${hid ? 'hidden' : ''}><span></span>${DAYS.map(d => `<span>${d[0]}</span>`).join('')}${HRS.map(h => `<span class="h">${h}:00</span>${DAYS.map((d, i) => `<b class="${(on || []).includes(i + '-' + h) ? 'on' : ''}" data-c="${i}-${h}"></b>`).join('')}`).join('')}</div>`;
  const availEd = cur => `<p class="sp">When they can teach. Tap to mark. Each square is 2 hours.</p>
    <div class="seg"><button type="button" class="on" data-wkseg="term">Term</button><button type="button" data-wkseg="hol">Holidays</button></div>
    <div class="card pad">${grid(cur.term, 'term')}${grid(cur.hol, 'hol', true)}</div>
    <div class="f"><span class="cap" style="display:block;margin-bottom:6px">Most sessions a week</span><div class="chips" data-pfradio="max">${[10, 15, 20, 25, 0].map(n => `<button type="button" class="chip ${(+cur.max || 0) === n && cur.at ? 'on' : ''}" data-pfval="${n}">${n || 'Any'}</button>`).join('')}</div></div>
    <div class="f"><span class="cap" style="display:block;margin-bottom:6px">How</span><div class="chips" data-pfchips="how">${HOW.map(h => `<button type="button" class="chip ${(cur.how || []).includes(h) ? 'on' : ''}" data-pfchip="${h}">${h}</button>`).join('')}</div></div>
    ${field(['areas','Areas for home visits','text'], cur.areas)}`;
  function readAvail(){ const sh = document.getElementById('sheet'), g = w => [...sh.querySelectorAll(`[data-wk="${w}"] b.on`)].map(b => b.dataset.c);
    return {term: g('term'), hol: g('hol'), max: +readField(['max', '', 'radio']) || 0, how: readField(['how', '', 'chips']), areas: readField(['areas', '', 'text'])}; }
  /* qualifications: the tutor lists them; LHQ ticks each one checked, and the five checks */
  const qualsEd = (cur, lhq) => `<p class="sp">${lhq ? 'Tick what LHQ has seen.' : 'One per line. LHQ checks them.'}</p>
    ${lhq ? `<div class="card">${(cur.L || []).map((q, i) => `<div class="toggle" style="padding:10px 14px"><div class="t"><b>${e(q.t)}</b></div><button type="button" class="sw-t ${q.ok ? 'on' : ''}" data-pfchk="q${i}" role="switch" aria-checked="${!!q.ok}" aria-label="Checked"></button></div>`).join('') || '<p class="empty">None listed yet.</p>'}</div>` : ''}
    <label class="f"><span>${lhq ? 'Add or change (one per line)' : 'Qualifications and training'}</span><textarea class="in" id="pf_ql" rows="4" placeholder="e.g. BSc Physics, University of Malawi">${e((cur.L || []).map(q => q.t).join('\n'))}</textarea></label>
    ${lhq ? `<div class="cap">Checks</div><div class="card">${CHK.map(([k, l]) => `<div class="toggle" style="padding:10px 14px"><div class="t"><b>${l}</b></div><button type="button" class="sw-t ${(cur.chk || {})[k] ? 'on' : ''}" data-pfchk="${k}" role="switch" aria-checked="${!!(cur.chk || {})[k]}" aria-label="${l}"></button></div>`).join('')}</div>` : ''}`;
  function readQuals(lhq){ const sh = document.getElementById('sheet'), was = ((ctx.P || {}).quals || {}).L || [];
    const L = document.getElementById('pf_ql').value.split('\n').map(x => x.trim()).filter(Boolean).map(t => { const i = was.findIndex(q => nk(q.t) === nk(t)), b = i >= 0 ? sh.querySelector(`[data-pfchk="q${i}"]`) : null;
      return {t, ok: lhq ? (b ? (b.classList.contains('on') ? 1 : 0) : 0) : (i >= 0 ? was[i].ok || 0 : 0)}; });
    const o = {L}; if(lhq){ o.chk = {}; CHK.forEach(([k]) => { const b = sh.querySelector(`[data-pfchk="${k}"]`); o.chk[k] = b && b.classList.contains('on') ? 1 : 0; }); } return o; }

  /* ---------- rows ---------- */
  const st = ok => ok === true ? '<span class="pf-st ok">✓</span>' : ok === '!' ? '<span class="pf-st am">!</span>' : ok === false ? '<span class="pf-st no"></span>' : '';
  const row = (attr, t, sub, ok, chev = '›') => `<${attr.startsWith('href') ? 'a' : 'button type="button"'} class="it" ${attr}><span class="t"><b>${e(t)}</b><small>${sub}</small></span>${st(ok)}<span class="chev">${chev}</span></${attr.startsWith('href') ? 'a' : 'button'}>`;
  const notAdded = w => `<span style="color:var(--muted)">Not added${w ? ' · ' + w : ''}</span>`;
  const lst = a => (a || []).filter(Boolean).join(' · ');
  const sum = {
    about: x => lst([x.goals, x.interests]), learn: x => lst([(x.best || []).join(', '), (x.hard || []).length ? 'finds hard: ' + x.hard.join(', ').toLowerCase() : '', x.note]),
    family: x => lst([x.g2 ? x.g2 + (x.g2p ? ' ' + x.g2p : '') : '', x.pays ? 'pays: ' + ({1:'first parent',2:'second parent',b:'both'})[x.pays] : '']),
    emerg: x => lst([x.n, x.p]), collect: x => lst([x.mode === 'alone' ? 'May leave on their own' : x.mode === 'named' ? 'Only named people' : '', x.who]),
    health: x => e(x.t || ''), avail: x => lst([x.times, x.note]), photo: x => ({name:'Yes, with their name', noname:'Yes, without their name', no:'No photos'})[x.v] || '',
  };
  const show = (P, sec, w) => done(P, sec) ? (e(sum[sec](P[sec])) || 'None') : notAdded(w);

  /* the Director's view of a student: tiles, then each part with ✓ or ○ */
  function studentTab(s){
    const P = all()['s:' + s.key] || {}, nb = nextBday(s.dob), may = (window.HD && HD.can && (HD.isDir() || HD.can('students')));
    const parts = [['family'], ['emerg'], ['collect'], ['about'], ['learn'], ['health'], ['avail'], ['photo']];
    const fill = [!!s.dob && !!s.phone].concat(parts.map(([k, v]) => v != null ? v : done(P, k))), n = fill.filter(Boolean).length;
    const a = k => may ? `data-psec="s:${e(s.key)}|${k}|lhq" data-pname="${e(s.name)}"` : 'disabled';
    return `<div class="pf-t3"><div><span>Birthday</span><b>${nb ? dayMon(nb.on) : '–'}</b><small>${nb ? (nb.in === 0 ? `turns ${nb.age} today 🎂` : `turns ${nb.age} · in ${nb.in} day${nb.in === 1 ? '' : 's'}`) : 'add the date of birth'}</small></div>
      <a href="#student/${encodeURIComponent(s.key)}/marks"><span>Targets</span><b>›</b><small>exams and marks</small></a>
      <div><span>Profile</span><b>${n}/${fill.length}</b><small>${n === fill.length ? 'complete ✓' : (fill.length - n) + ' to finish'}</small></div></div>
    <div class="card">
      ${row(a('family'), 'Family and contacts', e(lst([s.parent, s.phone, done(P, 'family') ? sum.family(P.family) : ''])) || notAdded('parent'), done(P, 'family'))}
      ${row(a('emerg'), 'Emergency contact', show(P, 'emerg', 'parent'), done(P, 'emerg'))}
      ${row(a('collect'), 'Collection', show(P, 'collect', 'parent'), done(P, 'collect'))}
      ${row(a('about'), 'About ' + firstN(s.name), show(P, 'about', 'student'), done(P, 'about'))}
      ${row(a('learn'), 'How ' + firstN(s.name) + ' learns', show(P, 'learn', 'student'), done(P, 'learn'))}
      ${row(a('health'), 'Health and safety', show(P, 'health', 'parent') + (done(P, 'health') ? ' · LHQ and their tutors only' : ''), done(P, 'health'))}
      ${row(`href="#student/${encodeURIComponent(s.key)}/marks"`, 'Subjects, exams and targets', 'On Marks', null)}
      ${row(a('avail'), 'Best times', show(P, 'avail', 'student or parent'), done(P, 'avail'))}
      ${row(a('photo'), 'Consents', done(P, 'photo') ? 'Photos: ' + show(P, 'photo') : notAdded('photo consent · parent'), done(P, 'photo') ? true : '!')}
    </div>`;
  }
  /* "Needs you" on the Director's Home: profiles still to finish (students with a current card) */
  function stuGaps(s){ const P = all()['s:' + s.key] || {}; return ['collect','health','photo','emerg'].filter(k => !done(P, k)).length + (s.dob ? 0 : 1); }

  /* ---------- families: the student's and parent's own parts ---------- */
  const FAMSEC = {student: ['about','learn','avail'], parent: ['collect','health','photo','emerg','family','avail']};
  const FAMNEED = {student: ['about','learn'], parent: ['collect','health','photo','emerg']};
  function famTodo(k, role){
    if(!k) return ''; const P = k.prof || {}, need = FAMNEED[role] || [], left = need.filter(x => !done(P, x));
    if(!left.length) return '';
    return `<div class="card pad pf-todo"><div class="pf-row"><b>${role === 'parent' ? `Check ${e(firstN(k.name))}'s details` : 'Finish your profile'}</b><span class="tag">${need.length - left.length} of ${need.length}</span></div>
      <div class="pf-bar">${need.map(x => `<i class="${done(P, x) ? 'y' : ''}"></i>`).join('')}</div>
      ${need.map(x => `<button type="button" class="it" data-psec="s:${e(k.key)}|${x}|fam" data-pk="${e(k.key)}">${st(done(P, x))}<span class="t"><b>${e((SEC[x].fam) || SEC[x].t)}</b><small>${e(({about:'Interests and what you want to study after school', learn:'Your tutors read this', collect:'Who may collect them after a session', health:'Allergies or medicine · LHQ and their tutors only', photo:'Photos on LHQ\'s social media', emerg:'Someone LHQ can call if you can\'t be reached'})[x])}</small></span><span class="chev">›</span></button>`).join('')}</div>`;
  }
  function famPage(k, role, back){
    if(!k) return '';
    const P = k.prof || {}, L = FAMSEC[role] || [], nb = nextBday(k.dob);
    return `${back}<div class="ph"><div class="tt"><h1>${role === 'parent' ? e(firstN(k.name)) + '\'s details' : 'My profile'}</h1><p>${role === 'parent' ? 'Only LHQ and ' + e(firstN(k.name)) + '\'s tutors see these' : 'Your tutors and LHQ see these'}</p></div></div>
      <div class="card">${L.map(x => `<button type="button" class="it" data-psec="s:${e(k.key)}|${x}|fam" data-pk="${e(k.key)}"><span class="t"><b>${e((role === 'student' && SEC[x].fam) || SEC[x].t)}</b><small>${show(P, x)}</small></span>${st(done(P, x))}<span class="chev">›</span></button>`).join('')}
      ${role === 'student' ? `<a class="it" href="#me/exams"><span class="t"><b>My exams</b><small>Which series and your target grades</small></span><span class="chev">›</span></a>` : ''}</div>
      ${role === 'student' ? `<div class="h2">Birthday</div><div class="card"><button type="button" class="it" data-psec="s:${e(k.key)}|bday|fam" data-pk="${e(k.key)}"><span class="t"><b>${nb ? dayMon(nb.on) : 'Not added'}</b><small>${P.bday && P.bday.off ? 'Not announced' : nb ? 'Your tutors and LHQ see it on the day' : 'LHQ adds your date of birth'}</small></span><span class="chev">›</span></button></div>` : ''}`;
  }

  /* ---------- tutors: what a tutor needs to know about a student, and their own profile ---------- */
  function tutorKnow(p, name){
    if(!p) return '';
    const rows = [];
    if(p.health && p.health.t) rows.push(['Health and safety', p.health.t]);
    if(p.learn) rows.push(['How ' + firstN(name) + ' learns', sum.learn(p.learn)]);
    if(p.about && p.about.goals) rows.push(['Goals', p.about.goals]);
    if(p.collect) rows.push(['Collection', lst([sum.collect(p.collect), p.phone ? 'call ' + p.phone : ''])]);
    if(p.emerg && p.emerg.n) rows.push(['Emergency contact', lst([p.emerg.n, p.emerg.p])]);
    if(p.dob) rows.push(['Birthday', dayMon(p.dob.replace(/^\d{4}/, '2000'))]);
    if(!rows.length) return '';
    return `<div class="h2">What you need to know</div><div class="card">${rows.map(([t, s]) => `<div class="it"><span class="t"><b>${e(t)}</b><small>${e(s)}</small></span></div>`).join('')}</div>`;
  }
  const TNEED = ['det','about','quals'];
  function tutorTodo(P){
    P = P || {}; const left = TNEED.filter(x => !done(P, x)); if(!left.length) return '';
    const lab = {det:['Details','Phone, emergency contact, date of birth'], about:['About you','A short bio'], quals:['Qualifications','LHQ checks them']};
    return `<div class="card pad pf-todo"><div class="pf-row"><b>Finish your profile</b><span class="tag">${TNEED.length - left.length} of ${TNEED.length}</span></div><div class="pf-bar">${TNEED.map(x => `<i class="${done(P, x) ? 'y' : ''}"></i>`).join('')}</div>
      ${TNEED.map(x => `<button type="button" class="it" data-psec="self|${x === 'about' ? 'bio' : x}|self">${st(done(P, x))}<span class="t"><b>${lab[x][0]}</b><small>${lab[x][1]}</small></span><span class="chev">›</span></button>`).join('')}</div>`;
  }
  let selfP = null;
  function availText(a){ if(!a || !a.at) return ''; const by = {}; (a.term || []).forEach(c => { const [d, h] = c.split('-').map(Number); (by[d] = by[d] || []).push(h); });
    const ds = Object.keys(by).map(Number).sort(), span = d => { const H = by[d].sort((x, y) => x - y); return `${String(H[0]).padStart(2, '0')}:00–${String(H[H.length - 1] + 2).padStart(2, '0')}:00`; };
    const groups = []; ds.forEach(d => { const s0 = span(d), g = groups[groups.length - 1]; if(g && g.s === s0 && g.to === d - 1) g.to = d; else groups.push({from: d, to: d, s: s0}); });
    return lst([groups.map(g => `${DAYS[g.from]}${g.to > g.from ? '–' + DAYS[g.to] : ''} ${g.s}`).join(' · '), (a.how || []).join(', '), a.max ? 'up to ' + a.max + ' a week' : '']); }
  const subsText = s => s && s.L && s.L.length ? s.L.map(x => `${x.n}${(x.lv || []).length ? ' · ' + x.lv.join(', ') : ''}`).join(' · ') : '';
  const placeText = p => p && p.at ? lst([PLACE[p.type], p.from ? 'from ' + dayMon(p.from) : '', p.inp ? 'in person ' + money(p.inp) : '', p.onl ? 'online ' + money(p.onl) : '']) : '';
  const qualText = q => q && q.at ? lst([(q.L || []).map(x => x.t + (x.ok ? ' ✓' : '')).join(' · '), q.chk ? `checks ${CHK.filter(([k]) => q.chk[k]).length} of ${CHK.length} done` : '']) : '';
  function tutorMine(P, back){
    selfP = P = P || {}; const nb = P.det && P.det.dob ? nextBday(P.det.dob) : null, L = (k, t, s, ed = true) => ed ? `<button type="button" class="it" data-psec="self|${k}|self"><span class="t"><b>${t}</b><small>${s}</small></span>${st(done(P, k === 'bio' ? 'about' : k))}<span class="chev">✎</span></button>` : `<div class="it"><span class="t"><b>${t}</b><small>${s}</small></span></div>`;
    return `${back}<div class="ph"><div class="tt"><h1>My profile</h1><p>LHQ sees everything here</p></div></div>
      <div class="card">${L('det', 'Details', done(P, 'det') ? e(lst([P.det.phone, P.det.area, P.det.en ? 'emergency contact ✓' : '', nb ? 'birthday ' + dayMon(nb.on) : ''])) : notAdded())}
      ${L('bio', 'About me', done(P, 'about') ? e((P.about.bio || '').slice(0, 80)) : notAdded())}
      ${L('avail', 'Availability', e(availText(P.avail)) || notAdded('LHQ sets it; you can change it'))}
      ${L('subs', 'Subjects and levels', e(subsText(P.subs)) || 'LHQ adds these', false)}
      ${L('weak', 'Topics I\'m less confident with', done(P, 'weak') ? `${(P.weak.L || []).length} topic${(P.weak.L || []).length === 1 ? '' : 's'} · only LHQ sees this` : notAdded('only LHQ sees this'))}
      ${L('quals', 'Qualifications', e(qualText(P.quals)) || notAdded('LHQ checks them'))}
      ${L('bday', 'Birthday', P.bday && P.bday.off ? 'Not announced' : nb ? 'Staff and your students see it on the day' : 'Add your date of birth in Details')}</div>
      <div class="h2">Placement and pay <span class="lock">🔒 Set by LHQ</span></div><div class="card pad">${placeText(P.place) ? `<dl class="kv"><dt>Placement</dt><dd>${e(PLACE[P.place.type] || '–')}${P.place.from ? ' · from ' + dayMon(P.place.from) : ''}</dd>${P.place.inp ? `<dt>In person</dt><dd>MWK ${money(P.place.inp)} a session</dd>` : ''}${P.place.onl ? `<dt>Online</dt><dd>MWK ${money(P.place.onl)} a session</dd>` : ''}${P.place.cap ? `<dt>Monthly cap</dt><dd>MWK ${money(P.place.cap)}</dd>` : ''}</dl>` : '<p class="empty" style="margin:0">Not set yet.</p>'}</div>`;
  }

  /* ---------- the Director's tutor profile ---------- */
  function tutorStudents(name){ const t = HD.today(), out = new Set();
    HD.students().forEach(s => { const c = s.cur, card = c ? (c.card || s.lastCard) : s.loneCard; if(!card || (c && c.inv.periodEnd && c.inv.periodEnd < t) || (!c && card.periodEnd && card.periodEnd < t)) return;
      if((card.subjects || []).some(x => nk(x.tutor) === nk(name))) out.add(s.key); }); return out.size; }
  function tutorPage(name, setup){
    const id = 'p:' + nk(name), P = all()[id] || {}, per = (HD.people() || []).find(p => nk(p.name) === nk(name)), may = HD.isDir() || HD.can('tutors');
    if(setup && may) setTimeout(() => openSec({mode:'lhq', id, sec:'det', P, name, setup: true}), 0);
    const a = k => may ? `data-psec="${e(id)}|${k}|lhq" data-pname="${e(name)}"` : 'disabled';
    const parts = ['det','subs','avail','place','quals','about','weak'], n = parts.filter(k => done(P, k)).length, nb = P.det && P.det.dob ? nextBday(P.det.dob) : null;
    const q = P.quals || {}, qOk = (q.L || []).length && (q.L || []).every(x => x.ok) && CHK.every(([k]) => (q.chk || {})[k]);
    return `${crumb('#tutors', 'Tutors')}<div class="pf-hd"><span class="av">${e(inits(name))}</span><div><h1>${e(name)}</h1><p>${e(lst([placeText(P.place) ? PLACE[P.place.type] + (P.place.from ? ' since ' + dayMon(P.place.from) : '') : '', subsText(P.subs)])) || 'Tutor'}</p></div></div>
      <div class="pf-t3"><a href="#tutors/${encodeURIComponent(name)}"><span>Students</span><b>${tutorStudents(name)}</b><small>on current cards ›</small></a>
        <div><span>Birthday</span><b>${nb ? dayMon(nb.on) : '–'}</b><small>${nb ? (nb.in === 0 ? 'today 🎂' : 'in ' + nb.in + ' day' + (nb.in === 1 ? '' : 's')) : 'not added'}</small></div>
        <div><span>Profile</span><b>${n}/${parts.length}</b><small>${n === parts.length ? 'complete ✓' : parts.length - n + ' to finish'}</small></div></div>
      <div class="card">
        ${row(a('det'), 'Details', done(P, 'det') ? e(lst([P.det.phone, P.det.area, P.det.en ? 'emergency contact ✓' : 'no emergency contact'])) : notAdded('tutor or LHQ'), done(P, 'det'))}
        ${row(a('subs'), 'Subjects and levels', e(subsText(P.subs)) || notAdded('LHQ'), done(P, 'subs'))}
        ${row(a('avail'), 'Availability', e(availText(P.avail)) || notAdded('LHQ'), done(P, 'avail'))}
        ${row(a('place'), 'Placement and pay', e(placeText(P.place)) || notAdded('LHQ'), done(P, 'place'))}
        ${row(a('quals'), 'Qualifications and checks', e(qualText(P.quals)) || notAdded('tutor lists, LHQ checks'), done(P, 'quals') ? (qOk ? true : '!') : false)}
        ${row(a('bio'), 'About', done(P, 'about') ? e((P.about.bio || '').slice(0, 90)) : notAdded('tutor'), done(P, 'about'))}
        ${row(a('weak'), 'Topics less confident with', done(P, 'weak') ? e((P.weak.L || []).join(' · ')) || 'None' : notAdded('tutor'), done(P, 'weak'))}
      </div>
      <div class="card">${per ? row(`href="#person/${e(per.id)}"`, 'Account', per.active === false ? 'Switched off' : per.seen ? 'Signed in ✓' : 'Not signed in yet', per.seen ? true : false) : row('href="#set/people"', 'Account', 'No account yet · add one in People', false)}
        ${window.KPIUI && KPIUI.may && KPIUI.may() ? row('href="#kpi"', 'KPIs', 'Last 4 weeks', null) : ''}${window.TPAYUI && TPAYUI.may && TPAYUI.may() ? row('href="#pay"', 'Pay', 'This month', null) : ''}</div>`;
  }
  /* for the tuition card's tutor picker: does this tutor teach the subject and level, and are they free then? */
  function tutorFit(name, sub, level, days, start){
    const P = all()['p:' + nk(name)] || {}; if(!P.subs || !P.subs.L) return null;
    const m = P.subs.L.find(x => nk(x.n) === nk(sub)), lvl = LV.find(l => new RegExp('\\b' + l.replace(' ', '\\s*') + '\\b', 'i').test(level || ''));
    const teaches = !!m && (!lvl || !(m.lv || []).length || m.lv.includes(lvl));
    let free = null; const A = P.avail; if(A && A.at && (A.term || []).length && (days || []).length && /^\d{1,2}:\d{2}$/.test(start || '')){
      const h = +start.split(':')[0], blk = HRS.filter(x => x <= h).pop(), DI = {Mo:0,Tu:1,We:2,Th:3,Fr:4,Sa:5,Su:6};
      free = days.every(d => (A.term || []).includes(DI[d] + '-' + blk)); }
    return {teaches, lvl, free};
  }

  /* ---------- birthdays ---------- */
  let B = null, Bat = 0, Bload = null;
  const HIDE = 'lhq_bd_hide';
  const hidden = () => { try{ return localStorage.getItem(HIDE) === todayISO(); }catch(x){ return false; } };
  async function loadB(){
    if(!window.hub || !hub.session || !hub.session()) return null;
    if(B && Date.now() - Bat < 10 * 60e3 && B.today === todayISO()) return B;
    if(Bload) return Bload;
    Bload = hub.api('bdays').then(r => { B = r; Bat = Date.now(); Bload = null; return r; }).catch(() => { Bload = null; return null; });
    return Bload;
  }
  const nameIs = x => x.kind === 'student' && x.age != null ? `${x.name} turns ${x.age}` : `${x.name}'s birthday`;
  function strip(){
    if(!B || !B.opt.strip || hidden()) return '';
    const L = B.week.filter(x => x.in === 0 && !x.me); if(!L.length) return '';
    const one = L.length === 1 ? L[0] : null;
    return `<div class="pf-strip" id="pfStrip"><span>🎂</span><span class="t">${one ? `${e(one.kind === 'student' && meP().role === 'tutor' ? firstN(one.name) : one.name)}'s birthday today${one.rel ? ' · ' + e(one.rel) : ''}` : `${L.length} birthdays today: ${e(L.map(x => firstN(x.name)).join(', '))}`}</span>
      ${B.canWish ? `<button type="button" data-bwish="${one ? e(one.id) : ''}">Wish ›</button>` : ''}<button type="button" data-bhide aria-label="Hide for today">✕</button></div>`;
  }
  function weekCard(){
    if(!B || !B.week.length) return '';
    const L = B.week.filter(x => !x.me);
    if(!L.length) return '';
    return `<div class="h2">Birthdays this week</div><div class="card">${L.map(x => `<div class="it"><span class="av sm">${e(inits(x.name))}</span><span class="t"><b>${e(x.name)}</b><small>${e(lst([x.kind === 'student' ? 'Student' : x.kind === 'tutor' ? 'Tutor' : 'LHQ', x.rel, x.age != null ? 'turns ' + x.age : '', x.in === 0 && x.wishes ? x.wishes + ' wish' + (x.wishes === 1 ? '' : 'es') : '']))}</small></span><b>${x.in === 0 ? 'Today' : x.in === 1 ? 'Tomorrow' : DAYS[(new Date(x.on + 'T00:00:00Z').getUTCDay() + 6) % 7] + ' ' + +x.on.slice(8)}</b>${x.in === 0 && B.canWish ? `<button type="button" class="btn sm" data-bwish="${e(x.id)}" style="margin-left:8px">Wish</button>` : ''}</div>`).join('')}</div>`;
  }
  function hero(){
    if(!B || !B.mine) return '';
    const W = B.mine;
    return `<div class="pf-hero"><div class="c">🎂</div><b>Happy birthday, ${e(firstN(meP().name))}!</b><small>From everyone at LHQ</small></div>
      ${W.length ? `<div class="h2">Wishes <em>${W.length}</em></div><div class="card">${W.map(w => `<div class="it" style="align-items:flex-start"><span class="av sm">${e(inits(w.by))}</span><span class="t"><b>${e(w.by)} <small style="display:inline;color:var(--muted);font-weight:600">· ${e(w.role)}</small></b><small style="color:var(--ink);font-size:13.5px">${e(w.t)}</small></span></div>`).join('')}</div>` : ''}`;
  }
  function wishSheet(id){
    const L = B ? B.week.filter(x => x.in === 0 && !x.me) : []; const x = L.find(y => y.id === id) || (L.length === 1 ? L[0] : null);
    if(!x){ openSheet(`<div class="hx"><h3>Who to wish?</h3><button class="ib" data-close>✕</button></div><div class="card">${L.map(y => `<button type="button" class="it" data-bwish="${e(y.id)}"><span class="t"><b>${e(y.name)}</b><small>${e(y.rel || (y.kind === 'student' ? 'Student' : y.kind === 'tutor' ? 'Tutor' : 'LHQ'))}</small></span><span class="chev">›</span></button>`).join('')}</div>`); return; }
    const f = firstN(x.name), P = [`Happy birthday, ${f}! 🎉`, 'Have a great day!', `Enjoy your day, ${f}!`];
    openSheet(`<div class="hx"><h3>Wish ${e(f)} a happy birthday</h3><button class="ib" data-close>✕</button></div><p class="sp">${e(x.name)} sees it on their Home today.</p>
      <div class="chips">${P.map((p, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-bpre>${e(p)}</button>`).join('')}</div>
      <label class="f"><span>Or write your own</span><input class="in" id="bwT" maxlength="200"></label>
      <button class="btn n full" id="bwGo">Send · from ${e(firstN(meP().name))}</button>`);
    const sh = document.getElementById('sheet');
    sh.querySelectorAll('[data-bpre]').forEach(b => b.onclick = () => { sh.querySelectorAll('[data-bpre]').forEach(y => y.classList.toggle('on', y === b)); document.getElementById('bwT').value = ''; });
    document.getElementById('bwGo').onclick = async () => { const own = document.getElementById('bwT').value.trim(), pre = sh.querySelector('[data-bpre].on'), t = own || (pre ? pre.textContent : '');
      if(!t){ toast('Write a wish'); return; }
      try{ await hub.api('wish', {method:'POST', body: JSON.stringify({id: x.id, t})}); B = null; closeSheet(); toast(`Sent to ${f} 🎉`); after(); }catch(err){ toast(err.message); } };
  }
  /* after every page: the strip at the top; Home gets "Birthdays this week" (staff and tutors) or the birthday person's own card */
  function after(){
    const m = document.getElementById('main'); if(!m || !window.hub || !hub.session || !hub.session()) return;
    const role = meP().role; if(role === 'parent') return;
    const draw = () => {
      const old = document.getElementById('pfStrip'); if(old) old.remove();
      m.querySelectorAll('[data-pfbd]').forEach(x => x.remove());
      const s = strip(); if(s) m.insertAdjacentHTML('afterbegin', s);
      const pg = (location.hash.slice(1).split('/')[0] || 'home'), sub = location.hash.slice(1).split('/')[1];
      const home = (pg === 'home' && ['director','admin'].includes(role)) || (pg === 'teach' && !sub && role === 'tutor') || (pg === 'me' && !sub && role === 'student');
      if(home){ const h = hero(), w = role === 'student' ? '' : weekCard();
        if(h){ const ph = m.querySelector('.ph'); (ph || m.firstChild) && (ph ? ph.insertAdjacentHTML('afterend', `<div data-pfbd>${h}</div>`) : m.insertAdjacentHTML('afterbegin', `<div data-pfbd>${h}</div>`)); }
        if(w) m.insertAdjacentHTML('beforeend', `<div data-pfbd>${w}</div>`); }
    };
    if(B && B.today === todayISO() && Date.now() - Bat < 10 * 60e3) draw(); else loadB().then(r => { if(r) draw(); });
  }
  /* Settings › Birthdays: who sees what (fixed), the Director's switches, and your own date of birth */
  function settingsPage(){
    const st = HD.store.get('lhq_settings', {}) || {}, o = Object.assign({strip: 1, wish: 1, stu: 0}, st.bday || {}), D = HD.isDir();
    const mine = (all()['p:' + nk(meP().name)] || {}).det || {};
    const sw = (k, t, s) => `<div class="toggle"><div class="t"><b>${t}</b><small>${s}</small></div><button type="button" class="sw-t ${o[k] ? 'on' : ''}" ${D ? `data-bopt="${k}"` : 'disabled'} role="switch" aria-checked="${!!o[k]}" aria-label="${t}"></button></div>`;
    return `<h2 class="sec-h">Birthdays</h2><p class="sec-p">From each date of birth. Parents see none.</p>
      <div class="card pad"><table class="pf-who"><tr><th>Who</th><th>Sees</th><th>Age</th></tr><tr><td>Director, admin</td><td>Everyone</td><td>✓</td></tr><tr><td>Tutors</td><td>Their students, all staff</td><td>Students</td></tr><tr><td>Students</td><td>Their tutors, LHQ staff${o.stu ? ', other students' : ''}</td><td>✕</td></tr><tr><td>Parents</td><td>None</td><td>✕</td></tr></table></div>
      <div class="card pad">${sw('strip', 'Strip on every page', 'On the day, for everyone above')}${sw('wish', 'Wishes', 'Staff and tutors send short wishes; the birthday person sees them')}${sw('stu', 'Students see other students', 'Off: students are minors, so their dates stay private')}</div>
      <div class="h2">Your birthday</div><div class="card pad"><label class="f"><span>Your date of birth</span><input class="in" type="date" id="bMyDob" value="${e(mine.dob || '')}"></label><button class="btn n" id="bMyGo">Save</button><p class="note">Anyone can switch off their own birthday in their profile.</p></div>`;
  }
  function bindSettings(){
    document.querySelectorAll('[data-bopt]').forEach(b => b.onclick = () => { const st = Object.assign({}, HD.store.get('lhq_settings', {})), o = Object.assign({strip: 1, wish: 1, stu: 0}, st.bday || {});
      o[b.dataset.bopt] = o[b.dataset.bopt] ? 0 : 1; st.bday = o; HD.store.set('lhq_settings', st); B = null; rerender(); });
    const g = document.getElementById('bMyGo'); if(g) g.onclick = async () => { const v = document.getElementById('bMyDob').value;
      try{ const r = await hub.api('prof', {method:'POST', body: JSON.stringify({sec:'det', x:{dob: v}})}); const A = Object.assign({}, HD.store.get('lhq_prof', {}) || {}), id = 'p:' + nk(meP().name);
        if(HD.isDir() || HD.can('tutors')){ A[id] = Object.assign({}, A[id], {det: r.x}); try{ localStorage.setItem('lhq_prof', JSON.stringify(A)); }catch(x){} }
        B = null; toast('Saved'); }catch(err){ toast(err.message); } };
  }

  /* one listener for every "open this section" row, on any page */
  document.addEventListener('click', ev => {
    const t = ev.target.closest && ev.target.closest('[data-psec],[data-bwish],[data-bhide]'); if(!t) return;
    if(t.hasAttribute('data-bhide')){ try{ localStorage.setItem(HIDE, todayISO()); }catch(x){} const s = document.getElementById('pfStrip'); if(s) s.remove(); return; }
    if(t.hasAttribute('data-bwish')){ ev.preventDefault(); wishSheet(t.dataset.bwish); return; }
    ev.preventDefault();
    const [id, sec, mode] = t.dataset.psec.split('|');
    if(mode === 'lhq') return openSec({mode, id, sec, P: all()[id] || {}, name: t.dataset.pname || ''});
    if(mode === 'self') return openSec({mode, id: 'p:' + nk(meP().name), sec, P: (window.TUT && TUT.prof && TUT.prof()) || selfP || {}, after: () => rerender()});
    if(mode === 'fam'){ const k = window.FAM && FAM.kidOf ? FAM.kidOf(t.dataset.pk) : null; if(!k) return; k.prof = k.prof || {};
      return openSec({mode, id, sec, k: k.key, P: k.prof, name: k.name, after: () => { if(FAM.saveCache) FAM.saveCache(); rerender(); }}); }
  });

  if(!document.getElementById('pfCss')){ const c = document.createElement('style'); c.id = 'pfCss'; c.textContent = `
.pf-t3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.pf-t3>*{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px;min-width:0;color:inherit;text-decoration:none}
.pf-t3 span{display:block;font-size:11.5px;color:var(--muted);font-weight:700}.pf-t3 b{display:block;font-size:20px;color:var(--brand,var(--accent))}.pf-t3 small{display:block;font-size:11.5px;color:var(--muted)}
.pf-st{width:20px;height:20px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;font-weight:900;flex:none;margin-left:6px}.pf-st.ok{background:var(--ok);color:#fff}.pf-st.am{background:var(--gold);color:#14213d}.pf-st.no{border:2px solid var(--muted)}
.pf-todo{border-left:3px solid var(--gold)}.pf-todo .it{padding-left:0;padding-right:0}.pf-todo .it .pf-st{margin:0 6px 0 0}.pf-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.pf-bar{display:flex;gap:6px;margin:8px 0 4px}.pf-bar i{flex:1;height:5px;border-radius:3px;background:var(--line2)}.pf-bar i.y{background:var(--accent)}
.pf-hd{display:flex;gap:12px;align-items:center;margin:6px 0 12px}.pf-hd h1{margin:0;font-size:23px;font-weight:800;color:var(--brand)}.pf-hd p{margin:2px 0 0;color:var(--muted);font-size:13.5px}.pf-hd .av{width:56px;height:56px;font-size:20px}
.pf-strip{display:flex;gap:8px;align-items:center;background:var(--am-bg,#fdf3d9);border:1px solid rgba(244,178,35,.45);border-radius:12px;padding:8px 12px;font-size:13.5px;font-weight:700;margin:0 0 12px}
.pf-strip .t{flex:1;min-width:0}.pf-strip button{border:0;background:none;color:var(--muted);font-weight:800;cursor:pointer;white-space:nowrap;padding:4px 8px;min-height:36px;min-width:36px}
.pf-hero{background:var(--accent);color:var(--onaccent);border-radius:18px;padding:16px;margin-bottom:12px;text-align:center}.pf-hero .c{font-size:34px}.pf-hero b{display:block;font-size:20px;margin-top:4px;color:inherit}.pf-hero small{opacity:.85;color:inherit}
.av.sm{width:34px;height:34px;font-size:12px;flex:none}
.pf-tk{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:inline-grid;place-items:center;flex:none;font-size:12px;font-weight:900;color:transparent}
[data-pfsub].on .pf-tk{background:var(--accent);border-color:var(--accent);color:var(--onaccent)}
.pf-lv{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 12px 46px}.pf-lv button{border:1.5px solid var(--line);background:var(--surface);border-radius:10px;padding:5px 10px;font-weight:700;font-size:12.5px;color:var(--muted);cursor:pointer}
.pf-lv button.on{border-color:var(--accent);color:var(--ink)}.pf-lv button.on::before{content:'✓ ';color:var(--accent);font-weight:900}
.pf-wk{display:grid;grid-template-columns:38px repeat(7,minmax(0,1fr));gap:3px;font-size:11px}.pf-wk span{color:var(--muted);font-weight:700;text-align:center;padding:2px 0}.pf-wk span.h{text-align:right;padding-right:4px}
.pf-wk b{height:24px;border-radius:5px;background:var(--line2);cursor:pointer}.pf-wk b.on{background:var(--accent)}
table.pf-who{width:100%;border-collapse:collapse;font-size:13px}table.pf-who th{text-align:left;font-size:11.5px;color:var(--muted);font-weight:800;padding:6px}table.pf-who td{padding:8px 6px;border-top:1px solid var(--line2);vertical-align:top}table.pf-who td:first-child{font-weight:800}
button.it{width:100%;text-align:left;background:none;border-left:0;border-right:0;border-bottom:0;font:inherit;color:inherit;cursor:pointer}button.it[disabled]{cursor:default}`; document.head.appendChild(c); }

  return {studentTab, stuGaps, famTodo, famPage, tutorKnow, tutorTodo, tutorMine, tutorPage, tutorFit, after, settingsPage, bindSettings, dobText, nextBday, loadB};
})();
