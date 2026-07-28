-- Add shipping column to orders table for delivery tracking details (JSON blob)
-- Stores: shippingDate, parcelName, parcelId, isComplete, completedAt
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add sort_order column to products table for manual drag-and-drop reordering
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order integer;
