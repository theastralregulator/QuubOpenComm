import { createClient } from '@supabase/supabase-js';
import { analytics } from './analytics';
import { ConversationViewModel, DbMessage, UserLoginActivity, DeactivationStatusResponse, Worker } from '../types';
import { normalizeJobType } from './jobType';
import { UserSettings } from '../types';
import { clearProfileCache, getPublicProfilesByIds, CanonicalPublicProfile } from './profileService';
import { notificationService } from './notificationService';

// Retrieve public environment variables
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export let NEXT_PUBLIC_APP_URL = (import.meta as any).env?.VITE_APP_URL || '';

// Fallback to current browser origin if undefined
if (!NEXT_PUBLIC_APP_URL && typeof window !== 'undefined') {
  NEXT_PUBLIC_APP_URL = window.location.origin;
}

export let supabase: any = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client successfully initialized with environment variables.');
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
}

let activeSupabaseUrl = SUPABASE_URL;
let activeSupabaseAnonKey = SUPABASE_ANON_KEY;

// Dynamically try to load/refresh Supabase client from a runtime config endpoint
export async function initializeRuntimeSupabase() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.appUrl) {
        NEXT_PUBLIC_APP_URL = data.appUrl;
      }
      if (data.supabaseUrl && data.supabaseAnonKey) {
        activeSupabaseUrl = data.supabaseUrl;
        activeSupabaseAnonKey = data.supabaseAnonKey;
        if (!supabase) {
          supabase = createClient(data.supabaseUrl, data.supabaseAnonKey);
          console.log('Supabase client initialized dynamically from runtime /api/config');
        }
        return supabase;
      }
    }
  } catch (err) {
    console.warn('Could not load dynamic configuration from /api/config.');
  }
  return supabase;
}

export function createTemporaryAuthClient() {
  const url = activeSupabaseUrl || (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const key = activeSupabaseAnonKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    });
  } catch (err) {
    console.error('Failed to create temporary auth client:', err);
    return null;
  }
}

// =========================================================================
// OFFLINE HIGH-FIDELITY EMULATION LAYER FOR LOCAL SANDBOX TESTING
// =========================================================================

const getLocalData = (key: string, defaultValue: any) => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return defaultValue;
  }
};

const saveLocalData = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export interface LocalProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  profile_image_url?: string;
  avatar_id?: string;
  default_avatar_id?: string;
  bio: string;
  short_bio?: string;
  phone: string;
  phone_country_code?: string;
  phone_number?: string;
  whatsapp_same_as_phone?: boolean;
  telegram_username?: string;
  phone_verified: boolean;
  email: string;
  city: string;
  state: string;
  country: string;
  country_code?: string;
  state_code?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  preferred_language: string;
  account_status: 'active' | 'deactivated' | 'suspended' | 'under_review' | 'disabled';
  profile_type: 'basic' | 'worker' | 'company';
  is_worker_listed?: boolean;
  signup_status?: 'pending_verification' | 'completed';
  opencomm_id?: string;
  created_at: string;
  updated_at: string;
  email_verified_for_actions?: boolean;
  onboarding_completed?: boolean;
  basic_account_intro_seen?: boolean;
  banner_id?: string;
  banner_url?: string;
  show_location_publicly?: boolean;
  location_visibility?: boolean;
}

export interface LocalWorkerExperience {
  id?: string;
  worker_id?: string;
  employer: string;
  role: string;
  start_date?: string;
  end_date?: string;
  currently_working?: boolean;
  description?: string;
  achievements?: string;
}

export interface LocalWorkerCertification {
  id?: string;
  worker_id?: string;
  name: string;
  institution?: string;
  graduation_year?: number;
  licence_number?: string;
  training_program?: string;
}

export interface LocalWorkerJobPreferences {
  job_categories?: string[];
  employment_types?: string[];
  preferred_locations?: string[];
  expected_pay_min?: number;
  expected_pay_max?: number;
  notice_period?: string;
}

export interface LocalWorkerProfile {
  id: string; // references profile id
  profession: string;
  skills: string[];
  experience_years: number;
  work_location: string;
  availability: 'Available Now' | 'Part-time' | 'Full-time' | 'Busy';
  bio_summary: string;
  hourly_rate?: number;
  expected_salary?: string;
  portfolio_url?: string;
  certificates?: string[];
  languages?: string[];

  // New fields
  professional_title?: string;
  primary_category?: string;
  years_experience?: number;
  experience_level?: string;
  expected_salary_min?: number;
  expected_salary_max?: number;
  currency?: string;
  work_preference?: string;
  availability_status?: string;
  willing_to_relocate?: boolean;
  service_radius?: number;
  current_employer?: string;
  linkedin_url?: string;
  github_url?: string;
  highest_qualification?: string;
  course_specialization?: string;
  institution?: string;
  graduation_year?: number;
  resume_path?: string;
  worker_profile_completed?: boolean;
  listing_enabled?: boolean;
  verification_status?: string;
  profile_status?: string;
  services_offered?: string[];
  travel_radius_km?: number;

  // Normalized relations
  experience?: LocalWorkerExperience[];
  certifications?: LocalWorkerCertification[];
  job_preferences?: LocalWorkerJobPreferences;
}

export interface LocalCompanyProfile {
  id: string; // references profile id
  name: string;
  logo_url: string;
  industry: string;
  description: string;
  city: string;
  state: string;
  country: string;
  website_url?: string;
  team_size?: string;
  verified: boolean;
}

export interface AdminMember {
  id: string;
  email: string;
  role: 'support' | 'content_admin' | 'moderator' | 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  added_by?: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  previous_data?: any;
  new_data?: any;
  reason?: string;
  request_id?: string;
  created_at: string;
}

export interface AdminNote {
  id: string;
  admin_id: string;
  target_type: string;
  target_id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface SiteSetting {
  id: string;
  group_name: string;
  setting_key: string;
  setting_value: any;
  description?: string;
  updated_by?: string;
  updated_at: string;
}

export interface SiteContent {
  id: string;
  content_type: string;
  content_key: string;
  content_value: any;
  status: 'draft' | 'published' | 'archived';
  updated_by?: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: string;
  cta_text?: string;
  cta_link?: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface LocalContactRequest {
  id: string;
  requester_id: string;
  profile_owner_id: string;
  request_type: 'phone' | 'email' | 'both';
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  created_at: string;
}

export interface LocalHiringRequest {
  id: string;
  client_id: string;
  client_name: string;
  worker_id: string;
  worker_name: string;
  work_title: string;
  description: string;
  budget: number;
  preferred_date: string;
  location?: string;
  duration?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | string;
  created_at: string;
}

// Standard data initializers
const DEFAULT_PROFILES: LocalProfile[] = [
  {
    id: 'user-demo-id',
    full_name: 'Akhil Varma',
    username: 'akhilvarma',
    avatar_url: '',
    default_avatar_id: 'avatar-tech-01',
    bio: 'Experienced full stack developer focusing on clean, modular component structures.',
    phone: '+919876543210',
    phone_verified: true,
    email: 'akhil@opencomm.org',
    city: 'Kochi',
    state: 'Kerala',
    country: 'India',
    preferred_language: 'English',
    account_status: 'active',
    profile_type: 'basic',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_verified_for_actions: true
  }
];

export const openCommDb = {
  getProfiles: (): LocalProfile[] => getLocalData('oc_profiles', DEFAULT_PROFILES),
  saveProfiles: (data: LocalProfile[]) => saveLocalData('oc_profiles', data),

  getWorkerProfiles: (): LocalWorkerProfile[] => getLocalData('oc_worker_profiles', []),
  saveWorkerProfiles: (data: LocalWorkerProfile[]) => saveLocalData('oc_worker_profiles', data),

  getCompanies: (): LocalCompanyProfile[] => getLocalData('oc_companies', []),
  saveCompanies: (data: LocalCompanyProfile[]) => saveLocalData('oc_companies', data),

  getContactRequests: (): LocalContactRequest[] => getLocalData('oc_contact_requests', []),
  saveContactRequests: (data: LocalContactRequest[]) => saveLocalData('oc_contact_requests', data),

  getHiringRequests: (): LocalHiringRequest[] => getLocalData('oc_hiring_requests', []),
  saveHiringRequests: (data: LocalHiringRequest[]) => saveLocalData('oc_hiring_requests', data)
};

// Unified database interactions
export async function assertUserEmailConfirmed() {
  if (supabase) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error("Authentication required. Please sign in.");
    }

    // Fetch profile and check email_verified_for_actions
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('email_verified_for_actions')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile || !profile.email_verified_for_actions) {
      if (user.email_confirmed_at) {
        // Native auth says confirmed, but profile is out of sync. Sync it using RPC.
        const { error: syncErr } = await supabase.rpc('sync_email_verification');
        if (!syncErr) {
          return; // Synced successfully, proceed.
        } else {
          console.error("Failed to sync email verification:", syncErr);
        }
      }
      throw new Error("Email verification is required for applications, job posting, hiring requests, and professional messaging.");
    }
  } else {
    // Local emulation checking
    const loggedInId = localStorage.getItem('opencomm_user_id') || 'user-demo-id';
    const profiles = openCommDb.getProfiles();
    const profile = profiles.find(p => p.id === loggedInId);
    if (!profile || !profile.email_verified_for_actions) {
      throw new Error("Email verification is required for applications, job posting, hiring requests, and professional messaging.");
    }
  }
}
async function getCurrentUserId(): Promise<string> {
  if (supabase) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error('Authentication required. Please sign in.');
    }
    return user.id;
  } else {
    return localStorage.getItem('opencomm_user_id') || 'user-demo-id';
  }
}


export const dbService = {
  // --------- User Settings & Support Ticket Service Wrappers ---------
  /**
   * Fetch the current user's settings.
   */
  async getMyUserSettings(): Promise<UserSettings | null> {
    if (supabase) {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('getMyUserSettings Supabase error:', error.message);
        return null;
      }
      return data as UserSettings;
    }
    // Local fallback – use stored profile as placeholder
    const userId = await getCurrentUserId();
    const profiles = openCommDb.getProfiles();
    const profile = profiles.find(p => p.id === userId);
    if (!profile) return null;
    // Map profile fields to UserSettings shape where possible
    return {
      userId: profile.id,
      profileVisibility: 'public',
      messagePermissions: 'everyone',
      hireRequestPermissions: 'everyone',
      showOnlineStatus: true,
      showExactLocation: false,
      searchEngineIndexing: true,
      themePreference: localStorage.getItem('opencomm_user_theme') || 'system',
      languagePreference: profile.preferred_language || 'en',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      showReviewsPublicly: true,
      showCompletedWorkCount: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as UserSettings;
  },

  /**
   * Update the current user's settings.
   */
  async updateMyUserSettings(updates: Partial<UserSettings>): Promise<UserSettings | null> {
    if (supabase) {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('user_settings')
        .upsert({ ...updates, user_id: userId }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) {
        console.error('updateMyUserSettings Supabase error:', error.message);
        return null;
      }
      // Cache theme locally to avoid flicker
      if (updates.themePreference) {
        localStorage.setItem('opencomm_user_theme', updates.themePreference);
      }
      return data as UserSettings;
    }
    // Local fallback – update profile cache (no real settings persistence)
    if (updates.themePreference) {
      localStorage.setItem('opencomm_user_theme', updates.themePreference);
    }
    return null;
  },

  /**
   * Create a support ticket for the current user.
   */
  async createSupportTicket(params: { category: string; subject: string; description: string; priority?: string }): Promise<string | null> {
    if (!supabase) throw new Error('Supabase is not initialized.');
    const userId = await getCurrentUserId();
    const payload = {
      user_id: userId,
      category: params.category,
      subject: params.subject,
      description: params.description,
      priority: params.priority ?? 'medium',
      status: 'open'
    };
    const { data, error } = await supabase.from('support_tickets').insert(payload).select('id').single();
    if (error) {
      console.error('createSupportTicket Supabase error:', error.message);
      throw new Error(error.message);
    }
    return data.id as string;
  },

  /**
   * Retrieve all support tickets belonging to the current user.
   */
  async getMySupportTickets(): Promise<SupportTicket[]> {
    if (supabase) {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId);
      if (error) {
        console.error('getMySupportTickets Supabase error:', error.message);
        return [];
      }
      return data as SupportTicket[];
    }
    // Local fallback – empty list
    return [];
  },

  async getProfile(userId: string): Promise<LocalProfile | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) {
          console.error('getProfile Supabase error:', error.message);
          return null;
        }
        return data as LocalProfile | null;
      } catch (err) {
        console.error('getProfile Supabase exception:', err);
        return null;
      }
    }
    const profiles = openCommDb.getProfiles();
    return profiles.find(p => p.id === userId) || null;
  },

  async getProfileByUsername(username: string): Promise<LocalProfile | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('profile_directory')
        .select('*')
        .ilike('username', username)
        .maybeSingle();

      if (!error && data) {
        return data as LocalProfile;
      }
      return null;
    }
    // Fallback to local emulation
    const profiles = openCommDb.getProfiles();
    return profiles.find(p => p.username.toLowerCase() === username.toLowerCase()) || null;
  },

  async uploadAvatar(userId: string, file: File): Promise<string> {
    if (!supabase) throw new Error("Supabase is not initialized.");

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-profile.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    if (data && data.publicUrl) {
      await this.updateProfile(userId, { avatar_url: data.publicUrl });
      return data.publicUrl;
    }

    throw new Error("Failed to get public URL for uploaded avatar.");
  },

  async uploadBanner(userId: string, file: File): Promise<string> {
    if (!supabase) throw new Error("Supabase is not initialized.");

    const fileExt = file.name.split('.').pop();
    const fileName = `banner_${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-banners')
      .upload(filePath, file, {
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('profile-banners')
      .getPublicUrl(filePath);

    if (data && data.publicUrl) {
      // Also update profile row with this URL
      await this.updateProfile(userId, { banner_id: data.publicUrl });
      return data.publicUrl;
    }

    throw new Error("Failed to get public URL for uploaded banner.");
  },

  async updateProfile(userId: string, updates: Partial<LocalProfile> & { show_location_publicly?: boolean; location_visibility?: boolean }): Promise<LocalProfile> {
    console.log('[Supabase Debug] updateProfile initiating for userId:', userId, 'updates:', updates);
    if (supabase) {
      // 1. First sync email verification if logged in user is confirmed in Auth
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email_confirmed_at) {
          await supabase.rpc('sync_email_verification');
        }
      } catch (e) {
        console.warn('[Supabase Debug] sync_email_verification pre-check warning:', e);
      }

      const showLocationVal = updates.show_location_publicly !== undefined
        ? updates.show_location_publicly
        : (updates.location_visibility !== undefined ? updates.location_visibility : true);

      // 2. Execute update_my_basic_profile RPC with exact parameter p_show_location_publicly
      const { data, error } = await supabase.rpc('update_my_basic_profile', {
        p_username: updates.username,
        p_full_name: updates.full_name,
        p_avatar_url: updates.avatar_url,
        p_banner_url: updates.banner_url || updates.banner_id,
        p_phone: updates.phone,
        p_city: updates.city,
        p_state: updates.state,
        p_country: updates.country,
        p_country_code: updates.country_code,
        p_state_code: updates.state_code,
        p_district: updates.district,
        p_latitude: updates.latitude,
        p_longitude: updates.longitude,
        p_preferred_language: updates.preferred_language,
        p_bio: updates.bio,
        p_show_location_publicly: showLocationVal,
        p_onboarding_completed: updates.onboarding_completed
      });

      console.log('[Supabase Debug] update_my_basic_profile RPC response:', { data, error });

      if (error) {
        console.error('[Supabase Debug] updateProfile RPC error returned:', error.message);
        throw new Error(error.message);
      }

      // Also update show_location_publicly directly on profiles table if needed
      if (showLocationVal !== undefined && userId) {
        const { error: directErr } = await supabase
          .from('profiles')
          .update({ show_location_publicly: showLocationVal })
          .eq('id', userId);
        if (directErr) {
          console.warn('[Supabase Debug] Direct show_location_publicly update warning:', directErr);
        }
      }

      const resObj = {
        ...(data as any),
        show_location_publicly: showLocationVal,
        location_visibility: showLocationVal
      };

      clearProfileCache(userId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('opencomm:profile-updated'));
      }

      return resObj as LocalProfile;
    }

    // Local fallback only if no Supabase instance
    const profiles = openCommDb.getProfiles();
    const idx = profiles.findIndex(p => p.id === userId);
    const updated = {
      ...(profiles[idx] || { id: userId, created_at: new Date().toISOString(), profile_type: 'basic', account_status: 'active', onboarding_completed: false }),
      ...updates,
      updated_at: new Date().toISOString()
    } as LocalProfile;

    if (idx >= 0) profiles[idx] = updated;
    else profiles.push(updated);
    openCommDb.saveProfiles(profiles);

    clearProfileCache(userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('opencomm:profile-updated'));
    }

    return updated;
  },

  async updateWorkerProfileData(userId: string, updates: {
    profession?: string;
    experience_years?: number;
    hourly_rate?: number;
    expected_salary?: string;
    availability?: string;
    skills?: string[];
    bio_summary?: string;
    work_location?: string;
  }): Promise<void> {
    console.log('[Supabase Debug] updateWorkerProfileData initiating for userId:', userId, 'updates:', updates);
    if (supabase && userId) {
      // First attempt to sync email verification status if user is authenticated
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email_confirmed_at) {
          await supabase.rpc('sync_email_verification');
        }
      } catch (e) {
        console.warn('[Supabase Debug] sync_email_verification pre-check warning in worker update:', e);
      }

      const payload: any = {
        id: userId,
        updated_at: new Date().toISOString()
      };

      if (updates.profession !== undefined) payload.profession = updates.profession;
      if (updates.experience_years !== undefined) payload.experience_years = updates.experience_years;
      if (updates.hourly_rate !== undefined) payload.hourly_rate = updates.hourly_rate;
      if (updates.expected_salary !== undefined) payload.expected_salary = updates.expected_salary;
      if (updates.availability !== undefined) payload.availability = updates.availability;
      if (updates.skills !== undefined) payload.skills = updates.skills;
      if (updates.bio_summary !== undefined) payload.bio_summary = updates.bio_summary;
      if (updates.work_location !== undefined) payload.work_location = updates.work_location;

      console.log('[Supabase Debug] Executing worker_profiles upsert with clean live payload:', payload);

      const { data, error } = await supabase
        .from('worker_profiles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      console.log('[Supabase Debug] worker_profiles upsert response:', { data, error });

      if (error) {
        console.error('[Supabase Debug] CRITICAL worker_profiles upsert error:', error);
        throw new Error(`Worker profile update failed: ${error.message}`);
      }
    }
    clearProfileCache(userId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('opencomm:profile-updated'));
    }
  },

  async createWorkerProfile(worker: LocalWorkerProfile): Promise<LocalWorkerProfile> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const payload: any = {
          id: worker.id,
          profession: worker.profession || '',
          skills: worker.skills || [],
          experience_years: worker.experience_years ?? worker.years_experience ?? 0,
          work_location: worker.work_location || '',
          availability: worker.availability || 'Available Now',
          bio_summary: worker.bio_summary || '',
          hourly_rate: worker.hourly_rate || 0,
          expected_salary: worker.expected_salary || '',
          portfolio_url: worker.portfolio_url || '',
          certificates: worker.certificates || [],
          languages: worker.languages || [],
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('worker_profiles')
          .upsert(payload, { onConflict: 'id' });

        if (error) {
          console.error('[Supabase Debug] createWorkerProfile error:', error);
          throw error;
        }

        // Also sync old workers_directory table for complete safety
        await supabase.from('workers_directory').upsert({
          id: worker.id,
          title: worker.professional_title || worker.profession,
          hourly_rate: worker.hourly_rate || 0,
          experience_years: worker.years_experience ?? worker.experience_years,
          skills: worker.skills,
          availability_status: (worker.availability_status || worker.availability) === 'Available Now' ? 'available' : 'busy'
        });

        // Sync worker_skills
        if (worker.skills && worker.skills.length > 0) {
          await supabase.from('worker_skills').delete().eq('worker_id', worker.id);
          const skillsToInsert = worker.skills.map(s => ({ worker_id: worker.id, skill: s }));
          await supabase.from('worker_skills').insert(skillsToInsert);
        }

        // Sync worker_experience
        if (worker.experience) {
          await supabase.from('worker_experience').delete().eq('worker_id', worker.id);
          if (worker.experience.length > 0) {
            const expToInsert = worker.experience.map(e => ({
              worker_id: worker.id,
              employer: e.employer,
              role: e.role,
              start_date: e.start_date || null,
              end_date: e.end_date || null,
              currently_working: e.currently_working || false,
              description: e.description || '',
              achievements: e.achievements || ''
            }));
            await supabase.from('worker_experience').insert(expToInsert);
          }
        }

        // Sync worker_certifications
        if (worker.certifications) {
          await supabase.from('worker_certifications').delete().eq('worker_id', worker.id);
          if (worker.certifications.length > 0) {
            const certsToInsert = worker.certifications.map(c => ({
              worker_id: worker.id,
              name: c.name,
              institution: c.institution || '',
              graduation_year: c.graduation_year || null,
              licence_number: c.licence_number || '',
              training_program: c.training_program || ''
            }));
            await supabase.from('worker_certifications').insert(certsToInsert);
          }
        }

        // Sync worker_languages
        if (worker.languages && worker.languages.length > 0) {
          await supabase.from('worker_languages').delete().eq('worker_id', worker.id);
          const langsToInsert = worker.languages.map(l => ({ worker_id: worker.id, language: l }));
          await supabase.from('worker_languages').insert(langsToInsert);
        }

        // Sync worker_job_preferences
        if (worker.job_preferences) {
          await supabase.from('worker_job_preferences').upsert({
            worker_id: worker.id,
            job_categories: worker.job_preferences.job_categories || [],
            employment_types: worker.job_preferences.employment_types || [],
            preferred_locations: worker.job_preferences.preferred_locations || [],
            expected_pay_min: worker.job_preferences.expected_pay_min || null,
            expected_pay_max: worker.job_preferences.expected_pay_max || null,
            notice_period: worker.job_preferences.notice_period || ''
          });
        }
      } catch (err) {
        console.error('createWorkerProfile Supabase error:', err);
      }
    }
    const workers = openCommDb.getWorkerProfiles();
    const idx = workers.findIndex(w => w.id === worker.id);
    if (idx >= 0) workers[idx] = worker;
    else workers.push(worker);
    openCommDb.saveWorkerProfiles(workers);

    // Sync emulator arrays
    if (worker.experience) {
      const allExp = getLocalData('oc_worker_experience', []).filter((e: any) => e.worker_id !== worker.id);
      const mapped = worker.experience.map(e => ({ ...e, id: e.id || Math.random().toString(36).substr(2, 9), worker_id: worker.id }));
      allExp.push(...mapped);
      saveLocalData('oc_worker_experience', allExp);
    }
    if (worker.certifications) {
      const allCerts = getLocalData('oc_worker_certifications', []).filter((c: any) => c.worker_id !== worker.id);
      const mapped = worker.certifications.map(c => ({ ...c, id: c.id || Math.random().toString(36).substr(2, 9), worker_id: worker.id }));
      allCerts.push(...mapped);
      saveLocalData('oc_worker_certifications', allCerts);
    }

    // Sync user profile type
    await this.updateProfile(worker.id, { profile_type: 'worker' });

    // Track worker profile creation in Google Analytics
    analytics.trackWorkerProfileCreated({
      profession: worker.professional_title || worker.profession,
      skills: worker.skills,
      rate: worker.hourly_rate
    });

    return worker;
  },

  async createMyWorkerProfile(params: {
    profession: string;
    skills: string[];
    experience_years?: number;
    work_location?: string;
    availability?: string;
    bio_summary?: string;
    hourly_rate?: number;
    expected_salary?: string;
    portfolio_url?: string;
    certificates?: string[];
    languages?: string[];
  }): Promise<any> {
    if (supabase) {
      const { data, error } = await supabase.rpc('create_my_worker_profile', {
        p_profession: params.profession,
        p_skills: params.skills,
        p_experience_years: params.experience_years || 0,
        p_work_location: params.work_location || null,
        p_availability: params.availability || 'Available Now',
        p_bio_summary: params.bio_summary || null,
        p_hourly_rate: params.hourly_rate || null,
        p_expected_salary: params.expected_salary || null,
        p_portfolio_url: params.portfolio_url || null,
        p_certificates: params.certificates || [],
        p_languages: params.languages || []
      });

      if (error) {
        console.error("create_my_worker_profile RPC error:", error.message);
        throw new Error(error.message);
      }
      return data;
    }

    const userId = localStorage.getItem('opencomm_user_id') || 'temp-id';
    await this.updateProfile(userId, { profile_type: 'worker' });
    return this.createWorkerProfile({
      id: userId,
      profession: params.profession,
      skills: params.skills,
      experience_years: params.experience_years || 0,
      hourly_rate: params.hourly_rate,
      bio_summary: params.bio_summary,
      work_location: params.work_location
    });
  },

  async getWorkerProfile(userId: string): Promise<LocalWorkerProfile | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('worker_profiles').select('*').eq('id', userId).single();
        if (!error && data) {
          // Fetch normalized tables
          const { data: skillsData } = await supabase.from('worker_skills').select('skill').eq('worker_id', userId);
          const { data: expData } = await supabase.from('worker_experience').select('*').eq('worker_id', userId);
          const { data: certData } = await supabase.from('worker_certifications').select('*').eq('worker_id', userId);
          const { data: langData } = await supabase.from('worker_languages').select('language').eq('worker_id', userId);
          const { data: prefData } = await supabase.from('worker_job_preferences').select('*').eq('worker_id', userId).maybeSingle();

          return {
            id: data.id,
            profession: data.profession || '',
            skills: skillsData && skillsData.length > 0 ? skillsData.map((s: any) => s.skill) : (data.skills || []),
            experience_years: data.experience_years ?? data.years_experience ?? 0,
            work_location: data.work_location || '',
            availability: data.availability || 'Available Now',
            bio_summary: data.bio_summary || '',
            hourly_rate: Number(data.hourly_rate) || 0,
            expected_salary: data.expected_salary || '',
            portfolio_url: data.portfolio_url || '',
            certificates: data.certificates || [],
            languages: langData && langData.length > 0 ? langData.map((l: any) => l.language) : (data.languages || []),
            experience: expData || [],
            certifications: certData || [],
            job_preferences: prefData ? {
              job_categories: prefData.job_categories || [],
              employment_types: prefData.employment_types || [],
              preferred_locations: prefData.preferred_locations || [],
              expected_pay_min: prefData.expected_pay_min ? Number(prefData.expected_pay_min) : undefined,
              expected_pay_max: prefData.expected_pay_max ? Number(prefData.expected_pay_max) : undefined,
              notice_period: prefData.notice_period || ''
            } : undefined
          };
        }
      } catch (err) {
        console.error('getWorkerProfile Supabase error:', err);
      }
    }
    const worker = openCommDb.getWorkerProfiles().find(w => w.id === userId) || null;
    if (worker) {
      const mockExp = getLocalData('oc_worker_experience', []).filter((e: any) => e.worker_id === userId);
      const mockCert = getLocalData('oc_worker_certifications', []).filter((c: any) => c.worker_id === userId);
      return {
        ...worker,
        experience: mockExp,
        certifications: mockCert
      };
    }
    return null;
  },

  async hasWorkerProfile(userId: string): Promise<boolean> {
    if (!userId) return false;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('worker_profiles').select('id').eq('id', userId).maybeSingle();
        if (!error && data) {
          return true;
        }
      } catch (err) {
        console.error('hasWorkerProfile Supabase error:', err);
      }
    }
    const local = openCommDb.getWorkerProfiles().find(w => w.id === userId);
    return !!local;
  },

  async logTermsConsent(consent: { user_id: string; terms_version: string; privacy_version: string; account_type: string; }): Promise<void> {
    if (supabase) {
      try {
        await supabase.from('terms_consent_logs').insert({
          user_id: consent.user_id,
          terms_version: consent.terms_version,
          privacy_version: consent.privacy_version,
          account_type: consent.account_type,
          user_agent: navigator.userAgent
        });
      } catch (err) {
        console.error('logTermsConsent Supabase error:', err);
      }
    }
    const logs = getLocalData('oc_terms_consent_logs', []);
    logs.push({
      id: Math.random().toString(36).substr(2, 9),
      user_id: consent.user_id,
      terms_version: consent.terms_version,
      privacy_version: consent.privacy_version,
      accepted_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      account_type: consent.account_type
    });
    saveLocalData('oc_terms_consent_logs', logs);
  },

  async getResumeSignedUrl(workerId: string, resumePath: string, requesterId: string): Promise<string> {
    try {
      const response = await fetch('/api/get-resume-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, resumePath, requesterId })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.signedUrl;
    } catch (err: any) {
      console.error("Failed to fetch resume signed URL:", err);
      return `/mock-resumes/${resumePath}`;
    }
  },

  async createCompanyProfile(company: LocalCompanyProfile): Promise<LocalCompanyProfile> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('companies').insert({
          id: company.id,
          name: company.name,
          logo_url: company.logo_url,
          website_url: company.website_url,
          description: company.description,
          location: `${company.city}, ${company.state}`,
          verified: company.verified || false
        }).select().single();
        if (!error && data) return { ...company, id: data.id, verified: data.verified };
      } catch (err) {
        console.error('createCompanyProfile Supabase error:', err);
      }
    }
    const companies = openCommDb.getCompanies();
    companies.push(company);
    openCommDb.saveCompanies(companies);

    // Sync user profile type
    await this.updateProfile(company.id, { profile_type: 'company' });

    // Track company profile creation in Google Analytics
    analytics.trackEmployerProfileCreated({
      name: company.name,
      city: company.city || '',
      state: company.state || ''
    });

    return company;
  },

  async getCompanyProfile(userId: string): Promise<LocalCompanyProfile | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('companies').select('*').eq('id', userId).single();
        if (!error && data) {
          const [city, state] = (data.location || '').split(', ');
          return {
            id: data.id,
            name: data.name,
            logo_url: data.logo_url || '',
            industry: '',
            description: data.description || '',
            city: city || '',
            state: state || '',
            country: 'United States',
            website_url: data.website_url || '',
            verified: data.verified
          };
        }
      } catch (err) {
        console.error('getCompanyProfile Supabase error:', err);
      }
    }
    return openCommDb.getCompanies().find(c => c.id === userId) || null;
  },

  // Contact requests privacy
  async requestContactDetails(req: Omit<LocalContactRequest, 'id' | 'created_at' | 'status'>): Promise<LocalContactRequest> {
    await assertUserEmailConfirmed();
    const requests = openCommDb.getContactRequests();
    const newReq: LocalContactRequest = {
      ...req,
      id: `req-${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    requests.push(newReq);
    openCommDb.saveContactRequests(requests);
    return newReq;
  },

  async updateContactRequestStatus(requestId: string, status: 'approved' | 'rejected' | 'revoked'): Promise<LocalContactRequest | null> {
    const requests = openCommDb.getContactRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx >= 0) {
      requests[idx].status = status;
      openCommDb.saveContactRequests(requests);
      return requests[idx];
    }
    return null;
  },

  async getContactRequestsForUser(userId: string): Promise<LocalContactRequest[]> {
    const requests = openCommDb.getContactRequests();
    return requests.filter(r => r.profile_owner_id === userId || r.requester_id === userId);
  },

  // Hiring Requests Flow
  async sendHiringRequest(req: Omit<LocalHiringRequest, 'id' | 'created_at' | 'status'>): Promise<LocalHiringRequest> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('hiring_requests').insert({
          client_id: req.client_id,
          client_name: req.client_name,
          worker_id: req.worker_id,
          worker_name: req.worker_name,
          work_title: req.work_title,
          description: req.description,
          budget: req.budget,
          preferred_date: req.preferred_date,
          location: req.location || '',
          duration: req.duration || '',
          message: req.message || '',
          status: 'pending'
        }).select().single();
        if (!error && data) {
          return {
            id: data.id,
            client_id: data.client_id,
            client_name: data.client_name,
            worker_id: data.worker_id,
            worker_name: data.worker_name,
            work_title: data.work_title,
            description: data.description,
            budget: Number(data.budget),
            preferred_date: data.preferred_date,
            location: data.location,
            duration: data.duration,
            message: data.message,
            status: data.status,
            created_at: data.created_at
          };
        }
      } catch (err) {
        console.error('sendHiringRequest Supabase error:', err);
      }
    }
    const requests = openCommDb.getHiringRequests();
    const newReq: LocalHiringRequest = {
      ...req,
      id: `hire-req-${Date.now()}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    requests.push(newReq);
    openCommDb.saveHiringRequests(requests);
    return newReq;
  },

  async updateHiringRequestStatus(requestId: string, status: 'accepted' | 'rejected' | 'withdrawn'): Promise<LocalHiringRequest | null> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('hiring_requests').update({ status }).eq('id', requestId).select().single();
        if (!error && data) {
          return {
            id: data.id,
            client_id: data.client_id,
            client_name: data.client_name,
            worker_id: data.worker_id,
            worker_name: data.worker_name,
            work_title: data.work_title,
            description: data.description,
            budget: Number(data.budget),
            preferred_date: data.preferred_date,
            message: data.message,
            status: data.status,
            created_at: data.created_at
          };
        }
      } catch (err) {
        console.error('updateHiringRequestStatus Supabase error:', err);
      }
    }
    const requests = openCommDb.getHiringRequests();
    const idx = requests.findIndex(r => r.id === requestId);
    if (idx >= 0) {
      requests[idx].status = status;
      openCommDb.saveHiringRequests(requests);
      return requests[idx];
    }
    return null;
  },

  async getHiringRequestsForUser(userId: string): Promise<LocalHiringRequest[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('hiring_requests').select('*').or(`client_id.eq.${userId},worker_id.eq.${userId}`);
        if (!error && data) {
          return data.map((d: any) => ({
            id: d.id,
            client_id: d.client_id,
            client_name: d.client_name,
            worker_id: d.worker_id,
            worker_name: d.worker_name,
            work_title: d.work_title,
            description: d.description,
            budget: Number(d.budget),
            preferred_date: d.preferred_date,
            message: d.message,
            status: d.status,
            created_at: d.created_at
          }));
        }
      } catch (err) {
        console.error('getHiringRequestsForUser Supabase error:', err);
      }
    }
    const requests = openCommDb.getHiringRequests();
    return requests.filter(r => r.client_id === userId || r.worker_id === userId);
  },

  // --- DIRECT HIRING WORKFLOW RPCS ---

  async acceptHiringRequest(requestId: string): Promise<{ request_id: string; room_id: string; status: string }> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('accept_hiring_request', { p_request_id: requestId });
    if (error) {
      console.error('acceptHiringRequest RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async declineHiringRequest(requestId: string, reason?: string): Promise<{ request_id: string; status: string }> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('decline_hiring_request', {
      p_request_id: requestId,
      p_reason: reason || null
    });
    if (error) {
      console.error('declineHiringRequest RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async withdrawHiringRequest(requestId: string, reason?: string): Promise<{ request_id: string; status: string }> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('withdraw_hiring_request', {
      p_request_id: requestId,
      p_reason: reason || null
    });
    if (error) {
      console.error('withdrawHiringRequest RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async sendNegotiationMessage(roomId: string, text: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('send_negotiation_message', {
      p_room_id: roomId,
      p_text: text
    });
    if (error) {
      console.error('sendNegotiationMessage RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async submitDealProposal(payload: {
    request_id?: string;
    application_id?: string;
    work_title: string;
    work_description: string;
    final_price: number;
    payment_type?: string;
    work_date?: string;
    start_time?: string;
    duration?: string;
    location?: string;
    additional_terms?: string;
  }): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('submit_deal_proposal', {
      p_request_id: payload.request_id || null,
      p_application_id: payload.application_id || null,
      p_work_title: payload.work_title,
      p_work_description: payload.work_description,
      p_final_price: payload.final_price,
      p_payment_type: payload.payment_type || 'fixed',
      p_work_date: payload.work_date || null,
      p_start_time: payload.start_time || null,
      p_duration: payload.duration || null,
      p_location: payload.location || null,
      p_additional_terms: payload.additional_terms || null,
    });
    if (error) {
      console.error('submitDealProposal RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async respondToDealProposal(
    proposalId: string,
    response: 'accept' | 'reject' | 'request_changes',
    reason?: string
  ): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('respond_to_deal_proposal', {
      p_proposal_id: proposalId,
      p_response: response,
      p_reason: reason || null,
    });
    if (error) {
      console.error('respondToDealProposal RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async getHireWorkflowDetails(requestId: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('get_hire_workflow_details', { p_request_id: requestId });
    if (error) {
      console.error('getHireWorkflowDetails RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async startJobApplicationNegotiation(applicationId: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('start_job_application_negotiation', { p_application_id: applicationId });
    if (error) {
      console.error('startJobApplicationNegotiation RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async getApplicationWorkflowDetails(applicationId: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('get_application_workflow_details', { p_application_id: applicationId });
    if (error) {
      console.error('getApplicationWorkflowDetails RPC error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async getWorkContractById(contractId: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase
      .from('work_contracts')
      .select('*')
      .eq('id', contractId)
      .single();
    if (error) {
      console.error('getWorkContractById error:', error);
      throw new Error(error.message || 'Work contract not found or unauthorized.');
    }
    return data;
  },

  async requestContractCancellation(contractId: string, reason: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('request_contract_cancellation', {
      p_contract_id: contractId,
      p_reason: reason
    });
    if (error) {
      console.error('requestContractCancellation error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async respondToContractCancellation(contractId: string, response: 'accept' | 'reject', reason?: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('respond_to_contract_cancellation', {
      p_contract_id: contractId,
      p_response: response,
      p_reason: reason || null
    });
    if (error) {
      console.error('respondToContractCancellation error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async requestContractCompletion(contractId: string, note?: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('request_contract_completion', {
      p_contract_id: contractId,
      p_note: note || null
    });
    if (error) {
      console.error('requestContractCompletion error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async respondToContractCompletion(contractId: string, response: 'accept' | 'reject', reason?: string): Promise<any> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('respond_to_contract_completion', {
      p_contract_id: contractId,
      p_response: response,
      p_reason: reason || null
    });
    if (error) {
      console.error('respondToContractCompletion error:', error.message);
      throw new Error(error.message);
    }
    return data;
  },

  async getCurrentUserHiringRequests(): Promise<any[]> {
    if (!supabase) throw new Error("Supabase client is not initialized.");
    const { data, error } = await supabase.rpc('get_hiring_requests_for_current_user');
    if (error) {
      console.error('getCurrentUserHiringRequests RPC error:', error.message);
      throw new Error(error.message);
    }
    return data || [];
  },

  // Jobs integration
  async createJobInDb(job: any, postedBy: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const authenticatedUserId = user?.id || postedBy;

        const rawJobType = job.jobType || job.job_type;
        const normalizedType = normalizeJobType(rawJobType) || rawJobType || 'full_time';
        const locData = job.locationData || {};
        const country = locData.country || job.country || null;
        const countryCode = locData.country_code || job.country_code || null;
        const state = locData.state || job.state || null;
        const stateCode = locData.state_code || job.state_code || null;
        const district = locData.district || job.district || null;
        const city = locData.city || job.city || null;
        const lat = locData.latitude !== undefined ? locData.latitude : (job.latitude !== undefined ? job.latitude : null);
        const lng = locData.longitude !== undefined ? locData.longitude : (job.longitude !== undefined ? job.longitude : null);

        const { data, error } = await supabase.from('jobs').insert({
          title: job.title,
          description: job.description,
          salary_range: job.salary,
          location: job.location,
          category: job.category,
          job_type: normalizedType,
          application_deadline: job.applicationDeadline || job.application_deadline || null,
          requirements: job.requirements || [],
          posted_by: authenticatedUserId,
          is_active: true,
          country,
          country_code: countryCode,
          state,
          state_code: stateCode,
          district,
          city,
          latitude: lat,
          longitude: lng
        }).select().single();
        if (!error && data) {
          analytics.trackJobPosted({
            title: job.title,
            category: job.category,
            salary: job.salary
          });
          return data;
        }
      } catch (err) {
        console.error('[Audit] createJobInDb Supabase error:', err);
        throw err;
      }
    } else {
      throw new Error("Supabase client is not initialized.");
    }
  },

  async updateJobInDb(jobId: string, updatedJob: any): Promise<any> {
    await assertUserEmailConfirmed();
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be logged in to edit a job post.");

    // Pre-flight check: Verify ownership and 5-hour edit window
    const { data: existingJob, error: fetchErr } = await supabase
      .from('jobs')
      .select('id, posted_by, created_at')
      .eq('id', jobId)
      .single();

    if (fetchErr || !existingJob) {
      throw new Error("Job record not found.");
    }

    if (existingJob.posted_by !== user.id) {
      throw new Error("Unauthorized: You can only edit your own job post.");
    }

    const createdAtTime = new Date(existingJob.created_at).getTime();
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    if (Date.now() > (createdAtTime + FIVE_HOURS_MS)) {
      throw new Error("The 5-hour edit window for this post has expired.");
    }

    const payload: any = {
      updated_at: new Date().toISOString()
    };

    if (updatedJob.title) payload.title = updatedJob.title;
    if (updatedJob.description) payload.description = updatedJob.description;
    if (updatedJob.salary) payload.salary_range = updatedJob.salary;
    if (updatedJob.location) payload.location = updatedJob.location;
    const locData = updatedJob.locationData || updatedJob;
    if (locData.country !== undefined) payload.country = locData.country;
    if (locData.country_code !== undefined) payload.country_code = locData.country_code;
    if (locData.state !== undefined) payload.state = locData.state;
    if (locData.state_code !== undefined) payload.state_code = locData.state_code;
    if (locData.district !== undefined) payload.district = locData.district;
    if (locData.city !== undefined) payload.city = locData.city;
    if (locData.latitude !== undefined) payload.latitude = locData.latitude;
    if (locData.longitude !== undefined) payload.longitude = locData.longitude;
    if (updatedJob.category) payload.category = updatedJob.category;
    if (updatedJob.requirements) payload.requirements = updatedJob.requirements;
    if (updatedJob.jobType || updatedJob.job_type) {
      const rawType = updatedJob.jobType || updatedJob.job_type;
      payload.job_type = normalizeJobType(rawType) || rawType;
    }
    if (updatedJob.applicationDeadline !== undefined || updatedJob.application_deadline !== undefined) {
      payload.application_deadline = updatedJob.applicationDeadline || updatedJob.application_deadline || null;
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(payload)
      .eq('id', jobId)
      .eq('posted_by', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Audit] updateJobInDb error:', error);
      throw error;
    }

    return data;
  },

  async deleteJobInDb(jobId: string): Promise<boolean> {
    await assertUserEmailConfirmed();
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("You must be logged in to delete a job post.");

    // Soft-delete to preserve applications, conversations, messages, and audit history
    const { data, error } = await supabase
      .from('jobs')
      .update({ is_active: false })
      .eq('id', jobId)
      .eq('posted_by', user.id)
      .select('id, is_active, posted_by');

    if (error) {
      console.error('[Audit] deleteJobInDb error:', error);
      throw new Error(error.message || "Database error occurred while deleting job.");
    }

    if (!data || data.length === 0) {
      console.warn('[Audit] deleteJobInDb 0 rows updated for jobId:', jobId, 'user:', user.id);
      throw new Error("Unable to delete this post. You may not have permission.");
    }

    const updatedJob = data[0];

    return true;
  },

  async getJobsFromDb(): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*, companies(*)')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Collect unique posted_by user IDs for profile hydration
          const userIdsToFetch: string[] = Array.from(
            new Set(data.map((j: any) => j.posted_by).filter((id): id is string => typeof id === 'string' && id.length > 0))
          );

          // Batched hydration from profile_directory via getPublicProfilesByIds
          let profileMap = new Map<string, CanonicalPublicProfile>();
          if (userIdsToFetch.length > 0) {
            try {
              profileMap = await getPublicProfilesByIds(userIdsToFetch);
            } catch (pErr) {
              console.error('Error fetching job poster public profiles:', pErr);
            }
          }

          const nowTime = Date.now();
          const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;

          const mapped = data.map(job => {
            const hasCompany = Boolean(job.companies?.name);
            const pubProf = job.posted_by ? profileMap.get(job.posted_by) : null;

            const posterName = hasCompany
              ? job.companies.name
              : (pubProf?.name || pubProf?.fullName || 'OpenComm User');

            const posterAvatar = hasCompany
              ? (job.companies.logo_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80')
              : (pubProf?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');

            const posterRole = hasCompany ? 'Company Employer' : 'Individual Employer';
            const posterVerified = hasCompany
              ? Boolean(job.companies.is_verified ?? job.companies.verified ?? false)
              : false;

            return {
              id: job.id,
              title: job.title,
              company: posterName,
              companyLogo: posterAvatar,
              posterName,
              posterAvatar,
              posterRole,
              posterType: hasCompany ? 'company' : 'individual',
              posterVerified,
              verified: posterVerified,
              salary: job.salary_range || 'Contract',
              location: job.location || 'Remote',
              category: job.category || 'Professional',
              jobType: job.job_type || null,
              description: job.description || '',
              requirements: Array.isArray(job.requirements) ? job.requirements : [],
              bookmarked: false,
              applied: false,
              datePosted: new Date(job.created_at).toLocaleDateString(),
              applicationDeadline: job.application_deadline || job.deadline || job.expires_at || null,
              is_active: job.is_active !== undefined ? job.is_active : true,
              workers_needed: job.workers_needed || 1,
              filled_positions: job.filled_positions || 0,
              status: job.status || (job.is_active ? 'active' : 'closed'),
              closed_at: job.closed_at || null,
              archive_after: job.archive_after || null,
              posted_by: job.posted_by,
              created_at: job.created_at
            };
          });

          // Apply 4-day post-deadline public visibility rule & archived check
          return mapped.filter(j => {
            if (j.is_active === false || j.status === 'archived') return false;
            if (j.applicationDeadline) {
              const dTime = new Date(j.applicationDeadline).getTime();
              if (!isNaN(dTime) && nowTime > (dTime + FOUR_DAYS_MS)) {
                return false; // Hide from public Jobs page after deadline + 4 days
              }
            }
            return true;
          });
        }
      } catch (err) {
        console.error('getJobsFromDb Supabase error:', err);
      }
    }
    return [];
  },

  // Job Applications
  async applyToJobInDb(jobId: string, applicantId: string, note: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('job_applications').insert({
          job_id: jobId,
          applicant_id: applicantId,
          cover_letter: note,
          status: 'pending'
        }).select().single();
        if (!error && data) {
          analytics.trackJobApplied(jobId, note.length);
          return data;
        }
      } catch (err) {
        console.error('applyToJobInDb Supabase error:', err);
      }
    }
    return null;
  },

  async getApplicationsFromDb(userId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('job_applications').select('*, jobs(*)').or(`applicant_id.eq.${userId}`);
        if (!error && data) return data;
      } catch (err) {
        console.error('getApplicationsFromDb Supabase error:', err);
      }
    }
    return [];
  },

  // Saved Jobs & Workers (Bookmarks)
  async saveJobId(userId: string, jobId: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('saved_jobs').insert({ user_id: userId, job_id: jobId });
        return !error;
      } catch (err) {
        console.error('saveJobId Supabase error:', err);
      }
    }
    return true;
  },

  async removeSavedJobId(userId: string, jobId: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId);
        return !error;
      } catch (err) {
        console.error('removeSavedJobId Supabase error:', err);
      }
    }
    return true;
  },

  async getSavedJobIds(userId: string): Promise<string[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('saved_jobs').select('job_id').eq('user_id', userId);
        if (!error && data) return data.map((d: any) => d.job_id);
      } catch (err) {
        console.error('getSavedJobIds Supabase error:', err);
      }
    }
    return [];
  },

  async saveWorkerId(userId: string, workerId: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('saved_workers').insert({ user_id: userId, worker_id: workerId });
        return !error;
      } catch (err) {
        console.error('saveWorkerId Supabase error:', err);
      }
    }
    return true;
  },

  async removeSavedWorkerId(userId: string, workerId: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('saved_workers').delete().eq('user_id', userId).eq('worker_id', workerId);
        return !error;
      } catch (err) {
        console.error('removeSavedWorkerId Supabase error:', err);
      }
    }
    return true;
  },

  async getSavedWorkerIds(userId: string): Promise<string[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('saved_workers').select('worker_id').eq('user_id', userId);
        if (!error && data) return data.map((d: any) => d.worker_id);
      } catch (err) {
        console.error('getSavedWorkerIds Supabase error:', err);
      }
    }
    return [];
  },

  async getPublicWorkers(): Promise<Worker[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('worker_directory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('getPublicWorkers query error:', error);
        return [];
      }

      if (!data) return [];

      const seenIds = new Set<string>();
      const deduplicated = data.filter((d: any) => {
        if (!d.id || seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return true;
      });

      return deduplicated.map((d: any) => ({
        id: d.id,
        name: d.full_name || d.username || 'OpenComm Worker',
        photo: d.avatar_url || '',
        title: d.profession || 'Professional',
        experience: Number(d.experience_years || 0),
        rating: 0,
        availability: d.availability || 'Available Now',
        location: [d.city, d.state, d.country].filter(Boolean).join(', ') || d.work_location || '',
        bio: d.bio_summary || '',
        skills: Array.isArray(d.skills) ? d.skills : [],
        completedWorks: 0,
        hourlyRate: Number(d.hourly_rate || 0),
        expectedSalary: d.expected_salary || '',
        verified: false,
        bookmarked: false
      }));
    } catch (err) {
      console.error('getPublicWorkers exception:', err);
      return [];
    }
  },

  // Conversations & Messages
  async getConversationsFromDb(userId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('conversations').select('*').or(`creator_id.eq.${userId},member_id.eq.${userId}`);
        if (!error && data) return data;
      } catch (err) {
        console.error('getConversationsFromDb Supabase error:', err);
      }
    }
    return [];
  },

  async createConversationInDb(jobId: string | null, applicantId: string | null, creatorId: string, memberId: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('conversations').insert({
          job_id: jobId,
          application_id: applicantId,
          creator_id: creatorId,
          member_id: memberId,
          last_message_text: '',
          unread_count: 0
        }).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.error('createConversationInDb Supabase error:', err);
      }
    }
    return null;
  },

  async getMessagesFromDb(convoId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', convoId).order('created_at', { ascending: true });
        if (!error && data) return data;
      } catch (err) {
        console.error('getMessagesFromDb Supabase error:', err);
      }
    }
    return [];
  },

  async sendMessageToDb(convoId: string, senderId: string, senderName: string, senderAvatar: string, text: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('messages').insert({
          conversation_id: convoId,
          sender_id: senderId,
          sender_name: senderName,
          sender_avatar: senderAvatar,
          text: text,
          unread: true,
          role: 'user'
        }).select().single();

        if (!error && data) {
          // Update conversation last message too
          await supabase.from('conversations').update({
            last_message_text: text,
            last_message_time: new Date().toISOString()
          }).eq('id', convoId);
          return data;
        }
      } catch (err) {
        console.error('sendMessageToDb Supabase error:', err);
      }
    }
    return null;
  },

  // Reviews
  async getReviewsFromDb(userId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .eq('reviewee_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const reviewerIds: string[] = Array.from(
            new Set(data.map((r: any) => r.reviewer_id).filter((id): id is string => typeof id === 'string' && id.length > 0))
          );
          let profileMap = new Map<string, CanonicalPublicProfile>();
          if (reviewerIds.length > 0) {
            try {
              profileMap = await getPublicProfilesByIds(reviewerIds);
            } catch (pErr) {
              console.error('Error fetching reviewer profiles:', pErr);
            }
          }
          return data.map(r => {
            const pubProf = profileMap.get(r.reviewer_id);
            return {
              ...r,
              reviewer: {
                full_name: pubProf?.name || pubProf?.fullName || 'OpenComm User',
                avatar_url: pubProf?.avatarUrl || null
              }
            };
          });
        }
      } catch (err) {
        console.error('getReviewsFromDb Supabase error:', err);
      }
    }
    return [];
  },

  async addReviewInDb(reviewerId: string, revieweeId: string, rating: number, comment: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('reviews').insert({
          reviewer_id: reviewerId,
          reviewee_id: revieweeId,
          rating,
          comment
        }).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.error('addReviewInDb Supabase error:', err);
      }
    }
    return null;
  },

  // Saved Items Counts
  async getSavedJobsCount(userId: string): Promise<number> {
    if (!supabase || !userId) return 0;
    try {
      const { count, error } = await supabase
        .from('saved_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (!error && count !== null) return count;
    } catch (err) {
      console.error('Error fetching saved jobs count:', err);
    }
    return 0;
  },

  async getSavedWorkersCount(userId: string): Promise<number> {
    if (!supabase || !userId) return 0;
    try {
      const { count, error } = await supabase
        .from('saved_workers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (!error && count !== null) return count;
    } catch (err) {
      console.error('Error fetching saved workers count:', err);
    }
    return 0;
  },

  // Portfolio Items
  async getPortfolioItemsFromDb(userId: string): Promise<any[]> {
    if (!supabase || !userId) return [];
    try {
      const { data, error } = await supabase
        .from('worker_portfolio_items')
        .select('*')
        .eq('worker_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (err) {
      console.error('Error fetching portfolio items:', err);
    }
    return [];
  },

  async addPortfolioItemInDb(userId: string, title: string, filePath?: string, linkUrl?: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (!supabase || !userId) return null;
    try {
      const { data, error } = await supabase
        .from('worker_portfolio_items')
        .insert({
          worker_id: userId,
          title,
          file_path: filePath || null,
          link_url: linkUrl || null,
        })
        .select()
        .single();
      if (!error && data) return data;
    } catch (err) {
      console.error('Error adding portfolio item:', err);
    }
    return null;
  },

  async deletePortfolioItemInDb(itemId: string, userId: string): Promise<boolean> {
    await assertUserEmailConfirmed();
    if (!supabase || !itemId) return false;
    try {
      const { error } = await supabase
        .from('worker_portfolio_items')
        .delete()
        .eq('id', itemId)
        .eq('worker_id', userId);
      return !error;
    } catch (err) {
      console.error('Error deleting portfolio item:', err);
    }
    return false;
  },

  // Job Application Documents / Worker Portfolio Items
  async getWorkerDocumentsFromDb(userId: string, isOwner: boolean = false): Promise<any[]> {
    if (!supabase || !userId) return [];
    try {
      let query = supabase
        .from('worker_portfolio_items')
        .select('*')
        .eq('worker_id', userId);

      if (!isOwner) {
        query = query.eq('is_public', true);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return data.map(item => ({
          ...item,
          user_id: item.worker_id,
          document_type: item.file_type ? (item.file_type.charAt(0).toUpperCase() + item.file_type.slice(1)) : 'Portfolio'
        }));
      }
      if (error) console.error('Error fetching worker portfolio items:', error);
    } catch (err) {
      console.error('Error fetching worker portfolio items:', err);
    }
    return [];
  },

  async uploadWorkerDocumentFile(userId: string, file: File): Promise<{ publicUrl: string; storagePath: string }> {
    await assertUserEmailConfirmed();
    if (!supabase || !userId || !file) {
      throw new Error("Missing parameters for document upload.");
    }
    const fileExt = file.name.split('.').pop();
    const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const storagePath = `${userId}/${cleanFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('worker-documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Worker document upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('worker-documents')
      .getPublicUrl(storagePath);

    return {
      publicUrl: data?.publicUrl || '',
      storagePath
    };
  },

  async addWorkerDocumentInDb(userId: string, doc: {
    document_type: 'Portfolio' | 'CV' | 'Resume' | string;
    title: string;
    description?: string;
    file_url?: string;
    storage_path?: string;
    external_url?: string;
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    is_public?: boolean;
  }): Promise<any> {
    await assertUserEmailConfirmed();
    if (!supabase || !userId) return null;
    try {
      const docTypeLower = (doc.document_type || 'portfolio').toLowerCase();
      const validFileType = ['portfolio', 'cv', 'resume', 'certificate', 'other'].includes(docTypeLower)
        ? docTypeLower
        : 'other';

      const payload = {
        worker_id: userId,
        title: doc.title,
        description: doc.description || null,
        file_url: doc.file_url || doc.external_url || '',
        file_type: validFileType,
        thumbnail_url: null,
        is_public: doc.is_public !== undefined ? doc.is_public : true
      };

      const { data, error } = await supabase
        .from('worker_portfolio_items')
        .insert(payload)
        .select()
        .single();

      if (!error && data) {
        return {
          ...data,
          user_id: data.worker_id,
          document_type: doc.document_type
        };
      }
      if (error) console.error('Error inserting worker portfolio item:', error);
    } catch (err) {
      console.error('Error adding worker portfolio item:', err);
    }
    return null;
  },

  async deleteWorkerDocumentInDb(documentId: string, userId: string, storagePath?: string): Promise<boolean> {
    await assertUserEmailConfirmed();
    if (!supabase || !documentId) return false;
    try {
      if (storagePath) {
        try {
          await supabase.storage.from('worker-documents').remove([storagePath]);
        } catch (sErr) {
          console.warn('Storage delete warning:', sErr);
        }
      }

      const { error } = await supabase
        .from('worker_portfolio_items')
        .delete()
        .eq('id', documentId)
        .eq('worker_id', userId);

      return !error;
    } catch (err) {
      console.error('Error deleting worker portfolio item:', err);
    }
    return false;
  },

  // My Job Posts
  async getMyJobPostsCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('posted_by', userId);

    if (error) {
      console.error('Error fetching job posts count:', error);
      return 0;
    }
    return count || 0;
  },

  async getMyJobApplications(userId: string): Promise<{ data: any[] | null; error: any }> {
    const { data, error } = await supabase
      .from('job_applications')
      .select('id, job_id, applicant_id, proposed_rate, cover_letter, status, created_at')
      .eq('applicant_id', userId);

    if (error) {
      console.error('[dbService] Error fetching job applications:', error);
    }
    return { data, error };
  },

  async updateMyJobStatus(jobId: string, isActive: boolean): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase.rpc('update_my_job_status', {
        p_job_id: jobId,
        p_is_active: isActive
      });
      if (error) {
        console.error("updateMyJobStatus error:", error);
        throw new Error(error.message);
      }
      return true;
    }
    return false;
  },

  async deleteMyJob(jobId: string): Promise<boolean> {
    if (supabase) {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);
      if (error) {
        console.error("deleteMyJob error:", error);
        throw new Error(error.message);
      }
      return true;
    }
    return false;
  },

  // Messaging Service Methods
  async getOrCreateApplicationConversation(applicationId: string): Promise<string | null> {
    if (!supabase) return null;

    // Pre-flight check: Enforce that messaging is ONLY allowed after application acceptance
    const { data: appData, error: appError } = await supabase
      .from('job_applications')
      .select('id, status, applicant_id, job_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError || !appData) {
      throw new Error('Application details could not be verified.');
    }

    if (appData.status !== 'accepted') {
      throw new Error('Messaging is only allowed after the application has been accepted by the employer.');
    }

    const { data, error } = await supabase.rpc('get_or_create_application_conversation', {
      p_application_id: applicationId
    });
    if (error) {
      console.error('get_or_create_application_conversation error:', error);
      throw new Error(error.message);
    }
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      if ('id' in data) return (data as any).id;
      if (Array.isArray(data) && data[0]?.id) return data[0].id;
    }
    return data || null;
  },

  async getOrCreateWorkerConversation(workerId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required to message a worker.');
    }
    if (user.id === workerId) {
      throw new Error('You cannot message yourself.');
    }

    // Optional check if worker profile exists/is valid can be done if needed,
    // but the RPC usually handles it or returns error
    const { data, error } = await supabase.rpc('get_or_create_worker_conversation', {
      p_worker_id: workerId
    });

    if (error) {
      console.error('get_or_create_worker_conversation error:', error);
      throw new Error(error.message || 'Worker profile not found or unavailable');
    }
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      if ('id' in data) return (data as any).id;
      if (Array.isArray(data) && data[0]?.id) return data[0].id;
    }
    return data || null;
  },


  async getMyConversations(options: { includeArchived?: boolean } = {}): Promise<ConversationViewModel[]> {
    const includeArchived = options.includeArchived === true;
    if (!supabase) return [];
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return [];

    const { data: directConvRows, error: directConvError } = await supabase
      .from('conversations')
      .select('*')
      .or(`creator_id.eq.${user.id},member_id.eq.${user.id}`)
      .order('last_message_time', { ascending: false, nullsFirst: false });

    if (directConvError) {
      console.error('getMyConversations direct conversations error:', directConvError);
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (memberError) {
      console.error('getMyConversations conversation_members error:', memberError);
    }

    let memberConvRows: any[] = [];
    const memberConvIds = (memberRows || []).map((row: any) => row.conversation_id).filter(Boolean);
    if (memberConvIds.length > 0) {
      const { data: rows, error: memberConvError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', memberConvIds);

      if (memberConvError) {
        console.error('getMyConversations member conversation rows error:', memberConvError);
      } else {
        memberConvRows = rows || [];
      }
    }

    const allConvRows = Array.from(
      new Map([...(directConvRows || []), ...memberConvRows].map((row: any) => [row.id, row])).values()
    ).sort((a: any, b: any) => {
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return timeB - timeA;
    });
    const convRows = includeArchived
      ? allConvRows
      : allConvRows.filter((row: any) => !row.archived_at);

    if (!convRows || convRows.length === 0) {
      return [];
    }
    const otherParticipantIds = [...new Set(convRows.map((c: any) =>
      c.creator_id === user.id ? c.member_id : c.creator_id
    ).filter(Boolean))] as string[];

    const jobIds = [...new Set(convRows.map((c: any) => c.job_id).filter(Boolean))];
    const contractIds = [...new Set(convRows.map((c: any) => c.work_contract_id).filter(Boolean))];
    const activeConvIds = convRows.filter((c: any) => !c.archived_at).map((c: any) => c.id);

    let profileMap = new Map();
    if (otherParticipantIds.length > 0) {
      const { getPublicProfilesByIds } = await import('./profileService');
      const canonicalMap = await getPublicProfilesByIds(otherParticipantIds);
      canonicalMap.forEach((prof, id) => {
        profileMap.set(id, {
          id: prof.id,
          full_name: prof.name,
          username: prof.name,
          avatar_url: prof.avatarUrl,
          profile_type: prof.profileType || 'normal',
          city: prof.city,
          state: prof.state,
          country: prof.country,
        });
      });
    }

    const workerIds = convRows
      .filter((c: any) => c.conversation_type === 'worker_direct')
      .map((c: any) => c.creator_id === user.id ? c.member_id : c.creator_id)
      .filter(Boolean);

    let professionMap = new Map();
    if (workerIds.length > 0) {
      const { data: wRows, error: wError } = await supabase
        .from('worker_profiles')
        .select('id, profession')
        .in('id', workerIds);

      if (wRows) {
        wRows.forEach((w: any) => { professionMap.set(w.id, w.profession); });
      }
      if (wError) {
        console.error('getMyConversations worker_profiles error:', wError);
      }
    }

    let jobMap: Record<string, string> = {};
    if (jobIds.length > 0) {
      const { data: jRows } = await supabase
        .from('jobs')
        .select('id, title')
        .in('id', jobIds);
      if (jRows) {
        jRows.forEach((j: any) => { jobMap[j.id] = j.title; });
      }
    }

    let contractTitleMap: Record<string, string> = {};
    if (contractIds.length > 0) {
      const { data: cRows } = await supabase
        .from('work_contracts')
        .select('id, work_title')
        .in('id', contractIds);
      if (cRows) {
        cRows.forEach((c: any) => { contractTitleMap[c.id] = c.work_title; });
      }
    }

    const unreadCountMap: Record<string, number> = {};
    if (activeConvIds.length > 0) {
      const { data: unreadRows, error: unreadError } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', activeConvIds)
        .neq('sender_id', user.id)
        .eq('unread', true);
      if (unreadError) {
        console.error('getMyConversations unread messages error:', unreadError);
      }
      (unreadRows || []).forEach((row: any) => {
        unreadCountMap[row.conversation_id] = (unreadCountMap[row.conversation_id] || 0) + 1;
      });
    }

    const mergedConversations = convRows.map((c: any) => {
      const otherId = c.creator_id === user.id ? c.member_id : c.creator_id;
      const otherProfile = profileMap.get(otherId) || {};
      let contextTitle = 'Job Opportunity';
      if (c.work_contract_id && contractTitleMap[c.work_contract_id]) {
        contextTitle = contractTitleMap[c.work_contract_id];
      } else if (c.job_id && jobMap[c.job_id]) {
        contextTitle = jobMap[c.job_id];
      } else if (c.conversation_type === 'worker_direct') {
        contextTitle = professionMap.get(otherId) || 'Professional';
      }

      const lastTimeFormatted = c.last_message_time
        ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : (c.created_at ? new Date(c.created_at).toLocaleDateString() : '');

      return {
        id: c.id,
        jobId: c.job_id,
        applicationId: c.application_id,
        creatorId: c.creator_id,
        memberId: c.member_id,
        otherParticipantId: otherId,
        otherParticipantName: otherProfile.full_name?.trim() || otherProfile.username?.trim() || 'OpenComm User',
        otherParticipantAvatar: otherProfile.avatar_url || null,
        otherParticipantTitle: contextTitle,
        lastMessageText: c.last_message_text || 'No messages yet',
        lastMessageTime: lastTimeFormatted,
        lastMessageAt: c.last_message_time || c.created_at,
        unreadCount: unreadCountMap[c.id] || 0,
        createdAt: c.created_at,
        conversationType: c.conversation_type,
        workContractId: c.work_contract_id,
        archiveScheduledAt: c.archive_scheduled_at || null,
        archivedAt: c.archived_at || null,
        archiveReason: c.archive_reason || null
      };
    });

    const uniqueConversations = Array.from(
      new Map(mergedConversations.map((item: any) => [item.id, item])).values()
    ) as ConversationViewModel[];

    return uniqueConversations;
  },

  async getConversationMessages(conversationId: string): Promise<DbMessage[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getConversationMessages error:', error);
      return [];
    }
    return data || [];
  },

  async sendTextMessage(conversationId: string, text: string): Promise<DbMessage | null> {
    if (!supabase) return null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Authentication required');

    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message cannot be empty');
    if (trimmed.length > 4000) throw new Error('Message exceeds 4000 characters limit');

    const { data: prof } = await supabase
      .from('profile_directory')
      .select('full_name, username, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    const senderName = prof?.full_name || prof?.username || user.email || 'User';
    const senderAvatar = prof?.avatar_url || null;

    const payload = {
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      text: trimmed,
      unread: true,
      role: 'user'
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.error('sendTextMessage error:', error);
      throw new Error(error.message);
    }

    await supabase
      .from('conversations')
      .update({
        last_message_text: trimmed,
        last_message_time: new Date().toISOString()
      })
      .eq('id', conversationId);

    return data;
  },

  async markConversationRead(conversationId: string): Promise<boolean> {
    if (!supabase) return false;
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId
    });
    if (error) {
      console.error('markConversationRead error:', error);
      return false;
    }
    return true;
  },

  // Centralized Notification Helpers
  createNotification: notificationService.createNotification,
  getUnreadNotificationCount: notificationService.getUnreadCount,
  getMyNotifications: notificationService.getMyNotifications,
  markNotificationRead: notificationService.markRead,
  markAllNotificationsRead: notificationService.markAllRead,
  deleteNotification: notificationService.deleteNotification,
  getNotificationPreferences: notificationService.getPreferences,
  updateNotificationPreferences: notificationService.updatePreferences,
  subscribeToNotifications: notificationService.subscribeToRealtime,

  // Ratings & Reviews Helpers
  async getContractReviewEligibility(contractId: string): Promise<any> {
    if (!supabase) return { can_review: false, reason: 'Database not initialized.' };
    const { data, error } = await supabase.rpc('get_contract_review_eligibility', {
      p_contract_id: contractId
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async submitContractReview(params: {
    contract_id: string;
    rating: number;
    title?: string;
    comment?: string;
    communication_rating?: number;
    work_quality_rating?: number;
    professionalism_rating?: number;
    punctuality_rating?: number;
    would_recommend?: boolean;
  }): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('submit_contract_review', {
      p_contract_id: params.contract_id,
      p_rating: params.rating,
      p_title: params.title || null,
      p_comment: params.comment || null,
      p_communication_rating: params.communication_rating || null,
      p_work_quality_rating: params.work_quality_rating || null,
      p_professionalism_rating: params.professionalism_rating || null,
      p_punctuality_rating: params.punctuality_rating || null,
      p_would_recommend: params.would_recommend ?? true
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async updateMyContractReview(reviewId: string, params: {
    rating: number;
    title?: string;
    comment?: string;
    communication_rating?: number;
    work_quality_rating?: number;
    professionalism_rating?: number;
    punctuality_rating?: number;
    would_recommend?: boolean;
  }): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('update_my_contract_review', {
      p_review_id: reviewId,
      p_rating: params.rating,
      p_title: params.title || null,
      p_comment: params.comment || null,
      p_communication_rating: params.communication_rating || null,
      p_work_quality_rating: params.work_quality_rating || null,
      p_professionalism_rating: params.professionalism_rating || null,
      p_punctuality_rating: params.punctuality_rating || null,
      p_would_recommend: params.would_recommend ?? true
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getReviewsForProfile(profileId: string, limit = 10, offset = 0): Promise<any[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_reviews_for_profile', {
      p_profile_id: profileId,
      p_limit: limit,
      p_offset: offset
    });
    if (error) {
      console.error('get_reviews_for_profile error:', error);
      return [];
    }
    return data || [];
  },

  async getProfileRatingSummary(profileId: string): Promise<any> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('get_profile_rating_summary', {
      p_profile_id: profileId
    });
    if (error) {
      console.error('get_profile_rating_summary error:', error);
      return null;
    }
    return data;
  },

  async getMyPendingReviews(): Promise<any[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('get_my_pending_reviews');
    if (error) {
      console.error('get_my_pending_reviews error:', error);
      return [];
    }
    return data || [];
  },

  async reportContractReview(reviewId: string, reason: string, details?: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('report_contract_review', {
      p_review_id: reviewId,
      p_reason: reason,
      p_details: details || null
    });
    if (error) throw new Error(error.message);
    return data;
  },

  // Admin Control Center Hardened RPCs
  async adminSuspendUser(targetUserId: string, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_suspend_user', {
      p_target_user_id: targetUserId,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminReactivateUser(targetUserId: string, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_reactivate_user', {
      p_target_user_id: targetUserId,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminModerateWorkerProfile(workerId: string, action: 'hide' | 'restore', reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_moderate_worker_profile', {
      p_worker_id: workerId,
      p_action: action,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminModerateJob(jobId: string, action: 'close' | 'archive' | 'restore', reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_moderate_job', {
      p_job_id: jobId,
      p_action: action,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminResolveReviewReport(reportId: string, action: 'dismiss' | 'hide_review' | 'mark_actioned', reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_resolve_review_report', {
      p_report_id: reportId,
      p_action: action,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminHideReview(reviewId: string, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_hide_review', {
      p_review_id: reviewId,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminSendPlatformNotification(recipientId: string, title: string, message: string, targetUrl: string, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_send_platform_notification', {
      p_recipient_id: recipientId,
      p_title: title,
      p_message: message,
      p_target_url: targetUrl,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminUpdatePlatformSetting(settingKey: string, settingValue: any, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_update_platform_setting', {
      p_setting_key: settingKey,
      p_setting_value: settingValue,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminSetFeatureFlag(flagKey: string, isEnabled: boolean, reason: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_set_feature_flag', {
      p_flag_key: flagKey,
      p_is_enabled: isEnabled,
      p_reason: reason
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminToggleMaintenanceMode(enabled: boolean, message?: string, reason?: string): Promise<any> {
    if (!supabase) throw new Error('Database not initialized.');
    const { data, error } = await supabase.rpc('admin_toggle_maintenance_mode', {
      p_enabled: enabled,
      p_message: message || null,
      p_reason: reason || null
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async adminGetDashboardAnalytics(): Promise<any> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('admin_get_dashboard_analytics');
    if (error) {
      console.error('admin_get_dashboard_analytics error:', error);
      return null;
    }
    return data;
  },

  async adminGetLocationServiceHealth(): Promise<any> {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('admin_get_location_service_health');
    if (error) {
      console.warn('[Audit] admin_get_location_service_health error:', error.message);
      return null;
    }
    return data;
  },

  // Account Deactivation & Reactivation
  async getAccountDeactivationStatus(): Promise<DeactivationStatusResponse> {
    if (supabase) {
      const { data, error } = await supabase.rpc('get_account_deactivation_status');
      if (error) {
        console.error('get_account_deactivation_status error:', error);
        throw new Error(error.message);
      }
      return data as DeactivationStatusResponse;
    }
    return {
      can_deactivate: true,
      blockers: {
        active_contracts: 0,
        pending_completion: 0,
        pending_cancellation: 0,
        disputed_contracts: 0,
        active_hire_commitments: 0,
        active_application_commitments: 0
      }
    };
  },

  async deactivateMyAccount(): Promise<{ success: boolean; message: string }> {
    if (supabase) {
      const { data, error } = await supabase.rpc('deactivate_my_account');
      if (error) {
        console.error('deactivate_my_account error:', error);
        throw new Error(error.message);
      }
      clearProfileCache();
      return data;
    }
    return { success: true, message: 'Account deactivated (local).' };
  },

  async reactivateMyAccount(): Promise<{ success: boolean; message: string }> {
    if (supabase) {
      const { data, error } = await supabase.rpc('reactivate_my_account');
      if (error) {
        console.error('reactivate_my_account error:', error);
        throw new Error(error.message);
      }
      clearProfileCache();
      return data;
    }
    return { success: true, message: 'Account reactivated (local).' };
  },

  // Login Activity
  async getLoginActivity(): Promise<UserLoginActivity[]> {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required.");
      const { data, error } = await supabase
        .from('user_login_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_in_at', { ascending: false })
        .limit(20);
      if (error) {
        console.error('getLoginActivity query error:', error);
        throw new Error(error.message || "Failed to load login activity history.");
      }
      return (data || []) as UserLoginActivity[];
    }
    return [];
  },

  async recordLoginActivity(authProvider?: string, fingerprint?: string): Promise<void> {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.access_token) return;

      const response = await fetch('/api/record-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          auth_provider: authProvider || session.user?.app_metadata?.provider || 'email',
          session_fingerprint: fingerprint || session.access_token.slice(-32)
        })
      });

      if (!response.ok) {
        console.warn('recordLoginActivity server endpoint returned status:', response.status);
      }
    } catch (err) {
      console.warn('recordLoginActivity error:', err);
    }
  },

  async adminListUsers(params?: { search?: string; limit?: number; offset?: number }): Promise<{ total: number; limit: number; offset: number; users: any[] }> {
    const search = params?.search || '';
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('admin_list_users', {
          p_search: search,
          p_limit: limit,
          p_offset: offset
        });
        if (!error && data) {
          return {
            total: data.total || 0,
            limit: data.limit || limit,
            offset: data.offset || offset,
            users: data.users || []
          };
        }
      } catch (err) {
        console.error('adminListUsers RPC error:', err);
      }
    }

    const allProfiles = openCommDb.getProfiles();
    const filtered = allProfiles.filter((p: any) =>
      !search ||
      (p.opencomm_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.username || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.id || '').includes(search)
    );
    const paged = filtered.slice(offset, offset + limit);
    return {
      total: filtered.length,
      limit,
      offset,
      users: paged
    };
  },

  async adminGetUserDetails(userId: string): Promise<any> {
    if (!userId) throw new Error('User ID required');
    if (supabase) {
      const { data, error } = await supabase.rpc('admin_get_user_details', {
        p_user_id: userId
      });
      if (error) {
        console.error('admin_get_user_details RPC error:', error);
        throw new Error(error.message || 'Unable to load user identity details.');
      }
      if (!data) {
        throw new Error('User identity details were not returned.');
      }
      return data;
    }

    const p = await this.getProfile(userId);
    if (!p) throw new Error('User profile not found');
    const w = await this.getWorkerProfile(userId);
    return {
      account_identity: {
        id: p.id,
        opencomm_id: p.opencomm_id || 'USER-000000',
        full_name: p.full_name,
        username: p.username,
        email: p.email,
        phone: p.phone,
        profile_type: p.profile_type,
        account_status: p.account_status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        preferred_language: p.preferred_language,
        onboarding_completed: p.onboarding_completed || false,
        email_verified_for_actions: p.email_verified_for_actions || false,
        phone_verified_for_actions: p.phone_verified_for_actions || false,
        deactivated_at: (p as any).deactivated_at
      },
      technical_identity: {
        auth_user_id: p.id,
        profile_id: p.id,
        worker_profile_id: w ? p.id : null,
        has_worker_profile: !!w,
        has_profile_directory: true,
        has_worker_directory: !!w
      },
      location: {
        city: p.city,
        district: p.district,
        state: p.state,
        country: p.country,
        show_location_publicly: p.show_location_publicly ?? true
      },
      worker_summary: w ? {
        profession: w.profession,
        skills: w.skills,
        experience_years: w.experience_years,
        availability: w.availability,
        hourly_rate: w.hourly_rate,
        expected_salary: w.expected_salary,
        portfolio_url: w.portfolio_url,
        is_worker_listed: p.is_worker_listed ?? true
      } : null,
      recent_logins: []
    };
  },

  async adminGetMediaStorageHealth(): Promise<any> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('admin_get_media_storage_health');
      if (error) {
        console.warn('admin_get_media_storage_health RPC error:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('adminGetMediaStorageHealth exception:', err);
      return null;
    }
  }
};

export function formatWorkerRate(worker: any): string {
  if (!worker) return 'Not added';

  const hourly = Number(worker.hourly_rate || worker.hourlyRate) || 0;
  const expSal = worker.expected_salary || worker.expectedSalary;

  if (hourly > 0) {
    return `₹${hourly.toLocaleString('en-IN')}/hr`;
  }

  if (expSal && typeof expSal === 'string' && expSal.trim()) {
    return expSal.trim();
  }

  return 'Not added';
}
