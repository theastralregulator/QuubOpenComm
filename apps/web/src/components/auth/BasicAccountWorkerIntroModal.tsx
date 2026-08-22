import React, { useEffect } from 'react';
import { Briefcase, UserCheck, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

interface BasicAccountWorkerIntroModalProps {
  isOpen: boolean;
  onBecomeWorker: () => void;
  onContinueBasic: () => void;
}

export default function BasicAccountWorkerIntroModal({
  isOpen,
  onBecomeWorker,
  onContinueBasic
}: BasicAccountWorkerIntroModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onContinueBasic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onContinueBasic]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="basic-account-intro-title"
      className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 text-left animate-fadeIn"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-w-[580px] w-full max-h-[90vh] overflow-y-auto space-y-6">
        
        {/* Header Title */}
        <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <h2 id="basic-account-intro-title" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            Your Basic Account is Ready
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            You've successfully created a Basic Account on OpenComm.
          </p>
        </div>

        {/* Capabilities Overview Grid */}
        <div className="space-y-4">
          
          {/* Basic Account Section */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>With your Basic Account, you can:</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium pl-1">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Post job listings and define work requirements</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Browse, search, and hire verified workers</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Manage your posted jobs, applicants, and hiring activity</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span>Communicate directly with workers via instant messaging</span>
              </li>
            </ul>
          </div>

          {/* Worker Profile Section */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/50 rounded-2xl space-y-2">
            <div className="flex items-center space-x-2 text-indigo-950 dark:text-indigo-200 font-bold text-xs">
              <Briefcase className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>To work and earn on OpenComm, add a Worker Profile:</span>
            </div>
            <ul className="space-y-1.5 text-xs text-indigo-900/90 dark:text-indigo-200/90 font-medium pl-1">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Apply for open job listings posted by employers</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Receive direct hire requests and work proposals</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Appear in the public Workers directory</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>Showcase your skills, services, hourly rate, and availability</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Question Prompt */}
        <div className="text-center space-y-1 pt-1">
          <p className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
            Would you like to become a worker now?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBecomeWorker}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <UserCheck className="w-4 h-4" />
            <span>Create Worker Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            onClick={onContinueBasic}
            className="w-full sm:w-auto px-5 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center"
          >
            Continue with Basic Account
          </button>
        </div>

        {/* Helper Note */}
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">
          You can create a Worker Profile anytime later from your Profile settings.
        </p>

      </div>
    </div>
  );
}
