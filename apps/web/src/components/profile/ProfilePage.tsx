import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Phone, MapPin, Briefcase, Calendar, Edit2,
  BadgeCheck, ShieldAlert, Lock, Globe, Star, X, Camera, ShieldCheck, CheckCircle2, Bookmark, Users, AlertCircle,
  MoreHorizontal, Share2, LogOut, Settings, Eye, ExternalLink, Plus, Trash2, Building2, Wrench, ChevronRight, Award, Clock, CheckCircle, MessageSquare,
  FileText, Folder, Download, DollarSign
} from 'lucide-react';
import { Activity, Job, Worker, Message, JobApplication, ApplicationMessage, Conversation } from '../../types';
import { supabase, dbService, assertUserEmailConfirmed, LocalProfile, LocalWorkerProfile, LocalCompanyProfile, formatWorkerRate } from '../../lib/supabase';
import { getPublicProfileById, clearProfileCache } from '../../lib/profileService';
import { analytics } from '../../lib/analytics';
import { navigateWithOrigin, SESSION_STORAGE_KEYS } from '../../lib/navigation';
import UserAvatar from '../common/UserAvatar';
import BasicProfileDashboard from './BasicProfileDashboard';
import PublicBasicProfile from './PublicBasicProfile';
import AvatarUploadMenu from './AvatarUploadMenu';

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
  { id: 'banner_01', name: 'Ocean Mist', category: 'blue gradients', class: 'bg-gradient-to-r from-blue-600/20 via-indigo-500/10 to-purple-600/20 dark:from-blue-950/60 dark:via-indigo-950/30 dark:to-purple-950/50' },
  { id: 'banner_02', name: 'Deep Sea', category: 'blue gradients', class: 'bg-gradient-to-r from-cyan-500/20 via-blue-600/20 to-indigo-700/20 dark:from-cyan-950/50 dark:via-blue-950/50 dark:to-indigo-950/50' },
  { id: 'banner_03', name: 'Skyward', category: 'blue gradients', class: 'bg-gradient-to-r from-sky-400/20 via-blue-500/15 to-indigo-500/25 dark:from-sky-950/40 dark:via-blue-950/40 dark:to-indigo-950/50' },
  { id: 'banner_04', name: 'Sunset Orchid', category: 'purple gradients', class: 'bg-gradient-to-r from-fuchsia-600/20 via-purple-600/15 to-pink-500/20 dark:from-fuchsia-950/40 dark:via-purple-950/40 dark:to-pink-950/40' },
  { id: 'banner_05', name: 'Cosmic Nebula', category: 'purple gradients', class: 'bg-gradient-to-r from-purple-800/25 via-indigo-700/15 to-violet-900/25 dark:from-purple-950/60 dark:via-indigo-950/40 dark:to-violet-950/60' },
  { id: 'banner_06', name: 'Neon Dusk', category: 'purple gradients', class: 'bg-gradient-to-r from-violet-600/20 via-fuchsia-500/10 to-purple-800/20 dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-purple-950/50' },
  { id: 'banner_07', name: 'Obsidian Gold', category: 'dark professional', class: 'bg-gradient-to-r from-neutral-900/90 via-amber-500/10 to-neutral-900/90 border-b border-amber-500/10 dark:from-neutral-950 dark:via-amber-500/5' },
  { id: 'banner_08', name: 'Midnight Slate', category: 'dark professional', class: 'bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 dark:from-slate-950 dark:via-slate-900' },
  { id: 'banner_09', name: 'Carbon Fiber', category: 'dark professional', class: 'bg-gradient-to-r from-neutral-950 via-zinc-900 to-neutral-950 dark:from-black dark:via-neutral-950' },
];

export const getBannerClass = (bannerId?: string) => {
  const found = BUILTIN_BANNERS.find(b => b.id === bannerId);
  return found ? found.class : BUILTIN_BANNERS[0].class;
};

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
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  const { usernameParam } = useParams<{ usernameParam: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const jobsAppliedRequestRef = useRef(0);

  const [isOwner, setIsOwner] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  
  // Real Statistics
  const [myJobPostsCount, setMyJobPostsCount] = useState(0);
  const [jobsAppliedCount, setJobsAppliedCount] = useState<number | null>(null);
  const [savedJobsCount, setSavedJobsCount] = useState(0);
  const [savedWorkersCount, setSavedWorkersCount] = useState(0);
  const [employerJobStats, setEmployerJobStats] = useState<any[]>([]);

  // Portfolio & Reviews Real Database Data
  const [reviews, setReviews] = useState<any[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [showAddPortfolioModal, setShowAddPortfolioModal] = useState(false);
  const [newPortfolioTitle, setNewPortfolioTitle] = useState('');
  const [newPortfolioLink, setNewPortfolioLink] = useState('');

  // Job Application Docs State
  const [workerDocs, setWorkerDocs] = useState<any[]>([]);
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [docType, setDocType] = useState<'Portfolio' | 'CV' | 'Resume'>('Portfolio');
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docExternalUrl, setDocExternalUrl] = useState('');
  const [docIsPublic, setDocIsPublic] = useState(true);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const [docToDelete, setDocToDelete] = useState<any | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // UI Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'reviews' | 'about'>('overview');
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [showMenuPopover, setShowMenuPopover] = useState(false);
  const [showSkillsExpanded, setShowSkillsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Company modal
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyLegalName, setCompanyLegalName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('');

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
  const [editLocationVisibility, setEditLocationVisibility] = useState(true);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // Worker profile edit buffers
  const [editTitle, setEditTitle] = useState('');
  const [editExperience, setEditExperience] = useState<number | ''>('');
  const [editHourlyRate, setEditHourlyRate] = useState<number | ''>('');
  const [editSalaryPeriod, setEditSalaryPeriod] = useState('hourly');
  const [editSalaryMin, setEditSalaryMin] = useState<number | ''>('');
  const [editSalaryMax, setEditSalaryMax] = useState<number | ''>('');
  const [editExpectedSalary, setEditExpectedSalary] = useState('');
  const [editWorkPreference, setEditWorkPreference] = useState('Onsite');
  const [editCategory, setEditCategory] = useState('');
  const [editAvailability, setEditAvailability] = useState('Available Now');
  const [editSkills, setEditSkills] = useState('');
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const [loggedInId, setLoggedInId] = useState<string | null>(null);

  // Refresh Real Jobs Applied Count
  const refreshJobsAppliedCount = async () => {
    const requestId = ++jobsAppliedRequestRef.current;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return;

    const { data: appliedRows, error } = await dbService.getMyJobApplications(user.id);
    if (requestId !== jobsAppliedRequestRef.current) return;
    if (!error && appliedRows) {
      setJobsAppliedCount(appliedRows.length);
    }
  };

  useEffect(() => {
    let channel: any;
    const setupSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      channel = supabase
        .channel(`profile-job-applications-${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'job_applications',
          filter: `applicant_id=eq.${user.id}`
        }, () => refreshJobsAppliedCount())
        .subscribe();
    };

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshJobsAppliedCount();
      }
    };

    refreshJobsAppliedCount();
    setupSubscriptions();

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('opencomm:job-application-changed', refreshJobsAppliedCount);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('opencomm:job-application-changed', refreshJobsAppliedCount);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/profile' && isOwner) {
      refreshJobsAppliedCount();
    }
  }, [location.pathname, isOwner]);

  // Load All Profile & Supplemental Data
  const loadProfileData = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      let p: LocalProfile | null = null;
      let isOwnerCheck = false;
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      
      if (authUser) {
        setLoggedInId(authUser.id);
      } else {
        setLoggedInId(null);
      }

      if (usernameParam) {
        if (authUser && authUser.id === usernameParam) {
          isOwnerCheck = true;
          p = await dbService.getProfile(authUser.id);
        } else {
          isOwnerCheck = false;
          const canonical = await getPublicProfileById(usernameParam);
          if (canonical) {
            p = {
              id: canonical.id,
              username: canonical.id,
              full_name: canonical.name,
              avatar_url: canonical.avatarUrl || '',
              banner_url: canonical.bannerUrl || '',
              bio: canonical.bio || '',
              city: canonical.city || '',
              state: canonical.state || '',
              country: canonical.country || '',
              preferred_language: '',
              profile_type: canonical.profileType || 'normal',
              onboarding_completed: true,
              created_at: new Date().toISOString(),
              verified: canonical.verified,
            } as unknown as LocalProfile;
          }
        }
      } else {
        if (!isLoggedIn || !authUser) {
          setProfile(null);
          setWorkerProfile(null);
          setCompanyProfile(null);
          setLoading(false);
          return;
        }
        p = await dbService.getProfile(authUser.id);
        isOwnerCheck = true;
      }

      if (p) {
        setProfile(p);
        setIsOwner(isOwnerCheck);
        setIsPublic(!isOwnerCheck);

        const targetUserId = p.id;

        // Fetch Additional Real Counts & Content from Supabase
        const [jobCount, sJobsCount, sWorkersCount, userReviews, userPortfolio] = await Promise.all([
          dbService.getMyJobPostsCount(targetUserId),
          dbService.getSavedJobsCount(targetUserId),
          dbService.getSavedWorkersCount(targetUserId),
          dbService.getReviewsFromDb(targetUserId),
          dbService.getPortfolioItemsFromDb(targetUserId),
        ]);

        setMyJobPostsCount(jobCount);
        setSavedJobsCount(sJobsCount);
        setSavedWorkersCount(sWorkersCount);
        setReviews(userReviews);
        setPortfolioItems(userPortfolio);

        // Fetch Employer Job Stats if owner
        if (isOwnerCheck && authUser) {
          try {
            const { data: jobStatsData, error: statsError } = await supabase
              .from('jobs')
              .select('id, title, created_at, job_applications(id, status)')
              .eq('posted_by', authUser.id)
              .order('created_at', { ascending: false });

            if (!statsError && jobStatsData) {
              const stats = jobStatsData.map((job: any) => {
                const apps = job.job_applications || [];
                return {
                  id: job.id,
                  title: job.title,
                  created_at: job.created_at,
                  total: apps.length,
                  pending: apps.filter((a: any) => a.status === 'pending' || a.status === 'under_review').length,
                  shortlisted: apps.filter((a: any) => a.status === 'shortlisted').length,
                  accepted: apps.filter((a: any) => a.status === 'accepted').length,
                  rejected: apps.filter((a: any) => a.status === 'rejected').length
                };
              });
              setEmployerJobStats(stats);
            } else {
              setEmployerJobStats([]);
            }
          } catch (err) {
            setEmployerJobStats([]);
          }
        } else {
          setEmployerJobStats([]);
        }

        // Sync global app header states for owner
        if (isOwnerCheck) {
          if (p.full_name && p.full_name !== username) {
            setUsername(p.full_name);
          }
          if (p.avatar_url && p.avatar_url !== userPhoto) {
            setUserPhoto(p.avatar_url);
          }
          if (setUserType && p.profile_type !== userType) {
            setUserType(p.profile_type as any || 'normal');
          }
        }

        if (p.profile_type === 'worker') {
          const w = await dbService.getWorkerProfile(p.id);
          setWorkerProfile(w);

          // Fetch Job Application Documents
          const docs = await dbService.getWorkerDocumentsFromDb(p.id, isOwnerCheck);
          setWorkerDocs(docs || []);
        } else if (p.profile_type === 'company') {
          const c = await dbService.getCompanyProfile(p.id);
          setCompanyProfile(c);
        }
      } else {
        if (isOwnerCheck && isLoggedIn) {
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
            email_verified_for_actions: isEmailVerified,
            location_visibility: true
          };
          setProfile(fallback);
        } else {
          setErrorState("Profile not found");
        }
      }
    } catch (err: any) {
      console.error("Error fetching profiles:", err);
      setErrorState(err.message || "Failed to load profile data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
    analytics.trackProfileViewed(usernameParam ? 'public' : 'own', loggedInId, usernameParam || username || 'User');
  }, [isLoggedIn, loggedInId, usernameParam, userType]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Edit Profile Debug] handleSaveProfile form submit event fired', {
      loggedInId,
      editName,
      editTitle,
      editBio,
      editCategory,
      editHourlyRate,
      editSalaryPeriod
    });
    setLoading(true);
    try {
      // 1. Resolve fresh user id directly from Supabase Auth to ensure auth.uid() match
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const targetUserId = authData?.user?.id || loggedInId;

      if (!targetUserId) {
        throw new Error("Authentication required to update profile. Please sign in again.");
      }

      console.log('[Edit Profile Debug] Verified target user ID:', targetUserId, 'auth user ID:', authData?.user?.id);

      let finalBannerId = editBannerId === 'custom' ? undefined : editBannerId;
      if (bannerFile) {
        finalBannerId = await dbService.uploadBanner(targetUserId, bannerFile);
      }

      console.log('[Edit Profile Debug] Calling dbService.updateProfile for targetUserId:', targetUserId);

      const updated = await dbService.updateProfile(targetUserId, {
        full_name: editName,
        bio: editBio,
        city: editCity,
        state: editState,
        country: editCountry,
        preferred_language: editLang,
        phone: editPhone,
        banner_id: finalBannerId,
        location_visibility: editLocationVisibility,
      });

      console.log('[Edit Profile Debug] dbService.updateProfile completed:', updated);

      if (userType === 'worker' || workerProfile) {
        console.log('[Edit Profile Debug] Calling dbService.updateWorkerProfileData for targetUserId:', targetUserId);
        await dbService.updateWorkerProfileData(targetUserId, {
          profession: editTitle,
          professional_title: editTitle,
          experience_years: Number(editExperience) || 0,
          hourly_rate: Number(editHourlyRate) || 0,
          expected_salary: editExpectedSalary,
          expected_salary_min: Number(editSalaryMin) || 0,
          expected_salary_max: Number(editSalaryMax) || 0,
          salary_period: editSalaryPeriod,
          work_preference: editWorkPreference,
          primary_category: editCategory,
          availability: editAvailability,
          skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
          bio_summary: editBio,
          work_location: [editCity, editState, editCountry].filter(Boolean).join(', ')
        });
        console.log('[Edit Profile Debug] dbService.updateWorkerProfileData completed successfully.');
      }

      if (updated) {
        setProfile(updated);
        setUsername(updated.full_name || editName);
        triggerToast("Profile updated successfully!");
      }
      setIsEditing(false);
      
      // Force invalidate profile cache & reload profile data from DB
      clearProfileCache(targetUserId);
      await loadProfileData();
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('opencomm:profile-updated'));
      }
    } catch (err: any) {
      console.error('[Edit Profile Debug] ERROR during profile save:', err);
      triggerToast(err.message || "Failed to update profile.");
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
      setBannerPreview(null);
      setEditLocationVisibility(profile.location_visibility ?? true);

      if (workerProfile) {
        setEditTitle(workerProfile.profession || workerProfile.professional_title || '');
        setEditExperience(workerProfile.experience_years ?? workerProfile.years_experience ?? 0);
        setEditHourlyRate(workerProfile.hourly_rate ?? 0);
        setEditSalaryPeriod(workerProfile.salary_period || 'hourly');
        setEditSalaryMin(workerProfile.expected_salary_min ?? '');
        setEditSalaryMax(workerProfile.expected_salary_max ?? '');
        setEditExpectedSalary(workerProfile.expected_salary || '');
        setEditWorkPreference(workerProfile.work_preference || 'Onsite');
        setEditCategory(workerProfile.primary_category || '');
        setEditAvailability(workerProfile.availability_status || workerProfile.availability || 'Available Now');
        setEditSkills(Array.isArray(workerProfile.skills) ? workerProfile.skills.join(', ') : '');
      }
    }
    setBannerFile(null);
    setIsEditing(true);
  };

  const handleAddDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInId || !docTitle.trim()) return;
    setIsUploadingDoc(true);
    try {
      let fileUrl = '';
      let storagePath = '';
      let fileName = '';
      let fileSize = 0;
      let mimeType = '';

      if (docFile) {
        if (docFile.size > 10 * 1024 * 1024) {
          triggerToast("File size exceeds 10 MB limit.");
          setIsUploadingDoc(false);
          return;
        }
        const uploaded = await dbService.uploadWorkerDocumentFile(loggedInId, docFile);
        fileUrl = uploaded.publicUrl;
        storagePath = uploaded.storagePath;
        fileName = docFile.name;
        fileSize = docFile.size;
        mimeType = docFile.type;
      }

      const created = await dbService.addWorkerDocumentInDb(loggedInId, {
        document_type: docType,
        title: docTitle.trim(),
        description: docDescription.trim(),
        file_url: fileUrl || undefined,
        storage_path: storagePath || undefined,
        external_url: docExternalUrl.trim() || undefined,
        file_name: fileName || undefined,
        file_size: fileSize || undefined,
        mime_type: mimeType || undefined,
        is_public: docIsPublic
      });

      if (created) {
        triggerToast("Document added successfully!");
        setShowAddDocModal(false);
        setDocTitle('');
        setDocDescription('');
        setDocFile(null);
        setDocExternalUrl('');
        setDocIsPublic(true);
        await loadProfileData();
      } else {
        triggerToast("Failed to save document record.");
      }
    } catch (err: any) {
      console.error("Add document error:", err);
      triggerToast(err.message || "Failed to upload document.");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocSubmit = async () => {
    if (!docToDelete || !loggedInId) return;
    setIsDeletingDoc(true);
    try {
      const success = await dbService.deleteWorkerDocumentInDb(docToDelete.id, loggedInId, docToDelete.storage_path);
      if (success) {
        triggerToast("Document deleted successfully!");
        setDocToDelete(null);
        await loadProfileData();
      } else {
        triggerToast("Failed to delete document.");
      }
    } catch (err: any) {
      console.error("Delete doc error:", err);
      triggerToast(err.message || "Error deleting document.");
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleCloseEdit = () => {
    setIsEditing(false);
  };

  const handleAddPortfolioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioTitle.trim() || !loggedInId) return;
    try {
      const item = await dbService.addPortfolioItemInDb(loggedInId, newPortfolioTitle.trim(), undefined, newPortfolioLink.trim() || undefined);
      if (item) {
        triggerToast("Portfolio project added!");
        setPortfolioItems(prev => [item, ...prev]);
        setShowAddPortfolioModal(false);
        setNewPortfolioTitle('');
        setNewPortfolioLink('');
      } else {
        triggerToast("Failed to add project.");
      }
    } catch (err) {
      triggerToast("Failed to add project.");
    }
  };

  const handleDeletePortfolioItem = async (itemId: string) => {
    if (!loggedInId || !window.confirm("Delete this portfolio project?")) return;
    const ok = await dbService.deletePortfolioItemInDb(itemId, loggedInId);
    if (ok) {
      setPortfolioItems(prev => prev.filter(i => i.id !== itemId));
      triggerToast("Project deleted.");
    } else {
      triggerToast("Failed to delete project.");
    }
  };

  const showLocation = isOwner || profile?.location_visibility !== false;
  const locationParts = showLocation ? [profile?.city, profile?.state, profile?.country].filter(Boolean) : [];
  const formattedLocation = locationParts.join(', ');
  const joinedYear = profile?.created_at ? new Date(profile.created_at).getFullYear() : null;

  const totalApplicationsReceived = employerJobStats.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const pendingApplicationsReceived = employerJobStats.reduce((acc, curr) => acc + (curr.pending || 0), 0);
  const acceptedApplicationsReceived = employerJobStats.reduce((acc, curr) => acc + (curr.accepted || 0), 0);
  const rejectedApplicationsReceived = employerJobStats.reduce((acc, curr) => acc + (curr.rejected || 0), 0);

  const skillsList = workerProfile?.skills || [];
  const displayedSkills = showSkillsExpanded ? skillsList : skillsList.slice(0, 6);
  const remainingSkillsCount = Math.max(0, skillsList.length - 6);
  const isBasicAccount = profile && (!profile.profile_type || profile.profile_type === 'basic' || profile.profile_type === 'normal');

  if (profile && isBasicAccount) {
    if (isOwner) {
      return (
        <BasicProfileDashboard
          profile={profile}
          username={username}
          userPhoto={userPhoto}
          joinedYear={joinedYear}
          formattedLocation={formattedLocation}
          jobs={jobs}
          workers={workers}
          myJobPostsCount={myJobPostsCount}
          jobsAppliedCount={jobsAppliedCount}
          isOwner={true}
          onEditProfile={handleOpenEdit}
          onCreateWorker={() => setShowCreateProfile(true)}
          onCreateCompany={() => triggerToast("Company profile creation coming soon.")}
          onUpdatePhoto={() => setShowAvatarMenu(true)}
          onUpdateBanner={() => setShowAvatarMenu(true)}
          onLogout={onLogout || (() => {})}
          triggerToast={triggerToast}
        />
      );
    } else {
      return (
        <PublicBasicProfile
          profile={profile}
          formattedLocation={formattedLocation}
          joinedYear={joinedYear}
          publicJobs={jobs.filter(j => (j as any).authorId === profile.id || (j as any).user_id === profile.id)}
          triggerToast={triggerToast}
        />
      );
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-3 sm:py-6 px-4 sm:px-6 pb-24 sm:pb-12 text-slate-800 dark:text-slate-100 text-left">
      
      {/* 1. GUEST GATEWAY BANNER (If not logged in) */}
      {!isLoggedIn && (
        <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/20 dark:to-pink-950/30 border border-purple-500/15 p-5 sm:p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left shadow-xs">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
              <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Browsing OpenComm Workspace as Guest</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Sign in or create an account to save bookmarks, post work, manage applications, and connect with contractors.
            </p>
          </div>
          <button 
            onClick={() => setCurrentView('home')}
            className="px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-transform duration-200 hover:scale-102 self-start md:self-auto"
          >
            Go to Welcome Hub
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !profile && (
        <div className="p-12 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 animate-pulse">
          <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mx-auto" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto" />
          <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">Loading OpenComm user profile...</p>
        </div>
      )}

      {errorState && (!isOwner || isPublic) && (
        <div className="p-12 text-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg mx-auto mt-12 shadow-xs">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">Profile Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This worker or user profile could not be found or is not public.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PROFILE HERO SECTION (Soft Gradient, Avatar with Camera, Compact Layout) */}
      {/* ========================================================================= */}
      {(!loading || profile) && (
        <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-500/10 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border border-purple-500/15 rounded-3xl p-5 sm:p-7 relative overflow-hidden shadow-xs">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
            {/* Avatar & Main Identity */}
            <div className="flex items-center space-x-4 min-w-0">
              <div className="relative shrink-0 group">
                <UserAvatar
                  avatarUrl={profile?.avatar_url || userPhoto}
                  fullName={profile?.full_name || username}
                  size="2xl"
                  className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl border-4 border-white dark:border-[#111827] shadow-md bg-slate-100"
                />
                {isOwner && isLoggedIn && (
                  <button 
                    onClick={() => setShowAvatarMenu(true)}
                    className="absolute bottom-0 right-0 p-2 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-full transition-all shadow-md cursor-pointer border-2 border-white dark:border-[#111827]"
                    title="Change profile photo"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0 text-left space-y-1">
                <div className="flex items-center space-x-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white truncate">
                    {profile?.full_name || username}
                  </h1>
                  {(profile?.verified || workerProfile?.verification_status === 'verified') && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 fill-emerald-500/10" />
                  )}
                  {workerProfile?.availability && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      workerProfile.availability === 'Available Now' 
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}>
                      ● {workerProfile.availability}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 truncate">
                  {workerProfile?.profession || companyProfile?.name || (profile?.profile_type === 'worker' ? 'Certified Professional' : profile?.profile_type === 'company' ? 'Verified Business' : 'OpenComm Member')}
                </p>

                {/* Micro Meta: Location, Experience, Rating */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                  {formattedLocation && (
                    <span className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400 shrink-0" />
                      {formattedLocation}
                    </span>
                  )}
                  {workerProfile?.experience_years !== undefined && workerProfile?.experience_years > 0 && (
                    <span className="flex items-center font-medium">
                      <Award className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
                      {workerProfile.experience_years} yrs exp
                    </span>
                  )}
                  {joinedYear && (
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      Member since {joinedYear}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Rating Badge */}
            {reviews.length > 0 && (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center space-x-2 shrink-0">
                <Star className="w-4 h-4 text-amber-500 fill-current" />
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {(reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 font-medium">({reviews.length} reviews)</span>
              </div>
            )}
          </div>

          {/* Bio Preview */}
          {profile?.bio && (
            <div className="mt-4 pt-3 border-t border-purple-500/10 text-left">
              <p className={`text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${isBioExpanded ? '' : 'line-clamp-2'}`}>
                {profile.bio}
              </p>
              {profile.bio.length > 120 && (
                <button
                  onClick={() => setIsBioExpanded(!isBioExpanded)}
                  className="mt-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                >
                  {isBioExpanded ? 'Show Less' : 'Read More'}
                </button>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. PROFILE ACTIONS (Purple-blue gradient for primary only, icons only) */}
          {/* ========================================================================= */}
          <div className="mt-5 pt-4 border-t border-purple-500/10 flex items-center justify-between flex-wrap gap-2">
            {isOwner ? (
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <button
                  onClick={handleOpenEdit}
                  className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>

                <button
                  onClick={() => navigate(`/profile/${profile?.id || loggedInId}`)}
                  className="h-9 px-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Profile</span>
                </button>

                <button
                  onClick={handleOpenEdit}
                  className="h-9 px-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Settings</span>
                </button>

                {/* Three Dot Popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowMenuPopover(!showMenuPopover)}
                    className="h-9 w-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {showMenuPopover && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-30 text-left"
                      >
                        <button
                          onClick={() => {
                            setShowMenuPopover(false);
                            handleOpenEdit();
                          }}
                          className="w-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Account Settings</span>
                        </button>
                        <button
                          onClick={async () => {
                            setShowMenuPopover(false);
                            await navigator.clipboard.writeText(window.location.href);
                            triggerToast("Profile link copied!");
                          }}
                          className="w-full px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center space-x-2"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share Profile</span>
                        </button>
                        {onLogout && (
                          <button
                            onClick={() => {
                              setShowMenuPopover(false);
                              onLogout();
                            }}
                            className="w-full px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Logout</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (profile?.id) {
                      navigate(`/messages`);
                    }
                  }}
                  className="h-9 px-4 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message Worker</span>
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(window.location.href);
                    triggerToast("Profile link copied!");
                  }}
                  className="h-9 px-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. APPLICATIONS RECEIVED SECTION (Only shown if owner has job applications) */}
      {/* ========================================================================= */}
      {isOwner && employerJobStats.length > 0 && (
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Applications Received</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Overview of applicant responses across your active job postings.
              </p>
            </div>
            
            {/* Manage button maintaining navigation origin */}
            <button
              onClick={() => navigateWithOrigin(navigate, '/profile/manage-applications', location, SESSION_STORAGE_KEYS.MANAGE_APPLICATIONS)}
              className="h-9 px-4 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer self-start sm:self-auto"
            >
              <span>Manage Applications</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total</span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">{totalApplicationsReceived}</span>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/15 text-center">
              <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">Pending</span>
              <span className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{pendingApplicationsReceived}</span>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/15 text-center">
              <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">Accepted</span>
              <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{acceptedApplicationsReceived}</span>
            </div>
            <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/15 text-center">
              <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider font-mono">Rejected</span>
              <span className="text-lg font-extrabold text-rose-700 dark:text-rose-300">{rejectedApplicationsReceived}</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PROFILE STATISTICS (4 Equal Premium Cards with Origin Navigation) */}
      {/* ========================================================================= */}
      {isOwner && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-left">
          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/my-job-posts', location, SESSION_STORAGE_KEYS.MY_JOB_POSTS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{myJobPostsCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Jobs Posted</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/jobs-applied', location, SESSION_STORAGE_KEYS.JOBS_APPLIED)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{jobsAppliedCount || 0}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Jobs Applied</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/saved-jobs', location, SESSION_STORAGE_KEYS.SAVED_JOBS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Bookmark className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{savedJobsCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Saved Jobs</span>
          </div>

          <div 
            onClick={() => navigateWithOrigin(navigate, '/profile/saved-workers', location, SESSION_STORAGE_KEYS.SAVED_WORKERS)}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs cursor-pointer hover:border-purple-500/30 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white block leading-none mb-1">{savedWorkersCount}</span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono block">Saved Workers</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PROFILE NAVIGATION TABS (Overview, Portfolio, Reviews, About) */}
      {/* ========================================================================= */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'docs', label: 'Job Application Docs', icon: FileText },
          { id: 'reviews', label: 'Reviews', icon: Star },
          { id: 'about', label: 'About', icon: Globe }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 font-extrabold shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB CONTENTS */}
      {/* ========================================================================= */}
      <AnimatePresence mode="wait">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div
            key="tab-overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* About Me Card */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">About Me</h3>
                {isOwner && (
                  <button onClick={handleOpenEdit} className="text-xs font-bold text-purple-600 hover:underline flex items-center space-x-1">
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {profile?.bio ? (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {profile.bio}
                </p>
              ) : (
                isOwner && (
                  <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                    <span className="text-xs text-purple-700 dark:text-purple-300 font-medium">Add a professional summary to help clients get to know you.</span>
                    <button onClick={handleOpenEdit} className="px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-xs font-bold shrink-0">Add Bio</button>
                  </div>
                )
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 font-mono text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Language</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{profile?.preferred_language || 'English'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Account Type</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold capitalize">{profile?.profile_type || 'Basic'} Member</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Location</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{formattedLocation || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Rate / Salary</span>
                  <span className="text-purple-600 dark:text-purple-400 font-extrabold">{formatWorkerRate(workerProfile)}</span>
                </div>
              </div>
            </div>

            {/* 7. SKILLS SECTION */}
            {(skillsList.length > 0 || isOwner) && (
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Skills & Expertise</h3>
                  {isOwner && (
                    <button onClick={handleOpenEdit} className="text-xs font-bold text-purple-600 hover:underline flex items-center space-x-1">
                      <Plus className="w-3 h-3" />
                      <span>Manage Skills</span>
                    </button>
                  )}
                </div>

                {skillsList.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {displayedSkills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800"
                      >
                        {skill}
                      </span>
                    ))}
                    {remainingSkillsCount > 0 && !showSkillsExpanded && (
                      <button
                        onClick={() => setShowSkillsExpanded(true)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 cursor-pointer"
                      >
                        +{remainingSkillsCount} more
                      </button>
                    )}
                  </div>
                ) : (
                  isOwner && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500 flex items-center justify-between">
                      <span>Add your top professional skills to get discovered on the worker directory.</span>
                      <button onClick={handleOpenEdit} className="px-3 py-1.5 bg-[#7C3AED] text-white rounded-lg text-xs font-bold shrink-0">Add Skills</button>
                    </div>
                  )
                )}
              </div>
            )}

            {/* 10. VERIFICATION SECTION */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
              <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Verification Status</h3>
              </div>
              <div className="flex items-center space-x-3 p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-white font-bold block">Verified Account</strong>
                  <span className="text-slate-500 dark:text-slate-400">Account identity and security status verified for OpenComm marketplace transactions.</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* JOB APPLICATION DOCS TAB */}
        {activeTab === 'docs' && (
          <motion.div
            key="tab-docs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Job Application Docs</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Manage your Portfolio, CV, and Resume files</p>
              </div>
              {isOwner && (
                <button
                  onClick={() => setShowAddDocModal(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-[#7C3AED] to-purple-600 hover:opacity-95 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Document</span>
                </button>
              )}
            </div>

            {workerDocs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {workerDocs.map((doc) => (
                  <div key={doc.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between">
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
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                doc.document_type === 'Resume' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                                doc.document_type === 'CV' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' :
                                'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}>
                                {doc.document_type}
                              </span>
                            </div>
                            {doc.file_name && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">{doc.file_name} {doc.file_size ? `• ${(doc.file_size / (1024 * 1024)).toFixed(2)} MB` : ''}</p>
                            )}
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => setDocToDelete(doc)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {doc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed line-clamp-2">{doc.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${doc.is_public ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {doc.is_public ? 'Public' : 'Private'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
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
                            className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1 shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-500 space-y-3">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="font-extrabold text-sm text-slate-800 dark:text-slate-200">No job application documents uploaded yet.</p>
                <p className="text-slate-500 max-w-sm mx-auto">Upload your Portfolio, CV, or Resume to stand out to employers and get hired faster.</p>
                {isOwner && (
                  <button
                    onClick={() => setShowAddDocModal(true)}
                    className="mt-2 px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-purple-600 text-white font-bold rounded-xl text-xs shadow-sm hover:opacity-95"
                  >
                    Add Your First Document
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <motion.div
            key="tab-reviews"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">Member Reviews</h3>

            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div key={rev.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <UserAvatar
                          avatarUrl={rev.reviewer?.avatar_url || ''}
                          fullName={rev.reviewer?.full_name || 'Member'}
                          size="sm"
                        />
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{rev.reviewer?.full_name || 'Member'}</span>
                      </div>
                      <div className="flex text-amber-500 space-x-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < (rev.rating || 5) ? 'fill-current' : 'text-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                      "{rev.comment || 'Great work experience.'}"
                    </p>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-500">
                <Star className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No reviews yet.</p>
                <p className="mt-1">Completed contracts and hiring milestones will display feedback here.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <motion.div
            key="tab-about"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4"
          >
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Account Details</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Full Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{profile?.full_name || username}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Account Type</span>
                <span className="font-bold text-slate-900 dark:text-white capitalize">{profile?.profile_type || 'Basic'} Member</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Member Since</span>
                <span className="font-bold text-slate-900 dark:text-white">{joinedYear || 'Recent'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Verification</span>
                <span className="font-bold text-emerald-600 flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Verified
                </span>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ADD PORTFOLIO MODAL */}
      <AnimatePresence>
        {showAddPortfolioModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPortfolioModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 z-10 text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Add Portfolio Project</h3>
                <button onClick={() => setShowAddPortfolioModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddPortfolioSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Project Title</label>
                  <input
                    type="text"
                    required
                    value={newPortfolioTitle}
                    onChange={(e) => setNewPortfolioTitle(e.target.value)}
                    placeholder="e.g. Modern Residential Renovation"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Project Link (Optional)</label>
                  <input
                    type="url"
                    value={newPortfolioLink}
                    onChange={(e) => setNewPortfolioLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button type="button" onClick={() => setShowAddPortfolioModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 rounded-xl text-xs font-bold">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-[#7C3AED] text-white rounded-xl text-xs font-bold shadow-xs">Add Project</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AVATAR UPLOAD MENU */}
      <AvatarUploadMenu 
        isOpen={showAvatarMenu}
        onClose={() => setShowAvatarMenu(false)}
        userId={loggedInId || ''}
        currentAvatarUrl={profile?.avatar_url || userPhoto}
        onSuccess={async (newUrl) => {
          if (newUrl !== undefined) {
            setUserPhoto(newUrl || '');
            triggerToast("Profile picture updated successfully.");
            await loadProfileData();
          }
        }}
        onError={(msg) => triggerToast(msg)}
      />

      {/* EDIT PROFILE MODAL */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white dark:bg-[#111827] rounded-t-[32px] sm:rounded-[32px] border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col shadow-2xl text-left overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-[#111827] shrink-0 z-10">
                <span className="font-bold text-lg text-slate-900 dark:text-white">Edit Profile</span>
                <button 
                  onClick={handleCloseEdit}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="edit-profile-form" onSubmit={handleSaveProfile} className="p-6 space-y-6 overflow-y-auto flex-1">
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Full Name</label>
                  <input 
                    type="text" 
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Location</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="City"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                    <input 
                      type="text" 
                      value={editState}
                      onChange={(e) => setEditState(e.target.value)}
                      placeholder="State"
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                    <input 
                      type="text" 
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      placeholder="Country"
                      className="col-span-2 sm:col-span-1 w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mt-3">
                    <input 
                      type="checkbox" 
                      checked={editLocationVisibility}
                      onChange={(e) => setEditLocationVisibility(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Show general location on profile</span>
                  </label>
                </div>

                {(userType === 'worker' || workerProfile) && (
                  <>
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Professional Title / Role</label>
                      <input 
                        type="text" 
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="e.g. Lead Product Designer, Senior Electrician"
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Worker Category</label>
                        <input 
                          type="text" 
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="e.g. Design, IT, Skilled Trades"
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Experience (Years)</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editExperience}
                          onChange={(e) => setEditExperience(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 5"
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Work Preference</label>
                        <select 
                          value={editWorkPreference}
                          onChange={(e) => setEditWorkPreference(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                        >
                          <option value="Onsite">Onsite</option>
                          <option value="Remote">Remote</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Salary / Rate Period</label>
                        <select 
                          value={editSalaryPeriod}
                          onChange={(e) => setEditSalaryPeriod(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                        >
                          <option value="hourly">Hourly Rate (/hr)</option>
                          <option value="daily">Daily Rate (/day)</option>
                          <option value="monthly">Monthly Salary (/mo)</option>
                          <option value="project">Project Fixed Rate (/project)</option>
                        </select>
                      </div>
                    </div>

                    {editSalaryPeriod === 'monthly' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Expected Min Salary (₹/mo)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={editSalaryMin}
                            onChange={(e) => setEditSalaryMin(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 20000"
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Expected Max Salary (₹/mo)</label>
                          <input 
                            type="number" 
                            min="0"
                            value={editSalaryMax}
                            onChange={(e) => setEditSalaryMax(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 40000"
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Rate / Amount (INR ₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          value={editHourlyRate}
                          onChange={(e) => setEditHourlyRate(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 650"
                          className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Availability Status</label>
                      <select 
                        value={editAvailability}
                        onChange={(e) => setEditAvailability(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                      >
                        <option value="Available Now">Available Now</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Busy">Busy</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Core Skills (comma separated)</label>
                      <input 
                        type="text" 
                        value={editSkills}
                        onChange={(e) => setEditSkills(e.target.value)}
                        placeholder="e.g. React, TypeScript, Figma, Wiring, Safety"
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 font-medium"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Preferred Language</label>
                  <input 
                    type="text" 
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value)}
                    placeholder="e.g. English, Hindi"
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 text-xs">Bio / Professional Summary</label>
                  <textarea 
                    rows={4}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value.substring(0, 500))}
                    placeholder="Write a short summary about yourself..."
                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white focus:outline-none focus:border-purple-500 resize-y min-h-[100px]"
                  />
                </div>
              </form>

              <div className="p-4 sm:px-6 sm:py-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button 
                  type="button"
                  onClick={handleCloseEdit}
                  className="flex-1 sm:flex-none px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="edit-profile-form"
                  disabled={loading}
                  className="flex-[2] sm:flex-none sm:ml-auto px-8 py-3 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-md shadow-purple-500/20 flex items-center justify-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD JOB APPLICATION DOCUMENT MODAL */}
      <AnimatePresence>
        {showAddDocModal && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Add Job Application Document</h3>
                <button onClick={() => setShowAddDocModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddDocSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Document Type *</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold"
                  >
                    <option value="Portfolio">Portfolio</option>
                    <option value="CV">CV (Curriculum Vitae)</option>
                    <option value="Resume">Resume</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Document Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Resume 2026"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of this document..."
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Upload File (PDF, DOC, DOCX, PNG, JPG - Max 10MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">External Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://myportfolio.com or Google Drive link"
                    value={docExternalUrl}
                    onChange={(e) => setDocExternalUrl(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="doc-is-public"
                    checked={docIsPublic}
                    onChange={(e) => setDocIsPublic(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <label htmlFor="doc-is-public" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Make publicly visible to employers on my profile
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddDocModal(false)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingDoc}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isUploadingDoc ? 'Uploading...' : 'Save Document'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE DOCUMENT CONFIRMATION MODAL */}
      <AnimatePresence>
        {docToDelete && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left"
            >
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Delete Document</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900 dark:text-white">"{docToDelete.title}"</strong>? This action cannot be undone and will remove the file permanently.
              </p>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setDocToDelete(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDocSubmit}
                  disabled={isDeletingDoc}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {isDeletingDoc ? 'Deleting...' : 'Delete Document'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
