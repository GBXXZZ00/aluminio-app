// Trabajador de fondo (service worker) de Cortes / Aluminio.
// - Permite anclar la app a la pantalla de inicio en Android y iPhone.
// - Hace que la app abra rápido: los archivos del programa se guardan en el
//   teléfono y se usan desde ahí, sin esperar a internet.
// Solo guarda archivos de la propia app; los datos (Supabase) siempre se piden
// en línea y nunca se guardan aquí.

const CACHE = 'cortes-v3';
// Si internet tarda más que esto en dar la página principal, se usa la guardada.
const ESPERA_PAGINA_MS = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icono-192.png', './icono-512.png']).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function guardar(req, res) {
  if (res && res.ok) {
    const copia = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copia));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Archivos del programa (assets/…): su nombre cambia en cada versión, así que
  // el guardado nunca queda viejo → primero el teléfono, internet solo si falta.
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => guardar(req, res))));
    return;
  }

  // Página principal: se intenta la versión más nueva de internet, pero si la
  // señal está lenta o no hay, se abre la guardada sin quedarse esperando.
  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        const guardada = caches.match('./');
        const red = fetch(req).then((res) => guardar('./', res));
        const lenta = new Promise((ok) => setTimeout(ok, ESPERA_PAGINA_MS));
        const primera = await Promise.race([red.catch(() => null), lenta.then(() => null)]);
        if (primera) return primera;
        return (await guardada) || red;
      })(),
    );
    return;
  }

  // Íconos y demás: teléfono primero, y se actualizan por detrás.
  e.respondWith(
    caches.match(req).then((r) => {
      const red = fetch(req).then((res) => guardar(req, res)).catch(() => r);
      return r || red;
    }),
  );
});
