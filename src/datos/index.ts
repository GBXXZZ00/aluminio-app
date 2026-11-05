import type { Api } from './tipos.ts';
import { crearApiSupabase } from './supabase.ts';
import { crearApiDemo } from './demo.ts';

export const MODO_DEMO = import.meta.env.VITE_MODO === 'demo';

const base: Api = MODO_DEMO ? crearApiDemo() : crearApiSupabase();

// ---------------------------------------------------------------------------
// Memoria rápida de lecturas (solo en este teléfono, solo mientras la app está
// abierta). Hace que volver atrás o pasar de "Lote" a "Resultados" sea
// inmediato en vez de volver a pedirlo todo al servidor.
// - Una lectura reciente (menos de FRESCO_MS) se reutiliza sin ir al servidor.
// - Dos pantallas que piden lo mismo a la vez comparten un solo pedido.
// - CUALQUIER cambio (guardar, borrar, cerrar sesión…) borra toda la memoria,
//   así nunca se muestra algo viejo después de un cambio propio, y nunca se
//   mezclan datos de dos herrerías.
// ---------------------------------------------------------------------------
const FRESCO_MS = 15_000;
const memoria = new Map<string, { valor: unknown; hora: number }>();
const enCurso = new Map<string, Promise<unknown>>();
let generacion = 0;

function olvidarTodo() {
  generacion++;
  memoria.clear();
  enCurso.clear();
}

/** Lo último guardado en memoria para esa clave (aunque no sea reciente). */
export function enMemoria<T>(clave: string): T | undefined {
  return memoria.get(clave)?.valor as T | undefined;
}

function leer<T>(clave: string, pedir: () => Promise<T>): Promise<T> {
  const m = memoria.get(clave);
  if (m && Date.now() - m.hora < FRESCO_MS) return Promise.resolve(m.valor as T);
  const ya = enCurso.get(clave);
  if (ya) return ya as Promise<T>;
  const gen = generacion;
  const p = pedir()
    .then((valor) => {
      if (gen === generacion) memoria.set(clave, { valor, hora: Date.now() });
      return valor;
    })
    .finally(() => {
      if (enCurso.get(clave) === p) enCurso.delete(clave);
    });
  enCurso.set(clave, p);
  return p;
}

/** Envuelve un cambio: al terminar (bien o mal) se olvida la memoria. */
function cambio<A extends unknown[], R>(f: (...a: A) => Promise<R>) {
  return async (...a: A): Promise<R> => {
    olvidarTodo();
    try {
      return await f(...a);
    } finally {
      olvidarTodo();
    }
  };
}

const LECTURAS = new Set<keyof Api>(['listarLotes', 'obtenerLote', 'obtenerGastos']);

export const claveLotes = (soloAbiertos = false) => `lotes:${soloAbiertos ? 'abiertos' : 'todos'}`;
export const claveLote = (id: string) => `lote:${id}`;
export const claveGastos = (id: string) => `gastos:${id}`;

const envuelta = {} as Record<string, unknown>;
for (const k of Object.keys(base) as (keyof Api)[]) {
  const f = (base[k] as (...a: unknown[]) => unknown).bind(base);
  if (k === 'sesionActual' || k === 'guardarTema' || LECTURAS.has(k)) envuelta[k] = f;
  else if (k === 'escucharSalida') envuelta[k] = (alSalir: () => void) => base.escucharSalida(() => { olvidarTodo(); alSalir(); });
  else envuelta[k] = cambio(f as (...a: unknown[]) => Promise<unknown>);
}
envuelta.listarLotes = (soloAbiertos = false) => leer(claveLotes(soloAbiertos), () => base.listarLotes(soloAbiertos));
envuelta.obtenerLote = (id: string) => leer(claveLote(id), () => base.obtenerLote(id));
envuelta.obtenerGastos = (id: string) => leer(claveGastos(id), () => base.obtenerGastos(id));

export const api = envuelta as unknown as Api;

export * from './tipos.ts';
