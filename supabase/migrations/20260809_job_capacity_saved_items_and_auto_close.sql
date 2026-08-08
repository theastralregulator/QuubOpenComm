-- Migration: 20260809_job_capacity_saved_items_and_auto_close.sql
-- Description: Add job capacity fields (workers_needed, filled_positions, closed_at, archive_after),
-- contract-based capacity auto-close trigger, applicant closure notifications with canonical schema,
-- hard race-condition exception guards, existing job capacity backfill, and 5-day pg_cron auto-archival.

-- =========================================================================
-- 1. ADD JOB CAPACITY & LIFECYCLE COLUMNS TO PUBLIC.JOBS
-- =========================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS workers_needed integer NOT NULL DEFAULT 1 CHECK (workers_needed >= 1),
  ADD COLUMN IF NOT EXISTS filled_positions integer NOT NULL DEFAULT 0 CHECK (filled_positions >= 0),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archive_after timestamptz NULL;

-- Index closed_at and archive_after for efficient archival queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_closed_archive
  ON public.jobs(status, closed_at, archive_after);


-- =========================================================================
-- 2. APPLICATION RLS GUARD: REJECT APPLICATIONS FOR CLOSED/ARCHIVED JOBS
-- =========================================================================

DROP POLICY IF EXISTS "Applicants can submit application" ON public.job_applications;
DROP POLICY IF EXISTS "Active users can insert job applications" ON public.job_applications;

CREATE POLICY "Applicants can submit application"
  ON public.job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = applicant_id
    AND public.is_current_user_active()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND j.is_active = true
        AND j.status = 'active'
    )
  );


-- =========================================================================
-- 3. WORK CONTRACT JOB CAPACITY & AUTO-CLOSE TRIGGER FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_work_contract_job_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id uuid;
  v_job_posted_by uuid;
  v_workers_needed integer;
  v_filled_count integer;
  v_job_title text;
  v_job_status text;
  v_applicant_record RECORD;
  v_target_app_id uuid;
BEGIN
  v_target_app_id := COALESCE(NEW.job_application_id, OLD.job_application_id);

  -- Only process contracts linked to a job application
  IF v_target_app_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine job_id & posted_by from job_applications
  SELECT ja.job_id, j.posted_by
  INTO v_job_id, v_job_posted_by
  FROM public.job_applications ja
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = v_target_app_id;

  IF v_job_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Lock job row FOR UPDATE to prevent concurrent race conditions
  SELECT workers_needed, filled_positions, title, status
  INTO v_workers_needed, v_filled_count, v_job_title, v_job_status
  FROM public.jobs
  WHERE id = v_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate exact current filled positions count for this job from non-cancelled contracts
  SELECT COUNT(DISTINCT wc.job_application_id)::integer
  INTO v_filled_count
  FROM public.work_contracts wc
  JOIN public.job_applications ja ON ja.id = wc.job_application_id
  WHERE ja.job_id = v_job_id
    AND wc.status IN ('active', 'completion_requested', 'completed', 'cancellation_requested', 'disputed');

  -- HARD RACE CONDITION PROTECTION: Never allow filled_positions to exceed workers_needed
  IF v_filled_count > v_workers_needed THEN
    RAISE EXCEPTION 'All positions for this job have already been filled.';
  END IF;

  IF v_filled_count >= v_workers_needed THEN
    -- Job is fully contracted / filled! Auto-close the job!
    UPDATE public.jobs
    SET filled_positions = v_filled_count,
        status = 'closed',
        is_active = false,
        closed_at = COALESCE(closed_at, now()),
        archive_after = COALESCE(archive_after, now() + interval '5 days'),
        updated_at = now()
    WHERE id = v_job_id;

    -- Notify all remaining non-contracted applicants for this job using canonical schema
    FOR v_applicant_record IN
      SELECT ja.id AS app_id, ja.applicant_id
      FROM public.job_applications ja
      WHERE ja.job_id = v_job_id
        AND ja.applicant_id != COALESCE(NEW.worker_id, OLD.worker_id)
        AND ja.status IN ('pending', 'under_review', 'shortlisted', 'negotiating', 'proposal_pending', 'changes_requested')
        AND NOT EXISTS (
          SELECT 1 FROM public.work_contracts wc2
          WHERE wc2.job_application_id = ja.id
            AND wc2.status IN ('active', 'completion_requested', 'completed', 'cancellation_requested', 'disputed')
        )
    LOOP
      -- Insert canonical notification
      INSERT INTO public.notifications (
        recipient_id,
        actor_id,
        type,
        title,
        message,
        target_url,
        metadata,
        dedupe_key,
        is_read,
        read_at
      ) VALUES (
        v_applicant_record.applicant_id,
        v_job_posted_by,
        'job_closed',
        'Job position filled',
        'The job "' || COALESCE(v_job_title, 'Position') || '" has been closed because all available positions have been filled.',
        '/jobs/' || v_job_id,
        jsonb_build_object('job_id', v_job_id, 'reason', 'positions_filled'),
        'job_filled:' || v_job_id || ':' || v_applicant_record.applicant_id,
        false,
        NULL
      )
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

      -- Update non-selected application status to rejected
      UPDATE public.job_applications
      SET status = 'rejected',
          updated_at = now()
      WHERE id = v_applicant_record.app_id;
    END LOOP;

  ELSE
    -- Job has open positions remaining (v_filled_count < v_workers_needed)
    -- If job was previously closed due to capacity (and not manually archived), reopen it safely
    IF v_job_status = 'closed' THEN
      UPDATE public.jobs
      SET filled_positions = v_filled_count,
          status = 'active',
          is_active = true,
          closed_at = NULL,
          archive_after = NULL,
          updated_at = now()
      WHERE id = v_job_id;
    ELSE
      UPDATE public.jobs
      SET filled_positions = v_filled_count,
          updated_at = now()
      WHERE id = v_job_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_work_contract_job_capacity ON public.work_contracts;
CREATE TRIGGER trg_handle_work_contract_job_capacity
  AFTER INSERT OR UPDATE OR DELETE ON public.work_contracts
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_work_contract_job_capacity();


-- =========================================================================
-- 4. BACKFILL EXISTING JOBS FILLED POSITIONS & AUTO-CLOSE AT CAPACITY
-- =========================================================================

-- Backfill filled_positions for existing jobs based on existing non-cancelled job-linked contracts
UPDATE public.jobs j
SET filled_positions = COALESCE(sub.filled_count, 0)
FROM (
  SELECT ja.job_id, COUNT(DISTINCT wc.job_application_id)::integer AS filled_count
  FROM public.work_contracts wc
  JOIN public.job_applications ja ON ja.id = wc.job_application_id
  WHERE wc.status IN ('active', 'completion_requested', 'completed', 'cancellation_requested', 'disputed')
  GROUP BY ja.job_id
) sub
WHERE j.id = sub.job_id;

-- Auto-close active jobs whose backfilled filled_positions already meet or exceed workers_needed
UPDATE public.jobs
SET status = 'closed',
    is_active = false,
    closed_at = COALESCE(closed_at, now()),
    archive_after = COALESCE(archive_after, now() + interval '5 days'),
    updated_at = now()
WHERE status = 'active'
  AND is_active = true
  AND filled_positions >= workers_needed;


-- =========================================================================
-- 5. PG_CRON AUTOMATIC 5-DAY ARCHIVAL FOR CLOSED JOBS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.archive_expired_closed_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_archived_count integer := 0;
BEGIN
  WITH target_jobs AS (
    SELECT id
    FROM public.jobs
    WHERE status = 'closed'
      AND (
        (archive_after IS NOT NULL AND archive_after <= now())
        OR (closed_at IS NOT NULL AND closed_at <= now() - interval '5 days')
      )
  ),
  updated AS (
    UPDATE public.jobs
    SET status = 'archived',
        is_active = false,
        updated_at = now()
    WHERE id IN (SELECT id FROM target_jobs)
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_archived_count FROM updated;

  RETURN v_archived_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_expired_closed_jobs() TO service_role;

-- Schedule pg_cron job for auto-archiving closed jobs after 5 days
DO $$
DECLARE
  v_job_id bigint;
  v_duplicate_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT MIN(jobid)
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'archive-closed-jobs-job';

    IF v_job_id IS NULL THEN
      SELECT cron.schedule(
        'archive-closed-jobs-job',
        '*/30 * * * *',
        'SELECT public.archive_expired_closed_jobs()'
      ) INTO v_job_id;
    ELSE
      PERFORM cron.alter_job(
        v_job_id,
        schedule => '*/30 * * * *',
        command => 'SELECT public.archive_expired_closed_jobs()'
      );
    END IF;

    FOR v_duplicate_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'archive-closed-jobs-job'
        AND jobid <> v_job_id
    LOOP
      PERFORM cron.unschedule(v_duplicate_job_id);
    END LOOP;
  END IF;
END;
$$;
