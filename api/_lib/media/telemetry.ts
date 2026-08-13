import { getServiceRoleSupabase } from './auth.js';

export type TelemetryOperation = 'upload_intent' | 'upload_finalize' | 'access' | 'delete' | 'health';
export type TelemetryEventType = 'success' | 'failure' | 'rate_limited' | 'unauthorized' | 'timeout';

export interface TelemetryParams {
  provider: 'r2' | 'b2' | 'cloudinary';
  operation: TelemetryOperation;
  eventType: TelemetryEventType;
  httpStatus?: number;
  latencyMs?: number;
  mediaType?: 'image' | 'video' | 'audio';
  sizeBucket?: string;
}

export function getSizeBucket(bytes?: number): string | undefined {
  if (bytes === undefined || bytes === null) return undefined;
  if (bytes < 100 * 1024) return '<100KB';
  if (bytes < 1 * 1024 * 1024) return '100KB-1MB';
  if (bytes < 10 * 1024 * 1024) return '1MB-10MB';
  return '>10MB';
}

export async function recordStorageEvent(params: TelemetryParams): Promise<void> {
  const adminClient = getServiceRoleSupabase();
  if (!adminClient) return;

  try {
    await adminClient.from('media_storage_events').insert({
      provider: params.provider,
      operation: params.operation,
      event_type: params.eventType,
      http_status: params.httpStatus || null,
      latency_ms: params.latencyMs || null,
      media_type: params.mediaType || null,
      size_bucket: params.sizeBucket || null,
    });
  } catch (err) {
    console.error('Failed to log media_storage_event:', err);
  }
}
