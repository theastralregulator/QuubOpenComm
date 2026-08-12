-- Migration: 202608120001_secure_media_live_compat.sql
-- Description: Follow-up migration for live production compatibility: B2 primary, Cloudinary fallback, strict finalizing_at lease reset, and service-role RPC lockdown.
-- DO NOT APPLY REMOTELY AUTOMATICALLY.

-- 1. Ensure storage_provider checks in media_upload_intents & message_media accept 'b2' and 'cloudinary'
DO $$
BEGIN
  -- Re-check media_upload_intents provider constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'media_upload_intents_provider_check'
  ) THEN
    ALTER TABLE public.media_upload_intents DROP CONSTRAINT media_upload_intents_provider_check;
    ALTER TABLE public.media_upload_intents ADD CONSTRAINT media_upload_intents_provider_check CHECK (provider IN ('r2', 'b2', 'cloudinary'));
  END IF;

  -- Re-check message_media storage_provider constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'message_media_storage_provider_check'
  ) THEN
    ALTER TABLE public.message_media DROP CONSTRAINT message_media_storage_provider_check;
    ALTER TABLE public.message_media ADD CONSTRAINT message_media_storage_provider_check CHECK (storage_provider IN ('r2', 'b2', 'cloudinary'));
  END IF;
END $$;

-- 2. Update claim_media_upload_intent_for_finalize RPC with finalizing_at lease recovery
CREATE OR REPLACE FUNCTION public.claim_media_upload_intent_for_finalize(
  p_intent_id uuid,
  p_user_id uuid,
  p_conversation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.media_upload_intents%ROWTYPE;
  v_stale_threshold timestamptz := now() - interval '5 minutes';
BEGIN
  SELECT * INTO v_intent
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

  IF v_intent.status = 'finalized' THEN
    RETURN jsonb_build_object(
      'status', 'finalized',
      'final_message_id', v_intent.final_message_id,
      'final_media_id', v_intent.final_media_id
    );
  END IF;

  IF v_intent.status = 'finalizing' THEN
    IF v_intent.final_message_id IS NOT NULL AND v_intent.final_media_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'finalized',
        'final_message_id', v_intent.final_message_id,
        'final_media_id', v_intent.final_media_id
      );
    END IF;

    -- Allow claim recovery if finalizing lease has expired (> 5 min)
    IF v_intent.finalizing_at IS NULL OR v_intent.finalizing_at < v_stale_threshold THEN
      UPDATE public.media_upload_intents
      SET status = 'finalizing',
          finalizing_at = now()
      WHERE id = p_intent_id;

      RETURN jsonb_build_object(
        'status', 'claimed',
        'provider', v_intent.provider,
        'object_key', v_intent.object_key,
        'media_type', v_intent.media_type,
        'mime_type', v_intent.mime_type,
        'file_size_bytes', v_intent.file_size_bytes
      );
    END IF;

    RETURN jsonb_build_object('status', 'finalizing_in_progress');
  END IF;

  IF v_intent.status = 'expired' THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_intent.status = 'failed' THEN
    RETURN jsonb_build_object('status', 'failed');
  END IF;

  IF v_intent.status NOT IN ('pending', 'uploaded') THEN
    RETURN jsonb_build_object('status', 'invalid_status', 'actual_status', v_intent.status);
  END IF;

  UPDATE public.media_upload_intents
  SET status = 'finalizing',
      finalizing_at = now()
  WHERE id = p_intent_id;

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

-- 3. Update finalize_media_message_internal RPC to accept b2, cloudinary, and r2
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
  p_original_filename text DEFAULT NULL
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
BEGIN
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

  IF split_part(trim(v_intent.mime_type), ';', 1) <> split_part(trim(p_mime_type), ';', 1) THEN
    RAISE EXCEPTION 'Upload intent mime_type mismatch.';
  END IF;

  IF v_intent.file_size_bytes <> p_file_size_bytes THEN
    RAISE EXCEPTION 'Upload intent file_size_bytes mismatch.';
  END IF;

  IF v_intent.expires_at IS NOT NULL AND v_intent.expires_at <= v_now THEN
    RAISE EXCEPTION 'Upload intent has expired.';
  END IF;

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

  -- Create canonical message record
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

  -- Create media record
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

  -- Update conversation preview
  UPDATE public.conversations
  SET last_message_text = p_preview_text,
      last_message_time = v_now
  WHERE id = p_conversation_id;

  -- Mark intent finalized and clear finalizing_at lease
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

-- 4. Re-enforce strict service-role permissions
REVOKE EXECUTE ON FUNCTION public.claim_media_upload_intent_for_finalize(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_media_upload_intent_for_finalize(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_media_message_internal(uuid, uuid, uuid, text, text, text, text, text, text, bigint, integer, integer, integer, text) TO service_role;
