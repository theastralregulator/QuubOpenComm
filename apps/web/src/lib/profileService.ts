/**
 * Canonical Profile Service for OpenComm
 * Provides a single source of truth for resolving user, employer, and worker identity across the application.
 * 
 * CANONICAL SCHEMA & KEY MAPPING:
 * - Table: public.profile_directory (backed by trigger from public.profiles)
 * - Key Column: id (UUID referencing auth.users.id)
 * - Reference Column: jobs.posted_by references profiles(id)
 * - Valid Columns: id, username, full_name, avatar_url, banner_url, bio, city, state, country, preferred_language, profile_type
 */

import { supabase } from './supabase';

export interface CanonicalPublicProfile {
  id: string;
  name: string;
  fullName: string;
  companyName?: string | null;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  verified: boolean;
  profileType?: string | null;
}

const profileCache = new Map<string, CanonicalPublicProfile>();

export function getInitials(nameStr?: string | null): string {
  if (!nameStr || nameStr === 'Employer' || nameStr === 'OpenComm User' || nameStr === 'Verified Employer') {
    return 'OU';
  }
  const clean = nameStr.trim();
  if (clean === 'OpenComm User') return 'OU';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

export function resolveDisplayName(profile?: { full_name?: string | null; username?: string | null } | null): string {
  if (!profile) return 'OpenComm User';
  const raw = profile.full_name || profile.username;
  if (!raw || !raw.trim() || raw === 'Verified Employer' || raw === 'Employer') {
    return 'OpenComm User';
  }
  return raw.trim();
}

export async function getPublicProfileById(userId: string): Promise<CanonicalPublicProfile> {
  if (!userId) {
    return {
      id: '',
      name: 'OpenComm User',
      fullName: 'OpenComm User',
      avatarUrl: null,
      verified: false,
    };
  }

  if (profileCache.has(userId)) {
    return profileCache.get(userId)!;
  }

  if (!supabase) {
    return {
      id: userId,
      name: 'OpenComm User',
      fullName: 'OpenComm User',
      avatarUrl: null,
      verified: false,
    };
  }

  try {
    // 1. Query profile_directory with ONLY existing valid schema columns
    const { data: pdData, error: pdError } = await supabase
      .from('profile_directory')
      .select('id, full_name, avatar_url, banner_url, bio, city, state, country, preferred_language, profile_type, username, show_location_publicly')
      .eq('id', userId)
      .maybeSingle();

    if (pdError) {
      console.error(`[Employer Identity Debug] profile_directory query error for ${userId}:`, pdError);
    }

    if (pdData) {
      const name = resolveDisplayName(pdData);
      const isLocPublic = pdData.show_location_publicly !== false;
      const profile: CanonicalPublicProfile = {
        id: pdData.id,
        name,
        fullName: pdData.full_name || name,
        avatarUrl: pdData.avatar_url || null,
        bannerUrl: pdData.banner_url || null,
        bio: pdData.bio || null,
        city: isLocPublic ? (pdData.city || null) : null,
        state: isLocPublic ? (pdData.state || null) : null,
        country: isLocPublic ? (pdData.country || null) : null,
        verified: false,
        profileType: pdData.profile_type || null,
      };
      profileCache.set(userId, profile);
      return profile;
    }
  } catch (err) {
    console.error(`[Employer Identity Debug] Unexpected error fetching public profile for ${userId}:`, err);
  }

  // Fallback profile if record not found in directory
  const fallback: CanonicalPublicProfile = {
    id: userId,
    name: 'OpenComm User',
    fullName: 'OpenComm User',
    avatarUrl: null,
    verified: false,
  };
  return fallback;
}

export async function getPublicProfilesByIds(userIds: string[]): Promise<Map<string, CanonicalPublicProfile>> {
  const result = new Map<string, CanonicalPublicProfile>();
  if (!userIds || userIds.length === 0) return result;

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const missingFromCache: string[] = [];

  for (const id of uniqueIds) {
    if (profileCache.has(id)) {
      result.set(id, profileCache.get(id)!);
    } else {
      missingFromCache.push(id);
    }
  }

  if (missingFromCache.length === 0) {
    return result;
  }

  if (!supabase) {
    for (const id of missingFromCache) {
      result.set(id, { id, name: 'OpenComm User', fullName: 'OpenComm User', avatarUrl: null, verified: false });
    }
    return result;
  }

  try {
    // Single clean batched lookup from profile_directory
    const { data: pdRows, error: pdError } = await supabase
      .from('profile_directory')
      .select('id, full_name, avatar_url, banner_url, bio, city, state, country, preferred_language, profile_type, username, show_location_publicly')
      .in('id', missingFromCache);

    if (pdError) {
      console.error('[Employer Identity Debug] profile_directory batch query error:', pdError);
    }

    if (pdRows) {
      pdRows.forEach((pd: any) => {
        const name = resolveDisplayName(pd);
        const isLocPublic = pd.show_location_publicly !== false;
        const profile: CanonicalPublicProfile = {
          id: pd.id,
          name,
          fullName: pd.full_name || name,
          avatarUrl: pd.avatar_url || null,
          bannerUrl: pd.banner_url || null,
          bio: pd.bio || null,
          city: isLocPublic ? (pd.city || null) : null,
          state: isLocPublic ? (pd.state || null) : null,
          country: isLocPublic ? (pd.country || null) : null,
          verified: false,
          profileType: pd.profile_type || null,
        };
        profileCache.set(pd.id, profile);
        result.set(pd.id, profile);
      });
    }

    const unmappedIds = missingFromCache.filter(id => !result.has(id));
    if (unmappedIds.length > 0) {
      console.warn(`[Employer Identity Debug] profile_directory unmapped profile IDs count: ${unmappedIds.length}`);
    }

  } catch (err) {
    console.error('[profileService] Exception in batch fetching profiles:', err);
  }

  for (const id of missingFromCache) {
    if (!result.has(id)) {
      const fb: CanonicalPublicProfile = { id, name: 'OpenComm User', fullName: 'OpenComm User', avatarUrl: null, verified: false };
      profileCache.set(id, fb);
      result.set(id, fb);
    }
  }

  return result;
}

export function clearProfileCache(userId?: string): void {
  if (userId) {
    profileCache.delete(userId);
  } else {
    profileCache.clear();
  }
}
