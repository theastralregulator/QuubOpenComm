import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, Briefcase, Users, MessageSquare, User,
  Sun, Moon, Settings, X, RefreshCcw,
  Info, Star, ChevronRight, Bookmark, Heart, LogOut
} from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import OpenCommLogo from '../common/OpenCommLogo';
import NotificationBell from '../notifications/NotificationBell';

export interface NavbarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  themeMode?: 'light' | 'dark';
  setThemeMode?: (mode: 'light' | 'dark') => void;
  unreadMessagesCount: number;
  unreadWorkflowCount: number;
  currentUserId?: string | null;
  username: string;
  setUsername: (name: string) => void;
  userPhoto: string;
  onResetData: () => void;
  isLoggedIn: boolean;
  userType: 'normal' | 'worker' | 'company';
  onOpenAuth: (tab: 'signin' | 'signup') => void;
  onLogout: () => void;
  isEmailVerified?: boolean;
  onVerifyEmail?: () => void;
}

export default function Navbar({
  currentView,
  setCurrentView,
  themeMode = 'light',
  setThemeMode,
  unreadMessagesCount,
  unreadWorkflowCount,
  currentUserId,
  username,
  setUsername,
  userPhoto,
  onResetData,
  isLoggedIn,
  userType,
  onOpenAuth,
  onLogout,
  isEmailVerified = true,
  onVerifyEmail,
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSettingsSub, setShowSettingsSub] = useState(false);

  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showProfileMenu) return;

    const handleOutsidePointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        profileButtonRef.current?.contains(target) ||
        profileMenuRef.current?.contains(target)
      ) {
        return;
      }
      setShowProfileMenu(false);
      setShowSettingsSub(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileMenu(false);
        setShowSettingsSub(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileMenu]);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, to: '/' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, to: '/jobs' },
    { id: 'workers', label: 'Workers', icon: Users, to: '/workers' },
    ...(isLoggedIn ? [] : [{ id: 'about', label: 'About', icon: Info, to: '/about' }]),
    ...(isLoggedIn ? [
      { id: 'messages', label: 'Messages', icon: MessageSquare, badgeCount: unreadMessagesCount, to: '/messages' },
      { id: 'profile', label: 'Profile', icon: User, badgeCount: unreadWorkflowCount, to: '/profile' },
    ] : [])
  ];

  // Map nav id -> route path
  const navRoutes: Record<string, string> = {
    home: '/',
    jobs: '/jobs',
    workers: '/workers',
    about: '/about',
    messages: '/messages',
    profile: '/profile',
    'saved-jobs': '/profile/saved-jobs',
    'saved-workers': '/profile/saved-workers',
  };

  const handleNavClick = useCallback((viewId: string) => {
    const targetPath = navRoutes[viewId];
    if (targetPath && location.pathname === targetPath) {
      // Already on this route — scroll to top smoothly instead of navigating
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (targetPath) {
      navigate(targetPath);
    }
    setShowProfileMenu(false);
    setShowSettingsMenu(false);
    setShowThemeMenu(false);
  }, [location.pathname, navigate]);

  return (
    <>
      {/* DESKTOP & TABLET HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-[#080B18]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#273449]/40 transition-colors duration-300">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-13 md:h-16 flex items-center justify-between">
          
          {/* Logo Brand Section */}
          <OpenCommLogo 
            variant="navbar" 
            isLoggedIn={isLoggedIn}
            onClick={() => handleNavClick('home')} 
          />

          {/* Center Navigation Links (Hidden on mobile) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-slate-100/60 p-1 rounded-full border border-slate-200/50" id="desktop-nav">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const pathname = location.pathname;
              const isActive = 
                item.id === 'home' ? pathname === '/' :
                item.id === 'jobs' ? (pathname === '/jobs' || pathname.startsWith('/jobs/')) :
                item.id === 'workers' ? (pathname === '/workers' || pathname.startsWith('/workers/')) :
                item.id === 'about' ? (pathname === '/about' || pathname.startsWith('/about/')) :
                item.id === 'messages' ? (pathname === '/messages' || pathname.startsWith('/messages/')) :
                item.id === 'profile' ? (pathname === '/profile' || pathname.startsWith('/profile/')) :
                false;
              
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(e) => {
                    if (item.id === 'profile') {
                      window.dispatchEvent(new Event('opencomm:navigate-profile'));
                      if (pathname === '/profile') {
                        e.preventDefault();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    } else if (isActive) {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                    setShowProfileMenu(false);
                    setShowSettingsMenu(false);
                    setShowThemeMenu(false);
                  }}
                  className={`relative px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center space-x-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${!isActive ? 'hover:bg-slate-100 dark:hover:bg-slate-800/50' : ''}`}
                  id={`nav-${item.id}`}
                  aria-label={item.badgeCount && item.badgeCount > 0 ? `${item.label}, ${item.badgeCount > 99 ? '99+' : item.badgeCount} unread` : item.label}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-gradient-to-r from-[#2563EB] to-[#7C3AED] rounded-full -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <IconComponent className={`w-4 h-4 z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900'}`} />
                  <span className={`z-10 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'}`}>
                    {item.label}
                  </span>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#080B18]">
                      {item.badgeCount > 99 ? '99+' : item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Action Icons Panel */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {!isLoggedIn ? (
              <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-row flex-nowrap shrink-0">
                <button
                  onClick={() => onOpenAuth('signin')}
                  className="px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/60 min-h-[36px] whitespace-nowrap shrink-0"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:opacity-95 shadow-md shadow-blue-500/15 hover:shadow-blue-500/25 transition-all cursor-pointer min-h-[36px] whitespace-nowrap shrink-0"
                >
                  Create Account
                </button>
              </div>
            ) : (
              <>
                {/* Notification Bell Component */}
                <NotificationBell currentUserId={currentUserId} />

                {/* Profile Avatar Dropdown */}
                <div className="relative">
                  <button 
                    ref={profileButtonRef}
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu);
                      setShowSettingsSub(false); // Reset settings expansion on open
                    }}
                    className="relative w-8 h-8 md:w-9 md:h-9 rounded-full border border-slate-200 dark:border-slate-800 hover:scale-105 transition-all cursor-pointer shrink-0"
                    id="profile-avatar-btn"
                  >
                    <UserAvatar
                      avatarUrl={userPhoto}
                      fullName={username}
                      size="sm"
                    />
                    {!isEmailVerified && (
                      <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#080B18]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showProfileMenu && (
                      <motion.div
                        ref={profileMenuRef}
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2.5 w-64 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl shadow-xl z-50 overflow-hidden py-1.5"
                      >
                           {/* Header info card */}
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3 text-left bg-slate-50/40 dark:bg-slate-900/30">
                            <UserAvatar
                              avatarUrl={userPhoto}
                              fullName={username}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block font-semibold text-sm text-slate-900 dark:text-white truncate">{username}</span>
                              <div className="mt-1 flex flex-col space-y-0.5">
                                {isEmailVerified ? (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    Email Verified
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-start space-y-0.5">
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                      Email Not Verified
                                    </span>
                                    {onVerifyEmail && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowProfileMenu(false);
                                          onVerifyEmail();
                                        }}
                                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-left"
                                        id="btn-dropdown-verify-now"
                                      >
                                        Verify Now
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Menu Items */}
                          <div className="py-1">
                            <button 
                              onClick={() => {
                                handleNavClick('profile');
                                setShowProfileMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-500/10 hover:text-[#2563EB] dark:hover:text-[#60A5FA] flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <User className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
                                View Full Profile
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>

                            <button 
                              onClick={() => {
                                navigate('/profile/hire-requests');
                                setShowProfileMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <Briefcase className="w-4 h-4 mr-2.5 text-purple-500 group-hover:text-purple-600" />
                                Direct Hire Requests
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>

                            <button
                              onClick={() => {
                                handleNavClick('saved-jobs');
                                setShowProfileMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-500/10 hover:text-[#2563EB] dark:hover:text-[#60A5FA] flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <Bookmark className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
                                Saved Jobs
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>

                            <button 
                              onClick={() => {
                                handleNavClick('saved-workers');
                                setShowProfileMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-purple-500/10 hover:text-[#7C3AED] dark:hover:text-[#C084FC] flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <Heart className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400 group-hover:text-purple-500" />
                                Saved Workers
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>

                            {/* Settings Link */}
                              <button
                                onClick={() => {
                                  navigate('/profile/settings');
                                  setShowProfileMenu(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-500/10 hover:text-[#2563EB] dark:hover:text-[#60A5FA] flex items-center justify-between cursor-pointer group transition-all"
                              >
                                <span className="flex items-center font-semibold">
                                  <Settings className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
                                  Settings
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              </button>

                            <AnimatePresence>
                              {showSettingsSub && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="px-4 py-3 bg-slate-50 dark:bg-[#172033]/30 border-y border-slate-100 dark:border-slate-800/50 space-y-3 overflow-hidden"
                                >
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Edit Display Name</label>
                                    <input 
                                      type="text" 
                                      value={username}
                                      onChange={(e) => setUsername(e.target.value)}
                                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#273449] bg-white dark:bg-slate-900 text-slate-950 dark:text-white focus:outline-none focus:border-blue-500"
                                      placeholder="Username"
                                    />
                                  </div>
                                  {isLoggedIn && setThemeMode && (
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Appearance Theme</label>
                                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#111827] rounded-lg border border-slate-200/50 dark:border-slate-800/40">
                                        {[
                                          { id: 'light', label: 'Light', icon: Sun },
                                          { id: 'dark', label: 'Dark', icon: Moon }
                                        ].map((mode) => {
                                          const ModeIcon = mode.icon;
                                          const isSelected = themeMode === mode.id;
                                          return (
                                            <button
                                              key={mode.id}
                                              type="button"
                                              onClick={() => setThemeMode(mode.id as any)}
                                              className={`py-1.5 rounded-md text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                isSelected 
                                                  ? 'bg-white dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] shadow-xs' 
                                                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                                              }`}
                                            >
                                              <ModeIcon className="w-3.5 h-3.5 mb-0.5" />
                                              <span>{mode.label}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  <button 
                                    onClick={() => {
                                      onResetData();
                                      setShowProfileMenu(false);
                                    }}
                                    className="w-full text-left py-1 text-xs hover:underline flex items-center space-x-1.5 text-rose-500 font-bold cursor-pointer"
                                  >
                                    <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" />
                                    <span>Reset App Data</span>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                            <button 
                              onClick={() => {
                                onLogout();
                                setShowProfileMenu(false);
                              }}
                              className="w-full text-left px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center justify-between cursor-pointer font-semibold transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <LogOut className="w-4 h-4 mr-2.5 text-rose-500" />
                                Logout
                              </span>
                            </button>
                          </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!(location.pathname.startsWith('/jobs/') && location.pathname !== '/jobs') &&
       !(location.pathname.startsWith('/messages/') && location.pathname !== '/messages') && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pointer-events-none">
        <nav className="flex items-center justify-around h-16 px-2 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const pathname = location.pathname;
            const isActive = 
              item.id === 'home' ? pathname === '/' :
              item.id === 'jobs' ? (pathname === '/jobs' || pathname.startsWith('/jobs/')) :
              item.id === 'workers' ? (pathname === '/workers' || pathname.startsWith('/workers/')) :
              item.id === 'about' ? (pathname === '/about' || pathname.startsWith('/about/')) :
              item.id === 'messages' ? (pathname === '/messages' || pathname.startsWith('/messages/')) :
              item.id === 'profile' ? (pathname === '/profile' || pathname.startsWith('/profile/')) :
              false;
            
            return (
              <Link
                key={item.id}
                to={item.to}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  if (item.id === 'profile') {
                    window.dispatchEvent(new Event('opencomm:navigate-profile'));
                    if (pathname === '/profile') {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  } else if (isActive) {
                    // Already on this route — scroll to top instead of navigating
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  setShowProfileMenu(false);
                  setShowSettingsMenu(false);
                  setShowThemeMenu(false);
                }}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-slate-500 dark:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[48px]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                id={`mobile-nav-${item.id}`}
                aria-label={item.badgeCount && item.badgeCount > 0 ? `${item.label}, ${item.badgeCount > 99 ? '99+' : item.badgeCount} unread` : item.label}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobileActiveIndicator"
                    className="absolute top-1 w-8 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                )}
                <IconComponent className={`w-5 h-5 mb-0.5 transition-colors duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className={`text-[10px] font-medium transition-colors duration-200 leading-none ${isActive ? 'text-slate-900 dark:text-white font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.label}
                </span>
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute top-2 right-1/4 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0B0F19]">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
      )}
    </>
  );
}
