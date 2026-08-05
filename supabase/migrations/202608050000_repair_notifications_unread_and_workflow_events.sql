-- Repair notification, unread-message, and workflow event delivery.
-- This migration is additive and preserves legacy notification rows.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Reconcile legacy and centralized notification schemas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid,
  actor_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  target_url text DEFAULT '/profile/notifications',
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  dedupe_key text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at timestamptz
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS target_url text DEFAULT '/profile/notifications',
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL';
    EXECUTE 'UPDATE public.notifications SET recipient_id = user_id WHERE recipient_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'description'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ALTER COLUMN description DROP NOT NULL';
    EXECUTE $sql$UPDATE public.notifications
      SET message = COALESCE(message, description, title, 'OpenComm notification')
      WHERE message IS NULL$sql$;
  ELSE
    EXECUTE $sql$UPDATE public.notifications
      SET message = COALESCE(message, title, 'OpenComm notification')
      WHERE message IS NULL$sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read'
  ) THEN
    EXECUTE 'ALTER TABLE public.notifications ALTER COLUMN read DROP NOT NULL';
    EXECUTE 'UPDATE public.notifications SET is_read = COALESCE(read, false) WHERE is_read IS NULL';
  END IF;
END $$;

ALTER TABLE public.notifications
  ALTER COLUMN recipient_id SET NOT NULL,
  ALTER COLUMN message SET NOT NULL,
  ALTER COLUMN target_url SET DEFAULT '/profile/notifications',
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN is_read SET DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND conname = 'notifications_recipient_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_recipient_id_fkey
      FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND conname = 'notifications_actor_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  in_app_enabled boolean DEFAULT true NOT NULL,
  email_enabled boolean DEFAULT true NOT NULL,
  hire_notifications boolean DEFAULT true NOT NULL,
  application_notifications boolean DEFAULT true NOT NULL,
  contract_notifications boolean DEFAULT true NOT NULL,
  message_notifications boolean DEFAULT true NOT NULL,
  marketing_notifications boolean DEFAULT true NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('notifications', 'notification_preferences')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname,
      CASE WHEN policy_row.tablename = 'notifications' THEN 'notifications' ELSE 'notification_preferences' END);
  END LOOP;
END $$;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE INSERT ON public.notifications FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_id, is_read)
  WHERE is_read = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Canonical notification RPCs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_target_url text,
  p_actor_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_notification_id uuid;
  v_prefs record;
  v_caller_id uuid := auth.uid();
  v_actor_id uuid := COALESCE(v_caller_id, p_actor_id);
BEGIN
  IF p_recipient_id IS NULL OR p_type IS NULL OR p_title IS NULL OR p_message IS NULL THEN
    RAISE EXCEPTION 'Notification recipient, type, title, and message are required.';
  END IF;

  IF v_actor_id IS NOT NULL AND v_actor_id = p_recipient_id THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_prefs
  FROM public.notification_preferences
  WHERE user_id = p_recipient_id;

  IF FOUND THEN
    IF NOT v_prefs.in_app_enabled THEN RETURN NULL; END IF;
    IF p_type LIKE 'hire_%' AND NOT v_prefs.hire_notifications THEN RETURN NULL; END IF;
    IF p_type LIKE 'application_%' AND NOT v_prefs.application_notifications THEN RETURN NULL; END IF;
    IF p_type LIKE 'contract_%' AND NOT v_prefs.contract_notifications THEN RETURN NULL; END IF;
    IF p_type LIKE 'message_%' AND NOT v_prefs.message_notifications THEN RETURN NULL; END IF;
    IF p_type LIKE 'marketing_%' AND NOT v_prefs.marketing_notifications THEN RETURN NULL; END IF;
  END IF;

  IF NULLIF(TRIM(p_dedupe_key), '') IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, actor_id, type, title, message, target_url, metadata, dedupe_key, is_read, read_at
    ) VALUES (
      p_recipient_id, v_actor_id, p_type, p_title, p_message,
      COALESCE(NULLIF(p_target_url, ''), '/profile/notifications'), COALESCE(p_metadata, '{}'::jsonb),
      TRIM(p_dedupe_key), false, NULL
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
      actor_id = EXCLUDED.actor_id,
      type = EXCLUDED.type,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      target_url = EXCLUDED.target_url,
      metadata = EXCLUDED.metadata,
      is_read = false,
      read_at = NULL,
      created_at = now()
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO public.notifications (
      recipient_id, actor_id, type, title, message, target_url, metadata, is_read, read_at
    ) VALUES (
      p_recipient_id, v_actor_id, p_type, p_title, p_message,
      COALESCE(NULLIF(p_target_url, ''), '/profile/notifications'), COALESCE(p_metadata, '{}'::jsonb), false, NULL
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  UPDATE public.notifications SET is_read = true, read_at = now()
  WHERE id = p_notification_id AND recipient_id = v_user_id;
  RETURN jsonb_build_object('success', true, 'notification_id', p_notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  UPDATE public.notifications SET is_read = true, read_at = now()
  WHERE recipient_id = v_user_id AND is_read = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'marked_read_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  DELETE FROM public.notifications WHERE id = p_notification_id AND recipient_id = v_user_id;
  RETURN jsonb_build_object('success', true, 'deleted_id', p_notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_count integer;
BEGIN
  IF v_user_id IS NULL THEN RETURN 0; END IF;
  SELECT COUNT(*)::integer INTO v_count FROM public.notifications
  WHERE recipient_id = v_user_id AND is_read = false;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_notifications(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_unread_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, recipient_id uuid, actor_id uuid, actor_name text, actor_avatar_url text,
  type text, title text, message text, target_url text, metadata jsonb,
  is_read boolean, created_at timestamptz, read_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  RETURN QUERY
  SELECT n.id, n.recipient_id, n.actor_id,
    COALESCE(p.full_name, 'OpenComm User'), p.avatar_url,
    n.type, n.title, n.message, n.target_url, n.metadata,
    n.is_read, n.created_at, n.read_at
  FROM public.notifications n
  LEFT JOIN public.profiles p ON p.id = n.actor_id
  WHERE n.recipient_id = v_user_id
    AND (NOT p_unread_only OR n.is_read = false)
  ORDER BY n.created_at DESC
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_notification_preferences()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_prefs record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.notification_preferences(user_id) VALUES (v_user_id) RETURNING * INTO v_prefs;
  END IF;
  RETURN to_jsonb(v_prefs);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_notification_preferences(
  p_in_app_enabled boolean DEFAULT true,
  p_email_enabled boolean DEFAULT true,
  p_hire_notifications boolean DEFAULT true,
  p_application_notifications boolean DEFAULT true,
  p_contract_notifications boolean DEFAULT true,
  p_message_notifications boolean DEFAULT true,
  p_marketing_notifications boolean DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid(); v_prefs record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated.'; END IF;
  INSERT INTO public.notification_preferences(
    user_id, in_app_enabled, email_enabled, hire_notifications,
    application_notifications, contract_notifications, message_notifications,
    marketing_notifications, updated_at
  ) VALUES (
    v_user_id, p_in_app_enabled, p_email_enabled, p_hire_notifications,
    p_application_notifications, p_contract_notifications, p_message_notifications,
    p_marketing_notifications, now()
  ) ON CONFLICT (user_id) DO UPDATE SET
    in_app_enabled = EXCLUDED.in_app_enabled,
    email_enabled = EXCLUDED.email_enabled,
    hire_notifications = EXCLUDED.hire_notifications,
    application_notifications = EXCLUDED.application_notifications,
    contract_notifications = EXCLUDED.contract_notifications,
    message_notifications = EXCLUDED.message_notifications,
    marketing_notifications = EXCLUDED.marketing_notifications,
    updated_at = now()
  RETURNING * INTO v_prefs;
  RETURN to_jsonb(v_prefs);
END;
$$;

-- One database source for every visible unread badge.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
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
    c.creator_id = v_user_id OR
    c.member_id = v_user_id OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = c.id AND cm.user_id = v_user_id
    )
  )
    AND m.sender_id <> v_user_id
    AND m.unread = true;

  SELECT COUNT(*)::integer INTO v_notification_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id AND n.is_read = false;

  SELECT COUNT(*)::integer INTO v_workflow_count
  FROM public.notifications n
  WHERE n.recipient_id = v_user_id
    AND n.is_read = false
    AND (
      n.type LIKE 'application_%' OR
      n.type LIKE 'hire_%' OR
      n.type LIKE 'contract_%' OR
      n.type IN (
        'negotiation_updated', 'deal_confirmed', 'work_started', 'work_completed',
        'completion_confirmed', 'review_available', 'review_required'
      )
    );

  RETURN jsonb_build_object(
    'message_count', COALESCE(v_message_count, 0),
    'notification_count', COALESCE(v_notification_count, 0),
    'workflow_count', COALESCE(v_workflow_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_notification(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_notifications(integer, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_notification_preferences() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_user_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_notification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_notifications(integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_user_notification_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Canonical message read state
-- -----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_messages_unread_incoming
  ON public.messages(conversation_id, unread, sender_id)
  WHERE unread = true;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id AND (creator_id = v_user_id OR member_id = v_user_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Not a participant in this conversation';
  END IF;

  UPDATE public.messages
  SET unread = false, read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_id <> v_user_id
    AND unread = true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- Conversation membership is the authorization boundary for message delivery.
-- Replace the legacy policies that ignored conversation_members and allowed
-- message reads to drift from the read-state RPC.
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'conversation_members', 'messages')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END $$;

CREATE POLICY "Conversation participants can read conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid() OR
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "Conversation participants can update conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid() OR
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    creator_id = auth.uid() OR
    member_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversations.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their conversation memberships"
  ON public.conversation_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can add their own conversation membership"
  ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversation membership"
  ON public.conversation_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own conversation membership"
  ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Conversation participants can read messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.creator_id = auth.uid() OR
          c.member_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.creator_id = auth.uid() OR
          c.member_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4. Database-generated workflow notifications
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_application_workflow_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_job_owner uuid;
  v_recipient uuid;
  v_actor uuid := COALESCE(auth.uid(), NEW.applicant_id);
  v_type text;
  v_title text;
  v_message text;
  v_target text;
BEGIN
  SELECT posted_by INTO v_job_owner FROM public.jobs WHERE id = NEW.job_id;
  IF v_job_owner IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      v_job_owner, 'application_submitted', 'New job application',
      'A new application was submitted for your job.', '/profile/my-job-posts', NEW.applicant_id,
      jsonb_build_object('application_id', NEW.id, 'job_id', NEW.job_id),
      'application:' || NEW.id::text || ':submitted'
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'accepted' THEN
    v_recipient := NEW.applicant_id;
    v_type := 'application_accepted';
    v_title := 'Application accepted';
    v_message := 'Your application has been accepted.';
    v_target := '/profile/jobs-applied';
  ELSIF NEW.status = 'rejected' THEN
    v_recipient := NEW.applicant_id;
    v_type := 'application_rejected';
    v_title := 'Application rejected';
    v_message := 'Your application was not selected for this opportunity.';
    v_target := '/profile/jobs-applied';
  ELSIF NEW.status = 'withdrawn' THEN
    v_recipient := v_job_owner;
    v_type := 'application_withdrawn';
    v_title := 'Application withdrawn';
    v_message := 'An applicant withdrew their application.';
    v_target := '/profile/my-job-posts';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    v_recipient, v_type, v_title, v_message, v_target, v_actor,
    jsonb_build_object('application_id', NEW.id, 'job_id', NEW.job_id, 'status', NEW.status),
    'application:' || NEW.id::text || ':' || v_type
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_hiring_workflow_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_recipient uuid;
  v_actor uuid := COALESCE(auth.uid(), NEW.client_id);
  v_type text;
  v_title text;
  v_message text;
  v_target text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.worker_id, 'hire_request_received', 'New hiring request',
      'A client sent you a hiring request.', '/profile/hire-requests', NEW.client_id,
      jsonb_build_object('hiring_request_id', NEW.id),
      'hire_request:' || NEW.id::text || ':received'
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'accepted' THEN
    v_recipient := NEW.client_id; v_type := 'hire_request_accepted';
    v_title := 'Hiring request accepted'; v_message := 'Your hiring request was accepted.';
  ELSIF NEW.status = 'rejected' THEN
    v_recipient := NEW.client_id; v_type := 'hire_request_rejected';
    v_title := 'Hiring request rejected'; v_message := 'Your hiring request was rejected.';
  ELSIF NEW.status = 'withdrawn' THEN
    v_recipient := NEW.worker_id; v_type := 'hire_request_withdrawn';
    v_title := 'Hiring request withdrawn'; v_message := 'A hiring request was withdrawn.';
  ELSIF NEW.status = 'negotiating' THEN
    v_recipient := CASE WHEN v_actor = NEW.client_id THEN NEW.worker_id ELSE NEW.client_id END;
    v_type := 'negotiation_updated'; v_title := 'Negotiation updated';
    v_message := 'A hiring negotiation was updated.';
  ELSIF NEW.status = 'confirmed' THEN
    v_recipient := CASE WHEN v_actor = NEW.client_id THEN NEW.worker_id ELSE NEW.client_id END;
    v_type := 'deal_confirmed'; v_title := 'Deal confirmed';
    v_message := 'The hiring deal has been confirmed.';
  ELSE
    RETURN NEW;
  END IF;

  v_target := CASE
    WHEN v_type LIKE 'hire_request_%' THEN '/profile/hire-requests'
    ELSE '/hire-requests/' || NEW.id::text || '/negotiation'
  END;

  PERFORM public.create_notification(
    v_recipient, v_type, v_title, v_message, v_target, v_actor,
    jsonb_build_object('hiring_request_id', NEW.id, 'status', NEW.status),
    'hire_request:' || NEW.id::text || ':' || v_type
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_negotiation_workflow_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_room record;
  v_recipient uuid;
  v_target text;
BEGIN
  SELECT client_id, worker_id, hiring_request_id, job_application_id INTO v_room
  FROM public.negotiation_rooms WHERE id = NEW.negotiation_room_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_recipient := CASE
    WHEN NEW.sender_id = v_room.client_id THEN v_room.worker_id
    WHEN NEW.sender_id = v_room.worker_id THEN v_room.client_id
    ELSE NULL
  END;
  IF v_recipient IS NULL THEN RETURN NEW; END IF;

  v_target := CASE
    WHEN v_room.hiring_request_id IS NOT NULL THEN '/hire-requests/' || v_room.hiring_request_id::text || '/negotiation'
    WHEN v_room.job_application_id IS NOT NULL THEN '/applications/' || v_room.job_application_id::text || '/negotiation'
    ELSE '/profile/notifications'
  END;

  PERFORM public.create_notification(
    v_recipient, 'negotiation_updated', 'Negotiation updated',
    'There is a new update in your negotiation.',
    v_target,
    NEW.sender_id,
    jsonb_build_object('negotiation_room_id', NEW.negotiation_room_id, 'message_id', NEW.id),
    'negotiation_message:' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_deal_proposal_workflow_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_client uuid;
  v_worker uuid;
  v_actor uuid := COALESCE(auth.uid(), NEW.proposed_by);
  v_recipient uuid;
  v_type text;
  v_title text;
  v_message text;
  v_request_id uuid;
BEGIN
  IF NEW.hiring_request_id IS NOT NULL THEN
    SELECT client_id, worker_id INTO v_client, v_worker
    FROM public.hiring_requests WHERE id = NEW.hiring_request_id;
    v_request_id := NEW.hiring_request_id;
  ELSIF NEW.job_application_id IS NOT NULL THEN
    SELECT j.posted_by, ja.applicant_id, ja.id
    INTO v_client, v_worker, v_request_id
    FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    WHERE ja.id = NEW.job_application_id;
  END IF;
  IF v_client IS NULL OR v_worker IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_type := 'negotiation_updated';
    v_title := 'New deal proposal';
    v_message := 'A new deal proposal is waiting for your response.';
  ELSIF NEW.proposal_status IS DISTINCT FROM OLD.proposal_status
     OR NEW.client_response IS DISTINCT FROM OLD.client_response
     OR NEW.worker_response IS DISTINCT FROM OLD.worker_response THEN
    IF NEW.proposal_status = 'accepted'
       OR (NEW.client_response = 'accepted' AND NEW.worker_response = 'accepted') THEN
      v_type := 'deal_confirmed';
      v_title := 'Deal confirmed';
      v_message := 'A deal proposal has been accepted.';
    ELSE
      v_type := 'negotiation_updated';
      v_title := 'Negotiation updated';
      v_message := 'A deal proposal received a new response.';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_recipient := CASE WHEN v_actor = v_client THEN v_worker ELSE v_client END;
  PERFORM public.create_notification(
    v_recipient, v_type, v_title, v_message,
    CASE WHEN NEW.hiring_request_id IS NOT NULL THEN '/hire-requests/' || v_request_id::text || '/negotiation' ELSE '/applications/' || v_request_id::text || '/negotiation' END,
    v_actor,
    jsonb_build_object('deal_proposal_id', NEW.id, 'hiring_request_id', NEW.hiring_request_id, 'job_application_id', NEW.job_application_id, 'proposal_status', NEW.proposal_status),
    'deal_proposal:' || NEW.id::text || ':' || v_type
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_contract_workflow_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), NEW.client_id);
  v_recipient uuid;
  v_type text;
  v_title text;
  v_message text;
BEGIN
  v_recipient := CASE WHEN v_actor = NEW.client_id THEN NEW.worker_id ELSE NEW.client_id END;

  IF TG_OP = 'INSERT' THEN
    v_type := 'contract_created'; v_title := 'Contract created';
    v_message := 'A work contract has been created for your deal.';
    PERFORM public.create_notification(
      v_recipient, v_type, v_title, v_message, '/work-contracts/' || NEW.id::text,
      v_actor, jsonb_build_object('work_contract_id', NEW.id, 'status', NEW.status),
      'work_contract:' || NEW.id::text || ':contract_created'
    );
    PERFORM public.create_notification(
      v_recipient, 'work_started', 'Work started',
      'Work has started under the new contract.', '/work-contracts/' || NEW.id::text,
      v_actor, jsonb_build_object('work_contract_id', NEW.id, 'status', NEW.status),
      'work_contract:' || NEW.id::text || ':work_started'
    );
    RETURN NEW;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancellation_requested' THEN
    v_type := 'contract_cancellation_requested'; v_title := 'Contract cancellation requested';
    v_message := 'A contract cancellation request needs your response.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled' THEN
    v_type := 'contract_cancelled'; v_title := 'Contract cancelled';
    v_message := 'A work contract has been cancelled.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completion_requested' THEN
    v_type := 'work_completed'; v_title := 'Work marked completed';
    v_message := 'The other party marked the work as completed.';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    v_type := 'completion_confirmed'; v_title := 'Completion confirmed';
    v_message := 'Work completion has been confirmed.';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    v_recipient, v_type, v_title, v_message, '/work-contracts/' || NEW.id::text,
    v_actor, jsonb_build_object('work_contract_id', NEW.id, 'status', NEW.status),
    'work_contract:' || NEW.id::text || ':' || v_type
  );
  RETURN NEW;
END;
$$;

-- Keep one review notification per party while using the workflow event name
-- consumed by the profile badge and notification filters.
CREATE OR REPLACE FUNCTION public.notify_contract_completed_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    PERFORM public.create_notification(
      NEW.client_id,
      'review_required',
      'Review required',
      'The completed work is ready for your review.',
      '/work-contracts/' || NEW.id,
      NEW.worker_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_required:' || NEW.id || ':' || NEW.client_id
    );
    PERFORM public.create_notification(
      NEW.worker_id,
      'review_required',
      'Review required',
      'The completed work is ready for your review.',
      '/work-contracts/' || NEW.id,
      NEW.client_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_required:' || NEW.id || ':' || NEW.worker_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_application_workflow ON public.job_applications;
CREATE TRIGGER trg_notify_application_workflow
  AFTER INSERT OR UPDATE OF status ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_workflow_event();

DROP TRIGGER IF EXISTS trg_notify_hiring_workflow ON public.hiring_requests;
CREATE TRIGGER trg_notify_hiring_workflow
  AFTER INSERT OR UPDATE OF status ON public.hiring_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_hiring_workflow_event();

DROP TRIGGER IF EXISTS trg_notify_negotiation_workflow ON public.negotiation_messages;
CREATE TRIGGER trg_notify_negotiation_workflow
  AFTER INSERT ON public.negotiation_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_negotiation_workflow_event();

DROP TRIGGER IF EXISTS trg_notify_deal_proposal_workflow ON public.deal_proposals;
CREATE TRIGGER trg_notify_deal_proposal_workflow
  AFTER INSERT OR UPDATE OF proposal_status, client_response, worker_response ON public.deal_proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_deal_proposal_workflow_event();

DROP TRIGGER IF EXISTS trg_notify_contract_workflow ON public.work_contracts;
CREATE TRIGGER trg_notify_contract_workflow
  AFTER INSERT OR UPDATE OF status ON public.work_contracts
  FOR EACH ROW EXECUTE FUNCTION public.notify_contract_workflow_event();

-- -----------------------------------------------------------------------------
-- 5. Realtime publication for the single client coordinator
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY[
      'messages', 'conversations', 'notifications', 'job_applications',
      'hiring_requests', 'negotiation_messages', 'deal_proposals', 'work_contracts'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Realtime publication repair skipped: %', SQLERRM;
END $$;

NOTIFY pgrst, reload_schema;

COMMIT;
