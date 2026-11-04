// Pruebas automáticas del motor de cálculos.
// Correr: npm test   (o: node --test --experimental-strip-types src/calculos/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acomodarEnBarras,
  calcularLote,
  csvVidrios,
  precioUnitarioSugerido,
  subirAMultiplo,
  textoWhatsApp,
  totalDesdeUnitario,
  unitarioDesdeTotal,
  validarVentana,
  type VentanaEntrada,
} from './index.ts';

const barrasDe = (r: ReturnType<typeof calcularLote>, perfil: string) =>
  r.tubos.find((t) => t.perfil === perfil)?.barras;

test('Caso obligatorio: 3 Ecobel blancas 100×100 con protección', () => {
  const v: VentanaEntrada = {
    etiqueta: 'V1', cantidad: 3, sistema: 'ecobel', color: 'blanco',
    alto: 100, ancho: 100, proteccion: true,
  };
  const r = calcularLote([v]);
  const c = r.cortes[0];
  assert.equal(c.altoTrabajo, 94);
  assert.equal(c.anchoTrabajo, 94);

  const m = (p: string) => c.piezas.filter((x) => x.perfil === p);
  assert.deepEqual(m('Marco').map((x) => [x.medida, x.cantidad]), [[94, 6], [94, 6]]);
  assert.deepEqual(m('Liso').map((x) => [x.medida, x.cantidad]), [[89.7, 6]]);
  assert.deepEqual(m('Enganche').map((x) => [x.medida, x.cantidad]), [[89.7, 6]]);
  assert.deepEqual(m('Horizontal').map((x) => [x.medida, x.cantidad]), [[42.9, 12]]);

  assert.deepEqual(
    { alto: c.vidrio.alto, ancho: c.vidrio.ancho, cantidad: c.vidrio.cantidad },
    { alto: 82.5, ancho: 42.4, cantidad: 6 },
  );

  assert.equal(barrasDe(r, 'Marco'), 2);
  assert.equal(barrasDe(r, 'Liso'), 1);
  assert.equal(barrasDe(r, 'Enganche'), 1);
  assert.equal(barrasDe(r, 'Horizontal'), 1);

  const lin = Object.fromEntries(r.bloques[0].lineas.map((l) => [l.nombre, l.cantidad]));
  assert.deepEqual(lin, { 'Ruedas Ecobel': 12, Trancador: 3, Topes: 12 });

  assert.deepEqual(r.generales, {
    tornillosUsados: 36, tornillosComprar: 100,
    remachesUsados: 24, remachesComprar: 100,
    gomaUsada: 1.5, gomaComprar: 2,
  });

  assert.equal(precioUnitarioSugerido('ecobel', 100, 100), 100);
  assert.equal(totalDesdeUnitario(100, 3), 300);
});

const lote004: VentanaEntrada[] = [
  { etiqueta: 'V1', cantidad: 2, sistema: 'ecobel', color: 'negro', alto: 120, ancho: 150, proteccion: false, precioUnitario: 180, precioTotal: 360 },
  { etiqueta: 'V2', cantidad: 1, sistema: 'panoramico', color: 'blanco', alto: 150, ancho: 180, proteccion: true, precioUnitario: 243, precioTotal: 243 },
];

test('Panorámico 150×180 con protección: fórmulas', () => {
  const c = calcularLote([lote004[1]]).cortes[0];
  const p = Object.fromEntries(c.piezas.map((x) => [x.perfil, [x.medida, x.cantidad]]));
  assert.deepEqual(p, {
    Lateral: [144, 2],
    Cabezal: [171.6, 1],
    Sabote: [171.6, 1],
    Riel: [88.3, 2],
  });
  assert.equal(c.vidrio.alto, 137.5);
  assert.equal(c.vidrio.ancho, 88.3);
  assert.equal(c.vidrio.cantidad, 2);
});

test('Mensaje de WhatsApp: formato exacto del lote 004', () => {
  const r = calcularLote(lote004);
  const esperado = [
    '*Lote 004*',
    '03/11/2026',
    '',
    '▪️ *ECOBEL · NEGRO*',
    'Marco: 2',
    'Liso: 1',
    'Enganche: 1',
    'Horizontal: 1',
    '_Accesorios_',
    'Ruedas Ecobel: 8',
    'Trancador: 2',
    'Topes: 8',
    '',
    '▫️ *PANORÁMICO · BLANCO*',
    'Lateral: 1',
    'Cabezal: 1',
    'Sabote: 1',
    'Riel: 1',
    '_Accesorios_',
    'Ruedas: 4',
    'Trancador tipo chupón: 1',
    'Felpa: 6.86 m',
    '',
    '🔩 *GENERAL*',
    'Tornillos 8 × 1½": 100',
    'Remaches 5/32": 100',
    'Goma vidrio 4 mm: 2 kg',
  ].join('\n');
  assert.equal(textoWhatsApp(4, new Date(2026, 10, 3), r), esperado);
  assert.ok(!/6 ?m\b|metros/.test(textoWhatsApp(4, new Date(2026, 10, 3), r).replace('6.86 m', '')));
  assert.equal(r.venta, 603);
});

test('Barras: el disco cuenta y una pieza no se reparte', () => {
  // 6 piezas de 100 = 600 cm justos, pero con disco de 0.3 no caben en una barra.
  assert.equal(acomodarEnBarras([100, 100, 100, 100, 100, 100], 0.3).length, 2);
  assert.equal(acomodarEnBarras([100, 100, 100, 100, 100, 100], 0).length, 1);
  // 3 piezas de 400 cm: suman 12 m pero necesitan 3 barras (no 2).
  assert.equal(acomodarEnBarras([400, 400, 400]).length, 3);
  // Sobrante: 6 × 94 + 6 × 0.3 = 565.8 → sobran 34.2
  assert.equal(acomodarEnBarras([94, 94, 94, 94, 94, 94]).at(0)?.sobrante, 34.2);
  // Una pieza de 600 cabe sola.
  assert.equal(acomodarEnBarras([600]).length, 1);
  assert.throws(() => acomodarEnBarras([600.1]));
});

test('Redondeos de paquetes', () => {
  assert.equal(subirAMultiplo(28, 100), 100);
  assert.equal(subirAMultiplo(100, 100), 100);
  assert.equal(subirAMultiplo(130, 100), 200);
  assert.equal(subirAMultiplo(200, 100), 200);
  assert.equal(subirAMultiplo(0, 100), 0);
  assert.equal(subirAMultiplo(1250, 1000), 2000);
});

test('Precios: sugerido por m² con medida original; unitario ↔ total', () => {
  assert.equal(precioUnitarioSugerido('ecobel', 120, 150), 180);
  assert.equal(precioUnitarioSugerido('panoramico', 150, 180), 243);
  assert.equal(totalDesdeUnitario(100, 4), 400);
  assert.equal(totalDesdeUnitario(110, 4), 440);
  assert.equal(unitarioDesdeTotal(380, 4), 95);
  assert.equal(unitarioDesdeTotal(100, 3), 33.33);
  assert.equal(unitarioDesdeTotal(100, 0), 0);
});

test('CSV para CutList Optimizer', () => {
  const r = calcularLote(lote004);
  assert.equal(
    csvVidrios(r),
    'Length,Width,Qty,Label\n108.5,70.4,4,V1 Ecobel\n137.5,88.3,2,V2 Panoramico\n',
  );
});

test('Validación de medidas', () => {
  const base: VentanaEntrada = { etiqueta: 'V1', cantidad: 1, sistema: 'ecobel', color: 'negro', alto: 100, ancho: 100, proteccion: false };
  assert.deepEqual(validarVentana(base), []);
  assert.ok(validarVentana({ ...base, alto: 601 }).length > 0);
  assert.ok(validarVentana({ ...base, ancho: 10 }).length > 0);
  assert.ok(validarVentana({ ...base, cantidad: 0 }).length > 0);
  assert.ok(validarVentana({ ...base, cantidad: 1.5 }).length > 0);
  assert.deepEqual(validarVentana({ ...base, sistema: 'panoramico', alto: 600, ancho: 600 }), []);
});

test('Varios colores y sistemas en un mismo lote', () => {
  const r = calcularLote([
    { etiqueta: 'V1', cantidad: 1, sistema: 'ecobel', color: 'blanco', alto: 100, ancho: 100, proteccion: false },
    { etiqueta: 'V2', cantidad: 1, sistema: 'ecobel', color: 'negro', alto: 100, ancho: 100, proteccion: false },
    { etiqueta: 'V3', cantidad: 1, sistema: 'ecobel', color: 'negro', alto: 100, ancho: 100, proteccion: false },
  ]);
  // Bloques: primero negro, luego blanco; los dos negros se juntan.
  assert.deepEqual(r.bloques.map((b) => `${b.sistema}-${b.color}`), ['ecobel-negro', 'ecobel-blanco']);
  assert.equal(r.bloques[0].lineas[0].cantidad, 8);
  // Goma: 3 × 0.5 = 1.5 → 2 kg; tornillos 36 → 100
  assert.equal(r.generales.gomaComprar, 2);
  assert.equal(r.generales.tornillosComprar, 100);
});

test('Lectura de números escritos a mano', async () => {
  const { leerNumero } = await import('./index.ts');
  assert.equal(leerNumero('120,5'), 120.5);
  assert.equal(leerNumero('120.5'), 120.5);
  assert.equal(leerNumero('1,500', true), 1500);
  assert.equal(leerNumero('1.500', true), 1500);
  assert.equal(leerNumero('1.500,50', true), 1500.5);
  assert.equal(leerNumero('1,500.50', true), 1500.5);
  assert.equal(leerNumero('1,500,000', true), 1500000);
  assert.equal(leerNumero('12,5', true), 12.5);
  assert.equal(leerNumero('0'), 0);
  assert.equal(leerNumero(''), null);
  assert.equal(leerNumero('1.2.3'), null);
  assert.equal(leerNumero('-5'), null);
});

test('Redondeo .x5 siempre hacia arriba y disco inválido', async () => {
  const { r1, cortesVentana, acomodarEnBarras } = await import('./index.ts');
  assert.equal(r1(42.95), 43);
  assert.equal(r1((94.1 - 8.2) / 2), 43);
  assert.equal(r1((100.1 - 8.2) / 2), 46);
  const c = cortesVentana({ etiqueta: 'V1', cantidad: 1, sistema: 'ecobel', color: 'negro', alto: 100, ancho: 94.1, proteccion: false });
  assert.equal(c.piezas.find((p) => p.perfil === 'Horizontal')!.medida, 43);
  assert.equal(c.vidrio.ancho, 42.5);
  assert.equal(acomodarEnBarras([300, 300.5], -0.5).length, 2);
  assert.equal(acomodarEnBarras([100, 100], Number.NaN).length, 1);
  assert.equal(acomodarEnBarras([100, 100], Number.NaN)[0].sobrante, 399.4);
});
