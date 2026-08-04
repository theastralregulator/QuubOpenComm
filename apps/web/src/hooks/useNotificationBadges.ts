import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationService } from '../lib/notificationService';
import { NOTIFICATION_CHANGED_EVENT, dispatchNotificationBadgeRefresh } from '../lib/notificationEvents';

interface UseNotificationBadgesOptions {
  isLoggedIn: boolean;
  userId?: string | null;
}

export function useNotificationBadges({ isLoggedIn, userId }: UseNotificationBadgesOptions) {
  const [totalUnreadNotificationsCount, setTotalUnreadNotificationsCount] = useState(0);
  const [workflowUnreadNotificationsCount, setWorkflowUnreadNotificationsCount] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);

  const refreshNotificationBadges = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      setTotalUnreadNotificationsCount(0);
      setWorkflowUnreadNotificationsCount(0);
      return;
    }

    const [totalCount, workflowCount] = await Promise.all([
      notificationService.getUnreadCount(userId),
      notificationService.getUnreadWorkflowCount(userId),
    ]);

    setTotalUnreadNotificationsCount(totalCount);
    setWorkflowUnreadNotificationsCount(workflowCount);
  }, [isLoggedIn, userId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshNotificationBadges();
    }, 75);
  }, [refreshNotificationBadges]);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setTotalUnreadNotificationsCount(0);
      setWorkflowUnreadNotificationsCount(0);
      return;
    }

    refreshNotificationBadges();

    const unsubscribe = notificationService.subscribeToRealtime(userId, () => {
      scheduleRefresh();
    });
    window.addEventListener(NOTIFICATION_CHANGED_EVENT, scheduleRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener(NOTIFICATION_CHANGED_EVENT, scheduleRefresh);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [isLoggedIn, userId, refreshNotificationBadges, scheduleRefresh]);

  return {
    totalUnreadNotificationsCount,
    workflowUnreadNotificationsCount,
    refreshNotificationBadges,
  };
}
