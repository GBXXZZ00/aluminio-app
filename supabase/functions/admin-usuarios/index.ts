// Función segura del servidor para que el ADMINISTRADOR gestione usuarios
// de SU herrería: crear, editar nombre/permisos, activar/desactivar, cambiar clave.
// La llave de servicio solo vive aquí (en el servidor), nunca en el navegador.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const error = (mensaje: string, estado = 400) => responder({ ok: false, error: mensaje }, estado);

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
const DOMINIO_INTERNO = 'aluminio.local';
const BLOQUEO_INDEFINIDO = '876000h'; // ~100 años

function normalizarUsuario(u: unknown): string {
  return String(u ?? '').trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return error('Método no permitido', 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, servicio, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) ¿Quién llama? Debe ser un administrador activo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return error('Sesión requerida', 401);
  const { data: quien, error: errQuien } = await admin.auth.getUser(token);
  if (errQuien || !quien?.user) return error('Sesión inválida', 401);

  const { data: yo } = await admin
    .from('perfiles')
    .select('id, herreria_id, es_admin, activo')
    .eq('id', quien.user.id)
    .maybeSingle();
  if (!yo || !yo.activo || !yo.es_admin) return error('Solo el administrador puede gestionar usuarios', 403);

  const { data: herreria } = await admin.from('herrerias').select('slug').eq('id', yo.herreria_id).single();
  if (!herreria) return error('Herrería no encontrada', 500);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return error('Datos inválidos');
  }
  const accion = String(cuerpo.accion ?? '');

  // Busca un usuario de MI herrería (nunca de la otra).
  async function usuarioDeMiHerreria(id: unknown) {
    if (typeof id !== 'string') return null;
    const { data } = await admin
      .from('perfiles')
      .select('id, herreria_id, es_admin, usuario')
      .eq('id', id)
      .eq('herreria_id', yo!.herreria_id)
      .maybeSingle();
    return data;
  }

  // 2) Acciones
  if (accion === 'crear') {
    const usuario = normalizarUsuario(cuerpo.usuario);
    const nombre = String(cuerpo.nombre ?? '').trim();
    const clave = String(cuerpo.clave ?? '');
    if (!USUARIO_VALIDO.test(usuario)) {
      return error('El usuario debe tener de 3 a 30 letras o números, sin espacios ni acentos.');
    }
    if (!nombre || nombre.length > 60) return error('Escribe el nombre de la persona (máximo 60 letras).');
    if (clave.length < 6) return error('La clave inicial debe tener al menos 6 caracteres.');

    const { data: existe } = await admin
      .from('perfiles')
      .select('id')
      .eq('herreria_id', yo.herreria_id)
      .eq('usuario', usuario)
      .maybeSingle();
    if (existe) return error('Ese nombre de usuario ya existe en esta herrería.');

    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email: `${usuario}@${herreria.slug}.${DOMINIO_INTERNO}`,
      password: clave,
      email_confirm: true,
      app_metadata: { herreria: herreria.slug },
    });
    if (errCrear || !creado?.user) return error('No se pudo crear el usuario: ' + (errCrear?.message ?? ''), 500);

    const { error: errPerfil } = await admin.from('perfiles').insert({
      id: creado.user.id,
      herreria_id: yo.herreria_id,
      usuario,
      nombre,
      es_admin: false,
      activo: true,
      puede_finanzas: cuerpo.puede_finanzas === true,
      puede_cierre: cuerpo.puede_cierre === true,
      debe_cambiar_clave: true,
    });
    if (errPerfil) {
      await admin.auth.admin.deleteUser(creado.user.id);
      return error('No se pudo guardar el usuario: ' + errPerfil.message, 500);
    }
    return responder({ ok: true, id: creado.user.id });
  }

  if (accion === 'actualizar') {
    const objetivo = await usuarioDeMiHerreria(cuerpo.id);
    if (!objetivo) return error('Usuario no encontrado', 404);
    if (objetivo.es_admin) return error('La cuenta del administrador no se edita desde aquí.');

    const cambios: Record<string, unknown> = {};
    if (typeof cuerpo.nombre === 'string') {
      const n = cuerpo.nombre.trim();
      if (!n || n.length > 60) return error('Nombre inválido.');
      cambios.nombre = n;
    }
    if (typeof cuerpo.puede_finanzas === 'boolean') cambios.puede_finanzas = cuerpo.puede_finanzas;
    if (typeof cuerpo.puede_cierre === 'boolean') cambios.puede_cierre = cuerpo.puede_cierre;
    if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo;
    if (!Object.keys(cambios).length) return error('No hay cambios.');

    if (typeof cuerpo.activo === 'boolean') {
      // Inactivo = además se le cierra la sesión y no puede volver a entrar.
      const { error: errBan } = await admin.auth.admin.updateUserById(objetivo.id, {
        ban_duration: cuerpo.activo ? 'none' : BLOQUEO_INDEFINIDO,
      });
      if (errBan) return error('No se pudo cambiar el estado: ' + errBan.message, 500);
    }
    const { error: errAct } = await admin.from('perfiles').update(cambios).eq('id', objetivo.id);
    if (errAct) return error('No se pudo guardar: ' + errAct.message, 500);
    return responder({ ok: true });
  }

  if (accion === 'cambiar_clave') {
    const objetivo = await usuarioDeMiHerreria(cuerpo.id);
    if (!objetivo) return error('Usuario no encontrado', 404);
    if (objetivo.es_admin) return error('La clave del administrador se cambia desde su propia sesión.');
    const clave = String(cuerpo.clave ?? '');
    if (clave.length < 6) return error('La clave debe tener al menos 6 caracteres.');
    const { error: errClave } = await admin.auth.admin.updateUserById(objetivo.id, { password: clave });
    if (errClave) return error('No se pudo cambiar la clave: ' + errClave.message, 500);
    await admin.from('perfiles').update({ debe_cambiar_clave: true }).eq('id', objetivo.id);
    return responder({ ok: true });
  }

  return error('Acción desconocida');
});
