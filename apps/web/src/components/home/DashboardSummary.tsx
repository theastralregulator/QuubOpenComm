import React from 'react';
import { motion } from 'motion/react';
import { 
  FileText, Briefcase, MessageSquare, Eye, Bookmark, Users, ArrowRight 
} from 'lucide-react';

interface DashboardSummaryProps {
  myPostsCount: number;
  myWorksCount: number;
  unreadMessagesCount: number;
  savedJobsCount: number;
  savedWorkersCount: number;
  profileViewsCount: number;
  onAction: (targetView: string) => void;
}

export default function DashboardSummary({
  myPostsCount,
  myWorksCount,
  unreadMessagesCount,
  savedJobsCount,
  savedWorkersCount,
  profileViewsCount,
  onAction,
}: DashboardSummaryProps) {
  const items = [
    {
      id: 'posts',
      label: 'My Posts',
      count: myPostsCount,
      status: `${myPostsCount} active posts`,
      icon: FileText,
      iconColor: 'text-blue-600 dark:text-blue-400',
      color: 'bg-blue-50/50 border-blue-100/40 dark:bg-blue-950/15 dark:border-blue-900/20',
      action: () => onAction('profile'), // Goes to Activity/Profile
    },
    {
      id: 'works',
      label: 'My Works',
      count: myWorksCount,
      status: `${myWorksCount} in progress`,
      icon: Briefcase,
      iconColor: 'text-amber-600 dark:text-amber-400',
      color: 'bg-amber-50/50 border-amber-100/40 dark:bg-amber-950/15 dark:border-amber-900/20',
      action: () => onAction('profile'),
    },
    {
      id: 'messages',
      label: 'Messages',
      count: unreadMessagesCount,
      status: `${unreadMessagesCount} unread threads`,
      icon: MessageSquare,
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      color: 'bg-emerald-50/50 border-emerald-100/40 dark:bg-emerald-950/15 dark:border-emerald-900/20',
      action: () => onAction('messages'),
    },
    {
      id: 'saved-jobs',
      label: 'Saved Jobs',
      count: savedJobsCount,
      status: `${savedJobsCount} saved listings`,
      icon: Bookmark,
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      color: 'bg-indigo-50/50 border-indigo-100/40 dark:bg-indigo-950/15 dark:border-indigo-900/20',
      action: () => onAction('saved-jobs'),
    },
    {
      id: 'saved-workers',
      label: 'Saved Workers',
      count: savedWorkersCount,
      status: `${savedWorkersCount} professionals`,
      icon: Users,
      iconColor: 'text-purple-600 dark:text-purple-400',
      color: 'bg-purple-50/50 border-purple-100/40 dark:bg-purple-950/15 dark:border-purple-900/20',
      action: () => onAction('saved-workers'),
    },
    {
      id: 'views',
      label: 'Profile Views',
      count: profileViewsCount,
      status: '+12% this week',
      icon: Eye,
      iconColor: 'text-rose-600 dark:text-rose-400',
      color: 'bg-rose-50/50 border-rose-100/40 dark:bg-rose-950/15 dark:border-rose-900/20',
      action: () => onAction('profile'),
    },
  ];

  return (
    <div className="mb-6 w-full">
      <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-left mb-3">
        DASHBOARD OVERVIEW
      </h3>
      
      {/* 2 columns on mobile, 2 columns on tablet, 3 columns on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {items.map((item) => {
          const IconComp = item.icon;
          return (
            <motion.div
              key={item.id}
              whileHover={{ y: -3, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.action}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-4 flex flex-col justify-between text-left cursor-pointer transition-all duration-300 shadow-xs hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700/80 relative overflow-hidden"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Top Row: Icon container & Action arrow */}
              <div className="flex justify-between items-center mb-3">
                <div className={`p-2.5 rounded-xl border ${item.color} ${item.iconColor}`}>
                  <IconComp className="w-5 h-5" />
                </div>
                <div className="text-slate-400 dark:text-slate-500 group-hover:text-[#2563EB] transition-colors p-1 rounded-full bg-slate-50 dark:bg-slate-800/50">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* Middle Row: Prominent Count & Label */}
              <div className="mt-1">
                <span className="block text-2xl sm:text-3.5xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-none">
                  {item.count}
                </span>
                <span className="block text-xs sm:text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-2">
                  {item.label}
                </span>
              </div>

              {/* Bottom Row: Status */}
              <span className="text-[10px] sm:text-xs text-[#475569] dark:text-slate-400 mt-2 block font-medium font-mono">
                {item.status}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
