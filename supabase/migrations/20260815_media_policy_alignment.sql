-- Migration: 20260815_media_policy_alignment.sql
-- Description: Align media policy validation in SQL RPC (Image: 10MB; Audio: 5MB/300s; Video: 50MB/300s)

CREATE OR REPLACE FUNCTION public.finalize_media_message_internal(
  p_user_id uuid,
  p_intent_id uuid,
  p_conversation_id uuid,
  p_provider text,
  p_object_key text,
  p_media_type text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_duration_ms integer DEFAULT NULL,
  p_width integer DEFAULT NULL,
  p_height integer DEFAULT NULL,
  p_original_filename text DEFAULT NULL,
  p_preview_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_member_exists boolean;
  v_conv_archived boolean;
  v_intent RECORD;
  v_message_id uuid;
  v_media_id uuid;
  v_delete_after timestamptz := NULL;
  v_clean_mime text;
BEGIN
  -- Normalize mime type
  v_clean_mime := lower(trim(split_part(p_mime_type, ';', 1)));

  -- 1. Check conversation participation & archive state
  SELECT 
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_id = p_conversation_id AND member_id = p_user_id
    ) OR EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = p_conversation_id AND (creator_id = p_user_id OR member_id = p_user_id)
    ),
    COALESCE(is_archived, false)
  INTO v_member_exists, v_conv_archived
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT COALESCE(v_member_exists, false) THEN
    RAISE EXCEPTION 'Not authorized to send media to this conversation.';
  END IF;

  IF COALESCE(v_conv_archived, false) THEN
    RAISE EXCEPTION 'Cannot send media to an archived conversation.';
  END IF;

  -- 2. Validate Canonical Media Policy Limits
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

  -- 3. Atomic intent verification & claim
  SELECT * INTO v_intent
  FROM public.media_upload_intents
  WHERE id = p_intent_id
    AND user_id = p_user_id
    AND conversation_id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload intent record not found or not owned by user.';
  END IF;

  -- Idempotency check: if intent is ALREADY finalized, return existing message_id & media_id!
  IF v_intent.status = 'finalized' AND v_intent.final_message_id IS NOT NULL THEN
    SELECT id INTO v_media_id FROM public.message_media WHERE message_id = v_intent.final_message_id LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'messageId', v_intent.final_message_id,
      'mediaId', COALESCE(v_media_id, v_intent.final_media_id),
      'idempotent', true
    );
  END IF;

  IF v_intent.status NOT IN ('pending', 'uploaded', 'finalizing') THEN
    RAISE EXCEPTION 'Upload intent is no longer in pending or finalizing state (status: %).', v_intent.status;
  END IF;

  -- Mark intent as finalizing
  UPDATE public.media_upload_intents
  SET status = 'finalizing', finalizing_at = now()
  WHERE id = p_intent_id;

  -- 4. Atomic INSERT of message & message_media records
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    sender_type,
    text,
    message_type,
    created_at
  ) VALUES (
    p_conversation_id,
    p_user_id,
    'user',
    COALESCE(p_preview_text, p_media_type || ' attachment'),
    'media',
    now()
  )
  RETURNING id INTO v_message_id;

  INSERT INTO public.message_media (
    message_id,
    conversation_id,
    sender_id,
    storage_provider,
    object_key,
    media_type,
    mime_type,
    file_size_bytes,
    duration_ms,
    width,
    height,
    original_filename,
    status,
    delete_after,
    created_at
  ) VALUES (
    v_message_id,
    p_conversation_id,
    p_user_id,
    p_provider,
    p_object_key,
    p_media_type,
    v_clean_mime,
    p_file_size_bytes,
    p_duration_ms,
    p_width,
    p_height,
    p_original_filename,
    'active',
    v_delete_after,
    now()
  )
  RETURNING id INTO v_media_id;

  -- Mark intent as finalized
  UPDATE public.media_upload_intents
  SET 
    status = 'finalized',
    final_message_id = v_message_id,
    final_media_id = v_media_id,
    finalizing_at = NULL
  WHERE id = p_intent_id;

  -- Update conversation activity
  UPDATE public.conversations
  SET 
    last_message = COALESCE(p_preview_text, p_media_type || ' attachment'),
    last_message_time = now(),
    updated_at = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'success', true,
    'messageId', v_message_id,
    'mediaId', v_media_id,
    'idempotent', false
  );
END;
$$;
