import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface PlayerState {
    // Identity
    playerId: string;
    displayName: string;

    // Preferences
    preferredLens: 'standard' | 'compact';

    // Stats
    totalConsultations: number;

    // Session
    lastPlayedAt: number;
}

const DEFAULT_PLAYER: PlayerState = {
    playerId: typeof crypto !== 'undefined' ? crypto.randomUUID() : 'default-player',
    displayName: 'Veterinary Professional',
    preferredLens: 'standard',
    totalConsultations: 0,
    lastPlayedAt: Date.now()
};

// Load from localStorage if available
function loadPlayerState(): PlayerState {
    if (!browser) return DEFAULT_PLAYER;

    const stored = localStorage.getItem('vetnotes_user_state');
    if (!stored) return DEFAULT_PLAYER;

    try {
        return JSON.parse(stored);
    } catch (e) {
        console.error('Failed to parse user state:', e);
        return DEFAULT_PLAYER;
    }
}

// Create the store
function createPlayerStore() {
    const { subscribe, set, update } = writable<PlayerState>(loadPlayerState());

    // Auto-save to localStorage on changes
    if (browser) {
        subscribe(state => {
            localStorage.setItem('vetnotes_user_state', JSON.stringify(state));
        });
    }

    return {
        subscribe,
        set,
        update,

        // Preferences
        setLens: (lens: 'standard' | 'compact') => update(state => ({
            ...state,
            preferredLens: lens
        })),

        // Progression
        completeConsultation: () => update(state => {
            return {
                ...state,
                totalConsultations: state.totalConsultations + 1,
                lastPlayedAt: Date.now()
            };
        }),

        // Reset (for testing)
        reset: () => set(DEFAULT_PLAYER)
    };
}

export const player = createPlayerStore();
