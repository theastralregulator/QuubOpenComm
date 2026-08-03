import React, { useState } from 'react';
import { motion } from 'motion/react';
import { FileText, DollarSign, Calendar, Clock, MapPin, X, Send, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { dbService } from '../../lib/supabase';

interface FinalDealFormProps {
  requestId?: string;
  applicationId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialBudget?: number;
  onClose: () => void;
  onSuccess: (proposal: any) => void;
  triggerToast: (msg: string) => void;
}

export default function FinalDealForm({
  requestId,
  applicationId,
  initialTitle = '',
  initialDescription = '',
  initialBudget = 1000,
  onClose,
  onSuccess,
  triggerToast
}: FinalDealFormProps) {
  const [workTitle, setWorkTitle] = useState(initialTitle);
  const [workDescription, setWorkDescription] = useState(initialDescription);
  const [finalPrice, setFinalPrice] = useState<number | ''>(initialBudget);
  const [paymentType, setPaymentType] = useState<'fixed' | 'hourly' | 'monthly' | 'daily' | 'project'>('fixed');
  const [workDate, setWorkDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('1 Week');
  const [location, setLocation] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workTitle.trim()) {
      setError('Work title is required.');
      return;
    }
    if (!workDescription.trim()) {
      setError('Work description and deliverables are required.');
      return;
    }
    if (!finalPrice || Number(finalPrice) <= 0) {
      setError('Please provide a valid positive final price.');
      return;
    }

    setSubmitting(true);
    try {
      const proposal = await dbService.submitDealProposal({
        request_id: requestId || undefined,
        application_id: applicationId || undefined,
        work_title: workTitle.trim(),
        work_description: workDescription.trim(),
        final_price: Number(finalPrice),
        payment_type: paymentType,
        work_date: workDate || undefined,
        start_time: startTime || undefined,
        duration: duration || undefined,
        location: location || undefined,
        additional_terms: additionalTerms || undefined,
      });

      triggerToast('Final deal proposal submitted successfully!');
      setSubmitting(false);
      onSuccess(proposal);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit deal proposal:', err);
      setError(err.message || 'Failed to submit proposal.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden shadow-2xl text-left my-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
              Prepare Work Agreement
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-[11px] text-purple-700 dark:text-purple-300 leading-relaxed font-medium flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
            <span>
              <strong>Work Agreement:</strong> Once both parties confirm this agreement, official work starts and permanent chat unlocks.
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Agreed Work / Project Title *
            </label>
            <input 
              type="text" 
              required
              value={workTitle}
              onChange={(e) => setWorkTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Final Price Amount (₹) *
              </label>
              <input 
                type="number" 
                required
                min="1"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs font-extrabold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Payment Structure *
              </label>
              <select 
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value="fixed">Fixed Price Milestone</option>
                <option value="hourly">Hourly Rate</option>
                <option value="monthly">Monthly Retainer</option>
                <option value="daily">Daily Rate</option>
                <option value="project">Project Lump Sum</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Scheduled Date
              </label>
              <input 
                type="date" 
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Start Time
              </label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Duration
              </label>
              <input 
                type="text" 
                placeholder="e.g. 5 Days"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Work Location / Venue
            </label>
            <input 
              type="text" 
              placeholder="e.g. Site Office / Client Location / Remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Detailed Work Description & Specific Deliverables *
            </label>
            <textarea 
              rows={3}
              required
              placeholder="Define exact deliverables, milestones, materials, and expectations..."
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Additional Terms & Clauses (Optional)
            </label>
            <input 
              type="text" 
              placeholder="e.g. 50% advance upon start, 50% upon final signoff."
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Agreement...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Work Agreement</span>
                </>
              )}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
