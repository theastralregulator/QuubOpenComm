import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, IndianRupee, Calendar, Briefcase, 
  ShieldCheck, CheckCircle2, Bookmark, Share2, Sparkles, Send, MessageSquare 
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
          const { data, error: sbError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

          if (sbError) {
            console.error('Error fetching job from Supabase:', sbError);
          } else if (data) {
            const mappedJob: Job = {
              id: data.id,
              title: data.title,
              company: data.company_name || 'Verified Employer',
              companyLogo: data.company_logo || '',
              salary: data.salary_range || 'Contract',
              location: data.location || 'Remote',
              category: data.category || 'Professional',
              description: data.description || '',
              requirements: Array.isArray(data.requirements) ? data.requirements : [],
              verified: data.verified || true,
              bookmarked: false,
              applied: false,
              datePosted: 'Just now',
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

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    if (!isLoggedIn) {
      onOpenAuth('locked');
      return;
    }

    setIsSubmitting(true);
    try {
      handleApplyJob(job.id, bidRate, coverLetter);
      setIsSubmitting(false);
      setShowApplyForm(false);
      setJob(prev => prev ? { ...prev, applied: true } : null);
    } catch (err) {
      triggerToast('Failed to submit application.');
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
        <div className="space-y-3 pt-6">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
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

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6 text-left pb-[calc(110px+env(safe-area-inset-bottom))]" id="job-detail-page">
      
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {/* Main Details Container */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        
        {/* Glow Decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          
          {/* Left section: Company & Title */}
          <div className="flex items-start space-x-4 min-w-0">
            <img 
              src={job.companyLogo} 
              alt={job.company} 
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover bg-slate-50 border border-slate-100 dark:border-slate-800 shadow-xs" 
            />
            <div className="space-y-1.5 text-left min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-[#475569] dark:text-slate-300">
                  {job.company}
                </span>
                {job.verified && (
                  <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 dark:bg-emerald-500/5 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
                    Verified Employer
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-snug">
                {job.title}
              </h1>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                  {job.category}
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-[#475569] dark:text-slate-300 px-2.5 py-1 rounded-full">
                  Full-time
                </span>
              </div>
            </div>
          </div>

          {/* Right section: Header Actions */}
          <div className="flex items-center space-x-2 shrink-0 self-end md:self-start">
            {/* Share */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer hover:scale-105"
                title="Share Job Opportunity"
              >
                <Share2 className="w-4.5 h-4.5" />
              </button>
              {copied && (
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-950 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap z-10 animate-bounce">
                  Copied URL!
                </div>
              )}
            </div>

            {/* Bookmark */}
            <button
              onClick={(e) => toggleBookmark(job.id, e)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:scale-105 ${
                job.bookmarked 
                  ? 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400' 
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-4.5 h-4.5 ${job.bookmarked ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick details strip */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 border-y border-slate-100 dark:border-slate-800/60 py-5">
          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/5 rounded-xl text-[#2563EB]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Location</span>
              <span className="text-xs font-bold text-[#475569] dark:text-slate-200">{job.location}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Salary Offer</span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatSalaryRange(undefined, undefined, job.salary)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 bg-purple-500/10 dark:bg-purple-500/5 rounded-xl text-purple-600 dark:text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Posted Date</span>
              <span className="text-xs font-bold text-[#475569] dark:text-slate-200">{job.datePosted}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-left">
            <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Application Deadline</span>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{getDeadlineInfo(job.applicationDeadline).formattedDate}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getDeadlineInfo(job.applicationDeadline).badgeColorClass}`}>
                  {getDeadlineInfo(job.applicationDeadline).label}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
            Opportunity Description
          </h2>
          <div className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed space-y-3">
            {job.description.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {/* Requirements Section */}
        {job.requirements && job.requirements.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Role Requirements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {job.requirements.map((req, index) => (
                <div key={index} className="flex items-start space-x-2.5 text-left bg-slate-50/50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{req}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Apply Call to Action */}
        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="text-xs font-bold text-[#475569] dark:text-slate-400 block">
              {getDeadlineInfo(job.applicationDeadline).isExpired ? 'Applications Closed' : 'Ready to propose?'}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {getDeadlineInfo(job.applicationDeadline).isExpired 
                ? `This job is no longer accepting applications (Deadline was ${getDeadlineInfo(job.applicationDeadline).formattedDate}).` 
                : 'Submit your bid and cover note directly to this company.'}
            </span>
          </div>

          <button
            onClick={() => {
              if (job.applied || getDeadlineInfo(job.applicationDeadline).isExpired) return;
              setShowApplyForm(!showApplyForm);
            }}
            disabled={job.applied || getDeadlineInfo(job.applicationDeadline).isExpired}
            aria-disabled={job.applied || getDeadlineInfo(job.applicationDeadline).isExpired}
            className={`h-11 px-8 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer w-full sm:w-auto flex items-center justify-center space-x-1.5 ${
              getDeadlineInfo(job.applicationDeadline).isExpired
                ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                : job.applied 
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default' 
                  : 'bg-gradient-to-r from-[#2563EB] to-blue-600 hover:opacity-95 text-white shadow-md hover:scale-102'
            }`}
          >
            {getDeadlineInfo(job.applicationDeadline).isExpired ? (
              <span>Applications Closed</span>
            ) : job.applied ? (
              <>
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span>Application Submitted</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Apply & Place Bid</span>
              </>
            )}
          </button>
        </div>

        {/* Dynamic Apply Form Section */}
        <AnimatePresence>
          {showApplyForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleApplySubmit}
              className="mt-6 border-t border-slate-100 dark:border-slate-800/60 pt-6 overflow-hidden space-y-4"
            >
              <div className="bg-blue-500/5 dark:bg-blue-500/2 border border-blue-500/10 p-4 rounded-2xl flex items-start space-x-2 text-left mb-2">
                <Sparkles className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold text-[#0F172A] dark:text-white">Smart Match Active</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Your profile will be matched. Make sure to propose a competitive bidding rate.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="md:col-span-1 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Your Propose Rate
                  </label>
                  <input 
                    type="text" 
                    required
                    value={bidRate}
                    onChange={(e) => setBidRate(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                    placeholder="e.g. ₹50,000"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cover Letter / Proposal Summary
                  </label>
                  <textarea 
                    rows={4}
                    required
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-medium"
                    placeholder="Tell the employer why you are a great fit..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
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
