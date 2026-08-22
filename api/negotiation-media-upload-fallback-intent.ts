import { verifyUserAuth, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createFallbackUploadTarget, MediaType } from './_lib/media/providers.js';
import { validateMediaRequest, normalizeMimeType } from './_lib/media/validation.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { roomId, mediaType, mimeType, fileSizeBytes, durationMs, replyToMessageId } = req.body || {};

  if (!roomId || !mediaType || !mimeType || !fileSizeBytes) {
    return res.status(400).json({ error: 'Missing required upload parameters' });
  }

  const cleanMimeType = normalizeMimeType(mimeType);
  const v2Enabled = process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() === 'true';
  if (!v2Enabled) {
    return res.status(400).json({ error: 'Negotiation media uploads are currently disabled.' });
  }

  const check = await verifyNegotiationRoomParticipant(authUser.userId, roomId);
  if (!check.allowed || check.locked) {
    return res.status(403).json({ error: 'Not authorized for this negotiation room' });
  }

  const validation = validateMediaRequest(mediaType as MediaType, cleanMimeType, Number(fileSizeBytes), durationMs ? Number(durationMs) : undefined);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server database configuration unavailable' });
  }

  try {
    const target = await createFallbackUploadTarget(
      roomId,
      mediaType as MediaType,
      cleanMimeType,
      Number(fileSizeBytes),
      'b2'
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const insertPayload: Record<string, any> = {
      user_id: authUser.userId,
      negotiation_room_id: roomId,
      provider: target.provider,
      object_key: target.objectKey,
      media_type: mediaType,
      mime_type: cleanMimeType,
      file_size_bytes: Number(fileSizeBytes),
      status: 'pending',
      expires_at: expiresAt
    };

    if (replyToMessageId) {
      insertPayload.reply_to_message_id = replyToMessageId;
    }

    const { data: intent, error: insertErr } = await adminClient
      .from('negotiation_media_upload_intents')
      .insert(insertPayload)
      .select('id, expires_at')
      .single();

    if (insertErr || !intent) {
      return res.status(500).json({ error: insertErr?.message || 'Failed to save fallback negotiation upload intent' });
    }

    return res.status(200).json({
      intentId: intent.id,
      provider: target.provider,
      uploadUrl: target.uploadUrl,
      formData: target.formDataParams,
      objectKey: target.objectKey,
      expiresAt: intent.expires_at
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to initialize fallback negotiation upload target' });
  }
}
