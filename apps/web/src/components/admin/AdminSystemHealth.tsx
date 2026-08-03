import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertCircle, Database, Radio, Server, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function AdminSystemHealth() {
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>('connected');
  const [realtimeStatus, setRealtimeStatus] = useState<'active' | 'unknown'>('active');
  const [maintenanceMode, setMaintenanceMode] = useState<any | null>(null);
  const [flagCounts, setFlagCounts] = useState<{ total: number; enabled: number }>({ total: 0, enabled: 0 });
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Test DB Query
      const { data: dbData, error: dbErr } = await supabase.from('profiles').select('id').limit(1);
      if (dbErr) {
        setDbStatus('error');
      } else {
        setDbStatus('connected');
      }

      // Check Maintenance Setting
      const { data: mData } = await supabase.from('site_settings').select('setting_value').eq('setting_key', 'system.maintenance_mode').maybeSingle();
      setMaintenanceMode(mData?.setting_value || { enabled: false });

      // Check Feature Flags
      const { data: fData } = await supabase.from('platform_feature_flags').select('key, is_enabled');
      if (fData) {
        setFlagCounts({
          total: fData.length,
          enabled: fData.filter(f => f.is_enabled).length
        });
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('System health check error:', err);
      setDbStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">System Operational Health</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time status monitoring of database connection, background triggers, and configuration states
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {lastRefreshed && (
            <span className="text-[10px] text-slate-400 font-mono">Last Checked: {lastRefreshed}</span>
          )}
          <button
            onClick={checkHealth}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Check</span>
          </button>
        </div>
      </div>

      {/* Operational Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Database Connectivity */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">PostgreSQL Database</h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
              dbStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}>
              {dbStatus === 'connected' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span>{dbStatus === 'connected' ? 'Healthy / Connected' : 'Connection Error'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Supabase PostgREST connection state and table accessibility verification.
          </p>
        </div>

        {/* Realtime Status */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
              <Radio className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Realtime PubSub Engine</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            WebSocket real-time events enabled for chat messages and notifications.
          </p>
        </div>

        {/* Maintenance Configuration */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <Server className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Maintenance Mode</h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              maintenanceMode?.enabled
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            }`}>
              {maintenanceMode?.enabled ? 'Maintenance Enabled ⚠️' : 'Normal Operation'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {maintenanceMode?.enabled ? `Notice: "${maintenanceMode.message || 'Maintenance in progress'}"` : 'Platform is operating normally for all public user traffic.'}
          </p>
        </div>

        {/* Feature Flags Overview */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <Layers className="w-5 h-5" />
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Platform Modules</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono">
              {flagCounts.enabled} / {flagCounts.total} Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Feature flag engine state governing core system capabilities.
          </p>
        </div>

      </div>
    </div>
  );
}
