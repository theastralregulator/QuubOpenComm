/**
 * Canonical Profile Service for OpenComm
 * Provides a single source of truth for resolving user, employer, and worker identity across the application.
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

export function resolveDisplayName(profile?: { full_name?: string | null; company_name?: string | null; username?: string | null } | null): string {
  if (!profile) return 'OpenComm User';
  const raw = profile.full_name || profile.company_name || profile.username;
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
    const fallback: CanonicalPublicProfile = {
      id: userId,
      name: 'OpenComm User',
      fullName: 'OpenComm User',
      avatarUrl: null,
      verified: false,
    };
    return fallback;
  }

  try {
    // 1. Primary lookup: profile_directory
    const { data: pdData } = await supabase
      .from('profile_directory')
      .select('id, full_name, company_name, avatar_url, banner_url, bio, city, state, country, verified, is_verified, profile_type, username')
      .eq('id', userId)
      .maybeSingle();

    if (pdData) {
      const name = resolveDisplayName(pdData);
      const profile: CanonicalPublicProfile = {
        id: pdData.id,
        name,
        fullName: pdData.full_name || name,
        companyName: pdData.company_name || null,
        avatarUrl: pdData.avatar_url || null,
        bannerUrl: pdData.banner_url || null,
        bio: pdData.bio || null,
        city: pdData.city || null,
        state: pdData.state || null,
        country: pdData.country || null,
        verified: Boolean(pdData.verified || pdData.is_verified),
        profileType: pdData.profile_type || null,
      };
      profileCache.set(userId, profile);
      return profile;
    }

    // 2. Secondary fallback lookup: profiles
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, avatar_url, banner_url, bio, city, state, country, verified, profile_type, username')
      .eq('id', userId)
      .maybeSingle();

    if (profData) {
      const name = resolveDisplayName(profData);
      const profile: CanonicalPublicProfile = {
        id: profData.id,
        name,
        fullName: profData.full_name || name,
        companyName: profData.company_name || null,
        avatarUrl: profData.avatar_url || null,
        bannerUrl: profData.banner_url || null,
        bio: profData.bio || null,
        city: profData.city || null,
        state: profData.state || null,
        country: profData.country || null,
        verified: Boolean(profData.verified),
        profileType: profData.profile_type || null,
      };
      profileCache.set(userId, profile);
      return profile;
    }
  } catch (err) {
    console.error(`[profileService] Error fetching profile for ${userId}:`, err);
  }

  // Stable Fallback if genuinely missing in DB
  const fallbackProfile: CanonicalPublicProfile = {
    id: userId,
    name: 'OpenComm User',
    fullName: 'OpenComm User',
    avatarUrl: null,
    verified: false,
  };
  profileCache.set(userId, fallbackProfile);
  return fallbackProfile;
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
      const fb: CanonicalPublicProfile = { id, name: 'OpenComm User', fullName: 'OpenComm User', avatarUrl: null, verified: false };
      result.set(id, fb);
    }
    return result;
  }

  try {
    // 1. Batched lookup from profile_directory
    const { data: pdRows } = await supabase
      .from('profile_directory')
      .select('id, full_name, company_name, avatar_url, banner_url, bio, city, state, country, verified, is_verified, profile_type, username')
      .in('id', missingFromCache);

    if (pdRows) {
      pdRows.forEach((pd: any) => {
        const name = resolveDisplayName(pd);
        const profile: CanonicalPublicProfile = {
          id: pd.id,
          name,
          fullName: pd.full_name || name,
          companyName: pd.company_name || null,
          avatarUrl: pd.avatar_url || null,
          bannerUrl: pd.banner_url || null,
          bio: pd.bio || null,
          city: pd.city || null,
          state: pd.state || null,
          country: pd.country || null,
          verified: Boolean(pd.verified || pd.is_verified),
          profileType: pd.profile_type || null,
        };
        profileCache.set(pd.id, profile);
        result.set(pd.id, profile);
      });
    }

    // 2. Batched fallback lookup from profiles for any remaining missing IDs
    const stillMissing = missingFromCache.filter(id => !result.has(id));
    if (stillMissing.length > 0) {
      const { data: profRows } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, avatar_url, banner_url, bio, city, state, country, verified, profile_type, username')
        .in('id', stillMissing);

      if (profRows) {
        profRows.forEach((prof: any) => {
          const name = resolveDisplayName(prof);
          const profile: CanonicalPublicProfile = {
            id: prof.id,
            name,
            fullName: prof.full_name || name,
            companyName: prof.company_name || null,
            avatarUrl: prof.avatar_url || null,
            bannerUrl: prof.banner_url || null,
            bio: prof.bio || null,
            city: prof.city || null,
            state: prof.state || null,
            country: prof.country || null,
            verified: Boolean(prof.verified),
            profileType: prof.profile_type || null,
          };
          profileCache.set(prof.id, profile);
          result.set(prof.id, profile);
        });
      }
    }
  } catch (err) {
    console.error('[profileService] Error batch fetching profiles:', err);
  }

  // Fill any remaining un-resolved IDs with stable fallback
  for (const id of missingFromCache) {
    if (!result.has(id)) {
      const fb: CanonicalPublicProfile = { id, name: 'OpenComm User', fullName: 'OpenComm User', avatarUrl: null, verified: false };
      profileCache.set(id, fb);
      result.set(id, fb);
    }
  }

  return result;
}

export function clearProfileCache(): void {
  profileCache.clear();
}
