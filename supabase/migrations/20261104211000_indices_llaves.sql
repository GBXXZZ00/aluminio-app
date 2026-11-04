-- Índices para las relaciones entre tablas (recomendación del analizador de Supabase).
create index lotes_cierre_idx         on public.lotes (cierre_id);
create index lotes_creado_por_idx     on public.lotes (creado_por);
create index mano_obra_cierre_idx     on public.mano_obra (cierre_id);
create index mano_obra_creado_por_idx on public.mano_obra (creado_por);
create index cierres_realizado_por_idx on public.cierres (realizado_por);
