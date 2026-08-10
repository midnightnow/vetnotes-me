import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
    saveDraft,
    loadDraft,
    clearDraft,
    purgeLegacyDraft,
    DRAFT_TTL_MS,
    type NoteDraft,
} from "./draftStorage";

const KEY = "vetnotes_draft";

// jsdom in this project exposes sessionStorage but not localStorage; polyfill a
// simple in-memory localStorage so the PHI/legacy-purge assertions can run.
class MemStorage {
    private m = new Map<string, string>();
    get length() {
        return this.m.size;
    }
    clear() {
        this.m.clear();
    }
    getItem(k: string) {
        return this.m.has(k) ? (this.m.get(k) as string) : null;
    }
    key(i: number) {
        return [...this.m.keys()][i] ?? null;
    }
    removeItem(k: string) {
        this.m.delete(k);
    }
    setItem(k: string, v: string) {
        this.m.set(k, String(v));
    }
}

beforeAll(() => {
    if (!window.localStorage) {
        Object.defineProperty(window, "localStorage", {
            value: new MemStorage() as unknown as Storage,
            configurable: true,
        });
    }
});

beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
});

describe("draftStorage", () => {
    it("PHI SAFETY: never writes the draft to durable localStorage", () => {
        saveDraft("Jasper, owner Jane Doe, 12 Main St", "S: emesis", "sick_visit");
        expect(window.localStorage.getItem(KEY)).toBeNull();
        expect(window.sessionStorage.getItem(KEY)).not.toBeNull();
    });

    it("round-trips a draft through sessionStorage", () => {
        saveDraft("raw note", "structured note", "wellness_exam");
        const d = loadDraft() as NoteDraft;
        expect(d.raw).toBe("raw note");
        expect(d.structured).toBe("structured note");
        expect(d.template).toBe("wellness_exam");
    });

    it("does not persist an empty draft, and clears an existing one when emptied", () => {
        saveDraft("something", "");
        expect(loadDraft()).not.toBeNull();
        saveDraft("   ", "   ");
        expect(loadDraft()).toBeNull();
        expect(window.sessionStorage.getItem(KEY)).toBeNull();
    });

    it("expires drafts older than the TTL and purges them", () => {
        saveDraft("old note", "");
        const later = Date.now() + DRAFT_TTL_MS + 1000;
        expect(loadDraft(later)).toBeNull();
        expect(window.sessionStorage.getItem(KEY)).toBeNull(); // purged, not just hidden
    });

    it("keeps a draft that is within the TTL", () => {
        saveDraft("fresh note", "");
        const soon = Date.now() + DRAFT_TTL_MS - 1000;
        expect(loadDraft(soon)?.raw).toBe("fresh note");
    });

    it("returns null (not a throw) on corrupt draft data", () => {
        window.sessionStorage.setItem(KEY, "{not valid json");
        expect(() => loadDraft()).not.toThrow();
        expect(loadDraft()).toBeNull();
    });

    it("clearDraft removes the current draft", () => {
        saveDraft("note", "");
        clearDraft();
        expect(loadDraft()).toBeNull();
    });

    it("purgeLegacyDraft removes an old localStorage draft (shipped PHI)", () => {
        window.localStorage.setItem(
            KEY,
            JSON.stringify({ raw: "leaked PHI", structured: "", ts: Date.now() }),
        );
        purgeLegacyDraft();
        expect(window.localStorage.getItem(KEY)).toBeNull();
    });
});
