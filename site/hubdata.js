/* LHQ Hub: reading the saved documents. Students, where each invoice stands, how documents link up,
   who is signed in and what they may do. Used by the Hub pages and the document page. */
(function(){
  const store = { get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
                  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g,'')); return isNaN(n) ? 0 : n; };
  const mk = n => 'MKW ' + Math.round(n).toLocaleString('en-US');
  const mkShort = n => { const a = Math.abs(n); return 'MKW ' + (a >= 1e6 ? (n/1e6).toFixed(2).replace(/\.?0+$/,'') + 'M' : a >= 1e4 ? Math.round(n/1e3) + 'k' : Math.round(n).toLocaleString('en-US')); };
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const isoOf = dt => dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
  const parseISO = iso => { const [y,m,d] = String(iso).split('-').map(Number); return new Date(y, m-1, d); };
  const today = () => isoOf(new Date());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const nice = iso => { if(!iso) return ''; const d = parseISO(iso); return `${d.getDate()} ${MON[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`; };
  const range = (a, b) => !a ? '' : !b ? nice(a) + ' onwards' : `${nice(a)} – ${nice(b)}`;
  function ago(t){
    if(!t) return ''; const m = Math.round((Date.now() - t) / 60000);
    if(m < 1) return 'just now'; if(m < 60) return `${m} min ago`; const h = Math.round(m / 60); if(h < 24) return `${h} h ago`;
    const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : nice(isoOf(new Date(t)));
  }
  const first = s => String(s || '').trim().split(/\s+/)[0];
  const sk = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const same = (a, b) => a && b && String(a).trim().toUpperCase() === String(b).trim().toUpperCase();
  const WORD = {quote:'Quote', invoice:'Invoice', receipt:'Receipt', card:'Tuition card'};
  const typeOf = d => d.type || 'quote';

  /* who is signed in, and what they may do */
  function me(){ const s = store.get('lhq_session', null); return s && s.me || {}; }
  const isDir = () => me().role === 'director';
  const can = k => isDir() || (me().role === 'admin' && (me().perms || []).includes(k));
  const ROLE = {director:'Director', admin:'Admin', tutor:'Tutor'};
  const roleText = p => (ROLE[p.role] || (p.admin ? 'Admin' : 'Tutor')) + (p.role !== 'tutor' && p.tutor ? ' + Tutor' : '');

  let saved = [], settings = {};
  let rIdx = null;   // receipts by the invoice number they pay, built once per load (lists with thousands of documents stay quick)
  function load(){ saved = store.get('lhq_saved', []); settings = Object.assign({}, window.DEFAULT_SETTINGS || {}, store.get('lhq_settings', {})); rIdx = null; return saved; }
  function receiptsFor(number){
    if(!rIdx){ rIdx = new Map(); saved.forEach(r => { if(r.type === 'receipt' && r.ref){ const k = String(r.ref).trim().toUpperCase(); if(!rIdx.has(k)) rIdx.set(k, []); rIdx.get(k).push(r); } }); }
    return rIdx.get(String(number || '').trim().toUpperCase()) || [];
  }
  const grace = () => Math.max(0, Math.round(num(settings.graceDays ?? 3)));

  /* the same sums as the document page (doc.html: totals, planInfo, invoiceFlag) */
  function total(d){
    const subtotal = (d.items||[]).reduce((s,it)=>s + num(it.sessions)*num(it.cost), 0);
    let discount = d.discType==='amt' ? num(d.discValue) : subtotal * num(d.discValue) / 100;
    discount = Math.round(Math.min(Math.max(discount, 0), subtotal) * 100) / 100;
    return subtotal - discount;
  }
  function invState(inv, receipts){
    receipts = receipts || receiptsFor(inv.number);
    const tot = total(inv), t = today();
    const fromRcts = receipts.reduce((m, r) => Math.max(m, num(r.prevPaid) + num(r.received)), 0);
    const paid = Math.max(num(inv.paid), fromRcts), balance = Math.round((tot - paid) * 100) / 100;
    const st = {total:tot, paid, balance, text:'', cls:'', over:false, grace:false, paidUp: tot > 0 && balance <= 0.005};
    if(st.paidUp){ st.text = 'Paid'; st.cls = 'ok'; return st; }
    if(inv.plan === 'half'){
      const a1 = Math.round(tot * 50) / 100, d1 = inv.plan1 || inv.periodStart || inv.date || t;
      let mid = addDays(d1, 14);
      if(inv.periodStart && inv.periodEnd){ const days = dayDiff(inv.periodStart, inv.periodEnd) + 1, w = Math.round(days / 7); mid = w >= 2 ? addDays(inv.periodStart, Math.floor(w / 2) * 7) : addDays(inv.periodStart, Math.floor(days / 2)); }
      const d2 = inv.plan2 || mid;
      st.rows = [{short:'1st 50%', amt:a1, due:d1, paid: paid >= a1 - 0.005}, {short:'2nd 50%', amt:tot - a1, due:d2, paid: paid >= tot - 0.005}];
      const next = paid < a1 - 0.005 ? {n:1, short:'1st instalment', due:d1, left:a1 - paid} : {n:2, short:'2nd instalment', due:d2, left:tot - Math.max(paid, a1)};
      st.next = next; st.plan = true; st.firstPaid = paid >= a1 - 0.005;
      const end = addDays(next.due, grace());
      if(t > end){ st.over = true; st.text = `${next.short} overdue`; st.cls = 'rd'; }
      else if(t > next.due){ st.grace = true; st.text = `${next.short} in grace until ${nice(end)}`; st.cls = 'am'; }
      else { st.text = `${next.short} due ${nice(next.due)}`; st.cls = 'bl'; }
      return st;
    }
    if(inv.dueDate && t > inv.dueDate){ st.over = true; st.text = paid > 0 ? 'Balance overdue' : 'Overdue'; st.cls = 'rd'; }
    else { st.text = paid > 0 ? 'Part paid' : 'Not paid yet'; st.cls = 'bl'; }
    return st;
  }
  /* the documents one document is linked to: quote → invoice → receipts → card */
  function chainOf(d){
    const t = typeOf(d);
    let inv = t === 'invoice' ? d
      : t === 'quote' ? saved.find(x => x.type === 'invoice' && same(x.ref, d.number))
      : saved.find(x => x.type === 'invoice' && same(x.number, d.ref));
    if(!inv && t === 'card'){ const r = saved.find(x => x.type === 'receipt' && same(x.number, d.ref)); if(r) inv = saved.find(x => x.type === 'invoice' && same(x.number, r.ref)); }
    const quote = t === 'quote' ? d : inv && inv.ref ? saved.find(x => typeOf(x) === 'quote' && same(x.number, inv.ref)) : null;
    const receipts = inv ? saved.filter(x => x.type === 'receipt' && same(x.ref, inv.number)).sort((a,b)=>(a.date||'').localeCompare(b.date||'')) : (t === 'receipt' ? [d] : []);
    const card = inv ? saved.find(x => x.type === 'card' && (same(x.ref, inv.number) || receipts.some(r => same(x.ref, r.number)))) : (t === 'card' ? d : null);
    return {quote, inv, receipts, card};
  }
  function docStatus(d){
    const t = typeOf(d);
    if(t === 'invoice'){ const s = invState(d); return [s.text, s.cls]; }
    if(t === 'quote') return chainOf(d).inv ? ['Invoiced','ok'] : d.sentAt || d.waSentAt ? ['Sent','bl'] : ['Not sent','gr'];
    if(t === 'receipt') return ['Received','ok'];
    return (d.subjects||[]).some(s => !s.tutor) ? ['No tutor yet','am'] : ['Ready','ok'];
  }
  const byDate = (a, b) => (b.date||'').localeCompare(a.date||'') || (b.savedAt||0) - (a.savedAt||0);

  /* students: details kept once (lhq_students), filled in from their documents where missing */
  const DETAIL = ['name','level','school','parent','phone','email','address','heard'];
  function studentRecords(){ return store.get('lhq_students', {}); }
  function students(){
    const recs = studentRecords(), map = new Map();
    saved.forEach(d => { const key = sk(d.student || d.name); if(!key) return; if(!map.has(key)) map.set(key, {key, docs:[]}); map.get(key).docs.push(d); });
    Object.keys(recs).forEach(key => { if(!map.has(key)) map.set(key, {key, docs:[]}); });
    return [...map.values()].map(s => {
      s.docs.sort(byDate);
      const D = s.docs, rec = recs[s.key] || {}, pick = f => (D.find(d => d[f]) || {})[f] || '';
      s.name = rec.name || (D.find(d => d.student) || D[0] || {}).student || (D[0] || {}).name || s.key;
      s.parent = rec.parent || (D.find(d => d.name && d.name !== s.name) || {}).name || '';
      s.level = rec.level || pick('level'); s.phone = rec.phone || pick('phone'); s.email = rec.email || pick('email');
      s.address = rec.address || pick('address'); s.heard = rec.heard || '';
      s.school = rec.school || (D.find(d => d.type === 'card' && d.school) || {}).school || '';
      s.first = D.length ? D.map(d => d.date || '').filter(Boolean).sort()[0] : (rec.added || '');
      s.periods = D.filter(d => d.type === 'invoice').map(inv => {
        const receipts = D.filter(r => r.type === 'receipt' && same(r.ref, inv.number));
        const card = D.find(c => c.type === 'card' && (same(c.ref, inv.number) || receipts.some(r => same(c.ref, r.number))));
        const quote = D.find(q => typeOf(q) === 'quote' && same(q.number, inv.ref));
        return {inv, receipts, card, quote, st: invState(inv, receipts)};
      });
      s.cur = s.periods[0] || null;
      const quotes = D.filter(d => typeOf(d) === 'quote' && !s.periods.some(p => same(p.inv.ref, d.number)));
      s.openQuote = quotes.find(q => !s.cur || (q.date || '') >= (s.cur.inv.date || '')) || null;
      s.lastCard = D.find(d => d.type === 'card') || null;
      if(!s.cur) s.loneCard = s.lastCard;
      s.status = stuStatus(s);
      return s;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  function stuStatus(s){
    const t = today(), c = s.cur;
    if(c){
      const end = c.inv.periodEnd;
      if(c.st.over) return {k:'over', text:'Overdue', cls:'rd'};
      if(end && end < t) return s.openQuote ? {k:'quote', text:'Quote sent', cls:'bl'} : {k:'ended', text:'Ended', cls:'gr'};
      if(end && dayDiff(t, end) <= 7) return {k:'ending', text:'Ends soon', cls:'am'};
      if(c.card) return {k:'active', text:'Active', cls:'ok'};
      return {k:'progress', text:'In progress', cls:'bl'};
    }
    if(s.openQuote) return {k:'quote', text:'Quote sent', cls:'bl'};
    if(s.loneCard) return {k:'active', text:'Active', cls:'ok'};
    return {k:'new', text:'New', cls:'gr'};
  }
  function saveStudent(key, fields){
    const recs = studentRecords(), cur = recs[key] || {};
    DETAIL.forEach(f => { if(f in fields) cur[f] = String(fields[f] || '').trim(); });
    if(!cur.added) cur.added = today();
    let newKey = key;
    if(cur.name && sk(cur.name) !== key){ newKey = sk(cur.name); delete recs[key]; }
    recs[newKey] = cur; store.set('lhq_students', recs);
    return newKey;
  }

  /* people (kept from the last time the list was fetched) */
  function people(){ return store.get('lhq_people', []); }
  async function refreshPeople(){
    if(!window.hub || !hub.session()) return people();
    try{ const r = await hub.api('people', {method:'POST', body:JSON.stringify({action:'list'})}); store.set('lhq_people', r.people); return r.people; }catch(e){ return people(); }
  }

  window.HD = {store, esc, num, mk, mkShort, nice, range, ago, first, sk, same, today, addDays, dayDiff, parseISO, isoOf, MON, WORD, typeOf,
    me, isDir, can, ROLE, roleText, load, get saved(){ return saved; }, get settings(){ return settings; }, total, invState, chainOf, docStatus, byDate,
    students, studentRecords, saveStudent, DETAIL, people, refreshPeople};
})();
