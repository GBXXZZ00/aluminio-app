// Resultados del lote en 3 pestañas: Perfiles, Vidrios y Compra.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api, claveLote, enMemoria, type Lote, type VentanaFila } from '../datos/index.ts';
import { useSesion } from '../sesion.tsx';
import {
  calcularLote, csvVidrios, fmtCm, fmtFecha, fmtKg, fmtLote, NOMBRE_SISTEMA, textoWhatsApp,
  type VentanaEntrada,
} from '../calculos/index.ts';
import { CampoNumero, Cargando, Encabezado, ErrorCaja } from '../componentes/comunes.tsx';
import { Chat, Descargar } from '../componentes/iconos.tsx';
import { descargarCsv } from '../exportar/descargar.ts';

type Pestana = 'perfiles' | 'vidrios' | 'compra';
const COLOR = { negro: 'Negro', blanco: 'Blanco' } as const;

export function Resultados() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const pestana = (params.get('ver') as Pestana) || 'perfiles';
  const { sesion, avisar } = useSesion();
  const previo = enMemoria<{ lote: Lote; ventanas: VentanaFila[] }>(claveLote(id!));
  const [lote, setLote] = useState<Lote | null>(previo?.lote ?? null);
  const [filas, setFilas] = useState<VentanaFila[]>(previo?.ventanas ?? []);
  const [disco, setDisco] = useState(previo?.lote.disco_corte ?? 0.3);
  const [error, setError] = useState<string | null>(null);
  const [verBarras, setVerBarras] = useState<string | null>(null);

  useEffect(() => {
    api.obtenerLote(id!).then(({ lote, ventanas }) => {
      setLote(lote);
      setFilas(ventanas);
      setDisco(lote.disco_corte);
    }).catch((e) => setError((e as Error).message));
  }, [id]);

  const entradas: VentanaEntrada[] = useMemo(
    () => filas.map((v, i) => ({
      etiqueta: `V${i + 1}`, cantidad: v.cantidad, sistema: v.sistema, color: v.color,
      alto: v.alto, ancho: v.ancho, proteccion: v.proteccion,
      precioUnitario: v.precio_unitario, precioTotal: v.precio_total,
    })),
    [filas],
  );
  const discoValido = disco >= 0 && disco <= 2 ? disco : 0.3;
  const r = useMemo(() => calcularLote(entradas, discoValido), [entradas, discoValido]);

  if (error) return <main className="pantalla"><Encabezado titulo="Resultados" volver={`/lote/${id}`} /><ErrorCaja mensaje={error} /></main>;
  if (!lote || !sesion) return <main className="pantalla"><Cargando /></main>;

  const fecha = new Date(lote.creado_en);
  const mensaje = textoWhatsApp(lote.numero, fecha, r);
  const cerrado = !!lote.cierre_id;

  async function guardarDisco() {
    if (cerrado || discoValido === lote!.disco_corte) return;
    try {
      await api.actualizarLote(lote!.id, { disco_corte: discoValido });
      setLote({ ...lote!, disco_corte: discoValido });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      avisar('Texto copiado');
    } catch {
      avisar('No se pudo copiar. Mantén presionado el texto para copiarlo.');
    }
  }

  const cambiar = (p: Pestana) => setParams({ ver: p }, { replace: true });

  return (
    <main className="pantalla">
      <Encabezado
        volver={`/lote/${lote.id}`}
        titulo={<span className="mono">Lote {fmtLote(lote.numero)}</span>}
        sub={`${sesion.herreria.nombre} · ${lote.cliente || 'Sin cliente'} · ${fmtFecha(fecha)}`}
      />
      <div className="pestanas" role="tablist">
        {(['perfiles', 'vidrios', 'compra'] as Pestana[]).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={pestana === p} onClick={() => cambiar(p)}>
            {p === 'perfiles' ? 'Perfiles' : p === 'vidrios' ? 'Vidrios' : 'Compra'}
          </button>
        ))}
      </div>

      {pestana === 'perfiles' && r.cortes.map((c) => (
        <div key={c.etiqueta} className="tarjeta" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="vid">{c.etiqueta}</span>
              <span style={{ fontSize: 17, fontWeight: 600 }}>{c.cantidad} × {NOMBRE_SISTEMA[c.sistema]} · {COLOR[c.color]}</span>
            </div>
            <span className="sec" style={{ fontSize: 14 }}>
              {entradas.find((e) => e.etiqueta === c.etiqueta)!.alto} × {entradas.find((e) => e.etiqueta === c.etiqueta)!.ancho} cm
              {entradas.find((e) => e.etiqueta === c.etiqueta)!.proteccion ? ` · con protección → ${c.altoTrabajo} × ${c.anchoTrabajo}` : ' · sin protección'}
            </span>
          </div>
          <div className="tabla-cab" style={{ gridTemplateColumns: 'minmax(0,1fr) 96px 56px' }}>
            <span>Pieza</span><span className="der">Medida cm</span><span className="der">Cant.</span>
          </div>
          {c.piezas.map((p, i) => (
            <div key={i} className="tabla-fila" style={{ gridTemplateColumns: 'minmax(0,1fr) 96px 56px' }}>
              <span style={{ fontSize: 16 }}>{p.perfil}{p.nota ? <span className="sec" style={{ fontSize: 13 }}> ({p.nota})</span> : null}</span>
              <span className="mono der" style={{ fontSize: 18, fontWeight: 600 }}>{fmtCm(p.medida)}</span>
              <span className="mono der acento" style={{ fontSize: 16 }}>×{p.cantidad}</span>
            </div>
          ))}
        </div>
      ))}

      {pestana === 'vidrios' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            {[['Paños', String(r.panos)], ['Área total', `${r.areaVidrioM2.toFixed(2)} m²`], ['Espesor', '4 mm']].map(([a, b]) => (
              <div key={a} className="tarjeta" style={{ padding: 12 }}>
                <div className="sec" style={{ fontSize: 12 }}>{a}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{b}</div>
              </div>
            ))}
          </div>
          <div className="tarjeta" style={{ overflow: 'hidden' }}>
            <div className="fila cabeza">Lista de corte de vidrios</div>
            <div className="tabla-cab" style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 72px 44px' }}>
              <span>Ventana</span><span className="der">Alto</span><span className="der">Ancho</span><span className="der">Cant.</span>
            </div>
            {r.vidrios.map((v) => (
              <div key={v.etiqueta} className="tabla-fila" style={{ gridTemplateColumns: 'minmax(0,1fr) 72px 72px 44px' }}>
                <span><span className="mono acento" style={{ fontWeight: 600 }}>{v.etiqueta}</span> <span className="sec" style={{ fontSize: 13 }}>{NOMBRE_SISTEMA[v.sistema]}</span></span>
                <span className="mono der" style={{ fontSize: 18, fontWeight: 600 }}>{fmtCm(v.alto)}</span>
                <span className="mono der" style={{ fontSize: 18, fontWeight: 600 }}>{fmtCm(v.ancho)}</span>
                <span className="mono der">×{v.cantidad}</span>
              </div>
            ))}
            <div className="ayuda" style={{ padding: '12px 16px', borderTop: '1px solid var(--borde)' }}>Medidas en cm, ya con los descuentos de cada sistema.</div>
          </div>
          <button type="button" className="btn secundario" onClick={() => descargarCsv(`vidrios-lote-${fmtLote(lote.numero)}.csv`, csvVidrios(r))}>
            <Descargar /> Descargar CSV para CutList Optimizer
          </button>
        </>
      )}

      {pestana === 'compra' && (
        <>
          <div className="tarjeta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', gap: 10 }}>
            <label htmlFor="disco" className="sec">Grosor del disco de corte (cm)</label>
            <CampoNumero id="disco" valor={disco} decimales={2} disabled={cerrado} style={{ width: 80, minHeight: 44 }}
              onCambio={setDisco} onBlur={guardarDisco} />
          </div>
          {discoValido !== disco && (
            <div className="aviso error" role="alert">El disco debe medir entre 0 y 2 cm. Mientras tanto se calcula con 0.3 cm.</div>
          )}

          <div className="tarjeta" style={{ overflow: 'hidden' }}>
            <div className="fila cabeza"><span>Tubos a comprar</span><span className="sec" style={{ fontSize: 13, fontWeight: 400 }}>barras</span></div>
            {r.tubos.map((t) => {
              const clave = `${t.sistema}-${t.color}-${t.perfil}`;
              return (
                <div key={clave}>
                  <button type="button" className="fila" aria-expanded={verBarras === clave}
                    onClick={() => setVerBarras(verBarras === clave ? null : clave)}
                    style={{ width: '100%', background: 'transparent', border: 'none', borderTop: '1px solid var(--linea)', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`punto ${t.color}`} style={{ width: 10, height: 10 }} />
                      {t.perfil} <span className="sec" style={{ fontSize: 13 }}>{NOMBRE_SISTEMA[t.sistema]} · {COLOR[t.color]}</span>
                    </span>
                    <span className="mono acento" style={{ fontSize: 24, fontWeight: 600 }}>{t.barras}</span>
                  </button>
                  {verBarras === clave && (
                    <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {t.acomodo.map((b, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span className="sec" style={{ fontSize: 13 }}>Barra {i + 1} · sobra {fmtCm(b.sobrante)} cm</span>
                          <div className="barra" aria-label={`Barra ${i + 1}: ${b.piezas.map(fmtCm).join(', ')} cm`}>
                            {b.piezas.map((p, j) => <div key={j} style={{ flex: `${p} 1 0` }}>{fmtCm(p)}</div>)}
                            {b.sobrante > 0 && <div className="sobra" style={{ flex: `${b.sobrante} 1 0` }} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="ayuda" style={{ padding: '10px 16px', borderTop: '1px solid var(--borde)' }}>Toca un tubo para ver cómo se acomodan las piezas.</div>
          </div>

          <div className="tarjeta" style={{ overflow: 'hidden' }}>
            <div className="fila cabeza">Accesorios</div>
            {r.bloques.flatMap((b) => b.lineas.map((l) => (
              <div key={`${b.sistema}-${b.color}-${l.nombre}`} className="fila">
                <span>{l.nombre} <span className="sec" style={{ fontSize: 13 }}>{NOMBRE_SISTEMA[b.sistema]} · {COLOR[b.color]}</span></span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{l.unidad === 'm' ? `${l.cantidad.toFixed(2)} m` : l.cantidad}</span>
              </div>
            )))}
            {r.generales.tornillosComprar > 0 && (
              <div className="fila"><span>Tornillos 8 × 1½" <span className="sec" style={{ fontSize: 13 }}>se usan {r.generales.tornillosUsados}</span></span><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{r.generales.tornillosComprar}</span></div>
            )}
            {r.generales.remachesComprar > 0 && (
              <div className="fila"><span>Remaches 5/32" <span className="sec" style={{ fontSize: 13 }}>se usan {r.generales.remachesUsados}</span></span><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{r.generales.remachesComprar}</span></div>
            )}
            {r.generales.gomaComprar > 0 && (
              <div className="fila"><span>Goma vidrio 4 mm <span className="sec" style={{ fontSize: 13 }}>se usan {fmtKg(r.generales.gomaUsada)} kg</span></span><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{fmtKg(r.generales.gomaComprar)} kg</span></div>
            )}
          </div>

          <span className="etiqueta-seccion">Exportar</span>
          <a className="btn whatsapp" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer">
            <Chat /> Enviar por WhatsApp
          </a>
          <div className="dos">
            <button type="button" className="btn secundario" onClick={copiar}>Copiar texto</button>
            <button type="button" className="btn secundario" onClick={() => import('../exportar/archivos.ts').then((m) => m.pdfLote(lote.numero, fecha, sesion.herreria.nombre, lote.cliente, r)).catch(() => avisar('No se pudo crear el PDF. Recarga la app e inténtalo de nuevo.'))}>Descargar PDF</button>
          </div>
          <span className="sec" style={{ fontSize: 13 }}>Vista previa del mensaje</span>
          <div className="burbuja">{mensaje}</div>
        </>
      )}
    </main>
  );
}
