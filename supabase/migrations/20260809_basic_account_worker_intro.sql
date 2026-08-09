-- Migration: 20260809_basic_account_worker_intro.sql
-- Description: Add basic_account_intro_seen column to profiles table to track one-time post-signup worker intro modal acknowledgment.
-- Existing profiles default to true so existing users do not receive the modal retroactively.
-- DO NOT APPLY REMOTELY YET.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS basic_account_intro_seen boolean NOT NULL DEFAULT true;
