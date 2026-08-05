-- Patch get_unread_counts to include review_received and contract_cancellation_requested
-- in the workflow notification count, matching the client-side category definitions.

BEGIN;

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

  -- Count unread incoming messages across all conversations the user participates in.
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
    AND m.sender_id <> v_user_id
    AND m.unread = true;

  -- Count all unread notifications.
  SELECT COUNT(*)::integer INTO v_notification_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id AND n.is_read = false;

  -- Count workflow-category unread notifications.
  -- Includes: application, hire, contract, negotiation, deal, work lifecycle, and review events.
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

-- Ensure authenticated users can call this function.
REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

-- Also ensure the notify_contract_completed_reviews trigger fires
-- for the correct status transition (status = 'completed').
-- The trigger already exists from the previous migration; only replace if needed.
CREATE OR REPLACE FUNCTION public.notify_contract_completed_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Notify client that work is ready for review.
    PERFORM public.create_notification(
      NEW.client_id,
      'review_required',
      'Review required',
      'The completed work is ready for your review.',
      '/work-contracts/' || NEW.id::text,
      NEW.worker_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_required:' || NEW.id::text || ':' || NEW.client_id::text
    );
    -- Notify worker that client can now leave a review.
    PERFORM public.create_notification(
      NEW.worker_id,
      'review_required',
      'Review required',
      'The completed work is ready for your review.',
      '/work-contracts/' || NEW.id::text,
      NEW.client_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_required:' || NEW.id::text || ':' || NEW.worker_id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger in case it was dropped or replaced on work_contracts.
DROP TRIGGER IF EXISTS trg_notify_contract_completed_reviews ON public.work_contracts;
CREATE TRIGGER trg_notify_contract_completed_reviews
  AFTER UPDATE OF status ON public.work_contracts
  FOR EACH ROW EXECUTE FUNCTION public.notify_contract_completed_reviews();

NOTIFY pgrst, reload_schema;

COMMIT;
