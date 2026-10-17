-- Reservar varios asientos con fecha y hora, y seguimiento del taxi (XG-0013).
--
-- * `reservas.cantidad_asientos`: una reserva aparta uno o más asientos. El
--   primero queda en `reservas.asiento_id` (como antes) y todos apuntan a la
--   reserva con `asientos.reserva_id`.
-- * `crear_reserva_cliente` recibe `p_cantidad_asientos` y bloquea esa
--   cantidad de asientos libres a la vez; el precio es por pasajero.
-- * `notificar_cambio_reserva` ocupa y libera todos los asientos de la reserva.
-- * `obtener_reservas_taxista` devuelve la cantidad y los números de asiento.
-- * `obtener_taxis_disponibles`: todos los taxis con asientos, no solo los
--   cinco más cercanos.
-- * `obtener_seguimiento_reserva`: ubicación del taxi y del punto de abordaje
--   de una reserva en curso, solo para el cliente dueño de la reserva.

alter table public.reservas
  add column if not exists cantidad_asientos smallint not null default 1;

alter table public.reservas
  drop constraint if exists reservas_cantidad_asientos_check;
alter table public.reservas
  add constraint reservas_cantidad_asientos_check
    check (cantidad_asientos between 1 and 20);

-- ---------------------------------------------------------------------------
-- Crear la reserva
-- ---------------------------------------------------------------------------

drop function if exists public.crear_reserva_cliente(
  uuid, text, text, uuid, double precision, double precision, timestamptz, text
);

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

-- ---------------------------------------------------------------------------
-- Asientos al cambiar el estado de una reserva
-- ---------------------------------------------------------------------------

-- Igual que en `20261015120000_operacion_taxista.sql`, pero ocupa y libera
-- todos los asientos de la reserva, y el aviso al taxista dice cuántos son.
create or replace function public.notificar_cambio_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo varchar(200);
  v_mensaje text;
  v_tipo varchar(50);
  v_destinatario uuid;
begin
  if tg_op = 'INSERT' then
    if new.estado = 'pendiente' then
      v_tipo := 'reserva_solicitada';
      v_titulo := 'Nueva solicitud de reserva';
      v_mensaje := case
        when coalesce(new.cantidad_asientos, 1) > 1
          then 'Un cliente quiere reservar ' || new.cantidad_asientos || ' asientos. Revisa tu panel.'
        else 'Un cliente quiere reservar un asiento. Revisa tu panel.'
      end;
      v_destinatario := new.taxista_id;
    end if;
  elsif tg_op = 'UPDATE' and old.estado is distinct from new.estado then
    if new.estado = 'aceptada' then
      v_tipo := 'reserva_aceptada';
      v_titulo := '¡Reserva aceptada!';
      v_mensaje := 'Tu reserva fue aceptada. Prepárate para tu viaje.';
      v_destinatario := new.cliente_id;
    elsif new.estado = 'rechazada' then
      v_tipo := 'reserva_rechazada';
      v_titulo := 'Reserva rechazada';
      v_mensaje := 'Lo sentimos, tu reserva fue rechazada por el taxista.';
      v_destinatario := new.cliente_id;
    elsif new.estado = 'cancelada_cliente' then
      v_tipo := 'reserva_cancelada';
      v_titulo := 'Reserva cancelada';
      v_mensaje := 'El cliente canceló su reserva.';
      v_destinatario := new.taxista_id;
    elsif new.estado = 'cancelada_taxista' then
      v_tipo := 'reserva_cancelada';
      v_titulo := 'Reserva cancelada por el taxista';
      v_mensaje := 'El taxista canceló tu reserva. Busca otra opción.';
      v_destinatario := new.cliente_id;
    elsif new.estado = 'completada' then
      v_tipo := 'viaje_completado';
      v_titulo := '¡Viaje completado!';
      v_mensaje := 'Gracias por viajar con XimbalGo. ¡Califica tu experiencia!';
      v_destinatario := new.cliente_id;
    end if;

    if new.estado = 'aceptada' then
      update public.asientos
      set estado = 'ocupado', reserva_id = new.id
      where id = new.asiento_id or reserva_id = new.id;
    elsif new.estado in ('rechazada', 'cancelada_cliente', 'cancelada_taxista', 'no_show', 'completada') then
      update public.asientos
      set estado = 'disponible', reserva_id = null
      where (id = new.asiento_id or reserva_id = new.id)
        and (reserva_id is null or reserva_id = new.id);
    end if;
  end if;

  if v_tipo is not null then
    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo, reserva_id)
    values (v_destinatario, v_titulo, v_mensaje, v_tipo, new.id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reservas del taxista
-- ---------------------------------------------------------------------------

drop function if exists public.obtener_reservas_taxista();

-- Los números de asiento solo se conocen mientras la reserva los tiene
-- apartados; al cerrarse queda el primero (`reservas.asiento_id`).
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
  cantidad_asientos integer,
  numeros_asientos integer[],
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
    reserva.cantidad_asientos::integer,
    coalesce(
      (select array_agg(apartado.numero_asiento order by apartado.numero_asiento)
       from public.asientos as apartado
       where apartado.reserva_id = reserva.id),
      case when asiento.numero_asiento is null then '{}'::integer[]
           else array[asiento.numero_asiento] end
    ),
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

-- ---------------------------------------------------------------------------
-- Todos los taxis disponibles
-- ---------------------------------------------------------------------------

-- Igual que `obtener_taxis_cercanos`, sin el límite de cinco. Sin coordenadas
-- la distancia es null y se ordena por matrícula.
create or replace function public.obtener_taxis_disponibles(
  p_latitud double precision default null,
  p_longitud double precision default null
)
returns table(
  vehiculo_id uuid,
  matricula text,
  nombre_taxista text,
  asientos_disponibles integer,
  distancia_metros double precision,
  ruta text,
  precio numeric
)
language sql
stable
set search_path = ''
as $$
  select
    vehiculo.id,
    vehiculo.matricula::text,
    concat_ws(' ', taxista.nombres, taxista.apellidos),
    disponibilidad.asientos_disponibles::integer,
    case
      when p_latitud is null or p_longitud is null then null
      else public.st_distance(
        taxista.ubicacion_actual::public.geography,
        public.st_setsrid(public.st_makepoint(p_longitud, p_latitud), 4326)::public.geography
      )
    end as distancia_metros,
    ruta.nombre::text,
    taxista.precio_ruta
  from public.taxistas as taxista
  join public.vehiculos as vehiculo
    on vehiculo.taxista_id = taxista.id
   and vehiculo.activo
  join public.vista_asientos_disponibles as disponibilidad
    on disponibilidad.vehiculo_id = vehiculo.id
   and disponibilidad.asientos_disponibles > 0
  left join public.rutas as ruta on ruta.id = taxista.ruta_id
  where taxista.taxista_activo
    and taxista.ubicacion_actual is not null
    and taxista.ubicacion_actualizada_en > now() - interval '15 minutes'
  order by distancia_metros nulls last, vehiculo.matricula
  limit 100;
$$;

-- ---------------------------------------------------------------------------
-- Seguimiento de una reserva
-- ---------------------------------------------------------------------------

-- El punto de abordaje es el GPS guardado en la reserva, el paradero de
-- origen o, si el origen es del catálogo de rutas, la última ubicación del
-- cliente. También se devuelve el paradero activo más cercano a ese punto.
-- La ubicación del taxi solo se entrega mientras la reserva está en curso.
-- La velocidad sale de la ruta (`distancia_km` / `tiempo_estimado_min`); si
-- falta, se usa 25 km/h.
create or replace function public.obtener_seguimiento_reserva(
  p_reserva_id uuid
)
returns table(
  estado text,
  taxista_id uuid,
  en_servicio boolean,
  taxi_latitud double precision,
  taxi_longitud double precision,
  ubicacion_actualizada_en timestamptz,
  punto_tipo text,
  punto_nombre text,
  punto_latitud double precision,
  punto_longitud double precision,
  paradero_nombre text,
  paradero_latitud double precision,
  paradero_longitud double precision,
  velocidad_kmh double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reserva public.reservas%rowtype;
  v_punto public.geography;
  v_tipo text;
  v_nombre text;
  v_activa boolean;
begin
  select * into v_reserva
  from public.reservas
  where id = p_reserva_id
    and cliente_id = auth.uid();

  if v_reserva.id is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;

  v_activa := v_reserva.estado in ('pendiente', 'aceptada');

  if v_reserva.ubicacion_origen is not null then
    v_punto := v_reserva.ubicacion_origen;
    v_tipo := 'ubicacion';
    v_nombre := coalesce(v_reserva.origen, 'Tu ubicación');
  else
    select paradero.ubicacion, paradero.nombre
      into v_punto, v_nombre
    from public.paraderos as paradero
    where paradero.id = v_reserva.paradero_origen_id;

    if v_punto is not null then
      v_tipo := 'paradero';
    else
      select cliente.ubicacion_actual into v_punto
      from public.clientes as cliente
      where cliente.id = v_reserva.cliente_id;

      if v_punto is not null then
        v_tipo := 'cliente';
        v_nombre := 'Tu última ubicación';
      end if;
    end if;
  end if;

  return query
  select
    v_reserva.estado::text,
    taxista.id,
    taxista.taxista_activo
      and taxista.ubicacion_actual is not null
      and taxista.ubicacion_actualizada_en > now() - interval '15 minutes',
    case when v_activa then public.st_y(taxista.ubicacion_actual::public.geometry) end,
    case when v_activa then public.st_x(taxista.ubicacion_actual::public.geometry) end,
    case when v_activa then taxista.ubicacion_actualizada_en end,
    v_tipo,
    v_nombre,
    public.st_y(v_punto::public.geometry),
    public.st_x(v_punto::public.geometry),
    cercano.nombre::text,
    public.st_y(cercano.ubicacion::public.geometry),
    public.st_x(cercano.ubicacion::public.geometry),
    coalesce(
      case
        when ruta.distancia_km > 0 and ruta.tiempo_estimado_min > 0
          then ruta.distancia_km::double precision / (ruta.tiempo_estimado_min::double precision / 60)
      end,
      25
    )
  from public.taxistas as taxista
  left join public.rutas as ruta on ruta.id = coalesce(v_reserva.ruta_id, taxista.ruta_id)
  left join lateral (
    select paradero.nombre, paradero.ubicacion
    from public.paraderos as paradero
    where v_punto is not null
      and paradero.activo
      and paradero.ubicacion is not null
    order by paradero.ubicacion operator(public.<->) v_punto
    limit 1
  ) as cercano on true
  where taxista.id = v_reserva.taxista_id;
end;
$$;

revoke all on function public.crear_reserva_cliente(uuid, text, text, uuid, double precision, double precision, timestamptz, text, integer) from public, anon;
revoke all on function public.obtener_reservas_taxista() from public, anon;
revoke all on function public.obtener_taxis_disponibles(double precision, double precision) from public, anon;
revoke all on function public.obtener_seguimiento_reserva(uuid) from public, anon;
grant execute on function public.crear_reserva_cliente(uuid, text, text, uuid, double precision, double precision, timestamptz, text, integer) to authenticated;
grant execute on function public.obtener_reservas_taxista() to authenticated;
grant execute on function public.obtener_taxis_disponibles(double precision, double precision) to authenticated;
grant execute on function public.obtener_seguimiento_reserva(uuid) to authenticated;

notify pgrst, 'reload schema';
