import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "$lib/firebase";
import type { SOAPNote } from "$lib/types";
import { AIVA_SYSTEM_PROMPT, buildSoapPrompt, parseSoapJson, SOAP_PRIMARY_MODEL } from "$lib/soapPrompt";

/**
 * Why cloud structuring did not run, phrased for the status line. The caller
 * falls back to local keyword rules and should say which of these applied.
 */
export class CloudStructuringUnavailable extends Error {
    constructor(public reason: "signed_out" | "not_pro" | "not_configured" | "rate_limited" | "failed") {
        super(reason);
    }
}

/**
 * Cloud structuring through the VetNotes server (`/api/soap/structure`), which
 * calls Vertex with its own service account. No AI key ships in the bundle.
 */
export async function structureViaCloud(transcript: string): Promise<SOAPNote> {
    const user = auth.currentUser;
    if (!user) throw new CloudStructuringUnavailable("signed_out");
    const token = await user.getIdToken();

    const res = await fetch("/api/soap/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript })
    });
    if (res.status === 401) throw new CloudStructuringUnavailable("signed_out");
    if (res.status === 403) throw new CloudStructuringUnavailable("not_pro");
    if (res.status === 503) throw new CloudStructuringUnavailable("not_configured");
    if (res.status === 429) throw new CloudStructuringUnavailable("rate_limited");
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success || !data.soap) throw new CloudStructuringUnavailable("failed");
    return data.soap as SOAPNote;
}

export const structureNote = structureViaGemini;

/**
 * Bring-your-own-key path: calls Gemini from the browser with a key the user
 * pasted into Settings (their key, their quota). There is no built-in key.
 */
export async function structureViaGemini(transcript: string, customApiKey?: string, templatePrompt?: string): Promise<SOAPNote> {
    if (!customApiKey) throw new Error("No Gemini API key provided");

    const genAI = new GoogleGenerativeAI(customApiKey);
    const model = genAI.getGenerativeModel({
        model: SOAP_PRIMARY_MODEL,
        generationConfig: {
            temperature: 0.3, // Lower for clinical accuracy and consistency
        }
    });

    try {
        const result = await model.generateContent(buildSoapPrompt(transcript, templatePrompt || AIVA_SYSTEM_PROMPT));
        return parseSoapJson(result.response.text());
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
}
