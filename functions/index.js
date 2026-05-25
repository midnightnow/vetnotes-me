const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// Initialize Gemini — uses .env file in functions directory (firebase-functions v7+)
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        temperature: 0.3, // Lower for clinical accuracy
    },
});

const AIVA_SYSTEM_PROMPT = `
You are AIVA (Artificial Intelligence Veterinary Assistant).
Your task is to structure raw veterinary consultation transcripts into a professional SOAP note.

RULES:
1. Output MUST be a valid JSON object.
2. The JSON schema must be:
   - subjective (string): History, client complaints, duration, progression.
   - objective (string): Physical exam findings, vital signs.
   - assessment (string): Differential diagnoses, confirmed diagnoses.
   - plan (string): Diagnostics, treatments, medications (w/ dosages), follow-up.
   - missedCharges (array of strings): Procedures/items mentioned but potentially not billed (e.g. "Nail Trim", "Cytology", "Fluids").
3. Use professional medical terminology (e.g. "vomiting" -> "emesis").
4. Be concise and telegraphic style.
5. If the input is empty or nonsense, return fields with "Not reported".
`;

// ─── AIVA Support Chat (HTTP endpoint) ────────────────────────────────────
// Universal chat endpoint for VetNotes support widget.
// POST /aivaChat with { site_id, message, image? }
// Returns { reply: "..." }

const SUPPORT_SYSTEM_PROMPT = `You are AIVA — the AI support assistant for VetNotes.me, a free open-source voice-to-SOAP clinical documentation tool for veterinary clinicians.

You help with:
- Recording issues (mic permissions, browser compatibility, Web Speech API)
- SOAP note structuring (how AI structures notes, templates)
- API key setup (Settings → Gemini key for cloud structuring)
- Clinical templates (Wellness, Sick Visit, Vaccination, Dental, Surgery, Admission)
- PII redaction (phones, emails, addresses auto-scrubbed)
- Sync to PIMS (requires Google Sign-In, writes to VetSorcery)
- Export (.vet JSON format, clipboard copy)
- Privacy (audio stays in browser, zero cloud retention)
- Voice input in the chat widget (🎤 mic icon, Web Speech API)
- Image attachments in chat (📷 camera icon)

RULES:
1. NEVER provide clinical or medical advice. Software support only.
2. Be concise, warm, and helpful. Use markdown formatting.
3. If you can't resolve an issue, suggest emailing support@vetsorcery.com.
4. Keep responses under 150 words unless the question requires detail.
5. You can reference the user by name if provided in context.`;

exports.aivaChat = functions.https.onRequest(async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).send("");
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { message, image, site_id } = req.body || {};

    if (!message) {
        return res.status(400).json({ error: "Missing required field: message" });
    }

    if (!API_KEY) {
        return res.status(500).json({ error: "Server misconfigured: no AI key" });
    }

    try {
        const chatModel = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { temperature: 0.4, maxOutputTokens: 500 },
            systemInstruction: SUPPORT_SYSTEM_PROMPT,
        });

        const parts = [message];

        const result = await chatModel.generateContent(parts);
        const response = result.response;
        const reply = response.text();

        return res.status(200).json({ reply: reply || "I'm here to help. Could you tell me more?" });
    } catch (error) {
        console.error("AIVA Chat Error:", error);
        return res.status(500).json({ error: "AI processing failed", reply: "Sorry, I encountered an error. Please try again or email support@vetsorcery.com." });
    }
});

// ─── SOAP Note Structuring (callable) ─────────────────────────────────────

exports.structureNote = functions.https.onCall(async (data, context) => {
    const transcript = data.transcript;

    if (!transcript || typeof transcript !== "string") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a 'transcript' string."
        );
    }

    if (!API_KEY) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "Gemini API key not configured."
        );
    }

    try {
        const prompt = `
    ${AIVA_SYSTEM_PROMPT}

    RAW TRANSCRIPT:
    "${transcript}"

    JSON OUTPUT:
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if any
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Gemini Error:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to structure note via Gemini."
        );
    }
});
