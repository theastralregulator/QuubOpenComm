-- Migration 202607260003: Secure Directory & RPC Adjustments

-- =========================================================================
-- 1. DROP OLD INSECURE VIEW
-- =========================================================================
DROP VIEW IF EXISTS public.public_profiles CASCADE;


-- =========================================================================
-- 2. CREATE SECURE PROFILE_DIRECTORY TABLE & VIEWS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profile_directory (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  full_name text,
  avatar_url text,
  banner_url text,
  bio text,
  city text,
  state text,
  country text,
  preferred_language text,
  profile_type text,
  onboarding_completed boolean,
  created_at timestamptz
);

-- Enable RLS and grant public SELECT
ALTER TABLE public.profile_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view directory" ON public.profile_directory;
CREATE POLICY "Public can view directory" ON public.profile_directory
  FOR SELECT USING (true);

-- Create a dedicated secure view for the Workers Directory
CREATE OR REPLACE VIEW public.worker_directory AS
SELECT 
  w.id, w.profession, w.skills, w.experience_years, w.work_location, w.availability, 
  w.bio_summary, w.hourly_rate, w.expected_salary, w.portfolio_url, w.certificates, 
  w.languages, w.created_at, w.updated_at,
  p.username, p.full_name, p.avatar_url, p.banner_url, p.city, p.state, p.country
FROM public.worker_profiles w
JOIN public.profile_directory p ON w.id = p.id
WHERE p.profile_type = 'worker';

GRANT SELECT ON public.worker_directory TO anon, authenticated;


-- =========================================================================
-- 3. SYNC TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_profile_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- We only want to expose fully active accounts
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.profile_directory WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.account_status = 'active' THEN
      INSERT INTO public.profile_directory (
        id, username, full_name, avatar_url, banner_url, bio, 
        city, state, country, preferred_language, profile_type, 
        onboarding_completed, created_at
      )
      VALUES (
        NEW.id, NEW.username, NEW.full_name, NEW.avatar_url, NEW.banner_url, NEW.bio, 
        NEW.city, NEW.state, NEW.country, NEW.preferred_language, NEW.profile_type, 
        NEW.onboarding_completed, NEW.created_at
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        banner_url = EXCLUDED.banner_url,
        bio = EXCLUDED.bio,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        country = EXCLUDED.country,
        preferred_language = EXCLUDED.preferred_language,
        profile_type = EXCLUDED.profile_type,
        onboarding_completed = EXCLUDED.onboarding_completed;
    ELSE
      -- Remove if status changed from active to something else
      DELETE FROM public.profile_directory WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_directory ON public.profiles;
CREATE TRIGGER trg_sync_profile_directory
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_directory();

-- Sync existing data immediately
INSERT INTO public.profile_directory (
  id, username, full_name, avatar_url, banner_url, bio, 
  city, state, country, preferred_language, profile_type, 
  onboarding_completed, created_at
)
SELECT 
  id, username, full_name, avatar_url, banner_url, bio, 
  city, state, country, preferred_language, profile_type, 
  onboarding_completed, created_at
FROM public.profiles
WHERE account_status = 'active'
ON CONFLICT (id) DO NOTHING;


-- =========================================================================
-- 4. UPDATE_MY_BASIC_PROFILE RPC & UPDATE POLICY LOCKDOWN
-- =========================================================================

-- Lock down direct updates
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

-- The RPC to safely update basic details
CREATE OR REPLACE FUNCTION public.update_my_basic_profile(
  p_username text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_preferred_language text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_show_location_publicly boolean DEFAULT NULL,
  p_onboarding_completed boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET 
    username = COALESCE(trim(p_username), username),
    full_name = COALESCE(trim(p_full_name), full_name),
    avatar_url = COALESCE(trim(p_avatar_url), avatar_url),
    banner_url = COALESCE(trim(p_banner_url), banner_url),
    phone = COALESCE(trim(p_phone), phone),
    city = COALESCE(trim(p_city), city),
    state = COALESCE(trim(p_state), state),
    country = COALESCE(trim(p_country), country),
    preferred_language = COALESCE(trim(p_preferred_language), preferred_language),
    bio = COALESCE(trim(p_bio), bio),
    show_location_publicly = COALESCE(p_show_location_publicly, show_location_publicly),
    onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
    updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_basic_profile FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_basic_profile TO authenticated;


-- =========================================================================
-- 5. IMPROVE WORKER RPC VALIDATION
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
  v_clean_skills text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a worker profile.' USING ERRCODE = '42501';
  END IF;

  -- Trim values
  p_profession := trim(p_profession);
  p_work_location := trim(p_work_location);
  p_bio_summary := trim(p_bio_summary);
  p_expected_salary := trim(p_expected_salary);
  p_portfolio_url := trim(p_portfolio_url);
  
  -- Clean skills array (remove empty strings or whitespace-only elements)
  IF p_skills IS NOT NULL THEN
    SELECT array_agg(trim(s)) INTO v_clean_skills
    FROM unnest(p_skills) s
    WHERE trim(s) <> '';
  END IF;

  IF p_profession IS NULL OR p_profession = '' THEN
    RAISE EXCEPTION 'Profession title is required.' USING ERRCODE = '22023';
  END IF;

  IF v_clean_skills IS NULL OR array_length(v_clean_skills, 1) IS NULL OR array_length(v_clean_skills, 1) = 0 THEN
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

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.account_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only active accounts can create a worker profile.' USING ERRCODE = '42501';
  END IF;

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
    v_clean_skills,
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

  UPDATE public.profiles
  SET profile_type = 'worker',
      updated_at = now()
  WHERE id = v_user_id;

  RETURN to_jsonb(v_worker);
END;
$$;


-- =========================================================================
-- 6. ADMIN HELPER ENUMERATION PREVENTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_admin(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF requested_user_id != auth.uid() THEN RETURN false; END IF;
  
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
  IF requested_user_id != auth.uid() THEN RETURN false; END IF;
  
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
  IF requested_user_id != auth.uid() THEN RETURN false; END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = requested_user_id
      AND is_active = true
      AND role = 'super_admin'
  );
END;
$$;
