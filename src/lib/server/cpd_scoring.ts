/**
 * CPD competency scoring — pure functions, no I/O.
 *
 * Extracted from `routes/api/cpd/attempt/submit-final/+server.ts` so the logic
 * behind a issued CPD credential is unit-testable and auditable. A regulator
 * auditing an hours claim is entitled to see how the mark was produced; logic
 * buried in a request handler that imports firebase-admin cannot be tested at all.
 *
 * ⚠️ HONESTY NOTE — retained deliberately from the original source:
 * COMP_1, COMP_2 and COMP_3 are simplified heuristics, NOT accreditation-grade
 * assessment. COMP_1 passes on 15 characters of free text; COMP_2 passes if two
 * fields are merely non-empty; COMP_3 passes on a single keyword substring match.
 * COMP_4 (the quiz) is the only competency that meaningfully tests knowledge.
 * Replacing these with a rubric-based model is tracked work — until then, the
 * rigour of the credential rests almost entirely on COMP_4, which is why the
 * duplicate-response defect fixed below mattered so much.
 */

/** COMP_1 — quality assessment notes. Heuristic: non-trivial free text. */
export function evaluateQuality(notes?: string): number {
	if (!notes || notes.trim().length < 15) return 0.0;
	return 1.0;
}

/** COMP_2 — structured interpretation. Heuristic: required fields present. */
export function evaluateStructuredInterpretation(reasoning: any, _requiredFields?: string[]): number {
	if (!reasoning || !reasoning.quality_assessment_notes || !reasoning.abnormalities_identified) return 0.0;
	return 1.0;
}

/** COMP_3 — pattern recognition. Heuristic: gold keyword substring match. */
export function evaluatePatternRecognition(differential?: string, keywords?: string[]): number {
	if (!differential || !keywords) return 0.0;
	const normalized = differential.toLowerCase();
	const matched = keywords.some((kw) => normalized.includes(kw.toLowerCase()));
	return matched ? 1.0 : 0.0;
}

/**
 * COMP_4 — clinical decision (the multiple-choice quiz). The only genuinely
 * graded competency, so its integrity carries the credential.
 *
 * Two defects fixed here:
 *
 * 1. It iterated `userResponses` and incremented `correct` on every match, so a
 *    client submitting the full cross-product — every option for every question —
 *    matched exactly once per question and scored 1.0 with zero knowledge.
 *    Now scored per QUESTION, taking the first response for each `question_id`,
 *    so extra submissions are worthless rather than free marks.
 *
 * 2. An empty answer key returned 1.0 (full marks). A case that cannot be graded
 *    must never be scored as passed.
 */
export function evaluateClinicalDecision(userResponses: any[], secureAnswers: any[]): number {
	if (!Array.isArray(secureAnswers) || secureAnswers.length === 0) return 0.0;
	if (!Array.isArray(userResponses) || userResponses.length === 0) return 0.0;

	const firstResponseByQuestion = new Map<string, any>();
	for (const res of userResponses) {
		const qid = res?.question_id;
		if (typeof qid !== 'string') continue;
		if (!firstResponseByQuestion.has(qid)) firstResponseByQuestion.set(qid, res);
	}

	let correct = 0;
	for (const key of secureAnswers) {
		const res = firstResponseByQuestion.get(key?.question_id);
		if (res && key.correct_option_index === res.selected_option_index) correct++;
	}

	return correct / secureAnswers.length;
}

/** COMP_5 — error detection against seeded errors (imaging-style cases). */
export function evaluateErrorDetection(userDetections: any[], secureSeededErrors: any[]): number {
	if (!Array.isArray(secureSeededErrors) || secureSeededErrors.length === 0) return 0.0;
	if (!Array.isArray(userDetections) || userDetections.length === 0) return 0.0;

	let detectedCount = 0;
	for (const seeded of secureSeededErrors) {
		const userAns = userDetections.find((det: any) => det?.seeded_error_id === seeded?.id);
		if (userAns && userAns.did_user_detect === true) detectedCount++;
	}
	return detectedCount / secureSeededErrors.length;
}
