// Barra de navegación de abajo, de vidrio esmerilado.
// Solo aparece si el usuario tiene más de un lugar a donde ir.
import { NavLink } from 'react-router-dom';
import { usePermisos } from '../sesion.tsx';
import { Archivo, Capas, Grafica, Usuarios } from './iconos.tsx';

export function BarraNav() {
  const permisos = usePermisos();
  const items = [
    { a: '/lotes', nombre: 'Lotes', icono: <Capas />, ver: true },
    { a: '/finanzas', nombre: 'Finanzas', icono: <Grafica />, ver: permisos.finanzas },
    { a: '/cierres', nombre: 'Cierres', icono: <Archivo />, ver: permisos.finanzas },
    { a: '/usuarios', nombre: 'Usuarios', icono: <Usuarios />, ver: permisos.admin },
  ].filter((i) => i.ver);
  if (items.length < 2) return null;
  return (
    <nav className="barra-nav" aria-label="Secciones">
      {items.map((i) => (
        <NavLink key={i.a} to={i.a} replace>
          {i.icono}
          <span>{i.nombre}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** ¿Esta persona verá la barra de abajo? (para dejarle espacio a la pantalla) */
export function useConBarra() {
  const p = usePermisos();
  return p.finanzas || p.admin;
}
