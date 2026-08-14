import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetBucketCorsCommand, PutBucketCorsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import { normalizeMimeType } from './validation.js';
import { getServiceRoleSupabase } from './auth.js';

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

export interface PrimaryProviderSetting {
  provider: StorageProviderType;
  auto_fallback: boolean;
}

export type B2CorsStatusCode = 'ready' | 'permission_missing' | 'rule_missing' | 'provider_error' | 'unconfigured';

export interface StorageProviderConfigStatus {
  b2Configured: boolean;
  b2CorsStatus: B2CorsStatusCode;
  b2CorsReady: boolean;
  b2Diagnostic?: any;
  cloudinaryConfigured: boolean;
  r2Configured: boolean;
  selectedPrimaryProvider: StorageProviderType;
  activePrimaryProvider: StorageProviderType | null;
  fallbackProvider: StorageProviderType | null;
  autoFallbackEnabled: boolean;
  failoverActive: boolean;
}

export interface B2CorsStatus {
  ready: boolean;
  status: B2CorsStatusCode;
  permissionMissing?: boolean;
  ruleMissing?: boolean;
  error?: string;
  diagnostic?: any;
}

let cachedB2CorsStatus: { status: B2CorsStatus; checkedAt: number } | null = null;

// Read site_settings table for media.primary_provider configuration
export async function getPrimaryProviderSetting(): Promise<PrimaryProviderSetting> {
  const adminClient = getServiceRoleSupabase();
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from('site_settings')
        .select('value')
        .eq('key', 'media.primary_provider')
        .maybeSingle();

      if (data && data.value && typeof data.value === 'object') {
        const prov = data.value.provider === 'cloudinary' ? 'cloudinary' : 'b2';
        const auto_fallback = data.value.auto_fallback !== false;
        return { provider: prov, auto_fallback };
      }
    } catch (err) {
      console.warn('Error reading media.primary_provider setting:', err);
    }
  }
  return { provider: 'b2', auto_fallback: true };
}

// Get trusted origins list from server configuration ONLY
export function getTrustedOriginsList(): string[] {
  const trustedOrigins = new Set<string>([
    'https://opencomm.online'
  ]);

  if (process.env.NODE_ENV !== 'production') {
    trustedOrigins.add('http://localhost:5173');
    trustedOrigins.add('http://localhost:3000');
  }

  if (process.env.APP_ORIGIN) trustedOrigins.add(process.env.APP_ORIGIN.trim().replace(/\/+$/, ''));
  if (process.env.PUBLIC_APP_URL) trustedOrigins.add(process.env.PUBLIC_APP_URL.trim().replace(/\/+$/, ''));
  if (process.env.MEDIA_ALLOWED_ORIGINS) {
    process.env.MEDIA_ALLOWED_ORIGINS.split(',').forEach(o => trustedOrigins.add(o.trim().replace(/\/+$/, '')));
  }
  if (process.env.B2_CORS_ALLOWED_ORIGINS) {
    process.env.B2_CORS_ALLOWED_ORIGINS.split(',').forEach(o => trustedOrigins.add(o.trim().replace(/\/+$/, '')));
  }

  return Array.from(trustedOrigins).filter(o => /^https?:\/\/[a-z0-9.-]+(:[0-9]+)?$/i.test(o));
}

// Read-only check for Backblaze B2 CORS configuration (NEVER mutates bucket configuration on public API calls!)
export async function checkB2CorsStatus(forceRefresh = false): Promise<B2CorsStatus> {
  const now = Date.now();
  if (!forceRefresh && cachedB2CorsStatus && (now - cachedB2CorsStatus.checkedAt < 5 * 60 * 1000)) {
    return cachedB2CorsStatus.status;
  }

  const b2 = getB2Client();
  if (!b2) {
    const status: B2CorsStatus = { ready: false, status: 'unconfigured', error: 'B2 storage client not configured' };
    cachedB2CorsStatus = { status, checkedAt: now };
    return status;
  }

  const trustedOrigins = getTrustedOriginsList();

  // 1. Safe Read-Only Diagnostics: HeadBucketCommand to verify credentials, bucket existence, region & endpoint
  let headBucketSuccess = false;
  let headBucketHttpStatus = 0;
  let headBucketErrorName = '';
  let headBucketErrorMessage = '';

  try {
    const headRes = await b2.client.send(new HeadBucketCommand({ Bucket: b2.bucket }));
    headBucketSuccess = true;
    headBucketHttpStatus = headRes.$metadata?.httpStatusCode || 200;
  } catch (headErr: any) {
    headBucketSuccess = false;
    headBucketHttpStatus = headErr.$metadata?.httpStatusCode || 0;
    headBucketErrorName = headErr.name || headErr.code || 'UnknownHeadBucketError';
    headBucketErrorMessage = headErr.message || '';
  }

  // 2. Safe Read-Only Diagnostics: GetBucketCorsCommand
  try {
    const corsRes = await b2.client.send(new GetBucketCorsCommand({ Bucket: b2.bucket }));
    const existingRules = corsRes.CORSRules || [];

    const ruleId = 'OpenCommBrowserMedia';
    const targetRule = existingRules.find((r: any) => r.ID === ruleId);

    const serializedRules = existingRules.map((r: any) => ({
      id: r.ID || null,
      allowedOrigins: r.AllowedOrigins || [],
      allowedMethods: r.AllowedMethods || [],
      allowedHeaders: r.AllowedHeaders || [],
      exposeHeaders: r.ExposeHeaders || [],
      maxAgeSeconds: r.MaxAgeSeconds || null
    }));

    if (!targetRule) {
      const status: B2CorsStatus = {
        ready: false,
        status: 'rule_missing',
        ruleMissing: true,
        error: 'OpenCommBrowserMedia CORS rule is missing',
        diagnostic: {
          headBucketSuccess,
          headBucketHttpStatus,
          getBucketCorsHttpStatus: 200,
          existingRulesCount: existingRules.length,
          existingRules: serializedRules
        }
      };
      cachedB2CorsStatus = { status, checkedAt: now };
      return status;
    }

    const methods = targetRule.AllowedMethods || [];
    const hasRequiredMethods = ['GET', 'HEAD', 'PUT'].every(m => methods.includes(m));

    const origins = targetRule.AllowedOrigins || [];
    const coversOrigins = trustedOrigins.every(o => origins.includes(o) || origins.includes('*'));

    const headers = targetRule.AllowedHeaders || [];
    const hasHeaders = headers.includes('*') || headers.map((h: string) => h.toLowerCase()).includes('content-type');

    const exposeHeaders = (targetRule.ExposeHeaders || []).map((h: string) => h.toLowerCase());
    const hasExpose = ['etag', 'content-length', 'content-type'].every(h => exposeHeaders.includes(h) || exposeHeaders.includes('*'));

    const maxAge = targetRule.MaxAgeSeconds || 0;
    const isMaxAgeValid = maxAge >= 3600;

    if (hasRequiredMethods && coversOrigins && hasHeaders && hasExpose && isMaxAgeValid) {
      const status: B2CorsStatus = {
        ready: true,
        status: 'ready',
        diagnostic: {
          headBucketSuccess,
          headBucketHttpStatus,
          getBucketCorsHttpStatus: 200,
          existingRulesCount: existingRules.length,
          existingRules: serializedRules
        }
      };
      cachedB2CorsStatus = { status, checkedAt: now };
      return status;
    } else {
      const status: B2CorsStatus = {
        ready: false,
        status: 'rule_missing',
        ruleMissing: true,
        error: 'OpenCommBrowserMedia CORS rule is incomplete',
        diagnostic: {
          headBucketSuccess,
          headBucketHttpStatus,
          getBucketCorsHttpStatus: 200,
          existingRulesCount: existingRules.length,
          existingRules: serializedRules
        }
      };
      cachedB2CorsStatus = { status, checkedAt: now };
      return status;
    }

  } catch (getCorsErr: any) {
    const errName = getCorsErr.name || getCorsErr.code || '';
    const errCode = getCorsErr.Code || getCorsErr.code || '';
    const errMsg = getCorsErr.message || '';
    const httpStatus = getCorsErr.$metadata?.httpStatusCode || 0;

    if (errName === 'NoSuchCORSConfiguration' || errCode === 'NoSuchCORSConfiguration' || errMsg.toLowerCase().includes('no cors configuration')) {
      const status: B2CorsStatus = {
        ready: false,
        status: 'rule_missing',
        ruleMissing: true,
        error: 'No CORS configuration exists on bucket',
        diagnostic: {
          headBucketSuccess,
          headBucketHttpStatus,
          headBucketErrorName,
          headBucketErrorMessage,
          getCorsHttpStatus: httpStatus,
          getCorsErrorName: errName,
          getCorsErrorMessage: errMsg
        }
      };
      cachedB2CorsStatus = { status, checkedAt: now };
      return status;
    }

    if (errName === 'AccessDenied' || errCode === 'AccessDenied' || errMsg.toLowerCase().includes('unauthorized') || errMsg.toLowerCase().includes('access denied')) {
      const status: B2CorsStatus = {
        ready: false,
        status: 'permission_missing',
        permissionMissing: true,
        error: 'Application key lacks CORS read permissions',
        diagnostic: {
          headBucketSuccess,
          headBucketHttpStatus,
          headBucketErrorName,
          headBucketErrorMessage,
          getCorsHttpStatus: httpStatus,
          getCorsErrorName: errName,
          getCorsErrorMessage: errMsg
        }
      };
      cachedB2CorsStatus = { status, checkedAt: now };
      return status;
    }

    console.warn('[B2 CORS Check Provider Error]:', errMsg);
    const status: B2CorsStatus = {
      ready: false,
      status: 'provider_error',
      error: 'Provider API communication error during CORS check',
      diagnostic: {
        headBucketSuccess,
        headBucketHttpStatus,
        headBucketErrorName,
        headBucketErrorMessage,
        getCorsHttpStatus: httpStatus,
        getCorsErrorName: errName,
        getCorsErrorMessage: errMsg
      }
    };
    cachedB2CorsStatus = { status, checkedAt: now };
    return status;
  }
}

// Authenticated Admin action to repair/configure Backblaze B2 CORS configuration
export async function repairB2CorsConfiguration(): Promise<B2CorsStatus> {
  const b2 = getB2Client();
  if (!b2) {
    return { ready: false, status: 'unconfigured', error: 'B2 storage client not configured' };
  }

  const trustedOrigins = getTrustedOriginsList();

  try {
    let existingRules: any[] = [];
    try {
      const corsRes = await b2.client.send(new GetBucketCorsCommand({ Bucket: b2.bucket }));
      existingRules = corsRes.CORSRules || [];
    } catch (getCorsErr: any) {
      const errName = getCorsErr.name || '';
      const errMsg = getCorsErr.message || '';

      if (errName === 'AccessDenied' || errMsg.toLowerCase().includes('unauthorized')) {
        return { ready: false, status: 'permission_missing', permissionMissing: true, error: 'Application key lacks CORS write permissions' };
      }
      if (errName !== 'NoSuchCORSConfiguration' && !errMsg.toLowerCase().includes('no cors configuration')) {
        return { ready: false, status: 'provider_error', error: 'Cannot fetch existing CORS rules for repair' };
      }
    }

    const ruleId = 'OpenCommBrowserMedia';
    const targetRuleIndex = existingRules.findIndex((r: any) => r.ID === ruleId);

    const desiredRule = {
      ID: ruleId,
      AllowedOrigins: trustedOrigins,
      AllowedMethods: ['GET', 'HEAD', 'PUT'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
      MaxAgeSeconds: 3600
    };

    if (targetRuleIndex === -1) {
      existingRules.push(desiredRule);
    } else {
      existingRules[targetRuleIndex] = desiredRule;
    }

    await b2.client.send(new PutBucketCorsCommand({
      Bucket: b2.bucket,
      CORSConfiguration: { CORSRules: existingRules }
    }));

    cachedB2CorsStatus = null;
    return await checkB2CorsStatus(true);

  } catch (err: any) {
    console.error('[B2 CORS Repair Error]:', err);
    return { ready: false, status: 'provider_error', error: err.message };
  }
}

// Inspect active environment & site_settings configuration
export async function checkStorageProvidersConfig(): Promise<StorageProviderConfigStatus> {
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

  const setting = await getPrimaryProviderSetting();
  const selectedPrimaryProvider = setting.provider;
  const autoFallbackEnabled = setting.auto_fallback;

  // B2 is operational ONLY if configured AND CORS ready!
  const b2Cors = b2Configured ? await checkB2CorsStatus(true) : { ready: false, status: 'unconfigured' as const };
  const b2Operational = b2Configured && b2Cors.ready;

  let activePrimaryProvider: StorageProviderType | null = null;
  let fallbackProvider: StorageProviderType | null = null;
  let failoverActive = false;

  if (selectedPrimaryProvider === 'b2') {
    if (b2Operational) {
      activePrimaryProvider = 'b2';
      fallbackProvider = autoFallbackEnabled && cloudinaryConfigured ? 'cloudinary' : null;
    } else if (autoFallbackEnabled && cloudinaryConfigured) {
      activePrimaryProvider = 'cloudinary';
      fallbackProvider = null; // When Cloudinary is ALREADY actively servicing traffic in failover mode, there is NO further fallback provider!
      failoverActive = true;
    }
  } else if (selectedPrimaryProvider === 'cloudinary') {
    if (cloudinaryConfigured) {
      activePrimaryProvider = 'cloudinary';
      fallbackProvider = autoFallbackEnabled && b2Operational ? 'b2' : null;
    } else if (autoFallbackEnabled && b2Operational) {
      activePrimaryProvider = 'b2';
      fallbackProvider = null; // When B2 is ALREADY actively servicing traffic in failover mode, there is NO further fallback provider!
      failoverActive = true;
    }
  }

  return {
    b2Configured,
    b2CorsStatus: b2Cors.status,
    b2CorsReady: b2Cors.ready,
    b2Diagnostic: b2Cors.diagnostic,
    cloudinaryConfigured,
    r2Configured,
    selectedPrimaryProvider,
    activePrimaryProvider,
    fallbackProvider,
    autoFallbackEnabled,
    failoverActive
  };
}

// Derive region from B2 endpoint hostname if B2_REGION is absent or mismatching
export function deriveB2Region(endpoint: string): string {
  if (process.env.B2_REGION && process.env.B2_REGION.trim()) {
    return process.env.B2_REGION.trim();
  }
  try {
    const host = new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`).hostname;
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
    forcePathStyle: true,
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
  if (mediaType === 'video' || mediaType === 'audio') return 'video';
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
  const datePrefix = new Date().toISOString().substring(0, 7);
  const randomUuid = crypto.randomUUID();
  return `opencomm_media/${datePrefix}/${conversationId}/${Date.now()}_${randomUuid}.${ext}`;
}

// Helper to create B2 target
async function createB2UploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string
): Promise<UploadTargetResult> {
  const b2 = getB2Client();
  if (!b2) throw new Error('Backblaze B2 storage provider is not configured.');

  const objectKey = generateObjectKey(conversationId, mediaType, mimeType);
  const command = new PutObjectCommand({
    Bucket: b2.bucket,
    Key: objectKey,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(b2.client, command, {
    expiresIn: 900,
    signableHeaders: new Set(['content-type']),
  });

  return {
    provider: 'b2',
    uploadUrl,
    objectKey,
    uploadMethod: 'PUT',
    headers: { 'Content-Type': mimeType },
    expiresInSeconds: 900,
  };
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
  const cleanKeyWithoutExt = rawObjectKey.replace(/\.[^/.]+$/, '');
  const publicId = cleanKeyWithoutExt.replace(/[^a-zA-Z0-9_\-\/]/g, '_');
  const resourceType = getCloudinaryResourceType(mediaType, mimeType);
  const deliveryType = 'authenticated';

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

  const fullPublicId = `${folder}/${publicId}`;

  return {
    provider: 'cloudinary',
    uploadUrl,
    objectKey: fullPublicId,
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

// Create Upload Target (Dynamic Admin Provider Router - Client preferredProvider override NOT allowed)
export async function createUploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string,
  fileSizeBytes: number
): Promise<UploadTargetResult> {
  const cleanMime = normalizeMimeType(mimeType);
  const config = await checkStorageProvidersConfig();

  const providerToUse = config.activePrimaryProvider;

  if (providerToUse === 'b2') {
    return await createB2UploadTarget(conversationId, mediaType, cleanMime);
  } else if (providerToUse === 'cloudinary') {
    return createCloudinaryUploadTarget(conversationId, mediaType, cleanMime);
  }

  if (config.selectedPrimaryProvider === 'b2' && !config.b2CorsReady) {
    throw new Error('Primary storage provider Backblaze B2 is CORS degraded and fallback is disabled.');
  }

  throw new Error(`Primary storage provider '${config.selectedPrimaryProvider}' is currently unavailable and fallback is disabled or unconfigured.`);
}

// Controlled Server-Side Fallback Target Creation
export async function createFallbackUploadTarget(
  conversationId: string,
  mediaType: MediaType,
  mimeType: string,
  fileSizeBytes: number,
  originalProvider: StorageProviderType
): Promise<UploadTargetResult> {
  const cleanMime = normalizeMimeType(mimeType);
  const config = await checkStorageProvidersConfig();

  if (!config.autoFallbackEnabled) {
    throw new Error('Automatic media storage provider fallback is disabled by administrator policy.');
  }

  // Prevent failover-of-failover loops:
  if (config.failoverActive) {
    throw new Error('No operational fallback provider is currently available.');
  }

  // Strictly calculate the fallback provider based on original intent provider and site_settings policy
  let fallbackProvider: StorageProviderType | null = null;
  if (originalProvider === 'b2' && config.selectedPrimaryProvider === 'b2') {
    fallbackProvider = 'cloudinary';
  } else if (originalProvider === 'cloudinary' && config.selectedPrimaryProvider === 'cloudinary') {
    fallbackProvider = 'b2';
  }

  if (fallbackProvider === 'cloudinary') {
    if (!config.cloudinaryConfigured) {
      throw new Error('No operational fallback provider is currently available.');
    }
    return createCloudinaryUploadTarget(conversationId, mediaType, cleanMime);
  }

  if (fallbackProvider === 'b2') {
    if (!config.b2Configured || !config.b2CorsReady) {
      throw new Error('No operational fallback provider is currently available.');
    }
    return await createB2UploadTarget(conversationId, mediaType, cleanMime);
  }

  throw new Error('No operational fallback provider is currently available.');
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
  expiresInSeconds: number = 900,
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

// Server-side deletion of object
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
