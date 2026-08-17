// Server endpoint for checking Chat Interactions V1 feature availability
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const chatInteractionsEnabled = process.env.CHAT_INTERACTIONS_V1_ENABLED?.trim() === 'true';

  return res.status(200).json({
    chatInteractionsEnabled
  });
}
