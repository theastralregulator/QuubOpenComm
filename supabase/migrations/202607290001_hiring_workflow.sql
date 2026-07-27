-- 1. Safely update the check constraint to include 'shortlisted'
DO $$ 
DECLARE
  con_record record;
BEGIN
  FOR con_record IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.job_applications'::regclass AND contype = 'c'
  LOOP
    IF pg_get_constraintdef(con_record.conname::regclass) LIKE '%status%' THEN
      EXECUTE 'ALTER TABLE public.job_applications DROP CONSTRAINT ' || quote_ident(con_record.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.job_applications 
  ADD CONSTRAINT job_applications_status_check 
  CHECK (status IN ('pending', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn'));

-- 2. Create secure RPC for updating application status (Employer Side)
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
  v_updated record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate requested status
  IF p_status NOT IN ('pending', 'shortlisted', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  -- Verify ownership: the authenticated user MUST be the owner of the job the application is for
  SELECT ja.job_id INTO v_job_id
  FROM public.job_applications ja
  WHERE ja.id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT posted_by INTO v_job_owner
  FROM public.jobs
  WHERE id = v_job_id;

  IF v_user_id != v_job_owner THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this job posting';
  END IF;

  -- Update status
  UPDATE public.job_applications
  SET status = p_status, updated_at = now()
  WHERE id = p_app_id
  RETURNING id, status INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) TO authenticated;

-- 3. Enable Realtime for job_applications table
-- We check if publication exists and add the table
DO $$
BEGIN
  -- If supabase_realtime publication exists, ensure job_applications is in it
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;';
  ELSE
    -- Just in case they don't have it, create it
    CREATE PUBLICATION supabase_realtime FOR TABLE public.job_applications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication, ignore
    NULL;
END $$;

-- 4. Ensure PostgREST cache reloads
NOTIFY pgrst, reload_schema;
