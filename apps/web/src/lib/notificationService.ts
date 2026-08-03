import { supabase } from './supabase';

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
}

export const notificationService = {
  /**
   * Centralized Helper to Create a Notification across all modules
   */
  async createNotification(params: CreateNotificationParams): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const actorId = params.actor_id || user?.id;

      // Do not notify self
      if (actorId && actorId === params.recipient_id) {
        return null;
      }

      // Try RPC first
      const { data, error } = await supabase.rpc('create_notification', {
        p_recipient_id: params.recipient_id,
        p_type: params.type,
        p_title: params.title,
        p_message: params.message,
        p_target_url: params.target_url,
        p_actor_id: actorId || null,
        p_metadata: params.metadata || {}
      });

      if (!error) {
        return data;
      }

      // Fallback direct table insert if RPC unavailable
      const { data: inserted, error: insertError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: params.recipient_id,
          actor_id: actorId || null,
          type: params.type,
          title: params.title,
          message: params.message,
          target_url: params.target_url,
          metadata: params.metadata || {},
          is_read: false
        })
        .select('id')
        .single();

      if (insertError) {
        console.warn('[NotificationService] Fallback insert failed:', insertError);
        return null;
      }

      return inserted?.id || null;
    } catch (err) {
      console.error('[NotificationService] Error creating notification:', err);
      return null;
    }
  },

  /**
   * Get Unread Notification Count
   */
  async getUnreadCount(): Promise<number> {
    if (!supabase) return 0;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase.rpc('get_unread_notification_count');
      if (!error && typeof data === 'number') {
        return data;
      }

      const { count, error: countError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      if (countError) return 0;
      return count || 0;
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

      // Fallback query
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('notifications')
        .select(`
          id, recipient_id, actor_id, type, title, message, target_url, metadata, is_read, created_at, read_at
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
   * Subscribe to Supabase Realtime Notifications
   */
  subscribeToRealtime(userId: string, callback: (notification: NotificationItem) => void) {
    if (!supabase || !userId) return () => {};

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`
        },
        (payload: any) => {
          if (payload.new) {
            callback(payload.new as NotificationItem);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
