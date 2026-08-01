-- Migration: Update public.worker_directory view to include listing_enabled and account_status
CREATE OR REPLACE VIEW public.worker_directory
WITH (security_invoker = true) AS
SELECT 
  w.id, w.profession, w.skills, w.experience_years, w.work_location, w.availability, 
  w.bio_summary, w.hourly_rate, w.expected_salary, w.portfolio_url, w.certificates, 
  w.languages, w.listing_enabled, w.created_at, w.updated_at,
  p.username, p.full_name, p.avatar_url, p.banner_url, p.city, p.state, p.country, p.account_status, p.verification_status, p.profile_type
FROM public.worker_profiles w
JOIN public.profile_directory p ON w.id = p.id
WHERE p.profile_type = 'worker';

GRANT SELECT ON public.worker_directory TO anon, authenticated;
