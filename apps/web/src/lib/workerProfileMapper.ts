import { LocalProfile, LocalWorkerProfile } from './supabase';

export interface WorkerProfileFormData {
  fullName: string;
  professionalTitle: string;
  category: string;
  experienceYears: number | string;
  workPreference: string;
  salaryPeriod: string; // 'hourly' | 'monthly' | 'daily' | 'project' | ''
  rateAmount: number | string;
  salaryMin?: number | string;
  salaryMax?: number | string;
  expectedSalaryText?: string;
  availability: string;
  skills: string; // comma-separated
  preferredLanguage: string;
  bioSummary: string;
  locationData: {
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    state_code?: string;
    district?: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Infer salary period from existing worker profile data if rate_period is missing.
 * Does NOT guess or overwrite values if there is no reliable legacy indicator.
 */
export function inferLegacySalaryPeriod(workerProfile?: Partial<LocalWorkerProfile> | null): string {
  if (!workerProfile) return '';
  if (workerProfile.rate_period) return workerProfile.rate_period;

  const expectedSalary = (workerProfile.expected_salary || '').toLowerCase();
  if (expectedSalary.includes('/mo') || expectedSalary.includes('/month')) return 'monthly';
  if (expectedSalary.includes('/day')) return 'daily';
  if (expectedSalary.includes('/project')) return 'project';
  if (expectedSalary.includes('/hr') || expectedSalary.includes('/hour')) return 'hourly';

  const hrRate = Number(workerProfile.hourly_rate) || 0;
  if (hrRate > 0 && !expectedSalary) {
    return 'hourly';
  }

  return '';
}

/**
 * Map DB Profile & WorkerProfile to a canonical form state.
 * Preserves stored values and avoids defaulting to false/hardcoded data.
 */
export function mapWorkerProfileToForm(
  profile?: LocalProfile | null,
  workerProfile?: LocalWorkerProfile | null
): WorkerProfileFormData {
  const locData = {
    city: profile?.city || '',
    state: profile?.state || '',
    country: profile?.country || '',
    country_code: profile?.country_code || '',
    state_code: profile?.state_code || '',
    district: profile?.district || '',
    latitude: profile?.latitude || undefined,
    longitude: profile?.longitude || undefined
  };

  const professionalTitle =
    workerProfile?.professional_title ||
    workerProfile?.profession ||
    '';

  const experienceYears =
    workerProfile?.years_experience ??
    workerProfile?.experience_years ??
    '';

  const category = workerProfile?.primary_category || '';
  const workPreference = workerProfile?.work_preference || '';
  const salaryPeriod = inferLegacySalaryPeriod(workerProfile);

  const rateAmount =
    workerProfile?.rate_amount ??
    workerProfile?.hourly_rate ??
    '';

  const availability =
    workerProfile?.availability_status ||
    workerProfile?.availability ||
    'Available Now';

  const skills = Array.isArray(workerProfile?.skills)
    ? workerProfile.skills.join(', ')
    : '';

  const preferredLanguage =
    profile?.preferred_language ||
    (Array.isArray(workerProfile?.languages) && workerProfile.languages.length > 0 ? workerProfile.languages[0] : '') ||
    '';

  const bioSummary =
    workerProfile?.bio_summary ||
    profile?.bio ||
    '';

  return {
    fullName: profile?.full_name || '',
    professionalTitle,
    category,
    experienceYears,
    workPreference,
    salaryPeriod,
    rateAmount,
    expectedSalaryText: workerProfile?.expected_salary || '',
    availability,
    skills,
    preferredLanguage,
    bioSummary,
    locationData: locData
  };
}

/**
 * Formats structured location into a readable summary string.
 */
export function formatLocationSummary(loc: { country?: string; state?: string; district?: string; city?: string }): string {
  const parts = [loc.city, loc.district || loc.state, loc.country].filter(Boolean);
  return parts.join(', ');
}

/**
 * Maps form data to database persistence payloads.
 */
export function mapFormToDbPayloads(formData: WorkerProfileFormData) {
  const numAmount = Number(formData.rateAmount) || 0;
  const computedHourlyRate = formData.salaryPeriod === 'hourly' ? (numAmount > 0 ? numAmount : null) : null;

  let formattedExpectedSalary = formData.expectedSalaryText || '';

  if (formData.salaryPeriod === 'hourly') {
    formattedExpectedSalary = numAmount > 0 ? `₹${numAmount}/hr` : '';
  } else if (formData.salaryPeriod === 'monthly') {
    const minVal = Number(formData.salaryMin) || 0;
    const maxVal = Number(formData.salaryMax) || 0;
    if (minVal > 0 && maxVal > 0 && minVal !== maxVal) {
      formattedExpectedSalary = `₹${minVal.toLocaleString('en-IN')} – ₹${maxVal.toLocaleString('en-IN')}/mo`;
    } else if (numAmount > 0) {
      formattedExpectedSalary = `₹${numAmount.toLocaleString('en-IN')}/mo`;
    }
  } else if (formData.salaryPeriod === 'daily') {
    formattedExpectedSalary = numAmount > 0 ? `₹${numAmount.toLocaleString('en-IN')}/day` : '';
  } else if (formData.salaryPeriod === 'project') {
    formattedExpectedSalary = numAmount > 0 ? `₹${numAmount.toLocaleString('en-IN')}/project` : '';
  }

  const skillsArray = typeof formData.skills === 'string'
    ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
    : (Array.isArray(formData.skills) ? formData.skills : []);

  const locSummary = formatLocationSummary(formData.locationData);

  const profileUpdates = {
    full_name: formData.fullName,
    bio: formData.bioSummary,
    city: formData.locationData.city || '',
    state: formData.locationData.state || '',
    country: formData.locationData.country || '',
    country_code: formData.locationData.country_code || '',
    state_code: formData.locationData.state_code || '',
    district: formData.locationData.district || '',
    latitude: formData.locationData.latitude,
    longitude: formData.locationData.longitude,
    preferred_language: formData.preferredLanguage
  };

  const workerProfileUpdates = {
    profession: formData.professionalTitle,
    primary_category: formData.category || undefined,
    experience_years: Number(formData.experienceYears) || 0,
    work_preference: formData.workPreference || undefined,
    rate_period: formData.salaryPeriod || undefined,
    rate_amount: numAmount > 0 ? numAmount : undefined,
    hourly_rate: computedHourlyRate,
    expected_salary: formattedExpectedSalary,
    availability: formData.availability,
    skills: skillsArray,
    bio_summary: formData.bioSummary,
    work_location: locSummary,
    languages: formData.preferredLanguage ? [formData.preferredLanguage] : undefined
  };

  return {
    profileUpdates,
    workerProfileUpdates
  };
}
