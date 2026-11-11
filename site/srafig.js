/* LHQ Hub › SRA figures for LHQ: averages at each review (with the ARS before it), topics whose marks drop between reviews,
   each student's SRAs; cards on a student's Overview. Every figure opens the SRAs behind it. From the tutors' marks (lhq_logs). */
window.SRAFIG = (function(){
  const HDR = ['LD','R1','R2','R3','R4','R5'];
  const pc = e => e.sc !== '' && e.sc != null && +e.mx > 0 ? Math.round(+e.sc / +e.mx * 100) : null;
  const ars = e => !e.na && +e.ao > 0 && e.ars != null && e.ars !== '' ? Math.round(+e.ars / +e.ao * 100) : null;
  const avg = L => L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : null;
  const pcs = v => v == null ? '–' : v + '%';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dl = d => { const x = new Date(d + 'T00:00:00Z'); return `${WD[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
  const addD = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  let per = '4w', by = 'review', last = {};
  const css = `.sf-dl{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:9px 14px;border-top:1px solid var(--line2);font-size:13.5px}.sf-dl:first-child{border-top:0}.sf-dl small{grid-column:1/-1;color:var(--muted);font-size:12px}.sf-dl b{white-space:nowrap}.sf-dl.r b{color:var(--rd)}.sf-dl.y b{color:var(--am)}
.sf-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:10px 14px;border-top:1px solid var(--line2);cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;font:inherit;color:var(--ink)}.sf-row:first-child{border-top:0}.sf-row:hover{background:var(--hover)}.sf-row small{display:block;color:var(--muted);font-size:12px}.sf-row .dn{color:var(--rd);font-weight:800}.sf-row .chev{color:var(--muted)}
.sf-bars{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;align-items:end;height:140px;margin:8px 0 4px}.sf-bars button{display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%;gap:4px;border:0;background:none;cursor:pointer;padding:0;font:inherit;color:var(--ink);border-radius:8px}.sf-bars button:hover{background:var(--hover)}
.sf-pair{display:flex;gap:3px;align-items:end;justify-content:center;width:100%;flex:1}.sf-pair i{width:34%;border-radius:5px 5px 2px 2px;background:var(--accent);min-height:2px}.sf-pair i.a{background:#7fa6d9}.sf-bars b{font-size:12px}.sf-bl{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;font-size:11px;font-weight:800;color:var(--muted);text-align:center}
.sf-lg{display:flex;gap:12px;font-size:12px;color:var(--muted);margin-top:6px}.sf-lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.sf-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}.sf-kv button{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:10px 12px;text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-width:0}.sf-kv button:hover{border-color:var(--muted)}.sf-kv span{display:block;font-size:11.5px;color:var(--muted);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sf-kv b{font-size:18px}
.sf-tdh,.sf-tdr{display:grid;grid-template-columns:minmax(0,1fr) 50px 46px 54px;gap:6px;align-items:center;padding:9px 14px;text-align:right}.sf-tdh{font-size:11px;font-weight:800;color:var(--muted);border-bottom:1px solid var(--line2)}.sf-tdh span:first-child,.sf-tdr span{text-align:left;min-width:0}
.sf-tdr{width:100%;border:0;border-top:1px solid var(--line2);background:none;cursor:pointer;color:inherit;font:inherit}.sf-tdr:first-of-type{border-top:0}.sf-tdr:hover{background:var(--hover)}.sf-tdr small{display:block;color:var(--muted);font-size:12px}.sf-tdr b.lo{color:var(--am)}`;
  let cssOn = false; const ensure = () => { if(cssOn) return; cssOn = true; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
  const range = () => { const t = HD.today(); if(per === 'term' && window.MIN){ const T = MIN.terms().filter(x => x[1] <= t).sort((a, b) => b[1].localeCompare(a[1]))[0]; if(T) return {a: T[1], b: t, l: T[0]}; }
    if(per === 'all') return {a: '2000-01-01', b: t, l: 'All'}; return {a: addD(t, -27), b: t, l: 'Last 4 weeks'}; };
  const logs = () => Object.values(((store.get('lhq_logs', {e: {}}) || {}).e) || {}).filter(e => e && !e.x);
  function data(r){
    const R = logs().filter(e => e.ty === 'r' && e.v === 2 && !e.self && e.d >= r.a && e.d <= r.b);
    const IN = R.filter(e => e.h !== 'm' && pc(e) != null);
    const rev = HDR.map((h, i) => { const L = IN.filter(e => (+e.rv || 0) === i), A = L.map(ars).filter(v => v != null); return {i, h, L, n: L.length, s: avg(L.map(pc)), a: avg(A)}; });
    /* topics: each student's first and latest marked review of the topic */
    const byKT = {}; IN.forEach(e => { (byKT[e.k + '|' + e.tk] = byKT[e.k + '|' + e.tk] || []).push(e); });
    const TP = {}; Object.values(byKT).forEach(L => { if(L.length < 2) return; L.sort((x, y) => (+x.rv || 0) - (+y.rv || 0) || x.d.localeCompare(y.d)); const f = L[0], l = L[L.length - 1];
      const key = f.sub + '|' + f.tk; (TP[key] = TP[key] || {sub: f.sub, tk: f.tk, S: []}).S.push({st: f.st, f, l, drop: pc(l) - pc(f)}); });
    const topics = Object.values(TP).map(x => Object.assign(x, {drop: avg(x.S.map(y => y.drop)), first: avg(x.S.map(y => pc(y.f))), latest: avg(x.S.map(y => pc(y.l)))})).filter(x => x.drop <= -10).sort((a, b) => a.drop - b.drop);
    const studs = {}; R.forEach(e => { const o = studs[e.k] = studs[e.k] || {k: e.k, st: e.st, L: []}; o.L.push(e); });
    const students = Object.values(studs).map(o => { const inn = o.L.filter(e => e.h !== 'm'), A = inn.filter(e => ars(e) != null);
      return Object.assign(o, {due: o.L.length, inn: inn.length, on: o.L.filter(e => e.h === 'o').length, wa: A.length, s: avg(inn.map(pc).filter(v => v != null)), a: avg(A.map(ars))}); })
      .sort((x, y) => x.inn / x.due - y.inn / y.due || (x.s || 0) - (y.s || 0));
    return {R, IN, rev, topics, students, inn: IN.length, due: R.length, on: R.filter(e => e.h === 'o').length, wa: IN.filter(e => ars(e) != null).length};
  }
  const rowE = e => `<div class="sf-dl ${e.h === 'm' ? 'r' : ars(e) == null ? 'y' : ''}"><span>${esc(e.st)} · ${esc(e.tk)} ${HDR[+e.rv || 0]}</span><b>${e.h === 'm' ? 'not handed in' : pcs(pc(e)) + (ars(e) != null ? ` · ARS ${ars(e)}%` : ' · no ARS')}</b><small>${esc(e.sub)} · ${dl(e.d)}${e.h === 'l' ? ' · late' : ''}</small></div>`;
  const sheet = (t, sub, body) => openSheet(`<div class="hx"><h3>${t}</h3><button class="ib" data-close>✕</button></div>${sub ? `<p class="sp">${sub}</p>` : ''}<div class="card">${body || '<p class="empty">Nothing here.</p>'}</div>`);

  /* ---------- Reports › SRAs ---------- */
  function page(){
    ensure(); const r = range(), D = data(r); last = D;
    const tiles = `<div class="sf-kv"><button data-sfd="in"><span>Handed in</span><b>${D.due ? `${D.inn} of ${D.due}` : '–'}</b></button><button data-sfd="on"><span>On their day</span><b>${D.due ? Math.round(D.on / D.due * 100) + '%' : '–'}</b></button><button data-sfd="wa"><span>With an ARS</span><b>${D.inn ? Math.round(D.wa / D.inn * 100) + '%' : '–'}</b></button></div>`;
    const mx = 100, body = by === 'review' ? `<div class="card pad"><b>Average at each review</b><p class="note" style="margin:2px 0 0">SRA mark, with the ARS before it · tap a review</p>
        <div class="sf-bars">${D.rev.map(x => `<button data-sfr="${x.i}" aria-label="${x.h}: SRA ${pcs(x.s)}"><div class="sf-pair"><i class="a" style="height:${(x.a || 0) / mx * 100}%"></i><i style="height:${(x.s || 0) / mx * 100}%"></i></div><b>${x.s == null ? '–' : x.s}</b></button>`).join('')}</div>
        <div class="sf-bl">${HDR.map(h => `<span>${h}</span>`).join('')}</div><div class="sf-lg"><span><i style="background:#7fa6d9"></i>ARS</span><span><i style="background:var(--accent)"></i>SRA</span></div></div>`
      : by === 'topic' ? `<div class="card">${D.topics.map((x, i) => `<button class="sf-row" data-sft="${i}"><span><b>${esc(x.tk)}</b><small>${esc(x.sub)} · ${x.S.length} student${x.S.length === 1 ? '' : 's'} · ${x.first}% → ${x.latest}%</small></span><span class="dn">${x.drop}</span><span class="chev">›</span></button>`).join('') || '<p class="empty">No topic falls 10 points or more.</p>'}</div><p class="note">Average fall from each student's first marked review to their latest.</p>`
      : `<div class="card">${D.students.map((x, i) => `<button class="sf-row" data-sfs="${i}"><span><b>${esc(x.st)}</b><small>${x.inn} of ${x.due} in · SRA ${pcs(x.s)}</small></span><span><small>ARS</small><b>${x.inn ? Math.round(x.wa / x.inn * 100) + '%' : '–'}</b></span><span class="chev">›</span></button>`).join('') || '<p class="empty">No SRAs in these dates.</p>'}</div>`;
    return `<a class="crumb" href="#reports">‹ Reports</a><div class="ph"><div class="tt"><h1>SRAs</h1><p>All students · ${esc(r.l)}</p></div></div>
      <div class="seg" style="display:flex;margin-bottom:10px">${[['4w','4 weeks'],['term','Term'],['all','All']].map(([k, l]) => `<button style="flex:1" class="${per === k ? 'on' : ''}" data-sfp="${k}">${l}</button>`).join('')}</div>
      ${tiles}<div class="card" style="margin-bottom:12px"><a class="it" href="#srafig/topics"><span class="t"><b>Topics</b><small>Hardest first · SRA, ARS, assessments</small></span><span class="chev">›</span></a><a class="it" href="#fu"><span class="t"><b>Follow-ups</b><small>Reteach, retest, take-home · what worked</small></span><span class="chev">›</span></a></div><div class="seg" style="display:flex;margin-bottom:12px">${[['review','By review'],['topic','Topics dropping'],['student','By student']].map(([k, l]) => `<button style="flex:1" class="${by === k ? 'on' : ''}" data-sfb="${k}">${l}</button>`).join('')}</div>${body}`;
  }
  function bind(){
    document.querySelectorAll('[data-sfp]').forEach(b => b.onclick = () => { per = b.dataset.sfp; render(); });
    document.querySelectorAll('[data-sfb]').forEach(b => b.onclick = () => { by = b.dataset.sfb; render(); });
    const D = last;
    document.querySelectorAll('[data-sfd]').forEach(b => b.onclick = () => { const k = b.dataset.sfd;
      if(k === 'in'){ const L = D.R.filter(e => e.h === 'm'); sheet(`Handed in · ${D.inn} of ${D.due}`, `${L.length} not handed in`, L.sort((a, b) => b.d.localeCompare(a.d)).map(rowE).join('')); }
      if(k === 'on'){ const L = D.R.filter(e => e.h !== 'o'); sheet(`On their day · ${D.on} of ${D.due}`, `${L.length} late or not handed in`, L.sort((a, b) => b.d.localeCompare(a.d)).map(rowE).join('')); }
      if(k === 'wa'){ const L = D.IN.filter(e => ars(e) == null); sheet(`With an ARS · ${D.wa} of ${D.inn}`, `${L.length} handed in without the ARS`, L.sort((a, b) => b.d.localeCompare(a.d)).map(rowE).join('')); } });
    document.querySelectorAll('[data-sfr]').forEach(b => b.onclick = () => { const x = D.rev[+b.dataset.sfr], S = {};
      x.L.forEach(e => { (S[e.k] = S[e.k] || {st: e.st, L: []}).L.push(e); });
      sheet(`${x.h} · SRA ${pcs(x.s)} · ARS ${pcs(x.a)}`, `${x.n} SRAs marked · by student`, Object.values(S).map(o => { const A = o.L.map(ars).filter(v => v != null); return `<div class="sf-dl"><span>${esc(o.st)}</span><b>${pcs(avg(o.L.map(pc)))}</b><small>${o.L.length} SRA${o.L.length === 1 ? '' : 's'} · ARS ${pcs(avg(A))}</small></div>`; }).join('')); });
    document.querySelectorAll('[data-sft]').forEach(b => b.onclick = () => { const x = D.topics[+b.dataset.sft];
      sheet(`${esc(x.tk)} · ${x.drop}`, `${esc(x.sub)} · first and latest review`, x.S.map(y => `<div class="sf-dl ${y.drop <= -10 ? 'r' : ''}"><span>${esc(y.st)}</span><b>${y.drop > 0 ? '+' : ''}${y.drop}</b><small>${HDR[+y.f.rv || 0]} ${pc(y.f)}% (${dl(y.f.d)}) → ${HDR[+y.l.rv || 0]} ${pc(y.l)}% (${dl(y.l.d)})</small></div>`).join('')); });
    document.querySelectorAll('[data-sfs]').forEach(b => b.onclick = () => { const x = D.students[+b.dataset.sfs];
      sheet(esc(x.st), `${x.inn} of ${x.due} handed in · ${x.on} on their day · ${x.wa} with an ARS`, x.L.slice().sort((a, b) => b.d.localeCompare(a.d)).map(rowE).join('')); });
    document.querySelectorAll('[data-sfc]').forEach(b => b.onclick = () => cardSheet(b.dataset.sfc, b.dataset.k));
  }

  /* ---------- Topics: hardest first (last 3 months) · SRA average, ARS average, assessments on the topic; each opens its students and tutors ---------- */
  let tdLv = '', tdSub = '', tdLast = [];
  const lvOf = l => { l = String(l || '').toLowerCase(); const y = +((l.match(/year\s*(\d+)/) || [])[1] || 0);
    return /a\s*level|\bas\b/.test(l) || y >= 12 ? 'A Level' : /igcse/.test(l) || y === 10 || y === 11 ? 'IGCSE' : y >= 7 && y <= 9 ? 'Years 7–9' : y === 6 || /primary/.test(l) ? 'Year 6' : 'Other'; };
  const nk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  function tdData(){
    const t = HD.today(), a = addD(t, -91), LV = {};
    (typeof saved !== 'undefined' ? saved : []).filter(d => d && d.type === 'card').sort((x, y) => String(x.date || '').localeCompare(String(y.date || ''))).forEach(c => { LV[nk(c.student)] = lvOf(c.level); });
    const E = logs().filter(e => e.d >= a && e.d <= t), R = E.filter(e => e.ty === 'r' && e.v === 2 && !e.self && e.h !== 'm' && pc(e) != null), W = E.filter(e => e.ty === 'w' && e.sc != null && e.sc !== '' && +e.mx > 0);
    const T = {}; R.forEach(e => { const lv = LV[(e.k || '').split('|')[0]] || 'Other', key = lv + '|' + nk(e.sub) + '|' + nk(e.tk);
      const o = T[key] = T[key] || {lv, sub: e.sub, tk: e.tk, R: [], W: []}; o.R.push(e); });
    W.forEach(e => { const lv = LV[(e.k || '').split('|')[0]] || 'Other'; (e.tp || []).forEach(tp => { const o = T[lv + '|' + nk(e.sub) + '|' + nk(tp)]; if(o) o.W.push(e); }); });
    return Object.values(T).map(o => Object.assign(o, {n: new Set(o.R.map(e => e.k)).size, s: avg(o.R.map(pc)), a: avg(o.R.map(ars).filter(v => v != null)), w: avg(o.W.map(pc))}));
  }
  function topicsPage(){
    ensure(); const all = tdData(), lvs = [...new Set(all.map(o => o.lv))].sort((a, b) => ['IGCSE','A Level','Years 7–9','Year 6','Other'].indexOf(a) - ['IGCSE','A Level','Years 7–9','Year 6','Other'].indexOf(b));
    if(!lvs.includes(tdLv)) tdLv = lvs[0] || ''; const inL = all.filter(o => o.lv === tdLv), subs = [...new Set(inL.map(o => o.sub))].sort();
    if(!subs.includes(tdSub)) tdSub = subs[0] || ''; const L = tdLast = inL.filter(o => o.sub === tdSub).sort((a, b) => a.s - b.s);
    const m = avg(L.map(o => o.s)), ma = avg(L.map(o => o.a).filter(v => v != null)), mw = avg(L.map(o => o.w).filter(v => v != null)), lo = (v, mm) => v != null && mm != null && v <= mm - 8 ? 'lo' : '';
    return `<a class="crumb" href="#srafig">‹ SRA figures</a><div class="ph"><div class="tt"><h1>Topics</h1><p>Hardest first · last 3 months</p></div></div>
      ${lvs.length > 1 ? `<div class="seg" style="display:flex;margin-bottom:10px">${lvs.map(x => `<button style="flex:1" class="${x === tdLv ? 'on' : ''}" data-tdl="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      ${subs.length > 1 ? `<div class="chips" style="margin-bottom:10px">${subs.map(x => `<button class="chip${x === tdSub ? ' on' : ''}" data-tds="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <div class="card"><div class="sf-tdh"><span>Topic</span><span>SRA</span><span>ARS</span><span>Assess.</span></div>${L.map((o, i) => `<button class="sf-tdr" data-tdt="${i}"><span><b>${esc(o.tk)}</b><small>${o.n} student${o.n === 1 ? '' : 's'}</small></span><b class="${lo(o.s, m)}">${pcs(o.s)}</b><b class="${lo(o.a, ma)}">${pcs(o.a)}</b><b class="${lo(o.w, mw)}">${pcs(o.w)}</b></button>`).join('') || '<p class="empty">No SRAs marked in these dates.</p>'}</div>
      <p class="note">SRA: average mark on the topic, every review. Amber: 8 points or more below the subject's average. Tap a topic for its students and tutors.</p>`;
  }
  function tdBind(){
    document.querySelectorAll('[data-tdl]').forEach(b => b.onclick = () => { tdLv = b.dataset.tdl; tdSub = ''; render(); });
    document.querySelectorAll('[data-tds]').forEach(b => b.onclick = () => { tdSub = b.dataset.tds; render(); });
    document.querySelectorAll('[data-tdt]').forEach(b => b.onclick = () => { const o = tdLast[+b.dataset.tdt], S = {};
      o.R.forEach(e => { const x = S[e.k] = S[e.k] || {st: e.st, tu: new Set(), L: [], W: []}; x.L.push(e); if(e.tutor) x.tu.add(e.tutor); });
      o.W.forEach(e => { if(S[e.k]) S[e.k].W.push(e); });
      const rows = Object.values(S).map(x => Object.assign(x, {s: avg(x.L.map(pc)), a: avg(x.L.map(ars).filter(v => v != null)), w: avg(x.W.map(pc))})).sort((a, b) => a.s - b.s);
      sheet(esc(o.tk), `${esc(o.lv)} ${esc(o.sub)} · ${o.n} student${o.n === 1 ? '' : 's'} · last 3 months`, rows.map(x => `<div class="sf-dl ${x.s < 65 ? 'y' : ''}"><span>${esc(x.st)}</span><b>SRA ${pcs(x.s)}</b><small>${[...x.tu].map(esc).join(', ') || '–'} · ${x.L.length} SRA${x.L.length === 1 ? '' : 's'} · ARS ${pcs(x.a)}${x.W.length ? ' · assessments ' + pcs(x.w) : ''}</small></div>`).join('')); });
  }

  /* ---------- a student's Overview: SRAs, fading topics, what they say ---------- */
  function student(key){
    ensure(); const t = HD.today(), r = {a: addD(t, -27), b: t}, L = logs().filter(e => e.ty === 'r' && e.v === 2 && !e.self && e.k && e.k.split('|')[0] === key);
    const inR = L.filter(e => e.d >= r.a), inn = inR.filter(e => e.h !== 'm'), A = inn.filter(e => ars(e) != null);
    const fad = fading(L);
    const SR = (store.get('lhq_sreports', null) || {})[key], says = SR && window.SREP ? SREP.stats(SREP.rows({[key]: SR}).filter(x => x.d >= r.a)) : null;
    if(!inR.length && !fad.length && !says) return '';
    return `<div class="h2">SRAs and what they say <em>last 4 weeks</em></div><div class="sf-kv">
      <button data-sfc="sra" data-k="${esc(key)}"><span>SRAs handed in</span><b>${inR.length ? `${inn.length}/${inR.length}` : '–'}</b></button>
      <button data-sfc="fade" data-k="${esc(key)}"><span>Fading topics</span><b>${fad.length}</b></button>
      <button data-sfc="says" data-k="${esc(key)}"><span>Prepared</span><b>${says ? says.prep + '%' : '–'}</b></button></div>`;
  }
  function fading(L){
    const byT = {}; L.filter(e => e.h !== 'm' && pc(e) != null).forEach(e => { (byT[e.k + '|' + e.tk] = byT[e.k + '|' + e.tk] || []).push(e); });
    return Object.values(byT).map(X => { X.sort((a, b) => (+a.rv || 0) - (+b.rv || 0) || a.d.localeCompare(b.d)); const f = X[0], l = X[X.length - 1]; return X.length > 1 && pc(f) - pc(l) >= 15 ? {f, l, drop: pc(l) - pc(f)} : null; }).filter(Boolean).sort((a, b) => a.drop - b.drop);
  }
  function cardSheet(kind, key){
    const t = HD.today(), a = addD(t, -27), L = logs().filter(e => e.ty === 'r' && e.v === 2 && !e.self && e.k && e.k.split('|')[0] === key);
    if(kind === 'sra'){ const R = L.filter(e => e.d >= a), inn = R.filter(e => e.h !== 'm'); sheet('SRAs · last 4 weeks', `${inn.length} of ${R.length} handed in · ${R.filter(e => e.h === 'o').length} on their day · ${inn.filter(e => ars(e) != null).length} with an ARS`, R.sort((x, y) => y.d.localeCompare(x.d)).map(rowE).join('')); }
    if(kind === 'fade'){ const F = fading(L); sheet('Fading topics', 'Latest marked review 15 points or more below the first', F.map(x => `<div class="sf-dl r"><span>${esc(x.f.tk)} · ${esc(x.f.sub)}</span><b>${x.drop}</b><small>${HDR[+x.f.rv || 0]} ${pc(x.f)}% (${dl(x.f.d)}) → ${HDR[+x.l.rv || 0]} ${pc(x.l)}% (${dl(x.l.d)})</small></div>`).join('')); }
    if(kind === 'says'){ const SR = (store.get('lhq_sreports', null) || {})[key]; const R = SR && window.SREP ? SREP.rows({[key]: SR}).filter(x => x.d >= a).sort((x, y) => y.d.localeCompare(x.d)) : [], s = R.length ? SREP.stats(R) : null;
      sheet('What they say · last 4 weeks', s ? `${s.n} session${s.n === 1 ? '' : 's'} · rating ${s.rate} · prepared ${s.prep}% · guide before ${s.gb}%` : 'No daily reports yet', R.map(x => `<div class="sf-dl ${x.prep === 'No' ? 'r' : x.prep === 'Partly' ? 'y' : ''}"><span>${esc(x.sub)} · ${dl(x.d)}</span><b>${x.rate ? x.rate + '/5' : '–'}</b><small>Prepared: ${esc(x.prep || '–')}${x.gb ? ' · guide before' : ''}${x.na ? ' · no guide' : ''}</small></div>`).join('')); }
  }
  return {page, bind, student, data, topicsPage, tdBind, ensure};
})();
