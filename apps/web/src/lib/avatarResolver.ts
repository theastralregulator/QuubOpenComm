import { PRESET_AVATARS } from '../data/presetAvatars';
import { LocalProfile } from './supabase';

/**
 * Resolves the final profile image URL based on priority:
 * 1. Uploaded profile_image_url
 * 2. Selected avatar_id (preset)
 * 3. Default avatar_id (preset)
 * 4. Initials fallback
 */
export function resolveProfileImage(profile: Partial<LocalProfile> | null): string {
  if (!profile) return generateInitialsAvatar('User');

  // 1. Uploaded Image
  if (profile.profile_image_url) {
    return profile.profile_image_url;
  }
  
  // Legacy support for avatar_url if it's not the unsplash default
  if (profile.avatar_url && !profile.avatar_url.includes('unsplash.com')) {
    return profile.avatar_url;
  }

  // 2. Selected Preset Avatar
  if (profile.avatar_id) {
    const preset = PRESET_AVATARS.find(a => a.id === profile.avatar_id);
    if (preset) return preset.url;
  }

  // 3. Stable Default Preset Avatar
  if (profile.default_avatar_id) {
    const preset = PRESET_AVATARS.find(a => a.id === profile.default_avatar_id);
    if (preset) return preset.url;
  }

  // 4. Initials Fallback
  return generateInitialsAvatar(profile.full_name || profile.username || 'User');
}

/**
 * Generates an SVG initials avatar URL
 */
export function generateInitialsAvatar(name: string): string {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';
    
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random`;
}
