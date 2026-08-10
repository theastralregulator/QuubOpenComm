import { getServiceRoleSupabase } from './_lib/media/auth';
import { deleteStorageObject, StorageProviderType } from './_lib/media/providers';
import { recordStorageEvent } from './_lib/media/telemetry';

export default async function handler(req: any, res: any) {
  // Authorization check: Vercel Cron or MEDIA_CRON_SECRET or query token
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const cronSecret = process.env.MEDIA_CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  let authorized = isVercelCron;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else if (cronSecret && req.query?.secret === cronSecret) {
    authorized = true;
  }

  // Allow admin trigger from admin session if service role available
  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return res.status(500).json({ error: 'Server configuration unavailable' });
  }

  if (!authorized) {
    // Check if user is authenticated admin
    const userAuthHeader = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (userAuthHeader) {
      try {
        const { data: { user } } = await adminClient.auth.getUser(userAuthHeader);
        if (user) {
          const { data: isAdmin } = await adminClient.rpc('is_admin', { p_user_id: user.id });
          if (isAdmin) authorized = true;
        }
      } catch (err) {
        // ignore
      }
    }
  }

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized cleanup worker trigger' });
  }

  let deletedMediaCount = 0;
  let deletedOrphanCount = 0;
  const errors: string[] = [];

  try {
    // 1. Process 15-day Post-Archive Expired Media
    const { data: dueMedia } = await adminClient
      .from('message_media')
      .select('id, storage_provider, object_key, media_type, status, delete_after, cleanup_attempts')
      .in('status', ['active', 'cleanup_pending'])
      .not('delete_after', 'is', null)
      .lte('delete_after', new Date().toISOString())
      .limit(50);

    if (dueMedia && dueMedia.length > 0) {
      for (const item of dueMedia) {
        // Atomically mark cleanup_pending
        await adminClient
          .from('message_media')
          .update({
            status: 'cleanup_pending',
            last_cleanup_attempt_at: new Date().toISOString()
          })
          .eq('id', item.id);

        const success = await deleteStorageObject(item.storage_provider as StorageProviderType, item.object_key);

        if (success) {
          await adminClient
            .from('message_media')
            .update({
              status: 'deleted',
              deleted_at: new Date().toISOString()
            })
            .eq('id', item.id);

          deletedMediaCount++;
          void recordStorageEvent({
            provider: item.storage_provider as StorageProviderType,
            operation: 'delete',
            eventType: 'success',
            mediaType: item.media_type
          });
        } else {
          const attempts = (item.cleanup_attempts || 0) + 1;
          await adminClient
            .from('message_media')
            .update({
              cleanup_attempts: attempts,
              last_cleanup_error: 'Provider object deletion failed or object not found',
              last_cleanup_attempt_at: new Date().toISOString()
            })
            .eq('id', item.id);

          errors.push(`Failed to delete object ${item.object_key} on ${item.storage_provider}`);
          void recordStorageEvent({
            provider: item.storage_provider as StorageProviderType,
            operation: 'delete',
            eventType: 'failure',
            mediaType: item.media_type
          });
        }
      }
    }

    // 2. Process Orphan Upload Intents (> 24 hours old and unfinalized)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: orphanIntents } = await adminClient
      .from('media_upload_intents')
      .select('id, provider, object_key, media_type')
      .eq('status', 'pending')
      .lte('created_at', cutoff24h)
      .limit(50);

    if (orphanIntents && orphanIntents.length > 0) {
      for (const intent of orphanIntents) {
        await deleteStorageObject(intent.provider as StorageProviderType, intent.object_key);
        await adminClient
          .from('media_upload_intents')
          .update({ status: 'expired' })
          .eq('id', intent.id);

        deletedOrphanCount++;
      }
    }

    return res.status(200).json({
      success: true,
      deletedMediaCount,
      deletedOrphanCount,
      errors
    });

  } catch (err: any) {
    console.error('Error during media cleanup job:', err);
    return res.status(500).json({ error: err.message || 'Cleanup job execution failed' });
  }
}
