import React from 'react';
import { motion } from 'motion/react';
import { Check, Star, Search, X } from 'lucide-react';

interface HeroSectionProps {
  username: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  triggerToast: (msg: string) => void;
}

export default function HeroSection({
  username,
  searchQuery,
  setSearchQuery,
  triggerToast,
}: HeroSectionProps) {
  return (
    <div className="mb-4 sm:mb-6 h-[145px] sm:h-auto relative overflow-hidden bg-blue-50/30 dark:bg-[#172033]/40 rounded-[20px] md:rounded-3xl border border-blue-100/50 dark:border-[#273449]/30 p-4 sm:p-6 lg:p-8 text-left shadow-md transition-colors duration-300">
      {/* Glow Effects */}
      <div className="absolute -top-12 -right-12 sm:-top-24 sm:-right-24 w-48 h-48 sm:w-80 sm:h-80 bg-gradient-to-br from-[#2563EB]/10 to-[#7C3AED]/10 rounded-full blur-2xl sm:blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 sm:-bottom-24 sm:-left-24 w-48 h-48 sm:w-80 sm:h-80 bg-gradient-to-tr from-blue-500/5 to-indigo-500/5 rounded-full blur-2xl sm:blur-3xl pointer-events-none" />
      
      <div className="relative z-10 grid grid-cols-12 gap-3 sm:gap-6 items-center">
        
        {/* Left Text Column */}
        <div className="col-span-12 sm:col-span-8 lg:col-span-7 space-y-1.5 sm:space-y-3">
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-xs self-start w-fit">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[7px] sm:text-[9px] font-bold uppercase tracking-widest font-mono">Marketplace Live</span>
          </div>

          <div className="space-y-0.5">
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold tracking-wide">Good morning, {username || 'Akhil'}</p>
            <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-display font-bold tracking-tight text-[#0F172A] dark:text-white leading-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent font-extrabold">
                OpenComm
              </span>
            </h1>
          </div>

          <div className="hidden xs:block space-y-1 sm:space-y-1.5">
            <p className="flex flex-wrap gap-x-1 sm:gap-x-2 items-center text-xs sm:text-base md:text-lg font-bold text-[#0F172A] dark:text-slate-250">
              <span className="text-[#2563EB]">Find jobs.</span>
              <span className="text-[#7C3AED]">Hire experts.</span>
            </p>
          </div>
        </div>

        {/* Right 3D CSS Briefcase Column */}
        <div className="hidden sm:flex col-span-4 lg:col-span-5 justify-end lg:justify-center items-center relative h-20 sm:h-44 lg:h-48 mt-0 lg:mt-0">
          <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-500/5 rounded-full blur-2xl -z-10" />
          
          {/* Floating Container (Smaller on mobile, full-size on desktop) */}
          <motion.div 
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="relative w-22 h-16 sm:w-44 sm:h-34 lg:w-48 lg:h-38 select-none"
            style={{ perspective: 1000 }}
          >
            {/* 3D Tilted Briefcase */}
            <div 
              className="w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-950/90 via-slate-900/90 to-blue-950/80 dark:from-indigo-950/95 dark:via-slate-950/95 dark:to-blue-950/90 border border-white/10 dark:border-slate-800/80 shadow-[0_10px_20px_rgba(0,0,0,0.2)] flex flex-col justify-between p-1.5 sm:p-4 relative overflow-hidden"
              style={{ transform: "rotateY(-15deg) rotateX(12deg) rotateZ(-2deg)" }}
            >
              {/* Glassmorphism reflections */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

              {/* Handle */}
              <div className="absolute -top-1 sm:-top-2 left-1/2 -translate-x-1/2 w-6 sm:w-12 h-1 sm:h-2 bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 dark:from-slate-800 dark:via-slate-600 dark:to-slate-800 rounded-t-xs sm:rounded-t-md border-t border-x border-white/25 shadow-xs" />

              {/* Top Latch Row */}
              <div className="flex justify-between items-center">
                <div className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-slate-500/30 border border-white/10" />
                <div className="w-4 sm:w-8 h-0.5 sm:h-1.5 rounded-full bg-slate-500/20 border border-white/10" />
                <div className="w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-slate-500/30 border border-white/10" />
              </div>

              {/* Center Shield logo */}
              <div className="mx-auto my-0.5 w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center shadow-[0_0_12px_rgba(37,99,235,0.4)] border border-white/20">
                <Check className="w-3 h-3 sm:w-5 sm:h-5 text-white stroke-[3]" />
              </div>

              {/* Bottom design elements */}
              <div className="flex justify-between items-center">
                <div className="w-2 sm:w-4 h-0.5 rounded-full bg-slate-500/20" />
                <div className="w-4 sm:w-8 h-0.5 rounded-full bg-slate-500/20" />
                <div className="w-2 sm:w-4 h-0.5 rounded-full bg-slate-500/20" />
              </div>
            </div>

            {/* Floating Chat Bubble (Smaller on mobile) */}
            <motion.div 
              animate={{ y: [0, 2, 0], x: [0, -1, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 0.5 }}
              className="absolute -top-1.5 -left-3 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 p-0.5 sm:p-1 rounded-lg shadow-sm flex items-center space-x-1 w-[70px] sm:w-28 text-left"
            >
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=60&h=60&q=80" 
                alt="Sarah" 
                referrerPolicy="no-referrer"
                className="w-3 h-3 sm:w-4.5 sm:h-4.5 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0 flex-1 leading-none">
                <p className="text-[5px] sm:text-[7px] font-bold text-slate-800 dark:text-white truncate leading-none">Sarah J.</p>
                <p className="text-[4px] sm:text-[6px] text-blue-500 font-medium mt-0.5 leading-none">Online</p>
              </div>
            </motion.div>

            {/* Floating Info Tag (Smaller on mobile) */}
            <motion.div 
              animate={{ y: [0, -1.5, 0], x: [0, 0.5, 0] }}
              transition={{ repeat: Infinity, duration: 5.5, ease: "easeInOut", delay: 1.2 }}
              className="absolute -bottom-0.5 -right-0.5 sm:-right-2 bg-purple-600 text-white py-0.5 px-1 sm:px-1.5 rounded-full shadow-xs border border-white/15 flex items-center space-x-0.5"
            >
              <Star className="w-1 sm:w-2 h-1 sm:h-2 fill-current text-amber-300" />
              <span className="text-[5px] sm:text-[7px] font-bold uppercase tracking-wider font-mono">Pro</span>
            </motion.div>
            
          </motion.div>
        </div>

      </div>
    </div>
  );
}
