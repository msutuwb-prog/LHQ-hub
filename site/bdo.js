/* LHQ Hub › the Business Development Officer (Mockup 18, agreed 22 Nov) and staff payslips.
   Enquiries: New → Contacted → Visit or trial → Ready to enrol → Enrolled, or Lost with a reason. Each source is LHQ's or the BDO's;
   admin confirms it and it's locked (only the Director changes it, with a reason). Commission counts BDO-source enrolments, earned on the first payment.
   Staff pay: salary, allowances, commission and bonus, each switched on by the Director; payslips Prepared → Approved → Received. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), tday = () => iso(new Date());
  const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const addD = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], MOL = ['January','February','March','April','May','June','July','August','September','October','November','December'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const nice = s => { const d = parse(s); return `${WD[d.getDay()]} ${d.getDate()} ${MO[d.getMonth()]}`; };
  const first = n => String(n || '').split(' ')[0];
  const MW = n => Math.round(+n || 0).toLocaleString('en-GB');
  const pc = (a, b) => b ? Math.round(a / b * 100) : 0;
  const toast = m => window.hubToast ? hubToast(m) : alert(m);
  const me = () => { try{ return (hub.session() || {}).me || {}; }catch(e){ return {}; } };
  const isDir = () => me().role === 'director', isStaff = () => ['director','admin'].includes(me().role), perms = () => me().perms || [];
  const isBdo = () => perms().includes('bdo'), mayPay = () => isDir() || perms().includes('tpay');
  const rerender = () => { if(window.hubApply) hubApply(); };
  const $ = id => document.getElementById(id);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const P = () => window.PLAN ? PLAN.data() : null;
  const enqs = () => Object.values((P() && P().enq) || {}).filter(e => !e.del);
  const put = async (key, id, rec, extra) => { try{ await hub.api('plan', {method:'POST', body: JSON.stringify(Object.assign({action:'put', key, id, rec}, extra || {}))}); await PLAN.load(true); return true; }catch(e){ toast(e.message); return false; } };

  /* ---------- enquiries ---------- */
  const STG = [['new','New'],['contacted','Contacted'],['visit','Visit or trial'],['ready','Ready to enrol'],['enrolled','Enrolled'],['lost','Lost']];
  const STL = Object.fromEntries(STG);
  const SRC = {lhq: ['Facebook','Billboard','Website','Walk-in','A family we teach','Referral','Other'], bdo: ['BDO school visit','BDO partner','BDO event','BDO contact']};
  const LOST = ['Fees','Timing','Chose another','No reply','Other'];
  let EF = 'open';
  const isOpen = e => !['enrolled','lost'].includes(e.stage);
  const late = e => isOpen(e) && ((e.follow && e.follow < tday()) || (!e.follow && e.stage === 'new' && e.d && e.d <= addD(tday(), -3)));
  function enqPage(){
    if(window.PLAN) PLAN.load(); if(!isStaff()) return '';
    const L = enqs().sort((a, b) => (b.d || '').localeCompare(a.d || '')), ym = tday().slice(0, 7), M = L.filter(e => (e.d || '').startsWith(ym));
    const F = {open: L.filter(isOpen).filter(e => e.stage !== 'ready'), ready: L.filter(e => e.stage === 'ready'), enrolled: L.filter(e => e.stage === 'enrolled'), lost: L.filter(e => e.stage === 'lost'), all: L}[EF] || L;
    const row = e => `<button class="it bd-row" data-enq="${esc(e.id)}"><span class="td-mk ${late(e) ? 'am' : e.stage === 'enrolled' ? 'ok' : ''}">${late(e) ? '!' : e.stage === 'enrolled' ? '✓' : ''}</span><span class="t"><b>${esc(e.who)}${e.year ? ' · ' + esc(e.year) : ''}</b><small>${esc(e.subj || e.for || '')} · ${STL[e.stage] || 'New'}${late(e) ? ` ${e.follow ? '· follow-up was ' + nice(e.follow) : '· ' + Math.round((parse(tday()) - parse(e.d)) / 864e5) + ' days'}` : e.follow && isOpen(e) ? ' · follow up ' + nice(e.follow) : ''} · <span class="bd-src ${e.srcOwner === 'bdo' ? 'b' : ''}">${e.srcOwner === 'bdo' ? 'BDO' : 'LHQ'}</span> ${esc(String(e.src || '').replace(/^BDO /, ''))}${e.lock ? ' 🔒' : ''}</small></span><span class="chev">›</span></button>`;
    return `<div class="ph"><div class="tt"><h1>Enquiries</h1><p>${MOL[+ym.slice(5) - 1]} · ${M.length} · ${M.filter(e => e.srcOwner === 'bdo').length} from the BDO</p></div><div class="acts"><button class="btn n" data-enqnew>+ New enquiry</button></div></div>
      <div class="chips">${[['open','Open'],['ready','Ready to enrol'],['enrolled','Enrolled'],['lost','Lost'],['all','All']].map(([k, l]) => `<button class="chip ${EF === k ? 'on' : ''}" data-enqf="${k}">${l} <i>${({open: L.filter(isOpen).filter(e => e.stage !== 'ready'), ready: L.filter(e => e.stage === 'ready'), enrolled: L.filter(e => e.stage === 'enrolled'), lost: L.filter(e => e.stage === 'lost'), all: L})[k].length}</i></button>`).join('')}</div>
      <div class="card one">${F.map(row).join('') || `<p class="empty">${P() ? 'Nothing here.' : 'Loading…'}</p>`}</div>
      <p class="note">Source: LHQ (marketing, walk-ins, families we teach) or BDO (their visits, partners, events, contacts). Admin confirms it, then it's locked 🔒.</p>`;
  }
  function enqSheet(id){
    const e = id ? enqs().find(x => x.id === id) : null, st = e ? JSON.parse(JSON.stringify(e)) : {who:'', phone:'', for:'tuition', year:'', school:'', subj:'', src:'', srcOwner:'', stage:'new', follow: addD(tday(), 2), notes:'', d: tday()};
    const admin = isDir() || (me().role === 'admin' && !isBdo()), locked = e && e.lock, students = window.HD ? HD.students().slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
    const keep = () => { const rf = $('eq_ref'); if(rf) st.refBy = rf.value; const lo = $('eq_lost'); if(lo) st.lost = lo.value; ['who','phone','year','school','subj','follow','notes','lostWhy','why'].forEach(k => { const el = $('eq_' + k); if(el) st[k] = el.value; }); const f = $('eq_for'); if(f){ st.prog = f.value; const p = window.PROGS ? PROGS().find(x => x.id === f.value) : null; st.for = p ? ({weekly:'tuition', short:'prog', exam:'exam', activity:'activity'}[p.type] || 'tuition') : 'tuition'; } };
    const draw = () => { openSheet(`<div class="hx"><h3>${e ? esc(e.who) : 'New enquiry'}</h3><button class="ib" data-close>✕</button></div>
      ${e ? `<div class="bd-stg">${STG.slice(0, 5).map(([k]) => `<span class="${STG.findIndex(x => x[0] === st.stage) >= STG.findIndex(x => x[0] === k) && st.stage !== 'lost' ? 'on' : ''}"></span>`).join('')}</div><label class="f"><span>Stage</span><select class="in" id="eq_stage">${STG.map(([k, l]) => `<option value="${k}" ${st.stage === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      <div class="r2"><label class="f"><span>Parent or student</span><input class="in" id="eq_who" value="${esc(st.who)}"></label><label class="f"><span>Phone</span><input class="in" id="eq_phone" value="${esc(st.phone)}"></label></div>
      <label class="f"><span>For</span><select class="in" id="eq_for">${(window.PROGS ? PROGS() : [{id:'weekly', name:'Weekly tuition'}]).map(p => `<option value="${esc(p.id)}" ${(st.prog || (st.for === 'tuition' ? 'weekly' : '')) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <div class="r2"><label class="f"><span>Year</span><select class="in" id="eq_year"><option value="">Choose…</option>${[...new Set((typeof settingsKV === 'function' ? String(settingsKV().levels || '').split('\n') : []).map(x => x.trim()).filter(Boolean).concat(st.year ? [st.year] : []))].map(y => `<option ${st.year === y ? 'selected' : ''}>${esc(y)}</option>`).join('')}</select></label><label class="f"><span>School</span><input class="in" id="eq_school" list="eq_schools" value="${esc(st.school)}"><datalist id="eq_schools">${[...new Set((window.HD ? HD.students() : []).map(x => x.school).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('')}</datalist></label></div>
      <label class="f"><span>Subjects</span><input class="in" id="eq_subj" value="${esc(st.subj)}" placeholder="Maths, Physics"></label>
      <div class="f"><span>Where from ${locked ? '🔒' : ''}</span>${locked && !isDir() ? `<p class="note" style="margin:4px 0 0">${st.srcOwner === 'bdo' ? 'BDO' : 'LHQ'} · ${esc(st.src)} · confirmed by ${esc(e.lockBy || 'admin')}</p>` : `
        <select class="in" id="eq_src" style="margin-top:4px"><option value="">Choose…</option><optgroup label="LHQ">${SRC.lhq.map(s => `<option value="lhq|${s}" ${st.src === s ? 'selected' : ''}>${s}</option>`).join('')}</optgroup><optgroup label="BDO · counts for commission">${SRC.bdo.map(s => `<option value="bdo|${s}" ${st.src === s ? 'selected' : ''}>${s}</option>`).join('')}</optgroup></select>
        ${st.src === 'Referral' && window.FAMS ? `<select class="in" id="eq_ref" style="margin-top:6px"><option value="">Which family referred them?</option>${Object.values(FAMS.F().fams || {}).filter(f => !f.del).sort((a, b) => a.name.localeCompare(b.name)).map(f => `<option value="${esc(f.id)}" ${st.refBy === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select>` : ''}
        <p class="note" style="margin:4px 0 0">A referral is an LHQ source: no BDO commission.</p>${locked && isDir() ? '<label class="f" style="margin-top:6px"><span>Why it changes (needed)</span><input class="in" id="eq_why"></label>' : ''}`}</div>
      ${st.stage === 'lost' ? `<label class="f"><span>Why lost</span><select class="in" id="eq_lost"><option value="">Choose…</option>${LOST.map(l => `<option ${st.lost === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      ${st.stage === 'enrolled' ? `<label class="f"><span>The student</span><select class="in" id="eq_stu"><option value="">Choose…</option>${students.map(s => `<option value="${esc(s.key)}" ${st.student === s.key ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
      ${isOpen(st) ? `<label class="f"><span>Follow up</span><input class="in" type="date" id="eq_follow" value="${esc(st.follow || '')}"></label>` : ''}
      <label class="f"><span>Notes</span><textarea class="in" id="eq_notes" rows="2">${esc(st.notes)}</textarea></label>
      <button class="btn n full" id="eqGo">${e ? 'Save' : 'Save enquiry'}</button>
      ${admin && !locked && st.src ? '<button class="btn full" id="eqLock" style="margin-top:8px">Confirm the source 🔒</button>' : ''}`);
      const on = (sel, f) => document.querySelectorAll('#sheet ' + sel).forEach(b => b.onclick = () => { keep(); f(b); draw(); });
      on('[data-eqs]', b => { st.stage = b.dataset.eqs; }); on('[data-eqfor]', b => st.for = b.dataset.eqfor); on('[data-eqsrc]', b => { const [o, s] = b.dataset.eqsrc.split('|'); st.srcOwner = o; st.src = s; }); on('[data-eqlost]', b => st.lost = b.dataset.eqlost);
      const sg = $('eq_stage'); if(sg) sg.onchange = () => { keep(); st.stage = sg.value; draw(); };
      const sr = $('eq_src'); if(sr) sr.onchange = () => { keep(); const [o, x] = sr.value.split('|'); st.srcOwner = o || ''; st.src = x || ''; draw(); };
      const save = async lock => { keep(); if($('eq_stu')) st.student = $('eq_stu').value; if(!st.who.trim()) return toast('Who is it?'); if(!st.src) return toast('Where did they hear about LHQ?'); if(st.stage === 'lost' && !st.lost) return toast('Why was it lost?'); if(st.src === 'Referral' && !st.refBy) return toast('Which family referred them?');
        if(st.stage === 'enrolled' && !st.student) return toast('Choose the student');
        if(st.stage === 'enrolled' && !(e && e.enrolledD)) st.enrolledD = tday();
        const why = st.why; delete st.why; if(lock){ st.lock = true; st.lockBy = me().name; }
        if(!e && admin && !isBdo()) { st.lock = true; st.lockBy = me().name; }
        if(await put('lhq_enq', e ? e.id : uid('en'), st, {why})){ if(st.stage === 'enrolled' && st.src === 'Referral' && window.FAMS) FAMS.linkReferral(st.student, st.refBy); closeSheet(); toast(st.stage === 'ready' && !(e && e.stage === 'ready') ? 'Sent to admin to enrol' : 'Saved'); } };
      $('eqGo').onclick = () => save(false); if($('eqLock')) $('eqLock').onclick = () => save(true); };
    draw();
  }
  /* jobs for Today: follow-ups due; for admin, enquiries ready to enrol and sources to confirm */
  function enqJobs(){
    if(!isStaff()) return []; if(window.PLAN) PLAN.load(); if(!P()) return [{key:'enqfu', hold:true}, {key:'enqready', hold:true}, {key:'enqsrc', hold:true}];
    const L = enqs(), t = tday(), out = [], mine = L.filter(e => isOpen(e) && e.follow && e.follow <= t && (e.by === me().id || (isBdo() && e.srcOwner === 'bdo')));
    if(mine.length) out.push({key:'enqfu', t:`Follow up ${mine.length} enquir${mine.length === 1 ? 'y' : 'ies'}`, sub: mine.slice(0, 3).map(e => first(e.who)).join(', '), href:'#enq'});
    if(me().role === 'admin' && !isBdo() || isDir()){ const R = L.filter(e => e.stage === 'ready'); if(R.length) out.push({key:'enqready', t:`${R.length} ready to enrol`, sub: R.slice(0, 3).map(e => esc(e.st || e.who)).join(', '), href:'#enq'});
      const U = L.filter(e => !e.lock && e.src); if(U.length && !isDir()) out.push({key:'enqsrc', t:`Confirm ${U.length} enquiry source${U.length === 1 ? '' : 's'}`, sub:'so the BDO\'s commission is right', href:'#enq'}); }
    return out;
  }

  /* ---------- the BDO's scorecard: their part of the plan, month by month ---------- */
  const DEFT = {enq: 8, enrolPct: 40, partners: 2, kids: 44, toTuition: 15, visits: 4};
  function scoreFor(ym){
    const L = enqs(), M = L.filter(e => (e.d || '').startsWith(ym)), B = M.filter(e => e.srcOwner === 'bdo'), Bin = L.filter(e => e.srcOwner === 'bdo' && (e.d || '') >= addD(ym + '-01', -60) && (e.d || '') <= ym + '-31');
    const PA = window.PLAN ? PLAN.partners() : [], K = window.PLAN ? PLAN.kids() : [], SC = window.PLAN ? PLAN.schools() : [];
    return {enq: B.length, enrolPct: pc(Bin.filter(e => e.stage === 'enrolled').length, Bin.length), partners: PA.filter(p => (p.since || '').slice(0, 7) >= addD(ym + '-01', -90).slice(0, 7) && (p.since || '') <= ym + '-31').length, kids: K.length, toTuition: pc(K.filter(k => k.moved).length, K.length), visits: SC.reduce((a, s) => a + (s.log || []).filter(l => (l.d || '').startsWith(ym) && l.kind === 'visit').length, 0)};
  }
  function scorePage(){
    if(window.PLAN) PLAN.load(); const ym = tday().slice(0, 7), A = scoreFor(ym), T = Object.assign({}, DEFT, ((((P() || {}).plan || {}).conf || {}).bdoT) || {}), C = commissionFor(bdoPerson(), ym);
    const L = [['enq','Enquiries from you','a month'],['enrolPct','Your enquiries that enrolled','%'],['partners','New partners','in 3 months'],['kids','Children in activities',''],['toTuition','Activity → tuition','%'],['visits','School visits','a month']];
    return `<div class="ph"><div class="tt"><h1>Scorecard</h1><p>${MOL[+ym.slice(5) - 1]} · from the plan</p></div>${isDir() ? '<div class="acts"><button class="btn" data-bdtgt>Targets</button></div>' : ''}</div>
      <div class="card one">${L.map(([k, l, u]) => { const ok = A[k] >= T[k], near = A[k] >= T[k] * 0.9; return `<div class="it"><span class="td-mk ${ok ? 'ok' : near ? '' : 'am'}">${ok ? '✓' : near ? '' : '!'}</span><span class="t"><b>${l}</b><small>plan ${T[k]}${u === '%' ? '%' : u ? ' ' + u : ''}</small></span><b class="${ok ? '' : 'bd-am'}">${A[k]}${u === '%' ? '%' : ''}</b></div>`; }).join('')}</div>
      <div class="h2">Commission <em>${C.on ? 'on' : 'off until the Director switches it on'}</em></div>
      <div class="card one"><div class="it"><span class="t"><b>${C.all.length} enrolment${C.all.length === 1 ? '' : 's'} from your sources</b><small>${C.paid.length} paid · ${C.all.length - C.paid.length} waiting for the first payment</small></span>${C.on ? `<b>MWK ${MW(C.amt)}</b>` : ''}</div>${C.paid.map(x => `<div class="it"><span class="t"><b>${esc(x.name)}</b><small>${esc(x.kind)} · paid ${nice(x.paidD)}</small></span>${C.on ? `<span>${MW(x.amt)}</span>` : ''}</div>`).join('')}</div>`;
  }
  const bdoPerson = () => isBdo() ? me().id : ((((P() || {}).people) || []).find(p => (p.perms || []).includes('bdo')) || {}).id;
  /* commission for a month: BDO-source enquiries now enrolled, earned on the student's first payment in that month */
  function commissionFor(pid, ym){
    const cfg = ((SP && SP.cfg) || {})[pid] || {}, c = cfg.comm || {}, R = c.rates || {}, docs = window.HD ? HD.load() : [];
    const firstPay = key => docs.filter(x => x.type === 'receipt' && !x.del && nk(x.student) === key && +String(x.received || 0).replace(/[^\d.]/g, '') > 0).map(x => x.date).sort()[0];
    const all = enqs().filter(e => e.srcOwner === 'bdo' && e.stage === 'enrolled' && e.student), out = [];
    all.forEach(e => { const fp = firstPay(e.student); if(!fp || !fp.startsWith(ym)) return; if(c.from && fp < c.from) return;
      const kind = e.kid ? 'activity → tuition' : e.for === 'prog' || e.for === 'exam' ? 'Fast Track, Marathon or exam prep' : 'weekly tuition', amt = e.kid ? +R.kid || 0 : e.for === 'prog' || e.for === 'exam' ? +R.prog || 0 : +R.tuition || 0;
      if(c.take4){ const s = (window.HD ? HD.students() : []).find(x => x.key === e.student); if(s && !(s.cur && (!s.cur.inv.periodEnd || s.cur.inv.periodEnd >= addD(fp, 28))) && addD(fp, 28) <= tday()) return; }
      out.push({name: (window.HD ? (HD.students().find(x => x.key === e.student) || {}).name : '') || e.who, kind, amt, paidD: fp, src: e.src}); });
    return {on: !!c.on, all: all.filter(e => !c.from || true), paid: out, amt: out.reduce((a, x) => a + x.amt, 0)};
  }
  function bonusFor(pid, ym){ const cfg = ((SP && SP.cfg) || {})[pid] || {}, b = cfg.bonus || {}, A = scoreFor(ym); return {on: !!b.on, items: (b.items || []).filter(x => x.on).map(x => ({label: x.label, target: x.target, got: A[x.k] || 0, ok: (A[x.k] || 0) >= x.target, amt: (A[x.k] || 0) >= x.target ? +x.amt || 0 : 0}))}; }

  /* ---------- BDO weekly report ---------- */
  const WF = {meet:'', close:'', needs:''};
  function weekPage(){
    if(window.PLAN) PLAN.load(); const t = tday(), w = (() => { const d = parse(t); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); })();
    const E = enqs().filter(e => (e.d || '') >= w), K = window.PLAN ? PLAN.kids().filter(k => (k.moved || '') >= w) : [];
    return `<div class="ph"><div class="tt"><h1>Weekly report</h1><p>${nice(w)} – ${nice(addD(w, 6))}</p></div></div>
      <div class="h2">Filled by the Hub</div><div class="card one"><div class="it"><span class="t"><b>Enquiries</b><small>${E.filter(e => e.srcOwner === 'bdo').length} yours · ${E.filter(e => e.srcOwner !== 'bdo').length} LHQ</small></span><b>${E.length}</b></div>
        <div class="it"><span class="t"><b>Enrolled</b><small>${E.filter(e => e.stage === 'enrolled' && e.srcOwner === 'bdo').length} yours</small></span><b>${E.filter(e => e.stage === 'enrolled').length}</b></div><div class="it"><span class="t"><b>Activity → tuition</b></span><b>${K.length}</b></div>
        <div class="it"><span class="t"><b>Lost</b><small>${[...new Set(E.filter(e => e.stage === 'lost').map(e => (e.lost || '').toLowerCase()))].join(' · ')}</small></span><b>${E.filter(e => e.stage === 'lost').length}</b></div></div>
      <div class="card pad"><label class="f"><span>Meetings held</span><textarea class="in" id="bw_meet" rows="2">${esc(WF.meet)}</textarea></label><label class="f"><span>Close to signing</span><textarea class="in" id="bw_close" rows="2">${esc(WF.close)}</textarea></label><label class="f" style="margin:0"><span>Needs the Director</span><textarea class="in" id="bw_needs" rows="2">${esc(WF.needs)}</textarea></label></div>
      <button class="btn n full" id="bwGo" style="margin-top:12px">Send</button>`;
  }

  /* ---------- school contact logs (kept with the partners, kind "school") ---------- */
  function schoolLog(name){
    const id = 'sch-' + nk(name).replace(/[^a-z0-9]+/g, '-').slice(0, 40), cur = (window.PLAN ? PLAN.schools() : []).find(p => p.id === id) || {kind:'school', name, log: []};
    openSheet(`<div class="hx"><h3>${esc(name)}</h3><button class="ib" data-close>✕</button></div><div class="card one" style="margin-bottom:12px">${(cur.log || []).slice().reverse().map(l => `<div class="it"><span class="t"><b>${nice(l.d)} · ${esc(l.kind)}</b><small>${esc(l.t)}</small></span></div>`).join('') || '<p class="empty">No contact yet.</p>'}</div>
      <div class="chips">${['visit','call','meeting','message'].map((k, i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-sck="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><label class="f"><span>What happened</span><textarea class="in" id="sc_t" rows="2"></textarea></label><button class="btn n full" id="scGo">Add</button>`);
    let kind = 'visit'; document.querySelectorAll('#sheet [data-sck]').forEach(b => b.onclick = () => { kind = b.dataset.sck; document.querySelectorAll('#sheet [data-sck]').forEach(x => x.classList.toggle('on', x === b)); });
    $('scGo').onclick = async () => { const t = $('sc_t').value.trim(); if(!t) return toast('Say what happened'); const r = JSON.parse(JSON.stringify(cur)); r.log = (r.log || []).concat({d: tday(), kind, t, by: me().name}).slice(-200); if(await put('lhq_partners', id, r)){ closeSheet(); toast('Added'); } };
  }

  /* ---------- the BDO's Home: their cards, follow-ups, partner money due ---------- */
  function homeBlock(){
    if(!isBdo() || !window.PLAN) return ''; PLAN.load(); const ym = tday().slice(0, 7), E = enqs().filter(e => (e.d || '').startsWith(ym)), K = PLAN.kids(), PA = PLAN.partners().filter(p => p.kind !== 'school');
    return `<div class="bd-kv"><a href="#enq"><span>Enquiries · ${MO[+ym.slice(5) - 1]}</span><b>${E.length}</b><small>${E.filter(e => e.srcOwner === 'bdo').length} yours</small></a><a href="#enq"><span>Enrolled</span><b>${E.filter(e => e.stage === 'enrolled').length}</b><small>${pc(E.filter(e => e.stage === 'enrolled').length, E.length)}%</small></a><a href="#plan/partners"><span>Partner children</span><b>${K.length}</b><small>${PA.length} partner${PA.length === 1 ? '' : 's'}</small></a></div>
      <div class="card one" style="margin-bottom:14px"><a class="it" href="#enq"><span class="t"><b>Enquiries</b><small>New, follow-ups, ready to enrol</small></span><span class="chev">›</span></a><a class="it" href="#plan/partners"><span class="t"><b>Partners</b></span><span class="chev">›</span></a><a class="it" href="#plan/schools"><span class="t"><b>Schools</b><small>Students, partner children, visits</small></span><span class="chev">›</span></a><a class="it" href="#score"><span class="t"><b>Scorecard</b></span><span class="chev">›</span></a><a class="it" href="#bweek"><span class="t"><b>Weekly report</b></span><span class="chev">›</span></a></div>`;
  }
  /* Needs attention for the BDO: contracts renewing within a month */
  function bdoAttention(){ if(!isBdo() && !isDir() || !window.PLAN) return []; const t = tday(); return PLAN.partners().filter(p => p.renew && p.renew >= t && p.renew <= addD(t, 31)).map(p => ({t: `${p.name} contract renews`, sub: nice(p.renew), href: '#plan/partner/' + p.id})); }

  /* ---------- staff pay ---------- */
  let SP = null, spAt = 0;
  async function loadSp(force){ if(!isStaff() || (!force && SP && Date.now() - spAt < 60000)) return; try{ SP = await hub.api('spay'); spAt = Date.now(); rerender(); }catch(e){} }
  const ST = {prepared:'Prepared · to approve', confirmed:'Approved · to receive', signed:'Received'};
  function slipLines(pid, ym){
    const cfg = ((SP && SP.cfg) || {})[pid] || {}, L = [{k:'sal', t:'Salary', s:'', amt: +cfg.salary || 0}];
    (cfg.allow || []).forEach(a => L.push({k:'alw', t:a.name, s:'allowance', amt: +a.amt || 0}));
    const C = commissionFor(pid, ym); if(C.on){ const by = {}; C.paid.forEach(x => (by[x.kind] = by[x.kind] || []).push(x)); Object.entries(by).forEach(([k, X]) => L.push({k:'com', t:`Commission · ${X.length} ${k}`, s: X.map(x => `${x.name} paid ${nice(x.paidD)}`).join(' · '), amt: X.reduce((a, x) => a + x.amt, 0)})); }
    const B = bonusFor(pid, ym); if(B.on) B.items.forEach(x => L.push({k:'bon', t:`Bonus · ${x.label} ${x.got} of ${x.target}${x.ok ? ' ✓' : ''}`, s: x.ok ? '' : 'not reached', amt: x.amt}));
    return L;
  }
  let SPM = '';
  function spayPage(){
    loadSp(); if(!mayPay()) return myPay();
    const ym = SPM || tday().slice(0, 7), Pp = (SP && SP.people) || [], prev = iso(new Date(+ym.slice(0, 4), +ym.slice(5) - 2, 1)).slice(0, 7), next = iso(new Date(+ym.slice(0, 4), +ym.slice(5), 1)).slice(0, 7);
    const row = p => { const s = ((SP && SP.slips) || {})[p.id + '|' + ym], c = ((SP && SP.cfg) || {})[p.id], tot = s ? s.snap.total : slipLines(p.id, ym).reduce((a, l) => a + l.amt, 0);
      return `<a class="it" href="#spay/${esc(p.id)}"><span class="td-mk ${s && s.st === 'signed' ? 'ok' : ''}">${s && s.st === 'signed' ? '✓' : ''}</span><span class="t"><b>${esc(p.name)}</b><small>${!c ? 'Pay not set yet' : s ? ST[s.st] : 'Draft'}${c && c.comm && c.comm.on ? ' · commission on' : ''}${c && c.bonus && c.bonus.on ? ' · bonus on' : ''}</small></span><b>${c ? 'MWK ' + MW(tot) : ''}</b><span class="chev">›</span></a>`; };
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>Staff payslips</h1><p>${MOL[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</p></div></div>
      <div class="cal-nav"><button class="btn sm" data-spm="${prev}">‹</button><b>${MOL[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</b><button class="btn sm" data-spm="${next}">›</button></div>
      <div class="card one">${Pp.map(row).join('') || `<p class="empty">${SP ? 'No staff yet.' : 'Loading…'}</p>`}</div><p class="note">Tutors' payslips stay in Tutor pay.</p>`;
  }
  function spayPerson(pid){
    loadSp(); const p = ((SP && SP.people) || []).find(x => x.id === pid); if(!p) return `<a class="crumb" href="#spay">‹ Staff payslips</a><p class="empty">${SP ? 'Not found.' : 'Loading…'}</p>`;
    const ym = SPM || tday().slice(0, 7), s = ((SP && SP.slips) || {})[pid + '|' + ym], c = ((SP && SP.cfg) || {})[pid] || {}, L = s ? s.snap.lines : slipLines(pid, ym), tot = L.reduce((a, l) => a + l.amt, 0), self = pid === me().id;
    const steps = `<div class="card one"><div class="it"><span class="td-mk ${s ? 'ok' : ''}">${s ? '✓' : ''}</span><span class="t"><b>Prepared</b><small>${s ? esc(s.by) + ' · ' + nice(iso(new Date(s.at))) : ''}</small></span></div><div class="it"><span class="td-mk ${s && s.st !== 'prepared' ? 'ok' : ''}">${s && s.st !== 'prepared' ? '✓' : ''}</span><span class="t"><b>Approved by the Director</b></span></div><div class="it"><span class="td-mk ${s && s.st === 'signed' ? 'ok' : ''}">${s && s.st === 'signed' ? '✓' : ''}</span><span class="t"><b>Received</b></span></div></div>`;
    return `<a class="crumb" href="#spay">‹ Staff payslips</a><div class="ph"><div class="tt"><h1>${MOL[+ym.slice(5) - 1]} ${ym.slice(0, 4)}</h1><p>${esc(p.name)} · ${s ? ST[s.st] : 'Draft'}${c.prob && c.prob >= tday() ? ' · probation until ' + nice(c.prob) : ''}</p></div>${isDir() ? `<div class="acts"><a class="btn" href="#spayset/${esc(pid)}">Pay settings</a></div>` : ''}</div>
      <div class="card pad"><table class="bd-pay">${L.map(l => `<tr><td>${esc(l.t)}${l.s ? `<small>${esc(l.s)}</small>` : ''}</td><td>${MW(l.amt)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${MW(tot)}</b></td></tr></table></div>${steps}
      ${!c.salary && !s ? `<p class="note">${isDir() ? 'Set the pay first.' : 'The Director sets the pay first.'}</p>` : !s ? (self && !isDir() ? '<p class="note">Someone else prepares your own payslip.</p>' : `<button class="btn n full" data-spprep="${esc(pid)}">${isDir() ? 'Approve payslip' : 'Prepare · send to the Director'}</button>`) : s.st === 'prepared' && isDir() ? `<div class="r2"><button class="btn" data-spreopen="${esc(pid)}">Reopen</button><button class="btn n" data-spok="${esc(pid)}">Approve payslip</button></div>` : s.st === 'confirmed' && isDir() ? `<button class="btn full" data-spreopen="${esc(pid)}">Reopen</button>` : ''}
      <p class="note" style="margin-top:8px">Every commission line names the student and the date they paid.</p>`;
  }
  function paySettings(pid){
    loadSp(); if(!isDir()) return ''; const p = ((SP && SP.people) || []).find(x => x.id === pid); if(!p) return `<p class="empty">${SP ? 'Not found.' : 'Loading…'}</p>`;
    const c = JSON.parse(JSON.stringify(((SP.cfg || {})[pid]) || {salary: 0, allow: [], comm: {on: false, rates: {tuition: 25000, prog: 15000, kid: 10000}, take4: false}, bonus: {on: false, items: [{k:'partners', label:'New partners', target: 2, amt: 50000, on: true}, {k:'enq', label:'Enquiries a month', target: 20, amt: 30000, on: true}, {k:'toTuition', label:'Activity → tuition %', target: 15, amt: 30000, on: false}]}}));
    SET[pid] = SET[pid] || c; const s = SET[pid], sw = (k, on) => `<button class="lp-sw${on ? ' on' : ''}" data-spsw="${k}" role="switch" aria-checked="${!!on}"></button>`;
    return `<a class="crumb" href="#spay/${esc(pid)}">‹ Payslip</a><div class="ph"><div class="tt"><h1>Pay · ${esc(first(p.name))}</h1><p>${(p.perms || []).includes('bdo') ? 'BDO' : 'Staff'} · full-time</p></div></div>
      <div class="card pad"><div class="r2"><label class="f"><span>Salary a month (MWK)</span><input class="in" data-spv="salary" inputmode="numeric" value="${s.salary || ''}"></label><label class="f"><span>Probation ends</span><input class="in" type="date" data-spv="prob" value="${esc(s.prob || '')}"></label></div>
        ${(s.allow || []).map((a, i) => `<div class="r2"><input class="in" data-spa="${i}|name" value="${esc(a.name)}" placeholder="Allowance"><input class="in" data-spa="${i}|amt" inputmode="numeric" value="${a.amt || ''}" placeholder="MWK"></div>`).join('')}<button class="btn sm" data-spaadd>+ Allowance</button></div>
      <div class="h2">Commission</div><div class="card one"><div class="it"><span class="t"><b>Commission</b><small>${s.comm.on ? 'on' : 'off'}${s.prob ? ' · reminder on ' + nice(s.prob) : ''}</small></span>${sw('comm', s.comm.on)}</div>
        ${[['tuition','Weekly tuition','per enrolment'],['prog','Fast Track, Marathon or exam prep',''],['kid','Activity child → tuition','']].map(([k, l, sub]) => `<div class="it"><span class="t"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span><input class="in bd-num" data-spr="${k}" inputmode="numeric" value="${s.comm.rates[k] || ''}"></div>`).join('')}
        <div class="it"><span class="t"><b>Earned when</b><small>the first payment comes in · BDO sources only</small></span><span>✓</span></div><div class="it"><span class="t"><b>Take back if they leave within 4 weeks</b></span>${sw('take4', s.comm.take4)}</div></div>
      <div class="h2">Bonus · you pick the measures</div><div class="card one"><div class="it"><span class="t"><b>Bonus</b><small>${s.bonus.on ? 'on' : 'off'}</small></span>${sw('bonus', s.bonus.on)}</div>
        ${s.bonus.items.map((x, i) => `<div class="it" style="flex-wrap:wrap"><span class="t"><b>${esc(x.label)}</b><small>target <input class="in bd-num" data-spb="${i}|target" value="${x.target}"> · MWK <input class="in bd-num" data-spb="${i}|amt" value="${x.amt}"></small></span>${sw('b' + i, x.on)}</div>`).join('')}</div>
      <button class="btn n full" data-spsave="${esc(pid)}">Save</button><p class="note" style="margin-top:8px">Every change is recorded in Activity.</p>`;
  }
  const SET = {};
  function myPay(){
    loadSp(); const S = Object.entries((SP && SP.slips) || {}).filter(([k]) => k.startsWith(me().id + '|')).sort((a, b) => b[0].localeCompare(a[0]));
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>My payslips</h1></div></div><div class="card one">${S.map(([k, s]) => { const m = k.split('|')[1]; return `<div class="it" style="flex-wrap:wrap"><span class="t"><b>${MOL[+m.slice(5) - 1]} ${m.slice(0, 4)}</b><small>${ST[s.st]}</small></span><b>MWK ${MW(s.snap.total)}</b>${s.st === 'confirmed' ? `<button class="btn sm n" data-spsign="${esc(m)}">✓ I've received it</button>` : ''}<table class="bd-pay" style="flex-basis:100%;margin-top:6px">${s.snap.lines.map(l => `<tr><td>${esc(l.t)}${l.s ? `<small>${esc(l.s)}</small>` : ''}</td><td>${MW(l.amt)}</td></tr>`).join('')}</table></div>`; }).join('') || `<p class="empty">${SP ? 'No payslips yet.' : 'Loading…'}</p>`}</div>`;
  }
  /* the Director's reminder on a probation end date */
  function probAttention(){ if(!isDir() || !SP) return []; const t = tday(); return Object.entries(SP.cfg || {}).filter(([, c]) => c.prob && c.prob <= t && c.prob >= addD(t, -14) && !((c.comm || {}).on && (c.bonus || {}).on)).map(([pid, c]) => ({t: `${first(((SP.people || []).find(p => p.id === pid) || {}).name)}'s probation ends ${c.prob === t ? 'today' : nice(c.prob)}`, sub: 'turn on commission or bonus?', href: '#spayset/' + pid})); }

  /* ---------- events ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest && e.target.closest('[data-enq],[data-enqnew],[data-enqf],[data-bdtgt],#bwGo,[data-schlog],[data-spm],[data-spprep],[data-spok],[data-spreopen],[data-spsign],[data-spsw],[data-spaadd],[data-spsave]'); if(!t) return; e.preventDefault(); const d = t.dataset;
    if(d.enq) return enqSheet(d.enq); if(t.hasAttribute('data-enqnew')){ if(window.PLAN && !PLAN.data()) PLAN.load(true); return enqSheet(null); }
    if(d.enqf){ EF = d.enqf; return rerender(); }
    if(d.schlog) return schoolLog(d.schlog);
    if(t.hasAttribute('data-bdtgt')){ const C = JSON.parse(JSON.stringify(((P() || {}).plan || {}).conf || {})), T = Object.assign({}, DEFT, C.bdoT || {});
      openSheet(`<div class="hx"><h3>BDO targets</h3><button class="ib" data-close>✕</button></div>${Object.entries({enq:'Enquiries a month', enrolPct:'Enrolled (%)', partners:'New partners in 3 months', kids:'Children in activities', toTuition:'Activity → tuition (%)', visits:'School visits a month'}).map(([k, l]) => `<label class="f"><span>${l}</span><input class="in" data-bt="${k}" inputmode="numeric" value="${T[k]}"></label>`).join('')}<button class="btn n full" id="btGo">Save</button>`);
      $('btGo').onclick = async () => { document.querySelectorAll('#sheet [data-bt]').forEach(el => T[el.dataset.bt] = +el.value || 0); C.bdoT = T; if(await put('lhq_bplan', 'conf', C)){ closeSheet(); toast('Saved'); } }; return; }
    if(t.id === 'bwGo'){ ['meet','close','needs'].forEach(k => WF[k] = $('bw_' + k).value); const ym = tday().slice(0, 7);
      try{ await hub.api('reps', {method:'POST', body: JSON.stringify(Object.assign({kind:'b', hub: scoreFor(ym)}, WF))}); toast('Report sent'); Object.keys(WF).forEach(k => WF[k] = ''); rerender(); }catch(err){ toast(err.message); } return; }
    if(d.spm){ SPM = d.spm; return rerender(); }
    const ym = SPM || tday().slice(0, 7), call = async (action, pid, extra) => { try{ await hub.api('spay', {method:'POST', body: JSON.stringify(Object.assign({action, pid, m: ym}, extra || {}))}); await loadSp(true); return true; }catch(err){ toast(err.message); return false; } };
    if(d.spprep){ const p = (SP.people || []).find(x => x.id === d.spprep); if(await call('prepare', d.spprep, {snap: {name: p.name, lines: slipLines(d.spprep, ym)}})) toast(isDir() ? 'Approved' : 'Sent to the Director'); return; }
    if(d.spok){ if(await call('approve', d.spok)) toast('Approved'); return; }
    if(d.spreopen){ if(await call('reopen', d.spreopen)) toast('Reopened'); return; }
    if(d.spsign){ try{ await hub.api('spay', {method:'POST', body: JSON.stringify({action:'sign', pid: me().id, m: d.spsign})}); await loadSp(true); toast('Thank you'); }catch(err){ toast(err.message); } return; }
    const pid = (location.hash.match(/^#spayset\/(.+)$/) || [])[1], s = SET[pid]; if(!s) return;
    keepSet(pid);
    if(d.spsw){ const k = d.spsw; if(k === 'comm') s.comm.on = !s.comm.on; else if(k === 'take4') s.comm.take4 = !s.comm.take4; else if(k === 'bonus') s.bonus.on = !s.bonus.on; else s.bonus.items[+k.slice(1)].on = !s.bonus.items[+k.slice(1)].on;
      if(k === 'comm' && s.comm.on && !s.comm.from) s.comm.from = tday(); if(k === 'bonus' && s.bonus.on && !s.bonus.from) s.bonus.from = tday(); return rerender(); }
    if(t.hasAttribute('data-spaadd')){ s.allow = (s.allow || []).concat({name:'', amt: 0}); return rerender(); }
    if(d.spsave){ try{ await hub.api('spay', {method:'POST', body: JSON.stringify({action:'cfg', pid, cfg: s})}); delete SET[pid]; await loadSp(true); toast('Saved'); }catch(err){ toast(err.message); } }
  });
  function keepSet(pid){ const s = SET[pid]; if(!s) return;
    document.querySelectorAll('[data-spv]').forEach(el => s[el.dataset.spv] = el.dataset.spv === 'prob' ? el.value : +String(el.value).replace(/[^\d]/g, '') || 0);
    document.querySelectorAll('[data-spa]').forEach(el => { const [i, f] = el.dataset.spa.split('|'); if(s.allow[+i]) s.allow[+i][f] = f === 'amt' ? +String(el.value).replace(/[^\d]/g, '') || 0 : el.value; });
    document.querySelectorAll('[data-spr]').forEach(el => s.comm.rates[el.dataset.spr] = +String(el.value).replace(/[^\d]/g, '') || 0);
    document.querySelectorAll('[data-spb]').forEach(el => { const [i, f] = el.dataset.spb.split('|'); s.bonus.items[+i][f] = +el.value || 0; }); }

  const css = `.bd-row{width:100%;background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left;cursor:pointer}.card.one>.bd-row:first-child{border-top:0}
    .bd-src{font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:6px;background:var(--bg);border:1px solid var(--line)}.bd-src.b{background:var(--accent);color:var(--onaccent);border-color:var(--accent)}
    .bd-stg{display:flex;gap:4px;margin:0 0 10px}.bd-stg span{flex:1;height:6px;border-radius:9px;background:var(--line)}.bd-stg span.on{background:var(--accent)}
    .bd-am{color:var(--am)}.bd-num{width:96px!important;padding:5px 8px!important;display:inline-block}
    .bd-pay{width:100%;border-collapse:collapse}.bd-pay td{padding:7px 2px;border-top:1px solid var(--line);font-size:14px;vertical-align:top}.bd-pay tr:first-child td{border-top:0}.bd-pay td:last-child{text-align:right;font-weight:800;white-space:nowrap}.bd-pay small{display:block;color:var(--muted);font-size:12px}
    .bd-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}.bd-kv a{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-decoration:none;color:var(--ink);min-width:0}.bd-kv span{display:block;font-size:12px;color:var(--muted);font-weight:700}.bd-kv b{font-size:22px}.bd-kv small{display:block;font-size:12px;color:var(--muted)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  window.BDO = {enqPage, enqJobs, scorePage, weekPage, homeBlock, bdoAttention, spayPage, spayPerson, paySettings, myPay, probAttention, loadSp, schoolLog, isBdo};
})();
