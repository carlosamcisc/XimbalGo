-- Detalle de un paradero para el cliente (XG-0012).
--
-- `paraderos.ubicacion` es `geography` y PostgREST la entrega como EWKB en
-- hexadecimal: esta función devuelve la latitud y longitud ya separadas para
-- abrir el mapa. `security invoker` mantiene la política RLS
-- `paraderos_ver_todos`, que solo deja ver los paraderos activos.
create or replace function public.obtener_paradero(
  p_paradero_id uuid
)
returns table (
  id uuid,
  nombre text,
  referencia text,
  foto_url text,
  latitud double precision,
  longitud double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    paradero.id,
    paradero.nombre,
    paradero.referencia,
    paradero.foto_url,
    public.st_y(paradero.ubicacion::public.geometry),
    public.st_x(paradero.ubicacion::public.geometry)
  from public.paraderos as paradero
  where paradero.id = p_paradero_id
    and paradero.activo;
$$;

revoke all on function public.obtener_paradero(uuid) from public, anon;
grant execute on function public.obtener_paradero(uuid) to authenticated;
