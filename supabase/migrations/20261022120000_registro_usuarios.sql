-- Registro de clientes y taxistas: limpia la metadata antes de guardarla.
--
-- Problemas de `handle_new_user` que corrige:
-- - Los textos se guardaban sin quitar espacios y un texto vacío quedaba como
--   '' en vez de null.
-- - Una edad o un precio que no fueran números hacían fallar el `::int` o el
--   `::decimal`, y Supabase rechazaba todo el registro ("Database error saving
--   new user"). Ahora esos valores se ignoran.
-- - Si el taxista dejaba vacío el precio, `precio_ruta` quedaba null y sus
--   reservas se creaban sin precio. Ahora toma la tarifa base de la ruta.
-- - `punto_partida` y `punto_destino` se leían de la metadata. La app ya no
--   los envía: `trigger_sincronizar_ruta_taxista` los copia de la ruta.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_rol_id int;
  v_nombres text := btrim(coalesce(v_meta ->> 'nombres', ''));
  v_apellidos text := btrim(coalesce(v_meta ->> 'apellidos', ''));
  v_telefono text := coalesce(
    nullif(btrim(v_meta ->> 'telefono'), ''),
    nullif(btrim(v_meta ->> 'phone'), '')
  );
  v_direccion text := nullif(btrim(v_meta ->> 'direccion'), '');
  v_edad int;
  v_horario text := nullif(btrim(v_meta ->> 'horario_trabajo'), '');
  v_precio decimal(10, 2);
  v_ruta_id uuid;
  v_precio_base decimal(10, 2);
begin
  if v_meta ->> 'rol_id' = '2' then
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
    nullif(btrim(v_meta ->> 'foto_perfil_url'), ''),
    true
  );

  if v_rol_id = 3 then
    if v_meta ->> 'edad' ~ '^\d{1,3}$' then
      v_edad := (v_meta ->> 'edad')::int;
    end if;

    insert into public.clientes (id, nombres, apellidos, edad, direccion, telefono)
    values (new.id, v_nombres, v_apellidos, v_edad, v_direccion, v_telefono);
  end if;

  if v_rol_id = 2 then
    -- Una ruta inexistente o inactiva no debe impedir crear la cuenta.
    select id, precio_base into v_ruta_id, v_precio_base
    from public.rutas
    where activa
      and id::text = v_meta ->> 'ruta_id';

    if v_meta ->> 'precio_ruta' ~ '^\d{1,8}(\.\d{1,2})?$' then
      v_precio := (v_meta ->> 'precio_ruta')::decimal(10, 2);
    end if;

    insert into public.taxistas (
      id, nombres, apellidos, direccion, telefono,
      ruta_id, horario_trabajo, precio_ruta
    )
    values (
      new.id, v_nombres, v_apellidos, v_direccion, v_telefono,
      v_ruta_id, v_horario, coalesce(v_precio, v_precio_base)
    );
  end if;

  return new;
end;
$$;

-- Taxistas registrados sin precio: toman la tarifa base de su ruta.
update public.taxistas as t
set precio_ruta = r.precio_base
from public.rutas as r
where r.id = t.ruta_id
  and t.precio_ruta is null;
