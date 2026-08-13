import { checkStorageProvidersConfig, runB2Diagnostic } from './_lib/media/providers.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = checkStorageProvidersConfig();
  const mediaMessagingEnabled = Boolean(config.activePrimaryProvider);

  let b2Diagnostic = undefined;
  if (req.query?.diag === '1' && config.b2Configured) {
    b2Diagnostic = await runB2Diagnostic();
  }

  return res.status(200).json({
    mediaMessagingEnabled,
    voiceEnabled: mediaMessagingEnabled,
    imageEnabled: mediaMessagingEnabled,
    videoEnabled: mediaMessagingEnabled,
    activePrimaryProvider: config.activePrimaryProvider,
    b2Configured: config.b2Configured,
    cloudinaryConfigured: config.cloudinaryConfigured,
    b2Diagnostic
  });
}
