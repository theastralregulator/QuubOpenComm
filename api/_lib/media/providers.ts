import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

export type StorageProviderType = 'r2' | 'b2' | 'cloudinary';
export type MediaType = 'image' | 'video' | 'audio';

export interface UploadTargetResult {
  provider: StorageProviderType;
  uploadUrl: string;
  objectKey: string;
  uploadMethod?: 'PUT' | 'POST';
  headers?: Record<string, string>;
  formDataParams?: Record<string, string>;
  expiresInSeconds: number;
}

export interface StorageProviderConfig {
  b2Configured: boolean;
  cloudinaryConfigured: boolean;
  r2Configured: boolean;
  activePrimaryProvider: StorageProviderType | null;
}

export interface ObjectVerificationResult {
  exists: boolean;
  contentLengthBytes?: number;
  contentType?: string;
  error?: string;
}

// 1. Check server environment variables configuration
export function checkStorageProvidersConfig(): StorageProviderConfig {
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
    process.env.R2_BUCKET_NAME &&
    (process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT)
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

// Helper: Get S3 Client for Backblaze B2
function getB2Client(): { client: S3Client; bucket: string } | null {
  const keyId = process.env.B2_KEY_ID;
  const applicationKey = process.env.B2_APPLICATION_KEY;
  const bucket = process.env.B2_BUCKET_NAME;
  const endpoint = process.env.B2_ENDPOINT;
  const region = process.env.B2_REGION || 'us-west-004';

  if (!keyId || !applicationKey || !bucket || !endpoint) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
  });

  return { client, bucket };
}

// Helper: Get S3 Client for Cloudflare R2 (Legacy historical read/cleanup only)
function getR2Client(): { client: S3Client; bucket: string } | null {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

// Cloudinary signature helper
function generateCloudinarySignature(params: Record<string, string | number>, apiSecret: string): string {
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + apiSecret;
  return crypto.createHash('sha1').update(toSign).digest('hex');
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

// Create Upload Target (PRIMARY = B2, FALLBACK = Cloudinary)
export async function createUploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string,
  fileSizeBytes: number
): Promise<UploadTargetResult> {
  const config = checkStorageProvidersConfig();

  // Primary Choice: Backblaze B2
  if (config.b2Configured) {
    try {
      const b2 = getB2Client();
      if (b2) {
        const objectKey = generateObjectKey(conversationId, mediaType, mimeType);
        const command = new PutObjectCommand({
          Bucket: b2.bucket,
          Key: objectKey,
          ContentType: mimeType,
          ContentLength: fileSizeBytes,
        });

        const uploadUrl = await getSignedUrl(b2.client, command, { expiresIn: 900 }); // 15 min
        return {
          provider: 'b2',
          uploadUrl,
          objectKey,
          uploadMethod: 'PUT',
          headers: { 'Content-Type': mimeType },
          expiresInSeconds: 900,
        };
      }
    } catch (err) {
      console.warn('[Storage Router] B2 presigned PUT generation failed, attempting Cloudinary fallback:', err);
    }
  }

  // Fallback Choice: Cloudinary
  if (config.cloudinaryConfigured) {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
      const apiKey = process.env.CLOUDINARY_API_KEY!;
      const apiSecret = process.env.CLOUDINARY_API_SECRET!;
      const folder = 'opencomm-chat-media';
      const timestamp = Math.floor(Date.now() / 1000);
      const rawObjectKey = generateObjectKey(conversationId, mediaType, mimeType);
      const publicId = rawObjectKey.replace(/[^a-zA-Z0-9_\-\/]/g, '_');

      const paramsToSign = {
        folder,
        public_id: publicId,
        timestamp
      };

      const signature = generateCloudinarySignature(paramsToSign, apiSecret);
      const resourceType = mediaType === 'image' ? 'image' : 'video'; // Cloudinary handles audio under video resource type
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
          public_id: publicId
        },
        expiresInSeconds: 900,
      };
    } catch (err) {
      console.error('[Storage Router] Cloudinary upload authorization failed:', err);
    }
  }

  throw new Error('No media storage provider (B2 or Cloudinary) is currently configured or available.');
}

// Verify Uploaded Object Exists (HEAD request)
export async function verifyUploadedObject(
  provider: StorageProviderType,
  objectKey: string
): Promise<ObjectVerificationResult> {
  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) return { exists: false, error: 'B2 provider not configured' };
    try {
      const command = new HeadObjectCommand({ Bucket: b2.bucket, Key: objectKey });
      const res = await b2.client.send(command);
      return {
        exists: true,
        contentLengthBytes: res.ContentLength,
        contentType: res.ContentType
      };
    } catch (err: any) {
      console.warn(`[Storage HEAD] B2 object verification failed for ${objectKey}:`, err);
      return { exists: false, error: err.message || 'Object HEAD request failed' };
    }
  }

  if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return { exists: false, error: 'Cloudinary provider not configured' };
    }

    try {
      // Admin API resource check
      const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const resourceType = objectKey.includes('/video/') || objectKey.endsWith('.webm') || objectKey.endsWith('.mp4') || objectKey.endsWith('.ogg') ? 'video' : 'image';
      const checkUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?public_ids=${encodeURIComponent(objectKey)}`;

      const res = await fetch(checkUrl, {
        headers: { Authorization: authHeader }
      });

      if (res.ok) {
        const data = await res.json();
        const resource = data.resources && data.resources[0];
        if (resource) {
          return {
            exists: true,
            contentLengthBytes: resource.bytes,
            contentType: resource.format ? `${resourceType}/${resource.format}` : undefined
          };
        }
      }
      return { exists: false, error: 'Cloudinary asset verification returned no matching resource' };
    } catch (err: any) {
      console.warn(`[Storage HEAD] Cloudinary object verification failed for ${objectKey}:`, err);
      return { exists: false, error: err.message || 'Cloudinary HEAD check failed' };
    }
  }

  // Legacy R2 Support
  if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) return { exists: false, error: 'R2 provider not configured' };
    try {
      const command = new HeadObjectCommand({ Bucket: r2.bucket, Key: objectKey });
      const res = await r2.client.send(command);
      return {
        exists: true,
        contentLengthBytes: res.ContentLength,
        contentType: res.ContentType
      };
    } catch (err: any) {
      return { exists: false, error: err.message || 'Object HEAD request failed' };
    }
  }

  return { exists: false, error: `Unsupported provider for verification: ${provider}` };
}

// Create Download Access URL (Presigned GET URL or Signed Cloudinary URL)
export async function createDownloadAccessUrl(
  provider: StorageProviderType,
  objectKey: string,
  expiresInSeconds: number = 900
): Promise<{ accessUrl: string; expiresInSeconds: number }> {
  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) throw new Error('Backblaze B2 is unconfigured.');
    const command = new GetObjectCommand({ Bucket: b2.bucket, Key: objectKey });
    const accessUrl = await getSignedUrl(b2.client, command, { expiresIn: expiresInSeconds });
    return { accessUrl, expiresInSeconds };
  }

  if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiSecret) throw new Error('Cloudinary is unconfigured.');

    const resourceType = objectKey.includes('/video/') || objectKey.endsWith('.webm') || objectKey.endsWith('.mp4') || objectKey.endsWith('.ogg') ? 'video' : 'image';
    const timestamp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = generateCloudinarySignature({ public_id: objectKey, timestamp }, apiSecret);
    const accessUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${signature}--/v${timestamp}/${objectKey}`;
    return { accessUrl, expiresInSeconds };
  }

  // Legacy R2 Support
  if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) throw new Error('Cloudflare R2 is unconfigured.');
    const command = new GetObjectCommand({ Bucket: r2.bucket, Key: objectKey });
    const accessUrl = await getSignedUrl(r2.client, command, { expiresIn: expiresInSeconds });
    return { accessUrl, expiresInSeconds };
  }

  throw new Error(`Unsupported storage provider: ${provider}`);
}

// Delete Object from Storage Provider
export async function deleteStorageObject(
  provider: StorageProviderType,
  objectKey: string
): Promise<boolean> {
  if (provider === 'b2') {
    const b2 = getB2Client();
    if (!b2) return false;
    try {
      const command = new DeleteObjectCommand({ Bucket: b2.bucket, Key: objectKey });
      await b2.client.send(command);
      return true;
    } catch (err) {
      console.error(`[Storage Delete] B2 delete error for key ${objectKey}:`, err);
      return false;
    }
  }

  if (provider === 'cloudinary') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return false;

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateCloudinarySignature({ public_id: objectKey, timestamp }, apiSecret);
      const resourceType = objectKey.includes('/video/') || objectKey.endsWith('.webm') || objectKey.endsWith('.mp4') || objectKey.endsWith('.ogg') ? 'video' : 'image';
      const destroyUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;

      const body = new URLSearchParams({
        public_id: objectKey,
        timestamp: String(timestamp),
        api_key: apiKey,
        signature
      });

      const res = await fetch(destroyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      return res.ok;
    } catch (err) {
      console.error(`[Storage Delete] Cloudinary delete error for key ${objectKey}:`, err);
      return false;
    }
  }

  // Legacy R2 Support
  if (provider === 'r2') {
    const r2 = getR2Client();
    if (!r2) return false;
    try {
      const command = new DeleteObjectCommand({ Bucket: r2.bucket, Key: objectKey });
      await r2.client.send(command);
      return true;
    } catch (err) {
      console.error(`[Storage Delete] R2 delete error for key ${objectKey}:`, err);
      return false;
    }
  }

  return false;
}
