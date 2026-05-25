/**
 * Clinic & Subscription Store
 * Resolves clinic context and subscription tier when user signs in.
 * Used to gate Pro features and scope Firestore writes.
 */
import { writable, derived } from 'svelte/store';
import { user } from './auth';
import {
    resolveClinicContext,
    getSubscriptionInfo,
    type ClinicContext,
    type SubscriptionInfo,
    type SubscriptionTier
} from '$lib/services/vetsorcery';

// Stores
export const clinicContext = writable<ClinicContext | null>(null);
export const subscription = writable<SubscriptionInfo>({
    tier: 'free',
    features: {
        cloudStructuring: false,
        revenueHunter: false,
        pimsSync: false,
        allTemplates: false
    }
});
export const clinicLoading = writable<boolean>(false);

// Derived
export const isPro = derived(subscription, ($sub) => $sub.tier !== 'free');
export const clinicId = derived(clinicContext, ($ctx) => $ctx?.clinicId || null);
export const canSyncToPIMS = derived(
    [subscription, clinicContext],
    ([$sub, $ctx]) => $sub.features.pimsSync || !!$ctx?.clinicId
);

/**
 * Initialize clinic context and subscription after auth resolves.
 * Call this once when user state changes to authenticated.
 */
export async function initClinicContext(): Promise<void> {
    clinicLoading.set(true);
    try {
        const [clinic, sub] = await Promise.all([
            resolveClinicContext(),
            getSubscriptionInfo()
        ]);
        clinicContext.set(clinic);
        subscription.set(sub);

        // Auto-populate Gemini API key from VetSorcery profile if available
        // This means Pro users don't need to manually enter BYOK
        if (clinic?.geminiApiKey && typeof window !== 'undefined') {
            const stored = localStorage.getItem('aiva_api_key');
            if (!stored) {
                localStorage.setItem('aiva_api_key', clinic.geminiApiKey);
            }
        }
    } catch (error) {
        console.error('Failed to init clinic context:', error);
    } finally {
        clinicLoading.set(false);
    }
}

// Auto-resolve when user changes
let previousUid: string | null = null;
user.subscribe(($user) => {
    if ($user && $user.uid !== previousUid) {
        previousUid = $user.uid;
        initClinicContext();
    } else if (!$user) {
        previousUid = null;
        clinicContext.set(null);
        subscription.set({
            tier: 'free',
            features: {
                cloudStructuring: false,
                revenueHunter: false,
                pimsSync: false,
                allTemplates: false
            }
        });
    }
});
