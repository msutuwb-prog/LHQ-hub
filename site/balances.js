/* LHQ Hub › Balances (agreed 21 Nov): the accountant enters what is in each bank, mobile money and cash account each day.
   The Hub works out what each one should hold: the last balance entered + money in to that account − payments out of it,
   and flags any gap (usually a payment or receipt that wasn't recorded). The accounts can be added or removed.
   Stored in lhq_bal: {acc: {list:[{id, n, k:'bank'|'mobile'|'cash', main}], at}, d: {date: {id: {v, by, at}}}, n: {date: {t, by, at}}}.
   Money in: receipts (by their account, else their payment method) and Record money in; money out: payments. */
window.BAL = (function(){
  const DEF = [{id:'nbm', n:'NBM', k:'bank', main:1}, {id:'std', n:'Standard Bank', k:'bank'}, {id:'fcb', n:'FCB', k:'bank'}, {id:'fdh', n:'FDH', k:'bank'},
    {id:'airtel', n:'Airtel Money', k:'mobile', main:1}, {id:'tnm', n:'TNM Mpamba', k:'mobile'}, {id:'cash', n:'Cash box', k:'cash'}];
  const S = () => HD.store, raw = () => S().get('lhq_bal', {}) || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0;
  const mk = n => 'MWK ' + Math.round(n).toLocaleString('en-US');
  const today = () => HD.today();
  const mayEnter = () => HD.isDir() || HD.can('acct');
  const mayRead = () => HD.isDir() || HD.can('acct') || HD.can('pl');
  function accounts(){ const a = raw().acc; return a && Array.isArray(a.list) && a.list.length ? a.list.filter(x => !x.off) : DEF; }
  function allAccounts(){ const a = raw().acc; return a && Array.isArray(a.list) && a.list.length ? a.list : DEF; }
  function save(fn){ const o = JSON.parse(JSON.stringify(raw())); o.d = o.d || {}; o.n = o.n || {}; fn(o); S().set('lhq_bal', o); }
  /* which account money went to or came from: the one chosen, else guessed from how it was paid */
  function accFor(acct, method){
    const A = accounts(); if(acct && A.some(x => x.id === acct)) return acct;
    const m = String(method || '').toLowerCase(), main = k => (A.find(x => x.k === k && x.main) || A.find(x => x.k === k) || {}).id;
    if(/airtel/.test(m)) return (A.find(x => /airtel/i.test(x.n)) || {}).id || main('mobile');
    if(/tnm|mpamba/.test(m)) return (A.find(x => /tnm|mpamba/i.test(x.n)) || {}).id || main('mobile');
    if(/cash/.test(m)) return main('cash');
    if(m) return main('bank');
    return null;
  }
  /* money moving through each account, by day */
  function moves(){
    const L = [];
    (HD.saved || []).filter(d => (d.type || '') === 'receipt' && !d.del).forEach(d => { const a = accFor(d.acct, d.method), v = num(d.received); if(a && v) L.push({a, d: d.date || '', v, what: (d.number || '') + ' · ' + (d.student || d.name || '')}); });
    Object.values(S().get('lhq_income', {}) || {}).filter(e => e && !e.del).forEach(e => { const a = accFor(e.acct, e.method), v = num(e.amount); if(a && v) L.push({a, d: e.date || '', v, what: e.what || e.cat || 'Money in'}); });
    Object.values(S().get('lhq_spend', {}) || {}).filter(e => e && !e.del && !e.skip).forEach(e => { const a = accFor(e.acct, e.method), v = num(e.amount); if(a && v) L.push({a, d: e.date || '', v: -v, what: (e.cat || '') + (e.what ? ' · ' + e.what : '')}); });
    return L;
  }
  /* for one day: each account's entered figure, what was expected, and the gap */
  function day(d){
    const B = raw(), D = B.d || {}, M = moves(), dates = Object.keys(D).filter(x => x < d).sort();
    return accounts().map(x => {
      const on = (D[d] || {})[x.id], prevDay = [...dates].reverse().find(dd => D[dd] && D[dd][x.id] != null), prev = prevDay ? D[prevDay][x.id].v : null;
      const flow = M.filter(m => m.a === x.id && m.d > (prevDay || '0000') && m.d <= d).reduce((s, m) => s + m.v, 0);
      const exp = prev == null ? null : prev + flow, v = on ? on.v : null;
      return {x, v, by: on && on.by, at: on && on.at, exp, gap: v != null && exp != null ? v - exp : null, prevDay, flow};
    });
  }
  const latest = () => { const D = raw().d || {}; return accounts().map(x => { const dd = Object.keys(D).filter(k => D[k][x.id] != null).sort().pop(); return {x, d: dd, v: dd ? D[dd][x.id].v : null}; }); };
  const total = () => latest().reduce((s, r) => s + (r.v || 0), 0);
  const enteredToday = () => { const T = (raw().d || {})[today()] || {}; return accounts().every(x => T[x.id] != null); };
  const gaps = () => day(today()).filter(r => r.gap && Math.abs(r.gap) >= 1);
  /* the total at the end of each of the last n days (the latest figure for each account on or before that day) */
  function trend(n = 30){ const D = raw().d || {}, out = []; for(let i = n - 1; i >= 0; i--){ const dd = HD.addDays(today(), -i);
    out.push(accounts().reduce((s, x) => { const k = Object.keys(D).filter(k => k <= dd && D[k][x.id] != null).sort().pop(); return s + (k ? D[k][x.id].v : 0); }, 0)); } return out; }
  function spark(V){ const max = Math.max(...V, 1), min = Math.min(...V.filter(v => v > 0), max), w = 300, h = 56, pts = V.map((v, i) => `${(i / Math.max(1, V.length - 1) * w).toFixed(1)},${(h - 4 - (max === min ? .5 : (v - min) / (max - min)) * (h - 8)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Total over the last 30 days"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" points="${pts}"/></svg>`; }

  /* ---------- the page: Business › Balances ---------- */
  function page(){
    if(!mayRead()) return '<p class="empty">Balances are for the accountant and the Director.</p>';
    const t = today(), R = day(t), done = R.filter(r => r.v != null).length, T = total(), tr = trend(30), first = tr.find(v => v > 0) || 0, ch = first ? Math.round((tr[tr.length - 1] - first) / first * 1000) / 10 : null;
    const note = ((raw().n || {})[t] || {}).t || '';
    return `<div class="card pad"><div style="display:flex;justify-content:space-between;align-items:center"><span class="note" style="margin:0">All accounts · latest</span>${ch != null && tr.some(v => v) ? `<span class="tag ${ch >= 0 ? 'ok' : 'rd'}">${ch >= 0 ? '+' : ''}${ch}% in 30 days</span>` : ''}</div>
        <div style="font-size:28px;font-weight:800;color:var(--brand)">${mk(T)}</div>${tr.some(v => v) ? spark(tr) : '<p class="note" style="margin:4px 0 0">Enter today\'s balances to start the trend.</p>'}</div>
      <div class="h2">Today · ${HD.nice(t)} <em>${done} of ${R.length}</em></div>
      <div class="card">${R.map(r => `<div class="it"><span class="ico" style="color:${r.v == null ? 'var(--muted)' : r.gap ? 'var(--am)' : 'var(--ok)'}">${ic(r.v == null ? 'clock' : r.gap ? 'alert' : 'check', 18)}</span><span class="t"><b>${esc(r.x.n)}${r.x.main ? ' <small style="display:inline;font-weight:700">· main</small>' : ''}</b>
        <small>${r.exp == null ? (r.v == null ? 'Not entered yet' : 'First figure: the next days are checked against it') : `Expected ${mk(r.exp)}${r.gap ? ` · <b style="display:inline;color:var(--am)">${r.gap < 0 ? mk(-r.gap) + ' short' : mk(r.gap) + ' over'}</b>` : r.v != null ? ' · matches' : ''}`}${r.by ? ` · ${esc(HD.first(r.by))}` : ''}</small></span><b style="white-space:nowrap">${r.v == null ? '–' : Math.round(r.v).toLocaleString('en-US')}</b></div>`).join('')}</div>
      <p class="note">Expected = the last balance entered + money in to that account − payments out of it since then. A gap usually means a receipt or payment wasn't recorded, or was recorded against another account.</p>
      ${mayEnter() ? `<div class="h2">Enter today's balances</div><div class="card pad">${R.map(r => `<label class="f"><span>${esc(r.x.n)}</span><input class="in" inputmode="numeric" data-balv="${esc(r.x.id)}" value="${r.v == null ? '' : Math.round(r.v).toLocaleString('en-US')}" placeholder="${r.exp == null ? 'MWK' : 'Expected ' + Math.round(r.exp).toLocaleString('en-US')}"></label>`).join('')}
        <label class="f"><span>Explain a gap (optional)</span><input class="in" id="balNote" value="${esc(note)}" placeholder="e.g. Transport refund paid, not recorded yet"></label>
        <button class="btn n full" id="balSave">Save today's balances</button></div>
        <div class="card"><button class="it" type="button" id="balAccts"><span class="ico">${ic('bank', 18)}</span><span class="t"><b>Accounts</b><small>${accounts().map(x => esc(x.n)).join(' · ')}</small></span><span class="chev">›</span></button></div>` : ''}`;
  }
  function bind(){
    const $ = id => document.getElementById(id);
    document.querySelectorAll('[data-balv]').forEach(i => i.oninput = () => { const d = i.value.replace(/[^\d]/g, ''); i.value = d ? Number(d).toLocaleString('en-US') : ''; });
    if($('balSave')) $('balSave').onclick = () => { const t = today(), me = HD.me().name, at = Date.now(); let n = 0;
      save(o => { o.d[t] = Object.assign({}, o.d[t]); document.querySelectorAll('[data-balv]').forEach(i => { if(i.value.trim() === '') return; o.d[t][i.dataset.balv] = {v: num(i.value), by: me, at}; n++; });
        const nt = ($('balNote').value || '').trim(); if(nt || (o.n[t] && o.n[t].t)) o.n[t] = {t: nt, by: me, at}; });
      toast(n ? `Saved ${n} balance${n === 1 ? '' : 's'}` : 'Nothing entered'); if(window.lhqRender) lhqRender(); };
    if($('balAccts')) $('balAccts').onclick = acctSheet;
  }
  /* add, rename, set the main one, or switch off an account (history stays) */
  function acctSheet(){
    let L = JSON.parse(JSON.stringify(allAccounts()));
    const draw = () => { openSheet(`<div class="hx"><h3>Accounts</h3><button class="ib" data-close>✕</button></div><p class="sp">Banks, mobile money and cash. Switching one off keeps its history.</p>
      <div class="card">${L.map((x, i) => `<div class="it" style="flex-wrap:wrap;gap:8px"><input class="in" data-acn="${i}" value="${esc(x.n)}" style="flex:1;min-width:140px" aria-label="Name">
        <select class="in" data-ack="${i}" style="width:auto" aria-label="Kind">${[['bank','Bank'],['mobile','Mobile money'],['cash','Cash']].map(([v, l]) => `<option value="${v}" ${x.k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button type="button" class="btn sm ${x.main ? 'n' : ''}" data-acm="${i}">${x.main ? 'Main ✓' : 'Main'}</button><button type="button" class="btn sm ${x.off ? '' : 'rd'}" data-aco="${i}">${x.off ? 'Switch on' : 'Switch off'}</button></div>`).join('')}</div>
      <button class="btn" id="acAdd" type="button">${ic('plus', 16, 2.4)} Add an account</button><button class="btn n full" id="acSave" style="margin-top:10px">Save</button>`);
      const q = s => document.querySelectorAll(s);
      q('[data-acn]').forEach(i => i.oninput = () => L[+i.dataset.acn].n = i.value);
      q('[data-ack]').forEach(i => i.onchange = () => L[+i.dataset.ack].k = i.value);
      q('[data-acm]').forEach(b => b.onclick = () => { const x = L[+b.dataset.acm]; L.forEach(y => { if(y.k === x.k) y.main = y === x ? 1 : 0; }); draw(); });
      q('[data-aco]').forEach(b => b.onclick = () => { const x = L[+b.dataset.aco]; x.off = x.off ? 0 : 1; draw(); });
      document.getElementById('acAdd').onclick = () => { L.push({id: 'a' + Date.now().toString(36), n: '', k: 'bank'}); draw(); const ins = q('[data-acn]'); ins[ins.length - 1].focus(); };
      document.getElementById('acSave').onclick = () => { L = L.filter(x => String(x.n).trim()); L.forEach(x => x.n = String(x.n).trim());
        save(o => { o.acc = {list: L, at: Date.now(), by: HD.me().name}; }); closeSheet(); toast('Accounts saved'); if(window.lhqRender) lhqRender(); };
    };
    draw();
  }
  /* for Home and approvals */
  const avail = () => total();
  return {DEF, accounts, accFor, day, total, avail, trend, enteredToday, gaps, page, bind, mayRead, mayEnter};
})();
