-- Distancias por calle a los paraderos cercanos y privacidad del GPS del taxista.
--
-- * La política `taxistas_ver_todos` deja a cualquier usuario autenticado leer
--   todas las filas de `taxistas`, y con ellas `ubicacion_actual`: cualquier
--   cliente podía consultar, o escuchar por Realtime, la posición de todos los
--   taxis. Se quita el permiso SELECT sobre esa columna; Realtime también
--   omite las columnas sin permiso. La app solo lee la ubicación del taxi con
--   `obtener_seguimiento_reserva`, que la entrega mientras la reserva está en
--   curso.
-- * `obtener_taxis_cercanos` y `obtener_taxis_disponibles` leían la columna con
--   los permisos del cliente: pasan a `security definer`. Solo devuelven la
--   distancia, y ya filtran taxistas en servicio y vehículos activos.
-- * `obtener_paraderos_cercanos` devuelve también las coordenadas del paradero:
--   la Edge Function `distancias-paraderos` las necesita para calcular la ruta.

revoke select on public.taxistas from anon, authenticated;
grant select (
  id, nombres, apellidos, direccion, telefono, punto_partida, punto_destino,
  taxista_activo, hora_inicio_trabajo, hora_fin_trabajo, horario_trabajo,
  precio_ruta, ruta_id, ubicacion_actualizada_en
) on public.taxistas to authenticated;

alter function public.obtener_taxis_cercanos(double precision, double precision, integer)
  security definer;
alter function public.obtener_taxis_disponibles(double precision, double precision)
  security definer;

revoke all on function public.obtener_taxis_cercanos(double precision, double precision, integer)
  from public, anon;
grant execute on function public.obtener_taxis_cercanos(double precision, double precision, integer)
  to authenticated;

-- Cambia el tipo de retorno: hay que borrarla antes de crearla.
drop function if exists public.obtener_paraderos_cercanos(double precision, double precision, integer);

create function public.obtener_paraderos_cercanos(
  p_latitud double precision,
  p_longitud double precision,
  p_limite integer default 5
)
returns table (
  id uuid,
  nombre text,
  referencia text,
  distancia_metros double precision,
  latitud double precision,
  longitud double precision
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
    ) as distancia_metros,
    public.st_y(paradero.ubicacion::public.geometry),
    public.st_x(paradero.ubicacion::public.geometry)
  from public.paraderos as paradero
  cross join ubicacion_cliente
  where paradero.activo
    and paradero.ubicacion is not null
  order by distancia_metros
  limit least(greatest(coalesce(p_limite, 5), 1), 5);
$$;

revoke all on function public.obtener_paraderos_cercanos(double precision, double precision, integer)
  from public, anon;
grant execute on function public.obtener_paraderos_cercanos(double precision, double precision, integer)
  to authenticated;
