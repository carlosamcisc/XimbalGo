begin;

alter table public.reservas add column llegada_notificada_en timestamptz;
update public.reservas r set llegada_notificada_en = (
  select min(n.fecha_envio) from public.notificaciones n
  where n.reserva_id = r.id and n.tipo = 'van_llegando'
) where exists (select 1 from public.notificaciones n where n.reserva_id = r.id and n.tipo = 'van_llegando');
create index reservas_pendientes_llegada_idx on public.reservas (taxista_id)
  where estado = 'aceptada' and abordado_en is null and llegada_notificada_en is null;

-- Solo puntos concretos de la reserva o ubicación compartida voluntariamente.
-- No se infiere el abordaje de nombres de rutas ni de un GPS histórico global.
create function public.taxi_cerca_abordaje(p_reserva_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select r.estado = 'aceptada' and r.abordado_en is null
      and (r.fecha_hora_viaje is null or r.fecha_hora_viaje <= now() + interval '15 minutes')
      and t.taxista_activo and v.activo
      and t.ubicacion_actual is not null
      and t.ubicacion_actualizada_en > now() - interval '90 seconds'
      and t.ubicacion_actualizada_en <= now()
      and coalesce(r.ubicacion_origen, p.ubicacion, compartida.ubicacion) is not null
      and public.st_dwithin(t.ubicacion_actual,
        coalesce(r.ubicacion_origen, p.ubicacion, compartida.ubicacion), 150)
    from public.reservas r
    join public.taxistas t on t.id = r.taxista_id
    join public.vehiculos v on v.id = r.vehiculo_id and v.taxista_id = r.taxista_id
    left join public.paraderos p on p.id = r.paradero_origen_id and p.activo
    left join public.ubicaciones_reserva compartida on compartida.reserva_id = r.id
      and compartida.actualizada_en > now() - interval '45 seconds'
      and compartida.actualizada_en <= now()
    where r.id = p_reserva_id
  ), false);
$$;

create function public.notificar_llegada_taxi(p_taxista_id uuid, p_reserva_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_avisos uuid[];
begin
  -- UPDATE condicional: dos ejecuciones simultáneas no crean dos avisos.
  with detectadas as (
    update public.reservas r set llegada_notificada_en = now()
    where r.taxista_id = p_taxista_id and (p_reserva_id is null or r.id = p_reserva_id)
      and r.estado = 'aceptada' and r.abordado_en is null and r.llegada_notificada_en is null
      and public.taxi_cerca_abordaje(r.id)
    returning r.id, r.cliente_id
  ), avisos as (
    insert into public.notificaciones (usuario_id, reserva_id, titulo, mensaje, tipo)
    select cliente_id, id, 'Tu taxi está llegando',
      'Tu taxi está cerca del punto de abordaje. Prepárate para subir.', 'van_llegando'
    from detectadas returning id
  ) select array_agg(id) into v_avisos from avisos;

  -- pg_net inicia la petición después del COMMIT. No esperar al cron de un
  -- minuto para un aviso de proximidad. Respetar la pausa administrativa.
  if v_avisos is not null
    and exists (select 1 from public.envios_push where notificacion_id = any(v_avisos) and estado = 'pendiente')
    and exists (select 1 from cron.job where jobname = 'ximbalgo-push-cada-minuto' and active) then
    begin
      perform public.invocar_procesador_push();
    exception when others then
      -- Un problema de configuración/red no debe impedir guardar GPS o aceptar.
      -- El trabajo permanece en cola y el cron puede retomarlo.
      raise warning 'No se pudo despertar el procesador push; el cron retomará la cola.';
    end;
  end if;
end;
$$;

create function public.detectar_llegada_ubicacion_taxista()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notificar_llegada_taxi(new.id);
  return new;
end;
$$;
create trigger detectar_llegada_taxista
  after update of ubicacion_actual, ubicacion_actualizada_en, taxista_activo on public.taxistas
  for each row when (new.taxista_activo)
  execute function public.detectar_llegada_ubicacion_taxista();

create function public.detectar_llegada_reserva()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notificar_llegada_taxi(new.taxista_id, new.id);
  return new;
end;
$$;
create trigger detectar_llegada_reserva
  after insert or update of estado, ubicacion_origen, paradero_origen_id, fecha_hora_viaje, taxista_id on public.reservas
  for each row when (new.estado = 'aceptada' and new.abordado_en is null and new.llegada_notificada_en is null)
  execute function public.detectar_llegada_reserva();

create function public.detectar_llegada_ubicacion_reserva()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_taxista uuid;
begin
  select taxista_id into v_taxista from public.reservas where id = new.reserva_id;
  perform public.notificar_llegada_taxi(v_taxista, new.reserva_id);
  return new;
end;
$$;
create trigger detectar_llegada_compartida
  after insert or update of ubicacion, actualizada_en on public.ubicaciones_reserva
  for each row execute function public.detectar_llegada_ubicacion_reserva();

-- Mantener la reclamación, leases y backoff existentes; añadir la validación
-- de vigencia del aviso de llegada sin cambiar el contrato REST del worker.
alter function public.reclamar_envios_push(uuid, text, boolean, integer) rename to reclamar_envios_push_base;
revoke all on function public.reclamar_envios_push_base(uuid, text, boolean, integer) from public, anon, authenticated, service_role;

create function public.reclamar_envios_push(p_proyecto_id uuid, p_entorno text,
  p_recibos boolean default false, p_limite integer default 50)
returns table (id uuid, bloqueo_id uuid, token_destino text, notificacion_id uuid,
  reserva_id uuid, tipo text, titulo text, mensaje text, ticket_expo text, vence_en timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_trabajo record; v_vence timestamptz;
begin
  for v_trabajo in select b.* from public.reclamar_envios_push_base(p_proyecto_id, p_entorno, p_recibos, p_limite) b loop
    if not coalesce(p_recibos, false) and v_trabajo.tipo = 'van_llegando' then
      select n.fecha_envio + interval '5 minutes' into v_vence
      from public.notificaciones n where n.id = v_trabajo.notificacion_id;
      if v_vence <= now() or not public.taxi_cerca_abordaje(v_trabajo.reserva_id) then
        update public.envios_push e set estado = 'cancelado', ultimo_error = 'LlegadaNoVigente',
          bloqueo_id = null, bloqueado_hasta = null
        where e.id = v_trabajo.id and e.bloqueo_id = v_trabajo.bloqueo_id;
        continue;
      end if;
      v_trabajo.vence_en := least(v_trabajo.vence_en, v_vence);
    end if;
    return query select v_trabajo.id, v_trabajo.bloqueo_id, v_trabajo.token_destino,
      v_trabajo.notificacion_id, v_trabajo.reserva_id, v_trabajo.tipo, v_trabajo.titulo,
      v_trabajo.mensaje, v_trabajo.ticket_expo, v_trabajo.vence_en;
  end loop;
end;
$$;

revoke all on function public.taxi_cerca_abordaje(uuid), public.notificar_llegada_taxi(uuid,uuid),
  public.detectar_llegada_ubicacion_taxista(), public.detectar_llegada_reserva(),
  public.detectar_llegada_ubicacion_reserva() from public, anon, authenticated, service_role;
revoke all on function public.reclamar_envios_push(uuid,text,boolean,integer) from public, anon, authenticated;
grant execute on function public.reclamar_envios_push(uuid,text,boolean,integer) to service_role;
notify pgrst, 'reload schema';
commit;
