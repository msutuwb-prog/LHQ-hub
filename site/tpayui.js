/* LHQ Hub › Tutor pay pages: #pay (the month), #pay/<tutor>/<YYYY-MM> (a payslip), Settings › Tutor pay, the tutor's My pay (#teach/pay).
   Every figure opens the sessions or entries behind it. The payslip prints on A4 in the documents' design. */
window.TPAYUI = (function(){
  const P = () => window.TPAY;
  const may = () => isDir() || can('tpay');
  const n = v => Math.round(v || 0).toLocaleString('en-US');
  const mk = n => (n < 0 ? '− ' : '') + 'MKW ' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const ctx = () => ({cards: saved.filter(d => typeOf(d) === 'card'), entries: Object.values(((store.get('lhq_logs', {e: {}}) || {}).e) || {}),
    classes: (v => Array.isArray(v) ? v : Object.values(v || {}))(store.get('lhq_classes', [])), pay: store.get('lhq_pay', {}) || {}, t: HD.today()});
  const ym = d => d.slice(0, 7), addM = (m, n) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const enc = encodeURIComponent, dec = s => { try{ return decodeURIComponent(s); }catch(e){ return s; } };
  let last = {};   // what the sheets show
  const post = async body => { try{ const r = await hub.api('pay', {method: 'POST', body: JSON.stringify(body)}); if(window.hub && hub.pull) await hub.pull(); return r; }catch(e){ toast(e.message || 'Couldn\'t save'); return null; } };
  const ST = {draft: ['', 'Draft'], confirmed: ['bl', 'Confirmed · to sign'], signed: ['ok', 'Signed']};
  const mark = st => `<span class="tp-mk ${ST[st][0]}">${st === 'signed' ? '✓' : ''}</span>`;
  const CSS = `.tp-mk{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);flex:none;display:grid;place-items:center;font-weight:900;font-size:13px;color:#fff}.tp-mk.ok{background:var(--ok);border-color:var(--ok)}.tp-mk.bl{border-color:var(--accent)}.tp-mk.am{border-color:var(--am);background:var(--am-bg);color:var(--am)}
.tp-big{font-size:28px;font-weight:800;color:var(--brand);font-variant-numeric:tabular-nums;cursor:pointer}.tp-mn{display:flex;align-items:center;justify-content:space-between;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px 8px;margin-bottom:12px}.tp-mn a{font-size:18px;font-weight:800;color:var(--brand);width:34px;text-align:center;text-decoration:none}.tp-mn b{font-size:14px}
.tp-cap{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:12px 14px 2px}
.tp-ln{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;border-top:1px solid var(--line2);font-size:14px;align-items:baseline;cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;color:var(--ink);font:inherit}.tp-ln:hover{background:var(--hover)}
.tp-ln span small{display:block;color:var(--muted);font-size:12px}.tp-ln b{white-space:nowrap;font-variant-numeric:tabular-nums}.tp-ln b::after{content:' ›';color:var(--muted)}.tp-ln.no b{color:var(--rd)}.tp-ln.hold b{color:var(--am)}.tp-ln.sub2 b{color:var(--muted);font-weight:700}
.tp-tot{display:flex;justify-content:space-between;padding:11px 14px;background:var(--surface2);border-top:1px solid var(--line2);font-weight:800}.tp-tot b{font-size:17px;color:var(--brand)}
.tp-bar{height:8px;border-radius:5px;background:var(--line2);margin:2px 14px 4px;overflow:hidden}.tp-bar i{display:block;height:100%;background:var(--accent)}
.tp-adds{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px;border-top:1px solid var(--line2)}
.tp-dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:9px 14px;border-top:1px solid var(--line2);font-size:13.5px}.tp-dl:first-child{border-top:0}.tp-dl small{grid-column:1/-1;color:var(--muted);font-size:12px}.tp-dl b{white-space:nowrap}
.tp-rr{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--line2)}.tp-rr:first-of-type{border-top:0}.tp-rr span{flex:1;font-size:14px}.tp-rr span small{display:block;color:var(--muted);font-size:12px}.tp-rr input{width:120px;text-align:right}`;
  let cssOn = false; const css = () => { if(cssOn) return ''; cssOn = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); return ''; };
  const stOf = x => x.slip ? x.slip.st : 'draft';

  /* ---------- the month ---------- */
  function list(m){
    const C = ctx(), T = P().tutors(C), X = T.map(t => P().shown(C, t, m)).filter(x => x.lines.length || x.slip);
    const tot = X.reduce((a, x) => a + x.total, 0), conf = X.filter(x => stOf(x) !== 'draft').length, sig = X.filter(x => stOf(x) === 'signed').length;
    last.list = X;
    return css() + `<div class="ph"><div class="tt"><h1>Pay</h1><p>From the tutors' session logs</p></div>${isDir() ? '<div class="acts"><a class="btn" href="#set/tpay">Settings</a></div>' : ''}</div>
      <div class="tp-mn"><a href="#pay/m/${addM(m, -1)}" aria-label="Month before">‹</a><b>${P().ml(m)}</b><a href="#pay/m/${addM(m, 1)}" aria-label="Month after">›</a></div>
      <div class="card pad"><span class="note">To pay</span><div class="tp-big" data-tpd="all">${mk(tot)}</div><div class="kv"><div><span>Tutors</span><b>${X.length}</b></div><div><span>Confirmed</span><b>${conf} of ${X.length}</b></div><div><span>Signed</span><b>${sig}</b></div></div></div>
      <div class="card">${X.map(x => `<a class="it" href="#pay/${enc(x.tutor)}/${m}">${x.held && stOf(x) === 'draft' ? '<span class="tp-mk am">!</span>' : mark(stOf(x))}<span class="t"><b>${esc(x.tutor)}</b><small>${x.place === 'full' ? 'Full-time' : x.place === 'mixed' ? 'Changed placement' : x.place === 'unset' ? 'Placement not set · part-time' : 'Part-time'} · ${x.paid} sessions · ${ST[stOf(x)][1]}${x.held ? ` · ${x.held} held` : ''}${x.slip && x.slip.q ? ' · queried' : ''}</small></span><b>${mk(x.total)}</b><span class="chev">›</span></a>`).join('') || '<p class="empty">No sessions logged this month.</p>'}</div>
      ${X.some(x => stOf(x) === 'draft') ? '<button class="btn full" data-tpall>Confirm all drafts</button>' : ''}`;
  }

  /* ---------- a payslip ---------- */
  const GROUPS = [['salary', ''], ['cap', 'Sessions · up to the cap'], ['top', 'On top'], ['not', 'Not paid'], ['held', ''], ['other', 'Added by LHQ']];
  function slip(tutor, m){
    const C = ctx(), x = P().shown(C, tutor, m), st = stOf(x), draft = st === 'draft', R = x.R, pl = P().placeNow(C.pay, tutor, C.t);
    last.slip = x;
    const line = l => l.grp === 'capline' ? `<div class="tp-bar"><i style="width:${l.cap ? Math.min(100, l.sum / l.cap * 100) : 0}%"></i></div><button class="tp-ln ${l.amt < 0 ? 'no' : 'sub2'}" data-tpl="${esc(l.id)}"><span>${l.amt < 0 ? 'Over the cap' : esc(l.label)}${l.amt < 0 ? `<small>${n(l.sum)} of ${n(l.cap)}</small>` : ''}</span><b>${l.amt < 0 ? mk(l.amt) : esc(l.sub)}</b></button>`
      : `<button class="tp-ln ${l.grp === 'not' ? 'no' : l.grp === 'held' ? 'hold' : ''}" data-tpl="${esc(l.id)}"><span>${esc(l.label)}<small>${esc(l.sub)}</small></span><b>${l.grp === 'held' ? mk(l.owed || 0) : l.amt === 0 && l.grp === 'not' ? 'MKW 0' : mk(l.amt)}</b></button>`;
    const body = GROUPS.map(([g, cap]) => { const L = x.lines.filter(l => l.grp === g || (g === 'cap' && l.grp === 'capline')); return L.length ? (cap ? `<div class="tp-cap">${cap}</div>` : '') + L.map(line).join('') : ''; }).join('');
    return css() + `<a class="crumb" href="#pay/m/${m}">‹ Pay</a><div class="ph"><div class="tt"><h1>${esc(tutor)}</h1><p>${x.place === 'full' ? 'Full-time' : x.place === 'mixed' ? 'Changed placement' : 'Part-time'} · ${x.label} · ${ST[st][1].toLowerCase()}</p></div><div class="acts"><button class="btn" data-tppdf>PDF</button></div></div>
      ${x.slip && x.slip.q ? `<div class="card pad" style="border-left:3px solid var(--am)"><b>${esc(tutor.split(' ')[0])} says something's wrong</b><p class="note" style="margin:4px 0 0">"${esc(x.slip.q.note)}"</p></div>` : ''}
      ${x.place === 'unset' && draft ? `<div class="card pad" style="border-left:3px solid var(--am)"><b>Placement not set</b><p class="note" style="margin:4px 0 0">Worked out as part-time.</p></div>` : ''}
      <div class="card">${body || '<p class="empty">No sessions logged this month.</p>'}
        ${draft && may() ? `<div class="tp-adds"><button class="btn sm" data-tpadd="allowance">+ Allowance</button>${isDir() ? '<button class="btn sm" data-tpadd="bonus">+ Bonus</button>' : ''}<button class="btn sm" data-tpadd="deduction">+ Deduction</button><button class="btn sm" data-tpadd="advance">+ Advance</button></div>` : ''}
        <div class="tp-tot" data-tpd="paid" style="cursor:pointer"><span>To pay<small style="display:block;font-weight:600;color:var(--muted);font-size:12px">${x.paid} sessions paid${x.notPaid ? ` · ${x.notPaid} not paid` : ''}${x.held ? ` · ${x.held} held` : ''}</small></span><b>${mk(x.total)}</b></div></div>
      ${x.slip ? `<p class="note">Confirmed by ${esc(x.slip.by)} · ${P().dl(new Date(x.slip.at).toISOString().slice(0, 10))}${x.slip.sAt ? ` · signed by ${esc(tutor.split(' ')[0])} · ${P().dl(new Date(x.slip.sAt).toISOString().slice(0, 10))}` : ''}</p>` : ''}
      ${draft && may() ? '<button class="btn n full" data-tpconf>Confirm payslip</button>' : ''}${st === 'confirmed' && isDir() ? '<button class="btn full" data-tpreopen style="margin-top:8px">Reopen</button>' : ''}
      ${isDir() ? `<div class="h2">Placement</div><div class="card"><a class="it" data-tpplace><span class="t"><b>${pl === 'full' ? 'Full-time' : 'Part-time'}</b><small>${(((C.pay.place || {})[P().nk(tutor)] || []).map(z => `${z.p === 'full' ? 'Full-time' : 'Part-time'} from ${P().dl(z.from)}`).join(' · ')) || 'Not set'}</small></span><span class="chev">›</span></a></div>` : ''}`;
  }
  function drill(id){
    const x = last.slip; if(!x) return; const l = x.lines.find(y => y.id === id); if(!l) return;
    openSheet(`<div class="hx"><h3>${esc(l.label)}</h3><button class="ib" data-close>✕</button></div><p class="sp">${esc(l.sub)}</p>
      <div class="card">${(l.rows || []).map(r => `<div class="tp-dl"><span>${esc(r.t)}</span><b>${esc(r.v)}</b>${r.s ? `<small>${esc(r.s)}</small>` : ''}</div>`).join('') || '<p class="empty">Nothing here.</p>'}
      <div class="tp-tot"><span>${l.grp === 'held' ? 'Owed once settled' : 'Total'}</span><b>${l.grp === 'held' ? mk(l.owed || 0) : mk(l.amt)}</b></div></div>
      ${l.item && stOf(x) === 'draft' && may() ? `<button class="btn rd full" data-tpunitem="${esc(l.item)}" style="margin-top:10px">Remove</button>` : ''}`);
    const u = document.querySelector('[data-tpunitem]'); if(u) u.onclick = async () => { if(await post({action: 'unitem', tutor: x.tutor, m: x.m, id: u.dataset.tpunitem})){ closeSheet(); toast('Removed'); render(); } };
  }
  function drillAll(){
    const X = last.list || []; openSheet(`<div class="hx"><h3>To pay</h3><button class="ib" data-close>✕</button></div><div class="card">${X.map(x => `<div class="tp-dl"><span>${esc(x.tutor)}</span><b>${mk(x.total)}</b><small>${ST[stOf(x)][1]} · ${x.paid} sessions</small></div>`).join('')}<div class="tp-tot"><span>Total</span><b>${mk(X.reduce((a, x) => a + x.total, 0))}</b></div></div>`);
  }
  function drillPaid(){
    const x = last.slip; if(!x) return; const L = x.lines.filter(l => ['salary', 'cap', 'top'].includes(l.grp));
    openSheet(`<div class="hx"><h3>${x.paid} sessions paid</h3><button class="ib" data-close>✕</button></div><p class="sp">Each session is in one line only.</p><div class="card">${L.map(l => `<div class="tp-dl"><span>${esc(l.label)}</span><b>${(l.rows || []).filter(r => r.s && /\d{2}:\d{2}|\?–/.test(r.s)).length || '–'}</b></div>`).join('')}${x.notPaid ? `<div class="tp-dl"><span>Not paid</span><b>${x.notPaid}</b></div>` : ''}${x.held ? `<div class="tp-dl"><span>Held</span><b>${x.held}</b></div>` : ''}</div>`);
  }
  function addItem(kind){
    const x = last.slip, L = {allowance: 'Allowance', bonus: 'Bonus', deduction: 'Deduction', advance: 'Advance'};
    openSheet(`<div class="hx"><h3>${L[kind]} · ${esc(x.tutor.split(' ')[0])}</h3><button class="ib" data-close>✕</button></div>
      <label class="f"><span>What for</span><input class="in" id="tpiL" placeholder="${kind === 'advance' ? 'Advance' : kind === 'allowance' ? 'e.g. Transport · Marathon Saturday' : ''}"></label>
      <label class="f"><span>Amount (MKW)</span><input class="in" id="tpiA" inputmode="numeric"></label>
      <label class="f"><span>Date</span><input class="in" type="date" id="tpiD" value="${HD.today()}"></label>
      <label class="f"><span>Note (optional)</span><input class="in" id="tpiN"></label>
      <button class="btn n full" id="tpiGo">Add</button>`);
    $('tpiGo').onclick = async () => { const r = await post({action: 'item', tutor: x.tutor, m: x.m, kind, label: $('tpiL').value || L[kind], amt: $('tpiA').value, d: $('tpiD').value, note: $('tpiN').value}); if(r){ closeSheet(); toast(L[kind] + ' added'); render(); } };
  }
  function place(tutor){
    openSheet(`<div class="hx"><h3>Placement · ${esc(tutor.split(' ')[0])}</h3><button class="ib" data-close>✕</button></div>
      <div class="seg" style="display:flex;margin-bottom:12px"><button style="flex:1" data-tpp="part" class="on">Part-time</button><button style="flex:1" data-tpp="full">Full-time</button></div>
      <label class="f"><span>From</span><input class="in" type="date" id="tppD" value="${HD.today().slice(0, 8)}01"></label><p class="note">A change mid-month splits the month by days.</p>
      <button class="btn n full" id="tppGo" style="margin-top:10px">Save</button>`);
    let p = 'part'; document.querySelectorAll('[data-tpp]').forEach(b => b.onclick = () => { p = b.dataset.tpp; document.querySelectorAll('[data-tpp]').forEach(y => y.classList.toggle('on', y === b)); });
    $('tppGo').onclick = async () => { if(await post({action: 'place', tutor, p, from: $('tppD').value})){ closeSheet(); toast('Saved'); render(); } };
  }

  /* ---------- the A4 payslip ---------- */
  function paperHTML(x){
    const L = x.lines.filter(l => l.amt !== 0 || l.grp === 'salary'), np = x.lines.filter(l => l.grp === 'not' && !l.amt);
    return `<div class="fd"><div class="fd-hd"><img src="logo.png" alt="LHQ Learning Solutions"><div class="fd-ttl"><b>PAYSLIP</b><span>${esc(x.label)}</span></div></div><div class="fd-rule"></div>
      <div class="fd-who"><div><span>Tutor</span><b>${esc(x.tutor)}</b></div><div><span>Placement</span><b>${x.place === 'full' ? 'Full-time' : x.place === 'mixed' ? 'Changed in the month' : 'Part-time'}</b></div><div><span>Sessions paid</span><b>${x.paid}${x.notPaid ? ` · ${x.notPaid} not paid` : ''}${x.held ? ` · ${x.held} held` : ''}</b></div></div>
      <h3>Pay</h3><table class="fd-t"><tr><th>Item</th><th>Detail</th><th class="r">Amount</th></tr>${L.map(l => `<tr><td>${esc(l.label)}</td><td>${esc(l.sub)}</td><td class="r">${mk(l.amt)}</td></tr>`).join('')}</table>
      <div class="fd-tot"><div><small>Sessions paid</small><b>${x.paid}</b></div><div><small>Not paid</small><b>${x.notPaid}</b></div><div class="due"><small>To pay</small><b>${mk(x.total)}</b></div></div>
      ${np.length ? `<h3>Not paid</h3><p class="fd-n" style="color:#1d2433">${np.map(l => `${esc(l.label)}: ${esc(l.sub)}`).join(' · ')}</p>` : ''}
      <h3>Sessions</h3><table class="fd-t"><tr><th>Line</th><th>Session</th><th class="r">Amount</th></tr>${x.lines.filter(l => ['cap', 'top', 'not', 'held'].includes(l.grp)).flatMap(l => (l.rows || []).filter(r => /\d{2}:\d{2}|\?–/.test(r.s || '')).map(r => `<tr><td>${esc(l.label)}</td><td>${esc(r.t)} · ${esc(r.s)}</td><td class="r">${esc(r.v)}</td></tr>`)).join('')}</table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:26px"><div style="border-top:1px solid #1d2433;padding-top:6px;font-size:11px;color:#6b7385"><b style="display:block;color:#1d2433;font-size:12px">${x.slip ? esc(x.slip.by) : ''}</b>${x.slip ? 'Confirmed ' + P().dl(new Date(x.slip.at).toISOString().slice(0, 10)) : 'Not confirmed yet'}</div>
        <div style="border-top:1px solid #1d2433;padding-top:6px;font-size:11px;color:#6b7385"><b style="display:block;color:#1d2433;font-size:12px">${esc(x.tutor)}</b>${x.slip && x.slip.sAt ? 'Signed in LHQ Hub ' + P().dl(new Date(x.slip.sAt).toISOString().slice(0, 10)) : 'Signature'}</div></div>
      <div class="fd-ft">LHQ Learning Solutions · Area 47, Sector 4, Lilongwe · worked out from the session logs in LHQ Hub</div></div>`;
  }
  async function pdf(x){ if(!window.FDOC) return; toast('Preparing the PDF…'); try{ await FDOC.pdf(paperHTML(x), `LHQ Payslip_ ${x.tutor}_ ${x.m}`); toast('PDF downloaded'); }catch(e){ console.error(e); toast('Couldn\'t make the PDF'); } }

  /* ---------- Settings › Tutor pay ---------- */
  function settings(){
    if(!isDir()) return '<p class="empty">Director only.</p>';
    const R = P().rules(store.get('lhq_pay', {})), row = (k, a, b) => `<div class="tp-rr"><span>${a}${b ? `<small>${b}</small>` : ''}</span><input class="in" data-tpr="${k}" value="${esc(R[k])}" ${k === 'after' ? 'type="time"' : 'inputmode="numeric"'}></div>`;
    return css() + `<h2 class="sec-h">Tutor pay</h2><p class="sec-p">Director only.</p>
      <div class="h2">Part-time</div><div class="card">${row('inp', 'In person', 'per session')}${row('onl', 'Online', 'per session')}${row('cap', 'Monthly cap', 'normal sessions')}${row('after', 'After hours from', 'after-hours and weekend sessions are paid on top')}</div>
      <div class="h2">Full-time</div><div class="card">${row('salary', 'Salary', 'a month')}${row('transport', 'Transport', 'each weekend day taught')}${row('lunch', 'Lunch', 'a long weekend day')}${row('lunchH', 'Lunch from', 'hours taught that day')}${row('overtime', 'Overtime', 'each weekday session after hours')}</div>
      <div class="h2">Sessions</div><div class="card">${row('lenTerm', 'Session length', 'term to term and programmes, minutes')}${row('lenHol', 'Holiday session length', 'minutes')}${row('grace', 'Grace', 'late start or early finish not charged, minutes')}</div>
      <div class="h2">Programme rates <em>a class whose name includes it</em></div><div class="card" id="tpProgs">${(R.progs || []).map((x, i) => `<div class="tp-rr"><input class="in" data-tpg="${i}:name" value="${esc(x.name)}" style="flex:1;width:auto;text-align:left"><input class="in" data-tpg="${i}:rate" value="${esc(x.rate)}" inputmode="numeric"></div>`).join('')}
        <a class="it" data-tpgadd><span class="t"><b style="color:var(--accent)">+ Programme rate</b></span></a></div>
      <button class="btn n" id="tpSave">Save</button>`;
  }
  let progDraft = null;
  function bindSettings(){
    const R = P().rules(store.get('lhq_pay', {})); progDraft = progDraft || (R.progs || []).map(x => Object.assign({}, x));
    document.querySelectorAll('[data-tpg]').forEach(el => el.oninput = () => { const [i, k] = el.dataset.tpg.split(':'); progDraft[+i][k] = el.value; });
    const ad = document.querySelector('[data-tpgadd]'); if(ad) ad.onclick = () => { progDraft.push({name: '', rate: ''}); const box = $('tpProgs'); const i = progDraft.length - 1; ad.insertAdjacentHTML('beforebegin', `<div class="tp-rr"><input class="in" data-tpg="${i}:name" placeholder="e.g. IGCSE Marathon" style="flex:1;width:auto;text-align:left"><input class="in" data-tpg="${i}:rate" inputmode="numeric" placeholder="10000"></div>`); bindSettings(); };
    if($('tpSave')) $('tpSave').onclick = async () => { const rules = {}; document.querySelectorAll('[data-tpr]').forEach(el => { rules[el.dataset.tpr] = el.dataset.tpr === 'after' ? el.value : +el.value; }); rules.progs = progDraft.filter(x => x.name && +x.rate > 0).map(x => ({name: x.name, rate: +x.rate}));
      if(await post({action: 'rules', rules})){ progDraft = null; toast('Saved'); } };
  }

  /* ---------- the tutor's My pay ---------- */
  let mine = null;
  function myPay(){
    if(!mine){ hub.api('pay').then(r => { mine = r; render(); }).catch(e => { mine = {err: e.message}; render(); }); return '<p class="empty">Loading…</p>'; }
    if(mine.err) return `<p class="empty">${esc(mine.err)}</p>`;
    const S = mine.slips || [], open = S.find(s => s.st === 'confirmed');
    return css() + `<a class="crumb" href="#teach">‹ Home</a><div class="ph"><div class="tt"><h1>My pay</h1><p>${mine.place === 'full' ? 'Full-time' : 'Part-time'}</p></div></div>
      ${open ? `<div class="card pad"><span class="note">${esc(open.snap.label)} · confirmed by LHQ</span><div class="tp-big" data-tpmy="${open.m}">${mk(open.snap.total)}</div><span class="note">Check it, then sign.</span>
        <button class="btn n full" style="margin-top:12px" data-tpmy="${open.m}">Open and sign</button><button class="btn full" style="margin-top:8px" data-tpq="${open.m}">Something's wrong</button>${open.q ? `<p class="note" style="margin-top:8px">You told LHQ: "${esc(open.q.note)}"</p>` : ''}</div>`
        : `<div class="card pad"><span class="note">${esc(mine.now.label)} · ${S.some(x => x.m === mine.now.m && x.st === 'signed') ? 'signed' : 'LHQ confirms at month end'}</span><div class="tp-big" style="cursor:default">${mine.now.paid} sessions</div>${mine.now.notPaid ? `<span class="note">${mine.now.notPaid} not paid${mine.now.held ? ` · ${mine.now.held} held` : ''}</span>` : ''}</div>`}
      <div class="h2">Payslips</div><div class="card">${S.map(s => `<a class="it" data-tpmy="${s.m}">${mark(s.st)}<span class="t"><b>${esc(s.snap.label)}</b><small>${s.st === 'signed' ? 'Signed ' + P().dl(new Date(s.sAt).toISOString().slice(0, 10)) : 'To sign'}</small></span><b>${mk(s.snap.total)}</b><span class="chev">›</span></a>`).join('') || '<p class="empty">No payslips yet.</p>'}</div>`;
  }
  function myOne(m){
    const s = (mine.slips || []).find(y => y.m === m); if(!s) return; const x = Object.assign({}, s.snap, {slip: s});
    last.slip = x;
    openSheet(`<div class="hx"><h3>${esc(x.label)}</h3><button class="ib" data-close>✕</button></div>
      <div class="card">${x.lines.map(l => `<button class="tp-ln ${l.grp === 'not' ? 'no' : l.grp === 'held' ? 'hold' : ''}" data-tpl="${esc(l.id)}"><span>${esc(l.label)}<small>${esc(l.sub)}</small></span><b>${l.grp === 'held' ? mk(l.owed || 0) : mk(l.amt)}</b></button>`).join('')}<div class="tp-tot"><span>To pay</span><b>${mk(x.total)}</b></div></div>
      <div class="row" style="gap:8px;margin-top:10px">${s.st === 'confirmed' ? '<button class="btn n" style="flex:1" id="tpSign">Sign</button>' : '<span class="note" style="flex:1">✓ Signed</span>'}<button class="btn" id="tpPdf">PDF</button></div>`);
    document.querySelectorAll('#sheet [data-tpl]').forEach(b => b.onclick = () => { const l = x.lines.find(y => y.id === b.dataset.tpl); if(!l) return;
      openSheet(`<div class="hx"><h3>${esc(l.label)}</h3><button class="ib" data-close>✕</button></div><div class="card">${(l.rows || []).map(r => `<div class="tp-dl"><span>${esc(r.t)}</span><b>${esc(r.v)}</b>${r.s ? `<small>${esc(r.s)}</small>` : ''}</div>`).join('')}</div><button class="btn full" style="margin-top:10px" id="tpBack">‹ Back</button>`); $('tpBack').onclick = () => myOne(m); });
    if($('tpSign')) $('tpSign').onclick = async () => { if(await post({action: 'sign', m})){ closeSheet(); toast('Signed'); mine = null; render(); } };
    $('tpPdf').onclick = () => pdf(x);
  }
  function query(m){
    openSheet(`<div class="hx"><h3>Something's wrong</h3><button class="ib" data-close>✕</button></div><label class="f"><span>What's wrong?</span><textarea class="in" id="tpqN" rows="3"></textarea></label><button class="btn n full" id="tpqGo">Send to LHQ</button>`);
    $('tpqGo').onclick = async () => { if(await post({action: 'query', m, note: $('tpqN').value})){ closeSheet(); toast('Sent to LHQ'); mine = null; render(); } };
  }

  /* ---------- routes and taps ---------- */
  function route(a1){
    if(!may()) return '<p class="empty">You don\'t have access to tutor pay.</p>';
    const h = location.hash.split('/'); if(h[1] === 'm' && /^\d{4}-\d{2}$/.test(h[2] || '')) return list(h[2]);
    if(h[1] && h[1] !== 'm' && /^\d{4}-\d{2}$/.test(h[2] || '')) return slip(dec(h[1]), h[2]);
    return list(ym(HD.today()));
  }
  function bind(){
    document.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => drill(b.dataset.tpl));
    document.querySelectorAll('[data-tpd="all"]').forEach(b => b.onclick = drillAll);
    document.querySelectorAll('[data-tpd="paid"]').forEach(b => b.onclick = drillPaid);
    document.querySelectorAll('[data-tpadd]').forEach(b => b.onclick = () => addItem(b.dataset.tpadd));
    const pl = document.querySelector('[data-tpplace]'); if(pl) pl.onclick = () => place(last.slip.tutor);
    const pd = document.querySelector('[data-tppdf]'); if(pd) pd.onclick = () => pdf(last.slip);
    const cf = document.querySelector('[data-tpconf]'); if(cf) cf.onclick = async () => { const x = last.slip; const r = await post({action: 'confirm', tutor: x.tutor, m: x.m}); if(r){ toast('Confirmed · sent to ' + x.tutor.split(' ')[0] + ' to sign'); render(); } };
    const ro = document.querySelector('[data-tpreopen]'); if(ro) ro.onclick = async () => { const x = last.slip; if(await post({action: 'unconfirm', tutor: x.tutor, m: x.m})){ toast('Reopened'); render(); } };
    const all = document.querySelector('[data-tpall]'); if(all) all.onclick = async () => { const X = (last.list || []).filter(x => stOf(x) === 'draft'); all.disabled = true; let n = 0;
      for(const x of X){ if(await post({action: 'confirm', tutor: x.tutor, m: x.m})) n++; } toast(`${n} payslip${n === 1 ? '' : 's'} confirmed`); render(); };
    document.querySelectorAll('[data-tpmy]').forEach(b => b.onclick = () => myOne(b.dataset.tpmy));
    document.querySelectorAll('[data-tpq]').forEach(b => b.onclick = () => query(b.dataset.tpq));
    if($('tpSave') || document.querySelector('[data-tpr]')) bindSettings();
  }
  /* Home card: this month so far */
  function card(){
    const C = ctx(), m = ym(C.t), X = P().tutors(C).map(t => P().shown(C, t, m)).filter(x => x.lines.length || x.slip), tot = X.reduce((a, x) => a + x.total, 0);
    return {tot, n: X.length, conf: X.filter(x => stOf(x) !== 'draft').length, sessions: X.reduce((a, x) => a + x.paid, 0)};
  }
  return {route, bind, settings, myPay, may, card, paperHTML, resetMine: () => { mine = null; }};
})();
