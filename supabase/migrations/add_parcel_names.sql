-- Add parcel_names JSONB column to customization for saved parcel/courier list
ALTER TABLE public.customization
  ADD COLUMN IF NOT EXISTS parcel_names jsonb NOT NULL DEFAULT '[]'::jsonb;
