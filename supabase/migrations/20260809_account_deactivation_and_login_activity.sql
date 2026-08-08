-- Migration: 20260809_account_deactivation_and_login_activity.sql
-- Description: Add Safe Account Deactivation and User Login Activity features

-- =========================================================================
-- 1. ACCOUNT DEACTIVATION SCHEMA & STATUS CONSTRAINTS
-- =========================================================================

-- Extend profiles.account_status check constraint to include 'deactivated'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_account_status;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'deactivated', 'suspended', 'under_review'));

-- Add deactivated_at column to profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;


-- =========================================================================
-- 2. PROFILE DIRECTORY SYNC TRIGGER FUNCTION ASSURANCE
-- =========================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_directory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
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
      -- Remove profile from directory if account_status is not active (e.g. deactivated, suspended, under_review)
      DELETE FROM public.profile_directory WHERE id = NEW.id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profile_directory() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_profile_directory ON public.profiles;
CREATE TRIGGER trg_sync_profile_directory
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.sync_profile_directory();


-- =========================================================================
-- 3. SERVER-SIDE ACCOUNT DEACTIVATION ELIGIBILITY CHECK RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_account_deactivation_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_active_contracts integer := 0;
  v_pending_completion integer := 0;
  v_pending_cancellation integer := 0;
  v_disputed_contracts integer := 0;
  v_active_hire_commitments integer := 0;
  v_active_app_commitments integer := 0;
  v_can_deactivate boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Unfinished work_contracts
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE status = 'active'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status = 'completion_requested'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status = 'cancellation_requested'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status = 'disputed'), 0)
  INTO
    v_active_contracts,
    v_pending_completion,
    v_pending_cancellation,
    v_disputed_contracts
  FROM public.work_contracts
  WHERE client_id = v_user_id OR worker_id = v_user_id;

  -- 2. Active hire commitments (hiring_requests with unfulfilled commitments)
  SELECT COALESCE(COUNT(*), 0) INTO v_active_hire_commitments
  FROM public.hiring_requests hr
  LEFT JOIN public.work_contracts wc ON hr.work_contract_id = wc.id
  WHERE (hr.client_id = v_user_id OR hr.worker_id = v_user_id)
    AND hr.status IN ('pending', 'accepted', 'negotiating', 'proposal_pending', 'changes_requested', 'confirmed')
    AND (hr.work_contract_id IS NULL OR wc.status NOT IN ('completed', 'cancelled'));

  -- 3. Active application commitments (job_applications with unfulfilled commitments)
  SELECT COALESCE(COUNT(*), 0) INTO v_active_app_commitments
  FROM public.job_applications ja
  JOIN public.jobs j ON ja.job_id = j.id
  LEFT JOIN public.work_contracts wc ON ja.work_contract_id = wc.id
  WHERE (ja.applicant_id = v_user_id OR j.posted_by = v_user_id)
    AND ja.status IN ('pending', 'under_review', 'shortlisted', 'accepted', 'negotiating', 'proposal_pending', 'changes_requested', 'confirmed')
    AND (ja.work_contract_id IS NULL OR wc.status NOT IN ('completed', 'cancelled'));

  v_can_deactivate := (
    v_active_contracts = 0 AND
    v_pending_completion = 0 AND
    v_pending_cancellation = 0 AND
    v_disputed_contracts = 0 AND
    v_active_hire_commitments = 0 AND
    v_active_app_commitments = 0
  );

  RETURN jsonb_build_object(
    'can_deactivate', v_can_deactivate,
    'blockers', jsonb_build_object(
      'active_contracts', v_active_contracts,
      'pending_completion', v_pending_completion,
      'pending_cancellation', v_pending_cancellation,
      'disputed_contracts', v_disputed_contracts,
      'active_hire_commitments', v_active_hire_commitments,
      'active_application_commitments', v_active_app_commitments
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_deactivation_status() TO authenticated;


-- =========================================================================
-- 4. ATOMIC DEACTIVATION RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.deactivate_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_eligibility jsonb;
  v_can_deactivate boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock profile row to serialize concurrent requests
  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;

  -- Re-check eligibility
  v_eligibility := public.get_account_deactivation_status();
  v_can_deactivate := COALESCE((v_eligibility->>'can_deactivate')::boolean, false);

  IF NOT v_can_deactivate THEN
    RAISE EXCEPTION 'Account deactivation blocked by unresolved work commitments: %', v_eligibility->'blockers';
  END IF;

  -- Archive user's active job posts (setting both is_active = false and status = 'archived')
  UPDATE public.jobs
  SET is_active = false,
      status = 'archived',
      updated_at = now()
  WHERE posted_by = v_user_id AND (is_active = true OR status = 'active');

  -- Hide worker profile listing
  UPDATE public.worker_profiles
  SET is_visible = false,
      updated_at = now()
  WHERE id = v_user_id;

  -- Update profile account status to deactivated
  UPDATE public.profiles
  SET account_status = 'deactivated',
      deactivated_at = now(),
      updated_at = now()
  WHERE id = v_user_id;

  -- sync_profile_directory trigger automatically removes profile from public directory

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account deactivated successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_my_account() TO authenticated;


-- =========================================================================
-- 5. ACCOUNT REACTIVATION RPC
-- =========================================================================

CREATE OR REPLACE FUNCTION public.reactivate_my_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_current_status text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT account_status INTO v_current_status
  FROM public.profiles
  WHERE id = v_user_id FOR UPDATE;

  IF v_current_status != 'deactivated' THEN
    RAISE EXCEPTION 'Account is not currently deactivated (status: %).', v_current_status;
  END IF;

  UPDATE public.profiles
  SET account_status = 'active',
      deactivated_at = NULL,
      updated_at = now()
  WHERE id = v_user_id;

  -- sync_profile_directory trigger automatically re-adds profile to public directory
  -- Note: Archived jobs and hidden worker profiles remain archived/hidden until explicitly restored by the user.

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Account reactivated successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_my_account() TO authenticated;


-- =========================================================================
-- 6. USER LOGIN ACTIVITY TABLE & RPC
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.user_login_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  country text,
  region text,
  city text,
  device_type text,
  os text,
  browser text,
  user_agent text,
  auth_provider text,
  session_fingerprint text,
  is_current_hint boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_activity_user_id_date 
  ON public.user_login_activity(user_id, logged_in_at DESC);

-- Enable RLS on user_login_activity
ALTER TABLE public.user_login_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own login activity" ON public.user_login_activity;
CREATE POLICY "Users can view own login activity"
  ON public.user_login_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- Restrict modification permissions to prevent client spoofing
REVOKE INSERT, UPDATE, DELETE ON public.user_login_activity FROM anon, authenticated;
GRANT SELECT ON public.user_login_activity TO authenticated;


-- SECURITY DEFINER RPC to record authenticated user login events
CREATE OR REPLACE FUNCTION public.record_login_activity(
  p_ip_address text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_os text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_auth_provider text DEFAULT NULL,
  p_session_fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_ip_inet inet;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cast IP string safely to inet
  IF p_ip_address IS NOT NULL AND p_ip_address != '' AND p_ip_address != '::1' AND p_ip_address != '127.0.0.1' THEN
    BEGIN
      v_ip_inet := p_ip_address::inet;
    EXCEPTION WHEN OTHERS THEN
      v_ip_inet := NULL;
    END;
  ELSE
    v_ip_inet := NULL;
  END IF;

  -- Idempotency check: if an entry with identical session_fingerprint exists within 15 minutes, update logged_in_at
  IF p_session_fingerprint IS NOT NULL AND p_session_fingerprint != '' THEN
    SELECT id INTO v_existing_id
    FROM public.user_login_activity
    WHERE user_id = v_user_id
      AND session_fingerprint = p_session_fingerprint
      AND logged_in_at > (now() - interval '15 minutes')
    ORDER BY logged_in_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.user_login_activity
    SET logged_in_at = now()
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('success', true, 'action', 'updated', 'id', v_existing_id);
  ELSE
    INSERT INTO public.user_login_activity (
      user_id,
      logged_in_at,
      ip_address,
      country,
      region,
      city,
      device_type,
      os,
      browser,
      user_agent,
      auth_provider,
      session_fingerprint,
      is_current_hint
    ) VALUES (
      v_user_id,
      now(),
      v_ip_inet,
      p_country,
      p_region,
      p_city,
      p_device_type,
      p_os,
      p_browser,
      p_user_agent,
      p_auth_provider,
      p_session_fingerprint,
      true
    )
    RETURNING id INTO v_existing_id;

    RETURN jsonb_build_object('success', true, 'action', 'created', 'id', v_existing_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login_activity TO authenticated;
