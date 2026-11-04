-- Decisión del dueño: solo quien tenga permiso de Finanzas puede borrar lotes
-- (al borrar un lote se borran también sus gastos de perfilería y vidrio).
alter policy lotes_borrar on public.lotes
  using ((select private.puede_finanzas())
         and herreria_id = (select private.mi_herreria())
         and cierre_id is null);
