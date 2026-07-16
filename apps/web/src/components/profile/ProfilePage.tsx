import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, MapPin, Briefcase, Calendar, Edit2, Check,
  Activity as ActivityIcon, Clock, BadgeCheck, Settings, ShieldAlert,
  Share2, Eye, Plus, Trash2, MessageSquare, Lock, Globe, Star, Shield, 
  Camera, ChevronRight, X, Heart, ExternalLink, CheckCircle2, ShieldCheck, LogOut
} from 'lucide-react';
import { Activity, Job, Worker, Message, JobApplication, ApplicationMessage, Conversation } from '../../types';

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
}

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
  onLogout
}: ProfilePageProps) {
  // --- SUB-STATES ---
  const [activeTab, setActiveTab] = useState<'overview' | 'experience' | 'skills' | 'reviews'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  
  // Company modal and setup states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');
  
  // Profile Fields (Synced with Owner details)
  const [userTitle, setUserTitle] = useState(() => {
    if (userType === 'worker') return 'Certified Contractor Specialist';
    if (userType === 'company') return 'Managing Partner / Project Director';
    return 'Premium Client Member';
  });
  const [userBio, setUserBio] = useState('Committed to professional collaborations with milestone-based escrows. Focused on top-tier local craftsmanship and transparent contract structures.');
  const [userEmail, setUserEmail] = useState('akhil.v@opencomm.io');
  const [userPhone, setUserPhone] = useState('+1 (512) 808-3294');
  const [userLoc, setUserLoc] = useState('Austin, TX, USA');
  const [availabilityStatus, setAvailabilityStatus] = useState<'Available Now' | 'Part-time' | 'Busy'>('Available Now');
  const [emailVisible, setEmailVisible] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);

  // Connection Requests simulation ( राहुल शर्मा and एमिली चेन )
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([
    { id: 'req-1', requesterName: 'Rahul Sharma', requesterPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80', reason: 'Discuss local app development contract escrow setup.', status: 'Pending', timestamp: '2 hours ago' },
    { id: 'req-2', requesterName: 'Emily Chen', requesterPhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80', reason: 'Full-time carpentry trim renovation collaboration.', status: 'Approved', timestamp: 'Yesterday' }
  ]);

  // Edit fields temp buffer
  const [editName, setEditName] = useState(username);
  const [editTitle, setEditTitle] = useState(userTitle);
  const [editLoc, setEditLoc] = useState(userLoc);
  const [editBio, setEditBio] = useState(userBio);
  const [editEmail, setEditEmail] = useState(userEmail);
  const [editPhone, setEditPhone] = useState(userPhone);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUsername(editName);
    setUserTitle(editTitle);
    setUserLoc(editLoc);
    setUserBio(editBio);
    setUserEmail(editEmail);
    setUserPhone(editPhone);
    setIsEditing(false);
    
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
    triggerToast('Profile updated and transmitted successfully.');
  };

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyLegalName.trim() || !companyIndustry.trim()) {
      triggerToast("Please provide both company legal name and industry.");
      return;
    }
    
    if (setUserType) {
      setUserType('company');
    }
    setUserTitle(`Managing Partner at ${companyLegalName}`);
    setUserBio(`Verified corporate entity operating in ${companyIndustry}. Committed to escrow-secured professional arrangements on OpenComm.`);
    
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
  };

  const handleApproveRequest = (id: string, requester: string) => {
    setContactRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Approved' } : r));
    triggerToast(`Approved connection request from ${requester}. Contacts unlocked.`);
  };

  const handleDeclineRequest = (id: string, requester: string) => {
    setContactRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'Rejected' } : r));
    triggerToast(`Declined request from ${requester}.`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2 sm:py-6 px-1">
      
      {/* 1. GUEST GATEWAY BANNER (If not logged in) */}
      {!isLoggedIn && (
        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/30 border border-indigo-500/15 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>👤</span>
              <span>Browsing OpenComm Workspace as Guest</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Create a personalized, certified account to establish a professional identity, save bookmarks, post work, and unlock secure escrow-protected contracts.
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

      {/* 2. MAIN HEADER CARD */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm relative text-left">
        {/* Decorative backdrop mesh */}
        <div className="h-32 sm:h-36 bg-gradient-to-r from-blue-600/15 via-indigo-500/10 to-purple-600/15 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-purple-950/50" />
        
        <div className="px-6 pb-6 relative">
          {/* Avatar overlap */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 sm:-mt-16 mb-4 gap-4">
            <div className="relative group self-start">
              <img 
                src={userPhoto} 
                alt={username} 
                referrerPolicy="no-referrer"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white dark:border-[#111827] shadow-lg bg-slate-100"
              />
              {isLoggedIn && (
                <button 
                  onClick={() => {
                    const nextPhoto = prompt("Enter a valid Unsplash image URL to update your photo:", userPhoto);
                    if (nextPhoto) {
                      setUserPhoto(nextPhoto);
                      triggerToast("Profile picture updated.");
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
                  onClick={() => {
                    setEditName(username);
                    setEditTitle(userTitle);
                    setEditLoc(userLoc);
                    setEditBio(userBio);
                    setEditEmail(userEmail);
                    setEditPhone(userPhone);
                    setIsEditing(true);
                  }}
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
                  {username}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[9px] font-extrabold border border-blue-500/10 font-mono">
                  <CheckCircle2 className="w-3 h-3 mr-0.5 fill-current shrink-0" />
                  {userType === 'worker' ? 'CERTIFIED CONTRACTOR' : userType === 'company' ? 'VERIFIED BUSINESS' : 'MEMBER'}
                </span>
                
                {isLoggedIn && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono border ${
                    availabilityStatus === 'Available Now' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15'
                      : availabilityStatus === 'Part-time'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15'
                      : 'bg-slate-500/10 text-slate-600 border-slate-500/15'
                  }`}>
                    ● {availabilityStatus}
                  </span>
                )}
              </div>
              
              <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 font-mono uppercase tracking-wider">
                {userTitle}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-normal">
              {userBio}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
              <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" /> {userLoc}</span>
              <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" /> Joined OpenComm in 2026</span>
            </div>
          </div>
        </div>
      </div>

      {/* OPTIONAL PROFILE ACTION PANELS */}
      {isLoggedIn && (
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl text-left space-y-4 shadow-sm">
          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Establish Workspace Identities</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select an option below to refine your contractor services, establish a business organizational profile, or update contact points.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Basic Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">👤</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Identity</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Basic Member Meta</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">Configure your bio, name, telephone contact details, or active region.</p>
              </div>
              <button
                onClick={() => {
                  setEditName(username);
                  setEditTitle(userTitle);
                  setEditLoc(userLoc);
                  setEditBio(userBio);
                  setEditEmail(userEmail);
                  setEditPhone(userPhone);
                  setIsEditing(true);
                }}
                className="w-full py-2 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold cursor-pointer transition-colors text-center"
              >
                Complete Basic Profile
              </button>
            </div>

            {/* Action 2: Worker Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">🛠️</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Contractor</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Contractor Profile</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                  {userType === 'worker' ? 'Already configured. Your contractor services are active and searchable.' : 'Register as a contractor to receive jobs and submit bids.'}
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
                {userType === 'worker' ? 'Update Worker Profile' : 'Create Worker Profile'}
              </button>
            </div>

            {/* Action 3: Company Profile */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 flex flex-col justify-between space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-lg">🏢</span>
                  <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase">Corporate</span>
                </div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">Company Profile</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                  {userType === 'company' ? 'Already active. Your corporate badge and organization info are verified.' : 'Flesh out company name and business sector to receive organization status.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCompanyModal(true);
                }}
                className="w-full py-2 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-bold cursor-pointer transition-all text-center"
              >
                {userType === 'company' ? 'Update Company Profile' : 'Create Company Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <p className="text-[10px] text-slate-400 font-medium">Verify your corporate entity identity</p>
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
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
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-mono">Company Size</label>
                    <select
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                      defaultValue="1-10"
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="200+">200+ employees</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-mono">Location HQ</label>
                    <input
                      type="text"
                      defaultValue={userLoc}
                      placeholder="e.g. Austin, TX"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
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

      {/* 3. PROFILE SUB-TABS NAVIGATION */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200/50 dark:border-slate-800/40 text-left">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'experience', label: 'Work History', icon: Briefcase },
          { id: 'skills', label: 'Expertise & Badges', icon: BadgeCheck },
          { id: 'reviews', label: 'Milestone Feedback', icon: Star }
        ].map((tab) => {
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
                {/* Secure Contact Block */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Secure Direct Contacts</h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-mono flex items-center">
                      <Lock className="w-2.5 h-2.5 mr-1" /> Encrypted
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Primary Email</p>
                          <p className="text-xs font-bold font-mono text-slate-950 dark:text-slate-200 mt-0.5">
                            {emailVisible ? userEmail : '••••••••••••••••••••'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!isLoggedIn) {
                            triggerToast("Create a verified account to interact with contact details.");
                            return;
                          }
                          setEmailVisible(!emailVisible);
                        }}
                        className="text-[10px] font-bold text-[#7C3AED] dark:text-purple-400 hover:underline cursor-pointer"
                      >
                        {emailVisible ? 'Hide' : 'Reveal Contact'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
                      <div className="flex items-center space-x-3">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Mobile Number</p>
                          <p className="text-xs font-bold font-mono text-slate-950 dark:text-slate-200 mt-0.5">
                            {phoneVisible ? userPhone : '••••••••••••••••••••'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!isLoggedIn) {
                            triggerToast("Create a verified account to interact with contact details.");
                            return;
                          }
                          setPhoneVisible(!phoneVisible);
                        }}
                        className="text-[10px] font-bold text-[#7C3AED] dark:text-purple-400 hover:underline cursor-pointer"
                      >
                        {phoneVisible ? 'Hide' : 'Reveal Contact'}
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                      🔒 <strong>OpenComm Shield Notice:</strong> Direct telephone links, emails, and address details are fully encrypted and only transmitted to counterparties after direct milestone escrow authorization.
                    </p>
                  </div>
                </div>

                {/* About Marketplace Profile */}
                <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Verification Status</h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-start space-x-3 p-3 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                      <ShieldCheck className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-900 dark:text-white font-bold block mb-0.5">Escrow Compliant Account</strong>
                        Your profile is verified to initialize secure milestone escrows, ensuring zero deposit loss during disputes.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'experience' && (
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

                <div className="relative border-l border-slate-200 dark:border-slate-800 pl-4 ml-2 space-y-6 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 ring-4 ring-white dark:ring-[#111827]" />
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Senior Project Specialist</h4>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold font-mono mt-0.5">Active Contractor &bull; 2024 - Present</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Overseeing high-quality local deliverables, managing milestone checks, and coordinating client approvals.
                    </p>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 ring-4 ring-white dark:ring-[#111827]" />
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">Professional Independent Consultant</h4>
                    <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">Contract Basis &bull; 2020 - 2024</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Delivered complex local renovation work, custom smart cabinetry trim, and digital prototype consultations.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'skills' && (
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
                    {['Contract Drafting', 'Milestone Management', 'Escrow Escort', 'Quality Inspection', 'Consultation', 'Troubleshooting'].map((skill, index) => (
                      <span 
                        key={index} 
                        className="px-3.5 py-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 text-[11px] font-mono font-medium text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/10"
                      >
                        {skill}
                      </span>
                    ))}
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

            {activeTab === 'reviews' && (
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

        {/* COLUMN RIGHT: Request Connection Feed & Settings */}
        <div className="space-y-6">
          {/* Connection Requests Panel (shown only if logged-in) */}
          {isLoggedIn && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Connection Requests</h3>
                <p className="text-[10px] text-slate-400 mt-1 font-medium leading-normal">Respond to unlock encrypted direct contacts.</p>
              </div>

              <div className="space-y-3.5">
                {contactRequests.map((req) => (
                  <div key={req.id} className="p-3 bg-slate-50/60 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs space-y-2 text-left">
                    <div className="flex items-center space-x-2.5">
                      <img src={req.requesterPhoto} alt={req.requesterName} className="w-7 h-7 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{req.requesterName}</h4>
                        <p className="text-[9px] text-slate-400 font-mono">{req.timestamp}</p>
                      </div>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-[#111827] p-2 rounded-xl border border-slate-200/40 dark:border-slate-800/20 leading-relaxed">
                      "{req.reason}"
                    </p>

                    <div className="flex items-center justify-end space-x-1.5 pt-1">
                      {req.status === 'Pending' ? (
                        <>
                          <button 
                            onClick={() => handleDeclineRequest(req.id, req.requesterName)}
                            className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Decline
                          </button>
                          <button 
                            onClick={() => handleApproveRequest(req.id, req.requesterName)}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-[10px] font-bold hover:opacity-90 cursor-pointer"
                          >
                            Approve
                          </button>
                        </>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'Approved' 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {req.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secure Settings summary card */}
          {isLoggedIn && (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Privacy Controls</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input type="checkbox" defaultChecked className="mt-0.5 text-blue-600 rounded border-slate-300" />
                  <span className="text-slate-600 dark:text-slate-300">Hide precise address from guest search results</span>
                </label>
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input type="checkbox" defaultChecked className="mt-0.5 text-blue-600 rounded border-slate-300" />
                  <span className="text-slate-600 dark:text-slate-300">Only receive bids from verified clients</span>
                </label>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 5. EDIT MODAL OVERLAY */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-lg overflow-hidden shadow-2xl text-left"
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

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Professional Title / Designation</label>
                  <input 
                    type="text" 
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Availability</label>
                    <select 
                      value={availabilityStatus}
                      onChange={(e) => setAvailabilityStatus(e.target.value as any)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Available Now">Available Now</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Busy">Busy</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Target Location</label>
                    <input 
                      type="text" 
                      required
                      value={editLoc}
                      onChange={(e) => setEditLoc(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Private Email</label>
                    <input 
                      type="email" 
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Private Phone</label>
                    <input 
                      type="text" 
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono text-[9px]">Professional Bio Summary</label>
                  <textarea 
                    rows={3}
                    required
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5">
                  <button 
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
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
