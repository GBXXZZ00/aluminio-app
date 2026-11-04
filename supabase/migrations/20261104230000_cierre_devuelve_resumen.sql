-- Ajustes tras la revisión de código:
-- 1) El cierre devuelve el resumen EXACTO que archivó (la pantalla muestra eso).
-- 2) Se bloquean las tablas antes que la herrería (evita bloqueos cruzados).
-- 3) Quien puede hacer el cierre también puede ver Finanzas.

create or replace function public.cerrar_periodo(clave text) returns jsonb
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

  -- Primero las tablas y luego la herrería, en el mismo orden que usa la app,
  -- para que dos operaciones nunca se queden esperándose una a la otra.
  lock table public.lotes, public.ventanas, public.gastos_lote, public.mano_obra
    in share row exclusive mode;

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

  return jsonb_build_object('ok', true, 'cierre_id', v_id, 'numero', v_numero, 'resumen', v_res);
end $$;


create or replace function private.puede_finanzas() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select es_admin or puede_finanzas or puede_cierre
                   from public.perfiles where id = auth.uid() and activo), false)
$$;
