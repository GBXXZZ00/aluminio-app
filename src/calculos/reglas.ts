// Constantes del taller. Cambiar aquí si cambia una regla.
import type { Sistema } from './tipos.ts';

export const LARGO_BARRA_CM = 600;
export const DISCO_CM_DEFECTO = 0.3;
export const DESCUENTO_PROTECCION_CM = 6;

/** Precio sugerido por m² (oculto en la app; solo sirve para proponer el precio). */
export const PRECIO_M2: Record<Sistema, number> = {
  ecobel: 100,
  panoramico: 90,
};

/** Orden en que se muestran los perfiles de cada sistema. */
export const PERFILES: Record<Sistema, string[]> = {
  ecobel: ['Marco', 'Liso', 'Enganche', 'Horizontal'],
  panoramico: ['Lateral', 'Cabezal', 'Sabote', 'Riel'],
};

export const NOMBRE_SISTEMA: Record<Sistema, string> = {
  ecobel: 'Ecobel',
  panoramico: 'Panorámico',
};

/** Accesorios por ventana. */
export const ACCESORIOS = {
  ecobel: { ruedas: 4, trancador: 1, topes: 4, tornillos: 12, remaches: 8, gomaGramos: 500 },
  panoramico: { ruedas: 4, trancadorChupon: 1, tornillos: 4, felpaPorCabezal: 4, gomaGramos: 250 },
} as const;

export const PAQUETE_TORNILLOS = 100;
export const PAQUETE_REMACHES = 100;
