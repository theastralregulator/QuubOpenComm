// Server endpoint for checking Negotiation Chat V2 feature availability
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const negotiationChatV2Enabled = process.env.NEGOTIATION_CHAT_V2_ENABLED?.trim() === 'true';

  return res.status(200).json({
    negotiationChatV2Enabled
  });
}
