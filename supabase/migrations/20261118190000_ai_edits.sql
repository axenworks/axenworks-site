-- AI Edit tool: customers describe changes in plain English, preview them, then apply or undo.
-- All access goes through the ai-edit edge function (service role); customers never read these tables directly.

create table if not exists public.ai_edits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  message text not null check (char_length(message) between 3 and 1000),
  before_site jsonb not null,
  after_site jsonb not null,
  changes jsonb not null default '[]'::jsonb,   -- [{key, label, before, after}] shown to the customer
  note text,
  status text not null default 'pending' check (status in ('pending', 'applied', 'discarded', 'undone')),
  counted boolean not null default true,        -- uses one edit from the allowance or credits
  used_credit boolean not null default false,   -- true when it was paid for with a bought credit
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists ai_edits_project_idx on public.ai_edits (project_id, created_at desc);
create index if not exists ai_edits_user_idx on public.ai_edits (user_id, created_at desc);
comment on table public.ai_edits is 'AI edit proposals and history. Written only by the ai-edit function.';

create table if not exists public.ai_edit_purchases (
  stripe_session_id text primary key,           -- one row per paid top-up, so a repeated webhook adds credits once
  user_id uuid not null references auth.users(id),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);
comment on table public.ai_edit_purchases is 'Bought AI edit packs. Written only by the Stripe webhook.';

alter table public.projects add column if not exists ai_credits integer not null default 0 check (ai_credits >= 0);
comment on column public.projects.ai_credits is 'Bought AI edits left (used after the monthly allowance runs out).';

alter table public.ai_edits enable row level security;
alter table public.ai_edit_purchases enable row level security;
revoke all on public.ai_edits from anon, authenticated;
revoke all on public.ai_edit_purchases from anon, authenticated;

create policy "Admins see all AI edits" on public.ai_edits
  for select to authenticated using ((select is_admin()));
create policy "Admins see all AI edit purchases" on public.ai_edit_purchases
  for select to authenticated using ((select is_admin()));
grant select on public.ai_edits to authenticated;
grant select on public.ai_edit_purchases to authenticated;

insert into public.app_settings (key, value) values
  ('ai_edit_enabled', 'false'::jsonb),
  ('ai_allowance', '{"starter":20,"standard":50,"pro":100}'::jsonb),
  ('ai_daily_cap', '20'::jsonb),
  ('ai_pack', '{"size":25,"pence":499}'::jsonb),
  ('ai_history_keep', '20'::jsonb)
on conflict (key) do nothing;
