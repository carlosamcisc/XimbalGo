-- Opciones del taxista sobre sus asientos y las solicitudes (XG-0013).
--
-- * `marcar_asientos_taxista`: el taxista marca como ocupados asientos libres
--   que se ocuparon sin reserva (pasajeros que subieron en el camino) y los
--   vuelve a dejar libres. Solo toca asientos sin reserva: un asiento ocupado
--   por una reserva se libera al cerrar el viaje.
-- * `reservas.motivo_taxista`: motivo con el que el taxista rechaza una
--   solicitud (obligatorio) o cancela un viaje (opcional). El cliente lo ve en
--   su reservación y en la notificación.
-- * `reservas.asientos_ofrecidos`: si el taxista no tiene todos los asientos
--   que pide el cliente, le ofrece los que le quedan
--   (`ofrecer_asientos_taxista`). El cliente acepta (la reserva queda aceptada
--   con esa cantidad y su precio) o no (la solicitud se cancela) con
--   `responder_oferta_asientos_cliente`.

alter table public.reservas
  add column if not exists motivo_taxista text,
  add column if not exists asientos_ofrecidos smallint;

alter table public.reservas
  drop constraint if exists reservas_motivo_taxista_check;
alter table public.reservas
  add constraint reservas_motivo_taxista_check
    check (motivo_taxista is null or char_length(motivo_taxista) between 1 and 200);

alter table public.reservas
  drop constraint if exists reservas_asientos_ofrecidos_check;
alter table public.reservas
  add constraint reservas_asientos_ofrecidos_check
    check (asientos_ofrecidos is null or asientos_ofrecidos between 1 and 20);

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones
  add constraint notificaciones_tipo_check
    check (tipo in (
      'reserva_solicitada', 'reserva_aceptada', 'reserva_rechazada',
      'reserva_cancelada', 'van_llegando', 'viaje_completado',
      'asientos_ofrecidos'
    ));

-- ---------------------------------------------------------------------------
-- Asientos ocupados sin reserva
-- ---------------------------------------------------------------------------

-- Todo o nada: si algún asiento ya no está como se esperaba (un cliente lo
-- reservó mientras tanto), no se cambia ninguno. Bloquea los asientos, así
-- `crear_reserva_cliente` (`skip locked`) no los toma a la vez.
create or replace function public.marcar_asientos_taxista(
  p_asiento_ids uuid[],
  p_ocupado boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taxista_id uuid := auth.uid();
  v_ids uuid[];
  v_estado_esperado text := case when p_ocupado then 'disponible' else 'ocupado' end;
  v_asiento record;
  v_total integer := 0;
begin
  if v_taxista_id is null
     or not exists (select 1 from public.taxistas where id = v_taxista_id) then
    raise exception 'Solo un taxista con sesión activa puede cambiar sus asientos.'
      using errcode = '42501';
  end if;

  select array_agg(distinct id) into v_ids
  from unnest(p_asiento_ids) as id
  where id is not null;

  if p_ocupado is null or coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Selecciona al menos un asiento.' using errcode = '22023';
  end if;

  for v_asiento in
    select asiento.id, asiento.numero_asiento, asiento.estado, asiento.reserva_id
    from public.asientos as asiento
    join public.vehiculos as vehiculo on vehiculo.id = asiento.vehiculo_id
    where asiento.id = any(v_ids)
      and vehiculo.taxista_id = v_taxista_id
    order by asiento.numero_asiento
    for update of asiento
  loop
    v_total := v_total + 1;
    if v_asiento.reserva_id is not null or v_asiento.estado = 'reservado' then
      raise exception 'El asiento % pertenece a una reservación; se libera al cerrar ese viaje.',
        v_asiento.numero_asiento
        using errcode = '22023';
    end if;
    if v_asiento.estado <> v_estado_esperado then
      raise exception 'El asiento % ya está %.', v_asiento.numero_asiento,
        case when v_asiento.estado = 'ocupado' then 'ocupado' else 'libre' end
        using errcode = '22023';
    end if;
  end loop;

  if v_total <> array_length(v_ids, 1) then
    raise exception 'No se encontraron los asientos en tu vehículo.' using errcode = '22023';
  end if;

  update public.asientos
  set estado = case when p_ocupado then 'ocupado' else 'disponible' end
  where id = any(v_ids);

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- Responder una solicitud
-- ---------------------------------------------------------------------------

drop function if exists public.actualizar_reserva_taxista(uuid, text);

-- Transiciones permitidas al taxista:
--   pendiente -> aceptada | rechazada (con motivo)
--   aceptada  -> completada | no_show | cancelada_taxista (motivo opcional)
-- Con una oferta de asientos sin responder solo puede rechazar: aceptar
-- apartaría asientos que ya dijo que no tiene.
create or replace function public.actualizar_reserva_taxista(
  p_reserva_id uuid,
  p_estado text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserva public.reservas%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  select * into v_reserva
  from public.reservas
  where id = p_reserva_id
    and taxista_id = auth.uid()
  for update;

  if v_reserva.id is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;

  if not (
    (v_reserva.estado = 'pendiente' and p_estado in ('aceptada', 'rechazada'))
    or (v_reserva.estado = 'aceptada' and p_estado in ('completada', 'no_show', 'cancelada_taxista'))
  ) then
    raise exception 'La reservación ya no admite este cambio.' using errcode = '22023';
  end if;

  if p_estado = 'aceptada' and v_reserva.asientos_ofrecidos is not null then
    raise exception 'Ofreciste % asiento(s) al cliente; espera su respuesta.',
      v_reserva.asientos_ofrecidos
      using errcode = '22023';
  end if;

  if p_estado = 'rechazada' and v_motivo is null then
    raise exception 'Indica al cliente el motivo del rechazo.' using errcode = '22023';
  end if;

  if char_length(v_motivo) > 200 then
    raise exception 'El motivo puede tener hasta 200 caracteres.' using errcode = '22023';
  end if;

  update public.reservas
  set estado = p_estado,
      motivo_taxista = case
        when p_estado in ('rechazada', 'cancelada_taxista') then v_motivo
        else motivo_taxista
      end
  where id = p_reserva_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ofrecer menos asientos
-- ---------------------------------------------------------------------------

-- La reserva conserva sus primeros `p_cantidad` asientos. Los demás quedan
-- ocupados sin reserva: el taxista dijo que no los tiene, así nadie más los
-- reserva. Puede liberarlos después con `marcar_asientos_taxista`.
create or replace function public.ofrecer_asientos_taxista(
  p_reserva_id uuid,
  p_cantidad integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserva public.reservas%rowtype;
begin
  select * into v_reserva
  from public.reservas
  where id = p_reserva_id
    and taxista_id = auth.uid()
  for update;

  if v_reserva.id is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;

  if v_reserva.estado <> 'pendiente' then
    raise exception 'Solo puedes ofrecer asientos en una solicitud pendiente.' using errcode = '22023';
  end if;

  if v_reserva.asientos_ofrecidos is not null then
    raise exception 'Ya ofreciste % asiento(s) en esta solicitud.', v_reserva.asientos_ofrecidos
      using errcode = '22023';
  end if;

  if p_cantidad is null or p_cantidad < 1 or p_cantidad >= v_reserva.cantidad_asientos then
    raise exception 'Ofrece de 1 a % asiento(s); si no tienes ninguno, rechaza la solicitud.',
      v_reserva.cantidad_asientos - 1
      using errcode = '22023';
  end if;

  update public.asientos
  set estado = 'ocupado', reserva_id = null
  where id in (
    select id
    from public.asientos
    where reserva_id = p_reserva_id
      and id is distinct from v_reserva.asiento_id
    order by numero_asiento desc
    limit v_reserva.cantidad_asientos - p_cantidad
  );

  update public.reservas
  set asientos_ofrecidos = p_cantidad
  where id = p_reserva_id;
end;
$$;

-- El cliente acepta: la reserva queda aceptada con los asientos ofrecidos y
-- el precio por asiento de la solicitud. No acepta: la solicitud se cancela.
create or replace function public.responder_oferta_asientos_cliente(
  p_reserva_id uuid,
  p_acepta boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserva public.reservas%rowtype;
begin
  select * into v_reserva
  from public.reservas
  where id = p_reserva_id
    and cliente_id = auth.uid()
  for update;

  if v_reserva.id is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;

  if v_reserva.estado <> 'pendiente' or v_reserva.asientos_ofrecidos is null then
    raise exception 'Esta reservación ya no tiene una oferta por responder.' using errcode = '22023';
  end if;

  if p_acepta then
    update public.reservas
    set estado = 'aceptada',
        precio = round(precio / cantidad_asientos * asientos_ofrecidos, 2),
        cantidad_asientos = asientos_ofrecidos
    where id = p_reserva_id;
  else
    update public.reservas
    set estado = 'cancelada_cliente'
    where id = p_reserva_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notificaciones y asientos al cambiar una reserva
-- ---------------------------------------------------------------------------

-- Igual que en `20261020120000_reservar_varios_asientos.sql`, más el motivo
-- del taxista, la oferta de asientos y la respuesta del cliente a la oferta.
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
  v_hubo_oferta boolean;
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
    v_hubo_oferta := old.estado = 'pendiente' and old.asientos_ofrecidos is not null;

    if new.estado = 'aceptada' and v_hubo_oferta then
      v_tipo := 'reserva_aceptada';
      v_titulo := 'Oferta aceptada';
      v_mensaje := 'El cliente aceptó ' || new.cantidad_asientos
        || case when new.cantidad_asientos = 1 then ' asiento.' else ' asientos.' end
        || ' El viaje quedó aceptado.';
      v_destinatario := new.taxista_id;
    elsif new.estado = 'aceptada' then
      v_tipo := 'reserva_aceptada';
      v_titulo := '¡Reserva aceptada!';
      v_mensaje := 'Tu reserva fue aceptada. Prepárate para tu viaje.';
      v_destinatario := new.cliente_id;
    elsif new.estado = 'rechazada' then
      v_tipo := 'reserva_rechazada';
      v_titulo := 'Reserva rechazada';
      v_mensaje := case
        when new.motivo_taxista is not null
          then 'El taxista rechazó tu solicitud. Motivo: ' || new.motivo_taxista
        else 'Lo sentimos, tu reserva fue rechazada por el taxista.'
      end;
      v_destinatario := new.cliente_id;
    elsif new.estado = 'cancelada_cliente' then
      v_tipo := 'reserva_cancelada';
      v_titulo := 'Reserva cancelada';
      v_mensaje := case
        when v_hubo_oferta and old.asientos_ofrecidos = 1
          then 'El cliente no aceptó el asiento que ofreciste.'
        when v_hubo_oferta
          then 'El cliente no aceptó los ' || old.asientos_ofrecidos || ' asientos que ofreciste.'
        else 'El cliente canceló su reserva.'
      end;
      v_destinatario := new.taxista_id;
    elsif new.estado = 'cancelada_taxista' then
      v_tipo := 'reserva_cancelada';
      v_titulo := 'Reserva cancelada por el taxista';
      v_mensaje := case
        when new.motivo_taxista is not null
          then 'El taxista canceló tu reserva. Motivo: ' || new.motivo_taxista
        else 'El taxista canceló tu reserva. Busca otra opción.'
      end;
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
  elsif tg_op = 'UPDATE'
        and new.estado = 'pendiente'
        and old.asientos_ofrecidos is null
        and new.asientos_ofrecidos is not null then
    v_tipo := 'asientos_ofrecidos';
    v_titulo := 'El taxista tiene menos asientos';
    v_mensaje := 'Pediste ' || new.cantidad_asientos || ' asientos, pero el taxista solo tiene '
      || case when new.asientos_ofrecidos = 1 then '1 disponible' else new.asientos_ofrecidos || ' disponibles' end
      || '. Abre tu reservación para aceptarlos o cancelar.';
    v_destinatario := new.cliente_id;
  end if;

  if v_tipo is not null then
    insert into public.notificaciones (usuario_id, titulo, mensaje, tipo, reserva_id)
    values (v_destinatario, v_titulo, v_mensaje, v_tipo, new.id);
  end if;

  return new;
end;
$$;

-- El trigger solo escuchaba `estado`; la oferta cambia `asientos_ofrecidos`.
drop trigger if exists trigger_notificar_reserva on public.reservas;
create trigger trigger_notificar_reserva
  after insert or update of estado, asientos_ofrecidos on public.reservas
  for each row execute function public.notificar_cambio_reserva();

-- ---------------------------------------------------------------------------
-- Reservas del taxista
-- ---------------------------------------------------------------------------

drop function if exists public.obtener_reservas_taxista();

-- Igual que en `20261020120000_reservar_varios_asientos.sql`, con el motivo y
-- la oferta de asientos.
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
  telefono_cliente text,
  motivo_taxista text,
  asientos_ofrecidos integer
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
    case when reserva.estado in ('pendiente', 'aceptada') then cliente.telefono::text end,
    reserva.motivo_taxista,
    reserva.asientos_ofrecidos::integer
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

revoke all on function public.marcar_asientos_taxista(uuid[], boolean) from public, anon;
revoke all on function public.actualizar_reserva_taxista(uuid, text, text) from public, anon;
revoke all on function public.ofrecer_asientos_taxista(uuid, integer) from public, anon;
revoke all on function public.responder_oferta_asientos_cliente(uuid, boolean) from public, anon;
revoke all on function public.obtener_reservas_taxista() from public, anon;
grant execute on function public.marcar_asientos_taxista(uuid[], boolean) to authenticated;
grant execute on function public.actualizar_reserva_taxista(uuid, text, text) to authenticated;
grant execute on function public.ofrecer_asientos_taxista(uuid, integer) to authenticated;
grant execute on function public.responder_oferta_asientos_cliente(uuid, boolean) to authenticated;
grant execute on function public.obtener_reservas_taxista() to authenticated;

notify pgrst, 'reload schema';
