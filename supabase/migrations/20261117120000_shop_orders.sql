-- Print Studio and Grow Studio orders.
-- Prices are not stored here: shop/catalog.json on the website is the price list,
-- and the shop-checkout function copies the checked prices onto each order.

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- short reference shown to the customer, e.g. AX-7K3F9Q
  view_token text not null default encode(gen_random_bytes(16), 'hex'), -- lets the customer see their order without logging in
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'printing', 'dispatched', 'cancelled', 'refunded')),
  items jsonb not null,                           -- [{id, name, details, qty, unit_pence, studio}]
  subtotal_pence integer not null,
  postage_pence integer not null,
  total_pence integer not null,
  stripe_session_id text unique,
  stripe_payment_intent text,
  email text,
  name text,
  phone text,
  address jsonb,
  tracking text,
  admin_note text,
  paid_at timestamptz,
  dispatched_at timestamptz,
  confirm_emailed_at timestamptz,
  dispatch_emailed_at timestamptz,
  owner_emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shop_orders_status_idx on public.shop_orders (status, created_at desc);

-- Only the edge functions (service role) touch orders. Nobody reads them with the public key.
alter table public.shop_orders enable row level security;
revoke all on public.shop_orders from anon, authenticated;

-- Shop switches. shop_open = 'false' pauses checkout (for a backlog or holiday).
insert into public.app_settings (key, value) values ('shop_open', 'true')
  on conflict (key) do nothing;
