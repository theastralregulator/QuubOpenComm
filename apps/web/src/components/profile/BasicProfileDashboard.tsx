import React from 'react';
import { motion } from 'motion/react';
import { 
  MapPin, Calendar, Camera, Edit2, Settings,
  Briefcase, Bookmark, Users, Star,
  UserCircle, Wrench, Building2, ShieldAlert, LifeBuoy,
  ChevronRight, Share2, LogOut
} from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { LocalProfile } from '../../lib/supabase';
import { Job, Worker } from '../../types';

interface BasicProfileDashboardProps {
  profile: LocalProfile | null;
  username: string;
  userPhoto: string;
  joinedYear: number | null;
  formattedLocation: string;
  jobs?: Job[];
  workers?: Worker[];
  onEditProfile: () => void;
  onCreateWorker: () => void;
  onCreateCompany: () => void;
  onUpdatePhoto: () => void;
  onLogout: () => void;
  triggerToast: (msg: string) => void;
}

export default function BasicProfileDashboard({
  profile,
  username,
  userPhoto,
  joinedYear,
  formattedLocation,
  jobs = [],
  workers = [],
  onEditProfile,
  onCreateWorker,
  onCreateCompany,
  onUpdatePhoto,
  onLogout,
  triggerToast
}: BasicProfileDashboardProps) {
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="max-w-4xl mx-auto space-y-5 sm:space-y-8 py-6 sm:py-8 px-4 sm:px-6 pb-28 sm:pb-12"
    >
      {/* 1. Hero Profile Card */}
      <motion.div 
        variants={itemVariants}
        className="bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-indigo-950/20 dark:via-[#111827] dark:to-purple-950/20 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)] relative overflow-hidden flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left"
      >
        <div className="relative group shrink-0">
          <UserAvatar
            avatarUrl={profile?.avatar_url || userPhoto}
            fullName={profile?.full_name || username}
            size="3xl"
            className="w-28 h-28 sm:w-32 sm:h-32 border-[4px] sm:border-[6px] border-white dark:border-[#111827] shadow-xl bg-slate-100"
          />
          <button 
            onClick={onUpdatePhoto}
            className="absolute bottom-1 right-1 p-2 sm:p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-110 active:scale-95"
            title="Update photo"
          >
            <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-3 pt-2 md:pt-0">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <h1 className="text-[26px] sm:text-[32px] font-bold text-slate-900 dark:text-white tracking-tight truncate leading-tight">
              {profile?.full_name || username}
            </h1>
            <span className="inline-flex items-center justify-center px-3 py-1 bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold w-max mx-auto md:mx-0">
              Basic Account
            </span>
          </div>

          <p className="text-[14px] sm:text-[15px] text-slate-600 dark:text-slate-300 font-medium max-w-2xl leading-relaxed">
            {profile?.bio || "Welcome to OpenComm. Update your profile to get started."}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            {formattedLocation && (
              <span className="flex items-center">
                <MapPin className="w-4 h-4 mr-1.5" />
                {formattedLocation}
              </span>
            )}
            {joinedYear && (
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                Joined {joinedYear}
              </span>
            )}
          </div>
        </div>

        {/* Floating Actions */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex space-x-2">
          <button onClick={() => triggerToast("Profile link copied to clipboard!")} className="p-2 sm:p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:scale-105 active:scale-95">
            <Share2 className="w-4 h-4 sm:w-4 sm:h-4" />
          </button>
        </div>
      </motion.div>

      {/* 2. Primary Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
        <button
          onClick={onEditProfile}
          className="flex items-center justify-center space-x-2 min-h-[48px] py-3.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-[20px] text-sm font-bold text-slate-700 dark:text-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
        >
          <Edit2 className="w-4 h-4" />
          <span>Edit Profile</span>
        </button>
        <button
          onClick={() => triggerToast("Account Settings coming soon")}
          className="flex items-center justify-center space-x-2 min-h-[48px] py-3.5 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-[20px] text-sm font-bold text-slate-700 dark:text-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
        >
          <Settings className="w-4 h-4" />
          <span>Account Settings</span>
        </button>
      </motion.div>

      {/* 3. Statistics Card */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4 sm:gap-6 md:divide-x divide-slate-100 dark:divide-slate-800">
          {[
            { label: 'Jobs Applied', value: '0', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Saved Jobs', value: jobs.filter(j => j.bookmarked).length.toString(), icon: Bookmark, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
            { label: 'Saved Workers', value: workers.filter(w => w.bookmarked).length.toString(), icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
            { label: 'Reviews', value: '0', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -2 }}
              className={`flex flex-col items-center text-center px-2 sm:px-4 ${i % 2 === 0 ? 'border-r border-slate-100 dark:border-slate-800 md:border-r-0' : ''}`}
            >
              <div className={`w-10 h-10 sm:w-12 sm:h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center mb-3`}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[22px] sm:text-[26px] md:text-3xl font-bold text-slate-900 dark:text-white leading-none mb-1">{stat.value}</span>
              <span className="text-[12px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 4. Account Options Section */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[28px] p-2 sm:p-4 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
        <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 sm:pb-4">
          <h3 className="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Account Options</h3>
        </div>
        
        <div className="flex flex-col space-y-1">
          {[
            { 
              title: 'Edit Profile Details', 
              subtitle: 'Update your personal information, bio and preferences.', 
              icon: UserCircle, 
              color: 'text-blue-600 dark:text-blue-400', 
              bg: 'bg-blue-100 dark:bg-blue-500/10',
              onClick: onEditProfile
            },
            { 
              title: 'Create Worker Profile', 
              subtitle: 'List your skills and services to find work opportunities.', 
              icon: Wrench, 
              color: 'text-purple-600 dark:text-purple-400', 
              bg: 'bg-purple-100 dark:bg-purple-500/10',
              onClick: onCreateWorker
            },
            { 
              title: 'Company Profile', 
              subtitle: 'Flesh out company name and business sector.', 
              icon: Building2, 
              color: 'text-indigo-600 dark:text-indigo-400', 
              bg: 'bg-indigo-100 dark:bg-indigo-500/10',
              badge: 'Coming Soon',
              onClick: onCreateCompany
            },
            { 
              title: 'Privacy & Security', 
              subtitle: 'Manage password, login sessions and security.', 
              icon: ShieldAlert, 
              color: 'text-emerald-600 dark:text-emerald-400', 
              bg: 'bg-emerald-100 dark:bg-emerald-500/10',
              onClick: () => triggerToast("Privacy & Security settings coming soon")
            },
            { 
              title: 'Help & Support', 
              subtitle: 'FAQs, Contact Support and Guides.', 
              icon: LifeBuoy, 
              color: 'text-amber-600 dark:text-amber-400', 
              bg: 'bg-amber-100 dark:bg-amber-500/10',
              onClick: () => triggerToast("Help & Support center coming soon")
            }
          ].map((row, i) => (
            <div 
              key={i}
              onClick={row.onClick}
              className="group flex items-center p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-[20px] cursor-pointer transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-2xl ${row.bg} ${row.color} flex items-center justify-center shrink-0 mr-3 sm:mr-4 transition-transform group-hover:scale-105`}>
                <row.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[16px] sm:text-[18px] font-bold text-slate-900 dark:text-white truncate">{row.title}</h4>
                  {row.badge && (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0">
                      {row.badge}
                    </span>
                  )}
                </div>
                <p className="text-[13px] sm:text-[15px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium line-clamp-2 leading-relaxed whitespace-normal">{row.subtitle}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-transform group-hover:translate-x-1 shrink-0" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* 5. Logout Button */}
      <motion.div variants={itemVariants}>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center space-x-2 py-4 min-h-[48px] bg-rose-50/50 dark:bg-[#111827] border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/50 rounded-[20px] text-sm font-bold text-rose-600 dark:text-rose-400 transition-all shadow-[0_10px_40px_rgba(0,0,0,0.06)] hover:shadow-[0_10px_40px_rgba(244,63,94,0.15)] active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5" />
          <span>Log Out Securely</span>
        </button>
      </motion.div>

    </motion.div>
  );
}
