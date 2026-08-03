import React, { useState, useEffect } from 'react';
import { 
  Users, User, Briefcase, FileText, Star, AlertOctagon,
  RefreshCw, AlertCircle, ShieldCheck, CheckCircle2, MessageSquare, LifeBuoy
} from 'lucide-react';
import { dbService } from '../../lib/supabase';
import { DashboardAnalyticsPayload } from '../../types';

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dbService.adminGetDashboardAnalytics();
      if (!res) throw new Error('Could not load dashboard analytics.');
      setData(res);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error('Fetch dashboard analytics error:', err);
      setError(err.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  const cards = data ? [
    { title: 'Total Platform Users', value: data.total_users, subtitle: `${data.active_users} Active • ${data.suspended_users} Suspended`, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { title: 'Worker Profiles', value: data.worker_users, subtitle: `Out of ${data.total_users} total users`, icon: User, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { title: 'Job Postings', value: data.total_jobs, subtitle: `${data.active_jobs} Active • ${data.closed_jobs} Closed`, icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { title: 'Work Contracts', value: data.total_contracts, subtitle: `${data.active_contracts} Active • ${data.completed_contracts} Completed`, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    { title: 'Platform Reviews', value: data.total_reviews, subtitle: `Avg Rating: ${data.platform_average_rating} ⭐`, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { title: 'Pending Review Reports', value: data.pending_review_reports, subtitle: `${data.unread_support_tickets} Open Support Tickets`, icon: AlertOctagon, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  ] : [];

  return (
    <div className="space-y-6 text-left">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Real-time platform statistics direct from PostgreSQL database queries
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {lastRefreshed && (
            <span className="text-[10px] text-slate-400 font-mono">
              Refreshed at: {lastRefreshed}
            </span>
          )}
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 space-y-3 animate-pulse">
              <div className="h-4 w-24 bg-slate-200 dark:bg-zinc-800 rounded" />
              <div className="h-8 w-16 bg-slate-200 dark:bg-zinc-800 rounded" />
            </div>
          ))
        ) : (
          cards.map((card, idx) => (
            <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center justify-between shadow-2xs">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">{card.title}</p>
                <div className="text-3xl font-black text-slate-900 dark:text-white">
                  {card.value}
                </div>
                <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">{card.subtitle}</p>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.bg} ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Secondary Detailed Breakdown */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* User & Workflow Metrics */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>User & Application Workflows</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Basic Users</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.basic_users}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Company Users</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.company_users}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Job Applications</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.total_applications}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Direct Hires</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.active_hire_requests}</span>
              </div>
            </div>
          </div>

          {/* Contracts & Notifications Metrics */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Contracts & System Activity</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Completed Contracts</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{data.completed_contracts}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Cancelled Contracts</span>
                <span className="text-lg font-black text-rose-600 dark:text-rose-400">{data.cancelled_contracts}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Negotiations</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.active_negotiations}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Notifications (24h)</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{data.notifications_last_24h}</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
