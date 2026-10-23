-- Operación del taxista: servicio y ubicación, vehículo, solicitudes de
-- reserva y correcciones de asientos.
--
-- Igual que en las reservas del cliente, las acciones que cambian estado de
-- varias tablas o que leen datos del cliente se hacen con funciones
-- `security definer` que validan todo con `auth.uid()`.

-- ---------------------------------------------------------------------------
-- Ubicación vigente
-- ---------------------------------------------------------------------------

-- La app solo envía la ubicación mientras está abierta. Si el taxista la
-- cierra sin terminar el servicio, `taxista_activo` sigue en true: con esta
-- fecha se descartan las ubicaciones viejas.
alter table public.taxistas
  add column if not exists ubicacion_actualizada_en timestamptz;

-- ---------------------------------------------------------------------------
-- Vehículos
-- ---------------------------------------------------------------------------

-- `reservas.vehiculo_id` es `on delete cascade`: borrar un vehículo borraría
-- el historial de reservas de los clientes. El taxista solo puede desactivarlo.
drop policy if exists vehiculos_gestionar_propio on public.vehiculos;

drop policy if exists vehiculos_insertar_propio on public.vehiculos;
create policy vehiculos_insertar_propio on public.vehiculos
  for insert to authenticated
  with check (taxista_id = (select auth.uid()));

drop policy if exists vehiculos_actualizar_propio on public.vehiculos;
create policy vehiculos_actualizar_propio on public.vehiculos
  for update to authenticated
  using (taxista_id = (select auth.uid()))
  with check (taxista_id = (select auth.uid()));

-- `trigger_generar_asientos` solo crea asientos al insertar. Si cambia la
-- capacidad, se agregan asientos o se quitan los últimos, siempre que estén
-- libres.
create or replace function public.ajustar_asientos_vehiculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.capacidad_total_asientos = old.capacidad_total_asientos then
    return new;
  end if;

  if new.capacidad_total_asientos > old.capacidad_total_asientos then
    insert into public.asientos (vehiculo_id, numero_asiento, estado)
    select new.id, numero, 'disponible'
    from generate_series(1, new.capacidad_total_asientos) as numero
    on conflict (vehiculo_id, numero_asiento) do nothing;
    return new;
  end if;

  if exists (
    select 1 from public.asientos
    where vehiculo_id = new.id
      and numero_asiento > new.capacidad_total_asientos
      and estado <> 'disponible'
  ) then
    raise exception 'No puedes quitar asientos que están reservados u ocupados.'
      using errcode = '22023';
  end if;

  delete from public.asientos
  where vehiculo_id = new.id
    and numero_asiento > new.capacidad_total_asientos;
  return new;
end;
$$;

drop trigger if exists trigger_ajustar_asientos on public.vehiculos;
create trigger trigger_ajustar_asientos
  after update of capacidad_total_asientos on public.vehiculos
  for each row execute function public.ajustar_asientos_vehiculo();

-- ---------------------------------------------------------------------------
-- Asientos al cambiar el estado de una reserva
-- ---------------------------------------------------------------------------

-- Se reescribe la función existente sin cambiar las notificaciones. Corrige:
-- * `no_show` salía antes de liberar el asiento (no tiene notificación).
-- * `completada` no liberaba el asiento.
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
      v_mensaje := 'Un cliente quiere reservar un asiento. Revisa tu panel.';
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

    if new.asiento_id is not null then
      if new.estado = 'aceptada' then
        update public.asientos
        set estado = 'ocupado', reserva_id = new.id
        where id = new.asiento_id;
      elsif new.estado in ('rechazada', 'cancelada_cliente', 'cancelada_taxista', 'no_show', 'completada') then
        update public.asientos
        set estado = 'disponible', reserva_id = null
        where id = new.asiento_id
          and (reserva_id is null or reserva_id = new.id);
      end if;
    end if;
  end if;

  if v_tipo is not null then
    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo, reserva_id)
    values (v_destinatario, v_titulo, v_mensaje, v_tipo, new.id);
  end if;

  return new;
end;
$$;

-- Asientos que quedaron ocupados o reservados por reservas ya cerradas.
update public.asientos as asiento
set estado = 'disponible', reserva_id = null
from public.reservas as reserva
where reserva.id = asiento.reserva_id
  and asiento.estado <> 'disponible'
  and reserva.estado in ('rechazada', 'cancelada_cliente', 'cancelada_taxista', 'no_show', 'completada');

-- ---------------------------------------------------------------------------
-- Servicio y ubicación
-- ---------------------------------------------------------------------------

create or replace function public.cambiar_servicio_taxista(
  p_en_servicio boolean,
  p_latitud double precision default null,
  p_longitud double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taxista_id uuid := auth.uid();
begin
  if v_taxista_id is null
     or not exists (select 1 from public.taxistas where id = v_taxista_id) then
    raise exception 'Solo un taxista con sesión activa puede cambiar su servicio.'
      using errcode = '42501';
  end if;

  if not p_en_servicio then
    update public.taxistas
    set taxista_activo = false,
        ubicacion_actual = null,
        ubicacion_actualizada_en = null
    where id = v_taxista_id;
    return;
  end if;

  if not exists (
    select 1 from public.taxistas as taxista
    join public.rutas as ruta on ruta.id = taxista.ruta_id and ruta.activa
    where taxista.id = v_taxista_id
  ) then
    raise exception 'Elige tu ruta en tu perfil antes de iniciar el servicio.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.vehiculos
    where taxista_id = v_taxista_id and activo
  ) then
    raise exception 'Registra un vehículo activo antes de iniciar el servicio.'
      using errcode = '22023';
  end if;

  if p_latitud is null or p_longitud is null
     or p_latitud not between -90 and 90
     or p_longitud not between -180 and 180 then
    raise exception 'Se necesita tu ubicación para iniciar el servicio.'
      using errcode = '22023';
  end if;

  update public.taxistas
  set taxista_activo = true,
      ubicacion_actual = public.st_setsrid(
        public.st_makepoint(p_longitud, p_latitud), 4326
      )::public.geography,
      ubicacion_actualizada_en = now()
  where id = v_taxista_id;
end;
$$;

create or replace function public.actualizar_ubicacion_taxista(
  p_latitud double precision,
  p_longitud double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_latitud not between -90 and 90 or p_longitud not between -180 and 180 then
    raise exception 'Ubicación inválida.' using errcode = '22023';
  end if;

  -- Fuera de servicio no se guarda la ubicación.
  update public.taxistas
  set ubicacion_actual = public.st_setsrid(
        public.st_makepoint(p_longitud, p_latitud), 4326
      )::public.geography,
      ubicacion_actualizada_en = now()
  where id = auth.uid()
    and taxista_activo;
end;
$$;

-- Los taxis con ubicación de hace más de 15 minutos dejan de aparecer.
create or replace function public.obtener_taxis_cercanos(
  p_latitud double precision,
  p_longitud double precision,
  p_limite integer default 5
)
returns table(
  vehiculo_id uuid,
  matricula text,
  nombre_taxista text,
  asientos_disponibles integer,
  distancia_metros double precision
)
language sql
stable
set search_path = ''
as $$
  with ubicacion_cliente as (
    select public.st_setsrid(
      public.st_makepoint(p_longitud, p_latitud),
      4326
    )::public.geography as punto
  )
  select
    vehiculo.id,
    vehiculo.matricula,
    concat_ws(' ', taxista.nombres, taxista.apellidos),
    disponibilidad.asientos_disponibles::integer,
    public.st_distance(
      taxista.ubicacion_actual::public.geography,
      ubicacion_cliente.punto
    ) as distancia_metros
  from public.taxistas as taxista
  join public.vehiculos as vehiculo
    on vehiculo.taxista_id = taxista.id
   and vehiculo.activo
  join public.vista_asientos_disponibles as disponibilidad
    on disponibilidad.vehiculo_id = vehiculo.id
   and disponibilidad.asientos_disponibles > 0
  cross join ubicacion_cliente
  where taxista.taxista_activo
    and taxista.ubicacion_actual is not null
    and taxista.ubicacion_actualizada_en > now() - interval '15 minutes'
  order by distancia_metros
  limit least(greatest(coalesce(p_limite, 5), 1), 5);
$$;

-- ---------------------------------------------------------------------------
-- Reservas del taxista
-- ---------------------------------------------------------------------------

-- El taxista no puede leer `clientes` por RLS. Esta función le da el nombre
-- del cliente de sus reservas, y el teléfono solo mientras la reserva está en
-- curso.
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
    origen.nombre::text,
    destino.nombre::text,
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

-- Transiciones permitidas al taxista:
--   pendiente -> aceptada | rechazada
--   aceptada  -> completada | no_show | cancelada_taxista
create or replace function public.actualizar_reserva_taxista(
  p_reserva_id uuid,
  p_estado text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado_actual text;
begin
  select estado into v_estado_actual
  from public.reservas
  where id = p_reserva_id
    and taxista_id = auth.uid()
  for update;

  if v_estado_actual is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;

  if not (
    (v_estado_actual = 'pendiente' and p_estado in ('aceptada', 'rechazada'))
    or (v_estado_actual = 'aceptada' and p_estado in ('completada', 'no_show', 'cancelada_taxista'))
  ) then
    raise exception 'La reservación ya no admite este cambio.' using errcode = '22023';
  end if;

  update public.reservas
  set estado = p_estado
  where id = p_reserva_id;
end;
$$;

revoke all on function public.cambiar_servicio_taxista(boolean, double precision, double precision) from public, anon;
revoke all on function public.actualizar_ubicacion_taxista(double precision, double precision) from public, anon;
revoke all on function public.obtener_reservas_taxista() from public, anon;
revoke all on function public.actualizar_reserva_taxista(uuid, text) from public, anon;
grant execute on function public.cambiar_servicio_taxista(boolean, double precision, double precision) to authenticated;
grant execute on function public.actualizar_ubicacion_taxista(double precision, double precision) to authenticated;
grant execute on function public.obtener_reservas_taxista() to authenticated;
grant execute on function public.actualizar_reserva_taxista(uuid, text) to authenticated;
