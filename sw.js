const CACHE = 'journal-v46';
const SHELL = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/animations.css',
  '/js/supabase-config.js',
  '/js/auth.js',
  '/js/crypto.js',
  '/js/drive.js',
  '/js/payment.js',
  '/js/db.js',
  '/js/scripture.js',
  '/js/router.js',
  '/js/home.js',
  '/js/entry.js',
  '/js/freewrite.js',
  '/js/calendar.js',
  '/js/goals.js',
  '/js/routines.js',
  '/js/recap.js',
  '/js/gallery.js',
  '/js/app.js',
  '/assets/logo.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/data/scriptures.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests for same-origin or CDN assets
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Let Supabase, Stripe, Google API calls go through network only
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('stripe.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('googleusercontent.com')
  ) return;

  // Network-first: users always get the latest app code on first load
  // (cache-first meant every update needed an extra reload to appear).
  // The cache is only used when offline.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
