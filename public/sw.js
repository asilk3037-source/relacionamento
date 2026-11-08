// Service worker: guarda só a "casca" do app para abrir rápido/offline. Nunca guarda API nem fotos de perfis.
const CACHE = 'elo-shell-v1';
const SHELL = ['/', '/css/app.css', '/js/main.js', '/js/core.js', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api') || u.pathname.startsWith('/media') || u.pathname.startsWith('/admin')) return;
  // rede primeiro (para receber atualizações); cache como reserva
  e.respondWith(fetch(e.request).then((r) => { if (r.ok && (u.pathname.startsWith('/js/') || u.pathname.startsWith('/css/') || u.pathname.startsWith('/assets/'))) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('/'))));
});
