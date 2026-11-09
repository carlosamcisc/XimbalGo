-- Usa dispositivos de un proyecto aleatorio. ROLLBACK restaura las preferencias
-- de las cuentas prestadas como fixture y elimina todos los avisos de prueba.
begin;
do $$
declare
  v_usuario uuid; v_otro uuid; v_proyecto uuid := gen_random_uuid();
  v_dev uuid := gen_random_uuid(); v_preview uuid := gen_random_uuid();
  v_aviso uuid; v_pendiente uuid; v_silenciado uuid; v_ajeno uuid;
  v_job record; v_recibo record; v_pref record; v_tipo text; v_total integer;
begin
  select id into v_usuario from public.usuarios order by id limit 1;
  select id into v_otro from public.usuarios where id <> v_usuario order by id limit 1;
  if v_otro is null then raise exception 'Se necesitan dos usuarios.'; end if;
  delete from public.preferencias_notificaciones where usuario_id in (v_usuario, v_otro);
  if has_table_privilege('anon', 'public.preferencias_notificaciones', 'select')
     or has_function_privilege('anon', 'public.guardar_preferencia_push(uuid,text,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.permite_notificacion_push(uuid,text)', 'execute')
     or has_function_privilege('service_role', 'public.reclamar_envios_push_base(uuid,text,boolean,integer)', 'execute') then
    raise exception 'Permisos públicos indebidos.';
  end if;
  insert into public.dispositivos_push (id, usuario_id, instalacion_id, expo_push_token, plataforma, proyecto_id, entorno)
  values (v_dev, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_dev || ']', 'android', v_proyecto, 'development'),
    (v_preview, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_preview || ']', 'ios', v_proyecto, 'preview');
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  values (v_usuario, 'reserva_aceptada', 'SQL: valor predeterminado', 'ROLLBACK') returning id into v_aviso;
  if (select count(*) from public.envios_push where notificacion_id = v_aviso and proyecto_id = v_proyecto) <> 2 then
    raise exception 'La ausencia de preferencias impide avisos existentes.';
  end if;
  select * into v_job from public.reclamar_envios_push(v_proyecto, 'development');
  perform public.resolver_envio_push(v_job.id, v_job.bloqueo_id, 'enviado', 'ticket-preferencias');
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  values (v_usuario, 'reserva_solicitada', 'SQL: en cola', 'ROLLBACK') returning id into v_pendiente;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development');

  insert into public.preferencias_notificaciones (usuario_id) values (v_otro);
  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  set local role authenticated;
  select * into v_pref from public.guardar_preferencia_push(v_usuario, 'push_habilitado', false);
  if v_pref.push_habilitado or not v_pref.reservas or not v_pref.llegada or not v_pref.viajes then
    raise exception 'No se conservan los valores predeterminados al crear preferencias.';
  end if;
  if exists (select 1 from public.preferencias_notificaciones where usuario_id = v_otro) then
    raise exception 'RLS expone preferencias de otro usuario.';
  end if;
  update public.preferencias_notificaciones set llegada = false where usuario_id = v_otro;
  get diagnostics v_total = row_count;
  if v_total <> 0 then raise exception 'Se modificaron preferencias ajenas.'; end if;
  begin
    perform public.guardar_preferencia_push(v_otro, 'push_habilitado', false);
    raise exception 'La RPC aceptó otra cuenta.';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.preferencias_notificaciones (usuario_id) values (gen_random_uuid());
    raise exception 'RLS permitió crear preferencias ajenas.';
  exception when insufficient_privilege then null; end;
  begin
    update public.preferencias_notificaciones set usuario_id = v_otro where usuario_id = v_usuario;
    raise exception 'Se permitió transferir preferencias.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.guardar_preferencia_push(v_usuario, 'campo_invalido', true);
    raise exception 'Se aceptó un campo arbitrario.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.guardar_preferencia_push(v_usuario, 'reservas', null);
    raise exception 'Se aceptó una preferencia nula.';
  exception when invalid_parameter_value then null; end;
  reset role;

  if exists (select 1 from public.envios_push where notificacion_id = v_pendiente and estado <> 'cancelado')
     or exists (select 1 from public.envios_push where notificacion_id = v_pendiente and bloqueo_id is not null) then
    raise exception 'Desactivar push no canceló pendientes/procesando en todos los teléfonos y entornos.';
  end if;
  if public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'enviado', 'ticket-tardio') then
    raise exception 'Se aceptó el resultado del envío cancelado.';
  end if;
  if not exists (select 1 from public.envios_push where id = v_job.id and estado = 'enviado') then
    raise exception 'Desactivar preferencias canceló los recibos de envíos ya aceptados.';
  end if;
  update public.envios_push set proximo_intento_en = now() where id = v_job.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  if v_recibo.id is distinct from v_job.id then raise exception 'No se pueden consultar recibos silenciados.'; end if;
  perform public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'confirmado');

  foreach v_tipo in array array['reserva_solicitada', 'reserva_aceptada', 'reserva_rechazada',
      'reserva_cancelada', 'asientos_ofrecidos', 'van_llegando', 'cliente_abordo', 'viaje_completado'] loop
    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
    values (v_usuario, v_tipo, 'SQL: todo silenciado', 'ROLLBACK') returning id into v_silenciado;
    if exists (select 1 from public.envios_push where notificacion_id = v_silenciado) then
      raise exception 'El interruptor general no bloqueó %.', v_tipo;
    end if;
  end loop;
  if not exists (select 1 from public.notificaciones where id = v_silenciado) then
    raise exception 'Silenciar push borró el aviso de la bandeja.';
  end if;
  if exists (select 1 from public.dispositivos_push where id in (v_dev, v_preview) and not activo) then
    raise exception 'Silenciar desactivó los tokens.';
  end if;
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
  values (v_otro, 'reserva_aceptada', 'SQL: otro usuario', 'ROLLBACK') returning id into v_ajeno;
  if not public.permite_notificacion_push(v_otro, 'reserva_aceptada') then
    raise exception 'Se silenciaron preferencias de otra cuenta.';
  end if;

  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  set local role authenticated;
  perform public.guardar_preferencia_push(v_usuario, 'reservas', false);
  perform public.guardar_preferencia_push(v_usuario, 'llegada', false);
  select * into v_pref from public.guardar_preferencia_push(v_usuario, 'push_habilitado', true);
  if not v_pref.push_habilitado or v_pref.reservas or v_pref.llegada or not v_pref.viajes then
    raise exception 'La actualización parcial sobrescribió otras elecciones.';
  end if;
  if not exists (select 1 from public.notificaciones where id = v_silenciado) then
    raise exception 'RLS no permite ver los avisos silenciados propios.';
  end if;
  update public.notificaciones set leida = true where id = v_silenciado and usuario_id = v_usuario;
  get diagnostics v_total = row_count;
  if v_total <> 1 then raise exception 'No se puede marcar como leído un aviso silenciado.'; end if;
  reset role;
  if exists (select 1 from public.envios_push where notificacion_id = v_silenciado) then
    raise exception 'Reactivar reenvió avisos históricos.';
  end if;
  foreach v_tipo in array array['reserva_solicitada', 'reserva_aceptada', 'reserva_rechazada',
      'reserva_cancelada', 'asientos_ofrecidos', 'van_llegando', 'cliente_abordo', 'viaje_completado'] loop
    insert into public.notificaciones (usuario_id, tipo, titulo, mensaje)
    values (v_usuario, v_tipo, 'SQL: categorías', 'ROLLBACK') returning id into v_aviso;
    select count(*) into v_total from public.envios_push where notificacion_id = v_aviso and proyecto_id = v_proyecto;
    if v_total <> (case when v_tipo in ('cliente_abordo', 'viaje_completado') then 2 else 0 end) then
      raise exception 'Clasificación de categorías incorrecta para %.', v_tipo;
    end if;
  end loop;
  select * into v_job from public.reclamar_envios_push(v_proyecto, 'development', false, 1);
  if v_job.id is null then raise exception 'No se reclamó el aviso de avance del viaje.'; end if;
  perform public.resolver_envio_push(v_job.id, v_job.bloqueo_id, 'enviado', 'ticket-silenciado-despues');
  update public.preferencias_notificaciones set viajes = false where usuario_id = v_usuario;
  update public.envios_push set proximo_intento_en = now() where id = v_job.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  perform public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'reintentar', null, 'MessageRateExceeded');
  update public.envios_push set proximo_intento_en = now() where id = v_job.id;
  select count(*) into v_total from public.reclamar_envios_push(v_proyecto, 'development');
  if v_total <> 0 or not exists (select 1 from public.envios_push where id = v_job.id and estado = 'cancelado'
                    and ultimo_error = 'PreferenciaDesactivada') then
    raise exception 'Un reintento de recibo ignoró las preferencias actuales.';
  end if;

  -- Incluso una inserción administrativa en la cola se revalida al reclamar.
  insert into public.envios_push (notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
  select v_silenciado, d.id, d.expo_push_token, d.proyecto_id, d.entorno
  from public.dispositivos_push d where d.id = v_dev;
  if exists (select 1 from public.reclamar_envios_push(v_proyecto, 'development')) then
    raise exception 'La reclamación permitió un trabajo agregado manualmente para una categoría silenciada.';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  begin
    perform public.guardar_preferencia_push(v_usuario, 'reservas', true);
    raise exception 'Se guardaron preferencias sin sesión.';
  exception when insufficient_privilege then null; end;
  reset role;
end;
$$;
select 1 as validacion_preferencias_notificaciones;
rollback;
