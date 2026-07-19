-- =========================================================================
-- 1. ADD COLUMNS TO PROFILES AND WORKER_PROFILES
-- =========================================================================

-- Add account_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text CHECK (account_type IN ('basic', 'worker', 'company')) DEFAULT 'basic';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add user_id and new fields to worker_profiles
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS professional_title text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS primary_category text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS years_experience integer;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS experience_level text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS expected_salary_min numeric;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS expected_salary_max numeric;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS work_preference text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS availability_status text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS willing_to_relocate boolean DEFAULT false;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS service_radius numeric;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS current_employer text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS highest_qualification text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS course_specialization text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS institution text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS graduation_year integer;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS resume_path text;
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS worker_profile_completed boolean DEFAULT false;

-- Backfill user_id in worker_profiles
UPDATE public.worker_profiles SET user_id = id WHERE user_id IS NULL;

-- =========================================================================
-- 2. CREATE RELATED NORMALIZED TABLES
-- =========================================================================

-- worker_skills table
CREATE TABLE IF NOT EXISTS public.worker_skills (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  skill text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(worker_id, skill)
);

-- worker_experience table
CREATE TABLE IF NOT EXISTS public.worker_experience (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  employer text NOT NULL,
  role text NOT NULL,
  start_date date,
  end_date date,
  currently_working boolean DEFAULT false,
  description text,
  achievements text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- worker_certifications table
CREATE TABLE IF NOT EXISTS public.worker_certifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  institution text,
  graduation_year integer,
  licence_number text,
  training_program text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- worker_languages table
CREATE TABLE IF NOT EXISTS public.worker_languages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  language text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(worker_id, language)
);

-- worker_job_preferences table
CREATE TABLE IF NOT EXISTS public.worker_job_preferences (
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  job_categories text[] DEFAULT '{}'::text[],
  employment_types text[] DEFAULT '{}'::text[],
  preferred_locations text[] DEFAULT '{}'::text[],
  expected_pay_min numeric,
  expected_pay_max numeric,
  notice_period text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- worker_portfolio_items table
CREATE TABLE IF NOT EXISTS public.worker_portfolio_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  file_path text,
  link_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 3. CONSENT LOGS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.terms_consent_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  accepted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_agent text,
  account_type text NOT NULL
);

-- =========================================================================
-- 4. ENABLE RLS & DEFINE POLICIES
-- =========================================================================

ALTER TABLE public.worker_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_consent_logs ENABLE ROW LEVEL SECURITY;

-- worker_skills policies
CREATE POLICY "Anyone can read worker skills" ON public.worker_skills FOR SELECT USING (true);
CREATE POLICY "Workers can manage own skills" ON public.worker_skills FOR ALL USING (auth.uid() = worker_id);

-- worker_experience policies
CREATE POLICY "Anyone can read worker experience" ON public.worker_experience FOR SELECT USING (true);
CREATE POLICY "Workers can manage own experience" ON public.worker_experience FOR ALL USING (auth.uid() = worker_id);

-- worker_certifications policies
CREATE POLICY "Anyone can read worker certifications" ON public.worker_certifications FOR SELECT USING (true);
CREATE POLICY "Workers can manage own certifications" ON public.worker_certifications FOR ALL USING (auth.uid() = worker_id);

-- worker_languages policies
CREATE POLICY "Anyone can read worker languages" ON public.worker_languages FOR SELECT USING (true);
CREATE POLICY "Workers can manage own languages" ON public.worker_languages FOR ALL USING (auth.uid() = worker_id);

-- worker_job_preferences policies
CREATE POLICY "Anyone can read worker preferences" ON public.worker_job_preferences FOR SELECT USING (true);
CREATE POLICY "Workers can manage own preferences" ON public.worker_job_preferences FOR ALL USING (auth.uid() = worker_id);

-- worker_portfolio_items policies
CREATE POLICY "Anyone can read worker portfolio" ON public.worker_portfolio_items FOR SELECT USING (true);
CREATE POLICY "Workers can manage own portfolio" ON public.worker_portfolio_items FOR ALL USING (auth.uid() = worker_id);

-- terms_consent_logs policies
CREATE POLICY "Users can view own consent logs" ON public.terms_consent_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consent logs" ON public.terms_consent_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 5. CREATE PRIVATE RESUMES STORAGE BUCKET & RLS
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow users to access their own folder in the resumes bucket
DROP POLICY IF EXISTS "Users can read own resumes" ON storage.objects;
CREATE POLICY "Users can read own resumes" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own resumes" ON storage.objects;
CREATE POLICY "Users can upload own resumes" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;
CREATE POLICY "Users can update own resumes" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;
CREATE POLICY "Users can delete own resumes" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'resumes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
