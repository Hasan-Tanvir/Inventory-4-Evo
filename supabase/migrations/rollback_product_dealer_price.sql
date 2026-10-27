-- Optional rollback. This removes configured base dealer prices.
alter table public.products
  drop column if exists dealer_price;

notify pgrst, 'reload schema';
