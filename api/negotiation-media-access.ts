import { verifyUserAuth, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createDownloadAccessUrl, StorageProviderType } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
