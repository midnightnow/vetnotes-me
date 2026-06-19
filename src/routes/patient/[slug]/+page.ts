import type { PageLoad } from './$types';
import type { VetClinicalData } from '$lib/types/vet-format';
import { db } from '$lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const load: PageLoad = async ({ params }) => {
    const slug = params.slug;

    // Try to fetch the real appointment from Firestore demo-sandbox
    try {
        const apptSnap = await getDoc(doc(db, 'clinics', 'demo-sandbox', 'appointments', slug));

        if (apptSnap.exists()) {
            const appt = apptSnap.data();
            const petName = appt.patient_name || appt.pet_name || 'Unknown Patient';
            const species  = appt.patient_species || appt.species || 'Canine';
            const breed    = appt.breed || 'Mixed Breed';
            const owner    = appt.client_name || appt.owner_name || '';
            const reason   = appt.appointment_type || appt.reason || 'General Consultation';
            const dateStr  = appt.date_str || '';
            const timeStr  = appt.appointment_time || appt.time || '';

            const subjective = [
                owner ? `${owner} presented ${petName} for ${reason.toLowerCase()}.` : `${petName} presented for ${reason}.`,
                dateStr ? `Requested: ${dateStr}${timeStr ? ` at ${timeStr}` : ''}.` : '',
                appt.additional_notes || '',
            ].filter(Boolean).join(' ');

            const patientContext: VetClinicalData = {
                metadata: {
                    version: '1.1.0',
                    timestamp: appt.created_at?.toDate?.()?.getTime() ?? Date.now(),
                    origin: 'AIVA',
                    clientApp: 'VetNotes Web'
                },
                patient: {
                    id: slug.slice(0, 12),
                    name: petName,
                    species: species.charAt(0).toUpperCase() + species.slice(1),
                    breed,
                },
                soap: {
                    subjective,
                    objective: 'Physical examination pending — appointment not yet attended.',
                    assessment: `${reason} — awaiting veterinary assessment.`,
                    plan: 'Appointment scheduled. Await clinical review.',
                },
                charges: reason ? [reason] : ['General Consultation'],
            };

            return { patientContext };
        }
    } catch (err) {
        console.warn('[VetNotes] Firestore fetch failed, using fallback:', err);
    }

    // Fallback for expired/missing records
    const patientContext: VetClinicalData = {
        metadata: {
            version: '1.1.0',
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
            subjective: 'Appointment record not found or has expired (demo records clear after 24 hours).',
            objective: '',
            assessment: '',
            plan: '',
        },
        charges: [],
    };

    return { patientContext };
};
