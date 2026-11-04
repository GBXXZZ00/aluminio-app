// Estado de la sesión: quién entró, a qué herrería, y su tema.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type Sesion, type Slug, type Tema } from './datos/index.ts';

interface Ctx {
  sesion: Sesion | null;
  cargando: boolean;
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

  const refrescar = useCallback(async () => {
    try {
      setSesion(await api.sesionActual());
    } catch {
      setSesion(null);
    }
  }, []);

  useEffect(() => {
    refrescar().finally(() => setCargando(false));
  }, [refrescar]);

  useEffect(() => {
    aplicarApariencia(sesion?.perfil.tema ?? temaGuardado(), sesion?.herreria.slug ?? null);
  }, [sesion]);

  const avisar = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const valor: Ctx = {
    sesion,
    cargando,
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
  };

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
