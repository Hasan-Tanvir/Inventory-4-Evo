-- Additive columns for transfers that move a specific product option.
-- Existing product-level transfers remain unchanged.
alter table public.product_stock_transfers
  add column if not exists variant_id text,
  add column if not exists order_id text;

alter table public.orders
  add column if not exists stock_transfer_from text;

notify pgrst, 'reload schema';
