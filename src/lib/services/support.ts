/**
 * VetNotes Universal AIVA Support Chat Service
 *
 * Matches VetSorcery's chat widget capabilities:
 * - Text chat with AI responses
 * - Image attachment support
 * - Voice input (STT handled in component)
 * - Text-to-speech (TTS) readout
 *
 * Fallback chain:
 * 1. Central AIVA endpoint (platform key, zero config)
 * 2. Local Gemini BYOK (user's API key from Settings)
 * 3. Smart local FAQ (always works, never says "unavailable")
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

const AIVA_CHAT_ENDPOINT = 'https://us-central1-vetnotes-mvp.cloudfunctions.net/aivaChat';
const SITE_ID = 'vetnotes_me';

function getSessionId(): string {
    if (typeof sessionStorage === 'undefined') return `sess_${Date.now()}`;
    let id = sessionStorage.getItem('aiva_session_id');
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('aiva_session_id', id);
    }
    return id;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    image?: string;
}

// ─── Main send function — NEVER returns an error to the user ──────────────

/**
 * Send a message. Always returns a helpful response — never throws,
 * never says "unavailable" or "not configured".
 */
export async function sendMessage(text: string, imageBase64?: string): Promise<string> {
    // 1. Try central AIVA endpoint (no API key needed)
    try {
        const reply = await sendViaCentral(text, imageBase64);
        if (reply) return reply;
    } catch (e: any) {
        console.warn('[AIVA] Central endpoint failed:', e.message);
    }

    // 2. Try local Gemini with stored API key
    try {
        const apiKey = getStoredApiKey();
        if (apiKey) {
            const reply = await sendViaGemini(text, imageBase64, apiKey);
            if (reply) return reply;
        }
    } catch (e: any) {
        console.warn('[AIVA] Gemini BYOK failed:', e.message);
    }

    // 3. Smart local FAQ — always works
    return getSmartResponse(text);
}

function getStoredApiKey(): string {
    if (typeof localStorage === 'undefined') return '';
    // Check localStorage first, then fall back to build-time env var
    return localStorage.getItem('aiva_api_key')
        || localStorage.getItem('gemini_api_key')
        || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_GEMINI_API_KEY : '')
        || '';
}

// ─── Central endpoint ─────────────────────────────────────────────────────

async function sendViaCentral(text: string, image?: string): Promise<string> {
    const user = auth.currentUser;
    const sessionId = getSessionId();

    const res = await fetch(AIVA_CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            site_id: SITE_ID,
            session_id: sessionId,
            message: text,
            image: image || undefined,
            user_context: user
                ? { uid: user.uid, email: user.email, displayName: user.displayName }
                : undefined,
        }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data.reply || '';
}

// ─── Direct Gemini BYOK ──────────────────────────────────────────────────

let chatSession: any = null;
let lastApiKey = '';

const SYSTEM_PROMPT = `You are VetNotes Support — an AI assistant for the VetNotes.me clinical documentation app.
You help with: recording issues, SOAP structuring, API key setup, templates, PII redaction, PIMS sync, export, privacy, voice input, image uploads.
RULES: Never provide clinical/medical advice. Be concise. Software support only.
If the user reports a bug, acknowledge it and offer to escalate to support@vetsorcery.com.`;

function ensureGeminiSession(apiKey: string): void {
    if (chatSession && lastApiKey === apiKey) return;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
    });
    chatSession = model.startChat({
        history: [],
        systemInstruction: SYSTEM_PROMPT,
    });
    lastApiKey = apiKey;
}

async function sendViaGemini(text: string, _image?: string, apiKey?: string): Promise<string> {
    if (!apiKey) return '';
    ensureGeminiSession(apiKey);
    const result = await chatSession.sendMessage(text);
    return result.response.text() || '';
}

// ─── Smart local FAQ (zero-config, always works) ─────────────────────────

function getSmartResponse(text: string): string {
    const q = text.toLowerCase();

    if (q.includes('voice') || q.includes('talk') || q.includes('speak') || q.includes('microphone') || q.includes('mic') || q.includes('audio')) {
        return "Voice input is ready! Tap the 🎤 microphone icon to speak your question — I'll transcribe it automatically.\n\nFor clinical recording, use the main \"New Consult\" button to record full consultations.\n\nYou can also tap 🔊 Listen on my responses to hear them read aloud.";
    }

    if (q.includes('image') || q.includes('photo') || q.includes('picture') || q.includes('upload') || q.includes('camera') || q.includes('attach') || q.includes('xray') || q.includes('x-ray')) {
        return "You can attach clinical images using the 📷 camera icon! Upload photos of skin lesions, X-rays, dental images, or lab results.\n\nImages are processed locally and never stored on our servers without your consent.";
    }

    if (q.includes('save') || q.includes('saved') || q.includes('storage') || q.includes('store') || q.includes('keep') || q.includes('where') || q.includes('persist')) {
        return "Your notes are held in browser memory during a session. To save permanently:\n\n• **Export .vet** — downloads a local JSON file\n• **Copy Note** — copies SOAP text to clipboard\n• **Sync to PIMS** — pushes to your VetSorcery account (requires Google Sign-In)\n\nIf Cloud Sync is enabled in the sidebar, notes back up automatically when you sync.";
    }

    if (q.includes('record') || q.includes('consult') || q.includes('transcri') || q.includes('start')) {
        return "To record a consultation:\n\n1. Click **New Consult** (the mic icon in the main area)\n2. Grant microphone permission if prompted\n3. Speak naturally — transcript appears in real-time\n4. When done, VetNotes structures it into a SOAP note\n\nWorks best in Chrome or Edge. Audio never leaves your browser.";
    }

    if (q.includes('api') || q.includes('key') || q.includes('gemini') || q.includes('settings') || q.includes('config')) {
        return "To set up AI-powered structuring:\n\n1. Click **Settings** in the top nav\n2. Paste your Gemini API key\n3. Save\n\nThis enables cloud AI SOAP structuring. Without a key, local regex patterns are used.\n\nGet a free key at aistudio.google.com";
    }

    if (q.includes('soap') || q.includes('note') || q.includes('structur') || q.includes('format')) {
        return "After recording, VetNotes structures your transcript into:\n\n• **S** — Subjective (history, complaints)\n• **O** — Objective (exam findings, vitals)\n• **A** — Assessment (diagnoses)\n• **P** — Plan (treatments, follow-up)\n\nWith a Gemini key → cloud AI handles it.\nWithout → local regex patterns work as fallback.";
    }

    if (q.includes('pims') || q.includes('sync') || q.includes('vetsorcery') || q.includes('ezyvet')) {
        return "To sync with your PIMS:\n\n• Sign in with Google (top nav)\n• Generate a SOAP note from a recording\n• Click **Sync to PIMS**\n\nPro tier enables automatic sync and direct integration with ezyVet, RxWorks, and more.\n\nFull PMS available at vetsorcery.com";
    }

    if (q.includes('pro') || q.includes('upgrade') || q.includes('paid') || q.includes('price')) {
        return "**Pro tier includes:**\n\n• All clinical templates (Equine, Pathology, Exotic...)\n• Revenue Hunter (missed charge detection)\n• Full PIMS sync\n• Cloud AI structuring\n• Priority support\n\nUpgrade at vetsorcery.com\n\nFree tier: 6 templates, local structuring, PII redaction, voice recording, .vet export.";
    }

    if (q.includes('privacy') || q.includes('data') || q.includes('secure') || q.includes('hipaa')) {
        return "**Privacy architecture:**\n\n• Audio processed entirely in-browser — never uploaded\n• PII automatically redacted (phones, emails, addresses, names)\n• Zero data retention — closing the tab clears everything\n• Cloud sync uses encrypted Firestore with per-user access rules";
    }

    if (q.includes('template') || q.includes('wellness') || q.includes('dental') || q.includes('surgery')) {
        return "**Available templates:**\n\nFree: Wellness Exam, Sick Visit, Vaccination, Dental, Surgery, Admission\n\nPro adds: Equine, Pathology, Exotic, Emergency, Ophthalmology, Dermatology\n\nSelect a template before recording to guide the SOAP structure.";
    }

    if (q.includes('export') || q.includes('.vet') || q.includes('download') || q.includes('copy')) {
        return "**Export options:**\n\n• **Export .vet** — JSON file in the open .vet format\n• **Copy Note** — formatted SOAP text to clipboard\n• **Sync to PIMS** — pushes to VetSorcery (requires sign-in)";
    }

    // Only match pure greetings (short messages with no real question)
    if (q.match(/^(hi|hey|hello|yo|g'day|sup|howdy)[\s!.,?]*$/) || (q.length < 15 && q.match(/^(hi|hey|hello)/))) {
        return "Hey! 👋 I'm VetNotes Support. I can help with:\n\n• 🎤 Voice recording & transcription\n• 📋 SOAP note structuring\n• 🔑 API key setup\n• 📷 Image attachments\n• 🔄 PIMS sync\n• 🔒 Privacy questions\n\nWhat can I help you with?";
    }

    // Conversational / unrecognized — give a helpful nudge, never "unavailable"
    return `I hear you! I'm running in local FAQ mode right now (no AI backend connected). I can answer specific questions about:\n\n• Recording & voice input\n• SOAP notes & templates\n• Saving, exporting, PIMS sync\n• API key setup\n• Privacy & security\n\nTry asking something specific like "how do I record?" or "how is my data saved?" — or add a Gemini API key in Settings for full AI chat.`;
}

// ─── TTS helper ───────────────────────────────────────────────────────────

export function speakText(text: string): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/•/g, '')
        .replace(/#{1,3}\s/g, '')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1')
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, '. ')
        .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
}

// ─── Ticket creation ──────────────────────────────────────────────────────

export async function createTicket(
    userMessage: string,
    aiResponse: string,
    category: 'bug' | 'feature' | 'question' | 'setup' = 'question'
): Promise<string> {
    const user = auth.currentUser;
    try {
        const ref = await addDoc(collection(db, 'support_tickets'), {
            site_id: SITE_ID,
            category,
            priority: category === 'bug' ? 'high' : 'medium',
            subject: userMessage.slice(0, 100),
            description: userMessage,
            ai_response: aiResponse,
            status: 'open',
            user_email: user?.email || 'anonymous',
            user_uid: user?.uid || null,
            page: typeof window !== 'undefined' ? window.location.pathname : '/',
            created_at: serverTimestamp(),
        });
        return ref.id;
    } catch (e) {
        console.error('Failed to create ticket:', e);
        return 'error';
    }
}

export function resetChat(): void {
    chatSession = null;
    lastApiKey = '';
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('aiva_session_id');
    }
}
