import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
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
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(getTimeGreeting());
    };

    updateGreeting();

    // Re-check time boundary every 30 seconds
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
  // Logged-in  -> "Good Morning, Sabin Saji"
  // Logged-out -> "Good Morning"
  const greetingText = isLoggedIn && userFullName && userFullName.trim().length > 0
    ? `${greeting}, ${userFullName.trim()}`
    : greeting;

  // Slow ambient glow animation (respects prefers-reduced-motion)
  const glowAnimation1 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.15, 1],
          opacity: [0.4, 0.65, 0.4],
          x: [0, 18, 0],
          y: [0, -10, 0],
        },
        transition: { duration: 10, repeat: Infinity, ease: 'easeInOut' as const },
      };

  const glowAnimation2 = prefersReducedMotion
    ? {}
    : {
        animate: {
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.55, 0.3],
          x: [0, -18, 0],
          y: [0, 10, 0],
        },
        transition: { duration: 12, repeat: Infinity, ease: 'easeInOut' as const, delay: 1 },
      };

  return (
    <div 
      className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-indigo-500/25 dark:border-indigo-400/25 p-3.5 sm:p-5 md:p-7 text-left shadow-md shadow-indigo-500/5 transition-all duration-300 aspect-[16/9] min-h-[200px] sm:min-h-[240px] md:min-h-[270px] max-h-[350px] sm:max-h-[390px] md:max-h-[430px] flex flex-col justify-center dark:from-[#0b0e1e] dark:via-[#10152b] dark:to-[#070914]"
      style={{
        background: 'radial-gradient(circle at 15% 20%, rgba(37, 99, 235, 0.16), transparent 38%), radial-gradient(circle at 85% 25%, rgba(168, 85, 247, 0.16), transparent 40%), radial-gradient(circle at 55% 90%, rgba(99, 102, 241, 0.10), transparent 42%), linear-gradient(135deg, #ffffff 0%, #f5f7ff 48%, #faf5ff 100%)'
      }}
    >

      {/* Layer 1: Blue & Purple Floating Radial Glows */}
      <motion.div
        {...glowAnimation1}
        className="absolute -top-16 -right-16 w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-br from-indigo-500/30 via-purple-500/25 to-blue-500/15 rounded-full blur-2xl pointer-events-none z-0"
      />
      <motion.div
        {...glowAnimation2}
        className="absolute -bottom-16 -left-16 w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-tr from-blue-600/25 via-indigo-500/20 to-purple-600/15 rounded-full blur-2xl pointer-events-none z-0"
      />

      {/* Layer 2: Subtle Mesh Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.09] pointer-events-none z-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:14px_14px]" 
      />

      {/* Layer 3: Content Container (Exact Content Order) */}
      <div className="relative z-10 space-y-1.5 sm:space-y-2.5 md:space-y-3 my-auto">

        {/* 1. Label: "BUILD BETTER WORK CONNECTIONS" (Top row) */}
        <div>
          <div className="inline-flex items-center px-2.5 py-0.5 sm:py-1 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/12 to-blue-500/12 dark:from-indigo-400/20 dark:via-purple-400/20 dark:to-blue-400/20 backdrop-blur-md border border-indigo-500/20 dark:border-indigo-400/25 shadow-2xs">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-300 dark:via-purple-200 dark:to-blue-300 bg-clip-text text-transparent font-extrabold text-[10px] sm:text-[11px] uppercase tracking-widest font-mono">
              BUILD BETTER WORK CONNECTIONS
            </span>
          </div>
        </div>

        {/* 2. Time Greeting: "Good Morning" (Always on its own row below label) */}
        <div>
          <span className="text-[13px] sm:text-sm md:text-base font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
            {greetingText}
          </span>
        </div>

        {/* 3. Main Heading: "Welcome to" + OpenComm Logo Image */}
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-2 sm:gap-3 leading-none">
          <span>Welcome to</span>
          <OpenCommLogo variant="hero" isLoggedIn={isLoggedIn} className="inline-flex items-center -mt-0.5 sm:-mt-1" />
        </h1>

        {/* 4. Short Description */}
        <p className="text-[13px] sm:text-sm md:text-base font-medium text-slate-700 dark:text-zinc-200 leading-snug sm:leading-relaxed max-w-[700px]">
          OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.
        </p>

        {/* 5. CTA Button: "About OpenComm" */}
        <div className="pt-0.5 sm:pt-1">
          <button
            type="button"
            onClick={onAboutClick}
            className="h-9 sm:h-10 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-1.5 border border-white/20 shadow-sm"
          >
            <span>About OpenComm</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
