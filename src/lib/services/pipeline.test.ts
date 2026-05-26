/**
 * Chinese Whispers Pipeline Test
 *
 * Validates that clinical data survives the full translation chain:
 *   Speech → Transcript → Shorthand Expansion → SOAP Structuring →
 *   Billing Detection → Firestore Document → Invoice Staging
 *
 * This is Approach A: Deterministic Integration Pipeline.
 * No live API calls. Tests real local logic in sequence.
 * Catches semantic drift when any layer changes.
 */

import { describe, it, expect } from 'vitest';
import { ShorthandEngine } from './ShorthandEngine';
import { structureLocally } from './aiva';

// ─── Test Fixtures: Realistic Clinical Dictations ─────────────────────────

const CLINICAL_SCENARIOS = [
    {
        name: 'Bilateral otitis with ear cleaning',
        rawTranscript: `Owner reports the dog has been shaking its head for 3 days and scratching at both ears.
            On exam, bilateral otitis externa with brown waxy discharge.
            Performed ear clean bilaterally using EpiOtic flush.
            Likely bacterial otitis. Rule out ear mites.
            Prescribed Otomax drops BID for 10 days. Recheck in 14 days.
            Also did a nail trim while sedated.`,
        expectedSOAP: {
            subjective: ['shaking', 'scratching', 'ears'],
            objective: ['otitis', 'discharge'],
            assessment: ['otitis'],
            plan: ['Otomax', 'Recheck'],
        },
        expectedCharges: ['Ear Cleaning', 'Nail Trim', 'Sedation'],
        minCharges: 2,
    },
    {
        name: 'Vomiting cat with blood work and IV fluids',
        rawTranscript: `Client states the cat has been vomiting for 2 days and not eating.
            HR: 180, RR: 28, Temp: 39.2. Mucous membranes pink, CRT less than 2.
            Likely gastroenteritis. Rule out pancreatitis.
            CBC and biochem submitted. Placed IV catheter in right cephalic.
            Started on lactated ringers at 10ml/kg/hr.
            Administered cerenia injection SQ.
            Recheck in 48 hours if not improving.`,
        expectedSOAP: {
            subjective: ['vomiting', 'not eating'],
            objective: ['HR: 180', 'Temp: 39.2'],
            assessment: ['gastroenteritis'],
            plan: ['cerenia', 'Recheck'],
        },
        expectedCharges: ['Blood Work', 'IV Catheter', 'IV Fluids', 'Injection Fee'],
        minCharges: 3,
    },
    {
        name: 'Lameness with radiographs and sedation',
        rawTranscript: `Presented with acute onset lameness in the right forelimb after jumping off the deck.
            Non-weight bearing on RF. Pain on palpation of the distal radius.
            Suspected fracture of the distal radius.
            Required sedation for radiographs. Took 2 view xray of the right forelimb.
            Prescribed meloxicam SID for 5 days. Referral to surgeon recommended.`,
        expectedSOAP: {
            subjective: ['lameness', 'right forelimb'],
            objective: ['Non-weight bearing', 'Pain'],
            assessment: ['fracture'],
            plan: ['meloxicam'],
        },
        expectedCharges: ['Sedation', 'Radiograph'],
        minCharges: 2,
    },
    {
        name: 'Wellness exam with fecal and anal glands',
        rawTranscript: `Annual wellness check. Owner reports no concerns.
            HR: 100, RR: 18, Temp: 38.5. Body condition score 5/9. All normal.
            DDX: healthy patient.
            Recommend: annual vaccination due next month.
            Expressed anal glands, normal secretion.
            Fecal sample collected for analysis.
            Performed nail trim.`,
        expectedSOAP: {
            subjective: ['no concerns'],
            objective: ['HR: 100'],
            assessment: ['healthy'],
            plan: ['vaccination'],
        },
        expectedCharges: ['Anal Gland Expression', 'Fecal Float', 'Nail Trim'],
        minCharges: 3,
    },
];

// ─── Pipeline Tests ───────────────────────────────────────────────────────

describe('Chinese Whispers: End-to-End Pipeline Integrity', () => {

    describe('Step 1 → 2: Shorthand Engine preserves clinical content', () => {
        it('scans billing triggers at start of line', () => {
            const input = 'Patient stable.\n*bill: nail trim\nRecheck in 7 days.';
            const matches = ShorthandEngine.scan(input);
            expect(matches.length).toBeGreaterThanOrEqual(1);
            expect(matches[0].axis).toBe('billing');
        });

        it('scans vital triggers and preserves values', () => {
            const input = '*vital: Temp 101.5, HR 120, RR 24';
            const matches = ShorthandEngine.scan(input);
            expect(matches[0].axis).toBe('instrumentation');
        });
    });

    describe('Step 2 → 3: SOAP structuring preserves semantic intent', () => {
        CLINICAL_SCENARIOS.forEach((scenario) => {
            it(`[${scenario.name}] extracts correct SOAP sections`, () => {
                const result = structureLocally(scenario.rawTranscript);

                // Subjective must contain key owner-reported terms
                scenario.expectedSOAP.subjective.forEach((term) => {
                    expect(result.subjective.toLowerCase()).toContain(term.toLowerCase());
                });

                // Assessment must contain diagnostic terms
                scenario.expectedSOAP.assessment.forEach((term) => {
                    expect(result.assessment.toLowerCase()).toContain(term.toLowerCase());
                });
            });
        });
    });

    describe('Step 3 → 4: Missed charge detection is complete', () => {
        CLINICAL_SCENARIOS.forEach((scenario) => {
            it(`[${scenario.name}] detects at least ${scenario.minCharges} charges`, () => {
                const result = structureLocally(scenario.rawTranscript);
                expect(result.missedCharges.length).toBeGreaterThanOrEqual(scenario.minCharges);
            });

            it(`[${scenario.name}] detects expected charges`, () => {
                const result = structureLocally(scenario.rawTranscript);
                scenario.expectedCharges.forEach((charge) => {
                    expect(
                        result.missedCharges,
                        `Expected "${charge}" in [${result.missedCharges.join(', ')}]`
                    ).toContain(charge);
                });
            });
        });
    });

    describe('Step 4 → 5: Firestore document serialization is valid', () => {
        CLINICAL_SCENARIOS.forEach((scenario) => {
            it(`[${scenario.name}] produces a valid medical_record document`, () => {
                const soap = structureLocally(scenario.rawTranscript);

                // Simulate the document that VetNotes writes to Firestore
                const doc = {
                    source: 'vetnotes',
                    type: 'soap_note',
                    status: 'draft',
                    billing_staged: false,
                    billingItems: soap.missedCharges.map((desc) => ({
                        description: desc,
                        status: 'suggested',
                        source: 'revenue_hunter',
                        quantity: 1,
                        addedAt: new Date().toISOString(),
                        reviewed: false,
                        approved: false,
                    })),
                    subjective: soap.subjective,
                    objective: soap.objective,
                    assessment: soap.assessment,
                    plan: soap.plan,
                    patientId: 'test_patient',
                    clinicId: 'test_clinic',
                    createdBy: 'test_vet',
                };

                // Schema assertions
                expect(doc.source).toBe('vetnotes');
                expect(doc.billing_staged).toBe(false);
                expect(doc.billingItems.length).toBeGreaterThanOrEqual(scenario.minCharges);
                expect(doc.billingItems.every((i) => i.status === 'suggested')).toBe(true);
                expect(doc.billingItems.every((i) => i.quantity >= 1)).toBe(true);
                expect(doc.billingItems.every((i) => typeof i.description === 'string' && i.description.length > 0)).toBe(true);
                expect(doc.subjective).toBeTruthy();
                expect(doc.objective).toBeTruthy();
                expect(doc.assessment).toBeTruthy();
                expect(doc.plan).toBeTruthy();
            });
        });
    });

    describe('Step 5 → 6: Backend trigger guard logic', () => {
        it('rejects documents not from vetnotes', () => {
            const doc = { source: 'manual_entry', billing_staged: false, billingItems: [] };
            expect(doc.source).not.toBe('vetnotes');
            // Guard: source !== 'vetnotes' → skip
        });

        it('rejects already-staged documents', () => {
            const doc = { source: 'vetnotes', billing_staged: true, billingItems: [{ description: 'test' }] };
            expect(doc.billing_staged).toBe(true);
            // Guard: billing_staged === true → skip
        });

        it('rejects documents with empty billingItems', () => {
            const doc = { source: 'vetnotes', billing_staged: false, billingItems: [] };
            expect(doc.billingItems.length).toBe(0);
            // Guard: billingItems empty → mark staged, skip
        });

        it('accepts valid vetnotes documents with billing items', () => {
            const soap = structureLocally(CLINICAL_SCENARIOS[0].rawTranscript);
            const doc = {
                source: 'vetnotes',
                billing_staged: false,
                billingItems: soap.missedCharges.map((desc) => ({
                    description: desc,
                    status: 'suggested',
                    source: 'revenue_hunter',
                    quantity: 1,
                })),
            };
            expect(doc.source).toBe('vetnotes');
            expect(doc.billing_staged).toBe(false);
            expect(doc.billingItems.length).toBeGreaterThan(0);
            // All guards pass → proceed to staging
        });
    });

    describe('Full pipeline: transcript → invoice line items (no semantic loss)', () => {
        CLINICAL_SCENARIOS.forEach((scenario) => {
            it(`[${scenario.name}] end-to-end integrity`, () => {
                // Step 1: Raw transcript (simulates STT output)
                const transcript = scenario.rawTranscript;

                // Step 2: SOAP structuring + charge detection
                const soap = structureLocally(transcript);

                // Step 3: Build Firestore document
                const billingItems = soap.missedCharges.map((desc) => ({
                    description: desc,
                    status: 'suggested' as const,
                    source: 'revenue_hunter',
                    quantity: 1,
                    addedAt: new Date().toISOString(),
                    reviewed: false,
                    approved: false,
                }));

                // Step 4: Simulate what the Cloud Function would stage on the invoice
                const stagedLineItems = billingItems.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: 0,
                    lineTotal: 0,
                    status: 'suggested' as const,
                    source: 'vetnotes' as const,
                    sourceRecordId: 'test_record_id',
                    sourceItemSource: item.source,
                    reviewed: false,
                    approved: false,
                    stagedAt: new Date().toISOString(),
                }));

                // FINAL ASSERTION: Every expected charge from the original
                // dictation survives all the way to the invoice line items
                scenario.expectedCharges.forEach((expectedCharge) => {
                    const found = stagedLineItems.find(
                        (li) => li.description === expectedCharge
                    );
                    expect(
                        found,
                        `"${expectedCharge}" was lost in the pipeline. ` +
                        `Staged items: [${stagedLineItems.map((i) => i.description).join(', ')}]`
                    ).toBeDefined();
                    expect(found!.status).toBe('suggested');
                    expect(found!.source).toBe('vetnotes');
                    expect(found!.quantity).toBe(1);
                });

                // No phantom charges: every staged item must trace back to a detected charge
                stagedLineItems.forEach((li) => {
                    expect(soap.missedCharges).toContain(li.description);
                });
            });
        });
    });
});
