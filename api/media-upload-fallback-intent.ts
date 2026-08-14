import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createFallbackUploadTarget, StorageProviderType } from './_lib/media/providers.js';
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

  // Reject any attempt by client to pass provider override parameters!
  const { originalIntentId } = req.body || {};

  if (!originalIntentId) {
    return res.status(400).json({ error: 'Missing originalIntentId' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server database configuration unavailable' });
  }

  try {
    // 1. ATOMICALLY CLAIM original intent to prevent race conditions & duplicate fallback intents
    const { data: origIntent, error: claimErr } = await adminClient
      .from('media_upload_intents')
      .update({ status: 'failed' })
      .eq('id', originalIntentId)
      .eq('user_id', authUser.userId)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (claimErr || !origIntent) {
      return res.status(409).json({
        error: 'Fallback retry already claimed or original intent is no longer eligible.'
      });
    }

    // 2. Verify conversation authorization & archive status
    const check = await verifyConversationParticipant(authUser.userId, origIntent.conversation_id);
    if (!check.allowed || check.archived) {
      return res.status(403).json({ error: 'Conversation access invalid or archived.' });
    }

    // 3. Create fallback upload target via server provider router
    const fallbackTarget = await createFallbackUploadTarget(
      origIntent.conversation_id,
      origIntent.media_type,
      origIntent.mime_type,
      origIntent.file_size_bytes,
      origIntent.provider as StorageProviderType
    );

    // 4. Record new fallback intent
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: fallbackIntent, error: insErr } = await adminClient
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
        expires_at: expiresAt
      })
      .select('id')
      .single();

    if (insErr || !fallbackIntent) {
      return res.status(500).json({ error: 'Failed to record fallback upload authorization intent record.' });
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
