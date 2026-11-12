/* LHQ Hub: reading the saved documents. Students, where each invoice stands, how documents link up,
   who is signed in and what they may do. Used by the Hub pages and the document page. */
(function(){
  /* who is signed in and the people list are read thousands of times a page (every permission check): parse them once per change */
  const RO = {lhq_session: 1, lhq_people: 1}, PC = {};
  const store = { get(k, d){ try{ const v = localStorage.getItem(k); if(!v) return d; if(RO[k]){ const c = PC[k]; if(c && c.v === v) return c.o; const o = JSON.parse(v); PC[k] = {v, o}; return o; } return JSON.parse(v); }catch(e){ return d; } },
                  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g,'')); return isNaN(n) ? 0 : n; };
  const mk = (n, d) => window.FX && FX.active() ? FX.usd(+n || 0, d) : 'MWK ' + Math.round(n).toLocaleString('en-US');   // $ only on money pages, when the Director chose MK / $
  const mkShort = (n, d) => { if(window.FX && FX.active()) return FX.usdShort(+n || 0, d); const a = Math.abs(n); return 'MWK ' + (a >= 1e6 ? (n/1e6).toFixed(2).replace(/\.?0+$/,'') + 'M' : a >= 1e4 ? Math.round(n/1e3) + 'k' : Math.round(n).toLocaleString('en-US')); };
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
  const ROLE = {director:'Director', admin:'Admin', tutor:'Tutor', student:'Student', parent:'Parent', bdo:'BDO'};
  const roleText = p => (ROLE[p.role] || (p.admin ? 'Admin' : 'Tutor')) + (p.role !== 'tutor' && p.tutor ? ' + Tutor' : '');

  let saved = [], settings = {};
  let rIdx = null;   // receipts by the invoice number they pay, built once per load (lists with thousands of documents stay quick)
  function load(){ saved = store.get('lhq_saved', []); settings = window.withDefaults ? withDefaults(store.get('lhq_settings', {})) : Object.assign({}, window.DEFAULT_SETTINGS || {}, store.get('lhq_settings', {})); rIdx = null; return saved; }
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
    const PR = (inv.plan === 'half' || inv.plan === 'set') && window.PAYPLAN ? PAYPLAN.rows(inv, tot, t) : null;
    if(PR){
      const nx = PAYPLAN.mark(PR, paid);
      st.rows = PR.map(r => ({short: r.n === 1 && inv.plan === 'half' ? '1st 50%' : r.n === 2 && inv.plan === 'half' ? '2nd 50%' : r.short, amt: r.amt, due: r.due, paid: r.paid}));
      const next = {n: nx.n, short: nx.short, due: nx.due, left: nx.left};
      st.next = next; st.plan = true; st.firstPaid = PR[0].paid;
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
  const DETAIL = ['name','level','school','parent','phone','email','address','area','district','heard'];
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
      s.address = rec.address || pick('address'); s.heard = rec.heard || ''; s.area = rec.area || pick('area'); s.district = rec.district || pick('district');
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

  /* make-up sessions for a tuition card, from tutors' session logs inside its period:
     owed = missed (student absent or tutor couldn't teach) + carried in from last period - make-ups taught */
  const nk = x => String(x || '').trim().toLowerCase().replace(/\s+/g, ' ');
  /* the session logs grouped by student + subject, read once per change (not once per card: with 3,000 logs that cost ~1 s a page on a phone) */
  let LG = {txt: null, by: new Map()};
  function sessionsByK(){
    let txt = null; try{ txt = localStorage.getItem('lhq_logs'); }catch(e){}
    if(txt === LG.txt) return LG.by;
    const by = new Map(); let L = null; try{ L = txt ? JSON.parse(txt) : null; }catch(e){}
    Object.values((L && L.e) || {}).forEach(e => { if(e && !e.x && e.ty === 's'){ if(!by.has(e.k)) by.set(e.k, []); by.get(e.k).push(e); } });
    LG = {txt, by}; return by;
  }
  function makeups(card){
    const BY = sessionsByK();
    const a = card.periodStart || '', b = card.periodEnd || '9999';
    return (card.subjects || []).map(s => {
      const k = nk(card.student) + '|' + nk(s.name), X = (BY.get(k) || []).filter(e => e.d >= a && e.d <= b);
      const missS = X.filter(e => e.a === 'absent').length, missT = X.filter(e => e.a === 'cancelled').length, made = X.filter(e => +e.mk).length, cf = +s.cf || 0;
      return {sub: s.name, tutor: s.tutor || '', missS, missT, made, cf, owed: Math.max(0, missS + missT + cf - made)};
    });
  }
  /* a logged session's confirmation: 'confirmed' | 'disputed' | 'settled' | 'auto' (48 h with no reply) | 'waiting' | null (missed, or not a session) */
  const CONFIRM_MS = 48 * 3600e3;
  function cfState(e, now){
    if(!e || e.x || e.ty !== 's' || e.a === 'absent' || e.a === 'cancelled') return null;
    if(e.cf && e.cf.s) return e.cf.s;
    return (now || Date.now()) - (e.c || e.at || 0) >= CONFIRM_MS ? 'auto' : 'waiting';
  }
  const cfLeft = e => Math.max(0, (e.c || e.at || 0) + CONFIRM_MS - Date.now());
  function sessionsToConfirm(){
    const L = store.get('lhq_logs', {e:{}}), E = Object.values((L && L.e) || {});
    return E.filter(e => ['waiting', 'disputed'].includes(cfState(e))).sort((a, b) => (a.d || '').localeCompare(b.d || ''));
  }
  window.HD = {store, cfState, cfLeft, sessionsToConfirm, esc, num, mk, mkShort, nice, range, ago, first, sk, same, today, addDays, dayDiff, parseISO, isoOf, MON, WORD, typeOf,
    me, isDir, can, ROLE, roleText, load, get saved(){ return saved; }, get settings(){ return settings; }, total, invState, chainOf, docStatus, byDate,
    students, studentRecords, saveStudent, DETAIL, people, refreshPeople, makeups};
})();
