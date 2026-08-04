export const NOTIFICATION_CHANGED_EVENT = 'opencomm:notifications-changed';

export function dispatchNotificationBadgeRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATION_CHANGED_EVENT));
  }
}
