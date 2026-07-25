-- =========================================================================
-- ADD MISSING FIELDS TO PROFILES & WORKER_PROFILES
-- =========================================================================

-- 1. profiles location and contact fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state_code text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_preference boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username text;

-- 2. worker_profiles fields
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS listing_enabled boolean DEFAULT true;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS verification_status text CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')) DEFAULT 'unverified';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS profile_status text CHECK (profile_status IN ('active', 'suspended', 'hidden')) DEFAULT 'active';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS services_offered text[] DEFAULT '{}'::text[];
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS travel_radius_km numeric;

-- In case languages is not present, add it safely
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}'::text[];

-- Update public_profiles view if it exists (recreate it with the new fields)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT
  id,
  full_name,
  username,
  avatar_url,
  bio,
  city,
  district,
  state,
  country,
  preferred_language,
  account_type,
  onboarding_completed,
  created_at
FROM public.profiles
WHERE account_status = 'active';

-- Indices for performance on new worker fields
CREATE INDEX IF NOT EXISTS idx_worker_profiles_listing ON public.worker_profiles(listing_enabled) WHERE listing_enabled = true;
CREATE INDEX IF NOT EXISTS idx_worker_profiles_status ON public.worker_profiles(profile_status) WHERE profile_status = 'active';
