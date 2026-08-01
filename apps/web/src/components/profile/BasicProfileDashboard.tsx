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
      className="max-w-5xl mx-auto space-y-6 py-3 sm:py-6 px-2 sm:px-6 pb-24 sm:pb-12 text-slate-800 dark:text-slate-100 text-left"
    >
      {/* 1 & 2. HERO SECTION */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl overflow-hidden shadow-xs relative w-full text-left">
        {/* Banner Area */}
        <div className={`h-[130px] md:h-[180px] w-full relative transition-all ${!profile?.banner_id?.startsWith('http') ? getBannerClass(profile?.banner_id) : ''}`}>
          {profile?.banner_id?.startsWith('http') ? (
            <img src={profile.banner_id} alt="Profile Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-black/5 dark:bg-black/20" />
          )}
          
          {isOwner && (
            <button
              onClick={onUpdateBanner}
              className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors backdrop-blur-sm shadow-sm cursor-pointer"
              title="Edit Banner"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Profile Details Area */}
        <div className="p-5 sm:p-7 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between -mt-12 md:-mt-16 gap-4">
            
            {/* Avatar & Info Group */}
            <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-5 flex-1 min-w-0">
              <div className="relative group shrink-0 self-start md:self-auto">
                <UserAvatar
                  avatarUrl={profile?.avatar_url || userPhoto}
                  fullName={profile?.full_name || username}
                  size="2xl"
                  className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl border-4 border-white dark:border-[#111827] shadow-md bg-slate-100"
                />
                {isOwner && (
                  <button 
                    onClick={onUpdatePhoto}
                    className="absolute bottom-0 right-0 p-2 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-full transition-all shadow-md cursor-pointer border-2 border-white dark:border-[#111827]"
                    title="Update photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-1 text-left space-y-1">
                <div className="flex flex-wrap items-center space-x-2 gap-y-1">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                    {profile?.full_name || username}
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    ● Basic Account
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  {actualLocation && (
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                      {actualLocation}
                    </span>
                  )}
                  {joinedYear && (
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      Member since {joinedYear}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Group */}
            <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0">
              {isOwner ? (
                <>
                  <button
                    onClick={onEditProfile}
                    className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button 
                    onClick={() => triggerToast("Profile link copied to clipboard!")}
                    className="h-9 w-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    title="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => triggerToast("Messaging is not yet available.")}
                    className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Message</span>
                  </button>
                  <button 
                    onClick={() => triggerToast("Profile link copied to clipboard!")}
                    className="h-9 w-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                    title="Share Profile"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          
          {/* Integrated Bio Section */}
          <div className="mt-4 pt-3 border-t border-purple-500/10 text-left">
            {profile?.bio ? (
              <div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {isBioExpanded || profile.bio.length <= 150 
                    ? profile.bio 
                    : `${profile.bio.substring(0, 150).trim()}...`}
                </p>
                {profile.bio.length > 150 && (
                  <button 
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="mt-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    {isBioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            ) : (
              isOwner && (
                <div className="bg-purple-50/50 dark:bg-purple-950/20 rounded-xl p-3.5 flex flex-col items-start border border-purple-200/50 dark:border-purple-800/40">
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-1">Add a short bio to tell people about yourself.</span>
                  <button onClick={onEditProfile} className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer">
                    Add bio
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </motion.div>

      {/* COMPACT STATISTICS & MAIN CONTENT */}
      <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${isOwner ? 'lg:grid-cols-12' : 'lg:grid-cols-1'}`}>
        
        {/* LEFT COLUMN: Main Info ~65% */}
        <div className={isOwner ? "lg:col-span-8 space-y-4 sm:space-y-6" : "space-y-4 sm:space-y-6 w-full max-w-4xl mx-auto"}>
          
          {/* 3. COMPACT STATISTICS */}
          {stats.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
                {stats.map((stat, i) => (
                  <div 
                    key={i}
                    onClick={stat.onClick}
                    className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs transition-all text-left ${stat.onClick ? 'cursor-pointer hover:border-purple-500/30 hover:shadow-md group' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`w-4 h-4 ${stat.color} ${stat.onClick ? 'group-hover:scale-110' : ''} transition-transform`} />
                      {stat.onClick && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{stat.value}</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">{stat.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Become a Worker CTA Card (Only for Basic Account Owner) */}
          {isOwner && (
            <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-6 shadow-xs text-left space-y-3.5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Become a Worker on OpenComm</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Offer skilled services, get listed in the Worker Directory, and receive reviews.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Converting to a Worker Account lets you showcase your skills, set your hourly rate, upload portfolio projects, manage availability, and accept direct hiring requests from employers.
              </p>
              <button 
                onClick={onCreateWorker}
                className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5 hover:scale-102"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Create Worker Profile</span>
              </button>
            </motion.div>
          )}
        </div>

        {/* RIGHT COLUMN: Quick Actions (Account Options & Logout) ~35% */}
        {isOwner && (
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            <motion.div variants={itemVariants} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs text-left">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider font-mono mb-3">Account Options</h3>
              
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
                    className="group flex items-center p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl cursor-pointer transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-xl ${row.bg} ${row.color} flex items-center justify-center shrink-0 mr-3`}>
                      <row.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{row.title}</h4>
                        {row.badge && (
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded-md uppercase tracking-wider shrink-0 font-mono">
                            {row.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate leading-tight">{row.subtitle}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-transform group-hover:translate-x-1 shrink-0" />
                  </div>
                ))}
              </div>
              
              {/* Logout Button */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
                <button
                  onClick={() => setShowLogoutConfirm(false) || setShowLogoutConfirm(true)}
                  className="w-full h-10 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
              className="relative w-full max-w-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Log out of OpenComm?</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">You will need to sign in again to access your account.</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
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
