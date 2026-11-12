/* LHQ Hub › on the test copy (a Netlify preview), a gold strip on every page so it is never mistaken for the live Hub */
(function(){
  const show = on => { document.documentElement.classList.toggle('lhq-test', !!on); };
  try{ if(sessionStorage.getItem('lhq_preview') === '1') show(true); }catch(e){}
  if(location.hostname === 'lhqhub.netlify.app'){ show(false); return; }   // the live Hub never asks; any other address (previews, lhqhub-test) asks the server
  fetch('/api/hub/people?v=2', {cache: 'no-store'}).then(r => r.json()).then(j => { show(j.preview); try{ sessionStorage.setItem('lhq_preview', j.preview ? '1' : '0'); }catch(e){} }).catch(() => {});
  const css = document.createElement('style');
  css.textContent = `html.lhq-test body::before{content:"TEST COPY · not the live Hub";display:block;position:sticky;top:0;z-index:9999;background:#f4b223;color:#14213d;font:800 12px/1.3 Manrope,system-ui,sans-serif;letter-spacing:.02em;text-align:center;padding:7px 12px}`;
  document.head.appendChild(css);
})();
