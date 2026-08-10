import { checkStorageProvidersConfig } from './_lib/media/providers';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = checkStorageProvidersConfig();
  const mediaMessagingEnabled = Boolean(config.activePrimaryProvider);

  return res.status(200).json({
    mediaMessagingEnabled,
    voiceEnabled: mediaMessagingEnabled,
    imageEnabled: mediaMessagingEnabled,
    videoEnabled: mediaMessagingEnabled,
    activePrimaryProvider: config.activePrimaryProvider,
    r2Configured: config.r2Configured,
    b2Configured: config.b2Configured,
    cloudinaryConfigured: config.cloudinaryConfigured
  });
}
