-- Run only after deploying an app version that no longer reads or writes this column.
-- Dropping the column permanently removes all saved option-combination price rules.
alter table public.products
  drop column if exists variant_price_combinations;
