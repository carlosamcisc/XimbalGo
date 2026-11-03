-- US-0026: el abordaje se conserva incluso después de completar el viaje.
alter table public.reservas add column abordado_en timestamptz;

alter table public.notificaciones drop constraint notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in (
  'reserva_solicitada', 'reserva_aceptada', 'reserva_rechazada', 'reserva_cancelada',
  'van_llegando', 'viaje_completado', 'asientos_ofrecidos', 'cliente_abordo'
));

create or replace function public.confirmar_abordaje_taxista(p_reserva_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_reserva public.reservas%rowtype;
begin
  select * into v_reserva from public.reservas
  where id = p_reserva_id and taxista_id = auth.uid() for update;
  if v_reserva.id is null then
    raise exception 'No se encontró la reservación.' using errcode = '22023';
  end if;
  if v_reserva.estado <> 'aceptada' then
    raise exception 'Solo puedes confirmar el abordaje de una reservación aceptada.' using errcode = '22023';
  end if;
  -- Los reintentos y toques simultáneos no generan avisos duplicados.
  if v_reserva.abordado_en is not null then return v_reserva.abordado_en; end if;
  update public.reservas set abordado_en = now() where id = p_reserva_id
  returning abordado_en into v_reserva.abordado_en;
  insert into public.notificaciones(usuario_id, titulo, mensaje, tipo, reserva_id)
  values (v_reserva.cliente_id, '¡Ya estás a bordo!',
    'Tu taxista confirmó que ya subiste a su taxi. ¡Buen viaje!', 'cliente_abordo', v_reserva.id);
  return v_reserva.abordado_en;
end;
$$;
revoke all on function public.confirmar_abordaje_taxista(uuid) from public, anon;
grant execute on function public.confirmar_abordaje_taxista(uuid) to authenticated;

-- También protege llamadas de versiones anteriores de la app.
create or replace function public.validar_estado_abordaje()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.abordado_en is not null and new.estado in ('no_show', 'cancelada_cliente') then
    raise exception 'El cliente ya está a bordo; no se puede cancelar ni marcar que no se presentó.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger trigger_validar_estado_abordaje before update of estado on public.reservas
for each row execute function public.validar_estado_abordaje();

drop function if exists public.obtener_reservas_taxista();

-- Conserva la consulta existente y agrega la fecha de abordaje.
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
  asientos_ofrecidos integer,
  abordado_en timestamptz
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
    reserva.asientos_ofrecidos::integer,
    reserva.abordado_en
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


revoke all on function public.obtener_reservas_taxista() from public, anon;
grant execute on function public.obtener_reservas_taxista() to authenticated;
notify pgrst, 'reload schema';
