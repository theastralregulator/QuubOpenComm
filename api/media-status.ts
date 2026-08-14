import { checkStorageProvidersConfig, ensureB2CorsReadiness } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestOrigin = req.headers?.origin || req.headers?.Origin;
  const config = await checkStorageProvidersConfig(requestOrigin);
  const b2Cors = await ensureB2CorsReadiness(requestOrigin);

  const mediaMessagingEnabled = Boolean(config.activePrimaryProvider);

  return res.status(200).json({
    mediaMessagingEnabled,
    voiceEnabled: mediaMessagingEnabled,
    imageEnabled: mediaMessagingEnabled,
    videoEnabled: mediaMessagingEnabled,

    selectedPrimaryProvider: config.selectedPrimaryProvider,
    activePrimaryProvider: config.activePrimaryProvider,
    fallbackProvider: config.fallbackProvider,
    autoFallbackEnabled: config.autoFallbackEnabled,
    failoverActive: config.failoverActive,

    b2Configured: config.b2Configured,
    b2CorsReady: b2Cors.ready,
    b2CorsPermissionMissing: Boolean(b2Cors.permissionMissing),
    b2CorsError: b2Cors.error || null,

    cloudinaryConfigured: config.cloudinaryConfigured
  });
}
