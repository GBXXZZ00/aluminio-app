// Íconos de línea (sin emojis). Todos decorativos: el botón lleva su aria-label.
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const Atras = () => <svg {...base}><path d="M15 6l-6 6 6 6" /></svg>;
export const Mas = () => <svg {...base} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>;
export const Cerrar = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const Luna = () => <svg {...base}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const Sol = () => <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const Usuarios = () => <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>;
export const Salir = () => <svg {...base}><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></svg>;
export const Puntos = () => <svg {...base} fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>;
export const Lapiz = () => <svg {...base} width={20} height={20}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></svg>;
export const Basura = () => <svg {...base} width={20} height={20}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const Grafica = () => <svg {...base}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>;
export const Flecha = () => <svg {...base}><path d="M9 6l6 6-6 6" /></svg>;
export const Archivo = () => <svg {...base}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></svg>;
export const Capas = () => <svg {...base}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>;
export const VentanaChica = () => <svg {...base} width={24} height={24}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M12 3v18M4 12h16" /></svg>;
export const Billete = () => <svg {...base} width={24} height={24}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></svg>;
export const Candado = () => <svg {...base}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const Ojo = () => <svg {...base}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const Descargar = () => <svg {...base} width={20} height={20}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const Chat = () => <svg {...base}><path d="M4 20l1.5-4.5A8 8 0 1 1 8.5 18.5z" /></svg>;
export const Ventana = () => (
  <svg {...base} width={56} height={56} viewBox="0 0 48 48" strokeWidth={2.5}><rect x="8" y="6" width="32" height="36" rx="2" /><path d="M24 6v36M8 24h32" /></svg>
);
