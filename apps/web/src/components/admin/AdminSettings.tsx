import React, { useState, useEffect } from 'react';
import { Settings, ShieldAlert, Server, CheckCircle2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';

export default function AdminSettings() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin';

  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Maintenance Toggle Modal
  const [showModal, setShowModal] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'system.maintenance_mode')
        .maybeSingle();

      if (fetchErr) {
        console.error('Fetch settings error:', fetchErr);
        setError(fetchErr.message || 'Failed to load site settings.');
      } else if (data && data.value) {
        setMaintenanceMode(Boolean(data.value.enabled));
        setMaintenanceMsg(data.value.message || 'Scheduled platform maintenance in progress.');
      } else {
        setMaintenanceMode(false);
        setMaintenanceMsg('Scheduled platform maintenance in progress.');
      }
    } catch (err: any) {
      console.error('Fetch settings error:', err);
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const newEnabled = !maintenanceMode;
      await dbService.adminToggleMaintenanceMode(newEnabled, maintenanceMsg.trim(), reasonInput.trim());
      setToastMsg(`Maintenance mode ${newEnabled ? 'enabled' : 'disabled'} successfully.`);
      setMaintenanceMode(newEnabled);
      setShowModal(false);
      setReasonInput('');
    } catch (err: any) {
      console.error('Toggle maintenance error:', err);
      setError(err.message || 'Failed to toggle maintenance mode.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Platform Configuration & Settings</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Manage platform operational configuration and maintenance controls</p>
        </div>
        <button
          onClick={fetchSettings}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-2">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>Read-Only Access: Critical system configurations require Super Admin authorization.</span>
        </div>
      )}

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Maintenance Mode Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-600 dark:text-amber-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Platform Maintenance Mode</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Current status: <span className="font-bold">{maintenanceMode ? 'ACTIVE (Read-Only Maintenance)' : 'Inactive (Normal Operations)'}</span>
              </p>
            </div>
          </div>

          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            maintenanceMode ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
          }`}>
            {maintenanceMode ? 'Maintenance Enabled ⚠️' : 'Normal Operations'}
          </span>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Public Maintenance Notice Message</label>
          <input
            type="text"
            value={maintenanceMsg}
            onChange={(e) => setMaintenanceMsg(e.target.value)}
            disabled={!isSuperAdmin}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white"
          />
        </div>

        {isSuperAdmin && (
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setShowModal(true);
                setReasonInput('');
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition-colors ${
                maintenanceMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode ⚠️'}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>{maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              A mandatory audit log entry will be created for this operational toggle.
            </p>

            <form onSubmit={handleToggleMaintenance} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Explain why maintenance mode state is being changed..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Executing...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
