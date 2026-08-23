import React, { useState } from 'react';
import { Mail, HelpCircle, ArrowLeft, Send, AlertTriangle } from 'lucide-react';
import { siteContactConfig } from '../../lib/siteContactConfig';

interface GrievancePageProps {
  navigate?: (path: string) => void;
  triggerToast?: (msg: string) => void;
}

type IssueType = 'general_support' | 'report_safety' | 'report_fraud' | 'report_job' | 'report_worker' | 'privacy_request' | 'account_deletion';

export default function GrievancePage({ navigate, triggerToast }: GrievancePageProps) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    type: 'general_support' as IssueType,
    subject: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { supabase, dbService } = await import('../../lib/supabase');
      let authedUserId: string | null = null;
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        authedUserId = user?.id || null;
      }
      if (!authedUserId) {
        if (triggerToast) {
          triggerToast("Please log in to submit a grievance ticket online.");
        }
        setIsSubmitting(false);
        return;
      }

      const isHighPriority = form.type === 'report_safety' || form.type === 'report_fraud';
      const ticketId = await dbService.createSupportTicket({
        category: form.type,
        subject: `[${form.type.toUpperCase()}] ${form.subject}`,
        message: `Name: ${form.name}\nEmail: ${form.email}\n\n${form.description}`,
        priority: isHighPriority ? 'high' : 'normal',
      });

      if (ticketId) {
        if (triggerToast) {
          triggerToast("Grievance ticket submitted successfully.");
        }
        setForm({
          name: '',
          email: '',
          type: 'general_support',
          subject: '',
          description: '',
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('Not authenticated') || errMsg.includes('jwt')) {
        if (triggerToast) {
          triggerToast("Please log in to submit a grievance ticket online.");
        }
      } else {
        if (triggerToast) {
          triggerToast("Could not submit ticket. Please check details or try again.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto py-8 sm:py-12 px-5 sm:px-8 lg:px-10 text-left animate-fadeIn pb-[calc(110px+env(safe-area-inset-bottom))]">
      {navigate && (
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info Column */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 lg:col-span-1 h-fit relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />
          
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Contact & Grievance
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
              Have questions, feedback, privacy requests, or safety issues? Get in touch with the OpenComm Grievance Redressal desk.
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-zinc-800 pt-5 space-y-4 text-xs font-medium text-slate-600 dark:text-zinc-300">
            {/* Support Email / Channel */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono font-bold block">Support Channels</span>
              {siteContactConfig.supportEmail ? (
                <p className="font-bold flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{siteContactConfig.supportEmail}</span>
                </p>
              ) : (
                <p className="font-semibold text-slate-700 dark:text-zinc-200">
                  In-App Support Ticket & Assistance Portal
                </p>
              )}
            </div>

            {/* Grievance Officer & Corporate Info (Only shown if populated by platform owner) */}
            {siteContactConfig.grievanceOfficerName && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono font-bold block">Grievance Officer</span>
                <p className="font-semibold text-slate-700 dark:text-zinc-200">
                  {siteContactConfig.grievanceOfficerName}
                </p>
                {siteContactConfig.corporateAddress && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    {siteContactConfig.corporateAddress}
                  </p>
                )}
              </div>
            )}

            {/* Acknowledgment Timeframe */}
            <div className="p-3.5 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/15 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-black text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-[11px]">
                <HelpCircle className="w-4 h-4" />
                <span>Response Timelines</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-500 dark:text-zinc-400">
                Tickets are acknowledged automatically upon creation. Verification and resolution is addressed within <strong>15 business days</strong> of receipt.
              </p>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />
          
          <div className="mb-6 flex items-start space-x-2">
            <AlertTriangle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">Submit a Grievance or Report</h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Please provide detailed information so we can investigate and address your request.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your Name"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700 dark:text-zinc-300">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="your.email@domain.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Issue Type Selector */}
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">Category of Issue</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as IssueType })}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="general_support">General Support / Inquiry</option>
                <option value="report_safety">Report Safety Issue</option>
                <option value="report_fraud">Report Fraud or Scams</option>
                <option value="report_job">Report a Misleading Job Listing</option>
                <option value="report_worker">Report Worker Profile Violations</option>
                <option value="privacy_request">Privacy or Data Access Request</option>
                <option value="account_deletion">Account Deletion Request</option>
              </select>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">Subject</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block font-semibold text-slate-700 dark:text-zinc-300">Description of Grievance</label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Please enter a complete description of the issue or your deletion/data request. Include IDs, job titles, or profile urls if relevant."
                className="w-full p-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-medium leading-relaxed resize-none focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "Submitting..." : "Submit Grievance"}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
