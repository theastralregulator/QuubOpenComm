import React from 'react';
import { User, MapPin, Calendar, Globe, CheckCircle2, Share2, Briefcase } from 'lucide-react';
import { LocalProfile } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';
import { Job } from '../../types';

interface PublicBasicProfileProps {
  profile: LocalProfile;
  formattedLocation: string;
  joinedYear: number | null;
  publicJobs?: Job[];
  triggerToast: (msg: string) => void;
}

export default function PublicBasicProfile({
  profile,
  formattedLocation,
  joinedYear,
  publicJobs = [],
  triggerToast,
}: PublicBasicProfileProps) {
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      triggerToast('Profile link copied to clipboard!');
    } catch (err) {
      triggerToast('Failed to copy link.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-6 pb-24 sm:pb-12 text-slate-800 dark:text-slate-100 text-left">
      {/* Basic Public Hero Card */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden text-left">
        {/* Soft Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4 min-w-0">
            <UserAvatar
              avatarUrl={profile.avatar_url || ''}
              fullName={profile.full_name || 'OpenComm Member'}
              size="2xl"
              className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl border-4 border-slate-100 dark:border-slate-800 bg-slate-100 shadow-sm shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                  {profile.full_name || 'OpenComm Member'}
                </h1>
                {(profile as any).verified && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" title="Verified Account" />
                )}
                <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-bold font-mono">
                  Member Profile
                </span>
              </div>

              {profile.username && (
                <p className="text-xs font-mono text-slate-400">@{profile.username}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                {formattedLocation && (
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-purple-500 shrink-0" />
                    {formattedLocation}
                  </span>
                )}
                {joinedYear && (
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    Joined {joinedYear}
                  </span>
                )}
                {profile.preferred_language && (
                  <span className="flex items-center">
                    <Globe className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                    {profile.preferred_language}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="h-9 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Profile</span>
          </button>
        </div>

        {/* Bio Section */}
        {profile.bio && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-2">About</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {profile.bio}
            </p>
          </div>
        )}
      </div>

      {/* Public Job Posts (If Any) */}
      {publicJobs.length > 0 && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4 text-left">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-purple-500" />
            <span>Active Job Posts by {profile.full_name?.split(' ')[0] || 'Member'}</span>
          </h3>
          <div className="space-y-3">
            {publicJobs.map((job) => (
              <div key={job.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{job.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{job.location} &bull; {(job as any).job_type || (job as any).category || 'Job'}</p>
                </div>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">Active Post</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
