import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { markCaseCompleted } from '$lib/server/cpd_attendance';
import { CPD_SCORING_SPEC, SCHEMA_VERSION } from '$lib/types/cpd_scoring_spec';
import type { CPDAttempt, CPDSecureCaseData, CompetencyId } from '$lib/types/cpd';

export const POST = async ({ request, locals }: any) => {
  const userId = locals.user?.uid;
  if (!userId) throw error(401, 'Unauthorized');

  const reqBody = await request.json();
  const { attemptId, quiz_responses } = reqBody;
  if (!attemptId || !quiz_responses) {
    throw error(400, 'Missing attemptId or quiz_responses payload');
  }

  const attemptRef = adminDb.collection('cpd_attempts').doc(attemptId);
  const scoreId = `score_${attemptId}`;
  const scoreRef = adminDb.collection('cpd_scores').doc(scoreId);

  // Use a transaction for atomicity and idempotency
  const result = await adminDb.runTransaction(async (transaction) => {
    const attemptSnap = await transaction.get(attemptRef);
    if (!attemptSnap.exists) throw error(404, 'Attempt record not found');

    const attempt = attemptSnap.data() as CPDAttempt;
    if (attempt.user_id !== userId) throw error(403, 'Permission denied');

    // Mark case as completed in attendance record
    await markCaseCompleted(userId, attempt.case_id);

    // IDEMPOTENCY CHECK: Block duplicate submissions
    if (attempt.current_step === 'COMPLETED') {
      throw error(400, 'Duplicate submission: This attempt has already been graded.');
    }

    // STATE GUARD: Must be in STEP_4_COMPARISON to submit final quiz
    if (attempt.current_step !== 'STEP_4_COMPARISON') {
      throw error(400, `Invalid state transition from ${attempt.current_step}. Must be in STEP_4_COMPARISON.`);
    }

    // Verify score doesn't already exist (race condition guard)
    const scoreSnap = await transaction.get(scoreRef);
    if (scoreSnap.exists) {
      throw error(400, 'Duplicate evaluation: Scores have already been committed.');
    }

    // 1. Fetch Secure Case Keys (server-only access)
    const secureDataSnap = await transaction.get(
      adminDb.collection('cpd_cases').doc(attempt.case_id).collection('private').doc('reveal')
    );
    if (!secureDataSnap.exists) {
      throw error(500, 'Secure case data is missing or corrupted');
    }

    const secureData = secureDataSnap.data() as CPDSecureCaseData;

    const caseDoc = await transaction.get(adminDb.collection('cpd_cases').doc(attempt.case_id));
    const caseData = caseDoc.data() as any;
    const sessionType: string = caseData?.session_type || 'IMAGING';
    const differential = attempt.user_reasoning?.primary_differential;

    let comp3: number;
    if (sessionType === 'VT') {
      const keywords = CPD_SCORING_SPEC.COMP_3.gold_differential_keywords || [];
      comp3 = keywords.length > 0
        ? evaluatePatternRecognition(differential, keywords)
        : 1.0;
    } else {
      const keywords = CPD_SCORING_SPEC.COMP_3.gold_differential_keywords || [];
      comp3 = keywords.length > 0
        ? evaluatePatternRecognition(differential, keywords)
        : 1.0;
    }

    const seededErrors = secureData.seeded_errors || [];
    const detectedSeededErrors = attempt.user_comparison?.detected_seeded_errors || [];
    const comp5 = sessionType === 'VT'
      ? 1.0
      : evaluateErrorDetection(detectedSeededErrors, seededErrors);

    // 2. Compute Competency Scores
    const comp_scores: Record<CompetencyId, number> = {
      COMP_1: evaluateQuality(attempt.user_reasoning?.quality_assessment_notes),
      COMP_2: evaluateStructuredInterpretation(attempt.user_reasoning, CPD_SCORING_SPEC.COMP_2.required_fields),
      COMP_3: comp3,
      COMP_4: evaluateClinicalDecision(quiz_responses, secureData.quiz_answers),
      COMP_5: comp5
    };

    const isPass = Object.values(comp_scores).every(score => score >= 0.80);

    // 3. Write CPDScore (Server Authority)
    const scoreData = {
      id: scoreId,
      attempt_id: attemptId,
      user_id: userId,
      case_id: attempt.case_id,
      competency_scores: comp_scores,
      is_overall_pass: isPass,
      schema_version: SCHEMA_VERSION,
      calculated_at: new Date().toISOString()
    };

    transaction.set(scoreRef, scoreData);

    // 4. Update Attempt to COMPLETED
    transaction.update(attemptRef, {
      current_step: 'COMPLETED',
      quiz_responses: quiz_responses,
      completed_at: new Date().toISOString()
    });

    // 5. Generate Certificate if user passed
    let certData = null;
    if (isPass) {
      const userSnap = await transaction.get(adminDb.collection('users').doc(userId));
      const recipientName = userSnap.exists && userSnap.data()?.displayName
        ? userSnap.data()!.displayName
        : 'Veterinary Practitioner';

      const certId = `cert_${userId}_${attempt.case_id}_v${attempt.attempt_version}`;
      const caseDoc = await transaction.get(adminDb.collection('cpd_cases').doc(attempt.case_id));
      const caseData = caseDoc.data() as any;
      const moduleId = caseData?.module_id || 'mod_unknown';
      const providerName = caseData?.provider_name || 'VetNotes Academy';
      const providerCode = caseData?.provider_code || 'VN-2026-PRV';
      const activityCode = caseData?.activity_code || caseId;
      const hoursAwarded = caseData?.hours_awarded ?? 1.0;
      const verificationBase = caseData?.verification_url || 'https://vetnotes.app/verify';

      certData = {
        id: certId,
        user_id: userId,
        module_id: moduleId,
        recipient_name: recipientName,
        provider_name: providerName,
        provider_veted_code: providerCode,
        activity_veted_code: activityCode,
        hours_awarded: hoursAwarded,
        schema_version: SCHEMA_VERSION,
        issued_at: new Date().toISOString(),
        verification_url: `${verificationBase}/${certId}`
      };

      transaction.set(adminDb.collection('cpd_certificates').doc(certId), certData);
    }

    return { competency_scores: comp_scores, passed: isPass, certificate: certData };
  });

  return json({ success: true, ...result });
};

// ==========================================
// SCORING LOGIC HELPERS (Server Side Only)
// ==========================================

// TODO: Replace with rubric-based clinical evaluation model
// Current implementation is simplified heuristic logic (NOT accreditation-grade)
// Used for MVP validation only, not for external CPD submission accuracy
function evaluateQuality(notes?: string): number {
  if (!notes || notes.trim().length < 15) return 0.0;
  return 1.0;
}

// TODO: Replace with rubric-based clinical evaluation model
// Current implementation is simplified heuristic logic (NOT accreditation-grade)
// Used for MVP validation only, not for external CPD submission accuracy
function evaluateStructuredInterpretation(reasoning: any, requiredFields?: string[]): number {
  if (!reasoning || !reasoning.quality_assessment_notes || !reasoning.abnormalities_identified) return 0.0;
  return 1.0;
}

// TODO: Replace with rubric-based clinical evaluation model
// Current implementation is simplified heuristic logic (NOT accreditation-grade)
// Used for MVP validation only, not for external CPD submission accuracy
function evaluatePatternRecognition(differential?: string, keywords?: string[]): number {
  if (!differential || !keywords) return 0.0;
  const normalized = differential.toLowerCase();
  const matched = keywords.some(kw => normalized.includes(kw.toLowerCase()));
  return matched ? 1.0 : 0.0;
}

function evaluateClinicalDecision(userResponses: any[], secureAnswers: any[]): number {
  let correct = 0;
  userResponses.forEach((res: any) => {
    const key = secureAnswers.find((ans: any) => ans.question_id === res.question_id);
    if (key && key.correct_option_index === res.selected_option_index) {
      correct++;
    }
  });
  return secureAnswers.length > 0 ? correct / secureAnswers.length : 1.0;
}

function evaluateErrorDetection(userDetections: any[], secureSeededErrors: any[]): number {
  if (!userDetections || secureSeededErrors.length === 0) return 0.0;
  let detectedCount = 0;
  secureSeededErrors.forEach((seeded: any) => {
    const userAns = userDetections.find((det: any) => det.seeded_error_id === seeded.id);
    if (userAns && userAns.did_user_detect === true) {
      detectedCount++;
    }
  });
  return detectedCount / secureSeededErrors.length;
}
