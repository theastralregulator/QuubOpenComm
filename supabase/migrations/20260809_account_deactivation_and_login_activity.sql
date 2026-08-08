-- Migration: 20260809_account_deactivation_and_login_activity.sql
-- Description: Add Safe Account Deactivation, Server-Only Login Activity, and Canonical RLS / RPC Active Account Guards

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
-- 2. PROFILE DIRECTORY SYNC TRIGGER FUNCTION ASSURANCE (PRIVACY-AWARE)
-- =========================================================================

ALTER TABLE public.profile_directory ADD COLUMN IF NOT EXISTS show_location_publicly boolean DEFAULT true;

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
        show_location_publicly, onboarding_completed, created_at
      )
      VALUES (
        NEW.id,
        NEW.username,
        NEW.full_name,
        NEW.avatar_url,
        NEW.banner_url,
        NEW.bio,
        CASE WHEN COALESCE(NEW.show_location_publicly, true) THEN NEW.city ELSE NULL END,
        CASE WHEN COALESCE(NEW.show_location_publicly, true) THEN NEW.state ELSE NULL END,
        CASE WHEN COALESCE(NEW.show_location_publicly, true) THEN NEW.country ELSE NULL END,
        NEW.preferred_language,
        NEW.profile_type,
        COALESCE(NEW.show_location_publicly, true),
        NEW.onboarding_completed,
        NEW.created_at
      )
      ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        banner_url = EXCLUDED.banner_url,
        bio = EXCLUDED.bio,
        city = CASE WHEN COALESCE(EXCLUDED.show_location_publicly, true) THEN EXCLUDED.city ELSE NULL END,
        state = CASE WHEN COALESCE(EXCLUDED.show_location_publicly, true) THEN EXCLUDED.state ELSE NULL END,
        country = CASE WHEN COALESCE(EXCLUDED.show_location_publicly, true) THEN EXCLUDED.country ELSE NULL END,
        preferred_language = EXCLUDED.preferred_language,
        profile_type = EXCLUDED.profile_type,
        show_location_publicly = EXCLUDED.show_location_publicly,
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

  -- 2. Genuine committed hire requests (mutually accepted/negotiating/confirmed but contract not completed)
  -- Note: Unaccepted 'pending' requests DO NOT block deactivation; they are auto-withdrawn upon deactivation.
  SELECT COALESCE(COUNT(*), 0) INTO v_active_hire_commitments
  FROM public.hiring_requests hr
  LEFT JOIN public.work_contracts wc ON hr.work_contract_id = wc.id
  WHERE (hr.client_id = v_user_id OR hr.worker_id = v_user_id)
    AND hr.status IN ('accepted', 'negotiating', 'proposal_pending', 'changes_requested', 'confirmed')
    AND (hr.work_contract_id IS NULL OR wc.status NOT IN ('completed', 'cancelled'));

  -- 3. Genuine committed job applications (mutually accepted/negotiating/confirmed but contract not completed)
  -- Note: Unaccepted ('pending', 'under_review', 'shortlisted') applications DO NOT block deactivation; they are auto-cleaned.
  SELECT COALESCE(COUNT(*), 0) INTO v_active_app_commitments
  FROM public.job_applications ja
  JOIN public.jobs j ON ja.job_id = j.id
  LEFT JOIN public.work_contracts wc ON ja.work_contract_id = wc.id
  WHERE (ja.applicant_id = v_user_id OR j.posted_by = v_user_id)
    AND ja.status IN ('accepted', 'negotiating', 'proposal_pending', 'changes_requested', 'confirmed')
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

  -- Auto-cleanup non-committed pending applications submitted by the user (mark as withdrawn)
  UPDATE public.job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE applicant_id = v_user_id AND status IN ('pending', 'under_review', 'shortlisted');

  -- Auto-cleanup non-committed pending applications submitted to the user's jobs (mark as rejected)
  UPDATE public.job_applications ja
  SET status = 'rejected', updated_at = now()
  FROM public.jobs j
  WHERE ja.job_id = j.id AND j.posted_by = v_user_id AND ja.status IN ('pending', 'under_review', 'shortlisted');

  -- Auto-cleanup unaccepted pending hire requests involving the user (mark as withdrawn)
  UPDATE public.hiring_requests
  SET status = 'withdrawn', updated_at = now()
  WHERE (client_id = v_user_id OR worker_id = v_user_id) AND status = 'pending';

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
-- 6. USER LOGIN ACTIVITY TABLE & RPC (SERVER-WRITE ONLY)
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


-- TRUSTED SERVER RPC to record authenticated user login events
CREATE OR REPLACE FUNCTION public.record_login_activity(
  p_user_id uuid,
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
  v_existing_id uuid;
  v_ip_inet inet;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required.';
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
    WHERE user_id = p_user_id
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
      p_user_id,
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

-- Revoke write/execute access from client roles; grant ONLY to service_role
REVOKE ALL ON FUNCTION public.record_login_activity(uuid, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_activity(uuid, text, text, text, text, text, text, text, text, text, text) TO service_role;


-- =========================================================================
-- 7. CANONICAL RLS POLICIES & RPC ACTIVE ACCOUNT GUARDS
-- =========================================================================

-- Helper function: returns true ONLY when auth.uid() is active in public.profiles
CREATE OR REPLACE FUNCTION public.is_current_user_active()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_active() TO authenticated;


-- -----------------------------------------------------------------------------
-- 7.1 JOBS (Replace existing INSERT policies with ONE canonical policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can post jobs" ON public.jobs;
DROP POLICY IF EXISTS "Active users can insert jobs" ON public.jobs;

CREATE POLICY "Authenticated users can post jobs"
  ON public.jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = posted_by
    AND public.is_current_user_active()
  );


-- -----------------------------------------------------------------------------
-- 7.2 JOB APPLICATIONS (Replace existing INSERT policies with ONE canonical policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Active users can insert job applications" ON public.job_applications;

CREATE POLICY "Applicants can submit application"
  ON public.job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND public.is_current_user_active()
  );


-- -----------------------------------------------------------------------------
-- 7.3 HIRING REQUESTS (Replace existing INSERT policies with ONE canonical policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Clients can post hiring requests" ON public.hiring_requests;
DROP POLICY IF EXISTS "Active users can insert hiring requests" ON public.hiring_requests;

CREATE POLICY "Clients can post hiring requests"
  ON public.hiring_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND public.is_current_user_active()
  );


-- -----------------------------------------------------------------------------
-- 7.4 MESSAGES (Replace ALL existing/legacy message INSERT policies with ONE canonical policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users in conversation can send messages" ON public.messages;
DROP POLICY IF EXISTS "Members can send message content" ON public.messages;
DROP POLICY IF EXISTS "Active users can insert messages" ON public.messages;

CREATE POLICY "Conversation participants can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_current_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.archived_at IS NULL
        AND (
          c.creator_id = auth.uid()
          OR c.member_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );


-- -----------------------------------------------------------------------------
-- 7.5 DEAL PROPOSALS & NEGOTIATION MESSAGES (Remove direct INSERT policies, preserve canonical RPCs with active guard)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Active users can insert deal proposals" ON public.deal_proposals;
DROP POLICY IF EXISTS "Active users can insert negotiation messages" ON public.negotiation_messages;

-- Preserve exact canonical submit_deal_proposal implementation (Dual-Source & Overload Resolution)
DROP FUNCTION IF EXISTS public.submit_deal_proposal(
  uuid, text, text, numeric, text, date, time, text, text, text
);
DROP FUNCTION IF EXISTS public.submit_deal_proposal(
  uuid, text, text, numeric, text, date, time, text, text, text, uuid
);

CREATE OR REPLACE FUNCTION public.submit_deal_proposal(
  p_request_id uuid DEFAULT NULL,
  p_work_title text DEFAULT '',
  p_work_description text DEFAULT '',
  p_final_price numeric DEFAULT 0,
  p_payment_type text DEFAULT 'fixed',
  p_work_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_duration text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_additional_terms text DEFAULT NULL,
  p_application_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
  v_app RECORD;
  v_room public.negotiation_rooms%ROWTYPE;
  v_client_id uuid;
  v_worker_id uuid;
  v_version integer;
  v_proposal_id uuid;
  v_client_resp text;
  v_worker_resp text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account is deactivated or non-active.';
  END IF;

  -- Validate exactly one input source is supplied
  IF (p_request_id IS NULL AND p_application_id IS NULL) OR (p_request_id IS NOT NULL AND p_application_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of p_request_id or p_application_id must be provided.';
  END IF;

  IF p_application_id IS NOT NULL THEN
    -- Job Application path
    SELECT ja.id, ja.status, ja.applicant_id, ja.job_id, j.posted_by AS job_owner
    INTO v_app
    FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    WHERE ja.id = p_application_id
    FOR UPDATE OF ja;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Job application not found.';
    END IF;

    v_client_id := v_app.job_owner;
    v_worker_id := v_app.applicant_id;

    IF v_client_id != v_user_id AND v_worker_id != v_user_id THEN
      RAISE EXCEPTION 'Only employer or applicant can submit deal proposals.';
    END IF;

    SELECT * INTO v_room
    FROM public.negotiation_rooms
    WHERE job_application_id = p_application_id
    FOR UPDATE;
  ELSE
    -- Direct Hire path
    SELECT * INTO v_request
    FROM public.hiring_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Hiring request not found.';
    END IF;

    v_client_id := v_request.client_id;
    v_worker_id := v_request.worker_id;

    IF v_client_id != v_user_id AND v_worker_id != v_user_id THEN
      RAISE EXCEPTION 'Only client or worker can submit deal proposals.';
    END IF;

    SELECT * INTO v_room
    FROM public.negotiation_rooms
    WHERE hiring_request_id = p_request_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active negotiation room required before submitting a deal proposal.';
  END IF;

  IF v_room.status != 'active' THEN
    RAISE EXCEPTION 'Negotiation room is locked or closed.';
  END IF;

  IF p_application_id IS NOT NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.deal_proposals WHERE job_application_id = p_application_id;

    UPDATE public.deal_proposals
    SET proposal_status = 'superseded', updated_at = now()
    WHERE job_application_id = p_application_id AND proposal_status IN ('pending', 'changes_requested');
  ELSE
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.deal_proposals WHERE hiring_request_id = p_request_id;

    UPDATE public.deal_proposals
    SET proposal_status = 'superseded', updated_at = now()
    WHERE hiring_request_id = p_request_id AND proposal_status IN ('pending', 'changes_requested');
  END IF;

  IF v_user_id = v_client_id THEN
    v_client_resp := 'accepted';
    v_worker_resp := 'pending';
  ELSE
    v_client_resp := 'pending';
    v_worker_resp := 'accepted';
  END IF;

  INSERT INTO public.deal_proposals (
    hiring_request_id,
    job_application_id,
    negotiation_room_id,
    version_number,
    proposed_by,
    work_title,
    work_description,
    final_price,
    payment_type,
    work_date,
    start_time,
    duration,
    location,
    additional_terms,
    proposal_status,
    client_response,
    worker_response,
    client_responded_at,
    worker_responded_at
  ) VALUES (
    p_request_id,
    p_application_id,
    v_room.id,
    v_version,
    v_user_id,
    trim(p_work_title),
    trim(p_work_description),
    p_final_price,
    COALESCE(p_payment_type, 'fixed'),
    p_work_date,
    p_start_time,
    p_duration,
    p_location,
    p_additional_terms,
    'pending',
    v_client_resp,
    v_worker_resp,
    CASE WHEN v_client_resp = 'accepted' THEN now() ELSE NULL END,
    CASE WHEN v_worker_resp = 'accepted' THEN now() ELSE NULL END
  ) RETURNING id INTO v_proposal_id;

  IF p_application_id IS NOT NULL THEN
    UPDATE public.job_applications
    SET active_proposal_id = v_proposal_id, status = 'proposal_pending', updated_at = now()
    WHERE id = p_application_id;
  ELSE
    UPDATE public.hiring_requests
    SET active_proposal_id = v_proposal_id, status = 'proposal_pending', updated_at = now()
    WHERE id = p_request_id;
  END IF;

  UPDATE public.negotiation_rooms SET updated_at = now() WHERE id = v_room.id;

  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text, metadata)
  VALUES (
    v_room.id,
    v_user_id,
    'proposal_event',
    'Submitted Final Deal Proposal (v' || v_version || ') for ₹' || p_final_price || '.',
    jsonb_build_object('proposal_id', v_proposal_id, 'version', v_version, 'price', p_final_price)
  );

  RETURN json_build_object(
    'proposal_id', v_proposal_id,
    'version_number', v_version,
    'status', 'pending',
    'message', 'Deal proposal submitted successfully.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text, uuid) TO authenticated;


-- Preserve exact canonical send_negotiation_message implementation
CREATE OR REPLACE FUNCTION public.send_negotiation_message(p_room_id uuid, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_room public.negotiation_rooms%ROWTYPE;
  v_msg_id uuid;
  v_created_at timestamp with time zone;
  v_clean_text text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account is deactivated or non-active.';
  END IF;

  v_clean_text := trim(p_text);
  IF v_clean_text IS NULL OR char_length(v_clean_text) = 0 THEN
    RAISE EXCEPTION 'Message text cannot be empty.';
  END IF;

  IF char_length(v_clean_text) > 5000 THEN
    RAISE EXCEPTION 'Message text exceeds maximum length of 5000 characters.';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negotiation room not found.';
  END IF;

  IF v_room.client_id != v_user_id AND v_room.worker_id != v_user_id THEN
    RAISE EXCEPTION 'You are not a participant in this negotiation room.';
  END IF;

  IF v_room.status != 'active' THEN
    RAISE EXCEPTION 'This negotiation room is locked or closed.';
  END IF;

  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
  VALUES (p_room_id, v_user_id, 'text', v_clean_text)
  RETURNING id, created_at INTO v_msg_id, v_created_at;

  UPDATE public.negotiation_rooms
  SET last_message_at = now(), updated_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'id', v_msg_id,
    'negotiation_room_id', p_room_id,
    'sender_id', v_user_id,
    'message_type', 'text',
    'text', v_clean_text,
    'created_at', v_created_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 7.6 WORKER PROFILE PUBLIC VISIBILITY TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_worker_profile_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.is_visible = true) AND NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Deactivated or non-active accounts cannot make worker profiles publicly visible.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_worker_profile_visibility ON public.worker_profiles;
CREATE TRIGGER trg_check_worker_profile_visibility
  BEFORE INSERT OR UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.check_worker_profile_visibility();
