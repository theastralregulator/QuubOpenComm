-- Migration: 20260901010000_simplified_signup_profile_completion_and_intro.sql
-- Description: Forward-only repository mirror of production migration for simplified signup, profile completion validation, and basic account intro acknowledgement.

-- 1. Add basic_account_intro_seen column to public.profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS basic_account_intro_seen boolean DEFAULT false;

-- 2. Helper function: is_current_user_profile_complete()
CREATE OR REPLACE FUNCTION public.is_current_user_profile_complete()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_completed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(onboarding_completed, false) INTO v_completed
  FROM public.profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_completed, false);
END;
$$;

-- 3. Update is_current_user_active() to require both active account_status and onboarding_completed = true
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS boolean
LANGUAGE plpgsql
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

-- 4. Update update_my_basic_profile RPC with location validation & onboarding transition enforcement
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_email_confirmed timestamptz;
  v_old_completed boolean;
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

  SELECT onboarding_completed, full_name, city, state, country, district, latitude, longitude
  INTO v_old_completed, v_final_full_name, v_final_city, v_final_state, v_final_country, v_final_district, v_final_lat, v_final_lng
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

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
  IF p_latitude IS NOT NULL THEN v_final_lat := p_latitude; END IF;
  IF p_longitude IS NOT NULL THEN v_final_lng := p_longitude; END IF;

  -- If performing first false -> true completion transition, strictly validate email & location requirements
  IF (COALESCE(v_old_completed, false) = false AND p_onboarding_completed = true) THEN
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
    onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
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
GRANT EXECUTE ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision) TO authenticated;

-- 5. RPC: acknowledge_basic_account_intro()
CREATE OR REPLACE FUNCTION public.acknowledge_basic_account_intro()
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
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET 
    basic_account_intro_seen = true,
    updated_at = now()
  WHERE id = v_user_id
  RETURNING id, basic_account_intro_seen, onboarding_completed, profile_type, updated_at
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_basic_account_intro() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_basic_account_intro() TO authenticated;
