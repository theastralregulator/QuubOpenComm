import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Calendar, Camera, Edit2,
  Briefcase, Bookmark, Users, Star,
  UserCircle, Wrench, Building2, ShieldAlert, LifeBuoy,
  ChevronRight, Share2, LogOut, ImageIcon, MessageSquare
} from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { LocalProfile } from '../../lib/supabase';
import { Job, Worker } from '../../types';
import { navigateWithOrigin, SESSION_STORAGE_KEYS } from '../../lib/navigation';

const BUILTIN_BANNERS = [
  { id: 'banner_01', class: 'bg-gradient-to-r from-blue-600/20 via-indigo-500/10 to-purple-600/20 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-purple-950/50' },
  { id: 'banner_02', class: 'bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-indigo-700/20 dark:from-cyan-950/50 dark:via-blue-950/50 dark:to-indigo-950/50' },
  { id: 'banner_03', class: 'bg-gradient-to-r from-sky-400/20 via-blue-500/15 to-indigo-500/25 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-indigo-950/50' },
  { id: 'banner_04', class: 'bg-gradient-to-r from-fuchsia-600/20 via-purple-600/15 to-pink-500/20 dark:from-fuchsia-950/40 dark:via-purple-950/40 dark:to-pink-950/40' },
  { id: 'banner_05', class: 'bg-gradient-to-r from-purple-800/25 via-indigo-700/15 to-violet-900/25 dark:from-purple-950/60 dark:via-indigo-950/40 dark:to-violet-950/60' },
  { id: 'banner_06', class: 'bg-gradient-to-r from-violet-600/20 via-fuchsia-500/10 to-purple-800/20 dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-purple-950/50' },
  { id: 'banner_07', class: 'bg-gradient-to-r from-neutral-900/90 via-amber-500/10 to-neutral-900/90 border-b border-amber-500/10 dark:from-neutral-950 dark:via-amber-500/5' },
  { id: 'banner_08', class: 'bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 dark:from-slate-950 dark:via-slate-900' },
  { id: 'banner_09', class: 'bg-gradient-to-r from-neutral-950 via-zinc-900 to-neutral-950 dark:from-black dark:via-neutral-950' },
  { id: 'banner_10', class: 'bg-gradient-to-r from-teal-500/15 via-indigo-600/15 to-emerald-500/15 dark:from-teal-950/40 dark:via-indigo-950/40 dark:to-emerald-950/40' },
  { id: 'banner_11', class: 'bg-gradient-to-r from-emerald-600/20 via-zinc-900/80 to-teal-600/20 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-teal-950/40' },
  { id: 'banner_12', class: 'bg-gradient-to-r from-blue-700/20 via-purple-600/25 to-pink-600/15 dark:from-blue-950/50 dark:via-purple-950/50 dark:to-pink-950/40' },
  { id: 'banner_13', class: 'bg-gradient-to-r from-zinc-500/20 via-orange-500/10 to-zinc-600/20 dark:from-zinc-800/40 dark:via-orange-950/30' },
  { id: 'banner_14', class: 'bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-stone-600/20 dark:from-amber-950/30' },
  { id: 'banner_15', class: 'bg-gradient-to-r from-neutral-300/40 via-neutral-400/30 to-stone-400/40 dark:from-neutral-800/40' },
  { id: 'banner_16', class: 'bg-gradient-to-r from-yellow-500/25 via-amber-600/15 to-neutral-900/30 dark:from-yellow-950/40' },
  { id: 'banner_17', class: 'bg-gradient-to-r from-orange-600/20 via-amber-500/10 to-red-600/15 dark:from-orange-950/40' },
  { id: 'banner_18', class: 'bg-gradient-to-r from-cyan-400/25 via-indigo-600/20 to-neutral-900/40 dark:from-cyan-950/50' },
  { id: 'banner_19', class: 'bg-gradient-to-r from-rose-500/20 via-stone-200/50 to-amber-500/10 dark:from-rose-950/40' },
  { id: 'banner_20', class: 'bg-gradient-to-r from-pink-300/30 via-purple-300/20 to-cyan-200/40 dark:from-pink-900/20' },
  { id: 'banner_21', class: 'bg-gradient-to-r from-indigo-50/50 via-slate-100 to-blue-50/50 dark:from-[#111827] dark:to-[#1e293b]' },
  { id: 'banner_22', class: 'bg-gradient-to-r from-indigo-900/40 via-blue-800/20 to-teal-900/45 dark:from-indigo-950 dark:to-teal-950' },
  { id: 'banner_23', class: 'bg-gradient-to-r from-emerald-500/10 via-[#0b0d12] to-stone-900 dark:from-emerald-950/40' },
  { id: 'banner_24', class: 'bg-gradient-to-r from-violet-700/25 via-[#111827] to-fuchsia-800/20 dark:from-violet-950/50' },
  { id: 'banner_25', class: 'bg-gradient-to-r from-[#1E3A8A]/20 via-[#2563EB]/10 to-[#3B82F6]/15 dark:from-blue-950/50' },
  { id: 'banner_26', class: 'bg-gradient-to-r from-amber-600/15 via-yellow-500/10 to-orange-500/15 dark:from-amber-950/30' },
  { id: 'banner_27', class: 'bg-gradient-to-r from-teal-700/20 via-slate-800 to-indigo-900/25 dark:from-teal-950/50' },
  { id: 'banner_28', class: 'bg-slate-100 dark:bg-zinc-800/50 border-b border-slate-200/40' },
  { id: 'banner_29', class: 'bg-gradient-to-r from-stone-100 via-orange-50/30 to-stone-200/50 dark:from-stone-900/40' },
  { id: 'banner_30', class: 'bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200/10' }
];

const getBannerClass = (bannerId?: string | null) => {
  if (!bannerId) return BUILTIN_BANNERS[0].class;
  const found = BUILTIN_BANNERS.find(b => b.id === bannerId);
  return found ? found.class : BUILTIN_BANNERS[0].class;
};

interface BasicProfileDashboardProps {
  profile: LocalProfile | null;
  username: string;
  userPhoto: string;
  joinedYear: number | null;
  formattedLocation: string;
  jobs?: Job[];
  workers?: Worker[];
  myJobPostsCount?: number;
  jobsAppliedCount?: number | null;
  isOwner?: boolean;
  onEditProfile: () => void;
  onCreateWorker: () => void;
  onCreateCompany: () => void;
  onUpdatePhoto: () => void;
  onUpdateBanner: () => void;
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
  myJobPostsCount = 0,
  jobsAppliedCount = null,
  isOwner = true,
  onEditProfile,
  onCreateWorker,
  onCreateCompany,
  onUpdatePhoto,
  onUpdateBanner,
  onLogout,
  triggerToast
}: BasicProfileDashboardProps) {
  const navigate = useNavigate();
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
  };

  const actualLocation = (!isOwner && profile?.location_visibility === false) ? 'Location hidden' : formattedLocation;
  
  // Conditionally hide stats for public users
  const stats = [
    { label: 'My Job Posts', value: myJobPostsCount.toString(), icon: Briefcase, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', private: true, onClick: () => navigateWithOrigin(navigate, '/profile/my-job-posts', location, SESSION_STORAGE_KEYS.MY_JOB_POSTS) },
    { label: 'Jobs Applied', value: jobsAppliedCount === null || jobsAppliedCount === undefined ? '0' : jobsAppliedCount.toString(), icon: Briefcase, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', private: true, onClick: () => navigateWithOrigin(navigate, '/profile/jobs-applied', location, SESSION_STORAGE_KEYS.JOBS_APPLIED) },
    { label: 'Saved Jobs', value: jobs.filter(j => j.bookmarked).length.toString(), icon: Bookmark, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10', private: true, onClick: () => navigateWithOrigin(navigate, '/profile/saved-jobs', location, SESSION_STORAGE_KEYS.SAVED_JOBS) },
    { label: 'Saved Workers', value: workers.filter(w => w.bookmarked).length.toString(), icon: Users, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', private: true, onClick: () => navigateWithOrigin(navigate, '/profile/saved-workers', location, SESSION_STORAGE_KEYS.SAVED_WORKERS) },
    { label: 'Reviews', value: '0', icon: Star, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', private: false }
  ].filter(s => isOwner ? true : !s.private);

  return (
    <motion.div 
      initial="hidden"
      animate="show"
      variants={containerVariants}
      className="max-w-[1200px] w-full mx-auto space-y-3 sm:space-y-5 pt-0 pb-[calc(100px+env(safe-area-inset-bottom))] sm:pb-12 px-2 sm:px-6 lg:px-8"
    >
      {/* 1 & 2. HERO SECTION */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative w-full">
        {/* Banner Area */}
        <div className={`h-[130px] md:h-[200px] w-full relative transition-all ${!profile?.banner_id?.startsWith('http') ? getBannerClass(profile?.banner_id) : ''}`}>
          {profile?.banner_id?.startsWith('http') ? (
            <img src={profile.banner_id} alt="Profile Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-black/5 dark:bg-black/20" />
          )}
          
          {isOwner && (
            <button
              onClick={onUpdateBanner}
              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-sm shadow-sm"
              title="Edit Banner"
            >
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>

        {/* Profile Details Area */}
        <div className="px-3 md:px-8 pb-5 md:pb-8 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between -mt-10 md:-mt-16 gap-3 md:gap-4">
            
            {/* Avatar & Info Group */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6 flex-1 min-w-0">
              <div className="relative group shrink-0 self-start md:self-auto ml-1 md:ml-0">
                <UserAvatar
                  avatarUrl={profile?.avatar_url || userPhoto}
                  fullName={profile?.full_name || username}
                  size="3xl"
                  className="w-[110px] h-[110px] md:w-[140px] md:h-[140px] border-[4px] md:border-[6px] border-white dark:border-[#0B0F19] shadow-md bg-slate-100"
                />
                {isOwner && (
                  <button 
                    onClick={onUpdatePhoto}
                    className="absolute bottom-1 right-1 p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                    title="Update photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 pb-1 pt-2 md:pt-0 text-left flex flex-col items-start w-full">
                <div className="flex flex-wrap items-center justify-start gap-2 mb-1.5 w-full">
                  <h1 className="text-[26px] md:text-[32px] font-bold text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                    {profile?.full_name || username}
                  </h1>
                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-full text-[11px] font-bold border border-purple-100 dark:border-purple-500/20">
                    Basic Account
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-3 text-sm text-slate-500 dark:text-slate-400 font-medium w-full mt-1">
                  {actualLocation && (
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      {actualLocation}
                    </span>
                  )}
                  {joinedYear && (
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      Joined {joinedYear}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-2 shrink-0 pt-3 md:pt-0 md:pb-2 w-full md:w-auto">
              {isOwner ? (
                <>
                  <button
                    onClick={onEditProfile}
                    className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 min-h-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                  <button 
                    onClick={() => triggerToast("Profile link copied to clipboard!")}
                    className="flex items-center justify-center p-2.5 min-h-[44px] min-w-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                    title="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => triggerToast("Messaging is not yet available.")}
                    className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 rounded-full text-sm font-bold text-white transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message</span>
                  </button>
                  <button 
                    onClick={() => triggerToast("Profile link copied to clipboard!")}
                    className="flex items-center justify-center p-2.5 min-h-[44px] min-w-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 transition-colors shrink-0"
                    title="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Integrated Bio Section */}
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800/60">
            {profile?.bio ? (
              <div>
                <p className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
                  {isBioExpanded || profile.bio.length <= 150 
                    ? profile.bio 
                    : `${profile.bio.substring(0, 150).trim()}...`}
                </p>
                {profile.bio.length > 150 && (
                  <button 
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="mt-2 text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    {isBioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            ) : (
              isOwner && (
                <div className="bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl p-4 flex flex-col items-start border border-indigo-100 dark:border-indigo-500/10">
                  <span className="text-sm text-slate-600 dark:text-slate-300 font-medium mb-1">Add a short bio to tell people about yourself.</span>
                  <button onClick={onEditProfile} className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline">
                    Add bio
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* COMPACT STATISTICS & MAIN CONTENT */}
      <div className={`grid grid-cols-1 gap-3 sm:gap-6 ${isOwner ? 'lg:grid-cols-12' : 'lg:grid-cols-1'}`}>
        
        {/* LEFT COLUMN: Main Info ~65% */}
        <div className={isOwner ? "lg:col-span-8 space-y-3 sm:space-y-6" : "space-y-3 sm:space-y-6 w-full max-w-4xl mx-auto"}>
          
          {/* 3. COMPACT STATISTICS */}
          {stats.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[20px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden w-full">
              <div className={`grid grid-cols-2 ${stats.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-2'} divide-x-0 md:divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800/80`}>
                {stats.map((stat, i) => (
                  <div 
                    key={i}
                    onClick={stat.onClick}
                    className={`flex items-center justify-center sm:justify-start gap-3 sm:gap-4 p-3 sm:p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors ${stat.onClick ? 'cursor-pointer' : ''} ${
                      i % 2 === 0 ? 'border-r border-slate-100 dark:border-slate-800/80 md:border-r-0' : ''
                    } ${i < 2 ? 'border-b md:border-b-0 border-slate-100 dark:border-slate-800/80' : ''}`}
                  >
                    <div className={`w-10 h-10 rounded-[12px] ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[20px] font-bold text-slate-900 dark:text-white leading-tight">{stat.value}</span>
                      <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Professional Details (Empty State for Basic Account) */}
          {isOwner && (
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] p-4 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Professional Profile</h3>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase">Basic</span>
              </div>
              <div className="text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-[16px] bg-slate-50/50 dark:bg-slate-900/20">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wrench className="w-6 h-6" />
                </div>
                <p className="text-[14px] font-bold text-slate-800 dark:text-slate-200 mb-1">No skills added yet</p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4 font-medium">Create a worker profile to start offering services and receive reviews.</p>
                <button 
                  onClick={onCreateWorker}
                  className="px-4 py-2 min-h-[44px] bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[13px] font-bold rounded-full transition-colors"
                >
                  Create Worker Profile
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT COLUMN: Quick Actions (Account Options & Logout) ~35% */}
        {isOwner && (
          <div className="lg:col-span-4 space-y-3 sm:space-y-6">
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-2">
              <div className="px-4 pt-3 pb-2">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Account Options</h3>
              </div>
              
              <div className="flex flex-col space-y-1">
                {[
                  { 
                    title: 'Edit Profile Details', 
                    subtitle: 'Update your personal information and bio.', 
                    icon: UserCircle, 
                    color: 'text-blue-600 dark:text-blue-400', 
                    bg: 'bg-blue-50 dark:bg-blue-500/10',
                    onClick: onEditProfile
                  },
                  { 
                    title: 'Create Worker Profile', 
                    subtitle: 'Add your skills and offer services.', 
                    icon: Wrench, 
                    color: 'text-purple-600 dark:text-purple-400', 
                    bg: 'bg-purple-50 dark:bg-purple-500/10',
                    onClick: onCreateWorker
                  },
                  { 
                    title: 'Company Profile', 
                    subtitle: 'Business profiles will be available soon.', 
                    icon: Building2, 
                    color: 'text-indigo-600 dark:text-indigo-400', 
                    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
                    badge: 'Soon',
                    onClick: onCreateCompany
                  },
                  { 
                    title: 'Privacy & Security', 
                    subtitle: 'Manage password and account security.', 
                    icon: ShieldAlert, 
                    color: 'text-emerald-600 dark:text-emerald-400', 
                    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
                    onClick: () => triggerToast("Privacy & Security coming soon")
                  },
                  { 
                    title: 'Help & Support', 
                    subtitle: 'FAQs, guides and support.', 
                    icon: LifeBuoy, 
                    color: 'text-amber-600 dark:text-amber-400', 
                    bg: 'bg-amber-50 dark:bg-amber-500/10',
                    onClick: () => triggerToast("Help & Support coming soon")
                  }
                ].map((row, i) => (
                  <div 
                    key={i}
                    onClick={row.onClick}
                    className="group flex items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-[16px] cursor-pointer transition-colors"
                  >
                    <div className={`w-[44px] h-[44px] rounded-[14px] ${row.bg} ${row.color} flex items-center justify-center shrink-0 mr-3`}>
                      <row.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-[14px] font-bold text-slate-900 dark:text-white truncate">{row.title}</h4>
                        {row.badge && (
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0">
                            {row.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate sm:whitespace-normal sm:line-clamp-2 leading-tight">{row.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-transform group-hover:translate-x-1 shrink-0" />
                  </div>
                ))}
              </div>
              
              {/* Logout Button */}
              <div className="p-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center justify-center space-x-2 py-3 min-h-[44px] bg-transparent border border-rose-200 dark:border-rose-500/20 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-[14px] text-[13px] font-bold text-rose-600 dark:text-rose-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-[24px] p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Log out of OpenComm?</h3>
              <p className="text-[14px] text-slate-500 dark:text-slate-400 mb-6 font-medium">You will need to sign in again to access your account.</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-[14px] text-sm font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-[14px] text-sm font-bold shadow-md shadow-rose-500/20 transition-all"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
