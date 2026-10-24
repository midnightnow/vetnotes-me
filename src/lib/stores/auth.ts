/**
 * Auth Store for VetNotes.me
 * Svelte writable store that tracks Firebase auth state.
 * Resolves clinic context from VetSorcery on sign-in.
 */
import { writable, derived } from 'svelte/store';
import {
    onAuthStateChanged,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    getIdToken,
    signOut as firebaseSignOut,
    type User
} from 'firebase/auth';
import { auth, googleProvider } from '$lib/firebase';
import { resolveClinicContext, clearClinicContext, type ClinicContext } from '$lib/services/vetsorcery';

// Core auth state
export const user = writable<User | null>(null);
export const currentUser = user; // Alias for compatibility
export const loading = writable<boolean>(true);
export const authLoading = loading; // Alias for compatibility
export const isAuthenticated = derived(user, ($user) => !!$user);

// Clinic context (resolved after sign-in)
export const clinicContext = writable<ClinicContext | null>(null);
export const hasClinic = derived(clinicContext, ($ctx) => !!$ctx);
export const isPro = derived(clinicContext, ($ctx) => 
    $ctx?.tier === 'pro' || $ctx?.tier === 'enterprise' || $ctx?.tier === 'starter'
);

// Helper to sync session cookie with server
export async function syncSessionCookie(currentUser: User | null): Promise<void> {
    try {
        if (currentUser) {
            const token = await getIdToken(currentUser, true);
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
        } else {
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: null })
            });
        }
    } catch (e) {
        console.warn('Failed to sync session cookie:', e);
    }
}

// Initialize listener
let unsubscribe: (() => void) | null = null;

export function initAuth() {
    if (unsubscribe) return; // Already initialized

    unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        user.set(currentUser);
        loading.set(false);

        if (currentUser) {
            await syncSessionCookie(currentUser);
            // Resolve clinic context from VetSorcery Firestore/claims
            const ctx = await resolveClinicContext();
            clinicContext.set(ctx);
        } else {
            clinicContext.set(null);
            clearClinicContext();
            await syncSessionCookie(null);
        }
    });
}

export async function signInWithGoogle(): Promise<User> {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await syncSessionCookie(result.user);
        return result.user;
    } catch (error: any) {
        console.error('Google Sign-In failed:', error.message);
        throw error;
    }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<User> {
    try {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        if (name && name.trim()) {
            await updateProfile(res.user, { displayName: name.trim() });
        }
        await syncSessionCookie(res.user);
        return res.user;
    } catch (error: any) {
        console.error('Sign-up failed:', error.message);
        throw error;
    }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
    try {
        const res = await signInWithEmailAndPassword(auth, email, password);
        await syncSessionCookie(res.user);
        return res.user;
    } catch (error: any) {
        console.error('Sign-in failed:', error.message);
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
