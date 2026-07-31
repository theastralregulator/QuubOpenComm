import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, IndianRupee, Calendar, Briefcase, 
  CheckCircle2, Bookmark, Share2, Send, Clock, RefreshCw,
  MessageSquare, Shield, X
} from 'lucide-react';
import { Job } from '../../types';
import { supabase, dbService } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';
import { getDeadlineInfo } from '../../lib/deadline';

interface JobDetailPageProps {
  jobs: Job[];
  toggleBookmark: (id: string, e: React.MouseEvent) => void;
  handleApplyJob: (id: string, bid: string, note: string) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn: boolean;
  onOpenAuth: (tab: 'signin' | 'signup' | 'locked') => void;
}

export default function JobDetailPage({
  jobs,
  toggleBookmark,
  handleApplyJob,
  triggerToast,
  isLoggedIn,
  onOpenAuth,
}: JobDetailPageProps) {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

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
  const isOwner = job?.posted_by && loggedInId === job.posted_by;
  const [dbApplied, setDbApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [existingApp, setExistingApp] = useState<any>(null);

  // Real Employer Metrics State (No hardcoded/fake defaults)
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
              company: data.companies?.name || data.company_name || 'Verified Employer',
              companyLogo: data.companies?.logo_url || data.company_logo || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80',
              salary: data.salary_range || 'Contract',
              location: data.location || 'Remote',
              category: data.category || 'Professional',
              description: data.description || '',
              requirements: Array.isArray(data.requirements) ? data.requirements : [],
              verified: data.verified !== undefined ? data.verified : true,
              bookmarked: false,
              applied: dbApplied,
              datePosted: new Date(data.created_at).toLocaleDateString(),
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

  // Fetch real employer metrics when job.posted_by is available
  useEffect(() => {
    async function fetchEmployerMetrics() {
      if (!job?.posted_by || !supabase) {
        setEmployerMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const [reviewsRes, jobsRes, profileRes] = await Promise.all([
          supabase
            .from('reviews')
            .select('rating')
            .eq('reviewee_id', job.posted_by),
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('posted_by', job.posted_by),
          supabase
            .from('profile_directory')
            .select('created_at')
            .eq('id', job.posted_by)
            .maybeSingle()
        ]);

        let avgRating: number | null = null;
        let count = 0;
        if (reviewsRes.data && reviewsRes.data.length > 0) {
          count = reviewsRes.data.length;
          const sum = reviewsRes.data.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
          avgRating = Number((sum / count).toFixed(1));
        }

        const jobsCount = jobsRes.count !== null ? jobsRes.count : null;
        let year: number | null = null;
        if (profileRes.data?.created_at) {
          year = new Date(profileRes.data.created_at).getFullYear();
        }

        setEmployerMetrics({
          avgRating,
          reviewCount: count,
          jobsCount,
          memberSinceYear: year,
          loading: false,
        });
      } catch (err) {
        console.error('Error fetching employer metrics:', err);
        setEmployerMetrics(prev => ({ ...prev, loading: false }));
      }
    }

    fetchEmployerMetrics();
  }, [job?.posted_by]);

  useEffect(() => {
    if (job) {
      analytics.trackEvent('view_job_detail', { job_id: job.id, job_title: job.title });
    }
  }, [job]);

  const handleShare = async () => {
    if (!job) return;
    const shareUrl = window.location.href;
    const shareText = `Check out this opportunity: ${job.title} at ${job.company}!`;

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
        triggerToast('Link copied to clipboard!');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  const handleOpenApplicationConversation = async () => {
    if (!existingApp?.id) return;
    if (applicationStatus !== 'accepted') {
      triggerToast("Messaging is only available after your application is accepted.");
      return;
    }

    try {
      triggerToast("Opening application conversation...");
      const convId = await dbService.getOrCreateApplicationConversation(existingApp.id);
      if (convId) {
        navigate(`/messages/${convId}`);
      } else {
        triggerToast("Unable to open conversation.");
      }
    } catch (err: any) {
      console.error('Error opening conversation:', err);
      triggerToast(err.message || 'Unable to open conversation.');
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setIsSubmitting(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setIsSubmitting(false);
        onOpenAuth('locked');
        return;
      }

      const applicantId = user.id;

      const { data: existing } = await supabase
        .from('job_applications')
        .select('id, status, proposed_rate, created_at')
        .eq('job_id', job.id)
        .eq('applicant_id', applicantId)
        .maybeSingle();

      if (existing) {
        setDbApplied(true);
        setApplicationStatus(existing.status);
        setExistingApp(existing);
        triggerToast('You have already applied for this job.');
        setShowApplyForm(false);
        return;
      }

      const payload = {
        job_id: job.id,
        applicant_id: applicantId,
        proposed_rate: bidRate,
        cover_letter: coverLetter,
        status: 'pending'
      };

      const response = await supabase
        .from('job_applications')
        .insert(payload)
        .select('id, status, proposed_rate, created_at')
        .single();

      if (response.error) throw response.error;

      setDbApplied(true);
      setApplicationStatus(response.data?.status || 'pending');
      setExistingApp(response.data);
      setJob(prev => prev ? { ...prev, applied: true } : null);
      
      window.dispatchEvent(new CustomEvent('opencomm:job-application-changed'));
      triggerToast('Application submitted successfully!');
      setShowApplyForm(false);
    } catch (err: any) {
      if (err.code === '23505') {
        triggerToast('You have already applied for this job.');
      } else {
        triggerToast('Unable to submit proposal. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_45%,#F9FBFF_100%)] dark:bg-[linear-gradient(180deg,#080C14_0%,#0F1424_45%,#080C14_100%)] py-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#6C4DFF]/10 text-[#6C4DFF] flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-bold text-[#6B7280]">Loading opportunity details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_45%,#F9FBFF_100%)] dark:bg-[linear-gradient(180deg,#080C14_0%,#0F1424_45%,#080C14_100%)] py-16 px-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800 rounded-[24px] p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center">
            <Briefcase className="w-7 h-7 text-rose-500" />
          </div>
          <h2 className="text-xl font-black text-[#111827] dark:text-white">Opportunity Closed</h2>
          <p className="text-xs text-[#6B7280]">{error || 'This job is no longer available.'}</p>
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#6C4DFF] hover:bg-[#5b3edf] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Explore Opportunities</span>
          </button>
        </div>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo(job.applicationDeadline);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FAFBFF_0%,#F7F5FF_45%,#F9FBFF_100%)] dark:bg-[linear-gradient(180deg,#080C14_0%,#0F1424_45%,#080C14_100%)] text-[#111827] dark:text-white pb-32">
      
      {/* MAIN CONTAINER - Optimized Mobile Padding (5px to 7px) */}
      <main className="w-full max-w-4xl mx-auto px-[6px] sm:px-4 pt-2.5 sm:pt-4 space-y-2.5 text-left">

        {/* COMPACT PAGE BACK BUTTON */}
        <div className="flex items-center justify-between pb-0.5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* 1. HERO CARD WITH SUBTLE LIGHT GRADIENT & GREEN CIRCULAR VERIFIED BADGE */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }} 
          className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F6F2FF_55%,#F1F6FF_100%)] dark:bg-[linear-gradient(135deg,#0F172A_0%,#171E36_55%,#0F172A_100%)] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-3.5 sm:p-5 shadow-[0_4px_20px_rgba(108,77,255,0.04)] space-y-3.5"
        >
          {/* Top Employer Row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => job.posted_by && navigate(`/profile/${job.posted_by}`)}
              aria-label={`View ${job.company}'s profile`}
              className="flex items-center space-x-3 text-left group cursor-pointer"
            >
              <div className="relative shrink-0">
                <img 
                  src={job.companyLogo} 
                  alt={job.company} 
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-[#ECEEF5] dark:border-slate-800 bg-slate-50 shadow-xs group-hover:brightness-95 transition-all" 
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0F172A] rounded-full" title="Online" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white tracking-tight group-hover:text-[#6C4DFF] group-hover:underline transition-colors">
                    {job.company}
                  </h3>
                  {job.verified && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[11px] font-bold shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Action Buttons: Share & Save */}
            <div className="flex items-center space-x-2">
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
            </div>
          </div>

          {/* Job Title */}
          <h1 className="text-lg sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight leading-snug break-words">
            {job.title}
          </h1>

          {/* Subtle Category & Type Chips (No Duplicate Verified Tag) */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-[#6C4DFF]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20 shadow-2xs">
              {job.category}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#ECEEF5] dark:border-slate-700/50 shadow-2xs">
              Full Time
            </span>
          </div>
        </motion.div>

        {/* 2. 4-CARD INFORMATION GRID - SOFT COLOR GRADING & FULL READABILITY */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Location - Soft Blue Tint */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-blue-900/60 dark:text-blue-400/80 tracking-wider mb-0.5">Location</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.location}
              </span>
            </div>
          </div>

          {/* Salary / Budget - Soft Mint Tint */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-emerald-900/60 dark:text-emerald-400/80 tracking-wider mb-0.5">Salary / Budget</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400 leading-snug whitespace-normal break-words overflow-visible block">
                {job.salary}
              </span>
            </div>
          </div>

          {/* Posted Date - Soft Purple Tint */}
          <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100/80 dark:border-purple-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-purple-900/60 dark:text-purple-400/80 tracking-wider mb-0.5">Posted Date</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.datePosted}
              </span>
            </div>
          </div>

          {/* Application Deadline - Soft Amber Tint */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100/80 dark:border-amber-900/30 rounded-[20px] p-3.5 sm:p-4 space-y-1.5 flex flex-col justify-between shadow-2xs min-h-[85px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-amber-900/60 dark:text-amber-400/80 tracking-wider mb-0.5">Deadline</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Flexible'}
              </span>
            </div>
          </div>
        </div>

        {/* APPLICATION STATUS CARD (POST-APPLICATION UX & MESSAGING GATEWAY) */}
        {dbApplied && (
          <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-3.5 sm:p-5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider">Application Status</span>
                <div className="flex items-center space-x-2 pt-0.5">
                  {applicationStatus === 'accepted' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                      Application Accepted
                    </span>
                  ) : applicationStatus === 'rejected' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
                      Application Rejected
                    </span>
                  ) : applicationStatus === 'shortlisted' ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 text-xs font-black uppercase tracking-wider">
                      Shortlisted
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                      Pending Review
                    </span>
                  )}
                </div>
              </div>

              {applicationStatus === 'accepted' && (
                <button
                  onClick={handleOpenApplicationConversation}
                  className="px-4 py-2 bg-[#6C4DFF] hover:bg-[#5b3edf] text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message Employer</span>
                </button>
              )}
            </div>

            <p className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 leading-relaxed pt-1 border-t border-[#ECEEF5] dark:border-slate-800/60">
              {applicationStatus === 'accepted' ? (
                "Your application has been accepted! You can now message the employer directly."
              ) : applicationStatus === 'rejected' ? (
                "Your application was not selected for this opportunity."
              ) : (
                "You can message the employer after your application is accepted."
              )}
            </p>
          </div>
        )}

        {/* 3. ABOUT THE OPPORTUNITY */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-3.5 sm:p-5 shadow-2xs space-y-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#6C4DFF]/10 text-[#6C4DFF] shrink-0">
              <Briefcase className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-[#111827] dark:text-white">About the Opportunity</h3>
          </div>
          <div className="text-sm sm:text-[15px] text-[#111827] dark:text-slate-200 leading-[1.65] font-normal whitespace-pre-wrap pt-0.5 space-y-3">
            {job.description}
          </div>
        </div>

        {/* 4. REQUIREMENTS SECTION POLISH - CIRCULAR CHECK ICON & NO EMOJIS */}
        <div className="bg-[#F7F5FF] dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800/60 rounded-[22px] p-3.5 sm:p-5 shadow-2xs space-y-3">
          <h3 className="text-sm sm:text-base font-black text-[#111827] dark:text-white flex items-center space-x-2">
            <span>Requirements</span>
          </h3>
          {job.requirements && job.requirements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {job.requirements.map((req, i) => (
                <div
                  key={i}
                  className="flex items-start space-x-2.5 p-3 rounded-xl bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/60 shadow-2xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#6C4DFF] shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-[#111827] dark:text-slate-200 leading-snug whitespace-normal break-words">{req}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] italic">No specific requirements mentioned.</p>
          )}
        </div>

        {/* 5. EMPLOYER TRUST CARD - GREEN CIRCULAR VERIFIED BADGE & REAL METRICS */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-3.5 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={() => job.posted_by && navigate(`/profile/${job.posted_by}`)}
              aria-label={`View ${job.company}'s profile`}
              className="flex items-center space-x-3 text-left group cursor-pointer"
            >
              <img 
                src={job.companyLogo} 
                alt={job.company} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-[#ECEEF5] dark:border-slate-800 bg-slate-50 group-hover:brightness-95 transition-all" 
              />
              <div>
                <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white group-hover:text-[#6C4DFF] group-hover:underline transition-colors">
                    {job.company}
                  </h4>
                  {job.verified && (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/60 text-[#059669] dark:text-emerald-400 text-[11px] font-bold shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] dark:text-emerald-400 shrink-0" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
            
            <button
              onClick={() => job.posted_by && navigate(`/profile/${job.posted_by}`)}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-[#6C4DFF] text-[#6C4DFF] font-bold text-xs hover:bg-[#6C4DFF]/10 transition-colors cursor-pointer"
            >
              View Profile
            </button>
          </div>

          {/* Real Database Metrics Only */}
          {!employerMetrics.loading && (
            <div className="flex items-center justify-around gap-2 pt-2 text-center border-t border-[#ECEEF5] dark:border-slate-800/60">
              {employerMetrics.avgRating !== null ? (
                <div className="p-1">
                  <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Rating</span>
                  <span className="text-xs font-extrabold text-[#111827] dark:text-white">
                    {employerMetrics.avgRating} ({employerMetrics.reviewCount} reviews)
                  </span>
                </div>
              ) : (
                <div className="p-1">
                  <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Rating</span>
                  <span className="text-xs font-bold text-[#6B7280]">No reviews yet</span>
                </div>
              )}

              {employerMetrics.jobsCount !== null && (
                <div className="p-1">
                  <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Jobs</span>
                  <span className="text-xs font-extrabold text-[#111827] dark:text-white">
                    {employerMetrics.jobsCount} Posted
                  </span>
                </div>
              )}

              {employerMetrics.memberSinceYear !== null && (
                <div className="p-1">
                  <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Member</span>
                  <span className="text-xs font-extrabold text-[#111827] dark:text-white">
                    Since {employerMetrics.memberSinceYear}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 6. SAFETY NOTE - SOFT BLUE-PURPLE TINT */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100/80 dark:border-indigo-900/30 rounded-[20px] p-3.5 sm:p-4 flex items-center space-x-3 text-xs font-medium text-indigo-900/80 dark:text-indigo-300">
          <Shield className="w-5 h-5 text-[#6C4DFF] shrink-0" />
          <span>Your contact information remains private until you choose to share it.</span>
        </div>

      </main>

      {/* 7. STICKY BOTTOM CTA - 52PX HEIGHT, PURPLE-TO-BLUE GRADIENT, NO DECORATIVE ICONS */}
      <div className="fixed bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/95 dark:bg-[#080C14]/95 backdrop-blur-xl border-t border-[#ECEEF5] dark:border-slate-800/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3">
          {!dbApplied ? (
            <button
              onClick={() => {
                if (deadlineInfo.isExpired) return;
                setShowApplyForm(true);
              }}
              disabled={deadlineInfo.isExpired || isSubmitting}
              className={`w-full h-[52px] rounded-2xl text-white font-semibold text-[15px] sm:text-base transition-all flex items-center justify-center space-x-2 shadow-md ${
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
                  <h3 className="text-base font-black text-[#111827] dark:text-white">Submit Proposal</h3>
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
                  <label className="block text-xs font-extrabold text-[#111827] dark:text-slate-200">
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
                  <label className="block text-xs font-extrabold text-[#111827] dark:text-slate-200">
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
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#6C4DFF] to-[#4F46E5] text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
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

    </div>
  );
}
