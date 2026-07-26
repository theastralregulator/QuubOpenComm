-- Migration 202607260004: Job Status RPC

-- 1. Create a secure RPC for updating job status
CREATE OR REPLACE FUNCTION public.update_my_job_status(
  p_job_id uuid,
  p_is_active boolean
)
RETURNS void AS $$
DECLARE
  v_posted_by uuid;
BEGIN
  -- 1. Check job exists and retrieve posted_by
  SELECT posted_by INTO v_posted_by FROM public.jobs WHERE id = p_job_id;
  
  IF v_posted_by IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- 2. Verify authorization
  IF v_posted_by != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 3. Perform the targeted update
  UPDATE public.jobs 
  SET is_active = p_is_active 
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Restrict execution
REVOKE EXECUTE ON FUNCTION public.update_my_job_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_job_status(uuid, boolean) TO authenticated;
