-- PostgreSQL real, sin red: todas las filas y cambios se revierten.
begin;
do $$
declare
  v_usuario uuid;
  v_otro uuid;
  v_proyecto uuid := gen_random_uuid();
  v_dev uuid := gen_random_uuid();
  v_preview uuid := gen_random_uuid();
  v_ajeno uuid := gen_random_uuid();
  v_inactivo uuid := gen_random_uuid();
  v_nueva_instalacion uuid := gen_random_uuid();
  v_notificacion uuid;
  v_segunda uuid;
  v_trabajo record;
  v_recibo record;
  v_bloqueo_anterior uuid;
  v_total integer;
begin
  select id into v_usuario from public.usuarios order by id limit 1;
  select id into v_otro from public.usuarios where id <> v_usuario order by id limit 1;
  if v_otro is null then raise exception 'Se requieren dos usuarios.'; end if;

  if has_function_privilege('authenticated', 'public.reclamar_envios_push(uuid,text,boolean,integer)', 'execute')
    or has_function_privilege('anon', 'public.resolver_envio_push(uuid,uuid,text,text,text)', 'execute')
    or has_function_privilege('authenticated', 'public.invocar_procesador_push()', 'execute')
    or not has_function_privilege('service_role', 'public.reclamar_envios_push(uuid,text,boolean,integer)', 'execute') then
    raise exception 'Permisos de funciones incorrectos.';
  end if;

  insert into public.dispositivos_push(id, usuario_id, instalacion_id, expo_push_token, plataforma, proyecto_id, entorno, activo)
  values
    (v_dev, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_dev || ']', 'android', v_proyecto, 'development', true),
    (v_preview, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_preview || ']', 'ios', v_proyecto, 'preview', true),
    (v_ajeno, v_otro, gen_random_uuid(), 'ExpoPushToken[' || v_ajeno || ']', 'android', v_proyecto, 'development', true),
    (v_inactivo, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_inactivo || ']', 'android', v_proyecto, 'development', false);

  insert into public.notificaciones(usuario_id, titulo, mensaje, tipo)
  values (v_usuario, 'Prueba', 'Se revierte.', 'reserva_aceptada') returning id into v_notificacion;
  select count(*) into v_total from public.envios_push where notificacion_id = v_notificacion and proyecto_id = v_proyecto;
  if v_total <> 2 then raise exception 'El trigger no creó un trabajo por dispositivo activo del destinatario.'; end if;

  insert into public.dispositivos_push(id, usuario_id, instalacion_id, expo_push_token, plataforma, proyecto_id, entorno)
  values (v_nueva_instalacion, v_usuario, gen_random_uuid(), 'ExpoPushToken[' || v_nueva_instalacion || ']', 'ios', v_proyecto, 'production');
  if exists (select 1 from public.envios_push where dispositivo_id = v_nueva_instalacion) then
    raise exception 'Se encolaron notificaciones históricas al registrar un dispositivo.';
  end if;

  set local role service_role;
  select count(*) into v_total from public.reclamar_envios_push(v_proyecto, 'production');
  if v_total <> 0 then raise exception 'Se mezclaron entornos.'; end if;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  if v_trabajo.id is null then raise exception 'No se reclamó el trabajo development.'; end if;
  begin
    perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'confirmado');
    raise exception 'Se confirmó un trabajo que todavía no fue enviado.';
  exception when sqlstate '22023' then null;
  end;
  select count(*) into v_total from public.reclamar_envios_push(v_proyecto, 'development');
  if v_total <> 0 then raise exception 'Se reclamó un trabajo con bloqueo vigente.'; end if;
  if public.resolver_envio_push(v_trabajo.id, gen_random_uuid(), 'error') then
    raise exception 'Un trabajador ajeno pudo resolver el trabajo.';
  end if;
  reset role;

  v_bloqueo_anterior := v_trabajo.bloqueo_id;
  update public.envios_push set bloqueado_hasta = now() - interval '1 second' where id = v_trabajo.id;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  if v_trabajo.bloqueo_id = v_bloqueo_anterior then raise exception 'No se renovó el bloqueo vencido.'; end if;
  if public.resolver_envio_push(v_trabajo.id, v_bloqueo_anterior, 'error') then
    raise exception 'Un trabajador vencido modificó el resultado.';
  end if;
  perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'reintentar', null, 'ExpoHttp503');
  if not exists (select 1 from public.envios_push where id = v_trabajo.id and estado = 'pendiente'
    and proximo_intento_en > now() and intentos = 2) then raise exception 'No se programó backoff.'; end if;
  select count(*) into v_total from public.reclamar_envios_push(v_proyecto, 'development');
  if v_total <> 0 then raise exception 'Se ignoró el backoff.'; end if;

  update public.envios_push set proximo_intento_en = now() where id = v_trabajo.id;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'enviado', 'ticket-prueba');
  select count(*) into v_total from public.reclamar_envios_push(v_proyecto, 'development', true);
  if v_total <> 0 then raise exception 'No se respetó la espera de recibos.'; end if;
  update public.envios_push set proximo_intento_en = now() where id = v_trabajo.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  perform public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'esperar_recibo', null, 'ReciboNoDisponible');
  if not exists (select 1 from public.envios_push where id = v_recibo.id and estado = 'enviado') then
    raise exception 'Un recibo pendiente volvió a encolar el envío.';
  end if;
  update public.envios_push set proximo_intento_en = now() where id = v_recibo.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  perform public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'reintentar', null, 'MessageRateExceeded');
  if not exists (select 1 from public.envios_push where id = v_recibo.id and estado = 'pendiente'
    and ticket_expo is null and enviado_en is null) then
    raise exception 'El error temporal del proveedor no liberó el ticket para un nuevo envío.';
  end if;
  update public.envios_push set proximo_intento_en = now() where id = v_recibo.id;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'enviado', 'ticket-reintento');
  update public.envios_push set proximo_intento_en = now() where id = v_trabajo.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  perform public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'confirmado');
  if not exists (select 1 from public.envios_push where id = v_recibo.id and estado = 'confirmado' and confirmado_en is not null) then
    raise exception 'No se conservó la confirmación del recibo.';
  end if;

  -- Un recibo del token antiguo no debe invalidar el nuevo token.
  insert into public.notificaciones(usuario_id, titulo, mensaje, tipo)
  values (v_usuario, 'Prueba rotación', 'Se revierte.', 'reserva_aceptada') returning id into v_segunda;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'enviado', 'ticket-antiguo');
  update public.envios_push set proximo_intento_en = now() where id = v_trabajo.id;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto, 'development', true);
  update public.dispositivos_push set expo_push_token = 'ExpoPushToken[rotado-' || v_dev || ']' where id = v_dev;
  if public.resolver_envio_push(v_recibo.id, v_recibo.bloqueo_id, 'dispositivo_invalido') then
    raise exception 'Se aceptó un recibo posterior a la rotación.';
  end if;
  if not exists (select 1 from public.dispositivos_push where id = v_dev and activo) then
    raise exception 'Un recibo antiguo desactivó el token nuevo.';
  end if;

  insert into public.notificaciones(usuario_id, titulo, mensaje, tipo)
  values (v_usuario, 'Prueba token inválido', 'Se revierte.', 'reserva_aceptada');
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto, 'development');
  perform public.resolver_envio_push(v_trabajo.id, v_trabajo.bloqueo_id, 'dispositivo_invalido', null, 'DeviceNotRegistered');
  if exists (select 1 from public.dispositivos_push where id = v_dev and activo) then
    raise exception 'No se desactivó el token inválido.';
  end if;

  -- Manipulaciones administrativas tampoco eluden la verificación de dueño.
  insert into public.envios_push(notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
  select v_notificacion, id, expo_push_token, proyecto_id, entorno from public.dispositivos_push where id = v_ajeno;
  perform public.reclamar_envios_push(v_proyecto, 'development');
  if not exists (select 1 from public.envios_push where notificacion_id = v_notificacion
    and dispositivo_id = v_ajeno and estado = 'cancelado') then raise exception 'Se aceptó un destinatario ajeno.'; end if;

  update public.envios_push set intentos = 6 where proyecto_id = v_proyecto and entorno = 'preview';
  perform public.reclamar_envios_push(v_proyecto, 'preview');
  if exists (select 1 from public.envios_push where proyecto_id = v_proyecto and entorno = 'preview' and estado <> 'error') then
    raise exception 'No se limitó el número de intentos.';
  end if;
  update public.notificaciones set fecha_envio = now() - interval '3 hours' where id = v_segunda;
  perform public.reclamar_envios_push(v_proyecto, 'production');
  if not exists (select 1 from public.envios_push where notificacion_id = v_segunda
    and entorno = 'production' and estado = 'error' and ultimo_error = 'EnvioVencido') then
    raise exception 'No se descartó el aviso vencido.';
  end if;

  begin
    perform public.reclamar_envios_push(v_proyecto, 'invalido');
    raise exception 'Se aceptó un entorno inválido.';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.reclamar_envios_push(v_proyecto, 'development', false, 101);
    raise exception 'Se aceptó un lote excesivo.';
  exception when sqlstate '22023' then null;
  end;
end;
$$;
rollback;
