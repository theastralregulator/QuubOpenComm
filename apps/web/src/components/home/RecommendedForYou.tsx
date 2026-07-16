import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, MapPin, DollarSign, Bookmark, CheckCircle2, Star, 
  MessageSquare, UserCheck, ArrowRight, Award, ShieldCheck, Users 
} from 'lucide-react';
import { Job, Worker } from '../../types';

interface RecommendedForYouProps {
  jobs: Job[];
  workers: Worker[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  handleApplyJob: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onViewJobs: () => void;
  onViewWorkers: () => void;
}

export default function RecommendedForYou({
  jobs,
  workers,
  toggleBookmark,
  toggleWorkerBookmark,
  handleApplyJob,
  onOpenMessage,
  onViewJobs,
  onViewWorkers,
}: RecommendedForYouProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'workers'>('jobs');

  // Select the top 3 recommended jobs and workers
  const recommendedJobs = jobs.slice(0, 3);
  const recommendedWorkers = workers.slice(0, 3);

  return (
    <div className="w-full mt-6 mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-left">
            RECOMMENDED FOR YOU
          </h3>
          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-0.5 text-left font-medium">
            Based on your interests and sandbox activity
          </p>
        </div>

        {/* Dynamic Dual-Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-[#172033] rounded-xl border border-slate-200/50 dark:border-slate-800/40 select-none">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer flex items-center space-x-1 ${
              activeTab === 'jobs'
                ? 'bg-white dark:bg-[#111827] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('workers')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer flex items-center space-x-1 ${
              activeTab === 'workers'
                ? 'bg-white dark:bg-[#111827] text-[#7C3AED] dark:text-[#C084FC] shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workers</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'jobs' ? (
          <motion.div
            key="jobs-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {/* Desktop: Grid | Mobile: Scrollable horizontal block */}
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
              {recommendedJobs.map((job) => (
                <motion.div
                  key={job.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-4 flex flex-col justify-between w-[280px] sm:w-auto shrink-0 snap-start shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden"
                >
                  <div>
                    {/* Header: Company & Logo & Bookmark */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <img 
                          src={job.companyLogo} 
                          alt={job.company} 
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-xl object-cover bg-slate-50 border border-slate-100" 
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#475569] dark:text-slate-300 truncate">
                            {job.company}
                          </h4>
                          <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-1.5 py-0.5 rounded-md mt-0.5">
                            <ShieldCheck className="w-3 h-3 mr-0.5 stroke-[2.5]" />
                            Verified
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleBookmark(job.id, e)}
                        className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${
                          job.bookmarked 
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${job.bookmarked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight hover:text-blue-600 transition-colors line-clamp-1">
                      {job.title}
                    </h3>

                    {/* Job Details: Location, Salary, Category */}
                    <div className="mt-3 space-y-1.5 text-xs text-[#475569] dark:text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-semibold">{job.salary}</span>
                      </div>
                    </div>

                    {/* Job type tag */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                        {job.category || 'Professional'}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800/60 text-[#475569] dark:text-slate-300 px-2 py-0.5 rounded-full">
                        Full-time
                      </span>
                    </div>
                  </div>

                  {/* Actions: View Details & Apply */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2">
                    <button
                      onClick={onViewJobs}
                      className="h-9 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102"
                    >
                      <span>View Details</span>
                    </button>
                    <button
                      onClick={(e) => handleApplyJob(job.id, e)}
                      disabled={job.applied}
                      className={`h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer ${
                        job.applied 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default' 
                          : 'bg-gradient-to-r from-[#2563EB] to-blue-600 hover:opacity-95 text-white shadow-xs hover:shadow-md hover:scale-102'
                      }`}
                    >
                      {job.applied ? (
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
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="workers-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {/* Desktop: Grid | Mobile: Scrollable horizontal block */}
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
              {recommendedWorkers.map((worker) => (
                <motion.div
                  key={worker.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-4 flex flex-col justify-between w-[280px] sm:w-auto shrink-0 snap-start shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden"
                >
                  <div>
                    {/* Header: Photo & Name & Bookmark */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img 
                            src={worker.photo} 
                            alt={worker.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-100" 
                          />
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#111827] ${
                            worker.availability === 'Available Now' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                              {worker.name}
                            </h4>
                            {worker.verified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 fill-emerald-500/10" />
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            {worker.title}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleWorkerBookmark(worker.id, e)}
                        className={`p-1.5 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer ${
                          (worker as any).bookmarked 
                            ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' 
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${(worker as any).bookmarked ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Stats: Rating & Experience & Hourly Rate */}
                    <div className="grid grid-cols-3 gap-1 bg-slate-50/70 dark:bg-slate-800/30 p-2 rounded-xl text-center mb-3">
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">RATING</span>
                        <div className="flex items-center justify-center mt-1 text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] space-x-0.5 leading-none">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                          <span>{worker.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <div className="border-x border-slate-200/60 dark:border-slate-800/80">
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">EXP</span>
                        <span className="block text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 leading-none">
                          {worker.experience} yrs
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none">HOURLY</span>
                        <span className="block text-xs font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 leading-none">
                          ${worker.hourlyRate}/hr
                        </span>
                      </div>
                    </div>

                    {/* Bio Snippet */}
                    <p className="text-xs text-[#475569] dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {worker.bio}
                    </p>

                    {/* Location & Availability Status */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-[#475569] dark:text-slate-400">
                      <div className="flex items-center space-x-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                        <span className="truncate max-w-[130px]">{worker.location}</span>
                      </div>
                      <span className={`font-bold uppercase tracking-wider text-[9px] ${
                        worker.availability === 'Available Now' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
                      }`}>
                        {worker.availability}
                      </span>
                    </div>
                  </div>

                  {/* Actions: View Profile & Message */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#273449]/30 grid grid-cols-2 gap-2">
                    <button
                      onClick={onViewWorkers}
                      className="h-9 rounded-xl border border-slate-200 dark:border-[#273449] hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs font-bold text-[#475569] dark:text-slate-200 transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102"
                    >
                      <span>View Profile</span>
                    </button>
                    <button
                      onClick={() => onOpenMessage(worker.name)}
                      className="h-9 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1 hover:scale-102"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
