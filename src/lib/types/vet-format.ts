import type { VetDocument, Patient, SOAPData } from '@vetsorcery/sdk';

export type SpeciesType = 'canine' | 'feline' | 'equine' | 'bovine' | 'exotic' | 'other' | string;

export type { VetDocument, Patient, SOAPData };

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

