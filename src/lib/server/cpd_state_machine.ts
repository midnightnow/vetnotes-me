/**
 * CPD State Machine — Single source of truth for all CPD lifecycle transitions.
 * 
 * This module defines:
 * - Allowed state transitions (forward-only, no skipping)
 * - Permitted field mutations per step
 * - Timing invariants
 * 
 * No CPD state mutation may occur outside this module's validation.
 */

import { error } from '@sveltejs/kit';
import type { CPDAttempt, CPDStep } from '$lib/types/cpd';

// Explicit field-level mutation permissions per step
const PERMITTED_MUTATIONS_PER_STEP: Record<CPDStep, string[]> = {
  STEP_1_INTAKE: ['started_at', 'current_step', 'attempt_version', 'user_id', 'case_id', 'id'],
  STEP_2_REASONING: ['user_reasoning', 'current_step'],
  STEP_3_REVEAL: ['ai_revealed_at', 'current_step'],
  STEP_4_COMPARISON: ['user_comparison', 'current_step'],
  STEP_5_QUIZ: ['quiz_responses', 'completed_at', 'current_step'],
  COMPLETED: [] // Completely immutable state
};

const ALLOWED_TRANSITIONS: Record<CPDStep, CPDStep[]> = {
  'STEP_1_INTAKE': ['STEP_2_REASONING'],
  'STEP_2_REASONING': ['STEP_3_REVEAL'],
  'STEP_3_REVEAL': ['STEP_4_COMPARISON'],
  'STEP_4_COMPARISON': ['STEP_5_QUIZ'],
  'STEP_5_QUIZ': ['COMPLETED'],
  'COMPLETED': []
};

const MIN_INSPECTION_TIME_MS = 120 * 1000; // 120 seconds

export class CPDStateMachine {
  /**
   * Validates state transitions, throwing SvelteKit errors if invariants fail.
   * Forward-only. No skipping. No regression.
   */
  static transition(attempt: CPDAttempt, targetStep: CPDStep): void {
    // Invariant: Block any transition out of COMPLETED
    if (attempt.current_step === 'COMPLETED') {
      throw error(400, 'CPD Attempt is completed and immutable.');
    }

    // Invariant: Block backwards regression or step skipping
    const allowed = ALLOWED_TRANSITIONS[attempt.current_step];
    if (!allowed || !allowed.includes(targetStep)) {
      throw error(400, `State machine violation: Cannot transition from ${attempt.current_step} to ${targetStep}`);
    }

    // Invariant: Timing validation before entering STEP_3_REVEAL
    if (targetStep === 'STEP_3_REVEAL') {
      const startTime = new Date(attempt.started_at).getTime();
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_INSPECTION_TIME_MS) {
        throw error(400, `Insufficient inspection duration. Elapsed: ${Math.round(elapsed / 1000)}s. Minimum: 120s.`);
      }
    }
  }

  /**
   * Guards against payloads writing unauthorized fields for a given step.
   */
  static validatePayloadSchema(step: CPDStep, payload: Record<string, any>): void {
    const allowedFields = PERMITTED_MUTATIONS_PER_STEP[step];
    const invalidFields = Object.keys(payload).filter(key => !allowedFields.includes(key));

    if (invalidFields.length > 0) {
      throw error(400, `Schema violation: Fields [${invalidFields.join(', ')}] are not writeable in state ${step}`);
    }
  }

  /**
   * Returns the allowed next steps from a given state.
   */
  static getAllowedTransitions(currentStep: CPDStep): CPDStep[] {
    return ALLOWED_TRANSITIONS[currentStep] || [];
  }
}
