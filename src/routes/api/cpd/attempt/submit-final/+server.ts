import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import { markCaseCompleted } from '$lib/server/cpd_attendance';
import { hasCpdEntitlement } from '$lib/server/cpd_entitlement';
import { issueCertificate } from '$lib/server/cpd_certificate';
import { CpdGovernor } from '$lib/server/cpd_governor';
import {
  evaluateQuality,
  evaluateStructuredInterpretation,
  evaluatePatternRecognition,
  evaluateClinicalDecision,
  evaluateErrorDetection
} from '$lib/server/cpd_scoring';
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

    // Per-case gold differential keywords come from THIS case's secure reveal doc.
    // Fall back to the global spec only if a case hasn't declared its own (legacy
    // single-case behaviour). A case with no keywords scores COMP_3 as pass (the
    // differential isn't the graded competency for that case — e.g. VT modules).
    const goldKeywords: string[] =
      (secureData as any).gold_differential_keywords ||
      CPD_SCORING_SPEC.COMP_3.gold_differential_keywords ||
      [];
    const comp3 = sessionType === 'VT' || goldKeywords.length === 0
      ? 1.0
      : evaluatePatternRecognition(differential, goldKeywords);

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

    return { competency_scores: comp_scores, passed: isPass, attempt };
  });

  // Certificate issuance happens OUTSIDE the scoring transaction.
  // Learning and scoring are free for everyone; the verifiable CPD
  // certificate ("earn the hours") is gated on entitlement — pay to certify.
  const gradedAttempt = result.attempt as CPDAttempt;
  await CpdGovernor.safeLog(adminDb, gradedAttempt.id, userId, gradedAttempt.case_id, gradedAttempt.attempt_version, 'CPD_EVENT:ASSESSMENT:COMPLETED', {
    passed: result.passed,
    competency_scores: result.competency_scores
  });

  let certificate = null;
  let paywall = null;
  if (result.passed) {
    if (await hasCpdEntitlement(userId)) {
      certificate = await issueCertificate(userId, gradedAttempt);
      await CpdGovernor.safeLog(adminDb, gradedAttempt.id, userId, gradedAttempt.case_id, gradedAttempt.attempt_version, 'CPD_EVENT:CREDENTIAL:ISSUED', {
        certificate_id: certificate?.id
      });
    } else {
      paywall = { required: true, reason: 'certificate', checkout_path: '/api/cpd/checkout' };
    }
  }

  return json({
    success: true,
    competency_scores: result.competency_scores,
    passed: result.passed,
    certificate,
    paywall
  });
};

// Scoring helpers now live in `$lib/server/cpd_scoring` — pure, unit-tested, and
// auditable, because they decide whether a CPD credential is issued.

