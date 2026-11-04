// Accesorios por bloque (sistema + color) y generales (tornillos, remaches, goma).
import type { AccesoriosBloque, AccesoriosGenerales, Color, CortesVentana, Sistema } from './tipos.ts';
import { ACCESORIOS, PAQUETE_REMACHES, PAQUETE_TORNILLOS } from './reglas.ts';
import { r2, subirAMultiplo } from './numeros.ts';

const ORDEN: [Sistema, Color][] = [
  ['ecobel', 'negro'],
  ['ecobel', 'blanco'],
  ['panoramico', 'negro'],
  ['panoramico', 'blanco'],
];

export function accesoriosPorBloque(cortes: CortesVentana[]): AccesoriosBloque[] {
  const bloques: AccesoriosBloque[] = [];
  for (const [s, col] of ORDEN) {
    const del = cortes.filter((c) => c.sistema === s && c.color === col);
    if (!del.length) continue;
    const q = del.reduce((t, c) => t + c.cantidad, 0);
    if (s === 'ecobel') {
      const a = ACCESORIOS.ecobel;
      bloques.push({
        sistema: s,
        color: col,
        lineas: [
          { nombre: 'Ruedas Ecobel', cantidad: a.ruedas * q },
          { nombre: 'Trancador', cantidad: a.trancador * q },
          { nombre: 'Topes', cantidad: a.topes * q },
        ],
      });
    } else {
      const a = ACCESORIOS.panoramico;
      // Felpa = largo del cabezal (m) × 4, por cada ventana.
      const felpaCm = del.reduce((t, c) => {
        const cabezal = c.piezas.find((p) => p.perfil === 'Cabezal');
        return t + (cabezal ? cabezal.medida * a.felpaPorCabezal * c.cantidad : 0);
      }, 0);
      bloques.push({
        sistema: s,
        color: col,
        lineas: [
          { nombre: 'Ruedas', cantidad: a.ruedas * q },
          { nombre: 'Trancador tipo chupón', cantidad: a.trancadorChupon * q },
          { nombre: 'Felpa', cantidad: r2(felpaCm / 100), unidad: 'm' },
        ],
      });
    }
  }
  return bloques;
}

export function accesoriosGenerales(cortes: CortesVentana[]): AccesoriosGenerales {
  let tornillos = 0;
  let remaches = 0;
  let gomaGramos = 0;
  for (const c of cortes) {
    if (c.sistema === 'ecobel') {
      tornillos += ACCESORIOS.ecobel.tornillos * c.cantidad;
      remaches += ACCESORIOS.ecobel.remaches * c.cantidad;
      gomaGramos += ACCESORIOS.ecobel.gomaGramos * c.cantidad;
    } else {
      tornillos += ACCESORIOS.panoramico.tornillos * c.cantidad;
      gomaGramos += ACCESORIOS.panoramico.gomaGramos * c.cantidad;
    }
  }
  return {
    tornillosUsados: tornillos,
    tornillosComprar: subirAMultiplo(tornillos, PAQUETE_TORNILLOS),
    remachesUsados: remaches,
    remachesComprar: subirAMultiplo(remaches, PAQUETE_REMACHES),
    gomaUsada: gomaGramos / 1000,
    gomaComprar: subirAMultiplo(gomaGramos, 1000) / 1000,
  };
}
