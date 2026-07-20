import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
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

    // Update greeting when tab regains focus
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
  // Logged-in -> "Good Morning, Sabin Saji"
  // Logged-out -> "Good Morning"
  const greetingText = isLoggedIn && userFullName && userFullName.trim().length > 0
    ? `${greeting}, ${userFullName.trim()}`
    : greeting;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/8 via-purple-500/5 via-white to-blue-500/10 dark:from-[#0c101d] dark:via-[#111628] dark:to-[#080a12] rounded-2xl md:rounded-3xl border border-indigo-500/10 dark:border-indigo-500/20 p-4 sm:p-5 md:p-6 text-left shadow-lg backdrop-blur-xl transition-all duration-300 min-h-[170px] sm:min-h-[190px] md:min-h-[200px] flex flex-col justify-center">
      
      {/* 1. Multi-Layered Ambient Background with Reduced Motion Support */}
      <motion.div 
        animate={{ 
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.25, 0.15],
          x: [0, 15, 0],
          y: [0, -10, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-16 -right-16 w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-blue-500/10 rounded-full blur-3xl pointer-events-none motion-reduce:animate-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.2, 0.1],
          x: [0, -15, 0],
          y: [0, 10, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute -bottom-16 -left-16 w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-purple-500/10 rounded-full blur-3xl pointer-events-none motion-reduce:animate-none" 
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/60 dark:from-transparent dark:via-transparent dark:to-[#080a12]/40 pointer-events-none" />

      {/* 2. Banner Content Container (Exact Vertical Order) */}
      <div className="relative z-10 space-y-2 sm:space-y-2.5">
        
        {/* 1 & 2. Label + Greeting (Stacked vertically on mobile, optional flex row on desktop) */}
        <div className="flex flex-col sm:flex-row sm:items-center items-start gap-1 sm:gap-3">
          
          {/* 1. Small Top Label: "BUILD BETTER WORK CONNECTIONS" */}
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 dark:from-indigo-400/15 dark:via-purple-400/15 dark:to-blue-400/15 backdrop-blur-md border border-indigo-500/15 dark:border-indigo-400/20 shadow-2xs">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-400 dark:via-purple-300 dark:to-blue-400 bg-clip-text text-transparent font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>

          {/* 2. Time Greeting directly below label on mobile */}
          <span className="text-xs sm:text-sm font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
            {greetingText}
          </span>
        </div>

        {/* 3. Main Heading: "Welcome to" + Official OpenComm Logo Image */}
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2 sm:gap-3 leading-none pt-0.5">
          <span>Welcome to</span>
          <OpenCommLogo variant="hero" className="inline-flex items-center -mt-0.5 sm:-mt-1" />
        </h1>

        {/* 4. Short Description */}
        <p className="text-xs sm:text-sm md:text-base font-medium text-slate-600 dark:text-zinc-300 leading-relaxed max-w-3xl">
          OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
        </p>

        {/* 5. Hero Button: About OpenComm */}
        <div className="pt-1">
          <button
            type="button"
            onClick={onAboutClick}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-98 transition-all cursor-pointer flex items-center space-x-1.5 border border-white/15 shadow-sm"
          >
            <span>About OpenComm</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
