import { verifyUserAuth, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createUploadTarget, MediaType } from './_lib/media/providers.js';
import { validateMediaRequest, normalizeMimeType } from './_lib/media/validation.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Feature Gate Check
  const v2Enabled = process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() === 'true';
  if (!v2Enabled) {
    return res.status(400).json({ error: 'Negotiation media uploads are currently disabled.' });
  }

  // 2. Authentication
  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { roomId, mediaType, mimeType, fileSizeBytes, durationMs, replyToMessageId } = req.body || {};

  if (!roomId || !mediaType || !mimeType || !fileSizeBytes) {
    return res.status(400).json({ error: 'Missing required upload parameters' });
  }

  const cleanMimeType = normalizeMimeType(mimeType);

  // 3. Room & Active Authorization Check
  const check = await verifyNegotiationRoomParticipant(authUser.userId, roomId);
  if (!check.allowed) {
    return res.status(403).json({ error: check.errorMsg || 'Forbidden' });
  }
  if (check.locked) {
    return res.status(400).json({ error: 'Cannot send media to a locked negotiation room.' });
  }

  // 4. Request Validation
  const validation = validateMediaRequest(mediaType as MediaType, cleanMimeType, Number(fileSizeBytes), durationMs ? Number(durationMs) : undefined);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server database configuration unavailable' });
  }

  // Active account check
  const { data: profile } = await adminClient
    .from('profiles')
    .select('account_status')
    .eq('id', authUser.userId)
    .maybeSingle();

  if (!profile || profile.account_status !== 'active') {
    return res.status(403).json({ error: 'Account is deactivated or non-active.' });
  }

  // 5. Reply Target Pre-Validation (Before creating intent/upload target)
  if (replyToMessageId) {
    const { data: replyTarget, error: replyErr } = await adminClient
      .from('negotiation_messages')
      .select('id, negotiation_room_id, deleted_at, message_type')
      .eq('id', replyToMessageId)
      .maybeSingle();

    if (replyErr || !replyTarget) {
      return res.status(400).json({ error: 'Reply target negotiation message does not exist.' });
    }
    if (replyTarget.negotiation_room_id !== roomId) {
      return res.status(400).json({ error: 'Reply target message belongs to a different negotiation room.' });
    }
    if (replyTarget.deleted_at) {
      return res.status(400).json({ error: 'Cannot reply to a deleted negotiation message.' });
    }
    if (['system', 'proposal_event', 'status_event'].includes(replyTarget.message_type)) {
      return res.status(400).json({ error: 'Cannot reply to a system or workflow event message.' });
    }
  }

  try {
    const target = await createUploadTarget(
      roomId,
      mediaType as MediaType,
      cleanMimeType,
      Number(fileSizeBytes)
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
      return res.status(500).json({ error: insertErr?.message || 'Failed to save negotiation upload intent' });
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
    return res.status(500).json({ error: err.message || 'Failed to initialize negotiation upload target' });
  }
}
