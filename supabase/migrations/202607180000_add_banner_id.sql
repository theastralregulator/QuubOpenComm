-- Add banner_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_id text DEFAULT 'banner_01';
