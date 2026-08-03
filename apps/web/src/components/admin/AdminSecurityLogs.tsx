import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw, AlertCircle, Lock, Code } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';

export default function AdminSecurityLogs() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin';

  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) fetchLogs();
  }, [isSuperAdmin]);

  const fetchLogs = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('admin_security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw err;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Fetch security logs error:', err);
      setError(err.message || 'Failed to load security logs.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <Lock className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-xs text-slate-500 dark:text-zinc-400">Security logs are restricted exclusively to Super Admins.</p>
      </div>
    );
  }

  const filtered = logs.filter(l => {
    return (
      (l.event_type || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.user_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.admin_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.ip_address || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Admin Security Logs</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Append-only immutable record of platform security events, authentication anomalies, and privileged actions</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter security events by type, IP or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-white"
        />
      </div>

      {/* Security Logs List */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Event Type</th>
                <th className="p-3.5">Admin / User ID</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Loading security logs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center space-y-2">
                    <ShieldAlert className="w-8 h-8 text-slate-300 dark:text-zinc-700 mx-auto" />
                    <p className="font-bold text-slate-700 dark:text-slate-300">No Security Events Recorded</p>
                    <p className="text-[11px] text-slate-400">Platform authentication anomalies and security events will log here automatically.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                        {log.admin_id || log.user_id || 'System'}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-500">
                        {log.ip_address || 'Internal'}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 rounded-lg text-[10px] font-bold inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Code className="w-3 h-3" />
                          <span>{expandedLogId === log.id ? 'Hide' : 'Inspect'}</span>
                        </button>
                      </td>
                    </tr>

                    {expandedLogId === log.id && (
                      <tr className="bg-slate-900 text-slate-200">
                        <td colSpan={5} className="p-4">
                          <pre className="text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(log.details || {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
