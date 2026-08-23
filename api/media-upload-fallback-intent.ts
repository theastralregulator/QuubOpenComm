import { verifyUserAuth, verifyConversationParticipant, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createFallbackUploadTarget, checkStorageProvidersConfig, verifyUploadedObject, MediaType, StorageProviderType } from './_lib/media/providers.js';
import { validateMediaRequest, normalizeMimeType } from './_lib/media/validation.js';
import { recordStorageEvent, getSizeBucket } from './_lib/media/telemetry.js';

// Consolidated serverless function for media upload fallback intent authorization:
// - /api/media-upload-fallback-intent (Permanent Chat)
// - /api/negotiation-media-upload-fallback-intent (Negotiation Chat V2)
export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = req.url || '';
  const matchedPath = (req.headers['x-matched-path'] as string) || '';
  const fullPath = (url + ' ' + matchedPath).toLowerCase();
  const isNegotiation = fullPath.includes('negotiation') || req.body?.scope === 'negotiation' || req.body?.isNegotiation === true;

  if (isNegotiation) {
    // ==================================================
    // NEGOTIATION CHAT V2 FALLBACK INTENT
    // ==================================================

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

    const { roomId: rawRoomId, negotiationRoomId, conversationId, mediaType, mimeType, fileSizeBytes, durationMs, replyToMessageId, originalProvider } = req.body || {};
    const roomId = rawRoomId || negotiationRoomId || conversationId;

    if (!roomId || !mediaType || !mimeType || !fileSizeBytes || !originalProvider) {
      return res.status(400).json({ error: 'Missing required upload parameters including originalProvider' });
    }

    if (originalProvider !== 'b2' && originalProvider !== 'cloudinary') {
      return res.status(400).json({ error: 'Invalid originalProvider. Must be b2 or cloudinary.' });
    }

    const cleanMimeType = normalizeMimeType(mimeType);

    // 3. Room & Active Authorization Check
    const check = await verifyNegotiationRoomParticipant(authUser.userId, roomId);
    if (!check.allowed || check.locked) {
      return res.status(403).json({ error: 'Cannot send media to a locked negotiation room.' });
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

    // 5. Reply Target Pre-Validation
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
      const target = await createFallbackUploadTarget(
        roomId,
        mediaType as MediaType,
        cleanMimeType,
        Number(fileSizeBytes),
        originalProvider as StorageProviderType
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
  } else {
    // ==================================================
    // PERMANENT CHAT FALLBACK INTENT
    // ==================================================
    const authUser = await verifyUserAuth(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { originalIntentId } = req.body || {};
    if (!originalIntentId || typeof originalIntentId !== 'string') {
      return res.status(400).json({ error: 'Missing originalIntentId' });
    }

    const chatEnabled = process.env.CHAT_INTERACTIONS_V1_ENABLED?.trim() === 'true';

    const adminClient = getServiceRoleSupabase();
    if (!adminClient) {
      return res.status(500).json({ error: 'Server database configuration unavailable' });
    }

    try {
      // 1. Fetch original intent record
      const { data: origIntent, error: fetchErr } = await adminClient
        .from('media_upload_intents')
        .select('*')
        .eq('id', originalIntentId)
        .maybeSingle();

      if (fetchErr) {
        console.error('Error querying original upload intent:', fetchErr);
        return res.status(500).json({ error: 'Server database error while verifying original upload intent.' });
      }

      if (!origIntent) {
        return res.status(404).json({ error: 'Original upload intent record not found.' });
      }

      // Security Check: Ownership
      if (origIntent.user_id !== authUser.userId) {
        return res.status(403).json({ error: 'Authorization mismatch for this upload intent.' });
      }

      // Security Check: Status
      if (origIntent.status !== 'pending') {
        return res.status(409).json({ error: 'Original upload intent is no longer eligible for fallback.' });
      }

      // Security Check: Expiration
      if (new Date(origIntent.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ error: 'Original upload intent has expired.' });
      }

      // Security Check: Conversation Access & Archive Status
      const check = await verifyConversationParticipant(authUser.userId, origIntent.conversation_id);
      if (!check.allowed || check.archived) {
        return res.status(403).json({ error: 'Conversation access invalid or archived.' });
      }

      // 2. Check Server Fallback Policy
      const config = await checkStorageProvidersConfig();
      if (!config.autoFallbackEnabled) {
        return res.status(400).json({ error: 'Automatic media storage provider fallback is disabled by administrator policy.' });
      }

      // 3. Server-side check if original object ALREADY EXISTS in storage bucket
      const origVerification = await verifyUploadedObject(
        origIntent.provider as StorageProviderType,
        origIntent.object_key,
        origIntent.media_type,
        origIntent.mime_type
      );

      if (origVerification.exists) {
        return res.status(400).json({
          error: 'Original object was already uploaded successfully. Please finalize the original intent.'
        });
      }

      // 4. ATOMICALLY CLAIM original intent (status = 'failed')
      const nowIso = new Date().toISOString();
      const { data: claimedIntent, error: claimErr } = await adminClient
        .from('media_upload_intents')
        .update({ status: 'failed' })
        .eq('id', originalIntentId)
        .eq('user_id', authUser.userId)
        .eq('status', 'pending')
        .gte('expires_at', nowIso)
        .select('id')
        .maybeSingle();

      if (claimErr) {
        console.error('Database query error claiming fallback intent:', claimErr);
        return res.status(500).json({ error: 'Server database error during fallback intent claim.' });
      }

      if (!claimedIntent) {
        return res.status(409).json({
          error: 'Fallback retry already claimed or original intent is no longer eligible.'
        });
      }

      let fallbackTarget;
      let fallbackIntent;

      try {
        // 5. Create fallback upload target via server provider router
        fallbackTarget = await createFallbackUploadTarget(
          origIntent.conversation_id,
          origIntent.media_type,
          origIntent.mime_type,
          origIntent.file_size_bytes,
          origIntent.provider as StorageProviderType
        );

        // 6. Record new fallback intent safely
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const insertPayload: Record<string, any> = {
          user_id: authUser.userId,
          conversation_id: origIntent.conversation_id,
          provider: fallbackTarget.provider,
          object_key: fallbackTarget.objectKey,
          media_type: origIntent.media_type,
          mime_type: origIntent.mime_type,
          file_size_bytes: origIntent.file_size_bytes,
          status: 'pending',
          expires_at: expiresAt
        };

        if (chatEnabled && origIntent.reply_to_message_id) {
          insertPayload.reply_to_message_id = origIntent.reply_to_message_id;
        }

        const { data: insData, error: insErr } = await adminClient
          .from('media_upload_intents')
          .insert(insertPayload)
          .select('id')
          .single();

        if (insErr || !insData) {
          throw new Error('Failed to record fallback upload authorization intent record.');
        }
        fallbackIntent = insData;

      } catch (stepErr: any) {
        console.error('Rolling back original intent status from failed to pending due to fallback creation failure:', stepErr);
        await adminClient
          .from('media_upload_intents')
          .update({ status: 'pending' })
          .eq('id', originalIntentId)
          .eq('status', 'failed');
        throw stepErr;
      }

      void recordStorageEvent({
        provider: fallbackTarget.provider,
        operation: 'upload_intent',
        eventType: 'success',
        httpStatus: 200,
        latencyMs: Date.now() - startTime,
        mediaType: origIntent.media_type,
        sizeBucket: getSizeBucket(Number(origIntent.file_size_bytes))
      });

      return res.status(200).json({
        intentId: fallbackIntent.id,
        provider: fallbackTarget.provider,
        uploadUrl: fallbackTarget.uploadUrl,
        objectKey: fallbackTarget.objectKey,
        uploadMethod: fallbackTarget.uploadMethod || 'PUT',
        formDataParams: fallbackTarget.formDataParams,
        headers: fallbackTarget.headers,
        expiresInSeconds: fallbackTarget.expiresInSeconds
      });

    } catch (err: any) {
      console.error('Error generating fallback upload intent:', err);
      return res.status(400).json({ error: err.message || 'Fallback upload target creation failed.' });
    }
  }
}
