/**
 * VetSorcery Integration Service
 * Handles clinic context resolution, SOAP sync to Firestore,
 * and subscription tier checks.
 */
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';
import { PAYING_PLANS, DEAD_STATUSES } from '$lib/constants/plans';
import type { SOAPNote } from '$lib/types';

// ─── Clinic Context ───────────────────────────────────────────────────────────

export interface ClinicContext {
    clinicId: string;
    clinicName: string;
    role: string;
    tier?: string;
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
            tier: data.subscription?.tier || data.subscriptionTier || 'free',
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

// Paid-plan vocabulary lives in `$lib/constants/plans` (imported at the top of
// this file) so this client gate and the server certificate gate
// (`server/cpd_entitlement.ts`) cannot disagree — they already had, and it
// paywalled paying clinics.

/**
 * Check the user's subscription tier.
 *
 * Reads the `plan` **custom auth claim**, which is the canonical paid-state
 * signal across VetSorcery: it is set server-side by `stripeWebhook.ts`,
 * carried forward by `/ensure-claims`, and revoked on cancellation. Because it
 * is server-set it cannot be forged from the client, and it costs no Firestore
 * read.
 *
 * FIXED 2026-08-04: this previously read `users/{uid}.subscription.tier` /
 * `.subscriptionTier`. **Nothing has ever written either field** — the webhook
 * writes `plan` on the user doc and `subscription.plan` on the clinic doc — so
 * every user on earth resolved to 'free' and `pimsSync` was permanently false.
 * "Sync to PIMS" was locked for paying customers, which is why no note has ever
 * synced. The clinic-record read below is a fallback for sessions whose token
 * predates the claim; refreshing the ID token is the fast path.
 */
export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
    const user = auth.currentUser;
    if (!user) return FREE_TIER;

    try {
        const token = await user.getIdTokenResult();
        let plan = typeof token.claims.plan === 'string' ? token.claims.plan : null;
        let status: string | null = null;

        // Fallback: a token minted before the plan claim existed. Resolve from
        // the clinic's subscription record, which the webhook does write.
        if (!plan) {
            const clinic = await resolveClinicContext();
            if (clinic?.clinicId) {
                const clinicDoc = await getDoc(doc(db, 'clinics', clinic.clinicId));
                const sub = clinicDoc.data()?.subscription;
                plan = typeof sub?.plan === 'string' ? sub.plan : null;
                status = typeof sub?.status === 'string' ? sub.status : null;
            }
        }

        const paid = !!plan && PAYING_PLANS.has(plan) && !(status && DEAD_STATUSES.has(status));
        if (!paid) return FREE_TIER;

        // 'enterprise' is the only tier that means more than "paid" to VetNotes.
        const tier: SubscriptionTier = plan === 'enterprise' ? 'enterprise' : 'pro';

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.exists() ? userDoc.data() : {};

        return {
            tier,
            aivaApiKey: data.aivaApiKey || data.geminiApiKey || undefined,
            features: {
                cloudStructuring: true,
                revenueHunter: true,
                pimsSync: true,
                allTemplates: true
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
 *
 * Writes to `tenants/{clinicId}/patients/{patientId}/medical_records` — the
 * cross-app integration layer VetNotes.me owns. See
 * `vetsorcery-core/docs/TENANT_ARCHITECTURE.md`: the dual `/clinics/` +
 * `/tenants/` tree is CANONICAL DESIGN, not a bug, and that document opens by
 * noting it "has been incorrectly 'fixed' 10+ times" by people who assumed
 * otherwise. `/tenants/` is where external apps write; `/clinics/` is for notes
 * created inside the PMS. It is also the path the deployed SOAP billing trigger
 * binds to, so writing here is what makes a note billable.
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
        // Destination, in priority order. `/tenants/` is VetNotes.me's own
        // integration layer (TENANT_ARCHITECTURE.md) and the path the deployed
        // SOAP billing trigger binds to, so a patient-scoped tenant write is
        // both correct and billable.
        //
        // An unlinked note (no patientId) has no tenant home — no rule matches
        // `tenants/{c}/medical_records` — so it goes clinic-level, which the
        // page reads and which the clinic-level triggers added on 2026-08-04
        // now stage charges from.
        //
        // Earlier today I rerouted ALL writes here to clinic-level, reasoning
        // that the page only read `clinics/`. That was wrong twice over: the
        // page has since learned to read both trees, and TENANT_ARCHITECTURE.md
        // exists precisely because this "fix" keeps getting made. Reverted.
        const path = options.patientId
            ? `tenants/${clinic.clinicId}/patients/${options.patientId}/medical_records`
            : `clinics/${clinic.clinicId}/medical_records`;

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

        // No try/catch around the write: a failure must reach the outer handler
        // (which falls back to personal records on permission-denied and returns
        // an honest error otherwise). The old inner `catch {}` swallowed the real
        // reason a sync failed and made every failure look like a path problem.
        const pathParts = path.split('/');
        const recordRef = await addDoc(collection(db, pathParts[0], ...pathParts.slice(1)), record);

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
