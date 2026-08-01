import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, IndianRupee, Calendar, Briefcase, 
  CheckCircle2, Bookmark, Share2, Send, Clock, RefreshCw,
  MessageSquare, Shield, X, Edit3, Trash2, MoreVertical
} from 'lucide-react';
import { Job } from '../../types';
import { supabase, dbService } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';
import { getDeadlineInfo } from '../../lib/deadline';
import { formatJobType } from '../../lib/jobType';
import { getPublicProfileById } from '../../lib/profileService';
import { navigateWithOrigin, SESSION_STORAGE_KEYS } from '../../lib/navigation';

interface JobDetailPageProps {
  jobs: Job[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  handleApplyJob: (id: string, bid: string, note: string) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn: boolean;
  onOpenAuth: (tab: 'signin' | 'signup' | 'locked') => void;
  onEditJob?: (job: Job) => void;
  onDeleteJob?: (job: Job) => Promise<void>;
}

export default function JobDetailPage({
  jobs,
  toggleBookmark,
  handleApplyJob,
  triggerToast,
  isLoggedIn,
  onOpenAuth,
  onEditJob,
  onDeleteJob,
}: JobDetailPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply form state
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [bidRate, setBidRate] = useState('');
  const [coverLetter, setCoverLetter] = useState('Hi! I am very interested in this opportunity and would love to collaborate on this project. I have extensive relevant experience and look forward to hearing from you.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loggedInId, setLoggedInId] = useState<string | null>(null);
  const isOwner = Boolean(job?.posted_by && loggedInId === job.posted_by);
  
  // 5-hour edit window calculation (using server/database created_at timestamp)
  const createdAtTime = job?.created_at ? new Date(job.created_at).getTime() : Date.now();
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
  const canEdit = isOwner && (Date.now() <= (createdAtTime + FIVE_HOURS_MS));

  // Three-dot owner menu state & portal positioning
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280 });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm && !isDeleting) {
        setShowDeleteConfirm(false);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteConfirm, isDeleting]);

  const [dbApplied, setDbApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [existingApp, setExistingApp] = useState<any>(null);

  // Canonical Employer Profile State (Prevents Flicker)
  const [employerProfile, setEmployerProfile] = useState<{
    id: string | null;
    name: string;
    avatarUrl: string | null;
    loading: boolean;
    avatarError: boolean;
  }>({
    id: null,
    name: '',
    avatarUrl: null,
    loading: true,
    avatarError: false,
  });

  // Real Employer Metrics State
  const [employerMetrics, setEmployerMetrics] = useState<{
    avgRating: number | null;
    reviewCount: number;
    jobsCount: number | null;
    memberSinceYear: number | null;
    loading: boolean;
  }>({
    avgRating: null,
    reviewCount: 0,
    jobsCount: null,
    memberSinceYear: null,
    loading: true,
  });

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;
      setLoading(true);
      setError(null);

      let currentAuthUserId: string | null = null;
      if (supabase) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) {
          console.error('[Job Details] Auth error:', authError);
        }
        currentAuthUserId = user?.id ?? null;
        setLoggedInId(currentAuthUserId);

        if (currentAuthUserId) {
          const { data: existingApplication } = await supabase
            .from('job_applications')
            .select('id, status, proposed_rate, created_at')
            .eq('job_id', jobId)
            .eq('applicant_id', currentAuthUserId)
            .maybeSingle();

          if (existingApplication) {
            setDbApplied(true);
            setApplicationStatus(existingApplication.status);
            setExistingApp(existingApplication);
          }
        }
      }

      // Check local jobs first
      const localJob = jobs.find((j) => j.id === jobId);
      if (localJob) {
        setJob(localJob);
        setBidRate(localJob.salary);
        setLoading(false);
        return;
      }

      // Fetch from Supabase if not found locally
      if (supabase) {
        try {
          const { data, error: sbError } = await supabase
            .from('jobs')
            .select('*, companies(*)')
            .eq('id', jobId)
            .single();

          if (sbError) {
            console.error('Error fetching job from Supabase:', sbError);
          } else if (data) {
            const mappedJob: Job = {
              id: data.id,
              title: data.title,
              company: data.companies?.name || data.company_name || 'OpenComm User',
              companyLogo: data.companies?.logo_url || data.company_logo || '',
              salary: data.salary_range || 'Contract',
              location: data.location || 'Remote',
              category: data.category || 'Professional',
              jobType: data.job_type || 'Full-time',
              description: data.description || '',
              requirements: Array.isArray(data.requirements) ? data.requirements : [],
              verified: data.verified !== undefined ? data.verified : true,
              bookmarked: false,
              applied: dbApplied,
              datePosted: new Date(data.created_at).toLocaleDateString(),
              applicationDeadline: data.application_deadline || data.deadline || data.expires_at || null,
              is_active: data.is_active !== undefined ? data.is_active : true,
              created_at: data.created_at,
              posted_by: data.posted_by
            };
            setJob(mappedJob);
            setBidRate(mappedJob.salary);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Supabase fetch exception:', err);
        }
      }

      setError('Job opportunity could not be found or has been closed.');
      setLoading(false);
    }

    fetchJob();
  }, [jobId, jobs]);

  // CANONICAL EMPLOYER PROFILE FETCH (SINGLE SOURCE OF TRUTH)
  useEffect(() => {
    let isCurrent = true;

    const loadEmployerProfile = async () => {
      if (!job?.posted_by) {
        setEmployerProfile({
          id: '',
          name: 'OpenComm User',
          avatarUrl: null,
          verified: false,
          loading: false,
          avatarError: false,
        });
        return;
      }

      setEmployerProfile(prev => ({ ...prev, loading: true, avatarError: false }));

      try {
        const canonical = await getPublicProfileById(job.posted_by);
        if (isCurrent) {
          setEmployerProfile({
            id: canonical.id,
            name: canonical.name,
            avatarUrl: canonical.avatarUrl,
            verified: canonical.verified,
            loading: false,
            avatarError: false,
          });
        }
      } catch (err) {
        console.error('[JobDetail] Profile fetch error:', err);
        if (isCurrent) {
          setEmployerProfile({
            id: job.posted_by,
            name: 'OpenComm User',
            avatarUrl: null,
            verified: false,
            loading: false,
            avatarError: false,
          });
        }
      }
    };

    loadEmployerProfile();

    return () => {
      isCurrent = false;
    };
  }, [job?.posted_by]);

  // Fetch real employer metrics
  useEffect(() => {
    async function fetchEmployerMetrics() {
      if (!job?.posted_by || !supabase) {
        setEmployerMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        setEmployerMetrics(prev => ({ ...prev, loading: true }));

        const [reviewsRes, jobsRes, profileRes] = await Promise.all([
          supabase
            .from('reviews')
            .select('rating')
            .eq('reviewee_id', job.posted_by),
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('posted_by', job.posted_by)
            .eq('is_active', true),
          supabase
            .from('profiles')
            .select('created_at')
            .eq('id', job.posted_by)
            .maybeSingle(),
        ]);

        let avgRating: number | null = null;
        let reviewCount = 0;
        if (!reviewsRes.error && reviewsRes.data && reviewsRes.data.length > 0) {
          reviewCount = reviewsRes.data.length;
          const sum = reviewsRes.data.reduce((acc, r) => acc + (r.rating || 0), 0);
          avgRating = parseFloat((sum / reviewCount).toFixed(1));
        }

        let jobsCount: number | null = null;
        if (!jobsRes.error && jobsRes.count !== null) {
          jobsCount = jobsRes.count;
        }

        let memberSinceYear: number | null = null;
        if (!profileRes.error && profileRes.data?.created_at) {
          memberSinceYear = new Date(profileRes.data.created_at).getFullYear();
        }

        setEmployerMetrics({
          avgRating,
          reviewCount,
          jobsCount,
          memberSinceYear,
          loading: false,
        });
      } catch (err) {
        console.error('[Employer Metrics] Exception fetching real metrics:', err);
        setEmployerMetrics(prev => ({ ...prev, loading: false }));
      }
    }

    fetchEmployerMetrics();
  }, [job?.posted_by]);

  // Auto-close owner menu on window scroll or resize
  useEffect(() => {
    if (!showOwnerMenu) return;
    const handleScrollOrResize = () => setShowOwnerMenu(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showOwnerMenu]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!job) return;
    const shareUrl = `${window.location.origin}/jobs/${job.id}`;
    const shareText = `Check out this job on OpenComm: ${job.title} at ${employerProfile.name || job.company}!`;

    analytics.trackEvent('share', { item_type: 'job', item_id: job.id, item_title: job.title });

    if (navigator.share) {
      try {
        await navigator.share({
          title: job.title,
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

  const handleApplyClick = () => {
    if (!isLoggedIn) {
      triggerToast('Please sign in to apply for this job.');
      onOpenAuth('locked');
      return;
    }

    if (isOwner) {
      triggerToast('You cannot apply to your own job post.');
      return;
    }

    setShowApplyForm(true);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !bidRate.trim() || !coverLetter.trim()) return;

    setIsSubmitting(true);
    try {
      if (supabase && loggedInId) {
        const { data: newApp, error: appError } = await supabase
          .from('job_applications')
          .insert({
            job_id: job.id,
            applicant_id: loggedInId,
            proposed_rate: bidRate.trim(),
            cover_letter: coverLetter.trim(),
            status: 'pending',
          })
          .select()
          .single();

        if (appError) {
          if (appError.code === '23505') {
            triggerToast('You have already applied for this job opportunity.');
            setDbApplied(true);
          } else {
            console.error('Application submission error:', appError);
            triggerToast(`Failed to submit application: ${appError.message}`);
          }
          setIsSubmitting(false);
          setShowApplyForm(false);
          return;
        }

        if (newApp) {
          setDbApplied(true);
          setApplicationStatus('pending');
          setExistingApp(newApp);
        }
      }

      handleApplyJob(job.id, bidRate, coverLetter);
      triggerToast('Application submitted successfully!');
      setShowApplyForm(false);
    } catch (err: any) {
      console.error('Application submission exception:', err);
      triggerToast(err.message || 'An unexpected error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenApplicationConversation = async () => {
    if (!existingApp?.id) {
      triggerToast('Application record not found.');
      return;
    }

    if (applicationStatus !== 'accepted') {
      triggerToast('Messaging becomes available once your application is accepted by the employer.');
      return;
    }

    try {
      const conversationId = await dbService.getOrCreateApplicationConversation(existingApp.id);
      if (conversationId) {
        navigate(`/messages?conversation=${conversationId}`);
      } else {
        triggerToast('Could not open conversation. Please try again.');
      }
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      triggerToast(err.message || 'Messaging is only available after application acceptance.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!job) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== job.posted_by) {
        throw new Error("Unable to delete this post. You may not have permission.");
      }

      if (onDeleteJob) {
        await onDeleteJob(job);
      } else {
        await dbService.deleteJobInDb(job.id);
      }

      triggerToast("Job post deleted successfully");
      setShowDeleteConfirm(false);
      navigate('/profile/my-job-posts', { replace: true });
    } catch (err: any) {
      console.error('[Job Delete Error]', err);
      setDeleteError(err.message || "Failed to delete job post.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEmployerProfileClick = () => {
    if (job?.posted_by) {
      navigate(`/profile/${job.posted_by}`);
    }
  };

  const getInitials = (name: string) => {
    if (!name || name === 'OpenComm User') return 'OU';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#6C4DFF] animate-spin" />
        <p className="text-xs font-semibold text-[#6B7280]">Loading opportunity details...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4 text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
          <X className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-[#111827] dark:text-white">Job Not Found</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{error || 'This job listing may have been closed or removed by the employer.'}</p>
        <button
          onClick={() => navigate('/jobs')}
          className="px-5 py-2.5 rounded-xl bg-[#6C4DFF] text-white font-extrabold text-xs shadow-md hover:bg-[#5b3edf] transition-all cursor-pointer flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs Listing</span>
        </button>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo(job.applicationDeadline);

  return (
    <div className="w-full bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_50%,#F9FBFF_100%)] dark:bg-[linear-gradient(180deg,#080C14_0%,#0F1424_50%,#080C14_100%)] min-h-screen text-left pb-[calc(90px+env(safe-area-inset-bottom))]" id="job-detail-container">
      
      {/* 1. CLEAN TOP NAVIGATION - SIMPLE BACK BUTTON ONLY */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#080C14]/90 backdrop-blur-md border-b border-[#ECEEF5] dark:border-slate-800/80 px-2 sm:px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/jobs')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            title="Back to Jobs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Jobs</span>
          </button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-2 sm:px-4 pt-3 sm:pt-5 space-y-3.5 sm:space-y-4">
        
        {/* 2. HERO CARD - CLEAN & ELEGANT DESIGN WITH UNCLIPPED OWNER THREE-DOT MENU */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F6F2FF_55%,#F1F6FF_100%)] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 sm:p-6 space-y-3.5 shadow-xs relative"
        >
          {/* Top Row: Employer Profile & Actions */}
          <div className="flex justify-between items-start">
            
            {/* Clickable Employer Avatar & Name (STABLE CANONICAL SOURCE) */}
            <button
              onClick={handleEmployerProfileClick}
              className="flex items-center space-x-3 text-left group cursor-pointer"
            >
              <div className="relative shrink-0">
                {employerProfile.loading ? (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                ) : employerProfile.avatarUrl && !employerProfile.avatarError ? (
                  <img 
                    src={employerProfile.avatarUrl} 
                    alt={employerProfile.name} 
                    onError={() => setEmployerProfile(prev => ({ ...prev, avatarError: true }))}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-[#ECEEF5] dark:border-slate-800 bg-slate-50 shadow-xs group-hover:brightness-95 transition-all" 
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#6C4DFF] to-[#4F46E5] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                    {getInitials(employerProfile.name)}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0F172A] rounded-full" title="Online" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  {employerProfile.loading ? (
                    <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  ) : (
                    <h3 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white tracking-tight group-hover:text-[#6C4DFF] group-hover:underline transition-colors">
                      {employerProfile.name}
                    </h3>
                  )}
                  {job.verified && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[11px] font-bold shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Action Buttons: Share, Save & Owner Three-Dot Menu */}
            <div className="flex items-center space-x-2 relative">
              <button
                onClick={handleShare}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#ECEEF5] dark:border-slate-800 bg-white/90 dark:bg-[#111827] hover:bg-slate-100 text-[#6B7280] dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-xs relative"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
                {copied && (
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow whitespace-nowrap animate-bounce z-10">
                    Copied!
                  </div>
                )}
              </button>

              <button
                onClick={(e) => toggleBookmark(job.id, e)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  job.bookmarked 
                    ? 'border-[#6C4DFF]/40 bg-[#6C4DFF]/10 text-[#6C4DFF]' 
                    : 'border-[#ECEEF5] dark:border-slate-800 bg-white/90 dark:bg-[#111827] text-[#6B7280] dark:text-slate-300 hover:text-[#6C4DFF]'
                }`}
                title="Bookmark"
              >
                <Bookmark className={`w-4 h-4 ${job.bookmarked ? 'fill-current' : ''}`} />
              </button>

              {/* Compact Owner Three-Dot Menu (Portal Rendered to Prevent Clipping) */}
              {isOwner && (
                <div>
                  <button
                    ref={menuButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!showOwnerMenu && menuButtonRef.current) {
                        const rect = menuButtonRef.current.getBoundingClientRect();
                        const menuWidth = Math.min(280, window.innerWidth - 24);
                        let left = rect.right - menuWidth;
                        if (left < 12) left = 12;
                        setMenuPos({
                          top: rect.bottom + 6,
                          left,
                          width: menuWidth,
                        });
                      }
                      setShowOwnerMenu(!showOwnerMenu);
                    }}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#ECEEF5] dark:border-slate-800 bg-white/90 dark:bg-[#111827] hover:bg-purple-50 text-[#6B7280] dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                    title="Owner Actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Job Title */}
          <h1 className="text-lg sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight leading-snug break-words">
            {job.title}
          </h1>

          {/* Category & Job Type Chips */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20 shadow-2xs">
              {job.category}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#ECEEF5] dark:border-slate-700/50 shadow-2xs">
              {formatJobType(job.jobType)}
            </span>
          </div>
        </motion.div>

        {/* 3. 4-CARD INFORMATION GRID - SOFT TINTS & FULL READABILITY */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Location */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-blue-900/60 dark:text-blue-400/80 tracking-wider mb-0.5">Location</span>
              <span className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.location}
              </span>
            </div>
          </div>

          {/* Salary / Budget */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-emerald-900/60 dark:text-emerald-400/80 tracking-wider mb-0.5">Salary / Budget</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 leading-snug whitespace-normal break-words overflow-visible block">
                {job.salary}
              </span>
            </div>
          </div>

          {/* Posted Date */}
          <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100/80 dark:border-purple-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-purple-900/60 dark:text-purple-400/80 tracking-wider mb-0.5">Posted Date</span>
              <span className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.datePosted}
              </span>
            </div>
          </div>

          {/* Application Deadline */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-amber-900/60 dark:text-amber-400/80 tracking-wider mb-0.5">Deadline</span>
              <span className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {deadlineInfo.label}
              </span>
            </div>
          </div>
        </div>

        {/* 4. APPLICANT STATUS CARD (For non-owners who applied) */}
        {!isOwner && dbApplied && (
          <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 sm:p-5 text-left space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-[#111827] dark:text-white">Your Application Status</h4>
              </div>
              <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                applicationStatus === 'accepted'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : applicationStatus === 'rejected'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
              }`}>
                {applicationStatus || 'pending'}
              </span>
            </div>

            {applicationStatus === 'accepted' ? (
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-3.5 space-y-2">
                <p className="text-xs text-emerald-900 dark:text-emerald-300 font-medium leading-relaxed">
                  Congratulations! Your application has been accepted by the employer. Messaging is now unlocked.
                </p>
                <button
                  onClick={handleOpenApplicationConversation}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Open Application Chat</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Your proposal has been received and is under review. Direct messaging will unlock once accepted.
              </p>
            )}
          </div>
        )}

        {/* 5. ABOUT THE OPPORTUNITY SECTION */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 sm:p-6 space-y-3.5 shadow-xs">
          <h2 className="text-sm sm:text-base font-bold text-[#111827] dark:text-white tracking-tight">
            About the Opportunity
          </h2>
          <div className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
            {job.description}
          </div>

          {job.requirements && job.requirements.length > 0 && (
            <div className="pt-3 border-t border-[#ECEEF5] dark:border-slate-800 space-y-2.5">
              <h3 className="text-xs font-bold text-[#111827] dark:text-white tracking-tight">
                Requirements
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {job.requirements.map((req, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#F7F8FE] dark:bg-slate-800/60 border border-[#ECEEF5] dark:border-slate-700/50 text-[#475569] dark:text-slate-300 text-xs font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#6C4DFF] shrink-0" />
                    <span>{req}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 6. COMPACT EMPLOYER CARD (STABLE CANONICAL DATA) */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[22px] p-4 sm:p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white tracking-tight">
              About the Employer
            </h3>
            <button
              onClick={handleEmployerProfileClick}
              className="text-xs font-bold text-[#6C4DFF] hover:underline cursor-pointer"
            >
              View Profile
            </button>
          </div>

          {employerMetrics.loading ? (
            <div className="flex items-center space-x-2 text-xs text-slate-400 py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Loading stats...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {employerMetrics.avgRating !== null ? (
                <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                  <span className="block text-[10px] uppercase font-bold text-amber-900/60 dark:text-amber-400/80 tracking-wider">Rating</span>
                  <span className="text-xs font-bold text-[#111827] dark:text-white">
                    ⭐ {employerMetrics.avgRating} ({employerMetrics.reviewCount})
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Rating</span>
                  <span className="text-xs font-medium text-slate-500">No reviews yet</span>
                </div>
              )}

              {employerMetrics.jobsCount !== null && (
                <div className="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <span className="block text-[10px] uppercase font-bold text-blue-900/60 dark:text-blue-400/80 tracking-wider">Active Jobs</span>
                  <span className="text-xs font-bold text-[#111827] dark:text-white">
                    {employerMetrics.jobsCount} Posted
                  </span>
                </div>
              )}

              {employerMetrics.memberSinceYear !== null && (
                <div className="p-2.5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                  <span className="block text-[10px] uppercase font-bold text-purple-900/60 dark:text-purple-400/80 tracking-wider">Member</span>
                  <span className="text-xs font-bold text-[#111827] dark:text-white">
                    Since {employerMetrics.memberSinceYear}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 7. PRIVACY NOTE */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/30 rounded-[20px] p-3.5 sm:p-4 flex items-center space-x-3 text-xs font-medium text-indigo-900/80 dark:text-indigo-300">
          <Shield className="w-5 h-5 text-[#6C4DFF] shrink-0" />
          <span>Your contact information remains private until you choose to share it.</span>
        </div>

      </main>

      {/* 8. STICKY BOTTOM ACTION BAR (APPLICANTS ONLY) */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/95 dark:bg-[#080C14]/95 backdrop-blur-xl border-t border-[#ECEEF5] dark:border-slate-800/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3">
            {!dbApplied ? (
              <button
                onClick={handleApplyClick}
                disabled={deadlineInfo.isExpired || isSubmitting}
                className={`w-full h-[52px] rounded-2xl text-white font-bold text-[15px] sm:text-base transition-all flex items-center justify-center space-x-2 shadow-md ${
                  deadlineInfo.isExpired
                    ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#6C4DFF] to-[#4F46E5] hover:opacity-95 shadow-[#6C4DFF]/20 cursor-pointer'
                }`}
              >
                {deadlineInfo.isExpired ? (
                  <span>Applications Closed</span>
                ) : isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Apply</span>
                )}
              </button>
            ) : (
              <div className="w-full flex flex-col sm:flex-row items-center gap-2">
                <div className="w-full h-[52px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 border border-slate-200 dark:border-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>
                    {applicationStatus === 'accepted' 
                      ? 'Application Accepted' 
                      : applicationStatus === 'rejected' 
                      ? 'Application Rejected' 
                      : 'Applied · Pending Review'}
                  </span>
                </div>
                {applicationStatus === 'accepted' && (
                  <button
                    onClick={handleOpenApplicationConversation}
                    className="w-full sm:w-auto h-[52px] px-6 rounded-2xl bg-[#6C4DFF] hover:bg-[#5b3edf] text-white font-semibold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0 shadow-md"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Message Employer</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROPOSAL APPLICATION DRAWER / MODAL */}
      <AnimatePresence>
        {showApplyForm && !isOwner && !deadlineInfo.isExpired && !existingApp && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setShowApplyForm(false)}
            />
            <motion.form
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onSubmit={handleApplySubmit}
              className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 border border-[#ECEEF5] dark:border-slate-800 z-10 text-left"
            >
              <div className="flex items-center justify-between border-b border-[#ECEEF5] dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Send className="w-5 h-5 text-[#6C4DFF]" />
                  <h3 className="text-base font-bold text-[#111827] dark:text-white">Submit Proposal</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#111827] dark:text-slate-200">
                    Proposed Rate / Budget
                  </label>
                  <input 
                    type="text" 
                    required
                    value={bidRate}
                    onChange={(e) => setBidRate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-[#ECEEF5] dark:border-slate-800 bg-[#F7F8FE] dark:bg-[#111827] text-[#111827] dark:text-white text-sm font-semibold focus:outline-none focus:border-[#6C4DFF]"
                    placeholder="e.g. ₹45,000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#111827] dark:text-slate-200">
                    Proposal / Cover Note
                  </label>
                  <textarea 
                    rows={4}
                    required
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-[#ECEEF5] dark:border-slate-800 bg-[#F7F8FE] dark:bg-[#111827] text-[#111827] dark:text-white text-sm font-medium focus:outline-none focus:border-[#6C4DFF]"
                    placeholder="Briefly explain your experience..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="flex-1 h-11 rounded-xl border border-[#ECEEF5] dark:border-slate-800 text-xs font-bold text-[#6B7280] dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#6C4DFF] to-[#4F46E5] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Applying...' : 'Submit Application'}</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* THREE-DOT OWNER MENU (PORTAL MOUNTED TO DOCUMENT.BODY TO PREVENT CLIPPING) */}
      {isOwner && showOwnerMenu && createPortal(
        <AnimatePresence>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowOwnerMenu(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: `${menuPos.top}px`,
                left: `${menuPos.left}px`,
                width: `${menuPos.width}px`,
              }}
              className="z-[9999] bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[18px] shadow-2xl py-1.5 overflow-hidden text-left"
            >
              {/* Manage Applications */}
              <button
                type="button"
                onClick={() => {
                  setShowOwnerMenu(false);
                  navigateWithOrigin(
                    navigate,
                    `/jobs/${job.id}/applications`,
                    location,
                    SESSION_STORAGE_KEYS.manageApplications(job.id)
                  );
                }}
                className="w-full px-4 py-3 min-h-[52px] flex items-center space-x-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Briefcase className="w-4.5 h-4.5 text-[#6C4DFF] shrink-0" />
                <span>Manage Applications</span>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />

              {/* Edit Post / Edit period expired */}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowOwnerMenu(false);
                    if (onEditJob) onEditJob(job);
                  }}
                  className="w-full px-4 py-3 min-h-[52px] flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <Edit3 className="w-4.5 h-4.5 text-amber-600 shrink-0" />
                    <span>Edit Post</span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                    5h window
                  </span>
                </button>
              ) : (
                <div className="w-full px-4 py-3 min-h-[52px] flex items-center space-x-3 text-xs font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-75">
                  <Edit3 className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Edit period expired</span>
                    <span className="text-[10px] text-slate-400">5-hour edit window ended</span>
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />

              {/* Delete Post */}
              <button
                type="button"
                onClick={() => {
                  setShowOwnerMenu(false);
                  setDeleteError(null);
                  setShowDeleteConfirm(true);
                }}
                className="w-full px-4 py-3 min-h-[52px] flex items-center space-x-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                <span>Delete Post</span>
              </button>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* DELETE CONFIRMATION MODAL (PORTAL Z-[10000]) */}
      {showDeleteConfirm && job && createPortal(
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => {
            if (!isDeleting) {
              setShowDeleteConfirm(false);
              setDeleteError(null);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl text-left space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#111827] dark:text-white">Delete this job post?</h3>
                <p className="text-xs text-slate-500 font-medium">Confirm post deletion</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                <strong className="text-slate-900 dark:text-white font-bold">"{job.title}"</strong> will be removed from the public marketplace. Existing applications and messages will remain available.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center space-x-1.5 shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Post</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
