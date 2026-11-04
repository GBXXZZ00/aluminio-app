import type { Api } from './tipos.ts';
import { crearApiSupabase } from './supabase.ts';
import { crearApiDemo } from './demo.ts';

export const MODO_DEMO = import.meta.env.VITE_MODO === 'demo';

export const api: Api = MODO_DEMO ? crearApiDemo() : crearApiSupabase();

export * from './tipos.ts';
