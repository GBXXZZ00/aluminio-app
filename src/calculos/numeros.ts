// Redondeos y formatos. Todo en un solo lugar para que sea consistente.

/** Redondea a 1 decimal (medidas en cm). */
export function r1(x: number): number {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** Redondea a 2 decimales (dinero, metros de felpa). */
export function r2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
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
