// Guarda la app en el teléfono para que abra rápido y funcione sin señal en el gimnasio.
// Los datos se sincronizan con Supabase cuando vuelve la conexión.
const VERSION = 'entrenador-v4';
const ARCHIVOS = ['./', './index.html', './styles.css?v=4', './app.js?v=4', './logic.js?v=4', './api.js?v=4', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './fonts/raleway-latin-400-normal.woff2', './fonts/raleway-latin-500-normal.woff2', './fonts/raleway-latin-600-normal.woff2', './fonts/raleway-latin-700-normal.woff2', './fonts/raleway-latin-800-normal.woff2', './fonts/raleway-latin-900-normal.woff2', './fonts/lora-latin-500-italic.woff2', './fonts/lora-latin-600-italic.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return; // datos: siempre a la red
  if (url.origin === location.origin) {
    // Primero la red (para recibir actualizaciones); si no hay señal, la copia guardada
    e.respondWith(fetch(e.request).then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copia = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return res; })));
  }
});
