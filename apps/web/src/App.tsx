import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Plus, UserPlus, Briefcase, DollarSign, MapPin, 
  ChevronRight, ChevronLeft, ChevronDown, Calendar, AlertCircle, RefreshCw, Compass, Eye, EyeOff, Lock,
  Mail, ShieldAlert, CheckCircle2, Send, ExternalLink, ShieldCheck
} from 'lucide-react';
import { Job, Worker, Category, Activity, Message, JobApplication, ApplicationMessage, Conversation, Work } from './types';
import { supabase, initializeRuntimeSupabase, dbService, NEXT_PUBLIC_APP_URL } from './lib/supabase';
import { signUpSchema, basicProfileSchema } from './lib/auth-schemas';
import { analytics } from './lib/analytics';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_JOBS, 
  INITIAL_WORKERS, 
  INITIAL_MESSAGES, 
  INITIAL_ACTIVITIES,
  INITIAL_CONVERSATIONS,
  INITIAL_APPLICATIONS,
  INITIAL_APP_MESSAGES
} from './data';

// Import our highly polished subcomponents
import Navbar from './components/navigation/Navbar';
import HeroSection from './components/home/HeroSection';
import OpenCommLogo from './components/common/OpenCommLogo';
import AboutPage from './components/about/AboutPage';
import SearchBar from './components/common/SearchBar';
import QuickActions from './components/home/QuickActions';
import DashboardSummary from './components/home/DashboardSummary';
import RecommendedForYou from './components/home/RecommendedForYou';
import JobsPage from './components/jobs/JobsPage';
import JobDetailPage from './components/jobs/JobDetailPage';
import WorkersPage from './components/workers/WorkersPage';
import WorkerDetailPage from './components/workers/WorkerDetailPage';
import SavedJobsPage from './components/saved/SavedJobsPage';
import SavedWorkersPage from './components/saved/SavedWorkersPage';
import MessagesPage from './components/messages/MessagesPage';
import ProfilePage from './components/profile/ProfilePage';
import MyJobPostsPage from './components/profile/MyJobPostsPage';
import MyJobsAppliedPage from './components/profile/MyJobsAppliedPage';
import ManageApplicationsPage from './components/profile/ManageApplicationsPage';
import SettingsPage from './components/settings/SettingsPage';
import HireRequestForm from './components/hiring/HireRequestForm';
import HireRequestsPage from './components/hiring/HireRequestsPage';
import HireRequestDetailsPage from './components/hiring/HireRequestDetailsPage';
import NegotiationPage from './components/hiring/NegotiationPage';
import WorkContractPage from './components/contracts/WorkContractPage';
import NotificationsPage from './components/notifications/NotificationsPage';
import NotificationSettingsPage from './components/notifications/NotificationSettingsPage';
import { ProfilePhotoUpload } from './components/ProfilePhotoUpload';
import LocationSelector from './components/common/LocationSelector';
import AvatarGalleryModal from './components/common/AvatarGalleryModal';
import { PRESET_AVATARS, DEFAULT_AVATAR_URL } from './data/presetAvatars';
import { resolveProfileImage } from './lib/avatarResolver';
import { useUnreadCounts } from './lib/unreadService';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from './data/countryCodes';
import RouteTracker from './components/common/RouteTracker';
import NotFoundPage from './components/common/NotFoundPage';

// Import our new legal pages and footer
import TermsPage from './components/legal/TermsPage';
import PrivacyPage from './components/legal/PrivacyPage';
import CommunityGuidelinesPage from './components/legal/CommunityGuidelinesPage';
import CookiePolicyPage from './components/legal/CookiePolicyPage';
import GrievancePage from './components/legal/GrievancePage';
import Footer from './components/navigation/Footer';

import AdminErrorBoundary from './components/admin/AdminErrorBoundary';
import AdminLayout from './components/admin/AdminLayout';
import UserAvatar from './components/common/UserAvatar';
import AdminDashboard from './components/admin/AdminDashboard';
import AdminUsers from './components/admin/AdminUsers';
import AdminWorkers from './components/admin/AdminWorkers';
import AdminJobs from './components/admin/AdminJobs';
import AdminCompanies from './components/admin/AdminCompanies';
import AdminVerifications from './components/admin/AdminVerifications';
import AdminReports from './components/admin/AdminReports';
import AdminMessages from './components/admin/AdminMessages';
import AdminSupport from './components/admin/AdminSupport';
import AdminContent from './components/admin/AdminContent';
import AdminAnnouncements from './components/admin/AdminAnnouncements';
import AdminSettings from './components/admin/AdminSettings';
import AdminStaff from './components/admin/AdminStaff';
import AdminAuditLogs from './components/admin/AdminAuditLogs';
import AdminContracts from './components/admin/AdminContracts';
import AdminReviews from './components/admin/AdminReviews';
import AdminNotifications from './components/admin/AdminNotifications';
import AdminFeatureFlags from './components/admin/AdminFeatureFlags';
import AdminSecurityLogs from './components/admin/AdminSecurityLogs';
import AdminSystemHealth from './components/admin/AdminSystemHealth';

export default function App() {
  // --- CORE SYSTEM STATES ---
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isJobsLoaded, setIsJobsLoaded] = useState(false);

  useEffect(() => {
    if (!isJobsLoaded) {
      dbService.getJobsFromDb().then(fetchedJobs => {
        if (fetchedJobs && fetchedJobs.length > 0) {
          setJobs(fetchedJobs);
        } else {
          setJobs([]); // Remove demo jobs if empty in DB
        }
        setIsJobsLoaded(true);
      });
    }
  }, [isJobsLoaded]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [applications, setApplications] = useState<JobApplication[]>(INITIAL_APPLICATIONS);
  const [appMessages, setAppMessages] = useState<ApplicationMessage[]>(INITIAL_APP_MESSAGES);
  
  // Custom states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Router Hooks
  const location = useLocation();
  const navigate = useNavigate();

  const handleOpenConversationForApplication = async (applicationId: string) => {
    if (!applicationId) return;
    try {
      triggerToast('Opening conversation...');
      const convId = await dbService.getOrCreateApplicationConversation(applicationId);
      if (convId) {
        navigate(`/messages/${convId}`);
      } else {
        triggerToast('Unable to open conversation. Please try again.');
      }
    } catch (err: any) {
      console.error('Error opening conversation:', err);
      triggerToast(err.message || 'Unable to open conversation.');
    }
  };

  const path = location.pathname;

  // Derive currentView from path
  let currentView = 'home';
  if (path === '/') currentView = 'home';
  else if (path.startsWith('/jobs')) currentView = 'jobs';
  else if (path.startsWith('/workers')) currentView = 'workers';
  else if (path.startsWith('/messages')) currentView = 'messages';
  else if (path === '/profile') currentView = 'profile';
  else if (path === '/profile/saved-jobs') currentView = 'saved-jobs';
  else if (path === '/profile/saved-workers') currentView = 'saved-workers';
  else if (path === '/verify-email') currentView = 'verify-email';
  else if (path === '/signup') currentView = 'signup';
  else if (path === '/login') currentView = 'login';

  // Navigate function replacing original currentView state setter
  const setCurrentView = (viewId: string) => {
    if (viewId === 'home') navigate('/');
    else if (viewId === 'jobs') navigate('/jobs');
    else if (viewId === 'workers') navigate('/workers');
    else if (viewId === 'messages') navigate('/messages');
    else if (viewId === 'profile') navigate('/profile');
    else if (viewId === 'saved-jobs') navigate('/profile/saved-jobs');
    else if (viewId === 'saved-workers') navigate('/profile/saved-workers');
    else if (viewId === 'verify-email') navigate('/verify-email');
    else if (viewId === 'signup') navigate('/signup');
    else if (viewId === 'login') navigate('/login');
  };
  
  // Dynamic User Profile
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userType, setUserType] = useState<'normal' | 'worker' | 'company'>('normal');
  const [username, setUsername] = useState('User');
  const [userIdState, setUserIdState] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState('');

  // UI Modals & Menus
  const [showPostJob, setShowPostJob] = useState(false);
  const [showCreateProfile, setShowCreateProfile] = useState(false);

  // Prevent background scroll when Worker Modal is open
  useEffect(() => {
    if (showCreateProfile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showCreateProfile]);

  const [showHireModal, setShowHireModal] = useState<Worker | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // Auth Modal States & Loading Guards
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const isSavingProfileRef = useRef(false);

  const [showAuthModal, _setShowAuthModal] = useState<'signin' | 'signup' | 'locked' | null>(null);
  const setShowAuthModal = (tab: 'signin' | 'signup' | 'locked' | null) => {
    setAuthError('');
    if (tab === 'signup') {
      if (signupStep === 1) {
        clearSignupTempState();
      }
    } else if (tab === null) {
      clearSignupTempState();
    }
    _setShowAuthModal(tab);
  };
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4>(1);
  const [signupType, setSignupType] = useState<'normal' | 'worker' | 'company'>('normal');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [selectedAccountType, setSelectedAccountType] = useState<'basic' | 'worker' | 'company'>('basic');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [whatsappSameNumber, setWhatsappSameNumber] = useState(true);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [listInWorkerDirectory, setListInWorkerDirectory] = useState(false);
  const [showOptionalWorkerDetails, setShowOptionalWorkerDetails] = useState(false);
  const [driverLicenceType, setDriverLicenceType] = useState('Commercial (LMV/HMV)');
  const [driverVehicleType, setDriverVehicleType] = useState('Car / Sedan');
  const [electricianWorkType, setElectricianWorkType] = useState('Domestic & Commercial');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarTab, setAvatarTab] = useState<'upload' | 'preset' | 'skip'>('upload');
  const [showAvatarGalleryModal, setShowAvatarGalleryModal] = useState(false);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [onboardingSubStep, setOnboardingSubStep] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>('A');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploadError, setResumeUploadError] = useState('');
  
  // Temp inputs for certificates & experience
  const [tempCert, setTempCert] = useState({ name: '', institution: '', graduationYear: new Date().getFullYear(), licenceNumber: '', trainingProgram: '' });
  const [tempExp, setTempExp] = useState({ employer: '', role: '', start_date: '', end_date: '', currently_working: false, description: '', achievements: '' });

  const [workerForm, setWorkerForm] = useState({
    fullName: '',
    phone: '',
    country: 'India',
    state: '',
    district: '',
    city: '',
    country_code: 'IN',
    state_code: '',
    latitude: 20.5937,
    longitude: 78.9629,
    preferredLanguage: 'English',
    bio: '',
    avatarUrl: '',
    professionalTitle: '',
    primaryCategory: 'Developer',
    skills: [] as string[],
    experienceLevel: 'Entry',
    availabilityStatus: 'Available Now',
    yearsExperience: 0,
    currentEmployer: '',
    hourlyRate: 75,
    expectedSalaryMin: 0,
    expectedSalaryMax: 0,
    currency: 'USD',
    workPreference: 'Remote',
    willingToRelocate: false,
    serviceRadius: 25,
    portfolioUrl: '',
    linkedinUrl: '',
    githubUrl: '',
    highestQualification: '',
    courseSpecialization: '',
    institution: '',
    graduationYear: new Date().getFullYear(),
    certifications: [] as Array<{ name: string; institution?: string; graduationYear?: number; licenceNumber?: string; trainingProgram?: string; }>,
    experience: [] as Array<{ employer: string; role: string; start_date?: string; end_date?: string; currently_working?: boolean; description?: string; achievements?: string; }>,
    resumePath: '',
    portfolioFiles: [] as string[],
    jobCategories: [] as string[],
    employmentTypes: [] as string[]
  });

  const [onboardingForm, setOnboardingForm] = useState({
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    country_code: 'US',
    state_code: 'TX',
    district: 'Travis County',
    latitude: 30.2672 as number | undefined,
    longitude: -97.7431 as number | undefined,
    preferred_language: 'English',
    bio: 'Local professional specialized in high-fidelity craftsmanship.',
    avatar_url: ''
  });

  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeVerificationInput, setShowCodeVerificationInput] = useState(false);
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [croppedFile, setCroppedFile] = useState<File | null>(null);

  const validateSubStep = (step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F') => {
    setAuthError('');
    const isWorker = listInWorkerDirectory;
    if (step === 'A') {
      if (!workerForm.fullName.trim()) return "Full name is required.";
      if (isWorker && !workerForm.avatarUrl) return "Profile photo is required.";
      if (!workerForm.phone.trim()) return "Phone number is required.";
      if (!workerForm.city.trim()) return "City is required.";
      if (!workerForm.preferredLanguage.trim()) return "Preferred language is required.";
    }
    if (step === 'B') {
      if (!workerForm.professionalTitle.trim()) return "Professional title is required.";
      if (!workerForm.primaryCategory) return "Primary category is required.";
      if (workerForm.skills.length === 0) return "At least one skill is required.";
      if (!workerForm.experienceLevel) return "Experience level is required.";
      if (!workerForm.availabilityStatus) return "Work availability status is required.";
    }
    if (step === 'F') {
      if (workerForm.jobCategories.length === 0) return "Select at least one job category of interest.";
      if (workerForm.employmentTypes.length === 0) return "Select at least one employment preference.";
    }
    return '';
  };
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    location: 'Austin, TX',
    profession: '',
    hourlyRate: 75,
    bio: '',
    companyName: '',
    industry: ''
  });

  // Redesigned authentication fields & controls state
  const [signinUsername, setSigninUsername] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isEmailNotConfirmedError, setIsEmailNotConfirmedError] = useState<boolean>(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(() => {
    return localStorage.getItem('opencomm_onboarding_completed') === 'true';
  });

  // --- AUTH CALLBACK ROUTE STATES ---
  const [authCallbackStatus, setAuthCallbackStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [authCallbackError, setAuthCallbackError] = useState<string>('');
  const [callbackEmail, setCallbackEmail] = useState<string>('');

  // --- EMAIL VERIFICATION SYSTEM STATES ---
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [pendingEmail, setPendingEmail] = useState<string>(() => {
    return localStorage.getItem('opencomm_pending_email') || '';
  });
  const [isEditingPendingEmail, setIsEditingPendingEmail] = useState<boolean>(false);
  const [editedPendingEmail, setEditedPendingEmail] = useState<string>(pendingEmail || '');
  useEffect(() => {
    setEditedPendingEmail(pendingEmail);
  }, [pendingEmail]);
  const updatePendingEmail = (email: string) => {
    setPendingEmail(email);
    localStorage.setItem('opencomm_pending_email', email);
  };
  const [showVerificationModal, setShowVerificationModal] = useState<boolean>(false);
  const [verificationActionName, setVerificationActionName] = useState<string>('');
  const [verificationSuccessCallback, setVerificationSuccessCallback] = useState<(() => void) | null>(null);
  const [mockVerificationUrl, setMockVerificationUrl] = useState<string>('');
  const [emailSentSuccessfully, setEmailSentSuccessfully] = useState<boolean>(false);

  const signupContainerRef = useRef<HTMLDivElement>(null);

  // Automatically scroll signup container to top on step transitions
  useEffect(() => {
    if (signupContainerRef.current) {
      signupContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [signupStep, onboardingSubStep]);

  // Prepopulate worker creation/upgrade modal with basic profile details when opened
  useEffect(() => {
    if (showCreateProfile && isLoggedIn) {
      const loadBasicDetailsForUpgrade = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id;
        if (!userId) return;
        try {
          const profile = await dbService.getProfile(userId);
          if (profile) {
            setNewWorkerName(profile.full_name || username || '');
            setNewWorkerBio(profile.bio || '');
            const locStr = profile.city ? `${profile.city}, ${profile.state_code || profile.state || ''}` : '';
            setNewWorkerLocation(locStr);
            setNewWorkerLocationData({
              city: profile.city || '',
              state: profile.state || '',
              country: profile.country || '',
              country_code: profile.country_code || '',
              state_code: profile.state_code || '',
              district: profile.district || '',
              latitude: profile.latitude || 30.2672,
              longitude: profile.longitude || -97.7431
            });
          }
        } catch (err) {
          console.error("Failed to load basic profile for upgrade:", err);
        }
      };
      loadBasicDetailsForUpgrade();
    }
  }, [showCreateProfile, isLoggedIn, username]);

  const isPublicPath = (pathname: string) => {
    const p = pathname.toLowerCase();
    if (p === '/' || 
        p === '/about' ||
        p === '/jobs' || 
        p === '/workers' || 
        p === '/terms' || 
        p === '/privacy' || 
        p === '/community-guidelines' || 
        p === '/cookie-policy' || 
        p === '/contact' || 
        p === '/grievance' || 
        p === '/signup' || 
        p === '/login' || 
        p === '/verify-email' ||
        p.startsWith('/auth/callback') ||
        p.startsWith('/reset-password') ||
        p.startsWith('/recovery')) {
      return true;
    }
    if (p.startsWith('/jobs/') || p.startsWith('/workers/')) {
      return true;
    }
    return false;
  };

  // --- ROUTE GUARD & ONBOARDING REDIRECT EFFECT ---
  useEffect(() => {
    if (isAuthLoading || isSavingProfileRef.current) return;

    if (isLoggedIn) {
      if (!isEmailVerified) {
        if (path !== '/verify-email') {
          navigate('/verify-email', { replace: true });
        }
      } else if (!isOnboardingCompleted) {
        if (path !== '/signup') {
          navigate('/signup', { replace: true });
        }
        _setShowAuthModal('signup');
      } else {
        // Authenticated, confirmed, onboarding completed -> NEVER REDIRECT TO SIGNUP
        _setShowAuthModal(null);
        if (path === '/signup' || path === '/login' || path === '/verify-email') {
          navigate('/', { replace: true });
        }
      }
    } else {
      // Logged out
      if (!isPublicPath(path)) {
        navigate(`/login?redirect=${encodeURIComponent(path)}`, { replace: true });
      }
    }
  }, [isLoggedIn, isEmailVerified, isOnboardingCompleted, path, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isLoggedIn) {
      if (path === '/signup') {
        _setShowAuthModal('signup');
      } else if (path === '/login') {
        _setShowAuthModal('signin');
      } else {
        _setShowAuthModal(null);
        clearSignupTempState();
      }
    }
  }, [path, isLoggedIn, isAuthLoading]);

  // Handle browser Back button and history state for signup/signin flow
  useEffect(() => {
    const handlePopState = () => {
      if (showAuthModal === 'signup' || showAuthModal === 'signin') {
        _setShowAuthModal(null);
        clearSignupTempState();
        setAuthError('');
        setLockedFeature(null);
        if (window.location.pathname === '/signup' || window.location.pathname === '/login') {
          navigate('/', { replace: true });
        }
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        const isUserLoggedIn = localStorage.getItem('opencomm_is_logged_in') === 'true';
        const isOnboarded = localStorage.getItem('opencomm_onboarding_completed') === 'true';
        if (isUserLoggedIn && isOnboarded) {
          _setShowAuthModal(null);
          if (window.location.pathname === '/signup' || window.location.pathname === '/login') {
            navigate('/', { replace: true });
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [showAuthModal, navigate]);

  // Protect routes and trigger sign in if needed
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    if (isAuthLoading || isSavingProfileRef.current) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      );
    }

    useEffect(() => {
      if (!isLoggedIn) {
        navigate(`/login?redirect=${encodeURIComponent(path)}`);
        triggerToast("Please sign in to access this page.");
      } else if (!isEmailVerified) {
        navigate('/verify-email');
        triggerToast("Please verify your email address to continue.");
      } else if (!isOnboardingCompleted) {
        navigate('/signup');
        triggerToast("Please complete your profile details to continue.");
      }
    }, [isLoggedIn, isEmailVerified, isOnboardingCompleted]);

    if (!isLoggedIn) {
      return <Navigate to={`/login?redirect=${encodeURIComponent(path)}`} replace />;
    }
    if (!isEmailVerified) {
      return <Navigate to="/verify-email" replace />;
    }
    if (!isOnboardingCompleted) {
      return <Navigate to="/signup" replace />;
    }
    return <>{children}</>;
  }

  // --- RESEND EMAIL COOLDOWN COUNTDOWN ---
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Form states for Post a Job
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobCompany, setNewJobCompany] = useState('');
  const [newJobSalary, setNewJobSalary] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobLocationData, setNewJobLocationData] = useState<any>({});
  const [newJobCategory, setNewJobCategory] = useState('Developer');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobReqs, setNewJobReqs] = useState('');
  const [newJobDeadline, setNewJobDeadline] = useState('');
  const [newJobType, setNewJobType] = useState('Full-time');
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobFormError, setJobFormError] = useState<string | null>(null);
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);

  const openEditJobModal = (jobToEdit: Job) => {
    setEditingJob(jobToEdit);
    setNewJobTitle(jobToEdit.title || '');
    setNewJobCompany(jobToEdit.company || '');
    setNewJobSalary(jobToEdit.salary || '');
    setNewJobLocation(jobToEdit.location || '');
    setNewJobCategory(jobToEdit.category || 'Developer');
    setNewJobType(jobToEdit.jobType || 'Full-time');
    setNewJobDeadline(jobToEdit.applicationDeadline ? jobToEdit.applicationDeadline.split('T')[0] : '');
    setNewJobReqs(Array.isArray(jobToEdit.requirements) ? jobToEdit.requirements.join(', ') : '');
    setNewJobDesc(jobToEdit.description || '');
    setJobFormError(null);
    setShowPostJob(true);
  };

  const handleDeleteJob = async (jobToDelete: Job) => {
    try {
      await dbService.deleteJobInDb(jobToDelete.id);
      triggerToast(`Job "${jobToDelete.title}" deleted successfully.`);
      const freshJobs = await dbService.getJobsFromDb();
      if (freshJobs) setJobs(freshJobs);
    } catch (err: any) {
      console.error('Error deleting job:', err);
      triggerToast(err.message || "Failed to delete job.");
      throw err;
    }
  };

  // Form states for Create Worker Profile
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerTitle, setNewWorkerTitle] = useState('');
  const [newWorkerRate, setNewWorkerRate] = useState(65);
  const [newWorkerLocation, setNewWorkerLocation] = useState('');
  const [newWorkerLocationData, setNewWorkerLocationData] = useState<any>({});
  const [newWorkerBio, setNewWorkerBio] = useState('');
  const [newWorkerSkills, setNewWorkerSkills] = useState('');
  const [newWorkerListingEnabled, setNewWorkerListingEnabled] = useState(true);
  const [newWorkerTermsAccepted, setNewWorkerTermsAccepted] = useState(false);

  // Form states for Hiring a Worker
  const [hireProjectTitle, setHireProjectTitle] = useState('');
  const [hireProjectDesc, setHireProjectDesc] = useState('');
  const [hireOfferRate, setHireOfferRate] = useState(0);

  // --- THEME SYNC (Manual User Preference Only - Light Default for Public) ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof localStorage !== 'undefined') {
      const isUserLoggedIn = localStorage.getItem('opencomm_is_logged_in') === 'true';
      if (isUserLoggedIn) {
        const saved = localStorage.getItem('opencomm_user_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      }
    }
    return 'light'; // Always default to Light theme for public/logged-out visitors
  });

  useEffect(() => {
    const root = document.documentElement;
    // Public / Logged-out website MUST ALWAYS be in Light Theme
    const activeTheme = isLoggedIn ? theme : 'light';

    if (activeTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }, [theme, isLoggedIn]);

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    if (!isLoggedIn) return; // Restrict theme switching to logged-in users only
    setTheme(newTheme);
    try {
      localStorage.setItem('opencomm_user_theme', newTheme);
    } catch (e) {}
  };

  // --- GOOGLE ANALYTICS INITIALIZATION & AUTO PAGE VIEW TRACKING ---
  useEffect(() => {
    analytics.init();
  }, []);

  // --- RESTORE PENDING SIGNUP STATE ---
  useEffect(() => {
    const savedPending = localStorage.getItem('opencomm_pending_email');
    if (savedPending) {
      setPendingEmail(savedPending);
      setSignupForm(prev => ({
        ...prev,
        email: savedPending,
        name: localStorage.getItem('opencomm_pending_signup_name') || prev.name,
        phone: localStorage.getItem('opencomm_pending_signup_phone') || prev.phone,
      }));
      const savedWorkerDirectory = localStorage.getItem('opencomm_pending_signup_worker_dir') === 'true';
      if (savedWorkerDirectory) {
        setListInWorkerDirectory(true);
      }
      
      setWorkerForm(prev => ({
        ...prev,
        fullName: localStorage.getItem('opencomm_pending_signup_name') || prev.fullName,
        phone: localStorage.getItem('opencomm_pending_signup_phone') || prev.phone,
        avatarUrl: localStorage.getItem('opencomm_pending_signup_avatar') || prev.avatarUrl,
        city: localStorage.getItem('opencomm_pending_signup_city') || prev.city,
        state: localStorage.getItem('opencomm_pending_signup_state') || prev.state,
        country: localStorage.getItem('opencomm_pending_signup_country') || prev.country,
        country_code: localStorage.getItem('opencomm_pending_signup_country_code') || prev.country_code,
        state_code: localStorage.getItem('opencomm_pending_signup_state_code') || prev.state_code,
        district: localStorage.getItem('opencomm_pending_signup_district') || prev.district,
        preferredLanguage: localStorage.getItem('opencomm_pending_signup_language') || prev.preferredLanguage || 'English',
        bio: localStorage.getItem('opencomm_pending_signup_bio') || prev.bio,
      }));
      
      setSignupStep(3); // Go straight to OTP verification page
    }
  }, []);

  useEffect(() => {
    analytics.trackPageView(currentView);
  }, [currentView]);

  // --- INITIALIZE SUPABASE AUTH LISTENER ---
  useEffect(() => {
    initializeRuntimeSupabase().then(() => {
      if (supabase) {
        // Fetch current session
        supabase.auth.getSession().then(({ data: { session } }: any) => {
          if (session?.user) {
            syncUserSession(session).finally(() => setIsAuthLoading(false));
          } else {
            setIsAuthLoading(false);
          }
        }).catch(() => setIsAuthLoading(false));

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
          if (session?.user) {
            await syncUserSession(session);
          } else {
            handleLogoutCleanState();
          }
          setIsAuthLoading(false);
        });

        return () => {
          subscription.unsubscribe();
        };
      } else {
        setIsAuthLoading(false);
      }
    }).catch(() => setIsAuthLoading(false));
  }, []);

  // --- DIRECT EMAIL VERIFICATION DEEP LINK REDIRECT HANDLER ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') === 'true') {
      triggerToast("Email verified successfully! All secure actions are now unlocked!");
      setIsEmailVerified(true);
      
      // Sync DB state locally
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.id) {
          dbService.getProfile(user.id).then(profile => {
            if (profile) {
              dbService.updateProfile(user.id, { email_verified_for_actions: true });
            }
          });
        }
      });

      // Clean the URL query params cleanly
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // --- AUTH CALLBACK PROCESSOR EFFECT ---
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname !== '/auth/callback') return;

    const processCallback = async () => {
      // 1. Ensure supabase client is initialized
      const client = await initializeRuntimeSupabase();
      if (!client) {
        setAuthCallbackStatus('error');
        setAuthCallbackError("Could not initialize authentication client. Please try again.");
        return;
      }

      // 2. Check for error parameters in query string
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');

      if (errorParam || errorCode || errorDesc) {
        setAuthCallbackStatus('error');
        if (errorCode === 'otp_expired' || errorDesc?.toLowerCase().includes('expired') || errorDesc?.toLowerCase().includes('otp')) {
          setAuthCallbackError("The verification link has expired or has already been used. Please request a new verification email to continue.");
        } else {
          setAuthCallbackError(errorDesc || "The verification link is invalid or has already been used. Please request a new verification email.");
        }
        return;
      }

      // 3. Check for PKCE 'code' parameter
      const code = params.get('code');
      if (code) {
        try {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          if (error) {
            setAuthCallbackStatus('error');
            const errMsg = error.message.toLowerCase();
            if (errMsg.includes('expired') || errMsg.includes('otp')) {
              setAuthCallbackError("The verification link has expired or has already been used. Please request a new verification email to continue.");
            } else {
              setAuthCallbackError(error.message);
            }
            return;
          }
          
          if (data?.session) {
            await handleCallbackSession(data.session);
            return;
          }
        } catch (err: any) {
          setAuthCallbackStatus('error');
          setAuthCallbackError(err.message || "Failed to complete authentication exchange.");
          return;
        }
      }

      // 4. If no code, check if there is an active session (e.g. parsed from hash implicit flow)
      try {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          await handleCallbackSession(session);
        } else {
          // Wait 1.5s in case hash is being parsed by SDK
          setTimeout(async () => {
            const { data: { session: delayedSession } } = await client.auth.getSession();
            if (delayedSession) {
              await handleCallbackSession(delayedSession);
            } else {
              setAuthCallbackStatus('error');
              setAuthCallbackError("No authentication session could be restored. Please try signing up again.");
            }
          }, 1500);
        }
      } catch (err: any) {
        setAuthCallbackStatus('error');
        setAuthCallbackError(err.message || "An unexpected error occurred.");
      }
    };

    const handleCallbackSession = async (session: any) => {
      const user = session.user;
      setCallbackEmail(user.email || '');
      
      // Get profile
      const profile = await dbService.getProfile(user.id);
      
      // Sync state
      await syncUserSession(session);

      setAuthCallbackStatus('success');
      
      // Clear URL and redirect
      setTimeout(() => {
        window.history.replaceState({}, '', '/');
        const isOnboarded = !!(profile?.onboarding_completed || profile?.city || profile?.bio);
        setIsOnboardingCompleted(isOnboarded);
        localStorage.setItem('opencomm_onboarding_completed', isOnboarded ? 'true' : 'false');

        if (profile && isOnboarded) {
          // Already onboarded
          setShowAuthModal(null);
          setCurrentView('home');
          triggerToast("Email verified successfully! Welcome back.");
        } else {
          // Needs onboarding
          setShowAuthModal('signup');
          setSignupStep(2);
          setSignupForm(prev => ({
            ...prev,
            email: user.email || '',
            name: user.user_metadata?.full_name || (user.email || '').split('@')[0],
            phone: user.user_metadata?.phone || ''
          }));
          triggerToast("Email verified successfully! Let's complete your profile setup.");
        }
      }, 1500);
    };

    processCallback();
  }, []);

  const syncUserSession = async (session: any) => {
    if (isSavingProfileRef.current) {
      return;
    }
    const user = session.user;
    const userId = user.id;
    const userEmail = user.email || '';
    
    // Attempt to retrieve profile from DB or Emulator
    let profile = await dbService.getProfile(userId);
    if (!profile) {
      // Create lazy profile
      profile = await dbService.updateProfile(userId, {
        id: userId,
        full_name: user.user_metadata?.full_name || userEmail.split('@')[0],
        email: userEmail,
        avatar_url: '',
        default_avatar_id: 'avatar-tech-01',
        phone: user.user_metadata?.phone || '',
        phone_verified: false,
        profile_type: 'basic',
        account_status: 'active',
        email_verified_for_actions: false,
        onboarding_completed: false
      });
    } else {
      // Rule 2 check: If profile_type is not 'basic' and email_verified_for_actions is false, safely migrate to basic.
      if (profile.profile_type !== 'basic' && !profile.email_verified_for_actions) {
        console.warn(`[Rule 2] Auto-downgrading unverified profile ${userId} from "${profile.profile_type}" to "basic"`);
        profile = await dbService.updateProfile(userId, { profile_type: 'basic' });
      }
    }
    
    // Verification status must come only from Supabase Auth
    const isVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
    setIsEmailVerified(isVerified);

    if (isVerified && !profile.email_verified_for_actions) {
      await dbService.updateProfile(userId, { email_verified_for_actions: true });
    }

    setIsLoggedIn(true);
    setUsername(profile.full_name || userEmail.split('@')[0]);
    setUserPhoto(resolveProfileImage(profile));
    setUserType(profile.profile_type as any || 'normal');

    // Restore saved user theme preference upon login
    const savedTheme = localStorage.getItem('opencomm_user_theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme as 'light' | 'dark');
    } else {
      setTheme('light');
    }

    // Removed opencomm_user_id and opencomm_is_logged_in from localStorage

    const isOnboarded = Boolean(
      profile?.onboarding_completed || 
      localStorage.getItem('opencomm_onboarding_completed') === 'true' ||
      (profile?.city && profile?.bio)
    );
    setIsOnboardingCompleted(isOnboarded);
    localStorage.setItem('opencomm_onboarding_completed', isOnboarded ? 'true' : 'false');
    
    if (!isOnboarded && !isSavingProfileRef.current) {
      _setShowAuthModal('signup');
      setSignupStep(2);
      setOnboardingSubStep('A');
      setWorkerForm(prev => ({
        ...prev,
        fullName: profile?.full_name || user.user_metadata?.full_name || userEmail.split('@')[0],
        phone: profile?.phone || user.user_metadata?.phone || '',
        avatarUrl: profile?.avatar_url || ''
      }));
    } else if (isOnboarded) {
      _setShowAuthModal(null);
      if (!profile.onboarding_completed) {
        dbService.updateProfile(userId, { onboarding_completed: true });
        profile.onboarding_completed = true;
      }
    }
  };

  function clearSignupTempState(forceClearPending = false) {
    setSignupStep(1);
    setOnboardingSubStep('A');

    setSignupForm({
      name: '',
      email: '',
      phone: '',
      location: 'Austin, TX',
      profession: '',
      hourlyRate: 75,
      bio: '',
      companyName: '',
      industry: ''
    });
    setSignupPassword('');
    setSignupConfirmPassword('');
    setSigninPassword('');
    setSelectedAccountType('basic');
    setPhoneCountryCode('+91');
    setWhatsappSameNumber(true);
    setTelegramUsername('');
    setListInWorkerDirectory(false);
    setShowOptionalWorkerDetails(false);
    setSelectedAvatar(null);
    setAvatarTab('upload');
    setAcceptTerms(false);
    setAcceptPrivacy(false);
    setVerificationCodeInput('');
    
    if (forceClearPending) {
      setPendingEmail('');
      localStorage.removeItem('opencomm_pending_email');
      localStorage.removeItem('opencomm_pending_signup_name');
      localStorage.removeItem('opencomm_pending_signup_phone');
      localStorage.removeItem('opencomm_pending_signup_country_code');
      localStorage.removeItem('opencomm_pending_signup_whatsapp');
      localStorage.removeItem('opencomm_pending_signup_telegram');
      localStorage.removeItem('opencomm_pending_signup_account_type');
      localStorage.removeItem('opencomm_pending_signup_is_worker_listed');
      localStorage.removeItem('opencomm_pending_signup_avatar');
      localStorage.removeItem('opencomm_pending_signup_city');
      localStorage.removeItem('opencomm_pending_signup_state');
      localStorage.removeItem('opencomm_pending_signup_country');
      localStorage.removeItem('opencomm_pending_signup_country_code');
      localStorage.removeItem('opencomm_pending_signup_state_code');
      localStorage.removeItem('opencomm_pending_signup_district');
      localStorage.removeItem('opencomm_pending_signup_language');
      localStorage.removeItem('opencomm_pending_signup_bio');
    }
    setCroppedFile(null);
    setResumeFile(null);
    setResumeUploadError('');
    setWorkerForm({
      fullName: '',
      phone: '',
      country: 'India',
      state: '',
      district: '',
      city: '',
      country_code: 'IN',
      state_code: '',
      latitude: 20.5937,
      longitude: 78.9629,
      preferredLanguage: 'English',
      bio: '',
      avatarUrl: '',
      professionalTitle: '',
      primaryCategory: 'Developer',
      skills: [] as string[],
      experienceLevel: 'Entry',
      availabilityStatus: 'Available Now',
      yearsExperience: 0,
      currentEmployer: '',
      hourlyRate: 75,
      expectedSalaryMin: 0,
      expectedSalaryMax: 0,
      currency: 'USD',
      workPreference: 'Remote',
      willingToRelocate: false,
      serviceRadius: 25,
      portfolioUrl: '',
      linkedinUrl: '',
      githubUrl: '',
      highestQualification: '',
      courseSpecialization: '',
      institution: '',
      graduationYear: new Date().getFullYear(),
      certifications: [] as Array<{ name: string; institution?: string; graduationYear?: number; licenceNumber?: string; trainingProgram?: string; }>,
      experience: [] as Array<{ employer: string; role: string; start_date?: string; end_date?: string; currently_working?: boolean; description?: string; achievements?: string; }>,
      resumePath: '',
      portfolioFiles: [] as string[],
      jobCategories: [] as string[],
      employmentTypes: [] as string[]
    });
  };

  const handleLogoutCleanState = () => {
    setIsLoggedIn(false);
    setIsEmailVerified(false);
    setUsername('');
    setUserPhoto('');
    setUserType('normal');
    setTheme('light'); // Reset theme state to Light Mode on logout
    
    localStorage.removeItem('opencomm_username');
    setUserIdState(null);

    // Force public DOM root back to Light Theme immediately
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';

    clearSignupTempState(true);
  };

  // --- TOAST HELPER ---
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // --- REST DATA HANDLER ---
  const handleResetData = () => {
    setJobs(INITIAL_JOBS);
    setWorkers(INITIAL_WORKERS);
    setActivities(INITIAL_ACTIVITIES);
    setMessages(INITIAL_MESSAGES);
    setConversations(INITIAL_CONVERSATIONS);
    setApplications(INITIAL_APPLICATIONS);
    setAppMessages(INITIAL_APP_MESSAGES);
    setSearchQuery('');
    setSelectedCategory(null);
    setCurrentView('home');
    
    setIsLoggedIn(true);
    setUserType('normal');
    setUsername('');
    setUserPhoto('');
    setUserType('normal');
    setIsOnboardingCompleted(false);

    localStorage.removeItem('opencomm_is_logged_in');
    localStorage.removeItem('opencomm_username');
    if (userIdState) {
      localStorage.removeItem(`opencomm_user_photo_${userIdState}`);
    }

    triggerToast("App data has been reset.");
  };

  // --- AUTH GATEWAY HELPERS ---
  const requireAuth = (actionName: string, onAuthorized: () => void) => {
    if (isLoggedIn) {
      onAuthorized();
    } else {
      setLockedFeature(actionName);
      setShowAuthModal('locked');
    }
  };

  const requireEmailVerification = async (actionName: string, onVerified: () => void) => {
    if (!isLoggedIn) {
      setLockedFeature(actionName);
      setShowAuthModal('locked');
      return;
    }

    let isVerified = isEmailVerified;
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          isVerified = Boolean(user.email_confirmed_at || user.confirmed_at);
          setIsEmailVerified(isVerified);
        }
      } catch (err) {
        console.error("Failed to check fresh verification status:", err);
      }
    }

    if (isVerified) {
      onVerified();
    } else {
      setVerificationActionName(actionName);
      setVerificationSuccessCallback(() => onVerified);
      setAuthError('');
      setEmailSentSuccessfully(false);
      setShowVerificationModal(true);
    }
  };

  const checkEmailVerificationFreshStatus = async () => {
    setAuthError('');
    if (!supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }

    try {
      setIsAuthSubmitting(true);
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user) {
        // 8. Verification status must come only from Supabase Auth
        const isVerified = Boolean(user.email_confirmed_at || user.confirmed_at);
        setIsEmailVerified(isVerified);
        if (isVerified) {
          try {
            await supabase
              .from('profiles')
              .update({ email_verified_for_actions: true })
              .eq('id', user.id);
          } catch (profileErr) {
            console.error("Failed to sync profile email verification status:", profileErr);
          }

          triggerToast("Email verified! Feature unlocked.");
          setShowVerificationModal(false);
          if (verificationSuccessCallback) {
            verificationSuccessCallback();
          }
        } else {
          setAuthError("Email verification is still pending. Please click the confirmation link in your inbox first.");
        }
      } else {
        setAuthError("No authenticated session found.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to fetch verification status.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleResendVerificationInModal = async () => {
    setAuthError('');
    if (resendCooldown > 0) return;
    
    if (!supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }

    try {
      setIsAuthSubmitting(true);
      
      let emailToResend = '';
      let userId = '';
      let accessToken = '';

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        emailToResend = session.user.email || '';
        userId = session.user.id;
        accessToken = session.access_token;
      }

      if (!emailToResend) {
        setAuthError("No email address found to dispatch verification.");
        setIsAuthSubmitting(false);
        return;
      }

      const res = await fetch('/api/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          email: emailToResend,
          userId,
          redirectAction: verificationActionName || ''
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch verification email.");
      }

      setResendCooldown(60);
      setEmailSentSuccessfully(true);
      triggerToast("Verification email dispatched successfully!");
    } catch (err: any) {
      const errMsg = (err.message || "").toLowerCase();
      if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || errMsg.includes('too many requests')) {
        setAuthError("Rate limit reached. Please wait a moment before trying again.");
      } else {
        setAuthError(err.message || "Failed to resend verification email.");
      }
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLoginSuccess = (uName: string, uType: 'normal' | 'worker' | 'company') => {
    setIsLoggedIn(true);
    setUserType(uType);
    setUsername(uName);
    analytics.trackLogin('direct', uName);
    
    const pickedPhoto = '';
    setUserPhoto(pickedPhoto);

    localStorage.setItem('opencomm_is_logged_in', 'true');
    localStorage.setItem('opencomm_user_type', uType);
    localStorage.setItem('opencomm_username', uName);
    if (userIdState) {
      localStorage.setItem(`opencomm_user_photo_${userIdState}`, pickedPhoto);
    }
    localStorage.setItem('opencomm_onboarding_completed', 'true');
    setIsOnboardingCompleted(true);

    if (uType === 'worker') {
      const alreadyExists = workers.some(w => w.name.toLowerCase() === uName.toLowerCase());
      if (!alreadyExists) {
        const newW: Worker = {
          id: `worker-user-${Date.now()}`,
          name: uName,
          title: signupForm.profession || 'Contractor Specialist',
          hourlyRate: Number(signupForm.hourlyRate) || 75,
          rating: 5.0,
          completedWorks: 0,
          skills: signupForm.profession ? [signupForm.profession, 'Local Care'] : ['Bespoke Custom Work', 'Escrow Guarded'],
          location: signupForm.location || 'Austin, TX',
          bio: signupForm.bio || 'Newly registered local provider ready for certified milestones.',
          photo: pickedPhoto,
          verified: true,
          experience: 1,
          availability: 'Available Now'
        };
        setWorkers(prev => [newW, ...prev]);
      }
    }

    const newAct: Activity = {
      id: `act-login-${Date.now()}`,
      type: 'complete',
      title: `Logged in as ${uName}`,
      status: 'Active Session',
      statusType: 'success',
      timestamp: 'Just now'
    };
    setActivities(prev => [newAct, ...prev]);

    triggerToast(`Welcome back, ${uName}!`);
    setShowAuthModal(null);
    setLockedFeature(null);
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error signing out of Supabase:", err);
      }
    }
    handleLogoutCleanState();
    setCurrentView('home');
    navigate('/', { replace: true });
    triggerToast("Signed out. Browse view initialized.");
  };

  // --- MULTI-STEP SIGNUP FLOW HANDLERS ---

  // --- SINGLE-PAGE SIGNUP SUBMIT HANDLER ---

  const handleSinglePageSignUp = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');

    if (selectedAccountType === 'company') {
      setAuthError("Company Account registration is Coming Soon. Please choose Worker Account or continue with a Basic Account.");
      return;
    }

    if (!acceptTerms || !acceptPrivacy) {
      setAuthError("You must read and agree to both the Terms of Service and Privacy Policy.");
      return;
    }

    // Validate Section 1 using Zod signUpSchema (passwords only validated if logged-out)
    if (!isLoggedIn) {
      const parseResult = signUpSchema.safeParse({
        full_name: signupForm.name,
        email: signupForm.email,
        phone: signupForm.phone,
        password: signupPassword,
        confirm_password: signupConfirmPassword,
        accept_terms: acceptTerms && acceptPrivacy
      });

      if (!parseResult.success) {
        const firstError = parseResult.error.issues[0]?.message || 'Invalid registration details';
        setAuthError(firstError);
        return;
      }
    } else {
      if (!signupForm.name || !signupForm.name.trim()) {
        setAuthError("Full Name is required.");
        return;
      }
      if (!signupForm.phone || !signupForm.phone.trim()) {
        setAuthError("Phone Number is required.");
        return;
      }
    }

    const isWorker = listInWorkerDirectory;

    // Validate Profile Picture or Avatar is required for all accounts
    if (!workerForm.avatarUrl && !selectedAvatar && !croppedFile) {
      setAuthError("Please upload a profile photo or select a valid avatar to continue.");
      return;
    }

    // Validate Section 2 if Worker Account is selected
    if (isWorker) {
      if (!workerForm.city) {
        setAuthError("Please select a base location for your worker profile.");
        return;
      }
      if (!workerForm.preferredLanguage || !workerForm.preferredLanguage.trim()) {
        setAuthError("Please enter your preferred language.");
        return;
      }
    }

    if (!supabase) {
      setAuthError("Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setIsAuthSubmitting(true);

    // Case 1: Already logged in, save profile changes directly
    if (isLoggedIn) {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) {
        setAuthError("No active user session found.");
        setIsAuthSubmitting(false);
        return;
      }
      try {
        const formFullName = signupForm.name.trim() || workerForm.fullName.trim() || 'User';
        const formPhone = signupForm.phone.trim() || workerForm.phone.trim();
        const formBio = workerForm.bio.trim();
        let finalAvatarUrl = workerForm.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

        // Upload cropped avatar file if exists
        if (croppedFile) {
          const safeExtension = croppedFile.type === 'image/png' ? 'png' : croppedFile.type === 'image/webp' ? 'webp' : 'jpg';
          const filePath = `${userId}/${Date.now()}-profile.${safeExtension}`;
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, croppedFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: croppedFile.type
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);
            finalAvatarUrl = publicUrlData.publicUrl;
          }
        }

        const profilePayload = {
          id: userId,
          full_name: formFullName,
          phone: formPhone,
          city: workerForm.city,
          state: workerForm.state,
          country: workerForm.country,
          country_code: workerForm.country_code,
          state_code: workerForm.state_code,
          district: workerForm.district,
          latitude: workerForm.latitude,
          longitude: workerForm.longitude,
          preferred_language: workerForm.preferredLanguage,
          bio: formBio,
          avatar_url: finalAvatarUrl,
          profile_type: (isWorker ? 'worker' : 'basic') as 'worker' | 'basic',
          account_status: 'active' as const,
          email_verified_for_actions: true,
          onboarding_completed: true,
          whatsapp_preference: whatsappSameNumber,
          telegram_username: telegramUsername
        };

        const savedProfile = await dbService.updateProfile(userId, profilePayload);
        if (!savedProfile) {
          throw new Error("Failed to save user profile. Please try again.");
        }

        if (isWorker) {
          await dbService.createWorkerProfile({
            id: userId,
            profession: workerForm.professionalTitle,
            skills: workerForm.skills,
            experience_years: workerForm.experienceLevel === 'Senior' ? 5 : workerForm.experienceLevel === 'Mid' ? 2 : 0,
            work_location: `${workerForm.city}, ${workerForm.state}`,
            availability: 'Available Now',
            bio_summary: formBio,
            hourly_rate: workerForm.hourlyRate || 75,
            expected_salary: workerForm.expectedSalaryMin && workerForm.expectedSalaryMax ? `₹${workerForm.expectedSalaryMin} – ₹${workerForm.expectedSalaryMax}/mo` : '',
            portfolio_url: workerForm.portfolioUrl
          });

          const mappedWorker: Worker = {
            id: userId,
            name: formFullName,
            photo: finalAvatarUrl,
            title: workerForm.professionalTitle || 'Independent Provider',
            experience: 1,
            rating: 5.0,
            availability: 'Available Now',
            location: `${workerForm.city}, ${workerForm.state}`,
            bio: formBio,
            skills: workerForm.skills.length > 0 ? workerForm.skills : ['Local Care', 'Bespoke Custom Work'],
            completedWorks: 0,
            hourlyRate: workerForm.hourlyRate || 75,
            verified: true
          };
          setWorkers(prev => [mappedWorker, ...prev.filter(w => w.id !== userId)]);
        }

        setIsOnboardingCompleted(true);
        localStorage.setItem('opencomm_onboarding_completed', 'true');
        setUsername(formFullName);
        setUserPhoto(finalAvatarUrl);
        setUserType(isWorker ? 'worker' : 'normal');
        localStorage.setItem('opencomm_username', formFullName);
        if (userId) {
          localStorage.setItem(`opencomm_user_photo_${userId}`, finalAvatarUrl);
        }
        localStorage.setItem('opencomm_user_type', isWorker ? 'worker' : 'normal');

        clearSignupTempState(true);
        _setShowAuthModal(null);
        setLockedFeature(null);
        setIsAuthSubmitting(false);
        triggerToast("Profile onboarding completed successfully!");

      } catch (err: any) {
        setIsAuthSubmitting(false);
        setAuthError(err.message || "Failed to save profile.");
      }
      return;
    }

    // Case 2: Logged-out user signing up
    try {
      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', signupForm.email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        setIsAuthSubmitting(false);
        setAuthError("This email address is already registered. Please sign in instead.");
        return;
      }

      setWorkerForm(prev => ({
        ...prev,
        fullName: signupForm.name,
        phone: signupForm.phone,
      }));

      // Submit actual signup request to Supabase
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email.trim().toLowerCase(),
        password: signupPassword,
        options: {
          emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
          data: {
            full_name: signupForm.name,
            phone: signupForm.phone
          }
        }
      });

      setIsAuthSubmitting(false);

      if (error) {
        console.error("SIGNUP API ERROR:", error);
        
        let errorText = "Registration failed.";
        if (typeof error === 'object' && error !== null) {
          errorText = error.message || (error as any).error_description || JSON.stringify(error);
        } else if (typeof error === 'string') {
          errorText = error;
        }

        const errMsg = String(errorText).toLowerCase();
        if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
          setAuthError("This email address is already registered. Please sign in instead.");
        } else if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || errMsg.includes('too many requests')) {
          setAuthError("Rate limit reached. Please wait a moment before trying again.");
        } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
          setAuthError("Network error. Please check your connection and try again.");
        } else {
          setAuthError(errorText === "{}" ? "An unknown database error occurred during signup." : errorText);
        }
        return;
      }

      const user = data?.user;
      if (!user) {
        setAuthError("An unexpected error occurred during account creation. Please try again.");
        return;
      }

      // Store verification details and form state in localStorage so progress is not lost
      updatePendingEmail(signupForm.email);
      setVerificationCodeInput('');
      
      localStorage.setItem('opencomm_pending_signup_name', signupForm.name);
      localStorage.setItem('opencomm_pending_signup_phone', signupForm.phone);
      localStorage.setItem('opencomm_pending_signup_worker_dir', listInWorkerDirectory ? 'true' : 'false');
      if (isWorker) {
        localStorage.setItem('opencomm_pending_signup_avatar', workerForm.avatarUrl || '');
        localStorage.setItem('opencomm_pending_signup_city', workerForm.city || '');
        localStorage.setItem('opencomm_pending_signup_state', workerForm.state || '');
        localStorage.setItem('opencomm_pending_signup_country', workerForm.country || '');
        localStorage.setItem('opencomm_pending_signup_country_code', workerForm.country_code || '');
        localStorage.setItem('opencomm_pending_signup_state_code', workerForm.state_code || '');
        localStorage.setItem('opencomm_pending_signup_district', workerForm.district || '');
        localStorage.setItem('opencomm_pending_signup_language', workerForm.preferredLanguage || '');
        localStorage.setItem('opencomm_pending_signup_bio', workerForm.bio || '');
      }

      // Move to Stage 3: Email OTP Verification
      setSignupStep(3);
      triggerToast("Account registered! A 6-digit verification code has been sent to your email.");
      analytics.trackSignUp('email', user.id);

    } catch (err: any) {
      console.error("SIGNUP EXCEPTION:", err);
      setIsAuthSubmitting(false);
      
      let errorText = "Registration failed.";
      if (typeof err === 'object' && err !== null) {
        errorText = err.message || (err as any).error_description || JSON.stringify(err);
      } else if (typeof err === 'string') {
        errorText = err;
      }

      const errMsg = String(errorText).toLowerCase();
      if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || errMsg.includes('too many requests')) {
        setAuthError("Rate limit reached. Please wait a moment before trying again.");
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setAuthError("Network error. Please check your connection and try again.");
      } else {
        setAuthError(errorText === "{}" ? "Registration failed due to an unknown database error." : errorText);
      }
    }
  };

  const handleVerifyOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError('');
    
    const otp = verificationCodeInput.trim();
    if (!otp || otp.length !== 6) {
      setAuthError("Please enter a valid 6-digit OTP code.");
      return;
    }

    const emailToVerify = pendingEmail || signupForm.email;
    if (!emailToVerify) {
      setAuthError("No pending email address found to verify.");
      return;
    }

    if (!supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }

    setIsAuthSubmitting(true);
    isSavingProfileRef.current = true;

    try {
      // 1. Verify OTP using 'email' or fallback 'signup'
      let result = await supabase.auth.verifyOtp({
        email: emailToVerify.trim().toLowerCase(),
        token: otp,
        type: 'email'
      });

      if (result.error) {
        const signupResult = await supabase.auth.verifyOtp({
          email: emailToVerify.trim().toLowerCase(),
          token: otp,
          type: 'signup'
        });
        if (!signupResult.error) {
          result = signupResult;
        }
      }

      const { data, error } = result;

      if (error || !data?.user) {
        throw new Error("Invalid or expired verification code.");
      }

      // 2. Verify Session & User
      let session = data.session;
      if (!session) {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        session = freshSession;
      }

      if (!session) {
        throw new Error("Invalid or expired verification code.");
      }

      const authUser = data.user;
      if (authUser.email?.trim().toLowerCase() !== emailToVerify.trim().toLowerCase()) {
        throw new Error("Invalid or expired verification code.");
      }

      const emailConfirmed = Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
      if (!emailConfirmed) {
        throw new Error("Invalid or expired verification code.");
      }

      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult?.user) {
        throw new Error("Invalid or expired verification code.");
      }

      const verifiedUser = userResult.user;

      // Preserve form values prior to async calls
      const formFullName = workerForm.fullName.trim() || signupForm.name.trim() || verifiedUser.email?.split('@')[0] || 'User';
      const formPhone = workerForm.phone.trim() || signupForm.phone.trim();
      const formBio = workerForm.bio.trim();

      // 3. Handle Avatar Storage / Linking
      let finalAvatarUrl = '';
      let finalAvatarId = '';

      if (croppedFile) {
        try {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          });

          const safeExtension =
            croppedFile.type === 'image/png'
              ? 'png'
              : croppedFile.type === 'image/webp'
                ? 'webp'
                : 'jpg';

          const filePath = `${verifiedUser.id}/${Date.now()}-profile.${safeExtension}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, croppedFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: croppedFile.type
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filePath);
            finalAvatarUrl = publicUrlData.publicUrl;
          }
        } catch (e) {
          console.warn("Avatar upload warning:", e);
        }
      } else if (workerForm.avatarUrl || selectedAvatar) {
        const urlToMatch = selectedAvatar || workerForm.avatarUrl;
        const presetMatch = PRESET_AVATARS.find(p => p.url === urlToMatch);
        if (presetMatch) {
          finalAvatarId = presetMatch.id;
        } else {
          finalAvatarUrl = urlToMatch || '';
        }
      }

      // 4. Upload resume file if present
      if (resumeFile) {
        try {
          const resumeExt = resumeFile.name.split('.').pop()?.toLowerCase();
          const resumePath = `${verifiedUser.id}/${Date.now()}-resume.${resumeExt}`;
          const { error: uploadResErr } = await supabase.storage
            .from('resumes')
            .upload(resumePath, resumeFile, {
              cacheControl: '3600',
              upsert: false,
              contentType: resumeFile.type
            });
          if (!uploadResErr) {
            workerForm.resumePath = resumePath;
          }
        } catch (e) {
          console.warn("Resume upload warning:", e);
        }
      }

      // 5. Update core profile with onboarding_completed = true
      const isWorker = listInWorkerDirectory;

      const profilePayload = {
        id: verifiedUser.id,
        full_name: formFullName,
        email: emailToVerify,
        phone: `${phoneCountryCode} ${formPhone}`,
        phone_country_code: phoneCountryCode,
        phone_number: formPhone,
        whatsapp_same_as_phone: whatsappSameNumber,
        telegram_username: telegramUsername,
        city: workerForm.city,
        state: workerForm.state,
        country: workerForm.country,
        country_code: workerForm.country_code,
        state_code: workerForm.state_code,
        district: workerForm.district,
        latitude: workerForm.latitude,
        longitude: workerForm.longitude,
        preferred_language: workerForm.preferredLanguage,
        bio: formBio || signupForm.bio,
        short_bio: signupForm.bio || formBio,
        avatar_url: '',
        profile_image_url: finalAvatarUrl || undefined,
        avatar_id: finalAvatarId || undefined,
        profile_type: (isWorker ? 'worker' : 'basic') as 'worker' | 'basic',
        is_worker_listed: isWorker,
        account_status: 'active' as const,
        email_verified_for_actions: true,
        onboarding_completed: true
      };

      const savedProfile = await dbService.updateProfile(verifiedUser.id, profilePayload);
      if (!savedProfile) {
        throw new Error("Failed to save user profile. Please try again.");
      }

      // 6. Create worker profile if selected
      if (isWorker) {
        await dbService.createWorkerProfile({
          id: verifiedUser.id,
          profession: workerForm.professionalTitle,
          skills: workerForm.skills,
          experience_years: workerForm.yearsExperience,
          work_location: `${workerForm.city}, ${workerForm.state}`,
          availability: workerForm.availabilityStatus as any,
          bio_summary: formBio,
          hourly_rate: workerForm.hourlyRate,
          expected_salary: workerForm.expectedSalaryMin && workerForm.expectedSalaryMax ? `₹${workerForm.expectedSalaryMin} – ₹${workerForm.expectedSalaryMax}/mo` : '',
          portfolio_url: workerForm.portfolioUrl
        });

        const mappedWorker: Worker = {
          id: verifiedUser.id,
          name: formFullName,
          photo: finalAvatarUrl,
          title: workerForm.professionalTitle,
          experience: Number(workerForm.yearsExperience) || 0,
          rating: 5.0,
          availability: workerForm.availabilityStatus as any || 'Available Now',
          location: `${workerForm.city}, ${workerForm.state}`,
          bio: formBio,
          skills: workerForm.skills,
          completedWorks: 0,
          hourlyRate: Number(workerForm.hourlyRate) || 0,
          verified: true
        };

        setWorkers(prev => [mappedWorker, ...prev.filter(w => w.id !== verifiedUser.id)]);
      }

      // 7. Log terms consent
      await dbService.logTermsConsent({
        user_id: verifiedUser.id,
        terms_version: "2026-07-19-v1",
        privacy_version: "2026-07-19-v1",
        account_type: isWorker ? 'worker' : 'basic'
      });

      // 8. Update in-memory & localStorage auth states
      setIsLoggedIn(true);
      setIsEmailVerified(true);
      setIsOnboardingCompleted(true);
      const resolvedPhoto = resolveProfileImage(profilePayload as any);
      setUsername(formFullName);
      setUserPhoto(resolvedPhoto);
      setUserType(isWorker ? 'worker' : 'normal');

      localStorage.setItem('opencomm_is_logged_in', 'true');
      localStorage.setItem('opencomm_username', formFullName);
      localStorage.setItem(`opencomm_user_photo_${verifiedUser.id}`, resolvedPhoto);
      setUserIdState(verifiedUser.id);
      setUserIdState(verifiedUser.id);
      localStorage.setItem('opencomm_user_type', isWorker ? 'worker' : 'normal');
      localStorage.setItem('opencomm_onboarding_completed', 'true');

      // 9. Clear temporary signup state AFTER DB save
      clearSignupTempState(true);
      setSignupStep(1);
      _setShowAuthModal(null);
      setLockedFeature(null);
      setIsAuthSubmitting(false);
      isSavingProfileRef.current = false;

      triggerToast("Verification successful! Welcome to OpenComm.");
      navigate('/', { replace: true });

      // 10. Replace navigation to home
      const queryParams = new URLSearchParams(window.location.search);
      const redirectPath = queryParams.get('redirect');
      if (redirectPath && redirectPath !== '/signup' && redirectPath !== '/login') {
        navigate(redirectPath, { replace: true });
      } else {
        navigate('/', { replace: true });
      }

    } catch (err: any) {
      console.error("VERIFY OTP EXCEPTION:", err);
      isSavingProfileRef.current = false;
      setIsAuthSubmitting(false);
      setVerificationCodeInput('');
      
      let errorText = "Invalid or expired verification code.";
      if (typeof err === 'object' && err !== null) {
        errorText = err.message || (err as any).error_description || JSON.stringify(err);
      } else if (typeof err === 'string') {
        errorText = err;
      }
      
      setAuthError(errorText === "{}" ? "Verification failed due to an unknown database error." : errorText);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setAuthError('');
    
    const emailToResend = pendingEmail || signupForm.email;
    if (!emailToResend) {
      setAuthError("No pending email address found.");
      return;
    }

    if (!supabase) {
      setAuthError("Supabase is not configured.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToResend.trim().toLowerCase()
      });

      setIsAuthSubmitting(false);

      if (error) {
        setAuthError(error.message);
        return;
      }

      setResendCooldown(60);
      triggerToast("A new 6-digit OTP code has been sent to your email.");
    } catch (err: any) {
      setIsAuthSubmitting(false);
      setAuthError(err.message || "Failed to resend OTP.");
    }
  };

  const handleResendVerificationEmail = async () => {
    if (resendCooldown > 0) return;
    setAuthError('');
    setIsAuthSubmitting(true);

    if (supabase) {
      try {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: signupForm.email,
          options: {
            emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`
          }
        });

        setIsAuthSubmitting(false);

        if (error) {
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || errMsg.includes('too many requests')) {
            setAuthError("Rate limit reached. Please wait a moment before trying again.");
          } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
            setAuthError("Network error. Please check your connection and try again.");
          } else {
            setAuthError(error.message);
          }
          return;
        }

        setResendCooldown(60);
        triggerToast("Verification email re-dispatched!");
      } catch (err: any) {
        setIsAuthSubmitting(false);
        const errMsg = (err.message || "").toLowerCase();
        if (errMsg.includes('rate limit') || errMsg.includes('rate_limit') || errMsg.includes('too many requests')) {
          setAuthError("Rate limit reached. Please wait a moment before trying again.");
        } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
          setAuthError("Network error. Please check your connection and try again.");
        } else {
          setAuthError(err.message || "Failed to resend verification email.");
        }
      }
    } else {
      setIsAuthSubmitting(false);
      setAuthError("Supabase is not configured.");
    }
  };

  // --- ACTIONS ---
  const toggleBookmark = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth('Save Jobs', () => {
      setJobs(prev => prev.map(j => {
        if (j.id === jobId) {
          const nextState = !j.bookmarked;
          triggerToast(nextState ? `Saved "${j.title}" to bookmarks.` : `Removed "${j.title}" from bookmarks.`);
          return { ...j, bookmarked: nextState };
        }
        return j;
      }));
    });
  };

  const toggleWorkerBookmark = (workerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth('Save Workers', () => {
      setWorkers(prev => prev.map(w => {
        if (w.id === workerId) {
          const nextState = !(w as any).bookmarked;
          triggerToast(nextState ? `Saved "${w.name}" to bookmarked professionals.` : `Removed "${w.name}" from bookmarks.`);
          return { ...w, bookmarked: nextState };
        }
        return w;
      }));
    });
  };

  const handleApplyJob = (jobId: string, bidOrEvent?: any, note?: string) => {
    requireEmailVerification("Apply to Job", () => {
      let bid = '$75/hr';
      let applicationNote = 'I would like to apply for this position and coordinate terms.';
      if (typeof bidOrEvent === 'string') {
        bid = bidOrEvent;
        applicationNote = note || applicationNote;
      } else if (bidOrEvent && bidOrEvent.stopPropagation) {
        bidOrEvent.stopPropagation();
      }

      setJobs(prev => prev.map(j => {
        if (j.id === jobId) {
          if (j.applied) return j;
          
          // Add active Application object
          const newApp: JobApplication = {
            id: `app-${Date.now()}`,
            jobId: j.id,
            jobTitle: j.title,
            applicantId: 'user',
            applicantName: username,
            applicantPhoto: userPhoto,
            applicantTitle: 'Product Architect & Tech Lead',
            applicantSkills: ['TypeScript', 'React', 'Tailwind CSS', 'System Design'],
            applicantLocation: 'Austin, TX',
            applicantRating: 4.9,
            applicantExperience: 8,
            applicantAvailability: 'Available Now',
            ownerId: j.company === 'OpenComm Labs' ? 'user' : 'company-other',
            ownerName: j.company,
            applicationNote: applicationNote,
            status: 'Pending',
            createdAt: 'Just now',
            updatedAt: 'Just now',
            bid: bid
          };
          setApplications(prevApp => [newApp, ...prevApp]);
          analytics.trackJobApplied(jobId, applicationNote.length);

          // Add activity
          const newAct: Activity = {
            id: `act-${Date.now()}`,
            type: 'apply',
            title: `Applied to ${j.title} at ${j.company}`,
            status: 'In Review',
            statusType: 'pending',
            timestamp: 'Just now'
          };
          setActivities(prevAct => [newAct, ...prevAct]);

          triggerToast(`Successfully applied to "${j.title}"!`);
          return { ...j, applied: true };
        }
        return j;
      }));
    });
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Audit] Submit clicked');
    setJobFormError(null);

    const { data: { user } } = await supabase.auth.getUser();
    const loggedInId = user?.id;
    if (!loggedInId) {
      setJobFormError("You must be logged in to post a job.");
      return;
    }

    // Validation
    const missingFields = [];
    if (!newJobTitle.trim()) missingFields.push('Job Title');
    if (!newJobCompany.trim()) missingFields.push('Company');
    if (!newJobSalary.trim()) missingFields.push('Salary or Budget');
    if (!newJobDeadline.trim()) missingFields.push('Application Deadline');
    if (!newJobLocation.trim()) missingFields.push('Location');
    if (!newJobCategory.trim()) missingFields.push('Category');
    if (!newJobDesc.trim()) missingFields.push('Description');

    if (missingFields.length > 0) {
      const errorMsg = `Please fill out required fields: ${missingFields.join(', ')}`;
      setJobFormError(errorMsg);
      console.log('[Audit] Validation failed:', missingFields);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (newJobDeadline < todayStr) {
      setJobFormError("Application deadline cannot be earlier than today.");
      console.log('[Audit] Validation failed: Deadline in past');
      return;
    }

    if (!isLoggedIn || !loggedInId) {
      setJobFormError("You must be logged in to post a job.");
      console.log('[Audit] Validation failed: Not logged in');
      return;
    }

    console.log('[Audit] Validation passed');
    console.log('[Audit] Current user ID:', loggedInId);

    const jobPayload = {
      title: newJobTitle.trim(),
      company: newJobCompany.trim(),
      salary: newJobSalary.includes('₹') ? newJobSalary : `₹${newJobSalary}`,
      location: newJobLocation.trim(),
      category: newJobCategory,
      jobType: newJobType,
      applicationDeadline: newJobDeadline.trim(),
      description: newJobDesc.trim(),
      requirements: newJobReqs ? newJobReqs.split(',').map(r => r.trim()).filter(Boolean) : ['Immediate availability']
    };

    setIsSubmittingJob(true);

    try {
      if (editingJob) {
        // EDIT MODE
        const updatedJob = await dbService.updateJobInDb(editingJob.id, jobPayload);
        if (updatedJob) {
          triggerToast(`Job "${newJobTitle}" updated successfully!`);
          setShowPostJob(false);
          setEditingJob(null);
          setJobFormError(null);

          const freshJobs = await dbService.getJobsFromDb();
          if (freshJobs) setJobs(freshJobs);
        }
      } else {
        // CREATE MODE
        const finalJob = await dbService.createJobInDb(jobPayload, loggedInId);
        if (finalJob) {
          triggerToast(`Job "${newJobTitle}" published successfully!`);
          setShowPostJob(false);
          setJobFormError(null);
          
          const freshJobs = await dbService.getJobsFromDb();
          if (freshJobs && freshJobs.length > 0) setJobs(freshJobs);

          navigate(`/jobs/${finalJob.id}`);
        }
      }
    } catch (err: any) {
      console.error('[Audit] Job submit error:', err);
      setJobFormError(err.message || "Failed to save job to the database.");
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerTitle.trim()) {
      triggerToast("Please provide a professional title.");
      return;
    }

    if (!newWorkerTermsAccepted) {
      triggerToast("Please accept the Worker Terms and Conditions before proceeding.");
      return;
    }

    try {
      const skillsArray = newWorkerSkills ? newWorkerSkills.split(',').map(s => s.trim()).filter(Boolean) : ['Professional'];
      
      await dbService.createMyWorkerProfile({
        profession: newWorkerTitle.trim(),
        skills: skillsArray,
        experience_years: 2,
        work_location: newWorkerLocation.trim() || undefined,
        availability: 'Available Now',
        bio_summary: newWorkerBio.trim() || undefined,
        hourly_rate: Number(newWorkerRate) || 75
      });

      analytics.trackWorkerProfileCreated({
        profession: newWorkerTitle,
        skills: skillsArray,
        rate: Number(newWorkerRate) || 75
      });

      triggerToast("Worker profile created successfully.");
      
      setUserType('worker');
      localStorage.setItem('opencomm_user_type', 'worker');
      setShowCreateProfile(false);

      setNewWorkerName('');
      setNewWorkerTitle('');
      setNewWorkerRate(75);
      setNewWorkerLocation('');
      setNewWorkerSkills('');
      setNewWorkerBio('');
      setNewWorkerTermsAccepted(false);
      setNewWorkerListingEnabled(true);
    } catch (err: any) {
      console.error("Worker creation failed:", err);
      triggerToast(err.message || "Failed to create worker profile. Please try again.");
    }
  };

  const triggerHireModal = (worker: Worker, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userIdState && worker.id === userIdState) {
      triggerToast("You cannot hire yourself.");
      return;
    }
    requireEmailVerification("Send Hiring Offer", () => {
      setShowHireModal(worker);
      setHireOfferRate(worker.hourlyRate);
      setHireProjectTitle(`Bespoke ${worker.title.split(' ')[0] || 'Consultation'}`);
    });
  };

  const handleHireWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showHireModal) return;

    if (userIdState && showHireModal.id === userIdState) {
      triggerToast("You cannot hire yourself.");
      setShowHireModal(null);
      return;
    }

    const newAct: Activity = {
      id: `act-${Date.now()}`,
      type: 'hire',
      title: `Hired ${showHireModal.name} for "${hireProjectTitle}"`,
      status: 'Awaiting Response',
      statusType: 'pending',
      timestamp: 'Just now'
    };
    setActivities(prev => [newAct, ...prev]);

    triggerToast(`Hiring contract offer transmitted securely to ${showHireModal.name}!`);
    setShowHireModal(null);
    setHireProjectTitle('');
    setHireProjectDesc('');
  };

  const handleOpenDirectMessage = (contactName: string) => {
    requireEmailVerification("Direct Messaging", () => {
      // Switch to messages page and auto-select contact
      setCurrentView('messages');
      triggerToast(`Opening direct conversation with ${contactName}...`);
      analytics.trackChatOpened(contactName);
    });
  };

  // --- REAL DASHBOARD STATS (loaded from DB on login) ---
  const [dashMyPostsCount, setDashMyPostsCount] = React.useState(0);
  const [dashMyWorksCount, setDashMyWorksCount] = React.useState(0);
  const [dashSavedJobsCount, setDashSavedJobsCount] = React.useState(0);
  const [dashSavedWorkersCount, setDashSavedWorkersCount] = React.useState(0);

  React.useEffect(() => {
    if (!isLoggedIn || !userIdState) return;
    let cancelled = false;
    (async () => {
      try {
        const [posts, savedJobs, savedWorkers, myWorksRes] = await Promise.all([
          dbService.getMyJobPostsCount(userIdState).catch(() => 0),
          dbService.getSavedJobsCount(userIdState).catch(() => 0),
          dbService.getSavedWorkersCount(userIdState).catch(() => 0),
          dbService.getMyJobApplications(userIdState).catch(() => ({ data: [], error: null })),
        ]);
        if (!cancelled) {
          setDashMyPostsCount(posts);
          setDashSavedJobsCount(savedJobs);
          setDashSavedWorkersCount(savedWorkers);
          setDashMyWorksCount(myWorksRes?.data?.length || 0);
        }
      } catch { /* silently ignore */ }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, userIdState]);

  const unreadCounts = useUnreadCounts(isLoggedIn ? userIdState : null);
  const unreadMessagesCount = unreadCounts.messageCount;
  const unreadWorkflowCount = unreadCounts.workflowCount;

  if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1020] text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-center p-4">
        {/* Glowing Background Accent */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-500/5 dark:bg-blue-600/5 rounded-full blur-[130px] pointer-events-none -z-10" />
        
        <div className="w-full max-w-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          {authCallbackStatus === 'processing' && (
            <>
              <div className="w-16 h-16 bg-blue-500/10 dark:bg-blue-600/10 rounded-full flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verifying Your Session</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Please hold on while we securely authenticate your email address and sync your session...
                </p>
              </div>
            </>
          )}

          {authCallbackStatus === 'success' && (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Email Verified Successfully</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Your session is secure. Redirecting you to onboarding...
                </p>
              </div>
            </>
          )}

          {authCallbackStatus === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500/10 dark:bg-red-600/10 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Verification Failed</h3>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-500/5 dark:bg-red-500/10 p-3 rounded-xl border border-red-500/10">
                  {authCallbackError}
                </p>
              </div>

              {/* Resend Verification Form */}
              <div className="pt-4 space-y-3">
                <div className="space-y-1.5 text-left">
                  <label className="block text-[10px] uppercase tracking-wider font-mono font-bold text-slate-500 dark:text-zinc-400">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={callbackEmail || signupForm.email}
                    onChange={(e) => setCallbackEmail(e.target.value)}
                    placeholder="Enter your email to resend"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 placeholder-slate-400 font-semibold"
                  />
                </div>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isAuthSubmitting || !(callbackEmail || signupForm.email)}
                  onClick={async () => {
                    const emailToUse = callbackEmail || signupForm.email;
                    if (!emailToUse || resendCooldown > 0) return;
                    setIsAuthSubmitting(true);
                    try {
                      const { error } = await supabase.auth.resend({
                        type: 'signup',
                        email: emailToUse,
                        options: {
                          emailRedirectTo: `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`
                        }
                      });
                      setIsAuthSubmitting(false);
                      if (error) {
                        setAuthCallbackError(error.message);
                      } else {
                        setResendCooldown(60);
                        triggerToast("A new verification email has been sent!");
                      }
                    } catch (err: any) {
                      setIsAuthSubmitting(false);
                      setAuthCallbackError(err.message || "Could not resend verification email.");
                    }
                  }}
                  className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isAuthSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>
                      {resendCooldown > 0 
                        ? `Resend Email (${resendCooldown}s)` 
                        : 'Resend Verification Email'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.history.replaceState({}, '', '/');
                    setShowAuthModal('signin');
                    setCurrentView('home');
                  }}
                  className="w-full h-11 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all cursor-pointer flex items-center justify-center"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const isAdminRoute = path.startsWith('/admin');
  const isJobDetailRoute = path.startsWith('/jobs/') && path !== '/jobs';
  const isIndividualChatRoute = path.startsWith('/messages/') && path !== '/messages';


  return (
    <div className={`min-h-screen bg-[#F8FAFC] dark:bg-[#0B1020] text-[#0F172A] dark:text-[#F8FAFC] font-sans transition-colors duration-300 relative overflow-x-hidden pb-24 md:pb-8 ${
      isAdminRoute ? 'admin-theme' : ''
    }`}>
      
      {/* GLOWING AMBIENT BACKGROUND ACCENTS */}
      <div className="absolute top-[-100px] left-1/4 w-[600px] h-[600px] bg-blue-500/5 dark:bg-blue-600/5 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-[30%] right-10 w-[500px] h-[500px] bg-purple-500/5 dark:bg-purple-600/5 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-[#121620] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center space-x-3 border border-slate-200/10"
          >
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-semibold tracking-wide">{successToast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STICKY TOP NAVBAR */}
      {!isAdminRoute && (
        <Navbar 
          currentView={currentView}
          setCurrentView={setCurrentView}
          themeMode={theme}
          setThemeMode={handleSetTheme}
          currentUserId={userIdState}
          unreadMessagesCount={unreadMessagesCount}
          unreadWorkflowCount={unreadWorkflowCount}
          username={username}
          setUsername={setUsername}
          userPhoto={userPhoto}
          onResetData={handleResetData}
          isLoggedIn={isLoggedIn}
          userType={userType}
          isEmailVerified={isEmailVerified}
          onOpenAuth={(tab) => {
            if (tab === 'signin') navigate('/login');
            else if (tab === 'signup') navigate('/signup');
          }}
          onLogout={handleLogout}
        />
      )}

      {/* UNVERIFIED EMAIL WARNING BANNER */}
      {isLoggedIn && !isAuthLoading && !isEmailVerified && !isAdminRoute && (
        <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border-b border-indigo-500/15 py-2.5 px-4 text-center flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 relative z-40" id="unverified-email-banner">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider font-sans">Email verification pending</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Verify your email to unlock all interactive marketplace actions.
          </p>
          <button
            onClick={() => requireEmailVerification('Verify account', () => {})}
            className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white text-[11px] font-black rounded-lg transition-all cursor-pointer shadow-xs active:scale-95"
            id="btn-banner-verify-now"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* CORE CONTAINER */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-[calc(90px+env(safe-area-inset-bottom))]">
        <RouteTracker jobs={jobs} workers={workers} />
        <Routes>
          {/* Home View */}
          <Route path="/" element={
            <motion.div
              key="home-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 sm:space-y-6 md:space-y-8"
            >
              <HeroSection 
                userFullName={isLoggedIn ? (username || 'Member') : undefined}
                isLoggedIn={isLoggedIn}
                onAboutClick={() => navigate('/about')}
                jobs={jobs}
                workers={workers}
                unreadMessagesCount={unreadMessagesCount}
              />

              <SearchBar 
                value={searchQuery}
                onChange={(v) => setSearchQuery(v)}
                onClear={() => setSearchQuery('')}
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate('/jobs');
                  analytics.trackSearch(searchQuery);
                }}
              />

              <QuickActions 
                onFindJobs={() => navigate('/jobs')}
                onFindWorkers={() => navigate('/workers')}
                onPostJob={() => requireEmailVerification('Post Jobs', () => setShowPostJob(true))}
                onCreateProfile={() => requireEmailVerification('Create Worker Profile', () => setShowCreateProfile(true))}
                onOpenMessages={() => requireAuth('Send Messages', () => navigate('/messages'))}
                onOpenProfile={() => requireAuth('View Full Profile', () => navigate('/profile'))}
                hasWorkerProfile={isLoggedIn && userType === 'worker'}
              />

              {isLoggedIn && (
                <DashboardSummary 
                  myPostsCount={dashMyPostsCount}
                  myWorksCount={dashMyWorksCount}
                  unreadMessagesCount={unreadMessagesCount}
                  savedJobsCount={dashSavedJobsCount}
                  savedWorkersCount={dashSavedWorkersCount}
                  onAction={(view) => {
                    if (view === 'my-posts') navigate('/profile/my-job-posts');
                    else if (view === 'jobs-applied') navigate('/profile/jobs-applied');
                    else if (view === 'saved-jobs') navigate('/profile/saved-jobs');
                    else if (view === 'saved-workers') navigate('/profile/saved-workers');
                    else if (view === 'messages') navigate('/messages');
                  }}
                />
              )}

              <RecommendedForYou 
                jobs={jobs}
                workers={workers}
                toggleBookmark={toggleBookmark}
                toggleWorkerBookmark={toggleWorkerBookmark}
                handleApplyJob={handleApplyJob}
                onOpenMessage={handleOpenDirectMessage}
                onViewJobs={() => navigate('/jobs')}
                onViewWorkers={() => navigate('/workers')}
                currentUserId={userIdState}
              />
            </motion.div>
          } />

          {/* Jobs View */}
          <Route path="/jobs" element={
            <motion.div
              key="jobs-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <JobsPage 
                jobs={jobs}
                toggleBookmark={toggleBookmark}
                handleApplyJob={handleApplyJob}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                triggerToast={triggerToast}
                isLoggedIn={isLoggedIn}
                onOpenAuth={(tab) => {
                  if (tab === 'signin') navigate('/login');
                  else if (tab === 'signup') navigate('/signup');
                }}
              />
            </motion.div>
          } />

          {/* About View */}
          <Route path="/about" element={
            <motion.div
              key="about-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <AboutPage 
                isLoggedIn={isLoggedIn}
                onOpenAuth={(tab) => {
                  if (tab === 'signin') navigate('/login');
                  else if (tab === 'signup') navigate('/signup');
                }}
              />
            </motion.div>
          } />
          <Route path="/jobs/:jobId" element={
            <motion.div
              key="jobs-view-detail"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <JobDetailPage 
                jobs={jobs}
                toggleBookmark={toggleBookmark}
                handleApplyJob={handleApplyJob}
                triggerToast={triggerToast}
                isLoggedIn={isLoggedIn}
                onOpenAuth={(tab) => {
                  if (tab === 'signin') navigate('/login');
                  else if (tab === 'signup') navigate('/signup');
                }}
              />
            </motion.div>
          } />

          {/* Workers View */}
          <Route path="/workers" element={
            <motion.div
              key="workers-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <WorkersPage 
                workers={workers}
                toggleWorkerBookmark={toggleWorkerBookmark}
                onOpenMessage={handleOpenDirectMessage}
                onOpenHire={triggerHireModal}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                triggerToast={triggerToast}
                isLoggedIn={isLoggedIn}
                onOpenAuth={(tab) => {
                  if (tab === 'signin') navigate('/login');
                  else if (tab === 'signup') navigate('/signup');
                }}
                onCreateProfile={() => requireEmailVerification('Create Worker Profile', () => setShowCreateProfile(true))}
              />
            </motion.div>
          } />
          <Route path="/workers/:workerId" element={
            <motion.div
              key="workers-view-detail"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <WorkerDetailPage 
                workers={workers}
                toggleWorkerBookmark={toggleWorkerBookmark}
                onOpenMessage={handleOpenDirectMessage}
                onOpenHire={triggerHireModal}
                triggerToast={triggerToast}
                isLoggedIn={isLoggedIn}
                onOpenAuth={(tab) => {
                  if (tab === 'signin') navigate('/login');
                  else if (tab === 'signup') navigate('/signup');
                }}
              />
            </motion.div>
          } />

          {/* Messages View */}
          <Route path="/messages" element={
            <ProtectedRoute>
              <motion.div
                key="messages-view"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <MessagesPage triggerToast={triggerToast} />
              </motion.div>
            </ProtectedRoute>
          } />
          <Route path="/messages/:conversationId" element={
            <ProtectedRoute>
              <motion.div
                key="messages-view-detail"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <MessagesPage triggerToast={triggerToast} />
              </motion.div>
            </ProtectedRoute>
          } />

          {/* Profile Pages */}
          <Route path="/profile/my-job-posts" element={
            <ProtectedRoute>
              <MyJobPostsPage />
            </ProtectedRoute>
          } />

          <Route path="/profile/manage-applications" element={
            <ProtectedRoute>
              <Navigate to="/profile/my-job-posts" replace />
            </ProtectedRoute>
          } />

          <Route path="/profile/jobs-applied" element={
            <ProtectedRoute>
              <MyJobsAppliedPage handleStartConversation={handleOpenConversationForApplication} />
            </ProtectedRoute>
          } />

          <Route path="/jobs/:jobId/applications" element={
            <ProtectedRoute>
              <ManageApplicationsPage handleStartConversation={handleOpenConversationForApplication} />
            </ProtectedRoute>
          } />

          {/* Hiring Workflow Routes */}
          <Route path="/profile/hire-requests" element={
            <ProtectedRoute>
              <HireRequestsPage triggerToast={triggerToast} />
            </ProtectedRoute>
          } />

          <Route path="/hire-requests/:requestId" element={
            <ProtectedRoute>
              <HireRequestDetailsPage triggerToast={triggerToast} />
            </ProtectedRoute>
          } />

          <Route path="/hire-requests/:requestId/negotiation" element={
            <ProtectedRoute>
              <NegotiationPage triggerToast={triggerToast} />
            </ProtectedRoute>
          } />

          <Route path="/applications/:applicationId/negotiation" element={
            <ProtectedRoute>
              <NegotiationPage triggerToast={triggerToast} />
            </ProtectedRoute>
          } />

          <Route path="/work-contracts/:contractId" element={
            <ProtectedRoute>
              <WorkContractPage triggerToast={triggerToast} />
            </ProtectedRoute>
          } />

          <Route path="/profile/notifications" element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          } />

          <Route path="/profile/notification-settings" element={
            <ProtectedRoute>
              <NotificationSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/profile/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

          <Route path="/profile" element={
            <ProtectedRoute>
              <motion.div
                key="profile-view"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <ProfilePage 
                  username={username}
                  setUsername={setUsername}
                  userPhoto={userPhoto}
                  setUserPhoto={setUserPhoto}
                  activities={activities}
                  setActivities={setActivities}
                  triggerToast={triggerToast}
                  jobs={jobs}
                  setJobs={setJobs}
                  workers={workers}
                  setWorkers={setWorkers}
                  messages={messages}
                  setMessages={setMessages}
                  conversations={conversations}
                  setConversations={setConversations}
                  applications={applications}
                  setApplications={setApplications}
                  appMessages={appMessages}
                  setAppMessages={setAppMessages}
                  setCurrentView={setCurrentView}
                  setShowPostJob={(val) => {
                    if (val) {
                      requireEmailVerification('Post Jobs', () => setShowPostJob(true));
                    } else {
                      setShowPostJob(false);
                    }
                  }}
                  setShowCreateProfile={(val) => {
                    if (val) {
                      requireEmailVerification('Create Worker Profile', () => setShowCreateProfile(true));
                    } else {
                      setShowCreateProfile(false);
                    }
                  }}
                  isLoggedIn={isLoggedIn}
                  userType={userType}
                  setUserType={setUserType}
                  onLogout={handleLogout}
                  isEmailVerified={isEmailVerified}
                  requireEmailVerification={requireEmailVerification}
                />
              </motion.div>
            </ProtectedRoute>
          } />

          {/* Public Profile View */}
          <Route path="/profile/:usernameParam" element={
            <motion.div
              key="public-profile-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <ProfilePage 
                  username={username}
                  setUsername={setUsername}
                  userPhoto={userPhoto}
                  setUserPhoto={setUserPhoto}
                  activities={activities}
                  setActivities={setActivities}
                  triggerToast={triggerToast}
                  jobs={jobs}
                  setJobs={setJobs}
                  workers={workers}
                  setWorkers={setWorkers}
                  messages={messages}
                  setMessages={setMessages}
                  conversations={conversations}
                  setConversations={setConversations}
                  applications={applications}
                  setApplications={setApplications}
                  appMessages={appMessages}
                  setAppMessages={setAppMessages}
                  setCurrentView={setCurrentView}
                  setShowPostJob={(val) => {
                    if (val) {
                      requireEmailVerification('Post Jobs', () => setShowPostJob(true));
                    } else {
                      setShowPostJob(false);
                    }
                  }}
                  setShowCreateProfile={(val) => {
                    if (val) {
                      requireEmailVerification('Create Worker Profile', () => setShowCreateProfile(true));
                    } else {
                      setShowCreateProfile(false);
                    }
                  }}
                  isLoggedIn={isLoggedIn}
                  userType={userType}
                  setUserType={setUserType}
                  onLogout={handleLogout}
                  isEmailVerified={isEmailVerified}
                  requireEmailVerification={requireEmailVerification}
                />
              </motion.div>
          } />

          {/* Saved Jobs Shortcut */}
          <Route path="/profile/saved-jobs" element={
            <ProtectedRoute>
              <motion.div
                key="saved-jobs-view"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <SavedJobsPage 
                  jobs={jobs}
                  toggleBookmark={toggleBookmark}
                  handleApplyJob={handleApplyJob}
                  onExplore={() => navigate('/jobs')}
                />
              </motion.div>
            </ProtectedRoute>
          } />

          {/* Saved Workers Shortcut */}
          <Route path="/profile/saved-workers" element={
            <ProtectedRoute>
              <motion.div
                key="saved-workers-view"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <SavedWorkersPage 
                  workers={workers}
                  toggleWorkerBookmark={toggleWorkerBookmark}
                  onOpenMessage={handleOpenDirectMessage}
                  onOpenHire={triggerHireModal}
                  onExplore={() => navigate('/workers')}
                />
              </motion.div>
            </ProtectedRoute>
          } />

          {/* Create Account route */}
          <Route path="/signup" element={
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-slate-400 dark:text-zinc-500 font-medium">Opening Create Account...</div>
            </div>
          } />

          {/* Sign In route */}
          <Route path="/login" element={
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="text-slate-400 dark:text-zinc-500 font-medium">Opening Sign In...</div>
            </div>
          } />

          {/* Email Verification Center */}
          <Route path="/verify-email" element={
            <div className="max-w-md mx-auto py-8 sm:py-12 space-y-6 px-4">
              <div className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full overflow-hidden shadow-2xl text-left relative">
                {/* Premium Gradient Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
                
                <div className="p-6 sm:p-8 space-y-5">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <ShieldAlert className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 block">Security Requirement</span>
                      <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                        Verify your email to continue
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Email verification is required before you can perform gated actions. Please input the 6-digit OTP code below.
                      </p>
                    </div>
                  </div>

                  {isEditingPendingEmail ? (
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 text-center space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 dark:text-zinc-500 block">Edit Email Address</span>
                      <input
                        type="email"
                        value={editedPendingEmail}
                        onChange={(e) => setEditedPendingEmail(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs text-center font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        placeholder="Enter your email address"
                      />
                      <div className="flex justify-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (editedPendingEmail.trim() && editedPendingEmail.includes('@')) {
                              updatePendingEmail(editedPendingEmail.trim());
                              setIsEditingPendingEmail(false);
                              triggerToast("Email address updated!");
                            } else {
                              triggerToast("Please enter a valid email address.");
                            }
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-md hover:bg-indigo-500 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditedPendingEmail(pendingEmail);
                            setIsEditingPendingEmail(false);
                          }}
                          className="px-3 py-1 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-bold rounded-md hover:bg-slate-300 dark:hover:bg-zinc-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-slate-200/50 dark:border-zinc-800/50 text-center space-y-1">
                      <span className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 dark:text-zinc-500 block">Pending Email Address</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 select-all block break-all">{pendingEmail || "No pending email found. Please sign up."}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditedPendingEmail(pendingEmail);
                          setIsEditingPendingEmail(true);
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                      >
                        Edit Email
                      </button>
                    </div>
                  )}

                  {authError && (
                    <div className="p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-xl flex items-start space-x-2.5 text-red-600 dark:text-red-400 text-[11px] font-semibold leading-relaxed animate-shake">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleVerifyOTP} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-mono">6-Digit Verification Code</label>
                      <input
                        type="text"
                        value={verificationCodeInput}
                        onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        maxLength={6}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-mono font-bold tracking-widest text-center focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isAuthSubmitting}
                        onClick={handleResendOTP}
                        className="h-11 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAuthSubmitting && 'animate-spin'}`} />
                        <span>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isAuthSubmitting || !verificationCodeInput}
                        className="h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isAuthSubmitting ? "Verifying..." : "Verify & Continue"}
                      </button>
                    </div>
                  </form>

                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full h-11 border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  >
                    Go to Home
                  </button>
                </div>
              </div>
            </div>
          } />

          {/* Legal routes */}
          <Route path="/terms" element={<TermsPage navigate={navigate} />} />
          <Route path="/privacy" element={<PrivacyPage navigate={navigate} />} />
          <Route path="/community-guidelines" element={<CommunityGuidelinesPage navigate={navigate} />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage navigate={navigate} />} />
          <Route path="/contact" element={<GrievancePage navigate={navigate} triggerToast={triggerToast} />} />
          <Route path="/grievance" element={<GrievancePage navigate={navigate} triggerToast={triggerToast} />} />

          {/* ADMIN ROUTES */}
          <Route path="/admin" element={<AdminErrorBoundary><AdminLayout /></AdminErrorBoundary>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="workers" element={<AdminWorkers />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="companies" element={<AdminCompanies />} />
            <Route path="verifications" element={<AdminVerifications />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="contracts" element={<AdminContracts />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="feature-flags" element={<AdminFeatureFlags />} />
            <Route path="security-logs" element={<AdminSecurityLogs />} />
            <Route path="system-health" element={<AdminSystemHealth />} />
            <Route path="admins" element={<AdminStaff />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
          </Route>

          {/* 404 Wildcard Page */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {/* SITE-WIDE FOOTER NAVIGATION */}
      {!isAdminRoute && !isJobDetailRoute && !isIndividualChatRoute && (
        <Footer navigate={navigate} />
      )}

      {/* ====================================================
          MODAL: EMAIL VERIFICATION GATEWAY
         ==================================================== */}
      <AnimatePresence>
        {showVerificationModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn" id="email-verification-modal-overlay">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-md overflow-hidden shadow-2xl text-left relative"
              id="email-verification-modal-card"
            >
              {/* Premium Gradient Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600" />
              
              <div className="p-6 sm:p-8 space-y-5">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <ShieldAlert className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-mono tracking-widest font-extrabold text-indigo-600 dark:text-indigo-400 block">Security Requirement</span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug" id="verification-modal-title">
                      Verify your email to continue
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium" id="verification-modal-description">
                      Email verification is required before you can apply for jobs, post opportunities, send hiring requests, create professional profiles, or use messaging. This helps OpenComm reduce spam and fake accounts.
                    </p>
                  </div>
                </div>

                {/* Success State Indicator */}
                {emailSentSuccessfully && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-2.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-shake" id="verification-success-alert">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>Verification email sent. Check your inbox.</span>
                  </div>
                )}

                {/* Friendly Error Messages */}
                {authError && (
                  <div className="p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-xl flex items-start space-x-2.5 text-red-600 dark:text-red-400 text-[11px] font-semibold leading-relaxed animate-shake" id="verification-error-alert">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isAuthSubmitting}
                    onClick={handleResendVerificationInModal}
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    id="btn-send-verification-email"
                  >
                    {isAuthSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          {resendCooldown > 0 
                            ? `Resend email (${resendCooldown}s)` 
                            : emailSentSuccessfully ? 'Resend Verification Email' : 'Send Verification Email'}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowVerificationModal(false);
                      setAuthError('');
                    }}
                    className="w-full h-11 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                    id="btn-cancel-verification"
                  >
                    Cancel
                  </button>
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-slate-400 font-medium inline-flex items-center">
                    <Lock className="w-3 h-3 mr-1 text-slate-400" />
                    Protected by secure OpenComm verification rules
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 1: POST A JOB
         ==================================================== */}
      <AnimatePresence>
        {showPostJob && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-xl shadow-2xl text-left flex flex-col max-h-[90dvh] sm:max-h-[85dvh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40 shrink-0 z-10 rounded-t-3xl">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    {editingJob ? 'Edit Job Post Details' : 'Post an Active Job Listing'}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setShowPostJob(false);
                    setEditingJob(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form id="post-job-form" onSubmit={handleCreateJob} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                
                {jobFormError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start space-x-2">
                    <span className="text-rose-600 dark:text-rose-400 font-bold">Error:</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium">{jobFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Job Title</label>
                    <input 
                      type="text" 
                      placeholder="Job title or role"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Company / Household Name</label>
                    <input 
                      type="text" 
                      placeholder="Company name"
                      value={newJobCompany}
                      onChange={(e) => setNewJobCompany(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Salary or Budget (₹)</label>
                    <input 
                      type="text" 
                      placeholder="Salary range or rate"
                      value={newJobSalary}
                      onChange={(e) => setNewJobSalary(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Job Type</label>
                    <select
                      value={newJobType}
                      onChange={(e) => setNewJobType(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                    >
                      {['Full-time', 'Part-time', 'Contract', 'Temporary', 'Freelance', 'Internship', 'Daily Wage', 'One-time Work'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Job Location</label>
                  <LocationSelector
                    value={newJobLocationData}
                    onChange={(loc) => {
                      setNewJobLocationData(loc);
                      setNewJobLocation(loc.city ? `${loc.city}, ${loc.state_code || loc.state}` : '');
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Category</label>
                    <select
                      value={newJobCategory}
                      onChange={(e) => setNewJobCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    >
                      {['Developer', 'Designer', 'Electrician', 'Carpenter', 'Driver', 'Chef', 'Teacher', 'Photographer', 'Mechanic', 'Cleaner'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Application Deadline</label>
                    <input 
                      type="date" 
                      min={new Date().toISOString().split('T')[0]}
                      value={newJobDeadline}
                      onChange={(e) => setNewJobDeadline(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Core Requirements (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="Required skills, tools, or frameworks"
                    value={newJobReqs}
                    onChange={(e) => setNewJobReqs(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Project Scope Description</label>
                  <textarea 
                    rows={3}
                    placeholder="Provide a clean summary of key deliverables, milestones, and working timelines..."
                    value={newJobDesc}
                    onChange={(e) => setNewJobDesc(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

              </form>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 sm:py-5 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-2.5 shrink-0 bg-white dark:bg-[#111827] pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button 
                  type="button"
                  onClick={() => {
                    setShowPostJob(false);
                    setEditingJob(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="post-job-form"
                  disabled={isSubmittingJob}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isSubmittingJob ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{editingJob ? 'Saving Changes...' : 'Publishing Job...'}</span>
                    </>
                  ) : (
                    <span>{editingJob ? 'Save Changes' : 'Publish Job'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 2: CREATE WORKER PROFILE
         ==================================================== */}
      <AnimatePresence>
        {showCreateProfile && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ y: '100%', opacity: 1 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 1 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white dark:bg-[#111827] flex flex-col w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-[#273449] overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="shrink-0 pt-[env(safe-area-inset-top)] bg-white dark:bg-[#111827] border-b border-slate-100 dark:border-slate-800/80 sticky top-0 z-10">
                <div className="px-6 py-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="w-5 h-5 text-purple-500" />
                    <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Create Certified Pro Profile</span>
                  </div>
                  <button 
                    onClick={() => setShowCreateProfile(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateWorker} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4 text-xs" style={{ scrollPaddingBottom: '100px' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Your full name"
                      value={newWorkerName}
                      onChange={(e) => setNewWorkerName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Professional Title (Profession)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Professional title or role"
                      value={newWorkerTitle}
                      onChange={(e) => setNewWorkerTitle(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Desired Hourly Rate (₹/hr)</label>
                  <input 
                    type="number" 
                    required
                    placeholder="Hourly rate"
                    value={newWorkerRate}
                    onChange={(e) => setNewWorkerRate(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Base Location</label>
                  <LocationSelector
                    value={newWorkerLocationData}
                    onChange={(loc) => {
                      setNewWorkerLocationData(loc);
                      setNewWorkerLocation(loc.city ? `${loc.city}, ${loc.state_code || loc.state}` : '');
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Skills / Tools List (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="Skills, tools, or technologies"
                    value={newWorkerSkills}
                    onChange={(e) => setNewWorkerSkills(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Professional Bio Summary</label>
                  <textarea 
                    rows={3}
                    placeholder="Highlight your previous milestone projects, certifications, custom woodwork inlays, smart home electrical experience, etc..."
                    value={newWorkerBio}
                    onChange={(e) => setNewWorkerBio(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={newWorkerListingEnabled}
                      onChange={(e) => setNewWorkerListingEnabled(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Show my profile in the Workers Directory</span>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input 
                      type="checkbox"
                      required
                      checked={newWorkerTermsAccepted}
                      onChange={(e) => setNewWorkerTermsAccepted(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300 dark:border-slate-700"
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-300">I accept the OpenComm Worker Marketplace Terms and Code of Conduct.</span>
                  </label>
                </div>

                </div>
                
                <div className="shrink-0 bg-white dark:bg-[#111827] pt-4 pb-[calc(16px+env(safe-area-inset-bottom))] px-6 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5 sticky bottom-0 z-10">
                  <button 
                    type="button"
                    onClick={() => setShowCreateProfile(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer hover:scale-102 active:scale-98"
                  >
                    Register Contractor
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 3: HIRE WORKER / CANONICAL HIRE REQUEST FORM
         ==================================================== */}
      <AnimatePresence>
        {showHireModal && (
          <HireRequestForm
            worker={showHireModal}
            onClose={() => setShowHireModal(null)}
            triggerToast={triggerToast}
          />
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 4: AUTHENTICATION & ONBOARDING SYSTEM (UNIVERSAL ACCOUNT)
         ==================================================== */}
      <AnimatePresence>
        {showAuthModal && (
          <div 
            ref={signupContainerRef}
            className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto bg-[#f7f8fa] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_38%)] dark:bg-[#0b0d12] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_38%)] backdrop-blur-lg scroll-smooth min-h-screen min-h-[100dvh] h-auto"
            style={{
              paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))',
              paddingLeft: '1rem',
              paddingRight: '1rem'
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[440px] p-6 rounded-[24px] bg-white/92 dark:bg-zinc-900/92 border border-slate-900/8 dark:border-white/8 shadow-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-[20px] transition-all relative flex flex-col h-auto text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowAuthModal(null);
                  setLockedFeature(null);
                  setAuthError('');
                  if (path === '/signup' || path === '/login') {
                    navigate('/');
                  }
                }}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Centered OpenComm Brand Logo */}
              <div className="flex justify-center mb-5 mt-2">
                <OpenCommLogo 
                  variant="auth" 
                  onClick={() => {
                    setShowAuthModal(null);
                    setLockedFeature(null);
                    setAuthError('');
                  }}
                />
              </div>

              {/* Header Title Section */}
              <div className="text-center mb-6 px-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight">
                  {showAuthModal === 'locked' ? 'Unlock Professional Features' : showAuthModal === 'signin' ? 'Welcome back' : 'Create your account'}
                </h3>
                <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1.5 leading-relaxed font-normal">
                  {showAuthModal === 'locked' 
                    ? `Create an account or sign in to ${lockedFeature || 'interact with this private module'}.` 
                    : showAuthModal === 'signin' 
                    ? 'Sign in to continue to OpenComm.' 
                    : 'Join OpenComm and discover jobs, workers, and opportunities.'}
                </p>
              </div>

              {/* Error block */}
              {authError && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex flex-col space-y-2.5 font-medium leading-normal animate-shake">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>

                </div>
              )}

              {/* Verify email section for unconfirmed accounts */}
              {isEmailNotConfirmedError && (
                <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-400 rounded-xl text-xs space-y-3 font-medium leading-normal" id="unconfirmed-email-verify-section">
                  <div className="flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                    <div>
                      <p className="font-bold">Email Verification Pending</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Your email has not been confirmed yet. Please verify it using your 6-digit OTP code to unlock your account.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEmailNotConfirmedError(false);
                      setAuthError("");
                      setShowAuthModal(null);
                      navigate('/verify-email');
                    }}
                    className="w-full h-10 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center space-x-1"
                    id="btn-unconfirmed-verify-email"
                  >
                    <span>Verify Email Now</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              )}

              {/* --- CASE A: LOCKED FEATURE VIEW --- */}
              {showAuthModal === 'locked' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-500/5 dark:bg-blue-600/5 border border-blue-500/10 dark:border-blue-500/15 rounded-xl flex items-start space-x-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-blue-600 dark:text-blue-400 block mb-0.5">Gateway Protection</strong>
                      Direct milestone escrow bids, verified contractors, and secure platform messaging require a basic member account.
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => {
                        setShowAuthModal('signup');
                        setAuthError('');
                      }}
                      className="w-full h-11 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-98"
                    >
                      <span>Create Free Account</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowAuthModal('signin');
                        setAuthError('');
                      }}
                      className="w-full h-11 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-350 font-semibold rounded-xl text-xs transition-colors cursor-pointer text-center flex items-center justify-center"
                    >
                      Already have an account? Sign In
                    </button>
                  </div>
                </div>
              )}

              {/* --- CASE B: SIGN IN FORM --- */}
              {showAuthModal === 'signin' && (
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!signinUsername.trim()) {
                      setAuthError("Email address or username is required.");
                      return;
                    }
                    if (!signinPassword) {
                      setAuthError("Password is required.");
                      return;
                    }
                    setAuthError("");
                    setIsAuthSubmitting(true);

                    if (supabase) {
                      try {
                        const { data, error } = await supabase.auth.signInWithPassword({
                          email: signinUsername,
                          password: signinPassword
                        });
                        setIsAuthSubmitting(false);
                        if (error) {
                          setAuthError(error.message);
                          const isUnconfirmed = error.message.toLowerCase().includes("email not confirmed") || 
                                                error.message.toLowerCase().includes("email_not_confirmed") || 
                                                error.message.toLowerCase().includes("unconfirmed") || 
                                                error.message.toLowerCase().includes("not verified");
                          if (isUnconfirmed) {
                            setIsEmailNotConfirmedError(true);
                            updatePendingEmail(signinUsername);
                            triggerToast("Email verification pending. Redirecting you to the verification page...");
                            setTimeout(() => {
                              setIsEmailNotConfirmedError(false);
                              setAuthError("");
                              setShowAuthModal(null);
                              navigate('/verify-email');
                            }, 2500);
                          }
                        } else {
                          setShowAuthModal(null);
                          setLockedFeature(null);
                          triggerToast("Signed in successfully!");
                          analytics.trackLogin('email', data.user?.id);
                          const queryParams = new URLSearchParams(window.location.search);
                          const redirectPath = queryParams.get('redirect');
                          navigate(redirectPath || '/', { replace: true });
                        }
                      } catch (err: any) {
                        setIsAuthSubmitting(false);
                        setAuthError(err.message || "An unexpected error occurred during sign-in.");
                      }
                    } else {
                      setTimeout(() => {
                        setIsAuthSubmitting(false);
                        const storedType = (localStorage.getItem('opencomm_user_type') as any) || 'normal';
                        handleLoginSuccess(signinUsername, storedType);
                        setShowAuthModal(null);
                        setLockedFeature(null);
                        analytics.trackLogin('mock', 'mock-user-id');
                        const queryParams = new URLSearchParams(window.location.search);
                        const redirectPath = queryParams.get('redirect');
                        navigate(redirectPath || '/', { replace: true });
                      }, 800);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Email address
                    </label>
                    <input 
                      type="email" 
                      name="email"
                      required
                      autoComplete="email"
                      value={signinUsername}
                      onChange={(e) => setSigninUsername(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold transition-all"
                      placeholder="Your email address"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Password
                    </label>
                    <div className="relative">
                      <input 
                        type={showSigninPassword ? "text" : "password"} 
                        name="password"
                        required
                        autoComplete="current-password"
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-[#94A3B8] font-semibold transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigninPassword(!showSigninPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                        aria-label={showSigninPassword ? "Hide password" : "Show password"}
                        title={showSigninPassword ? "Hide password" : "Show password"}
                      >
                        {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-1">
                      <span className="text-slate-400 dark:text-zinc-500 font-medium">Session secured by Supabase Guard</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!signinUsername.trim() || !signinUsername.includes('@')) {
                            setAuthError("Please enter your registered email address above first.");
                            return;
                          }
                          try {
                            setIsAuthSubmitting(true);
                            setAuthError("");
                            const { error } = await (supabase ? supabase.auth.resetPasswordForEmail(signinUsername, {
                              redirectTo: NEXT_PUBLIC_APP_URL
                            }) : { error: null });
                            setIsAuthSubmitting(false);
                            if (error) {
                              setAuthError(error.message);
                            } else {
                              triggerToast("Password reset link sent to your email!");
                            }
                          } catch (err: any) {
                            setIsAuthSubmitting(false);
                            setAuthError(err.message || "Could not trigger password reset request.");
                          }
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isAuthSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <span>Sign In</span>
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2 border-t border-slate-100 dark:border-zinc-800/80 mt-2">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setShowAuthModal('signup');
                          setSignupStep(1);
                          setAuthError('');
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                      >
                        Create account
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* --- CASE C: SINGLE-PAGE SIGN UP & ONBOARDING FORM --- */}
              {showAuthModal === 'signup' && (
                <div className="space-y-5 text-left">
                  {/* Returning Unverified User Banner */}
                  {pendingEmail && signupStep === 1 && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2 text-left animate-fadeIn">
                      <div className="flex items-start space-x-2.5">
                        <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">Email Verification Pending</h4>
                          <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed font-medium">
                            This email is registered but still needs verification: <strong className="text-slate-900 dark:text-white">{pendingEmail}</strong>.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSignupStep(3)}
                          className="flex-1 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
                        >
                          Continue Verification
                        </button>
                        <button
                          type="button"
                          onClick={handleResendOTP}
                          disabled={resendCooldown > 0}
                          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend OTP'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingEmail('');
                            localStorage.removeItem('opencomm_pending_email');
                          }}
                          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 font-bold text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          Use Another Email
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 1: UNIFIED SINGLE PAGE SIGNUP FORM */}
                  {signupStep === 1 && (
                    <form onSubmit={handleSinglePageSignUp} noValidate className="space-y-4 text-xs text-left animate-fadeIn">
                      
                      {/* SECTION 1: BASIC PROFILE (REQUIRED FOR EVERY USER) */}
                      <div className="space-y-3.5">
                        <div className="border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                            Basic Profile Details
                          </h3>
                        </div>

                        {/* Full Name */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Full Name <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text" 
                            value={signupForm.name}
                            onChange={(e) => setSignupForm({...signupForm, name: e.target.value})}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400"
                            placeholder="Rahul Sharma"
                          />
                        </div>

                        {/* Email Address */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Email Address <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="email" 
                            disabled={isLoggedIn}
                            value={signupForm.email}
                            onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                            className={`w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 ${isLoggedIn ? 'opacity-60 cursor-not-allowed' : ''}`}
                            placeholder="rahul.sharma@example.com"
                          />
                        </div>

                        {/* Phone Number with Country Code Selector (Default India +91) */}
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Phone Number <span className="text-rose-500">*</span>
                          </label>
                          <div className="flex rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 overflow-hidden focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                            {/* Country Code Dropdown */}
                            <select
                              value={phoneCountryCode}
                              onChange={(e) => setPhoneCountryCode(e.target.value)}
                              className="h-11 px-2.5 bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-white font-mono text-xs font-bold border-r border-slate-200 dark:border-zinc-800 outline-none cursor-pointer shrink-0"
                            >
                              {COUNTRY_CODES.map(c => (
                                <option key={c.code} value={c.dialCode}>
                                  {c.dialCode}
                                </option>
                              ))}
                            </select>
                            {/* Phone Input */}
                            <input 
                              type="tel" 
                              value={signupForm.phone}
                              onChange={(e) => setSignupForm({...signupForm, phone: e.target.value.replace(/[^\d]/g, '')})}
                              className="flex-1 h-11 px-3.5 bg-transparent text-slate-950 dark:text-white text-xs font-semibold focus:outline-none placeholder-slate-400"
                              placeholder="9876543210"
                            />
                          </div>

                          {/* Contact Preferences */}
                          <div className="pt-1.5 space-y-1.5">
                            <label className="flex items-center space-x-2 text-[11px] text-slate-600 dark:text-zinc-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={whatsappSameNumber}
                                onChange={(e) => setWhatsappSameNumber(e.target.checked)}
                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                              />
                              <span>WhatsApp uses this same number</span>
                            </label>

                            <input
                              type="text"
                              value={telegramUsername}
                              onChange={(e) => setTelegramUsername(e.target.value)}
                              placeholder="Telegram username"
                              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-950/60 text-slate-900 dark:text-white text-[11px] font-mono placeholder-slate-400 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Password & Confirm Password */}
                        {!isLoggedIn && (
                          <div className="space-y-3 pt-1">
                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Password <span className="text-rose-500">*</span>
                              </label>
                              <div className="relative">
                                <input 
                                  type={showSignupPassword ? "text" : "password"} 
                                  autoComplete="new-password"
                                  value={signupPassword}
                                  onChange={(e) => setSignupPassword(e.target.value)}
                                  className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400"
                                  placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                                  aria-label={showSignupPassword ? "Hide password" : "Show password"}
                                >
                                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                Confirm Password <span className="text-rose-500">*</span>
                              </label>
                              <div className="relative">
                                <input 
                                  type={showSignupConfirmPassword ? "text" : "password"} 
                                  autoComplete="new-password"
                                  value={signupConfirmPassword}
                                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                                  className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400"
                                  placeholder="Confirm password"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                                  aria-label={showSignupConfirmPassword ? "Hide password" : "Show password"}
                                >
                                  {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Base Location */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Base Location <span className="text-rose-500">*</span>
                          </label>
                          <LocationSelector
                            value={{
                              country: workerForm.country,
                              country_code: workerForm.country_code,
                              state: workerForm.state,
                              state_code: workerForm.state_code,
                              district: workerForm.district,
                              city: workerForm.city,
                              latitude: workerForm.latitude,
                              longitude: workerForm.longitude
                            }}
                            onChange={(loc) => setWorkerForm(prev => ({
                              ...prev,
                              country: loc.country,
                              country_code: loc.country_code,
                              state: loc.state,
                              state_code: loc.state_code,
                              district: loc.district,
                              city: loc.city,
                              latitude: loc.latitude,
                              longitude: loc.longitude
                            }))}
                          />
                        </div>

                        {/* Profile Picture / Avatar Selector (Required) */}
                        <div className="space-y-2 pt-1">
                          <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                              Profile Picture or Avatar <span className="text-rose-500">*</span>
                            </label>
                          </div>

                          {/* Options Tabs */}
                          <div className="flex space-x-1.5 p-1 bg-slate-100 dark:bg-zinc-950 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setAvatarTab('upload')}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                avatarTab === 'upload'
                                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                              }`}
                            >
                              Upload Photo
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarTab('preset');
                                setShowAvatarGalleryModal(true);
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                avatarTab === 'preset' || avatarTab === 'skip'
                                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                              }`}
                            >
                              Choose Avatar
                            </button>
                          </div>

                          {avatarTab === 'upload' ? (
                            <ProfilePhotoUpload
                              value={workerForm.avatarUrl}
                              onFileChange={(file) => {
                                setCroppedFile(file);
                                if (file) setSelectedAvatar(null);
                              }}
                              onChange={(url) => {
                                setWorkerForm(prev => ({ ...prev, avatarUrl: url }));
                                setUserPhoto(url);
                                if (url) setSelectedAvatar(null);
                              }}
                              userId={userIdState || ''}
                              supabase={supabase}
                              triggerToast={triggerToast}
                            />
                          ) : (
                            <div className="flex items-center space-x-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/80 dark:border-zinc-800">
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500/30 bg-white dark:bg-zinc-800 shrink-0 p-0.5 shadow-xs">
                                <img
                                  src={selectedAvatar || workerForm.avatarUrl || DEFAULT_AVATAR_URL}
                                  alt="Avatar preview"
                                  className="w-full h-full object-cover rounded-full"
                                />
                              </div>
                              <div className="space-y-0.5 text-left flex-1">
                                <span className="text-[11px] font-bold text-slate-900 dark:text-white block leading-tight">
                                  {selectedAvatar ? 'Preset Avatar Selected' : 'Choose Preset Avatar'}
                                </span>
                                <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-medium">
                                  Select from 50+ diverse professional avatars
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setShowAvatarGalleryModal(true)}
                                  className="px-2.5 py-1 mt-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold transition-all shadow-xs cursor-pointer inline-block"
                                >
                                  Browse Avatar Gallery (50+)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Short Bio (Optional) */}
                        <div className="space-y-1 pt-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Short Bio <span className="text-slate-400 font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={signupForm.bio}
                            onChange={(e) => setSignupForm({ ...signupForm, bio: e.target.value })}
                            placeholder="Tell people a little about yourself…"
                            className="w-full p-3 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs font-medium resize-none focus:outline-none"
                          />
                        </div>
                      </div>



                      {/* TERMS AND PRIVACY CONSENT */}
                      <div className="flex items-start space-x-2.5 pt-2 text-left">
                        <input 
                          type="checkbox"
                          id="accept-terms-privacy"
                          required
                          checked={acceptTerms && acceptPrivacy}
                          onChange={(e) => {
                            setAcceptTerms(e.target.checked);
                            setAcceptPrivacy(e.target.checked);
                          }}
                          className="mt-0.5 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="accept-terms-privacy" className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal font-medium cursor-pointer">
                          I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Privacy Policy</a>.
                        </label>
                      </div>

                      {/* AUTH ERROR BANNER */}
                      {authError && (
                        <div className="p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-xl flex items-start space-x-2.5 text-red-600 dark:text-red-400 text-[11px] font-semibold leading-relaxed animate-shake">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{authError}</span>
                        </div>
                      )}

                      {/* SUBMIT BUTTON */}
                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={isAuthSubmitting}
                          className="w-full h-12 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                          {isAuthSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <span>Create Account & Send OTP</span>
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>

                      {!isLoggedIn && (
                        <div className="text-center pt-2 border-t border-slate-100 dark:border-zinc-800/80 mt-1">
                          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                            Already have an account?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setShowAuthModal('signin');
                                setAuthError('');
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                            >
                              Sign in
                            </button>
                          </p>
                        </div>
                      )}
                    </form>
                  )}

                  {/* STEP 3: INLINE EMAIL OTP VERIFICATION SECTION */}
                  {signupStep === 3 && (
                    <div className="space-y-4 text-xs text-left animate-fadeIn">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <ShieldCheck className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                            Verify your Email
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
                            Please enter the 6-digit OTP code we sent to <strong className="text-slate-900 dark:text-white">{pendingEmail || signupForm.email}</strong>.
                          </p>
                        </div>
                      </div>

                      {authError && (
                        <div className="p-3 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-xl flex items-start space-x-2.5 text-red-600 dark:text-red-400 text-[11px] font-semibold leading-relaxed animate-shake">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{authError}</span>
                        </div>
                      )}

                      <form onSubmit={handleVerifyOTP} className="space-y-4">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-mono">Enter 6-Digit Code</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            autoFocus
                            value={verificationCodeInput}
                            onChange={(e) => setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="6-digit code"
                            className="w-full h-12 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-sm font-mono font-bold tracking-widest text-center focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={resendCooldown > 0 || isAuthSubmitting}
                            onClick={handleResendOTP}
                            className="flex-1 h-11 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 text-xs"
                          >
                            {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend Code"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSignupStep(1);
                              setPendingEmail('');
                              localStorage.removeItem('opencomm_pending_email');
                            }}
                            className="px-3.5 h-11 border border-slate-200 dark:border-zinc-800 text-slate-500 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-xs cursor-pointer"
                          >
                            Change Email
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={isAuthSubmitting || verificationCodeInput.length !== 6}
                          className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold rounded-xl cursor-pointer flex items-center justify-center text-xs shadow-md disabled:opacity-50"
                        >
                          {isAuthSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            "Verify & Continue"
                          )}
                        </button>
                      </form>
                    </div>
                  )}

                </div>
              )}

              {/* Avatar Gallery Modal */}
              <AvatarGalleryModal
                isOpen={showAvatarGalleryModal}
                onClose={() => setShowAvatarGalleryModal(false)}
                onSelectAvatar={(url) => {
                  setSelectedAvatar(url);
                  setWorkerForm(prev => ({ ...prev, avatarUrl: url }));
                  setUserPhoto(url);
                  setCroppedFile(null);
                }}
                selectedAvatarUrl={selectedAvatar || workerForm.avatarUrl}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
