import React from 'react';
import { motion } from 'motion/react';
import { Bookmark, MapPin, DollarSign, Trash2, ArrowRight, ExternalLink, Inbox } from 'lucide-react';
import { Job } from '../../types';

interface SavedJobsPageProps {
  jobs: Job[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  handleApplyJob: (id: string, e: React.MouseEvent) => void;
  onExplore: () => void;
}

export default function SavedJobsPage({
  jobs,
  toggleBookmark,
  handleApplyJob,
  onExplore,
}: SavedJobsPageProps) {
  const savedList = jobs.filter(j => j.bookmarked);

  return (
    <div className="w-full text-left" id="saved-jobs-container">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center">
          <Bookmark className="w-7 h-7 mr-2.5 text-blue-500 fill-current" />
          Saved Opportunities
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Keep track of positions and gigs you have bookmarked for later.
        </p>
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl p-12 text-center max-w-lg mx-auto mt-8 shadow-xs">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mx-auto mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">You have not saved any jobs yet.</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Discover active projects and click the bookmark icon on any job card to save them here.
          </p>
          <button 
            onClick={onExplore}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer hover:scale-103 active:scale-97"
          >
            Explore Active Jobs
          </button>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {savedList.map((job) => (
            <motion.div
              key={job.id}
              layoutId={`saved-job-row-${job.id}`}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/70 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                <img 
                  src={job.companyLogo} 
                  alt={job.company} 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-800 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">{job.company}</span>
                    {job.verified && (
                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded text-[8px] font-bold">VERIFIED</span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                    {job.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> {job.location}</span>
                    <span className="flex items-center font-bold text-blue-600 dark:text-blue-400"><DollarSign className="w-3.5 h-3.5 mr-0.5" /> {job.salary}</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-semibold text-slate-600 dark:text-slate-300">{job.category}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 pt-3 sm:pt-0 shrink-0">
                <button
                  onClick={(e) => toggleBookmark(job.id, e)}
                  className="px-3 py-2 border border-rose-200 dark:border-rose-950 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
                  title="Remove Bookmark"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>

                <button
                  onClick={(e) => handleApplyJob(job.id, e)}
                  disabled={job.applied}
                  className={`px-4.5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                    job.applied 
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-800' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 hover:scale-102 active:scale-98'
                  }`}
                >
                  <span>{job.applied ? 'Applied' : 'Apply Now'}</span>
                  {!job.applied && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>

            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
