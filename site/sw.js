/* LHQ Hub offline copy (service worker).
   Keeps the Hub's own files on the device, so pages open straight away and still open with no internet.
   Each file is shown from the device first. A release (a new CACHE name) installs fresh files and the page shows
   "A newer version is ready"; one tap loads it. A sweep every 12 hours catches anything else. Saving and syncing (/api/…) always go online. */
const CACHE = 'lhq-hub-v61', FONTS = 'lhq-fonts-v1';
const CORE = ['index.html', 'doc.html', 'reports.html', 'checklist.html', 'tutor.html', 'account.html', 'hub.css', 'theme.js', 'picker.js', 'testbar.js', 'schedule.js', 'sreport.js', 'search.js', 'marks.js', 'pako.min.js', 'store.js', 'sync.js',
  'defaults.js', 'payplan.js', 'hubdata.js', 'nav.js', 'schools.js', 'business.js', 'insights.js', 'moneyin.js', 'perf.js', 'cards.js', 'sra.js', 'attn.js', 'examdata.js', 'exams.js', 'examsui.js', 'kpi.js', 'kpiui.js', 'tpay.js', 'tpayui.js', 'srafig.js', 'fu.js', 'stuview.js', 'motion.js', 'move.js', 'fx.js', 'sxtras.js', 'splan.js', 'review.js', 'sounds.js', 'push.js', 'teach.js', 'famdocs.js', 'family.js', 'card.js', 'topics.js', 'codec.js', 'report-render.js',
  'logo.png', 'logo-white.png', 'arrow.png', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-app-192.png', 'icon-app-512.png', 'badge-96.png',
  'manifest.webmanifest', 'lib/html2pdf.bundle.min.js'];
/* Checking for updates, cheaply (every request counts against Netlify's credits):
   - a release changes CACHE below, so the browser installs this worker again with fresh files and the page offers the new version;
   - as a safety net, once every 12 hours on a device the stored pages are compared with the online copies (about 50 small requests). */
const SWEEP_EVERY = 12 * 3600e3, META = 'lhq-meta';
async function sweepDue(){
  try{
    const m = await caches.open(META), r = await m.match('/__sweep'), last = r ? +(await r.text()) : 0, now = Date.now();
    if(now - last < SWEEP_EVERY) return false;
    await m.put('/__sweep', new Response(String(now))); return true;
  }catch(e){ return false; }
}
async function sweep(){
  if(!(await sweepDue())) return;
  const cache = await caches.open(CACHE);
  for(const key of CORE){ if(key.startsWith('lib/')) continue; const cached = await cache.match(key); if(cached) await refresh(key, new Request(key, {cache: 'no-cache'}), cached); }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {}))))
    .then(() => caches.open(META)).then(m => m.put('/__sweep', new Response(String(Date.now()))))   // just fetched: no sweep needed yet
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(async ks => {
    const old = ks.filter(k => k !== CACHE && k !== FONTS && k !== META);
    await Promise.all(old.map(k => caches.delete(k))); await self.clients.claim();
    if(old.some(k => /^lhq-hub-v/.test(k))) soon();   // a new release replaced an older one: offer it on the open page
  }));
});

/* "/", "/t" (tutor links) and page addresses map onto the stored pages */
function keyFor(url){
  const p = url.pathname.replace(/^\//, '');
  if(p === '' ) return 'index.html';
  if(p === 't') return 'tutor.html';
  return p;
}
async function notify(){ (await self.clients.matchAll({type: 'window'})).forEach(c => c.postMessage({type: 'lhq-updated'})); }
let notifyTimer = null;
const soon = () => { clearTimeout(notifyTimer); notifyTimer = setTimeout(notify, 800); };

async function refresh(key, req, cached){
  if(cached && key.startsWith('lib/')) return;   // libraries never change at the same address
  try{
    const res = await fetch(req, {cache: 'no-cache'});
    if(!res.ok || res.type !== 'basic') return;
    const cache = await caches.open(CACHE);
    if(cached && !key.startsWith('lib/')){
      const [a, b] = await Promise.all([cached.clone().text(), res.clone().text()]);
      if(a === b) return;
      await cache.put(key, res); soon();   // a newer version of the Hub
    } else await cache.put(key, res);
  }catch(e){ /* offline: keep what is stored */ }
}

self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // fonts: once fetched, always from the device
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(FONTS).then(async c => (await c.match(req)) || fetch(req).then(r => { if(r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; })));
    return;
  }
  if(url.origin !== self.location.origin) return;
  if(url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;   // saving and syncing are always live
  const key = keyFor(url);
  const found = caches.open(CACHE).then(cache => cache.match(key, {ignoreSearch: true}).then(cached => ({cache, cached})));
  e.respondWith(found.then(async ({cache, cached}) => {
    if(cached) return cached.clone();   // the original is kept to compare with the online copy
    try{
      const res = await fetch(req);
      if(res.ok && res.type === 'basic' && CORE.includes(key)) cache.put(key, res.clone());
      return res;
    }catch(err){
      if(req.mode === 'navigate'){ const home = await cache.match('index.html'); if(home) return home; }
      throw err;
    }
  }));
  // opening a page: now and then, quietly compare the stored files with the online ones
  if(req.mode === 'navigate') e.waitUntil(sweep());
});

/* phone notifications: show what the Hub sends, and open the right page when tapped */
self.addEventListener('push', e => {
  let m = {}; try{ m = e.data ? e.data.json() : {}; }catch(err){ m = {title: 'LHQ Hub', body: e.data ? e.data.text() : ''}; }
  const actions = (m.actions || []).slice(0, 2).map(a => ({action: a.url, title: a.title}));
  self.clients.matchAll({type: 'window'}).then(L => L.forEach(c => c.postMessage({type: 'lhq-push', kind: m.tag || ''})));   // a sound while LHQ Hub is open
  e.waitUntil(self.registration.showNotification(m.title || 'LHQ Hub', {body: m.body || '', icon: 'icon-app-192.png', badge: 'badge-96.png', tag: m.tag || undefined, renotify: !!m.tag, data: {url: m.url || '/'}, actions}));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.action || (e.notification.data && e.notification.data.url) || '/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(L => {
    const w = L.find(c => c.url.startsWith(self.registration.scope));
    if(w){ w.focus(); return w.navigate ? w.navigate(url) : null; }
    return self.clients.openWindow(url);
  }));
});
