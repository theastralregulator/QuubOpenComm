import { useCallback, useEffect, useRef, useState } from 'react';
import { messageUnreadService } from '../lib/messageUnreadService';

interface UseUnreadMessagesOptions {
  isLoggedIn: boolean;
  userId?: string | null;
}

export function useUnreadMessages({ isLoggedIn, userId }: UseUnreadMessagesOptions) {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);

  const refreshUnreadMessagesCount = useCallback(async () => {
    if (!isLoggedIn || !userId) {
      setUnreadMessagesCount(0);
      return;
    }

    const count = await messageUnreadService.getUnreadCount(userId);
    setUnreadMessagesCount(count);
  }, [isLoggedIn, userId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshUnreadMessagesCount();
    }, 75);
  }, [refreshUnreadMessagesCount]);

  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setUnreadMessagesCount(0);
      return;
    }

    refreshUnreadMessagesCount();

    const unsubscribe = messageUnreadService.subscribeToUnreadChanges(userId, scheduleRefresh);
    window.addEventListener(messageUnreadService.eventName, scheduleRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener(messageUnreadService.eventName, scheduleRefresh);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [isLoggedIn, userId, refreshUnreadMessagesCount, scheduleRefresh]);

  return {
    unreadMessagesCount,
    refreshUnreadMessagesCount,
  };
}
