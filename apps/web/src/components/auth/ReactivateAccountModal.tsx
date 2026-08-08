import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, LogOut, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { dbService } from '../../lib/supabase';

interface ReactivateAccountModalProps {
  onReactivated: () => void;
  onSignOut: () => void;
}

export default function ReactivateAccountModal({ onReactivated, onSignOut }: ReactivateAccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReactivate = async () => {
    setLoading(true);
    setError(null);
    try {
      await dbService.reactivateMyAccount();
      onReactivated();
    } catch (err: any) {
      console.error('Failed to reactivate account:', err);
      setError(err?.message || 'Failed to reactivate account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Icon Header */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 dark:border-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Title & Description */}
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">
          Your Account is Deactivated
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          Your profile and active job posts are currently hidden from public discovery. All your historical work contracts, messages, applications, and reviews are safely preserved.
        </p>

        {/* Info Box */}
        <div className="p-3.5 mb-6 rounded-2xl bg-slate-50 dark:bg-[#0d1524] border border-slate-100 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Reactivating will restore normal platform access.</span>
          </div>
          <p className="pl-6 text-[11px] text-slate-500 dark:text-slate-400">
            Previously archived jobs and hidden worker profiles can be manually updated in your settings after reactivation.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleReactivate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white text-sm font-semibold shadow-md hover:opacity-95 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Reactivating Account…' : 'Reactivate My Account'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
