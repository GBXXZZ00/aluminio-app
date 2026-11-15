import * as L from './logic.js?v=2';
import * as API from './api.js?v=2';

const store = globalThis.localStorage;
const $app = () => document.getElementById('app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const fechaLarga = d => d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');

// ---------------- estado ----------------
const S = {
  clave: null, perfil: { ex: {}, decisiones: {} }, sesiones: [], medidas: [],
  pantalla: 'cargando', loginModo: null, loginError: '',
  sel: null, vista: 'entreno', abiertas: { cal: false },
  run: null, hoja: null, hojaData: null, progEj: null, aviso: '', online: true
};
export const _S = S; // para pruebas
let ahora = () => new Date();
export function _setAhora(fn) { ahora = fn; }

function cache() { try { store.setItem('gym_cache', JSON.stringify({ perfil: S.perfil, sesiones: S.sesiones, medidas: S.medidas })); } catch (e) {} }
function leerCache() { try { const c = JSON.parse(store.getItem('gym_cache') || 'null'); if (c) { S.perfil = Object.assign({ ex: {}, decisiones: {} }, c.perfil); S.sesiones = c.sesiones || []; S.medidas = c.medidas || []; } } catch (e) {} }

function hoy() { const d = ahora(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function info() { return L.infoSemana(hoy(), S.perfil.inicio); }
function plan() { return L.planSemana(hoy(), S.sesiones, S.perfil.decisiones, S.perfil.creado || null); }
function diaDeHoy() { const f = L.iso(hoy()); const elegida = S.sesiones.find(s => s.fecha === f && s.datos && s.datos.elegida); if (elegida) return elegida.dia; const p = plan(); return p.dias.find(x => x.esHoy).dia; }
function sesionDe(fecha, dia) { return S.sesiones.find(s => s.fecha === fecha && s.dia === dia); }
function sesionHoy(crear, forzarDia) {
  const dia = forzarDia || diaDeHoy(); if (!dia) return null;
  const f = L.iso(hoy()); let s = sesionDe(f, dia);
  if (!s && crear) {
    const i = info();
    s = { fecha: f, dia, ciclo: i.ciclo, semana: i.semana, terminada: false, nota: '', datos: { ex: {}, sep: {}, orden: L.RUTINA[dia].map((_, j) => j), descarga: i.descarga, elegida: !!forzarDia } };
    S.sesiones.unshift(s);
  }
  return s;
}
function setsDe(k, ses) { return L.seriesDe(L.EJ[k], ses && ses.datos.descarga); }
function historial(k, excluir) {
  return S.sesiones.filter(s => s !== excluir && s.datos && s.datos.ex && s.datos.ex[k]).slice().sort((a, b) => a.fecha < b.fecha ? -1 : 1)
    .map(s => Object.assign({ descarga: !!s.datos.descarga }, s.datos.ex[k])).filter(x => !x.skip && !x.swap && (x.reps || []).length);
}
function estadoEj(k) { return S.perfil.ex[k] || null; }
function entrada(ses, k) {
  if (!ses.datos.ex[k]) {
    const e = L.EJ[k]; const st = estadoEj(k);
    let w = st && st.w != null ? st.w : null; const u = (st && st.u) || e.u;
    if (ses.datos.descarga && w != null && e.carga !== 'tiempo') w = L.pesoDescarga(e, w, u);
    ses.datos.ex[k] = { w: e.carga === 'tiempo' ? null : w, u, reps: [] };
  }
  return ses.datos.ex[k];
}

// ---------------- guardar ----------------
let tGuardar = null;
function guardarSesion(ses) {
  cache();
  API.encolar(store, 'ses|' + ses.fecha + '|' + ses.dia, 'gym_guardar_sesion', { p_fecha: ses.fecha, p_dia: ses.dia, p_ciclo: ses.ciclo, p_semana: ses.semana, p_datos: ses.datos, p_nota: ses.nota || null, p_terminada: !!ses.terminada });
  programarEnvio();
}
function guardarPerfil() { cache(); API.encolar(store, 'perfil', 'gym_guardar_perfil', { p_datos: S.perfil }); programarEnvio(); }
function programarEnvio() { clearTimeout(tGuardar); tGuardar = setTimeout(enviarAhora, 600); }
export async function enviarAhora() {
  if (!S.clave) return;
  const r = await API.enviar(store, S.clave);
  S.online = !r.red;
  const b = document.getElementById('sync'); if (b) b.textContent = syncTexto();
}
function syncTexto() { const n = API.pendientes(store); return n ? (S.online ? 'Guardando…' : 'Sin internet · se guarda al volver') : ''; }
API.onClaveInvalida(err => { S.clave = null; try { store.removeItem('gym_clave'); } catch (e) {} S.pantalla = 'login'; S.loginModo = 'entrar'; S.loginError = err === 'bloqueado' ? 'Demasiados intentos. Espera 15 minutos.' : 'Tu clave cambió o no es válida. Vuelve a entrar.'; render(); });

// ---------------- arranque ----------------
export async function iniciar() {
  leerCache();
  S.clave = store.getItem('gym_clave');
  if (S.clave) { S.pantalla = 'inicio'; render(); refrescar(); }
  else { S.pantalla = 'cargando'; render(); await revisarLogin(); }
  setInterval(tick, 250);
  globalThis.addEventListener && globalThis.addEventListener('online', () => { S.online = true; enviarAhora(); });
}
async function revisarLogin() {
  try { const r = await API.rpc('gym_estado', { p_clave: '' }); S.loginModo = r.error === 'sin_clave' ? 'crear' : 'entrar'; }
  catch (e) { S.loginModo = 'entrar'; S.loginError = 'Sin conexión. Conéctate a internet para entrar la primera vez.'; }
  S.pantalla = 'login'; render();
}
async function refrescar() {
  try {
    await API.enviar(store, S.clave);
    const r = await API.rpc('gym_estado', { p_clave: S.clave });
    if (!r.ok) {
      try { store.removeItem('gym_clave'); } catch (e) {}
      S.clave = null; S.pantalla = 'login'; S.loginModo = r.error === 'sin_clave' ? 'crear' : 'entrar';
      S.loginError = r.error === 'bloqueado' ? 'Demasiados intentos. Espera 15 minutos.' : 'Vuelve a escribir tu clave.';
      render(); return;
    }
    if (API.pendientes(store) === 0) {
      S.perfil = Object.assign({ ex: {}, decisiones: {} }, r.perfil || {});
      const locales = S.sesiones.filter(s => s.fecha === L.iso(hoy()));
      S.sesiones = (r.sesiones || []).map(s => Object.assign({}, s, { datos: Object.assign({ ex: {}, sep: {} }, s.datos) }));
      locales.forEach(l => { if (!sesionDe(l.fecha, l.dia)) S.sesiones.unshift(l); });
      S.medidas = r.medidas || [];
    }
    if (!S.perfil.creado) {
      S.perfil.creado = L.iso(hoy());
      // Si aún no hay entrenamientos terminados, el ciclo arranca desde el lunes correcto
      if (!S.perfil.inicio || !S.sesiones.some(s => s.terminada)) S.perfil.inicio = L.iso(L.inicioCiclo(hoy()));
      guardarPerfil();
    }
    S.online = true; cache();
    if (S.pantalla === 'inicio' || S.pantalla === 'progreso' || S.pantalla === 'cuerpo') render();
  } catch (e) { S.online = false; render(); }
}

// ---------------- temporizador ----------------
function tick() {
  const r = S.run; if (!r || !r.rest) return;
  const left = (r.rest.until - Date.now()) / 1000;
  if (left <= 0) {
    r.rest = null;
    try { navigator.vibrate && navigator.vibrate([250, 120, 250]); } catch (e) {}
    beep();
    if (S.pantalla === 'ejercicio') render();
    return;
  }
  const el = document.getElementById('rest-t'); if (el) el.textContent = fmt(left);
  const ring = document.getElementById('rest-ring'); if (ring) { const fr = left / r.rest.total; ring.setAttribute('stroke-dashoffset', String(276.46 * (1 - fr))); }
}
let actx = null;
function beep() { try { actx = actx || new (globalThis.AudioContext || globalThis.webkitAudioContext)(); const o = actx.createOscillator(); const g = actx.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.25); } catch (e) {} }
let wake = null;
async function despierto(on) { try { if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); if (!on && wake) { await wake.release(); wake = null; } } catch (e) {} }

// ---------------- render ----------------
export function render() {
  const p = S.pantalla; let html = '';
  if (p === 'cargando') html = `<div class="centro"><div class="marca">ENTRENADOR</div><p class="sub">Cargando…</p></div>`;
  else if (p === 'login') html = vLogin();
  else if (p === 'inicio') html = vInicio() + nav('inicio');
  else if (p === 'ejercicio') html = vEjercicio();
  else if (p === 'listo') html = vListo();
  else if (p === 'resumen') html = vResumen();
  else if (p === 'progreso') html = vProgreso() + nav('progreso');
  else if (p === 'cuerpo') html = vCuerpo() + nav('cuerpo');
  else if (p === 'ajustes') html = vAjustes() + nav('ajustes');
  if (S.hoja) html += vHoja();
  $app().innerHTML = html;
  const dcSel = document.querySelector('.dcard.sel'); if (dcSel && dcSel.parentElement) { try { dcSel.parentElement.scrollLeft = Math.max(0, dcSel.offsetLeft - 20); } catch (e) {} }
  despierto(p === 'ejercicio');
}

function nav(act) {
  const it = [['inicio', 'Hoy', 'M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['progreso', 'Progreso', 'M4 19l5-6 4 3 7-9'], ['cuerpo', 'Mi cuerpo', 'M12 4a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM5 21c1-4 4-6 7-6s6 2 7 6'], ['ajustes', 'Ajustes', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z']];
  return `<nav class="nav">${it.map(([k, t, d]) => `<button class="navb${k === act ? ' on' : ''}" data-a="ir" data-x="${k}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${t}</button>`).join('')}</nav>`;
}

function vLogin() {
  const crear = S.loginModo === 'crear';
  return `<div class="login">
  <div class="marca">ENTRENADOR</div>
  <p class="sub">${crear ? 'Crea tu clave personal. Con ella entras desde cualquier teléfono y nadie más ve tus datos.' : 'Escribe tu clave personal.'}</p>
  <label class="lbl" for="c1">CLAVE</label>
  <input id="c1" class="inp" type="password" autocomplete="${crear ? 'new-password' : 'current-password'}" minlength="6" placeholder="Mínimo 6 caracteres">
  ${crear ? `<label class="lbl" for="c2">REPITE LA CLAVE</label><input id="c2" class="inp" type="password" autocomplete="new-password">` : ''}
  ${S.loginError ? `<p class="err" role="alert">${esc(S.loginError)}</p>` : ''}
  <button class="cta" data-a="${crear ? 'crearClave' : 'entrar'}">${crear ? 'CREAR Y ENTRAR' : 'ENTRAR'}</button>
  ${crear ? '<p class="nota">Guárdala bien: si la olvidas no se puede recuperar desde la app.</p>' : ''}
</div>`;
}

const SEC_T = { cal: 'CALENTAMIENTO', principal: 'BLOQUE PRINCIPAL', ss: 'SUPERSERIES', final: 'FINAL' };
function bloques(dia) {
  const out = []; L.RUTINA[dia].forEach((p, j) => { const last = out[out.length - 1]; if (last && last.sec === p.sec) last.pasos.push(j); else out.push({ sec: p.sec, pasos: [j] }); });
  return out;
}
function vInicio() {
  const pl = plan(); const i = info(); const hoyWd = L.weekday(hoy());
  if (S.sel == null) S.sel = hoyWd;
  const sd = pl.dias.find(x => x.wd === S.sel); const esHoy = S.sel === hoyWd;
  const dSel = esHoy ? diaDeHoy() : sd.dia;
  const ses = dSel ? sesionDe(sd.fecha, dSel) : null;
  const total = dSel ? L.RUTINA[dSel].length : 0;
  const hechosN = dSel && ses ? L.RUTINA[dSel].filter(p => L.pasoHecho(p, ses.datos, k => setsDe(k, ses))).length : 0;
  const tarjetas = pl.dias.map(x => {
    const meta = { antes: '—', hecho: 'HECHO', faltaste: 'FALTASTE', saltado: 'SALTADO', movido: 'MOVIDO', descanso: 'DESCANSO', hoy: (x.esHoy && diaDeHoy()) ? L.RUTINA[diaDeHoy()].reduce((a, p) => a + p.ex.length, 0) + ' EJ' : x.dia ? L.RUTINA[x.dia].reduce((a, p) => a + p.ex.length, 0) + ' EJ' : '', falta: x.dia ? L.RUTINA[x.dia].reduce((a, p) => a + p.ex.length, 0) + ' EJ' : '' }[x.estado];
    const xd = x.esHoy ? (diaDeHoy() || x.dia) : x.dia; const nombre = xd ? L.DIAS[xd].nombre : 'Descanso';
    return `<button class="dcard${x.wd === S.sel ? ' sel' : ''}${x.esHoy ? ' hoy' : ''} st-${x.estado}" data-a="dia" data-x="${x.wd}" aria-label="${esc(x.d + ', ' + nombre + ', ' + meta)}">
      <span class="dc-d">${esc(x.d.toUpperCase())}${x.movido ? ' · MOVIDO' : ''}</span><span class="dc-n">${esc(nombre.toUpperCase())}</span><span class="dc-m">${esc(meta)}</span></button>`;
  }).join('');
  const avisos = [];
  if (esHoy) {
    if (i.descarga) avisos.push(['SEMANA DE DESCARGA', 'La mitad de las series, 10 % menos de peso y RIR 3–4. Ya está calculado en cada ejercicio.']);
    else if (i.avisoDescarga) avisos.push(['LA PRÓXIMA SEMANA ES DE DESCARGA', 'Esta semana intenta superar tus pesos. Después tu cuerpo se recupera.']);
    if (i.buscarPesos) avisos.push(['SEMANAS 1 Y 2: ENCUENTRA TUS PESOS', 'Usa RIR 2–3: termina cada serie con 2 o 3 repeticiones de sobra. Toca el peso de cada ejercicio para anotarlo.']);
    if (hoyWd === 1 && !i.buscarPesos) avisos.push(['ES LUNES', 'La semana empieza con la rutina principal, aunque la pasada hayas faltado.']);
    if (dSel && !i.descarga) L.RUTINA[dSel].forEach(p => p.ex.forEach(k => { const st = estadoEj(k); if (st && st.trial) avisos.push(['HOY PRUEBAS SUBIR', L.EJ[k].n + ': ' + st.trial.from + ' → ' + st.trial.to + ' ' + st.trial.u + '. A ver qué tal.']); }));
  }
  const falta = esHoy && pl.faltas.length ? pl.faltas[0] : null;
  const puede = falta && L.puedeMover(hoy(), falta, S.perfil.decisiones);
  const dest = falta ? L.destino(L.DIAS[falta].wd) : null;
  let cuerpo = '';
  if (!dSel || (esHoy && S.vista === 'descanso')) {
    cuerpo = `<div class="card descanso"><div class="h2">DESCANSO</div><p class="sub">${!dSel ? (sd.wd === 4 ? 'Opcional: caminata suave de 20–30 min.' : 'Descanso total. Duerme bien y come suficiente proteína.') : 'Hoy descansas. Mañana te pregunto si reacomodamos la semana para no perder este entrenamiento.'}</p></div>`;
  } else {
    const secs = [];
    const calOpen = !!S.abiertas.cal;
    secs.push(`<section class="sec"><button class="sec-h" data-a="toggle" data-x="cal" aria-expanded="${calOpen}"><span class="bar b-cal"></span><span class="sec-t">CALENTAMIENTO · ${L.CALENTAMIENTO.length}</span><span class="chev${calOpen ? ' up' : ''}"></span></button>
      ${calOpen ? `<div class="sec-b">${L.CALENTAMIENTO.map(c => `<div class="item"><div><div class="it-n">${esc(c.n)}</div><div class="it-d">${esc(c.d)}</div></div></div>`).join('')}</div>` : ''}</section>`);
    const primerPend = ses ? (ses.datos.orden || []).find(j => !L.pasoHecho(L.RUTINA[dSel][j], ses.datos, k => setsDe(k, ses))) : 0;
    bloques(dSel).forEach((b, bi) => {
      const key = b.sec + bi; const open = S.abiertas[key] !== false;
      const n = b.pasos.reduce((a, j) => a + L.RUTINA[dSel][j].ex.length, 0);
      const items = b.pasos.map(j => {
        const p = L.RUTINA[dSel][j]; const done = ses && L.pasoHecho(p, ses.datos, k => setsDe(k, ses)); const now = esHoy && !done && j === primerPend;
        const lines = p.ex.map((k, xi) => { const e = L.EJ[k]; const st = estadoEj(k); const sets = L.seriesDe(e, esHoy && i.descarga); const w = st && st.w != null && e.carga !== 'tiempo' ? ' · ' + (esHoy && i.descarga ? L.pesoDescarga(e, st.w, st.u) : st.w) + ' ' + st.u : '';
          return `<div class="it-n">${p.ex.length > 1 ? (xi === 0 ? 'A1 · ' : 'A2 · ') : ''}${esc(nombreEj(k, ses))}</div><div class="it-d">${sets} × ${e.lo}–${e.hi}${e.carga === 'tiempo' ? ' s' : ''}${e.porPierna ? ' por pierna' : ''}${w}</div>`; }).join('');
        return `<div class="item"><div>${p.label ? `<div class="ss-tag">SUPERSERIE ${p.label}</div>` : ''}${lines}</div><span class="st ${done ? 'ok' : now ? 'now' : ''}">${done ? 'HECHO' : now ? 'AHORA' : 'FALTA'}</span></div>`;
      }).join('');
      secs.push(`<section class="sec"><button class="sec-h" data-a="toggle" data-x="${key}" aria-expanded="${open}"><span class="bar b-${b.sec}"></span><span class="sec-t">${SEC_T[b.sec]} · ${n}</span><span class="chev${open ? ' up' : ''}"></span></button>${open ? `<div class="sec-b">${items}</div>` : ''}</section>`);
    });
    cuerpo = secs.join('');
  }
  const nota = esHoy && dSel && S.vista === 'entreno' ? `<label class="lbl" for="nota">NOTA DEL DÍA</label><textarea id="nota" class="nota-in" rows="2" placeholder="Cómo te sentiste, qué cambiaste…">${esc(ses ? ses.nota : '')}</textarea>` : '';
  let cta = '';
  const allDone = dSel && ses && hechosN === total;
  const hoyEmpezado = (() => { const f = L.iso(hoy()); return S.sesiones.some(s => s.fecha === f && s.datos && Object.values(s.datos.ex || {}).some(x => (x.reps || []).length || x.skip)); })();
  if (!esHoy) cta = dSel && pl.dias.find(x => x.wd === S.sel).estado !== 'hecho' && !hoyEmpezado
    ? `<button class="cta" data-a="hacerHoy" data-x="${dSel}">HACER ESTA RUTINA HOY</button>`
    : `<button class="cta" data-a="dia" data-x="${hoyWd}">VOLVER A HOY</button>`;
  else if (!dSel) cta = `<button class="cta" data-a="hoja" data-x="elegir">ENTRENAR DE TODAS FORMAS</button>`;
  else if (S.vista === 'descanso') cta = '';
  else if (allDone) cta = `<button class="cta" data-a="ir" data-x="resumen">VER RESUMEN DEL DÍA</button>`;
  else cta = `<button class="cta" data-a="empezar">${hechosN || (ses && Object.keys(ses.datos.ex).length) ? 'SEGUIR LA RUTINA' : 'INICIAR RUTINA'}</button>`;
  const segs = total ? Array.from({ length: total }, (_, j) => `<span class="pseg${ses && L.pasoHecho(L.RUTINA[dSel][j], ses.datos, k => setsDe(k, ses)) ? ' on' : ''}"></span>`).join('') : '';
  return `<div class="pant">
  <header class="top">
    <div class="progreso-top">${segs}</div>
    <div class="top-row"><div><div class="mini">CICLO ${i.ciclo} · SEMANA ${i.semana} DE 6${i.descarga ? ' · DESCARGA' : ''}</div><h1 class="h1">${esc(esHoy ? 'HOY' : sd.d.toUpperCase())} · ${esc(dSel ? L.DIAS[dSel].nombre.toUpperCase() : 'DESCANSO')}</h1></div><span id="sync" class="sync">${esc(syncTexto())}</span></div>
  </header>
  <div class="mini pad">DÍAS · 5</div>
  <div class="dias">${tarjetas}</div>
  ${esHoy && dSel ? `<div class="pill2 pad"><button class="${S.vista === 'entreno' ? 'on' : ''}" data-a="vista" data-x="entreno">ENTRENO</button><button class="${S.vista === 'descanso' ? 'on' : ''}" data-a="vista" data-x="descanso">DESCANSO</button></div>` : ''}
  ${falta ? `<div class="card pregunta"><div class="h3">FALTASTE EL ${esc(L.NOMBRE_DIA[L.DIAS[falta].wd].toUpperCase())} (${esc(L.DIAS[falta].nombre.toUpperCase())}). ¿QUÉ HACEMOS?</div>
    <button class="opt" data-a="falta" data-x="seguir" data-y="${falta}"><b>Seguir con la rutina</b><span>${esc(L.DIAS[falta].nombre)} se salta esta semana.</span></button>
    ${puede ? `<button class="opt" data-a="falta" data-x="mover" data-y="${falta}"><b>Reacomodar la semana</b><span>${esc(L.DIAS[falta].nombre)} pasa al ${L.NOMBRE_DIA[dest]}, tu día libre.</span></button>` : `<p class="nota">El ${L.NOMBRE_DIA[dest] || 'día libre'} ya está ocupado o pasó: no se puede mover.</p>`}</div>` : ''}
  ${avisos.map(a => `<div class="card aviso"><div class="h3">${esc(a[0])}</div><p class="sub">${esc(a[1])}</p></div>`).join('')}
  ${nota}
  ${cuerpo}
  <div class="espacio"></div>
</div>${cta ? `<div class="pie">${cta}</div>` : ''}`;
}

// ---------------- ejercicio ----------------
function runPaso() { const r = S.run; const ses = sesionDe(r.fecha, r.dia); return { r, ses, paso: L.RUTINA[r.dia][ses.datos.orden[r.pos]], idx: ses.datos.orden[r.pos] }; }
function vEjercicio() {
  const { r, ses, paso, idx } = runPaso(); const sets = k => setsDe(k, ses);
  const k = L.activo(paso, ses.datos, r.turno, sets); const e = L.EJ[k]; const en = entrada(ses, k);
  const esSS = paso.ex.length > 1; const sep = !!ses.datos.sep[idx];
  const orden = ses.datos.orden; const pend = orden.filter(j => !L.pasoHecho(L.RUTINA[r.dia][j], ses.datos, sets)).length;
  const after = pend - (L.pasoHecho(paso, ses.datos, sets) ? 0 : 1);
  const segs = orden.map((j, p) => `<span class="pseg${L.pasoHecho(L.RUTINA[r.dia][j], ses.datos, sets) ? ' on' : p === r.pos ? ' cur' : ''}"></span>`).join('');
  const cards = paso.ex.map(kk => tarjetaEj(kk, ses, kk === k, esSS, idx, paso)).join('');
  const av = en.swap ? { t: 'Ejercicio cambiado', d: 'Anota el peso que uses: se guarda aparte y no cambia tu progreso de ' + e.n + '.' } : L.aviso(k, estadoEj(k), historial(k, ses), info());
  const rest = r.rest; const restLeft = rest ? Math.max(0, (rest.until - Date.now()) / 1000) : 0;
  const nSet = Math.min((en.reps || []).length + 1, sets(k));
  const vals = []; if (e.carga === 'tiempo') [15, 20, 25, 30, 35, 40].forEach(v => vals.push(v)); else for (let v = Math.max(1, e.lo - 2); v <= e.hi + 1; v++) vals.push(v);
  const picker = !rest && !L.hecho(k, ses.datos, sets(k)) ? `<div class="pick"><div class="row-b"><span class="h3">${esSS ? esc(nombreEj(k, ses)) + ' · ' : ''}${e.carga === 'tiempo' ? 'SEGUNDOS' : 'REPETICIONES'} EN LA SERIE ${nSet}</span>${(en.reps || []).length ? '<button class="link" data-a="deshacer">Deshacer</button>' : ''}</div>
    <div class="grid6">${vals.map(v => `<button class="num${v >= e.lo && v <= e.hi ? ' rango' : ''}" data-a="rep" data-x="${v}">${v}</button>`).join('')}</div></div>` : '';
  const restHtml = rest ? `<div class="card rest"><div class="ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="44" class="ring-bg"/><circle id="rest-ring" cx="52" cy="52" r="44" class="ring-fg" stroke-dasharray="276.46" stroke-dashoffset="${276.46 * (1 - restLeft / rest.total)}" transform="rotate(-90 52 52)"/></svg><div class="ring-t"><span id="rest-t">${fmt(restLeft)}</span><small>DESCANSO</small></div></div>
    <div class="rest-r"><span class="sub">Luego: <b>${esc(esSS ? nombreEj(k, ses) + ', ' : '')}serie ${nSet} de ${sets(k)}</b></span><div class="row2"><button class="btn2" data-a="mas30">+30 s</button><button class="btn2" data-a="saltarDesc">SALTAR</button></div></div></div>` : '';
  const espera = r.espera && r.espera > Date.now() ? `<div class="card espera"><span>Esperando la máquina · ${fmt((r.espera - Date.now()) / 1000)}</span><button class="btn2" data-a="libre">Ya está libre</button></div>` : '';
  return `<div class="pant ej">
  <header class="top"><div class="progreso-top">${segs}</div><div class="top-row"><span class="mini">${r.pos + 1} DE ${orden.length} · ${after <= 0 ? 'EL ÚLTIMO' : 'FALTAN ' + after}</span><button class="chip" data-a="ir" data-x="inicio">RUTINA</button></div></header>
  ${esSS ? `<div class="row-b pad"><h1 class="h1">SUPERSERIE ${paso.label}</h1><div class="pill2 sm"><button class="${!sep ? 'on' : ''}" data-a="sep" data-x="0">JUNTOS</button><button class="${sep ? 'on' : ''}" data-a="sep" data-x="1">SEPARADO</button></div></div>` : ''}
  ${espera}
  ${cards}
  <div class="card aviso"><div class="h3">${esc(av.t.toUpperCase())}</div><p class="sub">${esc(av.d)}</p></div>
  ${restHtml}${picker}
  <div class="espacio"></div>
</div>
<div class="pie tri"><button class="btn2" data-a="hoja" data-x="como">CÓMO</button><button class="btn2" data-a="hoja" data-x="molesta">ME MOLESTA</button><button class="btn2" data-a="hoja" data-x="ocupada">OCUPADA</button></div>`;
}
function nombreBase(k) { return k === 'abd_sab' && S.perfil.abdMaquina ? 'Abducción en máquina combinada' : L.EJ[k].n; }
function nombreEj(k, ses) { const en = ses && ses.datos.ex[k]; return en && en.swap ? en.swap : nombreBase(k); }
function tarjetaEj(k, ses, act, esSS, idx, paso) {
  const e = L.EJ[k]; const en = entrada(ses, k); const n = setsDe(k, ses);
  const bub = Array.from({ length: n }, (_, j) => { const v = (en.reps || [])[j]; const nx = act && j === (en.reps || []).length && !en.skip; return `<span class="bub${v != null ? ' done' : nx ? ' next' : ''}"><b>${v != null ? v : j + 1}</b><small>${v != null ? (e.carga === 'tiempo' ? 's' : 'reps') : 'serie'}</small></span>`; }).join('');
  const tag = esSS ? `<div class="ss-tag">${k === paso.ex[0] ? 'A1' : 'A2'}${en.skip ? ' · SALTADO' : L.hecho(k, ses.datos, n) ? ' · HECHO' : act ? ' · AHORA' : ''}</div>` : '';
  const st = estadoEj(k); const trial = !esSS && !en.swap && st && st.trial && !ses.datos.descarga;
  const peso = e.carga === 'tiempo' ? '' : `<button class="peso" data-a="hoja" data-x="peso" data-y="${k}" aria-label="Cambiar peso"><span class="w">${en.w == null ? '—' : en.w}<small> ${esc(en.u)}</small></span><span class="conv">${en.w == null ? 'Toca para anotar tu peso' : '≈ ' + L.convertir(en.w, en.u) + (en.u === 'lb' ? ' kg' : ' lb') + (e.carga === 'mancuernas' ? ' · cada mancuerna' : '') + ' · tocar para cambiar'}</span></button>`;
  let barra = '';
  if (!esSS && e.carga === 'discos' && en.w != null && !en.swap) {
    const base = (S.perfil.base || {})[k] || 0; const dp = L.discosPorLado(en.w, base, en.u);
    const pl = dp.discos.map(p => `<span class="disco d${discoClase(p, en.u)}"></span>`).join('');
    barra = `<div class="barra" aria-hidden="true"><span class="eje l"></span><span class="discos rev">${pl}</span><span class="tope"></span><span class="eje c"></span><span class="tope"></span><span class="discos">${pl}</span><span class="eje r"></span></div><div class="conv c">Por lado: ${dp.discos.length ? dp.discos.join(' + ') + ' ' + esc(en.u) : 'sin discos'}${base ? ' · máquina ' + base : ''}</div>`;
  }
  return `<div class="card ejc${esSS ? (act ? ' act' : ' inact') : ''}">${tag}
    ${en.swap ? `<div class="sub">En lugar de ${esc(e.n)}</div>` : ''}
    <div class="row-b"><div class="${esSS ? 'h2' : 'h1'}">${esc(nombreEj(k, ses).toUpperCase())}</div>${trial ? '<span class="badge">PRUEBA</span>' : ''}</div>
    <div class="it-d">${n} × ${e.lo}–${e.hi}${e.carga === 'tiempo' ? ' s' : ''}${e.porPierna ? ' por pierna' : ''} · ${esSS ? 'pausa ' + fmt(ses.datos.sep[idx] ? e.rest : (e.ssRest || e.rest)) : 'descanso ' + fmt(e.rest)} · RIR ${ses.datos.descarga ? '3–4' : e.rir}</div>
    ${peso}${barra}<div class="bubs">${bub}</div></div>`;
}
function discoClase(p, u) { const s = u === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [20, 15, 10, 5, 2.5, 1.25]; return s.indexOf(p); }

function vListo() {
  const { ses, paso } = runPaso();
  const items = paso.ex.map(k => { const en = ses.datos.ex[k] || {}; const d = en.decision || {}; return `<div class="card"><div class="h3">${esc(nombreEj(k, ses).toUpperCase())}</div><div class="it-d">${en.skip ? 'Saltado hoy' : (en.reps || []).length + ' series · ' + (en.w == null ? '' : en.w + ' ' + en.u + ' · ') + (en.reps || []).join(' · ')}</div>${d.t ? `<p class="txt">${esc(d.t)}</p><p class="sub">${esc(d.d)}</p>` : ''}</div>`; }).join('');
  const sig = siguientePos(); const nm = sig >= 0 ? nombrePaso(ses, sig) : '';
  return `<div class="pant listo"><div class="check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></div>
  <h1 class="h1">${paso.ex.length > 1 ? 'SUPERSERIE ' + paso.label + ' HECHA' : esc(nombreEj(paso.ex[0], ses).toUpperCase()) + ' · HECHO'}</h1>${items}
  ${sig >= 0 ? `<div class="card"><div class="mini">SIGUE</div><div class="h2">${esc(nm.toUpperCase())}</div></div>` : ''}<div class="espacio"></div></div>
  <div class="pie"><button class="cta" data-a="siguiente">${sig >= 0 ? 'SIGUIENTE' : (diaCompleto(ses) ? 'VER RESUMEN' : 'VOLVER A LO PENDIENTE')}</button></div>`;
}
function nombrePaso(ses, pos) { const p = L.RUTINA[S.run.dia][ses.datos.orden[pos]]; return p.ex.length > 1 ? 'Superserie ' + p.label : nombreEj(p.ex[0], ses); }
function siguientePos() { const { r, ses } = runPaso(); return ses.datos.orden.findIndex((j, p) => p > r.pos && !L.pasoHecho(L.RUTINA[r.dia][j], ses.datos, k => setsDe(k, ses))); }
function diaCompleto(ses) { return L.RUTINA[ses.dia].every(p => L.pasoHecho(p, ses.datos, k => setsDe(k, ses))); }

function vResumen() {
  const ses = sesionHoy(false) || (S.run && sesionDe(S.run.fecha, S.run.dia)); if (!ses) { S.pantalla = 'inicio'; return vInicio(); }
  const keys = []; L.RUTINA[ses.dia].forEach(p => p.ex.forEach(k => keys.push(k)));
  const series = keys.reduce((a, k) => a + Math.min(((ses.datos.ex[k] || {}).reps || []).length, setsDe(k, ses)), 0);
  const rows = keys.map(k => { const en = ses.datos.ex[k] || {}; const d = en.decision || {}; return `<div class="item"><div class="it-n">${esc(nombreEj(k, ses))}</div><span class="st ${d.good ? 'ok' : ''}">${esc(en.skip ? 'Saltado' : d.tag || '—')}</span></div>`; }).join('');
  return `<div class="pant"><header class="top"><div class="mini ok-t">DÍA TERMINADO</div><h1 class="h1">${esc(L.DIAS[ses.dia].nombre.toUpperCase())}</h1></header>
  <div class="stats"><div class="card"><div class="mini">EJERCICIOS</div><div class="big">${keys.filter(k => L.hecho(k, ses.datos, setsDe(k, ses))).length}/${keys.length}</div></div><div class="card"><div class="mini">SERIES</div><div class="big">${series}</div></div></div>
  <section class="sec"><div class="sec-h"><span class="bar b-principal"></span><span class="sec-t">PRÓXIMA SESIÓN</span></div><div class="sec-b">${rows}</div></section>
  <div class="espacio"></div></div><div class="pie"><button class="cta" data-a="ir" data-x="inicio">VOLVER AL INICIO</button></div>`;
}

// ---------------- progreso, cuerpo, ajustes ----------------
function vProgreso() {
  const conDatos = Object.keys(L.EJ).filter(k => L.EJ[k].carga !== 'tiempo' && historial(k).some(h => h.w != null));
  const k = S.progEj && conDatos.includes(S.progEj) ? S.progEj : conDatos[0];
  let graf = '<p class="sub pad">Cuando termines tus primeras sesiones, aquí verás cómo sube cada peso.</p>';
  if (k) {
    const h = historial(k).filter(x => x.w != null && !x.descarga).slice(-12);
    const ws = h.map(x => L.aKg(x.w, x.u)); const min = Math.min(...ws); const max = Math.max(...ws); const W = 330, H = 140;
    const xs = i => 16 + (h.length === 1 ? (W - 32) / 2 : i * (W - 32) / (h.length - 1)); const ys = v => max === min ? H / 2 : 16 + (H - 32) * (1 - (v - min) / (max - min));
    const pts = h.map((x, i) => `${xs(i).toFixed(1)},${ys(ws[i]).toFixed(1)}`).join(' ');
    const ult = h[h.length - 1]; const pri = h[0];
    graf = `<div class="card"><div class="row-b"><div><div class="mini">PESO ACTUAL</div><div class="big">${ult.w} <small>${esc(ult.u)}</small></div></div><span class="badge ${ult.w > pri.w ? 'ok' : ''}">${ult.w > pri.w ? '+' + Math.round((ult.w - pri.w) * 100) / 100 + ' ' + esc(ult.u) : 'Sin cambio'}</span></div>
      <svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso de ${esc(L.EJ[k].n)} por sesión"><polyline points="${pts}"/>${h.map((x, i) => `<circle cx="${xs(i).toFixed(1)}" cy="${ys(ws[i]).toFixed(1)}" r="4"/>`).join('')}</svg>
      <div class="hist">${h.slice().reverse().slice(0, 6).map(x => `<div class="item"><span>${esc(x.w + ' ' + x.u)}</span><span class="it-d">${esc((x.reps || []).join(' · '))}</span></div>`).join('')}</div></div>`;
  }
  return `<div class="pant"><header class="top"><h1 class="h1">PROGRESO</h1></header>
  ${conDatos.length ? `<div class="chips pad">${conDatos.map(x => `<button class="chip${x === k ? ' on' : ''}" data-a="progEj" data-x="${x}">${esc(L.EJ[x].n)}</button>`).join('')}</div>` : ''}${graf}<div class="espacio"></div></div>`;
}
function vCuerpo() {
  const m = S.medidas;
  return `<div class="pant"><header class="top"><div class="mini">OPCIONAL · SOLO CUANDO QUIERAS</div><h1 class="h1">MI CUERPO</h1></header>
  <div class="card"><div class="grid2">
    <label><span class="lbl">PESO (KG)</span><input id="m-peso" class="inp" inputmode="decimal"></label>
    <label><span class="lbl">CADERA (CM)</span><input id="m-cadera" class="inp" inputmode="decimal"></label>
    <label><span class="lbl">CINTURA (CM)</span><input id="m-cintura" class="inp" inputmode="decimal"></label>
    <label><span class="lbl">MUSLO (CM)</span><input id="m-muslo" class="inp" inputmode="decimal"></label></div>
    <button class="cta sm" data-a="medida">GUARDAR MEDIDA</button>${S.aviso ? `<p class="nota">${esc(S.aviso)}</p>` : ''}</div>
  <section class="sec"><div class="sec-h"><span class="bar b-final"></span><span class="sec-t">HISTORIAL · ${m.length}</span></div><div class="sec-b">
  ${m.length ? m.map(x => `<div class="item"><span>${esc(x.fecha)}</span><span class="it-d">${[x.peso_kg != null ? x.peso_kg + ' kg' : '', x.cadera_cm != null ? 'cadera ' + x.cadera_cm : '', x.cintura_cm != null ? 'cintura ' + x.cintura_cm : '', x.muslo_cm != null ? 'muslo ' + x.muslo_cm : ''].filter(Boolean).join(' · ')}</span></div>`).join('') : '<p class="sub">Sin medidas aún. Sin recordatorios: anota cuando quieras.</p>'}</div></section><div class="espacio"></div></div>`;
}
function vAjustes() {
  const i = info();
  return `<div class="pant"><header class="top"><h1 class="h1">AJUSTES</h1></header>
  <div class="card"><div class="h3">CICLO</div><p class="sub">Ciclo ${i.ciclo}, semana ${i.semana} de 6. Empezó el ${esc(S.perfil.inicio || '—')}.</p><button class="btn2" data-a="hoja" data-x="reiniciar">EMPEZAR CICLO NUEVO DESDE ESTA SEMANA</button></div>
  <div class="card"><div class="h3">ABDUCCIÓN</div><p class="sub">La máquina combinada está ${S.perfil.abdMaquina ? 'disponible' : 'dañada: se usa la polea'}.</p><button class="btn2" data-a="abd">${S.perfil.abdMaquina ? 'MARCAR COMO DAÑADA' : 'YA LA REPARARON'}</button></div>
  <div class="card"><div class="h3">SESIÓN</div><p class="sub">${API.pendientes(store) ? 'Hay cambios por subir. No cierres sesión sin internet.' : 'Todo guardado en la nube.'}</p><button class="btn2" data-a="salir">CERRAR SESIÓN EN ESTE TELÉFONO</button></div>
  <p class="nota pad">Entrenador · versión 1.0</p><div class="espacio"></div></div>`;
}

// ---------------- hojas ----------------
function vHoja() {
  const h = S.hoja; let t = '', body = '';
  if (h === 'peso') return vPeso();
  const ctx = S.run ? runPaso() : null; const k = ctx ? L.activo(ctx.paso, ctx.ses.datos, ctx.r.turno, kk => setsDe(kk, ctx.ses)) : null; const e = k ? L.EJ[k] : null;
  if (h === 'como') { t = 'CÓMO HACERLO'; body = `<p class="sub">${esc(nombreEj(k, ctx.ses))}</p><p class="txt">${esc(e.how)}</p><p class="sub">RIR ${esc(ctx.ses.datos.descarga ? '3–4' : e.rir)}: termina cada serie con esas repeticiones de sobra antes de no poder más.</p>`; }
  if (h === 'ocupada') {
    t = 'MÁQUINA OCUPADA'; const sig = siguientePos();
    body = `<p class="sub">Qué hacemos con ${esc(e.n)}</p>${e.alts.length ? `<div class="mini">CAMBIAR POR</div>${e.alts.map((a, i) => `<button class="opt" data-a="alt" data-x="${i}"><b>${esc(a.n)}</b><span>${esc(a.d)}</span></button>`).join('')}` : ''}
      ${sig >= 0 ? `<div class="mini">ADELANTAR</div><button class="opt" data-a="adelantar"><b>Haz ${esc(nombrePaso(ctx.ses, sig))} ahora</b><span>Vuelves a este cuando se libere</span></button>` : ''}
      <div class="mini">ESPERAR</div><button class="opt" data-a="esperar"><b>Esperar 5 minutos</b><span>Si sigue ocupada, te muestro las opciones otra vez</span></button>`;
  }
  if (h === 'molesta') {
    t = 'ME MOLESTA'; body = `<p class="sub">Opciones más suaves para ${esc(nombreEj(k, ctx.ses))}</p>
      ${e.carga !== 'tiempo' ? `<button class="opt" data-a="suave"><b>${esc(e.soft.n)}</b><span>${esc(e.soft.d)}</span></button><button class="opt" data-a="bajar10"><b>Bajar 10 % el peso hoy</b><span>Mismo ejercicio, más controlado</span></button>` : ''}
      <button class="opt" data-a="saltarEj"><b>Saltar este ejercicio hoy</b><span>No cuenta para tu progreso</span></button><p class="nota">Si el dolor es punzante o no se va, consulta a un fisioterapeuta.</p>`;
  }
  if (h === 'elegir') {
    t = 'ENTRENAR HOY'; const pl = plan(); const hechos = new Set(pl.dias.filter(x => x.estado === 'hecho' && x.dia).map(x => x.dia));
    const pend = pl.faltas.length ? pl.faltas : L.PRIORIDAD.filter(d => !hechos.has(d));
    body = `<p class="sub">Hoy es tu día de descanso. Si igual quieres entrenar, elige la rutina.${pend.length ? ' Te recomiendo la primera: es la que más te falta esta semana.' : ''}</p>` +
      ['lun', 'mar', 'mie', 'vie', 'sab'].sort((a, b) => (pend.includes(a) ? pend.indexOf(a) : 9) - (pend.includes(b) ? pend.indexOf(b) : 9)).map(d =>
        `<button class="opt" data-a="hacerHoy" data-x="${d}"><b>${esc(L.DIAS[d].nombre.toUpperCase())}</b><span>${hechos.has(d) ? 'Ya la hiciste esta semana' : L.RUTINA[d].reduce((a, p) => a + p.ex.length, 0) + ' ejercicios'}</span></button>`).join('');
  }
  if (h === 'reiniciar') { t = 'CICLO NUEVO'; body = `<p class="txt">El ciclo vuelve a la semana 1 desde este lunes. Tus pesos e historial se mantienen.</p><button class="cta" data-a="reiniciar">SÍ, EMPEZAR CICLO NUEVO</button>`; }
  return `<div class="velo" data-a="cerrar"></div><div class="hoja" role="dialog" aria-label="${esc(t)}"><span class="asa"></span><div class="h2">${esc(t)}</div>${body}<button class="btn2 full" data-a="cerrar">CERRAR</button></div>`;
}
function vPeso() {
  const d = S.hojaData; const e = L.EJ[d.k]; const u = d.u; const st = L.paso(e, u);
  const dp = e.carga === 'discos' ? L.discosPorLado(d.w || 0, d.base || 0, u) : null;
  const sizes = u === 'lb' ? [45, 35, 25, 10, 5, 2.5] : [20, 15, 10, 5, 2.5, 1.25];
  const cnt = {}; (dp ? dp.discos : []).forEach(p => cnt[p] = (cnt[p] || 0) + 1);
  return `<div class="velo" data-a="cerrar"></div><div class="hoja" role="dialog" aria-label="Cargar peso"><span class="asa"></span>
  <div class="row-b"><div class="h2">CARGAR PESO</div><div class="pill2 sm"><button class="${u === 'lb' ? 'on' : ''}" data-a="unidad" data-x="lb">LB</button><button class="${u === 'kg' ? 'on' : ''}" data-a="unidad" data-x="kg">KG</button></div></div>
  <p class="sub">${esc(e.n)}${e.carga === 'mancuernas' ? ' · peso de cada mancuerna' : ''}</p>
  <div class="pesorow"><button class="btn2 sq" data-a="pmenos">−</button><label class="pesoin"><input id="p-total" inputmode="decimal" value="${d.w == null ? '' : d.w}" aria-label="Peso total"><span>${esc(u)}</span></label><button class="btn2 sq" data-a="pmas">+</button></div>
  <p class="sub c">${d.w ? '≈ ' + L.convertir(d.w, u) + (u === 'lb' ? ' kg' : ' lb') : 'Escríbelo o usa + y −. Salto: ' + st + ' ' + u}</p>
  ${dp ? `<div class="barra big" aria-hidden="true"><span class="eje l"></span><span class="discos rev">${dp.discos.map(p => `<span class="disco d${sizes.indexOf(p)}"><i>${p}</i></span>`).join('')}</span><span class="tope"></span><span class="eje c"></span><span class="tope"></span><span class="discos">${dp.discos.map(p => `<span class="disco d${sizes.indexOf(p)}"><i>${p}</i></span>`).join('')}</span><span class="eje r"></span></div>
    <div class="grid2"><div class="lado"><span class="mini">IZQUIERDO</span><b>${dp.discos.length ? dp.discos.join(' + ') : 'Sin discos'}</b></div><div class="lado"><span class="mini">DERECHO</span><b>${dp.discos.length ? dp.discos.join(' + ') : 'Sin discos'}</b></div></div>
    ${dp.sobra > 0.001 ? `<p class="err">No se arma exacto con discos: sobran ${dp.sobra} ${esc(u)}.</p>` : ''}
    <div class="mini">AGREGAR A CADA LADO</div><div class="grid3">${sizes.map(p => `<button class="btn2 disc" data-a="disco" data-x="${p}"><b>${p}</b><small>${cnt[p] ? '× ' + cnt[p] : ''}</small></button>`).join('')}</div>
    <div class="row-b"><label class="sub">Peso de la máquina vacía <input id="p-base" class="mini-in" inputmode="decimal" value="${d.base || 0}"></label><button class="link" data-a="vaciar">Vaciar</button></div>` : ''}
  <button class="cta" data-a="usarPeso">USAR ${d.w == null ? '' : d.w + ' ' + esc(u)}</button><button class="btn2 full" data-a="cerrar">CANCELAR</button></div>`;
}

// ---------------- acciones ----------------
const ACC = {
  async crearClave() {
    const a = val('c1'), b = val('c2');
    if (a.length < 6) return loginErr('La clave debe tener al menos 6 caracteres.');
    if (a !== b) return loginErr('Las dos claves no coinciden.');
    try { const r = await API.rpc('gym_crear_clave', { p_clave: a }); if (!r.ok) return loginErr(r.error === 'ya_existe' ? 'Ya hay una clave creada. Escríbela para entrar.' : 'No se pudo crear la clave.', r.error === 'ya_existe' ? 'entrar' : null); }
    catch (e) { return loginErr('Sin conexión. Intenta de nuevo.'); }
    entrarCon(a);
  },
  async entrar() {
    const a = val('c1'); if (!a) return loginErr('Escribe tu clave.');
    try { const r = await API.rpc('gym_estado', { p_clave: a }); if (!r.ok) return loginErr(r.error === 'bloqueado' ? 'Demasiados intentos. Espera 15 minutos.' : r.error === 'sin_clave' ? 'Aún no hay clave: créala.' : 'Clave incorrecta.', r.error === 'sin_clave' ? 'crear' : null); }
    catch (e) { return loginErr('Sin conexión. Intenta de nuevo.'); }
    entrarCon(a);
  },
  ir(x) { if (x === 'resumen') { S.pantalla = 'resumen'; } else { S.pantalla = x; if (x === 'inicio') S.sel = L.weekday(hoy()); } S.hoja = null; S.aviso = ''; render(); },
  dia(x) { S.sel = Number(x); S.vista = 'entreno'; render(); },
  vista(x) { S.vista = x; render(); },
  toggle(x) { S.abiertas[x] = x === 'cal' ? !S.abiertas[x] : S.abiertas[x] === false; render(); },
  falta(x, y) { const wk = L.iso(L.lunesDe(hoy())); S.perfil.decisiones = S.perfil.decisiones || {}; Object.keys(S.perfil.decisiones).forEach(k => { if (k < wk) delete S.perfil.decisiones[k]; }); S.perfil.decisiones[wk] = Object.assign({}, S.perfil.decisiones[wk], { [y]: x }); guardarPerfil(); render(); },
  hacerHoy(x) { S.hoja = null; S.sel = L.weekday(hoy()); S.vista = 'entreno'; const ses = sesionHoy(true, x); ses.datos.elegida = true; ACC.empezar(); },
  empezar() {
    const ses = sesionHoy(true); const dia = ses.dia;
    const p = ses.datos.orden.findIndex(j => !L.pasoHecho(L.RUTINA[dia][j], ses.datos, k => setsDe(k, ses)));
    if (p < 0) { S.pantalla = 'resumen'; render(); return; }
    S.run = { fecha: ses.fecha, dia, pos: p, turno: 'a', rest: null, espera: 0 };
    guardarSesion(ses); S.pantalla = 'ejercicio'; render();
  },
  rep(x) {
    const { r, ses, paso, idx } = runPaso(); const sets = k => setsDe(k, ses);
    const k = L.activo(paso, ses.datos, r.turno, sets); if (L.hecho(k, ses.datos, sets(k))) return;
    const en = entrada(ses, k); en.reps = (en.reps || []).concat([Number(x)]);
    if (L.hecho(k, ses.datos, sets(k))) cerrarEj(ses, k);
    if (L.pasoHecho(paso, ses.datos, sets)) { r.rest = null; S.pantalla = 'listo'; if (diaCompleto(ses)) { ses.terminada = true; } guardarSesion(ses); render(); return; }
    const e = L.EJ[k]; let rest = e.rest;
    if (paso.ex.length > 1) { r.turno = L.siguienteTurno(paso, ses.datos, k, !!ses.datos.sep[idx], sets); rest = ses.datos.sep[idx] ? e.rest : (e.ssRest || e.rest); }
    r.rest = { until: Date.now() + rest * 1000, total: rest };
    guardarSesion(ses); render();
  },
  deshacer() { const { r, ses, paso } = runPaso(); const k = L.activo(paso, ses.datos, r.turno, kk => setsDe(kk, ses)); const en = entrada(ses, k); en.reps = (en.reps || []).slice(0, -1); delete en.decision; r.rest = null; guardarSesion(ses); render(); },
  mas30() { const r = S.run; if (r.rest) { r.rest.until += 30000; r.rest.total = Math.max(r.rest.total, (r.rest.until - Date.now()) / 1000); } render(); },
  saltarDesc() { S.run.rest = null; render(); },
  sep(x) { const { r, ses, paso, idx } = runPaso(); ses.datos.sep[idx] = x === '1'; const sets = k => setsDe(k, ses); r.turno = ses.datos.sep[idx] ? (L.hecho(paso.ex[0], ses.datos, sets(paso.ex[0])) ? 'b' : 'a') : (((ses.datos.ex[paso.ex[0]] || {}).reps || []).length <= ((ses.datos.ex[paso.ex[1]] || {}).reps || []).length ? 'a' : 'b'); guardarSesion(ses); render(); },
  hoja(x, y) {
    if (x === 'peso') { const { ses } = runPaso(); const en = entrada(ses, y); S.hojaData = { k: y, w: en.w, u: en.u, base: (S.perfil.base || {})[y] || 0 }; }
    S.hoja = x; render();
  },
  cerrar() { S.hoja = null; S.hojaData = null; render(); },
  alt(x) { const { r, ses, paso } = runPaso(); const k = L.activo(paso, ses.datos, r.turno, kk => setsDe(kk, ses)); const en = entrada(ses, k); en.swap = L.EJ[k].alts[Number(x)].n; S.hoja = null; guardarSesion(ses); render(); },
  suave() { const { r, ses, paso } = runPaso(); const k = L.activo(paso, ses.datos, r.turno, kk => setsDe(kk, ses)); const en = entrada(ses, k); en.swap = L.EJ[k].soft.n; S.hoja = null; guardarSesion(ses); render(); },
  bajar10() { const { r, ses, paso } = runPaso(); const k = L.activo(paso, ses.datos, r.turno, kk => setsDe(kk, ses)); const en = entrada(ses, k); if (en.w != null) { const st = L.paso(L.EJ[k], en.u); en.w = Math.max(0, Math.floor(en.w * 0.9 / st) * st); } en.bajado = true; S.hoja = null; guardarSesion(ses); render(); },
  saltarEj() {
    const { r, ses, paso, idx } = runPaso(); const sets = kk => setsDe(kk, ses); const k = L.activo(paso, ses.datos, r.turno, sets);
    entrada(ses, k).skip = true; S.hoja = null; r.rest = null;
    if (L.pasoHecho(paso, ses.datos, sets)) { S.pantalla = 'listo'; if (diaCompleto(ses)) ses.terminada = true; }
    else if (paso.ex.length > 1) r.turno = k === paso.ex[0] ? 'b' : 'a';
    guardarSesion(ses); render();
  },
  adelantar() { const { r, ses } = runPaso(); const sig = siguientePos(); if (sig < 0) return; const o = ses.datos.orden; [o[r.pos], o[sig]] = [o[sig], o[r.pos]]; r.turno = 'a'; r.rest = null; S.hoja = null; guardarSesion(ses); render(); },
  esperar() { S.run.espera = Date.now() + 300000; S.hoja = null; render(); },
  libre() { S.run.espera = 0; render(); },
  siguiente() {
    const { r, ses } = runPaso(); const sig = siguientePos();
    if (sig >= 0) { r.pos = sig; r.turno = 'a'; r.rest = null; S.pantalla = 'ejercicio'; }
    else { const p = ses.datos.orden.findIndex(j => !L.pasoHecho(L.RUTINA[r.dia][j], ses.datos, k => setsDe(k, ses))); if (p >= 0) { r.pos = p; r.turno = 'a'; S.pantalla = 'ejercicio'; } else { ses.terminada = true; guardarSesion(ses); S.pantalla = 'resumen'; } }
    render();
  },
  unidad(x) { const d = S.hojaData; if (d.u === x) return; const e = L.EJ[d.k]; if (d.w != null) d.w = L.redondear(x === 'kg' ? d.w * 0.4536 : d.w * 2.2046, L.paso(e, x)); d.u = x; render(); },
  pmenos() { const d = S.hojaData; const st = L.paso(L.EJ[d.k], d.u); d.w = Math.max(0, Math.round(((d.w || 0) - st) * 100) / 100); render(); },
  pmas() { const d = S.hojaData; const st = L.paso(L.EJ[d.k], d.u); d.w = Math.round(((d.w || 0) + st) * 100) / 100; render(); },
  disco(x) { const d = S.hojaData; d.w = Math.round(((d.w || d.base || 0) + 2 * Number(x)) * 100) / 100; render(); },
  vaciar() { const d = S.hojaData; d.w = d.base || 0; render(); },
  usarPeso() {
    const d = S.hojaData; const { ses } = runPaso(); const en = entrada(ses, d.k); const changed = en.w !== d.w || en.u !== d.u;
    en.w = d.w; en.u = d.u;
    if (!en.swap && !ses.datos.descarga && changed) { const st = estadoEj(d.k) || {}; S.perfil.ex[d.k] = { w: d.w, u: d.u, trial: st.trial && st.trial.to === d.w && st.trial.u === d.u ? st.trial : null }; guardarPerfil(); }
    if (L.EJ[d.k].carga === 'discos') { S.perfil.base = Object.assign({}, S.perfil.base, { [d.k]: d.base || 0 }); guardarPerfil(); }
    S.hoja = null; S.hojaData = null; guardarSesion(ses); render();
  },
  progEj(x) { S.progEj = x; render(); },
  medida() {
    const n = id => { const v = val(id).replace(',', '.'); const f = parseFloat(v); return isNaN(f) ? null : f; };
    const m = { fecha: L.iso(hoy()), peso_kg: n('m-peso'), cadera_cm: n('m-cadera'), cintura_cm: n('m-cintura'), muslo_cm: n('m-muslo') };
    if ([m.peso_kg, m.cadera_cm, m.cintura_cm, m.muslo_cm].every(v => v == null)) { S.aviso = 'Escribe al menos una medida.'; render(); return; }
    S.medidas.unshift(m); cache();
    API.encolar(store, 'med|' + Date.now(), 'gym_guardar_medida', { p_fecha: m.fecha, p_peso: m.peso_kg, p_cadera: m.cadera_cm, p_cintura: m.cintura_cm, p_muslo: m.muslo_cm });
    programarEnvio(); S.aviso = 'Guardado.'; render();
  },
  abd() { S.perfil.abdMaquina = !S.perfil.abdMaquina; guardarPerfil(); render(); },
  reiniciar() { S.perfil.inicio = L.iso(L.lunesDe(hoy())); S.hoja = null; guardarPerfil(); render(); },
  salir() { if (API.pendientes(store) && !confirmar()) return; S.clave = null; try { store.removeItem('gym_clave'); store.removeItem('gym_cache'); store.removeItem('gym_cola'); } catch (e) {} S.perfil = { ex: {}, decisiones: {} }; S.sesiones = []; S.medidas = []; S.pantalla = 'login'; S.loginModo = 'entrar'; S.loginError = ''; render(); }
};
export const _ACC = ACC;
function confirmar() { try { return globalThis.confirm ? globalThis.confirm('Hay cambios sin subir. ¿Cerrar sesión igual?') : true; } catch (e) { return true; } }
function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function loginErr(m, modo) { S.loginError = m; if (modo) S.loginModo = modo; render(); }
function entrarCon(clave) {
  S.clave = clave; try { store.setItem('gym_clave', clave); } catch (e) {}
  S.loginError = ''; S.pantalla = 'inicio'; render(); refrescar();
}
// Al terminar un ejercicio: decide el peso de la próxima vez (regla de 2 sesiones)
function cerrarEj(ses, k) {
  const en = ses.datos.ex[k]; if (!en || en.decision) return;
  if (en.swap) { en.decision = { t: 'Ejercicio cambiado', d: 'Su peso se guarda aparte. Tu progreso de ' + L.EJ[k].n + ' sigue igual.', tag: 'Cambiado', good: false }; return; }
  if (en.bajado) { const st = estadoEj(k); en.decision = { t: 'Peso bajado hoy', d: 'La próxima vuelves a ' + (st && st.w != null ? st.w + ' ' + st.u : 'tu peso') + '.', tag: 'Peso bajado hoy', good: false }; return; }
  const dec = L.decidir(k, Object.assign({ descarga: !!ses.datos.descarga }, en), historial(k, ses), estadoEj(k));
  en.decision = { t: dec.t, d: dec.d, tag: dec.tag, good: !!dec.good };
  if (dec.nuevo && !en.swap && !en.bajado) { S.perfil.ex[k] = dec.nuevo; guardarPerfil(); }
}

// ---------------- eventos ----------------
export function conectar(root) {
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-a]'); if (!b) return;
    const fn = ACC[b.dataset.a]; if (!fn) return;
    ev.preventDefault(); fn(b.dataset.x, b.dataset.y);
  });
  root.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'p-total' && S.hojaData) { const f = parseFloat(t.value.replace(',', '.')); S.hojaData.w = isNaN(f) ? null : f; }
    if (t.id === 'p-base' && S.hojaData) { const f = parseFloat(t.value.replace(',', '.')); S.hojaData.base = isNaN(f) ? 0 : f; }
    if (t.id === 'nota') { const ses = sesionHoy(true); ses.nota = t.value.slice(0, 2000); clearTimeout(t._t); t._t = setTimeout(() => guardarSesion(ses), 800); }
  });
  root.addEventListener('change', ev => { if ((ev.target.id === 'p-total' || ev.target.id === 'p-base') && S.hojaData) render(); });
  root.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.target.id === 'c1' || ev.target.id === 'c2')) { (S.loginModo === 'crear' ? ACC.crearClave : ACC.entrar)(); } });
}
