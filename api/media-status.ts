import { checkStorageProvidersConfig } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = await checkStorageProvidersConfig();
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
    b2CorsStatus: config.b2CorsStatus,
    b2CorsReady: config.b2CorsReady,

    cloudinaryConfigured: config.cloudinaryConfigured
  });
}
