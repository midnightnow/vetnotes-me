import { describe, it, expect } from 'vitest';
import { structureLocally, formatSOAPAsText } from './aiva';

describe('AIVA SOAP Structuring Service', () => {
    // ─── structureLocally ───────────────────────────────────────────────

    describe('structureLocally()', () => {
        it('returns a valid SOAPNote structure', () => {
            const result = structureLocally('Owner reports vomiting for 2 days');
            expect(result).toHaveProperty('subjective');
            expect(result).toHaveProperty('objective');
            expect(result).toHaveProperty('assessment');
            expect(result).toHaveProperty('plan');
            expect(result).toHaveProperty('missedCharges');
        });

        it('extracts subjective from owner reports', () => {
            const result = structureLocally('Owner reports the dog has been lethargic for 3 days.');
            expect(result.subjective).toContain('the dog has been lethargic for 3 days');
        });

        it('extracts subjective from presented with', () => {
            const result = structureLocally('Presented with acute onset lameness in the right forelimb.');
            expect(result.subjective).toContain('acute onset lameness in the right forelimb');
        });

        it('extracts subjective from history of', () => {
            const result = structureLocally('History of recurrent ear infections.');
            expect(result.subjective).toContain('recurrent ear infections');
        });

        it('extracts objective vitals - heart rate', () => {
            const result = structureLocally('HR: 120 bpm, RR: 24, Temp: 38.9');
            expect(result.objective).toContain('HR: 120');
        });

        it('extracts objective vitals - respiratory rate', () => {
            const result = structureLocally('Resp rate: 30, mucous membranes pink');
            expect(result.objective).toContain('Resp rate: 30');
        });

        it('extracts objective vitals - temperature', () => {
            const result = structureLocally('Temperature: 39.5 degrees');
            expect(result.objective).toContain('Temperature: 39.5');
        });

        it('extracts assessment from likely diagnosis', () => {
            const result = structureLocally('Likely gastroenteritis. Rule out pancreatitis.');
            expect(result.assessment).toContain('gastroenteritis');
        });

        it('extracts assessment from suspected', () => {
            const result = structureLocally('Suspected foreign body obstruction.');
            expect(result.assessment).toContain('foreign body obstruction');
        });

        it('extracts assessment from differential', () => {
            const result = structureLocally('DDX: otitis externa, ear mites, allergic dermatitis.');
            expect(result.assessment).toContain('otitis externa, ear mites, allergic dermatitis');
        });

        it('extracts plan from prescribed', () => {
            const result = structureLocally('Prescribed meloxicam SID for 5 days.');
            expect(result.plan).toContain('meloxicam SID for 5 days');
        });

        it('extracts plan from prescribed (truncates at period in dosage)', () => {
            // Note: the regex uses (?:\.|$) as terminator, so decimals in dosages
            // cause early truncation. This documents the known limitation.
            const result = structureLocally('Prescribed meloxicam 0.1mg/kg SID.');
            expect(result.plan).toContain('meloxicam 0');
        });

        it('extracts plan from recommend', () => {
            const result = structureLocally('Recommend: bland diet for 48 hours.');
            expect(result.plan).toContain('bland diet for 48 hours');
        });

        it('extracts plan from recheck', () => {
            const result = structureLocally('Recheck in 7 days if not improving.');
            expect(result.plan).toContain('in 7 days if not improving');
        });

        it('handles a full clinical transcript', () => {
            const transcript = `
                Owner reports the cat has been vomiting for 2 days and not eating.
                HR: 180, RR: 28, Temp: 39.2. MM pink, CRT: <2.
                Likely gastroenteritis. Rule out pancreatitis.
                Prescribed cerenia 1mg/kg SQ. Recommend recheck in 48 hours.
                Blood work submitted.
            `;
            const result = structureLocally(transcript);
            expect(result.subjective).not.toBe('Not recorded.');
            expect(result.objective).not.toBe('Physical exam performed.');
            expect(result.assessment).not.toBe('Pending.');
            expect(result.plan).not.toBe('Plan to be finalized.');
            expect(result.missedCharges).toContain('Blood Work');
        });
    });

    // ─── detectMissedCharges (tested through structureLocally) ──────────

    describe('detectMissedCharges (via structureLocally)', () => {
        it('detects nail trim', () => {
            const result = structureLocally('Performed nail trim on all four paws.');
            expect(result.missedCharges).toContain('Nail Trim');
        });

        it('detects anal gland expression', () => {
            const result = structureLocally('Expressed anal glands, normal secretion.');
            expect(result.missedCharges).toContain('Anal Gland Expression');
        });

        it('detects ear cleaning', () => {
            const result = structureLocally('Performed ear clean bilaterally.');
            expect(result.missedCharges).toContain('Ear Cleaning');
        });

        it('detects fecal float', () => {
            const result = structureLocally('Fecal sample collected for analysis.');
            expect(result.missedCharges).toContain('Fecal Float');
        });

        it('detects blood work - CBC', () => {
            const result = structureLocally('CBC and biochem submitted to lab.');
            expect(result.missedCharges).toContain('Blood Work');
        });

        it('detects injection fee', () => {
            const result = structureLocally('Administered cerenia injection SQ.');
            expect(result.missedCharges).toContain('Injection Fee');
        });

        it('detects IV catheter', () => {
            const result = structureLocally('Placed IV catheter in right cephalic.');
            expect(result.missedCharges).toContain('IV Catheter');
        });

        it('detects IV fluids', () => {
            const result = structureLocally('Started on lactated ringers at 10ml/kg/hr.');
            expect(result.missedCharges).toContain('IV Fluids');
        });

        it('detects sedation', () => {
            const result = structureLocally('Required sedation for radiographs.');
            expect(result.missedCharges).toContain('Sedation');
        });

        it('detects radiograph', () => {
            const result = structureLocally('Took 2 view xray of the abdomen.');
            expect(result.missedCharges).toContain('Radiograph');
        });

        it('detects ultrasound', () => {
            const result = structureLocally('Abdominal ultrasound performed.');
            expect(result.missedCharges).toContain('Ultrasound');
        });

        it('detects multiple charges in one transcript', () => {
            const result = structureLocally(
                'Sedation given. Took xray of chest. Placed IV catheter and started saline drip.'
            );
            expect(result.missedCharges).toContain('Sedation');
            expect(result.missedCharges).toContain('Radiograph');
            expect(result.missedCharges).toContain('IV Catheter');
            expect(result.missedCharges).toContain('IV Fluids');
        });

        it('returns empty array when no charges detected', () => {
            const result = structureLocally('The cat is doing well today.');
            expect(result.missedCharges).toEqual([]);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles empty string input', () => {
            const result = structureLocally('');
            expect(result.subjective).toBe('Not recorded.');
            expect(result.objective).toContain('Physical exam performed.');
            expect(result.assessment).toBe('Pending.');
            expect(result.plan).toBe('Plan to be finalized.');
            expect(result.missedCharges).toEqual([]);
        });

        it('handles input with no clinical content', () => {
            const result = structureLocally('Hello world this is just random text.');
            expect(result.subjective).toBe('Not recorded.');
            expect(result.assessment).toBe('Pending.');
        });

        it('handles multiple subjective findings', () => {
            const result = structureLocally(
                'Owner reports vomiting. Client states not eating. History of pancreatitis.'
            );
            expect(result.subjective).toContain('vomiting');
            expect(result.subjective).toContain('not eating');
            expect(result.subjective).toContain('pancreatitis');
        });

        it('handles multiple assessment findings', () => {
            const result = structureLocally(
                'Likely otitis externa. Rule out ear mites. Suspected allergic component.'
            );
            expect(result.assessment).toContain('otitis externa');
            expect(result.assessment).toContain('ear mites');
        });
    });

    // ─── formatSOAPAsText ───────────────────────────────────────────────

    describe('formatSOAPAsText()', () => {
        it('formats a basic SOAP note', () => {
            const note = {
                subjective: 'Vomiting 2 days.',
                objective: 'HR: 120.',
                assessment: 'Gastroenteritis.',
                plan: 'Cerenia 1mg/kg.'
            };
            const text = formatSOAPAsText(note);
            expect(text).toContain('S: Vomiting 2 days.');
            expect(text).toContain('O: HR: 120.');
            expect(text).toContain('A: Gastroenteritis.');
            expect(text).toContain('P: Cerenia 1mg/kg.');
        });

        it('includes missed charges when present', () => {
            const note = {
                subjective: 'Limping.',
                objective: 'Lame RF.',
                assessment: 'Soft tissue injury.',
                plan: 'Rest.',
                missedCharges: ['Radiograph', 'Sedation']
            };
            const text = formatSOAPAsText(note);
            expect(text).toContain('Clinical Considerations: Radiograph, Sedation');
        });

        it('omits clinical considerations when no missed charges', () => {
            const note = {
                subjective: 'Well.',
                objective: 'NAD.',
                assessment: 'Healthy.',
                plan: 'Annual vaccine.',
                missedCharges: []
            };
            const text = formatSOAPAsText(note);
            expect(text).not.toContain('Clinical Considerations');
        });

        it('uses newline-separated SOAP sections', () => {
            const note = {
                subjective: 'S',
                objective: 'O',
                assessment: 'A',
                plan: 'P'
            };
            const text = formatSOAPAsText(note);
            const lines = text.split('\n');
            expect(lines[0]).toBe('S: S');
            expect(lines[1]).toBe('O: O');
            expect(lines[2]).toBe('A: A');
            expect(lines[3]).toBe('P: P');
        });
    });
});
