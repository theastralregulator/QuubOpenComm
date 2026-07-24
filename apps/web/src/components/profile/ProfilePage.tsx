import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, MapPin, Briefcase, Calendar, Edit2,
  BadgeCheck, ShieldAlert, Lock, Globe, Star, X, Camera, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Activity, Job, Worker, Message, JobApplication, ApplicationMessage, Conversation } from '../../types';
import { dbService, LocalProfile, LocalWorkerProfile, LocalCompanyProfile } from '../../lib/supabase';
import { analytics } from '../../lib/analytics';

interface ProfilePageProps {
  username: string;
  setUsername: (name: string) => void;
  userPhoto: string;
  setUserPhoto: (url: string) => void;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  triggerToast: (msg: string) => void;
  jobs: Job[];
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  applications: JobApplication[];
  setApplications: React.Dispatch<React.SetStateAction<JobApplication[]>>;
  appMessages: ApplicationMessage[];
  setAppMessages: React.Dispatch<React.SetStateAction<ApplicationMessage[]>>;
  setCurrentView: (view: string) => void;
  setShowPostJob: (show: boolean) => void;
  setShowCreateProfile: (show: boolean) => void;
  isLoggedIn?: boolean;
  userType?: 'normal' | 'worker' | 'company';
  setUserType?: (type: 'normal' | 'worker' | 'company') => void;
  onLogout?: () => void;
  isEmailVerified?: boolean;
  requireEmailVerification?: (action: string, onVerified: () => void) => void;
}

export const BUILTIN_BANNERS = [
  // 1-3 Blue Gradients
  { id: 'banner_01', name: 'Ocean Mist', category: 'blue gradients', class: 'bg-gradient-to-r from-blue-600/20 via-indigo-500/10 to-purple-600/20 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-purple-950/50' },
  { id: 'banner_02', name: 'Deep Sea', category: 'blue gradients', class: 'bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-indigo-700/20 dark:from-cyan-950/50 dark:via-blue-950/50 dark:to-indigo-950/50' },
  { id: 'banner_03', name: 'Skyward', category: 'blue gradients', class: 'bg-gradient-to-r from-sky-400/20 via-blue-500/15 to-indigo-500/25 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-indigo-950/50' },

  // 4-6 Purple Gradients
  { id: 'banner_04', name: 'Sunset Orchid', category: 'purple gradients', class: 'bg-gradient-to-r from-fuchsia-600/20 via-purple-600/15 to-pink-500/20 dark:from-fuchsia-950/40 dark:via-purple-950/40 dark:to-pink-950/40' },
  { id: 'banner_05', name: 'Cosmic Nebula', category: 'purple gradients', class: 'bg-gradient-to-r from-purple-800/25 via-indigo-700/15 to-violet-900/25 dark:from-purple-950/60 dark:via-indigo-950/40 dark:to-violet-950/60' },
  { id: 'banner_06', name: 'Neon Dusk', category: 'purple gradients', class: 'bg-gradient-to-r from-violet-600/20 via-fuchsia-500/10 to-purple-800/20 dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-purple-950/50' },

  // 7-9 Dark Professional
  { id: 'banner_07', name: 'Obsidian Gold', category: 'dark professional', class: 'bg-gradient-to-r from-neutral-900/90 via-amber-500/10 to-neutral-900/90 border-b border-amber-500/10 dark:from-neutral-950 dark:via-amber-500/5' },
  { id: 'banner_08', name: 'Midnight Slate', category: 'dark professional', class: 'bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 dark:from-slate-950 dark:via-slate-900' },
  { id: 'banner_09', name: 'Carbon Fiber', category: 'dark professional', class: 'bg-gradient-to-r from-neutral-950 via-zinc-900 to-neutral-950 dark:from-black dark:via-neutral-950' },

  // 10-12 Abstract Technology
  { id: 'banner_10', name: 'Cyber Grid', category: 'abstract technology', class: 'bg-gradient-to-r from-teal-500/15 via-indigo-600/15 to-emerald-500/15 dark:from-teal-950/40 dark:via-indigo-950/40 dark:to-emerald-950/40' },
  { id: 'banner_11', name: 'Digital Matrix', category: 'abstract technology', class: 'bg-gradient-to-r from-emerald-600/20 via-zinc-900/80 to-teal-600/20 dark:from-emerald-950/40 dark:via-zinc-950 dark:to-teal-950/40' },
  { id: 'banner_12', name: 'Quantum Core', category: 'abstract technology', class: 'bg-gradient-to-r from-blue-700/20 via-purple-600/25 to-pink-600/15 dark:from-blue-950/50 dark:via-purple-950/50 dark:to-pink-950/40' },

  // 13-15 Construction
  { id: 'banner_13', name: 'Steel Girder', category: 'construction', class: 'bg-gradient-to-r from-zinc-500/20 via-orange-500/10 to-zinc-600/20 dark:from-zinc-800/40 dark:via-orange-950/30' },
  { id: 'banner_14', name: 'Safety Stripe', category: 'construction', class: 'bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-stone-600/20 dark:from-amber-950/30' },
  { id: 'banner_15', name: 'Concrete Slab', category: 'construction', class: 'bg-gradient-to-r from-neutral-300/40 via-neutral-400/30 to-stone-400/40 dark:from-neutral-800/40' },

  // 16-18 Electrical
  { id: 'banner_16', name: 'High Voltage', category: 'electrical', class: 'bg-gradient-to-r from-yellow-500/25 via-amber-600/15 to-neutral-900/30 dark:from-yellow-950/40' },
  { id: 'banner_17', name: 'Copper Coil', category: 'electrical', class: 'bg-gradient-to-r from-orange-600/20 via-amber-500/10 to-red-600/15 dark:from-orange-950/40' },
  { id: 'banner_18', name: 'Circuit Spark', category: 'electrical', class: 'bg-gradient-to-r from-cyan-400/25 via-indigo-600/20 to-neutral-900/40 dark:from-cyan-950/50' },

  // 19-21 Design
  { id: 'banner_19', name: 'Bauhaus Red', category: 'design', class: 'bg-gradient-to-r from-rose-500/20 via-stone-200/50 to-amber-500/10 dark:from-rose-950/40' },
  { id: 'banner_20', name: 'Pastel Craft', category: 'design', class: 'bg-gradient-to-r from-pink-300/30 via-purple-300/20 to-cyan-200/40 dark:from-pink-900/20' },
  { id: 'banner_21', name: 'Minimalist Line', category: 'design', class: 'bg-gradient-to-r from-indigo-50/50 via-slate-100 to-blue-50/50 dark:from-[#111827] dark:to-[#1e293b]' },

  // 22-24 Software
  { id: 'banner_22', name: 'Binary Sea', category: 'software', class: 'bg-gradient-to-r from-indigo-900/40 via-blue-800/20 to-teal-900/45 dark:from-indigo-950 dark:to-teal-950' },
  { id: 'banner_23', name: 'Terminal Green', category: 'software', class: 'bg-gradient-to-r from-emerald-500/10 via-[#0b0d12] to-stone-900 dark:from-emerald-950/40' },
  { id: 'banner_24', name: 'Syntax Violet', category: 'software', class: 'bg-gradient-to-r from-violet-700/25 via-[#111827] to-fuchsia-800/20 dark:from-violet-950/50' },

  // 25-27 Business
  { id: 'banner_25', name: 'Corporate Sky', category: 'business', class: 'bg-gradient-to-r from-[#1E3A8A]/20 via-[#2563EB]/10 to-[#3B82F6]/15 dark:from-blue-950/50' },
  { id: 'banner_26', name: 'Golden Hour', category: 'business', class: 'bg-gradient-to-r from-amber-600/15 via-yellow-500/10 to-orange-500/15 dark:from-amber-950/30' },
  { id: 'banner_27', name: 'Premium Teal', category: 'business', class: 'bg-gradient-to-r from-teal-700/20 via-slate-800 to-indigo-900/25 dark:from-teal-950/50' },

  // 28-30 Minimal
  { id: 'banner_28', name: 'Pure Chalk', category: 'minimal', class: 'bg-slate-100 dark:bg-zinc-800/50 border-b border-slate-200/40' },
  { id: 'banner_29', name: 'Warm Grain', category: 'minimal', class: 'bg-gradient-to-r from-stone-100 via-orange-50/30 to-stone-200/50 dark:from-stone-900/40' },
  { id: 'banner_30', name: 'Silent Gray', category: 'minimal', class: 'bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200/10' }
];

export const getBannerClass = (bannerId?: string) => {
  const found = BUILTIN_BANNERS.find(b => b.id === bannerId);
  return found ? found.class : BUILTIN_BANNERS[0].class;
};

interface ContactRequest {
  id: string;
  requesterName: string;
  requesterPhoto: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

export default function ProfilePage({
  username,
  setUsername,
  userPhoto,
  setUserPhoto,
  activities,
  setActivities,
  triggerToast,
  jobs,
  workers,
  messages,
  setCurrentView,
  setShowCreateProfile,
  isLoggedIn = false,
  userType = 'normal',
  setUserType,
  onLogout,
  isEmailVerified = true,
  requireEmailVerification,
}: ProfilePageProps) {
  // --- DATABASE STATES ---
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [workerProfile, setWorkerProfile] = useState<LocalWorkerProfile | null>(null);
  const [companyProfile, setCompanyProfile] = useState<LocalCompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'skills' | 'reviews'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  
  // Company modal and setup states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  
  const [emailVisible, setEmailVisible] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);

  // Connection Requests simulation
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([
    { id: 'req-1', requesterName: 'Rahul Sharma', requesterPhoto: 'https://api.dicebear.com/7.x/notionists/svg?seed=Rahul', reason: 'Discuss local app development contract escrow setup.', status: 'Pending', timestamp: '2 hours ago' },
    { id: 'req-2', requesterName: 'Emily Chen', requesterPhoto: 'https://api.dicebear.com/7.x/notionists/svg?seed=Emily', reason: 'Full-time carpentry trim renovation collaboration.', status: 'Approved', timestamp: 'Yesterday' }
  ]);

  // Edit fields temp buffers
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editLang, setEditLang] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBannerId, setEditBannerId] = useState('banner_01');

  const loggedInId = localStorage.getItem('opencomm_user_id') || 'user-demo-id';

  // --- REFRESH PROFILE DATA ON LOAD OR ACTIONS ---
  const loadProfileData = async () => {
    if (!isLoggedIn) {
      setProfile(null);
      setWorkerProfile(null);
      setCompanyProfile(null);
      return;
    }
    setLoading(true);
    setErrorState(null);
    try {
      const p = await dbService.getProfile(loggedInId);
      if (p) {
        setProfile(p);
        
        // Sync global app header states
        if (p.full_name && p.full_name !== username) {
          setUsername(p.full_name);
        }
        if (p.avatar_url && p.avatar_url !== userPhoto) {
          setUserPhoto(p.avatar_url);
        }
        if (setUserType && p.profile_type !== userType) {
          setUserType(p.profile_type as any || 'normal');
        }

        if (p.profile_type === 'worker') {
          const w = await dbService.getWorkerProfile(loggedInId);
          setWorkerProfile(w);
        } else if (p.profile_type === 'company') {
          const c = await dbService.getCompanyProfile(loggedInId);
          setCompanyProfile(c);
        }
      } else {
        // Construct fallback local object
        const fallback: LocalProfile = {
          id: loggedInId,
          full_name: username,
          username: username.toLowerCase().replace(/\s+/g, ''),
          avatar_url: userPhoto,
          bio: '',
          phone: '',
          phone_verified: false,
          email: '',
          city: '',
          state: '',
          country: '',
          preferred_language: '',
          account_status: 'active',
          profile_type: 'basic',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_verified_for_actions: isEmailVerified
        };
        setProfile(fallback);
      }
    } catch (err: any) {
      console.error("Error fetching matching profiles row:", err);
      setErrorState(err.message || "Failed to load actual stored values from public.profiles table.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
    analytics.trackProfileViewed('own', loggedInId, username || 'Own User');
  }, [isLoggedIn, loggedInId, userType]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await dbService.updateProfile(loggedInId, {
        full_name: editName,
        bio: editBio,
        city: editCity,
        state: editState,
        country: editCountry,
        preferred_language: editLang,
        email: editEmail,
        phone: editPhone,
        banner_id: editBannerId
      });
      setProfile(updated);
      setUsername(editName);
      setIsEditing(false);
      triggerToast('Profile metadata updated and transmitted successfully.');
      
      // Add activity log
      const newAct: Activity = {
        id: `act-edit-${Date.now()}`,
        type: 'complete',
        title: 'Updated Profile Metadata',
        status: 'Synced Successfully',
        statusType: 'success',
        timestamp: 'Just now'
      };
      setActivities(prev => [newAct, ...prev]);
    } catch (err: any) {
      triggerToast(err.message || "Failed to save profile changes.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = () => {
    if (profile) {
      setEditName(profile.full_name || username || '');
      setEditBio(profile.bio || '');
      setEditCity(profile.city || '');
      setEditState(profile.state || '');
      setEditCountry(profile.country || '');
      setEditLang(profile.preferred_language || '');
      setEditEmail(profile.email || '');
      setEditPhone(profile.phone || '');
      setEditBannerId(profile.banner_id || 'banner_01');
    } else {
      setEditName(username || '');
      setEditBio('');
      setEditCity('');
      setEditState('');
      setEditCountry('');
      setEditLang('');
      setEditEmail('');
      setEditPhone('');
      setEditBannerId('banner_01');
    }
    setIsEditing(true);
  };

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyLegalName.trim() || !companyIndustry.trim()) {
      triggerToast("Please provide both company legal name and industry.");
      return;
    }
    
    setLoading(true);
    try {
      await dbService.createCompanyProfile({
        id: loggedInId,
        name: companyLegalName,
        logo_url: userPhoto,
        industry: companyIndustry,
        description: `Verified business operating in ${companyIndustry}. Committed to high-quality professional cooperation on OpenComm.`,
        city: profile?.city || 'Austin',
        state: profile?.state || 'TX',
        country: profile?.country || 'USA',
        verified: true
      });

      // Track successful company profile creation in Google Analytics
      analytics.trackEmployerProfileCreated({
        name: companyLegalName,
        city: profile?.city || 'Austin',
        state: profile?.state || 'TX'
      });

      if (setUserType) {
        setUserType('company');
      }
      
      // Add activity log
      const newAct: Activity = {
        id: `act-comp-${Date.now()}`,
        type: 'complete',
        title: `Created Verified Company Profile: "${companyLegalName}"`,
        status: 'VERIFIED BUSINESS Active',
        statusType: 'success',
        timestamp: 'Just now'
      };
      setActivities(prev => [newAct, ...prev]);
      
      setShowCompanyModal(false);
      triggerToast("Verified Business Profile successfully created!");
      await loadProfileData();
    } catch (err: any) {
      triggerToast(err.message || "Failed to create corporate profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = (id: string, requester: string) => {
    setContactRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
    triggerToast(`Approved connection request from ${requester}. Contacts unlocked.`);
  };

  const handleDeclineRequest = (id: string, requester: string) => {
    setContactRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
    triggerToast(`Declined request from ${requester}.`);
  };

  // --- LOCATION PRETTIER STRING BUILDER ---
  const locationParts = [profile?.city, profile?.state, profile?.country].filter(Boolean);
  const formattedLocation = locationParts.join(', ');

  // --- JOINED YEAR ---
  const joinedYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2 sm:py-6 px-1 text-slate-800 dark:text-slate-100">
      
      {/* 1. GUEST GATEWAY BANNER (If not logged in) */}
      {!isLoggedIn && (
        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-indigo-500/15 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>👤</span>
              <span>Browsing OpenComm Workspace as Guest</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Create a personalized account to establish your profile, save bookmarks, post work, and connect with other professional members on the marketplace.
            </p>
          </div>
          <button 
            onClick={() => setCurrentView('home')}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-transform duration-200 hover:scale-102 self-start md:self-auto"
          >
            Go to Welcome Hub
          </button>
        </div>
      )}

      {/* LOADING STATE OR FRIENDLY RETRY STATE */}
      {loading && !profile && (
        <div className="p-12 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto" />
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">Retrieving public.profiles row...</p>
        </div>
      )}

      {errorState && (
        <div className="p-8 text-center bg-rose-500/5 border border-rose-500/15 rounded-3xl space-y-4 text-left">
          <h3 className="text-sm font-bold text-rose-500">Database Synchronization Blocked</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
            {errorState}
          </p>
          <button 
            onClick={loadProfileData}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* 2. MAIN HEADER CARD */}
      {(!loading || profile) && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm relative text-left">
          {/* Decorative backdrop mesh */}
          <div className={`h-32 sm:h-36 transition-all ${getBannerClass(profile?.banner_id)}`} />
          
          <div className="px-6 pb-6 relative">
            {/* Avatar overlap */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-16 mb-4 gap-4">
              <div className="relative group self-start">
                <img 
                  src={profile?.avatar_url || userPhoto} 
                  alt={profile?.full_name || username} 
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white dark:border-[#111827] shadow-lg bg-slate-100"
                />
                {isLoggedIn && (
                  <button 
                    onClick={async () => {
                      const nextPhoto = prompt("Enter a valid image URL to update your photo:", profile?.avatar_url || userPhoto);
                      if (nextPhoto) {
                        try {
                          await dbService.updateProfile(loggedInId, { avatar_url: nextPhoto });
                          setUserPhoto(nextPhoto);
                          triggerToast("Profile picture updated in database.");
                          await loadProfileData();
                        } catch (err: any) {
                          triggerToast(err.message || "Failed to update profile photo.");
                        }
                      }
                    }}
                    className="absolute bottom-1 right-1 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full transition-all cursor-pointer border border-white/20"
                    title="Update profile photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Profile CTAs */}
              {isLoggedIn && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleOpenEdit}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>

                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="px-4 py-2 border border-rose-500/20 hover:bg-rose-500/5 text-rose-500 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Logout
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Identity details */}
            <div className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {profile?.full_name || username}
                  </h1>

                  {/* Public verification tag (Only shown for worker or company, NOT shown for basic accounts) */}
                  {profile && profile.profile_type !== 'basic' && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-extrabold border border-blue-500/10 font-mono">
                      <CheckCircle2 className="w-3 h-3 mr-0.5 fill-current shrink-0" />
                      {profile.profile_type === 'worker' ? 'CERTIFIED CONTRACTOR' : 'VERIFIED BUSINESS'}
                    </span>
                  )}
                  
                  {isLoggedIn && profile?.profile_type === 'worker' && workerProfile?.availability && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono border ${
                      workerProfile.availability === 'Available Now' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15'
                        : workerProfile.availability === 'Part-time'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15'
                        : 'bg-slate-500/10 text-slate-600 border-slate-500/15'
                    }`}>
                      ● {workerProfile.availability}
                    </span>
                  )}
                </div>
                
                {/* Designation title (Only shown for worker or company, NOT shown for basic account) */}
                {profile && profile.profile_type !== 'basic' && (
                  <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 font-mono uppercase tracking-wider">
                    {profile.profile_type === 'worker' 
                      ? (workerProfile?.profession || 'Certified Contractor Specialist') 
                      : (companyProfile?.name || 'Managing Partner / Project Director')}
                  </p>
                )}
              </div>

              {/* Bio summary: Hide completely if empty or null */}
              {profile?.bio && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-normal">
                  {profile.bio}
                </p>
              )}

              {/* Meta details footer: Hide individual fields if empty */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
                {formattedLocation && (
                  <span className="flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" /> 
                    {formattedLocation}
                  </span>
                )}
                {joinedYear && (
                  <span className="flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" /> 
                    Joined OpenComm in {joinedYear}
                  </span>
                )}
                {profile?.preferred_language && (
                  <span className="flex items-center">
                    <Globe className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" /> 
                    Language: {profile.preferred_language}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT OPTIONS (Shown to Basic Users to offer profile updates) */}
      {isLoggedIn && profile?.profile_type === 'basic' && (
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl text-left space-y-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Account Options</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Complete your basic profile details, create a worker profile to offer your services, or set up a company profile.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Upgrade Action 1: Basic Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">👤</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Profile</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Edit Profile Details</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Configure your bio, name, phone contact details, or active region.</p>
              </div>
              <button
                onClick={handleOpenEdit}
                className="w-full py-2 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors text-center"
              >
                Complete Basic Profile
              </button>
            </div>

            {/* Upgrade Action 2: Worker Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">🛠️</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Worker</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Become a Worker</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                  Register as a worker to receive job matches and submit proposals to clients.
                </p>
              </div>
              <button
                onClick={() => {
                  if (setShowCreateProfile) {
                    setShowCreateProfile(true);
                  } else {
                    triggerToast("Please click the Create Profile action in the primary dashboard.");
                  }
                }}
                className="w-full py-2 bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl text-[10px] font-bold cursor-pointer transition-all text-center"
              >
                Become a Worker
              </button>
            </div>

            {/* Upgrade Action 3: Company Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">🏢</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Company</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Company Profile</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                  Flesh out company name and business sector to unlock business options.
                </p>
              </div>
              <button
                onClick={() => {
                  if (requireEmailVerification) {
                    requireEmailVerification("Create Company Profile", () => {
                      setShowCompanyModal(true);
                    });
                  } else {
                    setShowCompanyModal(true);
                  }
                }}
                className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-bold cursor-pointer transition-all text-center"
              >
                Create Company Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PROFILE SUB-TABS NAVIGATION (Only displayed for Worker/Company accounts; hidden for Basic accounts) */}
      {isLoggedIn && profile && profile.profile_type !== 'basic' && (
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-left">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'experience', label: 'Work History', icon: Briefcase },
            { id: 'skills', label: 'Expertise & Badges', icon: BadgeCheck },
            { id: 'reviews', label: 'Milestone Feedback', icon: Star }
          ].filter(tab => {
            if (profile.profile_type === 'company' && (tab.id === 'experience' || tab.id === 'skills')) {
              return false;
            }
            return true;
          }).map((tab) => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-[#1E293B] text-[#7C3AED] dark:text-purple-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. DETAILS ROW LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        
        {/* COLUMN LEFT: Tab Contents */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="tab-overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Professional Summary Card */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Professional Summary</h3>
                  </div>
                  <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 space-y-3">
                    <p className="leading-relaxed">
                      {profile?.bio || "No professional overview bio has been configured yet. Modify your account metadata to introduce yourself to other members on the marketplace."}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 font-mono text-[10px]">
                      <div className="space-y-1">
                        <span className="text-slate-400 dark:text-slate-500 uppercase font-bold block">Preferred Language</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs">{profile?.preferred_language || 'Not Specified'}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-slate-400 dark:text-slate-500 uppercase font-bold block">Account Tier</span>
                        <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs capitalize">{profile?.profile_type || 'Basic'} Member</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* EXPERIENCE TAB (Worker profiles only) */}
            {activeTab === 'experience' && profile?.profile_type === 'worker' && (
              <motion.div 
                key="tab-experience"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-5"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Employment & Milestones Timeline</h3>
                </div>

                <div className="relative border-l border-slate-200 dark:border-slate-800 pl-4 ml-2 space-y-6 text-xs text-left">
                  <div className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-white dark:ring-[#111827]" />
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{workerProfile?.profession || 'Independent Specialist'}</h4>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono mt-0.5">Active Contractor &bull; {workerProfile?.experience_years || 5}+ Years Experience</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {workerProfile?.bio_summary || 'Overseeing high-quality local deliverables, managing milestone checks, and coordinating client approvals.'}
                    </p>
                  </div>
                  
                  {workerProfile?.hourly_rate && (
                    <div className="relative pt-2">
                      <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-400 font-mono">Hourly Billing Rate:</span>
                        <span className="text-xs font-bold font-mono text-[#7C3AED] dark:text-purple-400 bg-indigo-500/5 px-2 py-0.5 rounded-md">${workerProfile.hourly_rate}/hr</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* SKILLS TAB (Worker profiles only) */}
            {activeTab === 'skills' && profile?.profile_type === 'worker' && (
              <motion.div 
                key="tab-skills"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-6"
              >
                <div>
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-3">Core Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {workerProfile?.skills && workerProfile.skills.length > 0 ? (
                      workerProfile.skills.map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3.5 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 text-[11px] font-mono font-medium text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/10"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      ['Project Planning', 'Task Coordination', 'Communications', 'Quality Review'].map((skill, index) => (
                        <span 
                          key={index} 
                          className="px-3.5 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 text-[11px] font-mono font-medium text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/10"
                        >
                          {skill}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono mb-3">Verified Certifications</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center space-x-3 p-3 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                      <BadgeCheck className="w-5 h-5 text-purple-500 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-white block">OpenComm Certified Expert</strong>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Issued January 2026 &bull; Verified ID: OC-8023-A</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && profile?.profile_type !== 'basic' && (
              <motion.div 
                key="tab-reviews"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Milestone Review Feed</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Rahul S.</span>
                      <div className="flex text-amber-400 space-x-0.5">
                        {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 italic font-normal leading-relaxed">
                      "Extremely dedicated partner. Placed milestone funds, approved immediately as work was reviewed, and kept excellent open logs. Will definitely continue business here."
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* COLUMN RIGHT: Verification & System Status */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-xs text-left">
            <div className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Verification Status</h3>
            </div>
            
            <div className="space-y-3 text-xs">
              {isEmailVerified ? (
                <div className="flex items-start space-x-3 p-3.5 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">Verified Account</strong>
                    <span className="text-slate-500 dark:text-slate-400 leading-normal">Your profile email has been fully verified and is currently ready to securely message and collaborate with other members.</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3 p-3.5 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                  <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <strong className="text-slate-900 dark:text-white font-bold block mb-0.5 text-amber-600 dark:text-amber-400">Email Verification Pending</strong>
                    <p className="mb-3 text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                      Your email has not been verified. Verify your email to unlock all secure interactions like sending milestone bids or revealing contacts.
                    </p>
                    {requireEmailVerification && (
                      <button
                        type="button"
                        onClick={() => requireEmailVerification('Verify profile details', () => {})}
                        className="w-full px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                      >
                        Verify Now
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* COMPANY PROFILE MODAL */}
      <AnimatePresence>
        {showCompanyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCompanyModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Create Company Profile</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Verify your corporate identity</p>
                </div>
                <button
                  onClick={() => setShowCompanyModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCompanyProfile} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-mono">Company Legal Name</label>
                  <input
                    type="text"
                    required
                    value={companyLegalName}
                    onChange={(e) => setCompanyLegalName(e.target.value)}
                    placeholder="e.g. Acme Trim & Carpentry Inc."
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-mono">Business Industry / Sector</label>
                  <input
                    type="text"
                    required
                    value={companyIndustry}
                    onChange={(e) => setCompanyIndustry(e.target.value)}
                    placeholder="e.g. Residential Carpentry & General Construction"
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>

                <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-3 flex gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Verified Business Badge Active</p>
                    <p className="text-[9px] text-slate-400 leading-normal">Saving this profile will flag your workspace with our gold VERIFIED BUSINESS badge across OpenComm, establishing trust.</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowCompanyModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-[10px] cursor-pointer hover:opacity-95 shadow-md shadow-blue-500/10 transition-all"
                  >
                    Create Company Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. EDIT MODAL OVERLAY */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl text-left"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-wider font-mono">Modify Account Meta</span>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Full Profile Name</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">City</label>
                    <input 
                      type="text" 
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="Kochi"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">State</label>
                    <input 
                      type="text" 
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="Kerala"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Country</label>
                    <input 
                      type="text" 
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="India"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Preferred Language</label>
                    <input 
                      type="text" 
                      value={editLang}
                      onChange={(e) => setEditLang(e.target.value)}
                      placeholder="English"
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Private Phone</label>
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Private Email</label>
                  <input 
                    type="email" 
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                  />
                </div>

                {/* Built-in Banner Picker */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Select Built-in Profile Banner (30 Choices)</label>
                  <div className="grid grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl scrollbar-thin">
                    {BUILTIN_BANNERS.map((banner) => (
                      <button
                        key={banner.id}
                        type="button"
                        onClick={() => setEditBannerId(banner.id)}
                        className={`group relative h-12 rounded-lg overflow-hidden border-2 text-left p-1.5 transition-all ${
                          editBannerId === banner.id
                            ? 'border-indigo-600 ring-2 ring-indigo-600/10 scale-[1.02]'
                            : 'border-transparent hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className={`absolute inset-0 ${banner.class}`} />
                        <div className="absolute inset-0 bg-black/5 dark:bg-black/10 group-hover:bg-transparent transition-colors" />
                        <div className="relative z-10 h-full flex flex-col justify-end">
                          <span className="text-[8px] font-black font-sans text-slate-900 dark:text-white drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate max-w-full">
                            {banner.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Bio / Summary</label>
                  <textarea 
                    rows={3}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-rose-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
