import { verifyUserAuth, verifyConversationParticipant, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createDownloadAccessUrl, StorageProviderType } from './_lib/media/providers.js';
import { recordStorageEvent } from './_lib/media/telemetry.js';

// Consolidated serverless function for media download/access authorization:
// - /api/media-access (Permanent Chat)
// - /api/negotiation-media-access (Negotiation Chat V2)
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = req.url || '';
  const matchedPath = (req.headers['x-matched-path'] as string) || '';
  const fullPath = (url + ' ' + matchedPath).toLowerCase();
  const isNegotiation = fullPath.includes('negotiation') || req.body?.scope === 'negotiation' || req.body?.isNegotiation === true;

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { mediaId, messageId, mode: rawMode } = req.body || {};
  const mode: 'view' | 'download' = rawMode === 'download' ? 'download' : 'view';

  if (!mediaId && !messageId) {
    return res.status(400).json({ error: 'Missing mediaId or messageId' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  if (isNegotiation) {
    // ==================================================
    // NEGOTIATION CHAT V2 MEDIA ACCESS
    // ==================================================
    try {
      let query = adminClient
        .from('negotiation_messages')
        .select('id, negotiation_room_id, media_type, media_path, media_url, media_metadata, deleted_at');

      if (messageId) {
        query = query.eq('id', messageId);
      } else {
        query = query.eq('id', mediaId);
      }

      const { data: msg, error } = await query.maybeSingle();

      if (error || !msg || !msg.media_type) {
        return res.status(404).json({ error: 'Negotiation media record not found' });
      }

      if (msg.deleted_at) {
        return res.status(410).json({ error: 'Media has been deleted', expired: true });
      }

      const check = await verifyNegotiationRoomParticipant(authUser.userId, msg.negotiation_room_id);
      if (!check.allowed) {
        return res.status(403).json({ error: 'Not authorized to access media for this negotiation room' });
      }

      const metadata = msg.media_metadata || {};
      const provider = (metadata.provider || 'b2') as StorageProviderType;
      const objectKey = msg.media_path || metadata.object_key || '';
      const mimeType = metadata.mime_type || 'application/octet-stream';
      const originalFilename = metadata.original_filename;

      if (!objectKey) {
        if (msg.media_url) {
          return res.status(200).json({
            mediaId: msg.id,
            messageId: msg.id,
            accessUrl: msg.media_url,
            expiresInSeconds: 3600,
            mediaType: msg.media_type,
            mimeType,
            fileSizeBytes: metadata.file_size_bytes || 0,
            durationMs: metadata.duration_ms,
            width: metadata.width,
            height: metadata.height
          });
        }
        return res.status(404).json({ error: 'Media object key missing' });
      }

      const access = await createDownloadAccessUrl(
        provider,
        objectKey,
        900,
        msg.media_type,
        mimeType,
        mode,
        originalFilename
      );

      return res.status(200).json({
        mediaId: msg.id,
        messageId: msg.id,
        accessUrl: access.accessUrl,
        expiresInSeconds: access.expiresInSeconds,
        mediaType: msg.media_type,
        mimeType,
        fileSizeBytes: metadata.file_size_bytes || 0,
        durationMs: metadata.duration_ms,
        width: metadata.width,
        height: metadata.height
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error generating negotiation media access URL' });
    }
  } else {
    // ==================================================
    // PERMANENT CHAT MEDIA ACCESS
    // ==================================================
    let resolvedProvider: StorageProviderType | null = null;
    let resolvedMediaType: any = undefined;

    try {
      let query = adminClient
        .from('message_media')
        .select('id, message_id, conversation_id, storage_provider, object_key, media_type, mime_type, file_size_bytes, status, delete_after, duration_ms, width, height, original_filename');

      if (mediaId) {
        query = query.eq('id', mediaId);
      } else {
        query = query.eq('message_id', messageId);
      }

      const { data: media, error } = await query.maybeSingle();

      if (error || !media) {
        return res.status(404).json({ error: 'Media record not found' });
      }

      resolvedProvider = media.storage_provider as StorageProviderType;
      resolvedMediaType = media.media_type;

      const check = await verifyConversationParticipant(authUser.userId, media.conversation_id);
      if (!check.allowed) {
        return res.status(403).json({ error: 'Not authorized to access media for this conversation' });
      }

      if (media.status === 'deleted' || (media.delete_after && new Date(media.delete_after) <= new Date())) {
        return res.status(410).json({ error: 'Media has expired', expired: true });
      }

      const access = await createDownloadAccessUrl(
        media.storage_provider as StorageProviderType,
        media.object_key,
        900,
        media.media_type,
        media.mime_type,
        mode,
        media.original_filename
      );

      void recordStorageEvent({
        provider: media.storage_provider as StorageProviderType,
        operation: 'access',
        eventType: 'success',
        httpStatus: 200,
        latencyMs: Date.now() - startTime,
        mediaType: media.media_type
      });

      return res.status(200).json({
        mediaId: media.id,
        messageId: media.message_id,
        accessUrl: access.accessUrl,
        expiresInSeconds: access.expiresInSeconds,
        mediaType: media.media_type,
        mimeType: media.mime_type,
        fileSizeBytes: media.file_size_bytes,
        durationMs: media.duration_ms,
        width: media.width,
        height: media.height
      });

    } catch (err: any) {
      console.error('Error generating media access URL:', err);
      if (resolvedProvider) {
        void recordStorageEvent({
          provider: resolvedProvider,
          operation: 'access',
          eventType: 'failure',
          httpStatus: 500,
          latencyMs: Date.now() - startTime,
          mediaType: resolvedMediaType
        });
      }
      return res.status(500).json({ error: err.message || 'Failed to generate access URL' });
    }
  }
}
