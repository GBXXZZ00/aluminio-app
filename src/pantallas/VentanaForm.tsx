// Agregar o editar una ventana (N ventanas iguales).
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type VentanaFila } from '../datos/index.ts';
import { useSesion } from '../sesion.tsx';
import {
  fmtLote, medidasTrabajo, NOMBRE_SISTEMA, precioUnitarioSugerido, totalDesdeUnitario,
  unitarioDesdeTotal, validarVentana, type Color, type Sistema,
} from '../calculos/index.ts';
import { CampoNumero, Cargando, ErrorCaja } from '../componentes/comunes.tsx';
import { Cerrar } from '../componentes/iconos.tsx';

/** Vuelve a la lista de ventanas sin dejar pantallas repetidas en el historial. */
function volverALista(nav: ReturnType<typeof useNavigate>, loteId: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) nav(-1);
  else nav(`/lote/${loteId}/ventanas`, { replace: true });
}

export function VentanaForm() {
  const { id: loteId, vid } = useParams();
  const editar = vid && vid !== 'nueva';
  const nav = useNavigate();
  const { avisar } = useSesion();
  const [listo, setListo] = useState(false);
  const [numLote, setNumLote] = useState(0);
  const [etiqueta, setEtiqueta] = useState('V1');
  const [cantidad, setCantidad] = useState(1);
  const [sistema, setSistema] = useState<Sistema>('ecobel');
  const [color, setColor] = useState<Color>('negro');
  const [alto, setAlto] = useState(0);
  const [ancho, setAncho] = useState(0);
  const [proteccion, setProteccion] = useState(false);
  const [unitario, setUnitario] = useState(0);
  const [total, setTotal] = useState(0);
  // Mientras no se toque el precio a mano, se sugiere solo con el área.
  const [precioManual, setPrecioManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.obtenerLote(loteId!).then(({ lote, ventanas }) => {
      if (lote.cierre_id) { nav(`/lote/${loteId}`, { replace: true }); return; }
      setNumLote(lote.numero);
      const i = editar ? ventanas.findIndex((v) => v.id === vid) : ventanas.length;
      setEtiqueta(`V${i + 1}`);
      if (editar) {
        const v = ventanas[i] as VentanaFila | undefined;
        if (!v) { nav(`/lote/${loteId}/ventanas`, { replace: true }); return; }
        setCantidad(v.cantidad); setSistema(v.sistema); setColor(v.color);
        setAlto(v.alto); setAncho(v.ancho); setProteccion(v.proteccion);
        setUnitario(v.precio_unitario); setTotal(v.precio_total);
        // Si el precio guardado era el sugerido, al corregir medidas se recalcula solo.
        const sugerido = precioUnitarioSugerido(v.sistema, v.alto, v.ancho);
        setPrecioManual(Math.abs(v.precio_unitario - sugerido) >= 0.005);
      }
      setListo(true);
    }).catch((e) => { setError((e as Error).message); setNumLote(-1); setListo(true); });
  }, [loteId, vid, editar, nav]);

  // Precio sugerido automático (oculto el precio por m²).
  useEffect(() => {
    if (precioManual) return;
    const u = alto > 0 && ancho > 0 ? precioUnitarioSugerido(sistema, alto, ancho) : 0;
    setUnitario(u);
    setTotal(totalDesdeUnitario(u, cantidad));
  }, [sistema, alto, ancho, cantidad, precioManual]);

  function cambiarCantidad(n: number) {
    const q = Math.max(1, Math.min(999, Math.round(n) || 1));
    setCantidad(q);
    setTotal(totalDesdeUnitario(unitario, q)); // se mantiene el unitario
  }

  const v = { etiqueta, cantidad, sistema, color, alto, ancho, proteccion };
  const t = medidasTrabajo(v);
  const errores = alto && ancho ? validarVentana(v) : [];

  async function guardar() {
    setError(null);
    const problemas = validarVentana(v);
    if (problemas.length) return setError(problemas.join(' '));
    setGuardando(true);
    try {
      await api.guardarVentana(loteId!, {
        ...(editar ? { id: vid } : {}),
        cantidad, sistema, color, alto, ancho, proteccion,
        precio_unitario: unitario, precio_total: total,
      });
      avisar(editar ? 'Ventana actualizada' : 'Ventana agregada');
      volverALista(nav, loteId!);
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  if (!listo) return <main className="pantalla"><Cargando /></main>;
  if (numLote < 0) {
    return (
      <main className="pantalla">
        <ErrorCaja mensaje={error} />
        <button type="button" className="btn secundario" onClick={() => nav('/lotes')}>Volver a los lotes</button>
      </main>
    );
  }

  const opcion = (activo: boolean, onClick: () => void, contenido: React.ReactNode) => (
    <button type="button" className="opcion" aria-pressed={activo} onClick={onClick}>{contenido}</button>
  );

  return (
    <main className="pantalla">
      <header className="encabezado">
        <button type="button" className="icono-btn" aria-label="Cerrar sin guardar" onClick={() => volverALista(nav, loteId!)}><Cerrar /></button>
        <div className="titulo">
          <h1>{editar ? 'Editar ventana' : 'Agregar ventana'}</h1>
          <div className="sub">Lote {fmtLote(numLote)} · {etiqueta}</div>
        </div>
      </header>

      <div className="campo">
        <span className="lbl" id="lbl-cant">Cantidad de ventanas iguales</span>
        <div className="contador" role="group" aria-labelledby="lbl-cant">
          <button type="button" className="icono-btn" aria-label="Restar una" onClick={() => cambiarCantidad(cantidad - 1)}>−</button>
          <CampoNumero id="cantidad" grande valor={cantidad} decimales={0} aria-label="Cantidad"
            onCambio={(n) => n >= 1 && cambiarCantidad(n)} style={{ textAlign: 'center' }} />
          <button type="button" className="icono-btn" aria-label="Sumar una" onClick={() => cambiarCantidad(cantidad + 1)}>+</button>
        </div>
      </div>

      <div className="campo">
        <span className="lbl">Sistema</span>
        <div className="dos">
          {opcion(sistema === 'ecobel', () => setSistema('ecobel'), 'Ecobel')}
          {opcion(sistema === 'panoramico', () => setSistema('panoramico'), 'Panorámico')}
        </div>
      </div>

      <div className="campo">
        <span className="lbl">Color del aluminio</span>
        <div className="dos">
          {opcion(color === 'negro', () => setColor('negro'), <><span className="punto negro" />Negro</>)}
          {opcion(color === 'blanco', () => setColor('blanco'), <><span className="punto blanco" />Blanco</>)}
        </div>
      </div>

      <div className="dos">
        <div className="campo">
          <label htmlFor="alto">Alto (cm)</label>
          <CampoNumero id="alto" grande valor={alto} decimales={1} onCambio={setAlto} />
        </div>
        <div className="campo">
          <label htmlFor="ancho">Ancho (cm)</label>
          <CampoNumero id="ancho" grande valor={ancho} decimales={1} onCambio={setAncho} />
        </div>
      </div>

      <div className="campo">
        <span className="lbl">Protección</span>
        <div className="dos">
          {opcion(!proteccion, () => setProteccion(false), 'No')}
          {opcion(proteccion, () => setProteccion(true), 'Sí')}
        </div>
        <span className="ayuda">Con protección se restan 6 cm al alto y 6 cm al ancho.</span>
      </div>

      <div className="tarjeta pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="etiqueta-seccion">Medida de trabajo</span>
        <span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{alto && ancho ? `${t.A} × ${t.W} cm` : '—'}</span>
        <span className="sec" style={{ fontSize: 14 }}>
          {cantidad} {cantidad === 1 ? 'ventana' : 'ventanas'} {NOMBRE_SISTEMA[sistema]} {color === 'negro' ? (cantidad === 1 ? 'negra' : 'negras') : (cantidad === 1 ? 'blanca' : 'blancas')}
        </span>
        {errores.length > 0 && <span className="peligro" style={{ fontSize: 14 }}>{errores.join(' ')}</span>}
      </div>

      <div className="tarjeta pad pila">
        <span className="etiqueta-seccion">Precio de venta</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label htmlFor="precio-unit" style={{ flex: 1, color: 'var(--texto-2)' }}>Precio unitario $</label>
          <CampoNumero id="precio-unit" dinero maximo={1_000_000} valor={unitario} style={{ width: 150, fontSize: 20, fontWeight: 600 }}
            onCambio={(n) => { setPrecioManual(true); setUnitario(n); setTotal(totalDesdeUnitario(n, cantidad)); }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--borde)' }}>
          <label htmlFor="precio-total" style={{ flex: 1, fontWeight: 600 }}>Total · {cantidad} {cantidad === 1 ? 'ventana' : 'ventanas'} $</label>
          <CampoNumero id="precio-total" dinero maximo={9_000_000} valor={total} style={{ width: 150, fontSize: 24, fontWeight: 600, color: 'var(--acento)', borderColor: 'var(--acento)' }}
            onCambio={(n) => { setPrecioManual(true); setTotal(n); setUnitario(unitarioDesdeTotal(n, cantidad)); }} />
        </div>
        <span className="ayuda">
          {precioManual
            ? 'Este precio lo escribiste a mano: no cambia solo si corriges las medidas.'
            : 'El precio se propone solo según el área. Puedes cambiar el unitario o el total y el otro se ajusta.'}
        </span>
        {total === 0 && alto > 0 && ancho > 0 && <span className="peligro" style={{ fontSize: 14 }}>Ojo: el precio está en $0.</span>}
        {precioManual && (
          <button type="button" className="btn secundario" onClick={() => setPrecioManual(false)}>Volver al precio sugerido</button>
        )}
      </div>

      <ErrorCaja mensaje={error} />
      <button type="button" className="btn primario" disabled={guardando || !alto || !ancho} onClick={guardar}>
        {guardando ? 'Guardando…' : 'Guardar ventana'}
      </button>
    </main>
  );
}
