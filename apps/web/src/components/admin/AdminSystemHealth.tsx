import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertCircle, Database, Radio, Server, Layers, MapPin, Globe, ShieldAlert, Lock, Settings2, ArrowRightLeft } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';
import { useAdminSession } from '../../hooks/useAdminSession';

export default function AdminSystemHealth() {
  const { adminUser } = useAdminSession();
  const isSuperAdmin = adminUser?.role === 'super_admin' || adminUser?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>('connected');
  const [maintenanceMode, setMaintenanceMode] = useState<any | null>(null);
  const [flagCounts, setFlagCounts] = useState<{ total: number; enabled: number }>({ total: 0, enabled: 0 });
  const [locationHealth, setLocationHealth] = useState<any | null>(null);
  const [mediaHealth, setMediaHealth] = useState<any | null>(null);
  const [mediaStatus, setMediaStatus] = useState<any | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Provider Switching Modal State
  const [showModal, setShowModal] = useState(false);
  const [targetProvider, setTargetProvider] = useState<'b2' | 'cloudinary'>('b2');
  const [targetAutoFallback, setTargetAutoFallback] = useState<boolean>(true);
  const [reasonInput, setReasonInput] = useState('');
  const [submittingSwitch, setSubmittingSwitch] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchToast, setSwitchToast] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Test DB Query
      const { error: dbErr } = await supabase.from('profile_directory').select('id').limit(1);
      if (dbErr) {
        setDbStatus('error');
      } else {
        setDbStatus('connected');
      }

      // Check Maintenance Setting
      const { data: mData } = await supabase.from('site_settings').select('value').eq('key', 'system.maintenance_mode').maybeSingle();
      setMaintenanceMode(mData?.value || { enabled: false });

      // Check Feature Flags
      const { data: fData } = await supabase.from('platform_feature_flags').select('key, is_enabled');
      if (fData) {
        setFlagCounts({
          total: fData.length,
          enabled: fData.filter(f => f.is_enabled).length
        });
      }

      // Check Location Service Health Telemetry via Admin RPC
      const lHealth = await dbService.adminGetLocationServiceHealth();
      if (lHealth) {
        setLocationHealth(lHealth);
      }

      // Check Media Storage Health Telemetry via Admin RPC & Status API
      const mHealth = await dbService.adminGetMediaStorageHealth();
      if (mHealth) {
        setMediaHealth(mHealth);
      }

      try {
        const res = await fetch('/api/media-status');
        const sData = await res.json();
        setMediaStatus(sData);
      } catch (err) {
        console.warn('Failed to fetch /api/media-status:', err);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('System health check error:', err);
      setDbStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const openSwitchModal = (newProvider: 'b2' | 'cloudinary', autoFallback: boolean) => {
    setTargetProvider(newProvider);
    setTargetAutoFallback(autoFallback);
    setReasonInput('');
    setSwitchError(null);
    setShowModal(true);
  };

  const handleConfirmProviderSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonInput.trim()) return;

    setSubmittingSwitch(true);
    setSwitchError(null);

    try {
      const settingVal = {
        provider: targetProvider,
        auto_fallback: targetAutoFallback
      };

      await dbService.adminUpdatePlatformSetting('media.primary_provider', settingVal, reasonInput.trim());

      setSwitchToast(`Media primary provider switched to ${targetProvider === 'b2' ? 'Backblaze B2' : 'Cloudinary'} (Auto Fallback: ${targetAutoFallback ? 'ON' : 'OFF'}).`);
      setShowModal(false);
      setReasonInput('');
      await checkHealth();
    } catch (err: any) {
      console.error('Error updating platform setting:', err);
      setSwitchError(err.message || 'Failed to update media storage setting.');
    } finally {
      setSubmittingSwitch(false);
    }
  };

  // Helper status calculators
  const getOsmTilesStatusInfo = () => {
    if (!locationHealth?.osm_tiles) return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    const { successes_24h, failures_24h, last_success_at } = locationHealth.osm_tiles;

    if (!last_success_at && failures_24h === 0) {
      return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    }
    if (failures_24h === 0 && successes_24h > 0) {
      return { label: 'Healthy', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    }
    if (failures_24h > 0 && successes_24h > 0) {
      return { label: 'Degraded', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: AlertCircle };
    }
    if (failures_24h > 0 && successes_24h === 0) {
      return { label: 'Issue Detected', style: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle };
    }
    return { label: 'No Data', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
  };

  const getNominatimStatusInfo = () => {
    if (!locationHealth?.nominatim) return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    const { successes_24h, failures_24h, rate_limited_24h, forbidden_24h, last_success_at } = locationHealth.nominatim;

    if (!last_success_at && failures_24h === 0) {
      return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    }
    if (forbidden_24h > 0) {
      return { label: 'Blocked (403)', style: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle };
    }
    if (rate_limited_24h > 0) {
      return { label: 'Rate Limited (429)', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: AlertCircle };
    }
    if (failures_24h === 0 && successes_24h > 0) {
      return { label: 'Healthy', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    }
    return { label: 'Degraded', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: AlertCircle };
  };

  const osmInfo = getOsmTilesStatusInfo();
  const nomInfo = getNominatimStatusInfo();
  const OsmIcon = osmInfo.icon;
  const NomIcon = nomInfo.icon;

  const osmData = locationHealth?.osm_tiles;
  const nomData = locationHealth?.nominatim;

  const b2Telemetry = mediaHealth?.events_summary_24h?.b2 || {};
  const cloudinaryTelemetry = mediaHealth?.events_summary_24h?.cloudinary || {};

  return (
    <div className="space-y-6 text-left max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span>System Operational Health</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time infrastructure diagnostics, telemetry, and storage provider routing controls
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400 font-mono">Refreshed: {lastRefreshed}</span>
          )}
          <button
            onClick={checkHealth}
            disabled={loading}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {switchToast && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{switchToast}</span>
        </div>
      )}

      {/* CORE INFRASTRUCTURE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Database Status */}
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

      {/* ── MEDIA STORAGE PROVIDER CONTROL & HEALTH SECTION ──────────────── */}
      <div className="pt-6 border-t border-slate-200/60 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Media Storage Provider & Failover Control</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Admin-controlled dynamic routing between Backblaze B2 and Cloudinary with automatic failover telemetry
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-800 self-start sm:self-auto">
            Retention: 15 Days Post-Archive
          </span>
        </div>

        {/* PROVIDER CONTROL CARD */}
        <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Active Provider Configuration</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">Selected Primary:</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  {mediaStatus?.selectedPrimaryProvider === 'cloudinary' ? 'Cloudinary' : 'Backblaze B2'}
                </span>
                {mediaStatus?.failoverActive && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center space-x-1 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    <span>Failover Active ({mediaStatus?.activePrimaryProvider})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Provider Switch Actions */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mr-1">Switch Primary:</span>
              <button
                disabled={!isSuperAdmin}
                onClick={() => openSwitchModal('b2', mediaStatus?.autoFallbackEnabled !== false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  mediaStatus?.selectedPrimaryProvider === 'b2'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                }`}
              >
                Backblaze B2
              </button>
              <button
                disabled={!isSuperAdmin}
                onClick={() => openSwitchModal('cloudinary', mediaStatus?.autoFallbackEnabled !== false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  mediaStatus?.selectedPrimaryProvider === 'cloudinary'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                }`}
              >
                Cloudinary
              </button>
              <button
                disabled={!isSuperAdmin}
                onClick={() => openSwitchModal(mediaStatus?.selectedPrimaryProvider || 'b2', !mediaStatus?.autoFallbackEnabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-1 ${
                  mediaStatus?.autoFallbackEnabled !== false
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Auto Fallback: {mediaStatus?.autoFallbackEnabled !== false ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">Servicing New Uploads</span>
              <span className="font-extrabold text-slate-800 dark:text-zinc-200 capitalize">{mediaStatus?.activePrimaryProvider || 'None'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">Fallback Target</span>
              <span className="font-extrabold text-slate-800 dark:text-zinc-200 capitalize">{mediaStatus?.fallbackProvider || 'None'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">Failover State</span>
              <span className={`font-extrabold ${mediaStatus?.failoverActive ? 'text-amber-600' : 'text-emerald-600'}`}>
                {mediaStatus?.failoverActive ? 'Failover Active' : 'Normal Operation'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block">B2 CORS Readiness</span>
              <span className={`font-extrabold ${mediaStatus?.b2CorsReady ? 'text-emerald-600' : 'text-amber-600'}`}>
                {mediaStatus?.b2CorsReady ? 'CORS Ready' : (mediaStatus?.b2CorsPermissionMissing ? 'CORS Permission Missing' : 'CORS Issue')}
              </span>
            </div>
          </div>

          {mediaStatus?.b2Configured && mediaStatus?.b2CorsStatus !== 'ready' && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 border ${
              mediaStatus?.b2CorsStatus === 'provider_error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-300'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Notice: Backblaze B2 CORS status is <strong>{mediaStatus?.b2CorsStatus}</strong>. Automatic Cloudinary failover is active.
              </span>
            </div>
          )}
        </div>

        {/* PROVIDER CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Backblaze B2 Card */}
          <div className="bg-white dark:bg-[#121624] p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Backblaze B2 Storage</h4>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono">
                  {mediaStatus?.selectedPrimaryProvider === 'b2' ? 'Selected Primary' : 'Available Provider'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                !mediaStatus?.b2Configured
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : mediaStatus?.activePrimaryProvider === 'b2'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : mediaStatus?.b2CorsStatus === 'provider_error'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  : mediaStatus?.b2CorsStatus === 'permission_missing'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : mediaStatus?.b2CorsStatus === 'rule_missing'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
              }`}>
                {!mediaStatus?.b2Configured
                  ? 'Unconfigured'
                  : mediaStatus?.activePrimaryProvider === 'b2'
                  ? 'Active Primary'
                  : mediaStatus?.b2CorsStatus === 'provider_error'
                  ? 'Degraded / Provider Error'
                  : mediaStatus?.b2CorsStatus === 'permission_missing'
                  ? 'Permission Missing'
                  : mediaStatus?.b2CorsStatus === 'rule_missing'
                  ? 'CORS Rule Missing'
                  : 'Configured Standby'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex justify-between">
                <span>Architecture Model:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">S3 Direct Presigned Bucket</span>
              </div>
              <div className="flex justify-between">
                <span>Total Events (24h):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                  {b2Telemetry?.total_events || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Success Count (24h):</span>
                <span className="font-mono font-bold text-emerald-600">
                  {b2Telemetry?.success_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failure Count (24h):</span>
                <span className={`font-mono font-bold ${b2Telemetry?.failure_count > 0 ? 'text-rose-500' : 'text-slate-700 dark:text-zinc-300'}`}>
                  {b2Telemetry?.failure_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Latency (24h):</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">
                  {b2Telemetry?.avg_latency_ms ? `${b2Telemetry.avg_latency_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Cloudinary Card */}
          <div className="bg-white dark:bg-[#121624] p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cloudinary Storage</h4>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest font-mono">
                  {mediaStatus?.selectedPrimaryProvider === 'cloudinary' ? 'Selected Primary' : 'Default Fallback'}
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                mediaStatus?.cloudinaryConfigured
                  ? (mediaStatus?.activePrimaryProvider === 'cloudinary' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20')
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              }`}>
                {mediaStatus?.cloudinaryConfigured ? (mediaStatus?.activePrimaryProvider === 'cloudinary' ? 'Active Primary' : 'Standby Fallback') : 'Unconfigured'}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex justify-between">
                <span>Target Folder & Access:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">opencomm-chat-media (Authenticated)</span>
              </div>
              <div className="flex justify-between">
                <span>Total Events (24h):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                  {cloudinaryTelemetry?.total_events || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Success Count (24h):</span>
                <span className="font-mono font-bold text-emerald-600">
                  {cloudinaryTelemetry?.success_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failure Count (24h):</span>
                <span className={`font-mono font-bold ${cloudinaryTelemetry?.failure_count > 0 ? 'text-rose-500' : 'text-slate-700 dark:text-zinc-300'}`}>
                  {cloudinaryTelemetry?.failure_count || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Latency (24h):</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">
                  {cloudinaryTelemetry?.avg_latency_ms ? `${cloudinaryTelemetry.avg_latency_ms} ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Retention & Lifecycle Summary */}
        <div className="bg-white dark:bg-[#121624] p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Lifecycle & Retention Counters</h4>
          {mediaHealth?.cleanup_overdue_count > 0 && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>⚠️ {mediaHealth.cleanup_overdue_count} media objects are overdue for 15-day post-archive cleanup deletion.</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-zinc-800/60">
              <span className="text-[10px] text-slate-400 font-mono block">Active Media</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">{mediaHealth?.active_media_count || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-zinc-800/60">
              <span className="text-[10px] text-slate-400 font-mono block">Cleanup Pending</span>
              <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{mediaHealth?.cleanup_pending_count || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-zinc-800/60">
              <span className="text-[10px] text-slate-400 font-mono block">Deleted Media</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">{mediaHealth?.deleted_media_count || 0}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-zinc-800/60">
              <span className="text-[10px] text-slate-400 font-mono block">Orphan Uploads</span>
              <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">{mediaHealth?.orphan_intents_count || 0}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * Archived conversation media is automatically marked for external deletion 15 days after conversation archiving. Chat history records are preserved permanently.
          </p>
        </div>
      </div>

      {/* ── LOCATION SERVICES SECTION ───────────────────────────────────── */}
      <div className="pt-6 border-t border-slate-200 dark:border-zinc-800 space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <span>Location Services Operational Health</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Privacy-safe operational telemetry monitoring OpenStreetMap map tiles and Nominatim reverse geocoding
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* OpenStreetMap Tiles Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">OpenStreetMap Tiles</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${osmInfo.style}`}>
                <OsmIcon className="w-3 h-3" />
                <span>{osmInfo.label}</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Interactive map tile availability observed from OpenComm map sessions.
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Last Success</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {osmData?.last_success_at ? new Date(osmData.last_success_at).toLocaleTimeString() : 'None observed'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Tile Errors (24h)</span>
                <span className={`font-bold ${osmData?.failures_24h > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-zinc-200'}`}>
                  {osmData?.failures_24h || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Nominatim Reverse Geocoding Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                <MapPin className="w-5 h-5" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Nominatim Reverse Geocoding</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center space-x-1 ${nomInfo.style}`}>
                <NomIcon className="w-3 h-3" />
                <span>{nomInfo.label}</span>
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Address lookup health observed from GPS and confirmed map-pin operations.
            </p>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Last Success</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {nomData?.last_success_at ? new Date(nomData.last_success_at).toLocaleTimeString() : 'None observed'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Avg Latency (24h)</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">
                  {nomData?.avg_latency_ms_24h ? `${nomData.avg_latency_ms_24h} ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHANGE PRIMARY PROVIDER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-left">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl text-purple-600 dark:text-purple-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Change Primary Media Storage</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Update system media routing configuration</p>
              </div>
            </div>

            {switchError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
                {switchError}
              </div>
            )}

            <form onSubmit={handleConfirmProviderSwitch} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">New Primary Provider:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white uppercase font-mono">
                    {targetProvider === 'b2' ? 'Backblaze B2' : 'Cloudinary'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Automatic Fallback:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white uppercase font-mono">
                    {targetAutoFallback ? 'Enabled (ON)' : 'Disabled (OFF)'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Audit Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Explain why the primary storage provider configuration is being changed..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSwitch || !reasonInput.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submittingSwitch && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Configuration Change</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
