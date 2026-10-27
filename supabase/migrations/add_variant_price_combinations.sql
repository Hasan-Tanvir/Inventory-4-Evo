alter table public.products
  add column if not exists variant_price_combinations jsonb not null default '[]'::jsonb;
