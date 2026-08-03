-- Migration: 202608030007_admin_system_hardening.sql
-- Description: Security hardening for OpenComm Admin Control Center: canonical roles, permission checks, audit & security logs, feature flags, maintenance mode, and trusted admin RPCs.

-- 1. Helper Functions for Admin Role & Permission Verification
CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role 
  FROM public.admin_members 
  WHERE id = auth.uid() AND is_active = true;

  -- Map legacy content_admin to moderator role for canonical permission checks
  IF v_role = 'content_admin' THEN
    RETURN 'moderator';
  END IF;

  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text := public.get_admin_role();
BEGIN
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Super Admin has all permissions
  IF v_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Admin permissions
  IF v_role = 'admin' THEN
    IF p_permission IN ('staff_management', 'maintenance_mode', 'feature_flags') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- Moderator permissions
  IF v_role = 'moderator' THEN
    IF p_permission IN ('content_moderation', 'reports_management', 'worker_visibility', 'job_moderation', 'support_view') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- Support Admin permissions
  IF v_role = 'support' THEN
    IF p_permission IN ('support_tickets', 'read_only_user_lookup') THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(text) TO authenticated;

-- 2. Create admin_security_logs table
CREATE TABLE IF NOT EXISTS public.admin_security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_id uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create platform_feature_flags table
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  key text PRIMARY KEY,
  description text NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_by uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Seed Default Feature Flags
INSERT INTO public.platform_feature_flags (key, description, is_enabled)
VALUES
  ('user_registration', 'Enable new user account registrations', true),
  ('job_posting', 'Enable employer job posting creation', true),
  ('worker_listing', 'Enable public worker directory and listing', true),
  ('direct_hire', 'Enable direct hire request workflow', true),
  ('job_application_negotiation', 'Enable job application negotiation and agreement workflow', true),
  ('ratings_reviews', 'Enable contract ratings and review submission', true),
  ('notifications', 'Enable centralized in-app push notifications', true),
  ('support_tickets', 'Enable user support ticket creation', true)
ON CONFLICT (key) DO NOTHING;

-- 4. Extend admin_audit_logs safely
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS admin_role text;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 5. Enable RLS & Configure Append-Only Rules
ALTER TABLE public.admin_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;

-- Security Logs RLS: Super Admins can view
DROP POLICY IF EXISTS "Super Admins can view security logs" ON public.admin_security_logs;
CREATE POLICY "Super Admins can view security logs" ON public.admin_security_logs
  FOR SELECT TO authenticated
  USING (public.get_admin_role() = 'super_admin');

-- Feature Flags RLS: Anyone can read, only Admins/Super Admins can modify
DROP POLICY IF EXISTS "Anyone can read feature flags" ON public.platform_feature_flags;
CREATE POLICY "Anyone can read feature flags" ON public.platform_feature_flags
  FOR SELECT TO authenticated, anon
  USING (true);

-- Revoke direct writes on audit & security logs from PUBLIC, anon, and authenticated
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_logs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_security_logs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.platform_feature_flags FROM PUBLIC, anon, authenticated;

-- Audit Logs RLS Policy for Admins
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_admin_permission('audit_logs') OR public.get_admin_role() IN ('super_admin', 'admin'));

-- 6. RPC Helper: Internal Audit Log Recorder
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_previous_data jsonb DEFAULT NULL,
  p_new_data jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text := public.get_admin_role();
  v_log_id uuid;
BEGIN
  INSERT INTO public.admin_audit_logs (
    admin_id,
    admin_role,
    action,
    target_type,
    target_id,
    reason,
    previous_data,
    new_data,
    metadata,
    created_at
  )
  VALUES (
    v_admin_id,
    v_role,
    p_action,
    p_target_type,
    p_target_id,
    p_reason,
    p_previous_data,
    p_new_data,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action FROM PUBLIC, anon, authenticated;

-- 7. SECURE ADMIN RPCS

-- A. Admin Suspend User
CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_target_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role text := public.get_admin_role();
  v_target_role text;
  v_prev_data jsonb;
BEGIN
  IF NOT public.has_admin_permission('user_management') AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Permission denied. Only Admins and Super Admins can suspend users.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A non-empty reason is required to suspend a user.';
  END IF;

  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Self-suspension is strictly prohibited.';
  END IF;

  -- Check target role if target is an admin
  SELECT role INTO v_target_role FROM public.admin_members WHERE id = p_target_user_id;
  IF v_target_role = 'super_admin' AND v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can manage Super Admin accounts.';
  END IF;

  SELECT to_jsonb(p.*) INTO v_prev_data FROM public.profiles p WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  UPDATE public.profiles
  SET is_active = false, updated_at = now()
  WHERE id = p_target_user_id;

  -- Record audit log
  PERFORM public.log_admin_action(
    'suspend_user',
    'profile',
    p_target_user_id::text,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('is_active', false)
  );

  RETURN jsonb_build_object('success', true, 'message', 'User suspended successfully.');
END;
$$;

-- B. Admin Reactivate User
CREATE OR REPLACE FUNCTION public.admin_reactivate_user(
  p_target_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_prev_data jsonb;
BEGIN
  IF NOT public.has_admin_permission('user_management') AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT to_jsonb(p.*) INTO v_prev_data FROM public.profiles p WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  UPDATE public.profiles
  SET is_active = true, updated_at = now()
  WHERE id = p_target_user_id;

  PERFORM public.log_admin_action(
    'reactivate_user',
    'profile',
    p_target_user_id::text,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('is_active', true)
  );

  RETURN jsonb_build_object('success', true, 'message', 'User reactivated successfully.');
END;
$$;

-- C. Admin Moderate Worker Profile (hide / restore)
CREATE OR REPLACE FUNCTION public.admin_moderate_worker_profile(
  p_worker_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_new_visible boolean;
  v_prev_data jsonb;
BEGIN
  IF NOT public.has_admin_permission('worker_visibility') AND v_caller_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_action NOT IN ('hide', 'restore') THEN
    RAISE EXCEPTION 'Invalid action. Must be hide or restore.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  v_new_visible := (p_action = 'restore');

  SELECT to_jsonb(w.*) INTO v_prev_data FROM public.worker_profiles w WHERE id = p_worker_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Worker profile not found.';
  END IF;

  UPDATE public.worker_profiles
  SET is_visible = v_new_visible, updated_at = now()
  WHERE id = p_worker_id;

  PERFORM public.log_admin_action(
    'moderate_worker_profile:' || p_action,
    'worker_profile',
    p_worker_id::text,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('is_visible', v_new_visible)
  );

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- D. Admin Moderate Job (close / archive / restore)
CREATE OR REPLACE FUNCTION public.admin_moderate_job(
  p_job_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_new_status text;
  v_prev_data jsonb;
BEGIN
  IF NOT public.has_admin_permission('job_moderation') AND v_caller_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_action = 'close' THEN v_new_status := 'closed';
  ELSIF p_action = 'archive' THEN v_new_status := 'archived';
  ELSIF p_action = 'restore' THEN v_new_status := 'active';
  ELSE RAISE EXCEPTION 'Invalid action. Must be close, archive, or restore.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT to_jsonb(j.*) INTO v_prev_data FROM public.jobs j WHERE id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job posting not found.';
  END IF;

  UPDATE public.jobs
  SET status = v_new_status, updated_at = now()
  WHERE id = p_job_id;

  PERFORM public.log_admin_action(
    'moderate_job:' || p_action,
    'job',
    p_job_id::text,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('status', v_new_status)
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- E. Admin Resolve Review Report
CREATE OR REPLACE FUNCTION public.admin_resolve_review_report(
  p_report_id uuid,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_report RECORD;
  v_new_status text;
BEGIN
  IF NOT public.has_admin_permission('reports_management') AND v_caller_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_action NOT IN ('dismiss', 'hide_review', 'mark_actioned') THEN
    RAISE EXCEPTION 'Invalid action.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT * INTO v_report FROM public.review_reports WHERE id = p_report_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  IF p_action = 'dismiss' THEN
    v_new_status := 'dismissed';
  ELSE
    v_new_status := 'actioned';
    IF p_action = 'hide_review' THEN
      UPDATE public.contract_reviews SET is_public = false, updated_at = now() WHERE id = v_report.review_id;
    END IF;
  END IF;

  UPDATE public.review_reports SET status = v_new_status WHERE id = p_report_id;

  PERFORM public.log_admin_action(
    'resolve_review_report:' || p_action,
    'review_report',
    p_report_id::text,
    TRIM(p_reason),
    to_jsonb(v_report),
    jsonb_build_object('status', v_new_status)
  );

  RETURN jsonb_build_object('success', true, 'status', v_new_status);
END;
$$;

-- F. Admin Hide Review
CREATE OR REPLACE FUNCTION public.admin_hide_review(
  p_review_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_prev_data jsonb;
BEGIN
  IF NOT public.has_admin_permission('reports_management') AND v_caller_role NOT IN ('super_admin', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT to_jsonb(r.*) INTO v_prev_data FROM public.contract_reviews r WHERE id = p_review_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found.';
  END IF;

  UPDATE public.contract_reviews SET is_public = false, updated_at = now() WHERE id = p_review_id;

  PERFORM public.log_admin_action(
    'hide_review',
    'contract_review',
    p_review_id::text,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('is_public', false)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Review hidden successfully.');
END;
$$;

-- G. Admin Send Platform Notification
CREATE OR REPLACE FUNCTION public.admin_send_platform_notification(
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_target_url text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_notif_id uuid;
BEGIN
  IF v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  PERFORM public.create_notification(
    p_recipient_id,
    'system_announcement',
    TRIM(p_title),
    TRIM(p_message),
    TRIM(p_target_url),
    auth.uid(),
    jsonb_build_object('admin_sent', true)
  );

  PERFORM public.log_admin_action(
    'send_platform_notification',
    'notification',
    p_recipient_id::text,
    TRIM(p_reason),
    NULL,
    jsonb_build_object('title', p_title, 'recipient_id', p_recipient_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Notification sent successfully.');
END;
$$;

-- H. Admin Update Platform Setting
CREATE OR REPLACE FUNCTION public.admin_update_platform_setting(
  p_setting_key text,
  p_setting_value jsonb,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_prev_data jsonb;
BEGIN
  IF v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Permission denied.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT to_jsonb(s.*) INTO v_prev_data FROM public.site_settings s WHERE setting_key = p_setting_key;

  INSERT INTO public.site_settings (id, group_name, setting_key, setting_value, updated_by, updated_at)
  VALUES (
    p_setting_key,
    'system',
    p_setting_key,
    p_setting_value,
    auth.uid(),
    now()
  )
  ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_by = auth.uid(),
    updated_at = now();

  PERFORM public.log_admin_action(
    'update_platform_setting',
    'site_setting',
    p_setting_key,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('setting_key', p_setting_key, 'setting_value', p_setting_value)
  );

  RETURN jsonb_build_object('success', true, 'setting_key', p_setting_key);
END;
$$;

-- I. Admin Set Feature Flag
CREATE OR REPLACE FUNCTION public.admin_set_feature_flag(
  p_flag_key text,
  p_is_enabled boolean,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_prev_data jsonb;
BEGIN
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can manage feature flags.';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason is required.';
  END IF;

  SELECT to_jsonb(f.*) INTO v_prev_data FROM public.platform_feature_flags f WHERE key = p_flag_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature flag key not found.';
  END IF;

  UPDATE public.platform_feature_flags
  SET is_enabled = p_is_enabled, updated_by = auth.uid(), updated_at = now()
  WHERE key = p_flag_key;

  PERFORM public.log_admin_action(
    'set_feature_flag',
    'feature_flag',
    p_flag_key,
    TRIM(p_reason),
    v_prev_data,
    jsonb_build_object('key', p_flag_key, 'is_enabled', p_is_enabled)
  );

  RETURN jsonb_build_object('success', true, 'key', p_flag_key, 'is_enabled', p_is_enabled);
END;
$$;

-- J. Admin Toggle Maintenance Mode
CREATE OR REPLACE FUNCTION public.admin_toggle_maintenance_mode(
  p_enabled boolean,
  p_message text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_msg text := COALESCE(NULLIF(TRIM(p_message), ''), 'Scheduled platform maintenance in progress.');
BEGIN
  IF v_caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can toggle system maintenance mode.';
  END IF;

  PERFORM public.admin_update_platform_setting(
    'system.maintenance_mode',
    jsonb_build_object('enabled', p_enabled, 'message', v_msg, 'toggled_at', now()),
    COALESCE(p_reason, 'Maintenance mode toggled by Super Admin')
  );

  RETURN jsonb_build_object('success', true, 'maintenance_enabled', p_enabled, 'message', v_msg);
END;
$$;

-- K. Real Analytics RPC
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text := public.get_admin_role();
  v_result jsonb;
  
  -- Metrics
  v_total_users int := 0;
  v_basic_users int := 0;
  v_worker_users int := 0;
  v_company_users int := 0;
  v_active_users int := 0;
  v_suspended_users int := 0;
  
  v_total_jobs int := 0;
  v_active_jobs int := 0;
  v_closed_jobs int := 0;
  
  v_total_applications int := 0;
  v_active_hire_requests int := 0;
  v_active_negotiations int := 0;
  
  v_total_contracts int := 0;
  v_active_contracts int := 0;
  v_completed_contracts int := 0;
  v_cancelled_contracts int := 0;
  
  v_total_reviews int := 0;
  v_platform_avg_rating numeric := 0;
  v_pending_review_reports int := 0;
  v_unread_support_tickets int := 0;
  v_notifs_last_24h int := 0;
  v_new_users_last_7d int := 0;
BEGIN
  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Access denied. Admin session required.';
  END IF;

  -- Users metrics
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE profile_type = 'normal')::int,
    COUNT(*) FILTER (WHERE profile_type = 'worker')::int,
    COUNT(*) FILTER (WHERE profile_type = 'company')::int,
    COUNT(*) FILTER (WHERE is_active = true)::int,
    COUNT(*) FILTER (WHERE is_active = false)::int,
    COUNT(*) FILTER (WHERE created_at >= (now() - INTERVAL '7 days'))::int
  INTO 
    v_total_users, v_basic_users, v_worker_users, v_company_users,
    v_active_users, v_suspended_users, v_new_users_last_7d
  FROM public.profiles;

  -- Jobs metrics
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'active')::int,
    COUNT(*) FILTER (WHERE status = 'closed')::int
  INTO v_total_jobs, v_active_jobs, v_closed_jobs
  FROM public.jobs;

  -- Applications & Direct Hire metrics
  SELECT COUNT(*)::int INTO v_total_applications FROM public.job_applications;
  
  SELECT COUNT(*)::int INTO v_active_hire_requests 
  FROM public.hiring_requests 
  WHERE status IN ('pending', 'accepted');

  SELECT COUNT(*)::int INTO v_active_negotiations 
  FROM public.negotiation_rooms 
  WHERE status = 'active';

  -- Contracts metrics
  SELECT 
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'active')::int,
    COUNT(*) FILTER (WHERE status = 'completed')::int,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int
  INTO v_total_contracts, v_active_contracts, v_completed_contracts, v_cancelled_contracts
  FROM public.work_contracts;

  -- Reviews & Reports metrics
  SELECT 
    COUNT(*)::int,
    COALESCE(ROUND(AVG(rating)::numeric, 2), 0)
  INTO v_total_reviews, v_platform_avg_rating
  FROM public.contract_reviews
  WHERE is_public = true;

  SELECT COUNT(*)::int INTO v_pending_review_reports 
  FROM public.review_reports 
  WHERE status = 'pending';

  -- Support & Notifications metrics
  SELECT COUNT(*)::int INTO v_unread_support_tickets 
  FROM public.support_tickets 
  WHERE status IN ('open', 'in_progress');

  SELECT COUNT(*)::int INTO v_notifs_last_24h 
  FROM public.notifications 
  WHERE created_at >= (now() - INTERVAL '24 hours');

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'basic_users', v_basic_users,
    'worker_users', v_worker_users,
    'company_users', v_company_users,
    'active_users', v_active_users,
    'suspended_users', v_suspended_users,
    'new_users_last_7d', v_new_users_last_7d,
    'total_jobs', v_total_jobs,
    'active_jobs', v_active_jobs,
    'closed_jobs', v_closed_jobs,
    'total_applications', v_total_applications,
    'active_hire_requests', v_active_hire_requests,
    'active_negotiations', v_active_negotiations,
    'total_contracts', v_total_contracts,
    'active_contracts', v_active_contracts,
    'completed_contracts', v_completed_contracts,
    'cancelled_contracts', v_cancelled_contracts,
    'total_reviews', v_total_reviews,
    'platform_average_rating', v_platform_avg_rating,
    'pending_review_reports', v_pending_review_reports,
    'unread_support_tickets', v_unread_support_tickets,
    'notifications_last_24h', v_notifs_last_24h
  );
END;
$$;

-- Grant EXECUTE privileges to authenticated users on Admin RPCs (Internal role checks inside each function guarantee strict authorization)
REVOKE EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reactivate_user(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_worker_profile(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_moderate_job(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_review_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_hide_review(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_send_platform_notification(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_platform_setting(text, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_feature_flag(text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_maintenance_mode(boolean, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_dashboard_analytics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_suspend_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_worker_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_moderate_job(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_review_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_platform_notification(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_setting(text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag(text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_maintenance_mode(boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_analytics() TO authenticated;
