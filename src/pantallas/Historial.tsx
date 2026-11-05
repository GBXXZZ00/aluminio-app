// Historial de lotes de la herrería.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Lote } from '../datos/index.ts';
import { usePermisos, useSesion } from '../sesion.tsx';
import { fmtFecha, fmtLote } from '../calculos/index.ts';
import { Cargando, ErrorCaja, Modal } from '../componentes/comunes.tsx';
import { AgregarInicio } from '../componentes/AgregarInicio.tsx';
import { Flecha, Grafica, Luna, Mas, Puntos, Salir, Sol, Usuarios } from '../componentes/iconos.tsx';

export function Historial() {
  const { sesion, salir, cambiarTema, avisar } = useSesion();
  const permisos = usePermisos();
  const nav = useNavigate();
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [cliente, setCliente] = useState('');
  const [creando, setCreando] = useState(false);
  const [borrar, setBorrar] = useState<Lote | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setLotes(await api.listarLotes());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // El menú ⋮ se cierra al tocar en cualquier otra parte.
  useEffect(() => {
    if (!menu) return;
    const cerrar = () => setMenu(null);
    const t = window.setTimeout(() => document.addEventListener('click', cerrar), 0);
    return () => { window.clearTimeout(t); document.removeEventListener('click', cerrar); };
  }, [menu]);

  if (!sesion) return null;
  const tema = sesion.perfil.tema;

  async function crear() {
    setCreando(true);
    try {
      const l = await api.crearLote(cliente);
      nav(`/lote/${l.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreando(false);
    }
  }

  async function duplicar(l: Lote) {
    setMenu(null);
    if (ocupado) return;
    setOcupado(true);
    try {
      const n = await api.duplicarLote(l.id);
      avisar(`Lote ${fmtLote(l.numero)} duplicado como ${fmtLote(n.numero)}`);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    try {
      await api.borrarLote(borrar.id);
      avisar(`Lote ${fmtLote(borrar.numero)} eliminado`);
      setBorrar(null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
      setBorrar(null);
    }
  }

  const abiertos = lotes?.filter((l) => !l.cierre_id) ?? [];
  const cerrados = lotes?.filter((l) => l.cierre_id) ?? [];

  const tarjetaLote = (l: Lote, destacado: boolean) => (
    <div key={l.id} className={`tarjeta${destacado ? ' acentuada' : ''}`} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link to={`/lote/${l.id}`} className="lote-item" style={{ flex: 1, minWidth: 0 }}>
          <div className="lote-num" style={{ color: destacado ? 'var(--acento)' : undefined }}>{fmtLote(l.numero)}</div>
          <div className="info">
            <div className="cli" style={l.cliente ? undefined : { color: 'var(--texto-2)', fontStyle: 'italic' }}>{l.cliente || 'Sin cliente'}</div>
            <div className="sec" style={{ fontSize: 14 }}>
              {fmtFecha(new Date(l.creado_en))} · {l.total_ventanas ?? 0} {l.total_ventanas === 1 ? 'ventana' : 'ventanas'}
            </div>
          </div>
        </Link>
        <button type="button" className="icono-btn plano" aria-label={`Opciones del lote ${fmtLote(l.numero)}`}
          aria-expanded={menu === l.id} onClick={() => setMenu(menu === l.id ? null : l.id)} style={{ marginRight: 8 }}>
          <Puntos />
        </button>
      </div>
      {menu === l.id && (
        <div className="menu">
          <button type="button" onClick={() => nav(`/lote/${l.id}`)}>Abrir</button>
          <button type="button" onClick={() => duplicar(l)}>Duplicar</button>
          {permisos.finanzas && !l.cierre_id && (
            <button type="button" className="peligro" onClick={() => { setMenu(null); setBorrar(l); }}>Eliminar</button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <main className="pantalla">
      <header className="encabezado" style={{ alignItems: 'flex-start' }}>
        <div className="titulo">
          <div className="mono acento" style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase' }}>Herrería {sesion.herreria.nombre}</div>
          <h1 style={{ fontSize: 32 }}>Lotes</h1>
        </div>
        <button type="button" className="icono-btn" aria-label={tema === 'claro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro'} onClick={cambiarTema}>
          {tema === 'claro' ? <Sol /> : <Luna />}
        </button>
        {permisos.admin && <Link to="/usuarios" className="icono-btn" aria-label="Usuarios"><Usuarios /></Link>}
        <button type="button" className="icono-btn" aria-label="Cerrar sesión" onClick={() => salir().then(() => nav('/', { replace: true }))}><Salir /></button>
      </header>
      <AgregarInicio />

      <button type="button" className="btn primario" onClick={() => { setCliente(''); setNuevo(true); }}><Mas /> Nuevo lote</button>

      {permisos.finanzas && (
        <Link to="/finanzas" className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textDecoration: 'none', color: 'var(--texto)' }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--acento-fondo)', color: 'var(--acento)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Grafica /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600 }}>Finanzas</span>
            <span className="sec" style={{ fontSize: 13 }}>Ventas, gastos, ganancia y cierre</span>
          </span>
          <span className="sec"><Flecha /></span>
        </Link>
      )}

      <ErrorCaja mensaje={error} />
      {lotes === null && !error && <Cargando />}

      {lotes && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="etiqueta-seccion">Lotes abiertos</span>
            <span className="sec" style={{ fontSize: 13 }}>{abiertos.length}</span>
          </div>
          {abiertos.length === 0 && <p className="ayuda">No hay lotes abiertos. Toca "Nuevo lote" para empezar.</p>}
          <div className="lista">{abiertos.map((l, i) => tarjetaLote(l, i === 0))}</div>

          {cerrados.length > 0 && (
            <>
              <span className="etiqueta-seccion">Lotes cerrados</span>
              <div className="lista">{cerrados.map((l) => tarjetaLote(l, false))}</div>
            </>
          )}
        </>
      )}

      {nuevo && (
        <Modal titulo="Nuevo lote" onCerrar={() => setNuevo(false)}>
          <p className="ayuda">El número de lote y la fecha se ponen solos.</p>
          <form className="pila" onSubmit={(e) => { e.preventDefault(); if (!creando) crear(); }}>
            <div className="campo">
              <label htmlFor="cliente-nuevo">Cliente u obra (opcional)</label>
              <input id="cliente-nuevo" className="entrada" maxLength={80} enterKeyHint="go" value={cliente} onChange={(e) => setCliente(e.target.value)} autoFocus />
            </div>
            <button type="submit" className="btn primario" disabled={creando}>{creando ? 'Creando…' : 'Crear lote'}</button>
          </form>
          <button type="button" className="btn secundario" onClick={() => setNuevo(false)}>Cancelar</button>
        </Modal>
      )}

      {borrar && (
        <Modal titulo={`¿Eliminar el lote ${fmtLote(borrar.numero)}?`} onCerrar={() => setBorrar(null)}>
          <p className="ayuda">Se borran sus ventanas y sus gastos. El número {fmtLote(borrar.numero)} no se vuelve a usar. No se puede deshacer.</p>
          <button type="button" className="btn peligro" onClick={confirmarBorrar}>Sí, eliminar</button>
          <button type="button" className="btn secundario" onClick={() => setBorrar(null)}>Cancelar</button>
        </Modal>
      )}
    </main>
  );
}
