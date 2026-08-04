import React from 'react';
import { motion } from 'motion/react';
import { Briefcase, Users, PlusCircle, UserCheck, ArrowUpRight, MessageSquare, User } from 'lucide-react';

interface QuickActionsProps {
  onFindJobs: () => void;
  onFindWorkers: () => void;
  onPostJob: () => void;
  onCreateProfile: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  /** Pass true when the logged-in user already has a worker profile */
  hasWorkerProfile?: boolean;
}

export default function QuickActions({
  onFindJobs,
  onFindWorkers,
  onPostJob,
  onCreateProfile,
  onOpenMessages,
  onOpenProfile,
  hasWorkerProfile = false,
}: QuickActionsProps) {
  // Base actions always shown
  const baseActions = [
    {
      title: 'Find Jobs',
      subtitle: 'Browse vacancies',
      icon: Briefcase,
      colorClass: 'text-[#2563EB] dark:text-[#60A5FA]',
      tintClass: 'bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-500/5 dark:hover:bg-blue-500/10',
      borderClass: 'border-blue-200/60 dark:border-blue-500/20',
      hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.2)]',
      action: onFindJobs,
    },
    {
      title: 'Find Workers',
      subtitle: 'Hire active pros',
      icon: Users,
      colorClass: 'text-purple-600 dark:text-purple-400',
      tintClass: 'bg-purple-500/5 hover:bg-purple-500/10 dark:bg-purple-500/5 dark:hover:bg-purple-500/10',
      borderClass: 'border-purple-200/60 dark:border-purple-500/20',
      hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(124,58,237,0.2)]',
      action: onFindWorkers,
    },
    {
      title: 'Post Job',
      subtitle: 'Post new vacancy',
      icon: PlusCircle,
      colorClass: 'text-white',
      tintClass: 'bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:opacity-95 text-white',
      borderClass: 'border-transparent',
      hoverGlow: 'hover:shadow-[0_8px_20px_-4px_rgba(37,99,235,0.45)]',
      isPrimary: true,
      action: onPostJob,
    },
  ];

  // Worker-profile conditional action
  const workerAction = hasWorkerProfile
    ? {
        title: 'Manage Worker Profile',
        subtitle: 'Update your listing',
        icon: UserCheck,
        colorClass: 'text-[#C026D3] dark:text-[#E879F9]',
        tintClass: 'bg-pink-500/5 hover:bg-pink-500/10 dark:bg-pink-500/5 dark:hover:bg-pink-500/10',
        borderClass: 'border-pink-200/60 dark:border-pink-500/20',
        hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(219,39,119,0.2)]',
        action: onOpenProfile,
      }
    : {
        title: 'Become a Worker',
        subtitle: 'Join worker network',
        icon: UserCheck,
        colorClass: 'text-[#C026D3] dark:text-[#E879F9]',
        tintClass: 'bg-pink-500/5 hover:bg-pink-500/10 dark:bg-pink-500/5 dark:hover:bg-pink-500/10',
        borderClass: 'border-pink-200/60 dark:border-pink-500/20',
        hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(219,39,119,0.2)]',
        action: onCreateProfile,
      };

  const trailingActions = [
    {
      title: 'Messages',
      subtitle: 'Inbox & Direct Chat',
      icon: MessageSquare,
      colorClass: 'text-cyan-600 dark:text-cyan-400',
      tintClass: 'bg-cyan-500/5 hover:bg-cyan-500/10 dark:bg-cyan-500/5 dark:hover:bg-cyan-500/10',
      borderClass: 'border-cyan-200/60 dark:border-cyan-500/20',
      hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(6,182,212,0.2)]',
      action: onOpenMessages,
    },
    {
      title: 'My Profile',
      subtitle: 'View your dashboard',
      icon: User,
      colorClass: 'text-indigo-600 dark:text-indigo-400',
      tintClass: 'bg-indigo-500/5 hover:bg-indigo-500/10 dark:bg-indigo-500/5 dark:hover:bg-indigo-500/10',
      borderClass: 'border-indigo-200/60 dark:border-indigo-500/20',
      hoverGlow: 'hover:shadow-[0_8px_20px_-6px_rgba(79,70,229,0.2)]',
      action: onOpenProfile,
    },
  ];

  const actions = [...baseActions, workerAction, ...trailingActions];

  return (
    <div className="mb-6 w-full">
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-left mb-3">
        QUICK ACTION HUB
      </h3>
      
      {/* 2 columns on mobile, 3 columns on tablet & desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
        {actions.map((act, index) => {
          const IconComp = act.icon;
          return (
            <motion.div
              key={index}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={act.action}
              className={`group flex flex-col justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-300 h-[110px] sm:h-[135px] relative overflow-hidden ${act.borderClass} ${act.tintClass} ${act.hoverGlow}`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="flex justify-between items-start relative z-10">
                <div className={`p-2 rounded-xl ${'isPrimary' in act && act.isPrimary ? 'bg-white/20' : 'bg-white dark:bg-[#111827] border border-slate-100 dark:border-slate-800 shadow-xs'} ${act.colorClass}`}>
                  <IconComp className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                </div>
                
                <div className={`rounded-full p-0.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${'isPrimary' in act && act.isPrimary ? 'text-white/85' : 'text-slate-400 dark:text-slate-500'}`}>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-2 relative z-10">
                <h4 className={`text-xs sm:text-sm font-extrabold tracking-tight truncate ${'isPrimary' in act && act.isPrimary ? 'text-white' : 'text-[#0F172A] dark:text-[#F8FAFC]'}`}>
                  {act.title}
                </h4>
                <p className={`text-[10px] sm:text-xs font-medium leading-none mt-1 truncate ${'isPrimary' in act && act.isPrimary ? 'text-white/85' : 'text-[#475569] dark:text-[#CBD5E1]'}`}>
                  {act.subtitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
