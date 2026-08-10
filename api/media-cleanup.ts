import { getServiceRoleSupabase } from './_lib/media/auth';
import { deleteStorageObject, StorageProviderType } from './_lib/media/providers';
import { recordStorageEvent } from './_lib/media/telemetry';

export default async function handler(req: any, res: any) {
  // Authorization check: Vercel Cron or MEDIA_CRON_SECRET
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  const cronSecret = process.env.MEDIA_CRON_SECRET;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  let authorized = isVercelCron;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else if (cronSecret && req.query?.secret === cronSecret) {
    authorized = true;
  }

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
  let deletedTelemetryCount = 0;
  const errors: string[] = [];

  try {
    // 1. Atomic Claim of 15-day Post-Archive Expired Media using claim_due_media_for_cleanup RPC (FOR UPDATE SKIP LOCKED)
    const { data: dueMedia, error: claimErr } = await adminClient.rpc('claim_due_media_for_cleanup', { p_limit: 50 });

    if (!claimErr && dueMedia && dueMedia.length > 0) {
      for (const item of dueMedia) {
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
          // Requirement 15: Sanitized error category only (no credentials or private keys in logs/errors)
          await adminClient
            .from('message_media')
            .update({
              cleanup_attempts: (item.cleanup_attempts || 0) + 1,
              last_cleanup_error: 'Provider object deletion failed or object not found',
              last_cleanup_attempt_at: new Date().toISOString()
            })
            .eq('id', item.id);

          errors.push(`Deletion attempt failed for media item ${item.id}`);
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
    const { data: orphanIntents } = await adminClient
      .from('media_upload_intents')
      .select('id, provider, object_key, media_type')
      .eq('status', 'pending')
      .lte('expires_at', new Date().toISOString())
      .limit(50);

    if (orphanIntents && orphanIntents.length > 0) {
      for (const intent of orphanIntents) {
        const success = await deleteStorageObject(intent.provider as StorageProviderType, intent.object_key);

        // Requirement 16: Only mark status 'expired' if provider delete succeeds (or object already gone)
        if (success) {
          await adminClient
            .from('media_upload_intents')
            .update({ status: 'expired' })
            .eq('id', intent.id);

          deletedOrphanCount++;
        }
      }
    }

    // 3. Telemetry 30-Day Retention Cleanup
    const { data: tDeleted } = await adminClient.rpc('cleanup_old_media_storage_events');
    if (typeof tDeleted === 'number') {
      deletedTelemetryCount = tDeleted;
    }

    return res.status(200).json({
      success: true,
      deletedMediaCount,
      deletedOrphanCount,
      deletedTelemetryCount,
      errors
    });

  } catch (err: any) {
    console.error('Error during media cleanup job:', err);
    return res.status(500).json({ error: err.message || 'Cleanup job execution failed' });
  }
}
