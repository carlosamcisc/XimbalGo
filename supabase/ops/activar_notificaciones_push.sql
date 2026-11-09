-- Ejecutar solo después de desplegar la función, configurar los secretos y
-- probar la invocación protegida. No contiene ni imprime secretos.
begin;
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'push_worker_url'
      and decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/enviar-notificaciones$')
    or not exists (select 1 from vault.decrypted_secrets where name = 'push_worker_secret'
      and length(decrypted_secret) >= 32) then
    raise exception 'Falta configurar Vault para notificaciones push.';
  end if;
  if not exists (select 1 from cron.job where jobname = 'ximbalgo-push-cada-minuto') then
    raise exception 'Falta aplicar la migración del cron push.';
  end if;
end;
$$;
select cron.alter_job((select jobid from cron.job where jobname = 'ximbalgo-push-cada-minuto'), active := true);
commit;
