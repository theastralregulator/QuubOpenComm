-- Migration: Message Realtime Participant RLS Policies
-- File: supabase/migrations/20260818010200_message_realtime_participant_rls.sql
-- Purpose: Harden public.messages SELECT and UPDATE policies to support conversation_members participants via helper
-- DO NOT APPLY THIS MIGRATION AUTOMATICALLY

-- 1. Hardened Message SELECT Policy (Uses is_current_user_conversation_participant helper for full participant support)
DROP POLICY IF EXISTS "Conversation participants can read messages" ON public.messages;
DROP POLICY IF EXISTS "Users in conversation can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can read message content" ON public.messages;
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;

CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_conversation_participant(conversation_id, false)
  );

-- 2. Hardened Message UPDATE Policy (Preserves received-message read status update semantics)
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can mark received messages read" ON public.messages;

CREATE POLICY "Participants can mark received messages read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND public.is_current_user_conversation_participant(conversation_id, false)
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND unread = false
    AND read_at IS NOT NULL
    AND public.is_current_user_conversation_participant(conversation_id, false)
  );
