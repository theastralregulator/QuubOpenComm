import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, Users, UserCheck, ShieldCheck, ChevronRight } from 'lucide-react';
import OpenCommLogo from '../common/OpenCommLogo';

interface HeroSectionProps {
  username?: string;
  isLoggedIn?: boolean;
  onExploreJobs?: () => void;
  onFindProfessionals?: () => void;
  onCreateAccount?: () => void;
}

export default function HeroSection({
  username,
  isLoggedIn = false,
  onExploreJobs,
  onFindProfessionals,
  onCreateAccount,
}: HeroSectionProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-slate-50/30 dark:from-[#0f172a]/60 dark:via-[#0b0d12] dark:to-[#0b0d12] rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 p-6 sm:p-8 lg:p-10 text-left shadow-xl transition-all duration-300">
      {/* Subtle Glow Accents */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-gradient-to-br from-[#2563EB]/10 via-[#7C3AED]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-gradient-to-tr from-indigo-500/5 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        
        {/* Eyebrow & Brand Logo Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full shadow-xs w-fit">
              <span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest font-mono">
                PROFESSIONAL MARKETPLACE
              </span>
            </div>

            {/* Main Heading H1 */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Build better work connections.
            </h1>
          </div>

          {/* Display OpenComm logo image clearly */}
          <div className="shrink-0 self-start sm:self-center">
            <OpenCommLogo variant="hero" />
          </div>
        </div>

        {/* Short & Supporting Descriptions */}
        <div className="max-w-3xl space-y-2 text-slate-600 dark:text-zinc-300">
          <p className="text-sm sm:text-base md:text-lg font-medium leading-relaxed">
            Discover skilled professionals, trusted opportunities, and meaningful work connections—all in one place.
          </p>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
            Browse jobs, find talent, create a professional profile, and connect securely through OpenComm.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onExploreJobs}
            className="px-6 h-12 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 shadow-md shadow-blue-500/15 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Explore Jobs</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onFindProfessionals}
            className="px-6 h-12 rounded-xl text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-100 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-sm active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <span>Find Professionals</span>
          </button>

          {!isLoggedIn && (
            <button
              type="button"
              onClick={onCreateAccount}
              className="px-5 h-12 rounded-xl text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <span>Create Free Account</span>
            </button>
          )}
        </div>

        {/* Compact Benefit Row with Lucide Line Icons */}
        <div className="pt-4 border-t border-slate-200/60 dark:border-zinc-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-semibold text-slate-700 dark:text-zinc-300">
            
            <div className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200/40 dark:border-zinc-800/40">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <span className="truncate">Find Opportunities</span>
            </div>

            <div className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200/40 dark:border-zinc-800/40">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span className="truncate">Discover Professionals</span>
            </div>

            <div className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200/40 dark:border-zinc-800/40">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="truncate">Build Your Profile</span>
            </div>

            <div className="flex items-center space-x-2.5 p-2.5 rounded-xl bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-200/40 dark:border-zinc-800/40">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="truncate">Connect Securely</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
