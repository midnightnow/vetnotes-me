/**
 * In-progress note draft persistence.
 *
 * Clinical drafts contain PHI (owner/patient names, addresses). We must protect
 * against accidental loss (reload, crash, navigation) WITHOUT leaving unredacted
 * PHI at rest on a shared clinic workstation.
 *
 * Storage choice: `sessionStorage`, not `localStorage`. sessionStorage survives
 * reload and in-tab navigation (the actual loss scenarios) but is scoped to the
 * tab session and cleared when the tab/window closes — so the next user on a
 * shared machine does NOT resurrect the previous user's patient. A TTL bounds the
 * degenerate "tab left open for hours" case.
 *
 * A prior build wrote drafts to `localStorage` (durable, cross-session). {@link
 * purgeLegacyDraft} clears that on load so already-shipped PHI is removed.
 */

export interface NoteDraft {
    raw: string;
    structured: string;
    template?: string;
    ts: number;
}

const KEY = "vetnotes_draft";
/** 12h — long enough for a working day, short enough to bound stale PHI. */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

function session(): Storage | null {
    try {
        return typeof window !== "undefined" ? window.sessionStorage : null;
    } catch {
        return null; // Storage can throw in private mode / sandboxed iframes.
    }
}

/** Remove the legacy durable draft a prior build left in localStorage (PHI). */
export function purgeLegacyDraft(): void {
    try {
        if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
    } catch {
        /* ignore */
    }
}

/** Persist the current draft, or clear it when both fields are empty. */
export function saveDraft(raw: string, structured: string, template?: string): void {
    const store = session();
    if (!store) return;
    try {
        if (raw.trim() || structured.trim()) {
            const draft: NoteDraft = { raw, structured, template, ts: Date.now() };
            store.setItem(KEY, JSON.stringify(draft));
        } else {
            store.removeItem(KEY);
        }
    } catch {
        /* quota / privacy mode — losing autosave is acceptable, crashing isn't */
    }
}

/** Load a non-empty, non-expired draft, else null. Expired/garbage is purged. */
export function loadDraft(now: number = Date.now()): NoteDraft | null {
    const store = session();
    if (!store) return null;
    try {
        const stored = store.getItem(KEY);
        if (!stored) return null;
        const draft = JSON.parse(stored) as NoteDraft;
        if (!draft || typeof draft.ts !== "number" || now - draft.ts > DRAFT_TTL_MS) {
            store.removeItem(KEY);
            return null;
        }
        if (!draft.raw?.trim() && !draft.structured?.trim()) {
            store.removeItem(KEY);
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

/** Drop the current draft. */
export function clearDraft(): void {
    try {
        session()?.removeItem(KEY);
    } catch {
        /* ignore */
    }
}
