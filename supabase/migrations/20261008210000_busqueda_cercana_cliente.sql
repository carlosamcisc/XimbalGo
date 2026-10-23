create or replace function public.obtener_paraderos_cercanos(
  p_latitud double precision,
  p_longitud double precision,
  p_limite integer default 5
)
returns table (
  id uuid,
  nombre text,
  referencia text,
  distancia_metros double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ubicacion_cliente as (
    select public.st_setsrid(
      public.st_makepoint(p_longitud, p_latitud),
      4326
    )::public.geography as punto
  )
  select
    paradero.id,
    paradero.nombre,
    paradero.referencia,
    public.st_distance(
      paradero.ubicacion::public.geography,
      ubicacion_cliente.punto
    ) as distancia_metros
  from public.paraderos as paradero
  cross join ubicacion_cliente
  where paradero.activo
    and paradero.ubicacion is not null
  order by distancia_metros
  limit least(greatest(coalesce(p_limite, 5), 1), 5);
$$;

revoke all on function public.obtener_paraderos_cercanos(
  double precision,
  double precision,
  integer
) from public;
grant execute on function public.obtener_paraderos_cercanos(
  double precision,
  double precision,
  integer
) to authenticated;

create or replace function public.obtener_taxis_cercanos(
  p_latitud double precision,
  p_longitud double precision,
  p_limite integer default 5
)
returns table (
  vehiculo_id uuid,
  matricula text,
  nombre_taxista text,
  asientos_disponibles integer,
  distancia_metros double precision
)
language sql
stable
security invoker
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
  order by distancia_metros
  limit least(greatest(coalesce(p_limite, 5), 1), 5);
$$;

revoke all on function public.obtener_taxis_cercanos(
  double precision,
  double precision,
  integer
) from public;
grant execute on function public.obtener_taxis_cercanos(
  double precision,
  double precision,
  integer
) to authenticated;
