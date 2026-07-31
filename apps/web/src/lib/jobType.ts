/**
 * Job Type Normalization and Formatting Utilities for OpenComm
 */

export type NormalizedJobType = 
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'temporary'
  | 'freelance'
  | 'internship'
  | 'daily_wage'
  | 'one_time';

export function normalizeJobType(value?: string | null): NormalizedJobType | null {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  switch (normalized) {
    case 'full_time':
    case 'fulltime':
      return 'full_time';
    case 'part_time':
    case 'parttime':
      return 'part_time';
    case 'contract':
      return 'contract';
    case 'temporary':
    case 'temp':
      return 'temporary';
    case 'freelance':
      return 'freelance';
    case 'internship':
    case 'intern':
      return 'internship';
    case 'daily_wage':
    case 'dailywage':
      return 'daily_wage';
    case 'one_time':
    case 'onetime':
    case 'one_time_work':
    case 'onetime_work':
      return 'one_time';
    default:
      return null;
  }
}

export function formatJobType(value?: string | null): string {
  const norm = normalizeJobType(value);
  switch (norm) {
    case 'full_time':
      return 'Full-time';
    case 'part_time':
      return 'Part-time';
    case 'contract':
      return 'Contract';
    case 'temporary':
      return 'Temporary';
    case 'freelance':
      return 'Freelance';
    case 'internship':
      return 'Internship';
    case 'daily_wage':
      return 'Daily Wage';
    case 'one_time':
      return 'One-time Work';
    default:
      if (value && value.trim() && value !== 'Full-time') {
        return value.trim();
      }
      return value?.trim() || 'Job type not specified';
  }
}
