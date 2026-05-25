export const TEMPLATES = {
  // ── Free Tier ────────────────────────────────────────────────────────────────
  wellness: {
    id: "wellness",
    name: "Wellness Exam",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["History", "Physical Findings", "Assessment", "Preventive Plan"]
  },
  sick: {
    id: "sick",
    name: "Sick Visit",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["Chief Complaint", "History", "Exam Findings", "Assessment", "Plan"]
  },
  vaccination: {
    id: "vaccination",
    name: "Vaccination",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["Vaccines Administered", "Next Due Dates", "Notes"]
  },
  dental: {
    id: "dental",
    name: "Dental Procedure",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["Pre-Op Assessment", "Dental Charting", "Extractions", "Post-Op Plan"]
  },
  surgery: {
    id: "surgery",
    name: "Surgery",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["Pre-Op Assessment", "Procedure Description", "Anaesthesia", "Post-Op Instructions"]
  },
  admission: {
    id: "admission",
    name: "Admission",
    species: ["dog", "cat"],
    tier: "free",
    prompts: ["Reason for Admission", "History", "Current Medications", "Treatment Plan"]
  },

  // ── Pro Tier ─────────────────────────────────────────────────────────────────
  equine_wellness: {
    id: "equine_wellness",
    name: "Equine Wellness",
    species: ["horse"],
    tier: "pro",
    prompts: ["History", "Body Condition Score", "Dental Assessment", "Lameness Evaluation", "Preventive Plan"]
  },
  equine_lameness: {
    id: "equine_lameness",
    name: "Equine Lameness",
    species: ["horse"],
    tier: "pro",
    prompts: ["Presenting Complaint", "Gait Analysis", "Flexion Tests", "Diagnostic Imaging", "Diagnosis", "Treatment Plan"]
  },
  exotic_avian: {
    id: "exotic_avian",
    name: "Avian / Exotic",
    species: ["bird", "reptile", "small mammal"],
    tier: "pro",
    prompts: ["Species & Weight", "Husbandry History", "Clinical Signs", "Physical Exam", "Assessment", "Plan"]
  },
  pathology: {
    id: "pathology",
    name: "Pathology / Biopsy",
    species: ["dog", "cat", "horse"],
    tier: "pro",
    prompts: ["Sample Description", "Gross Pathology", "Histopathology", "Diagnosis", "Clinical Significance"]
  },
  emergency: {
    id: "emergency",
    name: "Emergency / Triage",
    species: ["dog", "cat", "horse"],
    tier: "pro",
    prompts: ["Triage Score", "Presenting Emergency", "Vital Signs", "Immediate Interventions", "Stabilisation Plan", "Monitoring Parameters"]
  },
  oncology: {
    id: "oncology",
    name: "Oncology Consult",
    species: ["dog", "cat"],
    tier: "pro",
    prompts: ["Tumour History", "Staging Results", "Treatment Options Discussed", "Protocol Selected", "Monitoring Schedule"]
  },
  ophthalmology: {
    id: "ophthalmology",
    name: "Ophthalmology",
    species: ["dog", "cat", "horse"],
    tier: "pro",
    prompts: ["Chief Complaint", "Slit Lamp / Fundic Exam", "Tonometry", "Diagnosis", "Treatment & Follow-up"]
  },
  dermatology: {
    id: "dermatology",
    name: "Dermatology",
    species: ["dog", "cat"],
    tier: "pro",
    prompts: ["History & Duration", "Distribution / Pattern", "Primary Lesions", "Secondary Lesions", "Diagnosis", "Management Plan"]
  },
  cardiology: {
    id: "cardiology",
    name: "Cardiology",
    species: ["dog", "cat"],
    tier: "pro",
    prompts: ["Cardiac History", "Auscultation Findings", "ECG / Echo Summary", "ACVIM Stage", "Medical Management"]
  }
} as const;

export type TemplateId = keyof typeof TEMPLATES;
export const SOAP_TEMPLATES = TEMPLATES;

// Free tier template keys (shown without login or on free subscription)
export const FREE_TEMPLATE_KEYS: TemplateId[] = [
  "wellness", "sick", "vaccination", "dental", "surgery", "admission"
];
