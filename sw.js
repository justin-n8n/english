/* 離線快取（照 34.修行紀錄App 的 sw.js）：有網路時先抓最新版並更新快取；網路慢 3 秒或沒網路時用快取。
   新增檔案時把它加進 FILES，並把 VERSION 加一。 */
const VERSION = 'english-v0.2.1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true });
  const net = fetch(new Request(e.request.url, { cache: 'no-cache' })).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  e.respondWith(new Promise(resolve => {
    let done = false;
    const give = r => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => fromCache().then(give), 3000);
    net.then(r => { clearTimeout(timer); give(r); })
      .catch(() => {
        clearTimeout(timer);
        fromCache().then(hit => hit || caches.match('index.html')).then(r => { give(r); if (!done) { done = true; resolve(Response.error()); } });
      });
  }));
});
