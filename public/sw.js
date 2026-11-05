// Trabajador de fondo (service worker) de Cortes / Aluminio.
// Sirve para que Android y iPhone reconozcan la página como una app que se
// puede anclar a la pantalla de inicio, y para que abra rápido.
// Solo guarda los archivos de la propia app; los datos (Supabase) siempre
// se piden en línea y nunca se guardan aquí.

const CACHE = 'cortes-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono-512.png']).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos de la app (mismo sitio, lectura). Lo demás pasa directo.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Primero internet (siempre la versión más nueva); si no hay señal, lo guardado.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
