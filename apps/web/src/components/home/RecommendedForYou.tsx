import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, Users 
} from 'lucide-react';
import { Job, Worker } from '../../types';
import JobCard from '../cards/JobCard';
import WorkerCard from '../cards/WorkerCard';

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
            Based on your interests and recent activity
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
                <div key={job.id} className="w-[280px] sm:w-auto shrink-0 snap-start h-full">
                  <JobCard
                    id={job.id}
                    companyName={job.company}
                    companyLogo={job.companyLogo}
                    companyVerified={job.verified}
                    title={job.title}
                    shortDescription={job.description}
                    location={job.location}
                    salaryRange={job.salary}
                    category={job.category}
                    saved={job.bookmarked}
                    applied={job.applied}
                    onSave={toggleBookmark}
                    onViewDetails={onViewJobs}
                    onApply={(id, e) => handleApplyJob(id, e)}
                  />
                </div>
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
                <div key={worker.id} className="w-[280px] sm:w-auto shrink-0 snap-start h-full">
                  <WorkerCard
                    id={worker.id}
                    name={worker.name}
                    avatarUrl={worker.photo}
                    verified={worker.verified}
                    professionalTitle={worker.title}
                    rating={worker.rating}
                    experienceYears={worker.experience}
                    hourlyRate={worker.hourlyRate}
                    shortBio={worker.bio}
                    location={worker.location}
                    availability={worker.availability}
                    saved={(worker as any).bookmarked}
                    onSave={toggleWorkerBookmark}
                    onViewProfile={onViewWorkers}
                    onMessage={() => onOpenMessage(worker.name)}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
