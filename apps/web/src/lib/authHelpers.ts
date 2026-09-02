export type GoogleAuthIntent = 'signup' | 'signin';

/**
 * Clears temporary Google Auth Intent keys from sessionStorage.
 */
export function clearGoogleAuthIntent(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem('opencomm_google_auth_intent');
    window.sessionStorage.removeItem('opencomm_google_auth_started_at');
  }
}

/**
 * Classifies whether a Google OAuth authentication result represents a newly-created
 * user or an existing OpenComm account (e.g. existing email/password account linked to Google,
 * or existing Google account returning to sign in).
 *
 * Uses Supabase server timestamps primarily (user.created_at, user.last_sign_in_at, identity.created_at)
 * to remain resilient against client/device clock drift.
 */
export function classifyGoogleAuthResult(
  user: any,
  identities: any[] | null = null,
  flowStartedAt: number | null = null
): 'new' | 'existing' {
  if (!user) return 'new';

  const ids = identities || user.identities || [];

  // RULE A: If user has multiple linked identities (e.g. email + google), it is an EXISTING account
  if (Array.isArray(ids) && ids.length > 1) {
    return 'existing';
  }

  // RULE B: If any identity has a non-google provider (e.g. email), it is an EXISTING account
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (id.provider && id.provider !== 'google') {
        return 'existing';
      }
    }
  }

  // RULE C: Check Supabase-issued server timestamps for existing Google account
  const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : null;
  const lastSignInMs = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : null;

  if (createdAtMs !== null && lastSignInMs !== null && !isNaN(createdAtMs) && !isNaN(lastSignInMs)) {
    // If created_at is materially earlier than last_sign_in_at (> 10s difference), it is an EXISTING user returning to sign in
    if (lastSignInMs - createdAtMs > 10000) {
      return 'existing';
    }
  }

  // RULE D: Check identity server creation timestamps if available
  if (Array.isArray(ids) && ids.length === 1 && createdAtMs !== null && !isNaN(createdAtMs)) {
    const singleId = ids[0];
    const idCreatedAtMs = singleId.created_at ? new Date(singleId.created_at).getTime() : null;
    if (idCreatedAtMs !== null && !isNaN(idCreatedAtMs)) {
      if (idCreatedAtMs - createdAtMs > 10000 || createdAtMs - idCreatedAtMs > 10000) {
        return 'existing';
      }
    }
  }

  // RULE E: Conservative fallback using flowStartedAt if server timestamps are unavailable
  if (createdAtMs !== null && !isNaN(createdAtMs) && flowStartedAt !== null && !isNaN(flowStartedAt)) {
    if (createdAtMs < flowStartedAt - 15000) {
      return 'existing';
    }
  }

  // RULE F: Check if user.created_at and last_sign_in_at effectively align (within 10s server processing window)
  if (createdAtMs !== null && lastSignInMs !== null && Math.abs(lastSignInMs - createdAtMs) <= 10000) {
    return 'new';
  }

  // Ambiguous classification: prefer 'existing' for Signup UX safety to prevent incorrectly announcing "Account created" for an old user
  return 'existing';
}
