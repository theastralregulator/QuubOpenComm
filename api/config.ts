import { checkStorageProvidersConfig } from './_lib/media/providers.js';

// Consolidated serverless function for status & configuration endpoints:
// - /api/config
// - /api/chat-status
// - /api/negotiation-chat-status
// - /api/media-status
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = req.url || '';
  const matchedPath = (req.headers['x-matched-path'] as string) || '';
  const fullPath = (url + ' ' + matchedPath).toLowerCase();

  if (fullPath.includes('negotiation-chat-status')) {
    const negotiationChatV2Enabled = process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() === 'true';
    return res.status(200).json({ negotiationChatV2Enabled });
  }

  if (fullPath.includes('chat-status')) {
    const chatInteractionsEnabled = process.env.CHAT_INTERACTIONS_V1_ENABLED?.trim() === 'true';
    return res.status(200).json({ chatInteractionsEnabled });
  }

  if (fullPath.includes('media-status')) {
    const config = await checkStorageProvidersConfig();
    const mediaMessagingEnabled = Boolean(config.activePrimaryProvider);
    const isDocumentExplicitlyEnabled = process.env.MEDIA_DOCUMENT_ENABLED ? process.env.MEDIA_DOCUMENT_ENABLED.trim() === 'true' : false;
    const documentEnabled = mediaMessagingEnabled && isDocumentExplicitlyEnabled;

    return res.status(200).json({
      mediaMessagingEnabled,
      voiceEnabled: mediaMessagingEnabled,
      imageEnabled: mediaMessagingEnabled,
      videoEnabled: mediaMessagingEnabled,
      documentEnabled,

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

  // Default /api/config response
  return res.status(200).json({
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
    appUrl: process.env.VITE_APP_URL || process.env.APP_URL || ""
  });
}
