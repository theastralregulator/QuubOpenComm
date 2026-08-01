-- Migration: 202608010000_allow_owner_job_archiving.sql
-- Allow job owners to soft-delete / archive (is_active = false) their jobs anytime, even after 5 hours

DROP POLICY IF EXISTS "Authorized employers can soft delete or archive their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can archive their jobs" ON public.jobs;

CREATE POLICY "Authorized employers can archive their jobs" 
ON public.jobs 
FOR UPDATE 
USING (
  auth.uid() = posted_by
)
WITH CHECK (
  auth.uid() = posted_by
  AND is_active = false
);
