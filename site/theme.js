/* LHQ Hub: light / dark theme, shared by every page.
   Loads in <head> so the right colours show before the page paints. */
(function(){
  const KEY = 'lhq_theme';
  /* the choice: light, dark or auto (match the device); what shows: light or dark */
  const choice = () => { try{ const v = localStorage.getItem(KEY); return v === 'dark' || v === 'auto' ? v : 'light'; }catch(e){ return 'light'; } };
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const get = () => choice() === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : choice();
  function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} apply(get()); window.dispatchEvent(new CustomEvent('lhqtheme', {detail:get()})); }
  if(mq) (mq.addEventListener ? mq.addEventListener('change', () => { if(choice() === 'auto') apply(get()); }) : mq.addListener(() => { if(choice() === 'auto') apply(get()); }));
  /* text size on this device: standard, large or larger */
  const TKEY = 'lhq_text';
  const text = () => { try{ const v = localStorage.getItem(TKEY); return v === 'l' || v === 'xl' ? v : 's'; }catch(e){ return 's'; } };
  function setText(v){ try{ localStorage.setItem(TKEY, v); }catch(e){} document.documentElement.classList.toggle('tx-l', v === 'l'); document.documentElement.classList.toggle('tx-xl', v === 'xl'); }
  document.documentElement.classList.toggle('tx-l', text() === 'l'); document.documentElement.classList.toggle('tx-xl', text() === 'xl');
  /* colour theme on this device: changes the accent only (buttons, selected tabs, the bar, the timer ring, chart lines) */
  const CKEY = 'lhq_col', COLS = ['navy', 'teal', 'purple', 'forest', 'rose', 'sunset'];
  const col = () => { try{ const v = localStorage.getItem(CKEY); return COLS.includes(v) ? v : 'navy'; }catch(e){ return 'navy'; } };
  function setCol(v){ try{ localStorage.setItem(CKEY, v); }catch(e){} if(v === 'navy') delete document.documentElement.dataset.col; else document.documentElement.dataset.col = v; }
  if(col() !== 'navy') document.documentElement.dataset.col = col();
  const logo = () => document.documentElement.dataset.theme === 'dark' ? 'logo-white.png' : 'logo.png';
  function apply(t){
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('img.lhq-logo').forEach(i => { i.src = logo(); });
    document.querySelectorAll('.theme-btn').forEach(b => { b.innerHTML = icon(t); b.title = t === 'dark' ? 'Light mode' : 'Dark mode'; b.setAttribute('aria-label', b.title); });
    const m = document.querySelector('meta[name=theme-color]'); if(m) m.content = t === 'dark' ? '#0d1420' : '#f5f6f8';
  }
  function icon(t){
    return t === 'dark'
      ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
      : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg>';
  }
  function toggle(){ set(get() === 'dark' ? 'light' : 'dark'); }
  document.documentElement.dataset.theme = get();
  document.addEventListener('DOMContentLoaded', () => {
    apply(get());
    document.addEventListener('click', e => { if(e.target.closest && e.target.closest('.theme-btn')) toggle(); });
  });
  /* another tab changed it */
  window.addEventListener('storage', e => { if(e.key === KEY) apply(get()); if(e.key === TKEY) setText(text()); if(e.key === CKEY) setCol(col()); });
  window.lhqTheme = {get, choice, set, toggle, apply, logo, text, setText, col, setCol, COLS};
  /* The PDF and image maker is large, so pages load first and fetch it a moment later
     (or straight away when PDF, Print or Share is tapped). */
  let pdfP = null;
  window.lhqPdf = () => pdfP || (pdfP = window.html2pdf ? Promise.resolve(window.html2pdf) : new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'lib/html2pdf.bundle.min.js';   // kept inside the Hub so PDFs also work offline
    s.onload = () => ok(window.html2pdf); s.onerror = () => { pdfP = null; no(new Error('The PDF maker could not load. Check the connection.')); };
    document.head.appendChild(s);
  }));
  /* the offline copy: install it, and offer a refresh when LHQ Hub has been updated */
  if('serviceWorker' in navigator && location.protocol !== 'file:'){
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    navigator.serviceWorker.addEventListener('message', e => {
      if(!e.data || e.data.type !== 'lhq-updated' || document.getElementById('lhqUpd')) return;
      const b = document.createElement('div'); b.id = 'lhqUpd';
      b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:70;background:#073763;color:#fff;border-radius:14px;padding:10px 10px 10px 16px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.25);font:600 14px/1.3 Manrope,system-ui,sans-serif;max-width:calc(100vw - 24px)';
      b.innerHTML = '<span>A newer version of LHQ Hub is ready.</span><button type="button" style="border:0;border-radius:10px;background:#f4b223;color:#14213d;font:800 13.5px Manrope,system-ui,sans-serif;padding:9px 14px;cursor:pointer">Refresh</button>';
      b.querySelector('button').onclick = () => location.reload();
      document.body.appendChild(b);
    });
  }
  /* "Install LHQ Hub" (Android and computers); iPhone and iPad use Share › Add to Home Screen */
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.lhqInstall = e; window.dispatchEvent(new Event('lhqinstall')); });
  window.lhqInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.lhqPdfSoon = () => window.addEventListener('load', () => setTimeout(() => window.lhqPdf().catch(() => {}), 1200));
})();
