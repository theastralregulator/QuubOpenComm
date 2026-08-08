-- =============================================================================
-- Migration: 202608080001_automatic_conversation_archive.sql
-- Description: Implement 24-hour automatic archiving for work conversations
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Schema Additions
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS archive_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- -----------------------------------------------------------------------------
-- 2. Trigger to Schedule Archival
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_schedule_conversation_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Schedule archive 24 hours after completion or cancellation
  IF (NEW.status = 'completed' OR NEW.status = 'cancelled') AND (OLD.status IS NULL OR (OLD.status <> 'completed' AND OLD.status <> 'cancelled')) THEN
    UPDATE public.conversations
    SET archive_scheduled_at = now() + interval '24 hours'
    WHERE id = NEW.permanent_conversation_id;
  END IF;
  
  -- If somehow reopened/restored, cancel the scheduled archive
  IF (NEW.status <> 'completed' AND NEW.status <> 'cancelled') AND (OLD.status = 'completed' OR OLD.status = 'cancelled') THEN
    UPDATE public.conversations
    SET archive_scheduled_at = NULL, archived_at = NULL
    WHERE id = NEW.permanent_conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_conversation_archive_trigger ON public.work_contracts;
CREATE TRIGGER trg_schedule_conversation_archive_trigger
  AFTER UPDATE OF status ON public.work_contracts
  FOR EACH ROW EXECUTE FUNCTION public.trg_schedule_conversation_archive();

-- -----------------------------------------------------------------------------
-- 3. Archival Function
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

-- Note: Scheduling the execution via pg_cron should be done carefully 
-- if pg_cron is enabled on the instance. We wrap it in a DO block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Try to schedule the job, ignore if it already exists or fails
    BEGIN
      PERFORM cron.schedule('archive-conversations-job', '0 * * * *', 'SELECT public.archive_expired_work_conversations()');
    EXCEPTION WHEN OTHERS THEN
      -- Handle silently if cron.schedule throws (e.g. permission issues or already exists in some pg_cron versions)
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Message Send Protection (RLS)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can send message content" ON public.messages;
CREATE POLICY "Members can send message content" on public.messages
  for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id 
      and (c.creator_id = auth.uid() or c.member_id = auth.uid())
      and c.archived_at is null
    )
  );

-- Keep the older name policy dropped just in case
DROP POLICY IF EXISTS "Users in conversation can send messages" ON public.messages;

-- -----------------------------------------------------------------------------
-- 5. Unread Badge Protection
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id          uuid    := auth.uid();
  v_message_count    integer := 0;
  v_notification_count integer := 0;
  v_workflow_count   integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('message_count', 0, 'notification_count', 0, 'workflow_count', 0);
  END IF;

  -- Count unread incoming messages across all ACTIVE conversations the user participates in.
  SELECT COUNT(*)::integer INTO v_message_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE (
    c.creator_id = v_user_id OR
    c.member_id  = v_user_id OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id AND cm.user_id = v_user_id
    )
  )
    AND c.archived_at IS NULL
    AND m.sender_id <> v_user_id
    AND m.unread = true;

  -- Count all unread notifications.
  SELECT COUNT(*)::integer INTO v_notification_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id AND n.is_read = false;

  -- Count workflow-category unread notifications.
  SELECT COUNT(*)::integer INTO v_workflow_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id
    AND n.is_read = false
    AND (
      n.type LIKE 'application_%'              OR
      n.type LIKE 'hire_%'                     OR
      n.type LIKE 'contract_%'                 OR
      n.type IN (
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
    'message_count',      COALESCE(v_message_count,      0),
    'notification_count', COALESCE(v_notification_count, 0),
    'workflow_count',     COALESCE(v_workflow_count,     0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

NOTIFY pgrst, reload_schema;

COMMIT;
