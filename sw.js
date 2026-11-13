// Service worker: cache tampilan saja. Data dan foto selalu diambil dari server.
// Strategi stale-while-revalidate: tampilan langsung dari cache (cepat, juga saat sinyal lemah),
// lalu diperbarui di belakang. Versi baru terpakai pada pembukaan berikutnya.
var CACHE = 'defect-list-v29';
var SHELL = ['./', 'index.html', 'app.js', 'config.js', 'logika.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API GAS dan foto Drive tidak di-cache
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        // Hanya respons sukses utuh yang disimpan (bukan 404 atau sebagian).
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () { });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
