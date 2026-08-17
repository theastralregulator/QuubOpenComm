import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createFallbackUploadTarget, checkStorageProvidersConfig, verifyUploadedObject, StorageProviderType } from './_lib/media/providers.js';
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

  const { originalIntentId } = req.body || {};
  if (!originalIntentId || typeof originalIntentId !== 'string') {
    return res.status(400).json({ error: 'Missing originalIntentId' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server database configuration unavailable' });
  }

  try {
    // 1. Fetch original intent record to verify ownership, conversation, status & expiration
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

      // 6. Record new fallback intent
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: insData, error: insErr } = await adminClient
        .from('media_upload_intents')
        .insert({
          user_id: authUser.userId,
          conversation_id: origIntent.conversation_id,
          provider: fallbackTarget.provider,
          object_key: fallbackTarget.objectKey,
          media_type: origIntent.media_type,
          mime_type: origIntent.mime_type,
          file_size_bytes: origIntent.file_size_bytes,
          status: 'pending',
          expires_at: expiresAt,
          reply_to_message_id: origIntent.reply_to_message_id || null
        })
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
