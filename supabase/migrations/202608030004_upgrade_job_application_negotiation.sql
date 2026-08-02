-- =============================================================================
-- Migration: 202608030004_upgrade_job_application_negotiation.sql
-- Description: Extend negotiation, deal proposal, work contract and lifecycle engine
--              to support both Direct Hire Requests and Job Applications.
-- Author: OpenComm Engineering Team
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Extend public.job_applications Columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS negotiation_room_id uuid,
  ADD COLUMN IF NOT EXISTS active_proposal_id uuid,
  ADD COLUMN IF NOT EXISTS work_contract_id uuid,
  ADD COLUMN IF NOT EXISTS permanent_conversation_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Update status check constraint on job_applications
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN (
    'pending', 'under_review', 'shortlisted',
    'negotiating', 'proposal_pending', 'changes_requested',
    'confirmed', 'cancelled', 'completed', 'expired',
    'accepted', 'rejected', 'withdrawn'
  ));

-- -----------------------------------------------------------------------------
-- 2. Update public.negotiation_rooms Table
-- -----------------------------------------------------------------------------
ALTER TABLE public.negotiation_rooms
  ALTER COLUMN hiring_request_id DROP NOT NULL;

ALTER TABLE public.negotiation_rooms
  ADD COLUMN IF NOT EXISTS job_application_id uuid REFERENCES public.job_applications(id) ON DELETE CASCADE;

ALTER TABLE public.negotiation_rooms
  DROP CONSTRAINT IF EXISTS negotiation_rooms_single_source_check;

ALTER TABLE public.negotiation_rooms
  ADD CONSTRAINT negotiation_rooms_single_source_check
  CHECK (
    (hiring_request_id IS NOT NULL AND job_application_id IS NULL) OR
    (hiring_request_id IS NULL AND job_application_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_negotiation_rooms_unique_app
  ON public.negotiation_rooms(job_application_id)
  WHERE job_application_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Update public.deal_proposals Table
-- -----------------------------------------------------------------------------
ALTER TABLE public.deal_proposals
  ALTER COLUMN hiring_request_id DROP NOT NULL;

ALTER TABLE public.deal_proposals
  ADD COLUMN IF NOT EXISTS job_application_id uuid REFERENCES public.job_applications(id) ON DELETE CASCADE;

ALTER TABLE public.deal_proposals
  DROP CONSTRAINT IF EXISTS deal_proposals_single_source_check;

ALTER TABLE public.deal_proposals
  ADD CONSTRAINT deal_proposals_single_source_check
  CHECK (
    (hiring_request_id IS NOT NULL AND job_application_id IS NULL) OR
    (hiring_request_id IS NULL AND job_application_id IS NOT NULL)
  );

-- -----------------------------------------------------------------------------
-- 4. Update public.work_contracts Table
-- -----------------------------------------------------------------------------
ALTER TABLE public.work_contracts
  ALTER COLUMN hiring_request_id DROP NOT NULL;

ALTER TABLE public.work_contracts
  ADD COLUMN IF NOT EXISTS job_application_id uuid REFERENCES public.job_applications(id) ON DELETE CASCADE;

ALTER TABLE public.work_contracts
  DROP CONSTRAINT IF EXISTS work_contracts_single_source_check;

ALTER TABLE public.work_contracts
  ADD CONSTRAINT work_contracts_single_source_check
  CHECK (
    (hiring_request_id IS NOT NULL AND job_application_id IS NULL) OR
    (hiring_request_id IS NULL AND job_application_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_contracts_unique_app
  ON public.work_contracts(job_application_id)
  WHERE job_application_id IS NOT NULL;

-- Add foreign key constraints on job_applications for workflow tables
ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_negotiation_room_id_fkey,
  DROP CONSTRAINT IF EXISTS job_applications_active_proposal_id_fkey,
  DROP CONSTRAINT IF EXISTS job_applications_work_contract_id_fkey,
  DROP CONSTRAINT IF EXISTS job_applications_permanent_conversation_id_fkey;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_negotiation_room_id_fkey
  FOREIGN KEY (negotiation_room_id) REFERENCES public.negotiation_rooms(id) ON DELETE SET NULL,
  ADD CONSTRAINT job_applications_active_proposal_id_fkey
  FOREIGN KEY (active_proposal_id) REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  ADD CONSTRAINT job_applications_work_contract_id_fkey
  FOREIGN KEY (work_contract_id) REFERENCES public.work_contracts(id) ON DELETE SET NULL,
  ADD CONSTRAINT job_applications_permanent_conversation_id_fkey
  FOREIGN KEY (permanent_conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 5. RLS Policies Updates
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can view deal proposals by application" ON public.deal_proposals;

CREATE POLICY "Participants can view deal proposals by application"
  ON public.deal_proposals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      JOIN public.jobs j ON j.id = ja.job_id
      WHERE ja.id = deal_proposals.job_application_id
        AND (ja.applicant_id = auth.uid() OR j.posted_by = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 6. RPC: start_job_application_negotiation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_job_application_negotiation(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_app RECORD;
  v_room_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  -- Lock application
  SELECT ja.id, ja.status, ja.applicant_id, ja.job_id, j.posted_by AS job_owner
  INTO v_app
  FROM public.job_applications ja
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id
  FOR UPDATE OF ja;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job application not found.';
  END IF;

  IF v_app.job_owner != v_user_id THEN
    RAISE EXCEPTION 'Only the job owner can start negotiation for this application.';
  END IF;

  IF v_app.status NOT IN ('pending', 'under_review', 'shortlisted') THEN
    RAISE EXCEPTION 'Cannot start negotiation for an application with status: %', v_app.status;
  END IF;

  -- Create or reuse negotiation room
  INSERT INTO public.negotiation_rooms (job_application_id, client_id, worker_id, status, last_message_at)
  VALUES (v_app.id, v_app.job_owner, v_app.applicant_id, 'active', now())
  ON CONFLICT (job_application_id)
  DO UPDATE SET status = 'active', updated_at = now()
  RETURNING id INTO v_room_id;

  -- Update application status
  UPDATE public.job_applications
  SET
    status = 'negotiating',
    negotiation_room_id = v_room_id,
    updated_at = now()
  WHERE id = p_application_id;

  -- Add system message
  INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
  VALUES (
    v_room_id,
    v_user_id,
    'system',
    'Negotiation started! Use this room to discuss scope, schedule, and final contract terms.'
  );

  RETURN jsonb_build_object(
    'application_id', p_application_id,
    'status', 'negotiating',
    'negotiation_room_id', v_room_id,
    'message', 'Negotiation started successfully.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: get_application_workflow_details
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_application_workflow_details(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_app RECORD;
  v_job RECORD;
  v_applicant_prof jsonb;
  v_employer_prof jsonb;
  v_room RECORD;
  v_active_prop RECORD;
  v_contract RECORD;
  v_messages jsonb := '[]'::jsonb;
  v_proposals_history jsonb := '[]'::jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT ja.*, j.posted_by AS job_owner
  INTO v_app
  FROM public.job_applications ja
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job application not found.';
  END IF;

  IF v_app.applicant_id != v_user_id AND v_app.job_owner != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You are not a participant in this application.';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = v_app.job_id;

  SELECT jsonb_build_object('id', id, 'full_name', full_name, 'avatar_url', avatar_url) INTO v_applicant_prof
  FROM public.profiles WHERE id = v_app.applicant_id;

  SELECT jsonb_build_object('id', id, 'full_name', full_name, 'avatar_url', avatar_url) INTO v_employer_prof
  FROM public.profiles WHERE id = v_app.job_owner;

  SELECT * INTO v_room FROM public.negotiation_rooms WHERE job_application_id = p_application_id;

  IF v_room.id IS NOT NULL THEN
    SELECT jsonb_agg(to_jsonb(m.*) ORDER BY m.created_at ASC) INTO v_messages
    FROM public.negotiation_messages m
    WHERE m.negotiation_room_id = v_room.id;
  END IF;

  IF v_app.active_proposal_id IS NOT NULL THEN
    SELECT * INTO v_active_prop FROM public.deal_proposals WHERE id = v_app.active_proposal_id;
  END IF;

  SELECT jsonb_agg(to_jsonb(dp.*) ORDER BY dp.version_number DESC) INTO v_proposals_history
  FROM public.deal_proposals dp
  WHERE dp.job_application_id = p_application_id;

  IF v_app.work_contract_id IS NOT NULL THEN
    SELECT * INTO v_contract FROM public.work_contracts WHERE id = v_app.work_contract_id;
  END IF;

  RETURN jsonb_build_object(
    'job_application', to_jsonb(v_app),
    'job', to_jsonb(v_job),
    'applicant_profile', COALESCE(v_applicant_prof, '{}'::jsonb),
    'employer_profile', COALESCE(v_employer_prof, '{}'::jsonb),
    'negotiation_room', to_jsonb(v_room),
    'active_proposal', to_jsonb(v_active_prop),
    'work_contract', to_jsonb(v_contract),
    'negotiation_messages', COALESCE(v_messages, '[]'::jsonb),
    'deal_proposals_history', COALESCE(v_proposals_history, '[]'::jsonb)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Updated submit_deal_proposal RPC (Dual-Source Support)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_deal_proposal(
  p_request_id uuid DEFAULT NULL,
  p_work_title text DEFAULT '',
  p_work_description text DEFAULT '',
  p_final_price numeric DEFAULT 0,
  p_payment_type text DEFAULT 'fixed',
  p_work_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_duration text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_additional_terms text DEFAULT NULL,
  p_application_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_request public.hiring_requests%ROWTYPE;
  v_app RECORD;
  v_room public.negotiation_rooms%ROWTYPE;
  v_client_id uuid;
  v_worker_id uuid;
  v_version integer;
  v_proposal_id uuid;
  v_client_resp text;
  v_worker_resp text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_request_id IS NULL AND p_application_id IS NULL THEN
    RAISE EXCEPTION 'Either p_request_id or p_application_id must be provided.';
  END IF;

  IF p_application_id IS NOT NULL THEN
    -- Job Application path
    SELECT ja.id, ja.status, ja.applicant_id, ja.job_id, j.posted_by AS job_owner
    INTO v_app
    FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    WHERE ja.id = p_application_id
    FOR UPDATE OF ja;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Job application not found.';
    END IF;

    v_client_id := v_app.job_owner;
    v_worker_id := v_app.applicant_id;

    IF v_client_id != v_user_id AND v_worker_id != v_user_id THEN
      RAISE EXCEPTION 'Only employer or applicant can submit deal proposals.';
    END IF;

    SELECT * INTO v_room
    FROM public.negotiation_rooms
    WHERE job_application_id = p_application_id
    FOR UPDATE;
  ELSE
    -- Direct Hire path
    SELECT * INTO v_request
    FROM public.hiring_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Hiring request not found.';
    END IF;

    v_client_id := v_request.client_id;
    v_worker_id := v_request.worker_id;

    IF v_client_id != v_user_id AND v_worker_id != v_user_id THEN
      RAISE EXCEPTION 'Only client or worker can submit deal proposals.';
    END IF;

    SELECT * INTO v_room
    FROM public.negotiation_rooms
    WHERE hiring_request_id = p_request_id
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active negotiation room required before submitting a deal proposal.';
  END IF;

  IF v_room.status != 'active' THEN
    RAISE EXCEPTION 'Negotiation room is locked or closed.';
  END IF;

  IF p_application_id IS NOT NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.deal_proposals WHERE job_application_id = p_application_id;

    UPDATE public.deal_proposals
    SET proposal_status = 'superseded', updated_at = now()
    WHERE job_application_id = p_application_id AND proposal_status IN ('pending', 'changes_requested');
  ELSE
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
    FROM public.deal_proposals WHERE hiring_request_id = p_request_id;

    UPDATE public.deal_proposals
    SET proposal_status = 'superseded', updated_at = now()
    WHERE hiring_request_id = p_request_id AND proposal_status IN ('pending', 'changes_requested');
  END IF;

  IF v_user_id = v_client_id THEN
    v_client_resp := 'accepted';
    v_worker_resp := 'pending';
  ELSE
    v_client_resp := 'pending';
    v_worker_resp := 'accepted';
  END IF;

  INSERT INTO public.deal_proposals (
    hiring_request_id,
    job_application_id,
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
    p_application_id,
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

  IF p_application_id IS NOT NULL THEN
    UPDATE public.job_applications
    SET active_proposal_id = v_proposal_id, status = 'proposal_pending', updated_at = now()
    WHERE id = p_application_id;
  ELSE
    UPDATE public.hiring_requests
    SET active_proposal_id = v_proposal_id, status = 'proposal_pending', updated_at = now()
    WHERE id = p_request_id;
  END IF;

  UPDATE public.negotiation_rooms SET updated_at = now() WHERE id = v_room.id;

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
-- 9. Updated respond_to_deal_proposal RPC (Dual-Source Support)
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
  v_app RECORD;
  v_room public.negotiation_rooms%ROWTYPE;
  v_client_id uuid;
  v_worker_id uuid;
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

  IF v_proposal.job_application_id IS NOT NULL THEN
    SELECT ja.id, ja.status, ja.applicant_id, ja.job_id, j.posted_by AS job_owner
    INTO v_app
    FROM public.job_applications ja
    JOIN public.jobs j ON j.id = ja.job_id
    WHERE ja.id = v_proposal.job_application_id
    FOR UPDATE OF ja;

    v_client_id := v_app.job_owner;
    v_worker_id := v_app.applicant_id;
  ELSE
    SELECT * INTO v_request
    FROM public.hiring_requests
    WHERE id = v_proposal.hiring_request_id
    FOR UPDATE;

    v_client_id := v_request.client_id;
    v_worker_id := v_request.worker_id;
  END IF;

  SELECT * INTO v_room
  FROM public.negotiation_rooms
  WHERE id = v_proposal.negotiation_room_id
  FOR UPDATE;

  v_is_client := (v_client_id = v_user_id);
  v_is_worker := (v_worker_id = v_user_id);

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

      -- Check existing contract
      IF v_proposal.job_application_id IS NOT NULL THEN
        SELECT id INTO v_contract_id FROM public.work_contracts WHERE job_application_id = v_app.id;
      ELSE
        SELECT id INTO v_contract_id FROM public.work_contracts WHERE hiring_request_id = v_request.id;
      END IF;

      IF v_contract_id IS NULL THEN
        INSERT INTO public.work_contracts (
          hiring_request_id,
          job_application_id,
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
          v_proposal.hiring_request_id,
          v_proposal.job_application_id,
          v_proposal.id,
          v_client_id,
          v_worker_id,
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
          v_client_id,
          v_worker_id,
          'work_contract',
          v_contract_id,
          'Work Contract confirmed! Official project conversation thread opened.',
          now()
        ) RETURNING id INTO v_conv_id;

        INSERT INTO public.conversation_members (conversation_id, user_id)
        VALUES
          (v_conv_id, v_client_id),
          (v_conv_id, v_worker_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;

        INSERT INTO public.messages (
          conversation_id,
          sender_id,
          sender_name,
          text,
          role,
          unread
        ) VALUES (
          v_conv_id,
          v_client_id,
          'OpenComm System',
          'Work Contract confirmed! Official project conversation thread opened.',
          'system',
          true
        );
      END IF;

      UPDATE public.work_contracts
      SET permanent_conversation_id = v_conv_id
      WHERE id = v_contract_id;

      IF v_proposal.job_application_id IS NOT NULL THEN
        UPDATE public.job_applications
        SET
          status = 'confirmed',
          confirmed_at = now(),
          work_contract_id = v_contract_id,
          permanent_conversation_id = v_conv_id,
          updated_at = now()
        WHERE id = v_app.id;
      ELSE
        UPDATE public.hiring_requests
        SET
          status = 'confirmed',
          confirmed_at = now(),
          work_contract_id = v_contract_id,
          permanent_conversation_id = v_conv_id,
          updated_at = now()
        WHERE id = v_request.id;
      END IF;

      UPDATE public.negotiation_rooms
      SET status = 'locked', locked_at = now(), updated_at = now()
      WHERE id = v_proposal.negotiation_room_id;

      INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
      VALUES (
        v_proposal.negotiation_room_id,
        v_user_id,
        'status_event',
        'Deal Proposal accepted by both parties! Work Contract signed and activated.'
      );
    END IF;

    RETURN json_build_object(
      'proposal_id', p_proposal_id,
      'response', 'accepted',
      'both_accepted', v_both_accepted,
      'work_contract_id', v_contract_id,
      'permanent_conversation_id', v_conv_id,
      'message', CASE WHEN v_both_accepted THEN 'Proposal accepted by both parties. Work Contract created!' ELSE 'Proposal accepted. Awaiting other party confirmation.' END
    );

  ELSIF p_response = 'reject' THEN
    UPDATE public.deal_proposals
    SET
      proposal_status = 'rejected',
      rejection_reason = trim(COALESCE(p_reason, '')),
      client_response = CASE WHEN v_is_client THEN 'rejected' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'rejected' ELSE worker_response END,
      client_responded_at = CASE WHEN v_is_client THEN now() ELSE client_responded_at END,
      worker_responded_at = CASE WHEN v_is_worker THEN now() ELSE worker_responded_at END,
      updated_at = now()
    WHERE id = p_proposal_id;

    IF v_proposal.job_application_id IS NOT NULL THEN
      UPDATE public.job_applications SET status = 'negotiating', updated_at = now() WHERE id = v_app.id;
    ELSE
      UPDATE public.hiring_requests SET status = 'negotiating', updated_at = now() WHERE id = v_request.id;
    END IF;

    INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
    VALUES (
      v_proposal.negotiation_room_id,
      v_user_id,
      'proposal_event',
      'Proposal rejected: ' || COALESCE(trim(p_reason), 'No reason specified.')
    );

    RETURN json_build_object(
      'proposal_id', p_proposal_id,
      'response', 'rejected',
      'message', 'Proposal rejected. Room returned to active negotiation.'
    );

  ELSE
    -- request_changes
    UPDATE public.deal_proposals
    SET
      proposal_status = 'changes_requested',
      change_request_notes = trim(COALESCE(p_reason, '')),
      client_response = CASE WHEN v_is_client THEN 'changes_requested' ELSE client_response END,
      worker_response = CASE WHEN v_is_worker THEN 'changes_requested' ELSE worker_response END,
      client_responded_at = CASE WHEN v_is_client THEN now() ELSE client_responded_at END,
      worker_responded_at = CASE WHEN v_is_worker THEN now() ELSE worker_responded_at END,
      updated_at = now()
    WHERE id = p_proposal_id;

    IF v_proposal.job_application_id IS NOT NULL THEN
      UPDATE public.job_applications SET status = 'changes_requested', updated_at = now() WHERE id = v_app.id;
    ELSE
      UPDATE public.hiring_requests SET status = 'changes_requested', updated_at = now() WHERE id = v_request.id;
    END IF;

    INSERT INTO public.negotiation_messages (negotiation_room_id, sender_id, message_type, text)
    VALUES (
      v_proposal.negotiation_room_id,
      v_user_id,
      'proposal_event',
      'Changes requested on deal proposal: ' || COALESCE(trim(p_reason), 'No specific notes provided.')
    );

    RETURN json_build_object(
      'proposal_id', p_proposal_id,
      'response', 'changes_requested',
      'message', 'Changes requested for deal proposal.'
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Update Contract Lifecycle RPCs (Dual-Source Support)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_contract_cancellation(
  p_contract_id UUID,
  p_response TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_action TEXT;
  v_trimmed_reason TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_action := lower(trim(COALESCE(p_response, '')));
  IF v_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Invalid response. Must be accept or reject.';
  END IF;

  v_trimmed_reason := trim(COALESCE(p_reason, ''));
  IF v_action = 'reject' AND v_trimmed_reason = '' THEN
    RAISE EXCEPTION 'Rejection reason is required.';
  END IF;

  SELECT * INTO v_contract
  FROM public.work_contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work contract not found.';
  END IF;

  IF v_contract.client_id != v_user_id AND v_contract.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You are not a party to this contract.';
  END IF;

  IF v_contract.status != 'cancellation_requested' THEN
    RAISE EXCEPTION 'Contract is not currently awaiting cancellation response.';
  END IF;

  IF v_contract.cancellation_requested_by = v_user_id THEN
    RAISE EXCEPTION 'You cannot respond to your own cancellation request.';
  END IF;

  IF v_action = 'accept' THEN
    UPDATE public.work_contracts
    SET
      status = 'cancelled',
      cancelled_at = v_now,
      cancellation_client_response = 'accepted',
      cancellation_worker_response = 'accepted',
      cancellation_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE cancellation_client_responded_at END,
      cancellation_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE cancellation_worker_responded_at END,
      updated_at = v_now
    WHERE id = p_contract_id;

    -- Update linked source status to cancelled
    IF v_contract.job_application_id IS NOT NULL THEN
      UPDATE public.job_applications SET status = 'cancelled', cancelled_at = v_now, updated_at = v_now WHERE id = v_contract.job_application_id;
    ELSIF v_contract.hiring_request_id IS NOT NULL THEN
      UPDATE public.hiring_requests SET status = 'cancelled', cancelled_at = v_now, updated_at = v_now WHERE id = v_contract.hiring_request_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Contract has been mutually cancelled.',
      'contract_id', p_contract_id,
      'status', 'cancelled'
    );
  ELSE
    UPDATE public.work_contracts
    SET
      status = 'active',
      cancellation_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'rejected' ELSE cancellation_client_response END,
      cancellation_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'rejected' ELSE cancellation_worker_response END,
      cancellation_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE cancellation_client_responded_at END,
      cancellation_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE cancellation_worker_responded_at END,
      cancellation_rejection_reason = v_trimmed_reason,
      updated_at = v_now
    WHERE id = p_contract_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Cancellation request rejected. Contract remains active.',
      'contract_id', p_contract_id,
      'status', 'active'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_contract_completion(
  p_contract_id UUID,
  p_response TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_action TEXT;
  v_trimmed_reason TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_action := lower(trim(COALESCE(p_response, '')));
  IF v_action NOT IN ('accept', 'reject') THEN
    RAISE EXCEPTION 'Invalid response. Must be accept or reject.';
  END IF;

  v_trimmed_reason := trim(COALESCE(p_reason, ''));
  IF v_action = 'reject' AND v_trimmed_reason = '' THEN
    RAISE EXCEPTION 'Rejection reason is required.';
  END IF;

  SELECT * INTO v_contract
  FROM public.work_contracts
  WHERE id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work contract not found.';
  END IF;

  IF v_contract.client_id != v_user_id AND v_contract.worker_id != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You are not a party to this contract.';
  END IF;

  IF v_contract.status != 'completion_requested' THEN
    RAISE EXCEPTION 'Contract is not currently awaiting completion response.';
  END IF;

  IF v_contract.completion_requested_by = v_user_id THEN
    RAISE EXCEPTION 'You cannot respond to your own completion request.';
  END IF;

  IF v_action = 'accept' THEN
    UPDATE public.work_contracts
    SET
      status = 'completed',
      completed_at = v_now,
      completion_client_response = 'accepted',
      completion_worker_response = 'accepted',
      completion_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE completion_client_responded_at END,
      completion_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE completion_worker_responded_at END,
      updated_at = v_now
    WHERE id = p_contract_id;

    -- Update linked source status to completed
    IF v_contract.job_application_id IS NOT NULL THEN
      UPDATE public.job_applications SET status = 'completed', completed_at = v_now, updated_at = v_now WHERE id = v_contract.job_application_id;
    ELSIF v_contract.hiring_request_id IS NOT NULL THEN
      UPDATE public.hiring_requests SET status = 'completed', updated_at = v_now WHERE id = v_contract.hiring_request_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Contract has been mutually completed.',
      'contract_id', p_contract_id,
      'status', 'completed'
    );
  ELSE
    UPDATE public.work_contracts
    SET
      status = 'active',
      completion_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'rejected' ELSE completion_client_response END,
      completion_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'rejected' ELSE completion_worker_response END,
      completion_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE completion_client_responded_at END,
      completion_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE completion_worker_responded_at END,
      completion_rejection_reason = v_trimmed_reason,
      updated_at = v_now
    WHERE id = p_contract_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Completion request rejected. Contract remains active.',
      'contract_id', p_contract_id,
      'status', 'active'
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Permissions Lockdown
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.start_job_application_negotiation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_application_workflow_details(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_job_application_negotiation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_application_workflow_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_deal_proposal(uuid, text, text, numeric, text, date, time, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_deal_proposal(uuid, text, text) TO authenticated;

COMMIT;
