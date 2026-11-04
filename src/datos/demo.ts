// Modo demostración: datos en memoria, sin Supabase. Sirve para probar las
// pantallas (agentes de prueba, desarrollo). Se activa con VITE_MODO=demo.
// Usuarios: "raymundo" (admin) y "pedro" (sin finanzas), clave "demo123".
import type {
  Api, Cierre, Gastos, Herreria, Lote, ManoObra, Perfil, Resumen, Sesion, Slug, VentanaFila,
} from './tipos.ts';

const HERRERIAS: Herreria[] = [
  { id: 1, slug: 'famoso', nombre: 'Famoso' },
  { id: 2, slug: 'artesanos', nombre: 'Artesanos' },
];

let seq = 100;
const nuevoId = () => `demo-${++seq}`;
const espera = () => new Promise((r) => setTimeout(r, 60));

export function crearApiDemo(): Api {
  const perfiles: (Perfil & { clave: string })[] = [];
  for (const h of HERRERIAS) {
    perfiles.push({
      id: nuevoId(), herreria_id: h.id, usuario: 'raymundo', nombre: 'Raymundo', es_admin: true, activo: true,
      puede_finanzas: true, puede_cierre: true, debe_cambiar_clave: false, tema: 'oscuro', clave: 'demo123',
    });
    perfiles.push({
      id: nuevoId(), herreria_id: h.id, usuario: 'pedro', nombre: 'Pedro', es_admin: false, activo: true,
      puede_finanzas: false, puede_cierre: false, debe_cambiar_clave: false, tema: 'oscuro', clave: 'demo123',
    });
  }
  const ultimoLote: Record<number, number> = { 1: 0, 2: 0 };
  const lotes: (Lote & { herreria_id: number })[] = [];
  const ventanas: VentanaFila[] = [];
  const gastos = new Map<string, Gastos>();
  const mano: (ManoObra & { herreria_id: number; cierre_id: string | null })[] = [];
  const cierres: (Cierre & { herreria_id: number })[] = [];
  const claveCierre: Record<number, string | null> = { 1: null, 2: null };
  let sesion: Sesion | null = null;

  const yo = () => {
    if (!sesion) throw new Error('Sesión requerida');
    return sesion;
  };
  const h = () => yo().herreria.id;
  const puedeFin = () => yo().perfil.es_admin || yo().perfil.puede_finanzas;
  const mio = (id: string) => {
    const l = lotes.find((x) => x.id === id && x.herreria_id === h());
    if (!l) throw new Error('Este lote no existe o fue eliminado.');
    return l;
  };
  const abierto = (l: Lote) => {
    if (l.cierre_id) throw new Error('Este lote ya está cerrado.');
  };

  function crear(cliente: string | null): Lote {
    ultimoLote[h()]++;
    const l = {
      id: nuevoId(), herreria_id: h(), numero: ultimoLote[h()], cliente, disco_corte: 0.3,
      creado_en: new Date().toISOString(), cierre_id: null,
    };
    lotes.push(l);
    return l;
  }

  function calcular(): Resumen {
    const ls = lotes.filter((l) => l.herreria_id === h() && !l.cierre_id).sort((a, b) => a.numero - b.numero);
    const filas = ls.map((l) => {
      const vs = ventanas.filter((v) => v.lote_id === l.id);
      const g = gastos.get(l.id) ?? { perfileria: 0, vidrio: 0 };
      const vendido = vs.reduce((t, v) => t + v.precio_total, 0);
      return {
        numero: l.numero, cliente: l.cliente, ventanas: vs.reduce((t, v) => t + v.cantidad, 0),
        vendido, perfileria: g.perfileria, vidrio: g.vidrio, ganancia: vendido - g.perfileria - g.vidrio,
      };
    });
    const mo = mano.filter((m) => m.herreria_id === h() && !m.cierre_id).reduce((t, m) => t + m.monto, 0);
    const s = (k: 'vendido' | 'perfileria' | 'vidrio') => filas.reduce((t, f) => t + f[k], 0);
    return {
      cantidad_lotes: filas.length,
      cantidad_ventanas: filas.reduce((t, f) => t + f.ventanas, 0),
      lote_desde: filas[0]?.numero ?? null,
      lote_hasta: filas.at(-1)?.numero ?? null,
      periodo_desde: ls[0]?.creado_en ?? null,
      total_vendido: s('vendido'),
      total_perfileria: s('perfileria'),
      total_vidrio: s('vidrio'),
      total_mano_obra: mo,
      ganancia: s('vendido') - s('perfileria') - s('vidrio') - mo,
      lotes: filas,
    };
  }

  // Datos de ejemplo en Famoso: lote 001 con las ventanas del diseño.
  sesion = { perfil: perfiles[0], herreria: HERRERIAS[0] };
  const l1 = crear('Casa Pérez');
  ventanas.push(
    { id: nuevoId(), lote_id: l1.id, orden: 1, cantidad: 2, sistema: 'ecobel', color: 'negro', alto: 120, ancho: 150, proteccion: false, precio_unitario: 180, precio_total: 360 },
    { id: nuevoId(), lote_id: l1.id, orden: 2, cantidad: 1, sistema: 'panoramico', color: 'blanco', alto: 150, ancho: 180, proteccion: true, precio_unitario: 243, precio_total: 243 },
  );
  gastos.set(l1.id, { perfileria: 210, vidrio: 85 });
  claveCierre[1] = 'cierre1';
  sesion = null;

  return {
    async iniciarSesion(slug: Slug, usuario: string, clave: string) {
      await espera();
      const her = HERRERIAS.find((x) => x.slug === slug)!;
      const p = perfiles.find((x) => x.herreria_id === her.id && x.usuario === usuario.trim().toLowerCase());
      if (!p || p.clave !== clave || !p.activo) throw new Error('Usuario o clave incorrectos');
      sesion = { perfil: p, herreria: her };
      return sesion;
    },
    async cerrarSesion() { sesion = null; },
    escucharSalida() { return () => {}; },
    async sesionActual() { return sesion; },
    async cambiarMiClave(nueva) {
      const p = perfiles.find((x) => x.id === yo().perfil.id)!;
      if (p.clave === nueva) throw new Error('La clave nueva debe ser distinta a la anterior.');
      p.clave = nueva;
      p.debe_cambiar_clave = false;
    },
    async guardarTema(tema) { if (sesion) sesion.perfil.tema = tema; },

    async listarLotes() {
      await espera();
      return lotes
        .filter((l) => l.herreria_id === h())
        .sort((a, b) => b.numero - a.numero)
        .map((l) => ({ ...l, total_ventanas: ventanas.filter((v) => v.lote_id === l.id).reduce((t, v) => t + v.cantidad, 0) }));
    },
    async crearLote(cliente) { await espera(); return crear(cliente?.trim() || null); },
    async obtenerLote(id) {
      await espera();
      const l = mio(id);
      return { lote: { ...l }, ventanas: ventanas.filter((v) => v.lote_id === id).sort((a, b) => a.orden - b.orden).map((v) => ({ ...v })) };
    },
    async actualizarLote(id, c) { const l = mio(id); abierto(l); Object.assign(l, c); },
    async borrarLote(id) {
      const l = mio(id); abierto(l);
      if (!puedeFin()) throw new Error('No tienes permiso para hacer esto.');
      lotes.splice(lotes.indexOf(l), 1);
      for (let i = ventanas.length - 1; i >= 0; i--) if (ventanas[i].lote_id === id) ventanas.splice(i, 1);
      gastos.delete(id);
    },
    async duplicarLote(id) {
      const l = mio(id);
      const n = crear(l.cliente);
      n.disco_corte = l.disco_corte;
      for (const v of ventanas.filter((x) => x.lote_id === id)) ventanas.push({ ...v, id: nuevoId(), lote_id: n.id });
      return n;
    },
    async guardarVentana(loteId, v) {
      const l = mio(loteId); abierto(l);
      if (v.id) {
        const e = ventanas.find((x) => x.id === v.id)!;
        Object.assign(e, v);
      } else {
        const orden = Math.max(0, ...ventanas.filter((x) => x.lote_id === loteId).map((x) => x.orden)) + 1;
        ventanas.push({ ...v, id: nuevoId(), lote_id: loteId, orden });
      }
    },
    async borrarVentana(id) {
      const i = ventanas.findIndex((x) => x.id === id);
      if (i >= 0) { abierto(mio(ventanas[i].lote_id)); ventanas.splice(i, 1); }
    },

    async obtenerGastos(loteId) {
      if (!puedeFin()) throw new Error('No tienes permiso para hacer esto.');
      mio(loteId);
      return { ...(gastos.get(loteId) ?? { perfileria: 0, vidrio: 0 }) };
    },
    async guardarGastos(loteId, g) {
      if (!puedeFin()) throw new Error('No tienes permiso para hacer esto.');
      abierto(mio(loteId));
      gastos.set(loteId, { ...g });
    },

    async resumen() {
      if (!puedeFin()) throw new Error('Sin permiso de finanzas');
      await espera();
      return calcular();
    },
    async listarManoObra() {
      return mano.filter((m) => m.herreria_id === h() && !m.cierre_id).map(({ id, fecha, descripcion, monto }) => ({ id, fecha, descripcion, monto }));
    },
    async agregarManoObra(descripcion, monto) {
      mano.unshift({ id: nuevoId(), herreria_id: h(), fecha: new Date().toISOString().slice(0, 10), descripcion, monto, cierre_id: null });
    },
    async borrarManoObra(id) {
      const i = mano.findIndex((m) => m.id === id && m.herreria_id === h() && !m.cierre_id);
      if (i >= 0) mano.splice(i, 1);
    },
    async tieneClaveCierre() { return claveCierre[h()] != null; },
    async establecerClaveCierre(clave) {
      if (!yo().perfil.es_admin) throw new Error('Solo el administrador puede cambiar la clave de cierre');
      if (clave.length < 6) throw new Error('La clave de cierre debe tener al menos 6 caracteres');
      claveCierre[h()] = clave;
    },
    async cerrarPeriodo(clave) {
      await espera();
      const p = yo().perfil;
      if (!(p.es_admin || p.puede_cierre)) return { ok: false, error: 'Sin permiso para hacer el cierre general' };
      if (claveCierre[h()] == null) return { ok: false, error: 'El administrador aún no ha creado la clave de cierre' };
      if (clave !== claveCierre[h()]) return { ok: false, error: 'Clave de cierre incorrecta' };
      const r = calcular();
      if (!r.cantidad_lotes && !r.total_mano_obra) return { ok: false, error: 'No hay lotes ni pagos abiertos para cerrar' };
      const numero = cierres.filter((c) => c.herreria_id === h()).length + 1;
      const id = nuevoId();
      cierres.push({
        id, herreria_id: h(), numero, realizado_en: new Date().toISOString(), periodo_desde: r.periodo_desde,
        lote_desde: r.lote_desde, lote_hasta: r.lote_hasta, cantidad_lotes: r.cantidad_lotes,
        total_vendido: r.total_vendido, total_perfileria: r.total_perfileria, total_vidrio: r.total_vidrio,
        total_mano_obra: r.total_mano_obra, ganancia: r.ganancia, detalle: r,
      });
      for (const l of lotes) if (l.herreria_id === h() && !l.cierre_id) l.cierre_id = id;
      for (const m of mano) if (m.herreria_id === h() && !m.cierre_id) m.cierre_id = id;
      return { ok: true, numero, resumen: r };
    },
    async listarCierres() {
      if (!puedeFin()) throw new Error('No tienes permiso para hacer esto.');
      return cierres.filter((c) => c.herreria_id === h()).sort((a, b) => b.numero - a.numero);
    },

    async listarUsuarios() {
      const p = yo().perfil;
      return perfiles
        .filter((x) => x.herreria_id === h() && (p.es_admin || x.id === p.id))
        .map(({ clave: _c, ...resto }) => resto);
    },
    async crearUsuario(u) {
      if (!yo().perfil.es_admin) throw new Error('Solo el administrador puede gestionar usuarios');
      const usuario = u.usuario.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('El usuario debe tener de 3 a 30 letras o números, sin espacios ni acentos.');
      if (perfiles.some((x) => x.herreria_id === h() && x.usuario === usuario)) throw new Error('Ese nombre de usuario ya existe en esta herrería.');
      if (u.clave.length < 6) throw new Error('La clave inicial debe tener al menos 6 caracteres.');
      perfiles.push({
        id: nuevoId(), herreria_id: h(), usuario, nombre: u.nombre.trim(), es_admin: false, activo: true,
        puede_finanzas: u.puede_finanzas, puede_cierre: u.puede_cierre, debe_cambiar_clave: true, tema: 'oscuro', clave: u.clave,
      });
    },
    async actualizarUsuario(id, c) {
      const p = perfiles.find((x) => x.id === id && x.herreria_id === h());
      if (!p) throw new Error('Usuario no encontrado');
      if (p.es_admin) throw new Error('La cuenta del administrador no se edita desde aquí.');
      Object.assign(p, c);
    },
    async cambiarClaveUsuario(id, clave) {
      const p = perfiles.find((x) => x.id === id && x.herreria_id === h());
      if (!p) throw new Error('Usuario no encontrado');
      if (clave.length < 6) throw new Error('La clave debe tener al menos 6 caracteres.');
      p.clave = clave;
      p.debe_cambiar_clave = true;
    },
  };
}
