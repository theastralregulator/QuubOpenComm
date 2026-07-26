-- Migration 202607260002: Account Architecture, RPC Transaction & Security Advisor Fixes

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
  p_expected_salary_min numeric DEFAULT NULL,
  p_expected_salary_max numeric DEFAULT NULL,
  p_portfolio_url text DEFAULT NULL,
  p_linkedin_url text DEFAULT NULL,
  p_github_url text DEFAULT NULL,
  p_highest_qualification text DEFAULT NULL,
  p_course_specialization text DEFAULT NULL,
  p_institution text DEFAULT NULL,
  p_graduation_year integer DEFAULT NULL,
  p_resume_path text DEFAULT NULL,
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
  -- 1. Get authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 2. Confirm user has an active profile row
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.account_status = 'disabled' THEN
    RAISE EXCEPTION 'Disabled accounts cannot create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 3. Upsert into worker_profiles
  INSERT INTO public.worker_profiles (
    id,
    user_id,
    profession,
    professional_title,
    skills,
    experience_years,
    years_experience,
    work_location,
    availability,
    availability_status,
    bio_summary,
    hourly_rate,
    expected_salary,
    expected_salary_min,
    expected_salary_max,
    portfolio_url,
    linkedin_url,
    github_url,
    highest_qualification,
    course_specialization,
    institution,
    graduation_year,
    resume_path,
    listing_enabled,
    worker_profile_completed,
    verification_status,
    profile_status,
    updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    p_profession,
    p_profession,
    p_skills,
    COALESCE(p_experience_years, 0),
    COALESCE(p_experience_years, 0),
    p_work_location,
    p_availability,
    p_availability,
    p_bio_summary,
    p_hourly_rate,
    p_expected_salary,
    p_expected_salary_min,
    p_expected_salary_max,
    p_portfolio_url,
    p_linkedin_url,
    p_github_url,
    p_highest_qualification,
    p_course_specialization,
    p_institution,
    p_graduation_year,
    p_resume_path,
    true,
    true,
    'unverified',
    'active',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    profession = EXCLUDED.profession,
    professional_title = EXCLUDED.professional_title,
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    years_experience = EXCLUDED.years_experience,
    work_location = COALESCE(EXCLUDED.work_location, public.worker_profiles.work_location),
    availability = COALESCE(EXCLUDED.availability, public.worker_profiles.availability),
    availability_status = COALESCE(EXCLUDED.availability_status, public.worker_profiles.availability_status),
    bio_summary = COALESCE(EXCLUDED.bio_summary, public.worker_profiles.bio_summary),
    hourly_rate = COALESCE(EXCLUDED.hourly_rate, public.worker_profiles.hourly_rate),
    expected_salary = COALESCE(EXCLUDED.expected_salary, public.worker_profiles.expected_salary),
    portfolio_url = COALESCE(EXCLUDED.portfolio_url, public.worker_profiles.portfolio_url),
    linkedin_url = COALESCE(EXCLUDED.linkedin_url, public.worker_profiles.linkedin_url),
    github_url = COALESCE(EXCLUDED.github_url, public.worker_profiles.github_url),
    listing_enabled = true,
    worker_profile_completed = true,
    updated_at = now()
  RETURNING * INTO v_worker;

  -- 4. Atomic update of profiles.profile_type to 'worker'
  UPDATE public.profiles
  SET profile_type = 'worker',
      updated_at = now()
  WHERE id = v_user_id;

  -- 5. Sync languages if provided
  IF p_languages IS NOT NULL AND array_length(p_languages, 1) > 0 THEN
    DELETE FROM public.worker_languages WHERE worker_id = v_user_id;
    INSERT INTO public.worker_languages (worker_id, language)
    SELECT v_user_id, unnest(p_languages);
  END IF;

  RETURN to_jsonb(v_worker);
END;
$$;

-- Secure function permissions
REVOKE EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, numeric, numeric, text, text, text, text, text, text, integer, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, numeric, numeric, text, text, text, text, text, text, integer, text, text[]) TO authenticated;

-- =========================================================================
-- 2. PUBLIC PROFILES VIEW WITH SECURITY INVOKER
-- =========================================================================

CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker = true) AS 
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  banner_id, 
  bio, 
  city, 
  state, 
  country, 
  preferred_language, 
  profile_type, 
  location_visibility, 
  created_at, 
  updated_at 
FROM public.profiles;

-- =========================================================================
-- 3. RLS POLICIES FOR PROFILES, WORKER_PROFILES AND JOBS
-- =========================================================================

-- --- PROFILES RLS ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
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

DROP POLICY IF EXISTS "Anyone can view listing enabled workers" ON public.worker_profiles;
DROP POLICY IF EXISTS "Users can insert own worker profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Users can update own worker profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Public can view directory worker data" ON public.worker_profiles;
DROP POLICY IF EXISTS "Authenticated users insert own worker profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Authenticated users update own worker profile" ON public.worker_profiles;

CREATE POLICY "Public can view directory worker data" ON public.worker_profiles
  FOR SELECT USING (listing_enabled = true);

CREATE POLICY "Authenticated users insert own worker profile" ON public.worker_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users update own worker profile" ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --- JOBS RLS ---
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can search and view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can read active jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Profile owners/companies can modify jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can post jobs" ON public.jobs;
DROP POLICY IF EXISTS "Job owners can update own jobs within 5 hours" ON public.jobs;
DROP POLICY IF EXISTS "Job owners can delete own jobs" ON public.jobs;

CREATE POLICY "Anyone can read active jobs" ON public.jobs
  FOR SELECT USING (is_active = true);

CREATE POLICY "Authenticated users can post jobs" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job owners can update own jobs within 5 hours" ON public.jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = posted_by AND now() <= created_at + interval '5 hours')
  WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Job owners can delete own jobs" ON public.jobs
  FOR DELETE TO authenticated
  USING (auth.uid() = posted_by);

-- =========================================================================
-- 4. SECURITY ADVISOR FIXES FOR EXISTING FUNCTIONS
-- =========================================================================

-- Fix handle_new_user search path & revoke anon execute
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

-- Fix sync_email_verification search path
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
    SET email_verified_for_actions = true,
        updated_at = now()
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_email_verification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_email_verification(uuid) TO authenticated;

-- Fix is_admin and get_admin_role search paths
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
