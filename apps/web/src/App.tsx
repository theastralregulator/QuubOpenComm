import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, X, Plus, UserPlus, Briefcase, DollarSign, MapPin, 
  ChevronRight, Calendar, AlertCircle, RefreshCw, Compass, Eye, EyeOff, Lock,
  Mail
} from 'lucide-react';
import { Job, Worker, Category, Activity, Notification, Message, JobApplication, ApplicationMessage, Conversation, Work } from './types';
import { supabase, initializeRuntimeSupabase, dbService } from './lib/supabase';
import { signUpSchema, basicProfileSchema } from './lib/auth-schemas';
import { 
  INITIAL_CATEGORIES, 
  INITIAL_JOBS, 
  INITIAL_WORKERS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_MESSAGES, 
  INITIAL_ACTIVITIES,
  INITIAL_CONVERSATIONS,
  INITIAL_APPLICATIONS,
  INITIAL_APP_MESSAGES
} from './data';

// Import our highly polished subcomponents
import Navbar from './components/navigation/Navbar';
import HeroSection from './components/home/HeroSection';
import SearchBar from './components/common/SearchBar';
import QuickActions from './components/home/QuickActions';
import DashboardSummary from './components/home/DashboardSummary';
import RecommendedForYou from './components/home/RecommendedForYou';
import JobsPage from './components/jobs/JobsPage';
import WorkersPage from './components/workers/WorkersPage';
import SavedJobsPage from './components/saved/SavedJobsPage';
import SavedWorkersPage from './components/saved/SavedWorkersPage';
import MessagesPage from './components/messages/MessagesPage';
import ProfilePage from './components/profile/ProfilePage';

export default function App() {
  // --- CORE SYSTEM STATES ---
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES);
  
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [applications, setApplications] = useState<JobApplication[]>(INITIAL_APPLICATIONS);
  const [appMessages, setAppMessages] = useState<ApplicationMessage[]>(INITIAL_APP_MESSAGES);
  
  // Custom states
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Router Active view
  const [currentView, setCurrentView] = useState('home'); // home, jobs, workers, messages, profile, saved-jobs, saved-workers
  
  // Dynamic User Profile
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('opencomm_is_logged_in') === 'true';
  });
  const [userType, setUserType] = useState<'normal' | 'worker' | 'company'>(() => {
    return (localStorage.getItem('opencomm_user_type') as any) || 'normal';
  });
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('opencomm_username') || 'Akhil Varma';
  });
  const [userPhoto, setUserPhoto] = useState(() => {
    return localStorage.getItem('opencomm_user_photo') || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
  });

  // UI Modals & Menus
  const [showPostJob, setShowPostJob] = useState(false);
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [showHireModal, setShowHireModal] = useState<Worker | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // Auth Modal States
  const [showAuthModal, setShowAuthModal] = useState<'signin' | 'signup' | 'locked' | null>(null);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupType, setSignupType] = useState<'normal' | 'worker' | 'company'>('normal');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [onboardingForm, setOnboardingForm] = useState({
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    preferred_language: 'English',
    bio: 'Local professional specialized in high-fidelity craftsmanship.',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
  });
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
  const [signinUsername, setSigninUsername] = useState('Akhil Varma');
  const [signinPassword, setSigninPassword] = useState('password123');
  const [showSigninPassword, setShowSigninPassword] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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
  const [newJobCategory, setNewJobCategory] = useState('Developer');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobReqs, setNewJobReqs] = useState('');

  // Form states for Create Worker Profile
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerTitle, setNewWorkerTitle] = useState('');
  const [newWorkerRate, setNewWorkerRate] = useState(65);
  const [newWorkerLocation, setNewWorkerLocation] = useState('');
  const [newWorkerBio, setNewWorkerBio] = useState('');
  const [newWorkerSkills, setNewWorkerSkills] = useState('');

  // Form states for Hiring a Worker
  const [hireProjectTitle, setHireProjectTitle] = useState('');
  const [hireProjectDesc, setHireProjectDesc] = useState('');
  const [hireOfferRate, setHireOfferRate] = useState(0);

  // --- THEME SYNC ---
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (systemTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // --- INITIALIZE SUPABASE AUTH LISTENER ---
  useEffect(() => {
    initializeRuntimeSupabase().then(() => {
      if (supabase) {
        // Fetch current session
        supabase.auth.getSession().then(({ data: { session } }: any) => {
          if (session?.user) {
            syncUserSession(session);
          }
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
          if (session?.user) {
            syncUserSession(session);
          } else {
            handleLogoutCleanState();
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      }
    });
  }, []);

  const syncUserSession = async (session: any) => {
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
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        phone: user.user_metadata?.phone || '',
        phone_verified: false,
        profile_type: 'basic',
        account_status: 'active'
      });
    }

    setIsLoggedIn(true);
    setUsername(profile.full_name || userEmail.split('@')[0]);
    setUserPhoto(profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setUserType(profile.profile_type as any || 'normal');

    localStorage.setItem('opencomm_is_logged_in', 'true');
    localStorage.setItem('opencomm_username', profile.full_name || userEmail.split('@')[0]);
    localStorage.setItem('opencomm_user_photo', profile.avatar_url || '');
    localStorage.setItem('opencomm_user_type', profile.profile_type || 'normal');
    localStorage.setItem('opencomm_user_id', userId);

    if (!profile.city) {
      setShowAuthModal('signup');
      setSignupStep(3);
      setSignupForm(prev => ({
        ...prev,
        name: profile?.full_name || user.user_metadata?.full_name || userEmail.split('@')[0],
        email: userEmail,
        phone: profile?.phone || user.user_metadata?.phone || ''
      }));
    }
  };

  const handleLogoutCleanState = () => {
    setIsLoggedIn(false);
    setUsername('Akhil Varma');
    setUserPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    setUserType('normal');
    
    localStorage.removeItem('opencomm_is_logged_in');
    localStorage.removeItem('opencomm_username');
    localStorage.removeItem('opencomm_user_photo');
    localStorage.removeItem('opencomm_user_type');
    localStorage.removeItem('opencomm_user_id');
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
    setNotifications(INITIAL_NOTIFICATIONS);
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
    setUsername('Akhil Varma');
    setUserPhoto('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');
    localStorage.setItem('opencomm_is_logged_in', 'true');
    localStorage.setItem('opencomm_user_type', 'normal');
    localStorage.setItem('opencomm_username', 'Akhil Varma');
    localStorage.setItem('opencomm_user_photo', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80');

    triggerToast("Sandbox demo state successfully restored.");
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

  const handleLoginSuccess = (uName: string, uType: 'normal' | 'worker' | 'company') => {
    setIsLoggedIn(true);
    setUserType(uType);
    setUsername(uName);
    
    const photos = [
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80'
    ];
    const pickedPhoto = photos[Math.floor(Math.random() * photos.length)];
    setUserPhoto(pickedPhoto);

    localStorage.setItem('opencomm_is_logged_in', 'true');
    localStorage.setItem('opencomm_user_type', uType);
    localStorage.setItem('opencomm_username', uName);
    localStorage.setItem('opencomm_user_photo', pickedPhoto);

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

    const newNotif: Notification = {
      id: `notif-login-${Date.now()}`,
      type: 'system',
      title: 'Session Started Successfully',
      description: `Welcome back to the OpenComm secure workspace, ${uName}!`,
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

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
    triggerToast("Signed out. Browse view initialized.");
  };

  // --- MULTI-STEP SIGNUP FLOW HANDLERS ---
  const handleSignUpStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    // Validate Step 1 form fields using our Zod signUpSchema
    const parseResult = signUpSchema.safeParse({
      full_name: signupForm.name,
      email: signupForm.email,
      phone: signupForm.phone,
      password: signupPassword,
      confirm_password: signupConfirmPassword,
      accept_terms: acceptTerms
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid registration details';
      setAuthError(firstError);
      return;
    }

    setIsAuthSubmitting(true);

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: signupForm.email,
          password: signupPassword,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: signupForm.name,
              phone: signupForm.phone
            }
          }
        });

        setIsAuthSubmitting(false);

        if (error) {
          setAuthError(error.message);
          return;
        }

        setSignupStep(2);
        setResendCooldown(60);
        triggerToast("Verification email dispatched! Please check your inbox.");
      } catch (err: any) {
        setIsAuthSubmitting(false);
        setAuthError(err.message || "Registration failed.");
      }
    } else {
      setTimeout(() => {
        setIsAuthSubmitting(false);
        setSignupStep(2);
        setResendCooldown(60);
        triggerToast("Verification email dispatched (Mock)!");
      }, 800);
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
            emailRedirectTo: window.location.origin
          }
        });

        setIsAuthSubmitting(false);

        if (error) {
          setAuthError(error.message);
          return;
        }

        setResendCooldown(60);
        triggerToast("Verification email re-dispatched!");
      } catch (err: any) {
        setIsAuthSubmitting(false);
        setAuthError(err.message || "Failed to resend verification email.");
      }
    } else {
      setTimeout(() => {
        setIsAuthSubmitting(false);
        setResendCooldown(60);
        triggerToast("Verification email re-dispatched (Mock)!");
      }, 800);
    }
  };

  const handleSignUpStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const parseResult = basicProfileSchema.safeParse({
      city: onboardingForm.city,
      state: onboardingForm.state,
      country: onboardingForm.country,
      preferred_language: onboardingForm.preferred_language,
      bio: onboardingForm.bio
    });

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid profile details';
      setAuthError(firstError);
      return;
    }

    setIsAuthSubmitting(true);

    let finalUserId = `mock-user-${Date.now()}`;
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        finalUserId = session.user.id;
      }
    }

    // Sync profile updating details with dbService
    await dbService.updateProfile(finalUserId, {
      id: finalUserId,
      full_name: signupForm.name,
      email: signupForm.email,
      phone: signupForm.phone,
      city: onboardingForm.city,
      state: onboardingForm.state,
      country: onboardingForm.country,
      preferred_language: onboardingForm.preferred_language,
      bio: onboardingForm.bio,
      avatar_url: onboardingForm.avatar_url,
      profile_type: 'basic',
      account_status: 'active'
    });

    setIsAuthSubmitting(false);

    // Sync application-wide logged-in states
    setIsLoggedIn(true);
    setUsername(signupForm.name);
    setUserPhoto(onboardingForm.avatar_url);
    setUserType('normal');

    localStorage.setItem('opencomm_is_logged_in', 'true');
    localStorage.setItem('opencomm_username', signupForm.name);
    localStorage.setItem('opencomm_user_photo', onboardingForm.avatar_url);
    localStorage.setItem('opencomm_user_type', 'normal');
    localStorage.setItem('opencomm_user_id', finalUserId);

    // Complete onboarding flow
    setSignupStep(1);
    setShowAuthModal(null);
    setLockedFeature(null);
    triggerToast("Onboarding complete! Welcome to OpenComm.");
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

        // Add notification
        const newNotif: Notification = {
          id: `notif-${Date.now()}`,
          type: 'application',
          title: 'Application Sent Successfully',
          description: `Your application for "${j.title}" with bid ${bid} is now Pending.`,
          timestamp: 'Just now',
          read: false
        };
        setNotifications(prevNotif => [newNotif, ...prevNotif]);

        triggerToast(`Successfully applied to "${j.title}"!`);
        return { ...j, applied: true };
      }
      return j;
    }));
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle || !newJobCompany || !newJobSalary) {
      alert("Please fill in the title, company, and salary rate.");
      return;
    }

    const createdJob: Job = {
      id: `job-${Date.now()}`,
      title: newJobTitle,
      company: newJobCompany,
      companyLogo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=120&h=120&q=80',
      salary: newJobSalary,
      location: newJobLocation || 'Remote',
      category: newJobCategory,
      description: newJobDesc || 'No custom description provided.',
      requirements: newJobReqs ? newJobReqs.split(',').map(r => r.trim()) : ['React/TypeScript', 'Tailwind', 'Immediate availability'],
      verified: true,
      bookmarked: false,
      applied: false,
      datePosted: 'Just now'
    };

    setJobs(prev => [createdJob, ...prev]);

    const newAct: Activity = {
      id: `act-${Date.now()}`,
      type: 'post',
      title: `Posted job: "${newJobTitle}"`,
      status: 'Active (0 offers)',
      statusType: 'success',
      timestamp: 'Just now'
    };
    setActivities(prev => [newAct, ...prev]);

    triggerToast(`Job "${newJobTitle}" posted to marketplace!`);
    setShowPostJob(false);

    // Reset Form
    setNewJobTitle('');
    setNewJobCompany('');
    setNewJobSalary('');
    setNewJobLocation('');
    setNewJobDesc('');
    setNewJobReqs('');
  };

  const handleCreateWorker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerName || !newWorkerTitle) {
      alert("Please provide a name and professional title.");
      return;
    }

    const createdWorker: Worker = {
      id: `worker-${Date.now()}`,
      name: newWorkerName,
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      title: newWorkerTitle,
      experience: 4,
      rating: 5.0,
      availability: 'Available Now',
      location: newWorkerLocation || 'Remote',
      bio: newWorkerBio || 'Professional contractor ready to assist with local and remote briefs.',
      skills: newWorkerSkills ? newWorkerSkills.split(',').map(s => s.trim()) : ['Tailwind CSS', 'Framer Motion', 'Customer Sync'],
      completedWorks: 0,
      hourlyRate: Number(newWorkerRate) || 55,
      verified: true
    };

    setWorkers(prev => [createdWorker, ...prev]);

    const newAct: Activity = {
      id: `act-${Date.now()}`,
      type: 'post',
      title: `Created active Worker Profile: "${newWorkerTitle}"`,
      status: 'Listed',
      statusType: 'success',
      timestamp: 'Just now'
    };
    setActivities(prev => [newAct, ...prev]);

    triggerToast(`Congratulations! Professional profile listed under "${newWorkerTitle}".`);
    setShowCreateProfile(false);

    // Reset form
    setNewWorkerName('');
    setNewWorkerTitle('');
    setNewWorkerRate(65);
    setNewWorkerLocation('');
    setNewWorkerBio('');
    setNewWorkerSkills('');
  };

  const triggerHireModal = (worker: Worker, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowHireModal(worker);
    setHireOfferRate(worker.hourlyRate);
    setHireProjectTitle(`Bespoke ${worker.title.split(' ')[0] || 'Consultation'}`);
  };

  const handleHireWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showHireModal) return;

    const newAct: Activity = {
      id: `act-${Date.now()}`,
      type: 'hire',
      title: `Hired ${showHireModal.name} for "${hireProjectTitle}"`,
      status: 'Awaiting Response',
      statusType: 'pending',
      timestamp: 'Just now'
    };
    setActivities(prev => [newAct, ...prev]);

    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      type: 'hire',
      title: `Contract Offer Transmitted`,
      description: `Your custom offer of $${hireOfferRate}/hr has been submitted to ${showHireModal.name}.`,
      timestamp: 'Just now',
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);

    triggerToast(`Hiring contract offer transmitted securely to ${showHireModal.name}!`);
    setShowHireModal(null);
    setHireProjectTitle('');
    setHireProjectDesc('');
  };

  const handleOpenDirectMessage = (contactName: string) => {
    // Switch to messages page and auto-select contact
    setCurrentView('messages');
    triggerToast(`Opening direct conversation with ${contactName}...`);
  };

  // --- STAT CALCULATORS ---
  const myPostsCount = activities.filter(a => a.type === 'post').length;
  const myWorksCount = 2; // static in-progress
  const unreadMessagesCount = messages.filter(m => m.unread || m.role === 'assistant').length;
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const savedJobsCount = jobs.filter(j => j.bookmarked).length;
  const savedWorkersCount = workers.filter(w => (w as any).bookmarked).length;
  const profileViewsCount = 482;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1020] text-[#0F172A] dark:text-[#F8FAFC] font-sans transition-colors duration-300 relative overflow-x-hidden pb-24 md:pb-8">
      
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
            <div className="p-1 rounded-full bg-blue-500/20 text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs sm:text-sm font-semibold tracking-wide">{successToast}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STICKY TOP NAVBAR */}
      <Navbar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        themeMode={theme}
        setThemeMode={setTheme}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        username={username}
        setUsername={setUsername}
        userPhoto={userPhoto}
        notifications={notifications}
        setNotifications={setNotifications}
        onResetData={handleResetData}
        isLoggedIn={isLoggedIn}
        userType={userType}
        onOpenAuth={(tab) => {
          setSignupStep(1);
          setShowAuthModal(tab);
        }}
        onLogout={handleLogout}
      />

      {/* CORE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-[calc(90px+env(safe-area-inset-bottom))]">
        
        <AnimatePresence mode="wait">
          
          {/* 1. HOME/DASHBOARD VIEW */}
          {currentView === 'home' && (
            <motion.div
              key="home-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4 sm:space-y-6 md:space-y-8"
            >
              {/* Dynamic Welcome Hero Section */}
              <HeroSection 
                username={isLoggedIn ? username : "Guest"}
                searchQuery={searchQuery}
                setSearchQuery={(q) => {
                  setSearchQuery(q);
                  setCurrentView('jobs'); // auto-redirect search queries to Jobs list
                }}
                triggerToast={triggerToast}
              />

              {/* Standardized Float Search Bar */}
              <SearchBar 
                value={searchQuery}
                onChange={(v) => setSearchQuery(v)}
                onClear={() => setSearchQuery('')}
                onSubmit={(e) => {
                  e.preventDefault();
                  setCurrentView('jobs');
                }}
              />

              {/* 6 Card Quick Actions Hub */}
              <QuickActions 
                onFindJobs={() => setCurrentView('jobs')}
                onFindWorkers={() => setCurrentView('workers')}
                onPostJob={() => requireAuth('Post Jobs', () => setShowPostJob(true))}
                onCreateProfile={() => requireAuth('Create Worker Profile', () => setShowCreateProfile(true))}
                onOpenMessages={() => requireAuth('Send Messages', () => setCurrentView('messages'))}
                onOpenProfile={() => requireAuth('View Full Profile', () => setCurrentView('profile'))}
              />

              {/* Quick statistics summary widgets (only shown to logged-in users) */}
              {isLoggedIn && (
                <DashboardSummary 
                  myPostsCount={myPostsCount}
                  myWorksCount={myWorksCount}
                  unreadMessagesCount={unreadMessagesCount}
                  savedJobsCount={savedJobsCount}
                  savedWorkersCount={savedWorkersCount}
                  profileViewsCount={profileViewsCount}
                  onAction={(view) => setCurrentView(view)}
                />
              )}

              {/* Recommended Marketplace Listings */}
              <RecommendedForYou 
                jobs={jobs}
                workers={workers}
                toggleBookmark={toggleBookmark}
                toggleWorkerBookmark={toggleWorkerBookmark}
                handleApplyJob={handleApplyJob}
                onOpenMessage={handleOpenDirectMessage}
                onViewJobs={() => setCurrentView('jobs')}
                onViewWorkers={() => setCurrentView('workers')}
              />
            </motion.div>
          )}

          {/* 2. JOBS VIEW */}
          {currentView === 'jobs' && (
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
                  setSignupStep(1);
                  setShowAuthModal(tab);
                }}
              />
            </motion.div>
          )}

          {/* 3. WORKERS VIEW */}
          {currentView === 'workers' && (
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
                  setSignupStep(1);
                  setShowAuthModal(tab);
                }}
              />
            </motion.div>
          )}

          {/* 4. SAVED JOBS SHORTCUT */}
          {currentView === 'saved-jobs' && (
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
                onExplore={() => setCurrentView('jobs')}
              />
            </motion.div>
          )}

          {/* 5. SAVED WORKERS SHORTCUT */}
          {currentView === 'saved-workers' && (
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
                onExplore={() => setCurrentView('workers')}
              />
            </motion.div>
          )}

          {/* 6. MESSAGES VIEW */}
          {currentView === 'messages' && (
            <motion.div
              key="messages-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <MessagesPage 
                messages={messages}
                setMessages={setMessages}
                conversations={conversations}
                setConversations={setConversations}
                username={username}
                userPhoto={userPhoto}
                triggerToast={triggerToast}
              />
            </motion.div>
          )}

          {/* 7. PROFILE VIEW */}
          {currentView === 'profile' && (
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
                setShowPostJob={setShowPostJob}
                setShowCreateProfile={setShowCreateProfile}
                isLoggedIn={isLoggedIn}
                userType={userType}
                setUserType={setUserType}
                onLogout={handleLogout}
              />
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* ====================================================
          MODAL 1: POST A JOB
         ==================================================== */}
      <AnimatePresence>
        {showPostJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-xl overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Post an Active Job Listing</span>
                </div>
                <button 
                  onClick={() => setShowPostJob(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateJob} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Job Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Senior Figma Designer"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Company / Household Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. OpenComm Labs"
                      value={newJobCompany}
                      onChange={(e) => setNewJobCompany(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Salary or Budget (e.g. $65/hr, $1500/mo)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. $85/hr"
                      value={newJobSalary}
                      onChange={(e) => setNewJobSalary(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Austin, TX (or Remote)"
                      value={newJobLocation}
                      onChange={(e) => setNewJobLocation(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
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
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Core Requirements (comma-separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Figma, Framer, NextJS"
                      value={newJobReqs}
                      onChange={(e) => setNewJobReqs(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
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

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowPostJob(false)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer hover:scale-102 active:scale-98"
                  >
                    Publish Listing
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 2: CREATE WORKER PROFILE
         ==================================================== */}
      <AnimatePresence>
        {showCreateProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-xl overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
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

              {/* Form */}
              <form onSubmit={handleCreateWorker} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Full Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Akhil Varma"
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
                      placeholder="e.g. Senior Carpenter / Lead JS Developer"
                      value={newWorkerTitle}
                      onChange={(e) => setNewWorkerTitle(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Desired Hourly Rate ($/hr)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 75"
                      value={newWorkerRate}
                      onChange={(e) => setNewWorkerRate(Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Base Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Austin, TX (or Remote)"
                      value={newWorkerLocation}
                      onChange={(e) => setNewWorkerLocation(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Skills / Tools List (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Figma, React, Framer Motion, CSS"
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

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5">
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
          MODAL 3: HIRE WORKER / CONTRACT ESCROW INITIALIZATION
         ==================================================== */}
      <AnimatePresence>
        {showHireModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-[#273449] w-full max-w-lg overflow-hidden shadow-2xl text-left"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Initialize Contract Offer</span>
                </div>
                <button 
                  onClick={() => setShowHireModal(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleHireWorkerSubmit} className="p-6 space-y-4 text-xs">
                
                {/* Micro safety escrow alert */}
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed font-medium">
                  🔒 <strong>OpenComm Shield Protection:</strong> Funds will be locked in standard safe escrow milestones and only released as deliverables are checked.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Contractor</label>
                    <input 
                      type="text" 
                      disabled
                      value={showHireModal.name}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/75 rounded-xl text-slate-500 dark:text-slate-400 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Hourly Offer Rate ($/hr)</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 75"
                      value={hireOfferRate}
                      onChange={(e) => setHireOfferRate(Number(e.target.value))}
                      className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Project Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Premium Oak Kitchen Cabinet Trim Setup"
                    value={hireProjectTitle}
                    onChange={(e) => setHireProjectTitle(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-400 uppercase tracking-widest font-mono text-[9px]">Brief Description of Milestone Deliverables</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="State the milestones you want completed before final escrow payment releases..."
                    value={hireProjectDesc}
                    onChange={(e) => setHireProjectDesc(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-xl text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 leading-relaxed"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2.5">
                  <button 
                    type="button"
                    onClick={() => setShowHireModal(null)}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl font-bold transition-all shadow-md cursor-pointer hover:scale-102 active:scale-98"
                  >
                    Transmit Escrow Offer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ====================================================
          MODAL 4: AUTHENTICATION & ONBOARDING SYSTEM (UNIVERSAL ACCOUNT)
         ==================================================== */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-[#f7f8fa] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_38%)] dark:bg-[#0b0d12] dark:bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_38%)] backdrop-blur-lg overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[440px] p-6 rounded-[24px] bg-white/92 dark:bg-zinc-900/92 border border-slate-900/8 dark:border-white/8 shadow-2xl dark:shadow-[0_24px_70px_rgba(0,0,0,0.32)] backdrop-blur-[20px] transition-all relative flex flex-col h-auto my-auto text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowAuthModal(null);
                  setLockedFeature(null);
                  setAuthError('');
                }}
                className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Centered OpenComm Brand Logo */}
              <div className="flex flex-col items-center mb-5 mt-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-md shadow-blue-500/10 mb-3.5">
                  <Compass className="w-5.5 h-5.5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent">
                  OpenComm
                </span>
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
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs flex items-start space-x-2.5 font-medium leading-normal animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* --- CASE A: LOCKED FEATURE VIEW --- */}
              {showAuthModal === 'locked' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-blue-500/5 dark:bg-blue-600/5 border border-blue-500/10 dark:border-blue-500/15 rounded-xl flex items-start space-x-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <span className="text-base mt-0.5">🔒</span>
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
                        } else {
                          setShowAuthModal(null);
                          setLockedFeature(null);
                          triggerToast("Signed in successfully!");
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
                      }, 800);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      Email address or Username
                    </label>
                    <input 
                      type="text" 
                      name="username"
                      required
                      value={signinUsername}
                      onChange={(e) => setSigninUsername(e.target.value)}
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold transition-all"
                      placeholder="e.g. akhil.v@opencomm.io"
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
                        value={signinPassword}
                        onChange={(e) => setSigninPassword(e.target.value)}
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-[#94A3B8] font-semibold transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigninPassword(!showSigninPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
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
                              redirectTo: window.location.origin
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

              {/* --- CASE C: MULTI-STEP SIGN UP & ONBOARDING FORM --- */}
              {showAuthModal === 'signup' && (
                <div className="space-y-4">
                  {/* Step Header Indicator */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      Step {signupStep} of 3
                    </span>
                    <div className="flex space-x-1.5">
                      <span className={`w-2.5 h-1.5 rounded-full transition-all ${signupStep >= 1 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                      <span className={`w-2.5 h-1.5 rounded-full transition-all ${signupStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                      <span className={`w-2.5 h-1.5 rounded-full transition-all ${signupStep >= 3 ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-800'}`} />
                    </div>
                  </div>

                  {signupStep === 1 && (
                    <form onSubmit={handleSignUpStep1} className="space-y-3.5 text-xs">
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Full Name
                        </label>
                        <input 
                          type="text" 
                          required
                          value={signupForm.name}
                          onChange={(e) => setSignupForm({...signupForm, name: e.target.value})}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold"
                          placeholder="e.g. Akhil Varma"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Email Address
                        </label>
                        <input 
                          type="email" 
                          required
                          value={signupForm.email}
                          onChange={(e) => setSignupForm({...signupForm, email: e.target.value})}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold"
                          placeholder="e.g. akhil.v@opencomm.io"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Phone Number (with Country Code)
                        </label>
                        <input 
                          type="tel" 
                          required
                          value={signupForm.phone}
                          onChange={(e) => setSignupForm({...signupForm, phone: e.target.value})}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold"
                          placeholder="e.g. +919876543210"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Password
                        </label>
                        <div className="relative">
                          <input 
                            type={showSignupPassword ? "text" : "password"} 
                            required
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold"
                            placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignupPassword(!showSignupPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                          >
                            {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Confirm Password
                        </label>
                        <input 
                          type={showSignupPassword ? "text" : "password"} 
                          required
                          value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 font-semibold"
                          placeholder="Confirm password"
                        />
                      </div>

                      <div className="flex items-start space-x-2.5 pt-1">
                        <input 
                          type="checkbox"
                          id="accept-terms"
                          required
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <label htmlFor="accept-terms" className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal font-medium cursor-pointer">
                          I accept the <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Terms of Service</span> and <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Privacy Policy</span>.
                        </label>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <span>Continue</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center pt-2 border-t border-slate-100 dark:border-zinc-800/80 mt-2">
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
                    </form>
                  )}

                  {signupStep === 2 && (
                    <div className="space-y-4 text-xs text-center py-4">
                      <div className="w-16 h-16 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                        <Mail className="w-8 h-8 animate-pulse" />
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Check your email</h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium max-w-xs mx-auto">
                          We have dispatched a verification link to <strong className="text-indigo-600 dark:text-indigo-400">{signupForm.email}</strong>. 
                          Please click the link inside that email to verify your address and continue onboarding.
                        </p>
                      </div>

                      {authError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-600 dark:text-red-400 font-medium">
                          {authError}
                        </div>
                      )}

                      <div className="pt-4 space-y-2">
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || isAuthSubmitting}
                          onClick={handleResendVerificationEmail}
                          className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                          {isAuthSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <span>
                              {resendCooldown > 0 
                                ? `Resend email (${resendCooldown}s)` 
                                : 'Resend verification email'}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSignupStep(1)}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white hover:underline cursor-pointer font-bold block mx-auto pt-1"
                        >
                          Back to signup details
                        </button>
                      </div>
                    </div>
                  )}

                  {signupStep === 3 && (
                    <form onSubmit={handleSignUpStep3} className="space-y-3.5 text-xs">
                      {/* Avatar Picker */}
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Choose your profile avatar
                        </label>
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-200/40 dark:border-white/8">
                          {[
                            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80',
                            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&h=100&q=80',
                            'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&h=100&q=80',
                            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&h=100&q=80',
                            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&h=100&q=80'
                          ].map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setOnboardingForm({...onboardingForm, avatar_url: url})}
                              className={`w-11 h-11 rounded-full overflow-hidden transition-transform border-2 cursor-pointer ${
                                onboardingForm.avatar_url === url 
                                  ? 'border-indigo-600 scale-110 shadow-md shadow-indigo-600/10' 
                                  : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                              }`}
                            >
                              <img src={url} alt={`avatar-${i}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* City and State */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            City
                          </label>
                          <input 
                            type="text" 
                            required
                            value={onboardingForm.city}
                            onChange={(e) => setOnboardingForm({...onboardingForm, city: e.target.value})}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                            placeholder="e.g. Austin"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            District / State
                          </label>
                          <input 
                            type="text" 
                            required
                            value={onboardingForm.state}
                            onChange={(e) => setOnboardingForm({...onboardingForm, state: e.target.value})}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                            placeholder="e.g. Texas"
                          />
                        </div>
                      </div>

                      {/* Country and Language */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Country
                          </label>
                          <input 
                            type="text" 
                            required
                            value={onboardingForm.country}
                            onChange={(e) => setOnboardingForm({...onboardingForm, country: e.target.value})}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                            placeholder="e.g. USA"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Preferred Language
                          </label>
                          <input 
                            type="text" 
                            required
                            value={onboardingForm.preferred_language}
                            onChange={(e) => setOnboardingForm({...onboardingForm, preferred_language: e.target.value})}
                            className="w-full h-11 px-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-semibold"
                            placeholder="e.g. English"
                          />
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          Short Bio
                        </label>
                        <textarea 
                          rows={2.5}
                          value={onboardingForm.bio}
                          onChange={(e) => setOnboardingForm({...onboardingForm, bio: e.target.value})}
                          className="w-full p-3.5 rounded-xl border border-slate-900/12 dark:border-white/12 bg-white/90 dark:bg-zinc-950/90 text-slate-950 dark:text-white text-xs focus:outline-none focus:border-blue-500 font-medium leading-relaxed resize-none"
                          placeholder="Tell the community about your expertise..."
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isAuthSubmitting}
                          className="w-full h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                          {isAuthSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <span>Finish & Join OpenComm</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
