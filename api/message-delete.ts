import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { deleteStorageObject, StorageProviderType } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Server-side Feature Gate check
  if (process.env.CHAT_INTERACTIONS_V1_ENABLED?.trim() !== 'true') {
    return res.status(403).json({ error: 'Message interactions are currently unavailable.' });
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

  try {
    // 3. Fetch target message to verify ownership and attached media
    const { data: message, error: fetchErr } = await adminClient
      .from('messages')
      .select('id, conversation_id, sender_id, role, text, deleted_at')
      .eq('id', messageId)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error fetching message for deletion:', fetchErr);
      return res.status(500).json({ error: 'Database query error' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Security: Only original sender may delete
    if (message.sender_id !== authUser.userId) {
      return res.status(403).json({ error: 'Only the original sender may delete their message.' });
    }

    // Security: Positive rule - role MUST be 'user'
    if (message.role !== 'user') {
      return res.status(403).json({ error: 'Only normal user messages can be deleted.' });
    }

    // Security: Verify user conversation participation
    const check = await verifyConversationParticipant(authUser.userId, message.conversation_id);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Not authorized for this conversation.' });
    }

    // Idempotency: If already deleted
    if (message.deleted_at) {
      return res.status(200).json({ success: true, idempotent: true });
    }

    // 4. Fetch attached media (if any)
    const { data: mediaItems } = await adminClient
      .from('message_media')
      .select('id, storage_provider, object_key, status')
      .eq('message_id', messageId);

    // 5. IF ATTACHED MEDIA EXISTS, DELETE PROVIDER OBJECT FIRST!
    if (mediaItems && mediaItems.length > 0) {
      for (const media of mediaItems) {
        if (media.status !== 'deleted' && media.object_key) {
          try {
            await deleteStorageObject(
              media.storage_provider as StorageProviderType,
              media.object_key
            );
          } catch (deleteErr: any) {
            console.error('[MessageDelete] Provider object deletion failed:', {
              messageId,
              mediaId: media.id,
              provider: media.storage_provider,
              objectKey: media.object_key,
              error: deleteErr?.message
            });
            // Abort soft delete if provider storage deletion failed
            return res.status(500).json({
              error: 'Failed to delete attached storage media file. Message deletion cancelled.'
            });
          }
        }
      }
    }

    // 6. Invoke Service-Role RPC to finalize database soft deletion
    const { data: rpcRes, error: rpcErr } = await adminClient.rpc(
      'finalize_user_message_delete_internal',
      {
        p_user_id: authUser.userId,
        p_message_id: messageId
      }
    );

    if (rpcErr) {
      console.error('Error in finalize_user_message_delete_internal RPC:', rpcErr);
      return res.status(500).json({ error: rpcErr.message || 'Failed to complete message deletion.' });
    }

    return res.status(200).json(rpcRes || { success: true });

  } catch (err: any) {
    console.error('Error handling message deletion:', err);
    return res.status(500).json({ error: err.message || 'Server error deleting message.' });
  }
}
