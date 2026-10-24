export interface VetDocument {
  id: string;
  version: string;
  title: string;
  patientId: string;
  practiceId: string;
  createdAt: string;
  updatedAt: string;
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  moduleId: string;
  moduleVersion: string;
  metadata: any;
  research: {
    consent: boolean;
    completenessScore: number;
    adherenceScore: number;
    triggers: Record<string, any>;
  };
  audit: {
    generatedBy: string;
    validatedBy: string;
    validatedAt: string;
    recordHash: string;
  };
}

export interface VetDocumentSummary {
  id: string;
  title: string;
  moduleId: string;
  moduleVersion: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  compliance: {
    validated: boolean;
    completenessScore: number;
  };
}

export interface VetDocumentCreatePayload {
  title?: string;
  patientId: string;
  practiceId: string;
  moduleId: string;
  generatedBy: string;
  baseContent: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
}

export interface VetDocumentQuery {
  practiceId?: string;
  moduleId?: string;
  ownerId?: string;
  validated?: boolean;
}

export interface DocumentValidationResult {
  isValid: boolean;
  schemaErrors?: any[];
  quality?: {
    missing: string[];
    completeness: number;
  };
  triggers?: Record<string, any>;
}
