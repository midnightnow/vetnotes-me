/**
 * VetNotes Support Chat Service
 * Client-side Gemini chat with VetNotes-specific system prompt.
 * Creates support tickets in shared Firestore.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';

// ─── System Prompt ────────────────────────────────────────────────────────────

const VETNOTES_SUPPORT_PROMPT = `You are VetNotes Support — an AI assistant for the VetNotes.me clinical documentation app.

## About VetNotes
VetNotes.me is a free, open-source voice-to-SOAP note tool for veterinary clinicians. It records consultations, transcribes via Web Speech API, redacts PII, and structures notes into SOAP format using AI (Gemini) or local regex.

## What You Help With
- **Recording issues**: Mic permissions, browser compatibility (Chrome/Edge best), Web Speech API support
- **SOAP structuring**: How Gemini structures notes, local fallback when no API key
- **API key setup**: Settings → paste Gemini API key → enables cloud AI structuring
- **Templates**: Wellness, Sick Visit, Vaccination, Dental, Surgery, Admission (Pro has more)
- **PII redaction**: Automatic scrubbing of phone numbers, emails, addresses, names before AI processing
- **Export**: .vet file format (JSON), clipboard copy, manual editor
- **Sync to PIMS**: Requires Google Sign-In, writes SOAP to VetSorcery Firestore
- **Pro upgrade**: vetsorcery.com for full PMS (appointments, billing, inventory, PIMS sync)
- **Privacy**: Audio stays in RAM only, never uploaded, zero data retention
- **Shorthand engine**: Type *path: *tox: *lesion: *bill: *vital: for structured data entry

## Rules
- NEVER provide clinical or medical advice
- You are SOFTWARE SUPPORT only
- Be concise and helpful
- If you can't solve the issue, offer to create a support ticket
- When creating a ticket, ask for: what happened, what they expected, and steps to reproduce

## Tools
You can create support tickets when users report bugs or need human help.
When you determine a ticket should be created, respond with a JSON block like:
\`\`\`ticket
{"title": "Brief description", "category": "bug|feature|question|setup", "priority": "low|medium|high", "description": "Full details"}
\`\`\`
`;

// ─── Chat Service ─────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    ticketId?: string;
}

let chatHistory: ChatMessage[] = [];
let genAI: GoogleGenerativeAI | null = null;
let chatSession: any = null;

/**
 * Initialize or get the Gemini chat session.
 */
function getChat(apiKey: string) {
    if (!genAI || !chatSession) {
        genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: { temperature: 0.3 }
        });
        chatSession = model.startChat({
            history: [],
            systemInstruction: VETNOTES_SUPPORT_PROMPT
        });
    }
    return chatSession;
}

/**
 * Send a message and get AI response.
 */
export async function sendMessage(userMessage: string, apiKey: string): Promise<ChatMessage> {
    // Add user message to history
    chatHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
    });

    try {
        const chat = getChat(apiKey);
        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Check if response contains a ticket creation
        let ticketId: string | undefined;
        const ticketMatch = responseText.match(/```ticket\n([\s\S]*?)\n```/);
        if (ticketMatch) {
            try {
                const ticketData = JSON.parse(ticketMatch[1]);
                ticketId = await createTicket(ticketData);
            } catch (e) {
                console.error('Failed to parse/create ticket:', e);
            }
        }

        // Clean response (remove ticket JSON block from display)
        const cleanResponse = responseText.replace(/```ticket\n[\s\S]*?\n```/g, '').trim();
        const displayResponse = ticketId
            ? `${cleanResponse}\n\n✅ Support ticket created (ID: ${ticketId.slice(0, 8)})`
            : cleanResponse;

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: displayResponse,
            timestamp: Date.now(),
            ticketId
        };

        chatHistory.push(assistantMessage);
        return assistantMessage;
    } catch (error: any) {
        const errorMessage: ChatMessage = {
            role: 'assistant',
            content: error.message?.includes('API key')
                ? 'I need a Gemini API key to respond. Go to Settings and add your key, or sign in for Pro support.'
                : `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Try again or refresh the page.`,
            timestamp: Date.now()
        };
        chatHistory.push(errorMessage);
        return errorMessage;
    }
}

/**
 * Create a support ticket in Firestore.
 */
async function createTicket(data: {
    title: string;
    category: string;
    priority: string;
    description: string;
}): Promise<string> {
    const user = auth.currentUser;

    const ticketRef = await addDoc(collection(db, 'support_tickets'), {
        ...data,
        source: 'vetnotes',
        status: 'open',
        createdAt: serverTimestamp(),
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || null,
        userName: user?.displayName || 'Anonymous',
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    });

    return ticketRef.id;
}

/**
 * Get chat history.
 */
export function getChatHistory(): ChatMessage[] {
    return [...chatHistory];
}

/**
 * Clear chat history and reset session.
 */
export function clearChat(): void {
    chatHistory = [];
    chatSession = null;
}
