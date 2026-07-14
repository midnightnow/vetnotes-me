import dermLeaderSchema from '../schemas/dermatology-leader-format-v1.json';

const REQUIRED_FIELDS = [
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
];

export interface DiagnosticTriggerFlags {
  failedDietTrial: boolean;
  incompleteSteroidWashout: boolean;
  recurrentOtitis: boolean;
  recurrentPyoderma: boolean;
  rodsDetected: boolean;
  favrotCriteriaMet: boolean;
  allergyTestingCandidate: boolean;
  cultureRecommended: boolean;
  referralRecommended: boolean;
  triggerRationale: string[];
}

export interface DermMetadataQuality {
  missingCriticalMetadata: string[];
  completenessScore: number;
}

export interface DermMetadataValidation {
  valid: boolean;
  errors?: any[];
}

export function extractMetadataBlock(text: string): string | null {
  const match = text.match(/<derm_metadata_json>\s*(\{[\s\S]*?\})\s*<\/derm_metadata_json>/);
  return match ? match[1] : null;
}

export function validateMetadata(data: unknown): DermMetadataValidation {
  try {
    const schema = dermLeaderSchema as any;
    const validate = (value: unknown) => {
      if (typeof value !== 'object' || value === null) return ['Root payload must be an object'];
      const obj = value as Record<string, unknown>;

      if (!schema.properties || !schema.required) return ['Invalid schema loaded'];

      const errors: string[] = [];

      for (const key of schema.required as string[]) {
        if (!(key in obj)) {
          errors.push(`Missing required section: "${key}"`);
        }
      }

      for (const [section, sectionSchema] of Object.entries(schema.properties as Record<string, any>)) {
        const sectionObj = obj[section];
        if (typeof sectionObj !== 'object' || sectionObj === null) {
          errors.push(`Section "${section}" must be an object`);
          continue;
        }

        const inner = sectionObj as Record<string, unknown>;
        for (const field of Object.keys(inner)) {
          if (!sectionSchema.properties?.[field]) {
            errors.push(`Section "${section}" has unknown field: "${field}"`);
          }
        }

        for (const field of (sectionSchema.required || []) as string[]) {
          if (!(field in inner)) {
            errors.push(`Section "${section}" missing required field: "${field}"`);
          }
        }
      }

      return errors;
    };

    const schemaErrors = validate(data);
    return { valid: schemaErrors.length === 0, errors: schemaErrors.length ? schemaErrors : undefined };
  } catch (err) {
    return { valid: false, errors: [err instanceof Error ? err.message : 'Schema load failed'] };
  }
}

export function computeQuality(data: Record<string, unknown>): DermMetadataQuality {
  const missing = REQUIRED_FIELDS.filter((field) => data[field] == null);
  const completeness = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);
  return { missingCriticalMetadata: missing, completenessScore: completeness };
}

export function generateDiagnosticTriggers(data: Record<string, unknown>): DiagnosticTriggerFlags {
  const triggerRationale: string[] = [];

  const failedDietTrial = (data?.dietTrial?.outcome === 'worse') ||
    (typeof data?.dietTrial?.durationWeeks === 'number' && data.dietTrial.durationWeeks < 8);
  if (failedDietTrial) triggerRationale.push('Diet trial was unsuccessful or less than 8 weeks');

  const recurrentOtitis = Boolean(data?.recurrentOtitis);
  if (recurrentOtitis) triggerRationale.push('Recurrent otitis documented');

  const recurrentPyoderma = Boolean(data?.recurrentPyoderma);
  if (recurrentPyoderma) triggerRationale.push('Recurrent pyoderma documented');

  const favrotCriteriaMet = typeof data?.favrotCriteria?.criteriaMetCount === 'number'
    ? data.favrotCriteria.criteriaMetCount >= 5
    : false;
  if (favrotCriteriaMet) triggerRationale.push('FAVROT criteria met (>=5)');

  const allergyTestingCandidate = favrotCriteriaMet && !(data?.dietTrial?.performed === true);
  if (allergyTestingCandidate) triggerRationale.push('Allergy testing candidate: FAVROT met, diet trial not performed');

  const rodsDetected = Array.isArray(data?.cytology?.sites)
    ? data.cytology.sites.some((site: any) => typeof site?.rods0_4 === 'number' && site.rods0_4 > 0)
    : false;
  if (rodsDetected) triggerRationale.push('Rod-shaped organisms detected on cytology');

  const cultureRecommended = Array.isArray(data?.cytology?.sites)
    ? data.cytology.sites.some((site: any) => typeof site?.rods0_4 === 'number' && site.rods0_4 > 1)
    : false;
  if (cultureRecommended) triggerRationale.push('Culture recommended: rods > 1 on cytology');

  return {
    failedDietTrial,
    incompleteSteroidWashout: false,
    recurrentOtitis,
    recurrentPyoderma,
    rodsDetected,
    favrotCriteriaMet,
    allergyTestingCandidate,
    cultureRecommended,
    referralRecommended: true,
    triggerRationale
  };
}
