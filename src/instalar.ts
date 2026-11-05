// Anclar la app a la pantalla de inicio del celular.
// Android/Chrome avisa con el evento "beforeinstallprompt" (puede llegar antes
// de que React arranque), así que lo guardamos aquí desde el principio.

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let pendiente: EventoInstalar | null = null;
const avisos = new Set<() => void>();
const avisar = () => avisos.forEach((f) => f());

export function iniciarInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    pendiente = null;
    avisar();
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

export const escucharInstalacion = (f: () => void) => {
  avisos.add(f);
  return () => { avisos.delete(f); };
};

/** ¿Ya se abrió desde el ícono de la pantalla de inicio? */
export function yaAnclada() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function esIphone() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** ¿El iPhone está en un navegador que no es Safari (Chrome, la app de Claude, WhatsApp…)? */
export function iphoneSinSafari() {
  const ua = navigator.userAgent;
  return esIphone() && (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) || !/Safari/.test(ua));
}

export const puedeAvisoDirecto = () => pendiente !== null;

/** Muestra la ventana del sistema para anclar. Devuelve true si el usuario aceptó. */
export async function anclarDirecto() {
  if (!pendiente) return false;
  const ev = pendiente;
  pendiente = null;
  await ev.prompt();
  const r = await ev.userChoice;
  avisar();
  return r.outcome === 'accepted';
}
