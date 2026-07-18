-- Migration: Add custom email verification columns, tokens table with indexes, and core triggers to enforce verification rules on the database server-side.

-- 1. Add email_verified_for_actions, verified_email_at, phone_verified_for_actions, and verified_phone_at columns to public.profiles if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_for_actions boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_email_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_for_actions boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_phone_at timestamp with time zone;

-- 2. Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create indexes on email_verification_tokens
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON public.email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);

-- 4. Enable RLS on email_verification_tokens
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Note: No policies are created for standard users. 
-- Only secure server-side code (using service-role credentials) bypasses RLS to manage tokens,
-- preventing users from directly reading or inserting records from the browser.

-- 5. Trigger helper function to enforce email verification before mutations
CREATE OR REPLACE FUNCTION public.check_email_verification_for_action()
RETURNS trigger AS $$
DECLARE
  is_verified boolean;
  curr_user_id uuid;
BEGIN
  -- Determine current authenticated user
  curr_user_id := auth.uid();
  IF curr_user_id IS NULL THEN
    -- If no user is authenticated (e.g., system operations, local migrations, or server-role calls), allow it
    RETURN NEW;
  END IF;

  -- Fetch verification status from profiles table
  SELECT email_verified_for_actions INTO is_verified
  FROM public.profiles
  WHERE id = curr_user_id;

  -- Raise exception if email is not verified for actions
  IF is_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Email verification is required to complete this action.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach the verification trigger to the requested tables BEFORE INSERT/UPDATE mutations

-- Table: jobs
DROP TRIGGER IF EXISTS trg_check_verified_jobs ON public.jobs;
CREATE TRIGGER trg_check_verified_jobs BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: job_applications
DROP TRIGGER IF EXISTS trg_check_verified_job_applications ON public.job_applications;
CREATE TRIGGER trg_check_verified_job_applications BEFORE INSERT ON public.job_applications
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: hiring_requests
DROP TRIGGER IF EXISTS trg_check_verified_hiring_requests ON public.hiring_requests;
CREATE TRIGGER trg_check_verified_hiring_requests BEFORE INSERT ON public.hiring_requests
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: conversations
DROP TRIGGER IF EXISTS trg_check_verified_conversations ON public.conversations;
CREATE TRIGGER trg_check_verified_conversations BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: messages
DROP TRIGGER IF EXISTS trg_check_verified_messages ON public.messages;
CREATE TRIGGER trg_check_verified_messages BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: worker_profiles (checks on both insert and update)
DROP TRIGGER IF EXISTS trg_check_verified_worker_profiles ON public.worker_profiles;
CREATE TRIGGER trg_check_verified_worker_profiles BEFORE INSERT OR UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: companies (checks on both insert and update)
-- Some profile setups might create/update company profile, let's protect it
DROP TRIGGER IF EXISTS trg_check_verified_companies ON public.companies;
CREATE TRIGGER trg_check_verified_companies BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: contact_requests
DROP TRIGGER IF EXISTS trg_check_verified_contact_requests ON public.contact_requests;
CREATE TRIGGER trg_check_verified_contact_requests BEFORE INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: reviews
DROP TRIGGER IF EXISTS trg_check_verified_reviews ON public.reviews;
CREATE TRIGGER trg_check_verified_reviews BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: reports
DROP TRIGGER IF EXISTS trg_check_verified_reports ON public.reports;
CREATE TRIGGER trg_check_verified_reports BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- Table: verification_requests
DROP TRIGGER IF EXISTS trg_check_verified_verification_requests ON public.verification_requests;
CREATE TRIGGER trg_check_verified_verification_requests BEFORE INSERT ON public.verification_requests
  FOR EACH ROW EXECUTE PROCEDURE public.check_email_verification_for_action();

-- 7. Add self-verification prevention trigger on profiles table
CREATE OR REPLACE FUNCTION public.prevent_self_verification()
RETURNS trigger AS $$
BEGIN
  -- If the field email_verified_for_actions is changed to true
  IF NEW.email_verified_for_actions IS TRUE AND (OLD.email_verified_for_actions IS NOT TRUE OR OLD.email_verified_for_actions IS NULL) THEN
    -- If auth.uid() is not null (meaning it's an authenticated client-side request), block it!
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'You cannot verify your own account directly from the client.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_verification ON public.profiles;
CREATE TRIGGER trg_prevent_self_verification BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_self_verification();
