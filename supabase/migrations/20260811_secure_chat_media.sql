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

-- 2. Create public.media_upload_intents table
CREATE TABLE IF NOT EXISTS public.media_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('r2', 'b2', 'cloudinary')),
  object_key text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'finalizing', 'finalized', 'expired', 'failed')),
  final_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  final_media_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- 3. Create public.message_media table with UNIQUE upload_intent_id
CREATE TABLE IF NOT EXISTS public.message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id),
  upload_intent_id uuid NULL REFERENCES public.media_upload_intents(id) ON DELETE SET NULL,
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
  CONSTRAINT message_media_message_id_key UNIQUE (message_id),
  CONSTRAINT message_media_upload_intent_id_key UNIQUE (upload_intent_id)
);

-- Add Foreign Key for final_media_id now that message_media table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'media_upload_intents_final_media_id_fkey'
  ) THEN
    ALTER TABLE public.media_upload_intents
    ADD CONSTRAINT media_upload_intents_final_media_id_fkey
    FOREIGN KEY (final_media_id) REFERENCES public.message_media(id) ON DELETE SET NULL;
  END IF;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_message_media_upload_intent_id ON public.message_media(upload_intent_id);
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
  IF NEW.archived_at IS NOT NULL AND (OLD.archived_at IS NULL OR OLD.archived_at IS DISTINCT FROM NEW.archived_at) THEN
    UPDATE public.message_media
    SET delete_after = NEW.archived_at + interval '15 days'
    WHERE conversation_id = NEW.id
      AND status = 'active';
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

-- 7. Server-Only Intent Claiming RPC with Strict State Validation & Guarded Transitions
CREATE OR REPLACE FUNCTION public.claim_media_upload_intent_for_finalize(
  p_intent_id uuid,
  p_user_id uuid,
  p_conversation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_intent RECORD;
BEGIN
  -- Atomic row lock on upload intent
  SELECT id, user_id, conversation_id, provider, object_key, media_type, mime_type, file_size_bytes, status, expires_at, final_message_id, final_media_id
  INTO v_intent
  FROM public.media_upload_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_intent.user_id <> p_user_id THEN
    RETURN jsonb_build_object('status', 'user_mismatch');
  END IF;

  IF v_intent.conversation_id <> p_conversation_id THEN
    RETURN jsonb_build_object('status', 'conversation_mismatch');
  END IF;

  -- 1. If finalized (or finalizing with final IDs), return existing message/media IDs (Idempotent response)
  IF (v_intent.status = 'finalized' OR v_intent.status = 'finalizing') AND v_intent.final_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'finalized',
      'final_message_id', v_intent.final_message_id,
      'final_media_id', v_intent.final_media_id,
      'provider', v_intent.provider,
      'object_key', v_intent.object_key,
      'media_type', v_intent.media_type,
      'mime_type', v_intent.mime_type,
      'file_size_bytes', v_intent.file_size_bytes
    );
  END IF;

  -- 2. If finalizing without final IDs, return finalizing_in_progress
  IF v_intent.status = 'finalizing' THEN
    RETURN jsonb_build_object('status', 'finalizing_in_progress');
  END IF;

  -- 3. Explicit State Validation: Reject expired, failed, or unexpected states
  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_intent.status = 'expired' THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_intent.status = 'failed' THEN
    RETURN jsonb_build_object('status', 'failed');
  END IF;

  IF v_intent.status NOT IN ('pending', 'uploaded') THEN
    RETURN jsonb_build_object('status', 'invalid_status', 'current_status', v_intent.status);
  END IF;

  -- 4. Guarded transition ONLY from pending/uploaded to finalizing
  UPDATE public.media_upload_intents
  SET status = 'finalizing'
  WHERE id = p_intent_id
    AND status IN ('pending', 'uploaded');

  RETURN jsonb_build_object(
    'status', 'claimed',
    'provider', v_intent.provider,
    'object_key', v_intent.object_key,
    'media_type', v_intent.media_type,
    'mime_type', v_intent.mime_type,
    'file_size_bytes', v_intent.file_size_bytes
  );
END;
$$;

-- 8. Server-Only Atomic Database Finalization RPC (EXECUTABLE ONLY BY service_role)
CREATE OR REPLACE FUNCTION public.finalize_media_message_internal(
  p_user_id uuid,
  p_upload_intent_id uuid,
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
  v_sender_name text;
  v_sender_avatar text;
  v_user_status text;
  v_conv RECORD;
  v_intent RECORD;
  v_msg_id uuid;
  v_media_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required.';
  END IF;

  IF p_upload_intent_id IS NULL THEN
    RAISE EXCEPTION 'Upload intent is required.';
  END IF;

  -- Enforce active account for p_user_id
  SELECT account_status INTO v_user_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'User account is inactive or suspended.';
  END IF;

  -- Lock and fetch canonical upload intent row
  SELECT id, user_id, conversation_id, provider, object_key, media_type, mime_type, file_size_bytes, status, expires_at, final_message_id, final_media_id
  INTO v_intent
  FROM public.media_upload_intents
  WHERE id = p_upload_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload intent not found.';
  END IF;

  -- Strict Binding & Validation against Canonical Intent Metadata
  IF v_intent.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Upload intent ownership mismatch.';
  END IF;

  IF v_intent.conversation_id <> p_conversation_id THEN
    RAISE EXCEPTION 'Upload intent conversation mismatch.';
  END IF;

  IF v_intent.provider <> p_storage_provider THEN
    RAISE EXCEPTION 'Upload intent provider mismatch.';
  END IF;

  IF v_intent.object_key <> p_object_key THEN
    RAISE EXCEPTION 'Upload intent object_key mismatch.';
  END IF;

  IF v_intent.media_type <> p_media_type THEN
    RAISE EXCEPTION 'Upload intent media_type mismatch.';
  END IF;

  IF split_part(trim(v_intent.mime_type), ';', 1) <> split_part(trim(p_mime_type), ';', 1) THEN
    RAISE EXCEPTION 'Upload intent mime_type mismatch.';
  END IF;

  IF v_intent.file_size_bytes <> p_file_size_bytes THEN
    RAISE EXCEPTION 'Upload intent file_size_bytes mismatch.';
  END IF;

  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= now() THEN
    RAISE EXCEPTION 'Upload intent has expired.';
  END IF;

  -- State Flow Validation
  IF v_intent.status = 'finalized' AND v_intent.final_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'message_id', v_intent.final_message_id,
      'media_id', v_intent.final_media_id,
      'idempotent', true
    );
  END IF;

  IF v_intent.status NOT IN ('finalizing', 'finalized') THEN
    IF v_intent.status IN ('pending', 'uploaded') THEN
      RAISE EXCEPTION 'Upload intent must be claimed and verified before finalization.';
    ELSE
      RAISE EXCEPTION 'Upload intent is in an invalid state (%).', v_intent.status;
    END IF;
  END IF;

  -- Media-Type & Storage Provider Validations
  IF p_message_type NOT IN ('image', 'video', 'audio') THEN
    RAISE EXCEPTION 'Invalid message_type.';
  END IF;

  IF p_media_type <> p_message_type THEN
    RAISE EXCEPTION 'Mismatch between media_type and message_type.';
  END IF;

  IF p_storage_provider NOT IN ('r2', 'b2') THEN
    RAISE EXCEPTION 'Invalid storage_provider.';
  END IF;

  IF p_object_key IS NULL OR length(trim(p_object_key)) = 0 OR length(p_object_key) > 512 THEN
    RAISE EXCEPTION 'Invalid object_key length.';
  END IF;

  IF p_file_size_bytes IS NULL OR p_file_size_bytes <= 0 THEN
    RAISE EXCEPTION 'File size must be positive.';
  END IF;

  IF p_duration_ms IS NOT NULL AND p_duration_ms < 0 THEN
    RAISE EXCEPTION 'Duration cannot be negative.';
  END IF;

  IF p_width IS NOT NULL AND (p_width <= 0 OR p_width > 10000) THEN
    RAISE EXCEPTION 'Invalid image/video width.';
  END IF;

  IF p_height IS NOT NULL AND (p_height <= 0 OR p_height > 10000) THEN
    RAISE EXCEPTION 'Invalid image/video height.';
  END IF;

  -- Audio Specific Validation (Max 10MB, Max 5 min duration, exact preview mapping)
  IF p_media_type = 'audio' THEN
    IF p_mime_type NOT IN ('audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/aac') THEN
      RAISE EXCEPTION 'Unsupported audio MIME type.';
    END IF;
    IF p_file_size_bytes > 10485760 THEN
      RAISE EXCEPTION 'Audio exceeds maximum size limit of 10MB.';
    END IF;
    IF p_duration_ms IS NOT NULL AND p_duration_ms > 300000 THEN
      RAISE EXCEPTION 'Voice note exceeds maximum duration limit of 5 minutes.';
    END IF;
    IF p_preview_text <> 'Voice message' THEN
      RAISE EXCEPTION 'Invalid preview_text for audio media.';
    END IF;
  END IF;

  -- Image Specific Validation (Max 10MB, exact preview mapping, JPEG/PNG/WEBP only - reject SVG & GIF)
  IF p_media_type = 'image' THEN
    IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
      RAISE EXCEPTION 'Unsupported image MIME type. Only JPEG, PNG, and WEBP are permitted.';
    END IF;
    IF p_file_size_bytes > 10485760 THEN
      RAISE EXCEPTION 'Image exceeds maximum size limit of 10MB.';
    END IF;
    IF p_preview_text <> 'Photo' THEN
      RAISE EXCEPTION 'Invalid preview_text for image media.';
    END IF;
  END IF;

  -- Video Specific Validation (Max 50MB, Max 5 min duration, exact preview mapping)
  IF p_media_type = 'video' THEN
    IF p_mime_type NOT IN ('video/mp4', 'video/webm') THEN
      RAISE EXCEPTION 'Unsupported video MIME type. Only MP4 and WebM are permitted.';
    END IF;
    IF p_file_size_bytes > 52428800 THEN
      RAISE EXCEPTION 'Video exceeds maximum size limit of 50MB.';
    END IF;
    IF p_duration_ms IS NOT NULL AND p_duration_ms > 300000 THEN
      RAISE EXCEPTION 'Video exceeds maximum duration limit of 5 minutes.';
    END IF;
    IF p_preview_text <> 'Video' THEN
      RAISE EXCEPTION 'Invalid preview_text for video media.';
    END IF;
  END IF;

  -- Check conversation authorization (supports creator_id, member_id, conversation_members)
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

  IF v_conv.creator_id <> p_user_id
     AND v_conv.member_id <> p_user_id
     AND NOT EXISTS (
       SELECT 1 FROM public.conversation_members cm
       WHERE cm.conversation_id = p_conversation_id AND cm.user_id = p_user_id
     ) THEN
    RAISE EXCEPTION 'Not authorized to send messages in this conversation.';
  END IF;

  -- Get sender profile info from profile_directory
  SELECT COALESCE(full_name, username, 'OpenComm User'), avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profile_directory
  WHERE id = p_user_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'OpenComm User';
  END IF;

  -- 1. Insert into messages table
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
    p_user_id,
    v_sender_name,
    v_sender_avatar,
    p_preview_text,
    p_message_type,
    true,
    'user',
    now()
  )
  RETURNING id INTO v_msg_id;

  -- 2. Insert into message_media table with UNIQUE upload_intent_id link
  INSERT INTO public.message_media (
    message_id,
    conversation_id,
    uploader_id,
    upload_intent_id,
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
    p_user_id,
    p_upload_intent_id,
    p_media_type,
    p_storage_provider,
    p_object_key,
    p_provider_asset_id,
    p_mime_type,
    p_file_size_bytes,
    p_duration_ms,
    p_width,
    p_height,
    substring(trim(p_original_filename) from 1 for 255),
    'active',
    now()
  )
  RETURNING id INTO v_media_id;

  -- 3. Update upload_intent to finalized atomically in the SAME transaction!
  UPDATE public.media_upload_intents
  SET status = 'finalized',
      final_message_id = v_msg_id,
      final_media_id = v_media_id
  WHERE id = p_upload_intent_id;

  -- 4. Update last message info on conversation using canonical column names
  UPDATE public.conversations
  SET last_message_text = p_preview_text,
      last_message_time = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'message_id', v_msg_id,
    'media_id', v_media_id
  );
END;
$$;

-- 9. SECURITY DEFINER RPC to get sanitized media metadata without exposing object_key or upload_intent_id
CREATE OR REPLACE FUNCTION public.get_conversation_message_media(p_conversation_id uuid)
RETURNS TABLE (
  id uuid,
  message_id uuid,
  conversation_id uuid,
  media_type text,
  mime_type text,
  file_size_bytes bigint,
  duration_ms integer,
  width integer,
  height integer,
  status text,
  created_at timestamptz,
  delete_after timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND (
        c.creator_id = auth.uid()
        OR c.member_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to view media for this conversation.';
  END IF;

  RETURN QUERY
  SELECT
    mm.id,
    mm.message_id,
    mm.conversation_id,
    mm.media_type,
    mm.mime_type,
    mm.file_size_bytes,
    mm.duration_ms,
    mm.width,
    mm.height,
    mm.status,
    mm.created_at,
    mm.delete_after
  FROM public.message_media mm
  WHERE mm.conversation_id = p_conversation_id;
END;
$$;

-- 10. Atomic Claim RPC for Concurrency Safety in Cleanup Worker (Clamped Limit)
CREATE OR REPLACE FUNCTION public.claim_due_media_for_cleanup(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  storage_provider text,
  object_key text,
  media_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_effective_limit integer;
BEGIN
  v_effective_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 100));

  RETURN QUERY
  WITH target_rows AS (
    SELECT mm.id
    FROM public.message_media mm
    WHERE mm.status IN ('active', 'cleanup_pending')
      AND mm.delete_after IS NOT NULL
      AND mm.delete_after <= now()
    ORDER BY mm.delete_after ASC
    LIMIT v_effective_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.message_media mm
  SET status = 'cleanup_pending',
      last_cleanup_attempt_at = now()
  FROM target_rows
  WHERE mm.id = target_rows.id
  RETURNING mm.id, mm.storage_provider, mm.object_key, mm.media_type;
END;
$$;

-- 11. Telemetry 30-Day Cleanup RPC
CREATE OR REPLACE FUNCTION public.cleanup_old_media_storage_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.media_storage_events
  WHERE created_at < (now() - interval '30 days');
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- 12. Admin Media Health RPC (Uses canonical public.get_admin_role())
CREATE OR REPLACE FUNCTION public.admin_get_media_storage_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_active_count bigint;
  v_cleanup_pending bigint;
  v_cleanup_overdue bigint;
  v_deleted_count bigint;
  v_orphan_intents bigint;
  v_events_24h jsonb;
BEGIN
  v_caller_role := public.get_admin_role();
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'system_admin', 'moderator', 'support_agent') THEN
    RAISE EXCEPTION 'Admin authorization required.';
  END IF;

  SELECT count(*) INTO v_active_count FROM public.message_media WHERE status = 'active';
  SELECT count(*) INTO v_cleanup_pending FROM public.message_media WHERE status = 'cleanup_pending';
  SELECT count(*) INTO v_cleanup_overdue FROM public.message_media WHERE status IN ('active', 'cleanup_pending') AND delete_after IS NOT NULL AND delete_after <= now();
  SELECT count(*) INTO v_deleted_count FROM public.message_media WHERE status = 'deleted';
  SELECT count(*) INTO v_orphan_intents FROM public.media_upload_intents WHERE status = 'pending' AND expires_at <= now();

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

-- 13. RLS Lockdown & Strict Function Revokes
ALTER TABLE public.message_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_storage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.message_media FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS message_media_select_policy ON public.message_media;

DROP POLICY IF EXISTS media_upload_intents_select_policy ON public.media_upload_intents;
CREATE POLICY media_upload_intents_select_policy ON public.media_upload_intents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Requirement 1: REVOKE direct execution on internal finalization & intent claim from PUBLIC, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_media_upload_intent_for_finalize(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_media_for_cleanup(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_media_storage_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_conversation_message_media(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_media_storage_health() FROM PUBLIC, anon;

-- Grants: ONLY service_role can execute internal finalization and claim RPCs
GRANT EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_media_upload_intent_for_finalize(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_media_for_cleanup(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_media_storage_events() TO service_role;

-- Grants: Authenticated users can only read upload intents, read sanitized media, and call admin health (if admin)
GRANT SELECT ON public.media_upload_intents TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conversation_message_media(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_media_storage_health() TO authenticated;
