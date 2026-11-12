/* LHQ Hub › search: one box for everything, opened from the top bar, with / or Ctrl+K on a computer.
   The Hub supplies what can be found (LHQSearch.provider = () => groups), already limited to what this person may open;
   this file matches as you type and shows the results. Nothing goes to the server. */
window.LHQSearch = (function(){
  const RK = 'lhq_search_recent';
  let provider = null, scope = '', sel = 0, flat = [], el = null, wide = '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[,]/g, '');
  const rx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const read = () => { try{ return JSON.parse(localStorage.getItem(RK) || '[]'); }catch(e){ return []; } };
  const remember = it => { try{ const L = read().filter(x => x.href !== it.href); L.unshift({t: it.t, s: it.s, href: it.href, g: it.g}); localStorage.setItem(RK, JSON.stringify(L.slice(0, 6))); }catch(e){} };
  /* every word typed must appear; names that start with the first word come first */
  function score(it, toks){
    const n = norm(it.t), h = n + ' ' + norm(it.k) + ' ' + norm(it.s);
    if(!toks.every(t => h.includes(t))) return 0;
    let sc = 1; if(n.startsWith(toks[0])) sc += 4; else if(new RegExp('\\b' + rx(toks[0])).test(n)) sc += 3; else if(n.includes(toks[0])) sc += 1;
    if(toks.length > 1 && n.includes(toks.join(' '))) sc += 2;
    return sc;
  }
  function results(q){
    const G = provider ? provider() : [], toks = norm(q).split(/\s+/).filter(Boolean);
    if(!toks.length){
      const R = read().filter(r => G.some(g => g.items.some(i => i.href === r.href)));
      const A = (G.find(g => g.g === 'Actions') || {items: []}).items.slice(0, 4);
      return [R.length ? {g: 'Recent', items: R} : null, A.length ? {g: 'Actions', items: A} : null].filter(Boolean);
    }
    const out = G.map(g => { const L = g.items.map(i => [score(i, toks), i]).filter(x => x[0]).sort((a, b) => b[0] - a[0]);
      return {g: g.g, n: L.length, items: L.slice(0, g.g === wide ? 60 : g.g === scope ? 8 : 5).map(x => x[1])}; }).filter(g => g.items.length);
    out.sort((a, b) => (b.g === scope) - (a.g === scope));
    return out;
  }
  const hl = (t, q) => { let h = esc(t); norm(q).split(/\s+/).filter(Boolean).forEach(w => { h = h.replace(new RegExp('(' + rx(esc(w)) + ')', 'ig'), '<mark>$1</mark>'); }); return h; };
  function draw(){
    const q = el.querySelector('#gsQ').value, R = results(q); flat = [];
    el.querySelector('#gsR').innerHTML = R.map(g => `<div class="gs-h">${esc(g.g)}${g.n > g.items.length ? ` <button class="gs-all" data-gsall="${esc(g.g)}">All ${g.n}</button>` : ''}</div>` + g.items.map(i => { flat.push(Object.assign({g: g.g}, i));
      return `<a class="gs-it${flat.length - 1 === sel ? ' on' : ''}" href="${esc(i.href)}" data-gsi="${flat.length - 1}">${i.ic ? `<span class="gs-ic">${i.ic}</span>` : ''}<span class="gs-t"><b>${hl(i.t, q)}</b>${i.s ? `<small>${hl(i.s, q)}</small>` : ''}</span></a>`; }).join('')).join('')
      || (q.trim() ? `<p class="gs-none">Nothing for “${esc(q)}”</p>` : '<p class="gs-none">Type a name, a number or a page</p>');
    el.querySelectorAll('[data-gsi]').forEach(a => a.onclick = () => { remember(flat[+a.dataset.gsi]); close(); });
    el.querySelectorAll('[data-gsall]').forEach(b => b.onclick = () => { wide = b.dataset.gsall; draw(); el.querySelector('#gsQ').focus(); });
  }
  function open(sc){
    if(!provider) return;
    scope = sc || ''; sel = 0; wide = '';
    if(!el){
      el = document.createElement('div'); el.id = 'gs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Search');
      el.innerHTML = `<div class="gs-bg" data-gsx></div><div class="gs-p"><div class="gs-in"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="gsQ" type="search" placeholder="Search students, documents, people, pages" autocomplete="off" enterkeyhint="go"><button class="gs-x" data-gsx aria-label="Close">✕</button></div><div id="gsR" class="gs-r"></div></div>`;
      document.body.appendChild(el);
      el.querySelectorAll('[data-gsx]').forEach(b => b.onclick = close);
      const Q = el.querySelector('#gsQ');
      Q.oninput = () => { sel = 0; wide = ''; draw(); };
      Q.onkeydown = e => {
        if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); sel = Math.max(0, Math.min(flat.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); draw(); const on = el.querySelector('.gs-it.on'); if(on) on.scrollIntoView({block: 'nearest'}); }
        if(e.key === 'Enter' && flat[sel]){ e.preventDefault(); remember(flat[sel]); const h = flat[sel].href; close(); location.href = h; }
        if(e.key === 'Escape') close();
      };
    }
    el.hidden = false; document.documentElement.classList.add('gs-open');
    const Q = el.querySelector('#gsQ'); Q.value = ''; draw(); setTimeout(() => Q.focus(), 30);
  }
  function close(){ if(el){ el.hidden = true; document.documentElement.classList.remove('gs-open'); } }
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
    if(((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !typing && !document.querySelector('#sheet:not([hidden]) .hx'))){
      if(!provider) return; e.preventDefault(); open(window.LHQSearchScope ? window.LHQSearchScope() : '');
    }
  });
  window.addEventListener('hashchange', close);
  const css = document.createElement('style');
  css.textContent = `#gs{position:fixed;inset:0;z-index:9999}#gs[hidden]{display:none}
.gs-bg{position:absolute;inset:0;background:rgba(10,18,32,.45)}
.gs-p{position:relative;margin:9vh auto 0;width:min(640px,calc(100% - 32px));max-height:78vh;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden}
.gs-in{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line);color:var(--muted)}
.gs-in input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:16.5px;color:var(--ink)}
.gs-in input::-webkit-search-cancel-button{display:none}
.gs-x{border:0;background:none;color:var(--muted);font-size:17px;padding:4px 6px;cursor:pointer}
.gs-r{overflow:auto;padding:4px 8px 10px}
.gs-h{font-size:10.5px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;padding:12px 8px 4px;display:flex;justify-content:space-between}
.gs-all{border:0;background:none;color:var(--brand);font:inherit;font-size:12px;font-weight:800;text-transform:none;letter-spacing:0;cursor:pointer;padding:0}
.gs-it{display:flex;align-items:center;gap:12px;padding:9px 8px;border-radius:10px;color:var(--ink);text-decoration:none}
.gs-it:hover,.gs-it.on{background:var(--hover,rgba(127,127,127,.1))}
.gs-ic{width:30px;height:30px;border-radius:9px;background:var(--bg);display:grid;place-items:center;color:var(--brand);flex:none}
.gs-t{min-width:0}.gs-t b{display:block;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gs-t small{display:block;color:var(--muted);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gs-t mark{background:none;color:inherit;text-decoration:underline;text-decoration-color:var(--gold,#f4b223);text-decoration-thickness:2px;text-underline-offset:2px}
.gs-none{color:var(--muted);padding:16px 8px;margin:0}
@media (max-width:699px){.gs-p{margin:0;width:100%;height:100%;max-height:none;border-radius:0;border:0;padding-top:env(safe-area-inset-top)}.gs-bg{display:none}}
html.gs-open,html.gs-open body{overflow:hidden}`;
  document.head.appendChild(css);
  return {open, close, set provider(f){ provider = f; }, get provider(){ return provider; }};
})();
