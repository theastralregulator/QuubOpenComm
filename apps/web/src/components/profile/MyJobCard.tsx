import React, { useState } from 'react';
import { Briefcase, MapPin, DollarSign, Clock, MoreVertical, Edit2, Trash2, Eye, Power } from 'lucide-react';
import { Job } from '../../types';

interface MyJobCardProps {
  job: Job;
  onEdit: (jobId: string) => void;
  onView: (jobId: string) => void;
  onChangeStatus: (jobId: string, isActive: boolean) => Promise<void>;
  onDelete: (jobId: string) => Promise<void>;
}

export const MyJobCard: React.FC<MyJobCardProps> = ({ job, onEdit, onView, onChangeStatus, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  
  // Parse created_at
  const createdDate = (job as any).created_at ? new Date((job as any).created_at) : new Date((job as any).datePosted);
  const hoursSinceCreation = (new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  const canEdit = hoursSinceCreation <= 5;
  
  // Fallback status if job object doesn't carry it (local mock type vs db)
  // Our db schema uses `is_active`, we can assume `job` type has it or we pass it
  const isActive = (job as any).is_active ?? true;

  const handleDelete = async () => {
    if (window.confirm('Delete this job post? This action cannot be undone.')) {
      setIsDeleting(true);
      try {
        await onDelete(job.id);
      } catch (err) {
        setIsDeleting(false);
      }
    }
  };

  const handleStatusChange = async () => {
    setIsStatusChanging(true);
    try {
      await onChangeStatus(job.id, !isActive);
    } finally {
      setIsStatusChanging(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative text-left">
      <div className="flex justify-between items-start">
        <div className="space-y-1 pr-8">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{job.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
              isActive 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50' 
                : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
            }`}>
              {isActive ? 'Active' : 'Paused'}
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{job.category}</p>
        </div>

        {/* Context Menu */}
        <div className="relative">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-10 overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); onView(job.id); }}
                className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Eye className="w-4 h-4" />
                <span>View Job</span>
              </button>
              
              {canEdit ? (
                <button
                  onClick={() => { setShowMenu(false); onEdit(job.id); }}
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Details</span>
                </button>
              ) : (
                <div 
                  title="This job can no longer be edited because the 5-hour editing period has ended."
                  className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-400 dark:text-slate-600 cursor-not-allowed"
                >
                  <Edit2 className="w-4 h-4 opacity-50" />
                  <span>Edit Details</span>
                </div>
              )}
              
              <button
                onClick={handleStatusChange}
                disabled={isStatusChanging}
                className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Power className="w-4 h-4" />
                <span>{isActive ? 'Pause Job' : 'Activate Job'}</span>
              </button>
              
              <div className="border-t border-slate-100 dark:border-slate-800"></div>
              
              <button
                onClick={() => { setShowMenu(false); handleDelete(); }}
                disabled={isDeleting}
                className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Job</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 mt-5">
        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
          <MapPin className="w-4 h-4 mr-1.5 text-slate-400" />
          {job.location}
        </div>
        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
          <DollarSign className="w-4 h-4 mr-1.5 text-slate-400" />
          {job.salary}
        </div>
        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
          <Briefcase className="w-4 h-4 mr-1.5 text-slate-400" />
          {(job as any).employment_type || 'Contract'}
        </div>
        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
          <Clock className="w-4 h-4 mr-1.5 text-slate-400" />
          {createdDate.toLocaleDateString()}
        </div>
      </div>
      
      {/* Click-away layer for menu */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};
export default MyJobCard;
