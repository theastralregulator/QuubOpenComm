-- Migration: 20260810_fix_admin_user_details_runtime.sql
-- Description: Repair admin_get_user_details unassigned RECORD crash and add admin_members compatibility to get_admin_role().
-- DO NOT APPLY REMOTELY YET.

-- 1. Ensure get_admin_role checks both user_id and id for admin_members compatibility
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role 
  FROM public.admin_members 
  WHERE (user_id = auth.uid() OR id = auth.uid()) AND is_active = true
  LIMIT 1;

  -- Map legacy content_admin to moderator role for canonical permission checks
  IF v_role = 'content_admin' THEN
    RETURN 'moderator';
  END IF;

  RETURN v_role;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated;

-- 2. Safe admin_get_user_details RPC with JSON worker summary (resolves 'record v_w is not assigned yet' crash)
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
  v_has_worker boolean := false;
  v_has_prof_dir boolean := false;
  v_has_work_dir boolean := false;
  v_worker_summary jsonb := NULL;
  v_logins jsonb := '[]'::jsonb;
  v_admin_role text;
  v_masked_phone text;
BEGIN
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'moderator', 'support') THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
  END IF;

  -- Scalar admin role lookup
  SELECT role INTO v_admin_role FROM public.admin_members WHERE user_id = p_user_id OR id = p_user_id LIMIT 1;

  -- Check directories & worker profile existence
  SELECT EXISTS(SELECT 1 FROM public.worker_profiles WHERE id = p_user_id) INTO v_has_worker;
  SELECT EXISTS(SELECT 1 FROM public.profile_directory WHERE id = p_user_id) INTO v_has_prof_dir;
  SELECT EXISTS(SELECT 1 FROM public.worker_directory WHERE id = p_user_id) INTO v_has_work_dir;

  -- Safely build worker_summary jsonb ONLY if worker profile exists
  IF v_has_worker THEN
    SELECT jsonb_build_object(
      'profession', wp.profession,
      'skills', wp.skills,
      'experience_years', wp.experience_years,
      'availability', wp.availability,
      'hourly_rate', wp.hourly_rate,
      'expected_salary', wp.expected_salary,
      'portfolio_url', wp.portfolio_url,
      'is_visible', COALESCE(wp.is_visible, true)
    )
    INTO v_worker_summary
    FROM public.worker_profiles wp
    WHERE wp.id = p_user_id;
  END IF;

  -- Phone masking for support/moderator roles
  IF v_caller_role IN ('super_admin', 'admin') THEN
    v_masked_phone := v_p.phone;
  ELSE
    v_masked_phone := CASE
      WHEN v_p.phone IS NOT NULL AND length(v_p.phone) > 4
      THEN substring(v_p.phone from 1 for 3) || '*****' || substring(v_p.phone from length(v_p.phone)-2)
      ELSE 'Masked'
    END;
  END IF;

  -- Login history restricted to admin/super_admin
  IF v_caller_role IN ('super_admin', 'admin') THEN
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
  END IF;

  RETURN jsonb_build_object(
    'account_identity', jsonb_build_object(
      'id', v_p.id,
      'opencomm_id', v_p.opencomm_id,
      'full_name', v_p.full_name,
      'username', v_p.username,
      'email', v_p.email,
      'phone', v_masked_phone,
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
    'technical_identity', CASE WHEN v_caller_role IN ('super_admin', 'admin') THEN jsonb_build_object(
      'auth_user_id', v_p.id,
      'profile_id', v_p.id,
      'worker_profile_id', CASE WHEN v_has_worker THEN v_p.id ELSE NULL END,
      'has_worker_profile', v_has_worker,
      'has_profile_directory', v_has_prof_dir,
      'has_worker_directory', v_has_work_dir
    ) ELSE NULL END,
    'location', jsonb_build_object(
      'city', v_p.city,
      'district', v_p.district,
      'state', v_p.state,
      'country', v_p.country,
      'show_location_publicly', COALESCE(v_p.show_location_publicly, true),
      'coordinates', CASE WHEN v_caller_role IN ('super_admin', 'admin') THEN jsonb_build_object('latitude', v_p.latitude, 'longitude', v_p.longitude) ELSE NULL END
    ),
    'worker_summary', v_worker_summary,
    'recent_logins', v_logins
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_user_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid) TO authenticated;
