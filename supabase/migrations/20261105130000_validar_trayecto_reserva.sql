-- XG-0029: validar el trayecto del taxi antes de apartar asientos.
create or replace function public.normalizar_punto_viaje(valor text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(translate(lower(valor), 'áéíóúüñ', 'aeiouun'), '\s+', ' ', 'g'));
$$;

create or replace function public.crear_reserva_cliente(
  p_vehiculo_id uuid,
  p_destino text,
  p_origen text default null,
  p_paradero_origen_id uuid default null,
  p_latitud double precision default null,
  p_longitud double precision default null,
  p_fecha_hora_viaje timestamptz default null,
  p_notas text default null,
  p_cantidad_asientos integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente_id uuid := auth.uid();
  v_destino text := nullif(btrim(p_destino), '');
  v_origen text := nullif(btrim(p_origen), '');
  v_cantidad integer := coalesce(p_cantidad_asientos, 1);
  v_ubicacion public.geography;
  v_taxista_id uuid;
  v_ruta_id uuid;
  v_precio numeric;
  v_asientos uuid[];
  v_libres integer;
  v_reserva_id uuid;
begin
  if v_cliente_id is null
     or not exists (select 1 from public.clientes where id = v_cliente_id) then
    raise exception 'Solo un cliente con sesión activa puede reservar.'
      using errcode = '42501';
  end if;

  if v_cantidad < 1 or v_cantidad > 20 then
    raise exception 'Puedes reservar de 1 a 20 asientos.' using errcode = '22023';
  end if;

  if v_destino is null then
    raise exception 'Selecciona un destino para reservar.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.rutas
    where activa and public.normalizar_punto_viaje(destino) = public.normalizar_punto_viaje(v_destino)
  ) then
    raise exception 'El destino seleccionado ya no está disponible.' using errcode = '22023';
  end if;

  if p_latitud is not null or p_longitud is not null then
    if p_latitud is null or p_longitud is null
       or p_latitud not between -90 and 90
       or p_longitud not between -180 and 180 then
      raise exception 'Ubicación inválida.' using errcode = '22023';
    end if;
    v_ubicacion := public.st_setsrid(
      public.st_makepoint(p_longitud, p_latitud), 4326
    )::public.geography;
    v_origen := coalesce(v_origen, 'Ubicación actual');
  elsif p_paradero_origen_id is not null then
    select nombre into v_origen
    from public.paraderos
    where id = p_paradero_origen_id and activo;

    if v_origen is null then
      raise exception 'El paradero seleccionado ya no está disponible.' using errcode = '22023';
    end if;
  elsif v_origen is null then
    raise exception 'Selecciona un origen para reservar.' using errcode = '22023';
  elsif not exists (
    select 1 from public.rutas
    where activa and public.normalizar_punto_viaje(origen) = public.normalizar_punto_viaje(v_origen)
  ) then
    raise exception 'El origen seleccionado ya no está disponible.' using errcode = '22023';
  end if;

  if public.normalizar_punto_viaje(v_origen) = public.normalizar_punto_viaje(v_destino) then
    raise exception 'El origen y el destino deben ser distintos.' using errcode = '22023';
  end if;

  if p_fecha_hora_viaje is not null then
    if p_fecha_hora_viaje < now() - interval '5 minutes' then
      raise exception 'La fecha del viaje no puede estar en el pasado.' using errcode = '22023';
    end if;
    if p_fecha_hora_viaje > now() + interval '7 days' then
      raise exception 'Solo puedes reservar con hasta 7 días de anticipación.' using errcode = '22023';
    end if;
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

  select vehiculo.taxista_id, taxista.precio_ruta, taxista.ruta_id
    into v_taxista_id, v_precio, v_ruta_id
  from public.vehiculos as vehiculo
  join public.taxistas as taxista on taxista.id = vehiculo.taxista_id
  where vehiculo.id = p_vehiculo_id
    and vehiculo.activo
    and taxista.taxista_activo;

  if v_taxista_id is null then
    raise exception 'El taxi seleccionado no está disponible.' using errcode = '22023';
  end if;

  -- Validar antes de apartar asientos. GPS y paraderos no tienen asociación a rutas.
  if not exists (
    select 1 from public.taxistas t
    left join public.rutas r on r.id = t.ruta_id
    where t.id = v_taxista_id
      and (t.ruta_id is null or r.activa)
      and public.normalizar_punto_viaje(coalesce(r.destino, t.punto_destino)) = public.normalizar_punto_viaje(v_destino)
      and (v_ubicacion is not null or p_paradero_origen_id is not null
        or public.normalizar_punto_viaje(coalesce(r.origen, t.punto_partida)) = public.normalizar_punto_viaje(v_origen))
  ) then
    raise exception 'La ruta de este taxi no corresponde a tu viaje. Elige otro taxi.' using errcode = '22023';
  end if;

  -- Bloquea los asientos libres; otra reserva simultánea tomará otros.
  select array_agg(libre.id order by libre.numero_asiento)
    into v_asientos
  from (
    select id, numero_asiento
    from public.asientos
    where vehiculo_id = p_vehiculo_id
      and estado = 'disponible'
    order by numero_asiento
    limit v_cantidad
    for update skip locked
  ) as libre;

  if coalesce(array_length(v_asientos, 1), 0) < v_cantidad then
    v_libres := coalesce(array_length(v_asientos, 1), 0);
    if v_libres = 0 then
      raise exception 'El taxi ya no tiene asientos disponibles.' using errcode = '22023';
    end if;
    raise exception 'El taxi solo tiene % asiento(s) disponible(s).', v_libres
      using errcode = '22023';
  end if;

  insert into public.reservas (
    cliente_id, taxista_id, vehiculo_id, asiento_id, ruta_id,
    paradero_origen_id, origen, destino, ubicacion_origen,
    fecha_hora_viaje, precio, notas, estado, cantidad_asientos
  )
  values (
    v_cliente_id, v_taxista_id, p_vehiculo_id, v_asientos[1], v_ruta_id,
    p_paradero_origen_id, v_origen, v_destino, v_ubicacion,
    p_fecha_hora_viaje, v_precio * v_cantidad, nullif(btrim(p_notas), ''),
    'pendiente', v_cantidad
  )
  returning id into v_reserva_id;

  update public.asientos
  set estado = 'reservado', reserva_id = v_reserva_id
  where id = any(v_asientos);

  update public.clientes
  set destino_deseado = v_destino,
      ubicacion_actual = coalesce(v_ubicacion, ubicacion_actual),
      ubicacion_actualizada_en = case
        when v_ubicacion is null then ubicacion_actualizada_en
        else now()
      end
  where id = v_cliente_id;

  return v_reserva_id;
end;
$$;
