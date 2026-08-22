import { verifyUserAuth, verifyNegotiationRoomParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { deleteStorageObject, StorageProviderType, MediaType } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Server-side Feature Gate check
  if (process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() !== 'true') {
    return res.status(403).json({ error: 'Negotiation message deletion is currently disabled.' });
  }

  // 2. Authentication
  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { messageId } = req.body || {};
  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'Missing messageId parameter' });
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

  try {
    // 3. Fetch target negotiation message
    const { data: message, error: fetchErr } = await adminClient
      .from('negotiation_messages')
      .select('id, negotiation_room_id, sender_id, message_type, media_type, media_path, media_metadata, deleted_at')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error fetching negotiation message for deletion:', fetchErr);
      return res.status(500).json({ error: 'Database query error' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Negotiation message not found' });
    }

    // Security: Only original sender may delete
    if (message.sender_id !== authUser.userId) {
      return res.status(403).json({ error: 'Only the original sender may delete their message.' });
    }

    // Security: Reject workflow/system messages
    if (['system', 'proposal_event', 'status_event'].includes(message.message_type)) {
      return res.status(403).json({ error: 'System and workflow event messages cannot be deleted.' });
    }

    // Security: Verify participant (History delete allowed even if room is locked)
    const check = await verifyNegotiationRoomParticipant(authUser.userId, message.negotiation_room_id);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Not authorized for this negotiation room.' });
    }

    // Idempotency: If already deleted
    if (message.deleted_at) {
      return res.status(200).json({ success: true, idempotent: true });
    }

    // 4. IF ATTACHED MEDIA EXISTS, DELETE PROVIDER OBJECT FIRST!
    const objectKey = message.media_path || message.media_metadata?.object_key;
    const mediaType = message.media_type || message.message_type;
    const provider = (message.media_metadata?.provider || 'b2') as StorageProviderType;
    const mimeType = message.media_metadata?.mime_type || 'application/octet-stream';

    if (objectKey && mediaType && mediaType !== 'text') {
      let providerDeleted = false;
      try {
        providerDeleted = await deleteStorageObject(
          provider,
          objectKey,
          mediaType as MediaType,
          mimeType
        );
      } catch (deleteErr: any) {
        console.error('[NegotiationMessageDelete] Provider object deletion error:', {
          messageId,
          provider,
          objectKey,
          error: deleteErr?.message
        });
      }

      if (!providerDeleted) {
        console.error('[NegotiationMessageDelete] Provider deletion returned false:', {
          messageId,
          provider,
          objectKey
        });
        return res.status(500).json({
          error: 'Failed to delete attached storage media file. Message deletion cancelled.'
        });
      }
    }

    // 5. Invoke Service-Role Only RPC to finalize database soft deletion
    const { data: rpcRes, error: rpcErr } = await adminClient.rpc(
      'delete_negotiation_message_internal',
      {
        p_message_id: messageId,
        p_user_id: authUser.userId
      }
    );

    if (rpcErr) {
      console.error('Error in delete_negotiation_message_internal RPC:', rpcErr);
      return res.status(500).json({ error: rpcErr.message || 'Failed to complete message deletion.' });
    }

    return res.status(200).json(rpcRes || { success: true });

  } catch (err: any) {
    console.error('Error handling negotiation message deletion:', err);
    return res.status(500).json({ error: err.message || 'Server error deleting message.' });
  }
}
