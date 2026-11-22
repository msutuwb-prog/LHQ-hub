/* LHQ Hub › MK / $: money figures in US dollars, view only, for the Director and admins with money access.
   Quotes, invoices and receipts stay in kwacha; so does every page for tutors, students and parents.
   Rates (kv lhq_fx, fetched daily on the server; the Director or a money admin can correct today's): {days: {date: MWK per USD}, fix: {date: rate}, src, at}.
   Each figure uses its own month's rate (the last rate in that month; this month: today's), so a falling kwacha never shrinks past months.
   FX.adj(amount, date) re-prices a dated kwacha amount at today's rate, so sums across months come out right once mk() converts at today's rate. */
window.FX = (function(){
  const KEY = 'lhq_cur', PAGES = ['home', 'biz', 'reports', 'rep', 'perf', 'pay'];
  const read = () => { try{ return localStorage.getItem(KEY) === 'usd'; }catch(e){ return false; } };
  const raw = () => { const st = window.HD && HD.store; return (st && st.get('lhq_fx', null)) || {}; };
  function table(){ const r = raw(); const d = Object.assign({}, r.days || {}, r.fix || {}); return Object.keys(d).filter(k => +d[k] > 0).sort().map(k => [k, +d[k]]); }
  const today = () => (window.HD ? HD.today() : new Date().toISOString().slice(0, 10));
  const me = () => (window.HD && HD.me ? HD.me() : {}) || {};
  const may = () => { const m = me(); return !!m.role && !['tutor', 'student', 'parent'].includes(m.role) && (m.role === 'director' || (window.HD && HD.can && HD.can('money'))); };
  const routeNow = () => { try{ return typeof route !== 'undefined' ? route : null; }catch(e){ return null; } };
  function now(){ const T = table(), t = today(); let v = null, at = null; T.forEach(([k, r]) => { if(k <= t){ v = r; at = k; } }); if(v == null && T.length){ v = T[0][1]; at = T[0][0]; } return v ? {rate: v, at} : null; }
  function rateOn(d){
    const T = table(); if(!T.length) return null; d = String(d || today()).slice(0, 10); const m = d.slice(0, 7), t = today();
    if(m >= t.slice(0, 7)) return (now() || {}).rate;
    let best = null; T.forEach(([k, r]) => { if(k.slice(0, 7) <= m) best = r; });   // the last rate in that month, else the last before it
    return best == null ? T[0][1] : best;
  }
  /* a single day's rate (for spending paid in dollars): the latest on or before that day */
  function rateDay(d){ const T = table(); if(!T.length) return null; let v = T[0][1]; T.forEach(([k, r]) => { if(k <= d) v = r; }); return v; }
  const on = () => read() && may() && !!now();
  const active = () => { const r = routeNow(); return on() && !!r && PAGES.includes(r.page); };
  const adj = (a, d) => { if(!active()) return a; const n = now(), r = rateOn(d); return n && r ? a * n.rate / r : a; };
  const toUsd = (n, d) => { const r = d ? rateOn(d) : (now() || {}).rate; return r ? n / r : n; };
  const usd = (n, d) => { const v = toUsd(n, d), a = Math.abs(v); return (v < 0 ? '−' : '') + '$' + Math.round(a).toLocaleString('en-US'); };
  const usdShort = (n, d) => { const v = toUsd(n, d), a = Math.abs(v); return (v < 0 ? '−' : '') + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : a >= 1e4 ? (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : Math.round(a).toLocaleString('en-US')); };
  const dl = d => { const x = new Date(d + 'T00:00:00Z'); return `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.getUTCDay()]} ${x.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getUTCMonth()]}`; };
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  /* the line under a money page's title */
  function line(){ const n = now(); if(!n) return ''; const old = n.at < HD.addDays(today(), -1), fixed = (raw().fix || {})[n.at];
    return `<button type="button" class="fx-line" data-fxr>USD at each month's RBM middle rate · ${old ? 'rate from ' + dl(n.at) : 'today'} ${n.rate.toFixed(2)}${fixed ? ' (yours)' : ''} ›</button>`; }
  /* the months a report covers, with their rates (for the downloads) */
  function note(from, to){ const L = []; let m = String(from || today()).slice(0, 7); const end = String(to || today()).slice(0, 7);
    for(let i = 0; m <= end && i < 40; i++){ L.push(`${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}: ${(rateOn(m + '-28') || 0).toFixed(2)}`); const [y, k] = m.split('-').map(Number); m = k === 12 ? `${y + 1}-01` : `${y}-${String(k + 1).padStart(2, '0')}`; }
    return `<p style="font-size:10px;color:#6b7585;margin:14px 0 0">USD at each month's Reserve Bank of Malawi middle rate (MWK per USD): ${L.join(' · ')}. Documents are in MWK.</p>`; }
  function sheet(){
    const r = raw(), T = table(), by = {}; T.forEach(([k, v]) => { by[k.slice(0, 7)] = [k, v]; });
    const months = Object.keys(by).sort().reverse().slice(0, 18), n = now(), fix = (r.fix || {})[today()];
    openSheet(`<div class="hx"><h3>Bank rate · MWK per USD</h3><button class="ib" data-close>✕</button></div><p class="sp">Reserve Bank of Malawi middle rate · fetched once a day${r.src ? ' · ' + esc(r.src) : ''}</p>
      <div class="card">${months.map(m => { const [k, v] = by[m], cur = m === today().slice(0, 7); return `<div class="it"><span class="t"><b>${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}</b><small>${cur ? (k === today() ? 'today' : 'latest · ' + dl(k)) : 'last rate in the month · ' + dl(k)}${(r.fix || {})[k] ? ' · corrected' : ''}</small></span><b>${v.toFixed(2)}</b></div>`; }).join('') || '<p class="empty">No rates yet.</p>'}</div>
      <div class="card pad"><div class="cap">Correct today's rate</div><div style="display:flex;gap:8px"><input class="in" id="fxFix" inputmode="decimal" placeholder="${n ? n.rate.toFixed(2) : 'e.g. 1751.30'}" value="${fix || ''}" style="flex:1"><button class="btn n" id="fxSave">Save</button></div>
        ${fix ? '<button class="btn full" id="fxUndo" style="margin-top:8px">Use the fetched rate</button>' : ''}<p class="note" style="margin:6px 0 0">Type the RBM middle rate if the fetched one is off. It applies to today.</p></div>
      <p class="note">Each month uses its own rate, so past months keep their value in dollars. Quotes, invoices and receipts stay in kwacha.</p>`);
    const post = async b => { try{ await hub.api('fx', {method: 'POST', body: JSON.stringify(b)}); await hub.pull(); closeSheet(); toast('Rate saved'); render(); }catch(e){ toast(e.message); } };
    if($('fxSave')) $('fxSave').onclick = () => { const v = parseFloat(String($('fxFix').value).replace(/,/g, '')); if(!(v > 100 && v < 100000)){ toast('Check the rate'); return; } post({op: 'fix', rate: v}); };
    if($('fxUndo')) $('fxUndo').onclick = () => post({op: 'fix', rate: null});
  }
  /* after each page draw: the button's label, and the rate line under the title */
  function after(){
    const b = document.getElementById('hnFx'); if(b){ b.hidden = !may(); b.textContent = read() ? '$' : 'MK'; b.setAttribute('aria-label', read() ? 'Show money in kwacha' : 'Show money in dollars'); b.classList.toggle('on', read()); }
    if(may() && !table().length){ let tried = false; try{ tried = sessionStorage.getItem('lhq_fxTried') === '1'; sessionStorage.setItem('lhq_fxTried', '1'); }catch(e){}
      if(!tried) hub.api('fx', {method: 'POST', body: JSON.stringify({op: 'fetch'})}).then(() => hub.pull()).then(() => { if(typeof render === 'function') render(); }).catch(() => {}); }
    if(!active()) return; const main = document.getElementById('main'); if(!main || main.querySelector('.fx-line')) return;
    const ph = main.querySelector('.ph'); if(ph) ph.insertAdjacentHTML('afterend', line()); else main.insertAdjacentHTML('afterbegin', line());
    main.querySelectorAll('[data-fxr]').forEach(x => x.onclick = sheet);
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#hnFx'); if(!b) return;
    if(!now()){ toast('No bank rate yet. It arrives within a day.'); return; }
    try{ localStorage.setItem(KEY, read() ? 'mwk' : 'usd'); }catch(x){} if(typeof render === 'function') render(); });
  if(!document.getElementById('fxCss')){ const s = document.createElement('style'); s.id = 'fxCss';
    s.textContent = '.fx-line{display:block;width:100%;text-align:left;border:1px solid var(--line2);background:var(--surface2);border-radius:10px;padding:7px 10px;font:inherit;font-size:12.5px;color:var(--muted);font-weight:700;cursor:pointer;margin:0 0 12px}.fx-line:hover{background:var(--hover)}#hnFx{font-weight:900;font-size:12.5px;width:auto;min-width:36px;padding:0 8px}#hnFx.on{color:var(--accent)}';
    document.head.appendChild(s); }
  return {on, active, may, rateDay, adj, usd, usdShort, rateOn, now, note, sheet, after, table};
})();
