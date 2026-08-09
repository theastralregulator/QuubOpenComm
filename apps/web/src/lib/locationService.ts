/**
 * Location Service Module — Provider Abstraction
 * Handles location formatting, country-specific region catalogs, languages,
 * policy-safe Nominatim place search, coordinate validation, and reverse geocoding.
 */

import { COUNTRIES_DATA } from './locationsData';

export interface LocationData {
  country: string;
  country_code: string;
  state: string;
  state_code: string;
  district: string;
  city: string; // Locality / City / Town / Village / Suburb
  latitude?: number;
  longitude?: number;
}

export interface PlaceSearchResult {
  display_name: string;
  formatted_summary: string;
  data: LocationData;
}

// All 28 States & 8 Union Territories of India
export const INDIAN_STATES_AND_UTS: { code: string; name: string; isUT?: boolean }[] = [
  // 28 States
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'AR', name: 'Arunachal Pradesh' },
  { code: 'AS', name: 'Assam' },
  { code: 'BR', name: 'Bihar' },
  { code: 'CT', name: 'Chhattisgarh' },
  { code: 'GA', name: 'Goa' },
  { code: 'GJ', name: 'Gujarat' },
  { code: 'HR', name: 'Haryana' },
  { code: 'HP', name: 'Himachal Pradesh' },
  { code: 'JH', name: 'Jharkhand' },
  { code: 'KA', name: 'Karnataka' },
  { code: 'KL', name: 'Kerala' },
  { code: 'MP', name: 'Madhya Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'MN', name: 'Manipur' },
  { code: 'ML', name: 'Meghalaya' },
  { code: 'MZ', name: 'Mizoram' },
  { code: 'NL', name: 'Nagaland' },
  { code: 'OR', name: 'Odisha' },
  { code: 'PB', name: 'Punjab' },
  { code: 'RJ', name: 'Rajasthan' },
  { code: 'SK', name: 'Sikkim' },
  { code: 'TN', name: 'Tamil Nadu' },
  { code: 'TG', name: 'Telangana' },
  { code: 'TR', name: 'Tripura' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'UT', name: 'Uttarakhand' },
  { code: 'WB', name: 'West Bengal' },

  // 8 Union Territories
  { code: 'AN', name: 'Andaman and Nicobar Islands', isUT: true },
  { code: 'CH', name: 'Chandigarh', isUT: true },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', isUT: true },
  { code: 'DL', name: 'Delhi', isUT: true },
  { code: 'JK', name: 'Jammu and Kashmir', isUT: true },
  { code: 'LA', name: 'Ladakh', isUT: true },
  { code: 'LD', name: 'Lakshadweep', isUT: true },
  { code: 'PY', name: 'Puducherry', isUT: true }
];

// Major Indian languages & English for Preferred Language selection
export const MAJOR_LANGUAGES = [
  'English',
  'Malayalam',
  'Hindi',
  'Tamil',
  'Kannada',
  'Telugu',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Urdu',
  'Odia',
  'Assamese',
  'Sanskrit',
  'Konkani',
  'Manipuri',
  'Nepali',
  'Bodo',
  'Dogri',
  'Kashmiri',
  'Maithili',
  'Santali',
  'Sindhi'
];

/**
 * Get country-specific administrative regions (states, provinces, emirates)
 */
export function getRegionsForCountry(countryCodeOrName: string): { code: string; name: string }[] {
  if (!countryCodeOrName) return [];
  const code = countryCodeOrName.trim().toUpperCase();

  const foundCountry = COUNTRIES_DATA.find(c =>
    c.id === code ||
    c.id.toUpperCase() === code ||
    c.name.toLowerCase() === countryCodeOrName.trim().toLowerCase()
  );

  if (foundCountry && foundCountry.states && foundCountry.states.length > 0) {
    return foundCountry.states.map(s => ({ code: s.id, name: s.name }));
  }

  if (code === 'IN' || countryCodeOrName.trim().toLowerCase() === 'india') {
    return INDIAN_STATES_AND_UTS.map(s => ({ code: s.code, name: s.name }));
  }

  return [];
}

/**
 * Validate numeric coordinates
 */
export function isValidCoordinates(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined || lat === null || lng === null) return false;
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Format clean, non-repetitive location summary:
 * "locality, district, state, country"
 * e.g., "Kaduthuruthy, Kottayam, Kerala, India"
 */
export function formatLocationSummary(data?: Partial<LocationData> | null | string): string {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();

  const parts: string[] = [];
  const added = new Set<string>();

  const rawTokens = [
    data.city,
    data.district,
    data.state,
    data.country
  ];

  for (const token of rawTokens) {
    if (!token) continue;
    const trimmed = token.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!added.has(lower)) {
      added.add(lower);
      parts.push(trimmed);
    }
  }

  return parts.join(', ');
}

// In-memory rate limiting and result caching for Nominatim API
const searchCache = new Map<string, PlaceSearchResult[]>();
const reverseCache = new Map<string, LocationData>();
let lastApiCallTimestamp = 0;

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLast = now - lastApiCallTimestamp;
  if (timeSinceLast < 1000) { // 1 request per second rule
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  lastApiCallTimestamp = Date.now();
}

/**
 * Search places by query (e.g., "Kaduthuruthy", "Pala", "Whitefield")
 * Policy-safe: called on explicit user action (button click / Enter key), cached, rate-limited.
 */
export async function searchPlaces(
  query: string,
  options: { countryCode?: string; state?: string } = {}
): Promise<PlaceSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const countryCode = (options.countryCode || 'IN').toLowerCase();
  const cacheKey = `${countryCode}:${options.state || ''}:${q.toLowerCase()}`;

  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey)!;
  }

  let searchQuery = q;
  if (options.state && !q.toLowerCase().includes(options.state.toLowerCase())) {
    searchQuery = `${q}, ${options.state}`;
  }

  await enforceRateLimit();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=10&accept-language=en&countrycodes=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(searchQuery)}`;

    // Standard browser fetch
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const rawList = await res.json();
    if (!Array.isArray(rawList)) return [];

    const results: PlaceSearchResult[] = rawList.map((item: any) => {
      const addr = item.address || {};
      const countryName = addr.country || (countryCode === 'in' ? 'India' : '');
      const stateName = addr.state || addr.province || addr.region || options.state || '';

      // Deterministic extraction order
      const districtName = addr.state_district || addr.county || addr.district || '';
      const localityName = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.neighbourhood || addr.hamlet || addr.quarter || addr.subdistrict || item.name || q;

      const cCode = (addr.country_code || countryCode).toUpperCase();

      // Derive region/state code automatically from country regions or INDIAN_STATES_AND_UTS
      const countryRegions = getRegionsForCountry(cCode);
      const matchedRegion = countryRegions.find(r =>
        (stateName && r.name.toLowerCase() === stateName.toLowerCase()) ||
        (options.state && r.name.toLowerCase() === options.state.toLowerCase())
      );
      const sCode = matchedRegion ? matchedRegion.code : '';

      const lat = item.lat ? Math.round(parseFloat(item.lat) * 1000) / 1000 : undefined;
      const lng = item.lon ? Math.round(parseFloat(item.lon) * 1000) / 1000 : undefined;

      const data: LocationData = {
        country: countryName,
        country_code: cCode,
        state: stateName,
        state_code: sCode,
        district: districtName,
        city: localityName,
        latitude: lat,
        longitude: lng
      };

      const summary = formatLocationSummary(data);

      return {
        display_name: item.display_name,
        formatted_summary: summary,
        data
      };
    });

    searchCache.set(cacheKey, results);
    return results;
  } catch (err) {
    console.warn('[LocationService] Nominatim place search error:', err);
    return [];
  }
}

/**
 * Reverse geocode approximate coordinates
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<LocationData | null> {
  const approxLat = Math.round(lat * 1000) / 1000;
  const approxLng = Math.round(lng * 1000) / 1000;
  const cacheKey = `${approxLat},${approxLng}`;

  if (reverseCache.has(cacheKey)) {
    return reverseCache.get(cacheKey)!;
  }

  await enforceRateLimit();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${approxLat}&lon=${approxLng}&accept-language=en&addressdetails=1`;

    // Standard browser fetch
    const res = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data || !data.address) return null;

    const addr = data.address;
    const countryName = addr.country || '';
    const countryCode = (addr.country_code || '').toUpperCase();
    const stateName = addr.state || addr.province || addr.region || '';

    // Deterministic extraction order
    const districtName = addr.state_district || addr.county || addr.district || '';
    const localityName = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.neighbourhood || addr.hamlet || addr.quarter || addr.subdistrict || '';

    const countryRegions = getRegionsForCountry(countryCode);
    const matchedStateCode = countryRegions.find(r => r.name.toLowerCase() === stateName.toLowerCase())?.code || '';

    const locData: LocationData = {
      country: countryName,
      country_code: countryCode,
      state: stateName,
      state_code: matchedStateCode,
      district: districtName,
      city: localityName,
      latitude: approxLat,
      longitude: approxLng
    };

    reverseCache.set(cacheKey, locData);
    return locData;
  } catch (err) {
    console.warn('[LocationService] Reverse geocode error:', err);
    return null;
  }
}
