-- Ejecutar con `supabase db query --linked --file ...` después de la migración.
-- Usa relaciones existentes para una reserva temporal; todo se revierte.
begin;
do $$
declare
  v_reserva public.reservas%rowtype;
  v_id uuid;
  v_fecha timestamptz;
  v_reintento timestamptz;
  v_total integer;
begin
  select * into v_reserva from public.reservas limit 1;
  if v_reserva.id is null then raise exception 'Se requiere una reserva para las relaciones de prueba.'; end if;
  insert into public.reservas(cliente_id, taxista_id, vehiculo_id, estado)
  values (v_reserva.cliente_id, v_reserva.taxista_id, v_reserva.vehiculo_id, 'pendiente')
  returning id into v_id;

  if has_function_privilege('anon', 'public.confirmar_abordaje_taxista(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.confirmar_abordaje_taxista(uuid)', 'execute')
     or has_column_privilege('authenticated', 'public.reservas', 'abordado_en', 'update') then
    raise exception 'Permisos incorrectos.';
  end if;

  perform set_config('request.jwt.claim.sub', v_reserva.taxista_id::text, true);
  begin
    perform public.confirmar_abordaje_taxista(v_id);
    raise exception 'Se permitió abordar una reserva pendiente.';
  exception when sqlstate '22023' then null;
  end;
  update public.reservas set estado = 'aceptada' where id = v_id;

  -- Otro taxista, el cliente y una sesión sin usuario no pueden confirmarla.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.confirmar_abordaje_taxista(v_id);
    raise exception 'Se permitió confirmar a otro usuario.';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claim.sub', v_reserva.cliente_id::text, true);
  begin
    perform public.confirmar_abordaje_taxista(v_id);
    raise exception 'Se permitió confirmar al cliente.';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.confirmar_abordaje_taxista(v_id);
    raise exception 'Se permitió confirmar sin sesión.';
  exception when sqlstate '22023' then null;
  end;

  perform set_config('request.jwt.claim.sub', v_reserva.taxista_id::text, true);
  v_fecha := public.confirmar_abordaje_taxista(v_id);
  v_reintento := public.confirmar_abordaje_taxista(v_id);
  if v_fecha is null or v_fecha is distinct from v_reintento then
    raise exception 'El reintento cambió la hora de abordaje.';
  end if;
  select count(*) into v_total from public.notificaciones
  where reserva_id = v_id and tipo = 'cliente_abordo' and usuario_id = v_reserva.cliente_id and not leida;
  if v_total <> 1 then raise exception 'El cliente no recibió exactamente un aviso sin leer.'; end if;
  perform set_config('request.jwt.claim.sub', v_reserva.cliente_id::text, true);
  set local role authenticated;
  if not exists (select 1 from public.reservas where id = v_id and abordado_en = v_fecha)
     or not exists (select 1 from public.notificaciones where reserva_id = v_id and tipo = 'cliente_abordo') then
    raise exception 'RLS oculta el abordaje o el aviso al cliente.';
  end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  if exists (select 1 from public.notificaciones where reserva_id = v_id and tipo = 'cliente_abordo') then
    raise exception 'RLS permite leer el aviso de otro cliente.';
  end if;
  reset role;
  perform set_config('request.jwt.claim.sub', v_reserva.taxista_id::text, true);
  if not exists (select 1 from public.obtener_reservas_taxista() where id = v_id and abordado_en = v_fecha) then
    raise exception 'La consulta del taxista no muestra el abordaje.';
  end if;
  if not exists (select 1 from public.reservas where id = v_id and estado = 'aceptada') then
    raise exception 'Confirmar el abordaje cambió el estado del viaje.';
  end if;

  begin
    perform public.actualizar_reserva_taxista(v_id, 'no_show');
    raise exception 'Se permitió no_show después de abordar.';
  exception when sqlstate '22023' then null;
  end;
  begin
    update public.reservas set estado = 'cancelada_cliente' where id = v_id;
    raise exception 'Se permitió cancelar al cliente después de abordar.';
  exception when sqlstate '22023' then null;
  end;
  perform public.actualizar_reserva_taxista(v_id, 'completada');
  if not exists (select 1 from public.reservas where id = v_id and estado = 'completada' and abordado_en = v_fecha) then
    raise exception 'Completar el viaje perdió el abordaje.';
  end if;
  begin
    perform public.confirmar_abordaje_taxista(v_id);
    raise exception 'Se permitió abordar un viaje cerrado.';
  exception when sqlstate '22023' then null;
  end;
end;
$$;
rollback;
select 'OK: autorización, estado, persistencia, aviso único, reintentos y cierre del viaje' as resultado;
