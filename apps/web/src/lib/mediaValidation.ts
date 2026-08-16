export const MAX_AUDIO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB canonical limit
export const MAX_AUDIO_DURATION_MS = 5 * 60 * 1000; // 5 min (300,000 ms)

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB canonical limit

export const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB canonical limit
export const MAX_VIDEO_DURATION_MS = 5 * 60 * 1000; // 5 min (300,000 ms)

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB canonical limit

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv'
] as const;

export const ALLOWED_MIME_TYPES = {
  audio: ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/x-m4a'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm'],
  document: [...ALLOWED_DOCUMENT_MIME_TYPES],
};
