import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ShieldCheck, X, Send, Calendar, MapPin, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Worker } from '../../types';
import { supabase, dbService } from '../../lib/supabase';
import UserAvatar from '../common/UserAvatar';

interface HireRequestFormProps {
  worker: Worker;
  onClose: () => void;
  triggerToast: (msg: string) => void;
  onSuccess?: (requestId: string) => void;
}

export default function HireRequestForm({
  worker,
  onClose,
  triggerToast,
  onSuccess
}: HireRequestFormProps) {
  const navigate = useNavigate();

  const [workTitle, setWorkTitle] = useState(`Bespoke ${worker.title ? worker.title.split(' ')[0] : 'Service'} Project`);
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState<number | ''>(worker.hourlyRate || 500);
  const [preferredDate, setPreferredDate] = useState('');
  const [location, setLocation] = useState(worker.location || '');
  const [duration, setDuration] = useState('1 Week');
  const [additionalMessage, setAdditionalMessage] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('Client');

  useEffect(() => {
    async function loadUser() {
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setCurrentUserId(user.id);
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
            if (profile?.full_name) {
              setCurrentUserName(profile.full_name);
            }
          }
        } catch (err) {
          console.warn('Auth check error in HireRequestForm:', err);
        }
      }
    }
    loadUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!workTitle.trim()) {
      setError('Please provide a project title.');
      return;
    }
    if (!description.trim()) {
      setError('Please describe the work details and deliverables.');
      return;
    }
    if (!budget || Number(budget) <= 0) {
      setError('Please specify a valid positive budget.');
      return;
    }

    if (currentUserId && currentUserId === worker.id) {
      setError('You cannot send a hiring request to yourself.');
      return;
    }

    setSubmitting(true);

    try {
      // Formulate detailed message block preserving duration and location
      const metaDetails = [
        location ? `Location: ${location}` : null,
        duration ? `Expected Duration: ${duration}` : null,
        additionalMessage ? `Note: ${additionalMessage}` : null
      ].filter(Boolean).join(' | ');

      const formattedMessage = metaDetails ? `${metaDetails}` : '';

      const req = await dbService.sendHiringRequest({
        client_id: currentUserId || 'guest-client',
        client_name: currentUserName,
        worker_id: worker.id,
        worker_name: worker.name,
        work_title: workTitle.trim(),
        description: description.trim(),
        budget: Number(budget),
        preferred_date: preferredDate || new Date().toISOString().split('T')[0],
        location: location.trim(),
        duration: duration.trim(),
        message: additionalMessage.trim()
      });

      triggerToast(`Hiring request sent successfully to ${worker.name}!`);
      setSubmitting(false);
      onClose();

      if (onSuccess) {
        onSuccess(req.id);
      } else {
        navigate('/profile/hire-requests?tab=sent');
      }
    } catch (err: any) {
      console.error('Failed to send hiring request:', err);
      setError(err.message || 'Failed to submit hiring request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/40 backdrop-blur-xs overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-lg overflow-hidden shadow-2xl text-left my-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center space-x-3">
            <UserAvatar avatarUrl={worker.photo} fullName={worker.name} size="md" />
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
                Send Hire Request
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                To: <span className="font-bold text-purple-600 dark:text-purple-400">{worker.name}</span> ({worker.title || 'Professional'})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          
          {/* Micro safety escrow alert */}
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed font-medium flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>
              <strong>Direct Hiring Safeguard:</strong> This initial request opens a temporary negotiation room once accepted. Permanent chat unlocks only after a final contract deal is confirmed.
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
              Work / Project Title *
            </label>
            <input 
              type="text" 
              required
              placeholder="e.g. Full Custom Kitchen Cabinet Installation"
              value={workTitle}
              onChange={(e) => setWorkTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Proposed Budget (₹) *
              </label>
              <input 
                type="number" 
                required
                min="1"
                placeholder="e.g. 1500"
                value={budget}
                onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Preferred Start Date
              </label>
              <input 
                type="date" 
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Location / Address
              </label>
              <input 
                type="text" 
                placeholder="e.g. Indiranagar, Bengaluru"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
                Expected Duration
              </label>
              <input 
                type="text" 
                placeholder="e.g. 3 Days / 2 Weeks"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Detailed Work Description & Deliverables *
            </label>
            <textarea 
              rows={3}
              required
              placeholder="Describe the scope of work, key tasks, expectations, and deliverables required..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">
              Additional Note (Optional)
            </label>
            <input 
              type="text" 
              placeholder="Any special instructions or preliminary questions for the worker..."
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Request...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Hire Request</span>
                </>
              )}
            </button>
          </div>

        </form>
      </motion.div>
    </div>
  );
}
