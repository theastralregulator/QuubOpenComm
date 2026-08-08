-- 202608080000_backfill_workflow_notifications.sql
-- Backfill notifications for existing actionable workflow items

DO $$
DECLARE
  v_rec record;
BEGIN
  -- 1. Pending Job Applications (to job owner)
  FOR v_rec IN 
    SELECT a.id, a.job_id, a.applicant_id, j.posted_by, j.title
    FROM public.job_applications a
    JOIN public.jobs j ON a.job_id = j.id
    WHERE a.status IN ('pending', 'under_review')
  LOOP
    PERFORM public.create_notification(
      v_rec.posted_by,
      'application_submitted',
      'New Job Application',
      'You have a pending application for ' || v_rec.title,
      '/jobs/' || v_rec.job_id || '/applications',
      v_rec.applicant_id,
      jsonb_build_object('application_id', v_rec.id, 'job_id', v_rec.job_id),
      'application:' || v_rec.id || ':submitted'
    );
  END LOOP;

  -- 2. Active/pending direct hire requests (to worker)
  FOR v_rec IN 
    SELECT h.id, h.worker_id, h.client_id, h.work_title
    FROM public.hiring_requests h
    WHERE h.status IN ('pending', 'negotiating')
  LOOP
    PERFORM public.create_notification(
      v_rec.worker_id,
      'hire_request_received',
      'New Hiring Request',
      'You received a hire request for ' || v_rec.work_title,
      '/profile/hire-requests',
      v_rec.client_id,
      jsonb_build_object('request_id', v_rec.id),
      'hire_request:' || v_rec.id || ':received'
    );
  END LOOP;

  -- 3. Actionable negotiation items (deal proposals)
  -- Notify the party who needs to respond
  FOR v_rec IN
    SELECT dp.id, dp.job_application_id, dp.hiring_request_id, dp.proposed_by,
           j.posted_by AS client_id, ja.applicant_id AS worker_id
    FROM public.deal_proposals dp
    LEFT JOIN public.job_applications ja ON dp.job_application_id = ja.id
    LEFT JOIN public.jobs j ON ja.job_id = j.id
    WHERE dp.proposal_status = 'pending' AND dp.job_application_id IS NOT NULL
  LOOP
    -- If proposed by client, worker needs to respond
    IF v_rec.proposed_by = v_rec.client_id THEN
      PERFORM public.create_notification(
        v_rec.worker_id,
        'deal_proposal_received',
        'New Deal Proposal',
        'You have received a new deal proposal.',
        '/profile/my-jobs-applied',
        v_rec.client_id,
        jsonb_build_object('proposal_id', v_rec.id),
        'deal_proposal:' || v_rec.id || ':received'
      );
    ELSE
      PERFORM public.create_notification(
        v_rec.client_id,
        'deal_proposal_received',
        'New Deal Proposal',
        'You have received a new deal proposal.',
        '/profile/my-job-posts',
        v_rec.worker_id,
        jsonb_build_object('proposal_id', v_rec.id),
        'deal_proposal:' || v_rec.id || ':received'
      );
    END IF;
  END LOOP;

  -- Deal proposals from hiring requests
  FOR v_rec IN
    SELECT dp.id, dp.job_application_id, dp.hiring_request_id, dp.proposed_by,
           h.client_id, h.worker_id
    FROM public.deal_proposals dp
    JOIN public.hiring_requests h ON dp.hiring_request_id = h.id
    WHERE dp.proposal_status = 'pending' AND dp.hiring_request_id IS NOT NULL
  LOOP
    IF v_rec.proposed_by = v_rec.client_id THEN
      PERFORM public.create_notification(
        v_rec.worker_id,
        'deal_proposal_received',
        'New Deal Proposal',
        'You have received a new deal proposal.',
        '/profile/hire-requests',
        v_rec.client_id,
        jsonb_build_object('proposal_id', v_rec.id),
        'deal_proposal:' || v_rec.id || ':received'
      );
    ELSE
      PERFORM public.create_notification(
        v_rec.client_id,
        'deal_proposal_received',
        'New Deal Proposal',
        'You have received a new deal proposal.',
        '/profile/hire-requests',
        v_rec.worker_id,
        jsonb_build_object('proposal_id', v_rec.id),
        'deal_proposal:' || v_rec.id || ':received'
      );
    END IF;
  END LOOP;

  -- 4. Pending contract actions (e.g. pending cancellation/completion responses)
  FOR v_rec IN
    SELECT c.id, c.client_id, c.worker_id, c.status,
           c.cancellation_requested_by, c.completion_requested_by
    FROM public.work_contracts c
    WHERE c.status IN ('cancellation_requested', 'completion_requested')
  LOOP
    IF v_rec.status = 'cancellation_requested' THEN
      IF v_rec.cancellation_requested_by = v_rec.client_id THEN
        -- worker must respond
        PERFORM public.create_notification(
          v_rec.worker_id, 'contract_cancellation_requested', 'Contract cancellation requested',
          'A contract cancellation request needs your response.', '/work-contracts/' || v_rec.id,
          v_rec.client_id, jsonb_build_object('work_contract_id', v_rec.id, 'status', v_rec.status),
          'work_contract:' || v_rec.id || ':contract_cancellation_requested'
        );
      ELSE
        -- client must respond
        PERFORM public.create_notification(
          v_rec.client_id, 'contract_cancellation_requested', 'Contract cancellation requested',
          'A contract cancellation request needs your response.', '/work-contracts/' || v_rec.id,
          v_rec.worker_id, jsonb_build_object('work_contract_id', v_rec.id, 'status', v_rec.status),
          'work_contract:' || v_rec.id || ':contract_cancellation_requested'
        );
      END IF;
    ELSIF v_rec.status = 'completion_requested' THEN
      IF v_rec.completion_requested_by = v_rec.client_id THEN
        PERFORM public.create_notification(
          v_rec.worker_id, 'work_completed', 'Work marked completed',
          'The other party marked the work as completed.', '/work-contracts/' || v_rec.id,
          v_rec.client_id, jsonb_build_object('work_contract_id', v_rec.id, 'status', v_rec.status),
          'work_contract:' || v_rec.id || ':work_completed'
        );
      ELSE
        PERFORM public.create_notification(
          v_rec.client_id, 'work_completed', 'Work marked completed',
          'The other party marked the work as completed.', '/work-contracts/' || v_rec.id,
          v_rec.worker_id, jsonb_build_object('work_contract_id', v_rec.id, 'status', v_rec.status),
          'work_contract:' || v_rec.id || ':work_completed'
        );
      END IF;
    END IF;
  END LOOP;

  -- 5. Review-required items
  -- Checking contract_reviews separately for client and worker
  FOR v_rec IN
    SELECT c.id, c.client_id, c.worker_id, c.work_title
    FROM public.work_contracts c
    LEFT JOIN public.contract_reviews r_client ON c.id = r_client.contract_id AND r_client.reviewer_role = 'client'
    WHERE c.status = 'completed' AND r_client.id IS NULL
  LOOP
    PERFORM public.create_notification(
      v_rec.client_id,
      'review_required',
      'Leave a Review',
      'Please leave a review for contract ' || v_rec.work_title,
      '/work-contracts/' || v_rec.id,
      v_rec.worker_id,
      jsonb_build_object('work_contract_id', v_rec.id, 'status', 'completed'),
      'review_request:' || v_rec.id || ':client'
    );
  END LOOP;

  FOR v_rec IN
    SELECT c.id, c.client_id, c.worker_id, c.work_title
    FROM public.work_contracts c
    LEFT JOIN public.contract_reviews r_worker ON c.id = r_worker.contract_id AND r_worker.reviewer_role = 'worker'
    WHERE c.status = 'completed' AND r_worker.id IS NULL
  LOOP
    PERFORM public.create_notification(
      v_rec.worker_id,
      'review_required',
      'Leave a Review',
      'Please leave a review for contract ' || v_rec.work_title,
      '/work-contracts/' || v_rec.id,
      v_rec.client_id,
      jsonb_build_object('work_contract_id', v_rec.id, 'status', 'completed'),
      'review_request:' || v_rec.id || ':worker'
    );
  END LOOP;
END $$;
