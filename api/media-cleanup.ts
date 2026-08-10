import { getServiceRoleSupabase } from './_lib/media/auth';
import { deleteStorageObject, StorageProviderType } from './_lib/media/providers';
import { recordStorageEvent } from './_lib/media/telemetry';

export default async function handler(req: any, res: any) {
  // Authorization check: Vercel Cron, MEDIA_CRON_SECRET, or Canonical Admin Member
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

  // Requirement 4: Canonical Admin Authorization Check for manual trigger
  if (!authorized && authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const userAuthHeader = authHeader.substring(7).trim();
    if (userAuthHeader) {
      try {
        const { data: { user } } = await adminClient.auth.getUser(userAuthHeader);
        if (user) {
          const { data: adminMember } = await adminClient
            .from('admin_members')
            .select('id, role, is_active')
            .or(`user_id.eq.${user.id},id.eq.${user.id}`)
            .eq('is_active', true)
            .maybeSingle();

          if (adminMember && ['super_admin', 'admin', 'system_admin', 'moderator', 'support_agent'].includes(adminMember.role)) {
            authorized = true;
          }
        }
      } catch (err) {
        // ignore auth error
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
          // Requirement 5: Increment cleanup attempts atomically via DB RPC
          await adminClient.rpc('record_media_cleanup_failure', {
            p_media_id: item.id,
            p_error: 'Provider object deletion failed or object not found'
          });

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

    // 2. Requirement 3: Process Expired Unfinalized Upload Intents (pending, uploaded, or stale finalizing)
    // NEVER delete an intent that already has final_message_id or final_media_id!
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: orphanIntents } = await adminClient
      .from('media_upload_intents')
      .select('id, provider, object_key, media_type, finalizing_at')
      .in('status', ['pending', 'uploaded', 'finalizing'])
      .is('final_message_id', null)
      .is('final_media_id', null)
      .lte('expires_at', nowIso)
      .or(`finalizing_at.is.null,finalizing_at.lte.${fiveMinutesAgo}`)
      .limit(50);

    if (orphanIntents && orphanIntents.length > 0) {
      for (const intent of orphanIntents) {
        const success = await deleteStorageObject(intent.provider as StorageProviderType, intent.object_key);

        // Mark expired only when provider deletion succeeds or object is absent
        if (success) {
          await adminClient
            .from('media_upload_intents')
            .update({
              status: 'expired',
              finalizing_at: null
            })
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
