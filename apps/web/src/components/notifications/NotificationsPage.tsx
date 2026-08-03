import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ArrowLeft, Check, Trash2, Search, Settings, Briefcase, FileText,
  CheckCircle2, MessageSquare, AlertCircle, Filter, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService, NotificationItem } from '../../lib/notificationService';
import { supabase } from '../../lib/supabase';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'hire' | 'application' | 'contract' | 'message'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = notificationService.subscribeToRealtime(currentUserId, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setCurrentUserId(user.id);
      }
      const items = await notificationService.getMyNotifications({ limit: 100 });
      setNotifications(items);
    } catch (err: any) {
      console.error('Error fetching notifications:', err);
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await notificationService.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await notificationService.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      await handleMarkRead(notif.id);
    }
    if (notif.target_url) {
      navigate(notif.target_url);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread' && item.is_read) return false;
    if (activeTab === 'hire' && !item.type.startsWith('hire_')) return false;
    if (activeTab === 'application' && !item.type.startsWith('application_')) return false;
    if (activeTab === 'contract' && !item.type.startsWith('contract_')) return false;
    if (activeTab === 'message' && !item.type.startsWith('message_')) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Time Grouping Logic
  const groupNotificationsByTime = (items: NotificationItem[]) => {
    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; items: NotificationItem[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'This Week', items: [] },
      { label: 'Older', items: [] },
    ];

    items.forEach((item) => {
      const itemDate = new Date(item.created_at);
      const itemDateStr = itemDate.toDateString();

      if (itemDateStr === todayStr) {
        groups[0].items.push(item);
      } else if (itemDateStr === yesterdayStr) {
        groups[1].items.push(item);
      } else if (itemDate >= weekAgo) {
        groups[2].items.push(item);
      } else {
        groups[3].items.push(item);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  };

  const groupedList = groupNotificationsByTime(filteredNotifications);
  const unreadTotal = notifications.filter((n) => !n.is_read).length;

  const getCategoryIcon = (type: string) => {
    if (type.startsWith('hire_')) return <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    if (type.startsWith('application_')) return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    if (type.startsWith('contract_')) return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    if (type.startsWith('message_')) return <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
    return <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  };

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_55%,#FAFCFF_100%)] dark:bg-[#080C14] min-h-screen text-left">
      <div className="w-full max-w-4xl mx-auto px-2.5 sm:px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom))] space-y-4">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-800"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight">
                  Notifications
                </h1>
                {unreadTotal > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                    {unreadTotal} unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Stay updated with activity across hires, applications, contracts, and messages.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {unreadTotal > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Read</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/profile/notification-settings')}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-2xs"
              title="Notification Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Tabs Controls */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3 space-y-3 shadow-2xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'hire', label: 'Hire Requests' },
              { id: 'application', label: 'Job Applications' },
              { id: 'contract', label: 'Contracts' },
              { id: 'message', label: 'Messages' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                    : 'bg-white dark:bg-[#111827] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-6 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">Unable to load notifications</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
            <button
              type="button"
              onClick={fetchData}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 text-xs font-bold rounded-xl"
            >
              Retry
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3 shadow-xs">
            <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No notifications found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery ? 'Try clearing your search query or switching filters.' : 'You are all caught up! New notifications will appear here in real-time.'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedList.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono px-1">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex items-start space-x-3.5 ${
                        !notif.is_read ? 'border-l-4 border-l-purple-600 bg-purple-500/5 dark:bg-purple-950/20' : ''
                      }`}
                    >
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 mt-0.5">
                        {getCategoryIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line">
                          {notif.message}
                        </p>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {!notif.is_read && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkRead(notif.id, e)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-purple-600 cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(notif.id, e)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
