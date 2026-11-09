-- Consulta puntual para abrir avisos antiguos sin depender del límite de la lista.
begin;

create or replace function public.obtener_reserva_taxista(p_reserva_id uuid)
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
    and reserva.id = p_reserva_id;
$$;

revoke all on function public.obtener_reserva_taxista(uuid) from public, anon;
grant execute on function public.obtener_reserva_taxista(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
