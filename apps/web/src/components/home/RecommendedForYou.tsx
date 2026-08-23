import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, Users 
} from 'lucide-react';
import { Job, Worker } from '../../types';
import JobCard from '../cards/JobCard';
import WorkerCard from '../cards/WorkerCard';
import JobCardSkeleton from '../jobs/JobCardSkeleton';
import SharedApplicationModal from '../jobs/SharedApplicationModal';

interface RecommendedForYouProps {
  jobs: Job[];
  workers: Worker[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onViewJobs: () => void;
  onViewWorkers: () => void;
  /** Current user's ID — used to exclude own jobs/profiles */
  currentUserId?: string | null;
  applicationsByJobId?: Map<string, any>;
  isJobsLoaded?: boolean;
  isWorkersLoaded?: boolean;
  isApplicationsLoaded?: boolean;
  isLoggedIn?: boolean;
  onOpenAuth?: (tab: 'signin' | 'signup' | 'locked') => void;
  triggerToast?: (msg: string) => void;
  onApplicationCreated?: (jobId: string, appRecord: any) => void;
}

export default function RecommendedForYou({
  jobs,
  workers,
  toggleBookmark,
  toggleWorkerBookmark,
  onOpenMessage,
  onViewJobs,
  onViewWorkers,
  currentUserId,
  applicationsByJobId,
  isJobsLoaded = true,
  isWorkersLoaded = true,
  isApplicationsLoaded = true,
  isLoggedIn = false,
  onOpenAuth,
  triggerToast,
  onApplicationCreated,
}: RecommendedForYouProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'workers'>('jobs');
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);

  // Up to 6 jobs: exclude own posts and closed/archived/expired jobs
  const recommendedJobs = jobs
    .filter(job => {
      if (currentUserId && (job as any).posted_by === currentUserId) return false;
      const status = (job as any).status || (job as any).jobStatus || '';
      if (['closed', 'archived', 'expired', 'filled'].includes(status.toLowerCase())) return false;
      return true;
    })
    .slice(0, 6);

  // Up to 6 workers: exclude own profile, hidden/inactive
  const recommendedWorkers = workers
    .filter(worker => {
      if (currentUserId && worker.id === currentUserId) return false;
      const isHidden = (worker as any).hidden || (worker as any).is_active === false;
      if (isHidden) return false;
      return true;
    })
    .slice(0, 6);

  return (
    <div className="w-full mt-6 mb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-left">
            RECOMMENDED FOR YOU
          </h3>
          <p className="text-xs text-[#475569] dark:text-[#CBD5E1] mt-0.5 text-left font-medium">
            Personalized from your interests and activity
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
            {!isJobsLoaded || (currentUserId && !isApplicationsLoaded) ? (
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
                <JobCardSkeleton count={6} />
              </div>
            ) : recommendedJobs.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 text-xs font-medium">
                No job recommendations available right now.
              </div>
            ) : (
              /* Desktop: Grid | Mobile: Scrollable horizontal block */
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
                {recommendedJobs.map((job) => {
                  const appRecord = applicationsByJobId?.get(job.id);
                  const isApplied = Boolean(appRecord);
                  const appStatus = appRecord?.status || null;

                  return (
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
                        jobType={job.jobType}
                        created_at={job.created_at || job.datePosted}
                        saved={job.bookmarked}
                        applied={isApplied}
                        applicationStatus={appStatus}
                        applicationDeadline={job.applicationDeadline}
                        onSave={toggleBookmark}
                        onViewDetails={onViewJobs}
                        onApply={(id, e) => {
                          e.stopPropagation();
                          if (!currentUserId || !isLoggedIn) {
                            if (triggerToast) triggerToast("Please sign in to apply.");
                            if (onOpenAuth) onOpenAuth('locked');
                            return;
                          }
                          setApplyingJob(job);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
            {!isWorkersLoaded ? (
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div key={idx} className="w-[280px] sm:w-auto shrink-0 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 animate-pulse space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-1.5 flex-1">
                        <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                        <div className="w-16 h-3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                      </div>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    <div className="w-2/3 h-3 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                ))}
              </div>
            ) : recommendedWorkers.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 text-xs font-medium">
                No worker recommendations available right now.
              </div>
            ) : (
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-4 sm:pb-0 scrollbar-none snap-x snap-mandatory">
                {recommendedWorkers.map((worker) => (
                  <div key={worker.id} className="w-[280px] sm:w-auto shrink-0 snap-start h-full">
                    <WorkerCard
                      id={worker.id}
                      name={worker.name}
                      avatarUrl={worker.photo}
                      professionalTitle={worker.title}
                      rating={worker.rating}
                      experienceYears={worker.experience || 0}
                      hourlyRate={worker.hourlyRate}
                      shortBio={worker.bio || ''}
                      location={worker.location}
                      verified={worker.verified}
                      availability={worker.availability}
                      saved={worker.bookmarked}
                      onSave={toggleWorkerBookmark}
                      onMessage={(e) => { e.stopPropagation(); onOpenMessage(worker.name); }}
                      onViewProfile={onViewWorkers}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Application Modal for Quick Apply from Recommended Home */}
      {applyingJob && currentUserId && (
        <SharedApplicationModal
          isOpen={Boolean(applyingJob)}
          jobId={applyingJob.id}
          applicantId={currentUserId}
          jobSalary={applyingJob.salary}
          onClose={() => setApplyingJob(null)}
          onSuccess={(appRecord) => {
            const targetJobId = applyingJob.id;
            setApplyingJob(null);
            if (onApplicationCreated) {
              onApplicationCreated(targetJobId, appRecord);
            }
          }}
        />
      )}
    </div>
  );
}
