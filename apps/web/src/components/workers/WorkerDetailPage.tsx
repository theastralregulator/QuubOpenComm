import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, Star, Bookmark, Share2, Sparkles, Send, 
  MessageSquare, CheckCircle2, ShieldCheck, Briefcase, Award, Clock 
} from 'lucide-react';
import { Worker } from '../../types';
import { supabase } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';

interface WorkerDetailPageProps {
  workers: Worker[];
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onOpenHire: (worker: Worker, e: React.MouseEvent) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn: boolean;
  onOpenAuth: (tab: 'signin' | 'signup' | 'locked') => void;
}

export default function WorkerDetailPage({
  workers,
  toggleWorkerBookmark,
  onOpenMessage,
  onOpenHire,
  triggerToast,
  isLoggedIn,
  onOpenAuth,
}: WorkerDetailPageProps) {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hire Form / Message form state
  const [copied, setCopied] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [budget, setBudget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchWorker() {
      if (!workerId) return;
      setLoading(true);
      setError(null);

      // 1. Find in memory
      const localWorker = workers.find((w) => w.id === workerId);
      if (localWorker) {
        setWorker(localWorker);
        setLoading(false);
        return;
      }

      // 2. Try Supabase profiles
      if (supabase) {
        try {
          const { data, error: sbError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', workerId)
            .single();

          if (sbError) {
            console.error('Error fetching worker from Supabase:', sbError);
          } else if (data) {
            const mappedWorker: Worker = {
              id: data.id,
              name: data.full_name || 'Verified Worker',
              photo: data.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
              title: data.preferred_language || 'Professional Specialist',
              experience: 5,
              rating: 5.0,
              availability: 'Available Now',
              location: `${data.city || 'Austin'}, ${data.state || 'TX'}`,
              bio: data.bio || 'Professional contractor verified on OpenComm.',
              skills: ['Service', 'Contracting', 'Consulting'],
              completedWorks: 12,
              hourlyRate: 75,
              verified: true,
            };
            setWorker(mappedWorker);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Supabase fetch exception:', err);
        }
      }

      // 3. Fallback: Not found
      setError('Worker profile could not be found.');
      setLoading(false);
    }

    fetchWorker();
  }, [workerId, workers]);

  useEffect(() => {
    if (worker) {
      analytics.trackProfileViewed('worker', worker.id, worker.name);
    }
  }, [worker]);

  const handleShare = async () => {
    if (!worker) return;
    const shareUrl = window.location.href;
    const shareText = `Check out this certified professional on OpenComm: ${worker.name} (${worker.title})!`;

    analytics.trackEvent('share', { item_type: 'worker', item_id: worker.id, item_title: worker.name });

    if (navigator.share) {
      try {
        await navigator.share({
          title: worker.name,
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
        triggerToast('Profile URL copied to clipboard!');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  const handleHireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!worker) return;

    if (!isLoggedIn) {
      onOpenAuth('locked');
      return;
    }

    setIsSubmitting(true);
    try {
      // Mock triggering real hire proposal
      onOpenHire(worker, e as any);
      setIsSubmitting(false);
      setShowHireForm(false);
      triggerToast(`Hire request submitted to ${worker.name}!`);
    } catch (err) {
      triggerToast('Failed to submit hire request.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-12 px-4 space-y-6 animate-pulse text-left">
        <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
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

  if (error || !worker) {
    return (
      <div className="w-full max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center">
          <Briefcase className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profile Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'This contractor is no longer active.'}</p>
        <button
          onClick={() => navigate('/workers')}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Specialists</span>
        </button>
      </div>
    );
  }

  const availColor = worker.availability === 'Available Now' ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 space-y-6 text-left pb-[calc(110px+env(safe-area-inset-bottom))]" id="worker-detail-page">
      
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {/* Main Profile Details */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        
        {/* Ambient background decoration */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          
          {/* Photo & Identity Section */}
          <div className="flex items-start space-x-4 min-w-0">
            <div className="relative shrink-0">
              <img 
                src={worker.photo} 
                alt={worker.name} 
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-[#111827] shadow-md bg-slate-50" 
              />
              <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-3 border-white dark:border-[#111827] ${availColor} animate-pulse`} />
            </div>

            <div className="space-y-1 text-left min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight leading-none">
                  {worker.name}
                </h1>
                {worker.verified && (
                  <span className="inline-flex items-center text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 dark:bg-purple-500/5 px-2 py-0.5 rounded-md">
                    <ShieldCheck className="w-3.5 h-3.5 mr-0.5 stroke-[2.5]" />
                    Verified Specialist
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                {worker.title}
              </p>
              <div className="flex items-center space-x-1.5 pt-1">
                <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{worker.location}</span>
              </div>
            </div>
          </div>

          {/* Top Right Header Buttons */}
          <div className="flex items-center space-x-2 shrink-0 self-end md:self-start">
            {/* Share */}
            <div className="relative">
              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800 dark:text-slate-300 transition-all cursor-pointer hover:scale-105"
                title="Share Profile"
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
              onClick={(e) => toggleWorkerBookmark(worker.id, e)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer hover:scale-105 ${
                worker.saved 
                  ? 'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-400' 
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:bg-slate-800/40 dark:hover:bg-slate-800'
              }`}
            >
              <Bookmark className={`w-4.5 h-4.5 ${worker.saved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-slate-100 dark:border-slate-800/60 py-5 text-center">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">RATING</span>
            <div className="flex items-center justify-center mt-1 text-sm font-black text-slate-900 dark:text-white space-x-1">
              <Star className="w-4 h-4 text-amber-500 fill-current" />
              <span>{worker.rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="border-l sm:border-l border-slate-100 dark:border-slate-800/40">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">EXPERIENCE</span>
            <span className="block text-sm font-black text-slate-900 dark:text-white mt-1">
              {worker.experience} Years
            </span>
          </div>

          <div className="border-l border-slate-100 dark:border-slate-800/40 col-span-1">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">HOURLY RATE</span>
            <span className="block text-sm font-black text-slate-900 dark:text-white mt-1">
              ${worker.hourlyRate}/hr
            </span>
          </div>

          <div className="border-l border-slate-100 dark:border-slate-800/40 col-span-1">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">COMPLETED WORKS</span>
            <span className="block text-sm font-black text-slate-900 dark:text-white mt-1">
              {worker.completedWorks} Jobs
            </span>
          </div>
        </div>

        {/* Bio Section */}
        <div className="mt-8 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
            Professional Biography
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed">
            {worker.bio}
          </p>
        </div>

        {/* Skills Section */}
        {worker.skills && worker.skills.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Core Skills & Expertise
            </h2>
            <div className="flex flex-wrap gap-2">
              {worker.skills.map((skill, index) => (
                <span key={index} className="text-xs font-bold uppercase tracking-wide bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3.5 py-1.5 rounded-xl border border-purple-500/10">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Button Strip */}
        <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="text-xs font-bold text-[#475569] dark:text-slate-400 block">Need custom work?</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Contact or hire {worker.name} directly with escrow milestones.</span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={() => onOpenMessage(worker.name)}
              className="h-11 px-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-transparent dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Direct Message</span>
            </button>
            <button
              onClick={() => {
                setShowHireForm(!showHireForm);
              }}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer shadow-md hover:scale-102"
            >
              <Award className="w-4 h-4" />
              <span>Hire {worker.name.split(' ')[0]}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Hire Form Section */}
        <AnimatePresence>
          {showHireForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleHireSubmit}
              className="mt-6 border-t border-slate-100 dark:border-slate-800/60 pt-6 overflow-hidden space-y-4"
            >
              <div className="bg-purple-500/5 dark:bg-purple-500/2 border border-purple-500/10 p-4 rounded-2xl flex items-start space-x-2 text-left mb-2">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-extrabold text-[#0F172A] dark:text-white">Direct Hire Escrow Enabled</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Funds are held safely in multi-party escrow until milestones are achieved.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="md:col-span-1 space-y-1.5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Project Title
                    </label>
                    <input 
                      type="text" 
                      required
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                      placeholder="e.g. Build Landing Page"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                      Total Budget ($)
                    </label>
                    <input 
                      type="number" 
                      required
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                      placeholder="e.g. 500"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Project Requirements / Milestones
                  </label>
                  <textarea 
                    rows={5}
                    required
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-zinc-950 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-medium"
                    placeholder="Provide details about the work, expected timeline, and milestones..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHireForm(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Send Hire Proposal'}</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
