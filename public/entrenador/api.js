// Conexión con Supabase: llamadas a las funciones gym_* y cola para cuando no hay internet.
export const SUPABASE_URL = 'https://tgjcwgvaybidcawkqksm.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_IUErTM0dqiaAj37LkTygcQ_KYjWY0F-';

const COLA = 'gym_cola';
let enviando = false;
let alFallarClave = () => {};
export function onClaveInvalida(fn) { alFallarClave = fn; }

export async function rpc(nombre, args, fetchFn) {
  const f = fetchFn || globalThis.fetch;
  const r = await f(`${SUPABASE_URL}/rest/v1/rpc/${nombre}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

function leerCola(storage) { try { return JSON.parse(storage.getItem(COLA) || '[]'); } catch (e) { return []; } }
function guardarCola(storage, c) { try { storage.setItem(COLA, JSON.stringify(c)); } catch (e) {} }

// Encola un guardado. id identifica lo que se reemplaza (la misma sesión o el perfil) para no mandar copias viejas.
export function encolar(storage, id, nombre, args) {
  const c = leerCola(storage).filter(x => x.id !== id);
  c.push({ id, nombre, args });
  guardarCola(storage, c);
}
export function pendientes(storage) { return leerCola(storage).length; }

export async function enviar(storage, clave, fetchFn) {
  if (enviando) return { ok: false, ocupado: true };
  enviando = true;
  try {
    let c = leerCola(storage);
    while (c.length) {
      const x = c[0];
      let res;
      try { res = await rpc(x.nombre, Object.assign({ p_clave: clave }, x.args), fetchFn); }
      catch (e) { return { ok: false, red: true }; }
      if (res && res.ok === false && (res.error === 'clave' || res.error === 'bloqueado' || res.error === 'sin_clave')) { alFallarClave(res.error); return { ok: false, clave: true }; }
      c = leerCola(storage).filter(y => y !== x && !(y.id === x.id && JSON.stringify(y.args) === JSON.stringify(x.args)));
      guardarCola(storage, c);
    }
    return { ok: true };
  } finally { enviando = false; }
}
