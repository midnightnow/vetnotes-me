/**
 * Patient Store
 * Fetches and caches the clinic's patient list from shared Firestore.
 * Used by the patient picker to link SOAP notes to real patients.
 */
import { writable, derived } from 'svelte/store';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '$lib/firebase';
import { clinicContext } from './clinic';

export interface Patient {
    id: string;
    name: string;
    species: string;
    breed?: string;
    ownerName?: string;
    ownerId?: string;
}

export const patients = writable<Patient[]>([]);
export const patientsLoading = writable<boolean>(false);
export const selectedPatient = writable<Patient | null>(null);

/**
 * Fetch patients for the current clinic.
 * Tries the tenant-scoped path first (VetSorcery new schema),
 * falls back to clinic-scoped path (VetSorcery legacy/E2E schema).
 */
export async function fetchPatients(clinicId: string): Promise<void> {
    if (!clinicId) return;

    patientsLoading.set(true);
    try {
        // Try tenant-scoped path first (new VetSorcery schema)
        let snapshot;
        try {
            const tenantsRef = collection(db, 'tenants', clinicId, 'patients');
            const q = query(tenantsRef, orderBy('name'), limit(100));
            snapshot = await getDocs(q);
        } catch {
            // Fallback: legacy clinic-scoped path (matches VetQA E2E seeds)
            const clinicsRef = collection(db, 'clinics', clinicId, 'patients');
            const q = query(clinicsRef, orderBy('name'), limit(100));
            snapshot = await getDocs(q);
        }

        const patientList: Patient[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || data.patientName || 'Unknown',
                species: data.species || 'canine',
                breed: data.breed || '',
                ownerName: data.ownerName || data.client_name || '',
                ownerId: data.ownerId || data.client_id || ''
            };
        });

        patients.set(patientList);
    } catch (error) {
        console.error('Failed to fetch patients:', error);
        patients.set([]);
    } finally {
        patientsLoading.set(false);
    }
}

/**
 * Search patients by name (client-side filter on cached list).
 */
export const searchPatients = (searchTerm: string): Patient[] => {
    let currentPatients: Patient[] = [];
    patients.subscribe(p => currentPatients = p)();

    if (!searchTerm.trim()) return currentPatients;

    const term = searchTerm.toLowerCase();
    return currentPatients.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.ownerName && p.ownerName.toLowerCase().includes(term)) ||
        p.species.toLowerCase().includes(term)
    );
};

// Auto-fetch when clinic context resolves
let previousClinicId: string | null = null;
clinicContext.subscribe(($ctx) => {
    if ($ctx?.clinicId && $ctx.clinicId !== previousClinicId) {
        previousClinicId = $ctx.clinicId;
        fetchPatients($ctx.clinicId);
    } else if (!$ctx) {
        previousClinicId = null;
        patients.set([]);
        selectedPatient.set(null);
    }
});
