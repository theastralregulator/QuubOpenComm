-- Migration: 202608030005_centralized_notification_system.sql
-- Description: Centralized production-ready notification engine with strict security RLS, deduplication key, RPC helpers, workflow integrations, and Realtime publication.

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_url text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  dedupe_key text,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at timestamptz
);

-- 2. Create notification_preferences table
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

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 4. Strict Security RLS Policies for notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Direct INSERT is DENIED to authenticated and anon users to prevent spoofing.
-- Notifications MUST be created via SECURITY DEFINER create_notification() or DB workflow RPCs.
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM PUBLIC, anon, authenticated;

-- 5. RLS Policies for notification_preferences
DROP POLICY IF EXISTS "Users can read own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can read own notification preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6. Performance & Deduplication Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
  ON public.notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_id, is_read)
  WHERE is_read = false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 7. RPC Helper: Create Notification (SECURITY DEFINER, validated caller & preference check)
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
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_prefs record;
  v_category_enabled boolean := true;
  v_caller_id uuid := auth.uid();
  v_effective_actor uuid;
BEGIN
  -- Validate caller: if invoked by authenticated user, enforce actor_id = caller_id to prevent spoofing
  IF v_caller_id IS NOT NULL THEN
    v_effective_actor := v_caller_id;
  ELSE
    v_effective_actor := p_actor_id;
  END IF;

  -- Do not notify self
  IF v_effective_actor IS NOT NULL AND v_effective_actor = p_recipient_id THEN
    RETURN NULL;
  END IF;

  -- Fetch user preferences if existing
  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = p_recipient_id;
  
  IF FOUND THEN
    IF NOT v_prefs.in_app_enabled THEN
      RETURN NULL;
    END IF;

    IF p_type LIKE 'hire_%' AND NOT v_prefs.hire_notifications THEN
      v_category_enabled := false;
    ELSIF p_type LIKE 'application_%' AND NOT v_prefs.application_notifications THEN
      v_category_enabled := false;
    ELSIF p_type LIKE 'contract_%' AND NOT v_prefs.contract_notifications THEN
      v_category_enabled := false;
    ELSIF p_type LIKE 'message_%' AND NOT v_prefs.message_notifications THEN
      v_category_enabled := false;
    ELSIF p_type LIKE 'marketing_%' AND NOT v_prefs.marketing_notifications THEN
      v_category_enabled := false;
    END IF;

    IF NOT v_category_enabled THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Deduplicated Insert
  IF p_dedupe_key IS NOT NULL AND TRIM(p_dedupe_key) <> '' THEN
    INSERT INTO public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      message,
      target_url,
      metadata,
      dedupe_key,
      is_read
    )
    VALUES (
      p_recipient_id,
      v_effective_actor,
      p_type,
      p_title,
      p_message,
      p_target_url,
      COALESCE(p_metadata, '{}'::jsonb),
      TRIM(p_dedupe_key),
      false
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      created_at = now(),
      is_read = false
    RETURNING id INTO v_notification_id;
  ELSE
    INSERT INTO public.notifications (
      recipient_id,
      actor_id,
      type,
      title,
      message,
      target_url,
      metadata,
      is_read
    )
    VALUES (
      p_recipient_id,
      v_effective_actor,
      p_type,
      p_title,
      p_message,
      p_target_url,
      COALESCE(p_metadata, '{}'::jsonb),
      false
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
END;
$$;

-- Revoke direct EXECUTE access from PUBLIC, anon, and authenticated roles.
-- create_notification can ONLY be called by trusted database workflow RPCs / triggers.
REVOKE EXECUTE ON FUNCTION public.create_notification FROM PUBLIC, anon, authenticated;

-- 8. RPC Helper: Mark Single Notification as Read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE id = p_notification_id
    AND recipient_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'notification_id', p_notification_id);
END;
$$;

-- 9. RPC Helper: Mark All Notifications as Read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE recipient_id = v_user_id
    AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'marked_read_count', v_count);
END;
$$;

-- 10. RPC Helper: Delete Single Notification
CREATE OR REPLACE FUNCTION public.delete_notification(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  DELETE FROM public.notifications
  WHERE id = p_notification_id
    AND recipient_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_notification_id);
END;
$$;

-- 11. RPC Helper: Get Unread Notification Count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.notifications
  WHERE recipient_id = v_user_id
    AND is_read = false;

  RETURN v_count;
END;
$$;

-- 12. RPC Helper: Get User Notifications (Paginated with optional filtering)
CREATE OR REPLACE FUNCTION public.get_my_notifications(
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_unread_only boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  recipient_id uuid,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  type text,
  title text,
  message text,
  target_url text,
  metadata jsonb,
  is_read boolean,
  created_at timestamptz,
  read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  RETURN QUERY
  SELECT 
    n.id,
    n.recipient_id,
    n.actor_id,
    COALESCE(p.full_name, 'OpenComm User') AS actor_name,
    p.avatar_url AS actor_avatar_url,
    n.type,
    n.title,
    n.message,
    n.target_url,
    n.metadata,
    n.is_read,
    n.created_at,
    n.read_at
  FROM public.notifications n
  LEFT JOIN public.profiles p ON n.actor_id = p.id
  WHERE n.recipient_id = v_user_id
    AND (NOT p_unread_only OR n.is_read = false)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 13. RPC Helper: Get User Notification Preferences
CREATE OR REPLACE FUNCTION public.get_user_notification_preferences()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_prefs FROM public.notification_preferences WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.notification_preferences (user_id)
    VALUES (v_user_id)
    RETURNING * INTO v_prefs;
  END IF;

  RETURN to_jsonb(v_prefs);
END;
$$;

-- 14. RPC Helper: Upsert User Notification Preferences
CREATE OR REPLACE FUNCTION public.upsert_user_notification_preferences(
  p_in_app_enabled boolean DEFAULT true,
  p_email_enabled boolean DEFAULT true,
  p_hire_notifications boolean DEFAULT true,
  p_application_notifications boolean DEFAULT true,
  p_contract_notifications boolean DEFAULT true,
  p_message_notifications boolean DEFAULT true,
  p_marketing_notifications boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_prefs record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  INSERT INTO public.notification_preferences (
    user_id,
    in_app_enabled,
    email_enabled,
    hire_notifications,
    application_notifications,
    contract_notifications,
    message_notifications,
    marketing_notifications,
    updated_at
  )
  VALUES (
    v_user_id,
    p_in_app_enabled,
    p_email_enabled,
    p_hire_notifications,
    p_application_notifications,
    p_contract_notifications,
    p_message_notifications,
    p_marketing_notifications,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
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

-- 15. Add notifications to Supabase Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
