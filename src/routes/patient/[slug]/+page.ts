import type { PageLoad } from './$types';
import type { VetClinicalData } from '$lib/types/vet-format';

export const load: PageLoad = async ({ params }) => {
    const slug = params.slug;

    // Generate deterministic mock data based on the slug for demonstration
    const isJasper = slug.toLowerCase().includes('jasper');
    const name = isJasper ? "Jasper" : "Patient";
    const species = isJasper ? "Feline" : "Canine";

    const patientContext: VetClinicalData = {
        metadata: {
            version: "1.1.0",
            timestamp: Date.now(),
            origin: "VetNotes",
            clientApp: "VetNotes Web"
        },
        patient: {
            id: slug.slice(0, 8),
            name: name,
            species: species,
            breed: isJasper ? "Domestic Shorthair" : "Mixed Breed"
        },
        soap: {
            subjective: `${name} presented for a general wellness examination. Owner reports normal activity and appetite.`,
            objective: "Physical examination reveals normal heart and lung sounds. Body condition score is 5/9.",
            assessment: "Healthy adult patient.",
            plan: "Continue current diet and routine parasite prevention."
        },
        charges: ["Wellness Examination", "Fecal Float"]
    };

    return {
        patientContext
    };
};
