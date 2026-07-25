import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, User, Briefcase, Building2, 
  CheckCircle, AlertOctagon, Activity, ChevronRight
} from 'lucide-react';
import { useAdminSession } from '../../hooks/useAdminSession';

export default function AdminDashboard() {
  const { hasPermission } = useAdminSession();
  const [stats, setStats] = useState({
    users: 0,
    workers: 0,
    jobs: 0,
    companies: 0,
    reports: 0,
    verifications: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      setIsLoading(true);
      
      // Load real counts from DB
      const [
        { count: usersCount },
        { count: workersCount },
        { count: jobsCount },
        { count: companiesCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('worker_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        users: usersCount || 0,
        workers: workersCount || 0,
        jobs: jobsCount || 0,
        companies: companiesCount || 0,
        reports: 0, // Mock for now until reports table exists
        verifications: 0 // Mock for now
      });

      setIsLoading(false);
    }
    loadStats();
  }, []);

  const statCards = [
    { title: 'Total Users', value: stats.users, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { title: 'Worker Profiles', value: stats.workers, icon: User, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    { title: 'Published Jobs', value: stats.jobs, icon: Briefcase, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { title: 'Companies', value: stats.companies, icon: Building2, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { title: 'Pending Verifications', value: stats.verifications, icon: CheckCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { title: 'Open Reports', value: stats.reports, icon: AlertOctagon, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Real-time platform statistics and pending actions.</p>
        </div>
        <div className="flex space-x-2">
          <select className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm rounded-lg px-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>This month</option>
            <option>All time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1">{card.title}</p>
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {isLoading ? <div className="h-8 w-16 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" /> : card.value}
              </div>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} ${card.color}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center">
              <Activity className="w-4 h-4 mr-2 text-indigo-500" />
              Recent System Activity
            </h3>
            <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
              View all <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-3 text-sm">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-200 dark:bg-zinc-800" />
                <div className="flex-1">
                  <p className="text-slate-900 dark:text-white">
                    <span className="font-semibold">User #{1000 + i}</span> registered an account
                  </p>
                  <p className="text-xs text-slate-500">{i * 10} minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center">
              <AlertOctagon className="w-4 h-4 mr-2 text-red-500" />
              Pending Moderation
            </h3>
            <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
              Go to queue <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Inbox Zero</p>
            <p className="text-xs text-slate-500 mt-1">No pending reports to moderate.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
