import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, SlidersHorizontal, ChevronDown, X,
  Briefcase
} from 'lucide-react';
import { Job } from '../../types';
import JobCard from '../cards/JobCard';
import { getDeadlineInfo } from '../../lib/deadline';
import { navigateWithOrigin, SESSION_STORAGE_KEYS } from '../../lib/navigation';
import { supabase } from '../../lib/supabase';
import SharedApplicationModal from './SharedApplicationModal';

interface JobsPageProps {
  jobs: Job[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  handleApplyJob: (id: string, bid: string, note: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn?: boolean;
  onOpenAuth?: (tab: 'signin' | 'signup' | 'locked') => void;
}

export default function JobsPage({
  jobs,
  toggleBookmark,
  handleApplyJob,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  triggerToast,
  isLoggedIn = false,
  onOpenAuth,
}: JobsPageProps) {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Local fetch state
  const [localJobs, setLocalJobs] = useState<Job[]>(jobs);
  const [isFetching, setIsFetching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (jobs && jobs.length > 0) {
      setLocalJobs(jobs);
    }
  }, [jobs]);

  // Filters state
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('All'); // All, Full-time, Part-time, Freelance, Remote
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // newest, closing_soon, salary
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Fetch jobs from Supabase on mount
  useEffect(() => {
    let active = true;
    const fetchJobs = async () => {
      setIsFetching(true);
      try {
        const { dbService } = await import('../../lib/supabase');
        const data = await dbService.getJobsFromDb();
        if (active && data) {
          setLocalJobs(data);
        }
      } catch (err) {
        console.error("Error fetching jobs in JobsPage:", err);
      } finally {
        if (active) setIsFetching(false);
      }
    };
    fetchJobs();
    
    return () => { active = false; };
  }, []);

  // Fetch authenticated user and batched applications
  useEffect(() => {
    async function checkAuthAndApplications() {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        } else {
          setCurrentUserId(null);
          setApplicationsMap(new Map());
        }
      } catch (err) {
        console.error('Error fetching auth user in JobsPage:', err);
      }
    }

    checkAuthAndApplications();
  }, []);

  // Filter & sort logic
  const filteredJobs = useMemo(() => {
    return localJobs.filter(job => {
      // Search
      const matchesSearch = !searchQuery || 
        job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.posterName && job.posterName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.requirements && job.requirements.some(r => r.toLowerCase().includes(searchQuery.toLowerCase())));

      // Category
      const matchesCategory = !selectedCategory || selectedCategory === 'All' || job.category === selectedCategory;

      // Location
      const matchesLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());

      // Job Type
      const matchesJobType = jobTypeFilter === 'All' || 
        (jobTypeFilter === 'Remote' && (job.location.toLowerCase().includes('remote') || (job.requirements && job.requirements.some(r => r.toLowerCase() === 'remote')))) ||
        (jobTypeFilter === 'Full-time' && !job.salary.includes('/ day')) ||
        (jobTypeFilter === 'Freelance' && (job.company.toLowerCase().includes('freelance') || (job.requirements && job.requirements.some(r => r.toLowerCase() === 'freelance')))) ||
        (jobTypeFilter === 'Part-time' && job.requirements && job.requirements.some(r => r.toLowerCase().includes('part')));

      // Verified
      const matchesVerified = !verifiedOnly || job.verified;

      return matchesSearch && matchesCategory && matchesLocation && matchesJobType && matchesVerified;
    });
  }, [localJobs, searchQuery, selectedCategory, locationFilter, jobTypeFilter, verifiedOnly]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      if (sortBy === 'closing_soon') {
        const infoA = getDeadlineInfo(a.applicationDeadline);
        const infoB = getDeadlineInfo(b.applicationDeadline);
        if (infoA.isExpired && !infoB.isExpired) return 1;
        if (!infoA.isExpired && infoB.isExpired) return -1;
        return infoA.daysRemaining - infoB.daysRemaining;
      } else if (sortBy === 'salary') {
        const getVal = (s: string) => {
          const num = s.replace(/[^0-9]/g, '');
          return parseInt(num) || 0;
        };
        return getVal(b.salary) - getVal(a.salary);
      }
      return 0;
    });
  }, [filteredJobs, sortBy]);

  // Batch query applications for current user across visible jobs
  useEffect(() => {
    async function batchFetchApplications() {
      if (!currentUserId || !supabase || sortedJobs.length === 0) return;

      const visibleJobIds = sortedJobs.map(j => j.id);
      try {
        const { data, error } = await supabase
          .from('job_applications')
          .select('id, job_id, status, created_at')
          .eq('applicant_id', currentUserId)
          .in('job_id', visibleJobIds);

        if (!error && data) {
          const map = new Map<string, any>();
          data.forEach(app => map.set(app.job_id, app));
          setApplicationsMap(map);
        }
      } catch (err) {
        console.error('Error batch fetching job applications:', err);
      }
    }

    batchFetchApplications();
  }, [currentUserId, sortedJobs]);

  const categoriesList = ['All', 'Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'];

  const [applyingJob, setApplyingJob] = useState<Job | null>(null);

  const handleApplyClick = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isLoggedIn && !currentUserId) {
      triggerToast("Please sign in to apply.");
      if (onOpenAuth) onOpenAuth('locked');
      return;
    }

    if (currentUserId && job.posted_by === currentUserId) {
      triggerToast("You cannot apply to your own job.");
      navigate('/profile/my-jobs');
      return;
    }

    const existingApp = applicationsMap.get(job.id);
    if (existingApp) {
      triggerToast(`You have already applied for this job (Status: ${existingApp.status || 'pending'}).`);
      return;
    }

    const deadlineInfo = getDeadlineInfo(job.applicationDeadline);
    if (job.is_active === false || deadlineInfo.isExpired) {
      triggerToast("This job is no longer accepting applications.");
      return;
    }

    // Open the application modal instead of directly submitting
    setApplyingJob(job);
  };

  const handleModalSuccess = (appId: string) => {
    if (applyingJob) {
      triggerToast("Application submitted successfully!");
      setApplicationsMap(prev => {
        const next = new Map(prev);
        next.set(applyingJob.id, { id: appId, status: 'pending' });
        return next;
      });
      setApplyingJob(null);
    }
  };

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_50%,#F9FBFF_100%)] dark:bg-[linear-gradient(180deg,#080C14_0%,#0F1424_50%,#080C14_100%)] min-h-screen text-left pb-[calc(110px+env(safe-area-inset-bottom))]" id="jobs-page-container">
      
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pt-3 sm:pt-6 space-y-4">
        
        {/* 1. Page Title & Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2 bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 px-3 py-1 rounded-full shadow-2xs w-fit">
            <Briefcase className="w-3.5 h-3.5" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono">JOB MARKETPLACE</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#111827] dark:text-white flex items-center tracking-tight gap-2">
            <Briefcase className="w-6 h-6 text-[#6C4DFF] shrink-0" />
            <span>Discover Opportunities</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-slate-400 font-medium leading-relaxed">
            Explore verified jobs and projects from trusted employers.
          </p>
        </div>

        {/* 2. Search Bar */}
        <div className="relative rounded-2xl bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 p-1 flex items-center h-12 shadow-xs transition-all focus-within:border-[#6C4DFF]">
          <Search className="w-4 h-4 text-[#6B7280] ml-3 mr-2 shrink-0" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobs, keywords, requirements or companies..."
            className="w-full py-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none text-[#111827] dark:text-white placeholder-[#6B7280] font-medium"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 mr-1 text-[#6B7280] hover:text-[#111827] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3. Category Chips (Horizontally Scrollable) */}
        <div className="w-full overflow-x-auto whitespace-nowrap flex items-center space-x-1.5 py-1 no-scrollbar">
          {categoriesList.map((cat) => {
            const isSelected = selectedCategory === cat || (cat === 'All' && !selectedCategory);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-normal border transition-all cursor-pointer shrink-0 ${
                  isSelected 
                    ? 'bg-[#6C4DFF] border-[#6C4DFF] text-white shadow-xs' 
                    : 'bg-white dark:bg-[#0F172A] border-[#ECEEF5] dark:border-slate-800 text-[#475569] dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 4. Sort + Filter Row */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[#6B7280] font-mono">Sort:</span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none text-xs font-bold pl-2.5 pr-7 py-2 rounded-xl border border-[#ECEEF5] dark:border-slate-800 bg-white dark:bg-[#0F172A] text-[#111827] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="closing_soon">Closing Soon (Nearest Deadline)</option>
                <option value="salary">Highest Budget</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={() => setShowMobileFilters(true)}
            className="lg:hidden px-3.5 py-2 rounded-xl bg-white dark:bg-[#0F172A] text-[#111827] dark:text-white border border-[#ECEEF5] dark:border-slate-800 hover:bg-slate-50 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>Filters</span>
          </button>
        </div>

        {/* MAIN CARDS LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-2">
          
          {/* DESKTOP FILTERS SIDE PANEL */}
          <aside className="hidden lg:block lg:col-span-3 bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 text-left space-y-5 shadow-2xs">
            <div className="flex justify-between items-center pb-3 border-b border-[#ECEEF5] dark:border-slate-800">
              <span className="font-extrabold text-xs uppercase tracking-wider text-[#6B7280]">Refine Jobs</span>
              {(locationFilter || jobTypeFilter !== 'All' || verifiedOnly) && (
                <button 
                  onClick={() => {
                    setLocationFilter('');
                    setJobTypeFilter('All');
                    setVerifiedOnly(false);
                  }}
                  className="text-[11px] font-bold text-[#6C4DFF] hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Job Type */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Job Type</label>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Full-time', 'Part-time', 'Freelance', 'Remote'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setJobTypeFilter(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      jobTypeFilter === type 
                        ? 'bg-[#6C4DFF] border-[#6C4DFF] text-white shadow-2xs' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-[#ECEEF5] dark:border-slate-700 text-[#475569] dark:text-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Location</label>
              <input
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="Filter by city..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#F7F8FE] dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 text-[#111827] dark:text-white focus:outline-none focus:border-[#6C4DFF]"
              />
            </div>

            {/* Verified Employer Only */}
            <div className="pt-2 border-t border-[#ECEEF5] dark:border-slate-800">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6C4DFF] focus:ring-0 border-[#ECEEF5]"
                />
                <span className="text-xs font-extrabold text-[#111827] dark:text-white">Verified Employers Only</span>
              </label>
            </div>
          </aside>

          {/* JOBS LIST GRID */}
          <div className="lg:col-span-9 w-full space-y-4">
            {sortedJobs.length === 0 ? (
              <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[24px] p-8 text-center space-y-3 shadow-2xs">
                <div className="w-12 h-12 mx-auto bg-indigo-50 dark:bg-indigo-950/20 text-[#6C4DFF] rounded-2xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-[#111827] dark:text-white">No jobs found</h3>
                <p className="text-xs text-[#6B7280]">Try adjusting your search terms or filters to find more opportunities.</p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setLocationFilter('');
                    setJobTypeFilter('All');
                    setVerifiedOnly(false);
                    setSearchQuery('');
                  }}
                  className="mt-2 px-4 py-2 text-xs bg-[#6C4DFF] hover:bg-[#5b3edf] text-white rounded-xl font-bold transition-all cursor-pointer shadow-xs"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 w-full">
                {sortedJobs.map((job) => {
                  const isOwner = currentUserId ? job.posted_by === currentUserId : false;
                  const appRecord = applicationsMap.get(job.id);
                  const isApplied = Boolean(appRecord) || job.applied;
                  const appStatus = appRecord?.status || null;

                  return (
                    <JobCard
                      key={job.id}
                      id={job.id}
                      companyName={job.company}
                      companyLogo={job.companyLogo}
                      companyVerified={job.verified}
                      posterRole={job.posterRole}
                      title={job.title}
                      shortDescription={job.description}
                      location={job.location}
                      salaryRange={job.salary}
                      category={job.category}
                      jobType={job.jobType}
                      employmentType={job.employment_type}
                      created_at={job.created_at || job.datePosted}
                      saved={job.bookmarked}
                      applied={isApplied}
                      applicationStatus={appStatus}
                      isOwner={isOwner}
                      isActive={job.is_active !== false}
                      isSubmitting={false}
                      applicationDeadline={job.applicationDeadline}
                      onSave={(id, e) => toggleBookmark(id, e)}
                      onViewDetails={() => navigate(`/jobs/${job.id}`)}
                      onApply={(id, e) => handleApplyClick(job, e)}
                      onManageJob={() => navigateWithOrigin(
                        navigate,
                        `/jobs/${job.id}/applications`,
                        location,
                        SESSION_STORAGE_KEYS.manageApplications(job.id)
                      )}
                    />
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* MOBILE BOTTOM SHEET FOR FILTERS */}
        <AnimatePresence>
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs">
              <div className="absolute inset-0" onClick={() => setShowMobileFilters(false)} />
              
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-[#0F172A] rounded-t-[28px] border-t border-[#ECEEF5] dark:border-slate-800 p-5 text-left shadow-2xl flex flex-col z-10"
              >
                <div className="flex justify-between items-center pb-3 border-b border-[#ECEEF5] dark:border-slate-800 mb-4">
                  <span className="font-black text-xs uppercase tracking-wider text-[#6B7280]">Refine Postings</span>
                  <button 
                    onClick={() => setShowMobileFilters(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-5 overflow-y-auto flex-1 pb-4">
                  {/* Job Type */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Job Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['All', 'Full-time', 'Part-time', 'Freelance', 'Remote'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setJobTypeFilter(type)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-all ${
                            jobTypeFilter === type 
                              ? 'bg-[#6C4DFF] border-[#6C4DFF] text-white' 
                              : 'bg-slate-50 dark:bg-slate-800/40 border-[#ECEEF5] dark:border-slate-800 text-[#475569] dark:text-slate-300'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Location</label>
                    <input
                      type="text"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder="Filter by city..."
                      className="w-full px-3 py-2.5 text-xs rounded-xl bg-[#F7F8FE] dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800 text-[#111827] dark:text-white focus:outline-none focus:border-[#6C4DFF]"
                    />
                  </div>

                  {/* Verified Only */}
                  <div className="pt-2 border-t border-[#ECEEF5] dark:border-slate-800">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={verifiedOnly}
                        onChange={(e) => setVerifiedOnly(e.target.checked)}
                        className="w-4 h-4 rounded text-[#6C4DFF] focus:ring-0 border-[#ECEEF5]"
                      />
                      <span className="text-xs font-bold text-[#111827] dark:text-white">Verified Employers Only</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#ECEEF5] dark:border-slate-800">
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="w-full h-11 rounded-xl bg-[#6C4DFF] text-white font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-md"
                  >
                    Apply Filters
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

      {applyingJob && currentUserId && (
        <SharedApplicationModal
          isOpen={true}
          onClose={() => setApplyingJob(null)}
          jobId={applyingJob.id}
          applicantId={currentUserId}
          jobSalary={applyingJob.salary}
          onSuccess={handleModalSuccess}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
