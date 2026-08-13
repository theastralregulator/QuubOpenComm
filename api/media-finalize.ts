import { verifyUserAuth, getServiceRoleSupabase } from './_lib/media/auth.js';
import { verifyUploadedObject, StorageProviderType } from './_lib/media/providers.js';
import { recordStorageEvent, getSizeBucket } from './_lib/media/telemetry.js';

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

  if (!intentId || typeof intentId !== 'string' || !conversationId) {
    return res.status(400).json({ error: 'Missing mandatory intentId or conversationId parameter' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  // 1. Guarded Intent Claiming via Server-Only RPC
  const { data: claimResult, error: claimErr } = await adminClient.rpc('claim_media_upload_intent_for_finalize', {
    p_intent_id: intentId,
    p_user_id: authUser.userId,
    p_conversation_id: conversationId
  });

  if (claimErr || !claimResult) {
    console.error('Error claiming upload intent:', claimErr);
    return res.status(500).json({ error: 'Failed to process upload intent authorization' });
  }

  const status = claimResult.status;

  // Idempotent return if already finalized (or finalizing with existing final message ID)
  if (status === 'finalized') {
    return res.status(200).json({
      success: true,
      messageId: claimResult.final_message_id,
      mediaId: claimResult.final_media_id,
      idempotent: true
    });
  }

  if (status === 'finalizing_in_progress') {
    return res.status(409).json({ error: 'Upload finalization is already in progress' });
  }

  if (status === 'not_found') {
    return res.status(404).json({ error: 'Upload intent record not found' });
  }

  if (status === 'user_mismatch' || status === 'conversation_mismatch') {
    return res.status(403).json({ error: 'Authorization mismatch for this upload intent' });
  }

  if (status === 'expired') {
    return res.status(410).json({ error: 'Upload intent has expired. Please request a new upload target.' });
  }

  if (status === 'failed') {
    return res.status(400).json({ error: 'Upload intent has failed.' });
  }

  if (status !== 'claimed') {
    return res.status(400).json({ error: `Invalid intent status '${status}' for finalization.` });
  }

  const provider = claimResult.provider as StorageProviderType;
  const objectKey = claimResult.object_key;
  const mediaType = claimResult.media_type;
  const mimeType = claimResult.mime_type;
  const fileSizeBytes = Number(claimResult.file_size_bytes);

  // Helper to reset intent lease atomically back to pending
  const resetIntentLeaseToPending = async () => {
    await adminClient
      .from('media_upload_intents')
      .update({ status: 'pending', finalizing_at: null })
      .eq('id', intentId);
  };

  // 2. Server-side verification of Object Exists, File Size, and MIME/format against canonical intent
  const verification = await verifyUploadedObject(provider, objectKey, mediaType, mimeType);
  if (!verification.exists) {
    console.warn(`Object verification failed for key ${objectKey} on provider ${provider}: ${verification.error}`);
    await resetIntentLeaseToPending();

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 404,
      latencyMs: Date.now() - startTime,
      mediaType
    });
    return res.status(400).json({ error: 'Uploaded object was not found in storage bucket.' });
  }

  // Size Validation against intent metadata (tolerance: ±512 bytes)
  if (verification.contentLengthBytes !== undefined && verification.contentLengthBytes !== null) {
    const sizeDiff = Math.abs(verification.contentLengthBytes - fileSizeBytes);
    if (sizeDiff > 512) {
      console.warn(`Object size mismatch for key ${objectKey}: expected ${fileSizeBytes}, found ${verification.contentLengthBytes}`);
      await resetIntentLeaseToPending();

      void recordStorageEvent({
        provider,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType,
        sizeBucket: getSizeBucket(fileSizeBytes)
      });
      return res.status(400).json({ error: 'Uploaded file size does not match authorization intent.' });
    }
  }

  // Provider-Aware Format / MIME Validation
  if (provider === 'cloudinary') {
    // Cloudinary format & resource_type validation
    const resType = verification.resourceType;
    const format = String(verification.format || '').toLowerCase();

    if (mediaType === 'image') {
      const allowedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      if (resType !== 'image' || !allowedImageFormats.includes(format)) {
        console.warn(`Cloudinary image validation failed: resourceType=${resType}, format=${format}`);
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match image authorization intent.' });
      }
    } else if (mediaType === 'video') {
      const allowedVideoFormats = ['mp4', 'webm', 'mov'];
      if (resType !== 'video' || !allowedVideoFormats.includes(format)) {
        console.warn(`Cloudinary video validation failed: resourceType=${resType}, format=${format}`);
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match video authorization intent.' });
      }
    } else if (mediaType === 'audio') {
      // Cloudinary processes audio under resource_type = 'video' (EXPECTED and VALID!)
      const allowedAudioFormats = ['webm', 'ogg', 'mp3', 'mpeg', 'wav', 'm4a', 'aac', 'mp4'];
      if (resType !== 'video' || !allowedAudioFormats.includes(format)) {
        console.warn(`Cloudinary audio validation failed: resourceType=${resType}, format=${format}`);
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match audio authorization intent.' });
      }
    }
  } else if (verification.contentType) {
    // S3 HEAD ContentType validation for B2 / R2
    const headMime = verification.contentType.split(';')[0].trim().toLowerCase();
    const intentMime = mimeType.split(';')[0].trim().toLowerCase();

    const isMimeCompatible = (
      headMime === intentMime ||
      (intentMime === 'audio/mp4' && (headMime === 'audio/x-m4a' || headMime === 'audio/m4a')) ||
      (intentMime === 'audio/mpeg' && headMime === 'audio/mp3') ||
      (headMime === 'application/octet-stream')
    );

    if (!isMimeCompatible) {
      console.warn(`Object MIME type mismatch for key ${objectKey}: expected ${intentMime}, found ${headMime}`);
      await resetIntentLeaseToPending();

      void recordStorageEvent({
        provider,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType
      });
      return res.status(400).json({ error: 'Uploaded file type does not match authorization intent.' });
    }
  }

  // 3. Single Atomic Database Finalization via Server-Only finalize_media_message_internal RPC
  try {
    const previewText = (
      mediaType === 'audio' ? 'Voice message' :
      mediaType === 'image' ? 'Photo' : 'Video'
    );

    const { data: rpcResult, error: rpcError } = await adminClient.rpc('finalize_media_message_internal', {
      p_user_id: authUser.userId,
      p_upload_intent_id: intentId,
      p_conversation_id: conversationId,
      p_message_type: mediaType,
      p_preview_text: previewText,
      p_media_type: mediaType,
      p_storage_provider: provider,
      p_object_key: objectKey,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSizeBytes,
      p_duration_ms: durationMs ? Number(durationMs) : null,
      p_width: width ? Number(width) : null,
      p_height: height ? Number(height) : null,
      p_original_filename: originalFilename ? String(originalFilename).substring(0, 255) : null
    });

    if (rpcError) {
      console.error('Error in finalize_media_message_internal RPC:', rpcError);
      await resetIntentLeaseToPending();

      void recordStorageEvent({
        provider,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType,
        sizeBucket: getSizeBucket(fileSizeBytes)
      });
      return res.status(400).json({ error: rpcError.message || 'Failed to create media message record' });
    }

    const messageId = rpcResult?.message_id;
    const mediaId = rpcResult?.media_id;

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'success',
      httpStatus: 200,
      latencyMs: Date.now() - startTime,
      mediaType,
      sizeBucket: getSizeBucket(fileSizeBytes)
    });

    return res.status(200).json({
      success: true,
      messageId,
      mediaId
    });

  } catch (err: any) {
    console.error('Error finalizing media upload:', err);
    await resetIntentLeaseToPending();

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime,
      mediaType,
      sizeBucket: getSizeBucket(fileSizeBytes)
    });
    return res.status(500).json({ error: err.message || 'Failed to finalize media message.' });
  }
}
