-- Migration: 20260822010000_negotiation_chat_feature_parity.sql
-- Description: Negotiation chat feature parity upgrade (Reply, Soft Delete, Reactions, Media, Read Status, RPCs, Security Definer Helpers).
-- DO NOT APPLY TO PRODUCTION AUTOMATICALLY. MANUAL REVIEW REQUIRED FIRST.

BEGIN;

-- 1. Extend public.negotiation_messages schema
ALTER TABLE public.negotiation_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.negotiation_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS read_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS unread boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS media_type text NULL,
  ADD COLUMN IF NOT EXISTS media_path text NULL,
  ADD COLUMN IF NOT EXISTS media_url text NULL,
  ADD COLUMN IF NOT EXISTS media_metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

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
GRANT SELECT, DELETE ON public.negotiation_message_reactions TO authenticated;
GRANT INSERT (message_id, negotiation_room_id, user_id, emoji) ON public.negotiation_message_reactions TO authenticated;
GRANT UPDATE (emoji, updated_at) ON public.negotiation_message_reactions TO authenticated;

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

  -- Extract room UUID from topics like 'negotiation:UUID' or 'hire_negotiation_UUID'
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

-- 6. Trigger Function: Validate negotiation reply target
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

-- 7. Trigger Function: Validate negotiation reaction target
CREATE OR REPLACE FUNCTION public.validate_negotiation_message_reaction_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg public.negotiation_messages%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.message_id IS DISTINCT FROM OLD.message_id THEN
      RAISE EXCEPTION 'Cannot modify message_id of an existing reaction.';
    END IF;
    IF NEW.negotiation_room_id IS DISTINCT FROM OLD.negotiation_room_id THEN
      RAISE EXCEPTION 'Cannot modify negotiation_room_id of an existing reaction.';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot modify user_id of an existing reaction.';
    END IF;
  END IF;

  SELECT * INTO v_msg
  FROM public.negotiation_messages
  WHERE id = NEW.message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reaction target negotiation message does not exist.';
  END IF;

  IF v_msg.negotiation_room_id <> NEW.negotiation_room_id THEN
    RAISE EXCEPTION 'Reaction negotiation_room_id mismatch with target message.';
  END IF;

  IF v_msg.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot react to a deleted negotiation message.';
  END IF;

  IF v_msg.message_type IN ('system', 'proposal_event', 'status_event') THEN
    RAISE EXCEPTION 'Reactions are permitted only on normal user negotiation messages.';
  END IF;

  IF NOT public.can_current_user_access_negotiation_room(NEW.negotiation_room_id, true) THEN
    RAISE EXCEPTION 'Cannot add or modify reactions in a locked or unauthorized negotiation room.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_negotiation_message_reaction_target ON public.negotiation_message_reactions;
CREATE TRIGGER trg_validate_negotiation_message_reaction_target
  BEFORE INSERT OR UPDATE ON public.negotiation_message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_negotiation_message_reaction_target();

-- 8. RPC: Mark negotiation room messages as read
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

-- 9. RPC: Toggle negotiation message reaction
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

  IF NOT public.can_current_user_access_negotiation_room(p_room_id, true) THEN
    RAISE EXCEPTION 'Cannot toggle reactions in a locked or unauthorized negotiation room.';
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

-- 10. RPC: Soft-delete negotiation message
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

REVOKE ALL ON FUNCTION public.delete_negotiation_message_internal(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_negotiation_message_internal(uuid, uuid) TO authenticated;

COMMIT;
