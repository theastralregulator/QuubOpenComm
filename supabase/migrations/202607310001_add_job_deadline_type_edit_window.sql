-- Migration: 202607310001_add_job_deadline_type_edit_window.sql
-- Add application_deadline and job_type columns to public.jobs table
-- Restrict owner updates to the first 5 hours after creation

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS application_deadline timestamptz;

ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS job_type text DEFAULT 'Full-time';

-- Secure RLS Policy: Allow job owners to update their jobs ONLY during the first 5 hours after creation
DROP POLICY IF EXISTS "Authorized employers can edit or delete their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authorized employers can edit their jobs" ON public.jobs;

CREATE POLICY "Authorized employers can edit their jobs within 5 hours" 
ON public.jobs 
FOR UPDATE 
USING (
  auth.uid() = posted_by 
  AND now() <= (created_at + interval '5 hours')
)
WITH CHECK (
  auth.uid() = posted_by
);

-- Allow job owners to soft-delete / archive their jobs anytime
CREATE POLICY "Authorized employers can soft delete their jobs" 
ON public.jobs 
FOR DELETE 
USING (
  auth.uid() = posted_by
);
