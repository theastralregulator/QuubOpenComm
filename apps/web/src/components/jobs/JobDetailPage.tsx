import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, IndianRupee, Calendar, Briefcase, 
  ShieldCheck, CheckCircle2, Bookmark, Share2, Sparkles, Send, Clock
} from 'lucide-react';
import { Job } from '../../types';
import { supabase } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';
import { formatSalaryRange } from '../../lib/currency';
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
  const [coverLetter, setCoverLetter] = useState('Hi! I am very interested in this role and would love to collaborate on this. I have extensive experience in responsive development, TypeScript, and modern frameworks.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const loggedInId = localStorage.getItem('opencomm_user_id');
  const isOwner = job?.posted_by && loggedInId === job.posted_by;
  const [dbApplied, setDbApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [existingApp, setExistingApp] = useState<any>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!jobId) return;
      setLoading(true);
      setError(null);

      // 1. Try to find in memory first
      const localJob = jobs.find((j) => j.id === jobId);
      if (localJob) {
        setJob(localJob);
        setBidRate(localJob.salary);
        setLoading(false);
        return;
      }

      // 2. Query real Supabase if connected
      if (supabase) {
        try {
          // Check if user has already applied
          if (loggedInId) {
            const { data: appData } = await supabase
              .from('job_applications')
              .select('id, status, proposed_rate, created_at')
              .eq('job_id', jobId)
              .eq('applicant_id', loggedInId)
              .maybeSingle();
            if (appData) {
              setDbApplied(true);
              setApplicationStatus(appData.status);
              setExistingApp(appData);
            }
          }

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

      // 3. Fallback: Not found
      setError('Job opportunity could not be found or has been closed.');
      setLoading(false);
    }

    fetchJob();
  }, [jobId, jobs]);

  // Track detail view
  useEffect(() => {
    if (job) {
      analytics.trackEvent('view_job_detail', { job_id: job.id, job_title: job.title });
    }
  }, [job]);

  const handleShare = async () => {
    if (!job) return;
    const shareUrl = window.location.href;
    const shareText = `Check out this job opportunity: ${job.title} at ${job.company}!`;

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
        triggerToast('Job listing URL copied to clipboard!');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    if (!isLoggedIn || !loggedInId) {
      onOpenAuth('locked');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const applicantId = authData?.user?.id || loggedInId;

      // 1. Pre-flight duplicate check
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
        setIsSubmitting(false);
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

      // Update both local states so UI re-renders immediately
      setDbApplied(true);
      setApplicationStatus(response.data?.status || 'pending');
      setExistingApp(response.data);
      setJob(prev => prev ? { ...prev, applied: true } : null);
      
      triggerToast('Application submitted successfully!');
      
      setIsSubmitting(false);
      setShowApplyForm(false);
    } catch (err: any) {
      if (err.code === '23505') {
        triggerToast('You have already applied for this job.');
      } else {
        triggerToast('Unable to submit your application. Please try again.');
        if (import.meta.env.DEV) {
          console.error('--- SUPABASE ERROR OBJECT ---', err);
        }
      }
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 space-y-6 animate-pulse text-left">
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Opportunity Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'This job is no longer available.'}</p>
        <button
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Opportunities</span>
        </button>
      </div>
    );
  }

  const deadlineInfo = getDeadlineInfo(job.applicationDeadline);

  const createdDate = new Date(job.created_at || new Date());
  const now = new Date();
  const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
  const isEditable = isOwner && diffHours <= 5;

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-3.5 sm:px-4 space-y-4 sm:space-y-6 text-left pb-[calc(110px+env(safe-area-inset-bottom))]" id="job-detail-page">
      
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {/* Main Container */}
      <div className="w-full space-y-4 sm:space-y-5">
        
        {/* A1. JOB HEADER CARD */}
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[22px] sm:rounded-[26px] p-5 sm:p-7 shadow-[0_2px_10px_rgba(0,0,0,0.02)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src={job.companyLogo} 
                  alt={job.company} 
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shadow-sm" 
                />
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                      {job.company}
                    </span>
                    {job.verified && (
                      <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-1.5 py-0.5 rounded-md">
                        <ShieldCheck className="w-3 h-3 mr-0.5 stroke-[2.5]" />
                        Verified Employer
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                {isOwner && (
                  <div className="relative">
                    {isEditable ? (
                      <button
                        onClick={() => triggerToast('Edit Job feature is coming soon.')}
                        className="p-2.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 transition-all cursor-pointer shadow-sm hover:shadow"
                        title="Edit Job (Editable for 5 hours)"
                      >
                        <Briefcase className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                        This job can no longer be edited because the 5-hour editing period has ended.
                      </span>
                    )}
                  </div>
                )}
                <div className="relative">
                  <button
                    onClick={handleShare}
                    className="p-2.5 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-[#111827] dark:hover:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer shadow-sm hover:shadow"
                    title="Share Job Opportunity"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  {copied && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap z-10 animate-bounce">
                      Copied!
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => toggleBookmark(job.id, e)}
                  className={`p-2.5 rounded-full border transition-all cursor-pointer shadow-sm hover:shadow ${
                    job.bookmarked 
                      ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400' 
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-[#111827] dark:hover:bg-slate-800'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${job.bookmarked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>

            <div className="pt-2">
              <h1 className="text-[22px] sm:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                {job.title}
              </h1>
              <div className="flex flex-wrap gap-2 pt-3">
                <span className="text-[11px] font-extrabold tracking-wide bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg">
                  {job.category}
                </span>
                <span className="text-[11px] font-extrabold tracking-wide bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-800/50">
                  Full-time
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* A2. JOB INFORMATION GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[20px] p-4 flex items-center space-x-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/5 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Location</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{job.location}</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[20px] p-4 flex items-center space-x-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Salary / Budget</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">{job.salary}</span>
            </div>
          </div>
          {dbApplied ? (
            <div className="col-span-1 sm:col-span-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-[20px] p-5 flex items-center justify-between shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
              <div className="space-y-0.5 text-left">
                <h3 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Application Submitted</h3>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  You have applied for this job. Your application status is currently: 
                  {applicationStatus === 'accepted' ? (
                    <span className="ml-1.5 font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-[10px]">ACCEPTED</span>
                  ) : applicationStatus === 'rejected' ? (
                    <span className="ml-1.5 font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[10px]">REJECTED</span>
                  ) : applicationStatus === 'shortlisted' ? (
                    <span className="ml-1.5 font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[10px]">SHORTLISTED</span>
                  ) : (
                    <span className="ml-1.5 font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px]">PENDING</span>
                  )}
                </p>
              </div>
            </div>
          ) : null}

          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[20px] p-4 flex items-center space-x-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="p-2.5 bg-purple-500/10 dark:bg-purple-500/5 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Posted</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{job.datePosted}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[20px] p-4 flex items-center space-x-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Application Deadline</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {job.applicationDeadline ? `Apply by ${new Date(job.applicationDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No deadline specified'}
              </span>
            </div>
          </div>
        </div>

        {/* A4. JOB DESCRIPTION */}
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[22px] p-5 sm:p-7 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Opportunity Description
          </h2>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
            {job.description.split('\n').map((para, i) => (
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            ))}
          </div>
        </div>

        {/* A5. REQUIREMENTS */}
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[22px] p-5 sm:p-7 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-4">
          <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Requirements
          </h2>
          {job.requirements && job.requirements.length > 0 ? (
            <div className="flex flex-col space-y-2">
              {job.requirements.map((req, index) => (
                <div key={index} className="flex items-start space-x-3 bg-slate-50/50 dark:bg-slate-800/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 leading-snug">{req}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">No specific requirements added.</p>
          )}
        </div>

        {/* A6. APPLICATION SECTION */}
        {!isOwner && !existingApp && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-800/30 rounded-[22px] p-6 sm:p-8 flex flex-col items-center text-center space-y-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 space-y-2 max-w-md">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {deadlineInfo.isExpired ? 'Applications Closed' : 'Interested in this opportunity?'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {deadlineInfo.isExpired 
                  ? 'This job is no longer accepting applications at this time.' 
                  : 'Send your application directly to the employer.'}
              </p>
            </div>

            <div className="relative z-10 w-full max-w-xs pt-2">
              <button
                onClick={() => {
                  if (job.applied || deadlineInfo.isExpired) return;
                  setShowApplyForm(!showApplyForm);
                }}
                disabled={job.applied || deadlineInfo.isExpired}
                className={`w-full h-12 rounded-xl text-sm font-extrabold transition-all duration-200 flex items-center justify-center space-x-2 ${
                  deadlineInfo.isExpired
                    ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                    : job.applied 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default border border-emerald-500/20' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:scale-[1.02] cursor-pointer'
                }`}
              >
                {deadlineInfo.isExpired ? (
                  <span>Closed</span>
                ) : job.applied ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Applied</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4.5 h-4.5" />
                    <span>Apply</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* NEW APPLICATION STATUS CARD */}
        {!isOwner && existingApp && (
          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[22px] p-6 sm:p-8 flex flex-col space-y-4 shadow-[0_4px_15px_rgba(0,0,0,0.05)] text-left relative overflow-hidden">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Application Status
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-[#111827] p-5 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-1.5">
                <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Current Status</span>
                <div className="flex items-center">
                  {existingApp.status === 'accepted' ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold rounded-lg uppercase tracking-wider">Accepted</span>
                  ) : existingApp.status === 'rejected' ? (
                    <span className="px-3 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-bold rounded-lg uppercase tracking-wider">Rejected</span>
                  ) : existingApp.status === 'shortlisted' ? (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-bold rounded-lg uppercase tracking-wider">Shortlisted</span>
                  ) : existingApp.status === 'withdrawn' ? (
                    <span className="px-3 py-1 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold rounded-lg uppercase tracking-wider">Withdrawn</span>
                  ) : (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold rounded-lg uppercase tracking-wider">Pending</span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                 <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Proposed Rate</span>
                 <span className="block font-bold text-slate-900 dark:text-white">{existingApp.proposed_rate || '-'}</span>
              </div>
              <div className="space-y-1.5">
                 <span className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Applied On</span>
                 <span className="block font-bold text-slate-900 dark:text-white">
                   {new Date(existingApp.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                 </span>
              </div>
            </div>
            
            <button
               onClick={() => navigate('/profile/jobs-applied')}
               className="w-full sm:w-auto self-end h-11 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all shadow-sm cursor-pointer border border-slate-200 dark:border-slate-700"
            >
               View My Application
            </button>
          </div>
        )}

        {/* Dynamic Apply Form Section */}
        <AnimatePresence>
          {showApplyForm && !isOwner && !deadlineInfo.isExpired && !existingApp && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleApplySubmit}
              className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-[22px] p-5 sm:p-7 shadow-[0_4px_15px_rgba(0,0,0,0.05)] space-y-4"
            >
              <div className="flex items-center space-x-2 text-left mb-4">
                <Send className="w-5 h-5 text-blue-500 shrink-0" />
                <h4 className="text-[15px] font-extrabold text-[#0F172A] dark:text-white">Submit Your Application</h4>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Your Propose Rate
                  </label>
                  <input 
                    type="text" 
                    required
                    value={bidRate}
                    onChange={(e) => setBidRate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-semibold transition-colors"
                    placeholder="e.g. ₹50,000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cover Letter / Proposal
                  </label>
                  <textarea 
                    rows={4}
                    required
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 font-medium transition-colors"
                    placeholder="Tell the employer why you are a great fit..."
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Proposal'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
