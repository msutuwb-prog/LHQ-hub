/* LHQ Hub: light / dark theme, shared by every page.
   Loads in <head> so the right colours show before the page paints. */
(function(){
  const KEY = 'lhq_theme';
  const get = () => { try{ return localStorage.getItem(KEY) || 'light'; }catch(e){ return 'light'; } };
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
  function toggle(){ const t = get() === 'dark' ? 'light' : 'dark'; try{ localStorage.setItem(KEY, t); }catch(e){} apply(t); window.dispatchEvent(new CustomEvent('lhqtheme', {detail:t})); }
  document.documentElement.dataset.theme = get();
  document.addEventListener('DOMContentLoaded', () => {
    apply(get());
    document.addEventListener('click', e => { if(e.target.closest && e.target.closest('.theme-btn')) toggle(); });
  });
  /* another tab changed it */
  window.addEventListener('storage', e => { if(e.key === KEY) apply(get()); });
  window.lhqTheme = {get, toggle, apply, logo};
})();
