/**
 * Job Application Deadline Utilities for OpenComm
 */

export interface DeadlineInfo {
  formattedDate: string;
  daysRemaining: number;
  status: 'active' | 'closing_soon' | 'today' | 'expired';
  label: string;
  badgeColorClass: string;
  isExpired: boolean;
}

export function getDeadlineInfo(deadlineDateStr?: string | Date | null): DeadlineInfo {
  if (!deadlineDateStr) {
    // Default fallback if missing (14 days from now)
    const future = new Date();
    future.setDate(future.getDate() + 14);
    return calculateDeadline(future);
  }

  const deadline = new Date(deadlineDateStr);
  if (isNaN(deadline.getTime())) {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    return calculateDeadline(future);
  }

  return calculateDeadline(deadline);
}

function calculateDeadline(deadline: Date): DeadlineInfo {
  const now = new Date();
  
  // Normalize dates to start-of-day for local date comparison (avoid timezone off-by-one errors)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  
  const diffTime = deadlineStart.getTime() - todayStart.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(deadline);

  if (daysRemaining < 0) {
    return {
      formattedDate,
      daysRemaining,
      status: 'expired',
      label: 'Applications closed',
      badgeColorClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40',
      isExpired: true
    };
  }

  if (daysRemaining === 0) {
    return {
      formattedDate,
      daysRemaining: 0,
      status: 'today',
      label: 'Ends today',
      badgeColorClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700/50 font-bold',
      isExpired: false
    };
  }

  if (daysRemaining === 1) {
    return {
      formattedDate,
      daysRemaining: 1,
      status: 'closing_soon',
      label: 'Ends tomorrow',
      badgeColorClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/50 font-bold',
      isExpired: false
    };
  }

  if (daysRemaining <= 3) {
    return {
      formattedDate,
      daysRemaining,
      status: 'closing_soon',
      label: `Ends in ${daysRemaining} days`,
      badgeColorClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
      isExpired: false
    };
  }

  if (daysRemaining <= 7) {
    return {
      formattedDate,
      daysRemaining,
      status: 'closing_soon',
      label: `Ends in ${daysRemaining} days`,
      badgeColorClass: 'bg-amber-50/80 text-amber-700 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30',
      isExpired: false
    };
  }

  return {
    formattedDate,
    daysRemaining,
    status: 'active',
    label: `Apply by ${formattedDate}`,
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
    isExpired: false
  };
}
