// Tipos compartidos del motor de cálculos.

export type Sistema = 'ecobel' | 'panoramico';
export type Color = 'negro' | 'blanco';

/** Una entrada de ventana dentro de un lote (N ventanas iguales). */
export interface VentanaEntrada {
  /** Etiqueta visible: V1, V2… */
  etiqueta: string;
  cantidad: number;
  sistema: Sistema;
  color: Color;
  /** Medidas originales en cm (sin descontar protección). */
  alto: number;
  ancho: number;
  proteccion: boolean;
  precioUnitario?: number;
  precioTotal?: number;
}

/** Un corte de perfil: `cantidad` piezas de `medida` cm. */
export interface Pieza {
  perfil: string;
  /** Aclaración solo para mostrar, ej. "alto" / "ancho" en el Marco. */
  nota?: string;
  medida: number;
  cantidad: number;
}

export interface Vidrio {
  etiqueta: string;
  sistema: Sistema;
  alto: number;
  ancho: number;
  cantidad: number;
}

export interface CortesVentana {
  etiqueta: string;
  sistema: Sistema;
  color: Color;
  cantidad: number;
  altoTrabajo: number;
  anchoTrabajo: number;
  /** Piezas ya multiplicadas por la cantidad de ventanas. */
  piezas: Pieza[];
  vidrio: Vidrio;
}

/** Una barra de 600 cm con las piezas que se cortan de ella. */
export interface Barra {
  piezas: number[];
  sobrante: number;
}

export interface TuboCompra {
  sistema: Sistema;
  color: Color;
  perfil: string;
  barras: number;
  totalPiezas: number;
  acomodo: Barra[];
}

export interface AccesoriosBloque {
  sistema: Sistema;
  color: Color;
  lineas: { nombre: string; cantidad: number; unidad?: string }[];
}

export interface AccesoriosGenerales {
  tornillosUsados: number;
  tornillosComprar: number;
  remachesUsados: number;
  remachesComprar: number;
  /** en kg */
  gomaUsada: number;
  gomaComprar: number;
}
