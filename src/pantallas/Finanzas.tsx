// Finanzas: resumen del período, lotes abiertos, mano de obra y cierre general.
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Cierre, type ManoObra, type Resumen } from '../datos/index.ts';
import { usePermisos, useSesion } from '../sesion.tsx';
import { fmtDinero, fmtFecha, fmtLote } from '../calculos/index.ts';
import { CampoNumero, Cargando, Encabezado, ErrorCaja, Modal } from '../componentes/comunes.tsx';
import { Basura, Candado, Chat, Flecha, Mas } from '../componentes/iconos.tsx';

function TablaResumen({ r }: { r: Resumen }) {
  const filas: [string, number, boolean?][] = [
    ['Total vendido', r.total_vendido],
    ['Perfilería de aluminio', -r.total_perfileria],
    ['Vidrio', -r.total_vidrio],
    ['Mano de obra', -r.total_mano_obra],
  ];
  return (
    <div className="tarjeta" style={{ overflow: 'hidden' }}>
      {filas.map(([nombre, valor], i) => (
        <div key={nombre} className="fila">
          <span className={i > 0 ? 'sec' : undefined}>{nombre}</span>
          <span className={`mono${i > 0 ? ' sec' : ''}`} style={{ fontSize: 18, fontWeight: i > 0 ? 400 : 600 }}>{i > 0 ? '−' + fmtDinero(Math.abs(valor)) : fmtDinero(valor)}</span>
        </div>
      ))}
      <div className="fila" style={{ borderTop: '1px solid var(--borde)' }}>
        <span style={{ fontWeight: 600 }}>Ganancia</span>
        <span className="mono acento" style={{ fontSize: 22, fontWeight: 600 }}>{fmtDinero(r.ganancia)}</span>
      </div>
    </div>
  );
}

function TablaLotes({ r }: { r: Resumen }) {
  const cols = 'minmax(0,1fr) 72px 68px 72px';
  return (
    <div className="tarjeta" style={{ overflow: 'hidden' }}>
      <div className="tabla-cab" style={{ gridTemplateColumns: cols }}>
        <span>Lote</span><span className="der">Venta</span><span className="der">Gasto</span><span className="der">Gana</span>
      </div>
      {r.lotes.map((l) => (
        <div key={l.numero} className="tabla-fila" style={{ gridTemplateColumns: cols }}>
          <span style={{ minWidth: 0 }}>
            <span className="mono" style={{ fontWeight: 600, display: 'block' }}>{fmtLote(l.numero)}</span>
            <span className="sec" style={{ fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.cliente || 'Sin cliente'}</span>
          </span>
          <span className="mono der" style={{ fontSize: 13 }}>{fmtDinero(l.vendido)}</span>
          <span className="mono der sec" style={{ fontSize: 13 }}>{fmtDinero(l.perfileria + l.vidrio)}</span>
          <span className="mono der" style={{ fontSize: 13, fontWeight: 600 }}>{fmtDinero(l.ganancia)}</span>
        </div>
      ))}
      {!r.lotes.length && <div className="ayuda" style={{ padding: 16 }}>No hay lotes abiertos.</div>}
      <div className="ayuda" style={{ padding: '10px 16px', borderTop: '1px solid var(--borde)' }}>Gasto = perfilería + vidrio de cada lote. La mano de obra se resta aparte.</div>
    </div>
  );
}

export function Finanzas() {
  const { sesion, avisar } = useSesion();
  const permisos = usePermisos();
  const [r, setR] = useState<Resumen | null>(null);
  const [mano, setMano] = useState<ManoObra[]>([]);
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [res, m] = await Promise.all([api.resumen(), api.listarManoObra()]);
      setR(res);
      setMano(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function agregar() {
    if (!desc.trim()) return setError('Escribe una descripción del pago.');
    if (!(monto > 0)) return setError('Escribe un monto mayor que cero.');
    if (agregando) return;
    setAgregando(true);
    try {
      await api.agregarManoObra(desc, monto);
      setDesc('');
      setMonto(0);
      avisar('Pago agregado');
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAgregando(false);
    }
  }

  async function quitar(id: string) {
    try {
      await api.borrarManoObra(id);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!sesion) return null;
  return (
    <main className="pantalla">
      <Encabezado volver="/lotes" titulo="Finanzas"
        sub={<><span className="acento">Herrería {sesion.herreria.nombre}</span>{r?.periodo_desde ? ` · período abierto desde ${fmtFecha(new Date(r.periodo_desde))}` : ''}</>} />
      <ErrorCaja mensaje={error} />
      {!r && !error && <Cargando />}
      {r && (
        <>
          <div className="tarjeta" style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="etiqueta-seccion">Ganancia del período</span>
            <span className="grande-num">{fmtDinero(r.ganancia)}</span>
            <span className="sec" style={{ fontSize: 13 }}>
              {r.cantidad_lotes} {r.cantidad_lotes === 1 ? 'lote abierto' : 'lotes abiertos'} · {r.cantidad_ventanas} {r.cantidad_ventanas === 1 ? 'ventana' : 'ventanas'}
            </span>
          </div>
          <TablaResumen r={r} />
          <span className="etiqueta-seccion">Lotes abiertos</span>
          <TablaLotes r={r} />

          <span className="etiqueta-seccion">Mano de obra</span>
          <div className="tarjeta" style={{ overflow: 'hidden' }}>
            {mano.map((m) => (
              <div key={m.id} className="fila">
                <span className="mono sec" style={{ fontSize: 13, width: 44 }}>{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>{m.descripcion}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{fmtDinero(m.monto)}</span>
                <button type="button" className="icono-btn plano" aria-label={`Quitar pago ${m.descripcion}`} onClick={() => quitar(m.id)}><Basura /></button>
              </div>
            ))}
            {!mano.length && <div className="ayuda" style={{ padding: 16 }}>Sin pagos en este período.</div>}
            <div className="pila" style={{ padding: 16, borderTop: '1px solid var(--borde)', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px', gap: 10 }}>
                <div className="campo">
                  <label htmlFor="mo-desc">Descripción</label>
                  <input id="mo-desc" className="entrada" maxLength={120} placeholder="Ej. pago semanal" value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div className="campo">
                  <label htmlFor="mo-monto">Monto $</label>
                  <CampoNumero id="mo-monto" dinero valor={monto} onCambio={setMonto} />
                </div>
              </div>
              <button type="button" className="btn secundario" disabled={agregando} onClick={agregar}><Mas /> {agregando ? 'Guardando…' : 'Agregar pago'}</button>
            </div>
          </div>

          {permisos.cierre && (
            <Link to="/cierre" className="btn acento" style={{ minHeight: 60, fontSize: 18 }}><Candado /> Cierre general de lotes</Link>
          )}
          <Link to="/cierres" className="tarjeta" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', color: 'var(--texto)' }}>
            <span style={{ flex: 1 }}><span style={{ display: 'block', fontWeight: 600 }}>Cierres anteriores</span><span className="sec" style={{ fontSize: 13 }}>Consulta el resumen de cada cierre</span></span>
            <span className="sec"><Flecha /></span>
          </Link>
        </>
      )}
    </main>
  );
}

export function CierreGeneral() {
  const { sesion, avisar } = useSesion();
  const nav = useNavigate();
  const [r, setR] = useState<Resumen | null>(null);
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<{ numero: number; r: Resumen } | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => { api.resumen().then(setR).catch((e) => setError((e as Error).message)); }, []);
  if (!sesion) return null;

  async function cerrar() {
    setConfirmar(false);
    setEnviando(true);
    setError(null);
    try {
      const res = await api.cerrarPeriodo(clave);
      if (!res.ok) {
        setError(res.error ?? 'No se pudo cerrar.');
      } else {
        // Se muestra el resumen EXACTO que quedó archivado en el servidor.
        setHecho({ numero: res.numero ?? 0, r: res.resumen ?? r! });
        setClave('');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    const texto = textoCierre(hecho.numero, sesion.herreria.nombre, hecho.r);
    return (
      <main className="pantalla">
        <Encabezado titulo={`Cierre #${hecho.numero} listo`} sub={`Herrería ${sesion.herreria.nombre}`} />
        <div className="aviso ok">Los lotes quedaron archivados. Finanzas empieza de cero con los lotes nuevos.</div>
        <TablaResumen r={hecho.r} />
        <div className="dos">
          <button type="button" className="btn secundario" onClick={() => import('../exportar/archivos.ts').catch(() => null).then((m) => m ? m.pdfCierre(hecho.numero, sesion.herreria.nombre, new Date(), hecho.r) : avisar('No se pudo crear el PDF. Recarga la app e inténtalo de nuevo.'))}>Descargar PDF</button>
          <a className="btn whatsapp" style={{ minHeight: 52, fontSize: 16 }} href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer"><Chat /> WhatsApp</a>
        </div>
        <button type="button" className="btn primario" onClick={() => nav('/lotes', { replace: true })}>Volver a los lotes</button>
      </main>
    );
  }

  const vacio = r && !r.cantidad_lotes && !r.total_mano_obra;
  return (
    <main className="pantalla">
      <Encabezado volver="/finanzas" titulo="Cierre general"
        sub={<><span className="acento">Herrería {sesion.herreria.nombre}</span>{r?.periodo_desde ? ` · ${fmtFecha(new Date(r.periodo_desde))} al ${fmtFecha(new Date())}` : ''}</>} />
      {!r && !error && <Cargando />}
      {r && (
        <>
          <div className="tarjeta" style={{ overflow: 'hidden' }}>
            <div className="fila cabeza">
              <span>Lotes que se cierran</span>
              <span className="mono sec" style={{ fontSize: 14 }}>{r.lote_desde != null ? `${fmtLote(r.lote_desde)} – ${fmtLote(r.lote_hasta!)}` : '—'}</span>
            </div>
            {r.lotes.map((l) => (
              <div key={l.numero} className="fila">
                <span className="mono" style={{ fontWeight: 600, width: 36 }}>{fmtLote(l.numero)}</span>
                <span className="sec" style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.cliente || 'Sin cliente'}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{fmtDinero(l.ganancia)}</span>
              </div>
            ))}
            <div className="ayuda" style={{ padding: '10px 16px' }}>Ganancia de cada lote antes de mano de obra</div>
          </div>
          <TablaResumen r={r} />
          {vacio ? (
            <div className="aviso info">No hay lotes ni pagos abiertos para cerrar.</div>
          ) : (
            <>
              <div className="aviso info">
                Esto <strong>no se puede deshacer</strong>. Los lotes {r.lote_desde != null ? `${fmtLote(r.lote_desde)} a ${fmtLote(r.lote_hasta!)}` : ''} quedan archivados y Finanzas empieza de cero. La numeración de lotes sigue.
              </div>
              <div className="campo">
                <label htmlFor="clave-cierre">Clave de cierre</label>
                <input id="clave-cierre" className="entrada" type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
                <span className="ayuda">La crea y la cambia el administrador.</span>
              </div>
              <ErrorCaja mensaje={error} />
              <button type="button" className="btn primario" disabled={!clave || enviando} onClick={() => setConfirmar(true)}>
                {enviando ? 'Cerrando…' : 'Confirmar cierre'}
              </button>
            </>
          )}
        </>
      )}
      {!r && <ErrorCaja mensaje={error} />}
      {confirmar && (
        <Modal titulo="¿Hacer el cierre general?" onCerrar={() => setConfirmar(false)}>
          <p className="ayuda">Se archivan todos los lotes abiertos y los pagos de mano de obra. No se puede deshacer.</p>
          <button type="button" className="btn primario" onClick={cerrar}>Sí, cerrar</button>
          <button type="button" className="btn secundario" onClick={() => setConfirmar(false)}>Cancelar</button>
        </Modal>
      )}
    </main>
  );
}

function textoCierre(numero: number, herreria: string, r: Resumen): string {
  return [
    `*Cierre general #${numero} · ${herreria}*`,
    fmtFecha(new Date()),
    ...(r.lote_desde != null ? [`Lotes ${fmtLote(r.lote_desde)} – ${fmtLote(r.lote_hasta!)}`] : []),
    '',
    `Vendido: ${fmtDinero(r.total_vendido)}`,
    `Perfilería: ${fmtDinero(r.total_perfileria)}`,
    `Vidrio: ${fmtDinero(r.total_vidrio)}`,
    `Mano de obra: ${fmtDinero(r.total_mano_obra)}`,
    `*Ganancia: ${fmtDinero(r.ganancia)}*`,
  ].join('\n');
}

export function Cierres() {
  const { sesion, avisar } = useSesion();
  const [lista, setLista] = useState<Cierre[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.listarCierres().then(setLista).catch((e) => setError((e as Error).message)); }, []);
  if (!sesion) return null;
  return (
    <main className="pantalla">
      <Encabezado volver="/finanzas" titulo="Cierres anteriores" sub={`Herrería ${sesion.herreria.nombre}`} />
      <ErrorCaja mensaje={error} />
      {!lista && !error && <Cargando />}
      {lista && !lista.length && <p className="ayuda">Todavía no se ha hecho ningún cierre general.</p>}
      {lista?.map((c) => (
        <div key={c.id} className="tarjeta" style={{ overflow: 'hidden' }}>
          <button type="button" className="fila" aria-expanded={abierto === c.id} onClick={() => setAbierto(abierto === c.id ? null : c.id)}
            style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span>
              <span style={{ display: 'block', fontWeight: 600 }}>Cierre #{c.numero}</span>
              <span className="sec" style={{ fontSize: 13 }}>{fmtFecha(new Date(c.realizado_en))} · {c.cantidad_lotes} lotes{c.lote_desde != null ? ` (${fmtLote(c.lote_desde)} – ${fmtLote(c.lote_hasta!)})` : ''}</span>
            </span>
            <span className="mono acento" style={{ fontWeight: 600, fontSize: 18 }}>{fmtDinero(c.ganancia)}</span>
          </button>
          {abierto === c.id && (
            <div className="pila" style={{ padding: 12 }}>
              <TablaResumen r={c.detalle} />
              <TablaLotes r={c.detalle} />
              <button type="button" className="btn secundario" onClick={() => import('../exportar/archivos.ts').catch(() => null).then((m) => m ? m.pdfCierre(c.numero, sesion.herreria.nombre, new Date(c.realizado_en), c.detalle) : avisar('No se pudo crear el PDF. Recarga la app e inténtalo de nuevo.'))}>Descargar PDF</button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
