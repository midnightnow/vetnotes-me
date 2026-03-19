export interface SoapTemplate {
    name: string;
    species: string[];
    subjective_prompts: string[];
    objective_checklist: string[];
}

export const SOAP_TEMPLATES: Record<string, SoapTemplate> = {
    wellness_exam: {
        name: "Wellness Examination",
        species: ["dog", "cat"],
        subjective_prompts: [
            "Activity level and behavior at home",
            "Appetite and water consumption",
            "Urination and defecation habits",
            "Any concerns from owner"
        ],
        objective_checklist: [
            "Weight and BCS",
            "Temperature, pulse, respiration",
            "Eyes, ears, nose, throat",
            "Oral exam and dental assessment",
            "Lymph nodes",
            "Heart and lung auscultation",
            "Abdominal palpation",
            "Musculoskeletal assessment",
            "Skin and coat",
            "Neurological assessment"
        ]
    },
    sick_visit: {
        name: "Sick Patient Visit",
        species: ["dog", "cat"],
        subjective_prompts: [
            "Duration and progression of symptoms",
            "Appetite changes",
            "Vomiting/diarrhea (frequency, appearance)",
            "Energy level changes",
            "Recent travel or exposure"
        ],
        objective_checklist: [
            "Vital signs",
            "Hydration status",
            "MM color and CRT",
            "Focused exam based on symptoms",
            "Pain assessment"
        ]
    },
    vaccination: {
        name: "Vaccination Visit",
        species: ["dog", "cat"],
        subjective_prompts: [
            "Previous vaccine reactions",
            "Current health status",
            "Lifestyle factors for vaccine selection"
        ],
        objective_checklist: [
            "Weight",
            "Temperature",
            "General health assessment",
            "Injection site assessment"
        ]
    },
    dental: {
        name: "Dental Procedure",
        species: ["dog", "cat"],
        subjective_prompts: [
            "Eating habits and preferences",
            "Signs of oral pain",
            "Home dental care routine",
            "Anesthetic history"
        ],
        objective_checklist: [
            "Pre-anesthetic exam",
            "Oral exam findings",
            "Dental chart completion",
            "Radiographic findings"
        ]
    },
    surgery: {
        name: "Surgical Procedure",
        species: ["any"],
        subjective_prompts: [
            "Pre-surgical fasting confirmation",
            "Current stability",
            "Owner consent for procedure/biopsy"
        ],
        objective_checklist: [
            "Pre-anesthetic TPR",
            "ASA status",
            "Incision site/Location",
            "Anesthetic duration",
            "Complications (if any)"
        ]
    },
    admission: {
        name: "Hospital Admission",
        species: ["any"],
        subjective_prompts: [
            "Primary reason for hospitalization",
            "Duration of intended stay",
            "Emergency contact details confirmed"
        ],
        objective_checklist: [
            "Baseline vital signs",
            "Current mental status",
            "IV access secured",
            "Treatment sheet initiated"
        ]
    }
};

export const SPECIES_PAIN_GUIDANCE = {
    feline: {
        pain_note: "Cats are masters at hiding pain. A 'normal' appearing cat may be in significant distress.",
        behavior_cues: ["Hiding more than usual", "Decreased grooming", "Change in facial expression", "Decreased appetite"],
        exam_focus: ["Facial grimace scale", "Mobility assessment", "Abdominal palpation response"]
    },
    canine: {
        pain_note: "Dogs are more expressive but may still underreport pain, especially chronic conditions.",
        behavior_cues: ["Restlessness", "Vocalization", "Guarding behavior", "Reluctance to move"],
        exam_focus: ["Gait analysis", "Palpation response", "Range of motion"]
    },
    equine: {
        pain_note: "Horses may mask pain as prey animals. Watch for subtle behavioral changes.",
        behavior_cues: ["Weight shifting", "Pawing", "Flank watching", "Decreased feed intake"],
        exam_focus: ["Heart rate", "Gut sounds", "Digital pulses", "Posture"]
    },
    avian: {
        pain_note: "Birds strongly mask illness until severely compromised. Assume worse than presented.",
        behavior_cues: ["Fluffed feathers", "Decreased vocalization", "Position on perch", "Eye closure"],
        exam_focus: ["Weight", "Keel prominence", "Respiratory effort", "Vent condition"]
    }
};
