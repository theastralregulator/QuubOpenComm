-- Idempotent Migration: Update Profiles Schema for Onboarding Completion
-- Adds missing fields, modifies profile_type constraints, and secures RLS rules.

-- 1. Add onboarding_completed column to public.profiles if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 2. Drop the rigid profile_type check constraint to support 'company' instead of only 'company_admin'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_type_check CHECK (profile_type IN ('basic', 'worker', 'company', 'company_admin'));

-- 3. Ensure columns exist with correct defaults
ALTER TABLE public.profiles ALTER COLUMN profile_type SET DEFAULT 'basic';
ALTER TABLE public.profiles ALTER COLUMN onboarding_completed SET DEFAULT false;

-- 4. Create or update Row Level Security (RLS) policies for Profiles
-- Users can only insert a profile where id = auth.uid()
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert a profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile where id = auth.uid()
DROP POLICY IF EXISTS "Users can modify their own profile details" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
CREATE POLICY "Users can modify their own profile details" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Verify public profile query doesn't expose phone or email (handled by public_profiles view)
-- Let's update public_profiles view to make sure it includes the new fields and excludes phone and email
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
