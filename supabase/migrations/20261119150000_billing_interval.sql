alter table public.subscriptions add column if not exists billing_interval text not null default 'month' check (billing_interval in ('month','year'));
