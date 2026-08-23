-- Migration: Add missing persistence columns to worker_profiles table
-- Forward-only, idempotent migration using ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS primary_category text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS work_preference text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS rate_period text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS rate_amount numeric;

-- Grant permissions to authenticated and service_role
GRANT SELECT, INSERT, UPDATE ON public.worker_profiles TO authenticated;
GRANT ALL ON public.worker_profiles TO service_role;
