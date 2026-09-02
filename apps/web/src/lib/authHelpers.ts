export type GoogleAuthIntent = 'signup' | 'signin';

/**
 * Classifies whether a Google OAuth authentication result represents a newly-created
 * user or an existing OpenComm account (e.g. existing email/password account linked to Google,
 * or existing Google account returning to sign in).
 */
export function classifyGoogleAuthResult(
  user: any,
  identities: any[] | null = null,
  flowStartedAt: number | null = null
): 'new' | 'existing' {
  if (!user) return 'new';

  const userCreatedAt = user.created_at ? new Date(user.created_at).getTime() : Date.now();
  const now = Date.now();

  // Reference timestamp: use flowStartedAt if valid, else default to 30 seconds ago
  const refTime = flowStartedAt && !isNaN(flowStartedAt) ? flowStartedAt : (now - 30000);

  // CASE B: If user was created significantly before the flow started, it is an EXISTING user
  if (userCreatedAt < refTime - 15000) {
    return 'existing';
  }

  // CASE A: If user has multiple linked identities (e.g. email/password + google), it is an EXISTING user
  const ids = identities || user.identities || [];
  if (Array.isArray(ids) && ids.length > 1) {
    return 'existing';
  }

  // Check individual identity timestamps / providers
  if (Array.isArray(ids)) {
    for (const id of ids) {
      if (id.created_at) {
        const idCreatedAt = new Date(id.created_at).getTime();
        if (idCreatedAt < refTime - 15000) {
          return 'existing';
        }
      }
      if (id.provider && id.provider !== 'google') {
        return 'existing';
      }
    }
  }

  // CASE C: Truly new Google user created during this current OAuth flow
  return 'new';
}
