import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bookmark, MapPin, IndianRupee, CheckCircle2, Share2, Calendar, Briefcase, RefreshCw } from 'lucide-react';
import { analytics } from '../../lib/analytics';
import { formatSalaryRange } from '../../lib/currency';
import { getJobDateRangeInfo } from '../../lib/deadline';
import { formatJobType } from '../../lib/jobType';

export interface JobCardProps {
  key?: React.Key;
  id: string;
  companyName: string;
  companyLogo: string;
  companyVerified: boolean;
  posterRole?: string;
  title: string;
  shortDescription: string;
  location: string;
  salaryRange: string;
  category: string;
  employmentType?: string;
  jobType?: string;
  created_at?: string;
  saved: boolean;
  applied?: boolean;
  applicationStatus?: string | null;
  isOwner?: boolean;
  isActive?: boolean;
  isSubmitting?: boolean;
  applicationDeadline?: string;
  workersNeeded?: number;
  filledPositions?: number;
  status?: string;
  onSave: (id: string, e: React.MouseEvent) => void;
  onViewDetails: () => void;
  onApply: (id: string, e: React.MouseEvent) => void;
  onManageJob?: (id: string) => void;
  className?: string;
}

export default function JobCard({
  id,
  companyName,
  companyLogo,
  companyVerified,
  posterRole,
  title,
  shortDescription,
  location,
  salaryRange,
  category,
  employmentType,
  jobType,
  created_at,
  saved,
  applied = false,
  applicationStatus = null,
  isOwner = false,
  isActive = true,
  isSubmitting = false,
  applicationDeadline,
  workersNeeded = 1,
  filledPositions = 0,
  status: jobStatus,
  onSave,
  onViewDetails,
  onApply,
  onManageJob,
  className = '',
}: JobCardProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const dateRangeInfo = getJobDateRangeInfo(created_at, applicationDeadline);
  const isJobFull = filledPositions >= workersNeeded;
  const isClosed = !isActive || dateRangeInfo.isExpired || jobStatus === 'closed' || isJobFull;

  const displayJobType = formatJobType(jobType || employmentType);

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

  const handleManageJobClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onManageJob) {
      onManageJob(id);
    } else {
      navigate(`/jobs/${id}/applications`);
    }
  };

  const renderStatusButton = () => {
    if (isOwner) {
      return (
        <button
          type="button"
          onClick={handleManageJobClick}
          className="h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition-all cursor-pointer flex items-center justify-center space-x-1"
        >
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span>Manage Applications</span>
        </button>
      );
    }

    if (isClosed) {
      return (
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700 cursor-not-allowed flex items-center justify-center"
        >
          <span>Closed</span>
        </button>
      );
    }

    if (applied || applicationStatus) {
      const status = applicationStatus || 'pending';
      let label = 'Applied · Pending';
      let styleClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200/60';

      if (status === 'under_review') {
        label = 'Under Review';
        styleClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200/60';
      } else if (status === 'shortlisted') {
        label = 'Shortlisted';
        styleClass = 'bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border border-purple-200/60';
      } else if (status === 'accepted') {
        label = 'Accepted';
        styleClass = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60';
      } else if (status === 'rejected') {
        label = 'Rejected';
        styleClass = 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200/60';
      } else if (status === 'withdrawn') {
        label = 'Withdrawn';
        styleClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200';
      }

      return (
        <button
          type="button"
          onClick={onViewDetails}
          className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1 cursor-pointer ${styleClass}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      );
    }

    if (isClosed) {
      return (
        <button
          type="button"
          onClick={onViewDetails}
          className="h-10 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center space-x-1 cursor-pointer"
        >
          <span>{isJobFull ? 'Positions Filled' : 'Closed'}</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={isSubmitting}
        onClick={(e) => onApply(id, e)}
        className="h-10 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#4F46E5] hover:opacity-95 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs hover:shadow-md hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Applying...</span>
          </>
        ) : (
          <span>Apply</span>
        )}
      </button>
    );
  };

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.005 }}
      onClick={onViewDetails}
      className={`bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF9FF_60%,#FAFBFF_100%)] dark:bg-[#111827] border border-[#ECEEF5] dark:border-[#273449]/40 rounded-[20px] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden h-full shadow-xs hover:shadow-md cursor-pointer ${className}`}
    >
      <div>
        {/* Header: Company, Logo & Green Circular Verified Badge */}
        <div className="flex justify-between items-start mb-2.5">
          <div className="flex items-center space-x-2.5 min-w-0">
            <img 
              src={companyLogo} 
              alt={companyName} 
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shrink-0" 
            />
            <div className="min-w-0 text-left">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {companyName}
              </h4>
              {posterRole && (
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block truncate">
                  {posterRole}
                </span>
              )}
              {companyVerified && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[10px] font-bold mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-[#059669] dark:text-emerald-400 shrink-0" />
                  <span>Verified</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Share Button */}
            <div className="relative">
              <button
                type="button"
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
              type="button"
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

        {/* Title - UN-TRUNCATED 2-3 LINES FULL VISIBILITY */}
        <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-snug whitespace-normal break-words overflow-visible text-left hover:text-[#2563EB] transition-colors">
          {title}
        </h3>

        {/* Short Description */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed text-left">
          {shortDescription}
        </p>

        {/* Job Details: Location, Salary & Real Posted Date - Deadline Range */}
        <div className="mt-3 space-y-1.5 text-xs text-[#475569] dark:text-slate-300 text-left">
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span className="whitespace-normal break-words">{location}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold whitespace-normal break-words">{formattedSalary}</span>
          </div>
          {/* Posted Date – Application Deadline Range */}
          <div className="flex items-center space-x-1.5 pt-0.5" title={dateRangeInfo.tooltipText}>
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-normal break-words ${dateRangeInfo.badgeColorClass}`}>
              {dateRangeInfo.rangeLabel}
            </span>
          </div>
        </div>

        {/* Category & Job Type Tags & Workers Needed Capacity */}
        <div className="mt-3 flex flex-wrap gap-1 items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {category || 'Professional'}
          </span>
          <span className="text-[10px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full">
            {displayJobType}
          </span>
          {workersNeeded > 1 && (
            <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full ${
              isJobFull ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {filledPositions} / {workersNeeded} Filled
            </span>
          )}
        </div>
      </div>

      {/* Bottom Actions: View Details & Apply / Status Button */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onViewDetails}
          className="h-10 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1"
        >
          <span>View Details</span>
        </button>

        {renderStatusButton()}
      </div>
    </motion.div>
  );
}
