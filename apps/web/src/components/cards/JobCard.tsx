import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, MapPin, IndianRupee, ShieldCheck, CheckCircle2, Share2, Calendar, Clock } from 'lucide-react';
import { analytics } from '../../lib/analytics';
import { formatSalaryRange } from '../../lib/currency';
import { getDeadlineInfo } from '../../lib/deadline';

export interface JobCardProps {
  key?: React.Key;
  id: string;
  companyName: string;
  companyLogo: string;
  companyVerified: boolean;
  title: string;
  shortDescription: string;
  location: string;
  salaryRange: string;
  category: string;
  employmentType?: string;
  saved: boolean;
  applied?: boolean;
  applicationDeadline?: string;
  onSave: (id: string, e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onApply: (id: string, e: React.MouseEvent) => void;
  className?: string;
}

export default function JobCard({
  id,
  companyName,
  companyLogo,
  companyVerified,
  title,
  shortDescription,
  location,
  salaryRange,
  category,
  employmentType = 'Full-time',
  saved,
  applied = false,
  applicationDeadline,
  onSave,
  onViewDetails,
  onApply,
  className = '',
}: JobCardProps) {
  const [copied, setCopied] = useState(false);

  const deadlineInfo = getDeadlineInfo(applicationDeadline);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/jobs/${id}`;
    const shareText = `Check out this job on OpenComm: ${title} at ${companyName}!`;

    analytics.trackEvent('share', { item_type: 'job', item_id: id, item_title: title });

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
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

  const formattedSalary = formatSalaryRange(undefined, undefined, salaryRange);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onViewDetails}
      className={`bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden h-full shadow-xs hover:shadow-md cursor-pointer ${className}`}
    >
      <div>
        {/* Header: Company, Logo & Bookmark */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <img 
              src={companyLogo} 
              alt={companyName} 
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800" 
            />
            <div className="min-w-0 text-left">
              <h4 className="text-xs font-bold text-[#475569] dark:text-slate-300 truncate">
                {companyName}
              </h4>
              {companyVerified && (
                <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-1.5 py-0.5 rounded-md mt-0.5">
                  <ShieldCheck className="w-3 h-3 mr-0.5 stroke-[2.5]" />
                  Verified
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Share Button */}
            <div className="relative">
              <button
                onClick={handleShare}
                aria-label="Share Job"
                className="p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                title="Share Job"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {copied && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap z-10 animate-bounce">
                  Copied URL!
                </div>
              )}
            </div>

            {/* Bookmark Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave(id, e);
              }}
              aria-label="Bookmark Job"
              className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${
                saved 
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${saved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight hover:text-blue-600 transition-colors line-clamp-1 text-left">
          {title}
        </h3>

        {/* Short Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed text-left">
          {shortDescription}
        </p>

        {/* Job Details: Location, Salary & Deadline */}
        <div className="mt-3 space-y-1.5 text-xs text-[#475569] dark:text-slate-300 text-left">
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span className="truncate">{location}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{formattedSalary}</span>
          </div>
          {/* Application Deadline Badge Line */}
          <div className="flex items-center space-x-1.5 pt-0.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${deadlineInfo.badgeColorClass}`}>
              {deadlineInfo.label}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {category || 'Professional'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full">
            {employmentType}
          </span>
        </div>
      </div>

      {/* Actions: View Details & Apply */}
      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onViewDetails}
          className="h-11 sm:h-9 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102"
        >
          <span>View Details</span>
        </button>
        <button
          onClick={(e) => onApply(id, e)}
          disabled={applied || deadlineInfo.isExpired}
          aria-disabled={applied || deadlineInfo.isExpired}
          className={`h-11 sm:h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
            deadlineInfo.isExpired
              ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
              : applied 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default' 
                : 'bg-gradient-to-r from-[#2563EB] to-blue-600 hover:opacity-95 text-white shadow-xs hover:shadow-md hover:scale-102'
          }`}
        >
          {deadlineInfo.isExpired ? (
            <span>Applications Closed</span>
          ) : applied ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Applied</span>
            </>
          ) : (
            <span>Apply</span>
          )}
        </button>
      </div>
    </motion.div>
  );
}
