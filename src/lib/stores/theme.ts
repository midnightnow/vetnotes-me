import { writable } from "svelte/store";

export type ThemeName = "daylight" | "nightshift";

const STORAGE_KEY = "vetnotes_theme";

function initial(): ThemeName {
    if (typeof window === "undefined") return "daylight";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "nightshift" ? "nightshift" : "daylight";
}

export const theme = writable<ThemeName>(initial());

theme.subscribe((value) => {
    if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, value);
    }
});

export const THEMES: { id: ThemeName; label: string; blurb: string }[] = [
    { id: "daylight", label: "Daylight", blurb: "Warm clinical light — the default" },
    { id: "nightshift", label: "Night Shift", blurb: "Slate dark for after-hours work" },
];
