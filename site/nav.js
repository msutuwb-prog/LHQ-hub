/* LHQ Hub navigation: the top bar, the bottom bar and the sidebar, the same on every page.
   Each page calls LHQNav.mount('home' | 'students' | 'docs' | 'business' | 'reports' | 'settings'). */
(function(){
  const KEY = 'lhq_layout';
  const P = {home:'<path d="M4 11l8-7 8 7v9H4z"/>', students:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2 .8 3 3 3 6"/>',
    docs:'<path d="M8 3h8l4 4v12H8z"/><path d="M16 3v4h4"/><path d="M4 7v14h12"/>', reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', business:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>', plus:'<path d="M12 5v14M5 12h14"/>'};
  const ic = (n, s = 20, w = 1.8) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
  const ALL = [['home','Home','index.html#home'],['students','Students','index.html#students'],['docs','Documents','index.html#docs'],['business','Business','index.html#biz'],['reports','Reports','index.html#reports'],['settings','Settings','index.html#settings']];
  /* Business shows for the Director, and for an admin given spending or profit and loss */
  function bizOK(){ try{ const m = (JSON.parse(localStorage.getItem('lhq_session') || 'null') || {}).me || {}; return m.role === 'director' || (m.role === 'admin' && (m.perms || []).some(k => k === 'spend' || k === 'pl')); }catch(e){ return false; } }
  const items = () => ALL.filter(x => x[0] !== 'business' || bizOK());
  function layout(){ try{ return localStorage.getItem(KEY) === 'side' ? 'side' : 'bottom'; }catch(e){ return 'bottom'; } }
  function setLayout(v){ try{ localStorage.setItem(KEY, v); }catch(e){} apply(); }
  function apply(){ document.body.classList.toggle('hn-L-side', layout() === 'side'); document.body.classList.toggle('hn-L-bottom', layout() !== 'side'); }
  let current = '';
  function draw(){
    const logo = window.lhqTheme ? lhqTheme.logo() : 'logo.png';
    const side = document.getElementById('hnSide'), bar = document.getElementById('hnBar');
    if(side) side.innerHTML = `<a class="hn-logo" href="index.html#home"><img class="lhq-logo" src="${logo}" alt="LHQ Learning Solutions"></a>
      <a class="hn-new" href="index.html#new">${ic('plus',18,2.4)}<span>New</span></a>
      ${items().map(([k,l,h]) => `<a class="hn-i ${current===k?'on':''}" href="${h}">${ic(k,20)}<span>${l}</span></a>`).join('')}`;
    if(bar) bar.innerHTML = items().map(([k,l,h]) => `<a class="${current===k?'on':''}" href="${h}">${ic(k,22)}${l}</a>`).join('');
  }
  function mount(section){
    current = section;
    if(!document.getElementById('hnTop')){
      const logo = window.lhqTheme ? lhqTheme.logo() : 'logo.png';
      document.body.insertAdjacentHTML('afterbegin', `<header class="topbar hn-top" id="hnTop"><a class="hn-logo" href="index.html#home"><img class="lhq-logo" src="${logo}" alt="LHQ Learning Solutions"></a><div class="actions"><button class="theme-btn" type="button"></button></div></header><aside class="hn-side" id="hnSide"></aside>`);
      document.body.insertAdjacentHTML('beforeend', '<nav class="hn-bar" id="hnBar" aria-label="Sections"></nav>');
    }
    apply(); draw();
    if(window.lhqTheme) lhqTheme.apply(lhqTheme.get());
  }
  /* coming back to a page from the browser's back button shows it as it was left */
  /* where you came from, so a page's back link can say "‹ Home" or "‹ Documents" instead of always its parent.
     A trail of pages in this tab: going back to a page already in it cuts the trail there. */
  const TK = 'lhq_trail';
  const here = () => location.pathname.replace(/^.*\//, '').replace(/^$/, 'index.html') + location.hash;
  const norm = u => String(u || '').replace(/^index\.html#?$/, 'index.html#home').replace(/^#/, 'index.html#');
  function trail(){ try{ return JSON.parse(sessionStorage.getItem(TK) || '[]'); }catch(e){ return []; } }
  function visit(label){
    const u = norm(here()); let t = trail();
    const i = t.findIndex(x => x.u === u);
    if(i >= 0) t = t.slice(0, i + 1); else t.push({u, l: label || ''});
    t[t.length - 1].l = label || t[t.length - 1].l;
    try{ sessionStorage.setItem(TK, JSON.stringify(t.slice(-30))); }catch(e){}
  }
  /* the page before this one, or the fallback when there isn't one (a link opened fresh) */
  function back(fbHref, fbLabel, skip){
    const u = norm(here()), t = trail().filter(x => x.u !== u && x.l && !(skip && skip(x.u)));
    const p = t[t.length - 1];
    return p ? {href: p.u, label: p.l} : {href: fbHref, label: fbLabel};
  }
  /* a section opened from the menu starts a fresh trail, so it shows no back link */
  document.addEventListener('click', e => { if(e.target.closest && e.target.closest('#hnSide a, #hnBar a, .hn-top .hn-logo')){ try{ sessionStorage.setItem(TK, '[]'); }catch(err){} } }, true);
  window.LHQNav = {mount, layout, setLayout, section: s => { current = s; draw(); }, ic, visit, back, trail};
})();
