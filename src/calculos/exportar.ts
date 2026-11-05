// Texto de WhatsApp y CSV para CutList Optimizer.
import type { Color, Sistema } from './tipos.ts';
import type { ResultadoLote } from './lote.ts';
import { fmtCm, fmtFecha, fmtKg, fmtLote } from './numeros.ts';

const MARCA: Record<Color, string> = { negro: '▪️', blanco: '▫️' };
const TITULO: Record<Sistema, string> = { ecobel: 'ECOBEL', panoramico: 'PANORÁMICO' };

/**
 * Mensaje para WhatsApp. Formato exacto acordado (CLAUDE.md §6):
 * sin herrería ni cliente, sin metros de barra, sin la etiqueta "Tubos".
 */
export function textoWhatsApp(numeroLote: number, fecha: Date, r: ResultadoLote): string {
  const lineas: string[] = [`*Lote ${fmtLote(numeroLote)}*`, fmtFecha(fecha)];

  for (const b of r.bloques) {
    lineas.push('', `${MARCA[b.color]} *${TITULO[b.sistema]} · ${b.color.toUpperCase()}*`);
    for (const t of r.tubos.filter((t) => t.sistema === b.sistema && t.color === b.color)) {
      lineas.push(`${t.perfil}: ${t.barras}`);
    }
    lineas.push('_Accesorios_');
    for (const l of b.lineas) {
      lineas.push(`${l.nombre}: ${l.unidad === 'm' ? l.cantidad.toFixed(2) + ' m' : l.cantidad}`);
    }
  }

  const g = r.generales;
  const gen: string[] = [];
  if (g.tornillosComprar) gen.push(`Tornillos 8 × 1½": ${g.tornillosComprar}`);
  if (g.remachesComprar) gen.push(`Remaches 5/32": ${g.remachesComprar}`);
  if (g.gomaComprar) gen.push(`Goma vidrio 4 mm: ${fmtKg(g.gomaComprar)} kg`);
  if (gen.length) lineas.push('', '🔩 *GENERAL*', ...gen);

  return lineas.join('\n');
}

/** CSV de vidrios: Length,Width,Qty,Label (alto, ancho, cantidad, etiqueta VACÍA a pedido del dueño). */
export function csvVidrios(r: ResultadoLote): string {
  const filas = ['Length,Width,Qty,Label'];
  for (const v of r.vidrios) {
    filas.push(`${fmtCm(v.alto)},${fmtCm(v.ancho)},${v.cantidad},`);
  }
  return filas.join('\n') + '\n';
}
