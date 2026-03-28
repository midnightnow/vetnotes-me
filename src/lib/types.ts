import type { SOAPData } from '@vetsorcery/sdk';

export interface SOAPNote extends SOAPData {
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
