import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    credential: applicationDefault() // Needs to be configured correctly in the environment
  });
}

const db = getFirestore();

async function seedCase1() {
  console.log('Seeding Case 1: Canine Pneumonia & Alveolar Patterns...');

  const caseId = 'case_rad_001_pnuemonia';

  // 1. Seed the Public Case Data
  const publicData = {
    id: "case_rad_001_pnuemonia",
    schema_version: "1.0.0",
    is_free: true,
    module_id: "mod_rad_thoracic_01",
    sequence_number: 1,
    title: "Canine Pneumonia & Alveolar Patterns",
    difficulty: "Intermediate",
    estimated_duration_minutes: 60,
    accreditation_hours: 1.0,
    targeted_competencies: ["COMP_1", "COMP_2", "COMP_3", "COMP_4", "COMP_5"],
    signalment: {
      species: "Canine",
      breed: "Cavalier King Charles Spaniel",
      age_years: 9,
      sex: "Male Neutered",
      weight_kg: 8.4
    },
    clinical_history: "Presented for a soft, productive cough of 3 weeks duration, progressively worsening at night. Acute onset of moderate tachypnoea (resting respiratory rate: 48 bpm) noted this morning.",
    physical_examination: "Grade IV/VI holosystolic murmur loudest at the left apex. Mild bilateral crackles auscultated over the caudodorsal lung fields.",
    raw_images: [
      {
        image_id: "img_rad_001_lat",
        view: "Left Lateral Thorax",
        url: "https://storage.googleapis.com/vetsorcery/educational/case_rad_001/lat_view.jpg",
        is_educational: true
      },
      {
        image_id: "img_rad_001_vd",
        view: "Ventro-Dorsal Thorax",
        url: "https://storage.googleapis.com/vetsorcery/educational/case_rad_001/vd_view.jpg",
        is_educational: true
      }
    ],
    quiz_questions: [
      {
        id: "q_rad_001_01",
        question: "On the lateral thoracic view, what specific anatomical displacement confirms significant left atrial enlargement in this patient?",
        options: [
          "Ventral displacement of the mainstem bronchi.",
          "Dorsal displacement of the intrathoracic trachea and mainstem bronchi.",
          "Cranial displacement of the cranial lung lobes.",
          "Leftward deviation of the thoracic esophagus."
        ]
      },
      {
        id: "q_rad_001_02",
        question: "A veterinarian reviews the radiographs and administers dexamethasone to address suspected airway inflammation, along with a bolus of intravenous crystalloids to support hydration. What is the clinical consequence of this action?",
        options: [
          "Highly beneficial; it rapidly stabilizes tracheal irritation and supports systemic blood pressure.",
          "Contraindicated; corticosteroids promote sodium retention and fluid administration acutely increases left atrial pressure, risking fatal pulmonary edema.",
          "Acceptable; provided a low dose of diuretics is administered concurrently.",
          "Subclinical; it has no significant physiological impact on advanced mitral valve disease."
        ]
      }
    ]
  };

  await db.collection('cpd_cases').doc(caseId).set(publicData);
  console.log(`- Seeded Public Case: ${caseId}`);

  // 2. Seed the Private Reveal Data
  const privateData = {
    case_id: "case_rad_001_pnuemonia",
    schema_version: "1.0.0",
    ai_report_raw: "RADIOLOGY REPORT:\nAnatomical structures reviewed. Cardiac silhouette size is within normal limits. Tracheobronchial collapse pattern is suspected in the mid-thoracic region. Pulmonary parenchyma is clear; no distinct pulmonary pattern identified. Pleural space is normal. \nCONCLUSION: Normal heart size. Airway collapse suspected. Recommendation: Bronchodilator therapy and cough suppressants.",
    seeded_errors: [
      {
        id: "seed_err_01",
        anatomical_zone: "cardiac_silhouette",
        error_type: "false_negative",
        ai_claim: "Cardiac silhouette size is within normal limits.",
        ground_truth_fact: "Significant left atrial enlargement is present, causing dorsal displacement of the mainstem bronchi (the 'double-hallmark' sign of mitral valve disease on lateral view).",
        clinical_justification: "MMVD has a near 100% prevalence in aged Cavalier King Charles Spaniels. Failing to recognize cardiorespiratory cardiomegaly leads to untreated heart failure progression."
      },
      {
        id: "seed_err_02",
        anatomical_zone: "pulmonary_parenchyma",
        error_type: "false_negative",
        ai_claim: "Pulmonary parenchyma is clear; no distinct pulmonary pattern identified.",
        ground_truth_fact: "There is an active perihilar-to-caudodorsal unstructured interstitial to early alveolar lung pattern.",
        clinical_justification: "The perihilar alveolar pattern is the pathognomonic radiological marker of cardiogenic pulmonary edema. Failing to identify this leads to catastrophic delay in diuretic administration."
      }
    ],
    quiz_answers: [
      {
        question_id: "q_rad_001_01",
        correct_option_index: 1,
        explanation: "Left atrial enlargement expands the cardiac base dorsally, causing classic dorsal elevation of the trachea and compressing or elevating the left mainstem bronchus."
      },
      {
        question_id: "q_rad_001_02",
        correct_option_index: 1,
        explanation: "In Stage C congestive heart failure, the pulmonary vasculature is already severely congested. Administering fluids or sodium-retaining steroids will rapidly worsen cardiogenic pulmonary edema."
      }
    ]
  };

  await db.collection('cpd_cases').doc(caseId).collection('private').doc('reveal').set(privateData);
  console.log(`- Seeded Private Reveal Data: ${caseId}/private/reveal`);
  
  console.log('Case 1 seeding complete.');
}

async function seedCase2() {
  console.log('Seeding Case 2: Feline Asthma and Pleural Effusion...');

  const caseId = 'case_rad_002_asthma';

  const publicData = {
    id: "case_rad_002_asthma",
    schema_version: "1.0.0",
    is_free: false,
    module_id: "mod_rad_thoracic_01",
    sequence_number: 2,
    title: "Feline Asthma and Pleural Effusion",
    difficulty: "Advanced",
    estimated_duration_minutes: 45,
    accreditation_hours: 1.0,
    targeted_competencies: ["COMP_1", "COMP_6", "COMP_7"],
    signalment: {
      species: "Feline",
      breed: "Domestic Shorthair",
      age_years: 4,
      sex: "Female Spayed",
      weight_kg: 4.2
    },
    clinical_history: "Presented for acute onset of open-mouth breathing and abdominal effort. Chronic history of intermittent coughing episodes, previously managed with occasional prednisolone.",
    physical_examination: "Tachypnoeic (80 bpm), orthopnoeic posture. Muffled heart sounds ventrally. Mild cyanosis of mucous membranes.",
    raw_images: [
      {
        image_id: "img_rad_002_lat",
        view: "Lateral Thorax",
        url: "https://storage.googleapis.com/vetsorcery/educational/case_rad_002/lat_view.jpg",
        is_educational: true
      }
    ],
    quiz_questions: [
      {
        id: "q_rad_002_01",
        question: "What radiological sign is most suggestive of pleural effusion in this patient?",
        options: [
          "Hyperinflation of the lung lobes.",
          "Blunting of the costophrenic angles and scalloping of lung lobe margins.",
          "Dorsal displacement of the heart.",
          "Presence of air-bronchograms in the cranial lobes."
        ]
      }
    ]
  };

  await db.collection('cpd_cases').doc(caseId).set(publicData);
  console.log(`- Seeded Public Case: ${caseId} (LOCKED/PREMIUM)`);

  const privateData = {
    case_id: "case_rad_002_asthma",
    schema_version: "1.0.0",
    ai_report_raw: "Thoracic radiographs show mild bronchial patterns. Heart size is normal. No evidence of effusion.",
    seeded_errors: [
      {
        id: "seed_err_01",
        anatomical_zone: "pleural_space",
        error_type: "false_negative",
        ai_claim: "No evidence of effusion.",
        ground_truth_fact: "There is moderate bilateral pleural effusion causing lung lobe retraction and visible pleural fissures.",
        clinical_justification: "Missing pleural effusion in a dyspnoeic cat prevents life-saving thoracocentesis."
      }
    ],
    quiz_answers: [
      {
        question_id: "q_rad_002_01",
        correct_option_index: 1,
        explanation: "Pleural effusion collects in the dependent areas, obscuring the diaphragm and causing lung lobes to retract from the chest wall, creating 'fissure lines'."
      }
    ]
  };

  await db.collection('cpd_cases').doc(caseId).collection('private').doc('reveal').set(privateData);
  
  console.log('Case 2 seeding complete.');
}

async function main() {
  await seedCase1();
  await seedCase2();
}

main().catch(console.error);
