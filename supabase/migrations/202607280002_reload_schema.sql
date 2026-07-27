-- Ensure proposed_rate exists (idempotent)
ALTER TABLE public.job_applications
ADD COLUMN IF NOT EXISTS proposed_rate text;

-- Ensure unique constraint exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.job_applications'::regclass AND contype = 'u'
    AND conname = 'job_applications_job_applicant_unique'
  ) THEN
    ALTER TABLE public.job_applications ADD CONSTRAINT job_applications_job_applicant_unique UNIQUE (job_id, applicant_id);
  END IF;
END $$;

-- Reload PostgREST schema so the API recognizes the new column
NOTIFY pgrst, reload_schema;
