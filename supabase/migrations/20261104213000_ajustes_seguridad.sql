-- Ajustes tras la revisión de seguridad independiente.

-- 1) Límite de intentos para la clave de cierre: 5 fallos → bloqueo de 15 minutos.
alter table public.herrerias
  add column cierre_intentos_fallidos integer not null default 0,
  add column cierre_bloqueado_hasta   timestamptz;

-- 2) El cierre ya no lanza error con clave incorrecta (eso deshacía el conteo
--    de intentos). Devuelve un resultado: {ok, cierre_id} o {ok:false, error}.
--    Además bloquea las tablas de movimiento mientras calcula, para que nada
--    entre "a mitad" del cierre y los totales guardados coincidan siempre.
-- La versión anterior (realizar_cierre) queda deshabilitada y sin permiso.
create or replace function public.realizar_cierre(clave text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Función reemplazada por cerrar_periodo';
end $$;
revoke all on function public.realizar_cierre(text) from public, anon, authenticated;

create function public.cerrar_periodo(clave text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_h        smallint := private.mi_herreria();
  v_hash     text;
  v_fallos   integer;
  v_bloqueo  timestamptz;
  v_res      jsonb;
  v_numero   integer;
  v_id       uuid;
begin
  if v_h is null or not private.puede_cierre() then
    return jsonb_build_object('ok', false, 'error', 'Sin permiso para hacer el cierre general');
  end if;

  select clave_cierre_hash, cierre_intentos_fallidos, cierre_bloqueado_hasta
    into v_hash, v_fallos, v_bloqueo
    from public.herrerias where id = v_h for update;

  if v_bloqueo is not null and v_bloqueo > now() then
    return jsonb_build_object('ok', false, 'error',
      'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  end if;
  if v_hash is null then
    return jsonb_build_object('ok', false, 'error', 'El administrador aún no ha creado la clave de cierre');
  end if;
  if clave is null or extensions.crypt(clave, v_hash) <> v_hash then
    update public.herrerias
       set cierre_intentos_fallidos = case when v_fallos + 1 >= 5 then 0 else v_fallos + 1 end,
           cierre_bloqueado_hasta   = case when v_fallos + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = v_h;
    return jsonb_build_object('ok', false, 'error', 'Clave de cierre incorrecta');
  end if;

  update public.herrerias
     set cierre_intentos_fallidos = 0, cierre_bloqueado_hasta = null
   where id = v_h;

  -- Nadie puede crear/editar lotes, ventanas, gastos ni mano de obra
  -- mientras se calcula y archiva el cierre (dura milisegundos).
  lock table public.lotes, public.ventanas, public.gastos_lote, public.mano_obra
    in share row exclusive mode;

  v_res := private.calcular_resumen(v_h);
  if (v_res->>'cantidad_lotes')::int = 0 and (v_res->>'total_mano_obra')::numeric = 0 then
    return jsonb_build_object('ok', false, 'error', 'No hay lotes ni pagos abiertos para cerrar');
  end if;

  select coalesce(max(numero), 0) + 1 into v_numero from public.cierres where herreria_id = v_h;

  insert into public.cierres (
    herreria_id, numero, realizado_por, periodo_desde, lote_desde, lote_hasta,
    cantidad_lotes, total_vendido, total_perfileria, total_vidrio, total_mano_obra,
    ganancia, detalle)
  values (
    v_h, v_numero, auth.uid(), (v_res->>'periodo_desde')::timestamptz,
    (v_res->>'lote_desde')::int, (v_res->>'lote_hasta')::int,
    (v_res->>'cantidad_lotes')::int, (v_res->>'total_vendido')::numeric,
    (v_res->>'total_perfileria')::numeric, (v_res->>'total_vidrio')::numeric,
    (v_res->>'total_mano_obra')::numeric, (v_res->>'ganancia')::numeric, v_res)
  returning id into v_id;

  update public.lotes     set cierre_id = v_id where herreria_id = v_h and cierre_id is null;
  update public.mano_obra set cierre_id = v_id where herreria_id = v_h and cierre_id is null;

  return jsonb_build_object('ok', true, 'cierre_id', v_id, 'numero', v_numero);
end $$;

revoke all on function public.cerrar_periodo(text) from public, anon;
grant execute on function public.cerrar_periodo(text) to authenticated;

-- 3) Clave de cierre: mínimo 6 caracteres; al cambiarla se reinicia el bloqueo.
create or replace function public.establecer_clave_cierre(nueva text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_h smallint := private.mi_herreria();
begin
  if v_h is null or not private.es_admin() then
    raise exception 'Solo el administrador puede cambiar la clave de cierre';
  end if;
  if nueva is null or char_length(nueva) < 6 then
    raise exception 'La clave de cierre debe tener al menos 6 caracteres';
  end if;
  update public.herrerias
     set clave_cierre_hash        = extensions.crypt(nueva, extensions.gen_salt('bf')),
         cierre_intentos_fallidos = 0,
         cierre_bloqueado_hasta   = null
   where id = v_h;
end $$;

-- 4) Solo usuarios activos pueden marcar su clave como cambiada.
create or replace function public.marcar_clave_cambiada() returns void
language sql security definer set search_path = '' as $$
  update public.perfiles set debe_cambiar_clave = false where id = auth.uid() and activo
$$;

-- 5) El inicio del período se toma de cuándo se registró la mano de obra,
--    no de la fecha que se escribe (que se puede editar).
create or replace function private.calcular_resumen(h smallint) returns jsonb
language sql stable security definer set search_path = '' as $$
  with l as (
    select lo.numero, lo.cliente, lo.creado_en,
           coalesce((select sum(v.precio_total) from public.ventanas v where v.lote_id = lo.id), 0) as vendido,
           coalesce((select sum(v.cantidad)     from public.ventanas v where v.lote_id = lo.id), 0) as ventanas,
           coalesce(g.perfileria, 0) as perfileria,
           coalesce(g.vidrio, 0)     as vidrio
    from public.lotes lo
    left join public.gastos_lote g on g.lote_id = lo.id
    where lo.herreria_id = h and lo.cierre_id is null
  ),
  m as (
    select coalesce(sum(monto), 0) as total, min(creado_en) as desde
    from public.mano_obra where herreria_id = h and cierre_id is null
  ),
  t as (
    select count(*)::int                     as cantidad_lotes,
           coalesce(sum(ventanas), 0)::int   as cantidad_ventanas,
           min(numero)                       as lote_desde,
           max(numero)                       as lote_hasta,
           min(creado_en)                    as desde_lotes,
           coalesce(sum(vendido), 0)         as vendido,
           coalesce(sum(perfileria), 0)      as perfileria,
           coalesce(sum(vidrio), 0)          as vidrio
    from l
  )
  select jsonb_build_object(
    'cantidad_lotes',    t.cantidad_lotes,
    'cantidad_ventanas', t.cantidad_ventanas,
    'lote_desde',        t.lote_desde,
    'lote_hasta',        t.lote_hasta,
    'periodo_desde',     least(t.desde_lotes, m.desde),
    'total_vendido',     t.vendido,
    'total_perfileria',  t.perfileria,
    'total_vidrio',      t.vidrio,
    'total_mano_obra',   m.total,
    'ganancia',          t.vendido - t.perfileria - t.vidrio - m.total,
    'lotes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', numero, 'cliente', cliente, 'ventanas', ventanas,
               'vendido', vendido, 'perfileria', perfileria, 'vidrio', vidrio,
               'ganancia', vendido - perfileria - vidrio) order by numero)
      from l), '[]'::jsonb)
  )
  from t, m
$$;
revoke all on function private.calcular_resumen(smallint) from public, anon, authenticated;

-- 6) Lo que se cree en el futuro NO queda abierto por defecto:
--    cada tabla o función nueva debe recibir permisos a propósito.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
