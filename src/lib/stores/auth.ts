/**
 * Auth Store for VetNotes.me
 * Svelte writable store that tracks Firebase auth state.
 * Resolves clinic context from VetSorcery on sign-in.
 */
import { writable, derived } from 'svelte/store';
import {
    onAuthStateChanged,
    signInWithPopup,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';
import { auth, googleProvider } from '$lib/firebase';
import { resolveClinicContext, clearClinicContext, type ClinicContext } from '$lib/services/vetsorcery';

// Core auth state
export const user = writable<User | null>(null);
export const loading = writable<boolean>(true);
export const isAuthenticated = derived(user, ($user) => !!$user);

// Clinic context (resolved after sign-in)
export const clinicContext = writable<ClinicContext | null>(null);
export const hasClinic = derived(clinicContext, ($ctx) => !!$ctx);
export const isPro = derived(clinicContext, ($ctx) => 
    $ctx?.tier === 'pro' || $ctx?.tier === 'enterprise' || $ctx?.tier === 'starter'
);

// Initialize listener
let unsubscribe: (() => void) | null = null;

export function initAuth() {
    if (unsubscribe) return; // Already initialized

    unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        user.set(currentUser);
        loading.set(false);

        if (currentUser) {
            // Resolve clinic context from VetSorcery Firestore/claims
            const ctx = await resolveClinicContext();
            clinicContext.set(ctx);
        } else {
            clinicContext.set(null);
            clearClinicContext();
        }
    });
}

export async function signInWithGoogle(): Promise<void> {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
        console.error('Google Sign-In failed:', error.message);
        throw error;
    }
}

export async function signOut(): Promise<void> {
    clearClinicContext();
    clinicContext.set(null);
    await firebaseSignOut(auth);
}

// Cleanup (call on app destroy if needed)
export function destroyAuth() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
}
