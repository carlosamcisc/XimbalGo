-- Prueba PostgreSQL/PostGIS real. Sustituye la invocación HTTP solo dentro
-- de esta transacción; ROLLBACK restaura la función y todos los datos.
begin;
create temporary table fixture_llegada on commit drop as
select r.cliente_id, r.taxista_id, r.vehiculo_id, r.ruta_id
from public.reservas r join public.vehiculos v on v.id = r.vehiculo_id
where v.activo and v.taxista_id = r.taxista_id limit 1;
create temporary table despertares_llegada(id bigint generated always as identity) on commit drop;
create or replace function public.invocar_procesador_push()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  insert into pg_temp.despertares_llegada default values returning id into v_id;
  return v_id;
end;
$$;
select cron.alter_job((select jobid from cron.job where jobname = 'ximbalgo-push-cada-minuto'), active := true);

create function pg_temp.nueva_reserva_llegada(
  p_punto public.geography default 'SRID=4326;POINT(-89.6 20.96)'::public.geography,
  p_paradero uuid default null, p_fecha timestamptz default null,
  p_estado text default 'pendiente')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.reservas(cliente_id,taxista_id,vehiculo_id,ruta_id,estado,
    ubicacion_origen,paradero_origen_id,fecha_hora_viaje,origen,destino)
  select cliente_id,taxista_id,vehiculo_id,ruta_id,p_estado,p_punto,p_paradero,p_fecha,
    'Origen de prueba','Destino de prueba' from pg_temp.fixture_llegada returning id into v_id;
  return v_id;
end;
$$;
create function pg_temp.mover_taxi_llegada(p_metros double precision,
  p_fecha timestamptz default now(), p_servicio boolean default true)
returns void language sql as $$
  update public.taxistas set taxista_activo=p_servicio,
    ubicacion_actual=public.st_project('SRID=4326;POINT(-89.6 20.96)'::public.geography,p_metros,0),
    ubicacion_actualizada_en=p_fecha where id=(select taxista_id from pg_temp.fixture_llegada);
$$;
create function pg_temp.assert_llegadas(p_id uuid,p_total integer,p_motivo text)
returns void language plpgsql as $$
begin
  if (select count(*) from public.notificaciones where reserva_id=p_id and tipo='van_llegando') <> p_total then
    raise exception 'Avisos de llegada incorrectos: %',p_motivo;
  end if;
end;
$$;

do $$
declare
  v_id uuid; v_otro uuid; v_paradero uuid := gen_random_uuid();
  v_proyecto uuid := gen_random_uuid(); v_dispositivo uuid := gen_random_uuid();
  v_taxista uuid; v_cliente uuid; v_trabajo record; v_recibo record;
  v_estado text; v_total integer; v_despertares integer;
  v_punto public.geography := 'SRID=4326;POINT(-89.6 20.96)'::public.geography;
begin
  select taxista_id,cliente_id into v_taxista,v_cliente from pg_temp.fixture_llegada;
  if v_taxista is null then raise exception 'Se requiere una reserva con vehículo activo como fixture.'; end if;
  if has_function_privilege('authenticated','public.notificar_llegada_taxi(uuid,uuid)','execute')
    or has_function_privilege('anon','public.taxi_cerca_abordaje(uuid)','execute')
    or has_function_privilege('service_role','public.reclamar_envios_push_base(uuid,text,boolean,integer)','execute')
    or has_column_privilege('authenticated','public.reservas','llegada_notificada_en','update') then
    raise exception 'Las funciones internas o el marcador quedaron expuestos.';
  end if;
  insert into public.dispositivos_push(id,usuario_id,instalacion_id,expo_push_token,plataforma,proyecto_id,entorno)
  values(v_dispositivo,v_cliente,gen_random_uuid(),'ExpoPushToken['||v_dispositivo||']','android',v_proyecto,'development');

  -- Pendiente no avisa; aceptada lejos tampoco. El límite es 150 m reales.
  perform pg_temp.mover_taxi_llegada(1000);
  v_id := pg_temp.nueva_reserva_llegada();
  perform pg_temp.mover_taxi_llegada(100);
  perform pg_temp.assert_llegadas(v_id,0,'reserva pendiente');
  perform pg_temp.mover_taxi_llegada(1000);
  perform set_config('request.jwt.claim.sub',v_taxista::text,true);
  perform public.actualizar_reserva_taxista(v_id,'aceptada');
  perform pg_temp.assert_llegadas(v_id,0,'aceptada lejos');
  perform pg_temp.mover_taxi_llegada(151);
  perform pg_temp.assert_llegadas(v_id,0,'151 metros');
  select count(*) into v_despertares from pg_temp.despertares_llegada;
  perform pg_temp.mover_taxi_llegada(149);
  perform pg_temp.assert_llegadas(v_id,1,'149 metros');
  if not exists(select 1 from public.reservas where id=v_id and llegada_notificada_en is not null) then
    raise exception 'No se conservó el marcador de llegada.';
  end if;
  if (select count(*) from pg_temp.despertares_llegada) <> v_despertares+1 then
    raise exception 'La llegada no despertó el procesador inmediatamente.';
  end if;
  perform pg_temp.mover_taxi_llegada(148);
  perform pg_temp.mover_taxi_llegada(1000);
  perform pg_temp.mover_taxi_llegada(100);
  perform pg_temp.assert_llegadas(v_id,1,'sin repetir al salir y volver');
  if (select count(*) from pg_temp.despertares_llegada) <> v_despertares+1 then
    raise exception 'Las actualizaciones duplicaron la invocación HTTP.';
  end if;
  if exists(select 1 from public.notificaciones where reserva_id=v_id and tipo='van_llegando' and usuario_id<>v_cliente) then
    raise exception 'El aviso llegó a un destinatario ajeno.';
  end if;
  update public.reservas set estado='cancelada_cliente' where id=v_id;

  -- Aceptar cuando ya está cerca y fuera de servicio / GPS antiguo o futuro.
  v_id := pg_temp.nueva_reserva_llegada();
  perform public.actualizar_reserva_taxista(v_id,'aceptada');
  perform pg_temp.assert_llegadas(v_id,1,'aceptar cerca');
  foreach v_estado in array array['rechazada','cancelada_cliente','cancelada_taxista','completada','no_show'] loop
    v_otro := pg_temp.nueva_reserva_llegada(p_estado=>v_estado);
    perform pg_temp.mover_taxi_llegada(100);
    perform pg_temp.assert_llegadas(v_otro,0,'estado '||v_estado);
  end loop;
  perform pg_temp.mover_taxi_llegada(100,now(),false);
  v_otro := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada');
  perform pg_temp.assert_llegadas(v_otro,0,'taxi fuera de servicio');
  perform pg_temp.mover_taxi_llegada(100,now()-interval '91 seconds');
  perform pg_temp.assert_llegadas(v_otro,0,'GPS antiguo');
  perform pg_temp.mover_taxi_llegada(100,now()+interval '1 hour');
  perform pg_temp.assert_llegadas(v_otro,0,'GPS futuro');
  perform public.actualizar_ubicacion_taxista(public.st_y(v_punto::public.geometry),public.st_x(v_punto::public.geometry));
  perform pg_temp.assert_llegadas(v_otro,1,'RPC GPS del taxista refresca ubicación');

  -- No avisar si ya abordó, ni con un viaje programado demasiado pronto.
  v_otro := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada',p_fecha=>now()+interval '1 day');
  perform pg_temp.assert_llegadas(v_otro,0,'programada para mañana');
  update public.reservas set abordado_en=now(),fecha_hora_viaje=null where id=v_otro;
  perform pg_temp.mover_taxi_llegada(100);
  perform pg_temp.assert_llegadas(v_otro,0,'cliente ya abordó');
  v_otro := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada',p_fecha=>now()+interval '16 minutes');
  perform pg_temp.assert_llegadas(v_otro,0,'16 minutos antes');
  update public.reservas set fecha_hora_viaje=now()+interval '15 minutes' where id=v_otro;
  perform pg_temp.assert_llegadas(v_otro,1,'15 minutos antes');

  -- Punto de la reserva antes que paradero; nunca usar GPS global histórico.
  insert into public.paraderos(id,nombre,ubicacion,activo) values(v_paradero,'Paradero prueba llegada',v_punto,true);
  v_otro := pg_temp.nueva_reserva_llegada(null,v_paradero,null,'aceptada');
  perform pg_temp.assert_llegadas(v_otro,1,'abordaje en paradero');
  v_otro := pg_temp.nueva_reserva_llegada(public.st_project(v_punto,1000,0),v_paradero,null,'aceptada');
  perform pg_temp.assert_llegadas(v_otro,0,'GPS de reserva tiene prioridad sobre paradero');
  update public.paraderos set activo=false where id=v_paradero;
  v_otro := pg_temp.nueva_reserva_llegada(null,v_paradero,null,'aceptada');
  perform pg_temp.assert_llegadas(v_otro,0,'paradero desactivado');
  update public.clientes set ubicacion_actual=v_punto,ubicacion_actualizada_en=now() where id=v_cliente;
  v_otro := pg_temp.nueva_reserva_llegada(null,null,null,'aceptada');
  perform pg_temp.mover_taxi_llegada(100);
  perform pg_temp.assert_llegadas(v_otro,0,'sin punto concreto aunque exista GPS global');
  insert into public.ubicaciones_reserva values(v_otro,v_punto,now()-interval '46 seconds');
  perform pg_temp.assert_llegadas(v_otro,0,'ubicación compartida vencida');
  perform set_config('request.jwt.claim.sub',v_cliente::text,true);
  perform public.compartir_ubicacion_reserva(v_otro,20.96,-89.6,true);
  perform pg_temp.assert_llegadas(v_otro,1,'ubicación voluntaria vigente');

  -- El contrato de la cola permanece compatible, con TTL de cinco minutos.
  delete from public.envios_push where proyecto_id=v_proyecto;
  v_id := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada');
  delete from public.envios_push e using public.notificaciones n
  where e.notificacion_id=n.id and e.proyecto_id=v_proyecto and n.tipo<>'van_llegando';
  set local role service_role;
  select * into v_trabajo from public.reclamar_envios_push(v_proyecto,'development');
  if v_trabajo.id is null or v_trabajo.tipo<>'van_llegando' or v_trabajo.reserva_id<>v_id
    or v_trabajo.vence_en>now()+interval '5 minutes' then raise exception 'Lote de llegada/TTL incorrectos.'; end if;
  perform public.resolver_envio_push(v_trabajo.id,v_trabajo.bloqueo_id,'enviado','ticket-llegada');
  reset role;
  perform set_config('request.jwt.claim.sub',v_taxista::text,true);
  perform public.confirmar_abordaje_taxista(v_id);
  update public.envios_push set proximo_intento_en=now() where id=v_trabajo.id;
  set local role service_role;
  select * into v_recibo from public.reclamar_envios_push(v_proyecto,'development',true);
  if v_recibo.id<>v_trabajo.id then raise exception 'No se consultó el recibo tras abordar.'; end if;
  perform public.resolver_envio_push(v_recibo.id,v_recibo.bloqueo_id,'confirmado');
  reset role;

  -- Cancelar / alejarse / sin señal / expiración mientras espera o reintenta.
  foreach v_estado in array array['cancelada_cliente','completada','abordado','lejos','sin_gps','vencido','dejar_compartir','compartida_vencida'] loop
    delete from public.envios_push where proyecto_id=v_proyecto;
    perform pg_temp.mover_taxi_llegada(100);
    if v_estado in ('dejar_compartir','compartida_vencida') then
      v_id := pg_temp.nueva_reserva_llegada(p_punto=>null,p_estado=>'aceptada');
      insert into public.ubicaciones_reserva values(v_id,v_punto,now());
    else
      v_id := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada');
    end if;
    delete from public.envios_push e using public.notificaciones n
      where e.notificacion_id=n.id and e.proyecto_id=v_proyecto and n.tipo<>'van_llegando';
    if v_estado in ('cancelada_cliente','completada') then update public.reservas set estado=v_estado where id=v_id;
    elsif v_estado='abordado' then update public.reservas set abordado_en=now() where id=v_id;
    elsif v_estado='lejos' then perform pg_temp.mover_taxi_llegada(1000);
    elsif v_estado='sin_gps' then perform pg_temp.mover_taxi_llegada(100,now()-interval '91 seconds');
    elsif v_estado='dejar_compartir' then delete from public.ubicaciones_reserva where reserva_id=v_id;
    elsif v_estado='compartida_vencida' then update public.ubicaciones_reserva set actualizada_en=now()-interval '46 seconds' where reserva_id=v_id;
    else update public.notificaciones set fecha_envio=now()-interval '6 minutes' where reserva_id=v_id and tipo='van_llegando';
    end if;
    delete from public.envios_push e using public.notificaciones n
      where e.notificacion_id=n.id and e.proyecto_id=v_proyecto
        and (n.tipo<>'van_llegando' or n.reserva_id is distinct from v_id);
    set local role service_role;
    select count(*) into v_total from public.reclamar_envios_push(v_proyecto,'development');
    reset role;
    if v_total<>0 or not exists(select 1 from public.envios_push e join public.notificaciones n on n.id=e.notificacion_id
      where n.reserva_id=v_id and n.tipo='van_llegando' and e.proyecto_id=v_proyecto and e.estado='cancelado') then
      raise exception 'Se intentó enviar una llegada no vigente: %',v_estado;
    end if;
  end loop;

  -- La pausa del cron también impide despertar el worker desde el trigger.
  perform cron.alter_job((select jobid from cron.job where jobname='ximbalgo-push-cada-minuto'),active:=false);
  select count(*) into v_despertares from pg_temp.despertares_llegada;
  perform pg_temp.mover_taxi_llegada(100);
  v_id := pg_temp.nueva_reserva_llegada(p_estado=>'aceptada');
  perform pg_temp.assert_llegadas(v_id,1,'se conserva la bandeja con procesador pausado');
  if (select count(*) from pg_temp.despertares_llegada)<>v_despertares then raise exception 'Se ignoró la pausa.'; end if;

  set local role authenticated;
  begin
    perform public.notificar_llegada_taxi(v_taxista);
    raise exception 'Un cliente pudo invocar el detector interno.';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;
rollback;
