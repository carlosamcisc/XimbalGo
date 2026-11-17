-- Paraderos elegidos por cada conductor para su ruta y ubicación voluntaria
-- del cliente, accesible únicamente al conductor de una reserva aceptada.
create table public.paraderos_ruta_taxista (
  taxista_id uuid not null references public.taxistas(id) on delete cascade,
  ruta_id uuid not null references public.rutas(id) on delete cascade,
  paradero_id uuid not null references public.paraderos(id) on delete cascade,
  orden integer not null check (orden > 0),
  primary key (taxista_id, ruta_id, paradero_id),
  unique (taxista_id, ruta_id, orden)
);
create table public.ubicaciones_reserva (
  reserva_id uuid primary key references public.reservas(id) on delete cascade,
  ubicacion public.geography(point,4326) not null,
  actualizada_en timestamptz not null default now()
);
alter table public.paraderos_ruta_taxista enable row level security;
alter table public.ubicaciones_reserva enable row level security;
revoke all on public.paraderos_ruta_taxista, public.ubicaciones_reserva from public, anon, authenticated;

create function public.configurar_paraderos_taxista(p_paraderos uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare v_ruta uuid;
begin
  select ruta_id into v_ruta from public.taxistas where id = auth.uid() for update;
  if v_ruta is null then raise exception 'Selecciona tu ruta en Mi perfil.' using errcode = '42501'; end if;
  if p_paraderos is null or cardinality(p_paraderos) > 30
    or cardinality(p_paraderos) <> (select count(distinct id) from unnest(p_paraderos) id)
    or exists (select 1 from unnest(p_paraderos) as entrada(id) where not exists (
      select 1 from public.paraderos p where p.id = entrada.id and p.activo and p.ubicacion is not null
    )) then raise exception 'Selecciona hasta 30 paraderos activos sin repetir.' using errcode = '22023'; end if;
  delete from public.paraderos_ruta_taxista where taxista_id = auth.uid() and ruta_id = v_ruta;
  insert into public.paraderos_ruta_taxista (taxista_id, ruta_id, paradero_id, orden)
    select auth.uid(), v_ruta, id, orden::integer from unnest(p_paraderos) with ordinality as entrada(id, orden);
end;
$$;

create function public.catalogo_paraderos_taxista()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_ruta uuid;
begin
  select ruta_id into v_ruta from public.taxistas where id = auth.uid();
  if not found then raise exception 'Solo para taxistas.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre,
    'orden', pr.orden) order by pr.orden nulls last, p.nombre)
    from public.paraderos p left join public.paraderos_ruta_taxista pr
      on pr.paradero_id = p.id and pr.taxista_id = auth.uid() and pr.ruta_id = v_ruta
    where p.activo and p.ubicacion is not null), '[]'::jsonb);
end;
$$;

create function public.compartir_ubicacion_reserva(p_reserva_id uuid,
  p_latitud double precision default null, p_longitud double precision default null,
  p_compartir boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
declare v_reserva public.reservas%rowtype;
begin
  select * into v_reserva from public.reservas where id = p_reserva_id and cliente_id = auth.uid() for update;
  if not found then raise exception 'Reserva no disponible.' using errcode = '42501'; end if;
  if p_compartir is false then
    delete from public.ubicaciones_reserva where reserva_id = p_reserva_id;
    return;
  end if;
  if p_compartir is not true or v_reserva.estado <> 'aceptada' or v_reserva.abordado_en is not null then
    raise exception 'Solo se comparte antes del abordaje de una reserva aceptada.' using errcode = '42501';
  end if;
  if p_latitud is null or p_longitud is null or p_latitud not between -90 and 90 or p_longitud not between -180 and 180 then
    raise exception 'Ubicación no válida.' using errcode = '22023';
  end if;
  insert into public.ubicaciones_reserva values (p_reserva_id,
    public.st_setsrid(public.st_makepoint(p_longitud,p_latitud),4326)::public.geography, now())
  on conflict (reserva_id) do update set ubicacion = excluded.ubicacion, actualizada_en = excluded.actualizada_en;
end;
$$;

create function public.limpiar_ubicacion_reserva()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado <> 'aceptada' or new.abordado_en is not null or new.taxista_id is distinct from old.taxista_id then
    delete from public.ubicaciones_reserva where reserva_id = new.id;
  end if;
  return new;
end;
$$;
create trigger limpiar_ubicacion_reserva after update on public.reservas
for each row execute function public.limpiar_ubicacion_reserva();

create function public.obtener_mapa_taxista(p_reserva_id uuid default null, p_paradero_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_taxista public.taxistas%rowtype;
  v_reserva public.reservas%rowtype;
  v_ruta uuid;
  v_punto public.geography;
  v_cliente public.geography;
  v_cliente_en timestamptz;
  v_destino public.paraderos%rowtype;
  v_paraderos jsonb;
begin
  select * into v_taxista from public.taxistas where id = auth.uid();
  if not found then raise exception 'Solo para taxistas.' using errcode = '42501'; end if;
  v_ruta := v_taxista.ruta_id;
  if p_reserva_id is not null then
    select * into v_reserva from public.reservas where id = p_reserva_id and taxista_id = auth.uid()
      and estado in ('pendiente','aceptada') and abordado_en is null;
    if not found then raise exception 'Reserva no disponible.' using errcode = '42501'; end if;
    v_ruta := coalesce(v_reserva.ruta_id, v_ruta);
    v_punto := v_reserva.ubicacion_origen;
    if v_punto is null then select ubicacion into v_punto from public.paraderos where id = v_reserva.paradero_origen_id; end if;
    if v_reserva.estado = 'aceptada' then
      select ubicacion, actualizada_en into v_cliente, v_cliente_en from public.ubicaciones_reserva
        where reserva_id = p_reserva_id and actualizada_en > now() - interval '45 seconds';
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'orden', pr.orden,
    'latitud', public.st_y(p.ubicacion::public.geometry), 'longitud', public.st_x(p.ubicacion::public.geometry))
    order by pr.orden), '[]'::jsonb) into v_paraderos
  from public.paraderos_ruta_taxista pr join public.paraderos p on p.id = pr.paradero_id
  where pr.taxista_id = auth.uid() and pr.ruta_id = v_ruta and p.activo and p.ubicacion is not null;

  select p.* into v_destino from public.paraderos_ruta_taxista pr join public.paraderos p on p.id = pr.paradero_id
    where pr.taxista_id = auth.uid() and pr.ruta_id = v_ruta and p.activo and p.ubicacion is not null
      and (p_paradero_id is null or p.id = p_paradero_id)
    order by case when p.id = v_reserva.paradero_origen_id then 0 else 1 end,
      case when v_punto is not null then public.st_distance(p.ubicacion,v_punto) else null end,
      pr.orden limit 1;
  if p_paradero_id is not null and v_destino.id is null then
    raise exception 'El paradero no pertenece a tu ruta configurada.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rutaId', v_ruta,
    'rutaNombre', (select nombre from public.rutas where id = v_ruta),
    'paraderos', v_paraderos,
    'taxi', case when v_taxista.taxista_activo and v_taxista.ubicacion_actual is not null and v_taxista.ubicacion_actualizada_en > now() - interval '15 minutes'
      then jsonb_build_object('coordenadas', jsonb_build_object('latitud',public.st_y(v_taxista.ubicacion_actual::public.geometry),
        'longitud',public.st_x(v_taxista.ubicacion_actual::public.geometry)), 'titulo','Tu taxi') end,
    'punto', case when v_punto is not null then jsonb_build_object('coordenadas',jsonb_build_object(
      'latitud',public.st_y(v_punto::public.geometry),'longitud',public.st_x(v_punto::public.geometry)), 'titulo',coalesce(v_reserva.origen,'Abordaje')) end,
    'cliente', case when v_cliente is not null then jsonb_build_object('coordenadas',jsonb_build_object(
      'latitud',public.st_y(v_cliente::public.geometry),'longitud',public.st_x(v_cliente::public.geometry)), 'titulo','Cliente') end,
    'clienteActualizadoEn',v_cliente_en,
    'destino',case when v_destino.id is not null then jsonb_build_object('id',v_destino.id,'titulo',v_destino.nombre,
      'coordenadas',jsonb_build_object('latitud',public.st_y(v_destino.ubicacion::public.geometry),
        'longitud',public.st_x(v_destino.ubicacion::public.geometry))) end);
end;
$$;

revoke all on function public.configurar_paraderos_taxista(uuid[]) from public, anon;
revoke all on function public.catalogo_paraderos_taxista() from public, anon;
revoke all on function public.compartir_ubicacion_reserva(uuid,double precision,double precision,boolean) from public, anon;
revoke all on function public.obtener_mapa_taxista(uuid,uuid) from public, anon;
revoke all on function public.limpiar_ubicacion_reserva() from public, anon, authenticated;
grant execute on function public.configurar_paraderos_taxista(uuid[]) to authenticated;
grant execute on function public.catalogo_paraderos_taxista() to authenticated;
grant execute on function public.compartir_ubicacion_reserva(uuid,double precision,double precision,boolean) to authenticated;
grant execute on function public.obtener_mapa_taxista(uuid,uuid) to authenticated;
