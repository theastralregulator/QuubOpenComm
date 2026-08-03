import React, { useState, useEffect } from 'react';
import { User, Eye, EyeOff, Search, RefreshCw, AlertCircle, CheckCircle2, ExternalLink, MapPin, Briefcase } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminWorkers() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Moderation Modal
  const [targetWorker, setTargetWorker] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'hide' | 'restore'>('hide');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('worker_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw err;
      setWorkers(data || []);
    } catch (err: any) {
      console.error('Fetch worker profiles error:', err);
      setError(err.message || 'Failed to load worker profiles.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWorker || !reasonInput.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await dbService.adminModerateWorkerProfile(targetWorker.id, actionType, reasonInput.trim());
      setToastMsg(`Worker profile "${targetWorker.full_name || 'Worker'}" ${actionType === 'hide' ? 'hidden' : 'restored'} successfully.`);
      setTargetWorker(null);
      setReasonInput('');
      await fetchWorkers();
    } catch (err: any) {
      console.error('Worker moderation error:', err);
      setError(err.message || 'Failed to update worker profile visibility.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = workers.filter(w => {
    return (
      (w.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.location || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Worker Directory Moderation</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Manage worker profile listings, inspect verification states, and toggle search visibility</p>
        </div>
        <button
          onClick={fetchWorkers}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

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

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by worker name, category, or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-5 py-3">Worker Profile</th>
                <th className="px-5 py-3">Profession / Skill</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Visibility Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Loading worker directory...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">No worker profiles found.</td>
                </tr>
              ) : (
                filtered.map((worker) => {
                  const isVisible = worker.is_visible !== false;

                  return (
                    <tr key={worker.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-700 dark:text-purple-400 font-bold shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{worker.full_name || 'Worker Profile'}</p>
                            <p className="text-[10px] font-mono text-slate-400">{worker.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {worker.category || worker.profession || 'General Contractor'}
                      </td>

                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                        {worker.location || 'Not specified'}
                      </td>

                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isVisible
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}>
                          {isVisible ? 'Visible in Search' : 'Hidden by Admin'}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/workers/${worker.id}`}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="View Public Worker Page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {isVisible ? (
                            <button
                              onClick={() => {
                                setTargetWorker(worker);
                                setActionType('hide');
                                setReasonInput('');
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hide Profile from Directory"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setTargetWorker(worker);
                                setActionType('restore');
                                setReasonInput('');
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Restore Profile Visibility"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Moderation Modal */}
      {targetWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              {actionType === 'hide' ? <EyeOff className="w-4 h-4 text-rose-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
              <span>{actionType === 'hide' ? 'Hide Worker Profile' : 'Restore Worker Profile'}</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Worker: <strong className="text-slate-900 dark:text-white">{targetWorker.full_name || 'Worker'}</strong>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={`Explain why this profile is being ${actionType === 'hide' ? 'hidden' : 'restored'}...`}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetWorker(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 ${
                    actionType === 'hide' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting ? 'Updating...' : `Confirm ${actionType === 'hide' ? 'Hide' : 'Restore'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
