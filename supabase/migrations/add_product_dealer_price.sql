-- Add a dedicated base dealer price. Existing products start at zero and
-- should be populated with the appropriate dealer price in the product editor.
alter table public.products
  add column if not exists dealer_price numeric not null default 0;

notify pgrst, 'reload schema';
