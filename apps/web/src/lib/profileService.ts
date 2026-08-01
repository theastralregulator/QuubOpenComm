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

    // 2. Query profiles as fallback with ONLY existing valid schema columns
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, banner_url, bio, city, state, country, preferred_language, profile_type, username, show_location_publicly')
      .eq('id', userId)
      .maybeSingle();

    if (profData) {
      const name = resolveDisplayName(profData);
      const isLocPublic = profData.show_location_publicly !== false;
      const profile: CanonicalPublicProfile = {
        id: profData.id,
        name,
        fullName: profData.full_name || name,
        avatarUrl: profData.avatar_url || null,
        bannerUrl: profData.banner_url || null,
        bio: profData.bio || null,
        city: isLocPublic ? (profData.city || null) : null,
        state: isLocPublic ? (profData.state || null) : null,
        country: isLocPublic ? (profData.country || null) : null,
        verified: false,
        profileType: profData.profile_type || null,
      };
      profileCache.set(userId, profile);
      return profile;
    }
  } catch (err) {
    console.error(`[Employer Identity Debug] Unexpected error fetching public profile for ${userId}:`, err);
  }

  // 3. Robust fallback profile
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
    // 1. Batched lookup from profile_directory (using only valid columns!)
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

    // 2. Batched fallback lookup from profiles for any remaining missing IDs
    const stillMissing = missingFromCache.filter(id => !result.has(id));
    if (stillMissing.length > 0) {
      const { data: profRows, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, banner_url, bio, city, state, country, preferred_language, profile_type, username, email_verified_for_actions')
        .in('id', stillMissing);

      if (profError) {
        console.error('[Employer Identity Debug] profiles batch query error:', profError);
      }

      if (profRows) {
        profRows.forEach((prof: any) => {
          const name = resolveDisplayName(prof);
          const profile: CanonicalPublicProfile = {
            id: prof.id,
            name,
            fullName: prof.full_name || name,
            avatarUrl: prof.avatar_url || null,
            bannerUrl: prof.banner_url || null,
            bio: prof.bio || null,
            city: prof.city || null,
            state: prof.state || null,
            country: prof.country || null,
            verified: Boolean(prof.email_verified_for_actions),
            profileType: prof.profile_type || null,
          };
          profileCache.set(prof.id, profile);
          result.set(prof.id, profile);
        });
      }
    }

    const unmappedIds = missingFromCache.filter(id => !result.has(id));
    if (unmappedIds.length > 0) {
      console.warn(`[Employer Identity Debug]
canonical table: profile_directory & profiles
canonical key column: id
unmapped profile IDs count: ${unmappedIds.length}
unmapped IDs: ${unmappedIds.join(', ')}`);
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
