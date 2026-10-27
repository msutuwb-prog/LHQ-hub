/* Draws the parent reports (weekly / 2-weekly / monthly) and exports them as image and PDF.
   Uses the helpers defined in reports.html (studentModel, watchItems, letter, nice, range …). */

const REP_FOOT = '<div class="ft"><span>LHQ Learning Solutions · 0992 525 250 · learnhqes@gmail.com</span><span>Working grade: average of topical assessments taken at LHQ this tuition period (weekly, or every two weeks where topics are longer). LHQ scale: A* 90+, A 80–89, B 70–79, C 60–69, D 50–59. Not an official Cambridge grade. SRAs are spaced repetition reviews done at home.</span></div>';
const ARROW = t => t > 0 ? '<span class="up">↑</span>' : t < 0 ? '<span class="dn">↓</span>' : '<span class="fl">→</span>';
const firstName = n => String(n||'').trim().split(/\s+/)[0] || 'The student';

function editKey(m){ return `${norm(m.name)}|${m.a}|${m.b}|${state.freq}`; }
function getEdits(m){ return (store.get('lhq_repEdits', {}))[editKey(m)] || {}; }
function setEdits(m, ed){ const all = store.get('lhq_repEdits', {}); all[editKey(m)] = ed; store.set('lhq_repEdits', all); }

function draftComment(m){
  const n = firstName(m.name), S = [];
  if(m.sessions){
    let s = `${n} attended ${m.attended} of ${m.sessions} session${m.sessions===1?'':'s'} (${Math.round(m.attended/m.sessions*100)}%)`;
    const parts = [];
    if(m.testCount) parts.push(`took ${m.testCount} topical assessment${m.testCount===1?'':'s'} (average ${m.testAvg}%)`);
    if(m.sraDue) parts.push(`handed in ${m.sraOn} of ${m.sraDue} SRAs on time`);
    if(parts.length) s += (parts.length===1 ? ' and ' : ', ') + parts.join(parts.length===1 ? '' : ' and ');
    S.push(s + '.');
  }
  const graded = m.subjects.filter(s=>s.gNow!=null);
  if(graded.length > 1){
    const best = graded.slice().sort((x,y)=>y.gNow - x.gNow)[0];
    let s = `${n}'s strongest subject is ${best.name} (${letter(best.gNow)}, ${best.gNow}%)`;
    const up = graded.filter(x=>x.trend > 0 && x!==best).sort((x,y)=>(rank(letter(y.gPrev))-rank(letter(y.gNow))) - (rank(letter(x.gPrev))-rank(letter(x.gNow))))[0];
    if(up) s += `, and ${up.name} has improved the most, up from ${letter(up.gPrev)} to ${letter(up.gNow)}`;
    S.push(s + '.');
  } else if(graded.length===1 && graded[0].trend > 0){
    S.push(`${graded[0].name} has moved up from ${letter(graded[0].gPrev)} to ${letter(graded[0].gNow)}.`);
  }
  const down = m.subjects.filter(s=>s.trend < 0);
  if(down.length) S.push(down.map(s=>`${s.name} has slipped from ${letter(s.gPrev)} to ${letter(s.gNow)}`).join('; ') + ', and this will be the focus next month.');
  const abs = m.subjects.filter(s=>s.absences.length);
  if(abs.length){ const k = abs.reduce((x,s)=>x+s.absences.length,0); S.push(`${k} session${k>1?'s were':' was'} missed (${abs.map(s=>s.name).join(', ')}).`); }
  const lateSubs = m.subjects.filter(s=>s.sraLate || s.sraMiss);
  if(lateSubs.length) S.push(`Keeping SRAs on time in ${lateSubs.map(s=>s.name).join(' and ')} will help topics stick.`);
  return S.join(' ');
}

/* ---------- pieces ---------- */
function headHTML(title, sub){ return `<div class="hd"><img src="logo.png" alt="LHQ Learning Solutions"><div class="ttl"><b>${title}</b><span>${sub}</span></div></div><div class="rule"></div>`; }
function whoHTML(m, monthly){
  const bits = [m.level, m.exam ? `Exams ${m.exam}` : ''].filter(Boolean);
  if(monthly && m.periodStart) bits.push(`Tuition period ${range(m.periodStart, m.periodEnd || m.periodStart)}`);
  return `<div class="who"><h1>${esc(m.name)}</h1>${bits.length ? `<p>${esc(bits.join(' · '))}</p>` : ''}</div>`;
}
function figsHTML(m, monthly){
  const w = watchItems(m).length;
  const status = w ? `<b style="color:#a86a00">${w} to watch</b><small>See below</small>` : `<b style="color:#1f7a4d">On track</b><small>Nothing to watch</small>`;
  return `<div class="figs">
    <div><b>${m.attended} / ${m.sessions}</b><small>Sessions attended${m.sessions ? ` · ${Math.round(m.attended/m.sessions*100)}%` : ''}</small></div>
    <div><b>${m.testAvg!=null ? m.testAvg + '%' : '–'}</b><small>Topical assessments${monthly && m.testCount ? ` · ${m.testCount} taken` : ''}</small></div>
    <div><b>${m.sraDue ? `${m.sraOn} / ${m.sraDue}` : '–'}</b><small>SRAs on time</small></div>
    ${monthly ? `<div><b>${m.overall!=null ? `${letter(m.overall)} <span style="font-size:16px;color:#5f6b7d;font-weight:400">${m.overall}%</span>` : '–'}</b><small>Overall working grade</small></div>` : `<div>${status}</div>`}
  </div>`;
}
function dotFor(s){ return s.trend < 0 || s.sraMiss ? 'r' : (s.absences.length || s.sraLate) ? 'a' : 'g'; }
function sraCell(s){
  if(!s.sraDue) return '<span class="fl">none due</span>';
  const bad = s.sraDue - s.sraOn, why = [s.sraLate && `${s.sraLate} late`, s.sraMiss && `${s.sraMiss} not in`].filter(Boolean).join(', ');
  return `${s.sraOn} / ${s.sraDue}${bad ? ' <span class="dn">●</span>' : ''}${why ? `<span class="sub">${why}</span>` : ''}`;
}
function testCell(s, weekly){
  if(s.tests.length) return weekly && s.tests.length===1 ? `${s.tests[0]}%` : `${s.testAvg}%${s.tests.length>1 ? `<span class="sub">${s.tests.length} tests</span>` : ''}`;
  return s.tf===2 ? '<span class="fl">none this week<span class="sub">every 2 weeks</span></span>' : '<span class="fl">none</span>';
}
function gradeCell(s){
  if(s.gNow==null) return '<span class="fl">–</span>';
  return `<span class="gr">${letter(s.gNow)}</span> ${ARROW(s.trend)}<span class="dot ${dotFor(s)}"></span>${s.trend && s.gPrev!=null ? `<span class="sub">from ${letter(s.gPrev)}</span>` : ''}`;
}
function spark(vals){ return '<span class="spark">' + vals.map(v=>`<i style="height:${v==null ? 3 : Math.max(4, Math.round((v-40)/60*20)+2)}px"></i>`).join('') + '</span>'; }
function watchHTML(m){
  const w = watchItems(m); if(!w.length) return '';
  return `<div class="sec" style="margin-top:18px">To watch</div><ul class="watch">${w.map(([,c,t])=>`<li><i style="background:${c==='r'?'#c0392b':'#d99a00'}"></i><span>${t}</span></li>`).join('')}</ul>`;
}

/* ---------- weekly and 2-weekly: one page ---------- */
function weeklyHTML(m, ed){
  const two = state.freq==='2';
  const rows = m.subjects.map(s=>`<tr><td><b>${esc(s.name)}</b><span class="sub">${esc(s.topicsCovered.join(', ') || (s.sessions ? '' : 'no session logged'))}</span></td>
    <td class="c">${s.sessions ? `${s.attended} / ${s.sessions}${s.absences.length ? ' <span class="dn">●</span>' : ''}` : '<span class="fl">–</span>'}</td>
    <td class="c">${testCell(s, !two)}</td><td class="c">${sraCell(s)}</td><td class="c">${gradeCell(s)}</td></tr>`).join('');
  const notes = m.subjects.map(s=>{ const t = ed.notes && s.name in ed.notes ? ed.notes[s.name] : s.note; return t ? `<p><b>${esc(s.name)}</b> · ${esc(t)}</p>` : ''; }).join('');
  const wk = Math.max(1, Math.round(((parseISO(m.b) - parseISO(m.periodStart || m.a)) / 86400000 + 1) / 7));
  const inTuition = m.periodStart && m.b >= m.periodStart;
  const sub = (inTuition ? (two && wk > 1 ? `Weeks ${wk-1}–${wk} · ` : `Week ${wk} · `) : '') + range(m.a, m.b, true);
  return `<div class="rp wk">${headHTML(two ? '2-WEEKLY REPORT' : 'WEEKLY REPORT', sub)}${whoHTML(m, false)}${figsHTML(m, false)}
    <div class="sec">${two ? 'These two weeks' : 'This week'}</div>
    <table><tr><th>Subject</th><th class="c">Attended</th><th class="c">Topical test</th><th class="c">SRAs on time</th><th class="c">Working grade</th></tr>${rows}</table>
    ${watchHTML(m)}
    ${notes ? `<div class="sec" style="margin-top:18px">From the tutors</div><div class="notes">${notes}</div>` : ''}
    ${REP_FOOT}</div>`;
}

/* ---------- monthly: at-a-glance page + detailed pages, paginated ---------- */
function monthlyBlocks(m, ed){
  const rows = m.subjects.map(s=>`<tr><td><b>${esc(s.name)}</b><span class="sub">${esc([s.code, s.tier].filter(Boolean).join(' · '))}</span></td><td>${esc(s.tutor||'')}</td>
    <td class="c">${s.sessions ? `${s.attended} / ${s.sessions}${s.absences.length ? ' <span class="dn">●</span>' : ''}` : '<span class="fl">–</span>'}</td>
    <td class="c">${s.testAvg!=null ? s.testAvg + '%' : '<span class="fl">–</span>'}</td><td class="c">${s.sraDue ? `${s.sraOn} / ${s.sraDue}${s.sraOn<s.sraDue ? ' <span class="dn">●</span>' : ''}` : '<span class="fl">–</span>'}</td>
    <td class="c">${s.gNow!=null ? `<span class="gr">${letter(s.gNow)}</span> ${ARROW(s.trend)}` : '<span class="fl">–</span>'}</td><td class="c">${spark(s.weeklyG)}</td></tr>`).join('');
  const comment = 'overall' in ed ? ed.overall : draftComment(m);
  const first = [
    headHTML('PROGRESS REPORT', `Monthly · ${range(m.a, m.b)} · issued ${longDate(today())}`) + '<div class="glance">At a glance</div>' + whoHTML(m, true) + figsHTML(m, true) +
    `<div class="sec">Summary by subject</div><table><tr><th>Subject</th><th>Tutor</th><th class="c">Attended</th><th class="c">Topical avg</th><th class="c">SRAs on time</th><th class="c">Grade</th><th class="c">4 weeks</th></tr>${rows}</table>`
  ];
  const flow = [];
  const w = watchHTML(m); if(w) flow.push(w);
  if(comment && comment.trim()) flow.push(`<div class="sec" style="margin-top:18px">Overall comment</div><p class="cmt">${esc(comment)}</p>`);
  flow.push('<p style="font-size:12px;color:#7a8494;margin:14px 0 0">The detailed report follows: SRAs by topic and a section for each subject.</p>');
  // detail
  const detail = [];
  const subsWithSra = m.subjects.filter(s=>Object.keys(s.sraTopics).length);
  if(subsWithSra.length){
    const groups = subsWithSra.map(s=>`<tr class="sh"><td colspan="2">${esc(s.name)}</td></tr>` + Object.entries(s.sraTopics).map(([t,c])=>{
      const bad = c.due - c.on, why = [c.late && `${c.late} late`, c.miss && `${c.miss} not in`].filter(Boolean).join(', ');
      return `<tr><td>${esc(t)}</td><td>${why ? `<span style="color:#b42318;font-size:11px">${why}&nbsp;&nbsp;</span>` : ''}<span class="${bad?'bad':'ok'}">${c.on} / ${c.due}</span></td></tr>`; }).join(''));
    const cols = [[],[],[]]; let h = [0,0,0];
    groups.forEach((g,i)=>{ const n = subsWithSra[i], size = Object.keys(n.sraTopics).length + 1, k = h.indexOf(Math.min(...h)); cols[k].push(g); h[k] += size; });
    detail.push(`<div class="glance" style="margin-bottom:8px">Detailed report</div><div class="sec">Spaced repetition · SRAs handed in on time, by topic</div>
      <div class="srag">${cols.filter(c=>c.length).map(c=>`<div><table><tr><th>Topic</th><th>On time</th></tr>${c.join('')}</table></div>`).join('')}</div>`);
  } else detail.push('<div class="glance" style="margin-bottom:8px">Detailed report</div>');
  m.subjects.forEach((s,i)=>{
    const cm = (ed.cm && ed.cm[s.name]) || (s.comments ? {cs:s.comments.cs, ci:s.comments.ci, cn:s.comments.cn} : null);
    const ul = t => '<ul>' + String(t||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('') + '</ul>';
    const cols = cm && (cm.cs || cm.ci || cm.cn) ? `<div class="cols"><div><h4>Strengths</h4>${ul(cm.cs)}</div><div><h4>To improve</h4>${ul(cm.ci)}</div><div><h4>Next steps</h4>${ul(cm.cn)}</div></div>` : '';
    detail.push(`${i===0 ? '<div class="sec" style="margin-top:20px">Subject reports</div>' : ''}<div class="subj"><h3>${esc(s.name)} <small>${esc([s.code, s.tier].filter(Boolean).join(' · '))}</small>${s.tutor ? `<em>Tutor: <b>${esc(s.tutor)}</b></em>` : ''}</h3>
      ${!s.sessions && !s.sraDue && s.gNow==null ? '<p style="font-size:12.5px;color:#7a8494;margin:6px 0 0">No sessions logged for this period.</p>' : `<div class="sfig"><div><b>${s.sessions ? `${s.attended} / ${s.sessions}` : '–'}</b><small>Attended</small></div><div><b>${s.testAvg!=null ? s.testAvg+'%' : '–'}</b><small>Topical avg${s.tf===2?' · 2-weekly':''}</small></div><div><b>${s.sraDue ? `${s.sraOn} / ${s.sraDue}` : '–'}</b><small>SRAs on time</small></div><div><b>${s.gNow!=null ? `${letter(s.gNow)} ${ARROW(s.trend)}` : '–'}</b><small>Grade</small></div></div>`}
      ${s.topicsCovered.length ? `<div class="tp"><b>Topics this month:</b> ${esc(s.topicsCovered.join(', '))}</div>` : ''}${cols}</div>`);
  });
  return {first, flow, detail};
}
function paginate(m, blocks){
  const stage = F('stage'); stage.innerHTML = '';
  const pages = []; const LIMIT = 1122 - 92;
  const newPage = (firstPage) => {
    const p = document.createElement('div'); p.className = 'rp a4';
    p.innerHTML = (firstPage ? '' : `<div class="mini"><img src="logo.png" alt="LHQ"><span>${esc(m.name)} · Detailed report · ${range(m.a, m.b)} · page ${pages.length+1}</span></div>`) + '<div class="flow"></div>' + REP_FOOT;
    stage.appendChild(p); pages.push(p); return p.querySelector('.flow');
  };
  let box = newPage(true);
  const place = (html, startNew) => {
    if(startNew) box = newPage(false);
    const d = document.createElement('div'); d.innerHTML = html; box.appendChild(d);
    if(box.offsetTop + box.offsetHeight > LIMIT && box.children.length > 1){ box.removeChild(d); box = newPage(false); box.appendChild(d); }
  };
  blocks.first.forEach(h=>place(h));
  blocks.flow.forEach(h=>place(h));
  blocks.detail.forEach((h,i)=>place(h, i===0));
  // strip the "subject reports" heading if it ended up alone at a page bottom: fine as is
  const html = pages.map(p=>p.outerHTML).join('');
  stage.innerHTML = '';
  return html;
}
function reportHTML(m){
  const ed = getEdits(m);
  return state.freq==='m' ? paginate(m, monthlyBlocks(m, ed)) : weeklyHTML(m, ed);
}

/* ---------- preview, editing, sharing ---------- */
let pvModel = null;
function openPreview(m){
  pvModel = m;
  F('pvTitle').textContent = `${m.name} · ${state.freq==='m' ? 'Monthly' : state.freq==='2' ? '2-weekly' : 'Weekly'} report · ${range(m.a, m.b)}`;
  renderEditPanel(); renderPv();
  F('pvDlg').showModal(); requestAnimationFrame(fitPv);
}
function renderEditPanel(){
  const m = pvModel, ed = getEdits(m), monthly = state.freq==='m';
  let h = `<div class="h2">Check before sending</div><p class="hint" style="margin:-4px 0 10px">Changes here are saved for this report only. Clear a box to leave it off the report.</p>`;
  if(monthly){
    h += `<label><span>Overall comment (drafted from the results)</span><textarea id="edOverall" rows="7">${esc('overall' in ed ? ed.overall : draftComment(m))}</textarea></label>
      <button type="button" class="small" id="edRedraft">Redo the draft from the results</button>`;
    m.subjects.forEach((s,i)=>{
      const c = (ed.cm && ed.cm[s.name]) || (s.comments ? s.comments : {});
      h += `<h4>${esc(s.name)}${s.comments ? '' : ' <span class="tag t-amb">no comments from tutor</span>'}</h4>
        <label><span>Strengths (one point per line)</span><textarea rows="2" data-cm="${i}" data-f="cs">${esc(c.cs||'')}</textarea></label>
        <label><span>To improve</span><textarea rows="2" data-cm="${i}" data-f="ci">${esc(c.ci||'')}</textarea></label>
        <label><span>Next steps</span><textarea rows="2" data-cm="${i}" data-f="cn">${esc(c.cn||'')}</textarea></label>`;
    });
  } else {
    m.subjects.forEach((s,i)=>{
      const t = ed.notes && s.name in ed.notes ? ed.notes[s.name] : s.note;
      h += `<label><span>${esc(s.name)} · line from the tutor</span><textarea rows="2" maxlength="160" data-note="${i}">${esc(t||'')}</textarea></label>`;
    });
  }
  F('pvEdit').innerHTML = h;
  let tmr;
  const save = ()=>{
    const e = getEdits(m);
    if(monthly){
      e.overall = F('edOverall').value.trim(); e.cm = e.cm || {};
      document.querySelectorAll('[data-cm]').forEach(x=>{ const s = m.subjects[+x.dataset.cm]; (e.cm[s.name] = e.cm[s.name] || {})[x.dataset.f] = x.value; });
    } else { e.notes = e.notes || {}; document.querySelectorAll('[data-note]').forEach(x=>{ e.notes[m.subjects[+x.dataset.note].name] = x.value.trim(); }); }
    setEdits(m, e); clearTimeout(tmr); tmr = setTimeout(renderPv, 250);
  };
  F('pvEdit').querySelectorAll('textarea').forEach(t=>t.addEventListener('input', save));
  if(F('edRedraft')) F('edRedraft').onclick = ()=>{ F('edOverall').value = draftComment(m); save(); };
}
function renderPv(){ F('pvPages').innerHTML = reportHTML(pvModel); fitPv(); }
function fitPv(){
  const wrap = F('pvWrap'), sc = F('pvScale'), first = F('pvPages').firstElementChild; if(!wrap.clientWidth || !first) return;
  const w = first.offsetWidth, s = Math.min(1, wrap.clientWidth / w);
  sc.style.transform = `scale(${s})`; sc.style.width = w + 'px'; wrap.style.height = (F('pvPages').offsetHeight * s) + 'px';
}
window.addEventListener('resize', ()=>{ if(F('pvDlg').open) fitPv(); });

function fileBase(){ const m = pvModel; return `LHQ ${state.freq==='m' ? 'Progress Report' : state.freq==='2' ? '2-Weekly Report' : 'Weekly Report'}_ ${m.name}_${m.a}`.replace(/[\\/:*?"<>|]/g,''); }
async function stageClone(){
  const stage = F('stage'); stage.innerHTML = `<div>${reportHTML(pvModel)}</div>`;
  const wrap = stage.firstChild;
  if(document.fonts && document.fonts.ready) await document.fonts.ready;
  await Promise.all([...wrap.querySelectorAll('img')].map(i=>i.complete ? 0 : new Promise(r=>{ i.onload = i.onerror = r; })));
  return wrap;
}
async function pageOnePng(){
  const wrap = await stageClone(), el = wrap.firstElementChild, w = el.offsetWidth, h = el.offsetHeight;
  try{
    const canvas = await (await lhqPdf())().set({html2canvas:{scale:3, useCORS:true, backgroundColor:'#ffffff', x:0, y:0, scrollX:0, scrollY:0, width:w, height:h, windowWidth:w, windowHeight:h}}).from(el).toCanvas().get('canvas');
    return await new Promise(r=>canvas.toBlob(r, 'image/png'));
  } finally { F('stage').innerHTML = ''; }
}
async function reportPdf(){
  const wrap = await stageClone(), first = wrap.firstElementChild, w = first.offsetWidth, h = wrap.offsetHeight;
  const monthly = state.freq==='m';
  try{
    return await (await lhqPdf())().set({margin:0, image:{type:'jpeg', quality:0.98},
      html2canvas:{scale:3, useCORS:true, backgroundColor:'#ffffff', x:0, y:0, scrollX:0, scrollY:0, width:w, height:h, windowWidth:w, windowHeight:h},
      jsPDF: monthly ? {unit:'mm', format:'a4', orientation:'portrait'} : {unit:'pt', format:[w*0.75, h*0.75], orientation: h > w ? 'portrait' : 'landscape'},
      pagebreak:{mode:[]}}).from(wrap).outputPdf('blob');
  } finally { F('stage').innerHTML = ''; }
}
function download(blob, name){ const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u), 30000); }
async function shareFiles(files, text){
  if(navigator.canShare && navigator.canShare({files})){
    try{ await navigator.share({files, text}); return true; }catch(e){ if(e && e.name==='AbortError') return true; }
  }
  files.forEach((f,i)=>setTimeout(()=>download(f, f.name), i*900)); toast('Sharing isn\'t available here, so the files were downloaded'); return false;
}
async function busy(btn, fn){ const all = document.querySelectorAll('.dlg-foot button'); all.forEach(b=>b.disabled = true); toast('Preparing…'); try{ await fn(); }catch(e){ console.error(e); toast('Couldn\'t make the file. Check your connection and try again.'); } finally { all.forEach(b=>b.disabled = false); } }
const shareText = () => `${pvModel.name}: ${state.freq==='m' ? 'progress report' : 'weekly report'} for ${range(pvModel.a, pvModel.b)} from LHQ Learning Solutions.`;
F('pvShareImg').onclick = e=>busy(e.currentTarget, async ()=>{ const b = await pageOnePng(); await shareFiles([new File([b], fileBase()+'.png', {type:'image/png'})], shareText()); });
F('pvSharePdf').onclick = e=>busy(e.currentTarget, async ()=>{ const b = await reportPdf(); await shareFiles([new File([b], fileBase()+'.pdf', {type:'application/pdf'})], shareText()); });
F('pvDownload').onclick = e=>busy(e.currentTarget, async ()=>{
  const img = await pageOnePng(); download(img, fileBase()+'.png');
  if(state.freq==='m'){ const pdf = await reportPdf(); setTimeout(()=>download(pdf, fileBase()+'.pdf'), 900); }
  toast(state.freq==='m' ? 'Downloaded the image and the PDF' : 'Downloaded');
});
