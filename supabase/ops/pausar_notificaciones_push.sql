select cron.alter_job((select jobid from cron.job where jobname = 'ximbalgo-push-cada-minuto'), active := false);
