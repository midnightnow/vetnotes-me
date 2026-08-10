export type DermatologySchemaVersion = 'dermatology-leader-format:v1.0.0';

export type PrimaryComplaint =
  | 'pruritus'
  | 'otitis_externa'
  | 'pyoderma'
  | 'alopecia'
  | 'pododermatitis'
  | 'recurrent_skin_infection'
  | 'suspected_atopy'
  | 'other';

export type ReferralUrgency = 'routine' | 'urgent' | 'emergency';
export type Seasonality = 'seasonal' | 'non_seasonal' | 'unknown';
export type SteroidResponse = 'none' | 'partial' | 'good' | 'unknown';
export type DifferentialExcluded =
  | 'fleas'
  | 'mites'
  | 'dermatophytosis'
  | 'bacterial_pyoderma'
  | 'malassezia'
  | 'food_adverse_reaction'
  | 'endocrine_disease'
  | 'immune_mediated_disease'
  | 'none_confirmed';
export type DietStrictness = 'strict' | 'mostly_strict' | 'not_strict' | 'unknown' | 'not_performed';
export type DietType = 'hydrolysed' | 'novel_protein' | 'home_cooked' | 'commercial_elimination' | 'unknown' | 'not_performed';
export type DietOutcome = 'improved' | 'no_change' | 'worse' | 'unknown' | 'not_performed';
export type ParasiteCompliance = 'excellent' | 'good' | 'poor' | 'unknown';
export type ImmunosuppressionDrug = 'prednisolone' | 'apoquel' | 'cytopoint' | 'ciclosporin' | 'other' | 'none';
export type ClinicalResponse = 'none' | 'partial' | 'good' | 'unknown';
export type LesionSite =
  | 'face'
  | 'muzzle'
  | 'pinnae'
  | 'ear_canals'
  | 'axillae'
  | 'groin'
  | 'ventrum'
  | 'paws'
  | 'interdigital'
  | 'perineum'
  | 'flexural_surfaces'
  | 'lumbosacral'
  | 'generalized';
export type LesionType =
  | 'erythema'
  | 'papules'
  | 'pustules'
  | 'scale'
  | 'crust'
  | 'alopecia'
  | 'excoriation'
  | 'lichenification'
  | 'hyperpigmentation'
  | 'malodor'
  | 'exudate';
export type CytologySite = 'left_ear' | 'right_ear' | 'skin_lesion' | 'interdigital' | 'other';
export type CytologyMethod = 'tape_prep' | 'swab' | 'impression' | 'skin_scrape' | 'not_performed';
export type DiagnosticType =
  | 'skin_scrape'
  | 'trichogram'
  | 'cytology'
  | 'bacterial_culture'
  | 'fungal_culture'
  | 'dermatophyte_pcr'
  | 'wood_lamp'
  | 'endocrine_testing'
  | 'idexx_panel'
  | 'allergy_testing'
  | 'intradermal_testing'
  | 'serum_allergy_testing'
  | 'biopsy'
  | 'other';
export type ResearchSource = 'vetsorcery_scribe' | 'manual_entry' | 'lab_import' | 'specialist_review';
export type DiagnosticYield = 'not_available' | 'positive' | 'negative' | 'inconclusive';

export interface DermatologyLeaderFormatSpecialist {
  specialistId?: string;
  name?: string;
  clinic?: string;
  role?: string;
  clinicalAuthorityApproved?: boolean;
}

export interface DermatologyLeaderFormatPatient {
  species: 'Canine';
  breed: string;
  ageYears: number;
  sex: string;
  neutered?: boolean;
  weightKg: number;
}

export interface DermatologyLeaderFormatReferral {
  gpPracticeId: string;
  referralReason: string;
  urgency: ReferralUrgency;
  requestedSpecialistAction?: string;
}

export interface DermatologyChiefComplaint {
  primaryComplaint: PrimaryComplaint;
  secondaryComplaints?: string[];
  durationDays: number;
  severityScore: number;
  vasScore0_100?: number;
}

export interface DermatologyFavrotCriteria {
  ageOnsetUnder3Years: boolean;
  houseDustMiteSensitivitySuspected: boolean;
  frontFeetAffected: boolean;
  earPinnaeAffected: boolean;
  earMarginsSpared: boolean;
  lumbosacralAreaSpared: boolean;
  otherHouseholdMembersNotAffected: boolean;
  criteriaMetCount: number;
}

export interface DermatologyAtopicWorkup {
  onsetAgeYears: number;
  seasonality: Seasonality;
  chronicOrRecurrent: boolean;
  previousResponseToSteroids?: SteroidResponse;
  favrotCriteria: DermatologyFavrotCriteria;
  differentialsExcluded: DifferentialExcluded[];
}

export interface DermatologyDietTrial {
  performed: boolean;
  strictness: DietStrictness;
  durationWeeks: number;
  dietType: DietType;
  dietName?: string;
  proteinSource?: string;
  treatsOrTableScrapsAllowed?: boolean;
  deviations?: string[];
  outcome: DietOutcome;
}

export interface DermatologyParasiteControl {
  product: string;
  activeIngredient?: string;
  doseMgKg?: number;
  frequencyDays: number;
  lastGiven: string;
  durationDays?: number;
  compliance: ParasiteCompliance;
}

export interface DermatologyImmunosuppressionHistory {
  drugName: ImmunosuppressionDrug;
  doseMgKg?: number;
  frequency?: string;
  startDate?: string;
  stopDate?: string;
  lastDoseDate: string;
  durationDays?: number;
  washoutWeeks: number;
  clinicalResponse?: ClinicalResponse;
  adverseEvents?: string[];
}

export interface DermatologyLesionRegion {
  site: LesionSite;
  present: boolean;
  severity0_4: number;
  lesionTypes?: LesionType[];
}

export interface DermatologyLesionDistribution {
  regions: DermatologyLesionRegion[];
}

export interface DermatologyCytologySite {
  site: CytologySite;
  method: CytologyMethod;
  malassezia0_4: number;
  cocci0_4: number;
  rods0_4: number;
  neutrophils0_4: number;
  interpretation?: string;
}

export interface DermatologyCytology {
  sites: DermatologyCytologySite[];
}

export interface DermatologyDiagnostics {
  performed: DiagnosticType[];
  recommended: DiagnosticType[];
  idexxPanelCandidate?: boolean;
  idexxPanelRationale?: string;
}

export interface DermatologyDiagnosticTriggerFlags {
  failedDietTrial: boolean;
  incompleteSteroidWashout: boolean;
  recurrentOtitis: boolean;
  recurrentPyoderma: boolean;
  rodsDetected: boolean;
  favrotCriteriaMet: boolean;
  allergyTestingCandidate: boolean;
  cultureRecommended: boolean;
  referralRecommended: boolean;
  triggerRationale?: string[];
}

export interface DermatologyReferralQuality {
  protocolAdherenceScore: number;
  metadataCompletenessScore: number;
  missingCriticalMetadata: string[];
  specialistQuestions?: string[];
}

export interface DermatologyResearchDataset {
  protocolVersion: string;
  siteId?: string;
  gpId?: string;
  specialistId?: string;
  caseId?: string;
  source: ResearchSource;
  clinicianConfirmed: boolean;
  consentForResearch: boolean;
  completenessScore: number;
  adherenceScore: number;
  diagnosticYield?: DiagnosticYield;
  referralFrictionMinutes?: number;
  timeToTreatmentDays?: number;
  outcomeFollowupDueDate?: string;
}

export interface DermatologyAudit {
  schemaValidated: boolean;
  generatedBy: string;
  generatedAt: string;
  validatedBy?: string;
  validatedAt?: string;
  recordHash?: string;
}

export interface DermatologyLeaderFormatPayload {
  schemaVersion: DermatologySchemaVersion;
  protocolId: string;
  specialty: 'Dermatology';
  protocolName?: string;
  specialist?: DermatologyLeaderFormatSpecialist;
  createdAt: string;
  patient: DermatologyLeaderFormatPatient;
  referral: DermatologyLeaderFormatReferral;
  chiefComplaint: DermatologyChiefComplaint;
  canineAtopicDermatitisWorkup: DermatologyAtopicWorkup;
  dietTrial: DermatologyDietTrial;
  parasiteControl: DermatologyParasiteControl;
  immunosuppressionHistory: DermatologyImmunosuppressionHistory[];
  lesionDistribution: DermatologyLesionDistribution;
  cytology: DermatologyCytology;
  diagnostics: DermatologyDiagnostics;
  diagnosticTriggerFlags: DermatologyDiagnosticTriggerFlags;
  referralQuality: DermatologyReferralQuality;
  researchDataset: DermatologyResearchDataset;
  audit: DermatologyAudit;
}

export interface DermatologyGoldStandard {
  dietTrialMinimumWeeks: number;
  dietTrialStrictnessRequired: 'strict';
  parasiteControlMinimumWeeks: number;
  steroidWashoutMinimumWeeks: number;
  apoquelWashoutMinimumDays: number;
  cytopointWashoutMinimumWeeks: number;
  requiredCytologySites: readonly CytologySite[];
  favrotCriteriaRequired: boolean;
  minimumFavrotCriteriaCount: number;
  requiredBeforeAllergyTesting: string[];
}

export interface DermatologyLeaderFormatSeed {
  protocolId: string;
  schemaVersion: DermatologySchemaVersion;
  specialty: 'Dermatology';
  protocolName: string;
  status: 'draft_pending_specialist_approval' | 'active' | 'retired';
  goldStandard: DermatologyGoldStandard;
  requiredMetadata: readonly string[];
  systemPromptExtension: string;
  researchDatasetEnabled: boolean;
  idexxDiagnosticTriggerEnabled: boolean;
  createdAt: string;
  createdBy: string;
  clinicalAuthority: string | null;
  clinicalAuthorityApproved: boolean;
}

export const DERMATOLOGY_LEADER_FORMAT_REQUIRED_METADATA = [
  'diet_trial_duration_weeks',
  'diet_trial_strictness',
  'ectoparasite_product',
  'ectoparasite_last_given',
  'previous_steroid_dose_and_dates',
  'apoquel_cytopoint_washout',
  'favrot_criteria',
  'lesion_distribution',
  'ear_left_cytology',
  'ear_right_cytology',
  'skin_lesion_cytology',
  'secondary_infection_status',
  'diagnostic_trigger_flags',
  'research_consent'
] as const;

export const DERMATOLOGY_GOLD_STANDARD = {
  dietTrialMinimumWeeks: 8,
  dietTrialStrictnessRequired: 'strict',
  parasiteControlMinimumWeeks: 12,
  steroidWashoutMinimumWeeks: 2,
  apoquelWashoutMinimumDays: 7,
  cytopointWashoutMinimumWeeks: 8,
  requiredCytologySites: ['left_ear', 'right_ear', 'skin_lesion'],
  favrotCriteriaRequired: true,
  minimumFavrotCriteriaCount: 5,
  requiredBeforeAllergyTesting: [
    'completed_diet_trial',
    'adequate_ectoparasite_control',
    'cytology_documented',
    'secondary_infection_assessed',
    'immunosuppression_washout_confirmed'
  ]
} satisfies DermatologyGoldStandard;

export const DERMATOLOGY_LEADER_FORMAT_SEED = {
  protocolId: 'LF-DERM-FNQ',
  schemaVersion: 'dermatology-leader-format:v1.0.0',
  specialty: 'Dermatology',
  protocolName: 'FNQ Canine Atopic Dermatitis Referral Standard',
  status: 'draft_pending_specialist_approval',
  goldStandard: DERMATOLOGY_GOLD_STANDARD,
  requiredMetadata: DERMATOLOGY_LEADER_FORMAT_REQUIRED_METADATA,
  systemPromptExtension:
    'Extract dermatology metadata exactly from the GP consult. Do not infer missing values. If diet trial, washout, parasite control, cytology, or lesion distribution is unmentioned, set the value to null and add it to missingCriticalMetadata. Force a clean JSON block using the Dermatology Leader Format schema.',
  researchDatasetEnabled: true,
  idexxDiagnosticTriggerEnabled: true,
  createdAt: new Date().toISOString(),
  createdBy: 'Dr. Dallas McMillan',
  clinicalAuthority: null,
  clinicalAuthorityApproved: false
} satisfies DermatologyLeaderFormatSeed;
