/**
 * Job Application Deadline and Date Range Utilities for OpenComm
 */

export interface DeadlineInfo {
  formattedDate: string;
  daysRemaining: number;
  status: 'active' | 'closing_soon' | 'today' | 'expired' | 'none';
  label: string;
  badgeColorClass: string;
  isExpired: boolean;
}

export interface DateRangeInfo {
  postedFormatted: string;
  deadlineFormatted: string;
  rangeLabel: string;
  tooltipText: string;
  badgeColorClass: string;
  isExpired: boolean;
}

export function formatDateDDMMYYYY(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '';
  const d = new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateReadable(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return 'N/A';
  const d = new Date(dateStrOrObj);
  if (isNaN(d.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

export function getDeadlineInfo(deadlineDateStr?: string | Date | null): DeadlineInfo {
  if (!deadlineDateStr) {
    return {
      formattedDate: '',
      daysRemaining: 999,
      status: 'none',
      label: 'No deadline specified',
      badgeColorClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40',
      isExpired: false,
    };
  }

  const deadline = new Date(deadlineDateStr);
  if (isNaN(deadline.getTime())) {
    return {
      formattedDate: '',
      daysRemaining: 999,
      status: 'none',
      label: 'No deadline specified',
      badgeColorClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40',
      isExpired: false,
    };
  }

  return calculateDeadline(deadline);
}

function calculateDeadline(deadline: Date): DeadlineInfo {
  const now = new Date();
  
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
      label: 'Closes today',
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

  return {
    formattedDate,
    daysRemaining,
    status: 'active',
    label: `Apply by ${formattedDate}`,
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
    isExpired: false
  };
}

export function getJobDateRangeInfo(
  createdDateStr?: string | Date | null,
  deadlineDateStr?: string | Date | null
): DateRangeInfo {
  const postedDDMM = formatDateDDMMYYYY(createdDateStr) || formatDateDDMMYYYY(new Date());
  const postedReadable = formatDateReadable(createdDateStr);

  if (!deadlineDateStr) {
    return {
      postedFormatted: postedDDMM,
      deadlineFormatted: 'No deadline',
      rangeLabel: `${postedDDMM} – No deadline`,
      tooltipText: `Posted: ${postedReadable}\nDeadline: No deadline specified`,
      badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
      isExpired: false,
    };
  }

  const deadline = new Date(deadlineDateStr);
  if (isNaN(deadline.getTime())) {
    return {
      postedFormatted: postedDDMM,
      deadlineFormatted: 'No deadline',
      rangeLabel: `${postedDDMM} – No deadline`,
      tooltipText: `Posted: ${postedReadable}\nDeadline: No deadline specified`,
      badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
      isExpired: false,
    };
  }

  const deadlineDDMM = formatDateDDMMYYYY(deadline);
  const deadlineReadable = formatDateReadable(deadline);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  
  const diffTime = deadlineStart.getTime() - todayStart.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return {
      postedFormatted: postedDDMM,
      deadlineFormatted: 'Closed',
      rangeLabel: `${postedDDMM} – Closed`,
      tooltipText: `Posted: ${postedReadable}\nDeadline: ${deadlineReadable} (Closed)`,
      badgeColorClass: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40',
      isExpired: true,
    };
  }

  if (daysRemaining === 0) {
    return {
      postedFormatted: postedDDMM,
      deadlineFormatted: 'Closes today',
      rangeLabel: `${postedDDMM} – Closes today`,
      tooltipText: `Posted: ${postedReadable}\nDeadline: ${deadlineReadable} (Closes today)`,
      badgeColorClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700/50 font-bold',
      isExpired: false,
    };
  }

  return {
    postedFormatted: postedDDMM,
    deadlineFormatted: deadlineDDMM,
    rangeLabel: `${postedDDMM} – ${deadlineDDMM}`,
    tooltipText: `Posted: ${postedReadable}\nDeadline: ${deadlineReadable}`,
    badgeColorClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
    isExpired: false,
  };
}
