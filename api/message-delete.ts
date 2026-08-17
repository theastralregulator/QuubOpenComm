import { verifyUserAuth, verifyConversationParticipant, getServiceRoleSupabase } from './_lib/media/auth.js';
import { deleteStorageObject, StorageProviderType, MediaType } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyUserAuth(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { messageId } = req.body || {};
  if (!messageId || typeof messageId !== 'string') {
    return res.status(400).json({ error: 'Missing mandatory messageId parameter' });
  }

  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server database configuration unavailable' });
  }

  try {
    // 1. Fetch canonical message record
    const { data: msg, error: msgErr } = await adminClient
      .from('messages')
      .select('id, conversation_id, sender_id, role, text, deleted_at')
      .eq('id', messageId)
      .maybeSingle();

    if (msgErr || !msg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 2. Authorization and Protection Validations
    if (msg.sender_id !== authUser.userId) {
      return res.status(403).json({ error: 'Only the original sender may delete their message' });
    }

    if (msg.role === 'system' || msg.role === 'assistant') {
      return res.status(403).json({ error: 'Official system messages cannot be deleted' });
    }

    if (msg.deleted_at) {
      return res.status(200).json({ success: true, idempotent: true });
    }

    const check = await verifyConversationParticipant(authUser.userId, msg.conversation_id);
    if (!check.allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 3. Fetch attached media record (if any)
    const { data: media, error: mediaErr } = await adminClient
      .from('message_media')
      .select('id, storage_provider, object_key, media_type, mime_type, status')
      .eq('message_id', messageId)
      .neq('status', 'deleted')
      .maybeSingle();

    if (mediaErr) {
      console.error('Error fetching attached media for delete:', mediaErr);
      return res.status(500).json({ error: 'Database error fetching attached media record' });
    }

    // 4. DELETE THE PROVIDER STORAGE OBJECT FIRST before touching database state
    if (media && media.object_key && media.storage_provider) {
      const providerDeleted = await deleteStorageObject(
        media.storage_provider as StorageProviderType,
        media.object_key,
        media.media_type as MediaType,
        media.mime_type
      );

      if (!providerDeleted) {
        console.error(`Failed to delete storage provider object '${media.object_key}' on ${media.storage_provider}`);
        return res.status(500).json({ error: 'Failed to delete media from storage provider. Please retry.' });
      }
    }

    // 5. Execute Service-Role Only RPC to soft-delete message and mark media status deleted
    const { data: rpcResult, error: rpcErr } = await adminClient.rpc('finalize_user_message_delete_internal', {
      p_user_id: authUser.userId,
      p_message_id: messageId
    });

    if (rpcErr) {
      console.error('Error in finalize_user_message_delete_internal RPC:', rpcErr);
      return res.status(400).json({ error: rpcErr.message || 'Failed to complete message deletion' });
    }

    return res.status(200).json({
      success: true,
      idempotent: Boolean(rpcResult?.idempotent)
    });

  } catch (err: any) {
    console.error('Error executing message delete:', err);
    return res.status(500).json({ error: err.message || 'Failed to execute message delete.' });
  }
}
