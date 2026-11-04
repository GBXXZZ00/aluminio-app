// Acomodo de piezas en barras de 600 cm, como se hace en el taller.
import type { Barra, Color, CortesVentana, Sistema, TuboCompra } from './tipos.ts';
import { DISCO_CM_DEFECTO, LARGO_BARRA_CM, PERFILES } from './reglas.ts';
import { r1 } from './numeros.ts';

// Se trabaja en centésimas de cm (enteros) para evitar errores de decimales.
const U = 100;
const aU = (cm: number) => Math.round(cm * U);
const deU = (u: number) => u / U;

/**
 * Acomoda piezas en barras usando "primero la más larga, en la primera barra
 * donde quepa". Cada corte consume además el grosor del disco.
 * Una pieza nunca se reparte entre dos barras.
 */
export function acomodarEnBarras(
  medidas: number[],
  disco: number = DISCO_CM_DEFECTO,
  largo: number = LARGO_BARRA_CM,
): Barra[] {
  const L = aU(largo);
  // Disco inválido (vacío, negativo o absurdo) → se usa el valor normal.
  const D = aU(Number.isFinite(disco) && disco >= 0 && disco <= 2 ? disco : DISCO_CM_DEFECTO);
  const ordenadas = [...medidas].map(aU).sort((a, b) => b - a);
  const barras: { piezas: number[]; usado: number }[] = [];

  for (const m of ordenadas) {
    if (m > L) throw new Error(`Una pieza de ${deU(m)} cm no cabe en una barra de ${largo} cm`);
    // La pieza cabe si lo ya usado (piezas + discos) más la pieza no pasa del largo.
    let destino = barras.find((b) => b.usado + m <= L);
    if (!destino) {
      destino = { piezas: [], usado: 0 };
      barras.push(destino);
    }
    destino.piezas.push(m);
    destino.usado += m + D;
  }

  return barras.map((b) => ({
    piezas: b.piezas.map(deU),
    sobrante: r1(Math.max(0, deU(L - b.usado))),
  }));
}

const ORDEN_SISTEMA: Sistema[] = ['ecobel', 'panoramico'];
const ORDEN_COLOR: Color[] = ['negro', 'blanco'];

/** Barras a comprar por sistema + perfil + color, para todo el lote. */
export function tubosAComprar(cortes: CortesVentana[], disco: number = DISCO_CM_DEFECTO): TuboCompra[] {
  const grupos = new Map<string, { sistema: Sistema; color: Color; perfil: string; medidas: number[] }>();
  for (const c of cortes) {
    for (const p of c.piezas) {
      const clave = `${c.sistema}|${c.color}|${p.perfil}`;
      let g = grupos.get(clave);
      if (!g) {
        g = { sistema: c.sistema, color: c.color, perfil: p.perfil, medidas: [] };
        grupos.set(clave, g);
      }
      for (let i = 0; i < p.cantidad; i++) g.medidas.push(p.medida);
    }
  }

  const resultado: TuboCompra[] = [];
  for (const s of ORDEN_SISTEMA) {
    for (const col of ORDEN_COLOR) {
      for (const perfil of PERFILES[s]) {
        const g = grupos.get(`${s}|${col}|${perfil}`);
        if (!g) continue;
        const acomodo = acomodarEnBarras(g.medidas, disco);
        resultado.push({
          sistema: s,
          color: col,
          perfil,
          barras: acomodo.length,
          totalPiezas: g.medidas.length,
          acomodo,
        });
      }
    }
  }
  return resultado;
}
