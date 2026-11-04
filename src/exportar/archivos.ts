// Descargas: PDF del lote, PDF del cierre y CSV de vidrios.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  fmtCm, fmtDinero, fmtFecha, fmtKg, fmtLote, NOMBRE_SISTEMA, type ResultadoLote,
} from '../calculos/index.ts';
import type { Resumen } from '../datos/index.ts';
import { descargar } from './descargar.ts';

const COLOR_NOMBRE = { negro: 'Negro', blanco: 'Blanco' } as const;

function encabezado(doc: jsPDF, titulo: string, sub: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(titulo, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(sub, 14, 25);
  doc.setTextColor(0);
}

const estiloTabla = {
  theme: 'grid' as const,
  styles: { fontSize: 10, cellPadding: 2 },
  headStyles: { fillColor: [23, 23, 23] as [number, number, number], textColor: 255 },
  margin: { left: 14, right: 14 },
};

const ultimaY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export function pdfLote(numero: number, fecha: Date, herreria: string, cliente: string | null, r: ResultadoLote) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  encabezado(doc, `Lote ${fmtLote(numero)}`, `Herrería ${herreria} · ${cliente || 'Sin cliente'} · ${fmtFecha(fecha)}`);

  autoTable(doc, {
    ...estiloTabla,
    startY: 32,
    head: [['Compra de tubos', 'Color', 'Barras']],
    body: r.tubos.map((t) => [`${NOMBRE_SISTEMA[t.sistema]} · ${t.perfil}`, COLOR_NOMBRE[t.color], String(t.barras)]),
  });

  const acc: string[][] = [];
  for (const b of r.bloques) {
    for (const l of b.lineas) {
      acc.push([`${NOMBRE_SISTEMA[b.sistema]} ${COLOR_NOMBRE[b.color]}`, l.nombre, l.unidad === 'm' ? `${l.cantidad.toFixed(2)} m` : String(l.cantidad)]);
    }
  }
  const g = r.generales;
  if (g.tornillosComprar) acc.push(['General', `Tornillos 8 × 1½" (se usan ${g.tornillosUsados})`, String(g.tornillosComprar)]);
  if (g.remachesComprar) acc.push(['General', `Remaches 5/32" (se usan ${g.remachesUsados})`, String(g.remachesComprar)]);
  if (g.gomaComprar) acc.push(['General', `Goma vidrio 4 mm (se usan ${fmtKg(g.gomaUsada)} kg)`, `${fmtKg(g.gomaComprar)} kg`]);
  autoTable(doc, { ...estiloTabla, startY: ultimaY(doc) + 8, head: [['Bloque', 'Accesorio', 'Comprar']], body: acc });

  const cortes: string[][] = [];
  for (const c of r.cortes) {
    for (const p of c.piezas) {
      cortes.push([c.etiqueta, `${NOMBRE_SISTEMA[c.sistema]} ${COLOR_NOMBRE[c.color]}`, p.nota ? `${p.perfil} (${p.nota})` : p.perfil, fmtCm(p.medida), String(p.cantidad)]);
    }
  }
  autoTable(doc, { ...estiloTabla, startY: ultimaY(doc) + 8, head: [['Ventana', 'Sistema', 'Pieza', 'Medida cm', 'Cant.']], body: cortes });

  autoTable(doc, {
    ...estiloTabla,
    startY: ultimaY(doc) + 8,
    head: [['Vidrios 4 mm', 'Alto cm', 'Ancho cm', 'Cant.']],
    body: r.vidrios.map((v) => [`${v.etiqueta} ${NOMBRE_SISTEMA[v.sistema]}`, fmtCm(v.alto), fmtCm(v.ancho), String(v.cantidad)]),
  });

  descargar(`lote-${fmtLote(numero)}.pdf`, doc.output('blob'));
}

export function pdfCierre(numeroCierre: number, herreria: string, fecha: Date, res: Resumen) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rango = res.lote_desde != null ? `Lotes ${fmtLote(res.lote_desde)} – ${fmtLote(res.lote_hasta ?? res.lote_desde)}` : 'Sin lotes';
  encabezado(doc, `Cierre general #${numeroCierre}`, `Herrería ${herreria} · ${fmtFecha(fecha)} · ${rango}`);
  autoTable(doc, {
    ...estiloTabla,
    startY: 32,
    head: [['Lote', 'Cliente', 'Venta', 'Gasto', 'Ganancia']],
    body: res.lotes.map((l) => [fmtLote(l.numero), l.cliente || 'Sin cliente', fmtDinero(l.vendido), fmtDinero(l.perfileria + l.vidrio), fmtDinero(l.ganancia)]),
  });
  autoTable(doc, {
    ...estiloTabla,
    startY: ultimaY(doc) + 8,
    body: [
      ['Total vendido', fmtDinero(res.total_vendido)],
      ['Perfilería de aluminio', '-' + fmtDinero(res.total_perfileria)],
      ['Vidrio', '-' + fmtDinero(res.total_vidrio)],
      ['Mano de obra', '-' + fmtDinero(res.total_mano_obra)],
      ['Ganancia final', fmtDinero(res.ganancia)],
    ],
  });
  descargar(`cierre-${numeroCierre}.pdf`, doc.output('blob'));
}
