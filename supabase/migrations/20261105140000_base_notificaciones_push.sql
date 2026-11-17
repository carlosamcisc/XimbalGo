-- Punto 1: almacenamiento y permisos. El productor y el consumidor de la
-- cola se incorporan en el punto 3; esta migración no envía notificaciones.
begin;

create table public.dispositivos_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  instalacion_id uuid not null,
  expo_push_token text not null unique
    check (expo_push_token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'),
  plataforma text not null check (plataforma in ('android', 'ios')),
  proyecto_id uuid not null,
  entorno text not null check (entorno in ('development', 'preview', 'production')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, instalacion_id)
);

create index dispositivos_push_destinatario_idx
  on public.dispositivos_push (usuario_id, proyecto_id, entorno) where activo;

create function public.actualizar_fecha_dispositivo_push()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger dispositivo_push_actualizado
  before update on public.dispositivos_push
  for each row execute function public.actualizar_fecha_dispositivo_push();

create table public.envios_push (
  id uuid primary key default gen_random_uuid(),
  notificacion_id uuid not null references public.notificaciones(id) on delete cascade,
  dispositivo_id uuid not null references public.dispositivos_push(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'enviado', 'confirmado', 'error', 'cancelado')),
  intentos integer not null default 0 check (intentos >= 0),
  proximo_intento_en timestamptz not null default now(),
  bloqueado_hasta timestamptz,
  ticket_expo text,
  ultimo_error text,
  creado_en timestamptz not null default now(),
  enviado_en timestamptz,
  confirmado_en timestamptz,
  unique (notificacion_id, dispositivo_id)
);

create index envios_push_pendientes_idx
  on public.envios_push (proximo_intento_en) where estado = 'pendiente';
create index envios_push_bloqueados_idx
  on public.envios_push (bloqueado_hasta) where estado = 'procesando';
create index envios_push_recibos_idx
  on public.envios_push (enviado_en) where estado = 'enviado';
-- Las FK también necesitan índices para borrar dispositivos sin recorrer la cola.
create index envios_push_dispositivo_idx on public.envios_push (dispositivo_id);

alter table public.dispositivos_push enable row level security;
alter table public.envios_push enable row level security;

revoke all on public.dispositivos_push, public.envios_push from public, anon, authenticated;
grant select, insert, delete on public.dispositivos_push to authenticated;
grant update (expo_push_token, plataforma, proyecto_id, entorno, activo)
  on public.dispositivos_push to authenticated;
grant all on public.dispositivos_push, public.envios_push to service_role;

create policy dispositivos_push_ver on public.dispositivos_push
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy dispositivos_push_crear on public.dispositivos_push
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy dispositivos_push_actualizar on public.dispositivos_push
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy dispositivos_push_eliminar on public.dispositivos_push
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- La cola queda sin políticas de cliente: solo el backend puede usarla.
revoke all on function public.actualizar_fecha_dispositivo_push() from public, anon, authenticated;

commit;
