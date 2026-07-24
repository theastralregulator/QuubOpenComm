-- Admin Members Table
CREATE TABLE public.admin_members (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('support', 'content_admin', 'moderator', 'admin', 'super_admin')),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Admin Audit Logs
CREATE TABLE public.admin_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  reason text,
  request_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Admin Notes
CREATE TABLE public.admin_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  note text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Site Settings
CREATE TABLE public.site_settings (
  id text PRIMARY KEY,
  group_name text NOT NULL,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Site Content
CREATE TABLE public.site_content (
  id text PRIMARY KEY,
  content_type text NOT NULL,
  content_key text NOT NULL UNIQUE,
  content_value jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  updated_by uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Announcements
CREATE TABLE public.announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  cta_text text,
  cta_link text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Support Tickets
CREATE TABLE public.support_tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.admin_members(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Helper Function for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_members 
    WHERE id = auth.uid() AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_admin_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.admin_members 
  WHERE id = auth.uid() AND is_active = true;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- Admin Members: Only admins can view, only super_admins can modify (via edge function ideally, but allow super_admin select)
CREATE POLICY "Admins can view admin_members" ON public.admin_members
  FOR SELECT USING (public.is_admin());

-- Admin Audit Logs: Append-only for all admins (insert usually via edge functions using service role, but for select, all admins can view)
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin());

-- Admin Notes: All admins can view and insert, only author can edit/delete
CREATE POLICY "Admins can view notes" ON public.admin_notes
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert notes" ON public.admin_notes
  FOR INSERT WITH CHECK (public.is_admin() AND auth.uid() = admin_id);
CREATE POLICY "Admins can update own notes" ON public.admin_notes
  FOR UPDATE USING (auth.uid() = admin_id);

-- Site Settings: Anyone can read, only admins can modify
CREATE POLICY "Anyone can read site_settings" ON public.site_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can modify site_settings" ON public.site_settings
  FOR ALL USING (public.is_admin());

-- Site Content: Anyone can read published, only admins can read all and modify
CREATE POLICY "Anyone can read published site_content" ON public.site_content
  FOR SELECT USING (status = 'published');
CREATE POLICY "Admins can view all site_content" ON public.site_content
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can modify site_content" ON public.site_content
  FOR ALL USING (public.is_admin());

-- Announcements: Anyone can read active, admins can modify
CREATE POLICY "Anyone can read active announcements" ON public.announcements
  FOR SELECT USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins can view all announcements" ON public.announcements
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can modify announcements" ON public.announcements
  FOR ALL USING (public.is_admin());

-- Support Tickets: Users can read/write their own, admins can read/write all
CREATE POLICY "Users can view own support_tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own support_tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all support_tickets" ON public.support_tickets
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update support_tickets" ON public.support_tickets
  FOR UPDATE USING (public.is_admin());

-- Initial Super Admin Seed (Requires manual replacement of UUID if using pure SQL without variables, but we'll use a DO block to fetch the user ID)
DO $$
DECLARE
  super_admin_id uuid;
BEGIN
  -- Attempt to find the user by email
  SELECT id INTO super_admin_id FROM auth.users WHERE email = 'Sabinsaji3900@gmail.com' LIMIT 1;
  
  -- If user exists, insert into admin_members
  IF super_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_members (id, email, role, is_active)
    VALUES (super_admin_id, 'Sabinsaji3900@gmail.com', 'super_admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin', is_active = true;
  END IF;
END $$;
