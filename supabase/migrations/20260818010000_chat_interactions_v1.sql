-- Migration: 20260818010000_chat_interactions_v1.sql
-- Description: Chat interactions upgrade (Delete message, Reply to message, Reactions, Media & Files RPC, Delete-aware unread counts and conversation preview, Private Realtime Policies).
-- DO NOT APPLY TO PRODUCTION AUTOMATICALLY. MANUAL REVIEW REQUIRED FIRST.

-- 1. Add deleted_at, deleted_by, and reply_to_message_id to public.messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON public.messages(deleted_at) WHERE deleted_at IS NOT NULL;

-- 2. Add reply_to_message_id to public.media_upload_intents
ALTER TABLE public.media_upload_intents
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL;

-- 3. Trigger function to validate reply target message
CREATE OR REPLACE FUNCTION public.validate_message_reply_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.messages%ROWTYPE;
BEGIN
  IF NEW.reply_to_message_id IS NOT NULL THEN
    SELECT * INTO v_target
    FROM public.messages
    WHERE id = NEW.reply_to_message_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reply target message does not exist.';
    END IF;

    IF v_target.conversation_id <> NEW.conversation_id THEN
      RAISE EXCEPTION 'Reply target message belongs to a different conversation.';
    END IF;

    IF v_target.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot reply to a deleted message.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_message_reply_target ON public.messages;
CREATE TRIGGER trg_validate_message_reply_target
  BEFORE INSERT OR UPDATE OF reply_to_message_id ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_message_reply_target();

-- 4. Create public.message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_user_message_key UNIQUE (message_id, user_id),
  CONSTRAINT message_reactions_emoji_check CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🙏'))
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_conv ON public.message_reactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Reaction RLS Policies
DROP POLICY IF EXISTS "Participants can view message reactions" ON public.message_reactions;
CREATE POLICY "Participants can view message reactions"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.creator_id = auth.uid()
          OR c.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Participants can insert own reaction" ON public.message_reactions;
CREATE POLICY "Participants can insert own reaction"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id
        AND m.conversation_id = conversation_id
        AND m.deleted_at IS NULL
        AND (
          c.creator_id = auth.uid()
          OR c.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.conversation_members cm
            WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own reaction" ON public.message_reactions;
CREATE POLICY "Users can update own reaction"
  ON public.message_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reaction" ON public.message_reactions;
CREATE POLICY "Users can delete own reaction"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Add message_reactions to supabase_realtime publication safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Service-Role Only RPC for Message Soft Deletion
CREATE OR REPLACE FUNCTION public.finalize_user_message_delete_internal(
  p_user_id uuid,
  p_message_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_message_id IS NULL THEN
    RAISE EXCEPTION 'User ID and Message ID are required.';
  END IF;

  SELECT * INTO v_msg
  FROM public.messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found.';
  END IF;

  IF v_msg.sender_id <> p_user_id THEN
    RAISE EXCEPTION 'Only the original sender may delete their message.';
  END IF;

  IF v_msg.role IN ('system', 'assistant') THEN
    RAISE EXCEPTION 'Official system messages cannot be deleted.';
  END IF;

  -- Idempotent check
  IF v_msg.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  -- Soft delete message
  UPDATE public.messages
  SET
    text = 'This message was deleted',
    deleted_at = now(),
    deleted_by = p_user_id,
    unread = false
  WHERE id = p_message_id;

  -- Update message_media status
  UPDATE public.message_media
  SET
    status = 'deleted',
    deleted_at = now()
  WHERE message_id = p_message_id;

  RETURN jsonb_build_object('success', true, 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_user_message_delete_internal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_user_message_delete_internal(uuid, uuid) TO service_role;

-- 6. Delete-Aware get_unread_counts RPC
CREATE OR REPLACE FUNCTION public.get_unread_counts(p_user_id uuid)
RETURNS TABLE(conversation_id uuid, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    COUNT(m.id)::bigint AS unread_count
  FROM public.conversations c
  LEFT JOIN public.messages m
    ON m.conversation_id = c.id
   AND m.sender_id <> p_user_id
   AND m.unread = true
   AND m.deleted_at IS NULL
  WHERE c.creator_id = p_user_id
     OR c.member_id = p_user_id
     OR EXISTS (
       SELECT 1 FROM public.conversation_members cm
       WHERE cm.conversation_id = c.id AND cm.user_id = p_user_id
     )
  GROUP BY c.id;
END;
$$;

-- 7. Delete-Aware Conversation Sync Function & Triggers
CREATE OR REPLACE FUNCTION public.sync_conversation_after_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conv_id uuid;
  v_last_msg public.messages%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_conv_id := OLD.conversation_id;
  ELSE
    v_conv_id := NEW.conversation_id;
  END IF;

  -- Find newest non-deleted message
  SELECT * INTO v_last_msg
  FROM public.messages
  WHERE conversation_id = v_conv_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.conversations
    SET
      last_message_text = v_last_msg.text,
      last_message_time = v_last_msg.created_at,
      updated_at = now()
    WHERE id = v_conv_id;
  ELSE
    UPDATE public.conversations
    SET
      last_message_text = NULL,
      last_message_time = NULL,
      updated_at = now()
    WHERE id = v_conv_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_after_message ON public.messages;
CREATE TRIGGER trg_sync_conversation_after_message
  AFTER INSERT OR UPDATE OF text, deleted_at OR DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversation_after_message();

-- 8. Participant-Authorized get_conversation_shared_media_v2 RPC
CREATE OR REPLACE FUNCTION public.get_conversation_shared_media_v2(
  p_conversation_id uuid
)
RETURNS TABLE (
  media_id uuid,
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  media_type text,
  mime_type text,
  file_size_bytes bigint,
  duration_ms integer,
  width integer,
  height integer,
  original_filename text,
  status text,
  created_at timestamptz,
  message_deleted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify caller authorization
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
    RAISE EXCEPTION 'Not authorized to access media for this conversation.';
  END IF;

  RETURN QUERY
  SELECT
    mm.id AS media_id,
    mm.message_id,
    mm.conversation_id,
    mm.uploader_id AS sender_id,
    mm.media_type,
    mm.mime_type,
    mm.file_size_bytes,
    mm.duration_ms,
    mm.width,
    mm.height,
    mm.original_filename,
    mm.status,
    mm.created_at,
    m.deleted_at AS message_deleted_at
  FROM public.message_media mm
  JOIN public.messages m ON m.id = mm.message_id
  WHERE mm.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
  ORDER BY mm.created_at DESC
  LIMIT 100;
END;
$$;

-- 9. Private Realtime Topic RLS Policies for conversation:<UUID>
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Participants can broadcast in conversation topic" ON realtime.messages;
    CREATE POLICY "Participants can broadcast in conversation topic"
      ON realtime.messages FOR INSERT
      WITH CHECK (
        extension IN ('broadcast', 'presence')
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE ('conversation:' || c.id::text) = realtime.topic()
            AND (
              c.creator_id = auth.uid()
              OR c.member_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.conversation_members cm
                WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
              )
            )
        )
      );

    DROP POLICY IF EXISTS "Participants can listen to conversation topic" ON realtime.messages;
    CREATE POLICY "Participants can listen to conversation topic"
      ON realtime.messages FOR SELECT
      USING (
        extension IN ('broadcast', 'presence')
        AND EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE ('conversation:' || c.id::text) = realtime.topic()
            AND (
              c.creator_id = auth.uid()
              OR c.member_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.conversation_members cm
                WHERE cm.conversation_id = c.id AND cm.user_id = auth.uid()
              )
            )
        )
      );
  END IF;
END $$;
