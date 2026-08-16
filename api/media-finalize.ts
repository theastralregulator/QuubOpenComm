import { GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyUserAuth, getServiceRoleSupabase } from './_lib/media/auth.js';
import { verifyUploadedObject, getB2Client, getR2Client, createDownloadAccessUrl, StorageProviderType } from './_lib/media/providers.js';
import { recordStorageEvent, getSizeBucket } from './_lib/media/telemetry.js';
import { normalizeMimeType } from './_lib/media/validation.js';
import { verifyDocumentBuffer } from './_lib/media/documentScanner.js';

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

  // 1. Guarded Intent Claiming via Server-Only RPC (Production Status Contract)
  const { data: claimResult, error: claimErr } = await adminClient.rpc('claim_media_upload_intent_for_finalize', {
    p_intent_id: intentId,
    p_user_id: authUser.userId,
    p_conversation_id: conversationId
  });

  if (claimErr || !claimResult) {
    const errorMsg = claimErr?.message || 'Upload intent state claim failed';
    return res.status(400).json({ error: errorMsg });
  }

  const claimStatus = claimResult.status;

  if (claimStatus === 'finalized') {
    return res.status(200).json({
      success: true,
      messageId: claimResult.final_message_id,
      mediaId: claimResult.final_media_id,
      idempotent: true
    });
  }

  if (claimStatus === 'finalizing_in_progress') {
    return res.status(409).json({ error: 'Upload intent finalization is currently in progress.' });
  }

  if (claimStatus === 'not_found') {
    return res.status(404).json({ error: 'Upload intent not found.' });
  }

  if (claimStatus === 'user_mismatch' || claimStatus === 'conversation_mismatch') {
    return res.status(403).json({ error: 'Not authorized for this upload intent.' });
  }

  if (claimStatus === 'expired') {
    return res.status(410).json({ error: 'Upload intent has expired.' });
  }

  if (claimStatus !== 'claimed') {
    return res.status(400).json({ error: claimResult.error || 'Claim upload intent failed.' });
  }

  const provider: StorageProviderType = claimResult.provider;
  const objectKey: string = claimResult.object_key;
  const mediaType = claimResult.media_type;
  const cleanMimeType = normalizeMimeType(claimResult.mime_type);
  const fileSizeBytes = Number(claimResult.file_size_bytes);

  const resetIntentLeaseToPending = async () => {
    try {
      await adminClient
        .from('media_upload_intents')
        .update({ status: 'pending', finalizing_at: null })
        .eq('id', intentId)
        .eq('status', 'finalizing');
    } catch (err) {
      console.error('Failed to reset upload intent lease to pending:', err);
    }
  };

  // 2. Controlled Verification of Uploaded Object
  const verification = await verifyUploadedObject(provider, objectKey, mediaType, cleanMimeType);
  if (!verification.exists) {
    await resetIntentLeaseToPending();

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 400,
      latencyMs: Date.now() - startTime,
      mediaType
    });
    return res.status(400).json({ error: 'Uploaded object was not found on storage provider.' });
  }

  // Size Validation (Strict ±512 bytes tolerance for S3/Cloudinary metadata headers)
  if (verification.contentLengthBytes && Math.abs(verification.contentLengthBytes - fileSizeBytes) > 512) {
    console.warn(`Object size mismatch for key ${objectKey}: expected ${fileSizeBytes}, found ${verification.contentLengthBytes}`);
    await resetIntentLeaseToPending();

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 400,
      latencyMs: Date.now() - startTime,
      mediaType
    });
    return res.status(400).json({ error: 'Uploaded file size does not match authorization intent.' });
  }

  // Duration Validation
  const verifiedDurationMs = verification.durationMs || (durationMs ? Number(durationMs) : undefined);
  if (mediaType === 'audio' || mediaType === 'video') {
    const maxDurationMs = 5 * 60 * 1000;
    if (verifiedDurationMs && verifiedDurationMs > maxDurationMs) {
      console.warn(`Duration validation failed for key ${objectKey}: duration=${verifiedDurationMs}ms`);
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
      return res.status(400).json({ error: 'Uploaded video/audio duration exceeds maximum 5 minute limit.' });
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
      const allowedVideoFormats = ['mp4', 'webm'];
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
    } else if (mediaType === 'document') {
      const allowedDocFormats = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'];
      if (resType !== 'raw' || !allowedDocFormats.includes(format)) {
        console.warn(`Cloudinary document validation failed: resourceType=${resType}, format=${format}`);
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match document authorization intent.' });
      }
    }
  } else if (verification.contentType) {
    // S3 HEAD ContentType validation for B2 / R2
    const headMime = normalizeMimeType(verification.contentType);
    const intentMime = cleanMimeType;

    const isMimeCompatible = (
      headMime === intentMime ||
      (intentMime === 'audio/mp4' && (headMime === 'audio/x-m4a' || headMime === 'audio/m4a')) ||
      (intentMime === 'audio/mpeg' && headMime === 'audio/mp3') ||
      (mediaType !== 'document' && headMime === 'application/octet-stream')
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

  // 2b. Bounded Server-Side Document Magic Bytes & Signature Verification
  if (mediaType === 'document') {
    let docBuffer: Buffer | null = null;

    try {
      if (provider === 'b2') {
        const b2 = getB2Client();
        if (b2) {
          const getCmd = new GetObjectCommand({ Bucket: b2.bucket, Key: objectKey, Range: 'bytes=0-65535' });
          const getRes = await b2.client.send(getCmd);
          if (getRes.Body) {
            const byteArray = await getRes.Body.transformToByteArray();
            docBuffer = Buffer.from(byteArray);
          }
        }
      } else if (provider === 'r2') {
        const r2 = getR2Client();
        if (r2) {
          const getCmd = new GetObjectCommand({ Bucket: r2.bucket, Key: objectKey, Range: 'bytes=0-65535' });
          const getRes = await r2.client.send(getCmd);
          if (getRes.Body) {
            const byteArray = await getRes.Body.transformToByteArray();
            docBuffer = Buffer.from(byteArray);
          }
        }
      } else if (provider === 'cloudinary') {
        const access = await createDownloadAccessUrl(provider, objectKey, 300, mediaType, cleanMimeType, 'view');
        const fetchRes = await fetch(access.accessUrl, { headers: { Range: 'bytes=0-65535' } });
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          docBuffer = Buffer.from(ab);
        }
      }
    } catch (fetchErr) {
      console.warn(`Failed to fetch document header buffer for key ${objectKey}:`, fetchErr);
    }

    if (docBuffer) {
      const docCheck = verifyDocumentBuffer(docBuffer, cleanMimeType);
      if (!docCheck.valid) {
        console.warn(`Document content verification failed for key ${objectKey}: ${docCheck.error}`);
        await resetIntentLeaseToPending();

        void recordStorageEvent({
          provider,
          operation: 'upload_finalize',
          eventType: 'failure',
          httpStatus: 400,
          latencyMs: Date.now() - startTime,
          mediaType
        });
        return res.status(400).json({ error: docCheck.error || 'Uploaded document failed security content verification.' });
      }
    } else {
      console.warn(`Unable to fetch document header chunk for key ${objectKey}`);
      await resetIntentLeaseToPending();

      void recordStorageEvent({
        provider,
        operation: 'upload_finalize',
        eventType: 'failure',
        httpStatus: 400,
        latencyMs: Date.now() - startTime,
        mediaType
      });
      return res.status(400).json({ error: 'Unable to verify document content security.' });
    }
  }

  // 3. Single Atomic Database Finalization via Server-Only finalize_media_message_internal RPC
  try {
    const previewText = (
      mediaType === 'audio' ? 'Voice message' :
      mediaType === 'image' ? 'Photo' :
      mediaType === 'document' ? 'Document' : 'Video'
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
      p_mime_type: cleanMimeType,
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
        mediaType
      });
      return res.status(400).json({ error: rpcError.message || 'Database finalization failed' });
    }

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
      messageId: rpcResult.message_id,
      mediaId: rpcResult.media_id
    });

  } catch (err: any) {
    console.error('Error executing finalize_media_message_internal:', err);
    await resetIntentLeaseToPending();

    void recordStorageEvent({
      provider,
      operation: 'upload_finalize',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime,
      mediaType
    });
    return res.status(500).json({ error: err.message || 'Failed to complete media message finalization.' });
  }
}
