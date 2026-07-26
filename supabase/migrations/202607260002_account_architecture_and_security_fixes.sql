-- Migration 202607260002: Exact Account Architecture, Worker RPC & Security Advisor Fixes

-- Ensure banner columns exist on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_id text DEFAULT 'banner_01';

-- =========================================================================
-- 1. ATOMIC WORKER PROFILE CREATION RPC FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.create_my_worker_profile(
  p_profession text,
  p_skills text[],
  p_experience_years integer,
  p_work_location text DEFAULT NULL,
  p_availability text DEFAULT 'Available Now',
  p_bio_summary text DEFAULT NULL,
  p_hourly_rate numeric DEFAULT NULL,
  p_expected_salary text DEFAULT NULL,
  p_portfolio_url text DEFAULT NULL,
  p_certificates text[] DEFAULT '{}'::text[],
  p_languages text[] DEFAULT '{}'::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_profile RECORD;
  v_worker RECORD;
BEGIN
  -- 1. Use auth.uid()
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 2. Confirm linked profile exists and is active
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active accounts can create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 3. Upsert into worker_profiles (using only existing table columns)
  INSERT INTO public.worker_profiles (
    id,
    profession,
    skills,
    experience_years,
    work_location,
    availability,
    bio_summary,
    hourly_rate,
    expected_salary,
    portfolio_url,
    certificates,
    languages,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_profession,
    COALESCE(p_skills, '{}'::text[]),
    COALESCE(p_experience_years, 0),
    p_work_location,
    COALESCE(p_availability, 'Available Now'),
    p_bio_summary,
    p_hourly_rate,
    p_expected_salary,
    p_portfolio_url,
    COALESCE(p_certificates, '{}'::text[]),
    COALESCE(p_languages, '{}'::text[]),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    profession = EXCLUDED.profession,
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    work_location = COALESCE(EXCLUDED.work_location, public.worker_profiles.work_location),
    availability = COALESCE(EXCLUDED.availability, public.worker_profiles.availability),
    bio_summary = COALESCE(EXCLUDED.bio_summary, public.worker_profiles.bio_summary),
    hourly_rate = COALESCE(EXCLUDED.hourly_rate, public.worker_profiles.hourly_rate),
    expected_salary = COALESCE(EXCLUDED.expected_salary, public.worker_profiles.expected_salary),
    portfolio_url = COALESCE(EXCLUDED.portfolio_url, public.worker_profiles.portfolio_url),
    certificates = COALESCE(EXCLUDED.certificates, public.worker_profiles.certificates),
    languages = COALESCE(EXCLUDED.languages, public.worker_profiles.languages),
    updated_at = now()
  RETURNING * INTO v_worker;

  -- 4. Atomic update of profiles.profile_type to 'worker'
  UPDATE public.profiles
  SET profile_type = 'worker',
      updated_at = now()
  WHERE id = v_user_id;

  RETURN to_jsonb(v_worker);
END;
$$;

-- Secure execution permissions
REVOKE EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) TO authenticated;

-- =========================================================================
-- 2. PUBLIC PROFILES VIEW
-- =========================================================================

CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker = true) AS 
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  COALESCE(banner_url, banner_id) AS banner_url,
  banner_id, 
  bio, 
  city, 
  state, 
  country, 
  preferred_language, 
  profile_type, 
  onboarding_completed, 
  created_at 
FROM public.profiles
WHERE account_status = 'active';

-- =========================================================================
-- 3. RLS POLICIES FOR PROFILES, WORKER_PROFILES AND JOBS
-- =========================================================================

-- --- PROFILES RLS ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can modify their own profile details" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can insert own profile" ON public.profiles;

CREATE POLICY "Authenticated users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- --- WORKER PROFILES RLS ---
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read worker profiles" ON public.worker_profiles;
DROP POLICY IF EXISTS "Anyone can view worker profiles" ON public.worker_profiles;
DROP POLICY IF EXISTS "Workers can insert/update their own profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Workers can upsert their own profile details" ON public.worker_profiles;
DROP POLICY IF EXISTS "Anyone can view listing enabled workers" ON public.worker_profiles;
DROP POLICY IF EXISTS "Public can view directory worker data" ON public.worker_profiles;
DROP POLICY IF EXISTS "Authenticated users insert own worker profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Authenticated users update own worker profile" ON public.worker_profiles;

CREATE POLICY "Public can view directory worker data" ON public.worker_profiles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users insert own worker profile" ON public.worker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users update own worker profile" ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --- JOBS RLS ---
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can search and view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Profile owners/companies can modify jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can edit or delete their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can edit their jobs within 5 hours" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can delete their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can post jobs" ON public.jobs;
DROP POLICY IF EXISTS "Job owners can update own jobs within 5 hours" ON public.jobs;
DROP POLICY IF EXISTS "Job owners can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Job owners can delete own jobs" ON public.jobs;

CREATE POLICY "Anyone can read active jobs" ON public.jobs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can post jobs" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job owners can update own jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = posted_by)
  WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job owners can delete own jobs" ON public.jobs
  FOR DELETE TO authenticated
  USING (auth.uid() = posted_by);

-- =========================================================================
-- 4. SECURITY ADVISOR FIXES FOR EXISTING FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    username,
    avatar_url,
    profile_type,
    account_status,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    LOWER(COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'basic',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.sync_email_verification(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_confirmed_at timestamptz;
BEGIN
  SELECT email_confirmed_at INTO v_confirmed_at
  FROM auth.users
  WHERE id = p_user_id;

  IF v_confirmed_at IS NOT NULL THEN
    UPDATE public.profiles
    SET updated_at = now()
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_email_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_email_verification(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.admin_members 
  WHERE id = auth.uid() AND is_active = true;
  RETURN v_role;
END;
$$;
