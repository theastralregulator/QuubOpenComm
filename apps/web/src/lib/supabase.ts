import { createClient } from '@supabase/supabase-js';
import { analytics } from './analytics';

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
  account_status: 'active' | 'disabled';
  profile_type: 'basic' | 'worker' | 'company';
  account_type?: 'basic' | 'worker' | 'company';
  is_worker_listed?: boolean;
  signup_status?: 'pending_verification' | 'completed';
  created_at: string;
  updated_at: string;
  email_verified_for_actions?: boolean;
  onboarding_completed?: boolean;
  banner_id?: string;
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
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
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

export const dbService = {
  async getProfile(userId: string): Promise<LocalProfile | null> {
    let remoteProfile: any = null;
    if (supabase) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (!error && data) {
          remoteProfile = data;
        }
      } catch (err) {
        console.error('getProfile Supabase error:', err);
      }
    }
    const profiles = openCommDb.getProfiles();
    const localProfile = profiles.find(p => p.id === userId) || null;

    if (remoteProfile) {
      // Merge remote profile with local profile to preserve fields that cannot be saved on remote (e.g. onboarding_completed)
      const merged = {
        ...localProfile,
        ...remoteProfile,
        city: remoteProfile.city || localProfile?.city || '',
        state: remoteProfile.state || localProfile?.state || '',
        country: remoteProfile.country || localProfile?.country || '',
        country_code: remoteProfile.country_code || localProfile?.country_code || '',
        state_code: remoteProfile.state_code || localProfile?.state_code || '',
        district: remoteProfile.district || localProfile?.district || '',
        latitude: remoteProfile.latitude !== undefined ? remoteProfile.latitude : localProfile?.latitude,
        longitude: remoteProfile.longitude !== undefined ? remoteProfile.longitude : localProfile?.longitude,
        preferred_language: remoteProfile.preferred_language || localProfile?.preferred_language || '',
        bio: remoteProfile.bio || localProfile?.bio || '',
        avatar_url: remoteProfile.avatar_url || localProfile?.avatar_url || '',
        banner_id: remoteProfile.banner_id || localProfile?.banner_id || 'banner_01',
        onboarding_completed: remoteProfile.onboarding_completed ?? localProfile?.onboarding_completed ?? (remoteProfile.city ? true : false),
        email_verified_for_actions: remoteProfile.email_verified_for_actions ?? localProfile?.email_verified_for_actions ?? false,
      } as LocalProfile;

      // Update the local cache with the merged profile
      const idx = profiles.findIndex(p => p.id === userId);
      if (idx >= 0) {
        profiles[idx] = merged;
      } else {
        profiles.push(merged);
      }
      openCommDb.saveProfiles(profiles);

      return merged;
    }
    return localProfile;
  },

  async updateProfile(userId: string, updates: Partial<LocalProfile>): Promise<LocalProfile> {
    // 1. First, save to local profiles emulation so local data is always up-to-date
    const profiles = openCommDb.getProfiles();
    const idx = profiles.findIndex(p => p.id === userId);
    const updated = {
      ...(profiles[idx] || { id: userId, created_at: new Date().toISOString(), profile_type: 'basic', account_status: 'active', onboarding_completed: false }),
      ...updates,
      updated_at: new Date().toISOString()
    } as LocalProfile;
    
    // Explicitly update onboarding_completed if updates contains it, or if bio/city is provided
    if (updates.city || updates.onboarding_completed) {
      updated.onboarding_completed = true;
    }

    if (idx >= 0) profiles[idx] = updated;
    else profiles.push(updated);
    openCommDb.saveProfiles(profiles);

    // 2. Next, save to remote Supabase, filtering out non-existent columns (onboarding_completed, email_verified_for_actions)
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.id === userId) {
          const allowedRemoteColumns = [
            'id', 'username', 'full_name', 'avatar_url', 'email', 'phone', 
            'phone_verified', 'city', 'state', 'country', 'country_code', 'state_code', 'district', 'latitude', 'longitude', 'preferred_language', 
            'bio', 'account_status', 'profile_type', 'created_at', 'updated_at',
            'onboarding_completed', 'banner_id'
          ];
          
          const filteredUpdates: any = {};
          for (const [key, val] of Object.entries(updates)) {
            if (allowedRemoteColumns.includes(key)) {
              filteredUpdates[key] = val;
            }
          }

          // Check if profile exists to prevent any potential RLS upsert anomalies
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

          let result;
          if (existing) {
            result = await supabase
              .from('profiles')
              .update({
                ...filteredUpdates,
                updated_at: new Date().toISOString()
              })
              .eq('id', userId)
              .select()
              .maybeSingle();
          } else {
            result = await supabase
              .from('profiles')
              .insert({
                id: userId,
                ...filteredUpdates,
                updated_at: new Date().toISOString()
              })
              .select()
              .maybeSingle();
          }

          if (result.error) {
            console.error('updateProfile Supabase error returned:', result.error.message);
          } else if (result.data) {
            // Merge data from remote back into local cache
            const freshProfiles = openCommDb.getProfiles();
            const freshIdx = freshProfiles.findIndex(p => p.id === userId);
            if (freshIdx >= 0) {
              freshProfiles[freshIdx] = {
                ...freshProfiles[freshIdx],
                ...result.data
              };
              openCommDb.saveProfiles(freshProfiles);
            }
          }
        } else {
          console.log(`[dbService] Bypassed Supabase remote sync for local/unauthenticated user profile update (userId: ${userId})`);
        }
      } catch (err) {
        console.error('updateProfile Supabase exception:', err);
      }
    }

    return updated;
  },

  async createWorkerProfile(worker: LocalWorkerProfile): Promise<LocalWorkerProfile> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        await supabase.from('worker_profiles').upsert({
          id: worker.id,
          user_id: worker.id,
          profession: worker.professional_title || worker.profession,
          professional_title: worker.professional_title || worker.profession,
          primary_category: worker.primary_category || '',
          skills: worker.skills,
          experience_years: worker.years_experience ?? worker.experience_years,
          years_experience: worker.years_experience ?? worker.experience_years,
          experience_level: worker.experience_level || 'Entry',
          work_location: worker.work_location || '',
          availability: worker.availability_status || worker.availability,
          availability_status: worker.availability_status || worker.availability,
          bio_summary: worker.bio_summary || '',
          hourly_rate: worker.hourly_rate || 0,
          expected_salary: worker.expected_salary || '',
          expected_salary_min: worker.expected_salary_min || null,
          expected_salary_max: worker.expected_salary_max || null,
          currency: worker.currency || 'USD',
          work_preference: worker.work_preference || 'Remote',
          willing_to_relocate: worker.willing_to_relocate || false,
          service_radius: worker.service_radius || null,
          current_employer: worker.current_employer || '',
          linkedin_url: worker.linkedin_url || '',
          github_url: worker.github_url || '',
          portfolio_url: worker.portfolio_url || '',
          highest_qualification: worker.highest_qualification || '',
          course_specialization: worker.course_specialization || '',
          institution: worker.institution || '',
          graduation_year: worker.graduation_year || null,
          resume_path: worker.resume_path || '',
          worker_profile_completed: worker.worker_profile_completed || false,
          certificates: worker.certificates || [],
          languages: worker.languages || []
        });

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
    await this.updateProfile(worker.id, { profile_type: 'worker', account_type: 'worker' });
    
    // Track worker profile creation in Google Analytics
    analytics.trackWorkerProfileCreated({
      profession: worker.professional_title || worker.profession,
      skills: worker.skills,
      rate: worker.hourly_rate
    });

    return worker;
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
            profession: data.professional_title || data.profession,
            professional_title: data.professional_title || data.profession,
            primary_category: data.primary_category || '',
            skills: skillsData && skillsData.length > 0 ? skillsData.map((s: any) => s.skill) : (data.skills || []),
            experience_years: data.years_experience ?? data.experience_years ?? 0,
            years_experience: data.years_experience ?? data.experience_years ?? 0,
            experience_level: data.experience_level || 'Entry',
            work_location: data.work_location || '',
            availability: (data.availability_status || data.availability) as any || 'Available Now',
            availability_status: (data.availability_status || data.availability) as any || 'Available Now',
            bio_summary: data.bio_summary || '',
            hourly_rate: Number(data.hourly_rate) || 0,
            expected_salary: data.expected_salary || '',
            expected_salary_min: data.expected_salary_min ? Number(data.expected_salary_min) : undefined,
            expected_salary_max: data.expected_salary_max ? Number(data.expected_salary_max) : undefined,
            currency: data.currency || 'USD',
            work_preference: data.work_preference || 'Remote',
            willing_to_relocate: data.willing_to_relocate || false,
            service_radius: data.service_radius ? Number(data.service_radius) : undefined,
            current_employer: data.current_employer || '',
            linkedin_url: data.linkedin_url || '',
            github_url: data.github_url || '',
            portfolio_url: data.portfolio_url || '',
            highest_qualification: data.highest_qualification || '',
            course_specialization: data.course_specialization || '',
            institution: data.institution || '',
            graduation_year: data.graduation_year || undefined,
            resume_path: data.resume_path || '',
            worker_profile_completed: data.worker_profile_completed || false,
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

  // Jobs integration
  async createJobInDb(job: any, postedBy: string): Promise<any> {
    await assertUserEmailConfirmed();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('jobs').insert({
          title: job.title,
          description: job.description,
          salary_range: job.salary,
          location: job.location,
          category: job.category,
          requirements: job.requirements || [],
          posted_by: postedBy,
          is_active: true
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
        console.error('createJobInDb Supabase error:', err);
      }
    }
    return job;
  },

  async getJobsFromDb(): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('jobs').select('*, companies(*)');
        if (!error && data) return data;
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

  // Notifications
  async getNotificationsFromDb(userId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (!error && data) return data;
      } catch (err) {
        console.error('getNotificationsFromDb Supabase error:', err);
      }
    }
    return [];
  },

  async createNotificationInDb(userId: string, type: 'application' | 'message' | 'hire' | 'system', title: string, description: string): Promise<any> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('notifications').insert({
          user_id: userId,
          type,
          title,
          description,
          read: false
        }).select().single();
        if (!error && data) return data;
      } catch (err) {
        console.error('createNotificationInDb Supabase error:', err);
      }
    }
    return null;
  },

  async markNotificationReadInDb(notifId: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notifId);
        return !error;
      } catch (err) {
        console.error('markNotificationReadInDb Supabase error:', err);
      }
    }
    return true;
  },

  // Reviews
  async getReviewsFromDb(userId: string): Promise<any[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('reviews').select('*').eq('reviewee_id', userId);
        if (!error && data) return data;
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
  }
};

