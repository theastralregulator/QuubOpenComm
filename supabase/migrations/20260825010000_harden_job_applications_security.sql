-- Migration: 20260825010000_harden_job_applications_security.sql
-- Description: Harden job_applications RLS, create submit_job_application RPC with input validation & row locks, revoke direct table INSERT/UPDATE from clients, enforce UTC deadline checks, restrict employer status transitions with FOR UPDATE lock, add least-privilege table grants, and add concurrency-locked withdraw_job_application RPC.

-- 1. Drop existing INSERT and UPDATE policies on public.job_applications
DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Users can apply to jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Verified applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Involved applicant and employer can update status" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants and employers can update job applications" ON public.job_applications;

-- 2. Defense-in-Depth RLS INSERT Policy for public.job_applications
-- Even though direct table INSERT is revoked for authenticated users, keep hardened WITH CHECK policy as defense in depth.
-- Requires:
-- - auth.uid() = applicant_id
-- - account active (public.is_current_user_active())
-- - profiles.email_verified_for_actions = true
-- - target job exists, is_active = true, status = 'active'
-- - posted_by IS DISTINCT FROM auth.uid() (cannot apply to own job)
-- - application_deadline is NULL OR application_deadline has not expired in UTC
-- - status = 'pending'
-- - workflow-controlled / linkage fields are strictly NULL
CREATE POLICY "Verified applicants can submit application"
ON public.job_applications
FOR INSERT
WITH CHECK (
  auth.uid() = applicant_id
  AND public.is_current_user_active()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.email_verified_for_actions = true
  )
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_id
      AND j.is_active = true
      AND j.status = 'active'
      AND j.posted_by IS DISTINCT FROM auth.uid()
      AND (
        j.application_deadline IS NULL
        OR (j.application_deadline AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date
      )
  )
  AND status = 'pending'
  AND negotiation_room_id IS NULL
  AND active_proposal_id IS NULL
  AND work_contract_id IS NULL
  AND permanent_conversation_id IS NULL
  AND confirmed_at IS NULL
  AND cancelled_at IS NULL
  AND completed_at IS NULL
  AND decline_reason IS NULL
  AND cancellation_reason IS NULL
);

-- 3. Least-Privilege Table Grants on public.job_applications
-- Revoke all table privileges from PUBLIC, anon, and authenticated.
-- Direct table INSERT, UPDATE, DELETE, TRUNCATE, etc. are BLOCKED for clients.
REVOKE ALL ON public.job_applications FROM PUBLIC, anon;
REVOKE ALL ON public.job_applications FROM authenticated;

-- Grant authenticated users SELECT privilege ONLY (protected by RLS).
GRANT SELECT ON public.job_applications TO authenticated;

-- 4. Create SECURITY DEFINER submit_job_application RPC with Input Validation & Job Row Lock
CREATE OR REPLACE FUNCTION public.submit_job_application(
  p_job_id uuid,
  p_proposed_rate text,
  p_cover_letter text,
  p_resume_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_job_owner uuid;
  v_job_is_active boolean;
  v_job_status text;
  v_job_deadline timestamptz;
  v_inserted record;
  v_trimmed_rate text;
  v_trimmed_cover text;
  v_trimmed_resume text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account is deactivated';
  END IF;

  -- Basic input validation
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'Job ID is required';
  END IF;

  v_trimmed_rate := trim(coalesce(p_proposed_rate, ''));
  IF v_trimmed_rate = '' THEN
    RAISE EXCEPTION 'Proposed rate is required';
  END IF;
  IF length(v_trimmed_rate) > 200 THEN
    RAISE EXCEPTION 'Proposed rate exceeds maximum length of 200 characters';
  END IF;

  v_trimmed_cover := trim(coalesce(p_cover_letter, ''));
  IF v_trimmed_cover = '' THEN
    RAISE EXCEPTION 'Cover letter is required';
  END IF;
  IF length(v_trimmed_cover) > 5000 THEN
    RAISE EXCEPTION 'Cover letter exceeds maximum length of 5000 characters';
  END IF;

  v_trimmed_resume := NULLIF(trim(coalesce(p_resume_url, '')), '');
  IF v_trimmed_resume IS NOT NULL AND length(v_trimmed_resume) > 2048 THEN
    RAISE EXCEPTION 'Resume URL exceeds maximum length of 2048 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id
      AND email_verified_for_actions = true
  ) THEN
    RAISE EXCEPTION 'Email verification is required before submitting job applications';
  END IF;

  -- Lock target job row for reading
  SELECT j.posted_by, j.is_active, j.status, j.application_deadline
  INTO v_job_owner, v_job_is_active, v_job_status, v_job_deadline
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job listing not found';
  END IF;

  -- Fail closed on nullable is_active
  IF v_job_is_active IS DISTINCT FROM true OR v_job_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Job listing is not active';
  END IF;

  IF v_job_owner = v_user_id THEN
    RAISE EXCEPTION 'You cannot apply to your own job post';
  END IF;

  IF v_job_deadline IS NOT NULL AND (v_job_deadline AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION 'Application deadline has passed';
  END IF;

  INSERT INTO public.job_applications (
    job_id,
    applicant_id,
    proposed_rate,
    cover_letter,
    resume_url,
    status
  ) VALUES (
    p_job_id,
    v_user_id,
    v_trimmed_rate,
    v_trimmed_cover,
    v_trimmed_resume,
    'pending'
  )
  RETURNING id, job_id, applicant_id, proposed_rate, cover_letter, status, created_at, updated_at, negotiation_room_id, active_proposal_id, work_contract_id, permanent_conversation_id
  INTO v_inserted;

  RETURN to_jsonb(v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_job_application(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_job_application(uuid, text, text, text) TO authenticated;

-- 5. Harden update_job_application_status RPC with Concurrency Lock (FOR UPDATE) & Transition Matrix
CREATE OR REPLACE FUNCTION public.update_job_application_status(p_app_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_job_id uuid;
  v_job_owner uuid;
  v_current_status text;
  v_updated record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account is deactivated';
  END IF;

  -- Lock the application row FOR UPDATE before reading status to prevent concurrency races
  SELECT ja.job_id, ja.status INTO v_job_id, v_current_status
  FROM public.job_applications ja
  WHERE ja.id = p_app_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT j.posted_by INTO v_job_owner
  FROM public.jobs j
  WHERE j.id = v_job_id;

  IF v_job_owner IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this job posting';
  END IF;

  -- Transition matrix validation for generic employer status RPC:
  IF v_current_status = 'pending' THEN
    IF p_status NOT IN ('under_review', 'shortlisted', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition from pending to %', p_status;
    END IF;
  ELSIF v_current_status = 'under_review' THEN
    IF p_status NOT IN ('pending', 'shortlisted', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition from under_review to %', p_status;
    END IF;
  ELSIF v_current_status = 'shortlisted' THEN
    IF p_status NOT IN ('pending', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Invalid status transition from shortlisted to %', p_status;
    END IF;
  ELSIF v_current_status = 'rejected' THEN
    IF p_status NOT IN ('pending') THEN
      RAISE EXCEPTION 'Invalid status transition from rejected to %', p_status;
    END IF;
  ELSE
    RAISE EXCEPTION 'Application status % is workflow-managed or final and cannot be manually modified by employer', v_current_status;
  END IF;

  UPDATE public.job_applications
  SET status = p_status, updated_at = now()
  WHERE id = p_app_id
  RETURNING id, status, job_id, applicant_id INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.update_job_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) TO authenticated;

-- 6. Create secure withdraw_job_application RPC with Concurrency Lock (FOR UPDATE)
CREATE OR REPLACE FUNCTION public.withdraw_job_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_applicant_id uuid;
  v_current_status text;
  v_updated record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'Account is deactivated';
  END IF;

  -- Lock the application row FOR UPDATE before reading status to prevent concurrency races
  SELECT applicant_id, status INTO v_applicant_id, v_current_status
  FROM public.job_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_applicant_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only withdraw your own applications';
  END IF;

  IF v_current_status NOT IN ('pending', 'under_review', 'shortlisted') THEN
    RAISE EXCEPTION 'Application cannot be withdrawn in its current status (%)', v_current_status;
  END IF;

  UPDATE public.job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id
  RETURNING id, job_id, applicant_id, status, updated_at INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_job_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_job_application(uuid) TO authenticated;
