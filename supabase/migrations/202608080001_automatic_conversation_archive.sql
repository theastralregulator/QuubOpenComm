-- =============================================================================
-- Migration: 202608080001_automatic_conversation_archive.sql
-- Description: Persist and automatically archive final work conversations after a 24-hour grace period
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Schema additions and exact work-conversation linkage
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archive_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS idx_conversations_archive_due
  ON public.conversations (archive_scheduled_at)
  WHERE archive_scheduled_at IS NOT NULL AND archived_at IS NULL;

-- A work contract owns the linkage. The participant pair is deliberately never
-- used to resolve a conversation because users may share several work contexts.
CREATE OR REPLACE FUNCTION public.resolve_work_conversation_id(
  p_work_contract_id uuid,
  p_permanent_conversation_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_permanent_conversation_id,
    (
      SELECT c.id
      FROM public.conversations c
      WHERE c.work_contract_id = p_work_contract_id
      ORDER BY c.created_at
      LIMIT 1
    ),
    (
      SELECT h.permanent_conversation_id
      FROM public.hiring_requests h
      WHERE h.work_contract_id = p_work_contract_id
      LIMIT 1
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Persistent warning notifications for both work participants
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_conversation_archive_scheduled(
  p_conversation_id uuid,
  p_archive_reason text,
  p_archive_scheduled_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_creator_id uuid;
  v_member_id uuid;
  v_work_contract_id uuid;
  v_recipient_id uuid;
  v_prefs record;
  v_title text;
  v_message text;
  v_dedupe_key text;
BEGIN
  SELECT c.creator_id, c.member_id, c.work_contract_id
  INTO v_creator_id, v_member_id, v_work_contract_id
  FROM public.conversations c
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_title := CASE WHEN p_archive_reason = 'cancelled' THEN 'Work cancelled' ELSE 'Work completed' END;
  v_message := CASE
    WHEN p_archive_reason = 'cancelled'
      THEN 'Work cancelled. This conversation will be archived within 24 hours.'
    ELSE 'Work completed. This conversation will be archived within 24 hours.'
  END;
  v_dedupe_key := format(
    'conversation_archive:%s:%s:%s',
    p_conversation_id,
    p_archive_reason,
    to_char(p_archive_scheduled_at, 'YYYYMMDDHH24MISSMS')
  );

  FOR v_recipient_id IN
    SELECT DISTINCT participant_id
    FROM (
      SELECT v_creator_id AS participant_id
      UNION ALL
      SELECT v_member_id
      UNION ALL
      SELECT cm.user_id
      FROM public.conversation_members cm
      WHERE cm.conversation_id = p_conversation_id
    ) participants
    WHERE participant_id IS NOT NULL
  LOOP
    SELECT np.in_app_enabled, np.contract_notifications
    INTO v_prefs
    FROM public.notification_preferences np
    WHERE np.user_id = v_recipient_id;

    -- Match the existing notification preference behavior. Missing preferences
    -- use the table defaults and therefore still receive the warning.
    IF NOT FOUND OR (v_prefs.in_app_enabled AND v_prefs.contract_notifications) THEN
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
      )
      VALUES (
        v_recipient_id,
        NULL,
        'contract_archiving_scheduled',
        v_title,
        v_message,
        '/messages/' || p_conversation_id::text,
        jsonb_build_object(
          'conversation_id', p_conversation_id,
          'work_contract_id', v_work_contract_id,
          'archive_reason', p_archive_reason,
          'archive_scheduled_at', p_archive_scheduled_at
        ),
        v_dedupe_key || ':' || v_recipient_id::text,
        false,
        NULL
      )
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Schedule only after the canonical mutually-confirmed final transition
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_schedule_conversation_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_conversation_id uuid;
  v_final_at timestamptz;
  v_reason text;
  v_scheduled_at timestamptz;
  v_final_transition boolean := false;
BEGIN
  IF NEW.status IN ('completed', 'cancelled') THEN
    IF TG_OP = 'INSERT' THEN
      v_final_transition := true;
    ELSE
      v_final_transition := OLD.status IS DISTINCT FROM NEW.status
        OR OLD.permanent_conversation_id IS DISTINCT FROM NEW.permanent_conversation_id
        OR OLD.completed_at IS DISTINCT FROM NEW.completed_at
        OR OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at;
    END IF;

    IF v_final_transition THEN
      v_reason := CASE WHEN NEW.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END;
      v_final_at := CASE
        WHEN v_reason = 'cancelled' THEN COALESCE(NEW.cancelled_at, NEW.updated_at, NEW.created_at, now())
        ELSE COALESCE(NEW.completed_at, NEW.updated_at, NEW.created_at, now())
      END;
      v_scheduled_at := v_final_at + interval '24 hours';
      v_conversation_id := public.resolve_work_conversation_id(
        NEW.id,
        NEW.permanent_conversation_id
      );

      IF v_conversation_id IS NOT NULL THEN
        UPDATE public.conversations c
        SET archive_scheduled_at = v_scheduled_at,
            archive_reason = v_reason
        WHERE c.id = v_conversation_id
          AND c.archived_at IS NULL
          AND (
            c.archive_scheduled_at IS DISTINCT FROM v_scheduled_at
            OR c.archive_reason IS DISTINCT FROM v_reason
          );

        IF FOUND THEN
          PERFORM public.notify_conversation_archive_scheduled(
            v_conversation_id,
            v_reason,
            v_scheduled_at
          );
        END IF;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.status NOT IN ('completed', 'cancelled')
    AND OLD.status IN ('completed', 'cancelled') THEN
    v_conversation_id := public.resolve_work_conversation_id(
      NEW.id,
      NEW.permanent_conversation_id
    );

    IF v_conversation_id IS NOT NULL THEN
      UPDATE public.conversations
      SET archive_scheduled_at = NULL,
          archived_at = NULL,
          archive_reason = NULL
      WHERE id = v_conversation_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_conversation_archive_trigger ON public.work_contracts;
CREATE TRIGGER trg_schedule_conversation_archive_trigger
  AFTER INSERT OR UPDATE OF status, permanent_conversation_id, completed_at, cancelled_at
  ON public.work_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_schedule_conversation_archive();

-- Existing final contracts are backfilled only when an exact work-contract
-- conversation linkage exists. Age alone is never used as archive evidence.
DO $$
DECLARE
  v_existing record;
  v_scheduled_at timestamptz;
BEGIN
  FOR v_existing IN
    SELECT DISTINCT ON (c.id)
      c.id AS conversation_id,
      wc.status,
      CASE
        WHEN wc.status = 'cancelled' THEN COALESCE(wc.cancelled_at, wc.updated_at, wc.created_at, now())
        ELSE COALESCE(wc.completed_at, wc.updated_at, wc.created_at, now())
      END AS final_at
    FROM public.work_contracts wc
    JOIN public.conversations c
      ON c.id = public.resolve_work_conversation_id(wc.id, wc.permanent_conversation_id)
    WHERE wc.status IN ('completed', 'cancelled')
      AND c.archive_scheduled_at IS NULL
      AND c.archived_at IS NULL
    ORDER BY c.id, wc.updated_at DESC NULLS LAST
  LOOP
    v_scheduled_at := v_existing.final_at + interval '24 hours';
    UPDATE public.conversations
    SET archive_scheduled_at = v_scheduled_at,
        archive_reason = CASE WHEN v_existing.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END
    WHERE id = v_existing.conversation_id
      AND archive_scheduled_at IS NULL
      AND archived_at IS NULL;

    IF FOUND THEN
      PERFORM public.notify_conversation_archive_scheduled(
        v_existing.conversation_id,
        CASE WHEN v_existing.status = 'cancelled' THEN 'cancelled' ELSE 'completed' END,
        v_scheduled_at
      );
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Server-side archival, safe to run repeatedly while users are offline
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_expired_work_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.conversations
  SET archived_at = now()
  WHERE archive_scheduled_at IS NOT NULL
    AND archived_at IS NULL
    AND archive_scheduled_at <= now();
END;
$$;

-- Enable Supabase Cron before creating the archive scheduler.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Supabase Cron uses cron.schedule rather than direct cron.job writes. Existing
-- jobs are altered in place, so rerunning this migration cannot create duplicates.
-- If pg_cron is unavailable, the function remains installed and the scheduler
-- must be enabled/verified separately in the target Supabase project.
DO $$
DECLARE
  v_job_id bigint;
  v_duplicate_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT MIN(jobid)
    INTO v_job_id
    FROM cron.job
    WHERE jobname = 'archive-conversations-job';

    IF v_job_id IS NULL THEN
      SELECT cron.schedule(
        'archive-conversations-job',
        '*/15 * * * *',
        'SELECT public.archive_expired_work_conversations()'
      ) INTO v_job_id;
    ELSE
      PERFORM cron.alter_job(
        v_job_id,
        schedule => '*/15 * * * *',
        command => 'SELECT public.archive_expired_work_conversations()'
      );
    END IF;

    -- Remove any duplicate jobs through the pg_cron API, never by writing cron.job.
    FOR v_duplicate_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'archive-conversations-job'
        AND jobid <> v_job_id
    LOOP
      PERFORM cron.unschedule(v_duplicate_job_id);
    END LOOP;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Message INSERT protection: valid participants only, and never archived
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can send message content" ON public.messages;
DROP POLICY IF EXISTS "Users in conversation can send messages" ON public.messages;
DROP POLICY IF EXISTS "Conversation participants can send messages" ON public.messages;

CREATE POLICY "Conversation participants can send messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.archived_at IS NULL
        AND (
          c.creator_id = auth.uid()
          OR c.member_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id
              AND cm.user_id = auth.uid()
          )
        )
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Central unread RPC: archived conversations contribute zero
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_message_count integer := 0;
  v_notification_count integer := 0;
  v_workflow_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('message_count', 0, 'notification_count', 0, 'workflow_count', 0);
  END IF;

  SELECT COUNT(*)::integer INTO v_message_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (
    c.creator_id = v_user_id
    OR c.member_id = v_user_id
    OR EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id
        AND cm.user_id = v_user_id
    )
  )
    AND c.archived_at IS NULL
    AND m.sender_id <> v_user_id
    AND m.unread = true;

  SELECT COUNT(*)::integer INTO v_notification_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id
    AND n.is_read = false;

  SELECT COUNT(*)::integer INTO v_workflow_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id
    AND n.is_read = false
    AND (
      n.type LIKE 'application_%'
      OR n.type LIKE 'hire_%'
      OR n.type LIKE 'contract_%'
      OR n.type IN (
        'negotiation_updated',
        'deal_confirmed',
        'work_started',
        'work_completed',
        'completion_confirmed',
        'review_available',
        'review_required',
        'review_received'
      )
    );

  RETURN jsonb_build_object(
    'message_count', COALESCE(v_message_count, 0),
    'notification_count', COALESCE(v_notification_count, 0),
    'workflow_count', COALESCE(v_workflow_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_work_conversation_id(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_conversation_archive_scheduled(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_schedule_conversation_archive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_expired_work_conversations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

NOTIFY pgrst, reload_schema;

COMMIT;