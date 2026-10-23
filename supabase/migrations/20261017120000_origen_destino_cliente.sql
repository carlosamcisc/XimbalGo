-- Origen y destino del cliente desde el catálogo de rutas, y ubicación GPS.
--
-- Antes el cliente elegía origen y destino entre los paraderos, y la reserva
-- exigía `paradero_destino_id`. Ahora elige entre los orígenes y destinos de
-- `rutas`, así que la reserva guarda el texto del origen y del destino. Si el
-- origen es el GPS, se guarda el punto en `reservas.ubicacion_origen` y en
-- `clientes.ubicacion_actual` (antes solo viajaba como texto en `notas`).

alter table public.clientes
  add column if not exists ubicacion_actualizada_en timestamptz;

alter table public.reservas
  add column if not exists origen text,
  add column if not exists destino text,
  add column if not exists ubicacion_origen public.geography(point, 4326);

-- ---------------------------------------------------------------------------
-- Ubicación del cliente
-- ---------------------------------------------------------------------------

create or replace function public.actualizar_ubicacion_cliente(
  p_latitud double precision,
  p_longitud double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_latitud is null or p_longitud is null
     or p_latitud not between -90 and 90
     or p_longitud not between -180 and 180 then
    raise exception 'Ubicación inválida.' using errcode = '22023';
  end if;

  update public.clientes
  set ubicacion_actual = public.st_setsrid(
        public.st_makepoint(p_longitud, p_latitud), 4326
      )::public.geography,
      ubicacion_actualizada_en = now()
  where id = auth.uid();

  if not found then
    raise exception 'Solo un cliente con sesión activa puede guardar su ubicación.'
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------------------

drop function if exists public.crear_reserva_cliente(uuid, uuid, uuid, timestamptz, text);

-- El origen llega de una de tres formas: el GPS (`p_latitud`, `p_longitud` y
-- la dirección en `p_origen`), un paradero cercano (`p_paradero_origen_id`) o
-- un origen del catálogo de rutas (`p_origen`).
create or replace function public.crear_reserva_cliente(
  p_vehiculo_id uuid,
  p_destino text,
  p_origen text default null,
  p_paradero_origen_id uuid default null,
  p_latitud double precision default null,
  p_longitud double precision default null,
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
  v_destino text := nullif(btrim(p_destino), '');
  v_origen text := nullif(btrim(p_origen), '');
  v_ubicacion public.geography;
  v_taxista_id uuid;
  v_ruta_id uuid;
  v_precio numeric;
  v_asiento_id uuid;
  v_reserva_id uuid;
begin
  if v_cliente_id is null
     or not exists (select 1 from public.clientes where id = v_cliente_id) then
    raise exception 'Solo un cliente con sesión activa puede reservar.'
      using errcode = '42501';
  end if;

  if v_destino is null then
    raise exception 'Selecciona un destino para reservar.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.rutas
    where activa and lower(btrim(destino)) = lower(v_destino)
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
    where activa and lower(btrim(origen)) = lower(v_origen)
  ) then
    raise exception 'El origen seleccionado ya no está disponible.' using errcode = '22023';
  end if;

  if lower(v_origen) = lower(v_destino) then
    raise exception 'El origen y el destino deben ser distintos.' using errcode = '22023';
  end if;

  if p_fecha_hora_viaje is not null and p_fecha_hora_viaje < now() - interval '5 minutes' then
    raise exception 'La fecha del viaje no puede estar en el pasado.' using errcode = '22023';
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
    cliente_id, taxista_id, vehiculo_id, asiento_id, ruta_id,
    paradero_origen_id, origen, destino, ubicacion_origen,
    fecha_hora_viaje, precio, notas, estado
  )
  values (
    v_cliente_id, v_taxista_id, p_vehiculo_id, v_asiento_id, v_ruta_id,
    p_paradero_origen_id, v_origen, v_destino, v_ubicacion,
    p_fecha_hora_viaje, v_precio, nullif(btrim(p_notas), ''), 'pendiente'
  )
  returning id into v_reserva_id;

  update public.asientos
  set estado = 'reservado', reserva_id = v_reserva_id
  where id = v_asiento_id;

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

-- Igual que antes, pero las reservas nuevas guardan el origen y el destino
-- como texto; las anteriores los toman de sus paraderos.
create or replace function public.obtener_reservas_taxista()
returns table(
  id uuid,
  estado text,
  fecha_hora_reserva timestamptz,
  fecha_hora_viaje timestamptz,
  precio numeric,
  notas text,
  origen text,
  destino text,
  matricula text,
  numero_asiento integer,
  nombre_cliente text,
  telefono_cliente text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    reserva.id,
    reserva.estado::text,
    reserva.fecha_hora_reserva,
    reserva.fecha_hora_viaje,
    reserva.precio,
    reserva.notas,
    coalesce(reserva.origen, origen.nombre)::text,
    coalesce(reserva.destino, destino.nombre)::text,
    vehiculo.matricula::text,
    asiento.numero_asiento,
    concat_ws(' ', cliente.nombres, cliente.apellidos),
    case when reserva.estado in ('pendiente', 'aceptada') then cliente.telefono::text end
  from public.reservas as reserva
  join public.clientes as cliente on cliente.id = reserva.cliente_id
  left join public.paraderos as origen on origen.id = reserva.paradero_origen_id
  left join public.paraderos as destino on destino.id = reserva.paradero_destino_id
  left join public.vehiculos as vehiculo on vehiculo.id = reserva.vehiculo_id
  left join public.asientos as asiento on asiento.id = reserva.asiento_id
  where reserva.taxista_id = auth.uid()
  order by reserva.fecha_hora_reserva desc
  limit 200;
$$;

revoke all on function public.actualizar_ubicacion_cliente(double precision, double precision) from public, anon;
revoke all on function public.crear_reserva_cliente(uuid, text, text, uuid, double precision, double precision, timestamptz, text) from public, anon;
grant execute on function public.actualizar_ubicacion_cliente(double precision, double precision) to authenticated;
grant execute on function public.crear_reserva_cliente(uuid, text, text, uuid, double precision, double precision, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
