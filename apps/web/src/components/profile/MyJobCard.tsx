import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MapPin, IndianRupee, Calendar, Users, CheckCircle2, MoreVertical, Briefcase, Edit2, Trash2, Eye, Clock } from 'lucide-react';
import { formatSalaryRange } from '../../lib/currency';
import { getJobDateRangeInfo } from '../../lib/deadline';
import { formatJobType } from '../../lib/jobType';

export interface MyJobItem {
  id: string;
  title: string;
  description: string;
  location: string;
  salary_range: string;
  category: string;
  job_type: string | null;
  posted_by: string;
  created_at: string;
  application_deadline: string | null;
  is_active?: boolean;
}

export interface OwnerProfile {
  full_name?: string;
  avatar_url?: string;
  verified?: boolean;
}

interface MyJobCardProps {
  job: MyJobItem;
  ownerProfile?: OwnerProfile;
  applicationCount: number;
  onEdit: (jobId: string) => void;
  onView: (jobId: string) => void;
  onDelete: (jobId: string) => Promise<void>;
}

export function getJobLifecycleStatus(job: {
  is_active?: boolean;
  application_deadline?: string | null;
  created_at?: string;
}): {
  status: 'active' | 'closed' | 'archived' | 'deleted';
  label: string;
  badgeClass: string;
} {
  if (job.is_active === false) {
    return {
      status: 'deleted',
      label: 'Deleted',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
    };
  }

  const deadlineStr = job.application_deadline;
  if (!deadlineStr) {
    return {
      status: 'active',
      label: 'Active',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    };
  }

  const deadline = new Date(deadlineStr);
  if (isNaN(deadline.getTime())) {
    return {
      status: 'active',
      label: 'Active',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  
  const diffTime = deadlineStart.getTime() - todayStart.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < -4) {
    return {
      status: 'archived',
      label: 'Archived',
      badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    };
  }

  if (daysRemaining < 0) {
    return {
      status: 'closed',
      label: 'Applications Closed',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
    };
  }

  return {
    status: 'active',
    label: 'Active',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
  };
}

export default function MyJobCard({
  job,
  ownerProfile,
  applicationCount,
  onEdit,
  onView,
  onDelete,
}: MyJobCardProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const createdDate = new Date(job.created_at);
  const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
  const canEdit = hoursSinceCreation <= 5;

  const lifecycle = getJobLifecycleStatus(job);
  const dateRangeInfo = getJobDateRangeInfo(job.created_at, job.application_deadline);
  const formattedSalary = formatSalaryRange(undefined, undefined, job.salary_range);
  const displayJobType = formatJobType(job.job_type);

  const ownerName = ownerProfile?.full_name || 'My Post';
  const getInitials = (nameStr: string) => {
    const parts = nameStr.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const handleDeleteClick = async () => {
    if (window.confirm('Delete this job post? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await onDelete(job.id);
      } catch (err) {
        setIsDeleting(false);
      }
    }
  };

  const handleManageApplicationsClick = () => {
    setShowMenu(false);
    navigate(`/jobs/${job.id}/applications`);
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-[linear-gradient(180deg,#FFFFFF_0%,#FBF9FF_60%,#FAFBFF_100%)] dark:bg-[#111827] border border-[#ECEEF5] dark:border-[#273449]/40 rounded-[22px] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden shadow-xs hover:shadow-md text-left"
    >
      <div className="space-y-2.5">
        {/* Top Row: Owner Info, Lifecycle Badge & Three-Dot Overflow Menu */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            {ownerProfile?.avatar_url ? (
              <img 
                src={ownerProfile.avatar_url} 
                alt={ownerName} 
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shrink-0" 
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C4DFF] to-[#4F46E5] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                {getInitials(ownerName)}
              </div>
            )}
            <div className="min-w-0 text-left">
              <h4 className="text-xs font-bold text-[#475569] dark:text-slate-300 truncate">
                {ownerName}
              </h4>
              {ownerProfile?.verified && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[10px] font-bold mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-[#059669] dark:text-emerald-400 shrink-0" />
                  <span>Verified</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Real Lifecycle Status Badge */}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${lifecycle.badgeClass}`}>
              {lifecycle.label}
            </span>

            {/* Three-Dot Menu Trigger */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Owner Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full Job Title - 2-3 Lines Natural Wrapping */}
        <h3 
          className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-snug whitespace-normal break-words overflow-visible text-left hover:text-[#2563EB] transition-colors cursor-pointer"
          onClick={() => onView(job.id)}
        >
          {job.title}
        </h3>

        {/* Short Description */}
        {job.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed text-left">
            {job.description}
          </p>
        )}

        {/* Meta Details: Location, Salary, Posted-Deadline Range & Application Count */}
        <div className="space-y-1.5 text-xs text-[#475569] dark:text-slate-300 text-left pt-0.5">
          <div className="flex items-center space-x-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
            <span className="whitespace-normal break-words">{job.location}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold whitespace-normal break-words">{formattedSalary}</span>
          </div>
          <div className="flex items-center space-x-1.5" title={dateRangeInfo.tooltipText}>
            <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-normal break-words ${dateRangeInfo.badgeColorClass}`}>
              {dateRangeInfo.rangeLabel}
            </span>
          </div>
          
          {/* Clickable Application Count Button */}
          <div className="flex items-center space-x-1.5 pt-0.5">
            <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
            <button
              type="button"
              onClick={handleManageApplicationsClick}
              className="text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
            >
              {applicationCount} {applicationCount === 1 ? 'Application' : 'Applications'}
            </button>
          </div>
        </div>

        {/* Category & Job Type Tags */}
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {job.category || 'Professional'}
          </span>
          <span className="text-[10px] font-bold tracking-wide bg-slate-100 dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full">
            {displayJobType}
          </span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onView(job.id)}
          className="h-10 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1"
        >
          <span>View Details</span>
        </button>

        <button
          type="button"
          onClick={handleManageApplicationsClick}
          className="h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold text-xs border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 transition-all cursor-pointer flex items-center justify-center space-x-1"
        >
          <Briefcase className="w-3.5 h-3.5 shrink-0" />
          <span>Manage Job</span>
        </button>
      </div>

      {/* Portal Three-Dot Overflow Menu */}
      {showMenu && menuButtonRef.current && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowMenu(false)} 
          />
          <div 
            style={{
              position: 'fixed',
              top: `${menuButtonRef.current.getBoundingClientRect().bottom + 6}px`,
              left: `${Math.max(12, menuButtonRef.current.getBoundingClientRect().right - 220)}px`,
              width: '210px'
            }}
            className="z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              type="button"
              onClick={handleManageApplicationsClick}
              className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors"
            >
              <Briefcase className="w-4 h-4 shrink-0 text-purple-600" />
              <span>Manage Applications</span>
            </button>

            <button
              type="button"
              onClick={() => { setShowMenu(false); onView(job.id); }}
              className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Eye className="w-4 h-4 shrink-0 text-slate-400" />
              <span>View Details</span>
            </button>

            {canEdit ? (
              <button
                type="button"
                onClick={() => { setShowMenu(false); onEdit(job.id); }}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-4 h-4 shrink-0 text-slate-400" />
                <div className="flex flex-col text-left">
                  <span>Edit Post</span>
                  <span className="text-[10px] text-emerald-600 font-bold">5h window active</span>
                </div>
              </button>
            ) : (
              <div 
                title="The 5-hour edit window has expired for this job."
                className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed"
              >
                <Edit2 className="w-4 h-4 shrink-0 opacity-40" />
                <div className="flex flex-col text-left">
                  <span>Edit Expired</span>
                  <span className="text-[10px] text-slate-400">5-hour window ended</span>
                </div>
              </div>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              type="button"
              disabled={isDeleting}
              onClick={() => { setShowMenu(false); handleDeleteClick(); }}
              className="w-full flex items-center space-x-2.5 px-3.5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Delete Post</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </motion.div>
  );
}
