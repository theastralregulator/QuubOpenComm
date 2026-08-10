import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function getServiceRoleSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export function getUserSupabase(jwtToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwtToken}` } },
    auth: { persistSession: false }
  });
}

export async function verifyUserAuth(req: any): Promise<{ userId: string; jwtToken: string } | null> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const jwtToken = authHeader.substring(7).trim();
  if (!jwtToken) return null;

  const client = getUserSupabase(jwtToken);
  if (!client) return null;

  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return { userId: user.id, jwtToken };
  } catch (err) {
    console.error('Error verifying user auth token:', err);
    return null;
  }
}

export async function verifyConversationParticipant(
  userId: string,
  conversationId: string
): Promise<{ allowed: boolean; archived: boolean; errorMsg?: string }> {
  const adminClient = getServiceRoleSupabase();
  if (!adminClient) {
    return { allowed: false, archived: false, errorMsg: 'Server configuration unavailable' };
  }

  try {
    const { data: conv, error } = await adminClient
      .from('conversations')
      .select('id, creator_id, member_id, archived_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error || !conv) {
      return { allowed: false, archived: false, errorMsg: 'Conversation not found' };
    }

    let isParticipant = conv.creator_id === userId || conv.member_id === userId;

    if (!isParticipant) {
      // Check conversation_members table for canonical multi-participant support
      const { data: cm } = await adminClient
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (cm) {
        isParticipant = true;
      }
    }

    if (!isParticipant) {
      return { allowed: false, archived: false, errorMsg: 'Not authorized for this conversation' };
    }

    const archived = Boolean(conv.archived_at);
    return { allowed: true, archived };
  } catch (err: any) {
    console.error('verifyConversationParticipant exception:', err);
    return { allowed: false, archived: false, errorMsg: err.message || 'Verification failed' };
  }
}
