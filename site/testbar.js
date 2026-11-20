/* LHQ Hub › on the test copy (a Netlify preview), a gold strip on every page so it is never mistaken for the live Hub */
(function(){
  const show = on => { document.documentElement.classList.toggle('lhq-test', !!on); };
  try{ if(sessionStorage.getItem('lhq_preview') === '1') show(true); }catch(e){}
  if(location.hostname === 'lhqhub.netlify.app'){ show(false); return; }   // the live Hub never asks; any other address (previews, lhqhub-test) asks the server
  fetch('/api/hub/people?v=2', {cache: 'no-store'}).then(r => r.json()).then(j => { show(j.preview); try{ sessionStorage.setItem('lhq_preview', j.preview ? '1' : '0'); }catch(e){} }).catch(() => {});
  const css = document.createElement('style');
  css.textContent = `html.lhq-test body::before{content:"TEST COPY · not the live Hub";display:block;position:sticky;top:0;z-index:9999;background:#f4b223;color:#14213d;font:800 12px/1.3 Manrope,system-ui,sans-serif;letter-spacing:.02em;text-align:center;padding:7px 12px}`;
  document.head.appendChild(css);
  /* the test copy on Netlify's free plan gets a "Powered by Netlify" badge in the bottom-right corner, over the bar's More.
     The badge stays (Netlify's terms); the bar moves up above it instead. Test copy only. */
  const ours = el => /^(hn-|lhq|toast|sheet|sh-|fx|mo-)/i.test(el.id || '') || /(^|\s)(hn-|sheet|toast|lhq)/i.test(typeof el.className === 'string' ? el.className : '');
  const lift = () => {
    if(!document.documentElement.classList.contains('lhq-test')) return;
    let h = 0;
    for(const el of [...document.body.children, ...document.documentElement.children]){
      if(ours(el) || el.id === 'main' || el === document.body || el === document.head) continue;
      const st = getComputedStyle(el); if(st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if(!r.width || !r.height) continue;
      if(r.right >= innerWidth - 40 && r.bottom >= innerHeight - 40 && r.height < 120) h = Math.max(h, innerHeight - r.top + 6);
    }
    document.documentElement.style.setProperty('--nf-lift', h + 'px');
  };
  const css2 = document.createElement('style');
  css2.textContent = `html.lhq-test .hn-bar{bottom:var(--nf-lift,0px)}html.lhq-test body.hn-L-bottom{padding-bottom:calc(72px + var(--nf-lift,0px) + env(safe-area-inset-bottom,0px))}`;
  document.head.appendChild(css2);
  const start = () => { lift(); const mo = new MutationObserver(lift); mo.observe(document.body, {childList: true}); mo.observe(document.documentElement, {childList: true}); addEventListener('resize', lift); let n = 0; const t = setInterval(() => { lift(); if(++n > 20) clearInterval(t); }, 1000); };
  addEventListener('click', () => setTimeout(lift, 400));   // "Hide this badge"
  if(document.body) start(); else addEventListener('DOMContentLoaded', start);
})();
