import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, AlertCircle, Calendar, ShieldCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';

export default function AdminContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('work_contracts')
        .select(`
          id, work_title, final_price, status, created_at, confirmed_at, completed_at, cancelled_at,
          hiring_request_id, job_application_id,
          client:client_id (id, full_name, email),
          worker:worker_id (id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      const { data, error: err } = await query;
      if (err) throw err;
      setContracts(data || []);
    } catch (err: any) {
      console.error('Fetch contracts error:', err);
      setError(err.message || 'Failed to load contracts.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = contracts.filter(c => {
    const matchesSearch = (
      (c.work_title || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.client?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.worker?.full_name || '').toLowerCase().includes(search.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Work Contracts Oversight</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Read-only platform contract tracking across Direct Hire and Job Applications</p>
        </div>
        <button
          onClick={fetchContracts}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, contract ID, client or worker..."
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
          <option value="completion_requested">Completion Requested</option>
          <option value="completed">Completed</option>
          <option value="cancellation_requested">Cancellation Requested</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl text-xs text-red-600 dark:text-red-400 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Contracts Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Contract Title & ID</th>
                <th className="p-3.5">Workflow Source</th>
                <th className="p-3.5">Client</th>
                <th className="p-3.5">Worker</th>
                <th className="p-3.5">Agreed Rate</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading contracts...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No work contracts found matching filters.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="p-3.5">
                      <p className="font-extrabold text-slate-900 dark:text-white">{c.work_title}</p>
                      <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {c.hiring_request_id ? 'Direct Hire' : 'Job Application'}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {c.client?.full_name || 'Client'}
                    </td>
                    <td className="p-3.5 font-medium text-purple-600 dark:text-purple-400">
                      {c.worker?.full_name || 'Worker'}
                    </td>
                    <td className="p-3.5 font-extrabold text-slate-900 dark:text-white">
                      {formatINR(c.final_price || 0)}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        c.status === 'active' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' :
                        c.status === 'cancelled' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400 font-mono text-[10px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
