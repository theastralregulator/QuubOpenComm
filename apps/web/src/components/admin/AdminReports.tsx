import React, { useState, useEffect } from 'react';
import { AlertOctagon, CheckCircle2, EyeOff, XCircle, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Resolution Modal
  const [targetReport, setTargetReport] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'dismiss' | 'hide_review' | 'mark_actioned'>('dismiss');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('review_reports')
        .select(`
          id, reason, details, status, created_at,
          reporter:reporter_id (full_name, email),
          review:review_id (id, rating, title, comment, is_public, contract:contract_id (work_title))
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setReports(data || []);
    } catch (err: any) {
      console.error('Fetch review reports error:', err);
      setError(err.message || 'Failed to load review reports.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetReport || !reasonInput.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await dbService.adminResolveReviewReport(targetReport.id, actionType, reasonInput.trim());
      setToastMsg(`Report resolved with action "${actionType}".`);
      setTargetReport(null);
      setReasonInput('');
      await fetchReports();
    } catch (err: any) {
      console.error('Report resolution error:', err);
      setError(err.message || 'Failed to resolve report.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = reports.filter(r => {
    const matchesSearch = (
      (r.reason || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.details || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.reporter?.full_name || '').toLowerCase().includes(search.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Review Reports & Abuse Moderation</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Review reported contract feedback, dismiss false flags, or hide inappropriate reviews</p>
        </div>
        <button
          onClick={fetchReports}
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
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by reason, details or reporter name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
        >
          <option value="pending">Pending Reports</option>
          <option value="actioned">Actioned</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All Reports</option>
        </select>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 p-8 text-center text-slate-400 text-xs">Loading review reports...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 p-8 text-center text-slate-400 text-xs">No reports found matching filters.</div>
        ) : (
          filtered.map((rep) => (
            <div key={rep.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 shadow-2xs">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 font-mono block">
                    Reason: {rep.reason}
                  </span>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Reported by: <span className="font-bold text-slate-900 dark:text-white">{rep.reporter?.full_name || 'Member'}</span>
                  </p>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  rep.status === 'pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                  rep.status === 'actioned' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                  'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                }`}>
                  {rep.status}
                </span>
              </div>

              {rep.details && (
                <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                  "{rep.details}"
                </p>
              )}

              {/* Target Review Snippet */}
              {rep.review && (
                <div className="p-3 bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block font-mono">
                    Target Review ({rep.review.rating} ⭐)
                  </span>
                  {rep.review.title && <p className="font-bold text-slate-900 dark:text-white">"{rep.review.title}"</p>}
                  {rep.review.comment && <p className="text-slate-600 dark:text-slate-400 line-clamp-2">{rep.review.comment}</p>}
                </div>
              )}

              {rep.status === 'pending' && (
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    onClick={() => {
                      setTargetReport(rep);
                      setActionType('dismiss');
                      setReasonInput('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Dismiss Report
                  </button>

                  <button
                    onClick={() => {
                      setTargetReport(rep);
                      setActionType('hide_review');
                      setReasonInput('');
                    }}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Review</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Resolution Modal */}
      {targetReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 text-amber-500" />
              <span>Resolve Report: {actionType.replace('_', ' ').toUpperCase()}</span>
            </h3>

            <form onSubmit={handleResolutionSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Resolution Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={`Explain why this report is being ${actionType}...`}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetReport(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
