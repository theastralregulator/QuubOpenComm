import { verifyUserAuth, getUserSupabase, getServiceRoleSupabase } from './_lib/media/auth';
import { verifyUploadedObject, StorageProviderType } from './_lib/media/providers';
import { recordStorageEvent, getSizeBucket } from './_lib/media/telemetry';

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const {
    intentId,
    conversationId,
    durationMs,
    width,
    height,
    originalFilename
  } = req.body || {};

  // Requirement 5: intentId and conversationId are MANDATORY
  if (!intentId || typeof intentId !== 'string' || !conversationId) {
    return res.status(400).json({ error: 'Missing mandatory intentId or conversationId parameter' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  // 1. Fetch canonical intent record from database
  const { data: intent, error: intentErr } = await adminClient
    .from('media_upload_intents')
    .select('id, user_id, conversation_id, provider, object_key, media_type, mime_type, file_size_bytes, status, expires_at, final_message_id, final_media_id')
    .eq('id', intentId)
    .maybeSingle();

  if (intentErr || !intent) {
    return res.status(404).json({ error: 'Upload intent record not found' });
  }

  // 2. Strict validation against canonical intent data
  if (intent.user_id !== authUser.userId) {
    return res.status(403).json({ error: 'Upload intent ownership mismatch' });
  }

  if (intent.conversation_id !== conversationId) {
    return res.status(400).json({ error: 'Conversation ID mismatch for this upload intent' });
  }

  if (intent.expires_at && new Date(intent.expires_at) <= new Date()) {
    return res.status(410).json({ error: 'Upload intent has expired. Please request a new upload.' });
  }

  // Requirement 7: Idempotent finalize check
  if (intent.status === 'finalized' && intent.final_message_id && intent.final_media_id) {
    return res.status(200).json({
      success: true,
      messageId: intent.final_message_id,
      mediaId: intent.final_media_id,
      idempotent: true
    });
  }

  if (intent.status !== 'pending' && intent.status !== 'uploaded') {
    return res.status(400).json({ error: `Invalid intent status '${intent.status}' for finalization.` });
  }

  // Requirement 6: Verify external object HEAD before creating DB records
  const verification = await verifyUploadedObject(intent.provider as StorageProviderType, intent.object_key);
  if (!verification.exists) {
    console.warn(`Object HEAD verification failed for key ${intent.object_key} on provider ${intent.provider}: ${verification.error}`);
    void recordStorageEvent({
      provider: intent.provider as StorageProviderType,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 404,
      latencyMs: Date.now() - startTime,
      mediaType: intent.media_type
    });
    return res.status(400).json({ error: 'Uploaded object was not found in storage bucket or upload failed.' });
  }

  // 3. Call user Supabase client with user's JWT token to execute create_media_message RPC
  const userClient = getUserSupabase(authUser.jwtToken);
  if (!userClient) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  try {
    const previewText = (
      intent.media_type === 'audio' ? 'Voice message' :
      intent.media_type === 'image' ? 'Photo' : 'Video'
    );

    const { data: rpcResult, error: rpcError } = await userClient.rpc('create_media_message', {
      p_conversation_id: conversationId,
      p_message_type: intent.media_type,
      p_preview_text: previewText,
      p_media_type: intent.media_type,
      p_storage_provider: intent.provider,
      p_object_key: intent.object_key,
      p_mime_type: intent.mime_type,
      p_file_size_bytes: intent.file_size_bytes,
      p_duration_ms: durationMs ? Number(durationMs) : null,
      p_width: width ? Number(width) : null,
      p_height: height ? Number(height) : null,
      p_original_filename: originalFilename ? String(originalFilename).substring(0, 255) : null
    });

    if (rpcError) {
      console.error('Error in create_media_message RPC:', rpcError);
      void recordStorageEvent({
        provider: intent.provider as StorageProviderType,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType: intent.media_type,
        sizeBucket: getSizeBucket(intent.file_size_bytes)
      });
      return res.status(400).json({ error: rpcError.message || 'Failed to create media message record' });
    }

    const messageId = rpcResult?.message_id;
    const mediaId = rpcResult?.media_id;

    // 4. Update upload intent to finalized with references
    await adminClient
      .from('media_upload_intents')
      .update({
        status: 'finalized',
        final_message_id: messageId,
        final_media_id: mediaId
      })
      .eq('id', intentId);

    void recordStorageEvent({
      provider: intent.provider as StorageProviderType,
      operation: 'upload_finalize',
      eventType: 'success',
      httpStatus: 200,
      latencyMs: Date.now() - startTime,
      mediaType: intent.media_type,
      sizeBucket: getSizeBucket(intent.file_size_bytes)
    });

    return res.status(200).json({
      success: true,
      messageId,
      mediaId
    });

  } catch (err: any) {
    console.error('Error finalizing media upload:', err);
    void recordStorageEvent({
      provider: intent.provider as StorageProviderType,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime,
      mediaType: intent.media_type,
      sizeBucket: getSizeBucket(intent.file_size_bytes)
    });
    return res.status(500).json({ error: err.message || 'Failed to finalize media message.' });
  }
}
