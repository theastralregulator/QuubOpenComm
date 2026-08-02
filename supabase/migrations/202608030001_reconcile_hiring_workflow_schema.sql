-- =============================================================================
-- Migration: 202608030001_reconcile_hiring_workflow_schema.sql
-- Description: Reconcile Direct Hire, Negotiation, Proposal, Work Contract & Main Chat Workflow
-- Author: OpenComm Engineering Team
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Safety Guard Check
-- Ensure legacy deal_proposals and work_contracts tables are empty before replacement
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deal_proposals') THEN
    IF (SELECT COUNT(*) FROM public.deal_proposals) > 0 THEN
      RAISE EXCEPTION 'Aborting reconciliation migration: public.deal_proposals is not empty.';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_contracts') THEN
    IF (SELECT COUNT(*) FROM public.work_contracts) > 0 THEN
      RAISE EXCEPTION 'Aborting reconciliation migration: public.work_contracts is not empty.';
    END IF;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Drop Legacy Constraints & Tables
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.conversations DROP CONSTRAINT IF EXISTS conversations_work_contract_id_fkey;
ALTER TABLE IF EXISTS public.hiring_requests DROP CONSTRAINT IF EXISTS hiring_requests_work_contract_id_fkey;
ALTER TABLE IF EXISTS public.hiring_requests DROP CONSTRAINT IF EXISTS hiring_requests_active_proposal_id_fkey;

DROP TABLE IF EXISTS public.work_contracts CASCADE;
DROP TABLE IF EXISTS public.deal_proposals CASCADE;

-- -----------------------------------------------------------------------------
-- 3. Extend existing hiring_requests table
-- -----------------------------------------------------------------------------
ALTER TABLE public.hiring_requests
  DROP CONSTRAINT IF EXISTS hiring_requests_status_check;

ALTER TABLE public.hiring_requests
  ADD CONSTRAINT hiring_requests_status_check
  CHECK (status IN (
    'pending', 'accepted', 'rejected', 'withdrawn',
    'negotiating', 'proposal_pending', 'changes_requested',
    'confirmed', 'cancelled', 'expired', 'completed'
  ));

ALTER TABLE public.hiring_requests
  ADD COLUMN IF NOT EXISTS negotiation_room_id uuid,
  ADD COLUMN IF NOT EXISTS active_proposal_id uuid,
  ADD COLUMN IF NOT EXISTS work_contract_id uuid,
  ADD COLUMN IF NOT EXISTS permanent_conversation_id uuid,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS declined_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- -----------------------------------------------------------------------------
-- 4. Extend existing conversations & messages table constraints
-- Drop legacy constraint names and apply canonical single constraint
-- -----------------------------------------------------------------------------
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_type_check;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_conversation_type_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_conversation_type_check
  CHECK (conversation_type IN ('application', 'direct', 'worker_direct', 'work_contract'));

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS work_contract_id uuid;

-- Safely extend messages role constraint to support system messages
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_role_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant', 'system'));

-- -----------------------------------------------------------------------------
-- 5. Create public.negotiation_rooms Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negotiation_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_request_id uuid NOT NULL REFERENCES public.hiring_requests(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'cancelled', 'completed')),
  last_message_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT negotiation_rooms_unique_request UNIQUE (hiring_request_id),
  CONSTRAINT negotiation_rooms_different_users CHECK (client_id <> worker_id)
);

-- -----------------------------------------------------------------------------
-- 6. Create public.negotiation_messages Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negotiation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_room_id uuid NOT NULL REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'proposal_event', 'status_event')),
  text text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone,
  CONSTRAINT negotiation_messages_text_length CHECK (char_length(trim(text)) > 0 AND char_length(text) <= 5000)
);

-- -----------------------------------------------------------------------------
-- 7. Recreate Reconciled public.deal_proposals Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.deal_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_request_id uuid NOT NULL REFERENCES public.hiring_requests(id) ON DELETE CASCADE,
  negotiation_room_id uuid NOT NULL REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  proposed_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_title text NOT NULL,
  work_description text NOT NULL,
  final_price numeric(10,2) NOT NULL CHECK (final_price >= 0),
  payment_type text NOT NULL DEFAULT 'fixed' CHECK (payment_type IN ('hourly', 'fixed', 'monthly', 'daily', 'project')),
  work_date date,
  start_time time,
  duration text,
  location text,
  additional_terms text,
  proposal_status text NOT NULL DEFAULT 'pending' CHECK (proposal_status IN ('pending', 'changes_requested', 'rejected', 'superseded', 'accepted')),
  client_response text NOT NULL DEFAULT 'pending' CHECK (client_response IN ('pending', 'accepted', 'rejected', 'changes_requested')),
  worker_response text NOT NULL DEFAULT 'pending' CHECK (worker_response IN ('pending', 'accepted', 'rejected', 'changes_requested')),
  client_responded_at timestamp with time zone,
  worker_responded_at timestamp with time zone,
  rejection_reason text,
  change_request_notes text,
  superseded_by uuid REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- -----------------------------------------------------------------------------
-- 8. Recreate Reconciled public.work_contracts Table
-- -----------------------------------------------------------------------------
CREATE TABLE public.work_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hiring_request_id uuid NOT NULL REFERENCES public.hiring_requests(id) ON DELETE CASCADE,
  deal_proposal_id uuid NOT NULL REFERENCES public.deal_proposals(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_title text NOT NULL,
  work_description text NOT NULL,
  final_price numeric(10,2) NOT NULL CHECK (final_price >= 0),
  payment_type text NOT NULL DEFAULT 'fixed',
  work_date date,
  start_time time,
  duration text,
  location text,
  additional_terms text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')),
  permanent_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT work_contracts_unique_hiring_request UNIQUE (hiring_request_id),
  CONSTRAINT work_contracts_unique_deal_proposal UNIQUE (deal_proposal_id)
);

-- -----------------------------------------------------------------------------
-- 9. Add Foreign Keys, Constraints & Unique Partial Indexes
-- -----------------------------------------------------------------------------
ALTER TABLE public.hiring_requests
  ADD CONSTRAINT hiring_requests_negotiation_room_id_fkey
  FOREIGN KEY (negotiation_room_id) REFERENCES public.negotiation_rooms(id) ON DELETE SET NULL,
  ADD CONSTRAINT hiring_requests_active_proposal_id_fkey
  FOREIGN KEY (active_proposal_id) REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  ADD CONSTRAINT hiring_requests_work_contract_id_fkey
  FOREIGN KEY (work_contract_id) REFERENCES public.work_contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT hiring_requests_permanent_conversation_id_fkey
  FOREIGN KEY (permanent_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_work_contract_id_fkey
  FOREIGN KEY (work_contract_id) REFERENCES public.work_contracts(id) ON DELETE SET NULL;

-- Unique partial index on conversations(work_contract_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_conversations_work_contract
  ON public.conversations(work_contract_id)
  WHERE work_contract_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_request ON public.negotiation_rooms(hiring_request_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_client ON public.negotiation_rooms(client_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_worker ON public.negotiation_rooms(worker_id);

CREATE INDEX IF NOT EXISTS idx_negotiation_messages_room ON public.negotiation_messages(negotiation_room_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_messages_created ON public.negotiation_messages(created_at ASC);

CREATE INDEX IF NOT EXISTS idx_deal_proposals_request ON public.deal_proposals(hiring_request_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_room ON public.deal_proposals(negotiation_room_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_status ON public.deal_proposals(proposal_status);

CREATE INDEX IF NOT EXISTS idx_work_contracts_request ON public.work_contracts(hiring_request_id);
CREATE INDEX IF NOT EXISTS idx_work_contracts_client ON public.work_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker ON public.work_contracts(worker_id);

-- -----------------------------------------------------------------------------
-- 10. Enable Row Level Security (RLS) & Define Participant SELECT Policies ONLY
-- Direct INSERT and UPDATE are disabled; all mutations must run via SECURITY DEFINER RPCs.
-- -----------------------------------------------------------------------------
ALTER TABLE public.negotiation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_contracts ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Users can view negotiation rooms they are part of" ON public.negotiation_rooms;
DROP POLICY IF EXISTS "Participants can update negotiation rooms" ON public.negotiation_rooms;
DROP POLICY IF EXISTS "Participants can view negotiation messages" ON public.negotiation_messages;
DROP POLICY IF EXISTS "Participants can insert negotiation messages" ON public.negotiation_messages;
DROP POLICY IF EXISTS "Participants can view deal proposals" ON public.deal_proposals;
DROP POLICY IF EXISTS "Participants can insert deal proposals" ON public.deal_proposals;
DROP POLICY IF EXISTS "Participants can update deal proposals" ON public.deal_proposals;
DROP POLICY IF EXISTS "Participants can view their work contracts" ON public.work_contracts;

-- SELECT Policies for Authorized Participants Only
CREATE POLICY "Participants can view negotiation rooms"
  ON public.negotiation_rooms FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = worker_id);

CREATE POLICY "Participants can view negotiation messages"
  ON public.negotiation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.negotiation_rooms nr
      WHERE nr.id = negotiation_messages.negotiation_room_id
        AND (nr.client_id = auth.uid() OR nr.worker_id = auth.uid())
    )
  );

CREATE POLICY "Participants can view deal proposals"
  ON public.deal_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hiring_requests hr
      WHERE hr.id = deal_proposals.hiring_request_id
        AND (hr.client_id = auth.uid() OR hr.worker_id = auth.uid())
    )
  );

CREATE POLICY "Participants can view work contracts"
  ON public.work_contracts FOR SELECT
  USING (auth.uid() = client_id OR auth.uid() = worker_id);

-- -----------------------------------------------------------------------------
-- 11. Add to Supabase Realtime Publication
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 12. RPC Function: accept_hiring_request
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_hiring_request(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
  v_room_id uuid;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_request
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found.';
  END IF;

  IF v_request.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Only the requested worker can accept this hiring request.';
  END IF;

  IF v_request.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'This hiring request cannot be accepted in its current state (status: %).', v_request.status;
  END IF;

  INSERT INTO public.negotiation_rooms (hiring_request_id, client_id, worker_id, status, last_message_at)
  VALUES (v_request.id, v_request.client_id, v_request.worker_id, 'active', now())
  ON CONFLICT (hiring_request_id)
  DO UPDATE SET status = 'active', updated_at = now()
  RETURNING id INTO v_room_id;

  UPDATE public.hiring_requests
  SET
    status = 'negotiating',
    accepted_at = now(),
    negotiation_room_id = v_room_id,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
  VALUES (
    v_room_id,
    v_user_id,
    'system',
    'Hiring request accepted! Negotiation room initialized for initial discussions and final deal preparation.'
  );

  v_result := json_build_object(
    'request_id', p_request_id,
    'status', 'negotiating',
    'negotiation_room_id', v_room_id,
    'message', 'Hiring request accepted successfully.'
  );

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 13. RPC Function: decline_hiring_request
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_hiring_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_request
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found.';
  END IF;

  IF v_request.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Only the requested worker can decline this hiring request.';
  END IF;

  IF v_request.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'Only pending hiring requests can be declined.';
  END IF;

  UPDATE public.hiring_requests
  SET
    status = 'rejected',
    declined_at = now(),
    decline_reason = p_reason,
    updated_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'request_id', p_request_id,
    'status', 'rejected',
    'message', 'Hiring request declined.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 14. RPC Function: withdraw_hiring_request
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_hiring_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_request
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found.';
  END IF;

  IF v_request.client_id != v_user_id THEN
    RAISE EXCEPTION 'Only the client who sent this request can withdraw it.';
  END IF;

  IF v_request.status IN ('confirmed', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot withdraw a hiring request that is already confirmed or finalized.';
  END IF;

  UPDATE public.hiring_requests
  SET
    status = 'withdrawn',
    cancellation_reason = p_reason,
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  IF v_request.negotiation_room_id IS NOT NULL THEN
    UPDATE public.negotiation_rooms
    SET status = 'cancelled', locked_at = now(), updated_at = now()
    WHERE id = v_request.negotiation_room_id;
  END IF;

  RETURN json_build_object(
    'request_id', p_request_id,
    'status', 'withdrawn',
    'message', 'Hiring request withdrawn.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 15. RPC Function: send_negotiation_message
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_negotiation_message(p_room_id uuid, p_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_room public.negotiation_rooms%ROWTYPE;
  v_msg_id uuid;
  v_created_at timestamp with time zone;
  v_clean_text text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_clean_text := trim(p_text);
  IF v_clean_text IS NULL OR char_length(v_clean_text) = 0 THEN
    RAISE EXCEPTION 'Message text cannot be empty.';
  END IF;

  IF char_length(v_clean_text) > 5000 THEN
    RAISE EXCEPTION 'Message text exceeds maximum length of 5000 characters.';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negotiation room not found.';
  END IF;

  IF v_room.client_id != v_user_id AND v_room.worker_id != v_user_id THEN
    RAISE EXCEPTION 'You are not a participant in this negotiation room.';
  END IF;

  IF v_room.status != 'active' THEN
    RAISE EXCEPTION 'This negotiation room is locked or closed.';
  END IF;

  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
  VALUES (p_room_id, v_user_id, 'text', v_clean_text)
  RETURNING id, created_at INTO v_msg_id, v_created_at;

  UPDATE public.negotiation_rooms
  SET last_message_at = now(), updated_at = now()
  WHERE id = p_room_id;

  RETURN json_build_object(
    'id', v_msg_id,
    'negotiation_room_id', p_room_id,
    'sender_id', v_user_id,
    'message_type', 'text',
    'text', v_clean_text,
    'created_at', v_created_at
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 16. RPC Function: submit_deal_proposal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_deal_proposal(
  p_request_id uuid,
  p_work_title text,
  p_work_description text,
  p_final_price numeric,
  p_payment_type text DEFAULT 'fixed',
  p_work_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_duration text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_additional_terms text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
  v_room public.negotiation_rooms%ROWTYPE;
  v_version integer;
  v_proposal_id uuid;
  v_client_resp text;
  v_worker_resp text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_request
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found.';
  END IF;

  IF v_request.client_id != v_user_id AND v_request.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Only client or worker can submit deal proposals for this request.';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE hiring_request_id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active negotiation room required before submitting a deal proposal.';
  END IF;

  IF v_room.status != 'active' THEN
    RAISE EXCEPTION 'Negotiation room is locked or closed.';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.deal_proposals WHERE hiring_request_id = p_request_id;

  -- Mark existing pending proposals as superseded
  UPDATE public.deal_proposals
  SET proposal_status = 'superseded', updated_at = now()
  WHERE hiring_request_id = p_request_id AND proposal_status IN ('pending', 'changes_requested');

  IF v_user_id = v_request.client_id THEN
    v_client_resp := 'accepted';
    v_worker_resp := 'pending';
  ELSE
    v_client_resp := 'pending';
    v_worker_resp := 'accepted';
  END IF;

  INSERT INTO public.deal_proposals (
    hiring_request_id,
    negotiation_room_id,
    version_number,
    proposed_by,
    work_title,
    work_description,
    final_price,
    payment_type,
    work_date,
    start_time,
    duration,
    location,
    additional_terms,
    proposal_status,
    client_response,
    worker_response,
    client_responded_at,
    worker_responded_at
  ) VALUES (
    p_request_id,
    v_room.id,
    v_version,
    v_user_id,
    trim(p_work_title),
    trim(p_work_description),
    p_final_price,
    COALESCE(p_payment_type, 'fixed'),
    p_work_date,
    p_start_time,
    p_duration,
    p_location,
    p_additional_terms,
    'pending',
    v_client_resp,
    v_worker_resp,
    CASE WHEN v_client_resp = 'accepted' THEN now() ELSE NULL END,
    CASE WHEN v_worker_resp = 'accepted' THEN now() ELSE NULL END
  ) RETURNING id INTO v_proposal_id;

  UPDATE public.hiring_requests
  SET
    active_proposal_id = v_proposal_id,
    status = 'proposal_pending',
    updated_at = now()
  WHERE id = p_request_id;

  UPDATE public.negotiation_rooms
  SET
    updated_at = now()
  WHERE id = v_room.id;

  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text, metadata)
  VALUES (
    v_room.id,
    v_user_id,
    'proposal_event',
    'Submitted Final Deal Proposal (v' || v_version || ') for ₹' || p_final_price || '.',
    jsonb_build_object('proposal_id', v_proposal_id, 'version', v_version, 'price', p_final_price)
  );

  RETURN json_build_object(
    'proposal_id', v_proposal_id,
    'version_number', v_version,
    'status', 'pending',
    'message', 'Deal proposal submitted successfully.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 17. RPC Function: respond_to_deal_proposal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_deal_proposal(
  p_proposal_id uuid,
  p_response text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_proposal public.deal_proposals%ROWTYPE;
  v_request public.hiring_requests%ROWTYPE;
  v_room public.negotiation_rooms%ROWTYPE;
  v_is_client boolean;
  v_is_worker boolean;
  v_both_accepted boolean := false;
  v_contract_id uuid;
  v_conv_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_proposal
  FROM public.deal_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal proposal not found.';
  END IF;

  SELECT * INTO v_request
  FROM public.hiring_requests
  WHERE id = v_proposal.hiring_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated hiring request not found.';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = v_proposal.negotiation_room_id
  FOR UPDATE;

  v_is_client := (v_request.client_id = v_user_id);
  v_is_worker := (v_request.worker_id = v_user_id);

  IF NOT (v_is_client OR v_is_worker) THEN
    RAISE EXCEPTION 'You are not a participant in this deal proposal.';
  END IF;

  IF v_proposal.proposal_status NOT IN ('pending', 'changes_requested') THEN
    RAISE EXCEPTION 'This proposal is no longer active or pending (status: %).', v_proposal.proposal_status;
  END IF;

  IF p_response NOT IN ('accept', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid response type. Must be accept, reject, or request_changes.';
  END IF;

  IF p_response = 'accept' THEN
    IF v_is_client THEN
      UPDATE public.deal_proposals
      SET client_response = 'accepted', client_responded_at = now(), updated_at = now()
      WHERE id = p_proposal_id;
    ELSIF v_is_worker THEN
      UPDATE public.deal_proposals
      SET worker_response = 'accepted', worker_responded_at = now(), updated_at = now()
      WHERE id = p_proposal_id;
    END IF;

    SELECT (client_response = 'accepted' AND worker_response = 'accepted') INTO v_both_accepted
    FROM public.deal_proposals WHERE id = p_proposal_id;

    IF v_both_accepted THEN
      UPDATE public.deal_proposals
      SET proposal_status = 'accepted', updated_at = now()
      WHERE id = p_proposal_id;

      -- Check if contract already exists for this hiring request
      SELECT id INTO v_contract_id
      FROM public.work_contracts
      WHERE hiring_request_id = v_request.id;

      IF v_contract_id IS NULL THEN
        INSERT INTO public.work_contracts (
          hiring_request_id,
          deal_proposal_id,
          client_id,
          worker_id,
          work_title,
          work_description,
          final_price,
          payment_type,
          work_date,
          start_time,
          duration,
          location,
          additional_terms,
          status,
          confirmed_at
        ) VALUES (
          v_request.id,
          v_proposal.id,
          v_request.client_id,
          v_request.worker_id,
          v_proposal.work_title,
          v_proposal.work_description,
          v_proposal.final_price,
          v_proposal.payment_type,
          v_proposal.work_date,
          v_proposal.start_time,
          v_proposal.duration,
          v_proposal.location,
          v_proposal.additional_terms,
          'active',
          now()
        ) RETURNING id INTO v_contract_id;
      END IF;

      -- Check or create permanent main chat thread
      SELECT id INTO v_conv_id
      FROM public.conversations
      WHERE work_contract_id = v_contract_id LIMIT 1;

      IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (
          creator_id,
          member_id,
          conversation_type,
          work_contract_id,
          last_message_text,
          last_message_time
        ) VALUES (
          v_request.client_id,
          v_request.worker_id,
          'work_contract',
          v_contract_id,
          'Work Contract confirmed! Official project conversation thread opened.',
          now()
        ) RETURNING id INTO v_conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES
          (v_conv_id, v_request.client_id),
          (v_conv_id, v_request.worker_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        -- Insert contract confirmation system message using live messages schema
        INSERT INTO public.messages (
          conversation_id,
          sender_id,
          sender_name,
          text,
          role,
          unread
        ) VALUES (
          v_conv_id,
          v_request.client_id,
          'OpenComm System',
          'Work Contract confirmed! Official project conversation thread opened.',
          'system',
          true
        );
      END IF;

      UPDATE public.work_contracts
      SET permanent_conversation_id = v_conv_id
      WHERE id = v_contract_id;

      UPDATE public.hiring_requests
      SET
        status = 'confirmed',
        confirmed_at = now(),
        work_contract_id = v_contract_id,
        permanent_conversation_id = v_conv_id,
        updated_at = now()
      WHERE id = v_request.id;

      UPDATE public.negotiation_rooms
      SET status = 'locked', locked_at = now(), updated_at = now()
      WHERE id = v_proposal.negotiation_room_id;

      INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
      VALUES (
        v_proposal.negotiation_room_id,
        v_user_id,
        'system',
        'Final deal accepted by both parties! Work Contract initialized and Permanent Main Chat unlocked.'
      );

      RETURN json_build_object(
        'confirmed', true,
        'proposal_id', p_proposal_id,
        'contract_id', v_contract_id,
        'conversation_id', v_conv_id,
        'message', 'Deal proposal accepted by both parties. Work Contract created!'
      );
    ELSE
      RETURN json_build_object(
        'confirmed', false,
        'proposal_id', p_proposal_id,
        'message', 'Acceptance recorded. Waiting for the other party to accept.'
      );
    END IF;

  ELSIF p_response = 'reject' THEN
    UPDATE public.deal_proposals
    SET
      proposal_status = 'rejected',
      rejection_reason = p_reason,
      client_response = CASE WHEN v_is_client THEN 'rejected' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'rejected' ELSE worker_response END,
      updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.hiring_requests
    SET status = 'negotiating', updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
    VALUES (
      v_proposal.negotiation_room_id,
      v_user_id,
      'system',
      'Deal proposal rejected' || CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ': ' || p_reason ELSE '.' END
    );

    RETURN json_build_object(
      'confirmed', false,
      'proposal_id', p_proposal_id,
      'status', 'rejected',
      'message', 'Deal proposal rejected.'
    );

  ELSIF p_response = 'request_changes' THEN
    UPDATE public.deal_proposals
    SET
      proposal_status = 'changes_requested',
      change_request_notes = p_reason,
      client_response = CASE WHEN v_is_client THEN 'changes_requested' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'changes_requested' ELSE worker_response END,
      updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.hiring_requests
    SET status = 'changes_requested', updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
    VALUES (
      v_proposal.negotiation_room_id,
      v_user_id,
      'system',
      'Requested changes to proposal' || CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ': ' || p_reason ELSE '.' END
    );

    RETURN json_build_object(
      'confirmed', false,
      'proposal_id', p_proposal_id,
      'status', 'changes_requested',
      'message', 'Changes requested for deal proposal.'
    );
  END IF;

  RAISE EXCEPTION 'Unhandled response state.';
END;
$$;

-- -----------------------------------------------------------------------------
-- 18. RPC Function: get_hire_workflow_details
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hire_workflow_details(p_request_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
  v_client_prof json;
  v_worker_prof json;
  v_room json;
  v_active_proposal json;
  v_all_proposals json;
  v_messages json;
  v_contract json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_request FROM public.hiring_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found.';
  END IF;

  IF v_request.client_id != v_user_id AND v_request.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized to view this hiring request.';
  END IF;

  SELECT json_build_object('id', id, 'full_name', full_name, 'avatar_url', avatar_url) INTO v_client_prof
  FROM public.profiles WHERE id = v_request.client_id;

  SELECT json_build_object('id', id, 'full_name', full_name, 'avatar_url', avatar_url) INTO v_worker_prof
  FROM public.profiles WHERE id = v_request.worker_id;

  SELECT row_to_json(nr) INTO v_room
  FROM public.negotiation_rooms nr WHERE hiring_request_id = p_request_id;

  SELECT row_to_json(dp) INTO v_active_proposal
  FROM public.deal_proposals dp WHERE id = v_request.active_proposal_id;

  SELECT COALESCE(json_agg(row_to_json(dp) ORDER BY dp.version_number DESC), '[]'::json) INTO v_all_proposals
  FROM public.deal_proposals dp WHERE hiring_request_id = p_request_id;

  SELECT COALESCE(json_agg(row_to_json(nm) ORDER BY nm.created_at ASC), '[]'::json) INTO v_messages
  FROM (
    SELECT msg.*, prof.full_name as sender_name, prof.avatar_url as sender_avatar
    FROM public.negotiation_messages msg
    LEFT JOIN public.profiles prof ON prof.id = msg.sender_id
    WHERE msg.negotiation_room_id = (v_room->>'id')::uuid
    ORDER BY msg.created_at ASC
    LIMIT 200
  ) msg;

  SELECT row_to_json(wc) INTO v_contract
  FROM public.work_contracts wc WHERE hiring_request_id = p_request_id;

  RETURN json_build_object(
    'hiring_request', row_to_json(v_request),
    'client_profile', v_client_prof,
    'worker_profile', v_worker_prof,
    'negotiation_room', v_room,
    'active_proposal', v_active_proposal,
    'deal_proposals_history', v_all_proposals,
    'negotiation_messages', v_messages,
    'work_contract', v_contract
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 19. RPC Function: get_hiring_requests_for_current_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hiring_requests_for_current_user()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(item) ORDER BY item.updated_at DESC), '[]'::json) INTO v_result
  FROM (
    SELECT
      hr.*,
      cp.full_name as client_name_resolved,
      cp.avatar_url as client_avatar,
      wp.full_name as worker_name_resolved,
      wp.avatar_url as worker_avatar,
      dp.work_title as active_proposal_title,
      dp.final_price as active_proposal_price,
      dp.proposal_status as active_proposal_status
    FROM public.hiring_requests hr
    LEFT JOIN public.profiles cp ON cp.id = hr.client_id
    LEFT JOIN public.profiles wp ON wp.id = hr.worker_id
    LEFT JOIN public.deal_proposals dp ON dp.id = hr.active_proposal_id
    WHERE hr.client_id = v_user_id OR hr.worker_id = v_user_id
    ORDER BY hr.updated_at DESC
  ) item;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 20. Revoke Permissions from PUBLIC / anon & Grant to authenticated ONLY
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.accept_hiring_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_hiring_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdraw_hiring_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_hire_workflow_details(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_hiring_requests_for_current_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_hiring_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_hiring_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_hiring_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hire_workflow_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hiring_requests_for_current_user() TO authenticated;

COMMIT;
