import { describe, it, expect } from 'vitest';
import { ShorthandEngine, SHORTHAND_TRIGGERS } from './ShorthandEngine';
import type { AxisType } from './ShorthandEngine';

describe('ShorthandEngine', () => {
    // ─── scan() ─────────────────────────────────────────────────────────

    describe('scan()', () => {
        it('finds a single pathology trigger', () => {
            const matches = ShorthandEngine.scan('*path: liver biopsy');
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*path:');
            expect(matches[0].axis).toBe('pathology');
        });

        it('finds a single toxicology trigger', () => {
            const matches = ShorthandEngine.scan('*tox: chocolate ingestion');
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*tox:');
            expect(matches[0].axis).toBe('toxicology');
        });

        it('finds a single lesion trigger', () => {
            const matches = ShorthandEngine.scan('*lesion: mass on left flank');
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*lesion:');
            expect(matches[0].axis).toBe('lesion_description');
        });

        it('finds a billing trigger', () => {
            const matches = ShorthandEngine.scan('*bill: nail trim');
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*bill:');
            expect(matches[0].axis).toBe('billing');
        });

        it('finds a vital trigger', () => {
            const matches = ShorthandEngine.scan('*vital: HR 120');
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*vital:');
            expect(matches[0].axis).toBe('instrumentation');
        });

        it('finds multiple triggers in text', () => {
            const text = '*path: liver sample\n*tox: rat bait\n*lesion: ulcerated mass';
            const matches = ShorthandEngine.scan(text);
            expect(matches).toHaveLength(3);
            expect(matches[0].axis).toBe('pathology');
            expect(matches[1].axis).toBe('toxicology');
            expect(matches[2].axis).toBe('lesion_description');
        });

        it('returns correct startIndex and endIndex', () => {
            const text = '*path: sample';
            const matches = ShorthandEngine.scan(text);
            expect(matches[0].startIndex).toBe(0);
            expect(matches[0].endIndex).toBe(6); // '*path:' is 6 chars
        });

        it('finds trigger at start of line (not mid-line)', () => {
            const text = 'Some text *path: not a trigger\n*path: this is a trigger';
            const matches = ShorthandEngine.scan(text);
            // The regex uses ^...gm so only matches at start of line
            expect(matches).toHaveLength(1);
            expect(matches[0].startIndex).toBe(text.indexOf('\n*path:') + 1);
        });

        it('returns empty array when no triggers found', () => {
            const matches = ShorthandEngine.scan('Just a normal clinical note with no triggers.');
            expect(matches).toEqual([]);
        });

        it('returns empty array for empty string', () => {
            const matches = ShorthandEngine.scan('');
            expect(matches).toEqual([]);
        });

        it('handles trigger at the very start of text', () => {
            const matches = ShorthandEngine.scan('*bill: consultation fee');
            expect(matches).toHaveLength(1);
            expect(matches[0].startIndex).toBe(0);
        });

        it('handles trigger at end of text', () => {
            const text = 'Notes above\n*tox:';
            const matches = ShorthandEngine.scan(text);
            expect(matches).toHaveLength(1);
            expect(matches[0].trigger).toBe('*tox:');
        });
    });

    // ─── expand() ───────────────────────────────────────────────────────

    describe('expand()', () => {
        describe('pathology axis', () => {
            it('expands pathology with all fields', () => {
                const result = ShorthandEngine.expand('pathology', {
                    source: 'Liver',
                    method: 'Tru-cut biopsy',
                    fixative: 'Formalin',
                    history: 'Elevated ALT for 3 months'
                });
                expect(result).toContain('[PATHOLOGY MODULE]');
                expect(result).toContain('Source: Liver');
                expect(result).toContain('Sampling: Tru-cut biopsy');
                expect(result).toContain('Fixative: Formalin');
                expect(result).toContain('Clinical History: Elevated ALT for 3 months');
            });

            it('uses defaults for missing pathology fields', () => {
                const result = ShorthandEngine.expand('pathology', {});
                expect(result).toContain('Source: N/A');
                expect(result).toContain('Sampling: N/A');
                expect(result).toContain('Fixative: 10% Neutral Buffered Formalin');
                expect(result).toContain('Clinical History: See Subjective');
            });
        });

        describe('toxicology axis', () => {
            it('expands toxicology with all fields', () => {
                const result = ShorthandEngine.expand('toxicology', {
                    agent: 'Chocolate (dark)',
                    exposure_time: '2 hours',
                    signs: 'Vomiting, tachycardia',
                    decontamination: 'Apomorphine emesis'
                });
                expect(result).toContain('[TOXICOLOGY PROTOCOL]');
                expect(result).toContain('Agent: Chocolate (dark)');
                expect(result).toContain('Exposure: 2 hours ago');
                expect(result).toContain('Signs: Vomiting, tachycardia');
                expect(result).toContain('Action: Apomorphine emesis');
            });

            it('uses defaults for missing toxicology fields', () => {
                const result = ShorthandEngine.expand('toxicology', {});
                expect(result).toContain('Agent: Unknown');
                expect(result).toContain('Exposure: N/A ago');
                expect(result).toContain('Signs: N/A');
                expect(result).toContain('Action: N/A');
            });
        });

        describe('lesion_description axis', () => {
            it('expands lesion with all fields', () => {
                const result = ShorthandEngine.expand('lesion_description', {
                    morphology: 'Papule',
                    configuration: 'Clustered',
                    distribution: 'Ventral abdomen',
                    evolution: 'Progressive over 2 weeks',
                    site: 'Left flank'
                });
                expect(result).toContain('[LESION DESCRIPTION - MULTI-AXIS]');
                expect(result).toContain('Morphology: Papule');
                expect(result).toContain('Configuration: Clustered');
                expect(result).toContain('Distribution: Ventral abdomen');
                expect(result).toContain('Evolution: Progressive over 2 weeks');
                expect(result).toContain('Anatomical Site: Left flank');
            });

            it('uses defaults for missing lesion fields', () => {
                const result = ShorthandEngine.expand('lesion_description', {});
                expect(result).toContain('Morphology: N/A');
                expect(result).toContain('Configuration: N/A');
                expect(result).toContain('Distribution: N/A');
                expect(result).toContain('Anatomical Site: Unspecified');
            });

            it('uses secondary changes in evolution when no evolution provided', () => {
                const result = ShorthandEngine.expand('lesion_description', {
                    secondary: 'Crusting and alopecia'
                });
                expect(result).toContain('Evolution: Secondary changes: Crusting and alopecia');
            });
        });

        describe('billing axis', () => {
            it('expands billing with all fields', () => {
                const result = ShorthandEngine.expand('billing', {
                    code: 'CONS-001',
                    description: 'Standard Consultation',
                    qty: '1',
                    notes: 'Follow-up visit'
                });
                expect(result).toContain('[BILLING SNAPSHOT]');
                expect(result).toContain('SKU Code: CONS-001');
                expect(result).toContain('Description: Standard Consultation');
                expect(result).toContain('Quantity: 1');
                expect(result).toContain('Notes: Follow-up visit');
            });

            it('uses defaults for missing billing fields', () => {
                const result = ShorthandEngine.expand('billing', {});
                expect(result).toContain('SKU Code: UNTRACKED');
                expect(result).toContain('Description: General Service');
                expect(result).toContain('Quantity: 1');
                expect(result).toContain('Notes: Added via Volatile Bridge');
            });
        });

        describe('unknown/default axis', () => {
            it('returns JSON for unknown axis types', () => {
                const data = { foo: 'bar', baz: '123' };
                const result = ShorthandEngine.expand('instrumentation' as AxisType, data);
                expect(result).toBe(JSON.stringify(data, null, 2));
            });
        });
    });

    // ─── SHORTHAND_TRIGGERS constant ────────────────────────────────────

    describe('SHORTHAND_TRIGGERS', () => {
        it('maps *path: to pathology', () => {
            expect(SHORTHAND_TRIGGERS['*path:']).toBe('pathology');
        });

        it('maps *tox: to toxicology', () => {
            expect(SHORTHAND_TRIGGERS['*tox:']).toBe('toxicology');
        });

        it('maps *lesion: to lesion_description', () => {
            expect(SHORTHAND_TRIGGERS['*lesion:']).toBe('lesion_description');
        });

        it('maps *vital: to instrumentation', () => {
            expect(SHORTHAND_TRIGGERS['*vital:']).toBe('instrumentation');
        });

        it('maps *bill: to billing', () => {
            expect(SHORTHAND_TRIGGERS['*bill:']).toBe('billing');
        });

        it('has exactly 5 trigger mappings', () => {
            expect(Object.keys(SHORTHAND_TRIGGERS)).toHaveLength(5);
        });
    });
});
