import { supabase } from './supabase';

const MESSAGE_UNREAD_EVENT = 'opencomm:unread-messages-changed';

function dispatchUnreadMessageChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MESSAGE_UNREAD_EVENT));
  }
}

async function resolveUserId(userId?: string | null): Promise<string | null> {
  if (userId) return userId;
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

async function getConversationIdsForUser(userId: string): Promise<string[]> {
  if (!supabase || !userId) return [];

  const { data: directRows, error: directError } = await supabase
    .from('conversations')
    .select('id')
    .or(`creator_id.eq.${userId},member_id.eq.${userId}`);

  if (directError) {
    console.error('[MessageUnreadService] conversations query failed:', directError);
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  if (memberError) {
    console.error('[MessageUnreadService] conversation_members query failed:', memberError);
  }

  return [
    ...(directRows || []).map((row: any) => row.id),
    ...(memberRows || []).map((row: any) => row.conversation_id),
  ].filter(Boolean).filter((id, index, ids) => ids.indexOf(id) === index);
}

export const messageUnreadService = {
  eventName: MESSAGE_UNREAD_EVENT,

  async getUnreadCount(userId?: string | null): Promise<number> {
    if (!supabase) return 0;

    const currentUserId = await resolveUserId(userId);
    if (!currentUserId) return 0;

    const conversationIds = await getConversationIdsForUser(currentUserId);
    if (conversationIds.length === 0) return 0;

    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .neq('sender_id', currentUserId)
      .eq('unread', true);

    if (error) {
      console.error('[MessageUnreadService] unread count query failed:', error);
      return 0;
    }

    return count || 0;
  },

  async getUnreadCountsByConversation(
    conversationIds: string[],
    userId?: string | null,
  ): Promise<Record<string, number>> {
    if (!supabase || conversationIds.length === 0) return {};

    const currentUserId = await resolveUserId(userId);
    if (!currentUserId) return {};

    const { data, error } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', currentUserId)
      .eq('unread', true);

    if (error || !data) {
      if (error) console.error('[MessageUnreadService] per-conversation unread query failed:', error);
      return {};
    }

    return data.reduce((acc: Record<string, number>, row: any) => {
      if (row.conversation_id) {
        acc[row.conversation_id] = (acc[row.conversation_id] || 0) + 1;
      }
      return acc;
    }, {});
  },

  async markConversationRead(conversationId: string): Promise<boolean> {
    if (!supabase || !conversationId) return false;

    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.error('[MessageUnreadService] mark_conversation_read failed:', error);
      return false;
    }

    dispatchUnreadMessageChange();
    return true;
  },

  subscribeToUnreadChanges(userId: string, onChange: () => void) {
    if (!supabase || !userId) return () => {};

    const channelName = `unread-messages-${userId}`;
    const existing = supabase.getChannels?.()?.find((channel: any) => channel.name === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          const row = payload.new;
          if (row?.sender_id && row.sender_id !== userId && row.unread === true) {
            onChange();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: any) => {
          const row = payload.new;
          if (row?.sender_id && row.sender_id !== userId) {
            onChange();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  dispatchUnreadMessageChange,
};
