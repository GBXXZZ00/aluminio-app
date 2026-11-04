// Cálculo completo de un lote: todo lo que muestran Perfiles, Vidrios y Compra.
import type {
  AccesoriosBloque,
  AccesoriosGenerales,
  CortesVentana,
  TuboCompra,
  VentanaEntrada,
  Vidrio,
} from './tipos.ts';
import { cortesVentana } from './cortes.ts';
import { tubosAComprar } from './barras.ts';
import { accesoriosGenerales, accesoriosPorBloque } from './accesorios.ts';
import { DISCO_CM_DEFECTO } from './reglas.ts';
import { r2 } from './numeros.ts';

export interface ResultadoLote {
  cortes: CortesVentana[];
  vidrios: Vidrio[];
  panos: number;
  areaVidrioM2: number;
  tubos: TuboCompra[];
  bloques: AccesoriosBloque[];
  generales: AccesoriosGenerales;
  venta: number;
}

export function calcularLote(ventanas: VentanaEntrada[], disco: number = DISCO_CM_DEFECTO): ResultadoLote {
  const cortes = ventanas.map(cortesVentana);
  const vidrios = cortes.map((c) => c.vidrio);
  return {
    cortes,
    vidrios,
    panos: vidrios.reduce((t, v) => t + v.cantidad, 0),
    areaVidrioM2: r2(vidrios.reduce((t, v) => t + (v.alto * v.ancho * v.cantidad) / 10000, 0)),
    tubos: tubosAComprar(cortes, disco),
    bloques: accesoriosPorBloque(cortes),
    generales: accesoriosGenerales(cortes),
    venta: r2(ventanas.reduce((t, v) => t + (v.precioTotal ?? 0), 0)),
  };
}
