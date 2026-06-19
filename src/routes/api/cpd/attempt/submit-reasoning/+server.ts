import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { trackAttendancePing } from '$lib/server/cpd_attendance';
import type { CPDAttempt } from '$lib/types/cpd';

export const POST = async ({ request, locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const { attemptId, user_reasoning } = await request.json();
  if (!attemptId || !user_reasoning) throw error(400, 'Missing payload');

  const attemptRef = adminDb.collection('cpd_attempts').doc(attemptId);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) throw error(404, 'Attempt not found');

  const attempt = attemptSnap.data() as CPDAttempt;
  if (attempt.user_id !== userId) throw error(403, 'Forbidden');

  // Track attendance ping
  await trackAttendancePing(userId, attempt.case_id);

  // STATE GUARD: Enforce linear progression
  if (attempt.current_step !== 'STEP_1_INTAKE') {
    throw error(400, `Invalid state transition from ${attempt.current_step}`);
  }

  // Validate minimum completeness
  if (!user_reasoning.quality_assessment_notes || !user_reasoning.abnormalities_identified) {
    throw error(400, 'Reasoning inputs are incomplete');
  }

  // Update step and save human notes
  await attemptRef.update({
    current_step: 'STEP_2_REASONING',
    user_reasoning: user_reasoning
  });

  return json({ success: true, next_step: 'STEP_2_REASONING' });
};
