/* LHQ Hub demo data (previews only): six months of made-up students (about 40 at a time, averaging about MKW 700,000 a period at MKW 15,000 a session), quotes, invoices, receipts,
   tuition cards, session logs and SRAs, with every situation the Hub handles: paid, part-paid, in grace,
   overdue, ending this week, renewed, ended, quotes waiting, a card with no tutor, a deleted document.
   Everyone here is invented. Dates are worked out from today, so the demo always looks current. */
(function(){
  const DAY = 864e5;
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const norm = x => String(x||'').trim().toLowerCase().replace(/\s+/g,' ');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];

  const ADMINS = ['Wanangwa Msutu', 'Catherine Mkwinda'];
  const PEOPLE = [
    {name:'Catherine Mkwinda', role:'admin', pin:'1111', seen:Date.now() - 2 * 3600e3, perms:['quotes','receipts','cards','delete','restore','students','tutors','msgs','classes','spend']},
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
    'Business Studies':['Maureen Story','Joseph Nkhoma'],'Economics':['Wanangwa Msutu','Joseph Nkhoma'],'Accounting':['Joseph Nkhoma']};
  const tutorFor = (subj, i) => { const p = POOL[subj] || ['Grace Chinyama']; return p[i % p.length]; };
  /* LHQ's fee is MKW 15,000 a session for every level; what changes is how many sessions a student takes
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
      makeups[id] = {id, k:e.k, st:e.st, sub:e.sub, tutor:e.tutor, d, s:'15:00', e:'15:50', why:'', status: d < tIso ? 'ok' : 'asked', at, by:e.tutor}; });
    /* tutors' daily reports: sent on most days they taught (a few late or missing) */
    const treps = {}; const days = {}; Object.values(logs).forEach(e => { if(e && e.ty === 's' && e.tutor && e.d < iso(new Date(T))) days[e.tutor + '|' + e.d] = 1; });
    Object.keys(days).forEach(k => { const [tutor, d] = k.split('|'), r = rnd(); if(r < .08) return; const id = 'tr' + (uid++).toString(36);
      treps[id] = {id, tutor, d, sent: Date.parse(d + 'T14:30:00Z') + (r < .14 ? 864e5 : 0), at: Date.parse(d + 'T14:30:00Z'), rate: 4, comment: '', req: []}; });
    /* students' focus rounds and a study block or two */
    const lhq_focus = {}, lhq_plan = {}, SB = ['Mathematics','Physics','Chemistry','Biology','English'];
    Object.keys(recs).forEach((k, i) => { const L = []; for(let n = 1; n <= 24; n++){ if(rnd() < .45) continue; const d = iso(new Date(T - n * DAY)); L.push({d, m: (i + n) % 3 ? 25 : 50, sub: SB[(i + n) % 5], tk: '', at: T - n * DAY}); } lhq_focus[k] = L;
      if(i % 2 === 0) lhq_plan[k] = {bdemo1: {id: 'bdemo1', name: 'Revision', type: 'rev', sub: SB[i % 5], s: '19:00', e: '20:00', rep: 'weekdays', days: [], from: iso(new Date(T - 20 * DAY)), until: '', at: T - 20 * DAY},
        bdemo2: {id: 'bdemo2', name: 'Football', type: 'act', sub: '', s: '16:00', e: '17:30', rep: 'days', days: [3, 6], from: iso(new Date(T - 20 * DAY)), until: '', busy: 1, sh: 'busy', rem: [15], at: T - 20 * DAY},
        bdemo3: {id: 'bdemo3', all: 1, name: 'School sports day', type: 'school', sub: '', from: iso(new Date(T + 7 * DAY)), to: '', busy: 1, sh: 'all', cd: 1, at: T - 20 * DAY}}; });
    return {docs, trash, people:PEOPLE, kv:{lhq_focus, lhq_plan, lhq_treps:{e:treps}, lhq_makeups:makeups, lhq_students:recs, lhq_logs:{e:logs, imports}, lhq_counters:{quote:C.quote, invoice:C.invoice, receipt:C.receipt + 1, card:C.card}, lhq_spend:money.spend, lhq_budget:money.budget, lhq_targets:targets, lhq_pay:{
      place: Object.fromEntries([...new Set(Object.values(POOL).flat())].map(n => [n.toLowerCase(), [{p: ['Catherine Mkwinda','Emmanuel Mkwamba'].includes(n) ? 'full' : 'part', from: '2026-01-01'}]])),
      items: {pi1: {id: 'pi1', tutor: 'Peter Mvula', m: iso(new Date(T)).slice(0, 7), kind: 'advance', amt: 30000, label: 'Advance', d: iso(new Date(T - 4 * DAY)), by: 'Wanangwa Msutu', at: T - 4 * DAY},
        pi2: {id: 'pi2', tutor: 'Emmanuel Mkwamba', m: iso(new Date(T)).slice(0, 7), kind: 'allowance', amt: 10000, label: 'Transport · exam invigilation', d: iso(new Date(T - 2 * DAY)), by: 'Wanangwa Msutu', at: T - 2 * DAY}}}}};
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
