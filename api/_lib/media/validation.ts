import { MediaType } from './providers.js';

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

export const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000; // 5 min

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_DURATION_MS = 5 * 60 * 1000; // 5 min

export const ALLOWED_MIME_TYPES: Record<MediaType, string[]> = {
  audio: ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/aac'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'],
};

export function validateMediaRequest(
  mediaType: MediaType,
  mimeType: string,
  fileSizeBytes: number,
  durationMs?: number
): MediaValidationResult {
  if (!['image', 'video', 'audio'].includes(mediaType)) {
    return { valid: false, error: 'Invalid media type.' };
  }

  const allowedForType = ALLOWED_MIME_TYPES[mediaType] || [];
  if (!allowedForType.includes(mimeType.toLowerCase())) {
    return { valid: false, error: `Unsupported MIME type '${mimeType}' for ${mediaType}.` };
  }

  if (mediaType === 'audio') {
    if (fileSizeBytes > MAX_AUDIO_SIZE_BYTES) {
      return { valid: false, error: 'Audio file exceeds maximum size limit of 10MB.' };
    }
    if (durationMs && durationMs > MAX_AUDIO_DURATION_MS) {
      return { valid: false, error: 'Voice note exceeds maximum duration limit of 5 minutes.' };
    }
  }

  if (mediaType === 'image') {
    if (fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return { valid: false, error: 'Image exceeds maximum size limit of 10MB.' };
    }
  }

  if (mediaType === 'video') {
    if (fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
      return { valid: false, error: 'Video exceeds maximum size limit of 50MB.' };
    }
    if (durationMs && durationMs > MAX_VIDEO_DURATION_MS) {
      return { valid: false, error: 'Video exceeds maximum duration limit of 5 minutes.' };
    }
  }

  return { valid: true };
}
