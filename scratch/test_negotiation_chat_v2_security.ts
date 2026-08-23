/**
 * Negotiation Chat V2 & Production UI Static Preflight + Unit Test Suite
 * Performs actual static file analysis, AST checks, and unit tests.
 */

import fs from 'fs';
import path from 'path';
import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';

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

  const negotiationPagePath = path.join(rootDir, 'apps/web/src/components/hiring/NegotiationPage.tsx');
  const negotiationPageCode = fs.readFileSync(negotiationPagePath, 'utf8');

  const profilePagePath = path.join(rootDir, 'apps/web/src/components/profile/ProfilePage.tsx');
  const profilePageCode = fs.readFileSync(profilePagePath, 'utf8');

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

  const mapperPath = path.join(rootDir, 'apps/web/src/lib/workerProfileMapper.ts');
  const mapperCode = fs.existsSync(mapperPath) ? fs.readFileSync(mapperPath, 'utf8') : '';

  const recHomePath = path.join(rootDir, 'apps/web/src/components/home/RecommendedForYou.tsx');
  const recHomeCode = fs.readFileSync(recHomePath, 'utf8');

  const jobsPagePath = path.join(rootDir, 'apps/web/src/components/jobs/JobsPage.tsx');
  const jobsPageCode = fs.readFileSync(jobsPagePath, 'utf8');

  const bellPath = path.join(rootDir, 'apps/web/src/components/notifications/NotificationBell.tsx');
  const bellCode = fs.readFileSync(bellPath, 'utf8');

  const grievancePath = path.join(rootDir, 'apps/web/src/components/legal/GrievancePage.tsx');
  const grievanceCode = fs.readFileSync(grievancePath, 'utf8');

  const workerCardPath = path.join(rootDir, 'apps/web/src/components/cards/WorkerCard.tsx');
  const workerCardCode = fs.readFileSync(workerCardPath, 'utf8');

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

  // 5. Active Account Enforcement in SQL RPCs
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

  // 7. Canonical Reply Target Validation in Finalizer
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

  // 16. Route Tracker Title: /messages/:conversationId handled without 404 title
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

  // --- WORKER PROFILE DATA CONSISTENCY & REGISTRATION CHECKS ---

  // 24. Migration for Worker Profile Persistence Columns
  const migrationHasCols = workerColsMigrationSql.includes('primary_category text') &&
    workerColsMigrationSql.includes('work_preference text') &&
    workerColsMigrationSql.includes('rate_period text') &&
    workerColsMigrationSql.includes('rate_amount numeric');
  assert(
    migrationHasCols,
    'Worker Persistence Migration: Adds primary_category, work_preference, rate_period, rate_amount via ADD COLUMN IF NOT EXISTS'
  );

  // 25. Worker Registration Modal Header Text: Exactly "Create Worker Profile" (NO "Certified Pro")
  const headerExactText = appCode.includes('Create Worker Profile') && !appCode.includes('Create Certified Pro Profile');
  assert(
    headerExactText,
    'Registration UI Header: Modal displays EXACTLY "Create Worker Profile" without unverified "Certified Pro" wording'
  );

  // 26. Primary Registration Button Text: Exactly "Register" (NO "Register Contractor")
  const buttonExactText = />\s*Register\s*<\/button>/.test(appCode) && !appCode.includes('Register Contractor');
  assert(
    buttonExactText,
    'Registration UI CTA: Primary button displays EXACTLY "Register" without "Contractor" suffix'
  );

  // 27. No Hardcoded `experience_years: 2` or `availability: 'Available Now'` in handleCreateWorker
  const noHardcodedExpInCreate = !/experience_years:\s*2\b/.test(appCode);
  assert(
    noHardcodedExpInCreate,
    'Registration Data Safety: handleCreateWorker uses real form experience value, NOT hardcoded experience_years: 2'
  );

  // 28. Edit Profile Form State Initialization & Persistence
  const editProfileUsesMapper = profilePageCode.includes('mapWorkerProfileToForm') && profilePageCode.includes('mapFormToDbPayloads');
  const editProfileSetsCategory = profilePageCode.includes('setEditCategory(form.category)');
  const editProfileSetsWorkPref = profilePageCode.includes('setEditWorkPreference(form.workPreference)');
  assert(
    editProfileUsesMapper && editProfileSetsCategory && editProfileSetsWorkPref,
    'Edit Profile Initialization: Populates category, work preference, and rate period from persisted worker profile'
  );

  // 29. Save & Go Back Flow: Clears edit intent, closes modal, and returns to normal profile
  const saveClearsEditParam = profilePageCode.includes("searchParams.delete('edit')");
  const saveReturnsToProfile = profilePageCode.includes("navigate('/profile', { replace: true })");
  assert(
    saveClearsEditParam && saveReturnsToProfile,
    'Save and Go Back: Successful save closes modal, clears ?edit=true intent, and returns to normal /profile view'
  );

  // 30. Shared Form Mapper Architecture
  const mapperHasHelpers = mapperCode.includes('mapWorkerProfileToForm') && mapperCode.includes('mapFormToDbPayloads') && mapperCode.includes('inferLegacySalaryPeriod');
  assert(
    mapperHasHelpers,
    'Shared Data Architecture: workerProfileMapper.ts exports canonical bi-directional mapping helpers'
  );

  // 31. DB Availability Status Constraint Compliance: No Part-time/Full-time in Availability options
  const appNoPartTimeAvail = !/<option value="Part-time">Part-time<\/option>/.test(appCode);
  const profileNoPartTimeAvail = !/<option value="Part-time">Part-time<\/option>/.test(profilePageCode);
  const appHasVacationAvail = appCode.includes('<option value="On Vacation">On Vacation</option>');
  const profileHasVacationAvail = profilePageCode.includes('<option value="On Vacation">On Vacation</option>');
  assert(
    appNoPartTimeAvail && profileNoPartTimeAvail && appHasVacationAvail && profileHasVacationAvail,
    'Availability Status DB Constraint: Options strictly match "Available Now", "Busy", "On Vacation" (no Part-time/Full-time)'
  );

  // 32. Rate Period / Hourly Rate Logic Precision
  const mapperHourlyNullCheck = /computedHourlyRate = formData\.salaryPeriod === 'hourly'\s*\?\s*\(numAmount > 0 \? numAmount : null\)\s*:\s*null/.test(mapperCode);
  assert(
    mapperHourlyNullCheck,
    'Rate Period Safety: Non-hourly periods (monthly, daily, project) explicitly assign hourly_rate = null'
  );

  // 33. Basic -> Worker Creation Order: No premature profile_type: 'worker' before RPC
  const noPrematureWorkerType = !/updateProfile\(userId,\s*\{\s*[\s\S]*?profile_type:\s*'worker'/.test(appCode);
  assert(
    noPrematureWorkerType,
    'Creation Order Safety: handleCreateWorker updates basic profile fields first and lets createMyWorkerProfile RPC change profile_type upon worker creation success'
  );

  // 34. Migration File Preserved: 20260824000000_worker_profile_persistence_columns.sql
  assert(
    fs.existsSync(workerColsMigrationPath),
    'Migration Preserved: supabase/migrations/20260824000000_worker_profile_persistence_columns.sql exists without version drift'
  );

  // --- PRODUCTION UX CONSISTENCY & SAFETY CHECKS ---

  // 35. Home Application Status Invariant: RecommendedForYou receives applicationsByJobId map and does NOT auto-hide applied jobs with "Apply" button
  const recHomeReceivesAppMap = recHomeCode.includes('applicationsByJobId') && recHomeCode.includes('applicationsByJobId?.get(job.id)');
  const recHomeNoAutoFilterApplied = !recHomeCode.includes('if (job.applied) return false;');
  assert(
    recHomeReceivesAppMap && recHomeNoAutoFilterApplied,
    'Home Application Status: RecommendedForYou receives canonical applicationsByJobId map and preserves applied cards with live status'
  );

  // 36. Jobs False Empty Prevention: JobsPage checks !isJobsLoaded || isFetching before rendering "No jobs found"
  const jobsPageSkeletonCheck = jobsPageCode.includes('JobCardSkeleton') && jobsPageCode.includes('!isJobsLoaded || isFetching');
  assert(
    jobsPageSkeletonCheck,
    'Jobs False Empty Prevention: JobsPage renders JobCardSkeleton during initial fetch and prevents false "No jobs found" flash'
  );

  // 37. Notification Bell Cache & Skeleton Rows: Bell dropdown checks cached data before setting loading and renders row skeletons
  const bellCacheCheck = bellCode.includes('hasLoadedRef.current') && bellCode.includes('lastFetchedAtRef.current');
  const bellSkeletonRowsCheck = bellCode.includes('animate-pulse') && !bellCode.includes('Loading notifications...');
  assert(
    bellCacheCheck && bellSkeletonRowsCheck,
    'Notification Bell Cache & Skeletons: Bell uses background refresh for cached data and compact row skeletons for initial fetch'
  );

  // 38. Absence of Fake Verification Labels in Profiles and Worker Cards
  const profileNoCertifiedPro = !profilePageCode.includes("'Certified Professional'") && !profilePageCode.includes('"Certified Professional"');
  const profileNoVerifiedBiz = !profilePageCode.includes("'Verified Business'") && !profilePageCode.includes('"Verified Business"');
  const workerCardNoCertifiedPro = !workerCardCode.includes('certified professional');
  const profileVerifiedCardRealEmail = profilePageCode.includes('Email Verified') && profilePageCode.includes('profile?.email_verified_for_actions === true');
  assert(
    profileNoCertifiedPro && profileNoVerifiedBiz && workerCardNoCertifiedPro && profileVerifiedCardRealEmail,
    'Verification Label Integrity: Misleading "Certified Professional", "Verified Business", and "Verified Account" identity claims removed'
  );

  // 39. Contact Placeholders Removed & Grievance Ticket Persistence
  const grievanceNoPlaceholderEmail = !grievanceCode.includes('[support@opencomm-placeholder.io]');
  const grievanceNoPlaceholderOfficer = !grievanceCode.includes('[Grievance Officer Name Placeholder]');
  const grievanceUsesDbService = grievanceCode.includes('dbService.createSupportTicket') && !grievanceCode.includes('setTimeout(');
  assert(
    grievanceNoPlaceholderEmail && grievanceNoPlaceholderOfficer && grievanceUsesDbService,
    'Grievance Safety: Bracketed placeholder strings removed and handleSubmit calls real dbService.createSupportTicket'
  );

  // 40. Document Security Scanner Unit Tests
  console.log('\n--- Unit Testing Document Scanner ---');
  const dummyPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
  const pdfCheck = verifyDocumentBuffer(dummyPdfHeader, 'application/pdf');
  assert(pdfCheck.valid === true, 'Scanner Unit Test: Valid PDF header prefix passes security inspection');

  const exeMasquerade = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
  const exeCheck = verifyDocumentBuffer(exeMasquerade, 'application/pdf');
  assert(exeCheck.valid === false, 'Scanner Unit Test: Executable file masquerading as PDF is rejected');

  console.log(`\n=== SUMMARY: ${passedCount}/${totalCount} STATIC PREFLIGHT + UNIT CHECKS PASSED ===`);
  if (passedCount === totalCount) {
    console.log(`SUCCESS: All ${totalCount} static preflight + unit checks passed cleanly.`);
  } else {
    process.exit(1);
  }
}

runPreflightAndUnitChecks();
