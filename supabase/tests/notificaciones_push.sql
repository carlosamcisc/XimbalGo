-- Ejecutar después de aplicar 20261105140000_base_notificaciones_push.sql.
-- Requiere dos usuarios existentes; todas las escrituras se revierten.
begin;
do $$
declare
  v_usuario uuid;
  v_otro uuid;
  v_dispositivo uuid := gen_random_uuid();
  v_instalacion uuid := gen_random_uuid();
  v_notificacion uuid;
  v_token text := 'ExpoPushToken[' || replace(gen_random_uuid()::text, '-', '') || ']';
  v_total integer;
begin
  select id into v_usuario from public.usuarios order by id limit 1;
  select id into v_otro from public.usuarios where id <> v_usuario order by id limit 1;
  if v_otro is null then raise exception 'Se requieren dos usuarios para probar RLS.'; end if;

  if has_table_privilege('anon', 'public.dispositivos_push', 'select')
     or has_table_privilege('authenticated', 'public.envios_push', 'select')
     or has_table_privilege('authenticated', 'public.envios_push', 'insert')
     or has_table_privilege('authenticated', 'public.envios_push', 'update')
     or has_table_privilege('authenticated', 'public.envios_push', 'delete') then
    raise exception 'Permisos de tablas incorrectos.';
  end if;

  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  set local role authenticated;
  insert into public.dispositivos_push
    (id, usuario_id, instalacion_id, expo_push_token, plataforma, proyecto_id, entorno)
  values (v_dispositivo, v_usuario, v_instalacion, v_token, 'android',
    '4cd2f8ae-8267-4756-a608-c7fe9711ccc4', 'development');
  if not exists (select 1 from public.dispositivos_push where id = v_dispositivo) then
    raise exception 'El propietario no puede leer su dispositivo.';
  end if;
  update public.dispositivos_push set activo = false where id = v_dispositivo;
  get diagnostics v_total = row_count;
  if v_total <> 1 then raise exception 'El propietario no puede desactivar su dispositivo.'; end if;

  begin
    update public.dispositivos_push set usuario_id = v_otro where id = v_dispositivo;
    raise exception 'Se permitió transferir el dispositivo.';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.dispositivos_push
      (usuario_id, instalacion_id, expo_push_token, plataforma, proyecto_id, entorno)
    values (v_otro, gen_random_uuid(), 'ExpoPushToken[ajeno]', 'ios',
      gen_random_uuid(), 'development');
    raise exception 'Se permitió registrar dispositivos para otro usuario.';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_otro::text, true);
  if exists (select 1 from public.dispositivos_push where id = v_dispositivo) then
    raise exception 'Otro usuario puede ver el token.';
  end if;
  update public.dispositivos_push set activo = true where id = v_dispositivo;
  get diagnostics v_total = row_count;
  if v_total <> 0 then raise exception 'Otro usuario puede modificar el dispositivo.'; end if;
  delete from public.dispositivos_push where id = v_dispositivo;
  get diagnostics v_total = row_count;
  if v_total <> 0 then raise exception 'Otro usuario puede borrar el dispositivo.'; end if;
  reset role;

  insert into public.notificaciones (usuario_id, titulo, mensaje, tipo)
  values (v_usuario, 'Prueba push', 'Se revierte al terminar.', 'reserva_aceptada')
  returning id into v_notificacion;
  set local role service_role;
  -- El trigger de notificaciones ya lo crea desde la parte 3. En la parte 1
  -- el dispositivo de esta prueba está inactivo, por lo que se inserta aquí.
  insert into public.envios_push (notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
  select v_notificacion, id, expo_push_token, proyecto_id, entorno
  from public.dispositivos_push where id = v_dispositivo;
  begin
    insert into public.envios_push (notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
    select v_notificacion, id, expo_push_token, proyecto_id, entorno
    from public.dispositivos_push where id = v_dispositivo;
    raise exception 'Se permitió duplicar un envío para el mismo dispositivo.';
  exception when unique_violation then null;
  end;
  reset role;

  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  set local role authenticated;
  delete from public.dispositivos_push where id = v_dispositivo;
  get diagnostics v_total = row_count;
  if v_total <> 1 then raise exception 'El propietario no puede eliminar su dispositivo.'; end if;
  reset role;
  if exists (select 1 from public.envios_push
    where notificacion_id = v_notificacion and dispositivo_id = v_dispositivo) then
    raise exception 'Eliminar el dispositivo no eliminó sus envíos.';
  end if;
end;
$$;
rollback;
