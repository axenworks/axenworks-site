-- Atomic credit top-up used by the Stripe webhook (service role only).
create or replace function public.add_ai_credits(p_user_id uuid, p_qty integer)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.projects set ai_credits = ai_credits + p_qty where user_id = p_user_id;
$$;
revoke all on function public.add_ai_credits(uuid, integer) from public, anon, authenticated;
