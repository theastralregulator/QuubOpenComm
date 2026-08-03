import React, { useState, useEffect } from 'react';
import { Briefcase, Search, RefreshCw, AlertCircle, CheckCircle2, ExternalLink, Archive, XCircle, RotateCcw } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { Link } from 'react-router-dom';

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Moderation Modal
  const [targetJob, setTargetJob] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'close' | 'archive' | 'restore'>('close');
  const [reasonInput, setReasonInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('jobs')
        .select(`
          id, title, category, location, status, created_at,
          employer:posted_by (id, full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw err;
      setJobs(data || []);
    } catch (err: any) {
      console.error('Fetch jobs error:', err);
      setError(err.message || 'Failed to load jobs.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetJob || !reasonInput.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      await dbService.adminModerateJob(targetJob.id, actionType, reasonInput.trim());
      setToastMsg(`Job "${targetJob.title}" updated to status "${actionType}".`);
      setTargetJob(null);
      setReasonInput('');
      await fetchJobs();
    } catch (err: any) {
      console.error('Job moderation error:', err);
      setError(err.message || 'Failed to moderate job.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = jobs.filter(j => {
    const matchesSearch = (
      (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (j.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (j.employer?.full_name || '').toLowerCase().includes(search.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || j.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Job Postings Moderation</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Moderate employer job postings, enforce quality standards, close or archive listings</p>
        </div>
        <button
          onClick={fetchJobs}
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
            placeholder="Search by job title, category, or employer..."
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
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase tracking-wider text-[10px] font-bold">
              <tr>
                <th className="px-5 py-3">Job Title & Category</th>
                <th className="px-5 py-3">Employer</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Posted Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">Loading jobs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">No jobs found.</td>
                </tr>
              ) : (
                filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-extrabold text-slate-900 dark:text-white">{job.title}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{job.category || 'General'}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {job.employer?.full_name || 'Employer'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {job.location || 'Remote / Unspecified'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        job.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        job.status === 'closed' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="View Public Job Detail"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>

                        {job.status === 'active' && (
                          <button
                            onClick={() => {
                              setTargetJob(job);
                              setActionType('close');
                              setReasonInput('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="Close Job Posting"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {job.status !== 'archived' && (
                          <button
                            onClick={() => {
                              setTargetJob(job);
                              setActionType('archive');
                              setReasonInput('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Archive Job Posting"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}

                        {job.status !== 'active' && (
                          <button
                            onClick={() => {
                              setTargetJob(job);
                              setActionType('restore');
                              setReasonInput('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Restore Job Status to Active"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Moderation Modal */}
      {targetJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <Briefcase className="w-4 h-4 text-indigo-500" />
              <span>Job Action: {actionType.toUpperCase()}</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Job: <strong className="text-slate-900 dark:text-white">{targetJob.title}</strong>
            </p>

            <form onSubmit={handleActionSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <textarea
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={`Explain why this job is being set to ${actionType}...`}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-white resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetJob(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reasonInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Executing...' : `Confirm ${actionType.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
