import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, Star, MapPin, MessageSquare, CheckCircle2, Share2 } from 'lucide-react';
import { analytics } from '../../lib/analytics';
import { formatINR } from '../../lib/currency';
import { formatWorkerRate } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';

export interface WorkerCardProps {
  key?: React.Key;
  id: string;
  name: string;
  avatarUrl: string;
  verified: boolean;
  professionalTitle: string;
  rating: number;
  experienceYears: number;
  hourlyRate: number;
  salaryPeriod?: string;
  expectedSalaryMin?: number;
  expectedSalaryMax?: number;
  expectedSalary?: string;
  shortBio: string;
  location: string;
  availableNow?: boolean;
  availability?: "Available Now" | "Part-time" | "Full-time" | "Busy" | string;
  saved: boolean;
  onSave: (id: string, e: React.MouseEvent) => void;
  onViewProfile: () => void;
  onMessage: (e: React.MouseEvent) => void;
  onHire?: (e: React.MouseEvent) => void;
  showHireButton?: boolean;
  showMessageButton?: boolean;
  isMessaging?: boolean;
  className?: string;
  currentUserId?: string | null;
}

export default function WorkerCard({
  id,
  name,
  avatarUrl,
  verified,
  professionalTitle,
  rating,
  experienceYears,
  hourlyRate,
  salaryPeriod,
  expectedSalaryMin,
  expectedSalaryMax,
  expectedSalary,
  shortBio,
  location,
  availableNow,
  availability,
  saved,
  onSave,
  onViewProfile,
  onMessage,
  onHire,
  showHireButton = false,
  showMessageButton = true,
  isMessaging = false,
  className = '',
  currentUserId,
}: WorkerCardProps) {
  const isSelf = Boolean(currentUserId && id === currentUserId);
  const isAvailableNow = availableNow !== undefined ? availableNow : (availability === 'Available Now');
  const availText = availability || (isAvailableNow ? 'Available Now' : 'Part-time');
  const availColor = isAvailableNow ? 'bg-emerald-500' : 'bg-amber-500';

  const [copied, setCopied] = useState(false);

  const displayRate = formatWorkerRate({
    hourly_rate: hourlyRate,
    expected_salary: expectedSalary
  });

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/workers/${id}`;
    const shareText = `Check out this certified professional on OpenComm: ${name} (${professionalTitle})!`;

    analytics.trackEvent('share', { item_type: 'worker', item_id: id, item_title: name });

    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.warn('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onViewProfile}
      className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden h-full shadow-xs hover:shadow-md cursor-pointer ${className}`}
    >
      <div>
        {/* Header: Photo, Name & Bookmark */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={avatarUrl}
                fullName={name}
                size="md"
              />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111827] ${availColor}`} />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center space-x-1.5">
                <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                  {name}
                </h4>
                {verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 fill-emerald-500/10" />
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate">
                {professionalTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Share Button */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {copied && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10 animate-bounce">
                  Copied URL!
                </div>
              )}
            </div>

            {/* Bookmark Button (Hidden for self) */}
            {!isSelf && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(id, e);
                }}
                className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${
                  saved 
                    ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Stats: Rating, Experience & Hourly Rate */}
        <div className="grid grid-cols-3 gap-1 bg-slate-50/70 dark:bg-slate-800/30 p-2 rounded-xl text-center mb-3">
          <div>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">RATING</span>
            <div className="flex items-center justify-center mt-1 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] space-x-0.5 leading-none">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
              <span>{rating > 0 ? rating.toFixed(1) : 'New'}</span>
            </div>
          </div>
          <div className="border-x border-slate-200/60 dark:border-slate-800/80">
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">EXP</span>
            <span className="block text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 leading-none">
              {experienceYears > 0 ? `${experienceYears} yrs` : 'New'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">RATE / SALARY</span>
            <span className="block text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 leading-none truncate px-0.5" title={displayRate}>
              {displayRate}
            </span>
          </div>
        </div>

        {/* Bio Snippet */}
        {shortBio ? (
          <p className="text-xs text-[#475569] dark:text-slate-300 line-clamp-3 leading-relaxed text-left min-h-[3.25rem]">
            {shortBio}
          </p>
        ) : (
          <div className="min-h-[3.25rem]" />
        )}

        {/* Location & Availability Status */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-[#475569] dark:text-slate-400 text-left">
          <div className="flex items-center space-x-1 text-xs">
            {location ? (
              <>
                <MapPin className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                <span className="truncate max-w-[130px]">{location}</span>
              </>
            ) : (
              <span className="text-slate-400 text-[10px]">Location not specified</span>
            )}
          </div>
          <span className={`font-bold uppercase tracking-wider text-[9px] ${
            isAvailableNow ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
          }`}>
            {availText}
          </span>
        </div>
      </div>

      {/* Actions: View Profile & Message / Manage */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onViewProfile}
          className={`h-11 sm:h-9 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102 ${isSelf ? 'col-span-2' : ''}`}
        >
          <span>{isSelf ? 'Manage Worker Profile' : 'View Profile'}</span>
        </button>
        {!isSelf && showMessageButton && (
          <button
            onClick={onMessage}
            disabled={isMessaging}
            className="h-11 sm:h-9 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102 disabled:opacity-50"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isMessaging ? 'Loading...' : 'Message'}</span>
          </button>
        )}
        {!isSelf && showHireButton && onHire && !showMessageButton && (
          <button
            onClick={onHire}
            className="h-11 sm:h-9 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102"
          >
            <span>Hire</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
