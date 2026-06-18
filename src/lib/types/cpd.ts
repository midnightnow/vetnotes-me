// ==========================================
// CORE CPD ENUMS
// ==========================================
export type CPDCategory = 'Clinical/Scientific' | 'Non-Clinical/Practice Management';
export type CPDStep =
  | 'STEP_1_INTAKE'
  | 'STEP_2_REASONING'
  | 'STEP_3_REVEAL'
  | 'STEP_4_COMPARISON'
  | 'STEP_5_QUIZ'
  | 'COMPLETED';

export type AnatomicalZone =
  | 'cardiac_silhouette'
  | 'pulmonary_parenchyma'
  | 'pleura'
  | 'mediastinum'
  | 'airways'
  | 'osseous';

export type CompetencyId = 'COMP_1' | 'COMP_2' | 'COMP_3' | 'COMP_4' | 'COMP_5';
export type CompetencyTier = 'COMPETENT' | 'BORDERLINE' | 'NOT_COMPETENT';

// ==========================================
// PUBLIC DATABASE SCHEMAS
// ==========================================
export interface CPDModule {
  id: string;
  title: string;
  description: string;
  total_hours: number;
  category: CPDCategory;
  points: number;
  created_at: string;
}

export interface CPDCase {
  id: string;
  module_id: string;
  sequence_number: number;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  targeted_competencies: CompetencyId[];
  
  // Step 1: Blind clinical context
  signalment: {
    species: string;
    breed: string;
    age_years: number;
    sex: string;
    weight_kg: number;
  };
  clinical_history: string;
  physical_examination?: string;
  raw_images: Array<{
    image_id: string;
    view: string;
    url: string;
    is_educational: boolean;
  }>;
  
  // Quiz questions (questions only, no correct indices or rationales)
  quiz_questions: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
}

// ==========================================
// SECURE DATABASE SCHEMAS (Admin SDK Only)
// ==========================================
export type SeededError = {
  id: string;
  anatomical_zone: AnatomicalZone;
  error_type: 'false_positive' | 'false_negative' | 'misclassification';
  ai_claim: string;
  ground_truth_fact: string;
  clinical_justification: string;
};

export interface CPDSecureCaseData {
  case_id: string;
  // Secure case seed/reveal data
  ai_report_raw?: string;
  seeded_errors?: SeededError[];
  quiz_answers: Array<{
    question_id: string;
    correct_option_index: number;
    explanation: string;
  }>;
}

// ==========================================
// USER PROGRESSION & ATTEMPT SCHEMAS
// ==========================================
export interface CPDAttempt {
  id: string;
  user_id: string;
  case_id: string;
  attempt_version: number;
  current_step: CPDStep;
  
  // User submissions gathered during the steps
  user_reasoning?: {
    quality_assessment_notes: string;
    abnormalities_identified: string;
    primary_differential: string;
  };
  user_comparison?: {
    detected_seeded_errors: Array<{
      seeded_error_id: string;
      did_user_detect: boolean;
      user_correction_notes: string;
    }>;
    final_synthesized_report: string;
  };
  quiz_responses?: Array<{
    question_id: string;
    selected_option_index: number;
  }>;
  
  // Performance and fraud-prevention tracking
  started_at: string;
  ai_revealed_at?: string;
  completed_at?: string;

  // Non-forkable audit ledger anchors (query-free hash chaining)
  last_event_hash?: string;
  ledger_sequence?: number;
}

export interface CPDScore {
  id: string;
  attempt_id: string;
  user_id: string;
  case_id: string;
  competency_scores: Record<CompetencyId, number>; // Scores 0.0 to 1.0
  is_overall_pass: boolean;
  calculated_at: string;
}

export interface CPDCertificate {
  id: string;
  user_id: string;
  module_id: string;
  recipient_name: string;
  provider_name: string;
  provider_veted_code: string;
  activity_veted_code: string;
  hours_awarded: number;
  issued_at: string;
  verification_url: string;
}

// ==========================================
// REGULATORY & ATTENDANCE SCHEMAS
// ==========================================

export type CPDSessionType = 'IMAGING' | 'VT';

/**
 * Represents an accredited, approved CPD session (the delivery unit).
 * Groups cases together under a specific taxonomy category and required duration.
 */
export interface CPDSession {
  id: string;
  module_id: string;
  title: string;
  description: string;
  session_type: CPDSessionType;
  duration_minutes: number;
  is_free: boolean;
  
  // Sequence of cases that must be completed to satisfy this session
  case_ids: string[];
  
  // Topics
}

/**
 * Captures objective participation and attendance duration.
 * Provides the compliance proof required by auditors.
 */
export interface CPDAttendance {
  id: string; // Structured as `att_user_${userId}_sess_${sessionId}`
  user_id: string;
  session_id: string;
  started_at: string;      // ISO Timestamp
  last_active_at: string;  // ISO Timestamp
  completed_at: string | null;
  
  completed_case_ids: string[];
  completion_percentage: number; // completed_case_ids.length / CPDSession.case_ids.length
}
