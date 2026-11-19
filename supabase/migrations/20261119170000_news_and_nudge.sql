-- News list: unsubscribe links, where people signed up, and a log of what was sent.
alter table public.waitlist
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists source text;
create unique index if not exists waitlist_unsubscribe_token_idx on public.waitlist (unsubscribe_token);

create table if not exists public.news_sends (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  audience text not null,
  recipients integer not null,
  sent_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.news_sends enable row level security;
create policy "Admins can see news sends" on public.news_sends for select to authenticated using ((select public.is_admin()));
create index if not exists news_sends_sent_by_idx on public.news_sends (sent_by);

-- One reminder to people who make an account but don't choose a plan.
alter table public.profiles add column if not exists nudged_at timestamptz;

-- Secret the hourly job sends to the reminder function.
insert into public.app_settings (key, value)
values ('cron_secret', to_jsonb(encode(gen_random_bytes(24), 'hex')))
on conflict (key) do nothing;
