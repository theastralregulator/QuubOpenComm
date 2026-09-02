import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface SharedApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  applicantId: string;
  jobSalary?: string;
  onSuccess: (appRecord?: any) => void;
  triggerToast?: (msg: string) => void;
}

export default function SharedApplicationModal({
  isOpen,
  onClose,
  jobId,
  applicantId,
  jobSalary,
  onSuccess,
  triggerToast
}: SharedApplicationModalProps) {
  const [bidRate, setBidRate] = useState(jobSalary || '');
  const [coverLetter, setCoverLetter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !bidRate.trim() || !coverLetter.trim()) return;

    setIsSubmitting(true);
    try {
      if (supabase) {
        let realApplicantId = applicantId;
        if (!realApplicantId || realApplicantId === 'user') {
          const { data: { user } } = await supabase.auth.getUser();
          realApplicantId = user?.id || '';
        }

        if (!realApplicantId) {
          if (triggerToast) triggerToast('Please sign in to submit a job application.');
          setIsSubmitting(false);
          return;
        }

        const { assertUserEmailConfirmed, dbService } = await import('../../lib/supabase');
        try {
          await assertUserEmailConfirmed();
        } catch (verr: any) {
          if (triggerToast) triggerToast(verr.message || "Email verification is required before submitting job applications.");
          setIsSubmitting(false);
          return;
        }

        const freshProfile = await dbService.getProfile(realApplicantId);
        if (!freshProfile || freshProfile.onboarding_completed !== true) {
          if (triggerToast) triggerToast("Complete your profile to apply for jobs.");
          setIsSubmitting(false);
          onClose();
          return;
        }

        const { data: newApp, error: appError } = await supabase.rpc('submit_job_application', {
          p_job_id: jobId,
          p_proposed_rate: bidRate.trim(),
          p_cover_letter: coverLetter.trim(),
        });

        if (appError) {
          if (appError.code === '23505') {
            if (triggerToast) triggerToast('You have already applied for this job.');
            window.dispatchEvent(new CustomEvent('opencomm:job-application-changed'));
          } else {
            console.error('Application submission error:', appError);
            if (triggerToast) triggerToast(`Failed to submit application: ${appError.message}`);
          }
          setIsSubmitting(false);
          onClose();
          return;
        }

        if (newApp) {
          onSuccess(newApp);
        }
      } else {
        if (triggerToast) triggerToast('Unable to submit application right now. Please try again.');
        setIsSubmitting(false);
        onClose();
        return;
      }

      window.dispatchEvent(new CustomEvent('opencomm:job-application-changed'));
      if (triggerToast) triggerToast('Application submitted successfully!');
      onClose();
    } catch (err: any) {
      console.error('Application submission exception:', err);
      if (triggerToast) triggerToast(err.message || 'An unexpected error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => e.stopPropagation()}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={onClose}
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
                onClick={onClose}
                className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-[#ECEEF5] dark:border-slate-800 text-xs font-bold text-[#6B7280] dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#6C4DFF] to-[#4F46E5] text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
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
  );
}
