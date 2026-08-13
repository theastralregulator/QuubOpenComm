import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createDownloadAccessUrl, StorageProviderType } from './_lib/media/providers.js';
import { recordStorageEvent } from './_lib/media/telemetry.js';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { mediaId, messageId } = req.body || {};
  if (!mediaId && !messageId) {
    return res.status(400).json({ error: 'Missing mediaId or messageId' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  try {
    // 1. Fetch message_media record
    let query = adminClient
      .from('message_media')
      .select('id, message_id, conversation_id, storage_provider, object_key, media_type, mime_type, file_size_bytes, status, delete_after, duration_ms, width, height');

    if (mediaId) {
      query = query.eq('id', mediaId);
    } else {
      query = query.eq('message_id', messageId);
    }

    const { data: media, error } = await query.maybeSingle();

    if (error || !media) {
      return res.status(404).json({ error: 'Media record not found' });
    }

    // 2. Verify caller is conversation participant (supports creator_id, member_id, conversation_members)
    const check = await verifyConversationParticipant(authUser.userId, media.conversation_id);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Not authorized to access media for this conversation' });
    }

    // 3. Requirement 24: Check delete_after expiration (do not generate signed URL if delete_after <= now())
    if (media.status === 'deleted' || (media.delete_after && new Date(media.delete_after) <= new Date())) {
      return res.status(410).json({ error: 'Media has expired', expired: true });
    }

    // 4. Generate short-lived presigned GET URL (15 minutes = 900 seconds)
    const access = await createDownloadAccessUrl(
      media.storage_provider as StorageProviderType,
      media.object_key,
      900,
      media.media_type,
      media.mime_type
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
    void recordStorageEvent({
      provider: 'r2',
      operation: 'access',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime
    });
    return res.status(500).json({ error: err.message || 'Failed to generate access URL' });
  }
}
