const CACHE = 'skiftlon-v1';
const FILER = ['./', './index.html', './styles.css', './app.js', './avtal.js', './avtalssatser.js', './manifest.webmanifest', './ikon-192.png', './ikon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILER)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(n => Promise.all(n.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(svar => {
        const kopia = svar.clone();
        caches.open(CACHE).then(c => c.put(e.request, kopia));
        return svar;
      })
      .catch(() => caches.match(e.request).then(t => t || caches.match('./index.html')))
  );
});
