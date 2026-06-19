export type AnatomicalZone =
  | 'cardiac_silhouette'
  | 'pulmonary_parenchyma'
  | 'pleura'
  | 'mediastinum'
  | 'airways'
  | 'osseous';

export type CompetencyTier = 'COMPETENT' | 'BORDERLINE' | 'NOT_COMPETENT';

export interface CompetencyRequirement {
  type: 'rubric_completeness' | 'structured_field_coverage' | 'diagnostic_alignment' | 'quiz_accuracy' | 'seeded_error_recall';
  minimum_passing_score: number;
  required_fields?: string[];
  gold_differential_keywords?: string[];
}

export const SCHEMA_VERSION = "1.0.0";

export const CPD_SCORING_SPEC: Record<string, CompetencyRequirement> = {
  COMP_1: {
    type: "rubric_completeness",
    minimum_passing_score: 1.0 // Requires non-empty, high-density quality critique
  },
  COMP_2: {
    type: "structured_field_coverage",
    minimum_passing_score: 1.0,
    required_fields: ["cardiac_silhouette", "pulmonary_parenchyma", "pleural_space", "mediastinum_and_extra_thoracic"]
  },
  COMP_3: {
    type: "diagnostic_alignment",
    minimum_passing_score: 1.0,
    gold_differential_keywords: ["congestive", "chf", "edema", "oedema", "mitral", "mmvd", "atrial"]
  },
  COMP_4: {
    type: "quiz_accuracy",
    minimum_passing_score: 1.0 // 100% on the Case 1 clinical decision quiz
  },
  COMP_5: {
    type: "seeded_error_recall",
    minimum_passing_score: 1.0 // Must find 100% of injected false-negatives (2/2)
  }
};

/**
 * Maps numeric scores to formal, auditable competency tiers.
 */
export function getCompetencyTier(score: number): CompetencyTier {
  if (score >= 1.0) return 'COMPETENT';
  if (score >= 0.70) return 'BORDERLINE';
  return 'NOT_COMPETENT';
}
