import {
  DERMATOLOGY_GOLD_STANDARD,
  DERMATOLOGY_LEADER_FORMAT_REQUIRED_METADATA,
  DERMATOLOGY_LEADER_FORMAT_SEED,
  type DermatologyDiagnosticTriggerFlags,
  type DermatologyLeaderFormatPayload,
  type DermatologyLeaderFormatSeed
} from '$lib/types/dermatology';

export {
  DERMATOLOGY_GOLD_STANDARD,
  DERMATOLOGY_LEADER_FORMAT_REQUIRED_METADATA,
  DERMATOLOGY_LEADER_FORMAT_SEED
};

export type DermatologyLeaderFormatStatus =
  | 'draft_pending_specialist_approval'
  | 'active'
  | 'retired';

export type DermatologyLeaderFormatValidation = {
  valid: boolean;
  errors?: string[];
};

export type DermatologyLeaderFormatQuality = {
  missingCriticalMetadata: string[];
  completenessScore: number;
  missing: string[];
  completeness: number;
  protocolAdherenceScore: number;
  populatedRequiredPaths: number;
  totalRequiredPaths: number;
};

export type JsonSchemaLike = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNulls);
  }

  if (!isObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== null).map(([key, entryValue]) => [key, stripNulls(entryValue)]));
}

export function validateMetadata(data: unknown): DermatologyLeaderFormatValidation {
  const schema = loadDermatologySchema();
  const normalized = stripNulls(data);
  const errors = validateAgainstSchema(normalized, schema, '$');
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

export function computeQuality(data: Record<string, unknown>): DermatologyLeaderFormatQuality {
  const schema = loadDermatologySchema();
  const requiredPaths = collectRequiredPaths(schema, '$');
  const populatedRequiredPaths = requiredPaths.filter((path) => hasPath(data, path)).length;
  const missingCriticalMetadata = requiredPaths.filter((path) => !hasPath(data, path));
  const completenessScore =
    requiredPaths.length === 0
      ? 100
      : Math.round((populatedRequiredPaths / requiredPaths.length) * 100);

  return {
    missingCriticalMetadata,
    completenessScore,
    missing: missingCriticalMetadata,
    completeness: completenessScore,
    protocolAdherenceScore: computeProtocolAdherenceScore(data),
    populatedRequiredPaths,
    totalRequiredPaths: requiredPaths.length
  };
}

export function generateDiagnosticTriggers(data: Record<string, unknown>): DermatologyDiagnosticTriggerFlags {
  const triggerRationale: string[] = [];

  const dietTrial = isObject(data.dietTrial) ? data.dietTrial : {};
  const performed = dietTrial.performed === true;
  const durationWeeks = typeof dietTrial.durationWeeks === 'number' ? dietTrial.durationWeeks : 0;
  const strictness = typeof dietTrial.strictness === 'string' ? dietTrial.strictness : '';
  const outcome = typeof dietTrial.outcome === 'string' ? dietTrial.outcome : '';
  const adequateDietTrial = performed && durationWeeks >= DERMATOLOGY_GOLD_STANDARD.dietTrialMinimumWeeks && strictness === DERMATOLOGY_GOLD_STANDARD.dietTrialStrictnessRequired;
  const failedDietTrial = performed && (!adequateDietTrial || outcome === 'worse' || outcome === 'no_change');

  if (failedDietTrial) {
    triggerRationale.push('Diet trial was unsuccessful, incomplete, or below the gold-standard duration.');
  }

  const parasiteControl = isObject(data.parasiteControl) ? data.parasiteControl : {};
  const parasiteFrequencyDays = typeof parasiteControl.frequencyDays === 'number' ? parasiteControl.frequencyDays : 0;
  const parasiteDurationDays = typeof parasiteControl.durationDays === 'number' ? parasiteControl.durationDays : 0;
  const adequateParasiteControl = parasiteDurationDays >= DERMATOLOGY_GOLD_STANDARD.parasiteControlMinimumWeeks * 7 || parasiteFrequencyDays <= 31;

  const immunosuppressionHistory = Array.isArray(data.immunosuppressionHistory) ? data.immunosuppressionHistory : [];
  const incompleteSteroidWashout = immunosuppressionHistory.some((entry) => {
    if (!isObject(entry)) return false;
    const drugName = typeof entry.drugName === 'string' ? entry.drugName : '';
    const washoutWeeks = typeof entry.washoutWeeks === 'number' ? entry.washoutWeeks : 0;

    if (drugName === 'prednisolone') return washoutWeeks < DERMATOLOGY_GOLD_STANDARD.steroidWashoutMinimumWeeks;
    if (drugName === 'apoquel') return washoutWeeks < DERMATOLOGY_GOLD_STANDARD.apoquelWashoutMinimumDays / 7;
    if (drugName === 'cytopoint') return washoutWeeks < DERMATOLOGY_GOLD_STANDARD.cytopointWashoutMinimumWeeks;
    return false;
  });

  if (incompleteSteroidWashout) {
    triggerRationale.push('Immunosuppression washout is below the gold-standard threshold.');
  }

  const chiefComplaint = isObject(data.chiefComplaint) ? data.chiefComplaint : {};
  const primaryComplaint = typeof chiefComplaint.primaryComplaint === 'string' ? chiefComplaint.primaryComplaint : '';
  const secondaryComplaints = Array.isArray(chiefComplaint.secondaryComplaints) ? chiefComplaint.secondaryComplaints : [];
  const recurrentOtitis = primaryComplaint === 'otitis_externa' || secondaryComplaints.includes('otitis_externa') || secondaryComplaints.includes('recurrent otitis');
  const recurrentPyoderma = primaryComplaint === 'pyoderma' || secondaryComplaints.includes('pyoderma') || secondaryComplaints.includes('recurrent skin infection');

  if (recurrentOtitis) {
    triggerRationale.push('Recurrent otitis documented.');
  }

  if (recurrentPyoderma) {
    triggerRationale.push('Recurrent pyoderma documented.');
  }

  const favrotCriteria = isObject(data.canineAtopicDermatitisWorkup) && isObject(data.canineAtopicDermatitisWorkup.favrotCriteria)
    ? data.canineAtopicDermatitisWorkup.favrotCriteria
    : {};
  const criteriaMetCount = typeof favrotCriteria.criteriaMetCount === 'number' ? favrotCriteria.criteriaMetCount : 0;
  const favrotCriteriaMet = criteriaMetCount >= DERMATOLOGY_GOLD_STANDARD.minimumFavrotCriteriaCount;

  if (favrotCriteriaMet) {
    triggerRationale.push('FAVROT criteria met.');
  }

  const cytologySites = isObject(data.cytology) && Array.isArray(data.cytology.sites) ? data.cytology.sites : [];
  const rodsDetected = cytologySites.some((site) => isObject(site) && typeof site.rods0_4 === 'number' && site.rods0_4 > 0);

  if (rodsDetected) {
    triggerRationale.push('Rod-shaped organisms detected on cytology.');
  }

  const cultureRecommended = rodsDetected || cytologySites.some((site) => isObject(site) && typeof site.rods0_4 === 'number' && site.rods0_4 > 1);

  if (cultureRecommended) {
    triggerRationale.push('Bacterial culture is recommended before advanced allergy testing.');
  }

  const allergyTestingCandidate = favrotCriteriaMet && adequateDietTrial && adequateParasiteControl && !incompleteSteroidWashout && !cultureRecommended;

  if (allergyTestingCandidate) {
    triggerRationale.push('Allergy testing candidate after gold-standard pre-testing requirements are met.');
  }

  const referralRecommended = failedDietTrial || incompleteSteroidWashout || recurrentOtitis || recurrentPyoderma || rodsDetected || favrotCriteriaMet || cultureRecommended || allergyTestingCandidate;

  if (referralRecommended) {
    triggerRationale.push('Specialist referral is recommended by the Dermatology Leader Format.');
  }

  return {
    failedDietTrial,
    incompleteSteroidWashout,
    recurrentOtitis,
    recurrentPyoderma,
    rodsDetected,
    favrotCriteriaMet,
    allergyTestingCandidate,
    cultureRecommended,
    referralRecommended,
    triggerRationale
  };
}

export function extractMetadataBlock(text: string): string | null {
  const match = text.match(/<derm_metadata_json>\s*([\s\S]*?)\s*<\/derm_metadata_json>/);
  return match ? match[1].trim() : null;
}

export function toFirestoreSeed(): DermatologyLeaderFormatSeed {
  return DERMATOLOGY_LEADER_FORMAT_SEED;
}

export function buildLeaderFormatPayload(
  partial: Partial<DermatologyLeaderFormatPayload> & Pick<DermatologyLeaderFormatPayload, 'patient' | 'referral' | 'chiefComplaint' | 'canineAtopicDermatitisWorkup' | 'dietTrial' | 'parasiteControl' | 'immunosuppressionHistory' | 'lesionDistribution' | 'cytology' | 'diagnostics'>
): DermatologyLeaderFormatPayload {
  const triggers = generateDiagnosticTriggers(partial);
  const quality = computeQuality(partial as Record<string, unknown>);
  const now = new Date().toISOString();

  return {
    schemaVersion: 'dermatology-leader-format:v1.0.0',
    protocolId: 'LF-DERM-FNQ',
    specialty: 'Dermatology',
    protocolName: 'FNQ Canine Atopic Dermatitis Referral Standard',
    createdAt: now,
    patient: partial.patient,
    referral: partial.referral,
    chiefComplaint: partial.chiefComplaint,
    canineAtopicDermatitisWorkup: partial.canineAtopicDermatitisWorkup,
    dietTrial: partial.dietTrial,
    parasiteControl: partial.parasiteControl,
    immunosuppressionHistory: partial.immunosuppressionHistory,
    lesionDistribution: partial.lesionDistribution,
    cytology: partial.cytology,
    diagnostics: partial.diagnostics,
    diagnosticTriggerFlags: triggers,
    referralQuality: {
      protocolAdherenceScore: quality.protocolAdherenceScore,
      metadataCompletenessScore: quality.completenessScore,
      missingCriticalMetadata: quality.missingCriticalMetadata
    },
    researchDataset: {
      protocolVersion: 'dermatology-leader-format:v1.0.0',
      source: 'vetsorcery_scribe',
      clinicianConfirmed: false,
      consentForResearch: false,
      completenessScore: quality.completenessScore,
      adherenceScore: quality.protocolAdherenceScore
    },
    audit: {
      schemaValidated: validateMetadata(partial).valid,
      generatedBy: 'vetsorcery-scribe',
      generatedAt: now
    }
  };
}

function loadDermatologySchema(): JsonSchemaLike {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://aiva.vet/schemas/dermatology-leader-format-v1.json',
    title: 'AIVA Dermatology Leader Format',
    description: 'Structured clinical metadata contract for canine atopic dermatitis / chronic otitis / pruritus referrals.',
    type: 'object',
    additionalProperties: false,
    required: [
      'schemaVersion',
      'protocolId',
      'specialty',
      'createdAt',
      'patient',
      'referral',
      'chiefComplaint',
      'canineAtopicDermatitisWorkup',
      'dietTrial',
      'parasiteControl',
      'immunosuppressionHistory',
      'lesionDistribution',
      'cytology',
      'diagnostics',
      'diagnosticTriggerFlags',
      'referralQuality',
      'researchDataset',
      'audit'
    ],
    properties: {
      schemaVersion: { type: 'string', const: 'dermatology-leader-format:v1.0.0' },
      protocolId: { type: 'string' },
      specialty: { type: 'string', const: 'Dermatology' },
      protocolName: { type: 'string' },
      specialist: {
        type: 'object',
        additionalProperties: false,
        properties: {
          specialistId: { type: 'string' },
          name: { type: 'string' },
          clinic: { type: 'string' },
          role: { type: 'string' },
          clinicalAuthorityApproved: { type: 'boolean' }
        }
      },
      createdAt: { type: 'string', format: 'date-time' },
      patient: {
        type: 'object',
        additionalProperties: false,
        required: ['species', 'breed', 'ageYears', 'sex', 'weightKg'],
        properties: {
          species: { type: 'string', const: 'Canine' },
          breed: { type: 'string' },
          ageYears: { type: 'number', minimum: 0 },
          sex: { type: 'string' },
          neutered: { type: 'boolean' },
          weightKg: { type: 'number', minimum: 0 }
        }
      },
      referral: {
        type: 'object',
        additionalProperties: false,
        required: ['gpPracticeId', 'referralReason', 'urgency'],
        properties: {
          gpPracticeId: { type: 'string' },
          referralReason: { type: 'string' },
          urgency: { type: 'string', enum: ['routine', 'urgent', 'emergency'] },
          requestedSpecialistAction: { type: 'string' }
        }
      },
      chiefComplaint: {
        type: 'object',
        additionalProperties: false,
        required: ['primaryComplaint', 'durationDays', 'severityScore'],
        properties: {
          primaryComplaint: {
            type: 'string',
            enum: ['pruritus', 'otitis_externa', 'pyoderma', 'alopecia', 'pododermatitis', 'recurrent_skin_infection', 'suspected_atopy', 'other']
          },
          secondaryComplaints: { type: 'array', items: { type: 'string' } },
          durationDays: { type: 'integer', minimum: 0 },
          severityScore: { type: 'integer', minimum: 0, maximum: 10 },
          vasScore0_100: { type: 'integer', minimum: 0, maximum: 100 }
        }
      },
      canineAtopicDermatitisWorkup: {
        type: 'object',
        additionalProperties: false,
        required: ['onsetAgeYears', 'seasonality', 'chronicOrRecurrent', 'favrotCriteria', 'differentialsExcluded'],
        properties: {
          onsetAgeYears: { type: 'number', minimum: 0 },
          seasonality: { type: 'string', enum: ['seasonal', 'non_seasonal', 'unknown'] },
          chronicOrRecurrent: { type: 'boolean' },
          previousResponseToSteroids: { type: 'string', enum: ['none', 'partial', 'good', 'unknown'] },
          favrotCriteria: {
            type: 'object',
            additionalProperties: false,
            required: ['ageOnsetUnder3Years', 'houseDustMiteSensitivitySuspected', 'frontFeetAffected', 'earPinnaeAffected', 'earMarginsSpared', 'lumbosacralAreaSpared', 'otherHouseholdMembersNotAffected', 'criteriaMetCount'],
            properties: {
              ageOnsetUnder3Years: { type: 'boolean' },
              houseDustMiteSensitivitySuspected: { type: 'boolean' },
              frontFeetAffected: { type: 'boolean' },
              earPinnaeAffected: { type: 'boolean' },
              earMarginsSpared: { type: 'boolean' },
              lumbosacralAreaSpared: { type: 'boolean' },
              otherHouseholdMembersNotAffected: { type: 'boolean' },
              criteriaMetCount: { type: 'integer', minimum: 0, maximum: 7 }
            }
          },
          differentialsExcluded: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['fleas', 'mites', 'dermatophytosis', 'bacterial_pyoderma', 'malassezia', 'food_adverse_reaction', 'endocrine_disease', 'immune_mediated_disease', 'none_confirmed']
            }
          }
        }
      },
      dietTrial: {
        type: 'object',
        additionalProperties: false,
        required: ['performed', 'strictness', 'durationWeeks', 'dietType', 'outcome'],
        properties: {
          performed: { type: 'boolean' },
          strictness: { type: 'string', enum: ['strict', 'mostly_strict', 'not_strict', 'unknown', 'not_performed'] },
          durationWeeks: { type: 'integer', minimum: 0 },
          dietType: { type: 'string', enum: ['hydrolysed', 'novel_protein', 'home_cooked', 'commercial_elimination', 'unknown', 'not_performed'] },
          dietName: { type: 'string' },
          proteinSource: { type: 'string' },
          treatsOrTableScrapsAllowed: { type: 'boolean' },
          deviations: { type: 'array', items: { type: 'string' } },
          outcome: { type: 'string', enum: ['improved', 'no_change', 'worse', 'unknown', 'not_performed'] }
        }
      },
      parasiteControl: {
        type: 'object',
        additionalProperties: false,
        required: ['product', 'frequencyDays', 'lastGiven', 'compliance'],
        properties: {
          product: { type: 'string' },
          activeIngredient: { type: 'string' },
          doseMgKg: { type: 'number' },
          frequencyDays: { type: 'integer', minimum: 1 },
          lastGiven: { type: 'string', format: 'date' },
          durationDays: { type: 'integer', minimum: 0 },
          compliance: { type: 'string', enum: ['excellent', 'good', 'poor', 'unknown'] }
        }
      },
      immunosuppressionHistory: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['drugName', 'lastDoseDate', 'washoutWeeks'],
          properties: {
            drugName: { type: 'string', enum: ['prednisolone', 'apoquel', 'cytopoint', 'ciclosporin', 'other', 'none'] },
            doseMgKg: { type: 'number' },
            frequency: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            stopDate: { type: 'string', format: 'date' },
            lastDoseDate: { type: 'string', format: 'date' },
            durationDays: { type: 'integer', minimum: 0 },
            washoutWeeks: { type: 'number', minimum: 0 },
            clinicalResponse: { type: 'string', enum: ['none', 'partial', 'good', 'unknown'] },
            adverseEvents: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      lesionDistribution: {
        type: 'object',
        additionalProperties: false,
        required: ['regions'],
        properties: {
          regions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['site', 'present', 'severity0_4'],
              properties: {
                site: {
                  type: 'string',
                  enum: ['face', 'muzzle', 'pinnae', 'ear_canals', 'axillae', 'groin', 'ventrum', 'paws', 'interdigital', 'perineum', 'flexural_surfaces', 'lumbosacral', 'generalized']
                },
                present: { type: 'boolean' },
                severity0_4: { type: 'integer', minimum: 0, maximum: 4 },
                lesionTypes: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['erythema', 'papules', 'pustules', 'scale', 'crust', 'alopecia', 'excoriation', 'lichenification', 'hyperpigmentation', 'malodor', 'exudate']
                  }
                }
              }
            }
          }
        }
      },
      cytology: {
        type: 'object',
        additionalProperties: false,
        required: ['sites'],
        properties: {
          sites: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['site', 'method', 'malassezia0_4', 'cocci0_4', 'rods0_4', 'neutrophils0_4'],
              properties: {
                site: { type: 'string', enum: ['left_ear', 'right_ear', 'skin_lesion', 'interdigital', 'other'] },
                method: { type: 'string', enum: ['tape_prep', 'swab', 'impression', 'skin_scrape', 'not_performed'] },
                malassezia0_4: { type: 'integer', minimum: 0, maximum: 4 },
                cocci0_4: { type: 'integer', minimum: 0, maximum: 4 },
                rods0_4: { type: 'integer', minimum: 0, maximum: 4 },
                neutrophils0_4: { type: 'integer', minimum: 0, maximum: 4 },
                interpretation: { type: 'string' }
              }
            }
          }
        }
      },
      diagnostics: {
        type: 'object',
        additionalProperties: false,
        required: ['performed', 'recommended'],
        properties: {
          performed: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['skin_scrape', 'trichogram', 'cytology', 'bacterial_culture', 'fungal_culture', 'dermatophyte_pcr', 'wood_lamp', 'endocrine_testing', 'idexx_panel', 'allergy_testing', 'intradermal_testing', 'serum_allergy_testing', 'biopsy', 'other']
            }
          },
          recommended: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['cytology', 'bacterial_culture', 'fungal_culture', 'dermatophyte_pcr', 'idexx_panel', 'allergy_testing', 'intradermal_testing', 'serum_allergy_testing', 'biopsy', 'other']
            }
          },
          idexxPanelCandidate: { type: 'boolean' },
          idexxPanelRationale: { type: 'string' }
        }
      },
      diagnosticTriggerFlags: {
        type: 'object',
        additionalProperties: false,
        required: ['failedDietTrial', 'incompleteSteroidWashout', 'recurrentOtitis', 'recurrentPyoderma', 'rodsDetected', 'favrotCriteriaMet', 'allergyTestingCandidate', 'cultureRecommended', 'referralRecommended'],
        properties: {
          failedDietTrial: { type: 'boolean' },
          incompleteSteroidWashout: { type: 'boolean' },
          recurrentOtitis: { type: 'boolean' },
          recurrentPyoderma: { type: 'boolean' },
          rodsDetected: { type: 'boolean' },
          favrotCriteriaMet: { type: 'boolean' },
          allergyTestingCandidate: { type: 'boolean' },
          cultureRecommended: { type: 'boolean' },
          referralRecommended: { type: 'boolean' },
          triggerRationale: { type: 'array', items: { type: 'string' } }
        }
      },
      referralQuality: {
        type: 'object',
        additionalProperties: false,
        required: ['protocolAdherenceScore', 'metadataCompletenessScore', 'missingCriticalMetadata'],
        properties: {
          protocolAdherenceScore: { type: 'integer', minimum: 0, maximum: 100 },
          metadataCompletenessScore: { type: 'integer', minimum: 0, maximum: 100 },
          missingCriticalMetadata: { type: 'array', items: { type: 'string' } },
          specialistQuestions: { type: 'array', items: { type: 'string' } }
        }
      },
      researchDataset: {
        type: 'object',
        additionalProperties: false,
        required: ['protocolVersion', 'source', 'clinicianConfirmed', 'consentForResearch', 'completenessScore', 'adherenceScore'],
        properties: {
          protocolVersion: { type: 'string' },
          siteId: { type: 'string' },
          gpId: { type: 'string' },
          specialistId: { type: 'string' },
          caseId: { type: 'string' },
          source: { type: 'string', enum: ['vetsorcery_scribe', 'manual_entry', 'lab_import', 'specialist_review'] },
          clinicianConfirmed: { type: 'boolean' },
          consentForResearch: { type: 'boolean' },
          completenessScore: { type: 'integer', minimum: 0, maximum: 100 },
          adherenceScore: { type: 'integer', minimum: 0, maximum: 100 },
          diagnosticYield: { type: 'string', enum: ['not_available', 'positive', 'negative', 'inconclusive'] },
          referralFrictionMinutes: { type: 'integer', minimum: 0 },
          timeToTreatmentDays: { type: 'integer', minimum: 0 },
          outcomeFollowupDueDate: { type: 'string', format: 'date' }
        }
      },
      audit: {
        type: 'object',
        additionalProperties: false,
        required: ['schemaValidated', 'generatedBy', 'generatedAt'],
        properties: {
          schemaValidated: { type: 'boolean' },
          generatedBy: { type: 'string' },
          generatedAt: { type: 'string', format: 'date-time' },
          validatedBy: { type: 'string' },
          validatedAt: { type: 'string', format: 'date-time' },
          recordHash: { type: 'string' }
        }
      }
    }
  };
}

function validateAgainstSchema(value: unknown, schema: JsonSchemaLike, path: string): string[] {
  const errors: string[] = [];

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }

  if (schema.type === 'object') {
    if (!isObject(value)) {
      errors.push(`${path} must be an object`);
      return errors;
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(`${path}.${key} is not allowed`);
        }
      }
    }

    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required as string[] : [];

    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value && isObject(propertySchema)) {
        errors.push(...validateAgainstSchema(value[key], propertySchema, `${path}.${key}`));
      }
    }

    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return errors;
    }

    const itemsSchema = schema.items;
    if (isObject(itemsSchema)) {
      value.forEach((item, index) => {
        errors.push(...validateAgainstSchema(item, itemsSchema, `${path}[${index}]`));
      });
    }

    return errors;
  }

  if (schema.type === 'string' && typeof value !== 'string') {
    errors.push(`${path} must be a string`);
  }

  if (schema.type === 'number' && typeof value !== 'number') {
    errors.push(`${path} must be a number`);
  }

  if (schema.type === 'integer' && (!Number.isInteger(value))) {
    errors.push(`${path} must be an integer`);
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${path} must be a boolean`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  }

  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${path} must be >= ${schema.minimum}`);
  }

  if (typeof schema.maximum === 'number' && typeof value === 'number' && value > schema.maximum) {
    errors.push(`${path} must be <= ${schema.maximum}`);
  }

  return errors;
}

function collectRequiredPaths(schema: JsonSchemaLike, path: string): string[] {
  const paths: string[] = [];

  if (schema.type !== 'object' || !isObject(schema.properties)) {
    return paths;
  }

  const required = Array.isArray(schema.required) ? schema.required as string[] : [];
  for (const key of required) {
    const propertySchema = schema.properties[key];
    const nextPath = `${path}.${key}`;
    paths.push(nextPath);

    if (isObject(propertySchema) && propertySchema.type === 'object') {
      paths.push(...collectRequiredPaths(propertySchema, nextPath));
    }
  }

  return paths;
}

function hasPath(value: unknown, path: string): boolean {
  const keys = path.replace(/^\$/, '').split('.').filter(Boolean);
  let current = value;

  for (const key of keys) {
    if (!isObject(current) || !(key in current) || current[key] === null || current[key] === undefined) {
      return false;
    }
    current = current[key];
  }

  return true;
}

function computeProtocolAdherenceScore(data: Record<string, unknown>): number {
  let score = 100;
  const dietTrial = isObject(data.dietTrial) ? data.dietTrial : {};
  const parasiteControl = isObject(data.parasiteControl) ? data.parasiteControl : {};
  const immunosuppressionHistory = Array.isArray(data.immunosuppressionHistory) ? data.immunosuppressionHistory : [];

  if (dietTrial.performed === true) {
    if (typeof dietTrial.durationWeeks === 'number' && dietTrial.durationWeeks < DERMATOLOGY_GOLD_STANDARD.dietTrialMinimumWeeks) {
      score -= 15;
    }
    if (dietTrial.strictness !== DERMATOLOGY_GOLD_STANDARD.dietTrialStrictnessRequired) {
      score -= 10;
    }
  }

  if (typeof parasiteControl.durationDays === 'number' && parasiteControl.durationDays < DERMATOLOGY_GOLD_STANDARD.parasiteControlMinimumWeeks * 7) {
    score -= 10;
  }

  for (const entry of immunosuppressionHistory) {
    if (!isObject(entry)) continue;
    const drugName = typeof entry.drugName === 'string' ? entry.drugName : '';
    const washoutWeeks = typeof entry.washoutWeeks === 'number' ? entry.washoutWeeks : 0;

    if (drugName === 'prednisolone' && washoutWeeks < DERMATOLOGY_GOLD_STANDARD.steroidWashoutMinimumWeeks) score -= 15;
    if (drugName === 'apoquel' && washoutWeeks < DERMATOLOGY_GOLD_STANDARD.apoquelWashoutMinimumDays / 7) score -= 15;
    if (drugName === 'cytopoint' && washoutWeeks < DERMATOLOGY_GOLD_STANDARD.cytopointWashoutMinimumWeeks) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}
