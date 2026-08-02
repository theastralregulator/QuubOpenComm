-- Migration: Add Mutual Contract Cancellation and Mutual Completion schema & RPCs

-- 1. Update work_contracts status check constraint to include cancellation_requested & completion_requested
ALTER TABLE public.work_contracts
  DROP CONSTRAINT IF EXISTS work_contracts_status_check;

ALTER TABLE public.work_contracts
  ADD CONSTRAINT work_contracts_status_check
  CHECK (status IN ('active', 'cancellation_requested', 'cancelled', 'completion_requested', 'completed', 'disputed'));

-- 2. Add mutual cancellation tracking columns to work_contracts
ALTER TABLE public.work_contracts
  ADD COLUMN IF NOT EXISTS cancellation_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_client_response TEXT CHECK (cancellation_client_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS cancellation_worker_response TEXT CHECK (cancellation_worker_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS cancellation_client_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_worker_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_rejection_reason TEXT;

-- 3. Add mutual completion tracking columns to work_contracts
ALTER TABLE public.work_contracts
  ADD COLUMN IF NOT EXISTS completion_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_note TEXT,
  ADD COLUMN IF NOT EXISTS completion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_client_response TEXT CHECK (completion_client_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS completion_worker_response TEXT CHECK (completion_worker_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS completion_client_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_worker_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_rejection_reason TEXT;

-- 4. RPC: request_contract_cancellation
CREATE OR REPLACE FUNCTION public.request_contract_cancellation(
  p_contract_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_trimmed_reason TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_trimmed_reason := trim(COALESCE(p_reason, ''));
  IF v_trimmed_reason = '' THEN
    RAISE EXCEPTION 'Cancellation reason is required.';
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

  IF v_contract.status != 'active' THEN
    IF v_contract.status = 'cancellation_requested' THEN
      RAISE EXCEPTION 'A cancellation request is already pending for this contract.';
    ELSE
      RAISE EXCEPTION 'Cannot cancel a contract with status: %', v_contract.status;
    END IF;
  END IF;

  UPDATE public.work_contracts
  SET
    status = 'cancellation_requested',
    cancellation_requested_by = v_user_id,
    cancellation_reason = v_trimmed_reason,
    cancellation_requested_at = now(),
    cancellation_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'accepted' ELSE 'pending' END,
    cancellation_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'accepted' ELSE 'pending' END,
    cancellation_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN now() ELSE NULL END,
    cancellation_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN now() ELSE NULL END,
    cancellation_rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cancellation requested successfully. Awaiting confirmation from the other party.',
    'contract_id', p_contract_id,
    'status', 'cancellation_requested'
  );
END;
$$;

-- 5. RPC: respond_to_contract_cancellation
CREATE OR REPLACE FUNCTION public.respond_to_contract_cancellation(
  p_contract_id UUID,
  p_response TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_action TEXT;
  v_new_status TEXT;
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
    v_new_status := 'cancelled';

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

    -- Update linked hiring_request status to cancelled
    UPDATE public.hiring_requests
    SET status = 'cancelled', updated_at = v_now
    WHERE id = v_contract.hiring_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Contract has been mutually cancelled.',
      'contract_id', p_contract_id,
      'status', 'cancelled'
    );
  ELSE
    -- Rejection
    UPDATE public.work_contracts
    SET
      status = 'active',
      cancellation_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'rejected' ELSE cancellation_client_response END,
      cancellation_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'rejected' ELSE cancellation_worker_response END,
      cancellation_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE cancellation_client_responded_at END,
      cancellation_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE cancellation_worker_responded_at END,
      cancellation_rejection_reason = trim(COALESCE(p_reason, '')),
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

-- 6. RPC: request_contract_completion
CREATE OR REPLACE FUNCTION public.request_contract_completion(
  p_contract_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_trimmed_note TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  v_trimmed_note := trim(COALESCE(p_note, ''));

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

  IF v_contract.status != 'active' THEN
    IF v_contract.status = 'completion_requested' THEN
      RAISE EXCEPTION 'A completion request is already pending for this contract.';
    ELSE
      RAISE EXCEPTION 'Cannot mark completion for contract with status: %', v_contract.status;
    END IF;
  END IF;

  UPDATE public.work_contracts
  SET
    status = 'completion_requested',
    completion_requested_by = v_user_id,
    completion_note = v_trimmed_note,
    completion_requested_at = now(),
    completion_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'accepted' ELSE 'pending' END,
    completion_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'accepted' ELSE 'pending' END,
    completion_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN now() ELSE NULL END,
    completion_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN now() ELSE NULL END,
    completion_rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Completion requested successfully. Awaiting confirmation from the other party.',
    'contract_id', p_contract_id,
    'status', 'completion_requested'
  );
END;
$$;

-- 7. RPC: respond_to_contract_completion
CREATE OR REPLACE FUNCTION public.respond_to_contract_completion(
  p_contract_id UUID,
  p_response TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_contract RECORD;
  v_action TEXT;
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

    -- Update linked hiring_request status to completed
    UPDATE public.hiring_requests
    SET status = 'completed', updated_at = v_now
    WHERE id = v_contract.hiring_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Contract has been mutually completed.',
      'contract_id', p_contract_id,
      'status', 'completed'
    );
  ELSE
    -- Rejection / Report issue
    UPDATE public.work_contracts
    SET
      status = 'active',
      completion_client_response = CASE WHEN v_contract.client_id = v_user_id THEN 'rejected' ELSE completion_client_response END,
      completion_worker_response = CASE WHEN v_contract.worker_id = v_user_id THEN 'rejected' ELSE completion_worker_response END,
      completion_client_responded_at = CASE WHEN v_contract.client_id = v_user_id THEN v_now ELSE completion_client_responded_at END,
      completion_worker_responded_at = CASE WHEN v_contract.worker_id = v_user_id THEN v_now ELSE completion_worker_responded_at END,
      completion_rejection_reason = trim(COALESCE(p_reason, '')),
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
