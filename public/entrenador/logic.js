// Lógica pura del entrenador: rutina, semanas, progresión, descarga, faltas y discos.
// No toca el DOM ni la red, así se puede probar sola.

// Horario nuevo desde el lunes 23/11/2026: los días de pierna caen cuando esas máquinas están libres
// (en el gimnasio todos hacen pierna lunes y miércoles, y arriba martes y viernes).
// Se mantienen las mismas claves (lun, mar…) para no perder el historial ni los pesos.
const HORARIO_NUEVO = new Date() >= new Date(2026, 10, 23);
const WD = HORARIO_NUEVO ? { lun: 2, mar: 1, mie: 5, vie: 3, sab: 6 } : { lun: 1, mar: 2, mie: 3, vie: 5, sab: 6 };
const LETRA_DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DIAS = {
  lun: { d: LETRA_DIA[WD.lun], nombre: 'Glúteo + Isquios', wd: WD.lun },
  mar: { d: LETRA_DIA[WD.mar], nombre: 'Torso A', wd: WD.mar },
  mie: { d: LETRA_DIA[WD.mie], nombre: 'Pierna B', wd: WD.mie },
  vie: { d: LETRA_DIA[WD.vie], nombre: 'Torso B', wd: WD.vie },
  sab: { d: LETRA_DIA[WD.sab], nombre: HORARIO_NUEVO ? 'Glúteo C + Femoral' : 'Glúteo C + Cuádriceps', wd: WD.sab }
};
const clave = wd => Object.keys(WD).find(k => WD[k] === wd) || null;
export const SEMANA = [1, 2, 3, 4, 5, 6, 7].map(wd => clave(wd) ? { wd, key: clave(wd) } : { wd, key: null, d: LETRA_DIA[wd] });
export const ORDEN_DIAS = SEMANA.filter(x => x.key).map(x => x.key);
export const NOMBRE_DIA = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const A = (n, d) => ({ n, d });

// carga: discos (máquina de discos), pila (máquina con pasador), polea, mancuernas, tiempo (sin peso)
export const EJ = {
  ht_lun: { n: 'Hip Thrust en máquina', sets: 4, lo: 6, hi: 8, rest: 150, rir: '1–2', carga: 'discos', u: 'lb',
    how: 'Espalda alta en el respaldo, pies al ancho de la cadera. Mentón al pecho y costillas abajo. Empuja con los talones hasta quedar recto, aprieta el glúteo 2 segundos y baja controlado.',
    soft: A('Puente de glúteo en Smith, más liviano', 'Mismo glúteo, menos peso y recorrido más corto'),
    alts: [A('Hip thrust con barra en banco', 'Mismo movimiento, otra estación'), A('Puente de glúteo en Smith', 'Muy parecido y fácil de montar'), A('Patada de glúteo en polea', 'Si todo está lleno')] },
  pt_lun: { n: 'Pull-through en polea', sets: 3, lo: 12, hi: 15, rest: 90, rir: '1–2', carga: 'polea', u: 'kg',
    how: 'De espaldas a la polea baja, cuerda entre las piernas. Lleva la cadera atrás con la espalda recta hasta sentir el estiramiento detrás de la pierna y sube apretando el glúteo.',
    soft: A('Patada de glúteo en polea', 'Sin carga en la espalda'),
    alts: [A('Patada de glúteo en polea', 'Otra polea'), A('Hip thrust con barra en banco', 'Mismo glúteo'), A('Puente de glúteo en Smith', 'Fácil de montar')] },
  pr_lun: { n: 'Prensa 45° pies altos', sets: 3, lo: 10, hi: 12, rest: 120, rir: '1–2', carga: 'discos', u: 'kg',
    how: 'Pies altos y anchos. Baja hasta donde la cadera siga pegada al respaldo. Empuja con los talones y no bloquees las rodillas arriba.',
    soft: A('Prensa con recorrido corto, hasta 90°', 'Menos flexión de rodilla'),
    alts: [A('Hack squat con pies altos', 'Máquina parecida'), A('Prensa horizontal sentado', 'Otra prensa, espalda apoyada'), A('Sentadilla en Smith, pies adelante', 'Solo si la espalda está bien')] },
  cf_lun: { n: 'Curl femoral sentado', sets: 4, lo: 10, hi: 12, rest: 90, ssRest: 30, rir: '0–1', carga: 'pila', u: 'kg',
    how: 'Rodillas alineadas con el eje de la máquina. Dobla las piernas apretando la parte de atrás del muslo y vuelve en 3 segundos.',
    soft: A('Curl femoral sentado, 20 % menos peso', 'Bajada lenta y sin forzar'),
    alts: [A('Curl femoral de pie a una pierna', 'Otra máquina'), A('Curl femoral acostado', 'Mismo músculo'), A('Curl con mancuerna acostado', 'Si todo está lleno')] },
  lat_lun: { n: 'Elevaciones laterales con mancuernas', sets: 4, lo: 12, hi: 15, rest: 60, ssRest: 60, rir: '0–1', carga: 'mancuernas', u: 'kg',
    how: 'De pie, codos un poco doblados. Sube los brazos a los lados hasta la altura del hombro, sin impulso, y baja en 2 segundos.',
    soft: A('Laterales en polea, más liviano', 'Tensión suave y constante'),
    alts: [A('Laterales en polea', 'Otra estación'), A('Laterales en máquina', 'Si hay máquina libre'), A('Laterales sentado con mancuernas', 'Sin impulso')] },
  pa_lun: { n: 'Pantorrilla en prensa', sets: 3, lo: 10, hi: 12, rest: 75, ssRest: 60, rir: '1', carga: 'discos', u: 'kg',
    how: 'Punta de los pies en el borde de la plataforma. Baja el talón hasta estirar, aguanta 2 segundos y sube lo más alto que puedas.',
    soft: A('Pantorrilla sentado', 'Menos carga en la rodilla'),
    alts: [A('Pantorrilla de pie en máquina', 'Mismo músculo'), A('Pantorrilla en Smith sobre disco', 'Fácil de montar'), A('Pantorrilla a una pierna con mancuerna', 'Si todo está lleno')] },

  pim_mar: { n: 'Press inclinado con mancuernas 30°', sets: 4, lo: 6, hi: 8, rest: 150, ssRest: 90, rir: '1–2', carga: 'mancuernas', u: 'kg',
    how: 'Omóplatos juntos y pegados al banco. Baja hasta la parte alta del pecho y empuja sin chocar las mancuernas.',
    soft: A('Press inclinado en máquina, más liviano', 'Recorrido guiado'),
    alts: [A('Press inclinado en máquina', 'Recorrido guiado'), A('Press inclinado en Smith', 'Barra guiada'), A('Cruce de poleas abajo-arriba', 'Si todo está lleno')] },
  jal_mar: { n: 'Jalón al pecho agarre abierto', sets: 4, lo: 8, hi: 10, rest: 120, ssRest: 90, rir: '1', carga: 'pila', u: 'kg',
    how: 'Pecho arriba. Piensa en llevar los codos a los bolsillos, no en tirar con las manos. Sube controlado.',
    soft: A('Jalón con agarre neutro, más liviano', 'Más cómodo para el hombro'),
    alts: [A('Jalón con agarre neutro', 'Otra barra'), A('Dominadas asistidas', 'En máquina'), A('Jalón a un brazo en polea', 'Si todo está lleno')] },
  rem_mar: { n: 'Remo con pecho apoyado', sets: 3, lo: 8, hi: 10, rest: 120, ssRest: 75, rir: '1', carga: 'discos', u: 'kg',
    how: 'Pecho pegado al apoyo. Lleva los codos atrás y aprieta la espalda 1 segundo.',
    soft: A('Remo en polea sentado, más liviano', 'Espalda recta, sin balanceo'),
    alts: [A('Remo en máquina', 'Pecho apoyado'), A('Remo en polea sentado', 'Otra estación'), A('Remo con mancuerna apoyado en banco', 'Si todo está lleno')] },
  cru_mar: { n: 'Cruce de poleas abajo-arriba', sets: 3, lo: 12, hi: 15, rest: 75, ssRest: 75, rir: '0–1', carga: 'polea', u: 'kg',
    how: 'Poleas abajo. Brazos un poco doblados, junta las manos a la altura de la cara apretando el pecho alto.',
    soft: A('Cruce de poleas, más liviano', 'Recorrido corto'),
    alts: [A('Aperturas inclinadas con mancuernas', 'Mismo pecho alto'), A('Pec-deck', 'Máquina'), A('Press inclinado en máquina ligero', 'Si todo está lleno')] },
  latp_mar: { n: 'Elevaciones laterales en polea', sets: 4, lo: 12, hi: 15, rest: 60, rir: '0–1', carga: 'polea', u: 'kg',
    how: 'Polea baja por delante del cuerpo. Sube hasta la altura del hombro, sin impulso.',
    soft: A('Laterales con mancuernas ligeras', 'Sin impulso'),
    alts: [A('Laterales con mancuernas', 'Otra estación'), A('Laterales en máquina', 'Si hay libre'), A('Laterales sentado', 'Sin impulso')] },
  tri_mar: { n: 'Tríceps en polea con cuerda', sets: 3, lo: 10, hi: 12, rest: 75, ssRest: 30, rir: '1', carga: 'polea', u: 'kg',
    how: 'Codos pegados al cuerpo. Extiende y abre la cuerda abajo.',
    soft: A('Tríceps con barra en polea, más liviano', 'Más estable'),
    alts: [A('Tríceps con barra en polea', 'Otra agarradera'), A('Fondos en máquina', 'Si hay libre'), A('Patada de tríceps con mancuerna', 'Si todo está lleno')] },
  mar_mar: { n: 'Curl martillo', sets: 3, lo: 10, hi: 12, rest: 75, ssRest: 75, rir: '1', carga: 'mancuernas', u: 'kg',
    how: 'Palmas mirándose. Sube sin balancear el cuerpo y baja en 2 segundos.',
    soft: A('Curl martillo en polea con cuerda', 'Tensión suave'),
    alts: [A('Curl martillo en polea con cuerda', 'Otra estación'), A('Curl con barra Z', 'Si hay libre'), A('Curl en máquina', 'Si todo está lleno')] },
  col_mar: { n: 'Colgarse de la barra (opcional)', sets: 2, lo: 20, hi: 30, rest: 60, rir: '—', carga: 'tiempo', u: 's', opcional: true,
    how: 'Cuélgate de la barra con los brazos estirados y el cuerpo relajado. Solo si te alivia la espalda.', soft: A('Saltarlo hoy', 'Es opcional'), alts: [] },

  prm_mie: { n: 'Prensa 45° pies a media altura', sets: 3, lo: 8, hi: 10, rest: 150, rir: '1–2', carga: 'discos', u: 'kg',
    how: 'Pies al ancho de la cadera, a media altura. Baja controlado y no bloquees las rodillas arriba.',
    soft: A('Prensa con recorrido corto, hasta 90°', 'Menos flexión de rodilla'),
    alts: [A('Hack squat', 'Máquina parecida'), A('Prensa horizontal sentado', 'Espalda apoyada'), A('Sentadilla en Smith, pies adelante', 'Solo si la espalda está bien')] },
  zan_mie: { n: 'Zancada estática con mancuernas', sets: 3, lo: 10, hi: 12, rest: 120, rir: '1–2', carga: 'mancuernas', u: 'kg', porPierna: true,
    how: 'Los pies no se mueven. Paso largo y torso un poco adelante para más glúteo. Empuja con el talón de adelante.',
    soft: A('Prensa a una pierna, más liviana', 'Espalda apoyada'),
    alts: [A('Zancada estática en Smith', 'Más estable'), A('Prensa a una pierna', 'Espalda apoyada'), A('Step-up a banco bajo con mancuernas', 'Si todo está lleno')] },
  ext_mie: { n: 'Extensión de cuádriceps (recorrido corto)', sets: 3, lo: 12, hi: 15, rest: 75, rir: '1', carga: 'pila', u: 'kg',
    how: 'De 90° a unos 30°, sin estirar del todo la pierna. Haz una serie ligera antes para calentar la rodilla.',
    soft: A('Extensión con menos peso y pausa', 'Cuida la rótula'),
    alts: [A('Extensión a una pierna', 'Misma máquina'), A('Prensa con pies bajos, ligera', 'Otra máquina'), A('Sentadilla sissy asistida', 'Si todo está lleno')] },
  pat_mie: { n: 'Patada de glúteo en polea', sets: 3, lo: 12, hi: 15, rest: 60, ssRest: 30, rir: '0–1', carga: 'polea', u: 'kg', porPierna: true,
    how: 'Tobillera en la polea baja. Lleva la pierna atrás apretando 1 segundo, sin arquear la espalda.',
    soft: A('Patada de glúteo, más liviana', 'Recorrido corto'),
    alts: [A('Patada de glúteo en máquina', 'Si hay libre'), A('Abducción en polea', 'Mismo glúteo'), A('Puente de glúteo en Smith', 'Si todo está lleno')] },
  pan_mie: { n: 'Pantorrilla sentado', sets: 3, lo: 12, hi: 15, rest: 60, ssRest: 60, rir: '0–1', carga: 'discos', u: 'kg',
    how: 'Rodillas bajo el cojín. Baja el talón, pausa 2 segundos y sube lo más alto posible.',
    soft: A('Pantorrilla sentado, más liviana', 'Pausa larga'),
    alts: [A('Pantorrilla en prensa', 'Otra máquina'), A('Pantorrilla de pie en máquina', 'Mismo músculo'), A('Pantorrilla con mancuerna sentado', 'Si todo está lleno')] },

  pima_vie: { n: 'Press inclinado en máquina', sets: 3, lo: 8, hi: 10, rest: 120, ssRest: 90, rir: '1', carga: 'discos', u: 'kg',
    how: 'Espalda pegada al respaldo, empuja hacia arriba y adelante sin bloquear los codos.',
    soft: A('Press inclinado en máquina, más liviano', 'Recorrido corto'),
    alts: [A('Press inclinado con mancuernas', 'Mismo pecho alto'), A('Press inclinado en Smith', 'Barra guiada'), A('Cruce de poleas abajo-arriba', 'Si todo está lleno')] },
  jaln_vie: { n: 'Jalón agarre neutro', sets: 3, lo: 8, hi: 10, rest: 120, ssRest: 90, rir: '1', carga: 'pila', u: 'kg',
    how: 'Pecho arriba, baja la barra hasta la clavícula llevando los codos hacia abajo.',
    soft: A('Jalón neutro, más liviano', 'Sin forzar el hombro'),
    alts: [A('Dominadas asistidas', 'En máquina'), A('Jalón abierto', 'Otra barra'), A('Jalón a un brazo en polea', 'Si todo está lleno')] },
  remp_vie: { n: 'Remo en polea sentado', sets: 3, lo: 10, hi: 12, rest: 90, ssRest: 90, rir: '1', carga: 'pila', u: 'kg',
    how: 'Espalda recta, sin balancearte. Lleva los codos atrás y aprieta la espalda.',
    soft: A('Remo con pecho apoyado, más liviano', 'Sin carga en la espalda baja'),
    alts: [A('Remo con pecho apoyado', 'Otra máquina'), A('Remo en máquina', 'Si hay libre'), A('Remo con mancuerna apoyado', 'Si todo está lleno')] },
  pmil_vie: { n: 'Press militar sentado con respaldo', sets: 3, lo: 8, hi: 10, rest: 120, ssRest: 90, rir: '1–2', carga: 'mancuernas', u: 'kg',
    how: 'Espalda pegada al respaldo, sin arquear. Empuja hasta casi estirar los brazos.',
    soft: A('Press de hombro en máquina, más liviano', 'Recorrido guiado'),
    alts: [A('Press de hombro en máquina', 'Recorrido guiado'), A('Press militar en Smith sentado', 'Barra guiada'), A('Press Arnold sentado', 'Si todo está lleno')] },
  pdi_vie: { n: 'Deltoide posterior en pec-deck inverso', sets: 3, lo: 12, hi: 15, rest: 60, rir: '0–1', carga: 'pila', u: 'kg',
    how: 'Brazos casi rectos. Abre hacia atrás apretando la parte de atrás del hombro.',
    soft: A('Pec-deck inverso, más liviano', 'Recorrido corto'),
    alts: [A('Face pull en polea', 'Mismo hombro posterior'), A('Pájaros con mancuernas apoyado', 'Pecho apoyado'), A('Cruce inverso en poleas', 'Si todo está lleno')] },
  curi_vie: { n: 'Curl en banco inclinado', sets: 3, lo: 10, hi: 12, rest: 75, ssRest: 30, rir: '1', carga: 'mancuernas', u: 'kg',
    how: 'Espalda en el banco inclinado, brazos colgando. Sube sin mover los codos.',
    soft: A('Curl en polea, más liviano', 'Tensión suave'),
    alts: [A('Curl en polea baja', 'Otra estación'), A('Curl en máquina', 'Si hay libre'), A('Curl con barra Z', 'Si todo está lleno')] },
  tsc_vie: { n: 'Tríceps sobre la cabeza en polea', sets: 3, lo: 10, hi: 12, rest: 75, ssRest: 75, rir: '1', carga: 'polea', u: 'kg',
    how: 'De espaldas a la polea, codos arriba y quietos. Extiende los brazos por encima de la cabeza.',
    soft: A('Tríceps con cuerda abajo, más liviano', 'Más cómodo'),
    alts: [A('Extensión con mancuerna sobre la cabeza', 'Sentado con respaldo'), A('Tríceps con cuerda', 'Otra posición'), A('Fondos en máquina', 'Si todo está lleno')] },
  col_vie: { n: 'Colgarse de la barra (opcional)', sets: 2, lo: 20, hi: 30, rest: 60, rir: '—', carga: 'tiempo', u: 's', opcional: true,
    how: 'Cuélgate de la barra con los brazos estirados y el cuerpo relajado. Solo si te alivia la espalda.', soft: A('Saltarlo hoy', 'Es opcional'), alts: [] },

  ht_sab: { n: 'Hip Thrust en máquina (volumen)', sets: 3, lo: 10, hi: 12, rest: 120, rir: '2', carga: 'discos', u: 'lb',
    how: 'Menos peso que ' + (HORARIO_NUEVO ? 'el martes' : 'el lunes') + ' y más repeticiones. Aprieta 2 segundos arriba.',
    soft: A('Puente de glúteo en Smith, más liviano', 'Recorrido corto'),
    alts: [A('Hip thrust con barra en banco', 'Otra estación'), A('Puente de glúteo en Smith', 'Fácil de montar'), A('Patada de glúteo en polea', 'Si todo está lleno')] },
  pt_sab: { n: 'Pull-through en polea', sets: 3, lo: 12, hi: 15, rest: 90, rir: '1', carga: 'polea', u: 'kg',
    how: 'De espaldas a la polea baja, cuerda entre las piernas. Cadera atrás con la espalda recta y sube apretando el glúteo.',
    soft: A('Patada de glúteo en polea', 'Sin carga en la espalda'),
    alts: [A('Patada de glúteo en polea', 'Otra polea'), A('Hip thrust con barra en banco', 'Mismo glúteo'), A('Puente de glúteo en Smith', 'Fácil de montar')] },
  cf_sab: { n: 'Curl femoral sentado', sets: 3, lo: 10, hi: 12, rest: 90, ssRest: 30, rir: '1', carga: 'pila', u: 'kg',
    how: 'Rodillas alineadas con el eje. Dobla apretando la parte de atrás del muslo y vuelve en 3 segundos.',
    soft: A('Curl femoral, 20 % menos peso', 'Bajada lenta'),
    alts: [A('Curl femoral de pie a una pierna', 'Otra máquina'), A('Curl femoral acostado', 'Mismo músculo'), A('Curl con mancuerna acostado', 'Si todo está lleno')] },
  lat_sab: { n: 'Elevaciones laterales con mancuernas', sets: 3, lo: 12, hi: 15, rest: 60, ssRest: 60, rir: '0–1', carga: 'mancuernas', u: 'kg',
    how: 'Sube los brazos a los lados hasta la altura del hombro, sin impulso.',
    soft: A('Laterales en polea, más liviano', 'Tensión suave'),
    alts: [A('Laterales en polea', 'Otra estación'), A('Laterales en máquina', 'Si hay libre'), A('Laterales sentado', 'Sin impulso')] },
  abd_sab: { n: 'Abducción de cadera en polea', sets: 3, lo: 15, hi: 20, rest: 60, ssRest: 30, rir: '0–1', carga: 'polea', u: 'kg', porPierna: true,
    how: 'De pie, tobillera en la polea baja. Abre la pierna hacia el lado sin girar la cadera. Si la máquina combinada funciona, úsala con el torso inclinado adelante.',
    soft: A('Abducción en polea, más liviana', 'Recorrido corto'),
    alts: [A('Abducción en máquina combinada', 'Cuando la reparen'), A('Patada lateral en polea', 'Otra variante'), A('Abducción con banda sentado', 'Si todo está lleno')] },
  ext_sab: { n: 'Extensión de cuádriceps (recorrido corto)', sets: 3, lo: 12, hi: 15, rest: 75, ssRest: HORARIO_NUEVO ? 30 : 60, rir: '1', carga: 'pila', u: 'kg',
    how: 'De 90° a unos 30°, sin estirar del todo. Peso moderado.',
    soft: A('Extensión con menos peso y pausa', 'Cuida la rótula'),
    alts: [A('Extensión a una pierna', 'Misma máquina'), A('Prensa con pies bajos, ligera', 'Otra máquina'), A('Sentadilla sissy asistida', 'Si todo está lleno')] }
};

// Pasos de cada día: un ejercicio solo o una superserie (2 ejercicios). sec = sección en el inicio.
export const RUTINA = {
  lun: [
    { sec: 'principal', ex: ['ht_lun'] }, { sec: 'principal', ex: ['pt_lun'] }, { sec: 'principal', ex: ['pr_lun'] },
    { sec: 'ss', ex: ['cf_lun', 'lat_lun'], label: 'A' },
    ...(HORARIO_NUEVO ? [{ sec: 'ss', ex: ['ext_sab', 'pa_lun'], label: 'B' }] : [{ sec: 'final', ex: ['pa_lun'] }])
  ],
  mar: [
    { sec: 'ss', ex: ['pim_mar', 'jal_mar'], label: 'A' }, { sec: 'ss', ex: ['rem_mar', 'cru_mar'], label: 'B' },
    { sec: 'principal', ex: ['latp_mar'] }, { sec: 'ss', ex: ['tri_mar', 'mar_mar'], label: 'C' }, { sec: 'final', ex: ['col_mar'] }
  ],
  mie: [
    { sec: 'principal', ex: ['prm_mie'] }, { sec: 'principal', ex: ['zan_mie'] }, { sec: 'principal', ex: ['ext_mie'] },
    { sec: 'ss', ex: ['pat_mie', 'pan_mie'], label: 'A' }
  ],
  vie: [
    { sec: 'ss', ex: ['pima_vie', 'jaln_vie'], label: 'A' }, { sec: 'ss', ex: ['remp_vie', 'pmil_vie'], label: 'B' },
    { sec: 'principal', ex: ['pdi_vie'] }, { sec: 'ss', ex: ['curi_vie', 'tsc_vie'], label: 'C' }, { sec: 'final', ex: ['col_vie'] }
  ],
  sab: [
    { sec: 'principal', ex: ['ht_sab'] }, { sec: 'principal', ex: ['pt_sab'] },
    { sec: 'ss', ex: ['cf_sab', 'lat_sab'], label: 'A' },
    // Desde el horario nuevo la extensión pasa al martes (el viernes ya es día de cuádriceps)
    HORARIO_NUEVO ? { sec: 'final', ex: ['abd_sab'] } : { sec: 'ss', ex: ['abd_sab', 'ext_sab'], label: 'B' }
  ]
};
export const CALENTAMIENTO = [
  { n: 'Bicicleta o caminadora', d: '5–8 min suave' },
  { n: 'Series ligeras del primer ejercicio', d: '1–2 series con poco peso' }
];
export const PRIORIDAD = ['lun', 'sab', 'mie', 'mar', 'vie']; // glúteo primero

// ---------- fechas ----------
export function iso(d) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${dd}`; }
export function parseIso(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function weekday(d) { const w = d.getDay(); return w === 0 ? 7 : w; } // 1=lunes … 7=domingo
export function inicioCiclo(d) { return weekday(d) >= 6 ? addDays(lunesDe(d), 7) : lunesDe(d); }
export function lunesDe(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (weekday(x) - 1)); return x; }
export function addDays(d, n) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
export function diffDays(a, b) { return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000); }

// Semana del ciclo de 6 (la 6 es descarga). inicio = lunes en que empezó el primer ciclo.
export function infoSemana(hoy, inicioIso) {
  const inicio = inicioIso ? parseIso(inicioIso) : lunesDe(hoy);
  const semanas = Math.floor(diffDays(lunesDe(inicio), lunesDe(hoy)) / 7);
  const n = Math.max(0, semanas);
  const ciclo = Math.floor(n / 6) + 1; const semana = (n % 6) + 1;
  return { ciclo, semana, descarga: semana === 6, avisoDescarga: semana === 5, buscarPesos: ciclo === 1 && semana <= 2, semanaKey: iso(lunesDe(hoy)) };
}

// ---------- pesos ----------
export function paso(e, u) {
  u = u || e.u;
  if (e.carga === 'mancuernas') return u === 'lb' ? 5 : 1;
  return u === 'lb' ? 5 : 2.5;
}
export function redondear(w, st) { return Math.round(Math.round(w / st) * st * 100) / 100; }
// Subida de 2–10 % (ACSM), redondeada al salto más pequeño posible
export function siguientePeso(e, w, u) {
  const st = paso(e, u); const pct = e.carga === 'discos' ? 0.04 : 0.05;
  return Math.round((w + Math.max(st, Math.round(w * pct / st) * st)) * 100) / 100;
}
export function pesoDescarga(e, w, u) { const st = paso(e, u); return Math.max(0, Math.floor((w * 0.9) / st) * st); }
export function seriesDe(e, descarga) { return descarga ? Math.max(1, Math.ceil(e.sets / 2)) : e.sets; }
export function convertir(w, u) { return u === 'lb' ? Math.round(w * 0.4536 * 10) / 10 : Math.round(w * 2.2046); }
export function aKg(w, u) { return u === 'lb' ? w * 0.4536 : w; }

export function discosPorLado(total, base, u) {
  const sizes = u === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [20, 15, 10, 5, 2.5, 1.25];
  let lado = (total - (base || 0)) / 2; const out = [];
  if (lado < 0) return { discos: [], sobra: Math.round(lado * 2 * 100) / 100 };
  sizes.forEach(p => { while (lado >= p - 0.001 && out.length < 12) { out.push(p); lado -= p; } });
  return { discos: out, sobra: Math.round(lado * 2 * 100) / 100 };
}

// ---------- progresión (regla de 2 sesiones, ACSM) ----------
const top = (r, sets, hi) => r.length >= sets && r.slice(0, sets).every(v => v >= hi);
const minOk = (r, sets, lo) => r.length >= sets && r.slice(0, sets).every(v => v >= lo);

// historial: entradas anteriores del ejercicio (más antigua primero) {w,u,reps,descarga}
export function decidir(k, entrada, historial, estadoEj) {
  const e = EJ[k]; const w = entrada.w; const u = entrada.u; const r = entrada.reps || [];
  if (e.carga === 'tiempo') return { t: 'Hecho', d: 'Opcional, no cuenta para el progreso.', tag: 'Hecho', nuevo: null };
  if (entrada.descarga) return { t: 'Semana de descarga', d: 'No cuenta para subir peso. Después vuelves a ' + (estadoEj && estadoEj.w != null ? estadoEj.w : w) + ' ' + u + '.', tag: 'Descarga', nuevo: null };
  if (w == null) return { t: 'Peso sin anotar', d: 'Anota el peso para poder seguir tu progreso.', tag: '—', nuevo: null };
  const trial = estadoEj && estadoEj.trial;
  if (trial && trial.to === w && trial.u === u) {
    if (minOk(r, e.sets, e.lo)) return { t: w + ' ' + u + ' es tu nuevo peso', d: 'Llegaste al mínimo en todas las series. Ahora sumas repeticiones con este peso.', tag: 'Nuevo peso ' + w + ' ' + u, good: true, nuevo: { w, u, trial: null } };
    return { t: 'La próxima vuelves a ' + trial.from + ' ' + u, d: 'No llegaste a ' + e.lo + ' en todas. Sin problema: lo intentamos más adelante.', tag: 'Vuelve a ' + trial.from + ' ' + u, nuevo: { w: trial.from, u, trial: null } };
  }
  const previas = historial.filter(h => !h.descarga && h.w === w && h.u === u);
  const ultima = previas[previas.length - 1];
  if (top(r, e.sets, e.hi)) {
    if (ultima && top(ultima.reps || [], e.sets, e.hi)) {
      const to = siguientePeso(e, w, u);
      return { t: 'La próxima pruebas ' + to + ' ' + u, d: '2 sesiones seguidas en el máximo. Subimos un poco, a ver qué tal.', tag: 'Prueba ' + to + ' ' + u, good: true, nuevo: { w: to, u, trial: { from: w, to, u } } };
    }
    return { t: '1 de 2 sesiones en el máximo', d: 'Si la próxima también haces ' + e.sets + ' × ' + e.hi + ', pruebas ' + siguientePeso(e, w, u) + ' ' + u + '.', tag: '1 de 2', nuevo: { w, u, trial: null } };
  }
  const tres = previas.slice(-2);
  const suma = x => (x.reps || []).slice(0, e.sets).reduce((a, b) => a + b, 0);
  if (tres.length === 2 && suma(entrada) <= suma(tres[0])) {
    return { t: 'Tope: 3 sesiones sin progresar', d: 'Mantén ' + w + ' ' + u + '. Primero busca más repeticiones con bajada de 3 segundos; si sigue igual, cambiamos de variante en el próximo ciclo.', tag: 'Tope', nuevo: { w, u, trial: null } };
  }
  return { t: 'Mantén ' + w + ' ' + u, d: 'Busca 1 repetición más la próxima sesión.', tag: 'Mantén ' + w + ' ' + u, nuevo: { w, u, trial: null } };
}

// Mensaje antes de empezar el ejercicio
export function aviso(k, estadoEj, historial, info) {
  const e = EJ[k];
  if (e.carga === 'tiempo') return { t: 'Opcional', d: 'Hazlo solo si te alivia la espalda.' };
  if (info && info.descarga) return { t: 'Semana de descarga', d: 'La mitad de las series, 10 % menos de peso y RIR 3–4: termina cada serie con 3 o 4 repeticiones de sobra.' };
  if (!estadoEj || estadoEj.w == null) return { t: info && info.buscarPesos ? 'Encuentra tu peso' : 'Anota tu peso', d: 'Elige un peso con el que llegues a ' + e.hi + ' repeticiones dejando 2 o 3 de sobra. Toca el peso para cambiarlo.' };
  if (estadoEj.trial) return { t: 'Hoy pruebas ' + estadoEj.trial.to + ' ' + estadoEj.trial.u, d: 'Las últimas 2 sesiones llegaste al máximo con ' + estadoEj.trial.from + ' ' + estadoEj.trial.u + '. Si no llegas a ' + e.lo + ' en todas, vuelves a ' + estadoEj.trial.from + '.' };
  const previas = historial.filter(h => !h.descarga && h.w === estadoEj.w && h.u === estadoEj.u);
  const ultima = previas[previas.length - 1];
  if (ultima && top(ultima.reps || [], e.sets, e.hi)) return { t: 'Peso fijo · 1 de 2 en el máximo', d: 'Si hoy repites ' + e.sets + ' × ' + e.hi + ', la próxima pruebas ' + siguientePeso(e, estadoEj.w, estadoEj.u) + ' ' + estadoEj.u + '.' };
  if (ultima) return { t: 'Peso fijo', d: 'Busca 1 repetición más que la vez pasada (' + (ultima.reps || []).join(' · ') + ').' };
  return { t: 'Peso fijo', d: 'Completa tus series y anota las repeticiones.' };
}

// ---------- semana: faltas y reacomodo ----------
// sesiones: [{fecha, dia, terminada}] · decisiones: {semanaKey: {dia: 'seguir'|'mover'}}
// desde: fecha (YYYY-MM-DD) en que empezaste a usar la app; los días anteriores no cuentan como faltas
export function planSemana(hoy, sesiones, decisiones, desde) {
  const lunes = lunesDe(hoy); const wk = iso(lunes); const dec = (decisiones && decisiones[wk]) || {};
  const hechos = new Set(sesiones.filter(s => s.terminada && s.fecha >= wk && s.fecha <= iso(addDays(lunes, 6))).map(s => s.dia));
  const hoyWd = weekday(hoy);
  const movidos = {}; // wd destino -> dia
  Object.keys(dec).forEach(dia => { if (dec[dia] === 'mover') { const dest = destino(DIAS[dia].wd); if (dest) movidos[dest] = dia; } });
  const faltas = [];
  SEMANA.forEach(s => {
    if (!s.key || s.wd >= hoyWd) return;
    if (desde && iso(addDays(lunes, s.wd - 1)) < desde) return;
    if (hechos.has(s.key) || dec[s.key]) return;
    faltas.push(s.key);
  });
  faltas.sort((a, b) => PRIORIDAD.indexOf(a) - PRIORIDAD.indexOf(b));
  const dias = SEMANA.map(s => {
    const fecha = iso(addDays(lunes, s.wd - 1));
    let dia = s.key; let movido = false;
    if (!dia && movidos[s.wd]) { dia = movidos[s.wd]; movido = true; }
    let estado = 'falta';
    if (dia && hechos.has(dia) && (movido || !(dec[dia] === 'mover'))) estado = 'hecho';
    else if (s.key && dec[s.key] === 'seguir') estado = 'saltado';
    else if (s.key && dec[s.key] === 'mover') estado = 'movido';
    else if (s.key && s.wd < hoyWd && desde && fecha < desde) estado = 'antes';
    else if (s.key && s.wd < hoyWd) estado = 'faltaste';
    else if (!dia) estado = 'descanso';
    if (s.wd === hoyWd && estado === 'falta') estado = 'hoy';
    return { wd: s.wd, fecha, dia, movido, estado, d: s.key ? DIAS[s.key].d : s.d, esHoy: s.wd === hoyWd };
  });
  return { semanaKey: wk, faltas, dias };
}
// Lunes–miércoles se recupera el jueves. El domingo es SIEMPRE descanso: viernes y sábado no se mueven.
export function destino(wd) { if (wd <= 3) return 4; return null; }
export function puedeMover(hoy, dia, decisiones) {
  const wk = iso(lunesDe(hoy)); const dec = (decisiones && decisiones[wk]) || {};
  const dest = destino(DIAS[dia].wd); if (!dest) return false;
  if (dest < weekday(hoy)) return false;
  return !Object.keys(dec).some(k => dec[k] === 'mover' && destino(DIAS[k].wd) === dest);
}

// ---------- flujo dentro del día ----------
export function hecho(k, ses, sets) { const x = ses.ex[k]; return !!(x && (x.skip || (x.reps || []).length >= sets)); }
export function pasoHecho(paso, ses, setsDe) { return paso.ex.every(k => hecho(k, ses, setsDe(k))); }
export function activo(paso, ses, turno, setsDe) {
  if (paso.ex.length === 1) return paso.ex[0];
  const k = turno === 'b' ? paso.ex[1] : paso.ex[0];
  if (!hecho(k, ses, setsDe(k))) return k;
  const o = k === paso.ex[0] ? paso.ex[1] : paso.ex[0];
  return hecho(o, ses, setsDe(o)) ? k : o;
}
export function siguienteTurno(paso, ses, k, separado, setsDe) {
  const a = paso.ex[0]; const b = paso.ex[1];
  if (separado) return hecho(a, ses, setsDe(a)) ? 'b' : 'a';
  const o = k === a ? b : a;
  if (!hecho(o, ses, setsDe(o))) return o === a ? 'a' : 'b';
  return k === a ? 'a' : 'b';
}

// ---------------- registro diario ----------------
// Fuerza estimada (fórmula de Epley): sirve para comparar 60 kg × 10 con 65 kg × 8.
export function e1rm(w, u, reps) { if (w == null || !reps) return 0; return aKg(w, u) * (1 + reps / 30); }
export function mejorSerie(en) {
  if (!en || en.w == null || !(en.reps || []).length) return 0;
  return Math.max(...en.reps.map(r => e1rm(en.w, en.u, r)));
}
// ¿Esta entrada supera todo lo anterior? (con historial previo; la primera vez no cuenta como récord)
export function esRecord(en, historial) {
  if (!en || en.skip || en.swap || en.w == null) return false;
  const prev = (historial || []).filter(h => !h.descarga).map(mejorSerie).filter(x => x > 0);
  if (!prev.length) return false;
  return mejorSerie(en) > Math.max(...prev) + 0.01;
}
// Kilos movidos en una entrada (peso × repeticiones de cada serie)
export function volumen(en) { if (!en || en.skip || en.w == null) return 0; return Math.round(aKg(en.w, en.u) * (en.reps || []).reduce((a, b) => a + b, 0)); }
export function resumenSesion(ses) {
  const ex = Object.entries((ses && ses.datos && ses.datos.ex) || {});
  const hechos = ex.filter(([, en]) => !en.skip && (en.reps || []).length);
  const t0 = ses && ses.datos && ses.datos.t0, t1 = ses && ses.datos && ses.datos.t1;
  return {
    ejercicios: hechos.length,
    series: hechos.reduce((a, [, en]) => a + en.reps.length, 0),
    volumen: hechos.reduce((a, [, en]) => a + volumen(en), 0),
    records: hechos.filter(([, en]) => en.pr).map(([k]) => k),
    minutos: t0 && t1 && t1 > t0 ? Math.round((t1 - t0) / 60000) : null
  };
}
// Días seguidos de semanas cumplidas no: racha = semanas consecutivas (hasta la actual) con al menos 1 sesión
export function rachaSemanas(hoy, sesiones) {
  const sem = new Set((sesiones || []).filter(s => s.datos && Object.values(s.datos.ex || {}).some(e => (e.reps || []).length)).map(s => iso(lunesDe(parseIso(s.fecha)))));
  let l = lunesDe(hoy); let n = 0;
  if (!sem.has(iso(l))) l = addDays(l, -7);
  while (sem.has(iso(l))) { n++; l = addDays(l, -7); }
  return n;
}
