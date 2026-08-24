-- Migration: 20260825010000_harden_job_applications_security.sql
-- Description: Harden job_applications INSERT RLS, remove direct UPDATE RLS policies, harden update_job_application_status RPC, and add withdraw_job_application RPC.

-- 1. Drop existing INSERT and UPDATE policies on public.job_applications
DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Users can apply to jobs" ON public.job_applications;
DROP POLICY IF EXISTS "Verified applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Involved applicant and employer can update status" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants and employers can update job applications" ON public.job_applications;

-- 2. Create hardened INSERT policy for public.job_applications
-- Requires: auth.uid() = applicant_id AND account active AND email_verified_for_actions = true AND job exists, is active, and NOT posted by applicant
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
  )
);

-- 3. Direct UPDATE policy on public.job_applications is purposely NOT recreated for authenticated users.
-- Normal browser clients must NOT have arbitrary direct UPDATE access to job_applications.
-- Employer actions use update_job_application_status RPC.
-- Applicant withdrawal uses withdraw_job_application RPC.
-- Negotiation & contract workflows use their respective SECURITY DEFINER functions.

-- 4. Harden update_job_application_status RPC
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

  IF p_status NOT IN ('pending', 'under_review', 'shortlisted', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status transition for employer';
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

  UPDATE public.job_applications
  SET status = p_status, updated_at = now()
  WHERE id = p_app_id
  RETURNING id, status, job_id, applicant_id INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE ALL ON FUNCTION public.update_job_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) TO authenticated;

-- 5. Create secure withdraw_job_application RPC
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
