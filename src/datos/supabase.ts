// Conexión real con Supabase.
// La llave "publishable" es pública por diseño: la seguridad la ponen las
// reglas RLS de la base de datos, no esta llave.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Api, CambiosUsuario, Cierre, Gastos, Lote, ManoObra, Perfil, Resumen, Sesion, Slug, Tema,
  UsuarioNuevo, VentanaFila,
} from './tipos.ts';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL || 'https://qfnoaldpopikhghizvyb.supabase.co';
const LLAVE = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_96jzw5X6qX4eEJWDJOixJg_4b37w8PQ';
const DOMINIO_INTERNO = 'aluminio.local';

const ERROR_LOGIN = 'Usuario o clave incorrectos';

function falla(e: { message?: string } | null | undefined, porDefecto = 'Algo salió mal. Revisa tu conexión e inténtalo de nuevo.'): never {
  const m = e?.message ?? '';
  if (/Failed to fetch|NetworkError|network/i.test(m)) throw new Error('Sin conexión a internet.');
  if (/row-level security|permission denied/i.test(m)) throw new Error('No tienes permiso para hacer esto.');
  throw new Error(m && /[áéíóúñ¿]|^[A-ZÁÉÍÓÚ][a-záéíóú]+ /.test(m) ? m : porDefecto);
}

const n = (x: unknown) => Number(x ?? 0);

function aLote(f: Record<string, unknown>): Lote {
  const ventanas = f.ventanas as { cantidad: number }[] | undefined;
  return {
    id: f.id as string,
    numero: n(f.numero),
    cliente: (f.cliente as string | null) ?? null,
    disco_corte: n(f.disco_corte),
    creado_en: f.creado_en as string,
    cierre_id: (f.cierre_id as string | null) ?? null,
    total_ventanas: ventanas ? ventanas.reduce((t, v) => t + n(v.cantidad), 0) : undefined,
  };
}

function aVentana(f: Record<string, unknown>): VentanaFila {
  return {
    id: f.id as string,
    lote_id: f.lote_id as string,
    orden: n(f.orden),
    cantidad: n(f.cantidad),
    sistema: f.sistema as VentanaFila['sistema'],
    color: f.color as VentanaFila['color'],
    alto: n(f.alto),
    ancho: n(f.ancho),
    proteccion: Boolean(f.proteccion),
    precio_unitario: n(f.precio_unitario),
    precio_total: n(f.precio_total),
  };
}

function aResumen(j: Record<string, unknown>): Resumen {
  return {
    cantidad_lotes: n(j.cantidad_lotes),
    cantidad_ventanas: n(j.cantidad_ventanas),
    lote_desde: j.lote_desde == null ? null : n(j.lote_desde),
    lote_hasta: j.lote_hasta == null ? null : n(j.lote_hasta),
    periodo_desde: (j.periodo_desde as string | null) ?? null,
    total_vendido: n(j.total_vendido),
    total_perfileria: n(j.total_perfileria),
    total_vidrio: n(j.total_vidrio),
    total_mano_obra: n(j.total_mano_obra),
    ganancia: n(j.ganancia),
    lotes: ((j.lotes as Record<string, unknown>[]) ?? []).map((l) => ({
      numero: n(l.numero),
      cliente: (l.cliente as string | null) ?? null,
      ventanas: n(l.ventanas),
      vendido: n(l.vendido),
      perfileria: n(l.perfileria),
      vidrio: n(l.vidrio),
      ganancia: n(l.ganancia),
    })),
  };
}

export function crearApiSupabase(): Api {
  const sb: SupabaseClient = createClient(URL_SUPABASE, LLAVE, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  async function cargarSesion(): Promise<Sesion | null> {
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return null;
    const { data: perfil } = await sb.from('perfiles').select('*').eq('id', uid).maybeSingle();
    const { data: herreria } = await sb.from('herrerias').select('id, slug, nombre').maybeSingle();
    if (!perfil || !herreria || !perfil.activo) return null;
    return { perfil: perfil as Perfil, herreria: { ...herreria, id: n(herreria.id) } as Sesion['herreria'] };
  }

  async function invocarAdmin(cuerpo: Record<string, unknown>) {
    const { data, error } = await sb.functions.invoke('admin-usuarios', { body: cuerpo });
    if (error) {
      let mensaje = '';
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) mensaje = (await ctx.json())?.error ?? '';
      } catch { /* sin detalle */ }
      throw new Error(mensaje || 'No se pudo completar. Inténtalo de nuevo.');
    }
    if (data && data.ok === false) throw new Error(data.error);
  }

  return {
    async iniciarSesion(slug: Slug, usuario: string, clave: string) {
      const u = usuario.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(u) || !clave) throw new Error(ERROR_LOGIN);
      const { error } = await sb.auth.signInWithPassword({ email: `${u}@${slug}.${DOMINIO_INTERNO}`, password: clave });
      if (error) {
        if (/fetch|network/i.test(error.message)) throw new Error('Sin conexión a internet.');
        if (/rate|too many/i.test(error.message)) throw new Error('Demasiados intentos. Espera unos minutos.');
        throw new Error(ERROR_LOGIN);
      }
      const s = await cargarSesion();
      if (!s || s.herreria.slug !== slug) {
        await sb.auth.signOut();
        throw new Error(ERROR_LOGIN);
      }
      return s;
    },

    async cerrarSesion() {
      await sb.auth.signOut();
    },

    sesionActual: cargarSesion,

    async cambiarMiClave(nueva) {
      const { error } = await sb.auth.updateUser({ password: nueva });
      if (error) {
        if (/different|same/i.test(error.message)) throw new Error('La clave nueva debe ser distinta a la anterior.');
        if (/weak|short|characters/i.test(error.message)) throw new Error('La clave es muy corta o muy simple.');
        falla(error);
      }
      const { error: e2 } = await sb.rpc('marcar_clave_cambiada');
      if (e2) falla(e2);
    },

    async guardarTema(tema: Tema) {
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user.id;
      if (!uid) return;
      await sb.from('perfiles').update({ tema }).eq('id', uid);
    },

    async listarLotes() {
      const { data, error } = await sb
        .from('lotes')
        .select('id, numero, cliente, disco_corte, creado_en, cierre_id, ventanas(cantidad)')
        .order('numero', { ascending: false });
      if (error) falla(error);
      return (data ?? []).map(aLote);
    },

    async crearLote(cliente) {
      const { data, error } = await sb
        .from('lotes')
        .insert({ cliente: cliente?.trim() || null })
        .select('id, numero, cliente, disco_corte, creado_en, cierre_id')
        .single();
      if (error) falla(error);
      return aLote(data);
    },

    async obtenerLote(id) {
      const { data: lote, error } = await sb
        .from('lotes')
        .select('id, numero, cliente, disco_corte, creado_en, cierre_id')
        .eq('id', id)
        .maybeSingle();
      if (error) falla(error);
      if (!lote) throw new Error('Este lote no existe o fue eliminado.');
      const { data: v, error: e2 } = await sb.from('ventanas').select('*').eq('lote_id', id).order('orden');
      if (e2) falla(e2);
      return { lote: aLote(lote), ventanas: (v ?? []).map(aVentana) };
    },

    async actualizarLote(id, cambios) {
      const { error } = await sb.from('lotes').update(cambios).eq('id', id);
      if (error) falla(error);
    },

    async borrarLote(id) {
      const { error, count } = await sb.from('lotes').delete({ count: 'exact' }).eq('id', id);
      if (error) falla(error);
      if (!count) throw new Error('No se pudo eliminar (¿el lote ya está cerrado o no tienes permiso?).');
    },

    async duplicarLote(id) {
      const { lote, ventanas } = await this.obtenerLote(id);
      const nuevo = await this.crearLote(lote.cliente);
      await this.actualizarLote(nuevo.id, { disco_corte: lote.disco_corte });
      if (ventanas.length) {
        const { error } = await sb.from('ventanas').insert(
          ventanas.map(({ id: _id, lote_id: _l, ...resto }) => ({ ...resto, lote_id: nuevo.id })),
        );
        if (error) falla(error);
      }
      return nuevo;
    },

    async guardarVentana(loteId, v) {
      const { id, ...datos } = v;
      if (id) {
        const { error } = await sb.from('ventanas').update(datos).eq('id', id);
        if (error) falla(error);
        return;
      }
      const { data: ult } = await sb
        .from('ventanas')
        .select('orden')
        .eq('lote_id', loteId)
        .order('orden', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await sb.from('ventanas').insert({ ...datos, lote_id: loteId, orden: n(ult?.orden) + 1 });
      if (error) falla(error);
    },

    async borrarVentana(id) {
      const { error } = await sb.from('ventanas').delete().eq('id', id);
      if (error) falla(error);
    },

    async obtenerGastos(loteId): Promise<Gastos> {
      const { data, error } = await sb.from('gastos_lote').select('perfileria, vidrio').eq('lote_id', loteId).maybeSingle();
      if (error) falla(error);
      return { perfileria: n(data?.perfileria), vidrio: n(data?.vidrio) };
    },

    async guardarGastos(loteId, g) {
      // Primero se intenta actualizar; si aún no existe la fila, se crea.
      // (Un "upsert" intentaría reescribir lote_id, que la app no puede tocar.)
      const { data: act, error } = await sb
        .from('gastos_lote')
        .update({ perfileria: g.perfileria, vidrio: g.vidrio })
        .eq('lote_id', loteId)
        .select('lote_id');
      if (error) falla(error);
      if (act && act.length) return;
      const { error: e2 } = await sb.from('gastos_lote').insert({ lote_id: loteId, perfileria: g.perfileria, vidrio: g.vidrio });
      if (e2) falla(e2);
    },

    async resumen() {
      const { data, error } = await sb.rpc('resumen_periodo');
      if (error) falla(error);
      return aResumen(data as Record<string, unknown>);
    },

    async listarManoObra(): Promise<ManoObra[]> {
      const { data, error } = await sb
        .from('mano_obra')
        .select('id, fecha, descripcion, monto')
        .is('cierre_id', null)
        .order('creado_en', { ascending: false });
      if (error) falla(error);
      return (data ?? []).map((m) => ({ ...m, monto: n(m.monto) }) as ManoObra);
    },

    async agregarManoObra(descripcion, monto) {
      const { error } = await sb.from('mano_obra').insert({ descripcion: descripcion.trim(), monto });
      if (error) falla(error);
    },

    async borrarManoObra(id) {
      const { error } = await sb.from('mano_obra').delete().eq('id', id);
      if (error) falla(error);
    },

    async tieneClaveCierre() {
      const { data, error } = await sb.rpc('tiene_clave_cierre');
      if (error) falla(error);
      return Boolean(data);
    },

    async establecerClaveCierre(clave) {
      const { error } = await sb.rpc('establecer_clave_cierre', { nueva: clave });
      if (error) falla(error);
    },

    async cerrarPeriodo(clave) {
      const { data, error } = await sb.rpc('cerrar_periodo', { clave });
      if (error) falla(error);
      const r = data as { ok: boolean; error?: string; numero?: number };
      return r;
    },

    async listarCierres(): Promise<Cierre[]> {
      const { data, error } = await sb.from('cierres').select('*').order('numero', { ascending: false });
      if (error) falla(error);
      return (data ?? []).map((c) => ({
        ...c,
        numero: n(c.numero),
        total_vendido: n(c.total_vendido),
        total_perfileria: n(c.total_perfileria),
        total_vidrio: n(c.total_vidrio),
        total_mano_obra: n(c.total_mano_obra),
        ganancia: n(c.ganancia),
        detalle: aResumen(c.detalle),
      })) as Cierre[];
    },

    async listarUsuarios() {
      const { data, error } = await sb.from('perfiles').select('*').order('es_admin', { ascending: false }).order('nombre');
      if (error) falla(error);
      return (data ?? []) as Perfil[];
    },

    async crearUsuario(u: UsuarioNuevo) {
      await invocarAdmin({ accion: 'crear', ...u });
    },

    async actualizarUsuario(id: string, c: CambiosUsuario) {
      await invocarAdmin({ accion: 'actualizar', id, ...c });
    },

    async cambiarClaveUsuario(id, clave) {
      await invocarAdmin({ accion: 'cambiar_clave', id, clave });
    },
  };
}
