-- Relaciona a cada taxista con una ruta del catálogo.
--
-- Antes la ruta del taxista solo existía como texto libre (`punto_partida`,
-- `punto_destino`) y la app la unía con `rutas` comparando textos. Con
-- `ruta_id` la relación es exacta. Las columnas de texto se conservan y se
-- llenan con el origen y destino de la ruta elegida.

alter table public.taxistas
  add column if not exists ruta_id uuid
    references public.rutas (id) on delete set null;

create index if not exists taxistas_ruta_id_idx on public.taxistas (ruta_id);

-- El taxista elige su ruta en el registro, antes de tener sesión. El catálogo
-- de rutas activas no es información sensible.
drop policy if exists rutas_ver_publico on public.rutas;
create policy rutas_ver_publico on public.rutas
  for select to anon
  using (activa = true);

-- Mantiene `punto_partida` y `punto_destino` iguales a la ruta elegida, tanto
-- en el registro como cuando el taxista cambie de ruta desde su perfil.
create or replace function public.sincronizar_ruta_taxista()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origen text;
  v_destino text;
begin
  if new.ruta_id is null then
    return new;
  end if;

  select origen, destino into v_origen, v_destino
  from public.rutas
  where id = new.ruta_id and activa;

  if v_origen is null then
    raise exception 'La ruta seleccionada no está disponible.' using errcode = '22023';
  end if;

  new.punto_partida := v_origen;
  new.punto_destino := v_destino;
  return new;
end;
$$;

drop trigger if exists trigger_sincronizar_ruta_taxista on public.taxistas;
create trigger trigger_sincronizar_ruta_taxista
  before insert or update of ruta_id on public.taxistas
  for each row execute function public.sincronizar_ruta_taxista();

-- Registro de usuarios: guarda `ruta_id` del taxista y corrige el teléfono.
-- La app envía `telefono` en la metadata, pero la función solo leía `phone`,
-- así que el teléfono quedaba vacío en `usuarios`, `clientes` y `taxistas`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol_id int;
  v_telefono text := coalesce(
    nullif(new.raw_user_meta_data ->> 'telefono', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  v_ruta_id uuid;
begin
  if (new.raw_user_meta_data ->> 'rol_id')::int = 2 then
    v_rol_id := 2;
  else
    v_rol_id := 3;
  end if;

  insert into public.usuarios (id, correo, numero_telefono, rol_id, foto_perfil_url, activo)
  values (
    new.id,
    new.email,
    v_telefono,
    v_rol_id,
    new.raw_user_meta_data ->> 'foto_perfil_url',
    true
  );

  if v_rol_id = 3 then
    insert into public.clientes (id, nombres, apellidos, edad, direccion, telefono)
    values (
      new.id,
      new.raw_user_meta_data ->> 'nombres',
      new.raw_user_meta_data ->> 'apellidos',
      nullif(new.raw_user_meta_data ->> 'edad', '')::int,
      new.raw_user_meta_data ->> 'direccion',
      v_telefono
    );
  end if;

  if v_rol_id = 2 then
    -- Una ruta inexistente o inactiva no debe impedir crear la cuenta.
    select id into v_ruta_id
    from public.rutas
    where activa
      and id::text = new.raw_user_meta_data ->> 'ruta_id';

    insert into public.taxistas (
      id, nombres, apellidos, direccion, telefono,
      ruta_id, punto_partida, punto_destino, horario_trabajo, precio_ruta
    )
    values (
      new.id,
      new.raw_user_meta_data ->> 'nombres',
      new.raw_user_meta_data ->> 'apellidos',
      new.raw_user_meta_data ->> 'direccion',
      v_telefono,
      v_ruta_id,
      new.raw_user_meta_data ->> 'punto_partida',
      new.raw_user_meta_data ->> 'punto_destino',
      new.raw_user_meta_data ->> 'horario_trabajo',
      nullif(new.raw_user_meta_data ->> 'precio_ruta', '')::decimal(10, 2)
    );
  end if;

  return new;
end;
$$;

-- Recupera el teléfono de las cuentas creadas con el error anterior.
update public.usuarios as u
set numero_telefono = au.raw_user_meta_data ->> 'telefono'
from auth.users as au
where au.id = u.id
  and u.numero_telefono is null
  and nullif(au.raw_user_meta_data ->> 'telefono', '') is not null;

update public.clientes as c
set telefono = au.raw_user_meta_data ->> 'telefono'
from auth.users as au
where au.id = c.id
  and c.telefono is null
  and nullif(au.raw_user_meta_data ->> 'telefono', '') is not null;

update public.taxistas as t
set telefono = au.raw_user_meta_data ->> 'telefono'
from auth.users as au
where au.id = t.id
  and t.telefono is null
  and nullif(au.raw_user_meta_data ->> 'telefono', '') is not null;
