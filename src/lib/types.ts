/**
 * Core VetNotes Types
 */

export interface SOAPNote {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    missedCharges?: string[];
}

export interface VetClinicalData {
    metadata: {
        version: string;
        timestamp: number;
        origin: "VetNotes" | "Aiva";
        clientApp: string;
    };
    patient: {
        id?: string;
        name?: string;
        species?: string;
        breed?: string;
    };
    soap: {
        subjective: string;
        objective: string;
        assessment: string;
        plan: string;
    };
    charges: string[];
}
