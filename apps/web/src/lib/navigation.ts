import { NavigateFunction } from 'react-router-dom';

export interface RouteLocationLike {
  pathname: string;
  search: string;
  state?: any;
}

export const SESSION_STORAGE_KEYS = {
  MY_JOB_POSTS: 'opencomm:my-job-posts:return-to',
  manageApplications: (jobId: string) => `opencomm:manage-applications:${jobId}:return-to`,
} as const;

export const FALLBACK_ROUTES = {
  MY_JOB_POSTS: '/profile',
  MANAGE_APPLICATIONS: '/profile/my-job-posts',
} as const;

/**
 * Safely navigates to a destination route while preserving origin state in both 
 * React Router location state and sessionStorage.
 */
export function navigateWithOrigin(
  navigate: NavigateFunction,
  to: string,
  currentLocation: RouteLocationLike,
  storageKey?: string
) {
  const currentPath = (currentLocation?.pathname || '') + (currentLocation?.search || '');

  if (storageKey && currentPath) {
    try {
      sessionStorage.setItem(storageKey, currentPath);
    } catch (e) {
      // ignore storage access errors
    }
  }

  navigate(to, {
    state: { from: currentPath }
  });
}

/**
 * Validates whether a candidate return path is safe, internal, and non-looping.
 */
export function isValidReturnRoute(candidate: any, currentPath: string): candidate is string {
  if (typeof candidate !== 'string' || !candidate) return false;
  
  // Must be an absolute relative path (start with '/' but not '//')
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return false;
  
  // Must not contain external URLs
  if (candidate.includes('://')) return false;
  
  // Must not be the exact current full path
  if (candidate === currentPath) return false;

  // Must not share the exact same base path (prevents self-loops)
  const candidateBase = candidate.split('?')[0].replace(/\/$/, '');
  const currentBase = currentPath.split('?')[0].replace(/\/$/, '');
  if (candidateBase === currentBase) return false;

  return true;
}

/**
 * Resolves the origin-aware return route from location state, sessionStorage, or fallback.
 */
export function resolveReturnRoute(
  currentLocation: RouteLocationLike,
  fallbackRoute: string,
  storageKey?: string
): string {
  const currentPath = (currentLocation?.pathname || '') + (currentLocation?.search || '');

  // 1. Prefer location.state.from
  const stateFrom = currentLocation?.state?.from;
  if (isValidReturnRoute(stateFrom, currentPath)) {
    return stateFrom;
  }

  // 2. Try valid sessionStorage origin
  if (storageKey) {
    try {
      const storedFrom = sessionStorage.getItem(storageKey);
      if (isValidReturnRoute(storedFrom, currentPath)) {
        return storedFrom;
      }
    } catch (e) {
      // ignore storage access errors
    }
  }

  // 3. Fallback route
  return fallbackRoute;
}

/**
 * Executes safe back navigation using the resolved return route, clearing sessionStorage.
 */
export function smartBack(
  navigate: NavigateFunction,
  currentLocation: RouteLocationLike,
  fallbackRoute: string,
  storageKey?: string
) {
  const targetRoute = resolveReturnRoute(currentLocation, fallbackRoute, storageKey);

  if (storageKey) {
    try {
      sessionStorage.removeItem(storageKey);
    } catch (e) {
      // ignore
    }
  }

  navigate(targetRoute, { replace: true });
}
