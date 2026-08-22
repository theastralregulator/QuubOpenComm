-- Migration: 20260822010000_negotiation_chat_feature_parity.sql
-- Description: Negotiation chat feature parity upgrade (Reply, Soft Delete, Reactions, Media, Read Status, RPCs, Security Definer Helpers).
-- DO NOT APPLY TO PRODUCTION AUTOMATICALLY. MANUAL REVIEW REQUIRED FIRST.

BEGIN;

-- 1. Extend public.negotiation_messages schema safely with historical unread backfill
ALTER TABLE public.negotiation_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.negotiation_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS unread boolean NULL,
  ADD COLUMN IF NOT EXISTS media_type text NULL,
  ADD COLUMN IF NOT EXISTS media_path text NULL,
  ADD COLUMN IF NOT EXISTS media_url text NULL,
  ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

-- Backfill existing negotiation messages safely
UPDATE public.negotiation_messages SET unread = false WHERE unread IS NULL;
UPDATE public.negotiation_messages SET read_at = COALESCE(read_at, created_at) WHERE sender_id IS NOT NULL AND read_at IS NULL;

-- Set defaults and NOT NULL constraint after backfill
ALTER TABLE public.negotiation_messages ALTER COLUMN unread SET DEFAULT true;
ALTER TABLE public.negotiation_messages ALTER COLUMN unread SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_negotiation_messages_reply_to ON public.negotiation_messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_deleted ON public.negotiation_messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- Safely extend message_type check constraint on public.negotiation_messages
DO $$ 
DECLARE
  con_record record;
BEGIN
  FOR con_record IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.negotiation_messages'::regclass AND contype = 'c'
  LOOP
    IF pg_get_constraintdef(con_record.conname::regclass) LIKE '%message_type%' THEN
      EXECUTE 'ALTER TABLE public.negotiation_messages DROP CONSTRAINT ' || quote_ident(con_record.conname);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.negotiation_messages 
  ADD CONSTRAINT negotiation_messages_type_check 
  CHECK (message_type IN ('text', 'system', 'proposal_event', 'status_event', 'image', 'video', 'audio', 'document'));

-- Direct Privilege Hardening on negotiation_messages
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.negotiation_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.negotiation_messages TO authenticated;

-- Trigger to ensure system/workflow messages are never unread
CREATE OR REPLACE FUNCTION public.trg_negotiation_system_messages_unread_false()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.message_type IN ('system', 'proposal_event', 'status_event') THEN
    NEW.unread := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_negotiation_system_messages_unread ON public.negotiation_messages;
CREATE TRIGGER trg_negotiation_system_messages_unread
  BEFORE INSERT OR UPDATE ON public.negotiation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_negotiation_system_messages_unread_false();

-- 2. Create public.negotiation_message_reactions table
CREATE TABLE IF NOT EXISTS public.negotiation_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.negotiation_messages(id) ON DELETE CASCADE,
  negotiation_room_id uuid NOT NULL REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT negotiation_message_reactions_user_message_key UNIQUE (message_id, user_id),
  CONSTRAINT negotiation_message_reactions_emoji_check CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏'))
);

CREATE INDEX IF NOT EXISTS idx_negotiation_reactions_room ON public.negotiation_message_reactions(negotiation_room_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_reactions_msg ON public.negotiation_message_reactions(message_id);

ALTER TABLE public.negotiation_message_reactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.negotiation_message_reactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.negotiation_message_reactions TO authenticated;

DROP POLICY IF EXISTS "Participants can view negotiation message reactions" ON public.negotiation_message_reactions;
CREATE POLICY "Participants can view negotiation message reactions"
  ON public.negotiation_message_reactions
  FOR SELECT TO authenticated
  USING (public.can_current_user_access_negotiation_room(negotiation_room_id, false));

-- Ensure negotiation_message_reactions is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'negotiation_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_message_reactions;
  END IF;
END $$;

-- 3. Create public.negotiation_media_upload_intents table
CREATE TABLE IF NOT EXISTS public.negotiation_media_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  negotiation_room_id uuid NOT NULL REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE,
  provider text NOT NULL,
  object_key text NOT NULL,
  media_type text NOT NULL,
  mime_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'finalizing', 'finalized', 'failed', 'expired')),
  expires_at timestamptz NOT NULL,
  reply_to_message_id uuid NULL REFERENCES public.negotiation_messages(id) ON DELETE SET NULL,
  finalizing_at timestamptz NULL,
  final_message_id uuid NULL REFERENCES public.negotiation_messages(id) ON DELETE SET NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_media_intents_room ON public.negotiation_media_upload_intents(negotiation_room_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_media_intents_user ON public.negotiation_media_upload_intents(user_id);

ALTER TABLE public.negotiation_media_upload_intents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.negotiation_media_upload_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.negotiation_media_upload_intents TO authenticated;

-- 4. Helper Function: Check if auth.uid() can access negotiation room
CREATE OR REPLACE FUNCTION public.can_current_user_access_negotiation_room(
  p_room_id uuid,
  p_require_active boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room RECORD;
BEGIN
  IF v_uid IS NULL OR p_room_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT client_id, worker_id, status INTO v_room
  FROM public.negotiation_rooms
  WHERE id = p_room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_require_active AND v_room.status <> 'active' THEN
    RETURN false;
  END IF;

  IF v_room.client_id = v_uid OR v_room.worker_id = v_uid THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_current_user_access_negotiation_room(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_access_negotiation_room(uuid, boolean) TO authenticated;

-- 5. Helper Function: Check topic authorization for realtime topic
CREATE OR REPLACE FUNCTION public.can_current_user_access_negotiation_topic(
  p_topic text,
  p_require_active boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_room_id text;
BEGIN
  IF p_topic IS NULL THEN
    RETURN false;
  END IF;

  IF p_topic LIKE 'negotiation:%' THEN
    v_room_id := substring(p_topic from 13);
  ELSIF p_topic LIKE 'hire_negotiation_%' THEN
    v_room_id := substring(p_topic from 18);
  ELSIF p_topic LIKE 'opencomm:negotiation:%' THEN
    v_room_id := substring(p_topic from 22);
  ELSE
    v_room_id := p_topic;
  END IF;

  BEGIN
    RETURN public.can_current_user_access_negotiation_room(v_room_id::uuid, p_require_active);
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.can_current_user_access_negotiation_topic(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_current_user_access_negotiation_topic(text, boolean) TO authenticated;

-- 6. Private Realtime Topic Auth Policies on realtime.messages
-- DO NOT RUN: ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY
DROP POLICY IF EXISTS "negotiation_broadcast_presence_insert" ON realtime.messages;
CREATE POLICY "negotiation_broadcast_presence_insert"
  ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    extension IN ('broadcast', 'presence')
    AND public.can_current_user_access_negotiation_topic(realtime.topic(), true)
  );

DROP POLICY IF EXISTS "negotiation_broadcast_presence_select" ON realtime.messages;
CREATE POLICY "negotiation_broadcast_presence_select"
  ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    extension IN ('broadcast', 'presence')
    AND public.can_current_user_access_negotiation_topic(realtime.topic(), false)
  );

-- 7. Trigger Function: Validate negotiation reply target
CREATE OR REPLACE FUNCTION public.validate_negotiation_message_reply_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.negotiation_messages%ROWTYPE;
BEGIN
  IF NEW.reply_to_message_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM public.negotiation_messages
    WHERE id = NEW.reply_to_message_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target negotiation message does not exist.';
    END IF;

    IF v_target.negotiation_room_id <> NEW.negotiation_room_id THEN
      RAISE EXCEPTION 'Reply target message belongs to a different negotiation room.';
    END IF;

    IF v_target.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a deleted negotiation message.';
    END IF;

    IF v_target.message_type IN ('system', 'proposal_event', 'status_event') THEN
      RAISE EXCEPTION 'Cannot reply to a system or workflow event message.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_negotiation_message_reply_target ON public.negotiation_messages;
CREATE TRIGGER trg_validate_negotiation_message_reply_target
  BEFORE INSERT OR UPDATE OF reply_to_message_id ON public.negotiation_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_negotiation_message_reply_target();

-- 8. RPC: Secure text send & reply for Negotiation Chat V2
CREATE OR REPLACE FUNCTION public.send_negotiation_message_v2(
  p_room_id uuid,
  p_text text,
  p_reply_to_message_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean_text text;
  v_target public.negotiation_messages%ROWTYPE;
  v_msg_id uuid;
  v_created_at timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_text := trim(p_text);
  IF v_clean_text IS NULL OR length(v_clean_text) = 0 THEN
    RAISE EXCEPTION 'Message text cannot be empty.';
  END IF;

  IF length(v_clean_text) > 5000 THEN
    RAISE EXCEPTION 'Message text exceeds maximum 5000 character limit.';
  END IF;

  IF NOT public.can_current_user_access_negotiation_room(p_room_id, true) THEN
    RAISE EXCEPTION 'Cannot send messages to a locked or unauthorized negotiation room.';
  END IF;

  IF p_reply_to_message_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM public.negotiation_messages
    WHERE id = p_reply_to_message_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target message does not exist.';
    END IF;

    IF v_target.negotiation_room_id <> p_room_id THEN
      RAISE EXCEPTION 'Reply target message belongs to a different negotiation room.';
    END IF;

    IF v_target.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a deleted negotiation message.';
    END IF;

    IF v_target.message_type IN ('system', 'proposal_event', 'status_event') THEN
      RAISE EXCEPTION 'Cannot reply to a system or workflow event message.';
    END IF;
  END IF;

  INSERT INTO public.negotiation_messages (
    negotiation_room_id,
    sender_id,
    text,
    reply_to_message_id,
    unread,
    message_type,
    role
  ) VALUES (
    p_room_id,
    v_uid,
    v_clean_text,
    p_reply_to_message_id,
    true,
    'text',
    'user'
  )
  RETURNING id, created_at INTO v_msg_id, v_created_at;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_msg_id,
    'created_at', v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_negotiation_message_v2(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_negotiation_message_v2(uuid, text, uuid) TO authenticated;

-- 9. RPC: Mark negotiation room messages as read
CREATE OR REPLACE FUNCTION public.mark_negotiation_room_read(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_room_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_current_user_access_negotiation_room(p_room_id, false) THEN
    RAISE EXCEPTION 'Unauthorized for negotiation room';
  END IF;

  UPDATE public.negotiation_messages
  SET unread = false,
      read_at = COALESCE(read_at, now())
  WHERE negotiation_room_id = p_room_id
    AND sender_id <> v_uid
    AND unread = true;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_negotiation_room_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_negotiation_room_read(uuid) TO authenticated;

-- 10. RPC: Toggle negotiation message reaction
CREATE OR REPLACE FUNCTION public.toggle_negotiation_message_reaction(
  p_message_id uuid,
  p_room_id uuid,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_msg public.negotiation_messages%ROWTYPE;
  v_existing_id uuid;
  v_existing_emoji text;
  v_action text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_emoji NOT IN ('👍', '❤️', '😂', '😮', '😢', '🙏') THEN
    RAISE EXCEPTION 'Invalid emoji selection.';
  END IF;

  -- 1. Validate participant & active room
  IF NOT public.can_current_user_access_negotiation_room(p_room_id, true) THEN
    RAISE EXCEPTION 'Cannot toggle reactions in a locked or unauthorized negotiation room.';
  END IF;

  -- 2. Validate message target BEFORE checking or deleting/inserting reaction
  SELECT * INTO v_msg
  FROM public.negotiation_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target negotiation message does not exist.';
  END IF;

  IF v_msg.negotiation_room_id <> p_room_id THEN
    RAISE EXCEPTION 'Reaction room_id mismatch with target message room.';
  END IF;

  IF v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot react to a deleted negotiation message.';
  END IF;

  IF v_msg.message_type IN ('system', 'proposal_event', 'status_event') THEN
    RAISE EXCEPTION 'Reactions are permitted only on normal user negotiation messages.';
  END IF;

  SELECT id, emoji INTO v_existing_id, v_existing_emoji
  FROM public.negotiation_message_reactions
  WHERE message_id = p_message_id AND user_id = v_uid;

  IF FOUND THEN
    IF v_existing_emoji = p_emoji THEN
      DELETE FROM public.negotiation_message_reactions WHERE id = v_existing_id;
      v_action := 'removed';
    ELSE
      UPDATE public.negotiation_message_reactions
      SET emoji = p_emoji, updated_at = now()
      WHERE id = v_existing_id;
      v_action := 'updated';
    END IF;
  ELSE
    INSERT INTO public.negotiation_message_reactions (message_id, negotiation_room_id, user_id, emoji)
    VALUES (p_message_id, p_room_id, v_uid, p_emoji);
    v_action := 'added';
  END IF;

  RETURN jsonb_build_object('success', true, 'action', v_action, 'message_id', p_message_id, 'emoji', p_emoji);
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_negotiation_message_reaction(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_negotiation_message_reaction(uuid, uuid, text) TO authenticated;

-- 11. SERVER-ONLY RPC: Soft-delete negotiation message
CREATE OR REPLACE FUNCTION public.delete_negotiation_message_internal(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg public.negotiation_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg
  FROM public.negotiation_messages
  WHERE id = p_message_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found');
  END IF;

  IF v_msg.sender_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only sender can delete message');
  END IF;

  IF v_msg.message_type IN ('system', 'proposal_event', 'status_event') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workflow messages cannot be deleted');
  END IF;

  UPDATE public.negotiation_messages
  SET deleted_at = now(),
      deleted_by = p_user_id,
      text = 'This message was deleted'
  WHERE id = p_message_id;

  RETURN jsonb_build_object('success', true, 'message_id', p_message_id);
END;
$$;

-- CRITICAL AUTHORIZATION FIX: REVOKE EXECUTE FROM authenticated/anon, GRANT ONLY TO service_role
REVOKE ALL ON FUNCTION public.delete_negotiation_message_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_negotiation_message_internal(uuid, uuid) TO service_role;

-- 12. SERVER-ONLY RPC: Claim negotiation media upload intent for finalize
CREATE OR REPLACE FUNCTION public.claim_negotiation_media_upload_intent_for_finalize(
  p_intent_id uuid,
  p_user_id uuid,
  p_room_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.negotiation_media_upload_intents%ROWTYPE;
  v_room public.negotiation_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_intent
  FROM public.negotiation_media_upload_intents
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_intent.user_id <> p_user_id THEN
    RETURN jsonb_build_object('status', 'user_mismatch');
  END IF;

  IF v_intent.negotiation_room_id <> p_room_id THEN
    RETURN jsonb_build_object('status', 'room_mismatch');
  END IF;

  IF v_intent.status = 'finalized' AND v_intent.final_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'finalized',
      'final_message_id', v_intent.final_message_id
    );
  END IF;

  IF v_intent.expires_at <= now() THEN
    UPDATE public.negotiation_media_upload_intents
    SET status = 'expired'
    WHERE id = p_intent_id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = p_room_id;

  IF NOT FOUND OR v_room.status <> 'active' THEN
    RETURN jsonb_build_object('status', 'room_inactive');
  END IF;

  -- Lease handling for concurrent finalize requests
  IF v_intent.status = 'finalizing' THEN
    IF v_intent.finalizing_at IS NOT NULL AND v_intent.finalizing_at > (now() - interval '2 minutes') THEN
      RETURN jsonb_build_object('status', 'finalizing_in_progress');
    END IF;
  END IF;

  UPDATE public.negotiation_media_upload_intents
  SET status = 'finalizing',
      finalizing_at = now()
  WHERE id = p_intent_id;

  RETURN jsonb_build_object(
    'status', 'claimed',
    'provider', v_intent.provider,
    'object_key', v_intent.object_key,
    'media_type', v_intent.media_type,
    'mime_type', v_intent.mime_type,
    'file_size_bytes', v_intent.file_size_bytes,
    'reply_to_message_id', v_intent.reply_to_message_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_negotiation_media_upload_intent_for_finalize(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_negotiation_media_upload_intent_for_finalize(uuid, uuid, uuid) TO service_role;

-- 13. SERVER-ONLY RPC: Atomically finalize negotiation media message
CREATE OR REPLACE FUNCTION public.finalize_negotiation_media_message_internal(
  p_intent_id uuid,
  p_user_id uuid,
  p_room_id uuid,
  p_media_type text,
  p_object_key text,
  p_metadata jsonb,
  p_reply_to_message_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_intent public.negotiation_media_upload_intents%ROWTYPE;
  v_msg_id uuid;
  v_text text;
BEGIN
  SELECT * INTO v_intent
  FROM public.negotiation_media_upload_intents
  WHERE id = p_intent_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent not found');
  END IF;

  IF v_intent.status = 'finalized' AND v_intent.final_message_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message_id', v_intent.final_message_id,
      'idempotent', true
    );
  END IF;

  IF v_intent.status <> 'finalizing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intent is not in finalizing state');
  END IF;

  v_text := CASE p_media_type
    WHEN 'image' THEN 'Sent a photo'
    WHEN 'video' THEN 'Sent a video'
    WHEN 'audio' THEN 'Sent a voice note'
    ELSE 'Sent a document'
  END;

  INSERT INTO public.negotiation_messages (
    negotiation_room_id,
    sender_id,
    message_type,
    text,
    media_type,
    media_path,
    media_metadata,
    reply_to_message_id,
    unread,
    role
  ) VALUES (
    p_room_id,
    p_user_id,
    p_media_type,
    v_text,
    p_media_type,
    p_object_key,
    p_metadata,
    p_reply_to_message_id,
    true,
    'user'
  )
  RETURNING id INTO v_msg_id;

  UPDATE public.negotiation_media_upload_intents
  SET status = 'finalized',
      final_message_id = v_msg_id
  WHERE id = p_intent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message_id', v_msg_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_negotiation_media_message_internal(uuid, uuid, uuid, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_negotiation_media_message_internal(uuid, uuid, uuid, text, text, jsonb, uuid) TO service_role;

COMMIT;
