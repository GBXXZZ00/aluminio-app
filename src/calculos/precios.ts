// Precios de venta. El precio por m² no se muestra: solo propone el unitario.
import type { Sistema } from './tipos.ts';
import { PRECIO_M2 } from './reglas.ts';
import { r2 } from './numeros.ts';

/** Área con la medida ORIGINAL (aunque lleve protección), en m². */
export function areaM2(alto: number, ancho: number): number {
  return (alto * ancho) / 10000;
}

export function precioUnitarioSugerido(sistema: Sistema, alto: number, ancho: number): number {
  return r2(areaM2(alto, ancho) * PRECIO_M2[sistema]);
}

/** Si se cambia el unitario (o la cantidad): total = unitario × cantidad. */
export function totalDesdeUnitario(unitario: number, cantidad: number): number {
  return r2(unitario * cantidad);
}

/** Si se cambia el total: unitario = total ÷ cantidad. */
export function unitarioDesdeTotal(total: number, cantidad: number): number {
  if (cantidad <= 0) return 0;
  return r2(total / cantidad);
}
