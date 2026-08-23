import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, MapPin, Star, Bookmark, Share2, Sparkles, Send, 
  MessageSquare, CheckCircle2, ShieldCheck, Briefcase, Award, Clock,
  Calendar, Globe, ExternalLink, UserCheck, Check, Layers, ChevronRight,
  FileText, Folder, Download, Edit2
} from 'lucide-react';
import { Worker } from '../../types';
import { supabase, dbService, formatWorkerRate } from '../../lib/supabase';
import { getPublicProfileById, clearProfileCache } from '../../lib/profileService';
import { analytics } from '../../lib/analytics';
import { formatINR } from '../../lib/currency';
import { resolveReturnRoute, SESSION_STORAGE_KEYS } from '../../lib/navigation';
import UserAvatar from '../common/UserAvatar';
import HireRequestForm from '../hiring/HireRequestForm';
import ProfileReviewsSection from '../profile/ProfileReviewsSection';

interface WorkerDetailPageProps {
  workers: Worker[];
  toggleWorkerBookmark: (id: string, e: React.MouseEvent) => void;
  onOpenMessage: (name: string) => void;
  onOpenHire: (worker: Worker, e: React.MouseEvent) => void;
  triggerToast: (msg: string) => void;
  isLoggedIn?: boolean;
  onOpenAuth: (tab: 'signin' | 'signup' | 'locked') => void;
}

type PublicTabType = 'overview' | 'docs' | 'reviews' | 'about';

export default function WorkerDetailPage({
  workers,
  toggleWorkerBookmark,
  onOpenMessage,
  onOpenHire,
  triggerToast,
  isLoggedIn = false,
  onOpenAuth,
}: WorkerDetailPageProps) {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<PublicTabType>('overview');

  // Real Database Records State
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [workerDocs, setWorkerDocs] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [joinedYear, setJoinedYear] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('English');
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Hire Form State
  const [copied, setCopied] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [budget, setBudget] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loggedInId, setLoggedInId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      setAuthLoading(true);
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setLoggedInId(user.id);
          } else {
            setLoggedInId(null);
          }
        } catch {
          setLoggedInId(null);
        }
      } else {
        setLoggedInId(null);
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, [isLoggedIn, location.key]);

  useEffect(() => {
    async function fetchWorker() {
      if (!workerId) return;
      setLoading(true);
      setError(null);

      // Invalidate cache to ensure fresh details on every visit
      clearProfileCache(workerId);

      if (supabase) {
        try {
          let targetId = workerId;
          let rawWorkerData: any = null;

          // 1. Query dedicated secure view: worker_directory
          const { data: dirWorker, error: dirError } = await supabase
            .from('worker_directory')
            .select('*')
            .eq('id', workerId)
            .maybeSingle();

          if (!dirError && dirWorker) {
            rawWorkerData = dirWorker;
            targetId = dirWorker.id;
          } else {
            // 2. Fallback: Query worker_profiles directly by id
            const { data: wpData } = await supabase
              .from('worker_profiles')
              .select('*')
              .eq('id', workerId)
              .maybeSingle();

            if (wpData) {
              rawWorkerData = wpData;
              targetId = wpData.id || workerId;
            }
          }

          // Fetch canonical profile data for verified details
          const canonical = await getPublicProfileById(targetId);

          if (canonical && canonical.id) {
            const mappedWorker: Worker = {
              id: canonical.id,
              name: canonical.name || rawWorkerData?.full_name || '',
              photo: canonical.avatarUrl || rawWorkerData?.avatar_url || '',
              title: rawWorkerData?.profession || (canonical.profileType === 'worker' ? 'Service Provider' : ''),
              experience: rawWorkerData?.experience_years || 0,
              rating: 0,
              availability: rawWorkerData?.availability || 'Available Now',
              location: [canonical.city || rawWorkerData?.city, canonical.state || rawWorkerData?.state, canonical.country || rawWorkerData?.country].filter(Boolean).join(', ') || '',
              bio: canonical.bio || rawWorkerData?.bio_summary || '',
              skills: Array.isArray(rawWorkerData?.skills) ? rawWorkerData.skills : [],
              completedWorks: 0,
              hourlyRate: rawWorkerData?.hourly_rate || 0,
              verified: canonical.verified || rawWorkerData?.verification_status === 'verified',
            };

            setWorker(mappedWorker);

            // Extract Joined Date
            const rawCreatedAt = (canonical as any).created_at || (canonical as any).createdAt || rawWorkerData?.created_at;
            if (rawCreatedAt) {
              const dateObj = new Date(rawCreatedAt);
              if (!isNaN(dateObj.getTime())) {
                setJoinedYear(dateObj.getFullYear().toString());
              }
            }

            // Fetch Real Portfolio Items from Database
            const fetchedPortfolio = await dbService.getPortfolioItemsFromDb(canonical.id);
            setPortfolioItems(fetchedPortfolio || []);

            // Fetch Real Public Worker Documents
            const fetchedDocs = await dbService.getWorkerDocumentsFromDb(canonical.id, false);
            setWorkerDocs(fetchedDocs || []);

            // Fetch Real Reviews from Database
            const fetchedReviews = await dbService.getReviewsFromDb(canonical.id);
            setReviews(fetchedReviews || []);

            setLoading(false);
            return;
          }

        } catch (err) {
          console.error('[WorkerDetail Trace] Supabase fetch exception:', err);
        }
      }

      setError('Worker profile could not be found or is not public.');
      setLoading(false);
    }

    fetchWorker();

    const handleUpdate = () => {
      fetchWorker();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('opencomm:profile-updated', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('opencomm:profile-updated', handleUpdate);
      }
    };
  }, [workerId]);

  useEffect(() => {
    if (worker) {
      analytics.trackProfileViewed('worker', worker.id, worker.name);
    }
  }, [worker]);

  // Back Button Navigation
  const handleBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      const returnRoute = resolveReturnRoute(location, '/workers', SESSION_STORAGE_KEYS.SAVED_WORKERS);
      navigate(returnRoute);
    }
  };

  const handleShare = async () => {
    if (!worker) return;
    const shareUrl = window.location.href;
    const shareText = `Check out this worker profile on OpenComm: ${worker.name} (${worker.title || 'Service Provider'})!`;

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
        triggerToast('Profile link copied to clipboard!');
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
      onOpenHire(worker, e as any);
      setIsSubmitting(false);
      setShowHireForm(false);
      triggerToast(`Hire request submitted to ${worker.name}!`);
    } catch (err) {
      triggerToast('Failed to submit hire request.');
      setIsSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6 animate-pulse text-left">
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
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
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'This contractor is no longer active.'}</p>
        <button
          onClick={handleBack}
          className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Specialists</span>
        </button>
      </div>
    );
  }

  // Calculate Rating & Reviews Count
  const realRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviews.length) 
    : 0;
  const reviewsCount = reviews.length;
  const isAvailableNow = worker.availability === 'Available Now';
  const availColor = isAvailableNow ? 'bg-emerald-500' : 'bg-amber-500';

  // Ownership Check: Authenticated User ID === Canonical Worker Profile UUID
  const isOwnProfile = Boolean(loggedInId && worker?.id && loggedInId === worker.id);

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-6 px-2 sm:px-6 space-y-6 text-left pb-24 sm:pb-12" id="public-worker-profile-page">
      
      {/* Top Header: Back Button & Public Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Public Share & Save Actions */}
        <div className="flex items-center space-x-2">
          {/* Share Profile */}
          <div className="relative">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
              title="Share Profile"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {copied && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap z-20 animate-bounce">
                Copied Link!
              </div>
            )}
          </div>

          {/* Bookmark / Save Profile (Disabled for self profile) */}
          {!isOwnProfile && (
            <button
              onClick={(e) => toggleWorkerBookmark(worker.id, e)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                worker.saved 
                  ? 'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-400' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title={worker.saved ? 'Saved' : 'Save Profile'}
            >
              <Bookmark className={`w-4 h-4 ${worker.saved ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* 1. PUBLIC PROFILE HERO CARD */}
      <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xs space-y-6">
        
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 relative z-10">
          
          {/* Circular Avatar */}
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <UserAvatar
              avatarUrl={worker.photo}
              fullName={worker.name}
              size="2xl"
              className="border-3 border-white dark:border-[#111827] shadow-md bg-white dark:bg-slate-900"
            />
            <span className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#111827] ${availColor}`} />
          </div>

          {/* Identity & Header Details */}
          <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                {worker.name}
              </h1>
              {worker.verified && (
                <span className="inline-flex items-center text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/15 dark:bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 fill-current/10" />
                  Verified
                </span>
              )}
              <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isAvailableNow 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              }`}>
                ● {worker.availability}
              </span>
            </div>

            {worker.title && (
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {worker.title}
              </p>
            )}

            {/* Meta Row: Location, Experience & Joined */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
              {worker.location && (
                <div className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>{worker.location}</span>
                </div>
              )}

              {worker.experience > 0 && (
                <div className="flex items-center space-x-1">
                  <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{worker.experience} Yrs Exp</span>
                </div>
              )}

              {joinedYear && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0" />
                  <span>Member since {joinedYear}</span>
                </div>
              )}
            </div>

            {/* Short Bio Snippet */}
            {worker.bio && (
              <div className="pt-2">
                <p className={`text-xs text-slate-600 dark:text-slate-300 leading-relaxed ${isBioExpanded ? '' : 'line-clamp-2'}`}>
                  {worker.bio}
                </p>
                {worker.bio.length > 120 && (
                  <button
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="text-[11px] font-bold text-purple-600 dark:text-purple-400 mt-1 cursor-pointer hover:underline"
                  >
                    {isBioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Public Hero Action Buttons */}
        <div className="pt-3 border-t border-purple-500/10 flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="text-left text-xs font-bold text-slate-700 dark:text-slate-300 hidden sm:block">
            <span>Rate / Salary: <strong className="text-purple-600 dark:text-purple-400">{formatWorkerRate(worker)}</strong></span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {isOwnProfile ? (
              <button
                onClick={() => navigate(`/profile?edit=true&returnTo=/workers/${worker.id}`, { state: { openEdit: true, returnTo: `/workers/${worker.id}` } })}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer shadow-xs transition-all hover:scale-102"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    onOpenAuth('locked');
                    return;
                  }
                  setShowHireForm(!showHireForm);
                }}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center space-x-1.5 flex-1 sm:flex-initial cursor-pointer shadow-xs transition-all hover:scale-102"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Hire</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Hire Form */}
        <AnimatePresence>
          {showHireForm && worker && (
            <HireRequestForm
              worker={worker}
              onClose={() => setShowHireForm(false)}
              triggerToast={triggerToast}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 2. PUBLIC STATISTICS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 p-3.5 rounded-2xl text-center shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">COMPLETED JOBS</span>
          <div className="flex items-center justify-center mt-1 text-sm font-extrabold text-slate-900 dark:text-white space-x-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>{worker.completedWorks || 0}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 p-3.5 rounded-2xl text-center shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">RATING</span>
          <div className="flex items-center justify-center mt-1 text-sm font-extrabold text-slate-900 dark:text-white space-x-1">
            <Star className="w-4 h-4 text-amber-500 fill-current" />
            <span>{realRating > 0 ? realRating.toFixed(1) : 'New'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 p-3.5 rounded-2xl text-center shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">REVIEWS</span>
          <div className="flex items-center justify-center mt-1 text-sm font-extrabold text-slate-900 dark:text-white space-x-1">
            <MessageSquare className="w-4 h-4 text-purple-500" />
            <span>{reviewsCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 p-3.5 rounded-2xl text-center shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-wider">EXPERIENCE</span>
          <div className="flex items-center justify-center mt-1 text-sm font-extrabold text-slate-900 dark:text-white space-x-1">
            <Award className="w-4 h-4 text-blue-500" />
            <span>{worker.experience > 0 ? `${worker.experience} yrs` : 'New'}</span>
          </div>
        </div>
      </div>

      {/* 3. PROFILE NAVIGATION TABS */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-2xl p-1.5 flex items-center justify-around shadow-xs overflow-x-auto">
        {(['overview', 'docs', 'reviews', 'about'] as PublicTabType[]).map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<PublicTabType, string> = {
            overview: 'Overview',
            docs: `Job Application Docs (${workerDocs.length})`,
            reviews: `Reviews (${reviewsCount})`,
            about: 'About'
          };

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer capitalize text-center border-b-2 ${
                isActive 
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/30' 
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 4. TAB CONTENTS */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449]/40 rounded-3xl p-5 sm:p-7 shadow-xs">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 text-left">
            
            {/* Bio / Summary */}
            {worker.bio && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Professional Summary
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {worker.bio}
                </p>
              </div>
            )}

            {/* Core Skills */}
            {worker.skills && worker.skills.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                  Core Skills & Expertise
                </h3>
                <div className="flex flex-wrap gap-2">
                  {worker.skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-3 py-1 rounded-xl border border-purple-500/15"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Service & Rate Details Table */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                Key Professional Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Rate / Salary</span>
                  <span className="font-extrabold text-purple-600 dark:text-purple-400">
                    {formatWorkerRate(worker)}
                  </span>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Availability</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {worker.availability}
                  </span>
                </div>

                {worker.location && (
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Location</span>
                    <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[180px]">
                      {worker.location}
                    </span>
                  </div>
                )}

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Working Language</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {preferredLanguage}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* JOB APPLICATION DOCS TAB */}
        {activeTab === 'docs' && (
          <div className="space-y-4 text-left">
            {workerDocs.length === 0 ? (
              <div className="bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">No job application documents shared</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    This professional has not added any public portfolio, CV, or resume documents yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {workerDocs.map((doc) => (
                  <div 
                    key={doc.id}
                    className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
                          {doc.document_type === 'CV' || doc.document_type === 'Resume' ? (
                            <FileText className="w-5 h-5" />
                          ) : (
                            <Folder className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">{doc.title}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {doc.document_type}
                            </span>
                          </div>
                          {doc.file_name && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{doc.file_name} {doc.file_size ? `• ${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` : ''}</p>
                          )}
                        </div>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed line-clamp-2">{doc.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {doc.external_url && (
                        <a
                          href={doc.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs flex items-center space-x-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Link</span>
                        </a>
                      )}
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          download={doc.file_name || true}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <ProfileReviewsSection
            profileId={worker.id}
            fullName={worker.name}
            triggerToast={triggerToast}
          />
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <div className="space-y-5 text-left">
            <div className="space-y-2">
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                Full Professional Biography
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {worker.bio || 'No expanded biography provided.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                Public Account & Service Verification
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Verification Status</span>
                  <span className={`font-extrabold ${worker.verified ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500'}`}>
                    {worker.verified ? 'Verified Specialist' : 'Standard Account'}
                  </span>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Primary Location</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {worker.location || 'Not specified'}
                  </span>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Member Since</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {joinedYear ? `Year ${joinedYear}` : 'Active Member'}
                  </span>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Availability</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {worker.availability}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
