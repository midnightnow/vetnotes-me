import { adminDb } from './firebase-admin';
import type { CPDCase, CPDSession } from '$lib/types/cpd';

/**
 * Gating + credential metadata that MUST exist on the public case document.
 * Declared once so the create path and the backfill path cannot drift.
 */
const AUDIT_CASE_METADATA = {
  session_type: 'VT' as const,
  is_free: true,
  hours_awarded: 0.5,
  provider_name: 'AIVA Academy',
  provider_code: 'AIVA-ACAD-001'
};

export async function ensureAuditModuleExists(): Promise<void> {
  const caseId = 'case_m1_aiva_practice_audit';
  const sessionId = 'sess_m1_aiva_audit';
  const moduleId = 'mod_m1_aiva_audit';

  const caseSnap = await adminDb.collection('cpd_cases').doc(caseId).get();

  // Backfill for the ALREADY-SEEDED production document.
  //
  // This function is create-if-missing, so moving the gating fields onto the
  // public case doc (below) would never reach the live case — it was seeded
  // before the fix and `caseSnap.exists` is true forever after. Without this
  // merge the module stays mistyped as IMAGING and remains unpassable in prod.
  //
  // Merge-only, and only for fields that are actually absent: never clobber
  // values an operator has since set by hand.
  if (caseSnap.exists) {
    const existing = caseSnap.data() || {};
    const missing: Record<string, unknown> = {};
    for (const [key, value] of Object.entries({ ...AUDIT_CASE_METADATA, activity_code: caseId })) {
      if (existing[key] === undefined) missing[key] = value;
    }
    if (Object.keys(missing).length > 0) {
      await adminDb.collection('cpd_cases').doc(caseId).set(missing, { merge: true });
    }
  }

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

      // ── Gating + credential metadata belongs on the PUBLIC case document ──
      //
      // These six fields were previously written ONLY to `private/reveal` below,
      // but every consumer reads them off this document:
      //   - `session_type`   → submit-final:63, submit-comparison:24, reveal:34
      //                        (all `caseData.session_type || 'IMAGING'`). Absent
      //                        here, this VT module graded as an IMAGING case, so
      //                        COMP_5 scored 0.0 and the module was unpassable.
      //   - `hours_awarded`  → cpd_certificate.buildCertificate
      //   - `is_free`        → free-access gating
      //   - provider/activity codes → printed on the certificate
      //
      // `CPDCase` already declares all of them, so the type was right and the
      // writer was wrong. Nothing secret is exposed: the answer key, insight text
      // and reference document stay on `private/reveal`.
      ...AUDIT_CASE_METADATA,
      activity_code: caseId,
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
