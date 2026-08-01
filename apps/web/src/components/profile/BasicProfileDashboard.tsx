import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { 
  MapPin, Calendar, Globe, Camera, Edit2,
  Briefcase, Bookmark, Users, Wrench,
  ChevronRight, Share2, LogOut, MoreHorizontal, Settings,
  CheckCircle2, ShieldCheck, Clock
} from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { LocalProfile } from '../../lib/supabase';
import { Job, Worker } from '../../types';
import { navigateWithOrigin, SESSION_STORAGE_KEYS } from '../../lib/navigation';

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
  onUpdateBanner?: () => void;
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
  onUpdatePhoto,
  onLogout,
  triggerToast
}: BasicProfileDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [showMenuPopover, setShowMenuPopover] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Real database verification status check
  const isVerified = Boolean((profile as any)?.verified || profile?.phone_verified || (profile as any)?.verification_status === 'verified');
  const isPendingVerification = profile?.signup_status === 'pending_verification' || (profile as any)?.verification_status === 'pending';

  const updateMenuPosition = () => {
    if (menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 6,
        right: window.innerWidth - rect.right - window.scrollX,
      });
    }
  };

  // Location resolution
  const isLocationHidden = !isOwner && (profile?.show_location_publicly === false || (profile as any)?.location_visibility === false);
  const displayLocation = isLocationHidden
    ? 'Location hidden'
    : (formattedLocation && formattedLocation.trim().length > 0 ? formattedLocation : 'Location not provided');

  const savedJobsCount = jobs.filter(j => j.bookmarked).length;
  const savedWorkersCount = workers.filter(w => w.bookmarked).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-3 sm:py-6 px-2 sm:px-6 pb-24 sm:pb-12 text-slate-800 dark:text-slate-100 text-left">
      
      {/* ========================================================================= */}
      {/* 1. HERO PROFILE CARD */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xs">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          {/* Avatar & Info */}
          <div className="flex items-center space-x-4 min-w-0">
            <div className="relative shrink-0 group">
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
                  title="Change profile photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="min-w-0 text-left space-y-1">
              {/* Full Name */}
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                  {profile?.full_name || username}
                </h1>
                {isVerified && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 fill-emerald-500/10" title="Verified Account" />
                )}
              </div>

              {/* Basic Account Badge */}
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  ● Basic Account
                </span>
              </div>

              {/* Micro Meta: Real Saved Location -> Preferred Language -> Member Since */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                  {displayLocation}
                </span>

                <span className="flex items-center">
                  <Globe className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                  {profile?.preferred_language && profile.preferred_language.trim().length > 0
                    ? profile.preferred_language.trim()
                    : 'Language not provided'}
                </span>

                {joinedYear && (
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    Member since {joinedYear}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && (
          <div className="mt-4 pt-3 border-t border-purple-500/10 text-left">
            <p className={`text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${isBioExpanded ? '' : 'line-clamp-2'}`}>
              {profile.bio}
            </p>
            {profile.bio.length > 120 && (
              <button
                onClick={() => setIsBioExpanded(!isBioExpanded)}
                className="mt-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
              >
                {isBioExpanded ? 'Show Less' : 'Read More'}
              </button>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div className="mt-5 pt-4 border-t border-purple-500/10 flex items-center justify-between flex-wrap gap-2">
          {isOwner ? (
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              <button
                onClick={onEditProfile}
                className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>

              <button
                ref={menuButtonRef}
                onClick={() => {
                  if (!showMenuPopover) {
                    updateMenuPosition();
                  }
                  setShowMenuPopover(!showMenuPopover);
                }}
                className="h-9 w-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenuPopover && menuPosition && createPortal(
                <>
                  <div 
                    className="fixed inset-0 z-[9998] bg-transparent" 
                    onClick={() => setShowMenuPopover(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    style={{
                      position: 'absolute',
                      top: `${menuPosition.top}px`,
                      right: `${menuPosition.right}px`,
                    }}
                    className="w-48 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-2 z-[9999] text-left"
                  >
                    <button
                      onClick={() => {
                        setShowMenuPopover(false);
                        onEditProfile();
                      }}
                      className="w-full px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-500" />
                      <span>Settings</span>
                    </button>
                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowMenuPopover(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="w-full px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Logout</span>
                      </button>
                    )}
                  </motion.div>
                </>,
                document.body
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => triggerToast("Profile link copied to clipboard!")}
                className="h-9 w-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PROFILE STATISTICS CARDS */}
      {/* ========================================================================= */}
      {isOwner && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/my-job-posts', location, SESSION_STORAGE_KEYS.MY_JOB_POSTS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{myJobPostsCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">My Job Posts</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/jobs-applied', location, SESSION_STORAGE_KEYS.JOBS_APPLIED)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{jobsAppliedCount || 0}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">Jobs Applied</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/saved-jobs', location, SESSION_STORAGE_KEYS.SAVED_JOBS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Bookmark className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{savedJobsCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">Saved Jobs</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/saved-workers', location, SESSION_STORAGE_KEYS.SAVED_WORKERS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{savedWorkersCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">Saved Workers</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BECOME A WORKER CARD */}
      {/* ========================================================================= */}
      {isOwner && (
        <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-6 shadow-xs text-left space-y-3.5">
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VERIFICATION STATUS CARD */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3 text-left">
        <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Verification Status</h3>
        </div>
        
        {isVerified ? (
          <div className="flex items-center space-x-3 p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <strong className="text-slate-900 dark:text-white font-bold block">Verified Account</strong>
              <span className="text-slate-500 dark:text-slate-400">Account identity and security status verified for OpenComm marketplace transactions.</span>
            </div>
          </div>
        ) : isPendingVerification ? (
          <div className="flex items-center space-x-3 p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <strong className="text-amber-700 dark:text-amber-300 font-bold block">Verification Pending</strong>
              <span className="text-slate-500 dark:text-slate-400">Your account verification request is currently under review by moderation.</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <strong className="text-slate-900 dark:text-white font-bold block">Unverified Account</strong>
                <span className="text-slate-500 dark:text-slate-400">Apply for account verification to build trust across the network.</span>
              </div>
            </div>
            <button
              onClick={() => triggerToast("Verification request submitted for review!")}
              className="h-8 px-3.5 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs self-start sm:self-auto"
            >
              Apply for Verification
            </button>
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

    </div>
  );
}
