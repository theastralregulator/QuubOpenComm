-- =========================================================================
-- OpenComm Migration: Direct Hiring Negotiation & Contract Workflow
-- File: 202608030000_hire_negotiation_contract_workflow.sql
-- Description: Creates backend tables, constraints, RPCs, and RLS policies for:
--              Hire Request -> Temporary Negotiation -> Deal Proposals -> Work Contracts -> Main Chat
-- =========================================================================

-- 1. SAFELY UPDATE HIRING_REQUESTS STATUS CONSTRAINT & ADD COLUMNS
DO $$ 
DECLARE
  con_record record;
BEGIN
  FOR con_record IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'public.hiring_requests'::regclass AND contype = 'c'
  LOOP
    IF pg_get_constraintdef(con_record.conname::regclass) LIKE '%status%' THEN
      EXECUTE 'ALTER TABLE public.hiring_requests DROP CONSTRAINT ' || quote_ident(con_record.conname);
    END IF;
  END LOOP;
END $$;

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


-- 2. CREATE NEGOTIATION ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.negotiation_rooms (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hiring_request_id uuid REFERENCES public.hiring_requests(id) ON DELETE CASCADE NOT NULL UNIQUE,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('active', 'locked', 'cancelled', 'completed')) DEFAULT 'active' NOT NULL,
  last_message_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  locked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (client_id <> worker_id)
);

CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_client ON public.negotiation_rooms(client_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_worker ON public.negotiation_rooms(worker_id);
CREATE INDEX IF NOT EXISTS idx_negotiation_rooms_status ON public.negotiation_rooms(status);


-- 3. CREATE NEGOTIATION MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.negotiation_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  negotiation_room_id uuid REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  message_type text CHECK (message_type IN ('text', 'system', 'proposal_event', 'status_event')) DEFAULT 'text' NOT NULL,
  text text NOT NULL CHECK (char_length(trim(text)) > 0 AND char_length(text) <= 5000),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  edited_at timestamp with time zone,
  deleted_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_negotiation_messages_room_time ON public.negotiation_messages(negotiation_room_id, created_at ASC);


-- 4. CREATE DEAL PROPOSALS TABLE
CREATE TABLE IF NOT EXISTS public.deal_proposals (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hiring_request_id uuid REFERENCES public.hiring_requests(id) ON DELETE CASCADE NOT NULL,
  negotiation_room_id uuid REFERENCES public.negotiation_rooms(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  work_title text NOT NULL,
  work_description text NOT NULL,
  final_price numeric NOT NULL CHECK (final_price >= 0),
  payment_type text CHECK (payment_type IN ('hourly', 'fixed', 'monthly', 'daily', 'project')) DEFAULT 'fixed' NOT NULL,
  work_date date,
  start_time time,
  duration text,
  location text,
  additional_terms text,
  proposal_status text CHECK (proposal_status IN ('pending', 'changes_requested', 'rejected', 'superseded', 'accepted')) DEFAULT 'pending' NOT NULL,
  client_response text CHECK (client_response IN ('pending', 'accepted', 'rejected', 'changes_requested')) DEFAULT 'pending' NOT NULL,
  worker_response text CHECK (worker_response IN ('pending', 'accepted', 'rejected', 'changes_requested')) DEFAULT 'pending' NOT NULL,
  client_responded_at timestamp with time zone,
  worker_responded_at timestamp with time zone,
  superseded_by uuid REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT deal_proposals_version_unique UNIQUE (hiring_request_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_deal_proposals_request ON public.deal_proposals(hiring_request_id, proposal_status);


-- 5. CREATE WORK CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS public.work_contracts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hiring_request_id uuid REFERENCES public.hiring_requests(id) ON DELETE CASCADE NOT NULL UNIQUE,
  deal_proposal_id uuid REFERENCES public.deal_proposals(id) ON DELETE RESTRICT NOT NULL UNIQUE,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  work_title text NOT NULL,
  work_description text NOT NULL,
  final_price numeric NOT NULL CHECK (final_price >= 0),
  payment_type text NOT NULL,
  work_date date,
  start_time time,
  duration text,
  location text,
  additional_terms text,
  status text CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')) DEFAULT 'active' NOT NULL,
  permanent_conversation_id uuid,
  confirmed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (client_id <> worker_id)
);

CREATE INDEX IF NOT EXISTS idx_work_contracts_client ON public.work_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_work_contracts_worker ON public.work_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_work_contracts_status ON public.work_contracts(status);


-- 6. EXTEND CONVERSATIONS TABLE SAFELY FOR WORK CONTRACTS
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS work_contract_id uuid REFERENCES public.work_contracts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_work_contract_unique 
  ON public.conversations(work_contract_id) 
  WHERE work_contract_id IS NOT NULL;

-- Safely add work_contracts reference foreign keys back to hiring_requests & work_contracts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'hiring_requests_negotiation_room_id_fkey') THEN
    ALTER TABLE public.hiring_requests ADD CONSTRAINT hiring_requests_negotiation_room_id_fkey FOREIGN KEY (negotiation_room_id) REFERENCES public.negotiation_rooms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'hiring_requests_active_proposal_id_fkey') THEN
    ALTER TABLE public.hiring_requests ADD CONSTRAINT hiring_requests_active_proposal_id_fkey FOREIGN KEY (active_proposal_id) REFERENCES public.deal_proposals(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'hiring_requests_work_contract_id_fkey') THEN
    ALTER TABLE public.hiring_requests ADD CONSTRAINT hiring_requests_work_contract_id_fkey FOREIGN KEY (work_contract_id) REFERENCES public.work_contracts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'hiring_requests_permanent_conversation_id_fkey') THEN
    ALTER TABLE public.hiring_requests ADD CONSTRAINT hiring_requests_permanent_conversation_id_fkey FOREIGN KEY (permanent_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'work_contracts_permanent_conversation_id_fkey') THEN
    ALTER TABLE public.work_contracts ADD CONSTRAINT work_contracts_permanent_conversation_id_fkey FOREIGN KEY (permanent_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
END $$;


-- 7. ENABLE ROW LEVEL SECURITY AND POLICIES

-- A. negotiation_rooms RLS
ALTER TABLE public.negotiation_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view negotiation rooms" ON public.negotiation_rooms;
CREATE POLICY "Participants can view negotiation rooms" ON public.negotiation_rooms
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = worker_id);

-- B. negotiation_messages RLS
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room participants can view negotiation messages" ON public.negotiation_messages;
CREATE POLICY "Room participants can view negotiation messages" ON public.negotiation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.negotiation_rooms nr 
      WHERE nr.id = negotiation_messages.negotiation_room_id 
        AND (nr.client_id = auth.uid() OR nr.worker_id = auth.uid())
    )
  );

-- C. deal_proposals RLS
ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Request participants can view deal proposals" ON public.deal_proposals;
CREATE POLICY "Request participants can view deal proposals" ON public.deal_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.hiring_requests hr 
      WHERE hr.id = deal_proposals.hiring_request_id 
        AND (hr.client_id = auth.uid() OR hr.worker_id = auth.uid())
    )
  );

-- D. work_contracts RLS
ALTER TABLE public.work_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contract participants can view work contracts" ON public.work_contracts;
CREATE POLICY "Contract participants can view work contracts" ON public.work_contracts
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = worker_id);


-- =========================================================================
-- 8. SECURE RPC FUNCTIONS (SECURITY DEFINER)
-- =========================================================================

-- RPC A: accept_hiring_request(p_request_id uuid)
CREATE OR REPLACE FUNCTION public.accept_hiring_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
  v_room_id uuid;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found';
  END IF;

  IF v_req.worker_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the assigned worker can accept this hiring request';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid status transition: Request is not pending (current: %)', v_req.status;
  END IF;

  -- Create or retrieve existing negotiation room
  SELECT id INTO v_room_id
  FROM public.negotiation_rooms
  WHERE hiring_request_id = p_request_id;

  IF v_room_id IS NULL THEN
    INSERT INTO public.negotiation_rooms (
      hiring_request_id,
      client_id,
      worker_id,
      status
    ) VALUES (
      p_request_id,
      v_req.client_id,
      v_req.worker_id,
      'active'
    )
    RETURNING id INTO v_room_id;

    -- Insert system message
    INSERT INTO public.negotiation_messages (
      negotiation_room_id,
      sender_id,
      message_type,
      text
    ) VALUES (
      v_room_id,
      v_user_id,
      'system',
      'Worker accepted hiring request. Negotiation room activated.'
    );
  END IF;

  -- Update hiring request status
  UPDATE public.hiring_requests
  SET 
    status = 'negotiating',
    accepted_at = now(),
    negotiation_room_id = v_room_id,
    updated_at = now()
  WHERE id = p_request_id;

  v_result := jsonb_build_object(
    'request_id', p_request_id,
    'room_id', v_room_id,
    'status', 'negotiating'
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_hiring_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_hiring_request(uuid) TO authenticated;


-- RPC B: decline_hiring_request(p_request_id uuid, p_reason text)
CREATE OR REPLACE FUNCTION public.decline_hiring_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found';
  END IF;

  IF v_req.worker_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the assigned worker can decline this hiring request';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Invalid status: Only pending requests can be declined';
  END IF;

  UPDATE public.hiring_requests
  SET 
    status = 'rejected',
    declined_at = now(),
    decline_reason = trim(p_reason),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'rejected');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decline_hiring_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_hiring_request(uuid, text) TO authenticated;


-- RPC C: withdraw_hiring_request(p_request_id uuid, p_reason text)
CREATE OR REPLACE FUNCTION public.withdraw_hiring_request(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found';
  END IF;

  IF v_req.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Only the client can withdraw this request';
  END IF;

  IF v_req.status IN ('confirmed', 'completed', 'cancelled', 'withdrawn', 'rejected') THEN
    RAISE EXCEPTION 'Cannot withdraw request in current status: %', v_req.status;
  END IF;

  UPDATE public.hiring_requests
  SET 
    status = 'withdrawn',
    cancelled_at = now(),
    cancellation_reason = trim(p_reason),
    updated_at = now()
  WHERE id = p_request_id;

  IF v_req.negotiation_room_id IS NOT NULL THEN
    UPDATE public.negotiation_rooms
    SET status = 'cancelled', locked_at = now(), updated_at = now()
    WHERE id = v_req.negotiation_room_id;

    INSERT INTO public.negotiation_messages (
      negotiation_room_id, sender_id, message_type, text
    ) VALUES (
      v_req.negotiation_room_id, v_user_id, 'status_event', 'Client withdrew hiring request.'
    );
  END IF;

  RETURN jsonb_build_object('request_id', p_request_id, 'status', 'withdrawn');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.withdraw_hiring_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_hiring_request(uuid, text) TO authenticated;


-- RPC D: send_negotiation_message(p_room_id uuid, p_text text)
CREATE OR REPLACE FUNCTION public.send_negotiation_message(p_room_id uuid, p_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_room record;
  v_clean_text text;
  v_msg record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_text := trim(p_text);
  IF char_length(v_clean_text) = 0 THEN
    RAISE EXCEPTION 'Message text cannot be empty';
  END IF;
  IF char_length(v_clean_text) > 5000 THEN
    RAISE EXCEPTION 'Message text exceeds 5000 character limit';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negotiation room not found';
  END IF;

  IF v_room.client_id <> v_user_id AND v_room.worker_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not a participant in this negotiation room';
  END IF;

  IF v_room.status <> 'active' THEN
    RAISE EXCEPTION 'Negotiation room is % and cannot accept new messages', v_room.status;
  END IF;

  INSERT INTO public.negotiation_messages (
    negotiation_room_id,
    sender_id,
    message_type,
    text
  ) VALUES (
    p_room_id,
    v_user_id,
    'text',
    v_clean_text
  )
  RETURNING * INTO v_msg;

  UPDATE public.negotiation_rooms
  SET last_message_at = now(), updated_at = now()
  WHERE id = p_room_id;

  RETURN to_jsonb(v_msg);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_negotiation_message(uuid, text) TO authenticated;


-- RPC E: submit_deal_proposal(...)
CREATE OR REPLACE FUNCTION public.submit_deal_proposal(
  p_request_id uuid,
  p_work_title text,
  p_work_description text,
  p_final_price numeric,
  p_payment_type text,
  p_work_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_duration text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_additional_terms text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
  v_room record;
  v_next_version integer;
  v_proposal record;
  v_proposer_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_final_price < 0 THEN
    RAISE EXCEPTION 'Price cannot be negative';
  END IF;

  IF trim(p_work_title) = '' OR trim(p_work_description) = '' THEN
    RAISE EXCEPTION 'Work title and description are required';
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found';
  END IF;

  IF v_req.client_id <> v_user_id AND v_req.worker_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is neither client nor worker for this hiring request';
  END IF;

  IF v_req.status IN ('confirmed', 'completed', 'cancelled', 'withdrawn', 'rejected') THEN
    RAISE EXCEPTION 'Cannot submit proposal for hiring request in status: %', v_req.status;
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE hiring_request_id = p_request_id;

  IF NOT FOUND OR v_room.status <> 'active' THEN
    RAISE EXCEPTION 'Active negotiation room required to submit deal proposals';
  END IF;

  -- Supersede any current pending or changes_requested proposals
  UPDATE public.deal_proposals
  SET proposal_status = 'superseded', updated_at = now()
  WHERE hiring_request_id = p_request_id 
    AND proposal_status IN ('pending', 'changes_requested');

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.deal_proposals
  WHERE hiring_request_id = p_request_id;

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
    v_next_version,
    v_user_id,
    trim(p_work_title),
    trim(p_work_description),
    p_final_price,
    COALESCE(p_payment_type, 'fixed'),
    p_work_date,
    p_start_time,
    trim(p_duration),
    trim(p_location),
    trim(p_additional_terms),
    'pending',
    CASE WHEN v_user_id = v_req.client_id THEN 'accepted' ELSE 'pending' END,
    CASE WHEN v_user_id = v_req.worker_id THEN 'accepted' ELSE 'pending' END,
    CASE WHEN v_user_id = v_req.client_id THEN now() ELSE NULL END,
    CASE WHEN v_user_id = v_req.worker_id THEN now() ELSE NULL END
  )
  RETURNING * INTO v_proposal;

  -- Update hiring request state
  UPDATE public.hiring_requests
  SET 
    active_proposal_id = v_proposal.id,
    status = 'proposal_pending',
    updated_at = now()
  WHERE id = p_request_id;

  SELECT full_name INTO v_proposer_name FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.negotiation_messages (
    negotiation_room_id, sender_id, message_type, text, metadata
  ) VALUES (
    v_room.id,
    v_user_id,
    'proposal_event',
    'New deal proposal (v' || v_next_version || ') submitted by ' || COALESCE(v_proposer_name, 'Participant') || ' for ₹' || p_final_price || '.',
    jsonb_build_object('proposal_id', v_proposal.id, 'version', v_next_version, 'price', p_final_price)
  );

  RETURN to_jsonb(v_proposal);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text) TO authenticated;


-- RPC F: respond_to_deal_proposal(p_proposal_id uuid, p_response text, p_reason text)
CREATE OR REPLACE FUNCTION public.respond_to_deal_proposal(
  p_proposal_id uuid,
  p_response text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_prop record;
  v_req record;
  v_room record;
  v_is_client boolean;
  v_is_worker boolean;
  v_both_accepted boolean := false;
  v_contract_id uuid;
  v_conv_id uuid;
  v_client_name text;
  v_worker_name text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_response NOT IN ('accept', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid response option: %', p_response;
  END IF;

  SELECT * INTO v_prop
  FROM public.deal_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal proposal not found';
  END IF;

  IF v_prop.proposal_status IN ('superseded', 'rejected', 'accepted') THEN
    RAISE EXCEPTION 'Proposal is no longer active (status: %)', v_prop.proposal_status;
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = v_prop.hiring_request_id
  FOR UPDATE;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = v_prop.negotiation_room_id
  FOR UPDATE;

  v_is_client := (v_user_id = v_req.client_id);
  v_is_worker := (v_user_id = v_req.worker_id);

  IF NOT v_is_client AND NOT v_is_worker THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not part of this hiring workflow';
  END IF;

  -- 1. HANDLE REQUEST CHANGES
  IF p_response = 'request_changes' THEN
    UPDATE public.deal_proposals
    SET 
      proposal_status = 'changes_requested',
      client_response = CASE WHEN v_is_client THEN 'changes_requested' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'changes_requested' ELSE worker_response END,
      client_responded_at = CASE WHEN v_is_client THEN now() ELSE client_responded_at END,
      worker_responded_at = CASE WHEN v_is_worker THEN now() ELSE worker_responded_at END,
      updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.hiring_requests
    SET status = 'changes_requested', updated_at = now()
    WHERE id = v_req.id;

    INSERT INTO public.negotiation_messages (
      negotiation_room_id, sender_id, message_type, text, metadata
    ) VALUES (
      v_room.id, v_user_id, 'proposal_event',
      'Changes requested on proposal v' || v_prop.version_number || ': ' || COALESCE(trim(p_reason), 'No specific details provided.'),
      jsonb_build_object('proposal_id', p_proposal_id, 'response', 'changes_requested')
    );

    RETURN jsonb_build_object('proposal_id', p_proposal_id, 'confirmed', false, 'status', 'changes_requested');
  
  -- 2. HANDLE REJECT
  ELSIF p_response = 'reject' THEN
    UPDATE public.deal_proposals
    SET 
      proposal_status = 'rejected',
      client_response = CASE WHEN v_is_client THEN 'rejected' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'rejected' ELSE worker_response END,
      client_responded_at = CASE WHEN v_is_client THEN now() ELSE client_responded_at END,
      worker_responded_at = CASE WHEN v_is_worker THEN now() ELSE worker_responded_at END,
      updated_at = now()
    WHERE id = p_proposal_id;

    UPDATE public.hiring_requests
    SET status = 'negotiating', updated_at = now()
    WHERE id = v_req.id;

    INSERT INTO public.negotiation_messages (
      negotiation_room_id, sender_id, message_type, text, metadata
    ) VALUES (
      v_room.id, v_user_id, 'proposal_event',
      'Proposal v' || v_prop.version_number || ' was rejected.',
      jsonb_build_object('proposal_id', p_proposal_id, 'response', 'rejected')
    );

    RETURN jsonb_build_object('proposal_id', p_proposal_id, 'confirmed', false, 'status', 'rejected');

  -- 3. HANDLE ACCEPT
  ELSIF p_response = 'accept' THEN
    -- Update party response
    IF v_is_client THEN
      UPDATE public.deal_proposals
      SET client_response = 'accepted', client_responded_at = now(), updated_at = now()
      WHERE id = p_proposal_id;
    END IF;
    IF v_is_worker THEN
      UPDATE public.deal_proposals
      SET worker_response = 'accepted', worker_responded_at = now(), updated_at = now()
      WHERE id = p_proposal_id;
    END IF;

    -- Re-check if both parties have accepted
    SELECT (client_response = 'accepted' AND worker_response = 'accepted') INTO v_both_accepted
    FROM public.deal_proposals
    WHERE id = p_proposal_id;

    IF v_both_accepted THEN
      -- Mark proposal accepted
      UPDATE public.deal_proposals
      SET proposal_status = 'accepted', updated_at = now()
      WHERE id = p_proposal_id;

      -- Check if work contract already created for this hiring request
      SELECT id INTO v_contract_id
      FROM public.work_contracts
      WHERE hiring_request_id = v_req.id;

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
          v_req.id,
          p_proposal_id,
          v_req.client_id,
          v_req.worker_id,
          v_prop.work_title,
          v_prop.work_description,
          v_prop.final_price,
          v_prop.payment_type,
          v_prop.work_date,
          v_prop.start_time,
          v_prop.duration,
          v_prop.location,
          v_prop.additional_terms,
          'active',
          now()
        )
        RETURNING id INTO v_contract_id;
      END IF;

      -- Create permanent main chat conversation
      SELECT id INTO v_conv_id
      FROM public.conversations
      WHERE work_contract_id = v_contract_id;

      IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (
          creator_id,
          member_id,
          conversation_type,
          work_contract_id,
          last_message_text,
          last_message_time
        ) VALUES (
          v_req.client_id,
          v_req.worker_id,
          'work_contract',
          v_contract_id,
          'Work contract confirmed. Permanent main chat unlocked.',
          now()
        )
        RETURNING id INTO v_conv_id;

        -- Populate conversation_members
        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES 
          (v_conv_id, v_req.client_id),
          (v_conv_id, v_req.worker_id)
        ON CONFLICT DO NOTHING;

        -- Insert permanent system message
        SELECT full_name INTO v_client_name FROM public.profiles WHERE id = v_req.client_id;

        INSERT INTO public.messages (
          conversation_id,
          sender_id,
          sender_name,
          text,
          role
        ) VALUES (
          v_conv_id,
          v_req.client_id,
          COALESCE(v_client_name, 'System'),
          'Work contract confirmed. You can now communicate directly regarding this project.',
          'system'
        );
      END IF;

      -- Link conversation to contract
      UPDATE public.work_contracts
      SET permanent_conversation_id = v_conv_id, updated_at = now()
      WHERE id = v_contract_id;

      -- Update hiring request state
      UPDATE public.hiring_requests
      SET 
        status = 'confirmed',
        confirmed_at = now(),
        work_contract_id = v_contract_id,
        permanent_conversation_id = v_conv_id,
        updated_at = now()
      WHERE id = v_req.id;

      -- Lock negotiation room
      UPDATE public.negotiation_rooms
      SET status = 'locked', locked_at = now(), updated_at = now()
      WHERE id = v_room.id;

      INSERT INTO public.negotiation_messages (
        negotiation_room_id, sender_id, message_type, text, metadata
      ) VALUES (
        v_room.id, v_user_id, 'status_event',
        'Deal confirmed! Work contract created and permanent chat unlocked.',
        jsonb_build_object('contract_id', v_contract_id, 'conversation_id', v_conv_id)
      );

      RETURN jsonb_build_object(
        'proposal_id', p_proposal_id,
        'hiring_request_id', v_req.id,
        'contract_id', v_contract_id,
        'conversation_id', v_conv_id,
        'confirmed', true
      );
    ELSE
      INSERT INTO public.negotiation_messages (
        negotiation_room_id, sender_id, message_type, text, metadata
      ) VALUES (
        v_room.id, v_user_id, 'proposal_event',
        'Accepted deal proposal v' || v_prop.version_number || '. Awaiting response from other party.',
        jsonb_build_object('proposal_id', p_proposal_id, 'response', 'accepted')
      );

      RETURN jsonb_build_object(
        'proposal_id', p_proposal_id,
        'hiring_request_id', v_req.id,
        'confirmed', false,
        'status', 'accepted_pending_other_party'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('proposal_id', p_proposal_id, 'confirmed', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) TO authenticated;


-- RPC G: get_hire_workflow_details(p_request_id uuid)
CREATE OR REPLACE FUNCTION public.get_hire_workflow_details(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_req record;
  v_room record;
  v_active_proposal record;
  v_contract record;
  v_messages jsonb;
  v_proposals jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req
  FROM public.hiring_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hiring request not found';
  END IF;

  IF v_req.client_id <> v_user_id AND v_req.worker_id <> v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is neither client nor worker for this hiring request';
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE hiring_request_id = p_request_id;

  SELECT * INTO v_active_proposal
  FROM public.deal_proposals
  WHERE hiring_request_id = p_request_id
    AND proposal_status IN ('pending', 'changes_requested', 'accepted')
  ORDER BY version_number DESC
  LIMIT 1;

  SELECT * INTO v_contract
  FROM public.work_contracts
  WHERE hiring_request_id = p_request_id;

  IF v_room.id IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(nm) ORDER BY nm.created_at ASC) INTO v_messages
    FROM (
      SELECT * FROM public.negotiation_messages
      WHERE negotiation_room_id = v_room.id
      ORDER BY created_at ASC
      LIMIT 200
    ) nm;
  ELSE
    v_messages := '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(to_jsonb(dp) ORDER BY dp.version_number DESC) INTO v_proposals
  FROM public.deal_proposals dp
  WHERE dp.hiring_request_id = p_request_id;

  RETURN jsonb_build_object(
    'hiring_request', to_jsonb(v_req),
    'negotiation_room', CASE WHEN v_room.id IS NOT NULL THEN to_jsonb(v_room) ELSE NULL END,
    'active_proposal', CASE WHEN v_active_proposal.id IS NOT NULL THEN to_jsonb(v_active_proposal) ELSE NULL END,
    'work_contract', CASE WHEN v_contract.id IS NOT NULL THEN to_jsonb(v_contract) ELSE NULL END,
    'negotiation_messages', COALESCE(v_messages, '[]'::jsonb),
    'deal_proposals_history', COALESCE(v_proposals, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_hire_workflow_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hire_workflow_details(uuid) TO authenticated;


-- RPC H: get_hiring_requests_for_current_user()
CREATE OR REPLACE FUNCTION public.get_hiring_requests_for_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_agg(
    to_jsonb(hr.*) || jsonb_build_object(
      'client_avatar', cp.avatar_url,
      'client_full_name', cp.full_name,
      'worker_avatar', wp.avatar_url,
      'worker_full_name', wp.full_name
    )
    ORDER BY hr.created_at DESC
  ) INTO v_result
  FROM public.hiring_requests hr
  LEFT JOIN public.profiles cp ON cp.id = hr.client_id
  LEFT JOIN public.profiles wp ON wp.id = hr.worker_id
  WHERE hr.client_id = v_user_id OR hr.worker_id = v_user_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_hiring_requests_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hiring_requests_for_current_user() TO authenticated;


-- 9. REALTIME PUBLICATION CONFIGURATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_rooms;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.negotiation_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_proposals;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.work_contracts;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, reload_schema;
