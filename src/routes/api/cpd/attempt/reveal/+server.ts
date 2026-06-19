import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { trackAttendancePing } from '$lib/server/cpd_attendance';
import type { CPDAttempt } from '$lib/types/cpd';

const MINIMUM_TIME_BEFORE_REVEAL_SECONDS = 120; // 2 minutes for IMAGING sessions

export const POST = async ({ request, locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const { attemptId } = await request.json();
  if (!attemptId) throw error(400, 'Missing attemptId');

  const attemptRef = adminDb.collection('cpd_attempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw error(404, 'Attempt not found');

  const attempt = attemptSnap.data() as CPDAttempt;
  if (attempt.user_id !== userId) throw error(403, 'Forbidden');

  await trackAttendancePing(userId, attempt.case_id);

  if (attempt.current_step !== 'STEP_2_REASONING') {
    throw error(400, 'You must submit your reasoning before revealing the AI report');
  }

  const caseSnap = await adminDb.collection('cpd_cases').doc(attempt.case_id).get();
  const caseData = caseSnap.data() || {};
  const sessionType: string = caseData.session_type || 'IMAGING';

  if (sessionType === 'IMAGING') {
    const startTime = new Date(attempt.started_at).getTime();
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    if (elapsedSeconds < MINIMUM_TIME_BEFORE_REVEAL_SECONDS) {
      throw error(400, 'Please spend more time analyzing the radiographic views before revealing the AI assistant.');
    }
  }

  const secureDataSnap = await adminDb
    .collection('cpd_cases')
    .doc(attempt.case_id)
    .collection('private')
    .doc('reveal')
    .get();

  if (!secureDataSnap.exists) {
    throw error(500, 'Secure case data is missing or corrupted');
  }

  const secureData = secureDataSnap.data() || {};
  const aiRevealedAt = new Date().toISOString();
  await attemptRef.update({
    current_step: 'STEP_3_REVEAL',
    ai_revealed_at: aiRevealedAt
  });

  if (sessionType === 'VT') {
    return json({
      session_type: 'VT',
      insight_text: secureData.insight_text || secureData.ai_report_raw || '',
      reference_document_url: secureData.reference_document_url || null,
      seeded_errors: []
    });
  }

  return json({
    session_type: 'IMAGING',
    ai_report_raw: secureData?.ai_report_raw,
    seeded_errors: (secureData?.seeded_errors || []).map((err: any) => ({
      id: err.id,
      anatomical_zone: err.anatomical_zone,
      ai_claim: err.ai_claim
    }))
  });
};
