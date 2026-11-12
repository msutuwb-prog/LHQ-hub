/* LHQ Hub › phone notifications on this device: turn on or off, what to get, quiet hours, other devices,
   and the one-line prompt on Home. The server sends; the service worker (sw.js) shows them. */
window.LHQPush = (function(){
  const DK = 'lhq_push_later';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const device = () => { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : ios() ? 'iPhone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Computer') + ' · ' + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /Firefox\//.test(u) ? 'Firefox' : 'browser'); };
  const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  let info = null;
  async function load(){ info = await hub.api('push'); return info; }
  async function mySub(){ if(!supported()) return null; const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
  async function enable(){
    if(!supported()) throw new Error(ios() && !standalone() ? 'Add LHQ Hub to your Home Screen first' : 'This browser can\'t show notifications');
    const i = info || await load(); if(!i.key) throw new Error('Notifications aren\'t set up on LHQ Hub yet');
    const p = await Notification.requestPermission(); if(p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked for LHQ Hub in this browser\'s settings' : 'Not turned on');
    const reg = await navigator.serviceWorker.ready;
    let s = await reg.pushManager.getSubscription();
    if(!s) s = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64(i.key)});
    await hub.api('push', {method: 'POST', body: JSON.stringify({action: 'subscribe', sub: s.toJSON(), ua: device()})});
    try{ localStorage.removeItem(DK); }catch(e){}
    await load(); return true;
  }
  async function disable(){
    const s = await mySub(); if(s){ await hub.api('push', {method: 'POST', body: JSON.stringify({action: 'unsubscribe', endpoint: s.endpoint})}); await s.unsubscribe(); }
    await load();
  }
  /* the one-line prompt on Home: once; "Not now" hides it for 2 weeks */
  async function prompt(){
    try{ if(+localStorage.getItem(DK) > Date.now()) return ''; }catch(e){}
    if(ios() && !standalone()) return `<div class="lp-ask"><span><b>Notifications</b><small>Share ⬆︎ › Add to Home Screen, then open LHQ Hub from there</small></span><button class="btn sm" data-lpx>OK</button></div>`;
    if(!supported() || Notification.permission !== 'default') return '';
    try{ const i = info || await load(); if(!i.key) return ''; }catch(e){ return ''; }
    return `<div class="lp-ask"><span><b>Notifications on this ${/Android|iPhone/.test(device()) ? 'phone' : 'device'}?</b></span><button class="btn sm n" data-lpon>Turn on</button><button class="btn sm" data-lpx>Not now</button></div>`;
  }
  function bindPrompt(root, after){
    (root || document).querySelectorAll('[data-lpx]').forEach(b => b.onclick = () => { try{ localStorage.setItem(DK, String(Date.now() + 14 * 864e5)); }catch(e){} b.closest('.lp-ask').remove(); });
    (root || document).querySelectorAll('[data-lpon]').forEach(b => b.onclick = async () => { try{ await enable(); window.toast && toast('Notifications on'); b.closest('.lp-ask').remove(); after && after(); }catch(e){ window.toast && toast(e.message); } });
  }
  /* Settings › Notifications */
  async function page(){
    let i; try{ i = await load(); }catch(e){ return `<p class="empty">${esc(e.message)}</p>`; }
    const s = await mySub().catch(() => null), on = !!(s && i.devices.some(d => d.endpoint === s.endpoint)), pr = i.prefs;
    const sw = (attr, v, l, sub) => `<div class="it"><span class="t"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span><button class="lp-sw${v ? ' on' : ''}" ${attr} role="switch" aria-checked="${!!v}" aria-label="${esc(l)}"></button></div>`;
    const when = {report: '16:00', sreport: 'after the last session', sra: '07:30'};
    const other = i.devices.filter(d => !s || d.endpoint !== s.endpoint);
    const cant = !supported() ? (ios() && !standalone() ? 'On iPhone: Share ⬆︎ › Add to Home Screen, then open LHQ Hub from there.' : 'This browser can\'t show notifications.') : !i.key ? 'Not set up on LHQ Hub yet.' : Notification.permission === 'denied' ? 'Blocked in this browser\'s settings for LHQ Hub.' : '';
    return `<div class="card">${cant ? `<p class="empty" style="margin:0">${cant}</p>` : sw('data-lpdev', on, 'This device', on ? 'On' : 'Off')}</div>
      <div class="h2">What</div><div class="card" style="${on ? '' : 'opacity:.5'}">${i.kinds.map(([k, l]) => sw(`data-lpk="${k}"`, !(pr.off || {})[k], l, when[k] || '')).join('')}
        ${sw('data-lpsum', pr.summary, 'Morning summary', 'One at 07:00')}</div>
      <div class="h2">Quiet hours</div><div class="card pad"><div class="r2"><label class="f" style="margin:0"><span>From</span><input class="in" type="time" id="lpQ1" value="${esc(pr.quiet[0])}"></label><label class="f" style="margin:0"><span>To</span><input class="in" type="time" id="lpQ2" value="${esc(pr.quiet[1])}"></label></div></div>
      ${other.length ? `<div class="h2">Other devices <em>${other.length}</em></div><div class="card">${other.map(d => `<div class="it"><span class="t"><b>${esc(d.ua || 'Device')}</b><small>Added ${new Date(d.at).toLocaleDateString()}</small></span><button class="btn sm" data-lprm="${esc(d.endpoint)}">Remove</button></div>`).join('')}</div>` : ''}
      ${on ? '<button class="btn full" data-lptest style="margin-top:4px">Send a test</button>' : ''}`;
  }
  function bindPage(rerender){
    const prefs = () => ({off: Object.assign({}, info.prefs.off), quiet: info.prefs.quiet.slice(), summary: info.prefs.summary});
    const save = async p => { try{ await hub.api('push', {method: 'POST', body: JSON.stringify(Object.assign({action: 'prefs'}, p))}); info.prefs = p; rerender(); }catch(e){ toast(e.message); } };
    document.querySelectorAll('[data-lpdev]').forEach(b => b.onclick = async () => { try{ if(b.classList.contains('on')){ await disable(); toast('Off on this device'); } else { await enable(); toast('Notifications on'); } }catch(e){ toast(e.message); } rerender(); });
    document.querySelectorAll('[data-lpk]').forEach(b => b.onclick = () => { const p = prefs(), k = b.dataset.lpk; if(p.off[k]) delete p.off[k]; else p.off[k] = true; save(p); });
    document.querySelectorAll('[data-lpsum]').forEach(b => b.onclick = () => { const p = prefs(); p.summary = !p.summary; save(p); });
    ['lpQ1', 'lpQ2'].forEach((id, n) => { const el = document.getElementById(id); if(el) el.onchange = () => { const p = prefs(); p.quiet[n] = el.value || p.quiet[n]; save(p); }; });
    document.querySelectorAll('[data-lprm]').forEach(b => b.onclick = async () => { await hub.api('push', {method: 'POST', body: JSON.stringify({action: 'unsubscribe', endpoint: b.dataset.lprm})}); toast('Removed'); rerender(); });
    document.querySelectorAll('[data-lptest]').forEach(b => b.onclick = async () => { try{ const j = await hub.api('push', {method: 'POST', body: JSON.stringify({action: 'test'})}); toast(j.sent ? 'Sent' : 'Not sent: check this device'); }catch(e){ toast(e.message); } });
  }
  const css = document.createElement('style');
  css.textContent = `.lp-sw{width:44px;height:26px;border-radius:13px;background:var(--line);position:relative;flex:none;border:0;padding:0;cursor:pointer}
.lp-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s}
.lp-sw.on{background:var(--ok)}.lp-sw.on::after{left:21px}
.lp-ask{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--am-bg,#fdf3d9);border-radius:14px;padding:10px 12px;margin-bottom:12px}.lp-ask span{flex:1;min-width:160px}.lp-ask b{display:block}.lp-ask small{color:var(--muted);font-size:12.5px}`;
  document.head.appendChild(css);
  return {supported, enable, disable, prompt, bindPrompt, page, bindPage, load};
})();
