-- Migration: 20260809_location_service_health.sql
-- Description: Privacy-safe location service telemetry table, RLS, 30-day cleanup, and admin health RPC
-- DO NOT APPLY REMOTELY YET.

-- 1. Create location_service_events table
CREATE TABLE IF NOT EXISTS public.location_service_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL CHECK (service IN ('nominatim_reverse', 'osm_tiles')),
  event_type text NOT NULL CHECK (event_type IN ('success', 'http_error', 'rate_limited', 'forbidden', 'timeout', 'network_error', 'tile_error')),
  http_status integer NULL,
  latency_ms integer NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  source text NULL CHECK (source IN ('gps', 'map_confirm', 'map_tiles')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create performance indexes for admin aggregation
CREATE INDEX IF NOT EXISTS idx_location_service_events_service_created 
  ON public.location_service_events (service, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_service_events_type_created 
  ON public.location_service_events (event_type, created_at DESC);

-- 3. Row Level Security & Table Permissions
ALTER TABLE public.location_service_events ENABLE ROW LEVEL SECURITY;

-- Revoke direct browser table access from public, anon, and authenticated users
REVOKE ALL ON public.location_service_events FROM PUBLIC, anon, authenticated;

-- 4. 30-Day Cleanup Function
CREATE OR REPLACE FUNCTION public.cleanup_old_location_service_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.location_service_events
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_location_service_events() FROM PUBLIC, anon, authenticated;

-- Schedule daily cron cleanup if pg_cron extension is active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-location-service-events-job',
      '0 3 * * *',
      'SELECT public.cleanup_old_location_service_events()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Safe fallback if pg_cron is unavailable or non-superuser
  NULL;
END $$;

-- 5. Admin Aggregation RPC for System Health Monitoring
CREATE OR REPLACE FUNCTION public.admin_get_location_service_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_now timestamptz := now();
  v_1h timestamptz := v_now - INTERVAL '1 hour';
  v_24h timestamptz := v_now - INTERVAL '24 hours';

  -- Nominatim metrics
  v_nom_last_success timestamptz;
  v_nom_last_failure timestamptz;
  v_nom_succ_1h int := 0;
  v_nom_fail_1h int := 0;
  v_nom_succ_24h int := 0;
  v_nom_fail_24h int := 0;
  v_nom_rate_24h int := 0;
  v_nom_forb_24h int := 0;
  v_nom_time_24h int := 0;
  v_nom_avg_lat_24h int := 0;

  -- OSM Tiles metrics
  v_osm_last_success timestamptz;
  v_osm_last_failure timestamptz;
  v_osm_succ_1h int := 0;
  v_osm_fail_1h int := 0;
  v_osm_succ_24h int := 0;
  v_osm_fail_24h int := 0;
BEGIN
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin permissions required' USING ERRCODE = '42501';
  END IF;

  -- Nominatim Last timestamps
  SELECT MAX(created_at) INTO v_nom_last_success
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'success';

  SELECT MAX(created_at) INTO v_nom_last_failure
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type != 'success';

  -- Nominatim 1h counts
  SELECT COUNT(*) INTO v_nom_succ_1h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'success' AND created_at >= v_1h;

  SELECT COUNT(*) INTO v_nom_fail_1h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type != 'success' AND created_at >= v_1h;

  -- Nominatim 24h counts
  SELECT COUNT(*) INTO v_nom_succ_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'success' AND created_at >= v_24h;

  SELECT COUNT(*) INTO v_nom_fail_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type != 'success' AND created_at >= v_24h;

  SELECT COUNT(*) INTO v_nom_rate_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'rate_limited' AND created_at >= v_24h;

  SELECT COUNT(*) INTO v_nom_forb_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'forbidden' AND created_at >= v_24h;

  SELECT COUNT(*) INTO v_nom_time_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'timeout' AND created_at >= v_24h;

  SELECT COALESCE(ROUND(AVG(latency_ms)), 0) INTO v_nom_avg_lat_24h
  FROM public.location_service_events
  WHERE service = 'nominatim_reverse' AND event_type = 'success' AND created_at >= v_24h AND latency_ms IS NOT NULL;

  -- OSM Tiles Last timestamps
  SELECT MAX(created_at) INTO v_osm_last_success
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type = 'success';

  SELECT MAX(created_at) INTO v_osm_last_failure
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type != 'success';

  -- OSM Tiles 1h counts
  SELECT COUNT(*) INTO v_osm_succ_1h
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type = 'success' AND created_at >= v_1h;

  SELECT COUNT(*) INTO v_osm_fail_1h
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type != 'success' AND created_at >= v_1h;

  -- OSM Tiles 24h counts
  SELECT COUNT(*) INTO v_osm_succ_24h
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type = 'success' AND created_at >= v_24h;

  SELECT COUNT(*) INTO v_osm_fail_24h
  FROM public.location_service_events
  WHERE service = 'osm_tiles' AND event_type != 'success' AND created_at >= v_24h;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'nominatim', jsonb_build_object(
      'last_success_at', v_nom_last_success,
      'last_failure_at', v_nom_last_failure,
      'successes_1h', v_nom_succ_1h,
      'failures_1h', v_nom_fail_1h,
      'successes_24h', v_nom_succ_24h,
      'failures_24h', v_nom_fail_24h,
      'rate_limited_24h', v_nom_rate_24h,
      'forbidden_24h', v_nom_forb_24h,
      'timeouts_24h', v_nom_time_24h,
      'avg_latency_ms_24h', v_nom_avg_lat_24h
    ),
    'osm_tiles', jsonb_build_object(
      'last_success_at', v_osm_last_success,
      'last_failure_at', v_osm_last_failure,
      'successes_1h', v_osm_succ_1h,
      'failures_1h', v_osm_fail_1h,
      'successes_24h', v_osm_succ_24h,
      'failures_24h', v_osm_fail_24h
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_location_service_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_location_service_health() TO authenticated;
