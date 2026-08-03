-- Migration: 202608030006_ratings_and_reviews.sql
-- Description: Trusted Ratings & Reviews system for completed work contracts (Direct Hire & Job Apply), profile aggregates, security RLS, abuse reports, and notification triggers.

-- 1. Create contract_reviews table
CREATE TABLE IF NOT EXISTS public.contract_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.work_contracts(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('client', 'worker')),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  communication_rating integer CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)),
  work_quality_rating integer CHECK (work_quality_rating IS NULL OR (work_quality_rating >= 1 AND work_quality_rating <= 5)),
  professionalism_rating integer CHECK (professionalism_rating IS NULL OR (professionalism_rating >= 1 AND professionalism_rating <= 5)),
  punctuality_rating integer CHECK (punctuality_rating IS NULL OR (punctuality_rating >= 1 AND punctuality_rating <= 5)),
  would_recommend boolean DEFAULT true,
  is_public boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chk_different_users CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT uq_contract_reviewer UNIQUE (contract_id, reviewer_id)
);

-- 2. Create review_reports table for abuse moderation
CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.contract_reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_review_reporter UNIQUE (review_id, reporter_id)
);

-- 3. Enable RLS
ALTER TABLE public.contract_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for contract_reviews
DROP POLICY IF EXISTS "Public can read public reviews" ON public.contract_reviews;
CREATE POLICY "Public can read public reviews"
  ON public.contract_reviews FOR SELECT
  TO authenticated, anon
  USING (
    is_public = true 
    OR reviewer_id = auth.uid() 
    OR reviewee_id = auth.uid()
  );

-- Revoke direct write access from client roles; review submission must use submit_contract_review RPC.
REVOKE INSERT, UPDATE, DELETE ON public.contract_reviews FROM PUBLIC, anon, authenticated;

-- 5. RLS Policies for review_reports
DROP POLICY IF EXISTS "Users can read own review reports" ON public.review_reports;
CREATE POLICY "Users can read own review reports"
  ON public.review_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can submit review reports" ON public.review_reports;
CREATE POLICY "Authenticated users can submit review reports"
  ON public.review_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_contract_reviews_reviewee_created 
  ON public.contract_reviews(reviewee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_reviews_contract_id 
  ON public.contract_reviews(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_reviews_reviewer_id 
  ON public.contract_reviews(reviewer_id);

-- 7. RPC Helper: Check Contract Review Eligibility
CREATE OR REPLACE FUNCTION public.get_contract_review_eligibility(p_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_contract RECORD;
  v_my_role text;
  v_other_party_id uuid;
  v_other_party_name text;
  v_existing_review RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT wc.id, wc.status, wc.client_id, wc.worker_id, wc.work_title,
         cp.full_name AS client_name, wp.full_name AS worker_name
  INTO v_contract
  FROM public.work_contracts wc
  LEFT JOIN public.profiles cp ON cp.id = wc.client_id
  LEFT JOIN public.profiles wp ON wp.id = wc.worker_id
  WHERE wc.id = p_contract_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_review', false, 'reason', 'Contract not found.');
  END IF;

  IF v_user_id NOT IN (v_contract.client_id, v_contract.worker_id) THEN
    RETURN jsonb_build_object('can_review', false, 'reason', 'You are not a participant in this contract.');
  END IF;

  IF v_contract.client_id = v_user_id THEN
    v_my_role := 'client';
    v_other_party_id := v_contract.worker_id;
    v_other_party_name := COALESCE(v_contract.worker_name, 'Worker');
  ELSE
    v_my_role := 'worker';
    v_other_party_id := v_contract.client_id;
    v_other_party_name := COALESCE(v_contract.client_name, 'Client');
  END IF;

  IF v_contract.status <> 'completed' THEN
    RETURN jsonb_build_object(
      'can_review', false,
      'reason', 'Reviews are available only after contract completion.',
      'contract_status', v_contract.status
    );
  END IF;

  SELECT * INTO v_existing_review 
  FROM public.contract_reviews 
  WHERE contract_id = p_contract_id AND reviewer_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'can_review', false,
      'has_reviewed', true,
      'my_role', v_my_role,
      'other_party_id', v_other_party_id,
      'other_party_name', v_other_party_name,
      'review', to_jsonb(v_existing_review),
      'can_edit', (v_existing_review.created_at >= (now() - INTERVAL '24 hours'))
    );
  END IF;

  RETURN jsonb_build_object(
    'can_review', true,
    'has_reviewed', false,
    'my_role', v_my_role,
    'other_party_id', v_other_party_id,
    'other_party_name', v_other_party_name,
    'work_title', v_contract.work_title
  );
END;
$$;

-- 8. RPC Helper: Submit Contract Review
CREATE OR REPLACE FUNCTION public.submit_contract_review(
  p_contract_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_communication_rating integer DEFAULT NULL,
  p_work_quality_rating integer DEFAULT NULL,
  p_professionalism_rating integer DEFAULT NULL,
  p_punctuality_rating integer DEFAULT NULL,
  p_would_recommend boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_contract RECORD;
  v_reviewer_role text;
  v_reviewee_id uuid;
  v_review_id uuid;
  v_title text;
  v_comment text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Overall rating must be between 1 and 5 stars.';
  END IF;

  -- Lock contract row
  SELECT wc.id, wc.status, wc.client_id, wc.worker_id, wc.work_title
  INTO v_contract
  FROM public.work_contracts wc
  WHERE wc.id = p_contract_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work contract not found.';
  END IF;

  IF v_contract.status <> 'completed' THEN
    RAISE EXCEPTION 'Reviews can only be submitted for completed contracts.';
  END IF;

  IF v_user_id NOT IN (v_contract.client_id, v_contract.worker_id) THEN
    RAISE EXCEPTION 'Only contract participants may submit a review.';
  END IF;

  IF v_user_id = v_contract.client_id THEN
    v_reviewer_role := 'client';
    v_reviewee_id := v_contract.worker_id;
  ELSE
    v_reviewer_role := 'worker';
    v_reviewee_id := v_contract.client_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contract_reviews 
    WHERE contract_id = p_contract_id AND reviewer_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted a review for this contract.';
  END IF;

  -- Trim whitespace
  v_title := NULLIF(TRIM(p_title), '');
  v_comment := NULLIF(TRIM(p_comment), '');

  IF v_comment IS NOT NULL AND LENGTH(v_comment) > 2000 THEN
    RAISE EXCEPTION 'Comment exceeds maximum length of 2000 characters.';
  END IF;

  INSERT INTO public.contract_reviews (
    contract_id,
    reviewer_id,
    reviewee_id,
    reviewer_role,
    rating,
    title,
    comment,
    communication_rating,
    work_quality_rating,
    professionalism_rating,
    punctuality_rating,
    would_recommend,
    is_public,
    created_at,
    updated_at
  )
  VALUES (
    p_contract_id,
    v_user_id,
    v_reviewee_id,
    v_reviewer_role,
    p_rating,
    v_title,
    v_comment,
    p_communication_rating,
    p_work_quality_rating,
    p_professionalism_rating,
    p_punctuality_rating,
    COALESCE(p_would_recommend, true),
    true,
    now(),
    now()
  )
  RETURNING id INTO v_review_id;

  -- Create Notification for Reviewee
  PERFORM public.create_notification(
    v_reviewee_id,
    'review_received',
    'New Review Received ⭐',
    'You received a ' || p_rating || '-star review for "' || v_contract.work_title || '"',
    '/profile',
    v_user_id,
    jsonb_build_object('contract_id', p_contract_id, 'review_id', v_review_id),
    'review_rcvd:' || p_contract_id || ':' || v_reviewee_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'review_id', v_review_id,
    'message', 'Review submitted successfully.'
  );
END;
$$;

-- 9. RPC Helper: Update Own Review (within 24 hours)
CREATE OR REPLACE FUNCTION public.update_my_contract_review(
  p_review_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_communication_rating integer DEFAULT NULL,
  p_work_quality_rating integer DEFAULT NULL,
  p_professionalism_rating integer DEFAULT NULL,
  p_punctuality_rating integer DEFAULT NULL,
  p_would_recommend boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_review RECORD;
  v_title text;
  v_comment text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  SELECT * INTO v_review 
  FROM public.contract_reviews 
  WHERE id = p_review_id AND reviewer_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found or permission denied.';
  END IF;

  IF v_review.created_at < (now() - INTERVAL '24 hours') THEN
    RAISE EXCEPTION 'Reviews can only be edited within 24 hours of submission.';
  END IF;

  v_title := NULLIF(TRIM(p_title), '');
  v_comment := NULLIF(TRIM(p_comment), '');

  UPDATE public.contract_reviews
  SET
    rating = COALESCE(p_rating, rating),
    title = v_title,
    comment = v_comment,
    communication_rating = p_communication_rating,
    work_quality_rating = p_work_quality_rating,
    professionalism_rating = p_professionalism_rating,
    punctuality_rating = p_punctuality_rating,
    would_recommend = COALESCE(p_would_recommend, true),
    updated_at = now()
  WHERE id = p_review_id;

  RETURN jsonb_build_object('success', true, 'message', 'Review updated successfully.');
END;
$$;

-- 10. RPC Helper: Get Profile Rating Summary & Trust Badges
CREATE OR REPLACE FUNCTION public.get_profile_rating_summary(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_reviews int := 0;
  v_avg_rating numeric := 0;
  v_completed_works int := 0;
  v_recommend_count int := 0;
  v_recommend_pct numeric := 0;
  v_avg_comm numeric := 0;
  v_avg_quality numeric := 0;
  v_avg_prof numeric := 0;
  v_avg_punc numeric := 0;
  
  -- Badges
  v_is_new boolean := false;
  v_has_5plus_works boolean := false;
  v_is_highly_rated boolean := false;
  v_is_top_recommended boolean := false;
  v_top_communication boolean := false;
BEGIN
  -- Count completed contracts where profile was participant
  SELECT COUNT(*)::int INTO v_completed_works
  FROM public.work_contracts
  WHERE (client_id = p_profile_id OR worker_id = p_profile_id)
    AND status = 'completed';

  -- Aggregate reviews for this profile as reviewee
  SELECT 
    COUNT(*)::int,
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COALESCE(COUNT(*) FILTER (WHERE would_recommend = true)::int, 0),
    COALESCE(ROUND(AVG(communication_rating)::numeric, 1), 0),
    COALESCE(ROUND(AVG(work_quality_rating)::numeric, 1), 0),
    COALESCE(ROUND(AVG(professionalism_rating)::numeric, 1), 0),
    COALESCE(ROUND(AVG(punctuality_rating)::numeric, 1), 0)
  INTO 
    v_total_reviews,
    v_avg_rating,
    v_recommend_count,
    v_avg_comm,
    v_avg_quality,
    v_avg_prof,
    v_avg_punc
  FROM public.contract_reviews
  WHERE reviewee_id = p_profile_id
    AND is_public = true;

  IF v_total_reviews > 0 THEN
    v_recommend_pct := ROUND((v_recommend_count::numeric / v_total_reviews::numeric) * 100, 0);
  END IF;

  -- Trust Badges Evaluation Logic
  IF v_total_reviews = 0 THEN
    v_is_new := true;
  END IF;

  IF v_completed_works >= 5 THEN
    v_has_5plus_works := true;
  END IF;

  IF v_total_reviews >= 3 AND v_avg_rating >= 4.5 THEN
    v_is_highly_rated := true;
  END IF;

  IF v_total_reviews >= 3 AND v_recommend_pct >= 90 THEN
    v_is_top_recommended := true;
  END IF;

  IF v_total_reviews >= 3 AND v_avg_comm >= 4.5 THEN
    v_top_communication := true;
  END IF;

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'average_rating', v_avg_rating,
    'total_reviews', v_total_reviews,
    'completed_works', v_completed_works,
    'recommendation_percentage', v_recommend_pct,
    'communication_average', v_avg_comm,
    'work_quality_average', v_avg_quality,
    'professionalism_average', v_avg_prof,
    'punctuality_average', v_avg_punc,
    'badges', jsonb_build_object(
      'is_new', v_is_new,
      'has_5plus_works', v_has_5plus_works,
      'is_highly_rated', v_is_highly_rated,
      'is_top_recommended', v_is_top_recommended,
      'top_communication', v_top_communication
    )
  );
END;
$$;

-- 11. RPC Helper: Get Reviews For Profile (Paginated)
CREATE OR REPLACE FUNCTION public.get_reviews_for_profile(
  p_profile_id uuid,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  contract_id uuid,
  work_title text,
  reviewer_id uuid,
  reviewer_name text,
  reviewer_avatar_url text,
  reviewer_role text,
  rating int,
  title text,
  comment text,
  communication_rating int,
  work_quality_rating int,
  professionalism_rating int,
  punctuality_rating int,
  would_recommend boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.contract_id,
    wc.work_title,
    r.reviewer_id,
    COALESCE(p.full_name, 'OpenComm Member') AS reviewer_name,
    p.avatar_url AS reviewer_avatar_url,
    r.reviewer_role,
    r.rating,
    r.title,
    r.comment,
    r.communication_rating,
    r.work_quality_rating,
    r.professionalism_rating,
    r.punctuality_rating,
    r.would_recommend,
    r.created_at
  FROM public.contract_reviews r
  JOIN public.work_contracts wc ON wc.id = r.contract_id
  LEFT JOIN public.profiles p ON p.id = r.reviewer_id
  WHERE r.reviewee_id = p_profile_id
    AND r.is_public = true
  ORDER BY r.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 12. RPC Helper: Get Pending Unreviewed Completed Contracts for User
CREATE OR REPLACE FUNCTION public.get_my_pending_reviews()
RETURNS TABLE (
  contract_id uuid,
  work_title text,
  my_role text,
  other_party_id uuid,
  other_party_name text,
  other_party_avatar text,
  completed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  RETURN QUERY
  SELECT 
    wc.id AS contract_id,
    wc.work_title,
    CASE WHEN wc.client_id = v_user_id THEN 'client' ELSE 'worker' END AS my_role,
    CASE WHEN wc.client_id = v_user_id THEN wc.worker_id ELSE wc.client_id END AS other_party_id,
    COALESCE(p.full_name, 'OpenComm User') AS other_party_name,
    p.avatar_url AS other_party_avatar,
    wc.completed_at
  FROM public.work_contracts wc
  JOIN public.profiles p ON p.id = (CASE WHEN wc.client_id = v_user_id THEN wc.worker_id ELSE wc.client_id END)
  WHERE (wc.client_id = v_user_id OR wc.worker_id = v_user_id)
    AND wc.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.contract_reviews cr
      WHERE cr.contract_id = wc.id AND cr.reviewer_id = v_user_id
    )
  ORDER BY wc.completed_at DESC;
END;
$$;

-- 13. RPC Helper: Report Review for Abuse
CREATE OR REPLACE FUNCTION public.report_contract_review(
  p_review_id uuid,
  p_reason text,
  p_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_report_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Report reason is required.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.contract_reviews WHERE id = p_review_id) THEN
    RAISE EXCEPTION 'Review not found.';
  END IF;

  INSERT INTO public.review_reports (review_id, reporter_id, reason, details)
  VALUES (p_review_id, v_user_id, TRIM(p_reason), NULLIF(TRIM(p_details), ''))
  ON CONFLICT (review_id, reporter_id) DO NOTHING
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- 14. Trigger: Automatically send review_available notifications on contract completion
CREATE OR REPLACE FUNCTION public.notify_contract_completed_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Notify Client
    PERFORM public.create_notification(
      NEW.client_id,
      'review_available',
      'Rate Your Experience ⭐',
      'Work contract "' || NEW.work_title || '" is completed! Leave a review for your contractor.',
      '/work-contracts/' || NEW.id,
      NEW.worker_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_avail:' || NEW.id || ':' || NEW.client_id
    );

    -- Notify Worker
    PERFORM public.create_notification(
      NEW.worker_id,
      'review_available',
      'Rate Your Experience ⭐',
      'Work contract "' || NEW.work_title || '" is completed! Leave a review for your client.',
      '/work-contracts/' || NEW.id,
      NEW.client_id,
      jsonb_build_object('contract_id', NEW.id),
      'review_avail:' || NEW.id || ':' || NEW.worker_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contract_completed ON public.work_contracts;
CREATE TRIGGER trg_notify_contract_completed
  AFTER UPDATE OF status ON public.work_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contract_completed_reviews();
