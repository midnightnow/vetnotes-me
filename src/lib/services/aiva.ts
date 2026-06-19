// AIVA SOAP Structuring Service
// Takes raw transcript and structures it into veterinary SOAP format

const AIVA_SYSTEM_PROMPT = `You are AIVA (Augmented Intelligence for Veterinary Applications), a clinical documentation assistant.
Your role is to convert raw consultation transcripts into structured SOAP notes.

Guidelines:
- Be concise and use standard veterinary terminology
- Extract key clinical findings accurately
- Flag any mentioned but unbilled procedures
- Never fabricate clinical signs that weren't mentioned
- If information is missing, note it as "Not recorded" rather than inferring

Output Format:
S: [Subjective - owner complaints, history]
O: [Objective - physical exam findings, vitals]
A: [Assessment - differential diagnoses, clinical impression]
P: [Plan - treatments, medications, follow-up]`;

import type { SOAPNote } from '../types';
import { auth } from '$lib/firebase';

export type { SOAPNote };

const PROCEDURE_MAP: Record<string, string> = {
    'EXAM_CONSULT': 'Standard Consultation',
    'EXAM_TELEHEALTH': 'Telehealth Consultation',
    'EXAM_EMERGENCY': 'Emergency Consultation',
    'VACCINATION_CORE': 'Core Vaccination',
    'VACCINATION_RABIES': 'Rabies Vaccination',
    'DIAGNOSTIC_BLOODWORK': 'Blood Work',
    'DIAGNOSTIC_URINALYSIS': 'Fecal Float',
    'DIAGNOSTIC_XRAY': 'Radiograph',
    'DIAGNOSTIC_ULTRASOUND': 'Ultrasound',
    'DENTAL_SCALE_POLISH_LVL1': 'Dental Scale & Polish',
    'DENTAL_SCALE_POLISH_LVL2': 'Dental Scale & Polish',
    'DENTAL_SCALE_POLISH_LVL3': 'Dental Scale & Polish',
    'TOOTH_EXTRACTION_SIMPLE': 'Tooth Extraction',
    'TOOTH_EXTRACTION_SURGICAL': 'Surgical Extraction',
    'ANESTHESIA_GENERAL': 'Sedation',
    'FLUID_THERAPY_IV': 'IV Fluids',
    'HOSPITALIZATION': 'Hospitalization Fee',
    'GROOMING_NAIL_TRIM': 'Nail Trim',
    'BANDAGE_WOUND_CARE': 'Bandage Wound Care',
    'MICROCHIP': 'Microchip Implantation'
};

export async function structureToSOAP(transcript: string, useCloud = false): Promise<SOAPNote> {
    if (useCloud && typeof window !== 'undefined') {
        return await structureViaGemini(transcript);
    }
    return structureLocally(transcript);
}

async function structureViaGemini(transcript: string): Promise<SOAPNote> {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Unauthenticated');
        const token = await currentUser.getIdToken();

        const response = await fetch('/api/v1/voice-notes/extract-soap', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ transcript })
        });
        if (!response.ok) throw new Error('Gemini API call failed');
        const res = await response.json();
        if (!res.success || !res.soap) throw new Error('Failed to extract SOAP');

        const soapData = res.soap.soap;
        const clinicalIntent = res.soap.clinicalIntent;

        // Map extracted procedure taxonomy codes to human-friendly missed charges labels
        const procedures = clinicalIntent?.procedures || [];
        const missedCharges = procedures.map((p: string) => PROCEDURE_MAP[p] || p);

        return {
            subjective: soapData.subjective || 'Not recorded.',
            objective: soapData.objective || 'Not recorded.',
            assessment: soapData.assessment || 'Not recorded.',
            plan: soapData.plan || 'Not recorded.',
            missedCharges: missedCharges.length > 0 ? missedCharges : undefined
        };
    } catch (error) {
        console.error('Failed to structure via cloud API, falling back to local parsing:', error);
        return structureLocally(transcript);
    }
}

export function structureLocally(transcript: string): SOAPNote {
    return {
        subjective: extractSubjective(transcript),
        objective: extractObjective(transcript),
        assessment: extractAssessment(transcript),
        plan: extractPlan(transcript),
        missedCharges: detectMissedCharges(transcript)
    };
}

function extractSubjective(text: string): string {
    const patterns = [
        /(?:owner|client)\s+(?:reports?|states?|says?|noted?)\s+(.+?)(?:\.|$)/gi,
        /(?:presented?|came in)\s+(?:for|with)\s+(.+?)(?:\.|$)/gi,
        /history\s+of\s+(.+?)(?:\.|$)/gi
    ];
    const findings: string[] = [];
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) findings.push(match[1].trim());
    }
    return findings.length > 0 ? findings.join('. ') + '.' : 'Not recorded.';
}

function extractObjective(text: string): string {
    const patterns = [
        /(?:hr|heart rate)[:\s]+(\d+)/gi,
        /(?:rr|resp(?:iratory)? rate)[:\s]+(\d+)/gi,
        /(?:temp(?:erature)?)[:\s]+([\d.]+)/gi,
        /(?:mm|mucous membranes?)[:\s]+(\w+)/gi,
        /(?:crt)[:\s]+([<>]?\s*\d+)/gi
    ];
    const findings: string[] = [];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) findings.push(match[0]);
    }

    // Inference: if no explicit vitals but vet implies normal exam
    if (findings.length === 0) {
        const normalIndicators = /(?:healthy|normal|unremarkable|fine|good condition|bright|alert|responsive|wnl|within normal|no abnormalities)/i;
        if (normalIndicators.test(text)) {
            return 'General physical exam: No abnormalities detected on systems examined. Specific vitals not narrated.';
        }
        return 'Physical exam performed. Vitals: Not narrated.';
    }

    return findings.join('. ') + '.';
}

function extractAssessment(text: string): string {
    const patterns = [
        /(?:likely|probable|suspected?|r\/o|rule out)\s+(.+?)(?:\.|$)/gi,
        /(?:differential|ddx)[:\s]+(.+?)(?:\.|$)/gi
    ];
    const findings: string[] = [];
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) findings.push(match[1].trim());
    }
    return findings.length > 0 ? findings.join('; ') : 'Pending.';
}

function extractPlan(text: string): string {
    const findings: string[] = [];
    const patterns = [
        /(?:prescrib(?:ed?|ing)|gave|administered?|dispensed?)\s+(.+?)(?:\.|$)/gi,
        /(?:recommend|suggest|advise)[:\s]+(.+?)(?:\.|$)/gi,
        /(?:recheck|follow[- ]?up|return)\s+(.+?)(?:\.|$)/gi
    ];
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) findings.push(match[1].trim());
    }
    return findings.length > 0 ? findings.join('. ') + '.' : 'Plan to be finalized.';
}

function detectMissedCharges(text: string): string[] {
    const items = [
        { pattern: /(?:nail\s*(?:trim|clip))/gi, item: 'Nail Trim' },
        { pattern: /(?:anal\s*gland)/gi, item: 'Anal Gland Expression' },
        { pattern: /(?:ear\s*clean)/gi, item: 'Ear Cleaning' },
        { pattern: /(?:fecal|faecal|feces)/gi, item: 'Fecal Float' },
        { pattern: /(?:blood\s*(?:work|test)|cbc|biochem)/gi, item: 'Blood Work' },
        { pattern: /(?:injection|inj\.?|administered)/gi, item: 'Injection Fee' },
        { pattern: /(?:catheter|iv\s*cath)/gi, item: 'IV Catheter' },
        { pattern: /(?:fluid|lactated|lrs|saline)/gi, item: 'IV Fluids' },
        { pattern: /(?:sedation|sedate)/gi, item: 'Sedation' },
        { pattern: /(?:xray|x-ray|radiograph)/gi, item: 'Radiograph' },
        { pattern: /(?:ultrasound|sono)/gi, item: 'Ultrasound' }
    ];
    const detected: string[] = [];
    for (const { pattern, item } of items) {
        if (pattern.test(text)) detected.push(item);
    }
    return detected;
}

export function formatSOAPAsText(note: SOAPNote): string {
    let output = `S: ${note.subjective}\nO: ${note.objective}\nA: ${note.assessment}\nP: ${note.plan}`;
    if (note.missedCharges?.length) {
        output += `\n\nClinical Considerations: ${note.missedCharges.join(', ')}`;
    }
    return output;
}

export async function pushToPIMS(
    note: SOAPNote,
    pimsType: 'ezyvet' | 'rxworks' | 'ascend' = 'ezyvet',
    options: {
        patientId?: string;
        patientName?: string;
        species?: string;
        template?: string;
        rawTranscript?: string;
    } = {}
): Promise<{ success: boolean; message: string }> {
    // Use the real VetSorcery sync service
    const { syncSOAPToVetSorcery } = await import('./vetsorcery');

    try {
        const result = await syncSOAPToVetSorcery(note, options);
        return { success: result.success, message: result.message };
    } catch (error: any) {
        console.error('PIMS sync error:', error);
        return { success: false, message: `Sync failed: ${error.message || 'Unknown error'}` };
    }
}
