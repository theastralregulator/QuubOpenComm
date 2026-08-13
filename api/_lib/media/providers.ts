import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import { normalizeMimeType } from './validation.js';

export type StorageProviderType = 'r2' | 'b2' | 'cloudinary';
export type MediaType = 'image' | 'video' | 'audio';

export interface UploadTargetResult {
  provider: StorageProviderType;
  uploadUrl: string;
  objectKey: string;
  uploadMethod: 'PUT' | 'POST';
  formDataParams?: Record<string, string>;
  headers?: Record<string, string>;
  expiresInSeconds?: number;
}

export interface ObjectVerificationResult {
  exists: boolean;
  contentLengthBytes?: number;
  contentType?: string;
  resourceType?: string;
  format?: string;
  error?: string;
}

export interface StorageProviderConfigStatus {
  b2Configured: boolean;
  cloudinaryConfigured: boolean;
  r2Configured: boolean;
  activePrimaryProvider: StorageProviderType | null;
}

// Inspect active environment configuration
export function checkStorageProvidersConfig(): StorageProviderConfigStatus {
  const b2Configured = Boolean(
    process.env.B2_KEY_ID &&
    process.env.B2_APPLICATION_KEY &&
    process.env.B2_BUCKET_NAME &&
    process.env.B2_ENDPOINT
  );

  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  const r2Configured = Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );

  // Primary: B2. Fallback: Cloudinary. R2 is NOT an active primary for new uploads!
  let activePrimaryProvider: StorageProviderType | null = null;
  if (b2Configured) {
    activePrimaryProvider = 'b2';
  } else if (cloudinaryConfigured) {
    activePrimaryProvider = 'cloudinary';
  }

  return {
    b2Configured,
    cloudinaryConfigured,
    r2Configured,
    activePrimaryProvider
  };
}

// Derive region from B2 endpoint hostname if B2_REGION is absent or mismatching
export function deriveB2Region(endpoint: string): string {
  if (process.env.B2_REGION && process.env.B2_REGION.trim()) {
    return process.env.B2_REGION.trim();
  }
  try {
    const host = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`).hostname;
    // e.g. "s3.ca-east-006.backblazeb2.com" -> "ca-east-006"
    const match = host.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {}
  return 'us-west-004';
}

// Helper: Get S3 Client for Backblaze B2
function getB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_NAME;
  const rawEndpoint = process.env.B2_ENDPOINT;

  if (!keyId || !applicationKey || !bucket || !rawEndpoint) {
    return null;
  }

  let endpoint = rawEndpoint.trim().replace(/\/+$/, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }

  const region = deriveB2Region(endpoint);

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
    forcePathStyle: true, // Path-style URLs (https://s3.<region>.backblazeb2.com/<bucket>/<key>) ensure SSL certificate validity and prevent CORS domain resolution errors in browser uploads!
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return { client, bucket };
}

// Helper: Get S3 Client for Cloudflare R2 (Legacy historical read/cleanup only)
function getR2Client(): { client: S3Client; bucket: string } | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const accountId = process.env.R2_ACCOUNT_ID;
  const rawEndpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accessKeyId || !secretAccessKey || !bucket || !rawEndpoint) {
    return null;
  }

  let endpoint = rawEndpoint.trim().replace(/\/+$/, '');
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = `https://${endpoint}`;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return { client, bucket };
}

// Helper: Get Cloudinary resource_type ('image' | 'video' | 'raw')
export function getCloudinaryResourceType(mediaType: MediaType, mimeType: string): 'image' | 'video' | 'raw' {
  const cleanMime = normalizeMimeType(mimeType);
  if (mediaType === 'image') return 'image';
  if (mediaType === 'video' || mediaType === 'audio') return 'video'; // Cloudinary processes audio under 'video' resource_type pipeline
  return 'raw';
}

// Generate strong object key using crypto.randomUUID()
export function generateObjectKey(conversationId: string, mediaType: MediaType, mimeType: string): string {
  const extensionMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/m4a': 'm4a',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };

  const ext = extensionMap[mimeType] || (mediaType === 'audio' ? 'webm' : mediaType === 'image' ? 'jpg' : 'mp4');
  const datePrefix = new Date().toISOString().substring(0, 7); // YYYY-MM
  const randomUuid = crypto.randomUUID();
  return `opencomm_media/${datePrefix}/${conversationId}/${Date.now()}_${randomUuid}.${ext}`;
}

// Helper to create Cloudinary target
function createCloudinaryUploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string
): UploadTargetResult {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const folder = 'opencomm-chat-media';
  const timestamp = Math.floor(Date.now() / 1000);
  const rawObjectKey = generateObjectKey(conversationId, mediaType, mimeType);
  const publicId = rawObjectKey.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
  const resourceType = getCloudinaryResourceType(mediaType, mimeType);
  const deliveryType = 'authenticated'; // Enforce authenticated delivery!

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  const paramsToSign = {
    folder,
    public_id: publicId,
    timestamp,
    type: deliveryType
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  return {
    provider: 'cloudinary',
    uploadUrl,
    objectKey: publicId,
    uploadMethod: 'POST',
    formDataParams: {
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
      folder,
      public_id: publicId,
      type: deliveryType
    },
    expiresInSeconds: 900
  };
}

// Create Upload Target (PRIMARY = B2, FALLBACK = Cloudinary Authenticated Private Upload)
export async function createUploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string,
  fileSizeBytes: number,
  preferredProvider?: StorageProviderType
): Promise<UploadTargetResult> {
  const cleanMime = normalizeMimeType(mimeType);
  const config = checkStorageProvidersConfig();

  // If preferredProvider is explicitly requested and available, use it
  if (preferredProvider === 'cloudinary' && config.cloudinaryConfigured) {
    return createCloudinaryUploadTarget(conversationId, mediaType, cleanMime);
  }

  // Primary Choice: Backblaze B2
  if (config.b2Configured && preferredProvider !== 'cloudinary') {
    try {
      const b2 = getB2Client();
      if (b2) {
        const objectKey = generateObjectKey(conversationId, mediaType, cleanMime);
        const command = new PutObjectCommand({
          Bucket: b2.bucket,
          Key: objectKey,
          ContentType: cleanMime,
        });

        // Explicitly sign content-type & host in X-Amz-SignedHeaders to ensure B2 SigV4 canonical header verification succeeds!
        const uploadUrl = await getSignedUrl(b2.client, command, {
          expiresIn: 900,
          signableHeaders: new Set(['content-type', 'host']),
        });

        return {
          provider: 'b2',
          uploadUrl,
          objectKey,
          uploadMethod: 'PUT',
          headers: { 'Content-Type': cleanMime },
          expiresInSeconds: 900,
        };
      }
    } catch (err) {
      console.warn('[Storage Router] B2 presigned PUT generation failed, attempting Cloudinary fallback:', err);
    }
  }

  // Fallback Choice: Cloudinary Authenticated Private Delivery Model
  if (config.cloudinaryConfigured) {
    try {
      return createCloudinaryUploadTarget(conversationId, mediaType, cleanMime);
    } catch (err) {
      console.error('[Storage Router] Cloudinary upload target creation failed:', err);
    }
  }

  throw new Error('No storage provider is currently configured or available.');
}

// Server-side verification of uploaded object before DB finalization
export async function verifyUploadedObject(
  provider: StorageProviderType,
  objectKey: string,
  mediaType: MediaType,
  mimeType: string
): Promise<ObjectVerificationResult> {
  const cleanMime = normalizeMimeType(mimeType);

  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) return { exists: false, error: 'B2 storage provider not configured' };

    try {
      const headCmd = new HeadObjectCommand({ Bucket: b2.bucket, Key: objectKey });
      const res = await b2.client.send(headCmd);
      return {
        exists: true,
        contentLengthBytes: res.ContentLength,
        contentType: res.ContentType,
      };
    } catch (err: any) {
      return { exists: false, error: err.message || 'Object HEAD request failed on B2' };
    }
  }

  if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) return { exists: false, error: 'R2 storage provider not configured' };

    try {
      const headCmd = new HeadObjectCommand({ Bucket: r2.bucket, Key: objectKey });
      const res = await r2.client.send(headCmd);
      return {
        exists: true,
        contentLengthBytes: res.ContentLength,
        contentType: res.ContentType,
      };
    } catch (err: any) {
      return { exists: false, error: err.message || 'Object HEAD request failed on R2' };
    }
  }

  if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return { exists: false, error: 'Cloudinary storage provider not configured' };
    }

    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
      });

      const resourceType = getCloudinaryResourceType(mediaType, cleanMime);
      const res = await cloudinary.api.resource(objectKey, {
        resource_type: resourceType,
        type: 'authenticated'
      });

      return {
        exists: true,
        contentLengthBytes: res.bytes,
        resourceType: res.resource_type,
        format: res.format,
      };
    } catch (err: any) {
      return { exists: false, error: err.message || 'Object verification failed on Cloudinary' };
    }
  }

  return { exists: false, error: `Unknown storage provider '${provider}'` };
}

// Server-side generation of short-lived signed access URL for private media delivery
export async function createDownloadAccessUrl(
  provider: StorageProviderType,
  objectKey: string,
  expiresInSeconds: number = 900, // 15 minutes default
  mediaType: MediaType = 'image',
  mimeType: string = 'image/jpeg'
): Promise<{ accessUrl: string; expiresInSeconds: number }> {
  const cleanMime = normalizeMimeType(mimeType);
  let accessUrl = '';

  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) throw new Error('B2 storage provider not configured');

    const command = new GetObjectCommand({ Bucket: b2.bucket, Key: objectKey });
    accessUrl = await getSignedUrl(b2.client, command, { expiresIn: expiresInSeconds });
  } else if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) throw new Error('R2 storage provider not configured');

    const command = new GetObjectCommand({ Bucket: r2.bucket, Key: objectKey });
    accessUrl = await getSignedUrl(r2.client, command, { expiresIn: expiresInSeconds });
  } else if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary storage provider not configured');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    const resourceType = getCloudinaryResourceType(mediaType, cleanMime);
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    accessUrl = cloudinary.url(objectKey, {
      resource_type: resourceType,
      type: 'authenticated',
      sign_url: true,
      expires_at: expiresAt,
      secure: true
    });
  } else {
    throw new Error(`Unsupported storage provider '${provider}'`);
  }

  return { accessUrl, expiresInSeconds };
}

// Server-side deletion of object (used by media cleanup worker / deletion flows)
export async function deleteStorageObject(
  provider: StorageProviderType,
  objectKey: string,
  mediaType: MediaType = 'image',
  mimeType: string = 'image/jpeg'
): Promise<boolean> {
  const cleanMime = normalizeMimeType(mimeType);

  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) return false;
    try {
      const delCmd = new DeleteObjectCommand({ Bucket: b2.bucket, Key: objectKey });
      await b2.client.send(delCmd);
      return true;
    } catch (err) {
      console.error(`Failed to delete object ${objectKey} from B2:`, err);
      return false;
    }
  }

  if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) return false;
    try {
      const delCmd = new DeleteObjectCommand({ Bucket: r2.bucket, Key: objectKey });
      await r2.client.send(delCmd);
      return true;
    } catch (err) {
      console.error(`Failed to delete object ${objectKey} from R2:`, err);
      return false;
    }
  }

  if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) return false;

    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true
      });

      const resourceType = getCloudinaryResourceType(mediaType, cleanMime);
      const res = await cloudinary.uploader.destroy(objectKey, {
        resource_type: resourceType,
        type: 'authenticated',
        invalidate: true
      });

      return res.result === 'ok' || res.result === 'not found';
    } catch (err) {
      console.error(`Failed to delete object ${objectKey} from Cloudinary:`, err);
      return false;
    }
  }

  return false;
}
