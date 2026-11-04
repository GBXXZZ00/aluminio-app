-- Permite a la función del servidor (y solo a ella) cerrar todas las sesiones
-- abiertas de un usuario: al cambiarle la clave o desactivarlo, un teléfono
-- perdido deja de tener acceso.
create or replace function public.cerrar_sesiones_usuario(uid uuid) returns void
language sql security definer set search_path = '' as $$
  delete from auth.sessions where user_id = uid;
$$;
revoke all on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
