-- Migration: Create user_settings table and RLS policies
-- 202608040000_user_settings.sql

CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_visibility text DEFAULT 'public',
    message_permissions text DEFAULT 'everyone',
    hire_request_permissions text DEFAULT 'everyone',
    show_online_status boolean DEFAULT true,
    show_exact_location boolean DEFAULT false,
    search_engine_indexing boolean DEFAULT true,
    theme_preference text DEFAULT 'system',
    language_preference text DEFAULT 'en',
    timezone text DEFAULT 'UTC',
    date_format text DEFAULT 'YYYY-MM-DD',
    show_reviews_publicly boolean DEFAULT true,
    show_completed_work_count boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Trigger to update updated_at on modification
CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_settings_timestamp ON public.user_settings;
CREATE TRIGGER set_user_settings_timestamp
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_user_settings_timestamp();

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read own settings"
    ON public.user_settings
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow update own settings"
    ON public.user_settings
    FOR UPDATE
    USING (auth.uid() = user_id);

-- End of migration
