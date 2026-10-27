/* LHQ tuition card.
   Loaded before the main script. Everything here is a function; the main script calls initCard() once it has set up. */

const CARD_COLORS = [['#073763','#e6edf6'],['#1a74b0','#e4f0f8'],['#2c7a4b','#e5f3ea'],['#7a3f8f','#f1e8f5'],['#a85a14','#f8ece0'],['#3d5a80','#e7ecf3'],['#9b2c2c','#f7e5e5']];
const CARD_DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const CARD_DAYNAME = {Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun'};
let cardOpen = 0;               // which subject is expanded in the editor
let cardShareOnly = null;       // null = whole card, else subject index

/* ---------- topic lists ---------- */
function cardLevelSet(level){
  const l = String(level||'').toLowerCase();
  const y = +((l.match(/year\s*(\d+)/)||[])[1] || 0);
  if(/a\s*level|\bas\b/.test(l) || y >= 12) return 'A Level';
  if(/igcse/.test(l) || y === 10 || y === 11) return 'IGCSE';
  if(y >= 7 && y <= 9) return 'Lower Secondary (Years 7–9)';
  if(y === 5 || y === 6) return 'Primary (Year 6)';
  return null;
}
const cardNorm = s => String(s||'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const CARD_ALIAS = {
  'maths':['mathematics'], 'math':['mathematics'], 'mathematics':['pure mathematics 1'],
  'english':['english language','english'], 'english language':['english'], 'first language english':['english language','english'],
  'literature':['english literature'], 'literature in english':['english literature'],
  'business studies':['business'], 'business':['business studies'],
  'science':['combined science'], 'combined science':['science'], 'art':['art and design'], 'art design':['art and design']
};
/* Word-level matching so typed names like "Pure 1 Math", "Stats 1" or "Eng Lit" still find their list */
const CARD_WORD = {math:'mathematics',maths:'mathematics',mathematic:'mathematics',p:'pure',stats:'statistics',stat:'statistics',prob:'probability',
  lit:'literature',eng:'english',bio:'biology',chem:'chemistry',phy:'physics',phys:'physics',econ:'economics',econs:'economics',
  bus:'business',geo:'geography',acc:'accounting',accounts:'accounting',sci:'science',psych:'psychology',soc:'sociology',hist:'history',lang:'language'};
const CARD_SKIP = new Set(['and','of','the','studies','igcse','a','as','level','alevel','paper','cambridge']);
function cardWords(name){
  return cardNorm(name).replace(/([a-z])(\d)/g,'$1 $2').split(' ').filter(Boolean).map(w=>CARD_WORD[w]||w).filter(w=>!CARD_SKIP.has(w));
}
function cardMatchIn(lv, name){
  if(!lv || !window.TOPICS || !TOPICS[lv]) return [];
  const names = Object.keys(TOPICS[lv]), n = cardNorm(name);
  for(const c of [n, ...(CARD_ALIAS[n]||[])]){ const hit = names.find(x=>cardNorm(x)===c); if(hit) return [hit]; }
  const want = cardWords(name); if(!want.length) return [];
  const nums = want.filter(w=>/^\d+$/.test(w));
  return names.filter(x=>{ const have = cardWords(x); return want.every(w=>have.includes(w)) && (!nums.length || have.filter(w=>/^\d+$/.test(w)).join()===nums.join()); });
}
function cardGuessList(level, name){
  if(!window.TOPICS || !String(name||'').trim()) return '';
  const lv = cardLevelSet(level);
  if(lv){ const m = cardMatchIn(lv, name); return m.length===1 ? lv+'|'+m[0] : ''; }
  // No Year & level yet: use a match only if exactly one list anywhere fits
  const all = []; Object.keys(TOPICS).forEach(L=>cardMatchIn(L, name).forEach(n=>all.push(L+'|'+n)));
  return all.length===1 ? all[0] : '';
}
const CARD_LV_SHORT = {'Primary (Year 6)':'Year 6','Lower Secondary (Years 7–9)':'Years 7–9','IGCSE':'IGCSE','A Level':'A Level'};
function cardListLabel(key, lv){
  const i = key.indexOf('|'), L = key.slice(0,i), n = key.slice(i+1);
  return L===lv ? n : `${CARD_LV_SHORT[L]||L} · ${n}`;
}
function cardAllListKeys(lv){   // the student's level first, then every other level
  const order = [lv, ...Object.keys(TOPICS).filter(L=>L!==lv)].filter(L=>L && TOPICS[L]);
  return order.flatMap(L=>Object.keys(TOPICS[L]).map(n=>L+'|'+n));
}
function cardTopicSet(key){
  if(!key || !window.TOPICS) return null;
  const i = key.indexOf('|'); const lv = key.slice(0,i), name = key.slice(i+1);
  return (TOPICS[lv]||{})[name] || null;
}
function cardEntries(set){
  const out = []; let n = 0;
  (set ? set.topics : []).forEach((t, idx)=>{
    if(typeof t === 'string'){ n++; out.push({kind:'topic', key:'t'+idx, n, t}); }
    else if(t.sub){ n++; out.push({kind:'chapter', key:'c'+idx, n, t:t.t, sub:t.sub}); }
    else out.push({kind:'group', label:t.group});
  });
  return out;
}

/* ---------- card subjects ---------- */
/* IGCSE subjects Cambridge sets at Core or Extended */
const CARD_TIERED = ['Mathematics','Chemistry','Physics','Biology','Combined Science'];
function cardTiered(key){ return !!key && key.startsWith('IGCSE|') && CARD_TIERED.includes(key.slice(6)); }
function cardSubsFor(e, tier){ return tier==='Core' ? e.sub.filter(x=>!x.ext) : e.sub; }
const cardTier = s => cardTiered(s.list) ? (s.tier||'') : '';
function cardBlankSubject(name, level, perWeek, sessions){
  return { name: name||'', list: cardGuessList(level, name), tutor:'', days:[], perWeek: perWeek||'', sessions: sessions||'', mins:'', start:'', end:'',
    tier:'', mode:'selected', picks:{}, details:{}, custom:[], grade:'', basis:'', when:'', note:'', openCh:'' };
}
function cardSubjectsFromItems(items, level){
  return (items||[]).filter(it=>it.desc).map(it=>cardBlankSubject(it.desc, level, it.days, it.sessions));
}
function cardPicked(s){
  return Object.keys(s.picks||{}).filter(k=>{ const v = s.picks[k]; return v===true || v==='all' || (Array.isArray(v) && v.length); }).length + (s.custom||[]).length;
}
const cardMins = v => String(v||'').replace(/\s*minutes?/i,' min');
const cardDayText = s => (s.days||[]).length ? s.days.map(d=>CARD_DAYNAME[d]).join(' & ') : '';
function cardGradeText(s){
  if(!s.grade) return '';
  const extra = [s.basis, s.when].filter(Boolean).join(', ');
  return s.grade + (extra ? ` (${extra})` : '');
}
function cardMonths(){
  const out = [], d = new Date(); d.setDate(1);
  for(let i=0;i<24;i++){ out.push(`${MON[d.getMonth()]} ${d.getFullYear()}`); d.setMonth(d.getMonth()-1); }
  return out;
}

/* ---------- pickers for card fields (keys look like cs:<index>:<field>) ---------- */
function cardFieldCfg(key){
  const [, is, f] = key.split(':'); const i = +is, s = doc.subjects[i];
  const after = ()=>{ renderCardEditor(); update(); };
  const set = (k)=>v=>{ s[k] = v; };
  const cfg = {
    name: {title:'Subject', noun:'subject', list:subjectList, get:()=>s.name, set:v=>{ s.name = v; if(!cardPicked(s) && s.mode!=='full') s.list = cardGuessList(doc.level, v); }},
    list: {title:'Syllabus topic list', noun:'list', clear:'No list (own topics only)',
      list:()=>{ const lv = cardLevelSet(doc.level); return cardAllListKeys(lv).map(k=>cardListLabel(k, lv)); },
      get:()=>{ const k = s.list||''; return k ? cardListLabel(k, cardLevelSet(doc.level)) : ''; },
      set:v=>{ const lv = cardLevelSet(doc.level); const nk = v ? (cardAllListKeys(lv).find(k=>cardListLabel(k, lv)===v) || '') : '';
        s.noList = !nk;
        if(nk!==s.list){ s.list = nk; s.picks = {}; s.details = {}; s.openCh=''; } }},
    tf: {title:'Topical assessments', noun:'option', list:()=>['Weekly','Every 2 weeks'], get:()=>s.tf || 'Weekly', set:set('tf')},
    tier: {title:'Paper', noun:'option', clear:'Not set', list:()=>['Extended','Core'], get:()=>s.tier, set:set('tier')},
    tutor: {title:'Tutor', noun:'tutor', clear:'To be confirmed', list:()=>lines(settings.tutors), get:()=>s.tutor, set:set('tutor')},
    mins: {title:'Session length', noun:'length', clear:'Not set', list:()=>lines(settings.sessionLengths), get:()=>s.mins, set:set('mins')},
    grade: {title:'Current grade', noun:'grade', clear:'No grade', list:()=>lines(settings.grades), get:()=>s.grade, set:set('grade')},
    basis: {title:'Grade based on', noun:'option', clear:'Not given', list:()=>lines(settings.gradeBasis), get:()=>s.basis, set:set('basis')},
    when: {title:'When', noun:'month', clear:'Not given', list:cardMonths, get:()=>s.when, set:set('when')},
  }[f];
  return Object.assign({after}, cfg);
}

/* ---------- editor ---------- */
const cardChev = up => `<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="${up?'M6 15l6-6 6 6':'M6 9l6 6 6-6'}"/></svg>`;
const cardTick = (state) => {  // 'on' | 'mixed' | ''
  const mark = state==='on' ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>'
    : state==='mixed' ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="3.2"><path d="M6 12h12"/></svg>' : '';
  return `<span class="cl-box${state?' on':''}">${mark}</span>`;
};
function cardPickBtn(key, value, placeholder){
  return `<button type="button" class="picker-btn${value?'':' empty'}" data-pickfield="${key}" aria-haspopup="listbox" aria-expanded="false"><span class="pb-dot"></span><span class="pb-text">${esc(value||placeholder)}</span>${cardChev(false)}</button>`;
}
function cardChecklist(s, i){
  const set = cardTopicSet(s.list);
  if(!set) return `<p class="hint" style="margin:0">No topic list chosen. Choose one from <b>Topic list</b> above, or add your own topics below.</p>`;
  const rows = cardEntries(set).map(e=>{
    if(e.kind==='group') return `<div class="cl-grp">${esc(e.label)}</div>`;
    if(e.kind==='topic'){
      const on = s.picks[e.key]===true;
      return `<div class="cl-item"><button type="button" class="cl-row${on?' sel':''}" data-act="topic" data-key="${e.key}" aria-pressed="${on}">${cardTick(on?'on':'')}<span class="cl-n">${e.n}</span><span class="cl-t">${esc(e.t)}</span></button>
        ${on?`<input class="cl-detail" data-act="detail" data-key="${e.key}" value="${esc(s.details[e.key]||'')}" placeholder="Detail (optional)" aria-label="Detail for ${esc(e.t)}">`:''}</div>`;
    }
    const subs = cardSubsFor(e, cardTier(s)), v = s.picks[e.key], whole = v==='all', part = Array.isArray(v) ? v.filter(n=>subs.some(x=>x.n===n)) : [];
    const count = whole ? subs.length : part.length, open = s.openCh===e.key;
    const state = whole ? 'on' : part.length ? 'mixed' : '';
    let h = `<div class="cl-item cl-ch${open?' open':''}">
      <div class="cl-chrow">
        <button type="button" class="cl-tickbtn" data-act="chap" data-key="${e.key}" role="checkbox" aria-checked="${whole?'true':part.length?'mixed':'false'}" aria-label="Whole chapter: ${esc(e.t)}">${cardTick(state)}</button>
        <button type="button" class="cl-row cl-open${count?' sel':''}" data-act="chopen" data-key="${e.key}" aria-expanded="${open}"><span class="cl-n">${e.n}</span><span class="cl-t">${esc(e.t)}</span><span class="cl-count">${whole?`All ${subs.length}`:`${count} of ${subs.length}`}</span>${cardChev(open)}</button>
      </div>`;
    if(open){
      h += subs.map(x=>{ const on = whole || part.includes(x.n);
        return `<button type="button" class="cl-row cl-sub${on?' sel':''}" data-act="sub" data-key="${e.key}" data-n="${x.n}" aria-pressed="${on}">${cardTick(on?'on':'')}<span class="cl-n">${x.n}</span><span class="cl-t">${esc(x.t)}</span>${x.ext?'<span class="cl-e" title="Extended only">E</span>':''}</button>`; }).join('');
    }
    if(count) h += `<input class="cl-detail" data-act="detail" data-key="${e.key}" value="${esc(s.details[e.key]||'')}" placeholder="Detail (optional)" aria-label="Detail for ${esc(e.t)}">`;
    return h + '</div>';
  }).join('');
  const hasE = cardTier(s)!=='Core' && cardEntries(set).some(e=>e.sub && e.sub.some(x=>x.ext));
  return `<div class="cl"><div class="cl-head"><span>Syllabus topics · ${esc(set.code)}${cardTier(s)?' · '+cardTier(s):''}</span>${hasE?'<span>E = Extended only</span>':''}</div>
    ${cardEntries(set).some(e=>e.kind==='chapter')?'<div class="cl-tip">Tick a chapter for all of it, or open it to pick sub-topics.</div>':''}${rows}</div>`;
}
function renderCardEditor(){
  const subs = doc.subjects || [];
  if(cardOpen >= subs.length) cardOpen = subs.length - 1;
  const lv = cardLevelSet(doc.level);
  F('cardLevelNote').textContent = lv ? `Topic lists: ${lv}` : (doc.level ? 'No syllabus lists for this Year & level. Choose a topic list for each subject, or add your own topics.' : 'Choose Year & level above, or choose a topic list for each subject.');
  subs.forEach(s=>{ if(!s.list && !s.noList && s.mode!=='full' && !cardPicked(s)) s.list = cardGuessList(doc.level, s.name); });
  F('cardSubs').innerHTML = subs.map((s, i)=>{
    const [col] = CARD_COLORS[i % CARD_COLORS.length], open = i===cardOpen;
    const n = cardPicked(s), set = cardTopicSet(s.list);
    const cover = s.mode==='full' && set ? `Full course · ${cardEntries(set).filter(e=>e.kind!=='group').length} topics` : (n ? `${n} topic${n>1?'s':''}` : 'no topics yet');
    const sum = [cardTier(s), s.tutor || 'Tutor TBC', cardDayText(s) || 'days not set', s.start ? `${s.start}–${s.end}` : (s.days.length?'time TBC':''), cover].filter(Boolean).join(' · ');
    let h = `<div class="cs${open?' open':''}" style="--c:${col}">
      <button type="button" class="cs-head" data-act="toggle" data-cs="${i}" aria-expanded="${open}"><span class="cs-dot"></span><span class="cs-title"><b>${esc(s.name||'New subject')}</b><small>${esc(sum)}</small></span>${cardChev(open)}</button>`;
    if(open){
      const grade = cardGradeText(s);
      h += `<div class="cs-body" data-cs="${i}">
        <div class="grid2">
          <div class="fld"><span class="lbl">Subject</span>${cardPickBtn(`cs:${i}:name`, s.name, 'Choose')}</div>
          <div class="fld"><span class="lbl">Topic list</span>${cardPickBtn(`cs:${i}:list`, set ? `${cardListLabel(s.list, lv)} · ${set.code}` : '', 'None')}</div>
        </div>
        ${cardTiered(s.list) ? `<div class="grid2">
          <div class="fld"><span class="lbl">Paper</span>${cardPickBtn(`cs:${i}:tier`, s.tier, 'Not set')}</div>
          <div class="fld"><span class="lbl">Tutor</span>${cardPickBtn(`cs:${i}:tutor`, s.tutor, 'To be confirmed')}</div></div>`
        : `<div class="fld"><span class="lbl">Tutor</span>${cardPickBtn(`cs:${i}:tutor`, s.tutor, 'To be confirmed')}</div>`}
        <div class="fld"><span class="lbl">Days${s.perWeek?` <em class="cs-hint">(invoice: ${esc(s.perWeek)} days)</em>`:''}</span>
          <div class="cs-days" role="group" aria-label="Days">${CARD_DAYS.map(d=>`<button type="button" data-act="day" data-d="${d}" aria-pressed="${s.days.includes(d)}" class="${s.days.includes(d)?'on':''}">${d}</button>`).join('')}</div></div>
        <div class="grid2">
          <label><span>Sessions</span><input data-k="sessions" value="${esc(s.sessions)}" inputmode="numeric"></label>
          <div class="fld"><span class="lbl">Session length</span>${cardPickBtn(`cs:${i}:mins`, s.mins, 'Choose')}</div>
        </div>
        <div class="fld"><span class="lbl">Topical assessments</span>${cardPickBtn(`cs:${i}:tf`, s.tf || 'Weekly', 'Weekly')}</div>
        <div class="cs-times">
          <label><span>Start time (optional)</span><input type="time" data-k="start" value="${esc(s.start)}"></label>
          <span class="cs-dash">–</span>
          <label><span>End time (optional)</span><input type="time" data-k="end" value="${esc(s.end)}"></label>
        </div>
        <p class="hint" style="margin:-4px 0 12px">Leave the times blank if the timetable isn't ready. The card shows "time to be confirmed", and you can reshare it later.</p>
        ${set ? `<div class="fld"><span class="lbl">What to cover</span><div class="seg seg2" role="group" aria-label="What to cover">
          <button type="button" data-act="mode" data-m="selected" class="${s.mode!=='full'?'on':''}">Selected topics</button>
          <button type="button" data-act="mode" data-m="full" class="${s.mode==='full'?'on':''}">Full course</button></div></div>` : ''}
        ${s.mode==='full' && set ? `<p class="cs-full">The card will list all ${cardEntries(set).filter(e=>e.kind!=='group').length} topics in syllabus order, from the beginning.</p>` : cardChecklist(s, i)}
        <div class="fld" style="margin-top:12px"><span class="lbl">Your own topics</span>
          ${(s.custom||[]).length ? `<div class="cs-chips">${s.custom.map((t,ci)=>`<span class="cs-chip">${esc(t)}<button type="button" data-act="rmtopic" data-ci="${ci}" aria-label="Remove ${esc(t)}">✕</button></span>`).join('')}</div>` : ''}
          <div class="cs-add"><input data-act="newtopic" placeholder="Add a topic that isn't listed" aria-label="Add your own topic"><button type="button" class="small" data-act="addtopic">Add</button></div></div>
        <fieldset class="cs-grade"><legend>Current grade (optional)</legend>
          <div class="grid2">
            <div class="fld"><span class="lbl">Grade</span>${cardPickBtn(`cs:${i}:grade`, s.grade, 'Choose')}</div>
            <div class="fld"><span class="lbl">When</span>${cardPickBtn(`cs:${i}:when`, s.when, 'Choose')}</div>
          </div>
          <div class="fld"><span class="lbl">Based on</span>${cardPickBtn(`cs:${i}:basis`, s.basis, 'Choose')}</div>
          <div class="cs-preview">On the card: <b>${grade ? esc(grade) : 'no grade shown'}</b></div>
        </fieldset>
        <label><span>Notes for this tutor</span><textarea data-k="note" rows="3">${esc(s.note)}</textarea></label>
        <button type="button" class="small danger" data-act="remove">Remove ${esc(s.name||'this subject')}</button>
      </div>`;
    }
    return h + '</div>';
  }).join('') || '<p class="empty">No subjects yet. Add one below, or make the card from a saved invoice.</p>';
}

function cardEditorEvents(){
  const box = F('cardSubs');
  box.addEventListener('click', e=>{
    const pf = e.target.closest('[data-pickfield]'); if(pf){ openPicker(pf); return; }
    const b = e.target.closest('[data-act]'); if(!b || b.tagName==='INPUT') return;
    const body = b.closest('[data-cs]'); const i = +(b.dataset.cs ?? (body && body.dataset.cs));
    const s = doc.subjects[i], act = b.dataset.act;
    if(act==='toggle'){ cardOpen = cardOpen===i ? -1 : i; renderCardEditor(); return; }
    if(!s) return;
    if(act==='day'){ const d = b.dataset.d; s.days = s.days.includes(d) ? s.days.filter(x=>x!==d) : CARD_DAYS.filter(x=>x===d || s.days.includes(x)); }
    else if(act==='mode'){ s.mode = b.dataset.m; }
    else if(act==='topic'){ const k = b.dataset.key; if(s.picks[k]) delete s.picks[k]; else s.picks[k] = true; }
    else if(act==='chopen'){ s.openCh = s.openCh===b.dataset.key ? '' : b.dataset.key; }
    else if(act==='chap'){ const k = b.dataset.key; if(s.picks[k]==='all') delete s.picks[k]; else { s.picks[k] = 'all'; } }
    else if(act==='sub'){
      const k = b.dataset.key, n = b.dataset.n, ch = cardEntries(cardTopicSet(s.list)).find(x=>x.key===k);
      const all = cardSubsFor(ch, cardTier(s)).map(x=>x.n);
      let arr = s.picks[k]==='all' ? all.slice() : (s.picks[k]||[]).filter(x=>all.includes(x));
      arr = arr.includes(n) ? arr.filter(x=>x!==n) : all.filter(x=>x===n || arr.includes(x));
      if(!arr.length) delete s.picks[k]; else s.picks[k] = arr.length===all.length ? 'all' : arr;
    }
    else if(act==='addtopic'){ const inp = b.parentElement.querySelector('[data-act="newtopic"]'); const v = inp.value.trim(); if(!v) return; s.custom = (s.custom||[]).concat(v); }
    else if(act==='rmtopic'){ s.custom.splice(+b.dataset.ci, 1); }
    else if(act==='remove'){ doc.subjects.splice(i,1); cardOpen = Math.max(0, i-1); }
    renderCardEditor(); update();
  });
  box.addEventListener('input', e=>{
    const t = e.target, body = t.closest('[data-cs]'); if(!body) return;
    const s = doc.subjects[+body.dataset.cs]; if(!s) return;
    if(t.dataset.k){ s[t.dataset.k] = t.value; }
    else if(t.dataset.act==='detail'){ s.details[t.dataset.key] = t.value; }
    else return;
    update();
  });
  box.addEventListener('change', e=>{ if(e.target.dataset.k==='start' || e.target.dataset.k==='end') renderCardEditor(); });
  box.addEventListener('keydown', e=>{
    if(e.target.dataset.act==='newtopic' && e.key==='Enter'){ e.preventDefault(); e.target.parentElement.querySelector('[data-act="addtopic"]').click(); }
  });
  F('btnAddCardSubject').onclick = ()=>{ doc.subjects.push(cardBlankSubject('', doc.level)); cardOpen = doc.subjects.length-1; renderCardEditor(); update(); };
  F('whereChips').addEventListener('click', e=>{ const b = e.target.closest('[data-w]'); if(!b) return; doc.where = doc.where===b.dataset.w ? '' : b.dataset.w; F('f_where').value = doc.where; fillCardFields(); update(); });
  F('f_where').addEventListener('input', fillCardFields);
}
function fillCardFields(){
  F('whereChips').querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.w===doc.where));
  F('intakeBox').hidden = !doc.intake; F('intakeText').textContent = doc.intake || '';
}

const CARD_SHORT = {'mathematics':'Maths','additional mathematics':'Add Maths','english language':'English','english literature':'Literature',
  'business studies':'Business','combined science':'Science','global perspectives':'Global Persp.','computer science':'Comp. Sci.',
  'pure mathematics 1':'Pure 1','pure mathematics 3':'Pure 3','probability and statistics 1':'Stats 1','probability and statistics 2':'Stats 2','art and design':'Art'};
function cardShort(name){
  const n = String(name||''); if(n.length <= 10) return n;
  return CARD_SHORT[cardNorm(n)] || n.split(' ')[0].slice(0,10);
}

/* ---------- the card itself (preview, image, PDF) ---------- */
function cardHTML(d, only){
  const S = settings, idx = (d.subjects||[]).map((s,i)=>i).filter(i=>only==null || i===only);
  const subj = idx.map(i=>[i, d.subjects[i]]);
  const lab = (t, c='#5f6b7d') => `<div style="font-size:11px;color:${c};text-transform:uppercase;letter-spacing:.7px;font-weight:700">${t}</div>`;
  // weekly timetable
  const cols = CARD_DAYS.map(dd=>{
    const here = subj.filter(([,s])=>(s.days||[]).includes(dd));
    const blocks = here.map(([i,s])=>{ const [c] = CARD_COLORS[i % CARD_COLORS.length];
      const short = cardShort(s.name);
      const tm = s.start ? `${s.start}–<br>${s.end||''}` : 'Time<br>TBC';
      return `<div style="background:${c};color:#fff;border-radius:7px;padding:5px 3px;display:flex;flex-direction:column;gap:1px"><b style="font-size:12px;line-height:1.15;word-break:break-word">${esc(short)}</b><span style="font-size:10.5px;line-height:1.2">${tm}</span></div>`; }).join('');
    return `<div style="display:flex;flex-direction:column;gap:5px;min-width:0"><div style="font-weight:700;font-size:12.5px;color:${here.length?'#1d2433':'#8a94a3'}">${CARD_DAYNAME[dd]}</div><div style="background:#f3f5f8;border-radius:9px;min-height:74px;padding:4px;display:flex;flex-direction:column;gap:4px">${blocks || '<div style="color:#b3bcc8;font-size:12px;padding-top:6px">–</div>'}</div></div>`;
  }).join('');
  const anyDays = subj.some(([,s])=>(s.days||[]).length), anyTbc = subj.some(([,s])=>(s.days||[]).length && !s.start);
  // subject sections
  const sections = subj.map(([i,s])=>{
    const [c, tint] = CARD_COLORS[i % CARD_COLORS.length], set = cardTopicSet(s.list);
    const tutor = s.tutor ? `<b>${esc(s.tutor)}</b>` : '<b style="color:#9a5b00">To be confirmed</b>';
    const when = [cardDayText(s) || '<span style="color:#9a5b00">days to be confirmed</span>',
      s.start ? `${esc(s.start)}–${esc(s.end)}` : '<span style="color:#9a5b00">time to be confirmed</span>',
      s.sessions ? `${esc(s.sessions)} sessions${s.mins ? ` of ${esc(cardMins(s.mins))}` : ''}` : (s.mins ? esc(cardMins(s.mins)) + ' sessions' : '')].filter(Boolean).join(' · ');
    const grade = cardGradeText(s) ? `<div style="font-size:13px"><span style="color:#5f6b7d">Current grade:</span> <b>${esc(s.grade)}</b>${[s.basis,s.when].filter(Boolean).length?` <span style="color:#5f6b7d">(${esc([s.basis,s.when].filter(Boolean).join(', '))})</span>`:''}</div>` : '';
    let topics = '';
    if(set && s.mode==='full'){
      const items = cardEntries(set).filter(e=>e.kind!=='group');
      topics = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="background:#f4b223;color:#1d2433;border-radius:99px;padding:2px 10px;font-weight:700;font-size:12px">FULL COURSE · FROM THE BEGINNING</span><span style="font-size:12.5px;color:#5f6b7d">${items.length} topics in syllabus order</span></div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3px 14px">${items.map(e=>`<div style="display:flex;gap:6px;font-size:12.5px;line-height:1.35"><span style="color:${c};font-weight:700;min-width:16px;text-align:right">${e.n}</span><span>${esc(e.t)}</span></div>`).join('')}</div>`;
    }
    if(!(set && s.mode==='full') || (s.custom||[]).length){
      let rows = '';
      if(set && s.mode!=='full') cardEntries(set).forEach(e=>{
        const v = s.picks[e.key]; if(!v || (Array.isArray(v) && !v.length)) return;
        const det = s.details[e.key] ? `<div style="padding-left:16px;font-size:12.5px;color:#3b4555;font-style:italic">${esc(s.details[e.key])}</div>` : '';
        let sub = '';
        if(e.kind==='chapter'){
          const subs = cardSubsFor(e, cardTier(s));
          if(v==='all') sub = `<div style="padding-left:16px;font-size:12.5px;color:#3b4555">Whole chapter · all ${subs.length}${cardTier(s)==='Core'?' Core':''} sub-topics</div>`;
          else sub = subs.filter(x=>v.includes(x.n)).map(x=>`<div style="display:flex;gap:6px;padding-left:16px;font-size:12.5px"><span style="color:#8a94a3;min-width:30px">${x.n}</span><span>${esc(x.t)}</span></div>`).join('');
        }
        rows += `<div style="display:flex;flex-direction:column;gap:1px"><div style="display:flex;gap:6px;font-size:13px;line-height:1.35"><span style="color:${c}">■</span><b>${esc(e.t)}</b></div>${sub}${det}</div>`;
      });
      rows += (s.custom||[]).map(t=>`<div style="display:flex;gap:6px;font-size:13px;line-height:1.35"><span style="color:${c}">■</span><b>${esc(t)}</b></div>`).join('');
      if(rows) topics += `<div style="display:flex;flex-direction:column;gap:3px">${lab(set && s.mode==='full' ? 'Also cover' : 'Focus topics')}${rows}</div>`;
    }
    const note = s.note ? `<div style="font-size:13px;color:#3b4555;border-top:1px dashed #dde2ea;padding-top:6px;white-space:pre-wrap">${esc(s.note)}</div>` : '';
    return `<div style="border:1px solid #dde2ea;border-left:6px solid ${c};border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">
        <span><b style="font-size:17px;color:${c}">${esc(s.name||'Subject')}</b>${set?` <span style="font-size:12px;color:#5f6b7d">${esc(set.code)}</span>`:''}${cardTier(s)?` <span style="font-size:11px;font-weight:700;color:${c};border:1px solid ${c};border-radius:99px;padding:1px 7px;vertical-align:2px">${esc(cardTier(s).toUpperCase())}</span>`:''}</span>
        <span style="font-size:13px">Tutor: ${tutor}</span>
      </div>
      <div style="font-size:13.5px">${when}</div>${grade}${topics}${note}</div>`;
  }).join('');
  const levelLine = [d.level, d.exam ? `Exams ${d.exam}` : ''].filter(Boolean).map(esc).join(' · ');
  const len = rangeLength(d.periodStart, d.periodEnd);
  const period = d.periodStart ? rangeText(d.periodStart, d.periodEnd) + (len ? ` (${len})` : '') : (d.period || 'To be confirmed');
  return `<div class="tcard" style="width:540px;background:#fff;color:#1d2433;font-family:Calibri,Carlito,'Segoe UI',sans-serif;font-size:14px;line-height:1.4">
  <div style="background:#073763;color:#fff;padding:18px 24px;display:flex;align-items:center;gap:14px">
    <div style="background:#fff;border-radius:8px;padding:5px 7px;display:flex"><img src="logo.png" alt="LHQ" style="width:80px;height:42px;object-fit:contain;display:block"></div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:flex-end;text-align:right">
      <div style="font-size:24px;font-weight:700;letter-spacing:1px;line-height:1.1">TUITION CARD</div>
      <div style="color:#f4b223;font-weight:700;font-size:13px">${esc(d.number)} · Issued ${esc(niceDate(d.date))}${only!=null?' · '+esc(d.subjects[only].name):''}</div>
    </div>
  </div>
  <div style="padding:18px 24px 6px;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="font-size:23px;font-weight:700;color:#073763;line-height:1.15">${esc(d.student || 'Student name')}</div>
      ${levelLine?`<div style="font-size:14.5px">${levelLine}</div>`:''}
      ${d.school?`<div style="color:#5f6b7d">School: ${esc(d.school)}</div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px;border-top:1px solid #dde2ea;border-bottom:1px solid #dde2ea;padding:10px 0">
      <div>${lab('Tuition period')}<b>${esc(period)}</b></div>
      <div>${lab('Where')}<b>${esc(d.where || 'To be confirmed')}</b></div>
    </div>
    ${anyDays ? `<div style="display:flex;flex-direction:column;gap:8px">${lab('Weekly timetable')}<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;text-align:center">${cols}</div>${anyTbc?'<div style="font-size:12.5px;color:#5f6b7d">Session days are agreed. Times marked TBC will follow once the timetable is set.</div>':''}</div>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px">${lab(subj.length>1?'Subjects':'Subject')}${sections || '<div style="color:#5f6b7d">No subjects added yet.</div>'}</div>
    ${d.cardNote ? `<div style="background:#fff7e0;border-radius:10px;padding:10px 14px;display:flex;flex-direction:column;gap:4px">${lab('Notes from LHQ', '#7a5400')}<div style="white-space:pre-wrap">${esc(d.cardNote)}</div></div>` : ''}
  </div>
  <div style="margin-top:14px;border-top:3px solid #f4b223;height:12px"></div>
</div>`;
}
function renderCardPreview(){ F('cardDoc').innerHTML = cardHTML(doc, null); }

async function cardRender(only){
  const stage = F('pdfStage');
  stage.innerHTML = `<div style="width:540px">${cardHTML(doc, only)}</div>`;
  const el = stage.firstChild;
  if(document.fonts && document.fonts.ready) await document.fonts.ready;
  await Promise.all([...el.querySelectorAll('img')].map(img=>img.complete?0:new Promise(r=>{img.onload=img.onerror=r;})));
  const h = Math.ceil(el.offsetHeight) + 2;
  const opts = { margin:0, image:{type:'jpeg', quality:0.98},
    html2canvas:{scale:3, useCORS:true, backgroundColor:'#ffffff', scrollX:0, scrollY:0, x:0, y:0, width:540, height:h, windowWidth:540, windowHeight:h},
    jsPDF:{unit:'pt', format:[405, h*0.75], orientation: h > 540 ? 'portrait' : 'landscape'} };
  return {el, h, opts, done:()=>{ stage.innerHTML = ''; }};
}
async function cardPng(only){
  const r = await cardRender(only);
  try{
    const canvas = await (await lhqPdf())().set(r.opts).from(r.el).toCanvas().get('canvas');
    return await new Promise(res=>canvas.toBlob(res, 'image/png'));
  } finally { r.done(); }
}
async function cardPdf(only){
  const r = await cardRender(only);
  try{ return await (await lhqPdf())().set(r.opts).from(r.el).outputPdf('blob'); } finally { r.done(); }
}
function cardFileName(only, ext){
  const who = (doc.student || 'Student').trim();
  const part = only!=null ? `_${doc.subjects[only].name}` : '';
  return `LHQ Tuition Card_ ${who}${part}_${doc.number}.${ext}`.replace(/[\\/:*?"<>|]/g,'');
}

/* ---------- share sheet ---------- */
function openCardShare(){
  saveDoc(true);
  if(!(doc.subjects||[]).length){ toast('Add at least one subject first'); return; }
  cardShareOnly = null;
  renderCardShare();
  F('cardShareDlg').showModal();
}
function renderCardShare(){
  const subs = doc.subjects || [];
  document.querySelectorAll('#csWhich button').forEach(b=>b.classList.toggle('on', (b.dataset.w==='one') === (cardShareOnly!=null)));
  F('csSubjects').hidden = cardShareOnly==null;
  F('csSubjects').innerHTML = subs.map((s,i)=>`<button type="button" class="chip-btn${i===cardShareOnly?' on':''}" data-i="${i}">${esc(s.name||'Subject '+(i+1))}</button>`).join('');
  F('csThumb').innerHTML = `<div style="transform:scale(.1444);transform-origin:top left;width:540px">${cardHTML(doc, cardShareOnly)}</div>`;
  const shown = cardShareOnly==null ? subs : [subs[cardShareOnly]];
  F('csTitle').textContent = cardShareOnly==null ? `All ${subs.length} subject${subs.length>1?'s':''}` : (subs[cardShareOnly].name || 'One subject');
  F('csSub').textContent = shown.map(s=>s.name).filter(Boolean).join(', ');
  const tbc = shown.filter(s=>!s.tutor).map(s=>s.name);
  F('csWarn').textContent = tbc.length ? `Tutor not assigned yet: ${tbc.join(', ')}` : '';
  F('csCode').textContent = `${doc.number} · ${doc.student || 'Student'}`;
  const tutors = [...new Set((doc.subjects||[]).map(x=>x.tutor).filter(Boolean))];
  const others = (saved||[]).filter(x=>x.type==='card' && x.id!==doc.id);
  F('csTutors').innerHTML = tutors.length ? tutors.map(t=>{
      const subs = doc.subjects.filter(x=>x.tutor===t).map(x=>x.name).join(', ');
      const n = new Set(cardRosterSubjects(others.concat([doc])).filter(x=>x.tutor===t).map(x=>cardNormName(x.student))).size;
      return `<div class="cs-trow"><span><b>${esc(t)}</b><small>${esc(subs)} · ${n} student${n===1?'':'s'} in total</small><small>${esc(cardTutorSentText(t))}</small></span><button type="button" class="small wa" data-tutor="${esc(t)}">Send link</button></div>`; }).join('')
    : '<p class="hint" style="margin:0">Choose a tutor for each subject on the card to send them their link.</p>';
}
async function cardShareFile(kind, save){
  const btns = document.querySelectorAll('#cardShareDlg .cs-actions button'); btns.forEach(b=>b.disabled = true);
  toast(kind==='pdf' ? 'Preparing PDF…' : 'Preparing image…');
  try{
    const blob = kind==='pdf' ? await cardPdf(cardShareOnly) : await cardPng(cardShareOnly);
    const name = cardFileName(cardShareOnly, kind==='pdf' ? 'pdf' : 'png');
    const file = new File([blob], name, {type: kind==='pdf' ? 'application/pdf' : 'image/png'});
    if(!save && navigator.canShare && navigator.canShare({files:[file]})){
      try{ await navigator.share({files:[file], title: name}); toast('Shared'); }
      catch(err){ if(err && err.name!=='AbortError') { triggerDownload(blob, name); toast('Sharing isn\'t available here, so the file was downloaded'); } }
    } else { triggerDownload(blob, name); toast(save ? 'Saved' : 'Sharing isn\'t available here, so the file was downloaded'); }
  } catch(err){ console.error(err); toast('Couldn\'t make the file. Check your connection and try again.'); }
  finally { btns.forEach(b=>b.disabled = false); }
}

function initCard(){
  cardEditorEvents();
  document.querySelectorAll('#csWhich button').forEach(b=>b.addEventListener('click', ()=>{ cardShareOnly = b.dataset.w==='one' ? (cardShareOnly ?? 0) : null; renderCardShare(); }));
  F('csSubjects').addEventListener('click', e=>{ const b = e.target.closest('[data-i]'); if(!b) return; cardShareOnly = +b.dataset.i; renderCardShare(); });
  F('csClose').onclick = ()=>F('cardShareDlg').close();
  F('csImage').onclick = ()=>cardShareFile('png', false);
  F('csPdf').onclick = ()=>cardShareFile('pdf', false);
  F('csSave').onclick = ()=>cardShareFile('png', true);
  F('csTutors').onclick = async e=>{ const b = e.target.closest('[data-tutor]'); if(!b) return; saveDoc(true); await cardSendTutorLink(saved, b.dataset.tutor); renderCardShare(); };
  F('clLink').value = cardChecklistLink();
  const invite = ()=>`Hello! Please fill in this short LHQ Learning Solutions topic checklist so we know which subjects and topics you'd like help with. It takes about 3 minutes:\n${cardChecklistLink()}`;
  F('btnClCopy').onclick = async ()=>{ try{ await navigator.clipboard.writeText(cardChecklistLink()); toast('Link copied'); }catch(e){ F('clLink').select(); toast('Select the link and copy it'); } };
  F('btnClWa').onclick = ()=>{ const url = 'https://wa.me/?text=' + encodeURIComponent(invite()); const w = window.open(url, '_blank'); if(!w) location.href = url; };
  F('btnClOpen').onclick = ()=>window.open(cardChecklistLink(), '_blank');
  window.addEventListener('hashchange', cardImportFromHash);
}

/* ---------- importing a student's topic checklist (link: …/#import=<code>) ---------- */
function cardB64(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length % 4) s += '='; return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
async function cardDecode(code){
  const kind = code[0], bytes = cardB64(code.slice(1).replace(/[^A-Za-z0-9_-]/g,''));
  let raw = bytes;
  if(kind==='z') raw = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  else if(kind!=='j') throw new Error('unknown format');
  return JSON.parse(new TextDecoder().decode(raw));
}
const CARD_WHERE = {'At LHQ':'LHQ Centre', 'Online':'Online'};
function cardFromChecklist(p){
  const d = blankDoc('card');
  d.items = []; d.student = p.n || ''; d.level = p.l || ''; d.school = p.sc || ''; d.exam = p.ex || '';
  d.where = CARD_WHERE[p.wh] || ''; d.checklistId = p.id || '';
  d.subjects = (p.s || []).map(x=>{
    const s = cardBlankSubject(x.n, d.level);
    if(x.k && cardTopicSet(x.k)) s.list = x.k;
    s.mode = x.m==='f' ? 'full' : 'selected';
    s.picks = (x.p && typeof x.p==='object') ? x.p : {};
    s.custom = Array.isArray(x.c) ? x.c.map(String) : [];
    s.grade = x.g || ''; s.basis = x.b || ''; s.when = x.w || ''; s.tier = x.r || '';
    s.note = [x.m==='u' ? 'Student isn\'t sure which topics yet: check in the first session.' : '', x.o || ''].filter(Boolean).join(' ');
    return s;
  });
  const when = [(p.d||[]).map(k=>CARD_DAYNAME[k]).filter(Boolean).join(', '), (p.t||[]).join(', ').toLowerCase(), p.wh].filter(Boolean).join(' · ');
  d.intake = [`Checklist received ${niceDate(todayISO())}`, when ? `Available: ${when}` : '', p.no ? `Notes: ${p.no}` : ''].filter(Boolean).join('\n');
  return d;
}
async function cardImportFromHash(){
  if(!location.hash.startsWith('#import=')) return;
  const code = decodeURIComponent(location.hash.slice(8));
  history.replaceState(null, '', location.pathname + location.search);
  let p;
  try{ p = await cardDecode(code); }
  catch(e){ console.error(e); toast('This checklist link is incomplete. Ask the student to send it again, or copy the whole link.'); return; }
  const done = p.id && saved.find(s=>s.type==='card' && s.checklistId===p.id);
  if(done){ doc = normalize(JSON.parse(JSON.stringify(done))); fillForm(); setView('edit'); toast(`This checklist is already ${done.number}. It's open now.`); return; }
  if(!doc.id && (doc.student || doc.name) && !confirm(`Open ${p.n || 'the student'}'s checklist as a new tuition card? The unsaved ${WORD[doc.type].toLowerCase()} you're working on will be cleared.`)) return;
  closePicker(false); closeCal(false);
  doc = cardFromChecklist(p); cardOpen = 0;
  fillForm(); setView('edit'); window.scrollTo({top:0});
  toast(`${p.n || 'Student'}'s checklist is in tuition card ${doc.number}. Add tutors and days, then Save.`);
}
function cardChecklistLink(){ try{ return new URL('checklist.html', location.href).href; }catch(e){ return 'checklist.html'; } }


/* ---------- tutors' session-log links (shared by the app and the Reports page) ---------- */
const cardNormName = x => String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
function cardTopicNames(s){
  const set = cardTopicSet(s.list), out = [];
  if(set){
    const tier = cardTier(s);
    cardEntries(set).forEach(e=>{
      if(e.kind==='group') return;
      if(s.mode==='full'){ out.push(e.t); return; }
      const v = (s.picks||{})[e.key]; if(!v) return;
      if(e.kind==='topic' || v==='all') out.push(e.t);
      else cardSubsFor(e, tier).filter(x=>v.includes(x.n)).forEach(x=>out.push(x.t));
    });
  }
  (s.custom||[]).forEach(t=>out.push(t));
  return [...new Set(out)];
}
/* the newest saved tuition card for each student + subject */
function cardRosterSubjects(savedList){
  const out = new Map();
  (savedList||[]).filter(x=>x.type==='card').sort((a,b)=>(a.savedAt||0)-(b.savedAt||0)).forEach(c=>{
    (c.subjects||[]).forEach(s=>{
      if(!s.name || !c.student) return;
      const key = cardNormName(c.student) + '|' + cardNormName(s.name);
      out.set(key, {key, student:c.student.trim(), level:c.level||'', exam:c.exam||'', periodStart:c.periodStart||'', periodEnd:c.periodEnd||'', card:c.number,
        name:s.name, list:s.list||'', tier:cardTier(s), tutor:s.tutor||'', tf:s.tf==='Every 2 weeks' ? 2 : 1, days:s.days||[], start:s.start||'', end:s.end||'',
        code:(cardTopicSet(s.list)||{}).code || '', topics:cardTopicNames(s), _c:c, _s:s});
    });
  });
  return [...out.values()];
}
/* v2 link: grouped by card; topics travel as codes (chapter keys / sub-topic numbers) and
   the tutor page looks the names up in topics.js. Empty fields are left out to keep links short. */
function cardTutorPayload(savedList, tutor){
  const d = new Date(), iso = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const cards = new Map();
  const put = (o,k,v)=>{ if(v!=null && v!=='' && !(Array.isArray(v) && !v.length) && !(typeof v==='object' && !Array.isArray(v) && !Object.keys(v).length)) o[k] = v; };
  cardRosterSubjects(savedList).filter(x=>x.tutor===tutor).forEach(x=>{
    const c = x._c, s = x._s;
    if(!cards.has(c.number)){
      const o = {n:c.student.trim()};
      put(o,'no',c.number); put(o,'l',c.level); put(o,'x',c.exam); put(o,'sc',c.school); put(o,'w',c.where);
      put(o,'a',c.periodStart); put(o,'b',c.periodEnd); if(!c.periodStart) put(o,'pd',c.period); put(o,'nt',(c.cardNote||'').trim()); o.i = [];
      cards.set(c.number, o);
    }
    const it = {u:s.name};
    put(it,'ls',s.list); put(it,'r',cardTier(s)); if(s.mode==='full') it.md = 'f';
    if(s.mode!=='full'){ put(it,'pk',s.picks); }
    const dt = {}; Object.entries(s.details||{}).forEach(([k,v])=>{ if(String(v).trim() && (s.mode==='full' || (s.picks||{})[k])) dt[k] = String(v).trim(); }); put(it,'dt',dt);
    put(it,'cu',s.custom); put(it,'y',s.days); if(s.start) it.m = `${s.start}–${s.end||''}`; put(it,'mi',s.mins);
    if(s.tf==='Every 2 weeks') it.f = 2;
    put(it,'g',s.grade); put(it,'gb',s.basis); put(it,'gw',s.when); put(it,'nt',(s.note||'').trim());
    cards.get(c.number).i.push(it);
  });
  return {v:2, t:tutor, d:iso, c:[...cards.values()]};
}
async function cardTutorLink(savedList, tutor){
  return new URL('t', location.href).href + '#' + await lhqEncode(cardTutorPayload(savedList, tutor));
}
/* which tutors have already had a link (so the how-to text goes only the first time) */
function cardTlinks(){ try{ return JSON.parse(localStorage.getItem('lhq_tlinks')||'{}') || {}; }catch(e){ return {}; } }
function cardMarkTutorSent(tutor){ const o = cardTlinks(); o[tutor] = Date.now(); try{ localStorage.setItem('lhq_tlinks', JSON.stringify(o)); }catch(e){} }
function cardTutorSentText(tutor){
  const t = cardTlinks()[tutor]; if(!t) return 'Link not sent yet';
  const d = new Date(t); return `Link last sent ${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}`;
}
function cardTutorMessage(tutor, link, howTo){
  const first = String(tutor).split(' ')[0];
  if(howTo==null) howTo = !cardTlinks()[tutor];
  return howTo
    ? `Hello ${first}, here is your LHQ link. It has the tuition card for each of your students. Open it on your phone and keep it. After each session, log attendance, topics and any assessment score, then send your log to LHQ at the end of the week.\n\n${link}`
    : `${first}, your updated LHQ link:\n${link}`;
}
async function cardSendTutorLink(savedList, tutor){
  const link = await cardTutorLink(savedList, tutor);
  const howTo = F('csHowTo') && F('csHowTo').checked ? true : null;
  const url = 'https://wa.me/?text=' + encodeURIComponent(cardTutorMessage(tutor, link, howTo));
  cardMarkTutorSent(tutor);
  const w = window.open(url, '_blank'); if(!w) location.href = url;
}
