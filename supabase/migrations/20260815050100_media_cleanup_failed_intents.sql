-- Migration: 20260815_media_cleanup_failed_intents.sql
-- Description: Update partial indexes on media_upload_intents to include failed intents for orphan cleanup

CREATE INDEX IF NOT EXISTS idx_media_upload_intents_cleanup_status 
ON public.media_upload_intents (status, expires_at) 
WHERE status IN ('pending', 'uploaded', 'finalizing', 'failed');
