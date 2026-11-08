-- Datos sintéticos dentro de una transacción: no conserva reservas ni envía push.
begin;

do $$
declare
  v_base public.reservas%rowtype;
  v_reserva uuid;
  v_aviso_taxista uuid;
  v_aviso_cliente uuid;
  v_filas integer;
begin
  select * into v_base from public.reservas limit 1;
  if v_base.id is null then
    raise exception 'Se requiere una reserva existente para las relaciones de prueba.';
  end if;
  if has_function_privilege('anon', 'public.obtener_reserva_taxista(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.obtener_reserva_taxista(uuid)', 'execute') then
    raise exception 'Permisos incorrectos en la consulta puntual.';
  end if;

  insert into public.reservas (cliente_id, taxista_id, vehiculo_id, estado, fecha_hora_reserva)
  values (v_base.cliente_id, v_base.taxista_id, v_base.vehiculo_id, 'pendiente', '2000-01-01')
  returning id into v_reserva;
  -- Supera el límite de la lista sin depender de cuántos viajes reales existen.
  insert into public.reservas (cliente_id, taxista_id, vehiculo_id, estado, fecha_hora_reserva)
  select v_base.cliente_id, v_base.taxista_id, v_base.vehiculo_id, 'completada', now()
  from generate_series(1, 201);
  insert into public.notificaciones (usuario_id, reserva_id, tipo, titulo, mensaje)
  values (v_base.taxista_id, v_reserva, 'reserva_solicitada', 'Prueba SQL', 'No enviar')
  returning id into v_aviso_taxista;
  insert into public.notificaciones (usuario_id, reserva_id, tipo, titulo, mensaje)
  values (v_base.cliente_id, v_reserva, 'reserva_aceptada', 'Prueba SQL', 'No enviar')
  returning id into v_aviso_cliente;

  perform set_config('request.jwt.claim.sub', v_base.taxista_id::text, true);
  set local role authenticated;
  if exists (select 1 from public.obtener_reservas_taxista() where id = v_reserva) then
    raise exception 'La reserva antigua sigue dentro del límite de la lista.';
  end if;
  if (select count(*) from public.obtener_reserva_taxista(v_reserva)) <> 1 then
    raise exception 'No se puede abrir la reserva propia fuera de los últimos 200.';
  end if;
  if exists (select 1 from public.obtener_reserva_taxista(gen_random_uuid())) then
    raise exception 'Una reserva inexistente devolvió información.';
  end if;
  if not exists (select 1 from public.notificaciones where id = v_aviso_taxista)
     or exists (select 1 from public.notificaciones where id = v_aviso_cliente) then
    raise exception 'RLS de notificaciones no aísla al taxista.';
  end if;
  update public.notificaciones set leida = true where id = v_aviso_taxista and usuario_id = v_base.taxista_id;
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then raise exception 'El taxista no puede marcar su aviso como leído.'; end if;
  update public.notificaciones set leida = true where id = v_aviso_cliente;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then raise exception 'El taxista pudo marcar el aviso del cliente.'; end if;

  perform set_config('request.jwt.claim.sub', v_base.cliente_id::text, true);
  if exists (select 1 from public.obtener_reserva_taxista(v_reserva)) then
    raise exception 'El cliente obtuvo datos exclusivos del taxista.';
  end if;
  if not exists (select 1 from public.reservas where id = v_reserva and cliente_id = v_base.cliente_id)
     or not exists (select 1 from public.notificaciones where id = v_aviso_cliente)
     or exists (select 1 from public.notificaciones where id = v_aviso_taxista) then
    raise exception 'El cliente no puede abrir su reserva o ve avisos ajenos.';
  end if;
  update public.notificaciones set leida = true where id = v_aviso_cliente and usuario_id = v_base.cliente_id;
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then raise exception 'El cliente no puede marcar su aviso como leído.'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  if exists (select 1 from public.obtener_reserva_taxista(v_reserva))
     or exists (select 1 from public.notificaciones where id in (v_aviso_cliente, v_aviso_taxista)) then
    raise exception 'Otra cuenta puede consultar datos del aviso.';
  end if;
  perform set_config('request.jwt.claim.sub', '', true);
  if exists (select 1 from public.obtener_reserva_taxista(v_reserva)) then
    raise exception 'La consulta puntual devolvió datos sin sesión.';
  end if;
  reset role;

  update public.reservas set estado = 'completada' where id = v_reserva;
  perform set_config('request.jwt.claim.sub', v_base.taxista_id::text, true);
  set local role authenticated;
  if not exists (select 1 from public.obtener_reserva_taxista(v_reserva)
                 where estado = 'completada' and telefono_cliente is null) then
    raise exception 'El historial no refleja el estado actual o expone el teléfono.';
  end if;
  reset role;
end;
$$;

select 1 as validacion_apertura_push;
rollback;
