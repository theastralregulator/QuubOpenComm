import React, { useState } from 'react';
import { Bell, Send, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { dbService, supabase } from '../../lib/supabase';

export default function AdminNotifications() {
  const [recipientSearch, setRecipientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetUrl, setTargetUrl] = useState('/notifications');
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientSearch.trim() || !supabase) return;
    setSearching(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${recipientSearch}%,email.ilike.%${recipientSearch}%`)
        .limit(5);

      if (err) throw err;
      setSearchResults(data || []);
    } catch (err: any) {
      console.error('Search user error:', err);
      setError(err.message || 'Failed to search users.');
    } finally {
      setSearching(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !title.trim() || !message.trim() || !reason.trim()) return;

    setSubmitting(true);
    setError(null);
    setToastMsg(null);
    try {
      await dbService.adminSendPlatformNotification(
        selectedUser.id,
        title.trim(),
        message.trim(),
        targetUrl.trim() || '/notifications',
        reason.trim()
      );

      setToastMsg(`Notification sent successfully to ${selectedUser.full_name || selectedUser.email}!`);
      setTitle('');
      setMessage('');
      setReason('');
      setSelectedUser(null);
      setSearchResults([]);
      setRecipientSearch('');
    } catch (err: any) {
      console.error('Send notification error:', err);
      setError(err.message || 'Failed to send notification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white">Admin System Notifications</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400">
          Dispatch targeted system announcements directly to individual platform users
        </p>
      </div>

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recipient Selector & Form */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xs">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">1. Select Recipient User</h3>

          <form onSubmit={handleSearchUsers} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search user name or email..."
                value={recipientSearch}
                onChange={(e) => setRecipientSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={searching || !recipientSearch.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 border border-slate-100 dark:border-zinc-800 rounded-2xl p-2 max-h-48 overflow-y-auto">
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`p-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    selectedUser?.id === u.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div>
                    <p className="font-bold">{u.full_name || 'Member'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{u.email}</p>
                  </div>
                  {selectedUser?.id === u.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                </div>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-700 dark:text-indigo-300 font-bold">
              Selected Recipient: <span className="underline">{selectedUser.full_name}</span> ({selectedUser.email})
            </div>
          )}

          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white pt-2">2. Notification Details</h3>

          <form onSubmit={handleSendNotification} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Notification Title</label>
              <input
                type="text"
                placeholder="e.g. Account Notice / Policy Update"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Message Content</label>
              <textarea
                rows={3}
                placeholder="Describe the system notice..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                className="w-full p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Action URL</label>
              <input
                type="text"
                placeholder="/notifications"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
              <input
                type="text"
                placeholder="Why is this notification being dispatched?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedUser || !title.trim() || !message.trim() || !reason.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Notification</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Live In-App Notification Preview</h3>
          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-start space-x-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  {title || 'Notification Title Preview'}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {message || 'Your notification message content will appear here...'}
                </p>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono block pt-1">
                  Target: {targetUrl || '/notifications'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Note: Bulk broadcasting loops are blocked for server performance and security. Platform notices are sent to individual verified user IDs with full audit logging.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
