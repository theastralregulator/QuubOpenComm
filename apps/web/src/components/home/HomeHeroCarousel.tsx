import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Briefcase, UserCheck, MessageSquare, ShieldCheck, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpenCommLogo from '../common/OpenCommLogo';
import { getTimeGreeting } from '../../lib/time';
import { analytics } from '../../lib/analytics';
import { Job, Worker } from '../../types';

export interface SlideItem {
  id: string;
  type: 'welcome' | 'announcement' | 'featured_job' | 'featured_worker' | 'authenticated_summary' | 'admin_banner';
  badgeLabel?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonPath?: string;
  onButtonClick?: () => void;
  icon?: React.ElementType;
  job?: Job;
  worker?: Worker;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
}

interface HomeHeroCarouselProps {
  userFullName?: string;
  isLoggedIn?: boolean;
  onAboutClick?: () => void;
  jobs?: Job[];
  workers?: Worker[];
  unreadMessagesCount?: number;
}

export default function HomeHeroCarousel({
  userFullName,
  isLoggedIn = false,
  onAboutClick,
  jobs = [],
  workers = [],
  unreadMessagesCount = 0,
}: HomeHeroCarouselProps) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [greeting, setGreeting] = useState<string>(() => getTimeGreeting());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // Update greeting periodically
  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeGreeting());
    updateGreeting();
    const interval = setInterval(updateGreeting, 30000);
    return () => clearInterval(interval);
  }, []);

  const greetingText = isLoggedIn && userFullName && userFullName.trim().length > 0
    ? `${greeting}, ${userFullName.trim()}`
    : greeting;

  // Build active dynamic slides
  const slides = useMemo<SlideItem[]>(() => {
    const slideList: SlideItem[] = [];

    // 1. DEFAULT WELCOME SLIDE (Always present & first)
    slideList.push({
      id: 'slide-welcome',
      type: 'welcome',
      badgeLabel: 'BUILD BETTER WORK CONNECTIONS',
      title: 'Welcome to',
      description: 'OpenComm helps people discover trusted professionals, meaningful work opportunities, and better ways to connect and collaborate.',
      buttonText: 'About OpenComm',
      onButtonClick: onAboutClick || (() => navigate('/about'))
    });

    // 2. FEATURED ANNOUNCEMENT SLIDE
    slideList.push({
      id: 'slide-announcement-company',
      type: 'announcement',
      badgeLabel: 'PLATFORM ANNOUNCEMENT',
      title: 'Verified Company Profiles & Enterprise Hiring',
      description: 'Connecting verified organizations with top-tier active talent across technology, trades, and professional services.',
      buttonText: 'Explore Platform',
      buttonPath: '/about',
      icon: Building2
    });

    // 3. FEATURED JOB SLIDE (if active job exists)
    if (jobs && jobs.length > 0) {
      const featuredJob = jobs[0];
      slideList.push({
        id: `slide-job-${featuredJob.id}`,
        type: 'featured_job',
        badgeLabel: 'FEATURED OPPORTUNITY',
        title: featuredJob.title,
        subtitle: `${featuredJob.company} • ${featuredJob.location} • ${featuredJob.salary}`,
        description: featuredJob.description,
        buttonText: 'View Job Details',
        buttonPath: `/jobs/${featuredJob.id}`,
        job: featuredJob,
        icon: Briefcase
      });
    }

    // 4. FEATURED WORKER SLIDE (if active worker exists)
    if (workers && workers.length > 0) {
      const featuredWorker = workers[0];
      slideList.push({
        id: `slide-worker-${featuredWorker.id}`,
        type: 'featured_worker',
        badgeLabel: 'FEATURED PROFESSIONAL',
        title: `${featuredWorker.name} — ${featuredWorker.title}`,
        subtitle: `${featuredWorker.location} • ${featuredWorker.availability} • ${featuredWorker.skills.slice(0, 3).join(', ')}`,
        description: featuredWorker.bio || 'Verified professional available for hire on OpenComm.',
        buttonText: 'View Worker Profile',
        buttonPath: `/workers/${featuredWorker.id}`,
        worker: featuredWorker,
        icon: UserCheck
      });
    }

    // 5. AUTHENTICATED USER SLIDE (Signed-in users only)
    if (isLoggedIn) {
      if (unreadMessagesCount > 0) {
        slideList.push({
          id: 'slide-user-messages',
          type: 'authenticated_summary',
          badgeLabel: 'UNREAD MESSAGES',
          title: `You have ${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`,
          description: 'Stay connected with clients, employers, and candidates on OpenComm messaging.',
          buttonText: 'Open Inbox',
          buttonPath: '/messages',
          icon: MessageSquare
        });
      } else {
        slideList.push({
          id: 'slide-user-safety',
          type: 'announcement',
          badgeLabel: 'SAFETY & COMPLIANCE',
          title: 'Secure Work & Instant Verification',
          description: 'All conversations and job applications on OpenComm are protected by identity verification.',
          buttonText: 'Read Guidelines',
          buttonPath: '/community-guidelines',
          icon: ShieldCheck
        });
      }
    }

    return slideList;
  }, [jobs, workers, isLoggedIn, unreadMessagesCount, userFullName, onAboutClick, navigate]);

  const totalSlides = slides.length;

  const goToNextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
    analytics.trackEvent('banner_next', {
      slide_position: ((currentIndex + 1) % totalSlides) + 1
    });
  }, [totalSlides, currentIndex]);

  const goToPrevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    analytics.trackEvent('banner_previous', {
      slide_position: ((currentIndex - 1 + totalSlides) % totalSlides) + 1
    });
  }, [totalSlides, currentIndex]);

  const goToSlide = useCallback((index: number) => {
    if (index === currentIndex || totalSlides <= 1) return;
    setDirection(index > currentIndex ? 1 : -1);
    setCurrentIndex(index);
  }, [currentIndex, totalSlides]);

  // Throttled manual interactions to prevent broken rapid clicks & reset timer smoothly
  const handleManualNext = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;
    goToNextSlide();
  };

  const handleManualPrev = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;
    goToPrevSlide();
  };

  const handleManualGoTo = (idx: number) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;
    goToSlide(idx);
  };

  // Auto rotation timer (30,000 ms)
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        goToNextSlide();
      }
    }, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalSlides, isPaused, goToNextSlide]);

  // Handle visibility change (pause when tab hidden)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Track banner view event
  const activeSlide = slides[currentIndex] || slides[0];

  useEffect(() => {
    if (!activeSlide) return;
    const tracker = setTimeout(() => {
      analytics.trackEvent('banner_view', {
        banner_id: activeSlide.id,
        banner_type: activeSlide.type,
        slide_position: currentIndex + 1
      });
    }, 1000);
    return () => clearTimeout(tracker);
  }, [currentIndex, activeSlide]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handleManualPrev();
    } else if (e.key === 'ArrowRight') {
      handleManualNext();
    }
  };

  // Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (deltaX < -40) {
      handleManualNext();
    } else if (deltaX > 40) {
      handleManualPrev();
    }
  };

  // Slide Animation Variants
  const slideVariants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '100%' : '-100%',
      opacity: prefersReducedMotion ? 0 : 0.4,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        duration: prefersReducedMotion ? 0.2 : 0.45,
        ease: [0.25, 1, 0.5, 1] as const,
      },
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '-100%' : '100%',
      opacity: prefersReducedMotion ? 0 : 0.4,
      transition: {
        duration: prefersReducedMotion ? 0.2 : 0.45,
        ease: [0.25, 1, 0.5, 1] as const,
      },
    }),
  };

  const handleCtaClick = (slide: SlideItem) => {
    analytics.trackEvent('banner_cta_click', {
      banner_id: slide.id,
      banner_type: slide.type,
      button_text: slide.buttonText || 'Click'
    });
    if (slide.onButtonClick) {
      slide.onButtonClick();
    } else if (slide.buttonPath) {
      navigate(slide.buttonPath);
    }
  };

  return (
    <div
      role="region"
      aria-label="Featured announcements and opportunities"
      aria-live="off"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="relative w-full overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl border border-indigo-500/25 dark:border-indigo-400/25 p-3 sm:p-4.5 md:p-6 text-left shadow-sm shadow-indigo-500/5 transition-all duration-300 aspect-[16/9] min-h-[160px] sm:min-h-[190px] md:min-h-[240px] max-h-[245px] sm:max-h-[300px] md:max-h-[380px] flex flex-col justify-center bg-white dark:bg-[#050505] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* Background Radial Glows (Light & Dark mode aware) */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.16),transparent_38%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.16),transparent_40%),linear-gradient(135deg,#ffffff_0%,#f5f7ff_48%,#faf5ff_100%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(37,99,235,0.22),transparent_38%),radial-gradient(circle_at_85%_25%,rgba(168,85,247,0.20),transparent_40%),linear-gradient(135deg,#050505_0%,#080A12_50%,#0B0D17_100%)] transition-all duration-300" />

      {/* Layer 1: Ambient Glow Effects */}
      <div className="absolute -top-16 -right-16 w-56 h-56 sm:w-80 sm:h-80 bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-blue-500/10 dark:from-indigo-500/35 dark:via-purple-500/30 rounded-full blur-2xl pointer-events-none z-0" />
      <div className="absolute -bottom-16 -left-16 w-56 h-56 sm:w-80 sm:h-80 bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-purple-600/10 dark:from-blue-600/30 rounded-full blur-2xl pointer-events-none z-0" />
      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.09] pointer-events-none z-0 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:14px_14px]" />

      {/* Slide Content Carousel */}
      <div className="relative z-10 w-full my-auto overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={activeSlide.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full px-7 sm:px-10 md:px-12 space-y-1 sm:space-y-1.5 md:space-y-2.5"
          >
            {/* Top Badge / Label */}
            <div>
              <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/12 to-blue-500/12 dark:from-indigo-400/20 dark:via-purple-400/20 dark:to-blue-400/20 backdrop-blur-md border border-indigo-500/20 dark:border-indigo-400/25 shadow-2xs">
                {activeSlide.icon && <activeSlide.icon className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 dark:from-indigo-300 dark:via-purple-200 dark:to-blue-300 bg-clip-text text-transparent font-extrabold text-[9px] sm:text-[10px] uppercase tracking-widest font-mono">
                  {activeSlide.badgeLabel}
                </span>
              </div>
            </div>

            {/* Time Greeting (Welcome slide only) */}
            {activeSlide.type === 'welcome' && (
              <div>
                <span className="text-[12px] sm:text-[13px] md:text-sm font-bold tracking-wide text-indigo-600 dark:text-purple-300 drop-shadow-[0_2px_8px_rgba(99,102,241,0.25)]">
                  {greetingText}
                </span>
              </div>
            )}

            {/* Main Title / Heading */}
            {activeSlide.type === 'welcome' ? (
              <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-display font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-wrap items-center gap-1.5 sm:gap-2 leading-none">
                <span>Welcome to</span>
                <OpenCommLogo variant="hero" isLoggedIn={isLoggedIn} className="inline-flex items-center" />
              </h1>
            ) : (
              <div>
                <h2 className="text-base sm:text-lg md:text-xl font-display font-black tracking-tight text-slate-900 dark:text-white line-clamp-1 leading-tight">
                  {activeSlide.title}
                </h2>
                {activeSlide.subtitle && (
                  <p className="text-[11px] sm:text-xs font-semibold text-indigo-600 dark:text-purple-300 mt-0.5 line-clamp-1">
                    {activeSlide.subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Description Paragraph */}
            {activeSlide.description && (
              <p className="text-[12px] sm:text-[13px] md:text-[14px] font-medium text-slate-700 dark:text-zinc-200 leading-snug sm:leading-relaxed max-w-[650px] line-clamp-2">
                {activeSlide.description}
              </p>
            )}

            {/* Action Button */}
            {activeSlide.buttonText && (
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => handleCtaClick(activeSlide)}
                  className="h-8 sm:h-9 px-3 sm:px-3.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center space-x-1 border border-white/20 shadow-2xs"
                >
                  <span>{activeSlide.buttonText}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Manual Navigation Controls (Only if >1 slide exists) */}
      {totalSlides > 1 && (
        <>
          {/* Minimal Premium Previous Arrow */}
          <button
            type="button"
            onClick={handleManualPrev}
            aria-label="Previous banner"
            className="absolute left-1 sm:left-2 md:left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/35 dark:bg-black/30 hover:bg-white/75 dark:hover:bg-white/20 border border-white/50 dark:border-white/15 text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-white backdrop-blur-md flex items-center justify-center shadow-2xs hover:shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <ChevronLeft className="w-5 h-5 text-current" />
          </button>

          {/* Minimal Premium Next Arrow */}
          <button
            type="button"
            onClick={handleManualNext}
            aria-label="Next banner"
            className="absolute right-1 sm:right-2 md:right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/35 dark:bg-black/30 hover:bg-white/75 dark:hover:bg-white/20 border border-white/50 dark:border-white/15 text-slate-700 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-white backdrop-blur-md flex items-center justify-center shadow-2xs hover:shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <ChevronRight className="w-5 h-5 text-current" />
          </button>

          {/* Premium Slide Indicator Row */}
          <div 
            aria-label="Carousel pagination"
            className="absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
          >
            {slides.map((slide, idx) => {
              const isActive = idx === currentIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => handleManualGoTo(idx)}
                  aria-label={`Go to banner ${idx + 1}`}
                  aria-current={isActive ? 'true' : undefined}
                  className="p-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer flex items-center justify-center"
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-300 ease-out ${
                      isActive
                        ? 'w-6.5 sm:w-7 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-2xs'
                        : 'w-2 bg-slate-400/45 dark:bg-white/30 hover:bg-slate-500/70 dark:hover:bg-white/50'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
