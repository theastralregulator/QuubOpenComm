import { supabase } from './supabase';
import { unreadService } from './unreadService';

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  type: string;
  title: string;
  message: string;
  target_url: string;
  metadata?: Record<string, any>;
  dedupe_key?: string | null;
  is_read: boolean;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationPreferences {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  hire_notifications: boolean;
  application_notifications: boolean;
  contract_notifications: boolean;
  message_notifications: boolean;
  marketing_notifications: boolean;
  updated_at?: string;
}

export interface CreateNotificationParams {
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  target_url: string;
  actor_id?: string;
  metadata?: Record<string, any>;
  dedupe_key?: string;
}

export type NotificationRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';
async function refreshCurrentUserUnreadState(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await unreadService.refresh(user.id);
}

export const notificationService = {
  /**
   * Client-side notification creation is intentionally disabled. The
   * create_notification RPC is revoked from browser roles; workflow/admin
   * database RPCs are the trusted notification creation path.
   */
  async createNotification(params: CreateNotificationParams): Promise<string | null> {
    console.warn('[NotificationService] Ignoring client createNotification request for revoked RPC:', params.type);
    return null;
  },

  /**
   * Get Unread Notification Count
   */
  async getUnreadCount(userId?: string | null): Promise<number> {
    if (!supabase) return 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = userId || user?.id;
      if (!currentUserId) return 0;
      await unreadService.refresh(currentUserId);
      return unreadService.getSnapshot(currentUserId).notificationCount;
    } catch (err) {
      console.error('[NotificationService] Error fetching unread count:', err);
      return 0;
    }
  },

  /**
   * Get User Notifications (Paginated with filtering)
   */
  async getMyNotifications(params: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  } = {}): Promise<NotificationItem[]> {
    if (!supabase) return [];
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    const unreadOnly = params.unreadOnly || false;

    try {
      const { data, error } = await supabase.rpc('get_my_notifications', {
        p_limit: limit,
        p_offset: offset,
        p_unread_only: unreadOnly
      });

      if (!error && Array.isArray(data)) {
        return data;
      }

      // Fallback read query (allowed by SELECT RLS policy)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('notifications')
        .select(`
          id, recipient_id, actor_id, type, title, message, target_url, metadata, dedupe_key, is_read, created_at, read_at
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data: rawItems, error: queryError } = await query;
      if (queryError) throw queryError;

      return (rawItems || []).map((item: any) => ({
        ...item,
        actor_name: 'OpenComm User',
        actor_avatar_url: null
      }));
    } catch (err) {
      console.error('[NotificationService] Error fetching notifications:', err);
      return [];
    }
  },

  /**
   * Mark Single Notification as Read
   */
  async markRead(notificationId: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);
        if (updateError) throw updateError;
      }

      await refreshCurrentUserUnreadState();
      return true;
    } catch (err) {
      console.error('[NotificationService] Error marking notification read:', err);
      return false;
    }
  },

  /**
   * Mark All Notifications as Read
   */
  async markAllRead(): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('recipient_id', user.id)
            .eq('is_read', false);
        }
      }
      await refreshCurrentUserUnreadState();
      return true;
    } catch (err) {
      console.error('[NotificationService] Error marking all read:', err);
      return false;
    }
  },

  /**
   * Delete Notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.rpc('delete_notification', {
        p_notification_id: notificationId
      });

      if (error) {
        await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);
      }

      await refreshCurrentUserUnreadState();
      return true;
    } catch (err) {
      console.error('[NotificationService] Error deleting notification:', err);
      return false;
    }
  },

  /**
   * Fetch User Preferences
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_user_notification_preferences');
      if (!error && data) {
        return data as NotificationPreferences;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: prefRow } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (prefRow) return prefRow as NotificationPreferences;

      return {
        user_id: user.id,
        in_app_enabled: true,
        email_enabled: true,
        hire_notifications: true,
        application_notifications: true,
        contract_notifications: true,
        message_notifications: true,
        marketing_notifications: true
      };
    } catch (err) {
      console.error('[NotificationService] Error getting preferences:', err);
      return null;
    }
  },

  /**
   * Update User Preferences
   */
  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.rpc('upsert_user_notification_preferences', {
        p_in_app_enabled: prefs.in_app_enabled ?? true,
        p_email_enabled: prefs.email_enabled ?? true,
        p_hire_notifications: prefs.hire_notifications ?? true,
        p_application_notifications: prefs.application_notifications ?? true,
        p_contract_notifications: prefs.contract_notifications ?? true,
        p_message_notifications: prefs.message_notifications ?? true,
        p_marketing_notifications: prefs.marketing_notifications ?? true
      });

      if (error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('notification_preferences')
            .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() });
        }
      }

      return true;
    } catch (err) {
      console.error('[NotificationService] Error updating preferences:', err);
      return false;
    }
  },

  /**
   * Subscribe to Supabase Realtime Notifications safely
   */
  subscribeToRealtime(userId: string, callback: (notification: NotificationItem) => void) {
    return unreadService.subscribeNotificationEvents(userId, callback);
  }
};
