-- Hourly: one reminder email to accounts that haven't chosen a plan (see functions/nudge-unpaid).
create extension if not exists pg_cron;
select cron.schedule('nudge-unpaid-hourly', '17 * * * *', $$
  select net.http_post(
    url := 'https://cvkgnrrskoptdtojcwvz.supabase.co/functions/v1/nudge-unpaid',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value#>>'{}' from public.app_settings where key='cron_secret')),
    body := '{}'::jsonb);
$$);
