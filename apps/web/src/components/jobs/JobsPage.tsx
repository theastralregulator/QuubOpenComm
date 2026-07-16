import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, SlidersHorizontal, MapPin, DollarSign, Calendar, 
  Bookmark, Share2, CheckCircle, ChevronDown, Sparkles, X,
  Briefcase, CheckCircle2, Star, ArrowRight, ExternalLink,
  Heart, MessageSquare, BadgeCheck
} from 'lucide-react';
import { Job } from '../../types';

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
  // Filters state
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('All'); // All, Full-time, Part-time, Freelance, Remote
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // newest, salary
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Apply Job Modal states
  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [bidRate, setBidRate] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  // Hardcode some categories for the quick chips
  const categoriesList = ['All', 'Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'];

  // Share handler
  const handleShare = (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: `${job.title} at ${job.company}`,
        text: job.description,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/jobs/${job.id}`);
      triggerToast(`Link to "${job.title}" copied to clipboard!`);
    }
  };

  // Filter & sort logic
  const filteredJobs = jobs.filter(job => {
    // Search
    const matchesSearch = !searchQuery || 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.requirements.some(r => r.toLowerCase().includes(searchQuery.toLowerCase()));

    // Category
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || job.category === selectedCategory;

    // Location
    const matchesLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());

    // Job Type
    const matchesJobType = jobTypeFilter === 'All' || 
      (jobTypeFilter === 'Remote' && (job.location.toLowerCase().includes('remote') || job.requirements.some(r => r.toLowerCase() === 'remote'))) ||
      (jobTypeFilter === 'Full-time' && !job.salary.includes('/ day')) ||
      (jobTypeFilter === 'Freelance' && (job.company.toLowerCase().includes('freelance') || job.requirements.some(r => r.toLowerCase() === 'freelance'))) ||
      (jobTypeFilter === 'Part-time' && job.requirements.some(r => r.toLowerCase().includes('part')));

    // Verified
    const matchesVerified = !verifiedOnly || job.verified;

    return matchesSearch && matchesCategory && matchesLocation && matchesJobType && matchesVerified;
  });

  // Sort
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'newest') {
      return 1; // Keep feed default order/as inserted
    } else if (sortBy === 'salary') {
      // Crude extract of numbers for sorting
      const getVal = (s: string) => {
        const num = s.replace(/[^0-9]/g, '');
        return parseInt(num) || 0;
      };
      return getVal(b.salary) - getVal(a.salary);
    }
    return 0;
  });

  const categoriesShortcuts = ['All', 'Developer', 'Designer', 'Electrician', 'Carpenter'];

  return (
    <div className="w-full text-left space-y-6 pb-[calc(110px+env(safe-area-inset-bottom))]" id="jobs-page-container">
      
      {/* 1. Page Title & Subtitle */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-[28px] md:text-[34px] font-sans font-bold text-slate-900 dark:text-white flex items-center tracking-tight gap-1">
          ✨ Discover Opportunities
        </h1>
        <p className="text-[15px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
          Browse verified opportunities and connect with trusted employers.
        </p>
      </div>

      {/* 2. Search Bar (height 52px, rounded-16px, shadow, custom glow) */}
      <div className="relative rounded-[16px] bg-white dark:bg-[#1C152B] border border-slate-200/95 dark:border-purple-500/15 p-1 flex items-center h-[52px] shadow-[0_10px_25px_rgba(20,20,40,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition-all focus-within:border-[#7C3AED] focus-within:ring-4 focus-within:ring-[#7C3AED]/10">
        <Search className="w-5 h-5 text-slate-400 dark:text-purple-400/75 ml-3.5 mr-2.5 shrink-0" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs, keywords, requirements or companies..."
          className="w-full py-1.5 text-xs sm:text-sm bg-transparent border-none focus:outline-none focus:ring-0 text-slate-900 dark:text-slate-50 placeholder-slate-400/90 dark:placeholder-slate-500/90 font-medium font-sans"
        />
        {searchQuery && (
          <button 
            type="button"
            onClick={() => setSearchQuery('')}
            className="p-1 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Category Chips (Horizontally scrollable on mobile) */}
      <div className="w-full overflow-x-auto whitespace-nowrap flex items-center space-x-1.5 pb-1 scrollbar-none">
        {categoriesList.map((cat) => {
          const isSelected = selectedCategory === cat || (cat === 'All' && !selectedCategory);
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-normal border transition-all cursor-pointer shrink-0 ${
                isSelected 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                  : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 4. Sort + Filter Row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Sort:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none text-xs font-semibold pl-2 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="salary">Highest Budget</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Mobile Filters button - hidden on desktop */}
        <button
          onClick={() => setShowMobileFilters(true)}
          className="lg:hidden px-3 py-1.5 rounded-lg bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shrink-0 active:scale-[0.98] transition-transform"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <span>Filters</span>
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* DESKTOP FILTERS SIDE PANEL (Hidden on Mobile) */}
        <div className="hidden lg:block lg:col-span-3 bg-white dark:bg-[#111827] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-left shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-xs text-slate-400 dark:text-slate-500">Filters</span>
            {(locationFilter || jobTypeFilter !== 'All' || verifiedOnly) && (
              <button 
                onClick={() => {
                  setLocationFilter('');
                  setJobTypeFilter('All');
                  setVerifiedOnly(false);
                }}
                className="text-[11px] text-blue-500 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Job Type Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500">Job Type</label>
            <div className="space-y-1.5">
              {['All', 'Full-time', 'Part-time', 'Freelance', 'Remote'].map((type) => (
                <label key={type} className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <input 
                    type="radio" 
                    name="jobType"
                    checked={jobTypeFilter === type}
                    onChange={() => setJobTypeFilter(type)}
                    className="h-3.5 w-3.5 text-blue-600 border-slate-300 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Location Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500">Location</label>
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                placeholder="e.g. Remote, Kochi"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Verification toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mr-1" /> Credibility
            </label>
            <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
              <input 
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-3.5 w-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span>Verified clients only</span>
            </label>
          </div>

        </div>

        {/* FEED / JOB FEED COLUMN */}
        <div className="col-span-1 lg:col-span-9">
          {sortedJobs.length === 0 ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">No postings match your filters</h3>
              <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">Try modifying your search text, category chip, or clearing active search terms.</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setLocationFilter('');
                  setJobTypeFilter('All');
                  setVerifiedOnly(false);
                }}
                className="mt-4 px-4 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedJobs.map((job) => {
                const isFeatured = job.id === 'job-1' || job.id === 'job-3';
                const maxSkillsToShow = 2;
                const visibleSkills = job.requirements.slice(0, maxSkillsToShow);
                const remainingSkillsCount = job.requirements.length - maxSkillsToShow;
                
                return (
                  <motion.div
                    key={job.id}
                    layoutId={`job-card-${job.id}`}
                    onClick={() => {
                      setApplyingJob(job);
                      setBidRate(job.salary);
                      setCoverLetter('Hi! I am very interested in this role and would love to collaborate on this. I have extensive experience in responsive development, TypeScript, and modern frameworks.');
                    }}
                    className={`w-full overflow-hidden p-5 sm:p-[18px] bg-white sm:bg-transparent sm:premium-purple-card border border-[#ECECEC] sm:border-purple-500/10 dark:sm:border-purple-500/15 rounded-[22px] sm:rounded-none shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:shadow-none relative flex flex-col sm:flex-row gap-3.5 sm:gap-4 transition-all duration-200 cursor-pointer text-left ${
                      isFeatured && !window.matchMedia('(max-width: 640px)').matches
                        ? 'border-purple-500/25 dark:border-purple-500/30' 
                        : ''
                    }`}
                  >
                    {/* Mobile Top Row */}
                    <div className="flex sm:hidden items-center justify-between gap-2 w-full">
                      <div className="flex items-center gap-3.5">
                        <img 
                          src={job.companyLogo} 
                          alt={job.company} 
                          referrerPolicy="no-referrer"
                          className="w-[56px] h-[56px] rounded-[16px] object-cover border border-[#ECECEC] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[18px] font-semibold text-slate-800 leading-none">
                              {job.company}
                            </span>
                            {job.verified && (
                              <BadgeCheck className="w-5 h-5 text-[#2563EB] shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {isFeatured && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">
                          Featured
                        </span>
                      )}
                    </div>

                    {/* Desktop Left side: Company Logo */}
                    <div className="hidden sm:block shrink-0">
                      <img 
                        src={job.companyLogo} 
                        alt={job.company} 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-[14px] object-cover border border-slate-200/40 dark:border-purple-500/10 shrink-0 bg-slate-50 dark:bg-[#1C152B]"
                      />
                    </div>

                    {/* Right side: Information Details */}
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {/* Top row: Company details, Verified Badge, Bookmark buttons (Desktop only) */}
                      <div className="hidden sm:flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-wrap">
                          <span className="text-[15px] font-semibold text-slate-600 dark:text-purple-300">
                            {job.company}
                          </span>
                          
                          {job.verified && (
                            <div className="flex items-center space-x-1" title="Verified client">
                              <span className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-[#2563EB] text-white shadow-[0_0_8px_rgba(37,99,235,0.45)] hover:scale-110 transition-transform duration-150">
                                <svg className="w-2.5 h-2.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Verified</span>
                            </div>
                          )}

                          {isFeatured && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/15">
                              Featured
                            </span>
                          )}
                        </div>

                        {/* Actions block: Share and save */}
                        <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => handleShare(job, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-purple-300 hover:bg-slate-100/50 dark:hover:bg-purple-950/30 rounded-lg transition-all cursor-pointer"
                            title="Share listing"
                          >
                            <Share2 className="w-5 h-5" />
                          </button>

                          <button 
                            onClick={(e) => toggleBookmark(job.id, e)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer hover:bg-slate-100/50 dark:hover:bg-purple-950/30 hover:scale-115 ${
                              job.bookmarked 
                                ? 'text-[#7C3AED]' 
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            }`}
                            title={job.bookmarked ? "Remove bookmark" : "Save job"}
                          >
                            <Bookmark className={`w-5 h-5 ${job.bookmarked ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>

                      {/* Job Title */}
                      <h3 className="text-[20px] sm:text-[18px] font-bold text-slate-900 dark:text-white sm:dark:text-white sm:text-slate-900 leading-snug tracking-tight line-clamp-1">
                        {job.title}
                      </h3>

                      {/* Mobile Salary and Location */}
                      <div className="flex sm:hidden flex-col gap-2 w-full">
                        <span className="text-[18px] font-bold text-emerald-600">
                          {job.salary}
                        </span>
                        <span className="text-[15px] text-slate-500 flex items-center font-medium">
                          <MapPin className="w-5 h-5 mr-1.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                          {job.location}
                        </span>
                      </div>

                      {/* Job Description */}
                      <p className="block sm:hidden text-[15px] font-normal leading-[1.6] text-slate-600 line-clamp-3">
                        {job.description}
                      </p>
                      <p className="hidden sm:block text-[14px] font-normal leading-[1.7] text-slate-500 dark:text-purple-200/70 line-clamp-2">
                        {job.description}
                      </p>

                      {/* Metadata badges row (Desktop only) */}
                      <div className="hidden sm:flex flex-wrap items-center gap-3 text-[13px] font-medium text-slate-500 dark:text-slate-400 pt-1">
                        <span className="px-2.5 py-0.5 bg-[#F3E8FF] dark:bg-[#3B2A5C]/80 text-[#7C3AED] dark:text-[#D8B4FE] text-[11px] font-bold uppercase tracking-wider font-mono rounded-md">
                          {job.category}
                        </span>
                        <span className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {job.salary}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 flex items-center font-medium">
                          <MapPin className="w-5 h-5 mr-1 text-slate-400 dark:text-purple-400/50 shrink-0" strokeWidth={1.5} />
                          {job.location}
                        </span>
                      </div>

                      {/* Mobile Skills Chips */}
                      <div className="flex sm:hidden items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-bold text-slate-400 mr-1 uppercase tracking-wider font-mono">Skills:</span>
                        {visibleSkills.map((req, i) => (
                          <span key={i} className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-600 text-[13px] font-semibold rounded-full">
                            {req}
                          </span>
                        ))}
                        {remainingSkillsCount > 0 && (
                          <span className="px-2.5 py-1 text-[13px] font-mono font-bold text-slate-500 bg-slate-100 rounded-full">
                            +{remainingSkillsCount}
                          </span>
                        )}
                      </div>

                      {/* Desktop Skills & requirements tags */}
                      <div className="hidden sm:flex items-center gap-1.5 flex-wrap pt-2.5 border-t border-slate-100 dark:border-purple-900/20">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-purple-400 uppercase tracking-wider font-mono mr-1">Skills:</span>
                        {visibleSkills.map((req, i) => (
                          <span key={i} className="px-3 py-1 bg-[#F3E8FF] dark:bg-[#3B2A5C] text-[#6D28D9] dark:text-[#D8B4FE] text-[10px] font-semibold rounded-full border border-purple-500/5">
                            {req}
                          </span>
                        ))}
                        {remainingSkillsCount > 0 && (
                          <span className="px-2.5 py-1 text-[10px] font-mono font-bold text-slate-500 dark:text-purple-300 bg-slate-100 dark:bg-[#2C243A] rounded-full">
                            +{remainingSkillsCount}
                          </span>
                        )}
                      </div>

                      {/* Mobile Buttons */}
                      <div className="flex sm:hidden items-center gap-3 w-full mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setApplyingJob(job);
                            setBidRate(job.salary);
                            setCoverLetter('Hi! I am very interested in this role and would love to collaborate on this. I have extensive experience in responsive development, TypeScript, and modern frameworks.');
                          }}
                          className="h-[46px] rounded-[16px] bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm shadow-[0_4px_15px_rgba(124,58,237,0.25)] flex items-center justify-center flex-1 cursor-pointer active:scale-98 transition-transform"
                        >
                          Apply Now
                        </button>
                        
                        <button
                          onClick={(e) => {
                            toggleBookmark(job.id, e);
                          }}
                          className={`h-[46px] w-[46px] rounded-[16px] border ${
                            job.bookmarked 
                              ? 'border-red-200 bg-red-50 text-red-500' 
                              : 'border-[#ECECEC] bg-white text-slate-600'
                          } flex items-center justify-center cursor-pointer active:scale-98 transition-transform shrink-0`}
                          title={job.bookmarked ? "Remove bookmark" : "Save job"}
                        >
                          <Heart className={`w-5 h-5 ${job.bookmarked ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerToast(`Opening direct message thread with ${job.company}...`);
                          }}
                          className="h-[46px] w-[46px] rounded-[16px] border border-[#ECECEC] bg-white text-slate-600 flex items-center justify-center cursor-pointer active:scale-98 transition-transform shrink-0"
                          title="Message employer"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                      </div>

                    </div>
                  </motion.div>
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
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-[#111827] rounded-t-[32px] border-t border-slate-200 dark:border-[#273449] p-6 text-left shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-[#273449] mb-5">
                <span className="font-bold text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 font-display">Refine Postings</span>
                <button 
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6 overflow-y-auto flex-1 pb-6 pr-1">
                {/* Job Type */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Job Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['All', 'Full-time', 'Part-time', 'Freelance', 'Remote'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setJobTypeFilter(type)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold text-center border transition-all ${
                          jobTypeFilter === type 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-[#273449] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      placeholder="e.g. Remote, Kochi"
                      className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Verification */}
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Credibility</label>
                  <button
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center border flex items-center justify-center space-x-2 transition-all ${
                      verifiedOnly 
                        ? 'bg-emerald-600 border-emerald-600 text-white' 
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-[#273449] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Verified Clients Only</span>
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex gap-2.5">
                <button
                  onClick={() => {
                    setLocationFilter('');
                    setJobTypeFilter('All');
                    setVerifiedOnly(false);
                  }}
                  className="w-1/3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 text-center cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-2/3 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold text-center shadow-md cursor-pointer"
                >
                  Apply Filters ({sortedJobs.length} matches)
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PREMIUM APPLICATION MODAL */}
      <AnimatePresence>
        {applyingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="absolute inset-0" onClick={() => setApplyingJob(null)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] p-6 text-left shadow-2xl overflow-hidden"
            >
              {/* Colored accent header */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
              
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-950 uppercase tracking-widest font-mono">
                    Project Application
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1.5 leading-snug">
                    Apply for {applyingJob.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    at {applyingJob.company} • {applyingJob.location}
                  </p>
                </div>
                
                <button 
                  onClick={() => setApplyingJob(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form elements */}
              <div className="space-y-4 pt-2">
                {/* Proposed Bid Rate */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                    Proposed Rate / Bid Rate
                  </label>
                  <div className="relative rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-slate-900 overflow-hidden focus-within:border-blue-500">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                    </div>
                    <input 
                      type="text"
                      value={bidRate}
                      onChange={(e) => setBidRate(e.target.value)}
                      placeholder="e.g. $80/hr or $2,500 fixed"
                      className="w-full pl-8 pr-4 py-2.5 text-xs font-semibold bg-transparent border-none text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-0"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Suggested matching listing budget: <span className="font-bold text-slate-700 dark:text-slate-300">{applyingJob.salary}</span>
                  </p>
                </div>

                {/* Cover Message / Note */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">
                    Application Note / Cover Message
                  </label>
                  <textarea 
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={4}
                    placeholder="Describe your qualifications, relevant background, and how you plan to complete this job..."
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-[#273449] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none leading-relaxed font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setApplyingJob(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleApplyJob(applyingJob.id, bidRate, coverLetter);
                    setApplyingJob(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  Submit Application Request
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
