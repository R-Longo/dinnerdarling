// Dinner Darling service worker.
// Bump VERSION when shipping changes to app files so phones pick them up.
const VERSION = 'v49';
const CACHE = `dinner-darling-${VERSION}`;
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'art.js', 'recipes.json', 'assets/assets.json', 'manifest.webmanifest',
  'fonts/fraunces.woff2', 'fonts/fraunces-italic.woff2', 'fonts/figtree.woff2',
  'icons/tomato.svg', 'assets/decor/basil.webp', 'assets/decor/garlic.webp', 'assets/decor/herbs.webp', 'assets/decor/lemon-branch.webp', 'assets/decor/olive.webp', 'assets/decor/rosemary-peek.webp', 'assets/header-vine.webp', 'assets/mascot/tilly-header.webp', 'assets/mascot/basil-cat.webp', 'assets/mascot/ollie-olive.webp', 'assets/mascot/tilly-cooking-home.webp', 'assets/meal-type/pasta.webp', 'assets/meal-type/bowls.webp', 'assets/meal-type/salad.webp', 'assets/meal-type/sheet-pan.webp', 'assets/meal-type/skillet.webp', 'assets/meal-type/soup.webp', 'assets/protein/chicken.webp', 'assets/protein/pork.webp', 'assets/protein/salmon.webp', 'assets/protein/steak.webp', 'assets/protein/fish.webp', 'assets/protein/beef.webp', 'assets/protein/vegetarian.webp', 'assets/protein/turkey.webp', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Recipes and the page itself: network first, so edits show up right away; cache when offline.
  if (url.pathname.endsWith('/recipes.json') || url.pathname.endsWith('/assets.json') || req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Everything else: serve from cache, refresh in the background.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
