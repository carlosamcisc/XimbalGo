-- Pruebas sobre un vehículo existente; todas las modificaciones se revierten.
begin;
do $$
declare
  v_vehiculo public.vehiculos%rowtype;
  v_actual integer;
  v_libres integer;
  v_excluido uuid;
begin
  select * into strict v_vehiculo from public.vehiculos
    where exists (select 1 from public.asientos where vehiculo_id = vehiculos.id and estado = 'disponible')
    limit 1;
  perform set_config('request.jwt.claim.sub', v_vehiculo.taxista_id::text, true);
  select count(*) into v_actual from public.asientos
    where vehiculo_id = v_vehiculo.id and en_plataforma;
  perform public.configurar_asientos_plataforma(v_vehiculo.id, v_actual);
  begin
    perform public.configurar_asientos_plataforma(v_vehiculo.id, -1);
    raise exception 'Se aceptó una cantidad negativa.';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.configurar_asientos_plataforma(v_vehiculo.id, v_vehiculo.capacidad_total_asientos + 1);
    raise exception 'Se superó la capacidad física.';
  exception when sqlstate '22023' then null;
  end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform public.configurar_asientos_plataforma(v_vehiculo.id, 0);
    raise exception 'Otro usuario modificó el vehículo.';
  exception when sqlstate '42501' then null;
  end;
  perform set_config('request.jwt.claim.sub', v_vehiculo.taxista_id::text, true);
  select count(*) into v_libres from public.asientos
    where vehiculo_id = v_vehiculo.id and estado = 'disponible';
  perform public.configurar_asientos_plataforma(v_vehiculo.id, v_actual - 1);
  if (select count(*) from public.asientos where vehiculo_id = v_vehiculo.id and estado = 'disponible') <> v_libres - 1 then
    raise exception 'El asiento excluido sigue disponible para reservar.';
  end if;
  select id into strict v_excluido from public.asientos
    where vehiculo_id = v_vehiculo.id and not en_plataforma limit 1;
  begin
    perform public.marcar_asientos_taxista(array[v_excluido], false);
    raise exception 'Se liberó un asiento excluido por la RPC anterior.';
  exception when check_violation then null;
  end;
  perform public.configurar_asientos_plataforma(v_vehiculo.id, v_actual);
  if (select count(*) from public.asientos where vehiculo_id = v_vehiculo.id and estado = 'disponible') <> v_libres then
    raise exception 'No se recuperó la disponibilidad.';
  end if;
  -- Un pasajero sin reserva tampoco puede retirarse de la oferta mientras viaja.
  select id into v_excluido from public.asientos
    where vehiculo_id = v_vehiculo.id and estado = 'disponible' limit 1;
  perform public.marcar_asientos_taxista(array[v_excluido], true);
  begin
    perform public.configurar_asientos_plataforma(v_vehiculo.id, 0);
    raise exception 'Se retiraron asientos ocupados.';
  exception when sqlstate '22023' then null;
  end;
  if has_function_privilege('anon', 'public.configurar_asientos_plataforma(uuid,integer)', 'execute') then
    raise exception 'La función permite acceso anónimo.';
  end if;
end;
$$;
rollback;
