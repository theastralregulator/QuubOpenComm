import { verifyUserAuth, getServiceRoleSupabase, verifyNegotiationRoomParticipant } from './_lib/media/auth.js';
import { verifyUploadedObject, StorageProviderType } from './_lib/media/providers.js';
import { normalizeMimeType } from './_lib/media/validation.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const {
    intentId,
    roomId,
    durationMs,
    width,
    height,
    originalFilename
  } = req.body || {};

  if (!intentId || typeof intentId !== 'string' || !roomId) {
    return res.status(400).json({ error: 'Missing mandatory intentId or roomId parameter' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  const check = await verifyNegotiationRoomParticipant(authUser.userId, roomId);
  if (!check.allowed || check.locked) {
    return res.status(403).json({ error: 'Not authorized for this negotiation room' });
  }

  // Fetch intent record
  const { data: intent, error: intentErr } = await adminClient
    .from('negotiation_media_upload_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();

  if (intentErr || !intent) {
    return res.status(404).json({ error: 'Upload intent not found' });
  }

  if (intent.user_id !== authUser.userId || intent.negotiation_room_id !== roomId) {
    return res.status(403).json({ error: 'Intent authorization mismatch' });
  }

  if (intent.status === 'finalized' && intent.final_message_id) {
    return res.status(200).json({
      success: true,
      messageId: intent.final_message_id,
      idempotent: true
    });
  }

  const provider = intent.provider as StorageProviderType;
  const objectKey = intent.object_key;
  const mediaType = intent.media_type;
  const cleanMimeType = normalizeMimeType(intent.mime_type);

  const verification = await verifyUploadedObject(provider, objectKey, mediaType, cleanMimeType);
  if (!verification.exists) {
    return res.status(400).json({ error: 'Uploaded file not found in storage bucket' });
  }

  const metadata: Record<string, any> = {
    provider,
    object_key: objectKey,
    mime_type: cleanMimeType,
    file_size_bytes: intent.file_size_bytes,
    original_filename: originalFilename || undefined,
    duration_ms: durationMs || undefined,
    width: width || undefined,
    height: height || undefined
  };

  // Insert message into negotiation_messages
  const { data: msg, error: msgErr } = await adminClient
    .from('negotiation_messages')
    .insert({
      negotiation_room_id: roomId,
      sender_id: authUser.userId,
      message_type: mediaType,
      text: mediaType === 'image' ? 'Sent a photo' : mediaType === 'video' ? 'Sent a video' : mediaType === 'audio' ? 'Sent a voice note' : 'Sent a document',
      media_type: mediaType,
      media_path: objectKey,
      media_metadata: metadata,
      reply_to_message_id: intent.reply_to_message_id || null,
      unread: true
    })
    .select('id')
    .single();

  if (msgErr || !msg) {
    return res.status(500).json({ error: msgErr?.message || 'Failed to create negotiation media message' });
  }

  // Update intent status to finalized
  await adminClient
    .from('negotiation_media_upload_intents')
    .update({ status: 'finalized', final_message_id: msg.id })
    .eq('id', intentId);

  return res.status(200).json({
    success: true,
    messageId: msg.id
  });
}
