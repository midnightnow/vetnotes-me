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
  signalment: {
    species: string;
    breed: string;
    age_years: number;
    sex: string;
    weight_kg: number;
  };
  clinical_history: string;
  physical_examination?: string;
  raw_images?: Array<{
    image_id: string;
    view: string;
    url: string;
    is_educational: boolean;
  }>;
  quiz_questions: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
  session_type?: CPDSessionType;
  is_free?: boolean;
  hours_awarded?: number;
  provider_name?: string;
  provider_code?: string;
  activity_code?: string;
  module_id?: string;
}

export interface CPDSecureCaseData {
  case_id: string;
  insight_text?: string;
  reference_document_url?: string;
  ai_report_raw?: string;
  seeded_errors?: Array<{
    id: string;
    anatomical_zone: AnatomicalZone;
    error_type: 'false_positive' | 'false_negative' | 'misclassification';
    ai_claim: string;
    ground_truth_fact: string;
    clinical_justification: string;
  }>;
  quiz_answers: Array<{
    question_id: string;
    correct_option_index: number;
    explanation: string;
  }>;
}

export interface CPDAttempt {
  id: string;
  user_id: string;
  case_id: string;
  attempt_version: number;
  current_step: CPDStep;
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
  started_at: string;
  ai_revealed_at?: string;
  completed_at?: string;
  last_event_hash?: string;
  ledger_sequence?: number;
}

export interface CPDScore {
  id: string;
  attempt_id: string;
  user_id: string;
  case_id: string;
  competency_scores: Record<CompetencyId, number>;
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

export interface CPDSession {
  id: string;
  module_id: string;
  title: string;
  description: string;
  session_type: CPDSessionType;
  duration_minutes: number;
  is_free: boolean;
  case_ids: string[];
  created_at?: string;
}

export interface CPDAttendance {
  id: string;
  user_id: string;
  session_id: string;
  started_at: string;
  last_active_at: string;
  completed_at: string | null;
  completed_case_ids: string[];
  completion_percentage: number;
}
