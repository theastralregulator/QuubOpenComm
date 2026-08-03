import React, { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, ShieldAlert, RefreshCw, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';

export default function AdminFeatureFlags() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin';

  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toggle Modal
  const [targetFlag, setTargetFlag] = useState<any | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('platform_feature_flags')
        .select('*')
        .order('key');

      if (err) throw err;
      setFlags(data || []);
    } catch (err: any) {
      console.error('Fetch feature flags error:', err);
      setError(err.message || 'Failed to load feature flags.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFlag || !reasonInput.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const newStatus = !targetFlag.is_enabled;
      await dbService.adminSetFeatureFlag(targetFlag.key, newStatus, reasonInput.trim());
      setToastMsg(`Feature flag "${targetFlag.key}" ${newStatus ? 'enabled' : 'disabled'} successfully.`);
      setTargetFlag(null);
      setReasonInput('');
      await fetchFlags();
    } catch (err: any) {
      console.error('Toggle feature flag error:', err);
      setError(err.message || 'Failed to toggle feature flag.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Platform Feature Flags</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Control platform module availability dynamically across web applications
          </p>
        </div>
        <button
          onClick={fetchFlags}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-center space-x-2 font-bold">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Read-Only View: Only Super Admins are authorized to toggle platform feature flags.</span>
        </div>
      )}

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

      {/* Feature Flags Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-slate-400 text-xs">Loading feature flags...</div>
        ) : (
          flags.map((flag) => (
            <div key={flag.key} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">
                  {flag.key}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  flag.is_enabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {flag.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {flag.description}
              </p>

              {isSuperAdmin && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                  <button
                    onClick={() => {
                      setTargetFlag(flag);
                      setReasonInput('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
                      flag.is_enabled
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                        : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    {flag.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    <span>{flag.is_enabled ? 'Disable Flag' : 'Enable Flag'}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Toggle Modal */}
      {targetFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Toggle Feature Flag: {targetFlag.key}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Are you sure you want to {targetFlag.is_enabled ? 'disable' : 'enable'} this feature flag? A mandatory audit log entry will be created.
            </p>

            <form onSubmit={handleToggleSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Explain why this feature flag state is being modified..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetFlag(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
