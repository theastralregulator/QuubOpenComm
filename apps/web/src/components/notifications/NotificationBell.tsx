import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ExternalLink, MessageSquare, Briefcase, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService, NotificationItem } from '../../lib/notificationService';
import { unreadService, useUnreadCounts } from '../../lib/unreadService';

interface NotificationBellProps {
  currentUserId?: string | null;
  unreadCount?: number;
  onNotificationStateChange?: () => void;
}

export default function NotificationBell({
  currentUserId,
  unreadCount,
  onNotificationStateChange,
}: NotificationBellProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { notificationCount: unreadCount } = useUnreadCounts(currentUserId || null);

  const fetchInitialData = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const items = await notificationService.getMyNotifications({ limit: 5 });
      setNotifications(items);
      await unreadService.refresh(currentUserId);
    } catch (err) {
      console.error('Error fetching bell data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    fetchInitialData();

    const unsubscribe = unreadService.subscribeNotificationEvents(currentUserId, (newNotif, event) => {
      setNotifications((prev) => {
        if (event.eventType === 'DELETE') {
          return prev.filter((notification) => notification.id !== newNotif.id);
        }
        if (event.eventType === 'UPDATE') {
          return prev.map((notification) => notification.id === newNotif.id ? { ...notification, ...newNotif } : notification);
        }
        if (prev.some((notification) => notification.id === newNotif.id)) return prev;
        return [newNotif, ...prev].slice(0, 5);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, fetchInitialData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!isOpen) {
      fetchInitialData();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await notificationService.markRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      await unreadService.refresh(currentUserId);
    }
    setIsOpen(false);
    if (notif.target_url) {
      navigate(notif.target_url);
    }
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await unreadService.refresh(currentUserId);
  };

  const getCategoryIcon = (type: string) => {
    const category = getNotificationCategory(type);
    if (category === 'hire') return <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
    if (category === 'application') return <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
    if (category === 'contract' || category === 'review') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    if (category === 'message') return <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
    return <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
  };

  if (!userId) return null;

  const displayedUnreadCount = unreadCount ?? localUnreadCount;
  const displayedUnreadLabel = formatBadgeCount(displayedUnreadCount);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
        aria-label={hasVisibleBadge(displayedUnreadCount) ? `Notifications, ${displayedUnreadLabel} unread` : 'Notifications'}
      >
        <Bell className="w-4 h-4" />
        {hasVisibleBadge(displayedUnreadCount) && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-white font-extrabold text-[10px] animate-pulse ring-2 ring-white dark:ring-[#0B0F19]">
            {displayedUnreadLabel}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden text-left"
          >
            {/* Dropdown Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Notifications</h3>
                {hasVisibleBadge(displayedUnreadCount) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                    {displayedUnreadLabel} new
                  </span>
                )}
              </div>
              {hasVisibleBadge(displayedUnreadCount) && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center space-x-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List Body */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No notifications right now.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-purple-500/5 transition-colors cursor-pointer flex items-start space-x-3 ${
                      !notif.is_read ? 'bg-purple-500/5 dark:bg-purple-950/20' : ''
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                      {getCategoryIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {notif.title}
                        </h4>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {notif.message}
                      </p>
                      <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 block mt-1">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/profile/notifications');
                }}
                className="w-full py-2 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>View All Notifications</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
