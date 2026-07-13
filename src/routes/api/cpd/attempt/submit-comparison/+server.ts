import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { trackAttendancePing } from '$lib/server/cpd_attendance';
import { CpdGovernor } from '$lib/server/cpd_governor';
import type { CPDAttempt } from '$lib/types/cpd';

export const POST = async ({ request, locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const reqBody = await request.json();
  const { attemptId, user_comparison } = reqBody;
  if (!attemptId || !user_comparison) throw error(400, 'Missing attemptId or user_comparison payload');

  const attemptRef = adminDb.collection('cpd_attempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw error(404, 'Attempt not found');

  const attempt = attemptSnap.data() as CPDAttempt;
  if (attempt.user_id !== userId) throw error(403, 'Forbidden');

  const caseSnap = await adminDb.collection('cpd_cases').doc(attempt.case_id).get();
  const caseData = caseSnap.data() || {};
  const sessionType: string = caseData.session_type || 'IMAGING';

  const comparisonPayload: any = {
    detected_seeded_errors: reqBody.detected_seeded_errors || []
  };

  if (sessionType === 'VT') {
    comparisonPayload.final_synthesized_report = user_comparison?.final_synthesized_report || '';
  }

  await trackAttendancePing(userId, attempt.case_id);

  if (attempt.current_step !== 'STEP_3_REVEAL') {
    throw error(400, 'Attempt is not in the comparison state');
  }

  await attemptRef.update({
    current_step: 'STEP_4_COMPARISON',
    user_comparison: comparisonPayload
  });

  await CpdGovernor.safeLog(adminDb, attempt.id, userId, attempt.case_id, attempt.attempt_version, 'CPD_EVENT:COMPARISON:CALIBRATED', {});

  return json({ success: true, next_step: 'STEP_4_COMPARISON' });
};
