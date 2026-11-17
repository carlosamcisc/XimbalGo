begin;

create table public.preferencias_notificaciones (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  push_habilitado boolean not null default true,
  reservas boolean not null default true,
  llegada boolean not null default true,
  viajes boolean not null default true
);
alter table public.preferencias_notificaciones enable row level security;
revoke all on public.preferencias_notificaciones from public, anon, authenticated;
grant select on public.preferencias_notificaciones to authenticated;
grant insert (usuario_id, push_habilitado, reservas, llegada, viajes),
  update (push_habilitado, reservas, llegada, viajes)
  on public.preferencias_notificaciones to authenticated;
grant all on public.preferencias_notificaciones to service_role;
create policy preferencias_ver on public.preferencias_notificaciones for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy preferencias_crear on public.preferencias_notificaciones for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy preferencias_actualizar on public.preferencias_notificaciones for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- Cambiar un campo no sobrescribe las elecciones hechas en otro teléfono.
create function public.guardar_preferencia_push(p_usuario_id uuid, p_campo text, p_valor boolean)
returns setof public.preferencias_notificaciones
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_usuario_id is distinct from auth.uid() then
    raise exception 'Se requiere una sesión activa.' using errcode = '42501';
  end if;
  if p_campo is null or p_campo not in ('push_habilitado', 'reservas', 'llegada', 'viajes') or p_valor is null then
    raise exception 'Preferencia inválida.' using errcode = '22023';
  end if;
  return query
  insert into public.preferencias_notificaciones as p (usuario_id, push_habilitado, reservas, llegada, viajes)
  values (auth.uid(), case when p_campo = 'push_habilitado' then p_valor else true end,
    case when p_campo = 'reservas' then p_valor else true end,
    case when p_campo = 'llegada' then p_valor else true end,
    case when p_campo = 'viajes' then p_valor else true end)
  on conflict (usuario_id) do update set
    push_habilitado = case when p_campo = 'push_habilitado' then p_valor else p.push_habilitado end,
    reservas = case when p_campo = 'reservas' then p_valor else p.reservas end,
    llegada = case when p_campo = 'llegada' then p_valor else p.llegada end,
    viajes = case when p_campo = 'viajes' then p_valor else p.viajes end
  returning p.*;
end;
$$;
revoke all on function public.guardar_preferencia_push(uuid,text,boolean) from public, anon;
grant execute on function public.guardar_preferencia_push(uuid,text,boolean) to authenticated;

-- Sin fila se conserva el comportamiento de las instalaciones existentes.
create function public.permite_notificacion_push(p_usuario_id uuid, p_tipo text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.push_habilitado and case
    when p_tipo = 'van_llegando' then p.llegada
    when p_tipo in ('cliente_abordo', 'viaje_completado') then p.viajes
    else p.reservas end
  from public.preferencias_notificaciones p where p.usuario_id = p_usuario_id), true);
$$;

create or replace function public.encolar_notificacion_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.permite_notificacion_push(new.usuario_id, new.tipo::text) then
    insert into public.envios_push (notificacion_id, dispositivo_id, token_destino, proyecto_id, entorno)
    select new.id, d.id, d.expo_push_token, d.proyecto_id, d.entorno
    from public.dispositivos_push d where d.usuario_id = new.usuario_id and d.activo
    on conflict (notificacion_id, dispositivo_id) do nothing;
  end if;
  return new;
end;
$$;

create function public.cancelar_envios_por_preferencias()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Los recibos de mensajes ya enviados se siguen consultando normalmente.
  update public.envios_push e set estado = 'cancelado', ultimo_error = 'PreferenciaDesactivada',
    bloqueo_id = null, bloqueado_hasta = null
  from public.notificaciones n where n.id = e.notificacion_id and n.usuario_id = new.usuario_id
    and e.estado in ('pendiente', 'procesando') and not (new.push_habilitado and case
      when n.tipo = 'van_llegando' then new.llegada
      when n.tipo in ('cliente_abordo', 'viaje_completado') then new.viajes
      else new.reservas end);
  return new;
end;
$$;
create trigger preferencias_cancelar_envios after insert or update on public.preferencias_notificaciones
  for each row execute function public.cancelar_envios_por_preferencias();

-- Conserva las reglas de llegada, TTL, leases y recibos de las partes previas.
create or replace function public.reclamar_envios_push(p_proyecto_id uuid, p_entorno text,
  p_recibos boolean default false, p_limite integer default 50)
returns table (id uuid, bloqueo_id uuid, token_destino text, notificacion_id uuid,
  reserva_id uuid, tipo text, titulo text, mensaje text, ticket_expo text, vence_en timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_trabajo record; v_vence timestamptz;
begin
  if not coalesce(p_recibos, false) then
    update public.envios_push e set estado = 'cancelado', ultimo_error = 'PreferenciaDesactivada',
      bloqueo_id = null, bloqueado_hasta = null
    from public.notificaciones n where n.id = e.notificacion_id
      and e.proyecto_id = p_proyecto_id and e.entorno = p_entorno
      and e.estado in ('pendiente', 'procesando')
      and not public.permite_notificacion_push(n.usuario_id, n.tipo::text);
  end if;
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
revoke all on function public.permite_notificacion_push(uuid,text),
  public.cancelar_envios_por_preferencias() from public, anon, authenticated, service_role;
-- El trigger y el wrapper conservan sus permisos privados existentes.
notify pgrst, 'reload schema';
commit;
