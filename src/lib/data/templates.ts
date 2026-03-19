export const TEMPLATES = {
  wellness: {
    id: "wellness",
    name: "Wellness Exam",
    species: ["dog", "cat"],
    prompts: ["History", "Physical Findings", "Assessment", "Preventive Plan"]
  },
  sick: {
    id: "sick",
    name: "Sick Visit",
    species: ["dog", "cat"],
    prompts: ["Chief Complaint", "History", "Exam Findings", "Assessment", "Plan"]
  },
  vaccination: {
    id: "vaccination",
    name: "Vaccination",
    species: ["dog", "cat"],
    prompts: ["Vaccines Administered", "Next Due Dates", "Notes"]
  },
  procedure: {
    id: "procedure",
    name: "Procedure",
    species: ["dog", "cat"],
    prompts: ["Procedure Performed", "Findings", "Medications", "Follow-up"]
  },
  admission: {
    id: "admission",
    name: "Admission",
    species: ["dog", "cat"],
    prompts: ["Reason for Admission", "History", "Current Medications", "Treatment Plan"]
  }
} as const;

export type TemplateId = keyof typeof TEMPLATES;
export const SOAP_TEMPLATES = TEMPLATES;
