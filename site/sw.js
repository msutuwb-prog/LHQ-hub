/* LHQ Hub offline copy (service worker).
   Keeps the Hub's own files on the device, so pages open straight away and still open with no internet.
   Each file is shown from the device first, then quietly checked online; if LHQ Hub has been updated,
   the page shows "A newer version is ready" and one tap loads it. Saving and syncing (/api/…) always go online. */
const CACHE = 'lhq-hub-v5', FONTS = 'lhq-fonts-v1';
const CORE = ['index.html', 'doc.html', 'reports.html', 'checklist.html', 'tutor.html', 'hub.css', 'theme.js', 'pako.min.js', 'store.js', 'sync.js',
  'defaults.js', 'hubdata.js', 'nav.js', 'schools.js', 'business.js', 'insights.js', 'perf.js', 'cards.js', 'sra.js', 'teach.js', 'card.js', 'topics.js', 'codec.js', 'report-render.js',
  'logo.png', 'logo-white.png', 'arrow.png', 'icon-32.png', 'icon-180.png', 'icon-192.png', 'icon-app-192.png', 'icon-app-512.png',
  'manifest.webmanifest', 'lib/html2pdf.bundle.min.js'];
const CHECK_EVERY = 60000;   // look online for a newer copy of a file at most once a minute (an unchanged file costs a tiny 'not modified' reply)
const checked = new Map();

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
  const now = Date.now();
  if(cached && key.startsWith('lib/')) return;   // libraries never change at the same address
  if(cached && now - (checked.get(key) || 0) < CHECK_EVERY) return;
  checked.set(key, now);
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
  // then quietly look for a newer copy
  e.waitUntil(found.then(({cached}) => cached ? refresh(key, new Request(key, {cache: 'no-cache'}), cached) : null));
});
