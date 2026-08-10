import type { VetSorceryModule } from '$lib/types/module';
import { extractMetadataBlock, validateMetadata, computeQuality, generateDiagnosticTriggers } from '$lib/server/derm_pipeline';
import schema from '$lib/schemas/dermatology-leader-format-v1.json';

const dermatologyModule: VetSorceryModule = {
  id: 'dermatology',
  name: 'Dermatology',
  version: '0.1.0',
  specialty: 'Dermatology',
  tier: 'pro',
  systemPrompt: 'You are a veterinary dermatology scribe. Extract structured metadata within <derm_metadata_json> tags.',
  schema,
  extractMetadata(text: string) {
    const block = extractMetadataBlock(text);
    if (!block) return null;
    return JSON.parse(block);
  },
  validate(data: unknown) {
    return validateMetadata(data);
  },
  computeQuality(data: any) {
    const res = computeQuality(data);
    return { missing: res.missingCriticalMetadata, completeness: res.completenessScore };
  },
  generateTriggers(data: any) {
    const triggers = generateDiagnosticTriggers(data) as Record<string, any>;
    const res: Record<string, boolean | string> = {};
    for (const [k, v] of Object.entries(triggers)) {
      if (Array.isArray(v)) {
        res[k] = v.join('; ');
      } else if (typeof v === 'boolean' || typeof v === 'string') {
        res[k] = v;
      }
    }
    return res;
  },
  toFirestore(data: any) {
    return {
      ...data,
      audit: {
        schemaValidated: true,
        validatedBy: 'system',
        validatedAt: new Date().toISOString(),
        generatedBy: 'vetsorcery-scribe',
        generatedAt: new Date().toISOString(),
      },
      status: 'pending_specialist_review',
      createdAt: new Date().toISOString(),
    };
  },
  researchFields: ['diet', 'parasiteControl', 'immunosuppression', 'cytology']
};

export default dermatologyModule;
