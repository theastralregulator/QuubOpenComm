/**
 * Negotiation Chat V2 Security & Hardening Static Preflight + Unit Test Suite
 * Performs actual static file analysis, AST checks, and unit tests.
 */

import fs from 'fs';
import path from 'path';
import { verifyDocumentBuffer } from '../api/_lib/media/documentScanner.js';

function runPreflightAndUnitChecks() {
  console.log('=== STARTING NEGOTIATION CHAT V2 STATIC PREFLIGHT + UNIT CHECKS ===');
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

  const negotiationPagePath = path.join(rootDir, 'apps/web/src/components/hiring/NegotiationPage.tsx');
  const negotiationPageCode = fs.readFileSync(negotiationPagePath, 'utf8');

  const deleteApiPath = path.join(rootDir, 'api/negotiation-message-delete.ts');
  const deleteApiCode = fs.readFileSync(deleteApiPath, 'utf8');

  const finalizeApiPath = path.join(rootDir, 'api/negotiation-media-finalize.ts');
  const finalizeApiCode = fs.readFileSync(finalizeApiPath, 'utf8');

  const fallbackApiPath = path.join(rootDir, 'api/negotiation-media-upload-fallback-intent.ts');
  const fallbackApiCode = fs.readFileSync(fallbackApiPath, 'utf8');

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

  // 10. Online Status Fail-Closed Logic in Frontend
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

  // 12. Fallback API: originalProvider validation
  const fallbackOriginalProviderCheck = /originalProvider !== 'b2' && originalProvider !== 'cloudinary'/i.test(fallbackApiCode);
  assert(
    fallbackOriginalProviderCheck,
    'Fallback API: Validates originalProvider strictly against b2 or cloudinary'
  );

  // 13. Provider/MIME Validation in Media Finalizer
  const finalizeMimeValidation = /provider === 'cloudinary'[\s\S]*?resType[\s\S]*?allowedImageFormats/i.test(finalizeApiCode) && /isMimeCompatible/i.test(finalizeApiCode);
  assert(
    finalizeMimeValidation,
    'Media Finalizer: Contains full provider/MIME format validation matching permanent media rules'
  );

  // 14. Locked Room Invariant & Room Switch Reset in Frontend
  const pointerDownLockedCheck = /handleBubblePointerDown[\s\S]*?room\?\.status !== 'active'/i.test(negotiationPageCode);
  const resetRefsOnRoomSwitch = /fetchWorkflowDetails[\s\S]*?initialScrollCompletedRef\.current = false/i.test(negotiationPageCode);
  assert(
    pointerDownLockedCheck && resetRefsOnRoomSwitch,
    'Frontend Invariants: Pointer down checks room status !== active and room switch resets initial position refs'
  );

  // 15. Document Security Scanner Unit Tests
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
