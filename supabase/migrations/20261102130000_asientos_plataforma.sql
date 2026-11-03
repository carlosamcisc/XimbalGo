-- US-0027: separar capacidad física y asientos ofrecidos en la plataforma.
-- Los excluidos conservan el estado ocupado para que las consultas y RPC de
-- clientes existentes nunca los consideren disponibles.
alter table public.asientos
  add column en_plataforma boolean not null default true;

alter table public.asientos add constraint asientos_fuera_plataforma_check
  check (en_plataforma or (estado = 'ocupado' and reserva_id is null));

create or replace function public.configurar_asientos_plataforma(
  p_vehiculo_id uuid, p_cantidad integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacidad integer;
  v_actual integer;
  v_protegidos integer;
  v_ids uuid[];
begin
  select capacidad_total_asientos into v_capacidad
  from public.vehiculos
  where id = p_vehiculo_id and taxista_id = auth.uid()
  for update;
  if not found then
    raise exception 'No se encontró un vehículo de tu cuenta.' using errcode = '42501';
  end if;
  if p_cantidad is null or p_cantidad < 0 or p_cantidad > v_capacidad then
    raise exception 'Indica entre 0 y % asientos para la plataforma.', v_capacidad
      using errcode = '22023';
  end if;

  -- Mismo orden que marcar_asientos_taxista. Las reservas usan SKIP LOCKED.
  perform id from public.asientos where vehiculo_id = p_vehiculo_id
    order by numero_asiento for update;
  select count(*) filter (where en_plataforma),
    count(*) filter (where en_plataforma and (estado <> 'disponible' or reserva_id is not null))
    into v_actual, v_protegidos
  from public.asientos where vehiculo_id = p_vehiculo_id;
  if p_cantidad < v_protegidos then
    raise exception 'Hay % asientos reservados u ocupados. Libéralos antes de reducir la cantidad.', v_protegidos
      using errcode = '22023';
  end if;

  if p_cantidad < v_actual then
    select array_agg(id) into v_ids from (
      select id from public.asientos
      where vehiculo_id = p_vehiculo_id and en_plataforma
        and estado = 'disponible' and reserva_id is null
      order by numero_asiento desc limit (v_actual - p_cantidad)
    ) as elegidos;
    update public.asientos set en_plataforma = false, estado = 'ocupado'
      where id = any(v_ids);
  elsif p_cantidad > v_actual then
    select array_agg(id) into v_ids from (
      select id from public.asientos
      where vehiculo_id = p_vehiculo_id and not en_plataforma
      order by numero_asiento limit (p_cantidad - v_actual)
    ) as elegidos;
    update public.asientos set en_plataforma = true, estado = 'disponible'
      where id = any(v_ids);
  end if;
  return p_cantidad;
end;
$$;

revoke all on function public.configurar_asientos_plataforma(uuid, integer) from public, anon;
grant execute on function public.configurar_asientos_plataforma(uuid, integer) to authenticated;
