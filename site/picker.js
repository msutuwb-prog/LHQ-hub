/* LHQ Hub: one dropdown look everywhere.
   Every <select> and every typed field with a suggestion list (<input list>) opens the Hub's own list instead of the
   phone's or browser's: a sheet from the bottom on phones, a list under the field on bigger screens. The selected
   option has a tick, long lists get a search box, and picking fires the usual input/change events, so the page code
   that reads the field doesn't change. Add data-native to a field to keep the browser's own list. */
(function(){
  if(window.__lhqPicker) return; window.__lhqPicker = true;
  const css = `
.lpk-bg{position:fixed;inset:0;z-index:9998;background:rgba(10,18,30,.35)}
.lpk-bg.pop{background:transparent}
.lpk{position:fixed;z-index:9999;background:var(--surface,#fff);color:var(--ink,#14213d);border:1px solid var(--line,#e4e7ec);border-radius:14px;box-shadow:0 18px 40px rgba(10,18,30,.22);display:flex;flex-direction:column;overflow:hidden;font:inherit}
.lpk.sheet{left:0;right:0;bottom:0;border-radius:18px 18px 0 0;max-height:78vh;padding-bottom:env(safe-area-inset-bottom)}
.lpk .lpk-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px 6px}
.lpk .lpk-h b{font-size:16px}
.lpk .lpk-x{border:0;background:none;color:var(--muted,#6b7585);font-size:22px;line-height:1;width:36px;height:36px;border-radius:10px;cursor:pointer}
.lpk .lpk-s{margin:6px 12px 6px;width:auto;min-height:40px;padding:8px 12px;border:1px solid var(--line,#e4e7ec);border-radius:10px;background:var(--field,#fff);color:var(--ink,#14213d);font:inherit;font-size:16px}
.lpk ul{list-style:none;margin:0;padding:4px 0 8px;overflow:auto;overscroll-behavior:contain}
.lpk li{display:flex;align-items:center;gap:10px;padding:12px 16px;min-height:46px;cursor:pointer;font-size:15px;border-top:1px solid var(--line2,#eef0f3)}
.lpk li:first-child{border-top:0}
.lpk li:hover,.lpk li.on{background:var(--hover,#eef1f5)}
.lpk li .t{flex:1;min-width:0}
.lpk li small{display:block;color:var(--muted,#6b7585);font-size:12.5px;margin-top:1px}
.lpk li .ck{width:20px;height:20px;flex:none;border-radius:50%;border:1.6px solid var(--line,#d4d9e1);display:inline-flex;align-items:center;justify-content:center}
.lpk li[aria-selected=true] .ck{background:var(--accent,#073763);border-color:var(--accent,#073763);color:var(--onaccent,#fff)}
.lpk li[aria-selected=true]{font-weight:700}
.lpk li.ph{color:var(--muted,#6b7585)}
.lpk li[aria-disabled=true]{opacity:.45;cursor:not-allowed}
.lpk .lpk-g{padding:10px 16px 4px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#6b7585);cursor:default;min-height:0;border-top:0}
.lpk .lpk-g:hover{background:none}
.lpk .lpk-e{color:var(--muted,#6b7585);cursor:default}
.lpk .lpk-e:hover{background:none}`;
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  const TICK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const phone = () => matchMedia('(max-width:640px)').matches;
  const labelOf = el => {
    if(el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const l = el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    const sp = l && (l.querySelector('span') || l); const t = sp ? sp.textContent.replace(/\*/g, '').trim() : '';
    return t && t.length < 60 ? t : 'Choose';
  };
  let cur = null;   // {el, kind, items, act, wrap, bg, list, search}

  function itemsOf(el, q){
    const ql = (q || '').trim().toLowerCase();
    if(el.tagName === 'SELECT'){
      const out = [];
      [...el.children].forEach(n => {
        const opts = n.tagName === 'OPTGROUP' ? [...n.children] : [n];
        const mine = opts.filter(o => o.tagName === 'OPTION' && !o.hidden && (!ql || o.textContent.toLowerCase().includes(ql)));
        if(n.tagName === 'OPTGROUP' && mine.length) out.push({g:n.label});
        mine.forEach(o => { const t = o.textContent.trim(); if(o.value === '' && /^(choose|select)\b/i.test(t)) return; out.push({v:o.value, t, sel:o.selected && !(o.value === '' && !t), dis:o.disabled, ph:o.value === ''}); });
      });
      return out;
    }
    const dl = document.getElementById(el.dataset.lpkList || el.getAttribute('list')); if(!dl) return [];
    const all = [...dl.querySelectorAll('option')].map(o => ({v:o.value, t:o.value, sub:o.label && o.label !== o.value ? o.label : '', sel:o.value === el.value}));
    const m = ql ? all.filter(x => x.t.toLowerCase().includes(ql)) : all;
    return m.slice(0, 80);
  }
  function draw(){
    const c = cur; if(!c) return;
    const q = c.kind === 'select' ? (c.search ? c.search.value : '') : c.el.value;
    c.items = itemsOf(c.el, c.kind === 'list' && c.items0 === c.el.value ? '' : q);
    const pick = c.items.filter(x => !x.g && !x.dis);
    if(c.act == null || c.act >= pick.length) c.act = pick.findIndex(x => x.sel);
    let n = -1;
    c.list.innerHTML = c.items.map(x => {
      if(x.g) return `<li class="lpk-g" role="presentation">${esc(x.g)}</li>`;
      const i = x.dis ? -1 : ++n;
      return `<li role="option" data-i="${i}" id="lpk${i}" aria-selected="${!!x.sel}"${x.dis ? ' aria-disabled="true"' : ''} class="${x.ph ? 'ph' : ''}${i === c.act ? ' on' : ''}"><span class="t">${esc(x.t || (x.ph ? 'None' : ''))}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span><span class="ck">${x.sel ? TICK : ''}</span></li>`;
    }).join('') || `<li class="lpk-e" role="presentation">${c.kind === 'list' ? 'Nothing matches. What you typed will be used.' : 'Nothing matches.'}</li>`;
    c.pick = pick;
  }
  function place(){
    const c = cur; if(!c) return;
    if(phone() && c.kind === 'select'){ c.wrap.className = 'lpk sheet'; c.bg.className = 'lpk-bg'; c.wrap.removeAttribute('style'); return; }
    c.wrap.className = 'lpk'; c.bg.className = 'lpk-bg pop'; if(c.kind === 'list') c.bg.style.display = 'none';
    c.wrap.style.display = c.kind === 'list' && !c.pick.length ? 'none' : '';
    const r = c.el.getBoundingClientRect(), w = Math.max(r.width, 240), below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 240 && above > below, h = Math.min(360, Math.max(160, up ? above : below));
    Object.assign(c.wrap.style, {left: Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px', width: w + 'px', maxHeight: h + 'px', top: up ? 'auto' : (r.bottom + 6) + 'px', bottom: up ? (innerHeight - r.top + 6) + 'px' : 'auto'});
  }
  function open(el){
    if(cur) shut();
    const kind = el.tagName === 'SELECT' ? 'select' : 'list';
    if(kind === 'list' && !itemsOf(el, '').length) return;
    const bg = document.createElement('div'), wrap = document.createElement('div');
    const n = kind === 'select' ? el.options.length : 0, wantSearch = kind === 'select' && (n > 9 || phone() && n > 7);
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', labelOf(el));
    wrap.innerHTML = (phone() && kind === 'select' ? `<div class="lpk-h"><b>${esc(labelOf(el))}</b><button type="button" class="lpk-x" aria-label="Close">×</button></div>` : '') +
      (wantSearch ? `<input class="lpk-s" type="search" placeholder="Search" autocomplete="off" aria-label="Search ${esc(labelOf(el))}">` : '') +
      `<ul role="listbox" aria-label="${esc(labelOf(el))}"></ul>`;
    document.body.append(bg, wrap);
    cur = {el, kind, wrap, bg, list: wrap.querySelector('ul'), search: wrap.querySelector('.lpk-s'), act: null, items0: el.value};
    el.setAttribute('aria-expanded', 'true');
    draw(); place();
    const on = cur.list.querySelector('li.on'); if(on) on.scrollIntoView({block:'nearest'});
    bg.addEventListener('pointerdown', e => { e.preventDefault(); shut(); });
    const x = wrap.querySelector('.lpk-x'); if(x) x.onclick = () => shut(true);
    cur.list.addEventListener('pointerdown', e => e.preventDefault());   // keep the field focused
    cur.list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if(li && +li.dataset.i >= 0) choose(+li.dataset.i); });
    if(cur.search){ cur.search.addEventListener('input', () => { cur.act = 0; draw(); }); cur.search.addEventListener('keydown', keys); if(!phone()) cur.search.focus(); }
  }
  function shut(refocus){
    if(!cur) return; const c = cur; cur = null;
    c.wrap.remove(); c.bg.remove(); c.el.setAttribute('aria-expanded', 'false');
    if(refocus && c.kind === 'select') c.el.focus({preventScroll:true});
  }
  function choose(i){
    const c = cur, x = c && c.pick[i]; if(!x) return;
    const was = c.el.value; c.el.value = x.v; shut(true);
    if(c.el.value !== was || c.kind === 'list'){ c.el.dispatchEvent(new Event('input', {bubbles:true})); c.el.dispatchEvent(new Event('change', {bubbles:true})); }
  }
  function move(d){
    const c = cur; if(!c || !c.pick.length) return;
    c.act = (c.act + d + c.pick.length) % c.pick.length;
    c.list.querySelectorAll('li[data-i]').forEach(li => li.classList.toggle('on', +li.dataset.i === c.act));
    const li = c.list.querySelector(`li[data-i="${c.act}"]`); if(li) li.scrollIntoView({block:'nearest'});
  }
  function keys(e){
    if(!cur) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
    else if(e.key === 'Enter'){ if(cur.pick.length && (cur.kind === 'select' || cur.list.querySelector('li.on'))){ e.preventDefault(); choose(cur.act); } }
    else if(e.key === 'Escape'){ e.preventDefault(); shut(true); }
    else if(e.key === 'Tab') shut();
  }
  const ours = el => el && !el.disabled && !el.readOnly && !el.hasAttribute('data-native') && !(el.tagName === 'SELECT' && (el.multiple || el.size > 1)) &&
    (el.tagName === 'SELECT' || el.tagName === 'INPUT' && (el.getAttribute('list') || el.dataset.lpkList));
  // take the suggestion list off typed fields so the browser's own list never shows; ours uses it instead
  const adopt = el => { if(el.tagName === 'INPUT' && el.getAttribute('list') && !el.hasAttribute('data-native')){ el.dataset.lpkList = el.getAttribute('list'); el.removeAttribute('list'); el.setAttribute('autocomplete', 'off'); } };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if(n.nodeType !== 1) return; if(n.matches('input[list]')) adopt(n); n.querySelectorAll && n.querySelectorAll('input[list]').forEach(adopt); }))).observe(document.documentElement, {childList:true, subtree:true});
  document.querySelectorAll('input[list]').forEach(adopt);

  document.addEventListener('mousedown', e => { const el = e.target.closest && e.target.closest('select'); if(ours(el)){ e.preventDefault(); el.focus({preventScroll:true}); if(cur && cur.el === el) shut(); else open(el); } }, true);
  let tx = 0, ty = 0; document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, {capture:true, passive:true});
  document.addEventListener('touchend', e => { const t = e.changedTouches[0]; if(Math.abs(t.clientX - tx) > 10 || Math.abs(t.clientY - ty) > 10) return; const el = e.target.closest && e.target.closest('select'); if(ours(el)){ e.preventDefault(); el.focus({preventScroll:true}); if(cur && cur.el === el) shut(); else open(el); } }, {capture:true, passive:false});
  document.addEventListener('keydown', e => {
    const el = e.target;
    if(cur && (el === cur.el || el === cur.search)){ if(el === cur.el) keys(e); return; }
    if(ours(el) && el.tagName === 'SELECT' && [' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(e.key) && !e.altKey){ e.preventDefault(); open(el); }
    if(ours(el) && el.tagName === 'INPUT' && e.key === 'ArrowDown'){ e.preventDefault(); open(el); }
  }, true);
  document.addEventListener('focusin', e => { const el = e.target; if(ours(el) && el.tagName === 'INPUT' && !(cur && cur.el === el)) open(el); });
  document.addEventListener('input', e => { const el = e.target; if(!ours(el) || el.tagName !== 'INPUT') return; if(cur && cur.el === el){ cur.items0 = null; cur.act = 0; draw(); place(); } else open(el); });
  document.addEventListener('focusout', e => { if(cur && cur.kind === 'list' && e.target === cur.el) setTimeout(() => { if(cur && document.activeElement !== cur.el) shut(); }, 120); });
  addEventListener('resize', () => cur && place());
  addEventListener('scroll', e => { if(cur && !cur.wrap.contains(e.target) && !phone()) place(); }, true);
})();
