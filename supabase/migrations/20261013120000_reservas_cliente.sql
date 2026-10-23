-- Reservas del cliente.
--
-- El cliente no tiene permiso para actualizar `asientos`, así que apartar un
-- asiento y crear la reserva se hace en una sola función con privilegios del
-- propietario. La función valida todo con `auth.uid()` y nunca confía en el
-- cliente para el taxista, el precio ni el asiento.

create or replace function public.crear_reserva_cliente(
  p_vehiculo_id uuid,
  p_paradero_destino_id uuid,
  p_paradero_origen_id uuid default null,
  p_fecha_hora_viaje timestamptz default null,
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id uuid := auth.uid();
  v_taxista_id uuid;
  v_precio numeric;
  v_asiento_id uuid;
  v_reserva_id uuid;
begin
  if v_cliente_id is null
     or not exists (select 1 from public.clientes where id = v_cliente_id) then
    raise exception 'Solo un cliente con sesión activa puede reservar.'
      using errcode = '42501';
  end if;

  if p_paradero_destino_id is null then
    raise exception 'Selecciona un destino para reservar.' using errcode = '22023';
  end if;

  if p_paradero_origen_id is not null
     and p_paradero_origen_id = p_paradero_destino_id then
    raise exception 'El origen y el destino deben ser distintos.' using errcode = '22023';
  end if;

  if p_fecha_hora_viaje is not null and p_fecha_hora_viaje < now() - interval '5 minutes' then
    raise exception 'La fecha del viaje no puede estar en el pasado.' using errcode = '22023';
  end if;

  if (select count(*) from public.paraderos
      where activo
        and id in (p_paradero_destino_id, p_paradero_origen_id))
     <> (case when p_paradero_origen_id is null then 1 else 2 end) then
    raise exception 'El paradero seleccionado ya no está disponible.' using errcode = '22023';
  end if;

  -- Una sola reserva en curso por cliente evita que acapare asientos.
  if exists (
    select 1 from public.reservas
    where cliente_id = v_cliente_id
      and estado in ('pendiente', 'aceptada')
  ) then
    raise exception 'Ya tienes una reservación en curso. Cancélala o termina el viaje para reservar otra.'
      using errcode = '23505';
  end if;

  select vehiculo.taxista_id, taxista.precio_ruta
    into v_taxista_id, v_precio
  from public.vehiculos as vehiculo
  join public.taxistas as taxista on taxista.id = vehiculo.taxista_id
  where vehiculo.id = p_vehiculo_id
    and vehiculo.activo
    and taxista.taxista_activo;

  if v_taxista_id is null then
    raise exception 'El taxi seleccionado no está disponible.' using errcode = '22023';
  end if;

  -- Bloquea un asiento libre; otra reserva simultánea tomará uno diferente.
  select id into v_asiento_id
  from public.asientos
  where vehiculo_id = p_vehiculo_id
    and estado = 'disponible'
  order by numero_asiento
  limit 1
  for update skip locked;

  if v_asiento_id is null then
    raise exception 'El taxi ya no tiene asientos disponibles.' using errcode = '22023';
  end if;

  insert into public.reservas (
    cliente_id, taxista_id, vehiculo_id, asiento_id,
    paradero_origen_id, paradero_destino_id,
    fecha_hora_viaje, precio, notas, estado
  )
  values (
    v_cliente_id, v_taxista_id, p_vehiculo_id, v_asiento_id,
    p_paradero_origen_id, p_paradero_destino_id,
    p_fecha_hora_viaje, v_precio, nullif(btrim(p_notas), ''), 'pendiente'
  )
  returning id into v_reserva_id;

  update public.asientos
  set estado = 'reservado', reserva_id = v_reserva_id
  where id = v_asiento_id;

  return v_reserva_id;
end;
$$;

revoke all on function public.crear_reserva_cliente(uuid, uuid, uuid, timestamptz, text) from public;
grant execute on function public.crear_reserva_cliente(uuid, uuid, uuid, timestamptz, text) to authenticated;

-- Cancelar solo cambia el estado; `trigger_notificar_reserva` avisa al
-- taxista y libera el asiento.
create or replace function public.cancelar_reserva_cliente(p_reserva_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reservas
  set estado = 'cancelada_cliente'
  where id = p_reserva_id
    and cliente_id = auth.uid()
    and estado in ('pendiente', 'aceptada');

  if not found then
    raise exception 'La reservación ya no se puede cancelar.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.cancelar_reserva_cliente(uuid) from public;
grant execute on function public.cancelar_reserva_cliente(uuid) to authenticated;
