-- =====================================================================
-- Cortes / Aluminio · Etapa 1 · Base de datos
-- Tablas, reglas de seguridad (RLS) y funciones del servidor.
-- Regla principal: cada usuario solo ve SU herrería. Nunca se mezclan.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Esquema privado: funciones internas que la app no puede llamar directo.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 1. HERRERÍAS
-- ---------------------------------------------------------------------
create table public.herrerias (
  id                smallint primary key,
  slug              text not null unique,
  nombre            text not null,
  ultimo_lote       integer not null default 0,
  clave_cierre_hash text,
  creado_en         timestamptz not null default now()
);

insert into public.herrerias (id, slug, nombre) values
  (1, 'famoso', 'Famoso'),
  (2, 'artesanos', 'Artesanos');

-- ---------------------------------------------------------------------
-- 2. PERFILES (usuarios de la app; la cuenta vive en auth.users)
-- ---------------------------------------------------------------------
create table public.perfiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  herreria_id        smallint not null references public.herrerias(id),
  usuario            text not null check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nombre             text not null check (char_length(nombre) between 1 and 60),
  es_admin           boolean not null default false,
  activo             boolean not null default true,
  puede_finanzas     boolean not null default false,
  puede_cierre       boolean not null default false,
  debe_cambiar_clave boolean not null default true,
  tema               text not null default 'oscuro' check (tema in ('oscuro', 'claro')),
  creado_en          timestamptz not null default now(),
  unique (herreria_id, usuario)
);

-- ---------------------------------------------------------------------
-- 3. CIERRES (se crea antes porque lotes y mano_obra apuntan aquí)
-- ---------------------------------------------------------------------
create table public.cierres (
  id               uuid primary key default gen_random_uuid(),
  herreria_id      smallint not null references public.herrerias(id),
  numero           integer not null,
  realizado_en     timestamptz not null default now(),
  realizado_por    uuid references public.perfiles(id) on delete set null,
  periodo_desde    timestamptz,
  lote_desde       integer,
  lote_hasta       integer,
  cantidad_lotes   integer not null,
  total_vendido    numeric(14,2) not null,
  total_perfileria numeric(14,2) not null,
  total_vidrio     numeric(14,2) not null,
  total_mano_obra  numeric(14,2) not null,
  ganancia         numeric(14,2) not null,
  detalle          jsonb not null default '{}'::jsonb,
  unique (herreria_id, numero)
);

-- ---------------------------------------------------------------------
-- 4. LOTES
-- ---------------------------------------------------------------------
create table public.lotes (
  id          uuid primary key default gen_random_uuid(),
  herreria_id smallint not null references public.herrerias(id),
  numero      integer not null,
  cliente     text check (cliente is null or char_length(cliente) <= 80),
  disco_corte numeric(4,2) not null default 0.3 check (disco_corte >= 0 and disco_corte <= 2),
  creado_en   timestamptz not null default now(),
  creado_por  uuid references public.perfiles(id) on delete set null,
  cierre_id   uuid references public.cierres(id),
  unique (herreria_id, numero)
);
create index lotes_abiertos_idx on public.lotes (herreria_id, cierre_id);

-- ---------------------------------------------------------------------
-- 5. VENTANAS (cada fila = N ventanas iguales)
-- ---------------------------------------------------------------------
create table public.ventanas (
  id              uuid primary key default gen_random_uuid(),
  lote_id         uuid not null references public.lotes(id) on delete cascade,
  orden           integer not null default 0,
  cantidad        integer not null check (cantidad between 1 and 999),
  sistema         text not null check (sistema in ('ecobel', 'panoramico')),
  color           text not null check (color in ('negro', 'blanco')),
  alto            numeric(6,1) not null check (alto > 20 and alto <= 600),
  ancho           numeric(6,1) not null check (ancho > 20 and ancho <= 600),
  proteccion      boolean not null default false,
  precio_unitario numeric(12,2) not null default 0 check (precio_unitario >= 0),
  precio_total    numeric(12,2) not null default 0 check (precio_total >= 0),
  creado_en       timestamptz not null default now()
);
create index ventanas_lote_idx on public.ventanas (lote_id);

-- ---------------------------------------------------------------------
-- 6. GASTOS DEL LOTE (solo visible con permiso de Finanzas)
-- ---------------------------------------------------------------------
create table public.gastos_lote (
  lote_id        uuid primary key references public.lotes(id) on delete cascade,
  perfileria     numeric(12,2) not null default 0 check (perfileria >= 0),
  vidrio         numeric(12,2) not null default 0 check (vidrio >= 0),
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. MANO DE OBRA (gasto general del período)
-- ---------------------------------------------------------------------
create table public.mano_obra (
  id          uuid primary key default gen_random_uuid(),
  herreria_id smallint not null references public.herrerias(id),
  fecha       date not null default current_date,
  descripcion text not null check (char_length(descripcion) between 1 and 120),
  monto       numeric(12,2) not null check (monto > 0),
  creado_por  uuid references public.perfiles(id) on delete set null,
  creado_en   timestamptz not null default now(),
  cierre_id   uuid references public.cierres(id)
);
create index mano_obra_abierta_idx on public.mano_obra (herreria_id, cierre_id);

-- =====================================================================
-- FUNCIONES DE APOYO (privadas)
-- =====================================================================
create function private.mi_herreria() returns smallint
language sql stable security definer set search_path = '' as $$
  select herreria_id from public.perfiles where id = auth.uid() and activo
$$;

create function private.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select es_admin from public.perfiles where id = auth.uid() and activo), false)
$$;

create function private.puede_finanzas() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select es_admin or puede_finanzas from public.perfiles where id = auth.uid() and activo), false)
$$;

create function private.puede_cierre() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select es_admin or puede_cierre from public.perfiles where id = auth.uid() and activo), false)
$$;

-- Resumen del período abierto de una herrería (una sola fuente de verdad
-- para la pantalla Finanzas y para el cierre general).
create function private.calcular_resumen(h smallint) returns jsonb
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
    select coalesce(sum(monto), 0) as total, min(fecha) as desde
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
    'periodo_desde',     least(t.desde_lotes, m.desde::timestamptz),
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

-- ---------------------------------------------------------------------
-- Disparadores: el servidor decide herrería, número, autor y estado.
-- Lo que mande la app en esos campos se ignora.
-- ---------------------------------------------------------------------
create function private.lotes_antes_insertar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_h smallint;
begin
  v_h := private.mi_herreria();
  if v_h is null then
    raise exception 'Usuario sin herrería activa';
  end if;
  update public.herrerias set ultimo_lote = ultimo_lote + 1
   where id = v_h returning ultimo_lote into new.numero;
  new.herreria_id := v_h;
  new.creado_por  := auth.uid();
  new.creado_en   := now();
  new.cierre_id   := null;
  return new;
end $$;

create trigger lotes_antes_insertar before insert on public.lotes
for each row execute function private.lotes_antes_insertar();

create function private.mano_obra_antes_insertar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_h smallint;
begin
  v_h := private.mi_herreria();
  if v_h is null then
    raise exception 'Usuario sin herrería activa';
  end if;
  new.herreria_id := v_h;
  new.creado_por  := auth.uid();
  new.creado_en   := now();
  new.cierre_id   := null;
  return new;
end $$;

create trigger mano_obra_antes_insertar before insert on public.mano_obra
for each row execute function private.mano_obra_antes_insertar();

create function private.gastos_lote_tocar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger gastos_lote_tocar before insert or update on public.gastos_lote
for each row execute function private.gastos_lote_tocar();

revoke all on all functions in schema private from public, anon, authenticated;
-- Solo las 4 funciones que usan las reglas RLS. calcular_resumen NO:
-- recibe la herrería como dato y solo la llaman funciones del servidor.
grant execute on function private.mi_herreria()    to authenticated;
grant execute on function private.es_admin()       to authenticated;
grant execute on function private.puede_finanzas() to authenticated;
grant execute on function private.puede_cierre()   to authenticated;

-- =====================================================================
-- FUNCIONES QUE LA APP SÍ PUEDE LLAMAR
-- =====================================================================

-- Resumen financiero del período abierto (pantalla Finanzas).
create function public.resumen_periodo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_h smallint := private.mi_herreria();
begin
  if v_h is null or not private.puede_finanzas() then
    raise exception 'Sin permiso de finanzas';
  end if;
  return private.calcular_resumen(v_h);
end $$;

-- ¿Ya existe clave de cierre para mi herrería?
create function public.tiene_clave_cierre() returns boolean
language sql stable security definer set search_path = '' as $$
  select clave_cierre_hash is not null from public.herrerias where id = private.mi_herreria()
$$;

-- Crear o cambiar la clave de cierre (solo administrador).
create function public.establecer_clave_cierre(nueva text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_h smallint := private.mi_herreria();
begin
  if v_h is null or not private.es_admin() then
    raise exception 'Solo el administrador puede cambiar la clave de cierre';
  end if;
  if nueva is null or char_length(nueva) < 4 then
    raise exception 'La clave de cierre debe tener al menos 4 caracteres';
  end if;
  update public.herrerias
     set clave_cierre_hash = extensions.crypt(nueva, extensions.gen_salt('bf'))
   where id = v_h;
end $$;

-- Cierre general: verifica permiso y clave, guarda el resumen
-- y marca como cerrados los lotes y pagos de mano de obra abiertos.
create function public.realizar_cierre(clave text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_h      smallint := private.mi_herreria();
  v_hash   text;
  v_res    jsonb;
  v_numero integer;
  v_id     uuid;
begin
  if v_h is null or not private.puede_cierre() then
    raise exception 'Sin permiso para hacer el cierre general';
  end if;

  -- Bloquea la herrería para que no se hagan dos cierres a la vez.
  select clave_cierre_hash into v_hash from public.herrerias where id = v_h for update;
  if v_hash is null then
    raise exception 'El administrador aún no ha creado la clave de cierre';
  end if;
  if clave is null or extensions.crypt(clave, v_hash) <> v_hash then
    raise exception 'Clave de cierre incorrecta';
  end if;

  v_res := private.calcular_resumen(v_h);
  if (v_res->>'cantidad_lotes')::int = 0 and (v_res->>'total_mano_obra')::numeric = 0 then
    raise exception 'No hay lotes ni pagos abiertos para cerrar';
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

  return v_id;
end $$;

-- El usuario confirma que ya cambió su clave inicial.
create function public.marcar_clave_cambiada() returns void
language sql security definer set search_path = '' as $$
  update public.perfiles set debe_cambiar_clave = false where id = auth.uid()
$$;

revoke all on function public.resumen_periodo()              from public, anon;
revoke all on function public.tiene_clave_cierre()           from public, anon;
revoke all on function public.establecer_clave_cierre(text)  from public, anon;
revoke all on function public.realizar_cierre(text)          from public, anon;
revoke all on function public.marcar_clave_cambiada()        from public, anon;
grant execute on function public.resumen_periodo()             to authenticated;
grant execute on function public.tiene_clave_cierre()          to authenticated;
grant execute on function public.establecer_clave_cierre(text) to authenticated;
grant execute on function public.realizar_cierre(text)         to authenticated;
grant execute on function public.marcar_clave_cambiada()       to authenticated;

-- =====================================================================
-- PERMISOS POR COLUMNA: la app solo puede tocar lo necesario
-- =====================================================================
revoke all on public.herrerias, public.perfiles, public.lotes, public.ventanas,
              public.gastos_lote, public.mano_obra, public.cierres
  from anon, authenticated;

grant select (id, slug, nombre, ultimo_lote) on public.herrerias to authenticated;

grant select on public.perfiles to authenticated;
grant update (tema) on public.perfiles to authenticated;

grant select, insert, delete on public.lotes to authenticated;
grant update (cliente, disco_corte) on public.lotes to authenticated;

grant select, insert, delete on public.ventanas to authenticated;
grant update (orden, cantidad, sistema, color, alto, ancho, proteccion,
              precio_unitario, precio_total) on public.ventanas to authenticated;

grant select, insert on public.gastos_lote to authenticated;
grant update (perfileria, vidrio) on public.gastos_lote to authenticated;

grant select, insert, delete on public.mano_obra to authenticated;
grant update (fecha, descripcion, monto) on public.mano_obra to authenticated;

grant select on public.cierres to authenticated;

-- =====================================================================
-- REGLAS DE SEGURIDAD POR FILA (RLS)
-- =====================================================================
alter table public.herrerias   enable row level security;
alter table public.perfiles    enable row level security;
alter table public.lotes       enable row level security;
alter table public.ventanas    enable row level security;
alter table public.gastos_lote enable row level security;
alter table public.mano_obra   enable row level security;
alter table public.cierres     enable row level security;

-- Herrerías: solo la mía.
create policy herrerias_ver on public.herrerias for select to authenticated
  using (id = (select private.mi_herreria()));

-- Perfiles: me veo a mí; el admin ve a todos los de su herrería.
create policy perfiles_ver on public.perfiles for select to authenticated
  using (herreria_id = (select private.mi_herreria())
         and (id = (select auth.uid()) or (select private.es_admin())));
create policy perfiles_tema on public.perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Lotes: todos los de mi herrería; solo se modifican si están abiertos.
create policy lotes_ver on public.lotes for select to authenticated
  using (herreria_id = (select private.mi_herreria()));
create policy lotes_crear on public.lotes for insert to authenticated
  with check (herreria_id = (select private.mi_herreria()));
create policy lotes_editar on public.lotes for update to authenticated
  using (herreria_id = (select private.mi_herreria()) and cierre_id is null)
  with check (herreria_id = (select private.mi_herreria()) and cierre_id is null);
create policy lotes_borrar on public.lotes for delete to authenticated
  using (herreria_id = (select private.mi_herreria()) and cierre_id is null);

-- Ventanas: las de lotes de mi herrería; se modifican solo en lotes abiertos.
create policy ventanas_ver on public.ventanas for select to authenticated
  using (exists (select 1 from public.lotes l
                 where l.id = lote_id and l.herreria_id = (select private.mi_herreria())));
create policy ventanas_crear on public.ventanas for insert to authenticated
  with check (exists (select 1 from public.lotes l
                      where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                        and l.cierre_id is null));
create policy ventanas_editar on public.ventanas for update to authenticated
  using (exists (select 1 from public.lotes l
                 where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                   and l.cierre_id is null))
  with check (exists (select 1 from public.lotes l
                      where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                        and l.cierre_id is null));
create policy ventanas_borrar on public.ventanas for delete to authenticated
  using (exists (select 1 from public.lotes l
                 where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                   and l.cierre_id is null));

-- Gastos del lote: solo con permiso de Finanzas.
create policy gastos_ver on public.gastos_lote for select to authenticated
  using ((select private.puede_finanzas())
         and exists (select 1 from public.lotes l
                     where l.id = lote_id and l.herreria_id = (select private.mi_herreria())));
create policy gastos_crear on public.gastos_lote for insert to authenticated
  with check ((select private.puede_finanzas())
              and exists (select 1 from public.lotes l
                          where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                            and l.cierre_id is null));
create policy gastos_editar on public.gastos_lote for update to authenticated
  using ((select private.puede_finanzas())
         and exists (select 1 from public.lotes l
                     where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                       and l.cierre_id is null))
  with check ((select private.puede_finanzas())
              and exists (select 1 from public.lotes l
                          where l.id = lote_id and l.herreria_id = (select private.mi_herreria())
                            and l.cierre_id is null));

-- Mano de obra: solo con permiso de Finanzas; se modifica mientras esté abierta.
create policy mano_ver on public.mano_obra for select to authenticated
  using ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()));
create policy mano_crear on public.mano_obra for insert to authenticated
  with check ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()));
create policy mano_editar on public.mano_obra for update to authenticated
  using ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()) and cierre_id is null)
  with check ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()) and cierre_id is null);
create policy mano_borrar on public.mano_obra for delete to authenticated
  using ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()) and cierre_id is null);

-- Cierres: solo lectura, con permiso de Finanzas.
create policy cierres_ver on public.cierres for select to authenticated
  using ((select private.puede_finanzas()) and herreria_id = (select private.mi_herreria()));
