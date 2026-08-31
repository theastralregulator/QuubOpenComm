-- Migration: 20260901020000_reconcile_simplified_signup_production_state.sql
-- Description: Forward-only repository reconciliation migration to align repository schema with production state for simplified signup, profile completion, basic intro acknowledgement, profile system-field protection, messaging security triggers, and worker profile RLS policies.

-- 1. Ensure basic_account_intro_seen column exists on public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS basic_account_intro_seen boolean DEFAULT false;

-- 2. Helper function: is_current_user_profile_complete()
CREATE OR REPLACE FUNCTION public.is_current_user_profile_complete()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND onboarding_completed = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_profile_complete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_profile_complete() TO authenticated, service_role;

-- 3. Update is_current_user_active() to require both active account_status and onboarding_completed = true
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_completed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT account_status, COALESCE(onboarding_completed, false)
  INTO v_status, v_completed
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN (v_status = 'active' AND v_completed = true);
END;
$$;

REVOKE ALL ON FUNCTION public.is_current_user_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated, service_role;

-- 4. Hardened update_my_basic_profile RPC
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
  p_onboarding_completed boolean DEFAULT NULL,
  p_country_code text DEFAULT NULL,
  p_state_code text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_email_confirmed timestamptz;
  v_current public.profiles%ROWTYPE;
  v_new_full_name text;
  v_final_full_name text;
  v_final_city text;
  v_final_state text;
  v_final_country text;
  v_final_district text;
  v_final_lat double precision;
  v_final_lng double precision;
  v_updated RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT email_confirmed_at INTO v_email_confirmed
  FROM auth.users
  WHERE id = v_user_id;

  SELECT *
  INTO v_current
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_final_full_name := v_current.full_name;
  v_final_city := v_current.city;
  v_final_state := v_current.state;
  v_final_country := v_current.country;
  v_final_district := v_current.district;
  v_final_lat := v_current.latitude;
  v_final_lng := v_current.longitude;

  IF p_full_name IS NOT NULL THEN
    v_new_full_name := trim(p_full_name);
    IF length(v_new_full_name) > 0 THEN
      v_final_full_name := v_new_full_name;
    END IF;
  END IF;

  IF p_city IS NOT NULL AND length(trim(p_city)) > 0 THEN v_final_city := trim(p_city); END IF;
  IF p_state IS NOT NULL AND length(trim(p_state)) > 0 THEN v_final_state := trim(p_state); END IF;
  IF p_country IS NOT NULL AND length(trim(p_country)) > 0 THEN v_final_country := trim(p_country); END IF;
  IF p_district IS NOT NULL AND length(trim(p_district)) > 0 THEN v_final_district := trim(p_district); END IF;

  IF p_latitude IS NOT NULL THEN
    IF p_latitude < -90.0 OR p_latitude > 90.0 THEN
      RAISE EXCEPTION 'Latitude must be between -90 and 90 degrees' USING ERRCODE = '22023';
    END IF;
    v_final_lat := p_latitude;
  END IF;

  IF p_longitude IS NOT NULL THEN
    IF p_longitude < -180.0 OR p_longitude > 180.0 THEN
      RAISE EXCEPTION 'Longitude must be between -180 and 180 degrees' USING ERRCODE = '22023';
    END IF;
    v_final_lng := p_longitude;
  END IF;

  -- First false -> true completion transition validation
  IF (COALESCE(v_current.onboarding_completed, false) = false AND p_onboarding_completed = true) THEN
    IF v_email_confirmed IS NULL THEN
      RAISE EXCEPTION 'Email verification required before profile completion' USING ERRCODE = '42501';
    END IF;

    IF v_final_full_name IS NULL OR length(trim(v_final_full_name)) = 0 THEN
      RAISE EXCEPTION 'Full name is required for profile completion' USING ERRCODE = '22023';
    END IF;

    IF v_final_country IS NULL OR length(trim(v_final_country)) = 0 OR v_final_lat IS NULL OR v_final_lng IS NULL THEN
      RAISE EXCEPTION 'Valid location with coordinates is required for profile completion' USING ERRCODE = '22023';
    END IF;

    IF NOT (
      (v_final_city IS NOT NULL AND length(trim(v_final_city)) > 0)
      OR
      ((v_final_state IS NOT NULL AND length(trim(v_final_state)) > 0) AND (v_final_district IS NOT NULL AND length(trim(v_final_district)) > 0))
    ) THEN
      RAISE EXCEPTION 'Complete location details (city or state+district) are required for profile completion' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.profiles
  SET 
    username = COALESCE(NULLIF(trim(p_username), ''), username),
    full_name = v_final_full_name,
    avatar_url = CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE NULLIF(trim(p_avatar_url), '') END,
    banner_url = CASE WHEN p_banner_url IS NULL THEN banner_url ELSE NULLIF(trim(p_banner_url), '') END,
    phone = CASE WHEN p_phone IS NULL THEN phone ELSE NULLIF(trim(p_phone), '') END,
    city = v_final_city,
    state = v_final_state,
    country = v_final_country,
    country_code = COALESCE(NULLIF(trim(p_country_code), ''), country_code),
    state_code = COALESCE(NULLIF(trim(p_state_code), ''), state_code),
    district = v_final_district,
    latitude = v_final_lat,
    longitude = v_final_lng,
    preferred_language = COALESCE(NULLIF(trim(p_preferred_language), ''), preferred_language),
    bio = CASE WHEN p_bio IS NULL THEN bio ELSE trim(p_bio) END,
    show_location_publicly = COALESCE(p_show_location_publicly, show_location_publicly),
    onboarding_completed = CASE WHEN COALESCE(v_current.onboarding_completed, false) = true THEN true ELSE COALESCE(p_onboarding_completed, v_current.onboarding_completed) END,
    updated_at = now()
  WHERE id = v_user_id
  RETURNING 
    id, username, full_name, avatar_url, banner_url, phone, city, state, country, 
    country_code, state_code, district, latitude, longitude,
    preferred_language, bio, show_location_publicly, onboarding_completed, 
    basic_account_intro_seen, profile_type, created_at, updated_at 
  INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision) TO authenticated, service_role;

-- 5. RPC: acknowledge_basic_account_intro() returning boolean
-- MUST DROP PREVIOUS jsonb OVERLOAD FROM MIGRATION 20260901010000 TO PREVENT RETURN TYPE ALTERATION FAILURE
DROP FUNCTION IF EXISTS public.acknowledge_basic_account_intro();

CREATE OR REPLACE FUNCTION public.acknowledge_basic_account_intro()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET 
    basic_account_intro_seen = true,
    updated_at = now()
  WHERE id = auth.uid() AND onboarding_completed = true;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_basic_account_intro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_basic_account_intro() TO authenticated, service_role;

-- 6. Profile System-Fields Protection Trigger (NOT SECURITY DEFINER, exact production behavior)
CREATE OR REPLACE FUNCTION public.protect_profile_system_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed
       OR NEW.basic_account_intro_seen IS DISTINCT FROM OLD.basic_account_intro_seen
       OR NEW.profile_type IS DISTINCT FROM OLD.profile_type
       OR NEW.account_status IS DISTINCT FROM OLD.account_status
       OR NEW.email_verified_for_actions IS DISTINCT FROM OLD.email_verified_for_actions
       OR NEW.verified_email_at IS DISTINCT FROM OLD.verified_email_at THEN
      RAISE EXCEPTION
        'Protected profile state can only be changed through approved server functions.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_system_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_system_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_system_fields();

REVOKE ALL ON FUNCTION public.protect_profile_system_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_system_fields() TO service_role;

-- 7. Messaging Sender Profile-Ready Protection Trigger (exact production behavior)
CREATE OR REPLACE FUNCTION public.enforce_message_sender_profile_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.role = 'user' AND NEW.sender_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE p.id = NEW.sender_id
        AND p.account_status = 'active'
        AND p.onboarding_completed = true
        AND u.email_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Complete and verify your profile before sending messages.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_sender_profile_ready ON public.messages;
CREATE TRIGGER trg_enforce_message_sender_profile_ready
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_message_sender_profile_ready();

REVOKE ALL ON FUNCTION public.enforce_message_sender_profile_ready() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_message_sender_profile_ready() TO service_role;

-- 8. Drop any legacy/incorrect create_my_worker_profile overloads
DROP FUNCTION IF EXISTS public.create_my_worker_profile(text, text, text[], integer, text, text, text, numeric, text, text, text, numeric);

-- 9. Hardened canonical create_my_worker_profile RPC matching exact production & frontend body
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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_prof RECORD;
  v_email_confirmed timestamptz;
  v_clean_skills text[];
  v_result RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_profession IS NULL OR length(trim(p_profession)) = 0 THEN
    RAISE EXCEPTION 'Valid profession is required' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT trim(s)
    FROM unnest(p_skills) AS s
    WHERE length(trim(s)) > 0
    ORDER BY 1
  ) INTO v_clean_skills;

  IF array_length(v_clean_skills, 1) IS NULL OR array_length(v_clean_skills, 1) = 0 THEN
    RAISE EXCEPTION 'At least one skill is required' USING ERRCODE = '22023';
  END IF;

  IF p_experience_years IS NULL OR p_experience_years < 0 THEN
    RAISE EXCEPTION 'Experience years must be a non-negative number' USING ERRCODE = '22023';
  END IF;

  IF p_hourly_rate IS NOT NULL AND p_hourly_rate < 0 THEN
    RAISE EXCEPTION 'Hourly rate cannot be negative' USING ERRCODE = '22023';
  END IF;

  IF p_availability NOT IN ('Available Now', 'Busy', 'On Vacation') THEN
    RAISE EXCEPTION 'Invalid availability status' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_prof
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR v_prof.account_status IS DISTINCT FROM 'active' OR v_prof.onboarding_completed IS NOT TRUE THEN
    RAISE EXCEPTION 'Active account and completed profile required to register worker profile' USING ERRCODE = '42501';
  END IF;

  SELECT email_confirmed_at INTO v_email_confirmed
  FROM auth.users
  WHERE id = auth.uid();

  IF v_email_confirmed IS NULL THEN
    RAISE EXCEPTION 'Verified email required to register worker profile' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.worker_profiles (
    id, profession, skills, experience_years, work_location, availability,
    bio_summary, hourly_rate, expected_salary, portfolio_url, certificates,
    languages, created_at, updated_at
  )
  VALUES (
    auth.uid(), trim(p_profession), v_clean_skills, GREATEST(0, p_experience_years),
    NULLIF(trim(p_work_location), ''), p_availability, NULLIF(trim(p_bio_summary), ''),
    p_hourly_rate, NULLIF(trim(p_expected_salary), ''), NULLIF(trim(p_portfolio_url), ''),
    COALESCE(p_certificates, '{}'::text[]), COALESCE(p_languages, '{}'::text[]), now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    profession = EXCLUDED.profession,
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    work_location = COALESCE(EXCLUDED.work_location, public.worker_profiles.work_location),
    availability = EXCLUDED.availability,
    bio_summary = COALESCE(EXCLUDED.bio_summary, public.worker_profiles.bio_summary),
    hourly_rate = COALESCE(EXCLUDED.hourly_rate, public.worker_profiles.hourly_rate),
    expected_salary = COALESCE(EXCLUDED.expected_salary, public.worker_profiles.expected_salary),
    portfolio_url = COALESCE(EXCLUDED.portfolio_url, public.worker_profiles.portfolio_url),
    certificates = CASE WHEN array_length(EXCLUDED.certificates, 1) > 0 THEN EXCLUDED.certificates ELSE public.worker_profiles.certificates END,
    languages = CASE WHEN array_length(EXCLUDED.languages, 1) > 0 THEN EXCLUDED.languages ELSE public.worker_profiles.languages END,
    updated_at = now()
  RETURNING * INTO v_result;

  -- Only after worker profile insert/upsert succeeds, promote profile_type and mark basic intro seen
  UPDATE public.profiles
  SET 
    profile_type = 'worker',
    basic_account_intro_seen = true,
    updated_at = now()
  WHERE id = auth.uid();

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) TO authenticated, service_role;

-- 10. Clean up legacy own-write policies and enforce canonical policy on worker_profiles
DROP POLICY IF EXISTS "Workers can insert/update their own profile" ON public.worker_profiles;
DROP POLICY IF EXISTS "Workers can upsert their own profile details" ON public.worker_profiles;
DROP POLICY IF EXISTS "Users can manage own worker profile" ON public.worker_profiles;

CREATE POLICY "Workers can upsert their own profile details"
ON public.worker_profiles
FOR ALL
TO authenticated
USING (auth.uid() = id AND public.is_current_user_active())
WITH CHECK (auth.uid() = id AND public.is_current_user_active());
