import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the loader's runtime dependencies. auth.currentUser is null so the
// loader falls back to the demo-sandbox clinic without touching Firestore auth.
vi.mock('$lib/firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('$lib/services/vetsorcery', () => ({ resolveClinicContext: vi.fn() }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn(() => ({})),
    getDoc: vi.fn()
}));

import { load } from './+page';
import { getDoc } from 'firebase/firestore';

const run = (slug: string) => (load as any)({ params: { slug } });

describe('patient/[slug] loader — Branch B handoff', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns an honest pending state (no fabricated patient) when no note exists', async () => {
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const result = await run('nonexistent-appt-abc123');

        // The key regression guard: never fabricate a synthetic patient on a miss.
        expect(result.pending).toBe(true);
        expect(result.patientContext).toBeNull();
        // activePath is still returned so the page's live onSnapshot can populate
        // the real record the moment the visit is scribed.
        expect(result.activePath).toBe('clinics/demo-sandbox/vet_notes/nonexistent-appt-abc123');
    });

    it('returns the real record (pending false) when the note exists', async () => {
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({
                registry: { patients: [{ name: 'Jasper', species: 'feline', breed: 'DSH' }] },
                content: { soap: { subjective: 'Owner reports inappetence', plan: 'Dental' } }
            })
        });

        const result = await run('aiva-realnote-1');

        expect(result.pending).toBe(false);
        expect(result.patientContext).not.toBeNull();
        expect(result.patientContext!.patient.name).toBe('Jasper');
        expect(result.patientContext!.patient.species).toBe('Feline');
        expect(result.patientContext!.soap.subjective).toBe('Owner reports inappetence');
    });
});
