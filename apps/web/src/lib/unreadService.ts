import { useCallback, useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import type { NotificationItem } from './notificationService';

export interface UnreadCounts {
  messageCount: number;
  notificationCount: number;
  workflowCount: number;
}

export interface UnreadRealtimeEvent {
  table: 'messages' | 'conversations' | 'notifications' | 'job_applications' | 'hiring_requests' | 'negotiation_messages' | 'deal_proposals' | 'work_contracts';
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any>;
  old: Record<string, any>;
}

const EMPTY_COUNTS: UnreadCounts = {
  messageCount: 0,
  notificationCount: 0,
  workflowCount: 0
};

type Listener = () => void;
type EventListener = (event: UnreadRealtimeEvent) => void;

interface UserSession {
  userId: string;
  snapshot: UnreadCounts;
  listeners: Set<Listener>;
  messageListeners: Set<EventListener>;
  conversationListeners: Set<EventListener>;
  workflowListeners: Set<EventListener>;
  notificationListeners: Set<(notification: NotificationItem, event: UnreadRealtimeEvent) => void>;
  channel: any | null;
  refreshPromise: Promise<void> | null;
}

const sessions = new Map<string, UserSession>();

function getSession(userId: string): UserSession {
  const existing = sessions.get(userId);
  if (existing) return existing;

  const session: UserSession = {
    userId,
    snapshot: EMPTY_COUNTS,
    listeners: new Set(),
    messageListeners: new Set(),
    conversationListeners: new Set(),
    workflowListeners: new Set(),
    notificationListeners: new Set(),
    channel: null,
    refreshPromise: null
  };
  sessions.set(userId, session);
  return session;
}

function emit(session: UserSession) {
  session.listeners.forEach((listener) => listener());
}

function updateSnapshot(session: UserSession, next: UnreadCounts) {
  if (
    session.snapshot.messageCount === next.messageCount &&
    session.snapshot.notificationCount === next.notificationCount &&
    session.snapshot.workflowCount === next.workflowCount
  ) {
    return;
  }

  session.snapshot = next;
  emit(session);
}

function emitEvent(session: UserSession, event: UnreadRealtimeEvent) {
  if (event.table === 'messages') {
    session.messageListeners.forEach((listener) => listener(event));
  }
  if (event.table === 'conversations') {
    session.conversationListeners.forEach((listener) => listener(event));
  }
  if (
    event.table === 'job_applications' ||
    event.table === 'hiring_requests' ||
    event.table === 'negotiation_messages' ||
    event.table === 'deal_proposals' ||
    event.table === 'work_contracts'
  ) {
    session.workflowListeners.forEach((listener) => listener(event));
  }
  if (event.table === 'notifications') {
    const notification = event.eventType === 'DELETE' ? event.old : event.new;
    if (notification?.id) {
      session.notificationListeners.forEach((listener) => listener(notification as NotificationItem, event));
    }
  }
}

function normalizeCounts(value: any): UnreadCounts | null {
  if (!value || typeof value !== 'object') return null;

  const messageCount = Number(value.message_count);
  const notificationCount = Number(value.notification_count);
  const workflowCount = Number(value.workflow_count);

  if (![messageCount, notificationCount, workflowCount].every(Number.isFinite)) return null;

  return {
    messageCount: Math.max(0, messageCount),
    notificationCount: Math.max(0, notificationCount),
    workflowCount: Math.max(0, workflowCount)
  };
}

async function getFallbackCounts(userId: string): Promise<UnreadCounts> {
  if (!supabase) return EMPTY_COUNTS;

  let messageCount = 0;
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .or(`creator_id.eq.${userId},member_id.eq.${userId}`);

  const { data: memberships } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId);

  const conversationIds = Array.from(new Set([
    ...(conversations || []).map((conversation: any) => conversation.id),
    ...(memberships || []).map((membership: any) => membership.conversation_id)
  ].filter(Boolean)));

  if (conversationIds.length > 0) {
    const { data: conversationStates } = await supabase
      .from('conversations')
      .select('id, archived_at')
      .in('id', conversationIds);
    const activeConversationIds = (conversationStates || [])
      .filter((conversation: any) => !conversation.archived_at)
      .map((conversation: any) => conversation.id);

    if (activeConversationIds.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', activeConversationIds)
        .neq('sender_id', userId)
        .eq('unread', true);
      messageCount = count || 0;
    }
  }

  const { data: unreadNotifications } = await supabase
    .from('notifications')
    .select('type')
    .eq('recipient_id', userId)
    .eq('is_read', false);

  const workflowTypes = (type: string) =>
    type.startsWith('application_') ||
    type.startsWith('hire_') ||
    type.startsWith('contract_') ||
    type === 'negotiation_updated' ||
    type === 'deal_confirmed' ||
    type === 'work_started' ||
    type === 'work_completed' ||
    type === 'completion_confirmed' ||
    type === 'review_available' ||
    type === 'review_required' ||
    type === 'review_received';

  const notificationCount = unreadNotifications?.length || 0;
  const workflowCount = (unreadNotifications || []).filter((notification: any) => workflowTypes(notification.type)).length;

  return { messageCount, notificationCount, workflowCount };
}

async function fetchCounts(session: UserSession): Promise<UnreadCounts> {
  if (!supabase) return EMPTY_COUNTS;

  const { data, error } = await supabase.rpc('get_unread_counts');
  if (!error) {
    const counts = normalizeCounts(data);
    if (counts) return counts;
  }

  return getFallbackCounts(session.userId);
}

function ensureChannel(session: UserSession) {
  if (!supabase || session.channel) return;

  session.channel = supabase
    .channel(`opencomm:unread:${session.userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      (payload: any) => {
        emitEvent(session, {
          table: 'messages',
          eventType: payload.eventType,
          new: payload.new || {},
          old: payload.old || {}
        });
        void refresh(session.userId);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'conversations' },
      (payload: any) => {
        emitEvent(session, {
          table: 'conversations',
          eventType: payload.eventType,
          new: payload.new || {},
          old: payload.old || {}
        });
        void refresh(session.userId);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${session.userId}`
      },
      (payload: any) => {
        emitEvent(session, {
          table: 'notifications',
          eventType: payload.eventType,
          new: payload.new || {},
          old: payload.old || {}
        });
        void refresh(session.userId);
      }
    );

  const workflowTables: Array<UnreadRealtimeEvent['table']> = [
    'job_applications',
    'hiring_requests',
    'negotiation_messages',
    'deal_proposals',
    'work_contracts'
  ];

  workflowTables.forEach((table) => {
    session.channel = session.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: any) => {
        emitEvent(session, {
          table,
          eventType: payload.eventType,
          new: payload.new || {},
          old: payload.old || {}
        });
        void refresh(session.userId);
      }
    );
  });

  session.channel.subscribe();
}

function releaseSessionIfUnused(session: UserSession) {
  if (
    session.listeners.size > 0 ||
    session.messageListeners.size > 0 ||
    session.conversationListeners.size > 0 ||
    session.workflowListeners.size > 0 ||
    session.notificationListeners.size > 0
  ) {
    return;
  }

  if (supabase && session.channel) {
    void supabase.removeChannel(session.channel);
  }
  sessions.delete(session.userId);
}

export async function refresh(userId: string | null | undefined) {
  if (!userId) return;
  const session = getSession(userId);
  if (session.refreshPromise) return session.refreshPromise;

  session.refreshPromise = fetchCounts(session)
    .then((counts) => updateSnapshot(session, counts))
    .catch((error) => console.error('[UnreadService] Failed to refresh unread counts:', error))
    .finally(() => {
      session.refreshPromise = null;
    });

  return session.refreshPromise;
}

function subscribeToStore(userId: string | null | undefined, listener: Listener) {
  if (!userId) return () => {};
  const session = getSession(userId);
  session.listeners.add(listener);
  ensureChannel(session);
  void refresh(userId);

  return () => {
    session.listeners.delete(listener);
    releaseSessionIfUnused(session);
  };
}

function subscribeToEvents(
  userId: string | null | undefined,
  collection: 'messageListeners' | 'conversationListeners' | 'workflowListeners',
  listener: EventListener
) {
  if (!userId) return () => {};
  const session = getSession(userId);
  session[collection].add(listener);
  ensureChannel(session);
  void refresh(userId);

  return () => {
    session[collection].delete(listener);
    releaseSessionIfUnused(session);
  };
}

export const unreadService = {
  getSnapshot(userId: string | null | undefined): UnreadCounts {
    return userId ? getSession(userId).snapshot : EMPTY_COUNTS;
  },

  subscribe(userId: string | null | undefined, listener: Listener) {
    return subscribeToStore(userId, listener);
  },

  subscribeMessageEvents(userId: string | null | undefined, listener: EventListener) {
    return subscribeToEvents(userId, 'messageListeners', listener);
  },

  subscribeConversationEvents(userId: string | null | undefined, listener: EventListener) {
    return subscribeToEvents(userId, 'conversationListeners', listener);
  },

  subscribeWorkflowEvents(userId: string | null | undefined, listener: EventListener) {
    return subscribeToEvents(userId, 'workflowListeners', listener);
  },

  subscribeNotificationEvents(
    userId: string | null | undefined,
    listener: (notification: NotificationItem, event: UnreadRealtimeEvent) => void
  ) {
    if (!userId) return () => {};
    const session = getSession(userId);
    session.notificationListeners.add(listener);
    ensureChannel(session);
    void refresh(userId);

    return () => {
      session.notificationListeners.delete(listener);
      releaseSessionIfUnused(session);
    };
  },

  refresh
};

export function useUnreadCounts(userId: string | null | undefined): UnreadCounts {
  const subscribe = useCallback(
    (listener: Listener) => unreadService.subscribe(userId, listener),
    [userId]
  );
  const getSnapshot = useCallback(
    () => unreadService.getSnapshot(userId),
    [userId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
