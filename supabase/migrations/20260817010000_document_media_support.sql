-- Migration: 20260817010000_document_media_support.sql
-- Description: Extend public.finalize_media_message_internal RPC to support secure document attachments (PDF, DOC/X, XLS/X, PPT/X, TXT, CSV up to 20MB) while preserving 100% production schema compatibility.
-- DO NOT APPLY TO PRODUCTION AUTOMATICALLY. MANUAL REVIEW REQUIRED FIRST.

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
  v_clean_mime text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required.';
  END IF;

  IF p_upload_intent_id IS NULL THEN
    RAISE EXCEPTION 'Upload intent is required.';
  END IF;

  -- 1. Enforce active account for p_user_id
  SELECT account_status INTO v_user_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'User account is inactive or suspended.';
  END IF;

  -- 2. Lock and fetch canonical upload intent row
  SELECT id, user_id, conversation_id, provider, object_key, media_type, mime_type, file_size_bytes, status, expires_at, final_message_id, final_media_id
  INTO v_intent
  FROM public.media_upload_intents
  WHERE id = p_upload_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Upload intent not found.';
  END IF;

  -- 3. Strict Binding & Validation against Canonical Intent Metadata
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

  v_clean_mime := lower(trim(split_part(p_mime_type, ';', 1)));

  IF split_part(trim(v_intent.mime_type), ';', 1) <> v_clean_mime THEN
    RAISE EXCEPTION 'Upload intent mime_type mismatch.';
  END IF;

  IF v_intent.file_size_bytes <> p_file_size_bytes THEN
    RAISE EXCEPTION 'Upload intent file_size_bytes mismatch.';
  END IF;

  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= now() THEN
    RAISE EXCEPTION 'Upload intent has expired.';
  END IF;

  -- 4. State Flow & Idempotency Validation
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

  -- 5. Media-Type & Storage Provider General Validations
  IF p_message_type NOT IN ('image', 'video', 'audio', 'document') THEN
    RAISE EXCEPTION 'Invalid message_type.';
  END IF;

  IF p_media_type <> p_message_type THEN
    RAISE EXCEPTION 'Mismatch between media_type and message_type.';
  END IF;

  IF p_storage_provider NOT IN ('b2', 'cloudinary', 'r2') THEN
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

  -- 6. Canonical Media Policy Validations
  -- Audio: Max 5MB (5242880 bytes), Max 5 min (300000 ms), preview_text = 'Voice message'
  IF p_media_type = 'audio' THEN
    IF v_clean_mime NOT IN ('audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac') THEN
      RAISE EXCEPTION 'Unsupported audio MIME type.';
    END IF;
    IF p_file_size_bytes > 5242880 THEN
      RAISE EXCEPTION 'Audio exceeds maximum size limit of 5MB.';
    END IF;
    IF p_duration_ms IS NOT NULL AND p_duration_ms > 300000 THEN
      RAISE EXCEPTION 'Voice note exceeds maximum duration limit of 5 minutes.';
    END IF;
    IF p_preview_text <> 'Voice message' THEN
      RAISE EXCEPTION 'Invalid preview_text for audio media.';
    END IF;
  END IF;

  -- Image: Max 10MB (10485760 bytes), preview_text = 'Photo', JPEG/PNG/WEBP/GIF permitted
  IF p_media_type = 'image' THEN
    IF v_clean_mime NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
      RAISE EXCEPTION 'Unsupported image MIME type. Only JPEG, PNG, WEBP, and GIF are permitted.';
    END IF;
    IF p_file_size_bytes > 10485760 THEN
      RAISE EXCEPTION 'Image exceeds maximum size limit of 10MB.';
    END IF;
    IF p_preview_text <> 'Photo' THEN
      RAISE EXCEPTION 'Invalid preview_text for image media.';
    END IF;
  END IF;

  -- Video: Max 50MB (52428800 bytes), Max 5 min (300000 ms), preview_text = 'Video', MP4/WebM permitted
  IF p_media_type = 'video' THEN
    IF v_clean_mime NOT IN ('video/mp4', 'video/webm') THEN
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

  -- Document: Max 20MB (20971520 bytes), preview_text = 'Document', PDF/DOC/DOCX/XLS/XLSX/PPT/PPTX/TXT/CSV permitted
  IF p_media_type = 'document' THEN
    IF v_clean_mime NOT IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv'
    ) THEN
      RAISE EXCEPTION 'Unsupported document MIME type.';
    END IF;
    IF p_file_size_bytes > 20971520 THEN
      RAISE EXCEPTION 'Document exceeds maximum size limit of 20MB.';
    END IF;
    IF p_duration_ms IS NOT NULL THEN
      RAISE EXCEPTION 'Document cannot have a duration.';
    END IF;
    IF p_width IS NOT NULL OR p_height IS NOT NULL THEN
      RAISE EXCEPTION 'Document cannot have width or height dimensions.';
    END IF;
    IF p_preview_text <> 'Document' THEN
      RAISE EXCEPTION 'Invalid preview_text for document media.';
    END IF;
  END IF;

  -- 7. Check conversation authorization (supports creator_id, member_id, conversation_members)
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

  -- 8. Fetch sender profile metadata from profile_directory
  SELECT COALESCE(full_name, username, 'OpenComm User'), avatar_url
  INTO v_sender_name, v_sender_avatar
  FROM public.profile_directory
  WHERE id = p_user_id;

  IF v_sender_name IS NULL THEN
    v_sender_name := 'OpenComm User';
  END IF;

  -- 9. Insert into messages table using exact production schema columns
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

  -- 10. Insert into message_media table using exact production schema columns
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

  -- 11. Update conversation preview using production schema columns
  UPDATE public.conversations
  SET last_message_text = p_preview_text,
      last_message_time = now()
  WHERE id = p_conversation_id;

  -- 12. Mark upload intent finalized and clear finalizing_at lease
  UPDATE public.media_upload_intents
  SET status = 'finalized',
      finalizing_at = NULL,
      final_message_id = v_msg_id,
      final_media_id = v_media_id
  WHERE id = p_upload_intent_id;

  RETURN jsonb_build_object(
    'message_id', v_msg_id,
    'media_id', v_media_id,
    'idempotent', false
  );
END;
$$;

-- 13. Re-enforce strict service-role permissions lockdown
REVOKE EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text, text) TO service_role;
