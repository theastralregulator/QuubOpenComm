-- Migration: 20260825010000_harden_job_applications_security.sql
-- Description: Harden job_applications RLS, enforce deadline check, revoke direct table UPDATE, restrict employer status transitions, add least-privilege table grants, and add withdraw_job_application RPC.

-- 1. Drop existing INSERT and UPDATE policies on public.job_applications
DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Users can apply to jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Verified applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Involved applicant and employer can update status" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants and employers can update job applications" ON public.job_applications;

-- 2. Create hardened INSERT policy for public.job_applications
-- Requires:
-- - auth.uid() = applicant_id
-- - account active (public.is_current_user_active())
-- - profiles.email_verified_for_actions = true
-- - target job exists, is_active = true, status = 'active'
-- - posted_by IS DISTINCT FROM auth.uid() (cannot apply to own job)
-- - application_deadline is NULL OR application_deadline has not expired (date_trunc('day', j.application_deadline) >= date_trunc('day', now()))
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
        OR date_trunc('day', j.application_deadline) >= date_trunc('day', now())
      )
  )
);

-- 3. Direct UPDATE policy on public.job_applications is purposely NOT recreated for authenticated users.
-- Direct table UPDATE access is blocked for normal browser clients.
-- Employer review actions use update_job_application_status RPC.
-- Applicant withdrawals use withdraw_job_application RPC.
-- Workflow state changes use their respective SECURITY DEFINER functions.

-- 4. Apply Least-Privilege Table Grants on public.job_applications
REVOKE ALL ON public.job_applications FROM PUBLIC, anon;
GRANT SELECT ON public.job_applications TO anon;

REVOKE ALL ON public.job_applications FROM authenticated;
GRANT SELECT, INSERT ON public.job_applications TO authenticated;

-- 5. Harden update_job_application_status RPC with Current Status -> Requested Status Transition Matrix
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

  SELECT ja.job_id, ja.status INTO v_job_id, v_current_status
  FROM public.job_applications ja
  WHERE ja.id = p_app_id;

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

-- 6. Create secure withdraw_job_application RPC
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

  SELECT applicant_id, status INTO v_applicant_id, v_current_status
  FROM public.job_applications
  WHERE id = p_application_id;

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
