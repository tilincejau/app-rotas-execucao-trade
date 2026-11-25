// Guarda o app no aparelho para abrir sem internet (rede primeiro, cópia local se estiver offline).
const VERSAO = 'campo-v1';
const ARQUIVOS = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/regras.js', 'js/db.js', 'js/app.js', 'manifest.webmanifest',
  'img/icone-192.png', 'img/icone-512.png', 'img/apple-touch-icon.png', 'img/icon.svg', 'img/logo.png',
  'img/fluxos/craft.jpg', 'img/fluxos/premium.jpg', 'img/fluxos/lono.jpg', 'img/fluxos/mainstream.jpg', 'img/fluxos/mamba.jpg', 'img/fluxos/geladeira.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => Promise.all(ARQUIVOS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || new Response('', { status: 404 }))));
});
