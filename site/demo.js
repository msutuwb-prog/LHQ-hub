/* LHQ Hub demo data (previews only): six months of made-up students (about 40 at a time, averaging about MWK 700,000 a period at MWK 15,000 a session), quotes, invoices, receipts,
   tuition cards, session logs and SRAs, with every situation the Hub handles: paid, part-paid, in grace,
   overdue, ending this week, renewed, ended, quotes waiting, a card with no tutor, a deleted document.
   Everyone here is invented. Dates are worked out from today, so the demo always looks current. */
(function(){
  const DAY = 864e5;
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const norm = x => String(x||'').trim().toLowerCase().replace(/\s+/g,' '), nk0 = norm;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];

  const ADMINS = ['Wanangwa Msutu', 'Catherine Mkwinda'];
  const PEOPLE = [
    {name:'Catherine Mkwinda', role:'admin', pin:'1111', seen:Date.now() - 2 * 3600e3, perms:['quotes','cards','delete','restore','students','tutors','msgs','classes']},
    {name:'Benjamin Msutu', role:'admin', pin:'1111', seen:Date.now() - 3 * 3600e3, perms:['acct','receipts','money','tpay','spend','pl']},   /* the interim accountant, who also teaches (agreed 21 Nov) */
    {name:'Anna Navilati', role:'admin', pin:'1111', seen:Date.now() - 5 * 3600e3, perms:['bdo','ann']},   /* the interim Business Development Officer (agreed 22 Nov) */
    {name:'Emmanuel Mkwamba', role:'tutor', pin:'1111', seen:Date.now() - DAY},
    {name:'Ungweru Kaonga', role:'tutor', pin:'1111', seen:Date.now() - 3 * DAY},
    {name:'Maureen Story', role:'tutor', pin:'1111', seen:Date.now() - 5 * 3600e3},
    {name:'Chisomo Banda', role:'tutor', pin:'1111', seen:Date.now() - 6 * 3600e3},
    {name:'Grace Chinyama', role:'tutor', pin:'1111', seen:Date.now() - 26 * 3600e3},
    {name:'Peter Mvula', role:'tutor', pin:'1111', seen:Date.now() - 2 * DAY},
    {name:'Dalitso Phiri', role:'tutor', pin:'1111', seen:Date.now() - 4 * 3600e3},
    {name:'Joseph Nkhoma', role:'tutor', pin:'1111', seen:Date.now() - 30 * 3600e3},
    {name:'Mayamiko Goliati', role:'tutor', pin:'1111', active:false, seen:Date.now() - 40 * DAY},
  ];
  /* who teaches what (two tutors per subject, so the load is shared) */
  const POOL = {'Mathematics':['Ungweru Kaonga','Chisomo Banda'],'Pure Mathematics 1':['Ungweru Kaonga','Chisomo Banda'],'English':['Catherine Mkwinda','Grace Chinyama'],'English Language':['Catherine Mkwinda','Grace Chinyama'],
    'Physics':['Emmanuel Mkwamba','Peter Mvula'],'Chemistry':['Emmanuel Mkwamba','Dalitso Phiri'],'Science':['Peter Mvula','Dalitso Phiri'],'Biology':['Maureen Story','Dalitso Phiri'],
    'Business Studies':['Benjamin Msutu','Maureen Story'],'Economics':['Benjamin Msutu','Joseph Nkhoma'],'Accounting':['Joseph Nkhoma']};
  const tutorFor = (subj, i) => { const p = POOL[subj] || ['Grace Chinyama']; return p[i % p.length]; };
  /* LHQ's fee is MWK 15,000 a session for every level; what changes is how many sessions a student takes
     (days a week per subject, over a 4-week period: 5 days = 20 sessions) */
  const RATE = () => 15000;
  const WEEKDAYS = ['Mo','Tu','We','Th','Fr'];
  const DAYS = [['Mo','We','Fr'],['Tu','Th','Sa'],['Mo','Tu','Th'],['We','Fr','Sa'],['Mo','We','Th'],['Tu','Fr','Sa']];
  const TIMES = [['14:00','15:00'],['15:00','16:00'],['16:00','17:00'],['17:00','18:00'],['10:00','11:30']];
  /* a timetable that mostly works: each subject gets a time and days when its tutor and the student are both free (per
     tuition period); when nothing fits, a clash is left in, as happens in real life */
  const SLOTS = ['14:00','15:00','16:00','13:00','10:00','11:00','09:00','08:00','12:00'], WD6 = ['Mo','Tu','We','Th','Fr','Sa'], BUSY = {};
  const hh = t => String(+t.slice(0, 2) + 1).padStart(2, '0') + ':00';
  function place(a, b, tutor, stu, n, seed){
    const L = k => (BUSY[k] = BUSY[k] || []), T = tutor ? L('t:' + tutor) : [], S = L('s:' + stu);
    const taken = (X, ds) => X.some(x => x.ds === ds && x.a <= b && a <= x.b);
    const order = WD6.slice(seed % 6).concat(WD6.slice(0, seed % 6));
    for(const t of SLOTS){ const sun = t >= '14:00' && t <= '16:00' && seed % 5 === 0;   // LHQ opens Sunday 2–5 pm: some afternoon timetables use it
      const ok = (sun ? ['Su'].concat(order) : order).filter(d => !taken(T, d + t) && !taken(S, d + t)); if(ok.length >= n){
      const pickD = []; for(let i = 0; pickD.length < n && i < ok.length; i += Math.max(1, Math.floor(ok.length / n))) pickD.push(ok[i]); ok.forEach(d => { if(pickD.length < n && !pickD.includes(d)) pickD.push(d); });
      pickD.forEach(d => { if(tutor) T.push({a, b, ds: d + t}); S.push({a, b, ds: d + t}); }); return {days: WD6.concat('Su').filter(d => pickD.includes(d)), start: t, end: hh(t)}; } }
    return null;
  }
  /* the subject's tutors in turn, so a full timetable passes the student to the other tutor; if nobody is free, a clash stays */
  const placeAny = (a, b, subj, tutor, stu, n, seed) => { const P = tutor ? [tutor].concat((POOL[subj] || []).filter(x => x !== tutor)) : [''];
    for(const t of P){ const r = place(a, b, t, stu, n, seed); if(r) return Object.assign(r, {tutor: t}); } return {tutor: P[0], days: WEEKDAYS.slice(0, n), start: '16:00', end: '17:00'}; };
  const HEARD = ['A friend or family member','Instagram','Facebook','Study Smart Session','Their school','WhatsApp','Google','Sibling at LHQ'];
  const SCHOOLS = ['Bishop Mackenzie International School','The Lilongwe Academy International School','Sapitwa International School','Kamuzu Academy','St Andrew’s International High School','Phwezi Boys Secondary School','Lilongwe Private School','Saint Patrick’s Secondary School'];

  /* who, and how things stand today (s = what happens to their current period) */
  const STUDENTS = [
    ['Thando Banda','Year 10 · IGCSE','Mrs Banda',['Mathematics','Physics'],'ending',5,false],
    ['Natasha Banda','Year 8','Mrs Banda',['Mathematics','English'],'active',3,false,{disc:'Sibling',pct:10}],
    ['Chikondi Phiri','Year 9 · Checkpoint','Mr Phiri',['Science','Mathematics'],'overdue',4,true],
    ['Tamara Mwale','Year 12 · AS Level','Mrs Mwale',['Biology','Chemistry'],'quote_old'],
    ['Kondwani Zulu','Year 11 · IGCSE','Mr Zulu',['English Language','Mathematics'],'nocard',2,false],
    ['Lusungu Nyirenda','Year 13 · A Level','Dr Nyirenda',['Pure Mathematics 1','Economics'],'active',6,true],
    ['Mphatso Chirwa','Year 10 · IGCSE','Mrs Chirwa',['Chemistry','Biology'],'grace',3,true],
    ['Tiwonge Kamanga','Year 11 · IGCSE','Mr Kamanga',['Economics','Business Studies'],'active',5,false],
    ['Chisomo Mbewe','Year 7','Ms Mbewe',['Mathematics','English'],'ended',3,false],
    ['Kettie Gondwe','Year 11 · IGCSE','Mrs Gondwe',['Physics','Chemistry','Mathematics'],'active',4,true],
    ['Pemphero Kumwenda','Year 9 · Checkpoint','Mr Kumwenda',['English','Science'],'ending',2,false],
    ['Wezi Msiska','Year 12 · AS Level','Mrs Msiska',['Physics','Pure Mathematics 1'],'active',2,false],
    ['Madalitso Tembo','Year 10 · IGCSE','Mr Tembo',['Mathematics','Physics','Chemistry'],'notutor',1,false],
    ['Takondwa Mhango','Year 8','Mrs Mhango',['Science','Mathematics'],'ended',2,false],
    ['Yamikani Chimwaza','Year 11 · IGCSE','Mr Chimwaza',['Biology','Chemistry'],'overdue_full',2,false],
    ['Thoko Moyo','Year 13 · A Level','Mrs Moyo',['Economics','Pure Mathematics 1','Biology'],'active',6,false],
    ['Limbani Kalua','Year 10 · IGCSE','Mr Kalua',['English Language','Mathematics'],'unpaid_new',1,false],
    ['Atupele Mwakasungula','Year 9 · Checkpoint','Ms Mwakasungula',['Mathematics','Science'],'quote_new'],
    ['Kumbukani Phiri','Year 12 · AS Level','Mr Phiri',['Chemistry','Pure Mathematics 1'],'quote_old2'],
    ['Faith Ngwira','Year 7','Mrs Ngwira',['English','Mathematics','Science'],'active',4,false],
    ['Brian Chaponda','Year 11 · IGCSE','Mr Chaponda',['Business Studies','Economics','Mathematics'],'ended',4,true],
    ['Ruth Kachingwe','Year 10 · IGCSE','Mrs Kachingwe',['Physics','Mathematics'],'renewed',3,false],
  ];
  /* more students, so a month looks like LHQ's real size (30 to 50 students) */
  const FIRST = ['Chimwemwe','Dalitso','Kondwani','Luntha','Mwayi','Tadala','Taonga','Tawonga','Uchizi','Watipa','Zikomo','Alinafe','Bwalo','Chifundo','Eneya','Flora','Gift','Hope','Innocent','Jabulani','Khumbo','Lonjezo','Martha','Ndaona','Owen','Precious','Rhoda','Sangwani','Thokozani','Vitumbiko'];
  const LAST = ['Banda','Phiri','Mwale','Zulu','Nyirenda','Chirwa','Kamanga','Gondwe','Tembo','Moyo','Kalua','Ngwira','Mvula','Nkhoma','Msiska','Kumwenda','Chisale','Munthali','Kaunda','Mkandawire','Lungu','Mtonga','Chibwana','Kapalamula'];
  const LEVELS = ['Year 7','Year 8','Year 9 · Checkpoint','Year 10 · IGCSE','Year 10 · IGCSE','Year 11 · IGCSE','Year 11 · IGCSE','Year 12 · AS Level','Year 13 · A Level'];
  const SUBJ = l => /AS Level|A Level/.test(l) ? ['Pure Mathematics 1','Physics','Chemistry','Biology','Economics'] : /IGCSE/.test(l) ? ['Mathematics','Physics','Chemistry','Biology','English Language','Economics','Business Studies'] : ['Mathematics','English','Science'];
  (function(){
    let r = 99; const R = () => (r = (r * 48271) % 2147483647) / 2147483647, P = a => a[Math.floor(R() * a.length)];
    const used = new Set(STUDENTS.map(x => x[0]));
    for(let i = 0; i < 30; i++){
      let name; do { name = P(FIRST) + ' ' + P(LAST); } while(used.has(name)); used.add(name);
      const level = P(LEVELS), pool = SUBJ(level).slice(), subs = [];
      const x = R(), n = x < .03 ? 1 : x < .22 ? 2 : x < .66 ? 3 : 4;
      while(subs.length < Math.min(n, pool.length)) subs.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
      const sit = i < 26 ? 'active' : 'ended';
      STUDENTS.push([name, level, P(['Mr','Mrs','Ms','Dr']) + ' ' + name.split(' ')[1], subs, sit, 2 + Math.floor(R() * 5), R() < .3]);
    }
  })();
  const listFor = (level, subj) => {
    const l = level.toLowerCase(), y = +((l.match(/year\s*(\d+)/)||[])[1] || 0);
    const L = /a\s*level|\bas\b/.test(l) || y >= 12 ? 'A Level' : /igcse/.test(l) || y === 10 || y === 11 ? 'IGCSE' : y >= 7 && y <= 9 ? 'Lower Secondary (Years 7–9)' : 'Primary (Year 6)';
    return window.TOPICS && TOPICS[L] && TOPICS[L][subj] ? L + '|' + subj : '';
  };
  const topicsOf = key => {
    if(!key || !window.TOPICS) return ['Revision'];
    const [L, n] = key.split('|'), set = TOPICS[L][n];
    return set.topics.map(t => typeof t === 'string' ? t : t.t).filter(Boolean);
  };

  function build(){
    seed = 7;
    const now = new Date(); now.setHours(9, 0, 0, 0);
    const T = now.getTime(), at = (days, h = 10) => { const d = new Date(T + days * DAY); d.setHours(h, Math.floor(rnd() * 59), 0, 0); return d; };
    const docs = [], logs = {}, recs = {};
    const targets = {};
    let uid = 0; const id = () => 'demo' + (++uid).toString(36) + Math.floor(rnd() * 1e6).toString(36);
    const by = () => pick(ADMINS);
    function mk(type, dayOff, s, extra){
      const d = at(dayOff), who = extra.who || by();
      const doc = Object.assign({id:id(), type, number:'', date:iso(d), dueDate:'', ref:'', name:s.parent, student:s.name, level:s.level, address:s.address, email:s.email, phone:s.phone,
        forWhat:`${s.name.split(' ')[0]}'s Tuition`, periodStart:'', periodEnd:'', period:'', items:[], discType:'pct', discValue:'', discReason:'', paid:'', received:'', prevPaid:'',
        method:'Bank transfer', payRef:'', receivedBy:'', school:'', exam:'', where:'', cardNote:'', subjects:[], intake:'', checklistId:'', incOff:[], plan:'', plan1:'', plan2:'', noInstLine:false,
        savedAt:d.getTime(), createdBy:who, updatedBy:who, updatedAt:d.getTime(), log:[{a:'created', by:who, at:d.getTime(), from:extra.from || ''}]}, extra.f || {});
      delete doc.who;
      if(extra.send && dayOff <= -0.02){ const w = d.getTime() + 12 * 60e3; doc.waSentAt = w; doc.waSentTo = s.phone; doc.log.push({a:'whatsapp', by:who, at:w, to:s.phone}); }
      docs.push(doc); return doc;
    }
    STUDENTS.forEach(([name, level, parent, subjects, sit, periods, plan, opt], si) => {
      const first = name.split(' ')[0];
      const s = {name, level, parent, phone:'09' + String(91000000 + si * 731117 % 8999999).slice(0, 8).replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3'),
        email: rnd() < 0.7 ? norm(parent).replace(/[^a-z]/g, '') + si + '@gmail.com' : '', address:pick(['Area 10','Area 43','Area 47','Area 12','Area 3','Area 18','Area 9']) + ', Lilongwe',
        school:SCHOOLS[si % SCHOOLS.length], heard: name === 'Natasha Banda' ? 'Sibling at LHQ' : pick(HEARD)};
      const cost = RATE(level);
      const perWeek = subjects.map((x, i) => subjects.length >= 4 ? [2,3,2,3][(si + i) % 4] : [3,3,2,4][(si + i) % 4]);
      const items = subjects.map((x, i) => ({desc:x, days:String(perWeek[i]), sessions:String(perWeek[i] * 4), cost:String(cost)}));
      const disc = opt && opt.disc ? {discType:'pct', discValue:String(opt.pct), discReason:opt.disc} : {};
      const total = items.reduce((a, it) => a + (+it.sessions) * cost, 0) * (1 - ((opt && opt.pct) || 0) / 100);
      // quotes only
      if(/^quote/.test(sit)){
        const off = sit === 'quote_new' ? -2 : sit === 'quote_old' ? -17 : -11;
        mk('quote', off, s, {send:true, f:{items, dueDate:iso(at(off + 30)), periodStart:iso(at(off + 9)), periodEnd:iso(at(off + 9 + 25)), ...disc}});
        recs[norm(name)] = {name, level, school:s.school, parent, phone:s.phone, email:s.email, address:s.address, heard:s.heard, added:iso(at(off))};
        return;
      }
      // where the current period sits relative to today
      const curStart = {ending:-21, overdue:-19, grace:-15, nocard:-3, notutor:-6, overdue_full:-10, unpaid_new:5, renewed:4, ended:-60 - si % 3 * 9}[sit] ?? -(2 + si % 19);
      const n = periods || 1;
      let lastCard = null;
      const slot = DAYS[si % DAYS.length], time = TIMES[si % TIMES.length];
      for(let k = n - 1; k >= 0; k--){
        const ps = curStart - 28 * k, pe = ps + 25, isFirst = k === n - 1, isCur = k === 0;
        let quote = null;
        if(isFirst) quote = mk('quote', ps - 9, s, {send:true, f:{items, dueDate:iso(at(ps + 21)), periodStart:iso(at(ps)), periodEnd:iso(at(pe)), ...disc}});
        const invDay = isFirst ? ps - 5 : ps - 6;
        const inv = mk('invoice', invDay, s, {send:true, from: quote ? '@' + quote.id : '', f:{items, ref: quote ? '@' + quote.id : '', dueDate: sit === 'unpaid_new' && isCur ? iso(at(invDay + 7)) : iso(at(invDay)),
          periodStart:iso(at(ps)), periodEnd:iso(at(pe)), plan: plan ? 'half' : '', ...disc}});
        // payments
        const pays = [];
        if(!(isCur && (sit === 'unpaid_new' || sit === 'overdue_full'))){
          if(plan){ pays.push([invDay + 1, total / 2]); if(!(isCur && (sit === 'overdue' || sit === 'grace'))) pays.push([ps + 13, total / 2]); }
          else pays.push([invDay + (rnd() < .5 || invDay > -3 ? 0 : 2), total]);
        }
        if(isCur && sit === 'overdue_full'){ inv.dueDate = iso(at(invDay)); }
        let paid = 0;
        pays.forEach(([day, amt]) => {
          if(day > 0) return;
          const who = by();
          mk('receipt', day, s, {who, from:'@' + inv.id, f:{items, ref:'@' + inv.id, received:String(amt), prevPaid: paid ? String(paid) : '', method:pick(['Bank transfer','Airtel Money','TNM Mpamba','Cash']),
            payRef: 'FT' + Math.floor(rnd() * 1e8), receivedBy:who, periodStart:inv.periodStart, periodEnd:inv.periodEnd, plan:inv.plan, ...disc}});
          paid += amt;
          const t = at(day).getTime(); inv.paid = String(paid); inv.savedAt = Math.max(inv.savedAt, t); inv.updatedBy = who; inv.log.push({a:'paid', by:who, at:t, amount:String(paid)});
        });
        // tuition card
        if(!(isCur && sit === 'nocard') && !(isCur && sit === 'unpaid_new') && invDay + 2 < 0){
          const subs = subjects.map((x, i) => { const tu = sit === 'notutor' && i === 0 ? '' : (si % 7 === 3 && x === 'Mathematics' && k > 1 ? 'Mayamiko Goliati' : tutorFor(x, si + i)), pl = placeAny(inv.periodStart, inv.periodEnd, x, tu, name, perWeek[i], si + i); return {name:x, list:listFor(level, x), tutor: pl.tutor,
            days: pl.days, perWeek:String(perWeek[i]), sessions:String(perWeek[i] * 4), mins:'1 hour', start:pl.start, end:pl.end, tier: /IGCSE/.test(level) && ['Mathematics','Physics','Chemistry','Biology'].includes(x) ? 'Extended' : '',
            mode:'full', picks:{}, details:{}, custom:[], grade: pick(['B','C','C','D','A','']), basis: 'End of term results', when:'', note:'', openCh:''}; });
          lastCard = mk('card', invDay + 3, s, {from:'@' + inv.id, f:{ref:'@' + inv.id, school:s.school, where:pick(['LHQ Centre','LHQ Centre','Online']), exam: /IGCSE|A Level|AS/.test(level) ? 'May/June 2027' : '',
            cardNote: k === n - 1 ? pick(['Prefers worked examples first.','Shy in class; ask questions directly.','Strong at theory, needs exam practice.','Has a mock exam in late November.']) : (lastCard ? lastCard.cardNote : ''),
            subjects:subs, periodStart:inv.periodStart, periodEnd:inv.periodEnd, level}});
        }
      }
      recs[norm(name)] = {name, level, school:s.school, parent, phone:s.phone, email:s.email, address:s.address, heard:s.heard, added:iso(at(curStart - 28 * (n - 1) - 9))};
    });
    // renewal already made for Ruth (next period invoice, paid)
    // numbering in date order
    docs.sort((a, b) => a.savedAt - b.savedAt || a.date.localeCompare(b.date));
    const C = {quote:1000, invoice:0, receipt:0, card:0}, P = {quote:'Q', invoice:'INV', receipt:'RCT', card:'TC'}, byId = {};
    docs.slice().sort((a, b) => a.date.localeCompare(b.date) || a.log[0].at - b.log[0].at).forEach(d => { C[d.type]++; d.number = P[d.type] + '-' + String(C[d.type]).padStart(4, '0'); byId[d.id] = d; });
    docs.forEach(d => {
      if(d.ref && d.ref[0] === '@') d.ref = byId[d.ref.slice(1)].number;
      d.log.forEach(e => { if(e.from && e.from[0] === '@') e.from = byId[e.from.slice(1)].number; });
      const t = d.items.reduce((a, it) => a + (+it.sessions) * (+it.cost), 0);
      d.total = t - (d.discValue ? t * d.discValue / 100 : 0);
      if(d.type === 'receipt') d.receivedAmt = +d.received;
    });
    // a deleted duplicate receipt, for Recently deleted
    const dupOf = docs.find(d => d.type === 'receipt');
    const trash = dupOf ? [Object.assign(JSON.parse(JSON.stringify(dupOf)), {id:'demodup', number:'RCT-' + String(C.receipt + 1).padStart(4, '0'), deletedBy:'Catherine Mkwinda', deletedAt:T - 2 * DAY})] : [];

    // two clashes on purpose, to try the clash tools: one tutor with two students in the same subject at once (maybe a group),
    // and one tutor with two different subjects at once
    { const td = iso(now), cur = docs.filter(d => d.type === 'card' && d.periodEnd >= td && d.periodStart <= td);
      const lines = []; cur.forEach(c => (c.subjects || []).forEach(x => x.tutor && lines.push({c, x})));
      const same = lines.find(p => lines.some(q => q.c !== p.c && q.x.tutor === p.x.tutor && q.x.name === p.x.name));
      if(same){ const q = lines.find(q => q.c !== same.c && q.x.tutor === same.x.tutor && q.x.name === same.x.name); q.x.days = same.x.days.slice(); q.x.start = same.x.start; q.x.end = same.x.end; }
      const diff = lines.find(p => p !== same && lines.some(q => q.c !== p.c && q.x.tutor === p.x.tutor && q.x.name !== p.x.name));
      if(diff){ const q = lines.find(q => q.c !== diff.c && q.x.tutor === diff.x.tutor && q.x.name !== diff.x.name); q.x.days = [diff.x.days[0]].concat(q.x.days.filter(d => d !== diff.x.days[0])).slice(0, q.x.days.length); q.x.start = diff.x.start; q.x.end = diff.x.end; } }
    // tutors' session logs and SRAs for the last 8 weeks
    const DN = {Su:0, Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6}, imports = [];
    docs.filter(d => d.type === 'card').forEach(card => {
      card.subjects.forEach(sub => {
        if(!sub.tutor) return;
        const key = norm(card.student) + '|' + norm(sub.name), topics = topicsOf(sub.list);
        /* a target for most subjects (LHQ sets them until students have accounts) */
        if(!targets[key] && rnd() < .7){ const lv = String(sub.list || '').split('|')[0], ex = {'Primary (Year 6)':'P','Lower Secondary (Years 7–9)':'L','IGCSE':'I','A Level':'A'}[lv];
          if(ex){ const G = ex === 'P' || ex === 'L' ? ['High','Good','Outstanding'] : ex === 'A' ? ['A','B','C'] : ['A*','A','B','C']; targets[key] = {g: pick(G), ex, code: '', as: ex === 'A' ? 1 : 0, by: 'Wanangwa', role: 'lhq', at: T - 5 * DAY}; } }
        const start = Math.max(new Date(card.periodStart).getTime(), T - 28 * DAY), end = Math.min(new Date(card.periodEnd).getTime() + DAY, T);
        let ti = Math.floor(rnd() * 3), n = 0, wn = 0; const wb = 42 + Math.floor(rnd() * 30), wt = rnd() < .7 ? 3 : -2;
        for(let t = start; t < end; t += DAY){
          const d = new Date(t); if(!sub.days.some(x => DN[x] === d.getDay())) continue;
          n++;
          let a = rnd() < .08 ? 'absent' : rnd() < .06 ? 'late' : 'attended'; const eid = 'dl' + (++uid).toString(36);
          if(uid % 37 === 11) a = 'cancelled';   // now and then a cancelled session: by the tutor, LHQ or the student (no extra random draws)
          const e = {id:eid, k:key, st:card.student, sub:sub.name, d:iso(d), ty:'s', a, tp: a === 'absent' || a === 'cancelled' ? [] : [topics[ti % topics.length]], at:t + 18 * 3600e3, tutor:sub.tutor};
          if(a === 'cancelled') e.cb = ['tutor', 'lhq', 'student'][uid % 3];
          { const tt = (sub.times && sub.times[Object.keys(DN).find(x => DN[x] === d.getDay())]) || {s: sub.start, e: sub.end};   // logged times: mostly on time, sometimes a late start or early finish
            if(tt.s && tt.e && a !== 'absent' && a !== 'cancelled'){ const sh = (hm, n) => { const m = +hm.slice(0, 2) * 60 + +hm.slice(3, 5) + n; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
              e.t1 = sh(tt.s, uid % 13 === 0 ? 12 : uid % 7 === 0 ? 3 : 0); e.t2 = sh(tt.e, uid % 17 === 0 ? -8 : 0); } }
          if(a !== 'absent' && n % 4 === 0){ e.mx = 20; e.sc = 9 + Math.floor(rnd() * 12); }
          logs[eid] = e;
          // a weekly assessment about every third session, drifting up (most students) or down
          if(a !== 'absent' && n % 3 === 0){ const wid = 'dw' + (++uid).toString(36), p0 = Math.max(15, Math.min(98, wb + wn * wt + Math.round(rnd() * 10 - 5)));
            logs[wid] = {id:wid, k:key, st:card.student, sub:sub.name, d:iso(d), ty:'w', ak: wn % 4 === 3 ? 'm' : wn % 7 === 5 ? 'p' : 'w', tp:[topics[ti % topics.length]], mx:50, sc:Math.round(p0 / 2), wid:'w' + wid, md:iso(d), at:t + 18 * 3600e3, tutor:sub.tutor}; wn++; }
          if(a !== 'absent' && n % 2 === 0){
            // topic finished: SRA reviews 1, 3, 7 and 14 days later
            const topic = topics[ti % topics.length]; e.fin = [topic];   // its Learning Day: the SRA schedule starts here
            [1, 3, 7, 14].forEach((g, ri) => {
              const rt = t + g * DAY; if(rt >= T) return;
              const h = rnd() < .78 ? 'o' : rnd() < .6 ? 'l' : 'm', rid = 'dr' + (++uid).toString(36);
              const r = {id:rid, k:key, st:card.student, sub:sub.name, d:iso(new Date(rt)), ty:'r', v:2, tk:topic, rv:ri + 1, h, at:rt + 17 * 3600e3, tutor:sub.tutor};
              if(h !== 'm'){ r.mx = 10; r.sc = 4 + Math.floor(rnd() * 7);
                // the ARS before it: out of the topic's objectives; about 1 in 9 without one (no extra random draws, so the rest of the demo stays the same)
                const hv = (uid * 7919) % 100, ao = 4 + topic.length % 5; if(hv < 11) r.na = 1; else { r.ao = ao; r.ars = Math.max(0, Math.min(ao, Math.round((r.sc / 10 * ao - 0.5 + (hv % 3) * 0.5) * 2) / 2)); } }
              logs[rid] = r;
            });
            ti++;
          }
        }
        // an assessment scheduled ahead for about one in four current subjects (monthly or mock)
        if(new Date(card.periodEnd).getTime() > T + 7 * DAY && rnd() < .25){
          for(let t = T + 3 * DAY, i = 0; i < 14; i++, t += DAY){ const d = new Date(t); if(!sub.days.some(x => DN[x] === d.getDay())) continue;
            const aid = 'da' + (++uid).toString(36), mock = rnd() < .3;
            logs[aid] = {id:aid, k:key, st:card.student, sub:sub.name, d:iso(d), ty:'a', s: sub.start || '', ak: mock ? 'p' : 'm', tp: mock ? [] : topics.slice(0, 2), mx: mock ? 80 : 50, ag:'g' + aid, at:T - DAY, tutor:sub.tutor}; break; }
        }
        if(n > 3){
          const cid = 'dc' + (++uid).toString(36);
          logs[cid] = {id:cid, k:key, st:card.student, sub:sub.name, d:iso(new Date(end - 2 * DAY)), ty:'c', at:end, tutor:sub.tutor,
            cs: pick(['Works steadily and asks good questions.','Strong on recall; quick with calculations.','Good written answers; clear explanations.']),
            ci: pick(['Show all working in longer questions.','Read questions twice before answering.','Practise timed past-paper questions.']),
            cn: pick(['Next: past paper practice on the last two topics.','Next: start the following topic and review the SRA mistakes.','Next: a topical test in two weeks.'])};
        }
      });
    });
    [...new Set(Object.values(logs).map(e => e.tutor))].forEach(t => imports.push({t, at:T - Math.floor(rnd() * 3) * DAY, n:Object.values(logs).filter(e => e.tutor === t).length}));

    const money = spending(docs, now);
    /* SRAs handed out on (mostly) their day, and make-ups booked for missed sessions */
    const makeups = {}, tIso = iso(new Date(T));
    try{ if(window.SCHED && window.SRA){ const its = SCHED.items(docs.filter(d => d.type === 'card'), tIso);
      SRA.build(its, Object.values(logs), tIso).filter(x => x.stage > 0 && x.giveOn < tIso && x.status !== 'after').forEach(x => { const r = rnd(); if(r < .07) return; const it = its.find(i => i.k === x.k); if(!it) return;
        const d = r < .12 ? new Date(Date.parse(x.giveOn + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10) : x.giveOn, id = 'dg' + (uid++).toString(36);
        if(d >= tIso) return; logs[id] = {id, ty:'g', k:x.k, st:x.st, sub:x.sub, d, tk:x.topic, rv:x.stage, tutor:it.tutor, c:Date.parse(d + 'T13:00:00Z'), at:Date.parse(d + 'T13:00:00Z')}; }); } }catch(e){ console.warn('demo SRAs', e); }
    Object.values(logs).filter(e => e && e.ty === 's' && !e.mk && (e.a === 'absent' || e.a === 'cancelled') && e.d < tIso).forEach(e => { const r = rnd(); if(r < .12) return;
      const id = 'mu' + (uid++).toString(36), lag = r < .2 ? 9 : 1 + Math.floor(rnd() * 4), at = Date.parse(e.d + 'T12:00:00Z') + lag * 864e5, d = new Date(at + 3 * 864e5).toISOString().slice(0, 10);
      const taken = h => Object.values(makeups).some(m => m.st === e.st && m.d === d && m.s === h + ':00'), h = [15, 16, 17, 14].find(x => !taken(x)) || 15;   // never two make-ups for one student at the same time
      makeups[id] = {id, k:e.k, st:e.st, sub:e.sub, tutor:e.tutor, d, s:h + ':00', e:h + ':50', why:'', status: d < tIso ? 'ok' : 'asked', at, by:e.tutor}; });
    /* tutors' daily reports: sent on most days they taught (a few late or missing) */
    const treps = {}; const days = {}; Object.values(logs).forEach(e => { if(e && e.ty === 's' && e.tutor && e.d < iso(new Date(T))) days[e.tutor + '|' + e.d] = 1; });
    Object.keys(days).forEach(k => { const [tutor, d] = k.split('|'), r = rnd(); if(r < .08) return; const id = 'tr' + (uid++).toString(36);
      treps[id] = {id, tutor, d, sent: Date.parse(d + 'T14:30:00Z') + (r < .14 ? 864e5 : 0), at: Date.parse(d + 'T14:30:00Z'), rate: 4, comment: '', req: []}; });
    /* requisitions at each step: to price, priced, approved, bought, declined (agreed 21 Nov: tutor asks → accountant prices → Director approves → accountant buys) */
    const lhq_reqs = {}, RQ = [['Whiteboard markers', '6', null], ['Printer paper (reams)', '5', {s: 'priced', each: 9000}], ['Chemistry practical kit', '1', {s: 'approved', each: 85000}], ['Graph books', '10', {s: 'declined', note: 'We have some in the office'}], ['Calculator batteries', '4', null]];
    Object.values(treps).sort((a, b) => b.d.localeCompare(a.d)).filter(t => t.d < tIso).slice(0, RQ.length).forEach((t, i) => { const [item, qty, dec] = RQ[i]; t.req = [{item, qty}];
      if(dec){ const q = +qty, v = Object.assign({}, dec, dec.each ? {qty: q, total: dec.each * q, supplier: 'Bookland', pricedBy: 'Benjamin Msutu', pricedAt: t.at + 3600e3} : {}, dec.s !== 'priced' ? {by: 'Wanangwa Msutu', at: t.at + 7200e3} : {});
        if(nk0(t.tutor) === 'benjamin msutu') v.own = 1; lhq_reqs[t.id + '#0'] = v; } });
    /* students' focus rounds and a study block or two */
    const lhq_focus = {}, lhq_plan = {}, SB = ['Mathematics','Physics','Chemistry','Biology','English'];
    Object.keys(recs).forEach((k, i) => { const L = []; for(let n = 1; n <= 24; n++){ if(rnd() < .45) continue; const d = iso(new Date(T - n * DAY)); L.push({d, m: (i + n) % 3 ? 25 : 50, sub: SB[(i + n) % 5], tk: '', at: T - n * DAY}); } lhq_focus[k] = L;
      if(i % 2 === 0) lhq_plan[k] = {bdemo1: {id: 'bdemo1', name: 'Revision', type: 'rev', sub: SB[i % 5], s: '19:00', e: '20:00', rep: 'weekdays', days: [], from: iso(new Date(T - 20 * DAY)), until: '', at: T - 20 * DAY},
        bdemo2: {id: 'bdemo2', name: 'Football', type: 'act', sub: '', s: '16:00', e: '17:30', rep: 'days', days: [3, 6], from: iso(new Date(T - 20 * DAY)), until: '', busy: 1, sh: 'busy', rem: [15], at: T - 20 * DAY},
        bdemo3: {id: 'bdemo3', all: 1, name: 'School sports day', type: 'school', sub: '', from: iso(new Date(T + 7 * DAY)), to: '', busy: 1, sh: 'all', cd: 1, at: T - 20 * DAY}}; });
    /* follow-ups on weak topics (no random draws, so the rest of the demo stays the same) and objectives on recent ARSs where the topic is a syllabus chapter */
    const chap = tk => { for(const L of Object.keys(window.TOPICS || {})) for(const n of Object.keys(TOPICS[L])){ const c = ((TOPICS[L][n] || {}).topics || []).find(t => t && t.sub && t.t === tk); if(c) return c.sub.map(x => x.t); } return null; };
    Object.values(logs).forEach((e, i) => { if(e.ty !== 'r' || e.na || !(+e.ao > 0) || e.d < iso(new Date(T - 45 * DAY))) return; const L = chap(e.tk); if(!L) return;
      const om = {}; L.forEach((n, j) => { const h = (i * 31 + j * 17) % 10; om[n] = h < 6 ? 2 : h < 8 ? 1 : 0; }); e.om = om; e.ao = L.length; e.ars = L.reduce((a, n) => a + om[n], 0) / 2; });
    const lhq_fu = {}, pcOf = e => e.mx ? Math.round(e.sc / e.mx * 100) : null, seenFu = new Set(), ACTS = ['retest', 'reteach', 'take'];
    const FC = Object.values(logs).filter(e => e.ty === 'r' && e.h !== 'm' && pcOf(e) != null && pcOf(e) < 60 && e.d >= iso(new Date(T - 40 * DAY)) && e.d <= iso(new Date(T - 3 * DAY))).sort((a, b) => a.d.localeCompare(b.d)).filter(e => { const key = e.k + '|' + e.tk; if(seenFu.has(key)) return false; seenFu.add(key); return true; });
    FC.slice(0, 8).concat(FC.length > 14 ? FC.slice(-6) : []).forEach((e, i) => {
      const act = ACTS[i % 3], id = 'fdemo' + i, by = iso(new Date(new Date(e.d + 'T12:00:00').getTime() + (act === 'take' ? 7 : 14) * DAY)), f = {id, k: e.k, st: e.st, sub: e.sub, tk: e.tk, act, tutor: e.tutor, set: e.d, by, foc: '', before: pcOf(e), at: new Date(e.d + 'T18:00:00').getTime()};
      if(act === 'retest' && by < iso(now) && i % 4) f.res = {pc: Math.min(100, pcOf(e) + (i % 2 ? 22 : 4)), d: by, at: f.at + 14 * DAY};
      if(act === 'take' && i % 2) f.th = {pc: 70 + i % 20, d: by};
      lhq_fu[id] = f; });
    /* bank rates (MWK per USD) for the MK / $ button: a slow drift over the last 12 months, no random draws */
    const lhq_fx = {days: {}, fix: {}, src: 'demo'}; for(let i = 365; i >= 0; i -= 1){ const d = iso(new Date(T - i * DAY)); lhq_fx.days[d] = Math.round((1735 + (365 - i) * 0.045 + Math.sin(i / 9) * 0.6) * 100) / 100; }
    const NEW = newParts(T, docs, recs);
    return {docs, trash, people:PEOPLE, kv:{...NEW, lhq_fx, lhq_fu, lhq_focus, lhq_plan, lhq_treps:{e:treps}, lhq_makeups:makeups, lhq_students:recs, lhq_logs:{e:logs, imports}, lhq_counters:{quote:C.quote, invoice:C.invoice, receipt:C.receipt + 1, card:C.card}, lhq_spend:money.spend, lhq_budget:money.budget, lhq_targets:targets, lhq_reqs, lhq_pay:{rules: {trBy: {'catherine mkwinda': 15000, 'emmanuel mkwamba': 3000}},
      place: Object.fromEntries([...new Set(Object.values(POOL).flat())].map(n => [n.toLowerCase(), [{p: ['Catherine Mkwinda','Emmanuel Mkwamba'].includes(n) ? 'full' : 'part', from: '2026-01-01'}]])),
      items: {pi1: {id: 'pi1', tutor: 'Peter Mvula', m: iso(new Date(T)).slice(0, 7), kind: 'advance', amt: 30000, label: 'Advance', d: iso(new Date(T - 4 * DAY)), by: 'Wanangwa Msutu', at: T - 4 * DAY},
        pi2: {id: 'pi2', tutor: 'Emmanuel Mkwamba', m: iso(new Date(T)).slice(0, 7), kind: 'allowance', amt: 10000, label: 'Transport · exam invigilation', d: iso(new Date(T - 2 * DAY)), by: 'Wanangwa Msutu', at: T - 2 * DAY}}}}};
  }
  /* Release 2 parts (22 Nov): the plan, partners and children, enquiries, announcements, calendar entries, jobs, staff pay, app feedback and admin's reports.
     "@Name" stands for that person's id; the server swaps it in when the demo loads. */
  function newParts(T, docs, recs){
    const d = n => iso(new Date(T + n * DAY)), t0 = d(0), ym = t0.slice(0, 7), fy = +t0.slice(5, 7) >= 9 ? +t0.slice(0, 4) : +t0.slice(0, 4) - 1;
    const R = docs.filter(x => x.type === 'receipt' && +x.received > 0), first = {}; R.forEach(r => { const k = norm(r.student); if(!first[k] || r.date < first[k]) first[k] = r.date; });
    const S = Object.values(recs), schools = [...new Set(S.map(r => r.school).filter(Boolean))];
    const it = (o, x) => (o[x.id] = x, o);
    const bplan = [
      {id:'conf', fy, cap:180, centres:1, centre:'Area 47', junLeave:25, low:85, high:115, grow:{enq:30, fee:8, enrol:2, kept:1, partners:40, places:30}, comm:25000, bdoShare:50, tutorSes:60, vis:{'@Anna Navilati':{pp:1, planner:1}, '@Benjamin Msutu':{costs:1, streams:1}}, bdoT:{enq:6, enrolPct:40, partners:2, kids:20, toTuition:15, visits:3}},
      {id:'s:inp', name:'Weekly tuition', kind:'tuition', mode:'inp', status:'running', students0:34, enqM:8, enrol:35, kept:86, fee:180000, ses:8, rate:8000, ord:1},
      {id:'s:onl', name:'Weekly tuition', kind:'tuition', mode:'onl', status:'running', students0:6, enqM:2, enrol:30, kept:82, fee:150000, ses:8, rate:7000, ord:2},
      {id:'s:ft', name:'Fast Track', kind:'prog', mode:'inp', status:'running', runs:2, places:12, fill:70, feePlace:180000, costRun:900000, months:'1,7', match:'fast track', ord:3},
      {id:'s:mar', name:'IGCSE Marathon', kind:'prog', mode:'inp', status:'running', runs:1, places:20, fill:90, feePlace:180000, costRun:1200000, months:'4', match:'marathon', ord:4},
      {id:'s:par', name:'Partner activities', kind:'partner', mode:'none', status:'running', arr:'lhq', children:20, feeChild:7500, share:45, comm:10, toTuition:20, ord:5},
      {id:'s:ielts', name:'IELTS course', kind:'exam', mode:'onl', status:'planned', runs:2, places:10, fill:80, feePlace:250000, costRun:800000, months:'3,6', match:'ielts', ord:6},
      {id:'c:staff', name:'Staff pay', kind:'staff', monthly:1200000, cats:['Salaries','Staff pay','Wages']},
      {id:'c:rent', name:'Rent and running', kind:'rent', monthly:650000, cats:['Rent','Utilities','Internet','Electricity','Water']},
      {id:'c:mkt', name:'Marketing', kind:'mkt', monthly:120000, cats:['Marketing','Advertising']},
      {id:'c:mat', name:'Materials and printing', kind:'materials', monthly:90000, cats:['Printing','Stationery','Materials']},
      {id:'t:' + fy, inc:300000000, prof:90000000}, {id:'t:' + (fy + 4), inc:1500000000, prof:450000000},
      {id:'i:term1', name:'Term 1', area:'terms', owner:'@Catherine Mkwinda', d1:fy + '-09-07', d2:fy + '-12-04', status:'done', steps:[]},
      {id:'i:mocks', name:'Year 11 mock exams', area:'terms', owner:'@Catherine Mkwinda', d1:d(-13), d2:d(-2), status:'done', steps:[{t:'Print the papers', who:'@Catherine Mkwinda', by:d(-14), done:T - 14 * DAY}]},
      {id:'i:enqpage', name:'Enquiry page on the website', area:'mkt', owner:'@Wanangwa Msutu', d1:d(-40), d2:d(-1), status:'confirmed', cost:150000, steps:[{t:'Write the page', who:'@Wanangwa Msutu', by:d(-20), done:T - 21 * DAY}, {t:'Form goes to Enquiries', who:'@Wanangwa Msutu', by:d(-3)}]},
      {id:'i:open', name:'Open day', area:'mkt', owner:'@Anna Navilati', d1:d(13), d2:'', status:'confirmed', cost:450000, aim:'12 enquiries', tag:'BDO event', desc:'Taster sessions for Years 8–11 and a talk for parents, to bring in enquiries before January.', steps:[{t:'Book the hall', who:'@Anna Navilati', by:d(-10), done:T - 10 * DAY}, {t:'Invite current families', who:'@Catherine Mkwinda', by:d(6)}, {t:'Tutors for the tasters', who:'@Anna Navilati', by:d(9)}]},
      {id:'i:partners', name:'Sign 2 new partners', area:'mkt', owner:'@Anna Navilati', d1:d(-20), d2:d(80), status:'confirmed', steps:[{t:'Baking: Sweet Crumbs', who:'@Anna Navilati', by:d(30)}, {t:'Gym: FitZone teen class', who:'@Anna Navilati', by:d(60)}]},
      {id:'i:chem', name:'Hire an A Level Chemistry tutor', area:'people', owner:'@Wanangwa Msutu', d1:d(-12), d2:d(-2), status:'confirmed', steps:[{t:'Advert out', who:'@Catherine Mkwinda', by:d(-10), done:T - 10 * DAY}]},
      {id:'i:ft', name:'Fast Track · January', area:'prog', owner:'@Catherine Mkwinda', d1:(fy + 1) + '-01-04', d2:(fy + 1) + '-01-29', status:'confirmed', steps:[]},
      {id:'i:mar', name:'IGCSE Marathon', area:'prog', owner:'@Catherine Mkwinda', d1:(fy + 1) + '-04-06', d2:(fy + 1) + '-04-24', status:'confirmed', steps:[]},
      {id:'i:ielts', name:'IELTS course', area:'prog', owner:'@Wanangwa Msutu', d1:(fy + 1) + '-03-01', d2:(fy + 1) + '-06-30', status:'planned', steps:[]},
      {id:'i:site', name:'Centre 2: find a site', area:'growth', owner:'@Wanangwa Msutu', d1:(fy + 1) + '-03-01', d2:(fy + 1) + '-08-31', status:'planned', steps:[]},
      {id:'i:board', name:'Board meeting', area:'growth', owner:'@Wanangwa Msutu', d1:ym + '-27', d2:'', status:'confirmed', steps:[{t:'Board report', who:'@Wanangwa Msutu', by:ym + '-25'}]}
    ].reduce(it, {});
    const P3 = [{id:'ptchess', name:'Lilongwe Chess Club', contact:'Mr Tembo · 0999 000 111', arr:'lhq', share:40, since:d(-80), renew:d(20), acts:[{id:'acch', name:'Chess · Saturdays', fee:7500}]},
      {id:'ptswim', name:'AquaKids Swimming', contact:'Ms Chirwa · 0888 222 333', arr:'lhq', share:50, since:d(-60), renew:d(150), acts:[{id:'acsw', name:'Swimming · Wednesdays', fee:9000}]},
      {id:'ptkart', name:'Kart Arena', contact:'Mr Gama · 0999 444 555', arr:'partner', comm:10, since:d(-30), renew:d(300), acts:[{id:'ackt', name:'Go-karting · monthly', fee:25000}]}];
    P3.forEach(p => p.log = [{d:d(-25), kind:'meeting', t:'Agreed the term plan.', by:'Anna Navilati'}]);
    schools.slice(0, 3).forEach((sc, i) => P3.push({id:'sch-' + norm(sc).replace(/[^a-z0-9]+/g, '-').slice(0, 40), kind:'school', name:sc, log:[{d:d(-6 - i * 9), kind:'visit', t:'Met the Head of Year 11.', by:'Anna Navilati'}]}));
    const KN = ['Chisomo Phiri','Tadala Banda','Kondwani Mvula','Thoko Gondwe','Wezi Kalua','Mphatso Zulu','Atupele Nkhoma','Limbani Chirwa','Dalitso Moyo','Takondwa Kaunda','Yamikani Phiri','Chimwemwe Tembo','Lusungu Mhango','Kumbukani Banda','Madalitso Gama','Tiyamike Chisi','Ulemu Kamanga','Pempho Mwale','Zione Lungu','Alinafe Soko'];
    const kids = KN.map((n, i) => { const p = i < 8 ? 'ptchess' : i < 15 ? 'ptswim' : 'ptkart', a = {ptchess:'acch', ptswim:'acsw', ptkart:'ackt'}[p]; return {id:'kd' + i, name:n, parent:'Parent of ' + n.split(' ')[0], phone:'0999 1' + String(10000 + i * 7).slice(-5), school:schools[i % Math.max(1, schools.length)] || '', year:'Year ' + (7 + i % 5), act:a, partner:p, since:d(-70 + i * 2), src:'partner'}; }).reduce(it, {});
    /* enquiries over four months: about half from the BDO's work; the enrolled ones are real students, with the date of their first payment */
    const SL = ['Facebook','Billboard','Website','Walk-in','A family we teach'], BL = ['BDO school visit','BDO partner','BDO event','BDO contact'], enq = {};
    const newStu = Object.entries(first).filter(([, f]) => f >= d(-110)).sort((a, b) => a[1].localeCompare(b[1]));
    let n = 0; const mkE = (o) => { const id = 'endemo' + (n++); enq[id] = Object.assign({id, phone:'0999 ' + (300000 + n * 37), year:'Year ' + (8 + n % 5), subj:pick(['Maths','Physics','Chemistry','English','Biology']) + ', ' + pick(['Maths','Physics','Economics']), for:'tuition', by:'@Anna Navilati', at:T}, o); };
    newStu.forEach(([k, f], i) => { const bdo = i % 2 === 0; mkE({who:(recs[k] || {}).parent || 'Parent', st:(recs[k] || {}).name, school:(recs[k] || {}).school || '', d:iso(new Date(new Date(f + 'T09:00:00').getTime() - 9 * DAY)), src:bdo ? BL[i % 4] : SL[i % 5], srcOwner:bdo ? 'bdo' : 'lhq', lock:true, lockBy:'Catherine Mkwinda', stage:'enrolled', student:k, enrolledD:iso(new Date(new Date(f + 'T09:00:00').getTime() - 2 * DAY))}); });
    const NM = ['Mrs Banda','Mr Gondwe','Mrs Kumwenda','Mr Phiri','Ms Mvula','Mrs Chirwa','Mr Nkhoma','Mrs Zulu','Mr Kalua','Mrs Moyo','Mr Tembo','Mrs Mhango','Mr Soko','Mrs Lungu','Mr Kaunda','Mrs Mwale','Mr Chisi','Mrs Kamanga','Mr Gama','Mrs Chiumia','Mr Banda','Mrs Nyirenda','Mr Mbewe','Mrs Kapalamula','Mr Ngwira'];
    NM.forEach((w, i) => { const bdo = i % 2 === 1, age = 3 + i * 4, stg = i < 6 ? (i % 3 === 0 ? 'new' : i % 3 === 1 ? 'contacted' : 'visit') : i < 8 ? 'ready' : 'lost';
      mkE({who:w, school:schools[i % Math.max(1, schools.length)] || '', d:d(-age), src:bdo ? BL[i % 4] : SL[i % 5], srcOwner:bdo ? 'bdo' : 'lhq', lock:i % 4 !== 3, lockBy:i % 4 !== 3 ? 'Catherine Mkwinda' : '', stage:stg, follow:stg === 'new' || stg === 'contacted' || stg === 'visit' ? d(i % 2 ? -1 : 2) : '', lost:stg === 'lost' ? pick(['Fees','Timing','Chose another','No reply']) : '', for:i % 7 === 0 ? 'prog' : 'tuition'}); });
    Object.values(kids).slice(0, 3).forEach((k, i) => { k.moved = d(-20 + i * 5); const id = 'enkid' + i; enq[id] = {id, who:k.parent, st:k.name, phone:k.phone, school:k.school, src:'BDO partner · ' + ({ptchess:'Lilongwe Chess Club', ptswim:'AquaKids Swimming', ptkart:'Kart Arena'}[k.partner]), srcOwner:'bdo', partner:k.partner, kid:k.id, stage:'ready', d:k.moved, lock:true, lockBy:'Catherine Mkwinda', by:'@Anna Navilati', at:T}; k.enq = id; });
    const ann = {andemo1:{id:'andemo1', by:'@Wanangwa Msutu', byN:'Wanangwa Msutu', t:'Centre closed on Friday', body:'LHQ is closed on Friday for staff training. Online sessions go ahead as normal.', imp:true, aud:'all', fams:[], until:d(5), at:T - 2 * 3600e3, seen:{}, got:{}},
      andemo2:{id:'andemo2', by:'@Catherine Mkwinda', byN:'Catherine Mkwinda', t:'New SRA schedule', body:'Reviews now go out on session days.', imp:false, aud:'tutors', fams:[], until:'', at:T - 3 * DAY, seen:{}, got:{}}};
    const cal = {cdemo1:{id:'cdemo1', by:'@Anna Navilati', byN:'Anna Navilati', role:'admin', kind:'leave', t:'Family wedding', d:d(4), d2:d(4), all:true, s:'', e:'', vis:'lhq', inv:[], na:true, leave:{st:'wait'}, at:T},
      cdemo2:{id:'cdemo2', by:'@Wanangwa Msutu', byN:'Wanangwa Msutu', role:'director', kind:'meet', t:'Staff meeting', d:d(1), d2:d(1), all:false, s:'09:00', e:'10:00', vis:'inv', inv:['@Catherine Mkwinda', '@Anna Navilati', '@Benjamin Msutu'], na:false, at:T},
      cdemo3:{id:'cdemo3', by:'@Peter Mvula', byN:'Peter Mvula', role:'tutor', kind:'personal', t:'Dentist', d:d(1), d2:d(1), all:false, s:'10:00', e:'11:00', vis:'me', inv:[], na:true, at:T},
      cdemo4:{id:'cdemo4', by:'@Catherine Mkwinda', byN:'Catherine Mkwinda', role:'admin', kind:'work', t:'Bank: signatories', d:d(2), d2:d(2), all:false, s:'14:00', e:'15:00', vis:'lhq', inv:[], na:false, at:T}};
    const jobs = {jdemo1:{id:'jdemo1', what:'Print the Year 11 mock papers', by:'@Wanangwa Msutu', byN:'Wanangwa Msutu', to:'@Catherine Mkwinda', toN:'Catherine Mkwinda', d:t0, rep:'', tm:'12:00', at:T, done:{}},
      jdemo2:{id:'jdemo2', what:'Send the Term 2 dates to parents', by:'@Wanangwa Msutu', byN:'Wanangwa Msutu', to:'@Catherine Mkwinda', toN:'Catherine Mkwinda', d:d(-2), rep:'', tm:'', at:T - 2 * DAY, done:{}},
      jdemo3:{id:'jdemo3', what:'Call two partner leads', by:'@Anna Navilati', byN:'Anna Navilati', to:'@Anna Navilati', toN:'Anna Navilati', d:d(-14), rep:'wkday', tm:'', at:T - 14 * DAY, done:{}},
      jdemo4:{id:'jdemo4', what:'Board pack: check the figures', by:'@Wanangwa Msutu', byN:'Wanangwa Msutu', to:'@Wanangwa Msutu', toN:'Wanangwa Msutu', d:ym + '-25', rep:'month', tm:'', at:T, done:{}}};
    const pm = iso(new Date(new Date(T).getFullYear(), new Date(T).getMonth() - 1, 1)).slice(0, 7);
    const spay = {cfg:{'@Catherine Mkwinda':{salary:450000, allow:[{name:'Transport', amt:30000}], prob:'', comm:{on:false, rates:{tuition:0, prog:0, kid:0}}, bonus:{on:false, items:[]}},
      '@Benjamin Msutu':{salary:400000, allow:[{name:'Transport', amt:30000}], prob:'', comm:{on:false, rates:{}}, bonus:{on:false, items:[]}},
      '@Anna Navilati':{salary:350000, allow:[], prob:d(8), comm:{on:true, from:d(-120), take4:false, rates:{tuition:25000, prog:15000, kid:10000}}, bonus:{on:false, items:[{k:'partners', label:'New partners', target:2, amt:50000, on:true}, {k:'enq', label:'Enquiries a month', target:6, amt:30000, on:true}]}}},
      slips:{['@Catherine Mkwinda|' + pm]:{st:'signed', snap:{name:'Catherine Mkwinda', m:pm, lines:[{t:'Salary', amt:450000}, {t:'Transport', s:'allowance', amt:30000}], total:480000}, by:'Benjamin Msutu', at:T - 20 * DAY, aBy:'Wanangwa Msutu', aAt:T - 19 * DAY, sAt:T - 18 * DAY},
        ['@Benjamin Msutu|' + pm]:{st:'confirmed', snap:{name:'Benjamin Msutu', m:pm, lines:[{t:'Salary', amt:400000}, {t:'Transport', s:'allowance', amt:30000}], total:430000}, by:'Wanangwa Msutu', at:T - 19 * DAY, aBy:'Wanangwa Msutu', aAt:T - 19 * DAY}}};
    const fb = {fdemo1:{id:'fdemo1', by:'@Peter Mvula', byN:'Peter Mvula', role:'tutor', ty:'broke', note:"Save didn't work the first time on the marks sheet.", where:'SRA tracker', from:'report', dev:'iPhone · Safari', ver:'v71', at:T - 5 * 3600e3, st:'new'},
      fdemo2:{id:'fdemo2', by:'@Catherine Mkwinda', byN:'Catherine Mkwinda', role:'admin', ty:'idea', note:'A button to copy a quote for WhatsApp.', where:'Documents', from:'more', dev:'Windows · Chrome', ver:'v71', at:T - 2 * DAY, st:'look', lhq:'Next release'},
      fdemo3:{id:'fdemo3', by:'@Benjamin Msutu', byN:'Benjamin Msutu', role:'admin', ty:'slow', note:'Balances take a while to open on my phone.', where:'Business', from:'more', way:'little', dev:'Android · Chrome', ver:'v70', at:T - 9 * DAY, st:'fixed', stAt:T - 3 * DAY}};
    const areps = {}; for(let i = 1; i <= 5; i++){ const dd = d(-i); if([0, 6].includes(new Date(dd + 'T12:00:00').getDay())) continue; const rc = R.filter(r => r.date === dd);
      areps['@Catherine Mkwinda|' + dd] = {id:'@Catherine Mkwinda|' + dd, by:'@Catherine Mkwinda', byN:'Catherine Mkwinda', d:dd, hub:{money:rc.reduce((a, r) => a + +r.received, 0), pays:rc.length, invN:0, qN:0, studs:[], ses:0, logged:0, missed:0, mu:0, trep:0, tut:0, trMiss:[]}, enq:2 + i % 3, visits:i % 2, issues:i === 1 ? 'Mrs Gondwe asked about the sibling discount: sorted.' : '', supplies:i === 2 ? 'Toner running low.' : '', needs:i === 1 ? 'Approve MWK 180,000 for a second projector' : '', at:T - i * DAY}; }
    return {lhq_bplan:{items:bplan}, lhq_partners:{items:P3.reduce(it, {})}, lhq_kids:{items:kids}, lhq_enq:{items:enq}, lhq_ann:ann, lhq_cal:{items:cal}, lhq_jobs:{items:jobs}, lhq_spay:spay, lhq_fb:fb, lhq_areps:areps};
  }
  /* Business: spending from the first month with payments to today, recorded by Wanangwa and Catherine.
     Rent, internet and staff salaries repeat monthly; this month's internet and salaries are left for "to confirm". */
  function spending(docs, now){
    const ym = d => d.slice(0, 7), today = iso(now), cur = ym(today);
    const inc = {}; docs.filter(d => d.type === 'receipt').forEach(r => { const m = ym(r.date); inc[m] = (inc[m] || 0) + Number(r.received || 0); });
    let m = Object.keys(inc).sort()[0] || cur; const out = {}; let n = 0;
    const who = () => ADMINS[Math.floor(rnd() * 2)], r10 = v => Math.round(v / 1e4) * 1e4;
    const add = (day, cat, what, amount, method, o = {}) => {
      const [y, mo] = m.split('-').map(Number), dim = new Date(y, mo, 0).getDate(), date = `${m}-${String(Math.min(day, dim)).padStart(2, '0')}`;
      if(date > today) return;
      const id = 'ds' + (++n).toString(36), sid = o.series ? 'dser-' + o.series : undefined;
      out[id] = Object.assign({id, date, cat, what, amount, method, to:o.to || '', by:o.by || who(), at:new Date(date).getTime() + 10 * 3600e3}, o.rep ? {rep:'m'} : {}, sid ? {sid} : {});
    };
    for(let i = 0; m <= cur && i < 14; i++){
      const mon = new Date(m + '-01').toLocaleString('en-GB', {month:'long'}), isCur = m === cur, mi = +m.slice(5);
      add(1, 'Rentals', `Centre rent (${mon})`, 2500000, 'Bank transfer', {rep:true, series:'rent', to:'Landlord', by:'Wanangwa Msutu'});
      if(!isCur) add(5, 'Communication', `Internet: Airtel Fibre (${mon})`, 180000, 'Bank transfer', {rep:true, series:'net', to:'Airtel'});
      add(9, 'Communication', 'Airtime and data bundles', r10(60000 + rnd() * 40000), 'Airtel Money');
      add(15, 'Utilities', 'ESCOM electricity', r10(170000 + rnd() * 70000), 'TNM Mpamba', {to:'ESCOM'});
      add(18, 'Utilities', 'Water bill', r10(40000 + rnd() * 25000), 'Cash', {to:'Lilongwe Water Board'});
      add(6 + Math.floor(rnd() * 8), 'Stationery', pick(['Printing: SRA sheets and planners','Exercise books and pens','Printer toner','Printing: progress reports']), r10(70000 + rnd() * 80000), 'Cash');
      add(11, 'Transportation', 'Fuel: home visits and errands', r10(90000 + rnd() * 80000), 'Cash');
      add(23, 'Transportation', 'Fuel: tutor transport', r10(80000 + rnd() * 60000), 'Cash');
      add(20, 'Marketing', pick(['Facebook and Instagram ads','Instagram ads: next intake','Flyers for schools']), r10(150000 + rnd() * 180000), 'Airtel Money', {by:'Wanangwa Msutu'});
      if(rnd() < .6) add(12 + Math.floor(rnd() * 10), 'Maintenance', pick(['Air conditioner service','Plumbing repair','Fixing classroom chairs','Generator service']), r10(60000 + rnd() * 140000), 'Cash');
      if(mi === 8 || mi === 10) add(17, 'Trainings', mi === 8 ? 'Tutor training: SRA and session logs' : 'Cambridge marking workshop (2 tutors)', mi === 8 ? 450000 : 300000, 'Bank transfer', {by:'Wanangwa Msutu'});
      if(mi === 8) add(8, 'Renovations', 'Classroom 2: partition and painting', 3200000, 'Bank transfer', {to:'Banda Builders', by:'Wanangwa Msutu'});
      if(mi === 9) add(14, 'Purchases', 'Projector and screen', 1250000, 'Bank transfer', {by:'Wanangwa Msutu'});
      if(mi === 6) add(14, 'Purchases', 'Two whiteboards', 450000, 'Cash');
      if(!isCur){
        add(25, 'Salaries', `Front desk and admin salary (${mon})`, 650000, 'Bank transfer', {rep:true, series:'staff', by:'Wanangwa Msutu'});
        add(25, 'Salaries', `Cleaner and guard (${mon})`, 300000, 'Cash', {rep:true, series:'clean', by:'Catherine Mkwinda'});
        add(28, 'Salaries', `Tutor pay: ${mon} sessions`, r10((inc[m] || 0) * .38), 'Bank transfer', {by:'Wanangwa Msutu'});
      }
      const [y, mo] = m.split('-').map(Number); m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    }
    const budget = {m:{Salaries:11500000, Rentals:2500000, Utilities:300000, Communication:300000, Stationery:250000, Transportation:350000, Marketing:400000, Maintenance:200000, Trainings:200000, Purchases:300000}, by:'Wanangwa Msutu', at:now.getTime()};
    return {spend:out, budget};
  }
  window.LHQDemo = {build};
})();
