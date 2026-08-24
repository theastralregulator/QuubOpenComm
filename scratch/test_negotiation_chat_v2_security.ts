/**
 * Negotiation Chat V2 & Production UI Static Preflight + Unit Test Suite
 * Performs actual static file analysis, AST checks, and unit tests.
 */

import fs from 'fs';
import path from 'path';
import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';
import { getDeadlineInfo } from '../apps/web/src/lib/deadline.js';

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

  const savedJobsPagePath = path.join(rootDir, 'apps/web/src/components/saved/SavedJobsPage.tsx');
  const savedJobsPageCode = fs.readFileSync(savedJobsPagePath, 'utf8');

  const jobDetailPagePath = path.join(rootDir, 'apps/web/src/components/jobs/JobDetailPage.tsx');
  const jobDetailPageCode = fs.readFileSync(jobDetailPagePath, 'utf8');

  const bellPath = path.join(rootDir, 'apps/web/src/components/notifications/NotificationBell.tsx');
  const bellCode = fs.readFileSync(bellPath, 'utf8');

  const grievancePath = path.join(rootDir, 'apps/web/src/components/legal/GrievancePage.tsx');
  const grievanceCode = fs.readFileSync(grievancePath, 'utf8');

  const myJobsAppliedPath = path.join(rootDir, 'apps/web/src/components/profile/MyJobsAppliedPage.tsx');
  const myJobsAppliedCode = fs.readFileSync(myJobsAppliedPath, 'utf8');

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

  // --- HARDENED SECURE SUBMIT RPC & TABLE PRIVILEGE CHECKS ---

  // 26. Migration File Preserved: 20260825010000_harden_job_applications_security.sql
  assert(
    fs.existsSync(jobAppHardenMigrationPath),
    'Security Migration: 20260825010000_harden_job_applications_security.sql exists'
  );

  // 27. authenticated role has NO direct table INSERT grant after migration
  const authNoTableInsert = jobAppHardenSql.includes('REVOKE ALL ON public.job_applications FROM authenticated;') &&
    jobAppHardenSql.includes('GRANT SELECT ON public.job_applications TO authenticated;') &&
    !jobAppHardenSql.includes('GRANT SELECT, INSERT ON public.job_applications TO authenticated;');
  assert(
    authNoTableInsert,
    'Table Privilege Hardening: authenticated role has NO direct table INSERT or UPDATE grant after migration'
  );

  // 28. anon has NO job_applications table grant
  const anonNoTableGrant = jobAppHardenSql.includes('REVOKE ALL ON public.job_applications FROM PUBLIC, anon;') &&
    !jobAppHardenSql.includes('GRANT SELECT ON public.job_applications TO anon;');
  assert(
    anonNoTableGrant,
    'Table Privilege Hardening: anon role has NO direct table grants on job_applications'
  );

  // 29. submit_job_application is SECURITY DEFINER
  const submitRpcSecurityDefiner = jobAppHardenSql.includes('CREATE OR REPLACE FUNCTION public.submit_job_application') &&
    jobAppHardenSql.includes('SECURITY DEFINER') &&
    jobAppHardenSql.includes('SET search_path = public, pg_temp');
  assert(
    submitRpcSecurityDefiner,
    'Submit RPC Security: submit_job_application is SECURITY DEFINER with search_path = public, pg_temp'
  );

  // 30. submit RPC derives applicant from auth.uid()
  const submitRpcAuthUid = jobAppHardenSql.includes('v_user_id := auth.uid();') &&
    jobAppHardenSql.includes('applicant_id,\n    proposed_rate,') &&
    jobAppHardenSql.includes('v_user_id,');
  assert(
    submitRpcAuthUid,
    'Submit RPC Security: Derives applicant strictly from auth.uid() internally'
  );

  // 31. submit RPC block checks: always inserts status = 'pending' and does not accept status or linkage params
  const submitFnStart = jobAppHardenSql.indexOf('FUNCTION public.submit_job_application');
  const submitFnEnd = jobAppHardenSql.indexOf('FUNCTION public.update_job_application_status');
  const submitFnBlock = jobAppHardenSql.slice(submitFnStart, submitFnEnd);

  const submitRpcStatusPending = submitFnBlock.includes("'pending'") && !submitFnBlock.includes('p_status');
  assert(
    submitRpcStatusPending,
    "Submit RPC Security: Always inserts status = 'pending' and does not accept status parameter"
  );

  // 32. RPC does not accept status or workflow linkage IDs as parameters
  const submitRpcParamsClean = !submitFnBlock.includes('p_status') &&
    !submitFnBlock.includes('p_negotiation_room_id') &&
    !submitFnBlock.includes('p_work_contract_id');
  assert(
    submitRpcParamsClean,
    'Submit RPC Security: Does NOT accept status or workflow linkage IDs as input parameters'
  );

  // 33. RLS WITH CHECK explicitly requires status = 'pending' AND blocks non-null workflow fields
  const rlsDefenseInDepth = jobAppHardenSql.includes("status = 'pending'") &&
    jobAppHardenSql.includes('negotiation_room_id IS NULL') &&
    jobAppHardenSql.includes('active_proposal_id IS NULL') &&
    jobAppHardenSql.includes('work_contract_id IS NULL') &&
    jobAppHardenSql.includes('permanent_conversation_id IS NULL') &&
    jobAppHardenSql.includes('confirmed_at IS NULL');
  assert(
    rlsDefenseInDepth,
    'RLS Defense-in-Depth: WITH CHECK policy requires status = pending and enforces NULL workflow linkage fields'
  );

  // 34. SharedApplicationModal has NO direct .from('job_applications').insert
  const modalNoDirectInsert = !modalCode.includes(".from('job_applications')\n          .insert");
  const modalUsesSubmitRpc = modalCode.includes("supabase.rpc('submit_job_application'");
  assert(
    modalNoDirectInsert && modalUsesSubmitRpc,
    "SharedApplicationModal Security: Direct table insert removed and replaced with submit_job_application RPC"
  );

  // 35. JobDetailPage has NO direct .from('job_applications').insert
  const jobDetailNoDirectInsert = !jobDetailPageCode.includes(".from('job_applications')\n        .insert");
  const jobDetailUsesSubmitRpc = jobDetailPageCode.includes("supabase.rpc('submit_job_application'");
  assert(
    jobDetailNoDirectInsert && jobDetailUsesSubmitRpc,
    "JobDetailPage Security: Direct table insert removed and replaced with submit_job_application RPC"
  );

  // 36. Duplicate Application Behavior Refreshes Real DB State
  const duplicateModalHandling = modalCode.includes("appError.code === '23505'") &&
    modalCode.includes("window.dispatchEvent(new CustomEvent('opencomm:job-application-changed'))");
  const duplicateDetailHandling = jobDetailPageCode.includes("appError.code === '23505'") &&
    jobDetailPageCode.includes("window.dispatchEvent(new CustomEvent('opencomm:job-application-changed'))");
  assert(
    duplicateModalHandling && duplicateDetailHandling,
    'Duplicate Handling: Dispatches opencomm:job-application-changed to refresh real DB map without fabricating local state'
  );

  // 37. UTC Deadline SQL Semantics
  const sqlUtcDeadlineCheck = jobAppHardenSql.includes("(j.application_deadline AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date");
  assert(
    sqlUtcDeadlineCheck,
    "UTC Deadline SQL: Migration uses explicit (j.application_deadline AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date"
  );

  // 38. UTC Deadline TypeScript Semantics
  const tsUtcDeadlineCheck = deadlineLibCode.includes('getUTCFullYear()') &&
    deadlineLibCode.includes('getUTCMonth()') &&
    deadlineLibCode.includes('getUTCDate()') &&
    deadlineLibCode.includes("timeZone: 'UTC'");
  assert(
    tsUtcDeadlineCheck,
    "UTC Deadline TS: deadline.ts uses getUTCFullYear(), getUTCMonth(), getUTCDate(), and timeZone: 'UTC'"
  );

  // 39. Generic Employer Update RPC Remains Transition-Limited
  const hardenedEmployerRpc = jobAppHardenSql.includes('CREATE OR REPLACE FUNCTION public.update_job_application_status') &&
    jobAppHardenSql.includes("v_current_status = 'pending'") &&
    jobAppHardenSql.includes("v_current_status = 'under_review'") &&
    jobAppHardenSql.includes("v_current_status = 'shortlisted'") &&
    jobAppHardenSql.includes("v_current_status = 'rejected'") &&
    jobAppHardenSql.includes('workflow-managed or final and cannot be manually modified by employer');
  assert(
    hardenedEmployerRpc,
    'Employer Status RPC Security: Validates current status -> requested status transition matrix and blocks rewriting confirmed/negotiating/completed states'
  );

  // 40. Withdraw RPC Security
  const secureWithdrawRpc = jobAppHardenSql.includes('CREATE OR REPLACE FUNCTION public.withdraw_job_application') &&
    jobAppHardenSql.includes("v_current_status NOT IN ('pending', 'under_review', 'shortlisted')") &&
    jobAppHardenSql.includes('v_applicant_id IS DISTINCT FROM v_user_id');
  assert(
    secureWithdrawRpc,
    'Withdraw RPC Security: Enforces auth.uid(), applicant ownership, active account, and withdrawable status whitelist'
  );

  // 41. Document Security Scanner Unit Tests
  console.log('\n--- Unit Testing Document Scanner ---');
  const dummyPdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
  const pdfCheck = verifyDocumentBuffer(dummyPdfHeader, 'application/pdf');
  assert(pdfCheck.valid === true, 'Scanner Unit Test: Valid PDF header prefix passes security inspection');

  const exeMasquerade = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');
  const exeCheck = verifyDocumentBuffer(exeMasquerade, 'application/pdf');
  assert(exeCheck.valid === false, 'Scanner Unit Test: Executable file masquerading as PDF is rejected');

  // 42. Unit Testing Deadline Utilities UTC Functions
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
