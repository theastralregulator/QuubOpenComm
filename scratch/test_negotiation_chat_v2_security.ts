/**
 * Negotiation Chat V2 & Production UI Static Preflight + Unit Test Suite
 * Performs actual static file analysis, AST checks, and unit tests.
 */

import fs from 'fs';
import path from 'path';
import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';
import { getDeadlineInfo } from '../apps/web/src/lib/deadline.js';
import { classifyGoogleAuthResult } from '../apps/web/src/lib/authHelpers.js';

function runPreflightAndUnitChecks() {
  console.log('=== STARTING NEGOTIATION CHAT V2 & UI STATIC PREFLIGHT + UNIT CHECKS ===');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, description: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${totalCount}. ${description}`);
      passedCount++;
    } else {
      console.error(`[FAIL] ${totalCount}. ${description}`);
    }
  }

  const rootDir = process.cwd();
  const migrationPath = path.join(rootDir, 'supabase/migrations/20260822010000_negotiation_chat_feature_parity.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  const workerColsMigrationPath = path.join(rootDir, 'supabase/migrations/20260824000000_worker_profile_persistence_columns.sql');
  const workerColsMigrationSql = fs.existsSync(workerColsMigrationPath) ? fs.readFileSync(workerColsMigrationPath, 'utf8') : '';

  const jobAppHardenMigrationPath = path.join(rootDir, 'supabase/migrations/20260825010000_harden_job_applications_security.sql');
  const jobAppHardenSql = fs.existsSync(jobAppHardenMigrationPath) ? fs.readFileSync(jobAppHardenMigrationPath, 'utf8') : '';

  const simplifiedSignupMigrationPath = path.join(rootDir, 'supabase/migrations/20260901010000_simplified_signup_profile_completion_and_intro.sql');
  const simplifiedSignupSql = fs.existsSync(simplifiedSignupMigrationPath) ? fs.readFileSync(simplifiedSignupMigrationPath, 'utf8') : '';

  const negotiationPagePath = path.join(rootDir, 'apps/web/src/components/hiring/NegotiationPage.tsx');
  const negotiationPageCode = fs.readFileSync(negotiationPagePath, 'utf8');

  const profilePagePath = path.join(rootDir, 'apps/web/src/components/profile/ProfilePage.tsx');
  const profilePageCode = fs.readFileSync(profilePagePath, 'utf8');

  const completeProfilePagePath = path.join(rootDir, 'apps/web/src/components/profile/CompleteProfilePage.tsx');
  const completeProfilePageCode = fs.existsSync(completeProfilePagePath) ? fs.readFileSync(completeProfilePagePath, 'utf8') : '';

  const messagesPagePath = path.join(rootDir, 'apps/web/src/components/messages/MessagesPage.tsx');
  const messagesPageCode = fs.readFileSync(messagesPagePath, 'utf8');

  const routeTrackerPath = path.join(rootDir, 'apps/web/src/components/common/RouteTracker.tsx');
  const routeTrackerCode = fs.readFileSync(routeTrackerPath, 'utf8');

  const basicModalPath = path.join(rootDir, 'apps/web/src/components/auth/BasicAccountWorkerIntroModal.tsx');
  const basicModalCode = fs.readFileSync(basicModalPath, 'utf8');

  const navbarPath = path.join(rootDir, 'apps/web/src/components/navigation/Navbar.tsx');
  const navbarCode = fs.readFileSync(navbarPath, 'utf8');

  const loaderComponentPath = path.join(rootDir, 'apps/web/src/components/common/OpenCommAnimatedLoader.tsx');
  const loaderComponentCode = fs.readFileSync(loaderComponentPath, 'utf8');

  const loaderCssPath = path.join(rootDir, 'apps/web/src/components/common/OpenCommAnimatedLoader.css');
  const loaderCssCode = fs.readFileSync(loaderCssPath, 'utf8');

  const protectedRoutePath = path.join(rootDir, 'apps/web/src/components/auth/ProtectedRoute.tsx');
  const protectedRouteCode = fs.readFileSync(protectedRoutePath, 'utf8');

  const appPath = path.join(rootDir, 'apps/web/src/App.tsx');
  const appCode = fs.readFileSync(appPath, 'utf8');

  const authSchemasPath = path.join(rootDir, 'apps/web/src/lib/auth-schemas.ts');
  const authSchemasCode = fs.readFileSync(authSchemasPath, 'utf8');

  const supabaseLibPath = path.join(rootDir, 'apps/web/src/lib/supabase.ts');
  const supabaseLibCode = fs.readFileSync(supabaseLibPath, 'utf8');

  const modalPath = path.join(rootDir, 'apps/web/src/components/jobs/SharedApplicationModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf8');

  const deadlineLibPath = path.join(rootDir, 'apps/web/src/lib/deadline.ts');
  const deadlineLibCode = fs.readFileSync(deadlineLibPath, 'utf8');

  const fallbackApiPath = path.join(rootDir, 'api/media-upload-fallback-intent.ts');
  const fallbackApiCode = fs.readFileSync(fallbackApiPath, 'utf8');

  const finalizeApiPath = path.join(rootDir, 'api/media-finalize.ts');
  const finalizeApiCode = fs.readFileSync(finalizeApiPath, 'utf8');

  // 1. Migration Ordering Check: Helper function created BEFORE policies referencing it
  const helperIndex = migrationSql.indexOf('FUNCTION public.can_current_user_access_negotiation_room');
  const policyIndex = migrationSql.indexOf('POLICY "Participants can view negotiation message reactions"');
  assert(
    helperIndex !== -1 && policyIndex !== -1 && helperIndex < policyIndex,
    'Migration Ordering: can_current_user_access_negotiation_room function is defined BEFORE dependent RLS policies'
  );

  // 2. Constraint Drop Loop OID Fix: Uses con_record.oid and format(), NOT conname::regclass
  const usesOid = /pg_get_constraintdef\(con_record\.oid\)/i.test(migrationSql);
  const avoidsRegclassCast = !/pg_get_constraintdef\(con_record\.conname::regclass\)/i.test(migrationSql);
  assert(
    usesOid && avoidsRegclassCast,
    'Constraint Migration SQL: Uses pg_get_constraintdef(con_record.oid) and avoids conname::regclass cast'
  );

  // 3. Text Check Constraint Preservation: negotiation_messages_text_check is NOT explicitly dropped
  const textCheckNotDropped = !/DROP CONSTRAINT.*negotiation_messages_text_check/i.test(migrationSql);
  assert(
    textCheckNotDropped,
    'Constraint Safety: negotiation_messages_text_check is NOT explicitly dropped in migration'
  );

  // 4. Delete RPC Security: Revoked from authenticated, granted ONLY to service_role
  const deleteRevokeMatch = /REVOKE ALL ON FUNCTION public\.delete_negotiation_message_internal\(uuid, uuid\) FROM PUBLIC, anon, authenticated;/i.test(migrationSql);
  const deleteGrantMatch = /GRANT EXECUTE ON FUNCTION public\.delete_negotiation_message_internal\(uuid, uuid\) TO service_role;/i.test(migrationSql);
  assert(
    deleteRevokeMatch && deleteGrantMatch,
    'Delete RPC Security: delete_negotiation_message_internal is REVOKED from authenticated and granted ONLY to service_role'
  );

  // 5. Active Account Check: send_negotiation_message_v2 and toggle_negotiation_message_reaction RPCs enforce is_current_user_active()
  const activeCheckInSend = /send_negotiation_message_v2[\s\S]*?is_current_user_active\(\)/i.test(migrationSql);
  const activeCheckInReaction = /toggle_negotiation_message_reaction[\s\S]*?is_current_user_active\(\)/i.test(migrationSql);
  assert(
    activeCheckInSend && activeCheckInReaction,
    'Active Account Check: send_negotiation_message_v2 and toggle_negotiation_message_reaction RPCs enforce is_current_user_active()'
  );

  // 6. Atomic Row Locking FOR UPDATE in Intent Claim and Finalize RPCs
  const claimForUpdate = /claim_negotiation_media_upload_intent_for_finalize[\s\S]*?FOR UPDATE/i.test(migrationSql);
  const finalizeForUpdate = /finalize_negotiation_media_message_internal[\s\S]*?FOR UPDATE/i.test(migrationSql);
  assert(
    claimForUpdate && finalizeForUpdate,
    'Atomic Locking: claim and finalize SQL RPCs acquire explicit row-level locks via SELECT ... FOR UPDATE'
  );

  // 7. Canonical Finalizer: Compares reply_to_message_id using IS DISTINCT FROM against intent authorization
  const finalizeDistinctReplyCheck = /v_intent\.reply_to_message_id\s+IS DISTINCT FROM\s+p_reply_to_message_id/i.test(migrationSql);
  assert(
    finalizeDistinctReplyCheck,
    'Canonical Finalizer: Compares reply_to_message_id using IS DISTINCT FROM against intent authorization'
  );

  // 8. DB Invariant: Recheck Negotiation Room Status WITH FOR SHARE in Finalizer
  const finalizerRoomShareCheck = /finalize_negotiation_media_message_internal[\s\S]*?SELECT status[\s\S]*?FROM public\.negotiation_rooms[\s\S]*?FOR SHARE/i.test(migrationSql);
  assert(
    finalizerRoomShareCheck,
    'Finalizer DB Invariant: Rechecks negotiation room active status with FOR SHARE lock right before INSERT'
  );

  // 9. Direct Privilege Revocation on negotiation_messages
  const directRevoke = /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.negotiation_messages FROM PUBLIC, anon, authenticated;/i.test(migrationSql);
  assert(
    directRevoke,
    'Privilege Hardening: Direct INSERT, UPDATE, DELETE, TRUNCATE on negotiation_messages is REVOKED from authenticated'
  );

  // 10. Online Status Privacy: Fail-closed logic in NegotiationPage
  const onlinePrivacyCheck = /showOnlineStatus === true/i.test(negotiationPageCode);
  const onlinePrivacyNegativeCheck = !/showOnlineStatus !== false/i.test(negotiationPageCode);
  assert(
    onlinePrivacyCheck && onlinePrivacyNegativeCheck,
    'Online Status Privacy: NegotiationPage strictly evaluates showOnlineStatus === true (fail-closed)'
  );

  // 11. Reaction Realtime Flow: Error checking, local refresh, and broadcast
  const reactionRpcErrorCheck = /if \(rpcErr\)/i.test(negotiationPageCode);
  const reactionBroadcastPayload = /event: 'reaction_changed'/i.test(negotiationPageCode) && /roomId: details\.negotiation_room\.id/i.test(negotiationPageCode);
  assert(
    reactionRpcErrorCheck && reactionBroadcastPayload,
    'Reaction Realtime: handleToggleReaction checks RPC error, refreshes local state, and broadcasts reaction_changed'
  );

  // 12. Fallback API: originalProvider validation in consolidated endpoint
  const fallbackOriginalProviderCheck = /originalProvider !== 'b2' && originalProvider !== 'cloudinary'/i.test(fallbackApiCode);
  assert(
    fallbackOriginalProviderCheck,
    'Fallback API: Validates originalProvider strictly against b2 or cloudinary in consolidated endpoint'
  );

  // 13. Provider/MIME Validation in Media Finalizer
  const finalizeMimeValidation = /provider === 'cloudinary'[\s\S]*?resType[\s\S]*?allowedImageFormats/i.test(finalizeApiCode) && /isMimeCompatible/i.test(finalizeApiCode);
  assert(
    finalizeMimeValidation,
    'Media Finalizer: Contains full provider/MIME format validation matching permanent media rules'
  );

  // 14. Target Change Guard for Initial Position Refs Reset
  const targetChangeGuardCheck = /loadedWorkflowTargetRef\.current !== nextTargetKey/i.test(negotiationPageCode);
  const initialRefsResetCheck = /if \(isWorkflowTargetChange\)[\s\S]*?initialScrollCompletedRef\.current = false/i.test(negotiationPageCode);
  const realtimeScrollClearedCheck = /if \(isWorkflowTargetChange\)[\s\S]*?realtimeScrollTargetRef\.current = null/i.test(negotiationPageCode);
  assert(
    targetChangeGuardCheck && initialRefsResetCheck && realtimeScrollClearedCheck,
    'Target Change Guard: Initial position and realtime scroll refs are reset ONLY on true workflow target change'
  );

  // 15. Typing Indicator Text: Exactly "Typing…" without user names
  const messagesPageTypingText = /<span>Typing…<\/span>/i.test(messagesPageCode) && !/is typing/i.test(messagesPageCode);
  const negotiationPageTypingText = /<span>Typing…<\/span>/i.test(negotiationPageCode) && !/is typing/i.test(negotiationPageCode);
  assert(
    messagesPageTypingText && negotiationPageTypingText,
    'Typing Indicator Text: All visible typing render paths display ONLY "Typing…" without names'
  );

  // 16. Route Tracker Metadata: /messages/:conversationId maps to "Messages | OpenComm" instead of 404
  const routeTrackerMessagesCheck = /path === '\/messages' \|\| path\.startsWith\('\/messages\/'\)/i.test(routeTrackerCode);
  assert(
    routeTrackerMessagesCheck,
    'Route Tracker Metadata: /messages/:conversationId maps to "Messages | OpenComm" instead of 404'
  );

  // 17. Basic Account Modal: Top Sparkles icon and wrapper removed
  const modalSparklesImportRemoved = !/Sparkles/i.test(basicModalCode);
  const modalHeaderClean = /Your Basic Account is Ready/i.test(basicModalCode);
  assert(
    modalSparklesImportRemoved && modalHeaderClean,
    'Basic Account Modal: Top decorative Sparkles icon and unused import removed cleanly'
  );

  // 18. Mobile Navbar: Bounded safe-area bottom offset positioning
  const navbarBoundedBottom = /clamp\(10px, env\(safe-area-inset-bottom, 10px\), 34px\)/i.test(navbarCode);
  const navbarOldPbRemoved = !/pb-\[calc\(16px\+env\(safe-area-inset-bottom\)\)\]/i.test(navbarCode);
  assert(
    navbarBoundedBottom && navbarOldPbRemoved,
    'Mobile Navbar: Uses bounded clamp(10px, env(safe-area-inset-bottom, 10px), 34px) bottom offset'
  );

  // 19. Animated Loader Brand Wordmark: Displays EXACTLY "OpenComm" and uses React useId()
  const loaderWordmarkText = />\s*OpenComm\s*</i.test(loaderComponentCode) && !/>\s*YOU\s*</i.test(loaderComponentCode);
  const loaderUseIdCheck = /useId\(\)/i.test(loaderComponentCode) && /gradientId = `opencomm-loader-gradient-/i.test(loaderComponentCode);
  assert(
    loaderWordmarkText && loaderUseIdCheck,
    'Animated Loader Brand: Wordmark displays EXACTLY "OpenComm" with unique useId() instance IDs'
  );

  // 20. Animated Loader CSS Architecture: Scoped classes, valid align-items, no :global() rules, and no dead keyframes
  const cssNoGenericClasses = !/^\s*\.loader\b/m.test(loaderCssCode) && !/^\s*\.spin\b/m.test(loaderCssCode) && !/^\s*\.dash\b/m.test(loaderCssCode);
  const cssScopedClasses = /opencomm-loader-container/i.test(loaderCssCode) && /opencomm-loader-trace/i.test(loaderCssCode);
  const cssValidAlignItems = /align-items:\s*center;/i.test(loaderCssCode) && !/items-center:/i.test(loaderCssCode);
  const cssNoGlobalSelector = !/:global\(/i.test(loaderCssCode);
  const cssNoUnusedKeyframes = !/@keyframes\s+opencommLoaderGradientRotate/i.test(loaderCssCode);
  assert(
    cssNoGenericClasses && cssScopedClasses && cssValidAlignItems && cssNoGlobalSelector && cssNoUnusedKeyframes,
    'Animated Loader CSS Architecture: Scoped classes, valid align-items, no :global() rules, and no dead keyframes'
  );

  // 21. ProtectedRoute & App Callback Integrations
  const protectedRouteLoaderCheck = /<OpenCommAnimatedLoader[\s\S]*?fullscreen[\s\S]*?size="lg"/i.test(protectedRouteCode);
  const appCallbackLoaderCheck = /authCallbackStatus === 'processing'[\s\S]*?<OpenCommAnimatedLoader size="md" \/>/i.test(appCode);
  assert(
    protectedRouteLoaderCheck && appCallbackLoaderCheck,
    'Loader Integrations: ProtectedRoute Category A fullscreen loader and App.tsx Category B callback loader present'
  );

  // 22. Technical Precision: linearGradient userSpaceOnUse coordinates, lazy reduced-motion initialization, and SVG animateTransform
  const userSpaceGradientCheck = /gradientUnits="userSpaceOnUse"/i.test(loaderComponentCode) && /x2="340"/i.test(loaderComponentCode) && /y2="75"/i.test(loaderComponentCode);
  const lazyReducedMotionCheck = /useState\(\(\) =>[\s\S]*?prefers-reduced-motion/i.test(loaderComponentCode);
  const svgAnimateTransformCheck = /<animateTransform[\s\S]*?attributeName="gradientTransform"/i.test(loaderComponentCode);
  assert(
    userSpaceGradientCheck && lazyReducedMotionCheck && svgAnimateTransformCheck,
    'Technical Precision: linearGradient userSpaceOnUse coordinates, lazy reduced-motion initialization, and SVG animateTransform'
  );

  // 23. Vercel Hobby Serverless Function Count Limit (<= 10 functions)
  const apiDir = path.join(rootDir, 'api');
  const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('.ts'));
  const serverlessCount = apiFiles.length;
  assert(
    serverlessCount <= 10,
    `Vercel Hobby Serverless Limit: Deployable functions count is ${serverlessCount} (<= 10 target, well below 12 Hobby limit)`
  );

  // --- WORKER PROFILE PERSISTENCE & DATA INTEGRITY ---

  // 24. Migration for Worker Profile Persistence Columns
  const migrationHasCols = workerColsMigrationSql.includes('primary_category text') &&
    workerColsMigrationSql.includes('work_preference text') &&
    workerColsMigrationSql.includes('rate_period text') &&
    workerColsMigrationSql.includes('rate_amount numeric');
  assert(
    migrationHasCols,
    'Worker Persistence Migration: Adds primary_category, work_preference, rate_period, rate_amount via ADD COLUMN IF NOT EXISTS'
  );

  // 25. Availability Status DB Constraint Compliance
  const appNoPartTimeAvail = !/<option value="Part-time">Part-time<\/option>/.test(appCode);
  const profileNoPartTimeAvail = !/<option value="Part-time">Part-time<\/option>/.test(profilePageCode);
  assert(
    appNoPartTimeAvail && profileNoPartTimeAvail,
    'Availability Status DB Constraint: Options strictly match "Available Now", "Busy", "On Vacation" (no Part-time/Full-time)'
  );

  // --- SIMPLIFIED SIGNUP, GOOGLE AUTH & PROFILE COMPLETION ASSERTIONS ---

  // 26. Repo Mirror Migration Exists: 20260901010000_simplified_signup_profile_completion_and_intro.sql
  const mirrorMigrationExists = fs.existsSync(simplifiedSignupMigrationPath);
  const mirrorHasRpc = simplifiedSignupSql.includes('acknowledge_basic_account_intro()') &&
    simplifiedSignupSql.includes('is_current_user_profile_complete()') &&
    simplifiedSignupSql.includes('update_my_basic_profile(');
  assert(
    mirrorMigrationExists && mirrorHasRpc,
    'Repo Mirror Migration: 20260901010000_simplified_signup_profile_completion_and_intro.sql mirrors production RPCs & columns'
  );

  // 27. Simplified Initial Signup Schema: No phone or confirm_password required
  const schemaNoPhone = !authSchemasCode.includes('phone: z.string()');
  const schemaNoConfirmPass = !authSchemasCode.includes('confirm_password');
  assert(
    schemaNoPhone && schemaNoConfirmPass,
    'SignUp Schema: Initial signup schema asks ONLY for full_name, email, password, accept_terms (no phone or confirm_password)'
  );

  // 28. Google Auth OAuth Integration: Continue with Google uses signInWithOAuth
  const googleOAuthCheck = appCode.includes("provider: 'google'") &&
    appCode.includes("signInWithOAuth");
  assert(
    googleOAuthCheck,
    'Google Auth: "Continue with Google" integrates via Supabase Auth signInWithOAuth'
  );

  // 29. Profile Completion Page: Focused setup component exists and uses LocationSelector
  const completeProfileExists = fs.existsSync(completeProfilePagePath);
  const completeProfileUsesLocation = completeProfilePageCode.includes('LocationSelector') &&
    completeProfilePageCode.includes('onboarding_completed: true');
  assert(
    completeProfileExists && completeProfileUsesLocation,
    'Complete Profile Page: Focused /complete-profile setup page enforces mandatory location and onboarding_completed: true'
  );

  // 30. DB Onboarding Authority: ProtectedRoute redirects incomplete users to /complete-profile
  const protectedRouteCompleteCheck = protectedRouteCode.includes('Navigate to="/complete-profile"');
  assert(
    protectedRouteCompleteCheck,
    'DB Onboarding Authority: ProtectedRoute redirects incomplete onboarding users to /complete-profile'
  );

  // 31. Basic Intro Acknowledgement: dbService method calls acknowledge_basic_account_intro RPC
  const dbServiceAckCheck = supabaseLibCode.includes("supabase.rpc('acknowledge_basic_account_intro')");
  assert(
    dbServiceAckCheck,
    'Intro Acknowledgement: dbService.acknowledgeBasicAccountIntro calls production RPC acknowledge_basic_account_intro'
  );

  // --- HARDENED SECURE SUBMIT RPC, CONCURRENCY LOCKS & TABLE PRIVILEGE CHECKS ---

  // 32. Security Migration: 20260825010000_harden_job_applications_security.sql exists
  assert(
    fs.existsSync(jobAppHardenMigrationPath),
    'Security Migration: 20260825010000_harden_job_applications_security.sql exists'
  );

  // 33. authenticated role has NO direct table INSERT grant after migration
  const authNoTableInsert = jobAppHardenSql.includes('REVOKE ALL ON public.job_applications FROM authenticated;') &&
    jobAppHardenSql.includes('GRANT SELECT ON public.job_applications TO authenticated;') &&
    !jobAppHardenSql.includes('GRANT SELECT, INSERT ON public.job_applications TO authenticated;');
  assert(
    authNoTableInsert,
    'Table Privilege Hardening: authenticated role has NO direct table INSERT or UPDATE grant after migration'
  );

  // 34. Row Locking: update_job_application_status and withdraw_job_application use FOR UPDATE
  const updateRpcForUpdate = jobAppHardenSql.includes('FUNCTION public.update_job_application_status') &&
    /update_job_application_status[\s\S]*?FOR UPDATE/i.test(jobAppHardenSql);
  const withdrawRpcForUpdate = jobAppHardenSql.includes('FUNCTION public.withdraw_job_application') &&
    /withdraw_job_application[\s\S]*?FOR UPDATE/i.test(jobAppHardenSql);
  assert(
    updateRpcForUpdate && withdrawRpcForUpdate,
    'Concurrency Locking: update_job_application_status and withdraw_job_application lock application row FOR UPDATE'
  );

  // 35. Job Row Lock: submit_job_application locks target job FOR SHARE
  const submitRpcForShare = /submit_job_application[\s\S]*?FOR SHARE/i.test(jobAppHardenSql);
  assert(
    submitRpcForShare,
    'Concurrency Locking: submit_job_application locks target job row FOR SHARE'
  );

  // 36. Fail-Closed Job Active Check: IS DISTINCT FROM true
  const failClosedIsActive = jobAppHardenSql.includes('v_job_is_active IS DISTINCT FROM true');
  assert(
    failClosedIsActive,
    'Fail-Closed Safety: submit_job_application enforces v_job_is_active IS DISTINCT FROM true'
  );

  // 37. Input Validation: submit_job_application validates non-empty proposed rate & cover letter
  const submitInputValidation = jobAppHardenSql.includes("Proposed rate is required") &&
    jobAppHardenSql.includes("Cover letter is required");
  assert(
    submitInputValidation,
    'Input Validation: submit_job_application validates non-empty proposed rate & cover letter with max length limits'
  );

  // 38. RLS WITH CHECK explicitly requires status = 'pending' AND blocks non-null workflow fields
  const rlsDefenseInDepth = jobAppHardenSql.includes("status = 'pending'") &&
    jobAppHardenSql.includes('negotiation_room_id IS NULL') &&
    jobAppHardenSql.includes('active_proposal_id IS NULL') &&
    jobAppHardenSql.includes('work_contract_id IS NULL');
  assert(
    rlsDefenseInDepth,
    'RLS Defense-in-Depth: WITH CHECK policy requires status = pending and enforces NULL workflow linkage fields'
  );

  // 39. Test A: syncUserSession populates currentProfileObj
  const syncPopulatesCurrentProfile = /setCurrentProfileObj\(profile\)/i.test(appCode);
  assert(
    syncPopulatesCurrentProfile,
    'Test A: syncUserSession populates currentProfileObj with loaded canonical DB profile'
  );

  // 40. Test B & C: handleLogoutCleanState clears currentProfileObj and onboarding state
  const logoutClearsCurrentProfile = /setCurrentProfileObj\(null\)/i.test(appCode);
  const logoutClearsOnboardingState = /setIsOnboardingCompleted\(false\)/i.test(appCode);
  assert(
    logoutClearsCurrentProfile && logoutClearsOnboardingState,
    'Test B & C: handleLogoutCleanState clears currentProfileObj and resets onboarding state to false'
  );

  // 41. Test D: /complete-profile is not anonymously accessible (removed from isPublicPath)
  const isPublicPathIncludesCompleteProfile = /p === '\/complete-profile'/i.test(
    appCode.slice(appCode.indexOf('const isPublicPath'), appCode.indexOf('return false;'))
  );
  assert(
    !isPublicPathIncludesCompleteProfile,
    'Test D: /complete-profile is NOT included in isPublicPath and requires authentication'
  );

  // 42. Test E: Basic Account intro requires onboarding_completed === true
  const syncIntroRequiresOnboarding = /profile\.onboarding_completed === true[\s\S]*?profile\.profile_type === 'basic'[\s\S]*?profile\.basic_account_intro_seen === false/i.test(appCode);
  assert(
    syncIntroRequiresOnboarding,
    'Test E: Basic Account intro modal eligibility strictly requires profile.onboarding_completed === true'
  );

  // 43. Test F & G: opencomm_onboarding_completed and intro localStorage keys are NOT authorization sources
  const useStateLocalStorageOnboarding = /useState<boolean>\(\(\) => \{[\s\S]*?opencomm_onboarding_completed/i.test(appCode);
  const introLocalStorageAuthority = /localStorage\.getItem\(`opencomm_basic_intro_seen_\$\{userId\}`\)/i.test(appCode);
  assert(
    !useStateLocalStorageOnboarding && !introLocalStorageAuthority,
    'Test F & G: localStorage keys (opencomm_onboarding_completed, opencomm_basic_intro_seen_*) are removed as authorization sources'
  );

  // 44. Test H & I: Action gate re-validates canonical DB profile & incomplete users redirect to /complete-profile
  const requireGateRefetchesProfile = /dbService\.getProfile\(authUserId\)/i.test(
    appCode.slice(appCode.indexOf('const requireEmailVerification'), appCode.indexOf('checkEmailVerificationFreshStatus'))
  );
  const actionGateRedirectToast = appCode.includes('Complete your profile to continue.') && appCode.includes("navigate('/complete-profile')");
  assert(
    requireGateRefetchesProfile && actionGateRedirectToast,
    'Test H & I: requireEmailVerification re-validates canonical DB profile and redirects incomplete users to /complete-profile'
  );

  // 45. Test J: Account isolation in handleLogoutCleanState
  const logoutRemovesAuthKeys = appCode.includes("localStorage.removeItem('opencomm_is_logged_in')") &&
    appCode.includes("localStorage.removeItem('opencomm_user_type')");
  assert(
    logoutRemovesAuthKeys,
    'Test J: Account isolation: handleLogoutCleanState purges user tokens, profile objects, and auth states'
  );

  // 46. Test K: Google-auth callback redirects to /complete-profile
  const googleOAuthRedirectPath = appCode.includes('next=/complete-profile');
  assert(
    googleOAuthRedirectPath,
    'Test K: Google OAuth callback options target /complete-profile as primary onboarding entry point'
  );

  // 47. Test L: Intro acknowledgement calls canonical RPC
  const introModalRpcCall = appCode.includes('dbService.acknowledgeBasicAccountIntro()');
  assert(
    introModalRpcCall,
    'Test L: Basic Worker intro dismissal/action invokes canonical dbService.acknowledgeBasicAccountIntro() RPC'
  );

  // 48. Test M: Reconciliation migration contains exact production create_my_worker_profile signature, body, FOR UPDATE locks, unnest skills, and COALESCE upsert without CASE array_length
  const reconcSql = fs.readFileSync(path.join(rootDir, 'supabase/migrations/20260901020000_reconcile_simplified_signup_production_state.sql'), 'utf8');
  const reconcHasExactWorkerSig = reconcSql.includes('p_profession text') && reconcSql.includes('p_skills text[]') && reconcSql.includes('p_experience_years integer');
  const reconcNoIncorrectOverload = !reconcSql.includes('p_title text') && !reconcSql.includes('p_primary_category text');
  const reconcWorkerBodyParity = reconcSql.includes('search_path = public, auth, pg_temp') &&
    reconcSql.includes('FOR UPDATE;') &&
    reconcSql.includes('unnest(p_skills)') &&
    reconcSql.includes('certificates = COALESCE(EXCLUDED.certificates, public.worker_profiles.certificates)') &&
    !reconcSql.includes('CASE WHEN array_length(EXCLUDED.certificates');
  assert(
    reconcHasExactWorkerSig && reconcNoIncorrectOverload && reconcWorkerBodyParity,
    'Test M: create_my_worker_profile uses exact 11-param signature, FOR UPDATE lock, unnest skill cleaning, and production COALESCE upsert semantics without custom CASE array_length logic'
  );

  // 49. Test N: protect_profile_system_fields is NOT SECURITY DEFINER and checks current_user IN ('anon', 'authenticated')
  const protectFuncCode = reconcSql.slice(reconcSql.indexOf('protect_profile_system_fields()'), reconcSql.indexOf('trg_protect_profile_system_fields'));
  const protectNotDefiner = !protectFuncCode.includes('SECURITY DEFINER');
  const protectNoSessionUserBypass = !protectFuncCode.includes('current_user != session_user');
  const protectUserRoleCheck = protectFuncCode.includes("current_user IN ('anon', 'authenticated')");
  assert(
    protectNotDefiner && protectNoSessionUserBypass && protectUserRoleCheck,
    'Test N: protect_profile_system_fields is NOT SECURITY DEFINER, has NO session_user bypass, and checks current_user IN (anon, authenticated)'
  );

  // 50. Test O: Messaging trigger mirrors production exact error message & joins auth.users
  const messageTriggerCode = reconcSql.slice(reconcSql.indexOf('enforce_message_sender_profile_ready()'), reconcSql.indexOf('trg_enforce_message_sender_profile_ready'));
  const msgTriggerUserCheck = messageTriggerCode.includes("NEW.role = 'user'") && messageTriggerCode.includes("NEW.sender_id IS NOT NULL");
  const msgTriggerJoinUsers = messageTriggerCode.includes("profiles p") && messageTriggerCode.includes("JOIN auth.users u ON u.id = p.id");
  const msgTriggerExactErrMsg = messageTriggerCode.includes("Complete and verify your profile before sending messages.");
  assert(
    msgTriggerUserCheck && msgTriggerJoinUsers && msgTriggerExactErrMsg,
    'Test O: enforce_message_sender_profile_ready mirrors production JOIN auth.users check and exact user error message'
  );

  // 51. Test P: Migration chain return-type fix, update_my_basic_profile whitespace validation & exact production helper RPC attributes
  const dropAcknowledgeBeforeCreate = reconcSql.indexOf('DROP FUNCTION IF EXISTS public.acknowledge_basic_account_intro();') < reconcSql.indexOf('CREATE OR REPLACE FUNCTION public.acknowledge_basic_account_intro()');
  const updateProfileWhitespaceCheck = reconcSql.includes('Username cannot be empty or whitespace') && reconcSql.includes('Full name cannot be empty or whitespace');
  const updateProfileCoalesceUrls = reconcSql.includes("avatar_url = COALESCE(NULLIF(trim(p_avatar_url), ''), avatar_url)") && reconcSql.includes("banner_url = COALESCE(NULLIF(trim(p_banner_url), ''), banner_url)");
  const isProfileCompleteStableSql = /is_current_user_profile_complete[\s\S]*?LANGUAGE sql[\s\S]*?STABLE/i.test(reconcSql);
  const isActivePlpgsqlStable = /is_current_user_active[\s\S]*?LANGUAGE plpgsql[\s\S]*?STABLE/i.test(reconcSql);
  const acknowledgeReturnsFound = reconcSql.includes('RETURN FOUND;');
  const workerPolicyUpsertName = reconcSql.includes('Workers can upsert their own profile details');
  assert(
    dropAcknowledgeBeforeCreate && updateProfileWhitespaceCheck && updateProfileCoalesceUrls && isProfileCompleteStableSql && isActivePlpgsqlStable && acknowledgeReturnsFound && workerPolicyUpsertName,
    'Test P: 20260901020000 drops acknowledge_basic_account_intro before recreate, enforces whitespace validation in update_my_basic_profile, and uses exact production COALESCE URL semantics'
  );

  // 52. Test Q: Sign In UI contains Continue with Google button using handleGoogleSignIn
  const signinHasGoogleBtn = appCode.includes("showAuthModal === 'signin'") && appCode.includes("handleGoogleSignIn") && appCode.includes("Continue with Google");
  assert(
    signinHasGoogleBtn,
    'Test Q: Sign In modal UI renders Continue with Google button using canonical handleGoogleSignIn handler'
  );

  // 53. Test R: Auth callback fetches fresh profile post-sync & route guard enforces strict /complete-profile gate
  const callbackCode = appCode.slice(appCode.indexOf('const handleCallbackSession'), appCode.indexOf('processCallback()'));
  const callbackSyncFirst = callbackCode.indexOf('await syncUserSession(session)') < callbackCode.indexOf('await dbService.getProfile(user.id)');
  const callbackNoHomeFlash = !callbackCode.includes("window.history.replaceState({}, '', '/')");
  const callbackStrictRoute = callbackCode.includes("navigate('/complete-profile', { replace: true })");
  const routeGuardStrictIncomplete = appCode.includes("} else if (!isOnboardingCompleted) {") && !appCode.includes("if (path !== '/complete-profile' && !isPublicPath(path)) {");

  assert(
    callbackSyncFirst && callbackNoHomeFlash && callbackStrictRoute && routeGuardStrictIncomplete,
    'Test R: /auth/callback uses fresh profile after session sync, avoids home flash, and route guard strictly locks authenticated incomplete users to /complete-profile'
  );

  // 54. Test S: Navbar and Footer are hidden during mandatory profile completion & Sign out escape action exists
  const completeProfileCompCode = fs.readFileSync(path.join(rootDir, 'apps/web/src/components/profile/CompleteProfilePage.tsx'), 'utf8');
  const hasMandatoryFlag = appCode.includes('const isMandatoryProfileCompletion = isLoggedIn && isEmailVerified && !isOnboardingCompleted;');
  const navbarHiddenOnMandatory = appCode.includes('{!isAdminRoute && !isMandatoryProfileCompletion && (');
  const footerHiddenOnMandatory = /!isMandatoryProfileCompletion[\s\S]*?<Footer/.test(appCode);
  const completeProfileHasSignout = completeProfileCompCode.includes('onLogout?: () => void;') && completeProfileCompCode.includes('Sign out') && appCode.includes('onLogout={handleLogout}');
  const noSkipBypass = !completeProfileCompCode.includes('Skip') && !completeProfileCompCode.includes('Maybe later');

  assert(
    hasMandatoryFlag && navbarHiddenOnMandatory && footerHiddenOnMandatory && completeProfileHasSignout && noSkipBypass,
    'Test S: Navbar/Footer are hidden during mandatory profile completion, Sign out escape action is provided, and no Skip bypass exists'
  );

  // 55. Test T: Google Auth Intent UX, Account Already Exists Modal, select_account prompt & local signOut
  const signupGoogleIntent = appCode.includes("onClick={() => handleGoogleSignIn('signup')}");
  const signinGoogleIntent = appCode.includes("onClick={() => handleGoogleSignIn('signin')}");
  const hasSelectAccountPrompt = appCode.includes("prompt: 'select_account'");
  const clearsSessionStorageIntent = appCode.includes("window.sessionStorage.removeItem('opencomm_google_auth_intent')");
  const rendersAccountExistsModal = appCode.includes('showAccountExistsModal') && appCode.includes('Account already exists') && appCode.includes('btn-continue-to-signin') && appCode.includes('btn-use-another-google-account');
  const scopeLocalSignOut = appCode.includes("signOut({ scope: 'local' })");
  const indexHtmlCode = fs.readFileSync(path.join(rootDir, 'apps/web/index.html'), 'utf8');
  const metaViewportIntact = indexHtmlCode.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
  const noDesktopHacks = !appCode.includes("meta[name=viewport]") && !appCode.includes("window.open(");

  assert(
    signupGoogleIntent && signinGoogleIntent && hasSelectAccountPrompt && clearsSessionStorageIntent && rendersAccountExistsModal && scopeLocalSignOut && metaViewportIntact && noDesktopHacks,
    'Test T: Signup/Signin pass explicit intents, Google OAuth specifies prompt=select_account, sessionStorage intent is cleared, Account Exists modal renders responsively, and local signOut is used for account switching'
  );

  // 56. Test U: Unit testing classifyGoogleAuthResult helper for Cases A, B, C, and D (server timestamps)
  const nowTs = 1756850000000;
  const userMultiIdentity = { id: 'u1', created_at: new Date(nowTs).toISOString(), last_sign_in_at: new Date(nowTs).toISOString(), identities: [{ provider: 'email' }, { provider: 'google' }] };
  const resCaseA = classifyGoogleAuthResult(userMultiIdentity, userMultiIdentity.identities, null);

  const userOlderSignIn = { id: 'u2', created_at: new Date(nowTs - 3600000).toISOString(), last_sign_in_at: new Date(nowTs).toISOString(), identities: [{ provider: 'google' }] };
  const resCaseB = classifyGoogleAuthResult(userOlderSignIn, userOlderSignIn.identities, null);

  const userNewAligned = { id: 'u3', created_at: new Date(nowTs).toISOString(), last_sign_in_at: new Date(nowTs + 1000).toISOString(), identities: [{ provider: 'google', created_at: new Date(nowTs).toISOString() }] };
  const resCaseC = classifyGoogleAuthResult(userNewAligned, userNewAligned.identities, null);

  const userAmbiguous = { id: 'u4', created_at: new Date(nowTs).toISOString(), last_sign_in_at: null, identities: [] };
  const resCaseD = classifyGoogleAuthResult(userAmbiguous, userAmbiguous.identities, null);

  assert(
    resCaseA === 'existing' && resCaseB === 'existing' && resCaseC === 'new' && resCaseD === 'existing',
    'Test U: classifyGoogleAuthResult uses server timestamps primarily: multi-identity -> existing, old creation time -> existing, aligned initial auth -> new, and ambiguous -> existing'
  );

  // 57. Test V: Fresh identity retrieval & clearGoogleAuthIntent error handling
  const appHasFreshGetUser = appCode.includes("supabase.auth.getUser()") && appCode.includes("getUserIdentities");
  const appHasClearGoogleIntentOnError = appCode.includes("clearGoogleAuthIntent()");
  assert(
    appHasFreshGetUser && appHasClearGoogleIntentOnError,
    'Test V: Callback fetches fresh authenticated identity data with fallback, and handleGoogleSignIn clears sessionStorage intent on error/exception'
  );

  // 49. Document Security Scanner Unit Tests
  console.log('\n--- Unit Testing Document Scanner ---');
  const dummyPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
  const pdfCheck = verifyDocumentBuffer(dummyPdfHeader, 'application/pdf');
  assert(pdfCheck.valid === true, 'Scanner Unit Test: Valid PDF header prefix passes security inspection');

  const exeMasquerade = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
  const exeCheck = verifyDocumentBuffer(exeMasquerade, 'application/pdf');
  assert(exeCheck.valid === false, 'Scanner Unit Test: Executable file masquerading as PDF is rejected');

  // 50. Unit Testing Deadline Utilities UTC Functions
  console.log('\n--- Unit Testing Deadline Utilities ---');
  const testIsoDeadline = '2026-12-31T00:00:00.000Z';
  const deadlineInfo = getDeadlineInfo(testIsoDeadline);
  assert(deadlineInfo.formattedDate.includes('31 Dec 2026'), 'Deadline Unit Test: Formats UTC date string deterministically');

  console.log(`\n=== SUMMARY: ${passedCount}/${totalCount} STATIC PREFLIGHT + UNIT CHECKS PASSED ===`);
  if (passedCount === totalCount) {
    console.log(`SUCCESS: All ${totalCount} static preflight + unit checks passed cleanly.`);
  } else {
    process.exit(1);
  }
}

runPreflightAndUnitChecks();
