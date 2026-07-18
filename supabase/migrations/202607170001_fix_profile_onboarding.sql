-- Migration file: supabase/migrations/202607170001_fix_profile_onboarding.sql
-- Safely add missing columns to public.profiles table if they do not exist.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_type text DEFAULT 'basic';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_for_actions boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_email_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_for_actions boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_phone_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure profile_type and onboarding_completed defaults are correct on existing table
ALTER TABLE public.profiles ALTER COLUMN profile_type SET DEFAULT 'basic';
ALTER TABLE public.profiles ALTER COLUMN onboarding_completed SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN email_verified_for_actions SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN phone_verified_for_actions SET DEFAULT false;

-- Recreate the public.public_profiles view using only allowed public columns
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  city, 
  state, 
  country, 
  preferred_language, 
  bio, 
  profile_type, 
  onboarding_completed,
  created_at
FROM public.profiles
WHERE account_status = 'active';
