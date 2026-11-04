import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProveedorSesion, usePermisos, useSesion } from './sesion.tsx';
import { Cargando } from './componentes/comunes.tsx';
import { CambiarClave, Inicio, Login } from './pantallas/Acceso.tsx';
import { Historial } from './pantallas/Historial.tsx';
import { Lote } from './pantallas/Lote.tsx';
import { VentanaForm } from './pantallas/VentanaForm.tsx';
import { Resultados } from './pantallas/Resultados.tsx';
import { CierreGeneral, Cierres, Finanzas } from './pantallas/Finanzas.tsx';
import { Usuarios } from './pantallas/Usuarios.tsx';

type Requiere = 'finanzas' | 'cierre' | 'admin';

/** Solo deja pasar si hay sesión (y el permiso pedido). */
function Protegida({ children, requiere }: { children: ReactNode; requiere?: Requiere }) {
  const { sesion, cargando } = useSesion();
  const permisos = usePermisos();
  if (cargando) return <main className="pantalla"><Cargando /></main>;
  if (!sesion) return <Navigate to="/" replace />;
  if (sesion.perfil.debe_cambiar_clave) return <Navigate to="/clave" replace />;
  if (requiere && !permisos[requiere]) return <Navigate to="/lotes" replace />;
  return <>{children}</>;
}

function Rutas() {
  const { cargando, sinConexion, refrescar } = useSesion();
  if (cargando) return <main className="pantalla"><Cargando /></main>;
  if (sinConexion) {
    return (
      <main className="pantalla" style={{ minHeight: '100dvh', justifyContent: 'center' }}>
        <div className="aviso error" role="alert">{sinConexion}</div>
        <button type="button" className="btn primario" onClick={() => refrescar()}>Reintentar</button>
      </main>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/entrar/:slug" element={<Login />} />
      <Route path="/clave" element={<CambiarClave />} />
      <Route path="/lotes" element={<Protegida><Historial /></Protegida>} />
      <Route path="/lote/:id" element={<Protegida><Lote /></Protegida>} />
      <Route path="/lote/:id/ventana/:vid" element={<Protegida><VentanaForm /></Protegida>} />
      <Route path="/lote/:id/resultados" element={<Protegida><Resultados /></Protegida>} />
      <Route path="/finanzas" element={<Protegida requiere="finanzas"><Finanzas /></Protegida>} />
      <Route path="/cierre" element={<Protegida requiere="cierre"><CierreGeneral /></Protegida>} />
      <Route path="/cierres" element={<Protegida requiere="finanzas"><Cierres /></Protegida>} />
      <Route path="/usuarios" element={<Protegida requiere="admin"><Usuarios /></Protegida>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ProveedorSesion>
      <HashRouter>
        <Rutas />
      </HashRouter>
    </ProveedorSesion>
  );
}
