import type { PageLoad } from './$types';
import type { VetClinicalData } from '$lib/types/vet-format';
import { db, auth } from '$lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { resolveClinicContext } from '$lib/services/vetsorcery';

export const load: PageLoad = async ({ params }) => {
    const slug = params.slug;

    // Resolve clinic context for canonical .vet lookup
    let clinicId: string | null = null;
    try {
        const user = auth.currentUser;
        if (user) {
            const clinic = await resolveClinicContext();
            clinicId = clinic?.clinicId || null;
        }
    } catch {
        // unauthenticated or clinic resolution failed — fall back to demo-sandbox
    }

    const resolvedClinicId = clinicId || 'demo-sandbox';
    const activePath = `clinics/${resolvedClinicId}/vet_notes/${slug}`;

    try {
        const noteSnap = await getDoc(doc(db, activePath));
        if (noteSnap.exists()) {
            const note = noteSnap.data() as Record<string, any>;

            const exams = note?.clinical?.exams;
            const flatContent = note?.content?.soap;
            const soapData = exams?.[0]?.soap || flatContent || {};

            const patients = note?.registry?.patients || [];
            const patient = patients[0] || {};

            const charges: string[] = [];
            const finances = note?.clinical?.finances;
            if (Array.isArray(finances?.lineItems)) {
                charges.push(...finances.lineItems.map((item: any) => item.description || item.code).filter(Boolean));
            } else if (Array.isArray(note?.billing?.lineItems)) {
                charges.push(...note.billing.lineItems.map((item: any) => item.description || item.code).filter(Boolean));
            }

            const patientContext: VetClinicalData = {
                metadata: {
                    version: note?.version || '0.46.0',
                    timestamp: note?.metadata?.created_at
                        ? new Date(note.metadata.created_at).getTime()
                        : Date.now(),
                    origin: note?.metadata?.source === 'phone' || note?.metadata?.source === 'ambient' ? 'Aiva' : 'VetNotes',
                    clientApp: 'VetNotes Web',
                },
                patient: {
                    id: patient.patientId || patient.id || slug,
                    name: patient.name || 'Patient',
                    species: (patient.species || 'Canine').charAt(0).toUpperCase() + (patient.species || 'Canine').slice(1),
                    breed: patient.breed || 'Unknown',
                },
                soap: {
                    subjective: soapData.subjective || '',
                    objective: soapData.objective || '',
                    assessment: soapData.assessment || '',
                    plan: soapData.plan || '',
                },
                charges,
            };

            return { patientContext, activePath, slug };
        }
    } catch (err) {
        console.warn('[VetNotes] .vet load failed for path:', activePath, err);
    }

    const patientContext: VetClinicalData = {
        metadata: {
            version: '0.46.0',
            timestamp: Date.now(),
            origin: 'VetNotes',
            clientApp: 'VetNotes Web',
        },
        patient: {
            id: slug.slice(0, 8),
            name: 'Patient',
            species: 'Canine',
            breed: 'Unknown',
        },
        soap: {
            subjective: 'Clinical record not yet available.',
            objective: '',
            assessment: '',
            plan: '',
        },
        charges: [],
    };

    return { patientContext, activePath, slug };
};
