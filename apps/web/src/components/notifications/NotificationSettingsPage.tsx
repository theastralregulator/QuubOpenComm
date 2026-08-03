import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Mail, Briefcase, FileText, CheckCircle2, MessageSquare, Sparkles, Loader2, Save } from 'lucide-react';
import { notificationService, NotificationPreferences } from '../../lib/notificationService';

export default function NotificationSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: '',
    in_app_enabled: true,
    email_enabled: true,
    hire_notifications: true,
    application_notifications: true,
    contract_notifications: true,
    message_notifications: true,
    marketing_notifications: true
  });

  useEffect(() => {
    fetchPrefs();
  }, []);

  const fetchPrefs = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getPreferences();
      if (data) {
        setPrefs(data);
      }
    } catch (err) {
      console.error('Error loading notification preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const ok = await notificationService.updatePreferences(prefs);
      if (ok) {
        setSuccessMsg('Notification preferences saved successfully!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_55%,#FAFCFF_100%)] dark:bg-[#080C14] min-h-screen text-left">
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-[calc(110px+env(safe-area-inset-bottom))] space-y-5">

        {/* Header */}
        <div className="flex items-center space-x-3 pt-1">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer border border-slate-200/60 dark:border-slate-800"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight">
              Notification Preferences
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Manage how and when you receive notifications on Quub/OpenComm.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300">
            ✓ {successMsg}
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-pulse h-64" />
        ) : (
          <form onSubmit={handleSave} className="space-y-4">

            {/* Channels Card */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                Notification Channels
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">In-App Push Notifications</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Real-time alerts and badges inside OpenComm</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.in_app_enabled}
                      onChange={() => handleToggle('in_app_enabled')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Email Digest & Alerts</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Important activity updates sent to your registered email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.email_enabled}
                      onChange={() => handleToggle('email_enabled')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Categories Card */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                Category Subscriptions
              </h3>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Direct Hire Requests</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">New requests, declines, and direct discussions</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.hire_notifications}
                      onChange={() => handleToggle('hire_notifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Job Applications</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Submissions, shortlists, and status changes</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.application_notifications}
                      onChange={() => handleToggle('application_notifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Contracts & Work Agreements</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Agreements, completions, and cancellations</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.contract_notifications}
                      onChange={() => handleToggle('contract_notifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Direct & Work Messages</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Chat activity when you are not actively viewing thread</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.message_notifications}
                      onChange={() => handleToggle('message_notifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Platform News & Updates</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Occasional updates about feature releases and tips</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.marketing_notifications}
                      onChange={() => handleToggle('marketing_notifications')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-6 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-extrabold text-xs shadow-xs hover:opacity-95 cursor-pointer flex items-center space-x-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Preferences...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
