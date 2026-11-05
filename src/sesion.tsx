// Estado de la sesión: quién entró, a qué herrería, y su tema.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Sesion, type Slug, type Tema } from './datos/index.ts';

interface Ctx {
  sesion: Sesion | null;
  cargando: boolean;
  /** Mensaje si no se pudo verificar la sesión por falta de internet. */
  sinConexion: string | null;
  entrar: (slug: Slug, usuario: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
  cambiarTema: () => void;
  avisar: (mensaje: string) => void;
}

const SesionCtx = createContext<Ctx | null>(null);

export function aplicarApariencia(tema: Tema, herreria: Slug | null) {
  const r = document.documentElement;
  r.dataset.tema = tema;
  if (herreria) r.dataset.herreria = herreria;
  else delete r.dataset.herreria;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', tema === 'claro' ? '#f2f2f0' : '#0a0a0a');
}

function temaGuardado(): Tema {
  try {
    return localStorage.getItem('tema') === 'claro' ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [sinConexion, setSinConexion] = useState<string | null>(null);
  const reloj = useRef<number | undefined>(undefined);

  const refrescar = useCallback(async () => {
    try {
      setSesion(await api.sesionActual());
      setSinConexion(null);
    } catch (e) {
      // Sin internet: NO se cierra la sesión, se ofrece reintentar.
      setSinConexion((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refrescar().finally(() => setCargando(false));
  }, [refrescar]);

  // Si la sesión se cierra sola (clave cambiada, usuario desactivado), volver al inicio.
  useEffect(() => api.escucharSalida(() => setSesion(null)), []);

  useEffect(() => {
    aplicarApariencia(sesion?.perfil.tema ?? temaGuardado(), sesion?.herreria.slug ?? null);
  }, [sesion]);

  const avisar = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(reloj.current);
    reloj.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Se memoriza para que un aviso en pantalla no redibuje toda la app.
  const valor = useMemo<Ctx>(() => ({
    sesion,
    cargando,
    sinConexion,
    refrescar,
    avisar,
    async entrar(slug, usuario, clave) {
      setSesion(await api.iniciarSesion(slug, usuario, clave));
    },
    async salir() {
      await api.cerrarSesion();
      setSesion(null);
    },
    cambiarTema() {
      if (!sesion) return;
      const tema: Tema = sesion.perfil.tema === 'claro' ? 'oscuro' : 'claro';
      try {
        localStorage.setItem('tema', tema);
      } catch { /* sin almacenamiento */ }
      setSesion({ ...sesion, perfil: { ...sesion.perfil, tema } });
      api.guardarTema(tema).catch(() => {});
    },
  }), [sesion, cargando, sinConexion, refrescar, avisar]);

  return (
    <SesionCtx.Provider value={valor}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </SesionCtx.Provider>
  );
}

export function useSesion() {
  const c = useContext(SesionCtx);
  if (!c) throw new Error('useSesion fuera del proveedor');
  return c;
}

/** Atajos de permisos. */
export function usePermisos() {
  const { sesion } = useSesion();
  const p = sesion?.perfil;
  return {
    admin: !!p?.es_admin,
    finanzas: !!(p?.es_admin || p?.puede_finanzas),
    cierre: !!(p?.es_admin || p?.puede_cierre),
  };
}
