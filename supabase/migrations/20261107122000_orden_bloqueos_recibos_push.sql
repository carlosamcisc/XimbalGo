begin;
-- Dos recibos inválidos del mismo teléfono pueden resolverse a la vez.
-- Bloquear el dispositivo antes que su trabajo evita que cada transacción
-- conserve un trabajo mientras espera el dispositivo de la otra.
create or replace function public.resolver_envio_push(p_id uuid, p_bloqueo_id uuid,
  p_accion text, p_ticket text default null, p_codigo text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.envios_push%rowtype;
begin
  if p_accion = 'dispositivo_invalido' then
    perform d.id from public.dispositivos_push d join public.envios_push e on e.dispositivo_id = d.id
    where e.id = p_id and e.bloqueo_id = p_bloqueo_id and e.bloqueado_hasta > now()
      and e.estado in ('procesando', 'enviado') for update of d;
  end if;
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
create index envios_push_proyecto_entorno_idx on public.envios_push (proyecto_id, entorno, proximo_intento_en)
  where estado in ('pendiente', 'procesando', 'enviado');
commit;
