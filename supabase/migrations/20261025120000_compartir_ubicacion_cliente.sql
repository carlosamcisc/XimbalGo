-- El cliente comparte su ubicación en tiempo real con un familiar.
--
-- El cliente inicia una ubicación compartida con una duración; la app envía
-- su posición mientras está abierta y comparte un enlace a la página web
-- `web/compartir/`. El familiar abre el enlace sin cuenta: la página llama a
-- `obtener_ubicacion_compartida` como `anon` con el id del enlace, que es un
-- uuid aleatorio y hace de llave.
--
-- La tabla no tiene políticas ni permisos directos: todo pasa por las RPC.
-- Al terminar o vencer, la RPC pública deja de devolver las coordenadas.

create table if not exists public.ubicaciones_compartidas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  ubicacion public.geography(point, 4326),
  ubicacion_actualizada_en timestamptz,
  creada_en timestamptz not null default now(),
  expira_en timestamptz not null,
  finalizada_en timestamptz
);

create index if not exists ubicaciones_compartidas_cliente_activas_idx
  on public.ubicaciones_compartidas (cliente_id)
  where finalizada_en is null;

alter table public.ubicaciones_compartidas enable row level security;
revoke all on table public.ubicaciones_compartidas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cliente
-- ---------------------------------------------------------------------------

-- Termina la que estuviera activa: solo hay una por cliente.
create or replace function public.iniciar_ubicacion_compartida(
  p_latitud double precision,
  p_longitud double precision,
  p_minutos integer
)
returns table (id uuid, expira_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_latitud is null or p_longitud is null
     or p_latitud not between -90 and 90
     or p_longitud not between -180 and 180 then
    raise exception 'Ubicación inválida.' using errcode = '22023';
  end if;

  if p_minutos is null or p_minutos not between 15 and 480 then
    raise exception 'La duración debe ser de 15 minutos a 8 horas.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.clientes as cliente where cliente.id = auth.uid()) then
    raise exception 'Solo un cliente con sesión activa puede compartir su ubicación.'
      using errcode = '42501';
  end if;

  update public.ubicaciones_compartidas as compartida
  set finalizada_en = now()
  where compartida.cliente_id = auth.uid()
    and compartida.finalizada_en is null;

  return query
  insert into public.ubicaciones_compartidas as compartida (
    cliente_id, ubicacion, ubicacion_actualizada_en, expira_en
  )
  values (
    auth.uid(),
    public.st_setsrid(public.st_makepoint(p_longitud, p_latitud), 4326)::public.geography,
    now(),
    now() + make_interval(mins => p_minutos)
  )
  returning compartida.id, compartida.expira_en;
end;
$$;

-- Devuelve false si ya terminó o venció: la app deja de enviar.
create or replace function public.actualizar_ubicacion_compartida(
  p_id uuid,
  p_latitud double precision,
  p_longitud double precision
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_latitud is null or p_longitud is null
     or p_latitud not between -90 and 90
     or p_longitud not between -180 and 180 then
    raise exception 'Ubicación inválida.' using errcode = '22023';
  end if;

  update public.ubicaciones_compartidas
  set ubicacion = public.st_setsrid(
        public.st_makepoint(p_longitud, p_latitud), 4326
      )::public.geography,
      ubicacion_actualizada_en = now()
  where id = p_id
    and cliente_id = auth.uid()
    and finalizada_en is null
    and expira_en > now();

  return found;
end;
$$;

create or replace function public.detener_ubicacion_compartida(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ubicaciones_compartidas
  set finalizada_en = now()
  where id = p_id
    and cliente_id = auth.uid()
    and finalizada_en is null;
$$;

-- Para retomar el envío al volver a abrir la app.
create or replace function public.obtener_ubicacion_compartida_activa()
returns table (id uuid, expira_en timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select compartida.id, compartida.expira_en
  from public.ubicaciones_compartidas as compartida
  where compartida.cliente_id = auth.uid()
    and compartida.finalizada_en is null
    and compartida.expira_en > now()
  order by compartida.creada_en desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Familiar (página web, sin sesión)
-- ---------------------------------------------------------------------------

-- Solo el primer nombre del cliente. Sin fila si el id no existe; con
-- `activa` en false y sin coordenadas si ya terminó o venció.
create or replace function public.obtener_ubicacion_compartida(p_id uuid)
returns table (
  nombre text,
  activa boolean,
  latitud double precision,
  longitud double precision,
  ubicacion_actualizada_en timestamptz,
  expira_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with compartida as (
    select
      compartida.*,
      compartida.finalizada_en is null and compartida.expira_en > now() as activa
    from public.ubicaciones_compartidas as compartida
    where compartida.id = p_id
  )
  select
    split_part(trim(cliente.nombres), ' ', 1),
    compartida.activa,
    case when compartida.activa then public.st_y(compartida.ubicacion::public.geometry) end,
    case when compartida.activa then public.st_x(compartida.ubicacion::public.geometry) end,
    case when compartida.activa then compartida.ubicacion_actualizada_en end,
    compartida.expira_en
  from compartida
  join public.clientes as cliente on cliente.id = compartida.cliente_id;
$$;

revoke all on function public.iniciar_ubicacion_compartida(double precision, double precision, integer) from public, anon;
revoke all on function public.actualizar_ubicacion_compartida(uuid, double precision, double precision) from public, anon;
revoke all on function public.detener_ubicacion_compartida(uuid) from public, anon;
revoke all on function public.obtener_ubicacion_compartida_activa() from public, anon;
revoke all on function public.obtener_ubicacion_compartida(uuid) from public;

grant execute on function public.iniciar_ubicacion_compartida(double precision, double precision, integer) to authenticated;
grant execute on function public.actualizar_ubicacion_compartida(uuid, double precision, double precision) to authenticated;
grant execute on function public.detener_ubicacion_compartida(uuid) to authenticated;
grant execute on function public.obtener_ubicacion_compartida_activa() to authenticated;
grant execute on function public.obtener_ubicacion_compartida(uuid) to anon, authenticated;
