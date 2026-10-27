/* LHQ Hub navigation: the top bar, the bottom bar and the sidebar, the same on every page.
   Each page calls LHQNav.mount('home' | 'students' | 'docs' | 'reports' | 'settings'). */
(function(){
  const KEY = 'lhq_layout';
  const P = {home:'<path d="M4 11l8-7 8 7v9H4z"/>', students:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2 .8 3 3 3 6"/>',
    docs:'<path d="M8 3h8l4 4v12H8z"/><path d="M16 3v4h4"/><path d="M4 7v14h12"/>', reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>', plus:'<path d="M12 5v14M5 12h14"/>'};
  const ic = (n, s = 20, w = 1.8) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
  const ITEMS = [['home','Home','index.html#home'],['students','Students','index.html#students'],['docs','Documents','index.html#docs'],['reports','Reports','reports.html'],['settings','Settings','index.html#settings']];
  function layout(){ try{ return localStorage.getItem(KEY) === 'side' ? 'side' : 'bottom'; }catch(e){ return 'bottom'; } }
  function setLayout(v){ try{ localStorage.setItem(KEY, v); }catch(e){} apply(); }
  function apply(){ document.body.classList.toggle('hn-L-side', layout() === 'side'); document.body.classList.toggle('hn-L-bottom', layout() !== 'side'); }
  let current = '';
  function draw(){
    const logo = window.lhqTheme ? lhqTheme.logo() : 'logo.png';
    const side = document.getElementById('hnSide'), bar = document.getElementById('hnBar');
    if(side) side.innerHTML = `<a class="hn-logo" href="index.html#home"><img class="lhq-logo" src="${logo}" alt="LHQ Learning Solutions"></a>
      <a class="hn-new" href="index.html#new">${ic('plus',18,2.4)}<span>New</span></a>
      ${ITEMS.map(([k,l,h]) => `<a class="hn-i ${current===k?'on':''}" href="${h}">${ic(k,20)}<span>${l}</span></a>`).join('')}`;
    if(bar) bar.innerHTML = ITEMS.map(([k,l,h]) => `<a class="${current===k?'on':''}" href="${h}">${ic(k,22)}${l}</a>`).join('');
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
  window.LHQNav = {mount, layout, setLayout, section: s => { current = s; draw(); }, ic};
})();
