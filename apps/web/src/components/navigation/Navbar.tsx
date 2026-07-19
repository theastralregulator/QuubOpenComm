import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, Home, Briefcase, Users, MessageSquare, User, 
  Sun, Moon, Monitor, Bell, Settings, X, RefreshCcw, 
  CheckCircle2, Info, Star, ChevronRight, Bookmark, Heart, LogOut
} from 'lucide-react';
import { Notification } from '../../types';
import OpenCommLogo from '../common/OpenCommLogo';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
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
  themeMode,
  setThemeMode,
  unreadMessagesCount,
  unreadNotificationsCount,
  notifications,
  setNotifications,
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSettingsSub, setShowSettingsSub] = useState(false);

  const getThemeIcon = () => {
    if (themeMode === 'light') return <Sun className="w-4 h-4" />;
    if (themeMode === 'dark') return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, to: '/' },
    { id: 'jobs', label: 'Jobs', icon: Briefcase, to: '/jobs' },
    { id: 'workers', label: 'Workers', icon: Users, to: '/workers' },
    ...(isLoggedIn ? [
      { id: 'messages', label: 'Messages', icon: MessageSquare, badgeCount: unreadMessagesCount, to: '/messages' },
      { id: 'profile', label: 'Profile', icon: User, to: '/profile' },
    ] : [])
  ];

  const handleNavClick = (viewId: string) => {
    if (viewId === 'home') navigate('/');
    else if (viewId === 'jobs') navigate('/jobs');
    else if (viewId === 'workers') navigate('/workers');
    else if (viewId === 'messages') navigate('/messages');
    else if (viewId === 'profile') navigate('/profile');
    else if (viewId === 'saved-jobs') navigate('/profile/saved-jobs');
    else if (viewId === 'saved-workers') navigate('/profile/saved-workers');
    
    setShowNotifications(false);
    setShowProfileMenu(false);
    setShowSettingsMenu(false);
    setShowThemeMenu(false);
  };

  return (
    <>
      {/* DESKTOP & TABLET HEADER */}
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-[#080B18]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#273449]/40 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-13 md:h-16 flex items-center justify-between">
          
          {/* Logo Brand Section */}
          <OpenCommLogo 
            variant="navbar" 
            themeMode={themeMode}
            onClick={() => handleNavClick('home')} 
          />

          {/* Center Navigation Links (Hidden on mobile) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-slate-100/60 dark:bg-slate-900/40 p-1 rounded-full border border-slate-200/10 dark:border-slate-800/10" id="desktop-nav">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentView === item.id || 
                (item.id === 'home' && (currentView === 'home')) ||
                (item.id === 'profile' && (currentView === 'saved-jobs' || currentView === 'saved-workers'));
              
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  onClick={() => {
                    setShowNotifications(false);
                    setShowProfileMenu(false);
                    setShowSettingsMenu(false);
                    setShowThemeMenu(false);
                  }}
                  className="relative px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 flex items-center space-x-2 cursor-pointer outline-none"
                  id={`nav-${item.id}`}
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
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#080B18]">
                      {item.badgeCount}
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
                {/* Notification Icon */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowProfileMenu(false);
                      setShowSettingsMenu(false);
                      setShowThemeMenu(false);
                    }}
                    className="p-2 md:p-2.5 rounded-full text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                    id="notifications-btn"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    )}
                  </button>

                  {/* Notification Dropdown Box */}
                  <AnimatePresence>
                    {showNotifications && (
                      <>
                        {/* Backdrop to close when clicking outside */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-[-40px] sm:right-0 mt-2.5 w-80 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#273449] flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <span className="font-semibold text-xs tracking-wide uppercase text-slate-500 dark:text-slate-400 font-display">Notifications</span>
                            {unreadNotificationsCount > 0 && (
                              <button 
                                onClick={() => {
                                  setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                }}
                                className="text-[11px] text-blue-500 hover:underline cursor-pointer"
                              >
                                Mark all read
                              </button>
                            )}
                          </div>
                          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                            {notifications.length === 0 ? (
                              <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">No new updates.</div>
                            ) : (
                              notifications.map(n => (
                                <div 
                                  key={n.id} 
                                  onClick={() => {
                                    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                                    setShowNotifications(false);
                                  }}
                                  className={`p-3.5 transition-all text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${!n.read ? 'bg-blue-500/5 dark:bg-blue-950/10' : ''}`}
                                >
                                  <div className="flex space-x-3">
                                    <div className="mt-0.5 shrink-0">
                                      {n.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-500" />}
                                      {n.type === 'application' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                      {n.type === 'hire' && <Info className="w-4 h-4 text-purple-500" />}
                                      {n.type === 'system' && <Info className="w-4 h-4 text-amber-500" />}
                                    </div>
                                    <div className="flex-1">
                                      <p className={`text-xs ${!n.read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{n.title}</p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.description}</p>
                                      <span className="text-[9px] text-slate-400 block mt-1">{n.timestamp}</span>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Profile Avatar Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowProfileMenu(!showProfileMenu);
                      setShowNotifications(false);
                      setShowSettingsSub(false); // Reset settings expansion on open
                    }}
                    className="relative w-8 h-8 md:w-9 md:h-9 rounded-full border border-slate-200 dark:border-slate-800 hover:scale-105 transition-all cursor-pointer shrink-0"
                    id="profile-avatar-btn"
                  >
                    <img 
                      src={userPhoto} 
                      alt={username} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover"
                    />
                    {!isEmailVerified && (
                      <span className="absolute -top-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#080B18]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showProfileMenu && (
                      <>
                        {/* Backdrop to close when clicking outside */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 12, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 mt-2.5 w-64 bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-2xl shadow-xl z-50 overflow-hidden py-1.5"
                        >
                           {/* Header info card */}
                          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-3 text-left bg-slate-50/40 dark:bg-slate-900/30">
                            <img 
                              src={userPhoto} 
                              alt={username} 
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
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

                            {/* Collapsible Settings Row */}
                            <button 
                              onClick={() => setShowSettingsSub(!showSettingsSub)}
                              className="w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-blue-500/10 hover:text-[#2563EB] dark:hover:text-[#60A5FA] flex items-center justify-between cursor-pointer group transition-all"
                            >
                              <span className="flex items-center font-semibold">
                                <Settings className="w-4 h-4 mr-2.5 text-slate-500 dark:text-slate-400 group-hover:text-blue-500" />
                                Settings
                              </span>
                              <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSettingsSub ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
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
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 pl-0.5">Appearance Theme</label>
                                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#111827] rounded-lg border border-slate-200/50 dark:border-slate-800/40">
                                      {[
                                        { id: 'light', label: 'Light', icon: Sun },
                                        { id: 'dark', label: 'Dark', icon: Moon },
                                        { id: 'system', label: 'System', icon: Monitor }
                                      ].map((mode) => {
                                        const ModeIcon = mode.icon;
                                        const isSelected = themeMode === mode.id;
                                        return (
                                          <button
                                            key={mode.id}
                                            onClick={() => setThemeMode(mode.id as any)}
                                            className={`py-1 rounded-md text-[10px] font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
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
                                  <button 
                                    onClick={() => {
                                      onResetData();
                                      setShowProfileMenu(false);
                                    }}
                                    className="w-full text-left py-1 text-xs hover:underline flex items-center space-x-1.5 text-rose-500 font-bold cursor-pointer"
                                  >
                                    <RefreshCcw className="w-3.5 h-3.5 animate-spin-slow" />
                                    <span>Reset Sandbox Data</span>
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
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}

          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#080B18]/80 backdrop-blur-lg border-t border-slate-200 dark:border-[#273449]/40 pb-[env(safe-area-inset-bottom,8px)] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <nav className="flex items-center justify-around h-13 px-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id || 
              (item.id === 'home' && (currentView === 'home')) ||
              (item.id === 'profile' && (currentView === 'saved-jobs' || currentView === 'saved-workers'));
            
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfileMenu(false);
                  setShowSettingsMenu(false);
                  setShowThemeMenu(false);
                }}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-0.5 text-slate-500 dark:text-slate-400 focus:outline-none min-h-[44px]"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                id={`mobile-nav-${item.id}`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobileActiveIndicator"
                    className="absolute top-0.5 w-8 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                )}
                <IconComponent className={`w-4.5 h-4.5 mb-0.5 transition-colors duration-200 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className={`text-[9px] font-medium transition-colors duration-200 leading-none ${isActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                  {item.label}
                </span>
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute top-1.5 right-1/4 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                    {item.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
