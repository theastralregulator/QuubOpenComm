import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, IndianRupee, Calendar, Briefcase, 
  ShieldCheck, CheckCircle2, Bookmark, Share2, Sparkles, Send, Clock, RefreshCw,
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

  const handleDirectMessage = async () => {
    if (!job) return;

    if (!isLoggedIn || !loggedInId) {
      onOpenAuth('locked');
      return;
    }

    if (job.posted_by === loggedInId) {
      triggerToast("You cannot message yourself.");
      return;
    }

    if (!job.posted_by) {
      triggerToast("Employer details unavailable for direct messaging.");
      return;
    }

    try {
      const convId = await dbService.getOrCreateWorkerConversation(job.posted_by);
      if (convId) {
        navigate(`/messages/${convId}`);
      } else {
        triggerToast("Unable to start direct message conversation.");
      }
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      triggerToast(err.message || 'Failed to open message conversation.');
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
      <div className="min-h-screen bg-[#FAFBFF] dark:bg-[#080C14] py-12 px-4 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#6C4DFF]/10 text-[#6C4DFF] flex items-center justify-center animate-pulse">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-bold text-[#6B7280]">Loading opportunity details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] dark:bg-[#080C14] py-16 px-4 flex items-center justify-center">
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
    <div className="min-h-screen bg-[#FAFBFF] dark:bg-[#080C14] text-[#111827] dark:text-white pb-32">
      
      {/* MAIN CONTENT CONTAINER */}
      <main className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-3 sm:pt-5 space-y-3.5 text-left">

        {/* COMPACT PAGE BACK BUTTON */}
        <div className="flex items-center justify-between pb-1">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* 1. HERO CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.25 }} 
          className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(108,77,255,0.04)] relative overflow-hidden space-y-4"
        >
          {/* Top Employer Row */}
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center space-x-3">
              <div className="relative shrink-0">
                <img 
                  src={job.companyLogo} 
                  alt={job.company} 
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-[#ECEEF5] dark:border-slate-800 bg-slate-50 shadow-xs" 
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#0F172A] rounded-full" title="Online" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white tracking-tight">{job.company}</h3>
                  {job.verified && <ShieldCheck className="w-4 h-4 text-[#6C4DFF] shrink-0" />}
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Verified Employer</span>
              </div>
            </div>

            {/* Three Circular Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDirectMessage}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#ECEEF5] dark:border-slate-800 bg-[#F7F8FE] dark:bg-[#111827] hover:bg-[#6C4DFF]/10 text-[#6C4DFF] flex items-center justify-center transition-all cursor-pointer shadow-xs"
                title="Message Employer"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={handleShare}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-[#ECEEF5] dark:border-slate-800 bg-[#F7F8FE] dark:bg-[#111827] hover:bg-slate-100 text-[#6B7280] dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-xs relative"
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
                    : 'border-[#ECEEF5] dark:border-slate-800 bg-[#F7F8FE] dark:bg-[#111827] text-[#6B7280] dark:text-slate-300 hover:text-[#6C4DFF]'
                }`}
                title="Bookmark"
              >
                <Bookmark className={`w-4 h-4 ${job.bookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* Job Title - Max 3-4 lines, no truncation */}
          <h1 className="text-lg sm:text-2xl font-black text-[#111827] dark:text-white tracking-tight leading-snug break-words">
            {job.title}
          </h1>

          {/* Subtle Gradient Chips */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-[#6C4DFF]/10 to-[#9D4EDD]/10 text-[#6C4DFF] dark:text-purple-300 border border-[#6C4DFF]/20 shadow-xs">
              ✓ {job.category}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-slate-100 to-slate-200/60 dark:from-slate-800 dark:to-slate-800/60 text-slate-700 dark:text-slate-300 border border-[#ECEEF5] dark:border-slate-700/50 shadow-xs">
              ✓ Full Time
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 shadow-xs">
              ✓ Verified Employer
            </span>
          </div>
        </motion.div>

        {/* 2. 4-CARD INFORMATION GRID - NO ELLIPSIS / TRUNCATION */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* Location */}
          <div className="bg-[#F7F8FE] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 space-y-2 flex flex-col justify-between shadow-xs min-h-[90px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider mb-0.5">Location</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.location}
              </span>
            </div>
          </div>

          {/* Salary / Budget */}
          <div className="bg-[#F7F8FE] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 space-y-2 flex flex-col justify-between shadow-xs min-h-[90px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <IndianRupee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider mb-0.5">Salary / Budget</span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 leading-snug whitespace-normal break-words overflow-visible block">
                {job.salary}
              </span>
            </div>
          </div>

          {/* Posted Date */}
          <div className="bg-[#F7F8FE] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 space-y-2 flex flex-col justify-between shadow-xs min-h-[90px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider mb-0.5">Posted Date</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.datePosted}
              </span>
            </div>
          </div>

          {/* Application Deadline */}
          <div className="bg-[#F7F8FE] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 space-y-2 flex flex-col justify-between shadow-xs min-h-[90px]">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase text-[#6B7280] tracking-wider mb-0.5">Deadline</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white leading-snug whitespace-normal break-words overflow-visible block">
                {job.applicationDeadline ? new Date(job.applicationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Flexible'}
              </span>
            </div>
          </div>
        </div>

        {/* APPLICATION STATUS BANNER IF APPLIED */}
        {dbApplied && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-[20px] p-3.5 sm:p-4 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <h4 className="font-extrabold text-amber-900 dark:text-amber-300 text-xs sm:text-sm">Application Status</h4>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Status: {applicationStatus ? applicationStatus.toUpperCase() : 'PENDING'}
              </p>
            </div>
            <button
              onClick={() => navigate('/profile/jobs-applied')}
              className="px-3.5 py-1.5 bg-amber-600 text-white font-extrabold text-xs rounded-xl hover:bg-amber-700 transition-colors shadow-xs"
            >
              View Application
            </button>
          </div>
        )}

        {/* 3. ABOUT THE OPPORTUNITY */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3">
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

        {/* 4. REQUIREMENTS (PILL CARDS) */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-4 sm:p-5 shadow-xs space-y-3.5">
          <h3 className="text-sm sm:text-base font-black text-[#111827] dark:text-white flex items-center space-x-2">
            <span>Requirements</span>
          </h3>
          {job.requirements && job.requirements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {job.requirements.map((req, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.005 }}
                  className="flex items-start space-x-2.5 p-3 rounded-xl bg-[#F7F8FE] dark:bg-[#111827] border border-[#ECEEF5] dark:border-slate-800/60 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#6C4DFF] shrink-0 mt-0.5" />
                  <span className="text-xs font-bold text-[#111827] dark:text-slate-200 leading-snug whitespace-normal break-words">{req}</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] italic">No specific requirements mentioned.</p>
          )}
        </div>

        {/* 5. EMPLOYER TRUST SECTION */}
        <div className="bg-white dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[22px] p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={job.companyLogo} 
                alt={job.company} 
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover border border-[#ECEEF5] dark:border-slate-800 bg-slate-50" 
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <h4 className="text-xs sm:text-sm font-extrabold text-[#111827] dark:text-white">{job.company}</h4>
                  {job.verified && <ShieldCheck className="w-4 h-4 text-[#6C4DFF] shrink-0" />}
                </div>
                <span className="text-[11px] font-semibold text-[#6B7280]">Verified Employer</span>
              </div>
            </div>
            <button
              onClick={() => triggerToast(`Employer details for ${job.company}`)}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-[#6C4DFF] text-[#6C4DFF] font-bold text-xs hover:bg-[#6C4DFF]/10 transition-colors cursor-pointer"
            >
              View Profile
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-[#ECEEF5] dark:border-slate-800/60">
            <div className="p-1.5">
              <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Rating</span>
              <span className="text-xs font-extrabold text-[#111827] dark:text-white">★ 4.9</span>
            </div>
            <div className="p-1.5">
              <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Jobs</span>
              <span className="text-xs font-extrabold text-[#111827] dark:text-white">12 Posted</span>
            </div>
            <div className="p-1.5">
              <span className="block text-[10px] uppercase font-black text-[#6B7280] tracking-wider">Member</span>
              <span className="text-xs font-extrabold text-[#111827] dark:text-white">Since 2024</span>
            </div>
          </div>
        </div>

        {/* 6. SAFETY SECTION */}
        <div className="bg-[#F7F8FE] dark:bg-[#0F172A] border border-[#ECEEF5] dark:border-slate-800/80 rounded-[20px] p-3.5 sm:p-4 flex items-center space-x-3 text-xs font-medium text-[#6B7280] dark:text-slate-400">
          <Shield className="w-5 h-5 text-[#6C4DFF] shrink-0" />
          <span>Your personal contact information remains hidden until you choose to share it.</span>
        </div>

      </main>

      {/* 7. BOTTOM STICKY ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 p-3.5 sm:p-4 bg-white/95 dark:bg-[#080C14]/95 backdrop-blur-xl border-t border-[#ECEEF5] dark:border-slate-800/80 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={handleDirectMessage}
            className="flex-1 h-11 sm:h-12 rounded-2xl border-2 border-[#6C4DFF] text-[#6C4DFF] font-extrabold text-xs sm:text-sm hover:bg-[#6C4DFF]/10 transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Message Employer</span>
          </button>
          
          <button
            onClick={() => {
              if (job.applied || deadlineInfo.isExpired) return;
              setShowApplyForm(true);
            }}
            disabled={job.applied || deadlineInfo.isExpired}
            className={`flex-1 h-11 sm:h-12 rounded-2xl text-white font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 shadow-lg ${
              deadlineInfo.isExpired
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : job.applied
                ? 'bg-emerald-600 text-white cursor-default'
                : 'bg-gradient-to-r from-[#6C4DFF] to-[#9D4EDD] hover:opacity-95 shadow-[#6C4DFF]/25 cursor-pointer'
            }`}
          >
            {job.applied ? (
              <>
                <CheckCircle2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>Applied</span>
              </>
            ) : deadlineInfo.isExpired ? (
              <span>Applications Closed</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span>I'm Interested</span>
              </>
            )}
          </button>
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
              className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 border border-[#ECEEF5] dark:border-slate-800 z-10"
            >
              <div className="flex items-center justify-between border-b border-[#ECEEF5] dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-[#6C4DFF]" />
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
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#6C4DFF] to-[#9D4EDD] text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'Submitting...' : 'Send Application'}</span>
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
