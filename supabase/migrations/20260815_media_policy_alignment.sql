-- Migration: 20260815_media_policy_alignment.sql
-- Description: Replace media policy alignment RPC using canonical signature and production schema

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.media_upload_intents%ROWTYPE;
  v_message_id uuid;
  v_media_id uuid;
  v_now timestamptz := now();
  v_clean_mime text;
BEGIN
  -- Normalize MIME type
  v_clean_mime := lower(trim(split_part(p_mime_type, ';', 1)));

  -- 1. Validate Canonical Media Policy Limits
  IF p_media_type = 'image' THEN
    IF p_file_size_bytes > 10 * 1024 * 1024 THEN
      RAISE EXCEPTION 'Image file size exceeds 10MB limit.';
    END IF;
    IF v_clean_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
      RAISE EXCEPTION 'Unsupported image format.';
    END IF;
  ELSIF p_media_type = 'audio' THEN
    IF p_file_size_bytes > 5 * 1024 * 1024 THEN
      RAISE EXCEPTION 'Audio file size exceeds 5MB limit.';
    END IF;
    IF p_duration_ms IS NOT NULL AND p_duration_ms > 300000 THEN
      RAISE EXCEPTION 'Audio duration exceeds 5 minute limit.';
    END IF;
    IF v_clean_mime NOT IN ('audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/x-m4a') THEN
      RAISE EXCEPTION 'Unsupported audio format.';
    END IF;
  ELSIF p_media_type = 'video' THEN
    IF p_file_size_bytes > 50 * 1024 * 1024 THEN
      RAISE EXCEPTION 'Video file size exceeds 50MB limit.';
    END IF;
    IF p_duration_ms IS NOT NULL AND p_duration_ms > 300000 THEN
      RAISE EXCEPTION 'Video duration exceeds 5 minute limit.';
    END IF;
    IF v_clean_mime NOT IN ('video/mp4', 'video/webm') THEN
      RAISE EXCEPTION 'Unsupported video format.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported media type.';
  END IF;

  -- 2. Fetch and verify intent record
  SELECT * INTO v_intent
  FROM public.media_upload_intents
  WHERE id = p_upload_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload intent not found.';
  END IF;

  IF v_intent.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Upload intent user mismatch.';
  END IF;

  IF v_intent.conversation_id <> p_conversation_id THEN
    RAISE EXCEPTION 'Upload intent conversation mismatch.';
  END IF;

  IF v_intent.object_key <> p_object_key THEN
    RAISE EXCEPTION 'Upload intent object_key mismatch.';
  END IF;

  IF v_intent.media_type <> p_media_type THEN
    RAISE EXCEPTION 'Upload intent media_type mismatch.';
  END IF;

  IF split_part(trim(v_intent.mime_type), ';', 1) <> v_clean_mime THEN
    RAISE EXCEPTION 'Upload intent mime_type mismatch.';
  END IF;

  IF v_intent.file_size_bytes <> p_file_size_bytes THEN
    RAISE EXCEPTION 'Upload intent file_size_bytes mismatch.';
  END IF;

  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= v_now THEN
    RAISE EXCEPTION 'Upload intent has expired.';
  END IF;

  -- Idempotency check: if intent is ALREADY finalized
  IF v_intent.status = 'finalized' AND v_intent.final_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'message_id', v_intent.final_message_id,
      'media_id', v_intent.final_media_id,
      'status', 'already_finalized'
    );
  END IF;

  IF v_intent.status <> 'finalizing' THEN
    RAISE EXCEPTION 'Upload intent must be in finalizing state to call finalize_media_message_internal.';
  END IF;

  IF p_message_type NOT IN ('image', 'video', 'audio') THEN
    RAISE EXCEPTION 'Invalid message_type.';
  END IF;

  IF p_media_type <> p_message_type THEN
    RAISE EXCEPTION 'Mismatch between media_type and message_type.';
  END IF;

  IF p_storage_provider NOT IN ('b2', 'cloudinary', 'r2') THEN
    RAISE EXCEPTION 'Invalid storage_provider.';
  END IF;

  -- 3. Create canonical message record using production schema columns
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    message_text,
    message_type,
    created_at
  ) VALUES (
    p_conversation_id,
    p_user_id,
    p_preview_text,
    p_message_type,
    v_now
  ) RETURNING id INTO v_message_id;

  -- 4. Create media record using production schema columns
  INSERT INTO public.message_media (
    message_id,
    conversation_id,
    uploader_id,
    upload_intent_id,
    media_type,
    storage_provider,
    object_key,
    mime_type,
    file_size_bytes,
    duration_ms,
    width,
    height,
    original_filename,
    status,
    created_at
  ) VALUES (
    v_message_id,
    p_conversation_id,
    p_user_id,
    p_upload_intent_id,
    p_media_type,
    p_storage_provider,
    p_object_key,
    p_mime_type,
    p_file_size_bytes,
    p_duration_ms,
    p_width,
    p_height,
    p_original_filename,
    'active',
    v_now
  ) RETURNING id INTO v_media_id;

  -- 5. Update conversation preview using production schema columns
  UPDATE public.conversations
  SET last_message_text = p_preview_text,
      last_message_time = v_now
  WHERE id = p_conversation_id;

  -- 6. Mark intent finalized and clear finalizing_at lease
  UPDATE public.media_upload_intents
  SET status = 'finalized',
      finalizing_at = NULL,
      final_message_id = v_message_id,
      final_media_id = v_media_id
  WHERE id = p_upload_intent_id;

  RETURN jsonb_build_object(
    'message_id', v_message_id,
    'media_id', v_media_id,
    'status', 'finalized'
  );
END;
$$;

-- Strict service-role permissions lockdown
REVOKE EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) TO service_role;
