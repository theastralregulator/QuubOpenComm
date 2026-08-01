import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, Globe, CheckCircle2, Share2, Briefcase, ChevronRight, Edit2 } from 'lucide-react';
import { LocalProfile } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';
import { Job } from '../../types';

interface PublicBasicProfileProps {
  profile: LocalProfile;
  formattedLocation: string;
  joinedYear: number | null;
  publicJobs?: Job[];
  myJobPostsCount?: number;
  isOwner?: boolean;
  onEditProfile?: () => void;
  triggerToast: (msg: string) => void;
}

export default function PublicBasicProfile({
  profile,
  formattedLocation,
  joinedYear,
  publicJobs = [],
  myJobPostsCount = 0,
  isOwner = false,
  onEditProfile,
  triggerToast,
}: PublicBasicProfileProps) {
  const navigate = useNavigate();
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Verification status
  const isVerified = Boolean((profile as any)?.verified || profile?.phone_verified || (profile as any)?.verification_status === 'verified');

  // Location resolution: respect location visibility setting for non-owners
  const isLocationHidden = !isOwner && (profile?.show_location_publicly === false || (profile as any)?.location_visibility === false);
  const displayLocation = isLocationHidden
    ? 'Location hidden'
    : (formattedLocation && formattedLocation.trim().length > 0 ? formattedLocation : 'Location not provided');

  const displayLanguage = profile?.preferred_language && profile.preferred_language.trim().length > 0
    ? profile.preferred_language.trim()
    : 'Language not provided';

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      triggerToast('Profile link copied to clipboard!');
    } catch (err) {
      triggerToast('Failed to copy link.');
    }
  };

  const activeJobPostsCount = myJobPostsCount || publicJobs.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-3 sm:py-6 px-2 sm:px-6 pb-24 sm:pb-12 text-slate-800 dark:text-slate-100 text-left">
      
      {/* ========================================================================= */}
      {/* 1. HERO PROFILE CARD */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xs">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
          {/* Avatar & Info */}
          <div className="flex items-center space-x-4 min-w-0">
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={profile?.avatar_url || ''}
                fullName={profile?.full_name || profile?.username || 'OpenComm User'}
                size="2xl"
                className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl border-4 border-white dark:border-[#111827] shadow-md bg-slate-100"
              />
            </div>

            <div className="min-w-0 text-left space-y-1">
              {/* Full Name */}
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                  {profile?.full_name || profile?.username || 'OpenComm User'}
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

              {/* Micro Meta: Location -> Preferred Language -> Member Since */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                <span className="flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                  {displayLocation}
                </span>

                <span className="flex items-center">
                  <Globe className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                  {displayLanguage}
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

          {/* Action Button: Edit Profile (Owner Only) or Share */}
          <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
            {isOwner && onEditProfile ? (
              <button
                onClick={onEditProfile}
                className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button 
                onClick={handleShare}
                className="h-9 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                title="Share Profile"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Profile</span>
              </button>
            )}
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
      </div>

      {/* ========================================================================= */}
      {/* 2. PUBLIC STATISTICS (Active Job Posts Count) */}
      {/* ========================================================================= */}
      {activeJobPostsCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{activeJobPostsCount}</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block truncate">Active Job Posts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Public Job Posts Listing (If Any) */}
      {publicJobs.length > 0 && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 text-left">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Job Listings</h3>
          </div>
          <div className="space-y-3">
            {publicJobs.map((job) => (
              <div 
                key={job.id} 
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-purple-500/30 transition-all cursor-pointer group"
              >
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">{job.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{job.location || 'Remote'} &bull; {(job as any).category || 'General'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
