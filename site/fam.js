/* LHQ Hub › Families (Mockup 21, agreed 22 Nov): one page per family, parents' details collected by hand (place of work and more),
   every child and their services, children not with LHQ yet, spend, referrals, "Could offer", workplaces and lists of families to talk to.
   Families are found by matching parent phones and emails; admin confirms "Same family?" once. Staff only (synced key lhq_fam; tutors and families never get it).
   Could offer and referral asks only for families who said yes. */
(function(){
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), tday = () => iso(new Date());
  const nk = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const ph = s => String(s || '').replace(/\D/g, '').slice(-9);   // the last 9 digits: 0999 123 456 and +265 999 123 456 match
  const amt = v => +String(v || 0).replace(/[^\d.]/g, '') || 0;
  const M = n => { n = Math.round(+n || 0); return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'm' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n); };
  const first = n => String(n || '').split(' ')[0], last = n => String(n || '').trim().split(' ').slice(-1)[0];
  const toast = m => window.hubToast ? hubToast(m) : alert(m);
  const me = () => { try{ return (hub.session() || {}).me || {}; }catch(e){ return {}; } };
  const isStaff = () => me().role === 'director' || (me().role === 'admin' && (me().perms || []).some(k => k === 'students' || k === 'bdo'));
  const rerender = () => { if(window.hubApply) hubApply(); };
  const $ = id => document.getElementById(id);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const F = () => (window.HD ? HD.store.get('lhq_fam', null) : null) || {fams: {}, no: [], ref: {by: {type: 'pct', v: 10}, nw: {type: 'pct', v: 5}}};
  const save = f => { HD.store.set('lhq_fam', f); rerender(); };
  const fams = () => Object.values(F().fams || {}).filter(x => !x.del);
  const studs = () => window.HD ? HD.students() : [], kids = () => window.PLAN ? PLAN.kids() : [];
  /* each child: a student key "s:…" or an activity child "k:…" or a child not with LHQ "n:…" */
  const memberOf = id => fams().find(f => (f.kids || []).some(k => k.id === id));
  function entities(){ const R = HD.store.get('lhq_students', {}) || {};
    return studs().map(s => ({id: 's:' + s.key, name: s.name, parent: s.parent, phones: [s.phone, (R[s.key] || {}).phone2].map(ph).filter(x => x.length >= 7), email: nk(s.email), year: s.level, school: s.school}))
      .concat(kids().map(k => ({id: 'k:' + k.id, name: k.name, parent: k.parent, phones: [ph(k.phone)].filter(x => x.length >= 7), email: '', year: k.year, school: k.school}))); }
  /* "Same family?" suggestions: the same phone or email, not already together, not marked different */
  function matches(){ const E = entities(), by = {}, no = new Set((F().no || []).map(x => x.slice().sort().join('|')));
    E.forEach(e => e.phones.concat(e.email ? ['@' + e.email] : []).forEach(k => (by[k] = by[k] || []).push(e)));
    const out = [], done = new Set();
    Object.entries(by).forEach(([k, L]) => { if(L.length < 2) return; const ids = [...new Set(L.map(e => e.id))]; if(ids.length < 2) return;
      const fm = ids.map(i => (memberOf(i) || {}).id || ''); if(fm.every(x => x && x === fm[0])) return;
      const key = ids.slice().sort().join('|'); if(no.has(key) || done.has(key)) return; done.add(key);
      out.push({key, why: k[0] === '@' ? 'same email' : 'same parent phone: ' + k.replace(/(\d{3})(\d{3})(\d{3})/, '0$1 $2 $3'), L: ids.map(i => L.find(e => e.id === i))}); });
    return out; }
  /* what each child does, and what it adds up to */
  function childInfo(c){
    if(c.id.startsWith('s:')){ const s = studs().find(x => x.key === c.id.slice(2)) || {}, E = window.ENROL ? ENROL.all().filter(e => e.s.key === s.key) : [], P = window.PROGS ? PROGS() : [];
      const progs = [...new Set(E.map(e => e.prog))].map(p => ({p, n: E.filter(e => e.prog === p).length, name: (P.find(x => x.id === p) || {}).name || p}));
      const paid = E.reduce((a, e) => a + e.paid, 0), act = kids().find(k => nk(k.name) === nk(s.name));
      return {name: s.name || c.name, year: s.level, school: s.school, tags: progs.map(x => `${x.name}${x.n > 1 ? ' · ' + x.n + ' enrolments' : ''}`).concat(act ? [activity(act)] : []), progIds: progs.map(x => x.p), paid, enrol: E.length, ret: E.filter(e => e.kind === 'ret').length, act: !!act, href: '#student/' + encodeURIComponent(s.key || '')}; }
    if(c.id.startsWith('k:')){ const k = kids().find(x => 'k:' + x.id === c.id) || {}; return {name: k.name || c.name, year: k.year, school: k.school, tags: [activity(k)], progIds: [], paid: 0, enrol: 0, ret: 0, act: true, href: '#plan/partner/' + k.partner}; }
    return {name: c.name, year: c.year, school: c.school, tags: [], progIds: [], paid: 0, enrol: 0, ret: 0, act: false, none: true};
  }
  const activity = k => { const p = (window.PLAN ? PLAN.partners() : []).find(x => x.id === k.partner) || {}; return `${((p.acts || []).find(a => a.id === k.act) || {}).name || 'Activity'} · ${p.name || ''}`; };
  function famInfo(f){ const C = (f.kids || []).map(c => Object.assign({c}, childInfo(c)));
    const refs = fams().filter(x => x.refBy === f.id); return {C, paid: C.reduce((a, x) => a + x.paid, 0), enrol: C.reduce((a, x) => a + x.enrol, 0), ret: C.reduce((a, x) => a + x.ret, 0), services: new Set(C.flatMap(x => x.progIds.concat(x.act ? ['act'] : []))).size, refs}; }
  /* what LHQ could offer each child: programmes for their Year they don't do yet, and a partner activity if they have none */
  const yIx = v => { const t = String(v || '').toLowerCase(); if(/reception/.test(t)) return 0; if(/college/.test(t)) return 14; if(/universit/.test(t)) return 15; const m = /(\d{1,2})/.exec(t); return m ? +m[1] : -1; };
  function couldOffer(f){ if(!f.okOffer) return []; const out = [], P = window.PROGS ? PROGS() : [], PA = window.PLAN ? PLAN.partners() : [];
    famInfo(f).C.forEach(x => { const y = yIx(x.year);
      P.filter(p => p.type !== 'activity' && !x.progIds.includes(p.id) && (y < 0 || (yIx(p.from) <= y && y <= yIx(p.to)))).filter(p => !(p.type === 'weekly' && x.progIds.length)).slice(0, 2)
        .forEach(p => out.push({kid: x, t: `${first(x.name)} · ${p.name}`, s: `${p.from} – ${p.to}${p.fee ? ' · MWK ' + M(p.fee) + ' ' + ({month:'a month', course:'a course', place:'a place', session:'a session'}[p.per] || '') : ''}${x.none ? ' · not with LHQ yet' : ''}`, prog: p.id}));
      if(!x.act && PA.length){ const a = PA.flatMap(p => (p.acts || []).map(a => ({p, a})))[0]; if(a) out.push({kid: x, t: `${first(x.name)} · ${a.a.name.split('·')[0].trim()}`, s: `${a.p.name} · no activity yet`, prog: 'part'}); }
    }); return out.slice(0, 8); }
  /* referrals: the referring family's discount is due once the new family has paid; given when it's on an invoice */
  function referralsDue(){ const A = F(), G = A.given || {}, D = window.HD ? HD.load() : [], used = k => G[k] || D.some(d => !d.del && d.refKey === k);
    return fams().filter(f => f.refBy && !used('f:' + f.id) && (A.fams || {})[f.refBy] && famInfo(f).C.some(x => x.paid > 0)).map(f => ({key: 'f:' + f.id, by: A.fams[f.refBy], name: f.name})); }
  /* an enrolled "Referral" enquiry: put the student in a family (their own, or a new one) that remembers who referred them */
  function linkReferral(studentKey, refBy){ if(!studentKey || !refBy) return; const A = F(), have = memberOf('s:' + studentKey);
    if(have){ if(have.refBy) return; A.fams = Object.assign({}, A.fams, {[have.id]: Object.assign({}, A.fams[have.id], {refBy})}); return save(A); }
    const id = newFamily(['s:' + studentKey]), B = F(); B.fams[id] = Object.assign({}, B.fams[id], {refBy}); save(B); }
  function markGiven(key, inv){ const A = F(); A.given = Object.assign({}, A.given, {[key]: {d: tday(), inv: inv || '', by: me().name}}); save(A); }
  const refText = r => r.type === 'amt' ? 'MWK ' + Math.round(+r.v || 0).toLocaleString('en-GB') : (+r.v || 0) + '%';

  /* ---------- pages ---------- */
  let LIST = 'none', Q = '';
  function listPage(){
    const L = fams().map(f => Object.assign({f}, famInfo(f))), m = matches(), t = tday(), term = +t.slice(5, 7) >= 9 ? t.slice(0, 4) + '-09-01' : +t.slice(5, 7) <= 4 ? t.slice(0, 4) + '-01-01' : t.slice(0, 4) + '-05-01';
    const kidsN = L.reduce((a, x) => a + x.C.length, 0), two = L.filter(x => x.services >= 2).length, spend = L.length ? L.reduce((a, x) => a + x.paid, 0) / L.length : 0;
    const LISTS = {none: ['A child not with LHQ yet', x => x.C.some(c => c.none)], tonly: ['Tuition only', x => x.C.some(c => c.progIds.length) && !x.C.some(c => c.act)], aonly: ['Activities only', x => x.C.some(c => c.act) && !x.C.some(c => c.progIds.length)],
      back: ['Haven\'t come back this term', x => x.C.some(c => c.enrol) && !x.C.some(c => c.c.id.startsWith('s:') && (window.ENROL ? ENROL.all().some(e => 's:' + e.s.key === c.c.id && e.d >= term) : false))], refer: ['Can refer colleagues', x => x.f.okRefer], all: ['All families', () => true]};
    const S = L.filter(LISTS[LIST][1]).filter(x => !Q || nk(x.f.name + ' ' + x.C.map(c => c.name).join(' ')).includes(nk(Q)));
    return `<div class="ph"><div class="tt"><h1>Families</h1><p>${L.length} families · ${kidsN} children</p></div><div class="acts"><a class="btn" href="#fams/work">Workplaces</a><button class="btn n" data-famnew>+ Family</button></div></div>
      ${m.length ? `<a class="it fm-match" href="#fams/match"><span class="td-mk am">!</span><span class="t"><b>${m.length} possible famil${m.length === 1 ? 'y' : 'ies'} to confirm</b><small>Same phone or email · admin confirms once</small></span><span class="chev">›</span></a>` : ''}
      <div class="kv3"><div><span>Children a family</span><b>${L.length ? Math.round(kidsN / L.length * 10) / 10 : 0}</b></div><div><span>2+ services</span><b>${two}</b><small>${L.length ? Math.round(two / L.length * 100) : 0}%</small></div><div><span>Spend a family</span><b>${M(spend)}</b><small>all time</small></div></div>
      <div class="r2"><select class="in" id="fmL">${Object.entries(LISTS).map(([k, [l, f]]) => `<option value="${k}" ${LIST === k ? 'selected' : ''}>${esc(l)} · ${L.filter(f).length}</option>`).join('')}</select><input class="in" id="fmQ" placeholder="Search" value="${esc(Q)}"></div>
      <div class="card one" style="margin-top:10px">${S.map(x => `<a class="it" href="#fams/${esc(x.f.id)}"><span class="t"><b>${esc(x.f.name)}</b><small>${x.C.map(c => esc(first(c.name)) + (c.year ? ' · ' + esc(c.year) : '') + (c.none ? ' · not with LHQ' : '')).join(' · ')}</small></span><span class="chev">›</span></a>`).join('') || '<p class="empty">None in this list.</p>'}</div>`;
  }
  function matchPage(){
    const m = matches();
    return `<a class="crumb" href="#fams">‹ Families</a><div class="ph"><div class="tt"><h1>Same family?</h1><p>${m.length} to confirm · the Hub never joins families on its own</p></div></div>` +
      (m.map(x => `<div class="card pad" style="margin-bottom:10px"><p class="note" style="margin:0 0 8px">${esc(x.why)}</p>${x.L.map(e => `<div class="it" style="padding-left:0"><span class="t"><b>${esc(e.name)}</b><small>${e.id.startsWith('s:') ? 'Student' : 'Activity'}${e.year ? ' · ' + esc(e.year) : ''}${e.parent ? ' · parent ' + esc(e.parent) : ''}${memberOf(e.id) ? ' · in ' + esc(memberOf(e.id).name) : ''}</small></span></div>`).join('')}
        <div class="r2" style="margin-top:8px"><button class="btn" data-fmno="${esc(x.key)}">No, different</button><button class="btn n" data-fmyes="${esc(x.key)}">Yes, one family</button></div></div>`).join('') || '<p class="empty">Nothing to confirm. ✓</p>');
  }
  function famPage(id){
    const f = (F().fams || {})[id]; if(!f) return `<a class="crumb" href="#fams">‹ Families</a><p class="empty">Not found.</p>`;
    const I = famInfo(f), O = couldOffer(f), due = referralsDue().filter(r => r.by.id === id), by = f.refBy ? (F().fams || {})[f.refBy] : null, since = (I.C.map(c => (studs().find(s => 's:' + s.key === c.c.id) || {}).first).filter(Boolean).sort()[0] || '');
    return `<a class="crumb" href="#fams">‹ Families</a><div class="ph"><div class="tt"><h1>${esc(f.name)}</h1><p>${since ? 'With LHQ since ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+since.slice(5, 7) - 1] + ' ' + since.slice(0, 4) + ' · ' : ''}${I.C.length} child${I.C.length === 1 ? '' : 'ren'}${f.okOffer ? ' · ✓ happy to hear about other services' : ''}</p></div><div class="acts"><button class="btn" data-fmpar="${esc(id)}">Parents</button></div></div>
      <div class="kv3"><div><span>Spent with LHQ</span><b>${M(I.paid)}</b><small>all time</small></div><div><span>Enrolments</span><b>${I.enrol}</b><small>${I.ret} returning</small></div><div><span>Referred</span><b>${I.refs.length}</b><small>famil${I.refs.length === 1 ? 'y' : 'ies'}</small></div></div>
      ${by ? `<p class="note">Came through a referral from the <a href="#fams/${esc(by.id)}">${esc(by.name)}</a>${f.refGiven ? ' · their discount was given' : ''}.</p>` : ''}
      ${due.length ? `<div class="pl-alert am" style="background:var(--am-bg);border-radius:14px;padding:11px 13px;margin-bottom:12px"><b>Referral discount due</b>${due.map(r => `${refText(F().ref.by)} off their next invoice, for referring the ${esc(r.name)}.`).join(' ')} It's offered on the invoice as a button; nothing changes until it's added.</div>` : ''}
      <div class="h2">Children <button class="btn sm" data-fmkid="${esc(id)}">+ Child</button></div>
      <div class="card one">${I.C.map(x => `<${x.href ? `a href="${x.href}"` : 'div'} class="it"><span class="t"><b>${esc(x.name)}${x.year ? ' · ' + esc(x.year) : ''}</b><small>${esc(x.school || '')}${x.none ? (x.school ? ' · ' : '') + 'not with LHQ yet' : ''}</small><span class="fm-tags">${x.tags.map(t => `<i class="g">${esc(t)}</i>`).join('') || '<i>No service</i>'}</span></span>${x.href ? '<span class="chev">›</span>' : ''}</${x.href ? 'a' : 'div'}>`).join('')}</div>
      <div class="h2">Could offer ${f.okOffer ? '' : '<em>only for families who said yes</em>'}</div>
      ${f.okOffer ? `<div class="card one">${O.map((o, i) => `<div class="it"><span class="t"><b>${esc(o.t)}</b><small>${esc(o.s)}</small></span><button class="btn sm" data-fmoff="${esc(id)}|${i}">Enquiry</button></div>`).join('') || '<p class="empty">Nothing more to offer.</p>'}</div><p class="note">"Enquiry" opens an enquiry for that child, source "A family we teach". Nothing is sent to the family.</p>` : `<p class="note">Ask the family if they'd like to hear about other LHQ services, then switch it on under Parents.</p>`}`;
  }
  function workPage(){
    const W = {}; fams().forEach(f => (f.parents || []).forEach(p => { if(!p.work) return; const k = p.work.trim(); (W[k] = W[k] || {n: 0, refs: 0, F: new Set(), paid: 0}); if(!W[k].F.has(f.id)){ W[k].F.add(f.id); W[k].n++; W[k].paid += famInfo(f).paid; W[k].refs += famInfo(f).refs.length; } }));
    const L = Object.entries(W).sort((a, b) => b[1].n - a[1].n);
    return `<a class="crumb" href="#fams">‹ Families</a><div class="ph"><div class="tt"><h1>Workplaces</h1><p>Where our parents work</p></div></div>
      <div class="card one">${L.map(([w, x]) => `<div class="it"><span class="t"><b>${esc(w)}</b><small>${x.n} famil${x.n === 1 ? 'y' : 'ies'} · ${x.refs} referral${x.refs === 1 ? '' : 's'} · MWK ${M(x.paid)} all time</small></span></div>`).join('') || '<p class="empty">No places of work recorded yet. Add them under a family\'s Parents.</p>'}</div>
      ${L.length && L[0][1].n >= 3 ? `<div class="pl-alert ok" style="background:var(--ok-bg);border-radius:14px;padding:11px 13px"><b>An idea</b>${L[0][1].n} families at ${esc(L[0][0])}: ask one of the parents about a study-skills talk for staff, or a staff rate. It goes in the planner as a partnership.</div>` : ''}
      <p class="note">Never contact an employer without the parent's OK.</p>`;
  }
  function page(a){ if(!isStaff()) return '<p class="empty">Families are for the Director, admin and the BDO.</p>'; if(window.PLAN) PLAN.load(); if(a === 'match') return matchPage(); if(a === 'work') return workPage(); if(a) return famPage(a); return listPage(); }

  /* ---------- sheets ---------- */
  function parentsSheet(id){
    const f0 = (F().fams || {})[id]; if(!f0) return; const f = JSON.parse(JSON.stringify(f0)); f.parents = f.parents && f.parents.length ? f.parents : [{}];
    const keep = () => { f.name = $('fmN').value; f.parents.forEach((p, i) => ['name','phone','email','pref','work','job','area','heard'].forEach(k => { const el = $(`fp_${i}_${k}`); if(el) p[k] = el.value; })); };
    const draw = () => { const R = fams().filter(x => x.id !== id);
      openSheet(`<div class="hx"><h3>Parents</h3><button class="ib" data-close>✕</button></div><label class="f"><span>Family name</span><input class="in" id="fmN" value="${esc(f.name)}"></label>
        ${f.parents.map((p, i) => `<div class="card pad" style="margin-bottom:10px"><div class="r2"><label class="f"><span>Name</span><input class="in" id="fp_${i}_name" value="${esc(p.name || '')}"></label><label class="f"><span>Phone</span><input class="in" id="fp_${i}_phone" value="${esc(p.phone || '')}"></label></div>
          <div class="r2"><label class="f"><span>Email</span><input class="in" id="fp_${i}_email" value="${esc(p.email || '')}"></label><label class="f"><span>Prefers</span><select class="in" id="fp_${i}_pref">${['','WhatsApp','A call','SMS','Email'].map(o => `<option ${p.pref === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
          <div class="r2"><label class="f"><span>Works at (optional)</span><input class="in" id="fp_${i}_work" value="${esc(p.work || '')}"></label><label class="f"><span>Job (optional)</span><input class="in" id="fp_${i}_job" value="${esc(p.job || '')}"></label></div>
          <div class="r2"><label class="f" style="margin:0"><span>Lives in (optional)</span><input class="in" id="fp_${i}_area" value="${esc(p.area || '')}"></label><label class="f" style="margin:0"><span>Heard about LHQ</span><input class="in" id="fp_${i}_heard" value="${esc(p.heard || '')}"></label></div></div>`).join('')}
        ${f.parents.length < 2 ? '<button class="btn sm" data-fpadd>+ Second parent</button>' : ''}
        <div class="h2" style="margin-top:12px">Permissions</div>
        <button type="button" class="it" data-fpok="okOffer" style="width:100%;text-align:left;border:1px solid var(--line);border-radius:12px;margin-bottom:6px"><span class="td-mk ${f.okOffer ? 'ok' : ''}">${f.okOffer ? '✓' : ''}</span><span class="t"><b>Happy to hear about other LHQ services</b><small>${f.okOfferBy ? esc(f.okOfferBy) : 'Ask the family first'}</small></span></button>
        <button type="button" class="it" data-fpok="okRefer" style="width:100%;text-align:left;border:1px solid var(--line);border-radius:12px;margin-bottom:10px"><span class="td-mk ${f.okRefer ? 'ok' : ''}">${f.okRefer ? '✓' : ''}</span><span class="t"><b>Happy to refer colleagues</b><small>for the referral discount</small></span></button>
        <label class="f"><span>Referred by (optional)</span><select class="in" id="fmRef"><option value="">No one</option>${R.map(x => `<option value="${esc(x.id)}" ${f.refBy === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
        <button class="btn n full" id="fmGo">Save</button><p class="note" style="margin-top:8px">Only the Director, admin and the BDO see these. Tutors never do.</p>`);
      const ad = document.querySelector('#sheet [data-fpadd]'); if(ad) ad.onclick = () => { keep(); f.parents.push({}); draw(); };
      document.querySelectorAll('#sheet [data-fpok]').forEach(b => b.onclick = () => { keep(); const k = b.dataset.fpok; f[k] = !f[k]; if(f[k]) f[k + 'By'] = `Said yes · ${tday()} · ${first(me().name)}`; draw(); });
      $('fmGo').onclick = () => { keep(); f.refBy = $('fmRef').value || ''; const all = F(); all.fams = Object.assign({}, all.fams, {[id]: f}); save(all); closeSheet(); toast('Saved'); }; };
    draw();
  }
  function kidSheet(id){
    openSheet(`<div class="hx"><h3>Add a child</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>A student or activity child already in the Hub</span><select class="in" id="fkE"><option value="">Not with LHQ yet</option>${entities().filter(e => !memberOf(e.id)).sort((a, b) => a.name.localeCompare(b.name)).map(e => `<option value="${esc(e.id)}">${esc(e.name)}${e.year ? ' · ' + esc(e.year) : ''}</option>`).join('')}</select></label>
      <div class="r2"><label class="f"><span>Name (not with LHQ)</span><input class="in" id="fkN"></label><label class="f"><span>Year</span><select class="in" id="fkY">${['','Reception','Year 1','Year 2','Year 3','Year 4','Year 5','Year 6','Year 7','Year 8','Year 9','Year 10','Year 11','Year 12','Year 13','College','University'].map(y => `<option>${y}</option>`).join('')}</select></label></div>
      <label class="f"><span>School</span><input class="in" id="fkS"></label><button class="btn n full" id="fkGo">Add</button>`);
    $('fkGo').onclick = () => { const e = $('fkE').value, all = F(), f = JSON.parse(JSON.stringify(all.fams[id]));
      if(e) f.kids = (f.kids || []).concat({id: e}); else { const n = $('fkN').value.trim(); if(!n) return toast('Choose a child or type a name'); f.kids = (f.kids || []).concat({id: uid('n:'), name: n, year: $('fkY').value, school: $('fkS').value, by: me().name}); }
      all.fams = Object.assign({}, all.fams, {[id]: f}); save(all); closeSheet(); toast('Added'); };
  }
  function newFamily(ents){ const all = F(), id = uid('fam'), E = entities(), L = (ents || []).map(i => E.find(e => e.id === i)).filter(Boolean), p = L.find(e => e.parent) || {};
    all.fams = Object.assign({}, all.fams, {[id]: {id, name: (last(p.parent || (L[0] || {}).name) || 'New') + ' family', parents: p.parent ? [{name: p.parent, phone: ((studs().find(s => 's:' + s.key === p.id) || {}).phone) || ((kids().find(k => 'k:' + k.id === p.id) || {}).phone) || ''}] : [{}], kids: L.map(e => ({id: e.id})), at: Date.now(), by: me().name}});
    save(all); return id; }

  /* Settings › Referrals: fixed amount or a percentage, set apart for the family who referred and the new family */
  function refSettings(){ const R = F().ref || {}, row = (k, l, sub) => { const r = R[k] || {}; return `<div class="card pad" style="margin-bottom:10px"><b>${l}</b><p class="note" style="margin:2px 0 8px">${sub}</p><div class="r2"><select class="in" id="rf_${k}_t"><option value="pct" ${r.type !== 'amt' ? 'selected' : ''}>A percentage</option><option value="amt" ${r.type === 'amt' ? 'selected' : ''}>A fixed amount (MWK)</option></select><input class="in" id="rf_${k}_v" inputmode="decimal" value="${esc(r.v == null ? '' : r.v)}"></div></div>`; };
    return `<h2 class="sec-h">Referrals</h2><p class="sec-p">When a family refers another, both can get a discount. Leave a box at 0 for none.</p>
      ${row('by', 'The family who referred', 'Off their next invoice, once the new family\'s first payment is in')}${row('nw', 'The new family', 'Off their first invoice')}
      <button class="btn n" data-rfsave>Save</button><p class="note" style="margin-top:8px">A referral is an LHQ source: no BDO commission. The discount is offered on the invoice with the reason on the line; nothing changes until you add it.</p>`; }
  /* ---------- Today and the invoice ---------- */
  const famJobs = () => { if(!isStaff()) return []; const n = matches().length, d = referralsDue().length; return (n ? [{key: 'fammatch', t: `${n} possible famil${n === 1 ? 'y' : 'ies'} to confirm`, sub: 'same phone or email', href: '#fams/match'}] : []).concat(d ? [{key: 'famref', t: `${d} referral discount${d === 1 ? '' : 's'} due`, sub: 'offered on their next invoice', href: '#fams'}] : []); };
  /* for doc.html: a referral discount this student's family is owed */
  function dueFor(studentName){ const k = nk(studentName), s = studs().find(x => nk(x.name) === k), f = s && fams().find(x => (x.kids || []).some(c => c.id === 's:' + s.key)); if(!f) return null; const r = referralsDue().find(x => x.by.id === f.id); return r ? {fam: f, key: r.key, name: r.name, rule: F().ref.by} : null; }

  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-rfsave],[data-famnew],[data-fmno],[data-fmyes],[data-fmpar],[data-fmkid],[data-fmoff]'); if(!t) return; e.preventDefault(); const d = t.dataset;
    if(t.hasAttribute('data-rfsave')){ const A = F(); A.ref = {by: {type: $('rf_by_t').value, v: amt($('rf_by_v').value)}, nw: {type: $('rf_nw_t').value, v: amt($('rf_nw_v').value)}}; save(A); toast('Saved'); return; }
    if(t.hasAttribute('data-famnew')){ location.hash = '#fams/' + newFamily([]); setTimeout(() => parentsSheet(location.hash.slice(6)), 300); return; }
    if(d.fmno){ const all = F(); all.no = (all.no || []).concat([d.fmno.split('|')]); save(all); toast('Kept apart'); return; }
    if(d.fmyes){ const ids = d.fmyes.split('|'), have = ids.map(memberOf).find(Boolean), all = F();
      if(have){ const f = JSON.parse(JSON.stringify(all.fams[have.id])); ids.forEach(i => { if(!(f.kids || []).some(c => c.id === i)){ const o = memberOf(i); if(o && o.id !== f.id){ all.fams[o.id] = Object.assign({}, all.fams[o.id], {kids: (all.fams[o.id].kids || []).filter(c => c.id !== i)}); } f.kids = (f.kids || []).concat({id: i}); } }); all.fams = Object.assign({}, all.fams, {[f.id]: f}); save(all); }
      else newFamily(ids); toast('One family'); return; }
    if(d.fmpar) return parentsSheet(d.fmpar); if(d.fmkid) return kidSheet(d.fmkid);
    if(d.fmoff){ const [id, i] = d.fmoff.split('|'), f = F().fams[id], o = couldOffer(f)[+i]; if(!o) return;
      hub.api('plan', {method:'POST', body: JSON.stringify({action:'put', key:'lhq_enq', id: uid('en'), rec: {who: ((f.parents || [])[0] || {}).name || f.name, phone: ((f.parents || [])[0] || {}).phone || '', st: o.kid.name, year: o.kid.year || '', school: o.kid.school || '', prog: o.prog, for: o.prog === 'weekly' ? 'tuition' : 'prog', src: 'A family we teach', srcOwner: 'lhq', lock: true, lockBy: me().name, stage: 'new', d: tday(), follow: tday(), fam: id}})})
        .then(() => { toast('Enquiry added'); if(window.PLAN) PLAN.load(true); }).catch(err => toast(err.message)); }
  });
  document.addEventListener('change', e => { if(e.target.id === 'fmL'){ LIST = e.target.value; rerender(); } });
  document.addEventListener('input', e => { if(e.target.id === 'fmQ'){ Q = e.target.value; clearTimeout(window._fmq); window._fmq = setTimeout(() => { rerender(); const q = $('fmQ'); if(q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 300); } });
  const st = document.createElement('style'); st.textContent = `.fm-tags{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.fm-tags i{font-style:normal;font-size:11px;font-weight:800;padding:2px 7px;border-radius:7px;background:var(--bg);border:1px solid var(--line)}.fm-tags i.g{background:var(--ok-bg);color:var(--ok);border-color:transparent}.fm-match{background:var(--am-bg);border-radius:14px;margin-bottom:12px}`; document.head.appendChild(st);
  window.FAMS = {page, famJobs, dueFor, markGiven, linkReferral, matches, referralsDue, F, refText, refSettings};
})();
