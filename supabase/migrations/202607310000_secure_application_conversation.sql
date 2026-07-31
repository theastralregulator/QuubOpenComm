-- Migration: 202607310000_secure_application_conversation.sql
-- Enforce that application messaging is strictly restricted to accepted applications
-- and verify caller authorization (applicant or job owner).

CREATE OR REPLACE FUNCTION public.get_or_create_application_conversation(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app record;
  v_conv_id uuid;
BEGIN
  -- 1. Verify caller authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Fetch application and related job poster details
  SELECT 
    ja.id,
    ja.status,
    ja.applicant_id,
    ja.job_id,
    j.posted_by AS job_owner_id
  INTO v_app
  FROM public.job_applications ja
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  -- 3. Verify caller is authorized (must be applicant or job owner)
  IF auth.uid() IS DISTINCT FROM v_app.applicant_id AND auth.uid() IS DISTINCT FROM v_app.job_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is neither the applicant nor the job owner';
  END IF;

  -- 4. Secure condition: Enforce accepted status
  IF v_app.status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Messaging is only allowed after application is accepted';
  END IF;

  -- 5. Find existing conversation for this application
  SELECT id INTO v_conv_id 
  FROM public.conversations 
  WHERE application_id = p_application_id 
  LIMIT 1;

  -- 6. Create conversation if it does not exist
  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (
      creator_id,
      member_id,
      application_id,
      job_id,
      conversation_type
    ) VALUES (
      v_app.applicant_id,
      v_app.job_owner_id,
      p_application_id,
      v_app.job_id,
      'application'
    )
    RETURNING id INTO v_conv_id;

    -- Optionally populate conversation_members if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_members') THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES 
        (v_conv_id, v_app.applicant_id),
        (v_conv_id, v_app.job_owner_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_application_conversation(uuid) TO authenticated;
