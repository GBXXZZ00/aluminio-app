// Fórmulas de corte de cada sistema (ver CLAUDE.md, sección 3).
import type { CortesVentana, Pieza, VentanaEntrada } from './tipos.ts';
import { DESCUENTO_PROTECCION_CM, LARGO_BARRA_CM } from './reglas.ts';
import { r1 } from './numeros.ts';

/** Alto y ancho de trabajo: con protección se restan 6 cm a cada uno. */
export function medidasTrabajo(v: VentanaEntrada): { A: number; W: number } {
  const d = v.proteccion ? DESCUENTO_PROTECCION_CM : 0;
  return { A: r1(v.alto - d), W: r1(v.ancho - d) };
}

export function cortesVentana(v: VentanaEntrada): CortesVentana {
  const { A, W } = medidasTrabajo(v);
  const q = v.cantidad;
  let piezas: Pieza[];
  let vidrio: { alto: number; ancho: number };

  if (v.sistema === 'ecobel') {
    const liso = r1(A - 4.3);
    const horizontal = r1((W - 8.2) / 2);
    piezas = [
      { perfil: 'Marco', medida: A, cantidad: 2 * q },
      { perfil: 'Marco', medida: W, cantidad: 2 * q },
      { perfil: 'Liso', medida: liso, cantidad: 2 * q },
      { perfil: 'Enganche', medida: liso, cantidad: 2 * q },
      { perfil: 'Horizontal', medida: horizontal, cantidad: 4 * q },
    ];
    vidrio = { alto: r1(A - 11.5), ancho: r1(horizontal - 0.5) };
  } else {
    const cabezal = r1(W - 2.4);
    const riel = r1((cabezal + 5) / 2);
    piezas = [
      { perfil: 'Lateral', medida: A, cantidad: 2 * q },
      { perfil: 'Cabezal', medida: cabezal, cantidad: q },
      { perfil: 'Sabote', medida: cabezal, cantidad: q },
      { perfil: 'Riel', medida: riel, cantidad: 2 * q },
    ];
    vidrio = { alto: r1(A - 6.5), ancho: riel };
  }

  return {
    etiqueta: v.etiqueta,
    sistema: v.sistema,
    color: v.color,
    cantidad: q,
    altoTrabajo: A,
    anchoTrabajo: W,
    piezas,
    vidrio: { etiqueta: v.etiqueta, sistema: v.sistema, ...vidrio, cantidad: 2 * q },
  };
}

/**
 * Revisa que una ventana se pueda fabricar. Devuelve una lista de problemas
 * en palabras sencillas (vacía si todo está bien).
 */
export function validarVentana(v: VentanaEntrada): string[] {
  const errores: string[] = [];
  if (!Number.isInteger(v.cantidad) || v.cantidad < 1 || v.cantidad > 999) {
    errores.push('La cantidad debe ser un número entero entre 1 y 999.');
  }
  if (!(v.alto > 20) || !(v.ancho > 20)) {
    errores.push('El alto y el ancho deben ser mayores de 20 cm.');
  }
  if (v.alto > LARGO_BARRA_CM || v.ancho > LARGO_BARRA_CM) {
    errores.push('El alto y el ancho no pueden pasar de 600 cm (largo de la barra).');
  }
  if (errores.length) return errores;

  const c = cortesVentana(v);
  if (c.piezas.some((p) => p.medida <= 0) || c.vidrio.alto <= 0 || c.vidrio.ancho <= 0) {
    errores.push('La medida es demasiado pequeña: algún corte o vidrio da cero o negativo.');
  }
  if (c.piezas.some((p) => p.medida > LARGO_BARRA_CM)) {
    errores.push('Algún corte es más largo que la barra de 600 cm.');
  }
  return errores;
}
