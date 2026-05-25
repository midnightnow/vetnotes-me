/**
 * VetSorcery Integration Service
 * Handles clinic context resolution, SOAP sync to Firestore,
 * and subscription tier checks.
 */
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';
import type { SOAPNote } from '$lib/types';

// ─── Clinic Context ───────────────────────────────────────────────────────────

export interface ClinicContext {
    clinicId: string;
    clinicName: string;
    role: string;
    geminiApiKey?: string;
}

/**
 * Resolve the current user's clinic from their Firestore user doc.
 * VetSorcery stores clinic_id on the user document during onboarding.
 */
export async function resolveClinicContext(): Promise<ClinicContext | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return null;

        const data = userDoc.data();
        return {
            clinicId: data.clinic_id || data.clinicId || '',
            clinicName: data.clinic_name || data.clinicName || 'My Clinic',
            role: data.role || 'veterinarian',
            geminiApiKey: data.aivaApiKey || data.geminiApiKey || undefined
        };
    } catch (error) {
        console.error('Failed to resolve clinic context:', error);
        return null;
    }
}

/**
 * Clear cached context (call on sign-out)
 */
export function clearClinicContext(): void {
    // No-op for now — resolveClinicContext re-reads from Firestore each time
}

/**
 * Get clinic context synchronously (returns null if not yet resolved)
 */
export function getClinicContext(): ClinicContext | null {
    return null; // Stateless — use resolveClinicContext() for fresh data
}

// ─── Subscription Tier ────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface SubscriptionInfo {
    tier: SubscriptionTier;
    aivaApiKey?: string;
    features: {
        cloudStructuring: boolean;
        revenueHunter: boolean;
        pimsSync: boolean;
        allTemplates: boolean;
    };
}

/**
 * Check the user's subscription tier from Firestore.
 * Pro users get cloud structuring, Revenue Hunter, and PIMS sync.
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
    const user = auth.currentUser;
    if (!user) return FREE_TIER;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return FREE_TIER;

        const data = userDoc.data();
        const tier = (data.subscription?.tier || data.subscriptionTier || 'free') as SubscriptionTier;

        return {
            tier,
            aivaApiKey: data.aivaApiKey || data.geminiApiKey || undefined,
            features: {
                cloudStructuring: tier !== 'free',
                revenueHunter: tier !== 'free',
                pimsSync: tier !== 'free',
                allTemplates: tier !== 'free'
            }
        };
    } catch (error) {
        console.error('Failed to get subscription info:', error);
        return FREE_TIER;
    }
}

const FREE_TIER: SubscriptionInfo = {
    tier: 'free',
    features: {
        cloudStructuring: false,
        revenueHunter: false,
        pimsSync: false,
        allTemplates: false
    }
};

// ─── SOAP Sync to VetSorcery ──────────────────────────────────────────────────

export interface SyncResult {
    success: boolean;
    message: string;
    recordId?: string;
}

/**
 * Sync a SOAP note to VetSorcery's Firestore.
 * Writes to clinics/{clinicId}/medical_records/ so it appears
 * in the patient timeline on VetSorcery.
 */
export async function syncSOAPToVetSorcery(
    note: SOAPNote,
    options: {
        patientId?: string;
        patientName?: string;
        species?: string;
        template?: string;
        rawTranscript?: string;
    } = {}
): Promise<SyncResult> {
    const user = auth.currentUser;
    if (!user) {
        return { success: false, message: 'Sign in required to sync.' };
    }

    // Resolve clinic context
    const clinic = await resolveClinicContext();
    if (!clinic || !clinic.clinicId) {
        // Fallback: write to user's personal collection if no clinic
        return await syncToPersonalRecords(note, user.uid, options);
    }

    try {
        // Determine the correct Firestore path.
        // Try tenant-scoped path (new VetSorcery schema: tenants/{clinicId}/...)
        // with a fallback to clinic-scoped path (legacy: clinics/{clinicId}/...)
        const patientSegment = options.patientId
            ? `patients/${options.patientId}/medical_records`
            : 'medical_records';

        const tenantPath = `tenants/${clinic.clinicId}/${patientSegment}`;
        const clinicPath = `clinics/${clinic.clinicId}/${patientSegment}`;

        const record = {
            // SOAP content
            subjective: note.subjective,
            objective: note.objective,
            assessment: note.assessment,
            plan: note.plan,

            // Revenue detection — mapped to VetSorcery's billingItems schema
            // so the invoice auto-populates on the VetSorcery side
            missedCharges: note.missedCharges || [],
            billingItems: (note.missedCharges || []).map(charge => ({
                description: charge,
                status: 'suggested',
                source: 'revenue_hunter',
                quantity: 1,
                addedAt: new Date().toISOString(),
                reviewed: false,
                approved: false
            })),
            billing_staged: false,

            // Patient context
            patientId: options.patientId || null,
            patientName: options.patientName || 'Unknown',
            species: options.species || 'canine',

            // Metadata
            source: 'vetnotes',
            type: 'soap_note',
            template: options.template || 'general',
            createdBy: user.uid,
            createdByName: user.displayName || 'VetNotes User',
            createdByEmail: user.email,
            clinicId: clinic.clinicId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),

            // Raw data for re-processing
            rawTranscript: options.rawTranscript || null,

            // Status
            status: 'draft',
            reviewed: false
        };

        let recordRef;
        try {
            // Try tenant-scoped path first
            recordRef = await addDoc(collection(db, ...tenantPath.split('/')), record);
        } catch {
            // Fallback to clinic-scoped path
            recordRef = await addDoc(collection(db, ...clinicPath.split('/')), record);
        }

        return {
            success: true,
            message: `✅ Synced to ${clinic.clinicName}. Record available in VetSorcery.`,
            recordId: recordRef.id
        };
    } catch (error: any) {
        console.error('VetSorcery sync failed:', error);

        // If permission denied, try personal records as fallback
        if (error.code === 'permission-denied') {
            return await syncToPersonalRecords(note, user.uid, options);
        }

        return {
            success: false,
            message: `Sync failed: ${error.message || 'Unknown error'}`
        };
    }
}

/**
 * Fallback: sync to user's personal records if no clinic access.
 * These can be claimed by a clinic later during onboarding.
 */
async function syncToPersonalRecords(
    note: SOAPNote,
    uid: string,
    options: {
        patientId?: string;
        patientName?: string;
        species?: string;
        template?: string;
        rawTranscript?: string;
    }
): Promise<SyncResult> {
    try {
        const recordRef = await addDoc(
            collection(db, 'users', uid, 'soap_notes'),
            {
                subjective: note.subjective,
                objective: note.objective,
                assessment: note.assessment,
                plan: note.plan,
                missedCharges: note.missedCharges || [],
                patientName: options.patientName || 'Unknown',
                species: options.species || 'canine',
                source: 'vetnotes',
                template: options.template || 'general',
                rawTranscript: options.rawTranscript || null,
                createdAt: serverTimestamp(),
                status: 'draft'
            }
        );

        return {
            success: true,
            message: '✅ Saved to your personal records. Link a clinic in VetSorcery to enable full sync.',
            recordId: recordRef.id
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Save failed: ${error.message || 'Unknown error'}`
        };
    }
}
