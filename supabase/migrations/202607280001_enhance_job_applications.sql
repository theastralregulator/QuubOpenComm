-- 1. Add proposed_rate column if it doesn't exist
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS proposed_rate text;

-- 2. Safely drop the existing check constraint on status and add the new one
DO $$ 
DECLARE
  con_record record;
BEGIN
  FOR con_record IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.job_applications'::regclass AND contype = 'c'
  LOOP
    -- We assume the constraint we want to drop is the one enforcing the status values
    IF pg_get_constraintdef(con_record.conname::regclass) LIKE '%status%' THEN
      EXECUTE 'ALTER TABLE public.job_applications DROP CONSTRAINT ' || quote_ident(con_record.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.job_applications 
  ADD CONSTRAINT job_applications_status_check 
  CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected', 'withdrawn'));

-- 3. Ensure the unique constraint is in place
-- (It was created in the original schema but we'll re-assert if missing via a DO block to prevent errors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.job_applications'::regclass AND contype = 'u'
  ) THEN
    ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_job_id_applicant_id_key UNIQUE(job_id, applicant_id);
  END IF;
END $$;

-- 4. Create secure RPC for withdrawing application
CREATE OR REPLACE FUNCTION public.withdraw_job_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify ownership and update status
  UPDATE public.job_applications
  SET status = 'withdrawn', updated_at = now()
  WHERE id = p_application_id AND applicant_id = v_user_id
  RETURNING id, status INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found or unauthorized';
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_job_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_job_application(uuid) TO authenticated;

-- 5. Explicitly enforce RLS policies for insert
DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
CREATE POLICY "Applicants can submit application" ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = applicant_id
  );
