import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { trackAttendancePing } from '$lib/server/cpd_attendance';
import { CpdGovernor } from '$lib/server/cpd_governor';
import type { CPDAttempt } from '$lib/types/cpd';

// Integrity guard: CPD is formative (learn-then-retry), but a paid competency
// record can't be brute-forced infinitely. Cap attempts and stop once passed.
const MAX_ATTEMPTS = 5;

export const POST = async ({ request, locals }: any) => {
  // Ensure user is authenticated
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const { caseId } = await request.json();
  if (!caseId) throw error(400, 'Missing caseId');

  // Track attendance ping (non-blocking if possible, but we'll await for reliability in MVP)
  await trackAttendancePing(userId, caseId);

  const attemptsRef = adminDb.collection('cpd_attempts');
  const casesRef = adminDb.collection('cpd_cases');

  // Verify case exists
  const caseDoc = await casesRef.doc(caseId).get();
  if (!caseDoc.exists) throw error(404, 'Case not found');

  // 1. Calculate attempt_version by querying existing user attempts
  const existingAttemptsQuery = await attemptsRef
    .where('user_id', '==', userId)
    .where('case_id', '==', caseId)
    .orderBy('attempt_version', 'desc')
    .limit(1)
    .get();

  let nextVersion = 1;
  if (!existingAttemptsQuery.empty) {
    const latestAttempt = existingAttemptsQuery.docs[0].data() as CPDAttempt;
    nextVersion = latestAttempt.attempt_version + 1;

    // Pass-block: if a prior attempt already passed, no further attempts (index-free —
    // score ids are deterministic). Prevents re-farming a passed competency.
    const priorScore = await adminDb
      .collection('cpd_scores')
      .doc(`score_${latestAttempt.id}`)
      .get();
    if (priorScore.exists && priorScore.data()?.is_overall_pass === true) {
      throw error(409, 'You have already passed this case. No further attempts are needed.');
    }

    // Cap total attempts.
    if (nextVersion > MAX_ATTEMPTS) {
      throw error(429, `Maximum attempts (${MAX_ATTEMPTS}) reached for this case.`);
    }
  }

  // 2. Initialize CPDAttempt
  const attemptId = `att_${userId}_${caseId}_v${nextVersion}`;
  const newAttempt: CPDAttempt = {
    id: attemptId,
    user_id: userId,
    case_id: caseId,
    attempt_version: nextVersion,
    current_step: 'STEP_1_INTAKE',
    started_at: new Date().toISOString()
  };

  await attemptsRef.doc(attemptId).set(newAttempt);

  // Tamper-evident audit ledger (non-blocking).
  await CpdGovernor.safeLog(adminDb, attemptId, userId, caseId, nextVersion, 'CPD_EVENT:ATTEMPT:STARTED', {
    started_at: newAttempt.started_at
  });

  return json({ attempt: newAttempt });
};
