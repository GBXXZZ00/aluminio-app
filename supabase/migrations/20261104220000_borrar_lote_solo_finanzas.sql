-- Solo quien tiene permiso de Finanzas (o el administrador) puede borrar un lote,
-- porque al borrarlo también se borran sus gastos de perfilería y vidrio.
alter policy lotes_borrar on public.lotes
  using (herreria_id = (select private.mi_herreria())
         and cierre_id is null
         and (select private.puede_finanzas()));
