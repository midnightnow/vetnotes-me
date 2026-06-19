import { adminDb } from './firebase-admin';
import type { CPDCase, CPDSession } from '$lib/types/cpd';

export async function ensureAuditModuleExists(): Promise<void> {
  const caseId = 'case_m1_aiva_practice_audit';
  const sessionId = 'sess_m1_aiva_audit';
  const moduleId = 'mod_m1_aiva_audit';

  const caseSnap = await adminDb.collection('cpd_cases').doc(caseId).get();
  if (!caseSnap.exists) {
    const auditCase: CPDCase = {
      id: caseId,
      module_id: moduleId,
      sequence_number: 1,
      title: 'The AIVA Practice Audit',
      difficulty: 'Beginner',
      targeted_competencies: ['COMP_1', 'COMP_2', 'COMP_3', 'COMP_4', 'COMP_5'],
      signalment: {
        species: 'Clinical Practice',
        breed: 'General Practice',
        age_years: 0,
        sex: 'N/A',
        weight_kg: 0
      },
      clinical_history:
        'Reclaiming cognitive surplus from mechanical documentation. Map the AIVA Standard onto your current workflow.',
      physical_examination:
        'Assess current documentation latency, missed detail, and compliance gaps across five sampled consultations.',
      raw_images: [],
      quiz_questions: [
        {
          id: 'q1',
          question: 'What is the primary statutory requirement for veterinary medical records?',
          options: [
            'Speed of entry',
            'Accuracy, completeness, and contemporaneous documentation',
            'Use of standardized abbreviations only',
            'Billing code maximization'
          ]
        },
        {
          id: 'q2',
          question: 'What is the "mechanical energy" gap in standard consults?',
          options: [
            'Time spent typing instead of observing and building rapport',
            'Cost of EMR software licenses',
            'Physical fatigue from standing',
            'Clinic Wi-Fi latency'
          ]
        },
        {
          id: 'q3',
          question: 'How does AI-assisted transcription improve clinical governance?',
          options: [
            'It replaces the vet diagnostic reasoning',
            'It ensures the verbal consult is captured contemporaneously',
            'It automatically prescribes medications',
            'It bills clients without human review'
          ]
        },
        {
          id: 'q4',
          question: 'In the AIVA framework, what is the role of VetSorcery?',
          options: [
            'To make final diagnostic decisions',
            'To execute the AIVA documentation standard',
            'To replace veterinary degrees',
            'To communicate directly with clients'
          ]
        },
        {
          id: 'q5',
          question: 'What pass mark is required to unlock the verifiable CPD certificate?',
          options: ['50%', '70%', '80%', '100%']
        }
      ]
    };

    await adminDb.collection('cpd_cases').doc(caseId).set(auditCase);
  }

  const revealSnap = await adminDb.collection('cpd_cases').doc(caseId).collection('private').doc('reveal').get();
  if (!revealSnap.exists) {
    await adminDb
      .collection('cpd_cases')
      .doc(caseId)
      .collection('private')
      .doc('reveal')
      .set({
        case_id: caseId,
        insight_text:
          'Veterinarians spend 40-60% of consult time documenting. VetSorcery captures the full verbal consult and maps every finding to the AIVA Standard/RCVS Day One Competence 1.5 standard. The artisanal voice check takes approximately 90 seconds.',
        reference_document_url: '/docs/aiva_documentation_standard_1.5.pdf',
        quiz_answers: [
          { question_id: 'q1', correct_option_index: 1, explanation: 'Statutory records must be accurate, complete, and contemporaneous.' },
          { question_id: 'q2', correct_option_index: 0, explanation: 'Typing steals attention from patient observation and rapport.' },
          { question_id: 'q3', correct_option_index: 1, explanation: 'Contemporaneous capture is the core governance improvement.' },
          { question_id: 'q4', correct_option_index: 1, explanation: 'VetSorcery is the execution layer for the AIVA standard.' },
          { question_id: 'q5', correct_option_index: 2, explanation: 'An 80% pass mark is required for issuance.' }
        ],
        module_id: moduleId,
        provider_name: 'AIVA Academy',
        provider_code: 'AIVA-ACAD-001',
        activity_code: caseId,
        hours_awarded: 0.5,
        is_free: true,
        session_type: 'VT'
      });
  }

  const sessionSnap = await adminDb.collection('cpd_sessions').doc(sessionId).get();
  if (!sessionSnap.exists) {
    const session: CPDSession = {
      id: sessionId,
      module_id: moduleId,
      title: 'Module 1: The AIVA Practice Audit',
      description: 'Reclaiming cognitive surplus using VetSorcery against the AIVA documentation standard.',
      session_type: 'VT',
      duration_minutes: 15,
      is_free: true,
      case_ids: [caseId]
    };

    await adminDb.collection('cpd_sessions').doc(sessionId).set(session);
  }
}
