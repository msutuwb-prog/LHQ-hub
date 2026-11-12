/* LHQ Hub › motion: figures count up, rings and bars fill, ticks pop, sheets slide up.
   Per device (More › Appearance › Motion). On by default, Off where the phone asks for reduced motion or saves data.
   Counting and filling run the first time a page opens each day, never on the redraws that follow a tap.
   Only transform, opacity and SVG strokes move, so older phones aren't slowed; tables, lists and grids never move. */
window.MOTION = (function(){
  const KEY = 'lhq_motion', SEEN = 'lhq_mo_seen';
  const quiet = () => { try{ return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(navigator.connection && navigator.connection.saveData); }catch(e){ return false; } };
  const get = () => { let v = null; try{ v = localStorage.getItem(KEY); }catch(e){} return v === 'on' || v === 'off' ? v : (quiet() ? 'off' : 'on'); };
  const on = () => get() === 'on';
  const apply = () => document.documentElement.classList.toggle('mo', on());
  function set(v){ try{ localStorage.setItem(KEY, v); }catch(e){} apply(); }
  const today = () => { const d = new Date(Date.now() + 2 * 3600e3); return d.toISOString().slice(0, 10); };
  /* first time this page opens today? (the page, not every redraw) */
  function first(key){ let o = {}; try{ o = JSON.parse(localStorage.getItem(SEEN) || '{}'); }catch(e){} const t = today();
    if(o[key] === t) return false; Object.keys(o).forEach(k => { if(o[k] !== t) delete o[k]; }); o[key] = t; try{ localStorage.setItem(SEEN, JSON.stringify(o)); }catch(e){} return true; }
  const FIG = '.mc .v, .sx-pc .v, .f-four b, .t-ses b, .sf-kv b, .mk-big, .f-big, .kp-big, .mi-big, .tp-big, .mcs .v, .ac-big';
  const BAR = '[class*="bar"]:not(.hn-bar):not(.sx-bar):not(.fbar):not(.ac-bar):not(.tbar) > [style*="width"]';
  const ease = t => 1 - Math.pow(1 - t, 3);
  function count(el){
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while((n = w.nextNode()) && !n.nodeValue.trim());
    if(!n) return; const m = /^(\s*[^\d\s]{0,3}\s?)(\d[\d,]*)(\.\d+)?(\D*)$/.exec(n.nodeValue); if(!m) return;
    const dec = m[3] ? m[3].length - 1 : 0, to = +(m[2].replace(/,/g, '') + (m[3] || '')), comma = m[2].includes(','), pre = m[1], suf = m[4]; if(!(to > 1) || to > 1e9) return;
    const fmt = v => pre + (comma ? v.toLocaleString('en-GB', {minimumFractionDigits: dec, maximumFractionDigits: dec}) : v.toFixed(dec)) + suf, t0 = performance.now(), D = 700;
    n.nodeValue = fmt(0); const step = t => { if(!n.isConnected) return; const p = Math.min(1, (t - t0) / D); n.nodeValue = fmt(to * ease(p)); if(p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
  }
  function fill(root){
    root.querySelectorAll(BAR).forEach(el => { if(!el.animate) return; el.style.transformOrigin = 'left center'; el.animate([{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], {duration: 800, easing: 'cubic-bezier(.2,.7,.2,1)'}); });
    root.querySelectorAll('circle[stroke-dasharray]').forEach(c => { const v = (c.getAttribute('stroke-dasharray') || '').split(/[\s,]+/).map(Number); if(v.length < 2 || !c.animate || !(v[0] > 0)) return;
      c.animate([{strokeDasharray: `0 ${v[1]}`}, {strokeDasharray: `${v[0]} ${v[1]}`}], {duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)'}); });
  }
  /* after each page draw: count and fill only on the page's first open today */
  function after(){
    if(!on()) return; const main = document.getElementById('main'); if(!main) return;
    const key = (location.hash || '#').split('/').slice(0, 2).join('/'); if(!first(key)) return;
    main.querySelectorAll(FIG).forEach(count); fill(main);
  }
  /* a tapped tick pops (found again after the redraw) */
  let lastSel = null;
  document.addEventListener('click', e => { if(!on()) return; const b = e.target.closest('button, [role=button], [role=checkbox], [role=radio]'); if(!b) return;
    const a = [...b.attributes].find(x => /^data-/.test(x.name)); lastSel = a ? `[${a.name}="${CSS.escape(a.value)}"]` : null;
    if(lastSel) setTimeout(() => { const el = document.querySelector(lastSel); if(!el) return; const mk = el.matches('.f-tick, .t-ob') ? el : el.querySelector('.f-mk.ok, .f-tick.on, .t-obm, .t-ind, .tk .f-mk.ok, .sw.on, .sp-sw.on');
      if(mk && mk.animate) mk.animate([{transform: 'scale(.6)'}, {transform: 'scale(1.08)'}, {transform: 'scale(1)'}], {duration: 260, easing: 'ease-out'}); }, 30); }, true);
  /* a sheet sliding up, and its shade fading in (only when it opens, not when it redraws) */
  function sheet(){
    if(!on()) return; const s = document.getElementById('sheet'), bg = document.getElementById('shbg');
    if(s && s.animate) s.animate([{transform: 'translateY(28px)', opacity: .4}, {transform: 'none', opacity: 1}], {duration: 180, easing: 'ease-out'});
    if(bg && bg.animate) bg.animate([{opacity: 0}, {opacity: 1}], {duration: 180});
  }
  apply();
  return {get, set, on, after, sheet};
})();
