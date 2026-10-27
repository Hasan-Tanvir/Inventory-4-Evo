-- Roll back only the product option feature.
-- Deploy the pre-feature application before running this script.
-- This permanently deletes option groups, option combinations, their stock,
-- prices, and commission adjustments stored in these two columns.
BEGIN;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS variants,
  DROP COLUMN IF EXISTS variant_groups;

COMMIT;
