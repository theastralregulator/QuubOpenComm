import { GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyUserAuth, getServiceRoleSupabase } from './_lib/media/auth.js';
import { verifyUploadedObject, getB2Client, getR2Client, createDownloadAccessUrl, StorageProviderType } from './_lib/media/providers.js';
import { normalizeMimeType } from './_lib/media/validation.js';
import { verifyDocumentBuffer } from './_lib/media/documentScanner.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Server-side Feature Gate check
  if (process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() !== 'true') {
    return res.status(403).json({ error: 'Negotiation media finalization is currently disabled.' });
  }

  // 2. Authentication
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

  // 3. Guarded Intent Claiming via Server-Only RPC
  const { data: claimResult, error: claimErr } = await adminClient.rpc(
    'claim_negotiation_media_upload_intent_for_finalize',
    {
      p_intent_id: intentId,
      p_user_id: authUser.userId,
      p_room_id: roomId
    }
  );

  if (claimErr || !claimResult) {
    const errorMsg = claimErr?.message || 'Upload intent state claim failed';
    return res.status(400).json({ error: errorMsg });
  }

  const claimStatus = claimResult.status;

  if (claimStatus === 'finalized') {
    return res.status(200).json({
      success: true,
      messageId: claimResult.final_message_id,
      idempotent: true
    });
  }

  if (claimStatus === 'finalizing_in_progress') {
    return res.status(409).json({ error: 'Upload intent finalization is currently in progress.' });
  }

  if (claimStatus === 'not_found') {
    return res.status(404).json({ error: 'Upload intent not found.' });
  }

  if (claimStatus === 'user_mismatch' || claimStatus === 'room_mismatch') {
    return res.status(403).json({ error: 'Not authorized for this upload intent.' });
  }

  if (claimStatus === 'expired') {
    return res.status(410).json({ error: 'Upload intent has expired.' });
  }

  if (claimStatus === 'room_inactive') {
    return res.status(400).json({ error: 'Cannot finalize media in a locked or inactive negotiation room.' });
  }

  if (claimStatus !== 'claimed') {
    return res.status(400).json({ error: claimResult.error || 'Claim upload intent failed.' });
  }

  const provider: StorageProviderType = claimResult.provider;
  const objectKey: string = claimResult.object_key;
  const mediaType = claimResult.media_type;
  const cleanMimeType = normalizeMimeType(claimResult.mime_type);
  const fileSizeBytes = Number(claimResult.file_size_bytes);
  const replyToMessageId = claimResult.reply_to_message_id || null;

  const resetIntentLeaseToPending = async () => {
    try {
      await adminClient
        .from('negotiation_media_upload_intents')
        .update({ status: 'pending', finalizing_at: null })
        .eq('id', intentId)
        .eq('status', 'finalizing');
    } catch (err) {
      console.error('Failed to reset upload intent lease to pending:', err);
    }
  };

  // 4. Controlled Verification of Uploaded Object
  const verification = await verifyUploadedObject(provider, objectKey, mediaType, cleanMimeType);
  if (!verification.exists) {
    await resetIntentLeaseToPending();
    return res.status(400).json({ error: 'Uploaded object was not found on storage provider.' });
  }

  // Size Validation (±512 bytes tolerance)
  if (verification.contentLengthBytes && Math.abs(verification.contentLengthBytes - fileSizeBytes) > 512) {
    console.warn(`Object size mismatch for key ${objectKey}: expected ${fileSizeBytes}, found ${verification.contentLengthBytes}`);
    await resetIntentLeaseToPending();
    return res.status(400).json({ error: 'Uploaded file size does not match authorization intent.' });
  }

  // Duration Validation (Max 5 minutes)
  const verifiedDurationMs = verification.durationMs || (durationMs ? Number(durationMs) : undefined);
  if (mediaType === 'audio' || mediaType === 'video') {
    const maxDurationMs = 5 * 60 * 1000;
    if (verifiedDurationMs && verifiedDurationMs > maxDurationMs) {
      console.warn(`Duration validation failed for key ${objectKey}: duration=${verifiedDurationMs}ms`);
      await resetIntentLeaseToPending();
      return res.status(400).json({ error: 'Uploaded video/audio duration exceeds maximum 5 minute limit.' });
    }
  }

  // Provider-Aware Format / MIME Validation
  if (provider === 'cloudinary') {
    const resType = verification.resourceType;
    const format = String(verification.format || '').toLowerCase();

    if (mediaType === 'image') {
      const allowedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      if (resType !== 'image' || !allowedImageFormats.includes(format)) {
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match image authorization intent.' });
      }
    } else if (mediaType === 'video') {
      const allowedVideoFormats = ['mp4', 'webm'];
      if (resType !== 'video' || !allowedVideoFormats.includes(format)) {
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match video authorization intent.' });
      }
    } else if (mediaType === 'audio') {
      const allowedAudioFormats = ['webm', 'ogg', 'mp3', 'mpeg', 'wav', 'm4a', 'aac', 'mp4'];
      if (resType !== 'video' || !allowedAudioFormats.includes(format)) {
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match audio authorization intent.' });
      }
    } else if (mediaType === 'document') {
      const allowedDocFormats = ['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'csv'];
      if (resType !== 'raw' || !allowedDocFormats.includes(format)) {
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: 'Uploaded file type does not match document authorization intent.' });
      }
    }
  } else if (verification.contentType) {
    const headMime = normalizeMimeType(verification.contentType);
    const intentMime = cleanMimeType;

    const isMimeCompatible = (
      headMime === intentMime ||
      (intentMime === 'audio/mp4' && (headMime === 'audio/x-m4a' || headMime === 'audio/m4a')) ||
      (intentMime === 'audio/mpeg' && headMime === 'audio/mp3') ||
      (mediaType !== 'document' && headMime === 'application/octet-stream')
    );

    if (!isMimeCompatible) {
      await resetIntentLeaseToPending();
      return res.status(400).json({ error: 'Uploaded file type does not match authorization intent.' });
    }
  }

  // 5. Document Security Verification via Scanner
  if (mediaType === 'document') {
    const maxDocBytes = 20 * 1024 * 1024;
    if (fileSizeBytes > maxDocBytes) {
      await resetIntentLeaseToPending();
      return res.status(400).json({ error: 'Document size exceeds maximum 20MB limit.' });
    }

    let docBuffer: Buffer | null = null;
    const isOoxml = cleanMimeType.includes('openxmlformats');

    try {
      if (provider === 'b2') {
        const b2 = getB2Client();
        if (b2) {
          const getCmd = new GetObjectCommand({
            Bucket: b2.bucket,
            Key: objectKey,
            ...(isOoxml ? {} : { Range: 'bytes=0-65535' })
          });
          const getRes = await b2.client.send(getCmd);
          if (getRes.Body) {
            const byteArray = await getRes.Body.transformToByteArray();
            docBuffer = Buffer.from(byteArray);
          }
        }
      } else if (provider === 'r2') {
        const r2 = getR2Client();
        if (r2) {
          const getCmd = new GetObjectCommand({
            Bucket: r2.bucket,
            Key: objectKey,
            ...(isOoxml ? {} : { Range: 'bytes=0-65535' })
          });
          const getRes = await r2.client.send(getCmd);
          if (getRes.Body) {
            const byteArray = await getRes.Body.transformToByteArray();
            docBuffer = Buffer.from(byteArray);
          }
        }
      } else if (provider === 'cloudinary') {
        const access = await createDownloadAccessUrl(provider, objectKey, 300, mediaType, cleanMimeType, 'view');
        const headers: Record<string, string> = isOoxml ? {} : { Range: 'bytes=0-65535' };
        const fetchRes = await fetch(access.accessUrl, { headers });
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          docBuffer = Buffer.from(ab);
        }
      }
    } catch (fetchErr) {
      console.warn(`Failed to fetch document buffer for key ${objectKey}:`, fetchErr);
    }

    if (docBuffer) {
      const docCheck = verifyDocumentBuffer(docBuffer, cleanMimeType);
      if (!docCheck.valid) {
        console.warn(`Document content verification failed for key ${objectKey}: ${docCheck.error}`);
        await resetIntentLeaseToPending();
        return res.status(400).json({ error: docCheck.error || 'Uploaded document failed security content verification.' });
      }
    } else {
      console.warn(`Unable to fetch document header chunk for key ${objectKey}`);
      await resetIntentLeaseToPending();
      return res.status(400).json({ error: 'Unable to verify document content security.' });
    }
  }

  // 6. Atomic Server-Side Finalization RPC
  const metadata: Record<string, any> = {
    provider,
    object_key: objectKey,
    mime_type: cleanMimeType,
    file_size_bytes: fileSizeBytes,
    original_filename: originalFilename || undefined,
    duration_ms: verifiedDurationMs,
    width: width || undefined,
    height: height || undefined
  };

  const { data: finRes, error: finErr } = await adminClient.rpc(
    'finalize_negotiation_media_message_internal',
    {
      p_intent_id: intentId,
      p_user_id: authUser.userId,
      p_room_id: roomId,
      p_media_type: mediaType,
      p_object_key: objectKey,
      p_metadata: metadata,
      p_reply_to_message_id: replyToMessageId
    }
  );

  if (finErr || !finRes?.success) {
    await resetIntentLeaseToPending();
    return res.status(500).json({ error: finErr?.message || finRes?.error || 'Atomic negotiation media finalization failed.' });
  }

  return res.status(200).json({
    success: true,
    messageId: finRes.message_id
  });
}
