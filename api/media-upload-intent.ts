import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { createUploadTarget, MediaType } from './_lib/media/providers.js';
import { validateMediaRequest } from './_lib/media/validation.js';
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

  const { conversationId, mediaType, mimeType, fileSizeBytes, durationMs } = req.body || {};

  if (!conversationId || !mediaType || !mimeType || !fileSizeBytes) {
    return res.status(400).json({ error: 'Missing required upload parameters' });
  }

  // 1. Verify conversation authorization (supports creator_id, member_id, conversation_members) & archive status
  const check = await verifyConversationParticipant(authUser.userId, conversationId);
  if (!check.allowed) {
    return res.status(403).json({ error: check.errorMsg || 'Forbidden' });
  }
  if (check.archived) {
    return res.status(400).json({ error: 'Cannot send media to an archived conversation.' });
  }

  // 2. Validate media type, size, and duration (Validation failures DO NOT trigger provider fallback!)
  const validation = validateMediaRequest(mediaType as MediaType, mimeType, Number(fileSizeBytes), durationMs ? Number(durationMs) : undefined);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // 3. Create upload target using Storage Provider Router (B2 primary, Cloudinary fallback)
    const target = await createUploadTarget(conversationId, mediaType as MediaType, mimeType, Number(fileSizeBytes));

    // 4. Save upload intent in database with 24-hour retention window for orphan cleanup
    const adminClient = getServiceRoleSupabase();
    let intentId: string | null = null;

    if (adminClient) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: intent, error: intentErr } = await adminClient
        .from('media_upload_intents')
        .insert({
          user_id: authUser.userId,
          conversation_id: conversationId,
          provider: target.provider,
          object_key: target.objectKey,
          media_type: mediaType,
          mime_type: mimeType,
          file_size_bytes: Number(fileSizeBytes),
          status: 'pending',
          expires_at: expiresAt
        })
        .select('id')
        .single();

      if (!intentErr && intent) {
        intentId = intent.id;
      }
    }

    void recordStorageEvent({
      provider: target.provider,
      operation: 'upload_intent',
      eventType: 'success',
      httpStatus: 200,
      latencyMs: Date.now() - startTime,
      mediaType: mediaType as MediaType,
      sizeBucket: getSizeBucket(Number(fileSizeBytes))
    });

    return res.status(200).json({
      intentId,
      provider: target.provider,
      uploadUrl: target.uploadUrl,
      objectKey: target.objectKey,
      uploadMethod: target.uploadMethod || 'PUT',
      formDataParams: target.formDataParams,
      headers: target.headers,
      expiresInSeconds: target.expiresInSeconds
    });

  } catch (err: any) {
    console.error('Error generating upload intent:', err);
    void recordStorageEvent({
      provider: 'b2',
      operation: 'upload_intent',
      eventType: 'failure',
      httpStatus: 500,
      latencyMs: Date.now() - startTime,
      mediaType: mediaType as MediaType,
      sizeBucket: getSizeBucket(Number(fileSizeBytes))
    });
    return res.status(500).json({ error: err.message || 'Failed to generate upload authorization target.' });
  }
}
