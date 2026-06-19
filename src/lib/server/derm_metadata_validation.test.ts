import { describe, it, expect } from 'vitest';

// ============================================================
// Ground-truth schema fixture (from dermatology-leader-format.schema.json)
// Fields per section are the source of truth for clinical validation.
// ============================================================

const REQUIRED_TOP_LEVEL = ['diet', 'parasiteControl', 'immunosuppression', 'cytology'];

const SECTION_CONTRACT = {
  diet: ['active', 'durationWeeks', 'dietType'],
  parasiteControl: ['product', 'frequencyDays', 'lastGiven'],
  immunosuppression: ['drug', 'dose', 'durationDays', 'washoutWeeks'],
  cytology: ['earLeft', 'earRight', 'skin'],
} as const;

// ============================================================
// Helpers — simulate the contract enforced by the LLM parse-derm
// endpoint and the JSON schema validator.
// ============================================================

type DermMetadata = {
  diet: { active: boolean; durationWeeks: number | null; dietType: string | null };
  parasiteControl: { product: string | null; frequencyDays: number | null; lastGiven: string | null };
  immunosuppression: { drug: string | null; dose: number | null; durationDays: number | null; washoutWeeks: number | null };
  cytology: { earLeft: string | null; earRight: string | null; skin: string | null };
};

function validateDermContract(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Root payload is not an object'] };
  }

  const obj = data as Record<string, unknown>;

  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in obj)) {
      errors.push(`Missing required top-level section: "${key}"`);
    }
  }

  for (const [section, fields] of Object.entries(SECTION_CONTRACT)) {
    const sectionObj = obj[section];
    if (typeof sectionObj !== 'object' || sectionObj === null) {
      errors.push(`Section "${section}" must be an object`);
      continue;
    }

    const inner = sectionObj as Record<string, unknown>;
    for (const field of fields) {
      if (!(field in inner)) {
        errors.push(`Section "${section}" missing required field: "${field}"`);
      }
    }

    for (const field of Object.keys(inner)) {
      if (!(SECTION_CONTRACT[section as keyof typeof SECTION_CONTRACT] as readonly string[]).includes(field)) {
        errors.push(`Section "${section}" has unknown field: "${field}" (additionalProperties: false)`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Simulated LLM parser (mirrors src/routes/api/cases/parse-derm)
// ============================================================

function extractDermMetadata(llmRawOutput: string): DermMetadata | null {
  const jsonMatch = llmRawOutput.match(/<derm_metadata_json>([\s\S]*?)<\/derm_metadata_json>/);
  if (!jsonMatch) return null;
  return JSON.parse(jsonMatch[1].trim()) as DermMetadata;
}

// ============================================================
// Fixtures
// ============================================================

const VALID_PAYLOAD: DermMetadata = {
  diet: { active: true, durationWeeks: 8, dietType: 'Royal Canin Anallergenic' },
  parasiteControl: { product: 'Bravecto', frequencyDays: 90, lastGiven: '2026-05-10' },
  immunosuppression: { drug: 'Apoquel', dose: 0.5, durationDays: 14, washoutWeeks: 2 },
  cytology: { earLeft: '3+ Malassezia, 1+ Cocci', earRight: 'NAD', skin: 'Moderate neutrophils' },
};

const NULL_NORMALIZED_PAYLOAD: DermMetadata = {
  diet: { active: false, durationWeeks: null, dietType: null },
  parasiteControl: { product: null, frequencyDays: null, lastGiven: null },
  immunosuppression: { drug: null, dose: null, durationDays: null, washoutWeeks: null },
  cytology: { earLeft: null, earRight: null, skin: null },
};

function buildDermRawOutput(metadata: DermMetadata): string {
  const json = JSON.stringify(metadata);
  return `SOAP NOTE GOES HERE... <derm_metadata_json>${json}</derm_metadata_json>`;
}

// ============================================================
// Contract Validation Tests
// ============================================================

describe('Dermatology Leader Format — JSON Schema Contract', () => {
  it('accepts a valid fully-populated payload', () => {
    const result = validateDermContract(VALID_PAYLOAD);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a null-normalized payload (omitted values expressed as null)', () => {
    const result = validateDermContract(NULL_NORMALIZED_PAYLOAD);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects payload missing a top-level required section', () => {
    const { diet, ...bad } = VALID_PAYLOAD;
    const result = validateDermContract(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required top-level section: "diet"');
  });

  it('rejects immunosuppression missing washoutWeeks field', () => {
    const bad = {
      ...VALID_PAYLOAD,
      immunosuppression: { drug: 'Apoquel', dose: 0.5, durationDays: 14 },
    };
    const result = validateDermContract(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('washoutWeeks'))).toBe(true);
  });

  it('rejects cytology missing earRight field', () => {
    const bad = {
      ...VALID_PAYLOAD,
      cytology: { earLeft: 'NAD', skin: 'NAD' },
    };
    const result = validateDermContract(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('earRight'))).toBe(true);
  });

  it('rejects additionalProperties violations (extra fields in diet)', () => {
    const bad = {
      ...VALID_PAYLOAD,
      diet: { ...VALID_PAYLOAD.diet, unknownField: 'foo' },
    };
    const result = validateDermContract(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('additionalProperties'))).toBe(true);
  });

  it('rejects root payload that is not an object', () => {
    const result = validateDermContract('not-an-object');
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// LLM Parser Extraction Tests
// ============================================================

describe('Dermatology parse-derm LLM extraction', () => {
  const validRaw = buildDermRawOutput(VALID_PAYLOAD);

  it('extracts valid JSON from <derm_metadata_json> tags', () => {
    const parsed = extractDermMetadata(validRaw);
    expect(parsed).not.toBeNull();
    expect(parsed?.diet.active).toBe(true);
    expect(parsed?.cytology.earLeft).toBe('3+ Malassezia, 1+ Cocci');
  });

  it('returns null when tags are absent', () => {
    const parsed = extractDermMetadata('No tags here. Plain SOAP note.');
    expect(parsed).toBeNull();
  });

  it('throws JSON parse error on malformed inner JSON (logged, not swallowed)', () => {
    const malformed = `<derm_metadata_json>{ active: true }</derm_metadata_json>`;
    expect(() => extractDermMetadata(malformed)).toThrow();
  });

  it('contract-validates successfully extracted payload', () => {
    const parsed = extractDermMetadata(validRaw);
    expect(parsed).not.toBeNull();
    const result = validateDermContract(parsed!);
    expect(result.valid).toBe(true);
  });

  it('also validates the null-normalized payload through the full extraction path', () => {
    const raw = buildDermRawOutput(NULL_NORMALIZED_PAYLOAD);
    const parsed = extractDermMetadata(raw);
    expect(parsed).not.toBeNull();
    const result = validateDermContract(parsed!);
    expect(result.valid).toBe(true);
  });

  it('validates extracted payload with additional trailing characters after closing tag', () => {
    const raw = validRaw + ' EXTRA TRAILING CONTENT';
    const parsed = extractDermMetadata(raw);
    expect(parsed).not.toBeNull();
    const result = validateDermContract(parsed!);
    expect(result.valid).toBe(true);
  });
});
