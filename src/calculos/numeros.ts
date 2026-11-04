// Redondeos y formatos. Todo en un solo lugar para que sea consistente.

/**
 * Lee un número escrito a mano en el teléfono. Acepta coma o punto.
 * - Medidas (miles = false): "120,5" y "120.5" → 120.5
 * - Dinero (miles = true): además entiende separadores de miles:
 *   "1,500" → 1500, "1.500" → 1500, "1.500,50" → 1500.5, "1,500.50" → 1500.5,
 *   pero "12,5" → 12.5 y "1500.5" → 1500.5.
 * Devuelve null si no es un número válido.
 */
export function leerNumero(texto: string, miles = false): number | null {
  let t = texto.trim().replace(/\s/g, '');
  if (!t) return null;
  if (!/^[0-9.,]+$/.test(t)) return null;
  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // El separador que aparece al final es el decimal; el otro son miles.
    const dec = ultimaComa > ultimoPunto ? ',' : '.';
    const mil = dec === ',' ? '.' : ',';
    t = t.split(mil).join('').replace(dec, '.');
  } else if (miles && /^\d{1,3}([.,]\d{3})+$/.test(t)) {
    t = t.replace(/[.,]/g, '');
  } else {
    t = t.replace(',', '.');
  }
  if ((t.match(/\./g) ?? []).length > 1) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Redondea a 1 decimal (medidas en cm). */
export function r1(x: number): number {
  // toPrecision quita el "ruido" de los decimales de la computadora
  // (42.95 se guarda como 42.9499999…) para que .x5 siempre suba.
  return Math.round(Number((x * 10).toPrecision(12))) / 10;
}

/** Redondea a 2 decimales (dinero, metros de felpa). */
export function r2(x: number): number {
  return Math.round(Number((x * 100).toPrecision(12))) / 100;
}

/** Sube al siguiente múltiplo (28 → 100). 0 se queda en 0. */
export function subirAMultiplo(x: number, multiplo: number): number {
  if (x <= 0) return 0;
  return Math.ceil(x / multiplo - 1e-9) * multiplo;
}

/** 94 → "94.0" */
export function fmtCm(x: number): string {
  return r1(x).toFixed(1);
}

/** 1358 → "$1,358.00" */
export function fmtDinero(x: number): string {
  const n = r2(x);
  const signo = n < 0 ? '−' : '';
  return signo + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 4 → "004" */
export function fmtLote(n: number): string {
  return String(n).padStart(3, '0');
}

/** Fecha → "03/11/2026" (hora local del teléfono). */
export function fmtFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Kilos sin ceros de más: 2 → "2", 1.5 → "1.5", 1.25 → "1.25" */
export function fmtKg(x: number): string {
  return String(r2(x));
}
