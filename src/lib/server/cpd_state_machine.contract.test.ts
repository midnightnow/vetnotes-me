import { describe, it, expect } from 'vitest';
import { CPDStateMachine } from '$lib/server/cpd_state_machine';
import type { CPDAttempt } from '$lib/types/cpd';

function makeAttempt(overrides: Partial<CPDAttempt> = {}): CPDAttempt {
  return {
    id: 'att_test_001',
    user_id: 'user_001',
    case_id: 'case_001',
    attempt_version: 1,
    current_step: 'STEP_1_INTAKE',
    started_at: new Date(Date.now() - 125000).toISOString(),
    ...overrides,
  };
}

describe('CPDStateMachine — Contract tests', () => {
  it('completes all cpd workflow steps in sequence', () => {
    const attempt = makeAttempt({ current_step: 'STEP_1_INTAKE' });
    const steps: CPDStateMachine[] = [];
    expect(() => {
      CPDStateMachine.transition(attempt, 'STEP_2_REASONING');
      CPDStateMachine.transition({ ...attempt, current_step: 'STEP_2_REASONING' }, 'STEP_3_REVEAL');
    }).not.toThrow();

    const completed = makeAttempt({ current_step: 'COMPLETED' });
    expect(CPDStateMachine.getAllowedTransitions('COMPLETED')).toEqual([]);
  });
});
