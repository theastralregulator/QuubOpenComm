import type { Request, Response } from 'express';
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
    activeProviderRole: config.activePrimaryProvider ? 'active' : 'unconfigured'
  });
}
