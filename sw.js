// Tizon Tour – עבודה אופליין: האפליקציה, הנתונים (במכשיר), המפה ואריחי מפה שנצפו
const CACHE = 'tizon-tour-2.0.1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'firebase-config.js', 'logo.svg', 'logo.png', 'logo-dark.png', 'manifest.webmanifest'];
const RUNTIME_OK = /cdnjs\.cloudflare\.com|tile\.openstreetmap\.org|fonts\.(googleapis|gstatic)\.com/;
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const same = u.origin === location.origin;
  if (!same && !RUNTIME_OK.test(u.hostname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});
