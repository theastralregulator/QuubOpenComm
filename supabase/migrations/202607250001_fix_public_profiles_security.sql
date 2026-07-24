-- Recreate the public.public_profiles view using security_invoker
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles WITH (security_invoker = true) AS
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  city, 
  state, 
  country, 
  preferred_language, 
  bio, 
  profile_type, 
  onboarding_completed,
  created_at
FROM public.profiles
WHERE account_status = 'active';
