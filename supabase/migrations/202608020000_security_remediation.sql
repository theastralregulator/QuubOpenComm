-- Migration: 202608020000_security_remediation.sql
-- Description: Comprehensive Security Remediation for OpenComm Supabase Project
-- Covers Trigger Functions, Search Paths, Role-check Functions, RPC Authorization & Validation, Storage Policies.

-- =========================================================================
-- 1. SECURE TRIGGER AND INTERNAL FUNCTIONS
-- =========================================================================

-- Secure handle_new_user()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, signup_status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'completed'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Secure handle_updated_at()
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, auth
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;

-- Secure sync_profile_email_verification()
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_namespace.nspname = 'public' AND proname = 'sync_profile_email_verification'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.sync_profile_email_verification() SET search_path = public, auth;';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_profile_email_verification() FROM PUBLIC, anon, authenticated;';
  END IF;
END $$;

-- Secure rls_auto_enable() if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_namespace.nspname = 'public' AND proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;';
  END IF;
END $$;


-- =========================================================================
-- 2. SECURE ROLE-CHECK FUNCTIONS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_admin(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_id uuid := COALESCE(requested_user_id, caller_id);
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  IF caller_id <> target_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_members
      WHERE user_id = caller_id AND is_active = true
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = target_id
      AND is_active = true
      AND role IN ('admin', 'super_admin')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_id uuid := COALESCE(requested_user_id, caller_id);
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  IF caller_id <> target_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_members
      WHERE user_id = caller_id AND is_active = true
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = target_id
      AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(requested_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  target_id uuid := COALESCE(requested_user_id, caller_id);
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  IF caller_id <> target_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_members
      WHERE user_id = caller_id AND is_active = true AND role = 'super_admin'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE user_id = target_id
      AND is_active = true
      AND role = 'super_admin'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(target_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = target_company_id
      AND user_id = caller_id
      AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.admin_members
    WHERE user_id = caller_id
      AND is_active = true
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;


-- =========================================================================
-- 3. AUDIT & SECURE INTENTIONAL SECURITY DEFINER RPC FUNCTIONS
-- =========================================================================

-- RPC 1: update_my_basic_profile
CREATE OR REPLACE FUNCTION public.update_my_basic_profile(
  p_username text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_preferred_language text DEFAULT NULL,
  p_bio text DEFAULT NULL,
  p_show_location_publicly boolean DEFAULT NULL,
  p_onboarding_completed boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_full_name text;
  v_updated RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_username IS NOT NULL THEN
    v_username := trim(p_username);
    IF length(v_username) = 0 THEN
      RAISE EXCEPTION 'Username cannot be empty';
    END IF;
    IF length(v_username) > 100 THEN
      RAISE EXCEPTION 'Username exceeds 100 characters';
    END IF;
  END IF;

  IF p_full_name IS NOT NULL THEN
    v_full_name := trim(p_full_name);
    IF length(v_full_name) = 0 THEN
      RAISE EXCEPTION 'Full name cannot be empty';
    END IF;
    IF length(v_full_name) > 200 THEN
      RAISE EXCEPTION 'Full name exceeds 200 characters';
    END IF;
  END IF;

  IF p_bio IS NOT NULL AND length(trim(p_bio)) > 2000 THEN
    RAISE EXCEPTION 'Bio exceeds 2000 characters';
  END IF;

  UPDATE public.profiles
  SET 
    username = COALESCE(v_username, username),
    full_name = COALESCE(v_full_name, full_name),
    avatar_url = COALESCE(trim(p_avatar_url), avatar_url),
    banner_url = COALESCE(trim(p_banner_url), banner_url),
    phone = COALESCE(trim(p_phone), phone),
    city = COALESCE(trim(p_city), city),
    state = COALESCE(trim(p_state), state),
    country = COALESCE(trim(p_country), country),
    preferred_language = COALESCE(trim(p_preferred_language), preferred_language),
    bio = COALESCE(trim(p_bio), bio),
    show_location_publicly = COALESCE(p_show_location_publicly, show_location_publicly),
    onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
    updated_at = now()
  WHERE id = v_user_id
  RETURNING 
    id, username, full_name, avatar_url, banner_url, phone, city, state, country, 
    preferred_language, bio, show_location_publicly, onboarding_completed, 
    profile_type, created_at, updated_at 
  INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_basic_profile(text, text, text, text, text, text, text, text, text, text, boolean, boolean) TO authenticated;


-- RPC 2: create_my_worker_profile
CREATE OR REPLACE FUNCTION public.create_my_worker_profile(
  p_profession text,
  p_skills text[],
  p_experience_years integer DEFAULT 0,
  p_work_location text DEFAULT NULL,
  p_availability text DEFAULT 'Available Now',
  p_bio_summary text DEFAULT NULL,
  p_hourly_rate numeric DEFAULT 0,
  p_expected_salary text DEFAULT NULL,
  p_portfolio_url text DEFAULT NULL,
  p_certificates text[] DEFAULT '{}',
  p_languages text[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_prof text;
  v_result RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_prof := trim(COALESCE(p_profession, ''));
  IF length(v_prof) = 0 THEN
    RAISE EXCEPTION 'Profession title is required';
  END IF;
  IF length(v_prof) > 150 THEN
    RAISE EXCEPTION 'Profession title exceeds 150 characters';
  END IF;

  IF p_experience_years < 0 OR p_experience_years > 70 THEN
    RAISE EXCEPTION 'Experience years must be between 0 and 70';
  END IF;

  IF p_hourly_rate < 0 OR p_hourly_rate > 10000 THEN
    RAISE EXCEPTION 'Hourly rate must be between 0 and 10000';
  END IF;

  INSERT INTO public.worker_profiles (
    id,
    profession,
    skills,
    experience_years,
    work_location,
    availability,
    bio_summary,
    hourly_rate,
    expected_salary,
    portfolio_url,
    certificates,
    languages,
    updated_at
  ) VALUES (
    v_user_id,
    v_prof,
    COALESCE(p_skills, '{}'),
    GREATEST(0, p_experience_years),
    trim(COALESCE(p_work_location, '')),
    COALESCE(trim(p_availability), 'Available Now'),
    trim(COALESCE(p_bio_summary, '')),
    GREATEST(0, p_hourly_rate),
    trim(COALESCE(p_expected_salary, '')),
    trim(COALESCE(p_portfolio_url, '')),
    COALESCE(p_certificates, '{}'),
    COALESCE(p_languages, '{}'),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    profession = EXCLUDED.profession,
    skills = EXCLUDED.skills,
    experience_years = EXCLUDED.experience_years,
    work_location = EXCLUDED.work_location,
    availability = EXCLUDED.availability,
    bio_summary = EXCLUDED.bio_summary,
    hourly_rate = EXCLUDED.hourly_rate,
    expected_salary = EXCLUDED.expected_salary,
    portfolio_url = EXCLUDED.portfolio_url,
    certificates = EXCLUDED.certificates,
    languages = EXCLUDED.languages,
    updated_at = now()
  RETURNING * INTO v_result;

  UPDATE public.profiles
  SET profile_type = 'worker', updated_at = now()
  WHERE id = v_user_id;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_worker_profile(text, text[], integer, text, text, text, numeric, text, text, text[], text[]) TO authenticated;


-- RPC 3: get_or_create_application_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_application_conversation(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_app record;
  v_conv_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

  IF v_user_id IS DISTINCT FROM v_app.applicant_id AND v_user_id IS DISTINCT FROM v_app.job_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: Caller is neither applicant nor job owner';
  END IF;

  IF v_app.status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Messaging is only allowed after application is accepted';
  END IF;

  SELECT id INTO v_conv_id 
  FROM public.conversations 
  WHERE application_id = p_application_id 
  LIMIT 1;

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

REVOKE EXECUTE ON FUNCTION public.get_or_create_application_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_application_conversation(uuid) TO authenticated;


-- RPC 4: get_or_create_worker_conversation
CREATE OR REPLACE FUNCTION public.get_or_create_worker_conversation(p_worker_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_conv_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_user_id = p_worker_id THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_worker_id) THEN
    RAISE EXCEPTION 'Worker profile not found';
  END IF;

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE (creator_id = v_user_id AND member_id = p_worker_id)
     OR (creator_id = p_worker_id AND member_id = v_user_id)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (
      creator_id,
      member_id,
      conversation_type
    ) VALUES (
      v_user_id,
      p_worker_id,
      'direct'
    )
    RETURNING id INTO v_conv_id;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_members') THEN
      INSERT INTO public.conversation_members (conversation_id, user_id)
      VALUES 
        (v_conv_id, v_user_id),
        (v_conv_id, p_worker_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_conv_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_or_create_worker_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_worker_conversation(uuid) TO authenticated;


-- RPC 5: mark_conversation_read
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
    WHERE id = p_conversation_id AND (creator_id = v_user_id OR member_id = v_user_id)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Not a participant in this conversation';
  END IF;

  UPDATE public.messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_id != v_user_id
    AND is_read = false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;


-- RPC 6: update_job_application_status
CREATE OR REPLACE FUNCTION public.update_job_application_status(p_app_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_job_id uuid;
  v_job_owner uuid;
  v_updated record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('pending', 'under_review', 'shortlisted', 'accepted', 'rejected', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT ja.job_id INTO v_job_id
  FROM public.job_applications ja
  WHERE ja.id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  SELECT posted_by INTO v_job_owner
  FROM public.jobs
  WHERE id = v_job_id;

  IF v_user_id != v_job_owner THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this job posting';
  END IF;

  UPDATE public.job_applications
  SET status = p_status, updated_at = now()
  WHERE id = p_app_id
  RETURNING id, status INTO v_updated;

  RETURN to_jsonb(v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_job_application_status(uuid, text) TO authenticated;


-- RPC 7: update_my_job_status
CREATE OR REPLACE FUNCTION public.update_my_job_status(
  p_job_id uuid,
  p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_posted_by uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT posted_by INTO v_posted_by FROM public.jobs WHERE id = p_job_id;
  
  IF v_posted_by IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_posted_by != v_user_id THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this job posting';
  END IF;

  UPDATE public.jobs 
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_job_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_my_job_status(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_job_status(uuid, boolean) TO authenticated;


-- =========================================================================
-- 4. SECURE STORAGE BUCKET profile-banners
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view profile banners" ON storage.objects;
DROP POLICY IF EXISTS "Public Profile Banners Select" ON storage.objects;
DROP POLICY IF EXISTS "Profile Banners Read Policy" ON storage.objects;
DROP POLICY IF EXISTS "Profile Banners Insert Policy" ON storage.objects;
DROP POLICY IF EXISTS "Profile Banners Update Policy" ON storage.objects;
DROP POLICY IF EXISTS "Profile Banners Delete Policy" ON storage.objects;

CREATE POLICY "Profile Banners Read Policy"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-banners');

CREATE POLICY "Profile Banners Insert Policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-banners' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '%' OR
    name LIKE '%_' || auth.uid()::text || '.%'
  )
);

CREATE POLICY "Profile Banners Update Policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-banners' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '%' OR
    name LIKE '%_' || auth.uid()::text || '.%'
  )
);

CREATE POLICY "Profile Banners Delete Policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-banners' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '%' OR
    name LIKE '%_' || auth.uid()::text || '.%'
  )
);

NOTIFY pgrst, reload_schema;
