-- Migration 202607260002: Exact Account Architecture, Worker RPC & Security Advisor Fixes

-- Ensure banner_url column exists on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;

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
  -- 1. Obtain authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validate input constraints
  IF p_profession IS NULL OR trim(p_profession) = '' THEN
    RAISE EXCEPTION 'Profession title is required.' USING ERRCODE = '22023';
  END IF;

  IF p_skills IS NULL OR array_length(p_skills, 1) IS NULL OR array_length(p_skills, 1) = 0 THEN
    RAISE EXCEPTION 'At least one skill is required.' USING ERRCODE = '22023';
  END IF;

  IF p_experience_years IS NULL OR p_experience_years < 0 THEN
    RAISE EXCEPTION 'Experience years must be non-negative.' USING ERRCODE = '22023';
  END IF;

  IF p_hourly_rate IS NOT NULL AND p_hourly_rate < 0 THEN
    RAISE EXCEPTION 'Hourly rate must be non-negative.' USING ERRCODE = '22023';
  END IF;

  IF p_availability NOT IN ('Available Now', 'Busy', 'On Vacation') THEN
    RAISE EXCEPTION 'Invalid availability status.' USING ERRCODE = '22023';
  END IF;

  -- 3. Confirm linked profile exists and is active
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active accounts can create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- 4. Upsert into worker_profiles (using only real table columns)
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
    trim(p_profession),
    p_skills,
    p_experience_years,
    p_work_location,
    p_availability,
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

  -- 5. Atomic update of profiles.profile_type to 'worker'
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
-- 2. SECURE PUBLIC PROFILES VIEW
-- =========================================================================

-- By omitting security_invoker = true, this view executes with the privileges 
-- of the view creator (admin bypass), safely bypassing the strict RLS on the 
-- profiles table. This correctly exposes non-sensitive profile data for the 
-- directory while fully protecting sensitive columns (email, phone, role) 
-- from direct table access by anon or other users.
CREATE OR REPLACE VIEW public.public_profiles AS 
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  banner_url,
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

GRANT SELECT ON public.public_profiles TO anon, authenticated;


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
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Authenticated users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

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
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Authenticated users update own worker profile" ON public.worker_profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

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
  WITH CHECK ((select auth.uid()) = posted_by);

CREATE POLICY "Job owners can update own jobs within 5 hours" ON public.jobs
  FOR UPDATE TO authenticated
  USING (
    (select auth.uid()) = posted_by
    AND now() <= created_at + interval '5 hours'
  )
  WITH CHECK (
    (select auth.uid()) = posted_by
    AND now() <= created_at + interval '5 hours'
  );

CREATE POLICY "Job owners can delete own jobs" ON public.jobs
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = posted_by);


-- =========================================================================
-- 4. SECURITY ADVISOR FIXES FOR EXISTING FUNCTIONS & TRIGGERS
-- =========================================================================

-- Secure existing trigger-only functions without replacing their bodies
ALTER FUNCTION public.handle_updated_at() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.sync_profile_email_verification() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.sync_profile_email_verification() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- =========================================================================
-- 5. PRESERVED & SECURED ADMIN HELPER FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_admin(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = requested_user_id
      AND is_active = true
      AND role IN ('admin', 'super_admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = requested_user_id
      AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = requested_user_id
      AND is_active = true
      AND role = 'super_admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
