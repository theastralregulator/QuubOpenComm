-- Migration: 20260810_opencomm_id_and_secure_admin_users.sql
-- Description: OpenComm Permanent ID System, Immutability Trigger, Profiles Privacy Remediation, and Secure Admin Users RPCs.
-- DO NOT APPLY REMOTELY YET.

-- =========================================================================
-- 1. ADD opencomm_id COLUMN & SEQUENCE
-- =========================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opencomm_id text;

CREATE SEQUENCE IF NOT EXISTS public.opencomm_member_number_seq START WITH 1 INCREMENT BY 1;

-- =========================================================================
-- 2. GENERATION FUNCTION FOR OPENCOMM ID
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_opencomm_id(p_full_name text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_first text;
  v_prefix text;
  v_seq bigint;
BEGIN
  -- Extract first space-delimited token
  v_raw_first := split_part(trim(COALESCE(p_full_name, '')), ' ', 1);
  -- Upper-case and strip non-alphanumeric (ASCII-safe)
  v_prefix := upper(regexp_replace(v_raw_first, '[^a-zA-Z0-9]', '', 'g'));
  IF v_prefix IS NULL OR length(v_prefix) = 0 THEN
    v_prefix := 'USER';
  END IF;

  v_seq := nextval('public.opencomm_member_number_seq');
  RETURN v_prefix || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- =========================================================================
-- 3. INTEGRATE GENERATION INTO CANONICAL handle_new_user()
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name text;
  v_opencomm_id text;
BEGIN
  v_name := COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_opencomm_id := public.generate_opencomm_id(v_name);

  INSERT INTO public.profiles (id, full_name, email, avatar_url, signup_status, opencomm_id)
  VALUES (
    new.id,
    v_name,
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'completed',
    v_opencomm_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END;
$$;

-- =========================================================================
-- 4. DETERMINISTIC BACKFILL FOR EXISTING PROFILES
-- =========================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, full_name FROM public.profiles 
    WHERE opencomm_id IS NULL 
    ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.profiles 
    SET opencomm_id = public.generate_opencomm_id(r.full_name) 
    WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce NOT NULL and UNIQUE constraint after backfill
ALTER TABLE public.profiles ALTER COLUMN opencomm_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_opencomm_id ON public.profiles (opencomm_id);

-- Also add opencomm_id to profile_directory table & sync function
ALTER TABLE public.profile_directory ADD COLUMN IF NOT EXISTS opencomm_id text;

-- =========================================================================
-- 5. IMMUTABILITY TRIGGER FOR opencomm_id
-- =========================================================================
CREATE OR REPLACE FUNCTION public.protect_opencomm_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.opencomm_id IS NOT NULL AND NEW.opencomm_id IS DISTINCT FROM OLD.opencomm_id THEN
    RAISE EXCEPTION 'OpenComm ID is permanent and immutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_opencomm_id ON public.profiles;
CREATE TRIGGER trg_protect_opencomm_id
  BEFORE UPDATE OF opencomm_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_opencomm_id();

-- =========================================================================
-- 6. PRIVACY REMEDIATION ON public.profiles RLS
-- =========================================================================
-- Revoke direct arbitrary table SELECT from public and anon
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;

-- Ensure authenticated users can only SELECT their own full profile row directly
CREATE POLICY "Users can view own full profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

-- =========================================================================
-- 7. ADMIN LIST USERS RPC (SECURE DEFINER)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_search text;
  v_total int;
  v_users jsonb;
BEGIN
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'moderator', 'support') THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required' USING ERRCODE = '42501';
  END IF;

  v_search := trim(COALESCE(p_search, ''));

  -- Calculate total matching users
  SELECT COUNT(*) INTO v_total
  FROM public.profiles p
  WHERE v_search = '' OR (
    p.opencomm_id ILIKE '%' || v_search || '%' OR
    p.full_name ILIKE '%' || v_search || '%' OR
    p.email ILIKE '%' || v_search || '%' OR
    p.username ILIKE '%' || v_search || '%' OR
    p.id::text = v_search
  );

  -- Fetch user list page
  SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) INTO v_users
  FROM (
    SELECT 
      p.id,
      p.opencomm_id,
      p.full_name,
      p.username,
      p.email,
      p.profile_type,
      p.account_status,
      p.created_at,
      p.updated_at,
      am.role AS admin_role
    FROM public.profiles p
    LEFT JOIN public.admin_members am ON am.user_id = p.id OR am.id = p.id
    WHERE v_search = '' OR (
      p.opencomm_id ILIKE '%' || v_search || '%' OR
      p.full_name ILIKE '%' || v_search || '%' OR
      p.email ILIKE '%' || v_search || '%' OR
      p.username ILIKE '%' || v_search || '%' OR
      p.id::text = v_search
    )
    ORDER BY p.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    OFFSET GREATEST(p_offset, 0)
  ) u;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'users', v_users
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) TO authenticated;

-- =========================================================================
-- 8. ADMIN GET USER DETAILS RPC (SECURE DEFINER)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_get_user_details(
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_p RECORD;
  v_w RECORD;
  v_has_worker boolean := false;
  v_has_prof_dir boolean := false;
  v_has_work_dir boolean := false;
  v_logins jsonb := '[]'::jsonb;
  v_admin_role text;
BEGIN
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'moderator', 'support') THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Admin role check
  SELECT role INTO v_admin_role FROM public.admin_members WHERE user_id = p_user_id OR id = p_user_id;

  -- Check directories & worker profile
  SELECT EXISTS(SELECT 1 FROM public.worker_profiles WHERE id = p_user_id) INTO v_has_worker;
  SELECT EXISTS(SELECT 1 FROM public.profile_directory WHERE id = p_user_id) INTO v_has_prof_dir;
  SELECT EXISTS(SELECT 1 FROM public.worker_directory WHERE id = p_user_id) INTO v_has_work_dir;

  IF v_has_worker THEN
    SELECT * INTO v_w FROM public.worker_profiles WHERE id = p_user_id;
  END IF;

  -- Fetch login history if login activity table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_login_activity') THEN
    SELECT COALESCE(jsonb_agg(l), '[]'::jsonb) INTO v_logins
    FROM (
      SELECT 
        logged_in_at,
        device_type,
        os,
        browser,
        auth_provider,
        city,
        region,
        country
      FROM public.user_login_activity
      WHERE user_id = p_user_id
      ORDER BY logged_in_at DESC
      LIMIT 10
    ) l;
  END IF;

  RETURN jsonb_build_object(
    'account_identity', jsonb_build_object(
      'id', v_p.id,
      'opencomm_id', v_p.opencomm_id,
      'full_name', v_p.full_name,
      'username', v_p.username,
      'email', v_p.email,
      'phone', CASE WHEN v_caller_role IN ('super_admin', 'admin') THEN v_p.phone ELSE regexp_replace(COALESCE(v_p.phone, ''), '^(\+?\d{2})\d{5}(\d{3})$', '\1*****\2') END,
      'profile_type', v_p.profile_type,
      'account_status', v_p.account_status,
      'created_at', v_p.created_at,
      'updated_at', v_p.updated_at,
      'preferred_language', v_p.preferred_language,
      'onboarding_completed', COALESCE(v_p.onboarding_completed, false),
      'email_verified_for_actions', COALESCE(v_p.email_verified_for_actions, false),
      'phone_verified_for_actions', COALESCE(v_p.phone_verified_for_actions, false),
      'deactivated_at', v_p.deactivated_at,
      'admin_role', v_admin_role
    ),
    'technical_identity', jsonb_build_object(
      'auth_user_id', v_p.id,
      'profile_id', v_p.id,
      'worker_profile_id', CASE WHEN v_has_worker THEN v_p.id ELSE NULL END,
      'has_worker_profile', v_has_worker,
      'has_profile_directory', v_has_prof_dir,
      'has_worker_directory', v_has_work_dir
    ),
    'location', jsonb_build_object(
      'city', v_p.city,
      'district', v_p.district,
      'state', v_p.state,
      'country', v_p.country,
      'show_location_publicly', COALESCE(v_p.show_location_publicly, true),
      'coordinates', CASE WHEN v_caller_role IN ('super_admin', 'admin') THEN jsonb_build_object('latitude', v_p.latitude, 'longitude', v_p.longitude) ELSE NULL END
    ),
    'worker_summary', CASE WHEN v_has_worker THEN jsonb_build_object(
      'profession', v_w.profession,
      'skills', v_w.skills,
      'experience_years', v_w.experience_years,
      'availability', v_w.availability,
      'hourly_rate', v_w.hourly_rate,
      'expected_salary', v_w.expected_salary,
      'portfolio_url', v_w.portfolio_url,
      'is_worker_listed', COALESCE(v_p.is_worker_listed, true)
    ) ELSE NULL END,
    'recent_logins', v_logins
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid) TO authenticated;
