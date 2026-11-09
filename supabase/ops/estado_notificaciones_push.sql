-- Solo lectura. No muestra tokens, contenidos ni secretos.
select jobname, schedule, active from cron.job where jobname = 'ximbalgo-push-cada-minuto';
select entorno, estado, count(*) as total from public.envios_push group by entorno, estado order by entorno, estado;
select entorno, ultimo_error, count(*) as total from public.envios_push
where ultimo_error is not null group by entorno, ultimo_error order by entorno, ultimo_error;
