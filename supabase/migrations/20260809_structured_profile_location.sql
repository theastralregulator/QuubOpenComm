-- Migration: 20260809_structured_profile_location.sql
-- Description: Add structured location columns to profiles and update update_my_basic_profile RPC
-- DO NOT APPLY REMOTELY YET.

-- 1. Add structured location columns to profiles if they do not exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- 2. Drop previous overloaded signatures to avoid PostgREST ambiguity
DROP FUNCTION IF EXISTS public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision);

-- 3. Create updated update_my_basic_profile RPC matching exact LIVE error codes and behavior
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
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_full_name text;
  v_updated RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_username IS NOT NULL THEN
    v_username := trim(p_username);
    IF length(v_username) = 0 THEN
      RAISE EXCEPTION 'Username cannot be empty or whitespace' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_full_name IS NOT NULL THEN
    v_full_name := trim(p_full_name);
    IF length(v_full_name) = 0 THEN
      RAISE EXCEPTION 'Full name cannot be empty or whitespace' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.profiles
  SET 
    username = COALESCE(v_username, username),
    full_name = COALESCE(v_full_name, full_name),
    avatar_url = COALESCE(NULLIF(trim(p_avatar_url), ''), avatar_url),
    banner_url = COALESCE(NULLIF(trim(p_banner_url), ''), banner_url),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    city = COALESCE(NULLIF(trim(p_city), ''), city),
    state = COALESCE(NULLIF(trim(p_state), ''), state),
    country = COALESCE(NULLIF(trim(p_country), ''), country),
    country_code = COALESCE(NULLIF(trim(p_country_code), ''), country_code),
    state_code = COALESCE(NULLIF(trim(p_state_code), ''), state_code),
    district = COALESCE(NULLIF(trim(p_district), ''), district),
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
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
    profile_type, created_at, updated_at 
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

-- 4. Permissions management
REVOKE ALL ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean, text, text, text, double precision, double precision) TO authenticated;
