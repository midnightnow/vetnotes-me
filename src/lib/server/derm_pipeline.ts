// Schema bundled at build time via vite ?raw — a runtime readFileSync with an
// import.meta.url-relative path pointed at .svelte-kit/output/... where the
// JSON is never copied, so every clean `gcloud --source` build crashed in
// SvelteKit's postbuild analyse step (third broken-at-commit class, 2026-07-17).
import schemaRaw from '$lib/schemas/dermatology-leader-format-v1.json?raw';
import { generateDiagnosticTriggers as generateCanonicalDiagnosticTriggers } from '$lib/server/derm_leader_format';

const dermLeaderSchema = JSON.parse(schemaRaw);

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

function collectSchemaRequiredPaths(schema: any): string[] {
  const paths: string[] = [];
  if (!schema || typeof schema !== 'object' || !schema.properties) return paths;
  for (const section of (schema.required || []) as string[]) {
    const sectionSchema = schema.properties[section];
    const reqFields = (sectionSchema?.required || []) as string[];
    if (reqFields.length === 0) {
      paths.push(section);
    } else {
      for (const field of reqFields) {
        paths.push(`${section}.${field}`);
      }
    }
  }
  return paths;
}

function hasNestedPath(obj: any, dottedPath: string): boolean {
  let cur = obj;
  for (const key of dottedPath.split('.')) {
    if (!cur || typeof cur !== 'object' || !(key in cur) || cur[key] == null) {
      return false;
    }
    cur = cur[key];
  }
  return true;
}

export function computeQuality(data: any): DermMetadataQuality {
  const schemaPaths = collectSchemaRequiredPaths(dermLeaderSchema);
  const isNestedSchemaShape =
    data &&
    typeof data === 'object' &&
    ('diet' in data || 'parasiteControl' in data || 'immunosuppression' in data || 'cytology' in data);

  if (isNestedSchemaShape && schemaPaths.length > 0) {
    const missing = schemaPaths.filter((path) => !hasNestedPath(data, path));
    const completeness = Math.round(((schemaPaths.length - missing.length) / schemaPaths.length) * 100);
    return { missingCriticalMetadata: missing, completenessScore: completeness };
  }

  const missing = REQUIRED_FIELDS.filter((field) => data?.[field] == null);
  const completeness = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);
  return { missingCriticalMetadata: missing, completenessScore: completeness };
}

export function generateDiagnosticTriggers(data: any): DiagnosticTriggerFlags {
  const flags = generateCanonicalDiagnosticTriggers(
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  );
  return {
    ...flags,
    triggerRationale: flags.triggerRationale ?? []
  };
}
