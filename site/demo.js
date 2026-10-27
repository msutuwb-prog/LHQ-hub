/* LHQ Hub demo data (previews only): six months of made-up students (about 40 at a time, averaging MKW 700,000 a period), quotes, invoices, receipts,
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
    {name:'Catherine Mkwinda', role:'admin', pin:'1111', seen:Date.now() - 2 * 3600e3},
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
  /* LHQ's fees: per session, three sessions a week per subject (12 in a 4-week period) */
  const RATE = level => /A Level|AS Level|Year 1[23]/.test(level) ? 35000 : /IGCSE|Year 1[01]/.test(level) ? 30000 : 25000;
  const DAYS = [['Mo','We','Fr'],['Tu','Th','Sa'],['Mo','Tu','Th'],['We','Fr','Sa'],['Mo','We','Th'],['Tu','Fr','Sa']];
  const TIMES = [['14:00','15:00'],['15:00','16:00'],['16:00','17:00'],['17:00','18:00'],['10:00','11:30']];
  const HEARD = ['A friend or family member','Instagram','Facebook','Study Smart Session','Their school','WhatsApp','Google','Sibling at LHQ'];
  const SCHOOLS = ['Bishop Mackenzie International School','The Lilongwe Academy International School','Sapitwa International School','Kamuzu Academy','St Andrew’s International High School','Phwezi Boys Secondary School','Lilongwe Private School','Saint Patrick’s Secondary School'];

  /* who, and how things stand today (s = what happens to their current period) */
  const STUDENTS = [
    ['Thando Banda','Year 10 · IGCSE','Mrs Banda',['Mathematics','Physics'],'ending',5,false],
    ['Natasha Banda','Year 8','Mrs Banda',['Mathematics','English'],'active',3,false,{disc:'Sibling',pct:10}],
    ['Chikondi Phiri','Year 9 · Checkpoint','Mr Phiri',['Science','Mathematics'],'overdue',4,true],
    ['Tamara Mwale','Year 12 · AS Level','Mrs Mwale',['Biology'],'quote_old'],
    ['Kondwani Zulu','Year 11 · IGCSE','Mr Zulu',['English Language'],'nocard',2,false],
    ['Lusungu Nyirenda','Year 13 · A Level','Dr Nyirenda',['Pure Mathematics 1','Economics'],'active',6,true],
    ['Mphatso Chirwa','Year 10 · IGCSE','Mrs Chirwa',['Chemistry','Biology'],'grace',3,true],
    ['Tiwonge Kamanga','Year 11 · IGCSE','Mr Kamanga',['Economics','Business Studies'],'active',5,false],
    ['Chisomo Mbewe','Year 7','Ms Mbewe',['Mathematics'],'ended',3,false],
    ['Kettie Gondwe','Year 11 · IGCSE','Mrs Gondwe',['Physics','Chemistry','Mathematics'],'active',4,true],
    ['Pemphero Kumwenda','Year 9 · Checkpoint','Mr Kumwenda',['English','Science'],'ending',2,false],
    ['Wezi Msiska','Year 12 · AS Level','Mrs Msiska',['Physics'],'active',2,false],
    ['Madalitso Tembo','Year 10 · IGCSE','Mr Tembo',['Mathematics'],'notutor',1,false],
    ['Takondwa Mhango','Year 8','Mrs Mhango',['Science'],'ended',2,false],
    ['Yamikani Chimwaza','Year 11 · IGCSE','Mr Chimwaza',['Biology','Chemistry'],'overdue_full',2,false],
    ['Thoko Moyo','Year 13 · A Level','Mrs Moyo',['Economics'],'active',6,false],
    ['Limbani Kalua','Year 10 · IGCSE','Mr Kalua',['English Language','Mathematics'],'unpaid_new',1,false],
    ['Atupele Mwakasungula','Year 9 · Checkpoint','Ms Mwakasungula',['Mathematics'],'quote_new'],
    ['Kumbukani Phiri','Year 12 · AS Level','Mr Phiri',['Chemistry','Pure Mathematics 1'],'quote_old2'],
    ['Faith Ngwira','Year 7','Mrs Ngwira',['English'],'active',4,false],
    ['Brian Chaponda','Year 11 · IGCSE','Mr Chaponda',['Business Studies'],'ended',4,true],
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
      const n = R() < .15 ? 1 : R() < .55 ? 2 : R() < .85 ? 3 : 4;
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
      const items = subjects.map(x => ({desc:x, days:'3', sessions:'12', cost:String(cost)}));
      const disc = opt && opt.disc ? {discType:'pct', discValue:String(opt.pct), discReason:opt.disc} : {};
      const total = items.reduce((a, it) => a + 12 * cost, 0) * (1 - ((opt && opt.pct) || 0) / 100);
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
          const subs = subjects.map((x, i) => ({name:x, list:listFor(level, x), tutor: sit === 'notutor' && i === 0 ? '' : (si % 7 === 3 && x === 'Mathematics' && k > 1 ? 'Mayamiko Goliati' : tutorFor(x, si + i)),
            days: slot.slice(), perWeek:'3', sessions:'12', mins:'1 hour', start:TIMES[(si + i) % TIMES.length][0], end:TIMES[(si + i) % TIMES.length][1], tier: /IGCSE/.test(level) && ['Mathematics','Physics','Chemistry','Biology'].includes(x) ? 'Extended' : '',
            mode:'full', picks:{}, details:{}, custom:[], grade: pick(['B','C','C','D','A','']), basis: 'End of term results', when:'', note:'', openCh:''}));
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

    // tutors' session logs and SRAs for the last 8 weeks
    const DN = {Su:0, Mo:1, Tu:2, We:3, Th:4, Fr:5, Sa:6}, imports = [];
    docs.filter(d => d.type === 'card').forEach(card => {
      card.subjects.forEach(sub => {
        if(!sub.tutor) return;
        const key = norm(card.student) + '|' + norm(sub.name), topics = topicsOf(sub.list);
        const start = Math.max(new Date(card.periodStart).getTime(), T - 28 * DAY), end = Math.min(new Date(card.periodEnd).getTime() + DAY, T);
        let ti = Math.floor(rnd() * 3), n = 0;
        for(let t = start; t < end; t += DAY){
          const d = new Date(t); if(!sub.days.some(x => DN[x] === d.getDay())) continue;
          n++;
          const a = rnd() < .08 ? 'absent' : rnd() < .06 ? 'late' : 'attended', eid = 'dl' + (++uid).toString(36);
          const e = {id:eid, k:key, st:card.student, sub:sub.name, d:iso(d), ty:'s', a, tp: a === 'absent' ? [] : [topics[ti % topics.length]], at:t + 18 * 3600e3, tutor:sub.tutor};
          if(a !== 'absent' && n % 4 === 0){ e.mx = 20; e.sc = 9 + Math.floor(rnd() * 12); }
          logs[eid] = e;
          if(a !== 'absent' && n % 2 === 0){
            // topic finished: SRA reviews 1, 3, 7 and 14 days later
            const topic = topics[ti % topics.length];
            [1, 3, 7, 14].forEach((g, ri) => {
              const rt = t + g * DAY; if(rt >= T) return;
              const h = rnd() < .78 ? 'o' : rnd() < .6 ? 'l' : 'm', rid = 'dr' + (++uid).toString(36);
              const r = {id:rid, k:key, st:card.student, sub:sub.name, d:iso(new Date(rt)), ty:'r', tk:topic, rv:ri + 1, h, at:rt + 17 * 3600e3, tutor:sub.tutor};
              if(h !== 'm'){ r.mx = 10; r.sc = 4 + Math.floor(rnd() * 7); }
              logs[rid] = r;
            });
            ti++;
          }
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

    return {docs, trash, people:PEOPLE, kv:{lhq_students:recs, lhq_logs:{e:logs, imports}, lhq_counters:{quote:C.quote, invoice:C.invoice, receipt:C.receipt + 1, card:C.card}}};
  }
  window.LHQDemo = {build};
})();
