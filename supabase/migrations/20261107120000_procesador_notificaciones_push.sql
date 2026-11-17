begin;

-- Cada trabajo conserva el destino original. Una rotación del token o un
-- cambio de entorno cancela el trabajo antiguo, en lugar de redirigirlo.
alter table public.envios_push
  add column token_destino text,
  add column proyecto_id uuid,
  add column entorno text,
  add column bloqueo_id uuid,
  add column intentos_recibo integer not null default 0 check (intentos_recibo >= 0);
update public.envios_push e set token_destino = d.expo_push_token,
  proyecto_id = d.proyecto_id, entorno = d.entorno
from public.dispositivos_push d where d.id = e.dispositivo_id;
alter table public.envios_push
  alter column token_destino set not null,
  alter column proyecto_id set not null,
  alter column entorno set not null,
  add constraint envios_push_entorno_check check (entorno in ('development', 'preview', 'production'));

create function public.encolar_notificacion_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.envios_push (notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
  select new.id, d.id, d.expo_push_token, d.proyecto_id, d.entorno
  from public.dispositivos_push d where d.usuario_id = new.usuario_id and d.activo
  on conflict (notificacion_id, dispositivo_id) do nothing;
  return new;
end;
$$;
create trigger notificacion_encolar_push after insert on public.notificaciones
  for each row execute function public.encolar_notificacion_push();

-- No se reprocesan avisos históricos al registrar o reactivar un teléfono.
create function public.cancelar_envios_dispositivo_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.activo or old.expo_push_token is distinct from new.expo_push_token
    or old.proyecto_id is distinct from new.proyecto_id or old.entorno is distinct from new.entorno then
    update public.envios_push set estado = 'cancelado', bloqueo_id = null,
      bloqueado_hasta = null, ultimo_error = 'DestinoModificado'
    where dispositivo_id = new.id and estado in ('pendiente', 'procesando', 'enviado');
  end if;
  return new;
end;
$$;
create trigger dispositivo_cancelar_envios_push after update of activo, expo_push_token, proyecto_id, entorno
  on public.dispositivos_push for each row execute function public.cancelar_envios_dispositivo_push();

create function public.reclamar_envios_push(p_proyecto_id uuid, p_entorno text,
  p_recibos boolean default false, p_limite integer default 50)
returns table (id uuid, bloqueo_id uuid, token_destino text, notificacion_id uuid,
  reserva_id uuid, tipo text, titulo text, mensaje text, ticket_expo text, vence_en timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if p_entorno not in ('development', 'preview', 'production') or p_entorno is null
    or p_proyecto_id is null or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'Parámetros push inválidos.' using errcode = '22023';
  end if;

  -- Cancelar destinatarios inválidos también protege trabajos insertados por
  -- herramientas de administración y recibos de un token que ya fue rotado.
  update public.envios_push e set estado = 'cancelado', ultimo_error = 'DestinoInvalido',
    bloqueo_id = null, bloqueado_hasta = null
  from public.notificaciones n, public.dispositivos_push d
  where e.notificacion_id = n.id and e.dispositivo_id = d.id
    and e.proyecto_id = p_proyecto_id and e.entorno = p_entorno
    and e.estado in ('pendiente', 'procesando', 'enviado')
    and (not d.activo or d.usuario_id <> n.usuario_id or d.expo_push_token <> e.token_destino
      or d.proyecto_id <> e.proyecto_id or d.entorno <> e.entorno);

  update public.envios_push e set estado = 'error', ultimo_error = 'EnvioVencido',
    bloqueo_id = null, bloqueado_hasta = null
  from public.notificaciones n where n.id = e.notificacion_id
    and e.proyecto_id = p_proyecto_id and e.entorno = p_entorno
    and e.estado in ('pendiente', 'procesando')
    and (n.fecha_envio <= now() - interval '2 hours' or
      (e.intentos >= 6 and (e.bloqueado_hasta is null or e.bloqueado_hasta <= now())));

  update public.envios_push e set estado = 'error', ultimo_error = 'ReciboVencido',
    bloqueo_id = null, bloqueado_hasta = null
  where e.proyecto_id = p_proyecto_id and e.entorno = p_entorno and e.estado = 'enviado'
    and (e.enviado_en <= now() - interval '24 hours' or e.intentos_recibo >= 24)
    and (e.bloqueado_hasta is null or e.bloqueado_hasta <= now());

  return query
  with candidatos as (
    select e.id from public.envios_push e
    where e.proyecto_id = p_proyecto_id and e.entorno = p_entorno
      and e.proximo_intento_en <= now()
      and (e.bloqueado_hasta is null or e.bloqueado_hasta <= now())
      and (case when p_recibos then e.estado = 'enviado' and e.ticket_expo is not null
        else e.estado in ('pendiente', 'procesando') end)
    order by e.proximo_intento_en, e.id
    limit p_limite for update of e skip locked
  ), tomados as (
    update public.envios_push e set bloqueo_id = gen_random_uuid(),
      bloqueado_hasta = now() + interval '2 minutes',
      estado = case when p_recibos then 'enviado' else 'procesando' end,
      intentos = e.intentos + case when p_recibos then 0 else 1 end,
      intentos_recibo = e.intentos_recibo + case when p_recibos then 1 else 0 end
    from candidatos c where c.id = e.id returning e.*
  )
  select t.id, t.bloqueo_id, t.token_destino, t.notificacion_id,
    n.reserva_id, n.tipo::text, n.titulo::text, n.mensaje::text,
    t.ticket_expo, n.fecha_envio + interval '2 hours'
  from tomados t join public.notificaciones n on n.id = t.notificacion_id;
end;
$$;

create function public.resolver_envio_push(p_id uuid, p_bloqueo_id uuid,
  p_accion text, p_ticket text default null, p_codigo text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.envios_push%rowtype;
begin
  select * into v_envio from public.envios_push
  where id = p_id and bloqueo_id = p_bloqueo_id and bloqueado_hasta > now()
    and estado in ('procesando', 'enviado') for update;
  if not found then return false; end if;
  if p_accion is null or p_accion not in
    ('enviado', 'confirmado', 'reintentar', 'esperar_recibo', 'error', 'dispositivo_invalido') then
    raise exception 'Acción push inválida.' using errcode = '22023';
  end if;
  if (p_accion = 'enviado' and v_envio.estado <> 'procesando')
    or (p_accion in ('confirmado', 'esperar_recibo') and v_envio.estado <> 'enviado')
    or (p_accion = 'enviado' and (p_ticket is null or length(p_ticket) not between 1 and 200)) then
    raise exception 'Transición push inválida.' using errcode = '22023';
  end if;

  if p_accion = 'dispositivo_invalido' then
    -- Un recibo tardío no puede desactivar el nuevo token del teléfono.
    update public.dispositivos_push set activo = false
    where id = v_envio.dispositivo_id and expo_push_token = v_envio.token_destino;
  end if;

  update public.envios_push set
    estado = case p_accion
      when 'enviado' then 'enviado'
      when 'confirmado' then 'confirmado'
      when 'reintentar' then case when intentos < 6 then 'pendiente' else 'error' end
      when 'esperar_recibo' then case when intentos_recibo < 24 then 'enviado' else 'error' end
      else 'error' end,
    ticket_expo = case when p_accion = 'enviado' then p_ticket
      when p_accion = 'reintentar' then null else ticket_expo end,
    enviado_en = case when p_accion = 'enviado' then now()
      when p_accion = 'reintentar' then null else enviado_en end,
    intentos_recibo = case when p_accion = 'enviado' then 0 else intentos_recibo end,
    confirmado_en = case when p_accion = 'confirmado' then now() else confirmado_en end,
    proximo_intento_en = case p_accion
      when 'enviado' then now() + interval '15 minutes'
      when 'esperar_recibo' then now() + interval '5 minutes'
      when 'reintentar' then now() + interval '30 seconds' * power(2, least(intentos - 1, 5))
      else proximo_intento_en end,
    ultimo_error = case when p_accion in ('confirmado', 'enviado') then null else left(p_codigo, 100) end,
    bloqueo_id = null, bloqueado_hasta = null
  where id = p_id;
  return true;
end;
$$;

revoke all on function public.encolar_notificacion_push(), public.cancelar_envios_dispositivo_push(),
  public.reclamar_envios_push(uuid, text, boolean, integer),
  public.resolver_envio_push(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reclamar_envios_push(uuid, text, boolean, integer),
  public.resolver_envio_push(uuid, uuid, text, text, text) to service_role;

commit;
