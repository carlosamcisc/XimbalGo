-- Ejecutar con: supabase db query --linked --file scripts/test-mapa-taxista.sql
-- Las cuentas y reservas sintéticas se eliminan siempre con ROLLBACK.
begin;
do $$
declare
  conductor uuid := gen_random_uuid(); otro_conductor uuid := gen_random_uuid();
  cliente uuid := gen_random_uuid(); otro_cliente uuid := gen_random_uuid();
  ruta uuid := gen_random_uuid(); parada uuid := gen_random_uuid(); ajena uuid := gen_random_uuid();
  vehiculo uuid := gen_random_uuid(); reserva uuid := gen_random_uuid(); mapa jsonb;
  denegada boolean;
begin
  assert not has_table_privilege('authenticated','public.ubicaciones_reserva','SELECT');
  assert not has_table_privilege('anon','public.ubicaciones_reserva','SELECT');
  assert not has_function_privilege('anon','public.obtener_mapa_taxista(uuid,uuid)','EXECUTE');
  assert not has_function_privilege('anon','public.compartir_ubicacion_reserva(uuid,double precision,double precision,boolean)','EXECUTE');
  insert into public.rutas(id,nombre,origen,destino,precio_base) values (ruta,'Prueba mapa','A','B',10);
  insert into public.paraderos(id,nombre,ubicacion) values
    (parada,'Parada prueba',public.st_setsrid(public.st_makepoint(-89.63,20.98),4326)::public.geography),
    (ajena,'Fuera de la ruta',public.st_setsrid(public.st_makepoint(-89.62,20.97),4326)::public.geography);
  insert into auth.users(id,email,raw_user_meta_data) values
    (conductor,conductor::text || '@example.invalid',jsonb_build_object('rol_id',2,'nombres','Prueba','apellidos','Mapa','ruta_id',ruta)),
    (otro_conductor,otro_conductor::text || '@example.invalid',jsonb_build_object('rol_id',2,'nombres','Otro','apellidos','Mapa','ruta_id',ruta)),
    (cliente,cliente::text || '@example.invalid',jsonb_build_object('rol_id',3,'nombres','Cliente','apellidos','Mapa')),
    (otro_cliente,otro_cliente::text || '@example.invalid',jsonb_build_object('rol_id',3,'nombres','Otro','apellidos','Mapa'));
  update public.taxistas set taxista_activo = true, ubicacion_actualizada_en = now(),
    ubicacion_actual = public.st_setsrid(public.st_makepoint(-89.60,20.95),4326)::public.geography where id = conductor;
  insert into public.vehiculos(id,taxista_id,matricula) values (vehiculo,conductor,'TEST-' || substr(vehiculo::text,1,8));
  insert into public.reservas(id,cliente_id,taxista_id,vehiculo_id,ruta_id,estado,ubicacion_origen)
    values (reserva,cliente,conductor,vehiculo,ruta,'aceptada',
      public.st_setsrid(public.st_makepoint(-89.62,20.97),4326)::public.geography);

  perform set_config('request.jwt.claim.sub',conductor::text,true);
  perform public.configurar_paraderos_taxista(array[parada]);
  mapa := public.obtener_mapa_taxista(reserva);
  assert mapa->'destino'->>'id' = parada::text;
  assert jsonb_array_length(mapa->'paraderos') = 1;
  assert mapa->'cliente' = 'null'::jsonb;
  assert (mapa->'taxi'->'coordenadas'->>'longitud')::numeric = -89.60;
  denegada := false;
  begin perform public.obtener_mapa_taxista(reserva,ajena); exception when insufficient_privilege then denegada := true; end;
  assert denegada, 'No debe aceptar un paradero ajeno a la ruta';
  denegada := false;
  begin perform public.configurar_paraderos_taxista(array[parada,parada]); exception when invalid_parameter_value then denegada := true; end;
  assert denegada, 'No debe aceptar paraderos repetidos';
  denegada := false;
  begin perform public.configurar_paraderos_taxista(array[gen_random_uuid()]); exception when invalid_parameter_value then denegada := true; end;
  assert denegada, 'No debe aceptar paraderos inexistentes';

  perform set_config('request.jwt.claim.sub',otro_cliente::text,true);
  denegada := false;
  begin perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62); exception when insufficient_privilege then denegada := true; end;
  assert denegada, 'Otro cliente no debe enviar ubicación';
  perform set_config('request.jwt.claim.sub',cliente::text,true);
  perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62);
  perform set_config('request.jwt.claim.sub',otro_conductor::text,true);
  denegada := false;
  begin perform public.obtener_mapa_taxista(reserva); exception when insufficient_privilege then denegada := true; end;
  assert denegada, 'Otro conductor no debe ver la reserva';
  perform set_config('request.jwt.claim.sub',conductor::text,true);
  mapa := public.obtener_mapa_taxista(reserva);
  assert (mapa->'cliente'->'coordenadas'->>'latitud')::numeric = 20.97;
  update public.ubicaciones_reserva set actualizada_en = now() - interval '46 seconds' where reserva_id = reserva;
  assert public.obtener_mapa_taxista(reserva)->'cliente' = 'null'::jsonb, 'Ubicación caducada debe ocultarse';

  perform set_config('request.jwt.claim.sub',cliente::text,true);
  perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62);
  perform public.compartir_ubicacion_reserva(reserva,p_compartir => false);
  assert not exists (select 1 from public.ubicaciones_reserva where reserva_id = reserva);
  perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62);
  update public.reservas set abordado_en = now() where id = reserva;
  assert not exists (select 1 from public.ubicaciones_reserva where reserva_id = reserva), 'El abordaje debe borrar la ubicación';
  denegada := false;
  begin perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62); exception when insufficient_privilege then denegada := true; end;
  assert denegada;
  update public.reservas set abordado_en = null, estado = 'pendiente' where id = reserva;
  denegada := false;
  begin perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62); exception when insufficient_privilege then denegada := true; end;
  assert denegada, 'Una reserva pendiente no debe compartir';
  update public.reservas set estado = 'aceptada' where id = reserva;
  perform public.compartir_ubicacion_reserva(reserva,20.97,-89.62);
  update public.reservas set estado = 'cancelada_cliente' where id = reserva;
  assert not exists (select 1 from public.ubicaciones_reserva where reserva_id = reserva), 'Cancelar debe borrar la ubicación';
end;
$$;
rollback;
select 'Permisos, paraderos, caducidad, revocación y cierre: correctos; fixtures revertidos.' as resultado;
