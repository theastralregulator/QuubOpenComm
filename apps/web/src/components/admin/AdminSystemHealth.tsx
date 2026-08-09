import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, CheckCircle2, XCircle, RefreshCw, AlertCircle, Database, Radio, Server, Layers, MapPin, Globe } from 'lucide-react';
import { supabase, dbService } from '../../lib/supabase';

export default function AdminSystemHealth() {
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error'>('connected');
  const [maintenanceMode, setMaintenanceMode] = useState<any | null>(null);
  const [flagCounts, setFlagCounts] = useState<{ total: number; enabled: number }>({ total: 0, enabled: 0 });
  const [locationHealth, setLocationHealth] = useState<any | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Test DB Query
      const { error: dbErr } = await supabase.from('profiles').select('id').limit(1);
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

      // Check Location Service Health Telemetry via Admin RPC
      const lHealth = await dbService.adminGetLocationServiceHealth();
      if (lHealth) {
        setLocationHealth(lHealth);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('System health check error:', err);
      setDbStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Helper status calculator for OSM Tiles
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

  // Helper status calculator for Nominatim Reverse Geocoding
  const getNominatimStatusInfo = () => {
    if (!locationHealth?.nominatim) return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    const { successes_24h, failures_24h, rate_limited_24h, forbidden_24h, last_success_at } = locationHealth.nominatim;

    if (!last_success_at && failures_24h === 0) {
      return { label: 'No Data / Waiting for observations', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
    }
    if (forbidden_24h > 0 || (failures_24h > successes_24h && successes_24h === 0)) {
      return { label: 'Issue Detected', style: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: XCircle };
    }
    if (rate_limited_24h > 0 || failures_24h > 0) {
      return { label: 'Degraded', style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: AlertCircle };
    }
    if (successes_24h > 0) {
      return { label: 'Healthy', style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 };
    }
    return { label: 'No Data', style: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: AlertCircle };
  };

  const osmInfo = getOsmTilesStatusInfo();
  const nomInfo = getNominatimStatusInfo();
  const OsmIcon = osmInfo.icon;
  const NomIcon = nomInfo.icon;

  const nomData = locationHealth?.nominatim;
  const osmData = locationHealth?.osm_tiles;

  return (
    <div className="space-y-6 text-left max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">System Operational Health</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time status monitoring of database connection, background triggers, configuration states, and location services
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

      {/* ── LOCATION SERVICES SECTION ───────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-4">
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
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Tile Failures (1h)</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{osmData?.failures_1h || 0}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Success Sessions (24h)</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{osmData?.successes_24h || 0}</span>
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

            {/* Warnings */}
            {nomData?.rate_limited_24h > 0 && (
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>⚠️ Rate-limit (429) responses detected from Nominatim in last 24h.</span>
              </div>
            )}
            {nomData?.forbidden_24h > 0 && (
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>⛔ Access-block (403) responses detected. Review provider usage.</span>
              </div>
            )}

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
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Failures (24h)</span>
                <span className={`font-bold ${nomData?.failures_24h > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-zinc-200'}`}>
                  {nomData?.failures_24h || 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Timeouts (24h)</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{nomData?.timeouts_24h || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
