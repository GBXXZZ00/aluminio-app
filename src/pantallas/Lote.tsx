// Pantalla de un lote: cliente, ventanas con precios, dinero del lote.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Gastos, type Lote as TLote, type VentanaFila } from '../datos/index.ts';
import { usePermisos, useSesion } from '../sesion.tsx';
import { fmtDinero, fmtFecha, fmtLote, medidasTrabajo, NOMBRE_SISTEMA, r2 } from '../calculos/index.ts';
import { CampoNumero, Cargando, Encabezado, ErrorCaja, Modal } from '../componentes/comunes.tsx';
import { Basura, Lapiz, Mas } from '../componentes/iconos.tsx';

export function Lote() {
  const { id } = useParams();
  const { sesion, avisar } = useSesion();
  const permisos = usePermisos();
  const nav = useNavigate();
  const [lote, setLote] = useState<TLote | null>(null);
  const [ventanas, setVentanas] = useState<VentanaFila[]>([]);
  const [gastos, setGastos] = useState<Gastos>({ perfileria: 0, vidrio: 0 });
  const [cliente, setCliente] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<VentanaFila | null>(null);
  // Los guardados de gastos van en fila, uno detrás de otro (nunca dos a la vez).
  const colaGastos = useRef<Promise<void>>(Promise.resolve());
  const gastosRef = useRef(gastos);
  gastosRef.current = gastos;

  const cargar = useCallback(async () => {
    try {
      const r = await api.obtenerLote(id!);
      setLote(r.lote);
      setVentanas(r.ventanas);
      setCliente(r.lote.cliente ?? '');
      if (permisos.finanzas) setGastos(await api.obtenerGastos(id!));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, permisos.finanzas]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error && !lote) return <main className="pantalla"><Encabezado titulo="Lote" volver="/lotes" /><ErrorCaja mensaje={error} /></main>;
  if (!lote || !sesion) return <main className="pantalla"><Cargando /></main>;

  const cerrado = !!lote.cierre_id;
  const venta = r2(ventanas.reduce((t, v) => t + v.precio_total, 0));
  const totalGastos = r2(gastos.perfileria + gastos.vidrio);
  const unidades = ventanas.reduce((t, v) => t + v.cantidad, 0);

  async function guardarCliente() {
    if (cerrado || cliente === (lote!.cliente ?? '')) return;
    try {
      await api.actualizarLote(lote!.id, { cliente: cliente.trim() || null });
      setLote({ ...lote!, cliente: cliente.trim() || null });
      avisar('Cliente guardado');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function guardarGastos() {
    if (cerrado) return;
    const loteId = lote!.id;
    colaGastos.current = colaGastos.current.then(async () => {
      try {
        await api.guardarGastos(loteId, gastosRef.current);
        avisar('Gastos guardados');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    try {
      await api.borrarVentana(borrar.id);
      setBorrar(null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
      setBorrar(null);
    }
  }

  return (
    <main className="pantalla">
      <Encabezado
        volver="/lotes"
        titulo={<span className="mono">Lote {fmtLote(lote.numero)}</span>}
        sub={`Herrería ${sesion.herreria.nombre} · creado ${fmtFecha(new Date(lote.creado_en))}`}
      />
      {cerrado && <div className="aviso info">Este lote ya pasó por un cierre general. Solo se puede consultar.</div>}
      <ErrorCaja mensaje={error} />

      <div className="campo">
        <label htmlFor="cliente">Cliente u obra (opcional)</label>
        <input id="cliente" className="entrada" maxLength={80} value={cliente} disabled={cerrado}
          onChange={(e) => setCliente(e.target.value)} onBlur={guardarCliente} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="etiqueta-seccion">Ventanas</span>
        <span className="sec" style={{ fontSize: 13 }}>{unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>
      </div>

      <div className="lista">
        {ventanas.map((v, i) => {
          const t = medidasTrabajo({ ...v, etiqueta: '' });
          return (
            <div key={v.id} className="tarjeta pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="vid">V{i + 1}</span>
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{v.cantidad} × {NOMBRE_SISTEMA[v.sistema]}</span>
                <span className="chip"><span className={`punto ${v.color}`} style={{ width: 10, height: 10 }} />{v.color === 'negro' ? 'Negro' : 'Blanco'}</span>
              </div>
              <div className="mono" style={{ fontSize: 20 }}>{v.alto} × {v.ancho} cm</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="sec" style={{ fontSize: 14 }}>
                  {v.proteccion ? <>Con protección → <span className="mono" style={{ color: 'var(--texto)' }}>{t.A} × {t.W}</span></> : 'Sin protección'}
                </div>
                {!cerrado && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/lote/${lote.id}/ventana/${v.id}`} className="icono-btn" aria-label={`Editar ventana V${i + 1}`}><Lapiz /></Link>
                    <button type="button" className="icono-btn" aria-label={`Eliminar ventana V${i + 1}`} onClick={() => setBorrar(v)}><Basura /></button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, borderTop: '1px solid var(--borde)' }}>
                <span className="sec" style={{ fontSize: 14 }}><span className="mono" style={{ color: 'var(--texto)' }}>{fmtDinero(v.precio_unitario)}</span> c/u</span>
                <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{fmtDinero(v.precio_total)}</span>
              </div>
            </div>
          );
        })}
        {!cerrado && (
          <Link to={`/lote/${lote.id}/ventana/nueva`} className="btn punteado"><Mas /> Agregar ventana</Link>
        )}
      </div>

      {permisos.finanzas && (
        <>
          <span className="etiqueta-seccion">Dinero del lote</span>
          <div className="tarjeta pad pila">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>Venta del lote</span>
              <span className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{fmtDinero(venta)}</span>
            </div>
            <div className="pila" style={{ paddingTop: 14, borderTop: '1px solid var(--borde)', gap: 10 }}>
              <span className="sec" style={{ fontSize: 14, fontWeight: 600 }}>Gastos del lote ($)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label htmlFor="g-perfil" style={{ flex: 1 }}>Perfilería de aluminio<br /><span className="ayuda" style={{ fontSize: 12 }}>incluye accesorios</span></label>
                <CampoNumero id="g-perfil" dinero valor={gastos.perfileria} disabled={cerrado} style={{ width: 130 }}
                  onCambio={(n) => setGastos((g) => ({ ...g, perfileria: n }))} onBlur={guardarGastos} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label htmlFor="g-vidrio" style={{ flex: 1 }}>Vidrio</label>
                <CampoNumero id="g-vidrio" dinero valor={gastos.vidrio} disabled={cerrado} style={{ width: 130 }}
                  onCambio={(n) => setGastos((g) => ({ ...g, vidrio: n }))} onBlur={guardarGastos} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="sec">Total gastos</span>
                <span className="mono sec">−{fmtDinero(totalGastos)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, borderTop: '1px solid var(--borde)' }}>
              <span style={{ fontWeight: 600 }}>Ganancia del lote</span>
              <span className="mono acento" style={{ fontSize: 26, fontWeight: 600 }}>{fmtDinero(venta - totalGastos)}</span>
            </div>
          </div>
        </>
      )}

      <button type="button" className="btn primario" disabled={!ventanas.length} onClick={() => nav(`/lote/${lote.id}/resultados`)}>
        Ver cortes y compra
      </button>

      {borrar && (
        <Modal titulo="¿Eliminar esta ventana?" onCerrar={() => setBorrar(null)}>
          <p className="ayuda">{borrar.cantidad} × {NOMBRE_SISTEMA[borrar.sistema]} de {borrar.alto} × {borrar.ancho} cm.</p>
          <button type="button" className="btn peligro" onClick={confirmarBorrar}>Sí, eliminar</button>
          <button type="button" className="btn secundario" onClick={() => setBorrar(null)}>Cancelar</button>
        </Modal>
      )}
    </main>
  );
}
