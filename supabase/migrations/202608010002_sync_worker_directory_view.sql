-- Migration: Ensure public.worker_directory view coalesces bio, location, and title with canonical profiles
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
