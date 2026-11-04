-- =====================================================================
-- PRUEBA DE SEGURIDAD · se puede correr cuantas veces quieras.
-- Crea usuarios y datos de prueba, intenta romper las reglas y al final
-- lanza un "error" a propósito con el REPORTE: así TODO se deshace y la
-- base de datos queda exactamente igual que antes.
--
-- Cómo correrla: Supabase → SQL Editor → pegar todo → Run.
-- El resultado aparece como un error que empieza con "REPORTE".
-- Cada línea dice qué se esperaba; "FAIL" indica un problema.
-- =====================================================================
do $$
declare
  r text := '';
  fa uuid := gen_random_uuid(); fu uuid := gen_random_uuid(); ff uuid := gen_random_uuid(); fc uuid := gen_random_uuid();
  aa uuid := gen_random_uuid(); fi uuid := gen_random_uuid();
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; la uuid; n int; j jsonb; x numeric;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (fa,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_fa@famoso.test'),
    (fu,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_fu@famoso.test'),
    (ff,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_ff@famoso.test'),
    (fc,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_fc@famoso.test'),
    (aa,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_aa@artesanos.test'),
    (fi,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_fi@famoso.test');
  insert into public.perfiles (id, herreria_id, usuario, nombre, es_admin, puede_finanzas, puede_cierre, activo) values
    (fa,1,'tadmin','Admin F',true,false,false,true),
    (fu,1,'tuser','User F',false,false,false,true),
    (ff,1,'tfin','Fin F',false,true,false,true),
    (fc,1,'tcie','Cie F',false,true,true,true),
    (aa,2,'tadmin','Admin A',true,false,false,true),
    (fi,1,'tina','Inactivo',true,true,true,false);

  -- Artesanos crea un lote
  perform set_config('request.jwt.claims', json_build_object('sub',aa,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.lotes (cliente) values ('Artesanos 1') returning id into la;
  select numero into n from public.lotes where id = la; r := r || 'A lote num (esperado 1): ' || n || E'\n';
  insert into public.ventanas (lote_id,cantidad,sistema,color,alto,ancho,precio_unitario,precio_total) values (la,1,'ecobel','negro',100,100,100,100);
  execute 'reset role';

  -- Usuario normal de Famoso
  perform set_config('request.jwt.claims', json_build_object('sub',fu,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.lotes (cliente, herreria_id, numero) values ('F1', 2, 999) returning id into l1;
  select r || 'F lote1 herreria/num (esperado 1/1): ' || herreria_id || '/' || numero || E'\n' into r from public.lotes where id = l1;
  insert into public.lotes (cliente) values ('F2') returning id into l2;
  delete from public.lotes where id = l2; get diagnostics n = row_count; r := r || 'user sin finanzas borra lote filas (esperado 0): ' || n || E'\n';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',ff,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  delete from public.lotes where id = l2; get diagnostics n = row_count; r := r || 'user con finanzas borra lote filas (esperado 1): ' || n || E'\n';
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub',fu,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.lotes (cliente) values ('F3') returning id into l3;
  select numero into n from public.lotes where id = l3; r := r || 'F tras borrar, num (esperado 3): ' || n || E'\n';
  select count(*) into n from public.lotes; r := r || 'F user ve lotes (esperado 2): ' || n || E'\n';
  select count(*) into n from public.ventanas; r := r || 'F user ve ventanas de A (esperado 0): ' || n || E'\n';
  begin insert into public.ventanas (lote_id,cantidad,sistema,color,alto,ancho) values (la,1,'ecobel','negro',100,100); r := r || 'FAIL: insertó ventana en lote de A' || E'\n';
  exception when others then r := r || 'OK no inserta ventana en A' || E'\n'; end;
  update public.lotes set cliente = 'hack' where id = la; get diagnostics n = row_count; r := r || 'F update lote A filas (esperado 0): ' || n || E'\n';
  delete from public.lotes where id = la; get diagnostics n = row_count; r := r || 'F delete lote A filas (esperado 0): ' || n || E'\n';
  insert into public.ventanas (lote_id,cantidad,sistema,color,alto,ancho,precio_unitario,precio_total) values
    (l1,2,'ecobel','negro',120,150,180,360),(l1,1,'panoramico','blanco',150,180,243,243);
  begin insert into public.gastos_lote (lote_id,perfileria,vidrio) values (l1,210,85); r := r || 'FAIL: user sin finanzas insertó gastos' || E'\n';
  exception when others then r := r || 'OK user sin finanzas no inserta gastos' || E'\n'; end;
  begin insert into public.mano_obra (descripcion,monto) values ('x',1); r := r || 'FAIL: user sin finanzas insertó mano obra' || E'\n';
  exception when others then r := r || 'OK user sin finanzas no inserta mano obra' || E'\n'; end;
  begin j := public.resumen_periodo(); r := r || 'FAIL: user sin finanzas ve resumen' || E'\n';
  exception when others then r := r || 'OK resumen negado' || E'\n'; end;
  j := public.cerrar_periodo('loquesea'); r := r || 'user sin cierre (esperado ok:false) -> ' || j::text || E'\n';
  begin update public.perfiles set puede_finanzas = true where id = fu; r := r || 'FAIL: se dio finanzas a sí mismo' || E'\n';
  exception when others then r := r || 'OK no cambia sus permisos' || E'\n'; end;
  begin update public.perfiles set herreria_id = 2 where id = fu; r := r || 'FAIL: cambió su herreria' || E'\n';
  exception when others then r := r || 'OK no cambia su herreria' || E'\n'; end;
  update public.perfiles set tema = 'claro' where id = ff; get diagnostics n = row_count; r := r || 'F user cambia tema de otro filas (esperado 0): ' || n || E'\n';
  update public.perfiles set tema = 'claro' where id = fu; get diagnostics n = row_count; r := r || 'F user cambia su tema filas (esperado 1): ' || n || E'\n';
  select count(*) into n from public.perfiles; r := r || 'F user ve perfiles (esperado 1): ' || n || E'\n';
  begin perform clave_cierre_hash from public.herrerias; r := r || 'FAIL: leyó hash' || E'\n';
  exception when others then r := r || 'OK hash no legible' || E'\n'; end;
  begin update public.lotes set cierre_id = gen_random_uuid() where id = l1; r := r || 'FAIL: cambió cierre_id' || E'\n';
  exception when others then r := r || 'OK cierre_id no editable' || E'\n'; end;
  execute 'reset role';

  -- Usuario de Famoso con Finanzas (sin cierre)
  perform set_config('request.jwt.claims', json_build_object('sub',ff,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.gastos_lote (lote_id,perfileria,vidrio) values (l1,210,85);
  insert into public.mano_obra (descripcion, monto, herreria_id) values ('pago', 100, 2);
  select count(*) into n from public.mano_obra where herreria_id = 1; r := r || 'mano obra quedó en Famoso (esperado 1): ' || n || E'\n';
  j := public.resumen_periodo();
  r := r || 'resumen vendido=' || (j->>'total_vendido') || ' perf=' || (j->>'total_perfileria') || ' vid=' || (j->>'total_vidrio')
        || ' mo=' || (j->>'total_mano_obra') || ' ganancia (esperado 208)=' || (j->>'ganancia') || E'\n';
  j := public.cerrar_periodo('x'); r := r || 'finanzas sin cierre (esperado ok:false) -> ' || j::text || E'\n';
  begin perform public.establecer_clave_cierre('secreta1'); r := r || 'FAIL: no-admin creó clave' || E'\n';
  exception when others then r := r || 'OK no-admin no crea clave' || E'\n'; end;
  execute 'reset role';

  -- Admin de Famoso
  perform set_config('request.jwt.claims', json_build_object('sub',fa,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.establecer_clave_cierre('secreta1');
  select count(*) into n from public.lotes where herreria_id = 2; r := r || 'Admin F ve lotes de A (esperado 0): ' || n || E'\n';
  select count(*) into n from public.perfiles; r := r || 'Admin F ve perfiles (esperado 4 activos+inactivo de Famoso = 5): ' || n || E'\n';
  execute 'reset role';

  -- Usuario de Famoso con permiso de cierre
  perform set_config('request.jwt.claims', json_build_object('sub',fc,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  j := public.cerrar_periodo('mala'); r := r || 'clave mala (esperado ok:false) -> ' || j::text || E'\n';
  j := public.cerrar_periodo('secreta1'); r := r || 'clave buena (esperado true) -> ' || (j->>'ok') || E'\n';
  update public.lotes set cliente = 'cambio' where id = l1; get diagnostics n = row_count; r := r || 'editar lote cerrado filas (esperado 0): ' || n || E'\n';
  update public.ventanas set precio_total = 1 where lote_id = l1; get diagnostics n = row_count; r := r || 'editar ventana cerrada filas (esperado 0): ' || n || E'\n';
  update public.gastos_lote set vidrio = 1 where lote_id = l1; get diagnostics n = row_count; r := r || 'editar gasto cerrado filas (esperado 0): ' || n || E'\n';
  update public.mano_obra set monto = 1; get diagnostics n = row_count; r := r || 'editar mano obra cerrada filas (esperado 0): ' || n || E'\n';
  delete from public.lotes where id = l1; get diagnostics n = row_count; r := r || 'borrar lote cerrado filas (esperado 0): ' || n || E'\n';
  begin insert into public.ventanas (lote_id,cantidad,sistema,color,alto,ancho) values (l1,1,'ecobel','negro',100,100); r := r || 'FAIL: agregó ventana a lote cerrado' || E'\n';
  exception when others then r := r || 'OK no agrega ventana a lote cerrado' || E'\n'; end;
  select ganancia into x from public.cierres; r := r || 'cierre guardado ganancia (esperado 208): ' || x || E'\n';
  insert into public.lotes (cliente) values ('nuevo') returning id into l4;
  select numero into n from public.lotes where id = l4; r := r || 'lote tras cierre num (esperado 4): ' || n || E'\n';
  j := public.resumen_periodo(); r := r || 'nuevo período vendido (esperado 0): ' || (j->>'total_vendido') || E'\n';
  execute 'reset role';

  -- Usuario inactivo
  perform set_config('request.jwt.claims', json_build_object('sub',fi,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.lotes; r := r || 'Inactivo ve lotes (esperado 0): ' || n || E'\n';
  begin insert into public.lotes (cliente) values ('x'); r := r || 'FAIL: inactivo creó lote' || E'\n';
  exception when others then r := r || 'OK inactivo no crea lote' || E'\n'; end;
  execute 'reset role';

  raise exception E'REPORTE (todo se deshace)\n%', r;
end $$;
