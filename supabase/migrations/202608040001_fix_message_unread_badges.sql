-- Fix message read-state semantics used by the mobile nav unread badge.
-- The messages table uses unread/read_at, not is_read.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET read_at = COALESCE(read_at, created_at)
WHERE unread = false
  AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread_sender
  ON public.messages(conversation_id, sender_id, unread)
  WHERE unread = true;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id
      AND (creator_id = v_user_id OR member_id = v_user_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Not a participant in this conversation';
  END IF;

  UPDATE public.messages
  SET unread = false,
      read_at = COALESCE(read_at, now())
  WHERE conversation_id = p_conversation_id
    AND sender_id <> v_user_id
    AND unread = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
