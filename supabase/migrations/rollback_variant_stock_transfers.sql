-- Optional rollback of add_variant_stock_transfers.sql.
-- This removes transfer metadata and order-source markers without deleting
-- products, orders, stock entries, or any unrelated schema objects.
do $$
begin
  if exists (
    select 1
    from public.product_stock_transfers
    where variant_id is not null or order_id is not null
  ) or exists (
    select 1
    from public.orders
    where stock_transfer_from is not null
  ) then
    raise exception 'Cannot safely roll back while option/office transfer records exist. Reconcile or remove this feature data first.';
  end if;
end
$$;

alter table public.orders
  drop column if exists stock_transfer_from;

alter table public.product_stock_transfers
  drop column if exists order_id,
  drop column if exists variant_id;

notify pgrst, 'reload schema';
