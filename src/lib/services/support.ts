/**
 * VetNotes AIVA Support Chat Service
 *
 * Standard AIVA Protocol client. Calls the central VetSorcery gateway.
 * NO local fallbacks. NO direct Gemini calls. If the gateway is down,
 * the user sees an error — not a fake "local FAQ mode" that hides the problem.
 *
 * Endpoint: POST https://us-central1-vetsorcery.cloudfunctions.net/api/public/aiva/chat
 * Protocol: { site_id, session_id, message, user_context? }
 * Response: { reply, session_id, tool_calls? }
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

// ─── AIVA Protocol Constants ──────────────────────────────────────────────

const AIVA_GATEWAY = 'https://us-central1-vetsorcery.cloudfunctions.net/api/public/aiva/chat';
const SITE_ID = 'vetnotes_me';

// ─── Session Management ───────────────────────────────────────────────────

function getSessionId(): string {
    if (typeof sessionStorage === 'undefined') return `sess_${Date.now()}`;
    let id = sessionStorage.getItem('aiva_session_id');
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('aiva_session_id', id);
    }
    return id;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    timestamp: number;
    image?: string;
}

// ─── Main Send Function ───────────────────────────────────────────────────

/**
 * Send a message to the central AIVA gateway.
 * Throws on failure — the UI must handle the error visibly.
 */
export async function sendMessage(text: string, imageBase64?: string): Promise<string> {
    const user = auth.currentUser;
    const sessionId = getSessionId();

    const res = await fetch(AIVA_GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            site_id: SITE_ID,
            session_id: sessionId,
            message: text,
            image: imageBase64 || undefined,
            user_context: user
                ? { uid: user.uid, email: user.email, name: user.displayName }
                : undefined,
        }),
    });

    if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`AIVA gateway error (${res.status}): ${errorBody}`);
    }

    const data = await res.json();
    return data.reply || "I'm here to help. Could you tell me more?";
}

// ─── TTS Helper ───────────────────────────────────────────────────────────

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

// ─── Ticket Creation ──────────────────────────────────────────────────────

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

// ─── Reset ────────────────────────────────────────────────────────────────

export function resetChat(): void {
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('aiva_session_id');
    }
}
