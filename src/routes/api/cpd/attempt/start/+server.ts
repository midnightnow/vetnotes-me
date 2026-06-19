import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { trackAttendancePing } from '$lib/server/cpd_attendance';
import type { CPDAttempt } from '$lib/types/cpd';

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

  return json({ attempt: newAttempt });
};
