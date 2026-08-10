-- Migration: 20260811_secure_chat_media.sql
-- Description: Add secure chat media messaging (message_media, upload_intents, storage_events, 15-day retention trigger, RPCs, RLS)
-- DO NOT APPLY REMOTELY AUTOMATICALLY.

-- 1. Add message_type to public.messages if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'message_type'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN message_type text NOT NULL DEFAULT 'text' 
    CHECK (message_type IN ('text', 'image', 'video', 'audio'));
  END IF;
END $$;

-- 2. Create public.message_media table
CREATE TABLE IF NOT EXISTS public.message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  storage_provider text NOT NULL CHECK (storage_provider IN ('r2', 'b2', 'cloudinary')),
  object_key text NOT NULL,
  provider_asset_id text NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  duration_ms integer NULL,
  width integer NULL,
  height integer NULL,
  original_filename text NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('uploading', 'active', 'cleanup_pending', 'deleted', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delete_after timestamptz NULL,
  deleted_at timestamptz NULL,
  cleanup_attempts integer NOT NULL DEFAULT 0,
  last_cleanup_error text NULL,
  last_cleanup_attempt_at timestamptz NULL,
  CONSTRAINT message_media_message_id_key UNIQUE (message_id)
);

-- 3. Create public.media_upload_intents table
CREATE TABLE IF NOT EXISTS public.media_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('r2', 'b2', 'cloudinary')),
  object_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'finalized', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- 4. Create public.media_storage_events table
CREATE TABLE IF NOT EXISTS public.media_storage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('r2', 'b2', 'cloudinary')),
  operation text NOT NULL CHECK (operation IN ('upload_intent', 'upload_finalize', 'access', 'delete', 'health')),
  event_type text NOT NULL CHECK (event_type IN ('success', 'failure', 'rate_limited', 'unauthorized', 'timeout')),
  http_status integer NULL,
  latency_ms integer NULL,
  media_type text NULL,
  size_bucket text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_message_media_message_id ON public.message_media(message_id);
CREATE INDEX IF NOT EXISTS idx_message_media_conversation_id ON public.message_media(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_media_delete_after ON public.message_media(delete_after) WHERE status IN ('active', 'cleanup_pending');
CREATE INDEX IF NOT EXISTS idx_media_upload_intents_expires_at ON public.media_upload_intents(expires_at) WHERE status IN ('pending', 'uploaded');
CREATE INDEX IF NOT EXISTS idx_media_storage_events_created_at ON public.media_storage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_media_storage_events_provider_created_at ON public.media_storage_events(provider, created_at);

-- 6. Trigger on conversations for 15-day post-archive retention
CREATE OR REPLACE FUNCTION public.schedule_media_retention_on_conversation_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- When conversation archived_at becomes non-null: schedule delete_after = archived_at + 15 days
  IF NEW.archived_at IS NOT NULL AND (OLD.archived_at IS NULL OR OLD.archived_at IS DISTINCT FROM NEW.archived_at) THEN
    UPDATE public.message_media
    SET delete_after = NEW.archived_at + interval '15 days'
    WHERE conversation_id = NEW.id
      AND status = 'active';
  -- If conversation unarchived: clear delete_after
  ELSIF NEW.archived_at IS NULL AND OLD.archived_at IS NOT NULL THEN
    UPDATE public.message_media
    SET delete_after = NULL
    WHERE conversation_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_media_retention ON public.conversations;
CREATE TRIGGER trg_schedule_media_retention
  AFTER UPDATE OF archived_at ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_media_retention_on_conversation_archive();

-- 7. Secure RPC to create a media message atomically
CREATE OR REPLACE FUNCTION public.create_media_message(
  p_conversation_id uuid,
  p_message_type text,
  p_preview_text text,
  p_media_type text,
  p_storage_provider text,
  p_object_key text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_duration_ms integer DEFAULT NULL,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL,
  p_original_filename text DEFAULT NULL,
  p_provider_asset_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_sender_name text;
  v_sender_avatar text;
  v_conv RECORD;
  v_msg_id uuid;
  v_media_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. Check conversation exists & caller is participant & not archived
  SELECT id, creator_id, member_id, archived_at
  INTO v_conv
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found.';
  END IF;

  IF v_conv.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot send media to an archived conversation.';
  END IF;

  IF v_conv.creator_id <> v_caller_id AND v_conv.member_id <> v_caller_id THEN
    RAISE EXCEPTION 'Not authorized to send messages in this conversation.';
  END IF;

  -- Get sender profile info from profile_directory
  SELECT COALESCE(full_name, username, 'OpenComm User'), avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profile_directory
  WHERE id = v_caller_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'OpenComm User';
  END IF;

  -- 2. Insert into messages table
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    sender_name,
    sender_avatar,
    text,
    message_type,
    unread,
    role,
    created_at
  )
  VALUES (
    p_conversation_id,
    v_caller_id,
    v_sender_name,
    v_sender_avatar,
    COALESCE(p_preview_text, 'Media'),
    p_message_type,
    true,
    'user',
    now()
  )
  RETURNING id INTO v_msg_id;

  -- 3. Insert into message_media table
  INSERT INTO public.message_media (
    message_id,
    conversation_id,
    uploader_id,
    media_type,
    storage_provider,
    object_key,
    provider_asset_id,
    mime_type,
    file_size_bytes,
    duration_ms,
    width,
    height,
    original_filename,
    status,
    created_at
  )
  VALUES (
    v_msg_id,
    p_conversation_id,
    v_caller_id,
    p_media_type,
    p_storage_provider,
    p_object_key,
    p_provider_asset_id,
    p_mime_type,
    p_file_size_bytes,
    p_duration_ms,
    p_width,
    p_height,
    p_original_filename,
    'active',
    now()
  )
  RETURNING id INTO v_media_id;

  -- 4. Update last message info on conversation
  UPDATE public.conversations
  SET last_message_text = COALESCE(p_preview_text, 'Media'),
      last_message_at = now(),
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'message_id', v_msg_id,
    'media_id', v_media_id
  );
END;
$$;

-- 8. Admin Media Health RPC
CREATE OR REPLACE FUNCTION public.admin_get_media_storage_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_active_media count_type;
  v_active_count bigint;
  v_cleanup_pending bigint;
  v_cleanup_overdue bigint;
  v_deleted_count bigint;
  v_orphan_intents bigint;
  v_events_1h jsonb;
  v_events_24h jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.is_admin(v_caller_id) THEN
    RAISE EXCEPTION 'Admin authorization required.';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.message_media WHERE status = 'active';
  SELECT count(*) INTO v_cleanup_pending FROM public.message_media WHERE status = 'cleanup_pending';
  SELECT count(*) INTO v_cleanup_overdue FROM public.message_media WHERE status IN ('active', 'cleanup_pending') AND delete_after IS NOT NULL AND delete_after <= now();
  SELECT count(*) INTO v_deleted_count FROM public.message_media WHERE status = 'deleted';
  SELECT count(*) INTO v_orphan_intents FROM public.media_upload_intents WHERE status = 'pending' AND expires_at <= now();

  -- Telemetry events in last 24h by provider
  SELECT jsonb_object_agg(provider, provider_data) INTO v_events_24h
  FROM (
    SELECT provider, jsonb_build_object(
      'total_events', count(*),
      'success_count', count(*) FILTER (WHERE event_type = 'success'),
      'failure_count', count(*) FILTER (WHERE event_type = 'failure'),
      'avg_latency_ms', round(avg(latency_ms))
    ) AS provider_data
    FROM public.media_storage_events
    WHERE created_at >= (now() - interval '24 hours')
    GROUP BY provider
  ) t;

  RETURN jsonb_build_object(
    'active_media_count', v_active_count,
    'cleanup_pending_count', v_cleanup_pending,
    'cleanup_overdue_count', v_cleanup_overdue,
    'deleted_media_count', v_deleted_count,
    'orphan_intents_count', v_orphan_intents,
    'events_summary_24h', COALESCE(v_events_24h, '{}'::jsonb),
    'retention_policy_days', 15
  );
END;
$$;

-- 9. RLS & Grants
ALTER TABLE public.message_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_storage_events ENABLE ROW LEVEL SECURITY;

-- SELECT policy on message_media: allowed for participants of conversation
CREATE POLICY message_media_select_policy ON public.message_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_media.conversation_id
        AND (c.creator_id = auth.uid() OR c.member_id = auth.uid())
    )
  );

-- media_upload_intents policy
CREATE POLICY media_upload_intents_user_policy ON public.media_upload_intents
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Grants
GRANT SELECT ON public.message_media TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.media_upload_intents TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_media_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_media_storage_health TO authenticated;
