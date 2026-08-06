import { describe, it, expect } from 'vitest';
import {
	evaluateClinicalDecision,
	evaluateErrorDetection,
	evaluateQuality,
	evaluatePatternRecognition
} from './cpd_scoring';

const ANSWERS = [
	{ question_id: 'q1', correct_option_index: 1 },
	{ question_id: 'q2', correct_option_index: 0 },
	{ question_id: 'q3', correct_option_index: 2 }
];

describe('evaluateClinicalDecision — the free-pass exploit', () => {
	it('does NOT award full marks for submitting every option for every question', () => {
		// The original scorer iterated userResponses and incremented on each match,
		// so the full cross-product matched once per question and scored 1.0.
		const bruteForce = [];
		for (const qid of ['q1', 'q2', 'q3']) {
			for (let i = 0; i < 4; i++) {
				bruteForce.push({ question_id: qid, selected_option_index: i });
			}
		}
		const score = evaluateClinicalDecision(bruteForce, ANSWERS);
		expect(score).toBeLessThan(1.0);
		// First response per question is index 0 → only q2's answer (0) is correct.
		expect(score).toBeCloseTo(1 / 3);
	});

	it('cannot exceed 1.0 even with massive duplicate submission', () => {
		const spam = Array.from({ length: 500 }, () => ({
			question_id: 'q1',
			selected_option_index: 1
		}));
		expect(evaluateClinicalDecision(spam, ANSWERS)).toBeLessThanOrEqual(1.0);
	});

	it('takes the FIRST response per question, so a later correction does not help', () => {
		const responses = [
			{ question_id: 'q1', selected_option_index: 9 }, // wrong, submitted first
			{ question_id: 'q1', selected_option_index: 1 } // correct, too late
		];
		expect(evaluateClinicalDecision(responses, ANSWERS)).toBe(0);
	});
});

describe('evaluateClinicalDecision — ungradeable must not mean passed', () => {
	it('returns 0 when the answer key is empty (previously returned 1.0)', () => {
		expect(evaluateClinicalDecision([{ question_id: 'q1', selected_option_index: 1 }], [])).toBe(0);
	});

	it('returns 0 when the answer key is missing entirely', () => {
		expect(evaluateClinicalDecision([], undefined as any)).toBe(0);
	});

	it('returns 0 when the candidate submitted nothing', () => {
		expect(evaluateClinicalDecision([], ANSWERS)).toBe(0);
	});
});

describe('evaluateClinicalDecision — honest grading still works', () => {
	it('scores a fully correct submission as 1.0', () => {
		const responses = [
			{ question_id: 'q1', selected_option_index: 1 },
			{ question_id: 'q2', selected_option_index: 0 },
			{ question_id: 'q3', selected_option_index: 2 }
		];
		expect(evaluateClinicalDecision(responses, ANSWERS)).toBe(1);
	});

	it('scores partial credit correctly', () => {
		const responses = [
			{ question_id: 'q1', selected_option_index: 1 }, // correct
			{ question_id: 'q2', selected_option_index: 3 }, // wrong
			{ question_id: 'q3', selected_option_index: 2 } // correct
		];
		expect(evaluateClinicalDecision(responses, ANSWERS)).toBeCloseTo(2 / 3);
	});

	it('ignores malformed responses without crashing', () => {
		const responses = [
			null,
			{ selected_option_index: 1 },
			{ question_id: 42, selected_option_index: 1 },
			{ question_id: 'q1', selected_option_index: 1 }
		] as any[];
		expect(evaluateClinicalDecision(responses, ANSWERS)).toBeCloseTo(1 / 3);
	});
});

describe('evaluateErrorDetection', () => {
	const SEEDED = [{ id: 'e1' }, { id: 'e2' }];

	it('returns 0 with no seeded errors rather than crashing', () => {
		expect(evaluateErrorDetection([{ seeded_error_id: 'e1', did_user_detect: true }], [])).toBe(0);
	});

	it('returns 0 when nothing was submitted', () => {
		expect(evaluateErrorDetection([], SEEDED)).toBe(0);
	});

	it('scores detected errors proportionally', () => {
		const dets = [
			{ seeded_error_id: 'e1', did_user_detect: true },
			{ seeded_error_id: 'e2', did_user_detect: false }
		];
		expect(evaluateErrorDetection(dets, SEEDED)).toBe(0.5);
	});
});

describe('heuristic competencies — documented as weak, pinned so changes are deliberate', () => {
	it('COMP_1 passes on 15 characters of text', () => {
		expect(evaluateQuality('short')).toBe(0);
		expect(evaluateQuality('x'.repeat(15))).toBe(1);
	});

	it('COMP_3 passes on a single keyword substring', () => {
		expect(evaluatePatternRecognition('suspect CHF', ['chf'])).toBe(1);
		expect(evaluatePatternRecognition('suspect colic', ['chf'])).toBe(0);
	});
});
