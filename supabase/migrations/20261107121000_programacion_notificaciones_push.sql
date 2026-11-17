begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Los secretos se provisionan por separado. El cron nace desactivado para
-- permitir probar la migración sin enviar avisos reales ni invocar código viejo.
create function public.invocar_procesador_push()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secreto text;
  v_peticion bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_worker_url';
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'push_worker_secret';
  if v_url is null or v_url !~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/enviar-notificaciones$'
    or v_secreto is null or length(v_secreto) < 32 then
    raise exception 'Configura push_worker_url y push_worker_secret en Vault antes de activar el cron.';
  end if;
  select net.http_post(url := v_url, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secreto),
    timeout_milliseconds := 120000) into v_peticion;
  return v_peticion;
end;
$$;
revoke all on function public.invocar_procesador_push() from public, anon, authenticated, service_role;

select cron.schedule('ximbalgo-push-cada-minuto', '* * * * *', 'select public.invocar_procesador_push();');
select cron.alter_job((select jobid from cron.job where jobname = 'ximbalgo-push-cada-minuto'), active := false);
commit;
