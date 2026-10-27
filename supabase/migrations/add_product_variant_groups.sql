ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;
