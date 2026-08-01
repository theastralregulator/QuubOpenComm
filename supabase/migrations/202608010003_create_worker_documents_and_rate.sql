-- Migration: Create worker_documents table, rate fields, storage policies, and update worker_directory view

-- 1. Add salary_period column to worker_profiles if missing
ALTER TABLE public.worker_profiles ADD COLUMN IF NOT EXISTS salary_period text DEFAULT 'hourly';

-- 2. Create public.worker_documents Table
CREATE TABLE IF NOT EXISTS public.worker_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('Portfolio', 'CV', 'Resume')),
  title text NOT NULL,
  description text,
  file_url text,
  storage_path text,
  external_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on worker_documents
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public users can view public worker documents" ON public.worker_documents;
DROP POLICY IF EXISTS "Users can insert their own worker documents" ON public.worker_documents;
DROP POLICY IF EXISTS "Users can update their own worker documents" ON public.worker_documents;
DROP POLICY IF EXISTS "Users can delete their own worker documents" ON public.worker_documents;

-- Create RLS Policies
CREATE POLICY "Public users can view public worker documents" ON public.worker_documents
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own worker documents" ON public.worker_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own worker documents" ON public.worker_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own worker documents" ON public.worker_documents
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_documents TO authenticated;
GRANT SELECT ON public.worker_documents TO anon;

-- 3. Storage Bucket setup for worker-documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-documents', 'worker-documents', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies
DROP POLICY IF EXISTS "Users can upload their own worker documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own worker documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own worker documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view worker document files" ON storage.objects;

CREATE POLICY "Users can upload their own worker documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own worker documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own worker documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view worker document files" ON storage.objects
  FOR SELECT USING (bucket_id = 'worker-documents');

-- 4. Update worker_directory View to include rate & document fields
CREATE OR REPLACE VIEW public.worker_directory
WITH (security_invoker = true) AS
SELECT 
  w.id,
  COALESCE(NULLIF(w.profession, ''), NULLIF(w.professional_title, ''), 'Service Provider') AS profession,
  w.skills,
  COALESCE(w.experience_years, 0) AS experience_years,
  COALESCE(NULLIF(w.work_location, ''), NULLIF(CONCAT_WS(', ', p.city, p.state, p.country), '')) AS work_location,
  COALESCE(NULLIF(w.availability, ''), 'Available Now') AS availability,
  COALESCE(NULLIF(w.bio_summary, ''), p.bio) AS bio_summary,
  COALESCE(w.hourly_rate, 0) AS hourly_rate,
  w.expected_salary,
  w.expected_salary_min,
  w.expected_salary_max,
  COALESCE(NULLIF(w.salary_period, ''), 'hourly') AS salary_period,
  w.work_preference,
  w.primary_category,
  w.portfolio_url,
  w.certificates,
  w.languages,
  COALESCE(w.listing_enabled, true) AS listing_enabled,
  w.created_at,
  w.updated_at,
  p.username,
  p.full_name,
  p.avatar_url,
  p.banner_url,
  p.city,
  p.state,
  p.country,
  p.account_status,
  p.verification_status,
  p.profile_type
FROM public.worker_profiles w
JOIN public.profile_directory p ON w.id = p.id
WHERE p.profile_type = 'worker';

GRANT SELECT ON public.worker_directory TO anon, authenticated;
