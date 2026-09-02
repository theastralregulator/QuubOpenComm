import React from 'react';
import { Bookmark, Inbox } from 'lucide-react';
import { Job } from '../../types';
import JobCard from '../cards/JobCard';
import SharedApplicationModal from '../jobs/SharedApplicationModal';

interface SavedJobsPageProps {
  jobs: Job[];
  currentUserId?: string | null;
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  onExplore: () => void;
  applicationsByJobId?: Map<string, any>;
  isApplicationsLoaded?: boolean;
  applicationsStatus?: 'idle' | 'loading' | 'ready' | 'error';
  onRetryApplications?: () => void;
  onApplicationCreated?: (jobId: string, appRecord: any) => void;
  triggerToast?: (msg: string) => void;
  requireCompletedProfile?: (actionName: string, onAllowed: () => void) => void;
}

export default function SavedJobsPage({
  jobs,
  currentUserId,
  toggleBookmark,
  onExplore,
  applicationsByJobId,
  isApplicationsLoaded = true,
  applicationsStatus = 'ready',
  onRetryApplications,
  onApplicationCreated,
  triggerToast,
  requireCompletedProfile,
}: SavedJobsPageProps) {
  const [applyingJob, setApplyingJob] = React.useState<Job | null>(null);
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

      {currentUserId && applicationsStatus === 'error' && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center my-4">
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            Unable to load your application status.
          </p>
          {onRetryApplications && (
            <button
              onClick={onRetryApplications}
              className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              Retry
            </button>
          )}
        </div>
      )}

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 w-full">
          {savedList.map((job) => {
            const isOwner = Boolean(currentUserId && job.posted_by === currentUserId);
            const appRecord = applicationsByJobId?.get(job.id);
            const isApplied = Boolean(appRecord);
            const appStatus = appRecord?.status || null;

            return (
              <JobCard
                key={job.id}
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
                workersNeeded={job.workers_needed}
                filledPositions={job.filled_positions}
                status={job.status}
                isActive={job.is_active}
                created_at={job.created_at || job.datePosted}
                applicationDeadline={job.applicationDeadline}
                saved={job.bookmarked}
                applied={isApplied}
                applicationStatus={appStatus}
                isOwner={isOwner}
                onSave={toggleBookmark}
                onViewDetails={onExplore}
                onApply={(id, e) => {
                  e.stopPropagation();
                  if (!currentUserId) {
                    if (triggerToast) triggerToast("Please sign in to apply.");
                    if (onExplore) onExplore();
                    return;
                  }
                  if (isOwner) {
                    if (triggerToast) triggerToast("You cannot apply to your own job post.");
                    return;
                  }
                  if (!isApplicationsLoaded || applicationsStatus === 'loading') {
                    if (triggerToast) triggerToast("Loading application status...");
                    return;
                  }
                  if (applicationsStatus === 'error') {
                    if (triggerToast) triggerToast("Unable to load application status. Please retry.");
                    return;
                  }
                  if (requireCompletedProfile) {
                    requireCompletedProfile('apply for jobs', () => setApplyingJob(job));
                  } else {
                    setApplyingJob(job);
                  }
                }}
              />
            );
          })}
        </div>
      )}

      {applyingJob && currentUserId && (
        <SharedApplicationModal
          isOpen={true}
          onClose={() => setApplyingJob(null)}
          jobId={applyingJob.id}
          applicantId={currentUserId}
          jobSalary={applyingJob.salary}
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
