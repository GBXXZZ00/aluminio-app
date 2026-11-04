// Formas de los datos tal como vienen de la base de datos.
import type { Color, Sistema } from '../calculos/index.ts';

export type Slug = 'famoso' | 'artesanos';
export type Tema = 'oscuro' | 'claro';

export interface Herreria {
  id: number;
  slug: Slug;
  nombre: string;
}

export interface Perfil {
  id: string;
  herreria_id: number;
  usuario: string;
  nombre: string;
  es_admin: boolean;
  activo: boolean;
  puede_finanzas: boolean;
  puede_cierre: boolean;
  debe_cambiar_clave: boolean;
  tema: Tema;
}

export interface Lote {
  id: string;
  numero: number;
  cliente: string | null;
  disco_corte: number;
  creado_en: string;
  cierre_id: string | null;
  /** Total de ventanas (suma de cantidades). Solo en el listado. */
  total_ventanas?: number;
}

export interface VentanaFila {
  id: string;
  lote_id: string;
  orden: number;
  cantidad: number;
  sistema: Sistema;
  color: Color;
  alto: number;
  ancho: number;
  proteccion: boolean;
  precio_unitario: number;
  precio_total: number;
}

export type VentanaNueva = Omit<VentanaFila, 'id' | 'lote_id' | 'orden'> & { id?: string };

export interface Gastos {
  perfileria: number;
  vidrio: number;
}

export interface ManoObra {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
}

export interface ResumenLote {
  numero: number;
  cliente: string | null;
  ventanas: number;
  vendido: number;
  perfileria: number;
  vidrio: number;
  ganancia: number;
}

export interface Resumen {
  cantidad_lotes: number;
  cantidad_ventanas: number;
  lote_desde: number | null;
  lote_hasta: number | null;
  periodo_desde: string | null;
  total_vendido: number;
  total_perfileria: number;
  total_vidrio: number;
  total_mano_obra: number;
  ganancia: number;
  lotes: ResumenLote[];
}

export interface Cierre {
  id: string;
  numero: number;
  realizado_en: string;
  periodo_desde: string | null;
  lote_desde: number | null;
  lote_hasta: number | null;
  cantidad_lotes: number;
  total_vendido: number;
  total_perfileria: number;
  total_vidrio: number;
  total_mano_obra: number;
  ganancia: number;
  detalle: Resumen;
}

export interface UsuarioNuevo {
  usuario: string;
  nombre: string;
  clave: string;
  puede_finanzas: boolean;
  puede_cierre: boolean;
}

export interface CambiosUsuario {
  nombre?: string;
  puede_finanzas?: boolean;
  puede_cierre?: boolean;
  activo?: boolean;
}

export interface Sesion {
  perfil: Perfil;
  herreria: Herreria;
}

/** Todo lo que la app le pide a la base de datos. */
export interface Api {
  iniciarSesion(slug: Slug, usuario: string, clave: string): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  sesionActual(): Promise<Sesion | null>;
  cambiarMiClave(nueva: string): Promise<void>;
  guardarTema(tema: Tema): Promise<void>;

  listarLotes(): Promise<Lote[]>;
  crearLote(cliente: string | null): Promise<Lote>;
  obtenerLote(id: string): Promise<{ lote: Lote; ventanas: VentanaFila[] }>;
  actualizarLote(id: string, cambios: { cliente?: string | null; disco_corte?: number }): Promise<void>;
  borrarLote(id: string): Promise<void>;
  duplicarLote(id: string): Promise<Lote>;
  guardarVentana(loteId: string, v: VentanaNueva): Promise<void>;
  borrarVentana(id: string): Promise<void>;

  obtenerGastos(loteId: string): Promise<Gastos>;
  guardarGastos(loteId: string, g: Gastos): Promise<void>;

  resumen(): Promise<Resumen>;
  listarManoObra(): Promise<ManoObra[]>;
  agregarManoObra(descripcion: string, monto: number): Promise<void>;
  borrarManoObra(id: string): Promise<void>;
  tieneClaveCierre(): Promise<boolean>;
  establecerClaveCierre(clave: string): Promise<void>;
  cerrarPeriodo(clave: string): Promise<{ ok: boolean; error?: string; numero?: number }>;
  listarCierres(): Promise<Cierre[]>;

  listarUsuarios(): Promise<Perfil[]>;
  crearUsuario(u: UsuarioNuevo): Promise<void>;
  actualizarUsuario(id: string, c: CambiosUsuario): Promise<void>;
  cambiarClaveUsuario(id: string, clave: string): Promise<void>;
}
