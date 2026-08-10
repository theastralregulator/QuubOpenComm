import { verifyUserAuth, getUserSupabase, getServiceRoleSupabase } from './_lib/media/auth';
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
    provider,
    objectKey,
    mediaType,
    mimeType,
    fileSizeBytes,
    durationMs,
    width,
    height,
    originalFilename,
    previewText
  } = req.body || {};

  if (!conversationId || !provider || !objectKey || !mediaType || !mimeType || !fileSizeBytes) {
    return res.status(400).json({ error: 'Missing required media metadata parameters' });
  }

  // 1. Verify upload intent ownership if intentId provided
  const adminClient = getServiceRoleSupabase();
  if (intentId && adminClient) {
    const { data: intent } = await adminClient
      .from('media_upload_intents')
      .select('id, user_id, conversation_id, provider, object_key, status')
      .eq('id', intentId)
      .maybeSingle();

    if (intent) {
      if (intent.user_id !== authUser.userId || intent.conversation_id !== conversationId) {
        return res.status(403).json({ error: 'Upload intent ownership mismatch.' });
      }
    }
  }

  // 2. Call user Supabase client with user's JWT token to execute create_media_message RPC
  const userClient = getUserSupabase(authUser.jwtToken);
  if (!userClient) {
    return res.status(500).json({ error: 'Database connection failed' });
  }

  try {
    const preview = previewText || (
      mediaType === 'audio' ? 'Voice message' :
      mediaType === 'image' ? 'Photo' : 'Video'
    );

    const { data: rpcResult, error: rpcError } = await userClient.rpc('create_media_message', {
      p_conversation_id: conversationId,
      p_message_type: mediaType,
      p_preview_text: preview,
      p_media_type: mediaType,
      p_storage_provider: provider,
      p_object_key: objectKey,
      p_mime_type: mimeType,
      p_file_size_bytes: Number(fileSizeBytes),
      p_duration_ms: durationMs ? Number(durationMs) : null,
      p_width: width ? Number(width) : null,
      p_height: height ? Number(height) : null,
      p_original_filename: originalFilename || null
    });

    if (rpcError) {
      console.error('Error in create_media_message RPC:', rpcError);
      void recordStorageEvent({
        provider,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType,
        sizeBucket: getSizeBucket(Number(fileSizeBytes))
      });
      return res.status(400).json({ error: rpcError.message || 'Failed to create media message record' });
    }

    // Mark upload intent finalized
    if (intentId && adminClient) {
      await adminClient
        .from('media_upload_intents')
        .update({ status: 'finalized' })
        .eq('id', intentId);
    }

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'success',
      httpStatus: 200,
      latencyMs: Date.now() - startTime,
      mediaType,
      sizeBucket: getSizeBucket(Number(fileSizeBytes))
    });

    return res.status(200).json({
      success: true,
      messageId: rpcResult?.message_id,
      mediaId: rpcResult?.media_id
    });

  } catch (err: any) {
    console.error('Error finalizing media upload:', err);
    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime,
      mediaType,
      sizeBucket: getSizeBucket(Number(fileSizeBytes))
    });
    return res.status(500).json({ error: err.message || 'Failed to finalize media message.' });
  }
}
