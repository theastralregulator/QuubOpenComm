-- Migration: 20260809_structured_job_location.sql
-- Description: Add structured location columns to jobs table for future Nearby Jobs coordinates foundation
-- DO NOT APPLY REMOTELY YET.

-- Add nullable structured location columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add coordinate range CHECK constraints safely if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_latitude_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_latitude_check CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_longitude_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_longitude_check CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;
