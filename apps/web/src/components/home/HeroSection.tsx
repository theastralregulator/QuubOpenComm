import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import OpenCommLogo from '../common/OpenCommLogo';
import { getTimeGreeting } from '../../lib/time';

interface HeroSectionProps {
  userFullName?: string;
  isLoggedIn?: boolean;
  onAboutClick?: () => void;
}

export default function HeroSection({
  userFullName,
  isLoggedIn = false,
  onAboutClick,
}: HeroSectionProps) {
  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getTimeGreeting());
    };

    updateGreeting();

    // Check time boundary every 30 seconds
    const interval = setInterval(updateGreeting, 30000);

    // Update greeting when user refocuses tab
    const handleFocus = () => updateGreeting();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Format greeting display:
  // Logged-in -> "Good morning, Sabin Saji"
  // Logged-out -> "Good morning"
  const greetingText = isLoggedIn && userFullName && userFullName.trim().length > 0
    ? `${greeting}, ${userFullName.trim()}`
    : greeting;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 dark:from-[#0f172a]/70 dark:via-[#0b0d12] dark:to-[#111827] rounded-2xl md:rounded-3xl border border-slate-200/80 dark:border-zinc-800/80 p-5 sm:p-6 lg:p-8 text-left shadow-lg transition-all duration-300 min-h-[360px] max-h-[480px] md:min-h-[300px] md:max-h-[420px] flex flex-col justify-center">
      {/* Subtle Ambient Glow Effects */}
      <div className="absolute -top-20 -right-20 w-72 h-72 sm:w-80 sm:h-80 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-transparent rounded-full blur-2xl sm:blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 sm:w-80 sm:h-80 bg-gradient-to-tr from-indigo-500/5 via-purple-500/5 to-transparent rounded-full blur-2xl sm:blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
        
        {/* Main Content Column */}
        <div className="flex-1 space-y-2.5 sm:space-y-3 max-w-3xl">
          
          {/* Small Top Label */}
          <div className="inline-flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-xs w-fit">
            <span className="w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-pulse" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>

          {/* Time-Based Greeting */}
          <p className="text-xs sm:text-sm font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">
            {greetingText}
          </p>

          {/* Main H1 Heading */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Welcome to OpenComm
          </h1>

          {/* Descriptions */}
          <p className="text-xs sm:text-sm md:text-base font-medium text-slate-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
            OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
            Browse opportunities, discover skilled workers, build your professional presence, and communicate securely in one place.
          </p>

          {/* Single Hero Button: About OpenComm */}
          <div className="pt-1 sm:pt-2">
            <button
              type="button"
              onClick={onAboutClick}
              className="px-5 h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 shadow-md shadow-indigo-500/15 active:scale-98 transition-all cursor-pointer flex items-center space-x-1.5 border border-white/10"
            >
              <span>About OpenComm</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Supporting Brand Logo Element (Desktop Right / Mobile Compact) */}
        <div className="shrink-0 self-start md:self-center pt-2 md:pt-0">
          <OpenCommLogo variant="hero" />
        </div>

      </div>
    </div>
  );
}
