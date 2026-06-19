import { error, json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import type { SpecialistProfile, SpecialistReferral, ReferralValidationResult } from '$lib/types/specialist';

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current: any, key: string) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[key];
  }, obj);
}

export async function validateReferral(
  specialistId: string,
  patientData: Record<string, any>
): Promise<ReferralValidationResult> {
  const profileSnap = await adminDb.collection('specialist_profiles').doc(specialistId).get();
  if (!profileSnap.exists) {
    throw error(404, 'Specialist profile not found');
  }

  const profile = profileSnap.data() as SpecialistProfile;
  const requirements = profile.intake_requirements;
  const missingFields: string[] = [];
  const missingDocuments: string[] = [];

  for (const field of requirements.required_fields) {
    if (!field.required) continue;
    const value = getNestedValue(patientData, field.field);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field.field);
    }
  }

  const attachedDocuments: string[] = patientData.attached_documents || [];
  for (const doc of requirements.required_documents) {
    if (!attachedDocuments.includes(doc)) {
      missingDocuments.push(doc);
    }
  }

  const blocked = missingFields.length > 0 || missingDocuments.length > 0;

  return {
    blocked,
    missing_fields: missingFields,
    missing_documents: missingDocuments,
    rejection_message: requirements.rejection_message
  };
}

export async function createReferral(
  fromUserId: string,
  fromClinic: string,
  fromName: string,
  specialistId: string,
  patientData: Record<string, any>
): Promise<SpecialistReferral> {
  const profileSnap = await adminDb.collection('specialist_profiles').doc(specialistId).get();
  if (!profileSnap.exists) {
    throw error(404, 'Specialist profile not found');
  }

  const profile = profileSnap.data() as SpecialistProfile;

  const validation = await validateReferral(specialistId, patientData);
  if (validation.blocked) {
    throw error(400, validation.rejection_message);
  }

  const fee = profile.virtual_practice.fee_per_consult;
  const platformCutPercent = profile.virtual_practice.platform_cut_percent;
  const platformCut = Math.round(fee * (platformCutPercent / 100));
  const specialistNet = fee - platformCut;

  const now = new Date().toISOString();
  const referralId = `ref_${Date.now()}_${fromUserId.slice(0, 8)}`;

  const referral: SpecialistReferral = {
    id: referralId,
    from_gp: { userId: fromUserId, clinic: fromClinic, name: fromName },
    to_specialist: { specialistId, clinic: profile.clinic },
    patient: {
      signalment: patientData.signalment || {},
      clinical_history: patientData.clinical_history || {},
      diagnostics: patientData.diagnostics || {},
      attached_documents: patientData.attached_documents || [],
      soap_note: patientData.soap_note || {}
    },
    status: 'PENDING',
    fee,
    platform_cut,
    specialist_net,
    created_at: now
  };

  await adminDb.collection('specialist_referrals').doc(referralId).set(referral);

  await adminDb.collection('specialist_profiles').doc(specialistId).update({
    'virtual_practice.pending_count': adminDb.FieldValue.increment(1)
  });

  return referral;
}

export async function getSpecialistProfile(specialistId: string): Promise<SpecialistProfile | null> {
  const snap = await adminDb.collection('specialist_profiles').doc(specialistId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as SpecialistProfile;
}

export async function listActiveSpecialists(): Promise<SpecialistProfile[]> {
  const snap = await adminDb
    .collection('specialist_profiles')
    .where('status', '==', 'ACTIVE')
    .get();

  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as SpecialistProfile));
}

export async function seedDemoSpecialist(): Promise<string> {
  const specialistId = 'specialist_demo_001';
  const profile: Omit<SpecialistProfile, 'id'> = {
    name: 'Dr. Sarah Mitchell',
    ava_rcvs_number: 'AVA-DEMO-001',
    clinic: 'Mitchell Veterinary Care',
    email: 'sarah@mitchellvetcare.com',
    phone: '+61 400 000 000',
    specialty: 'Small Animal Medicine',
    leader_format_version: '1.0',
    intake_requirements: {
      required_fields: [
        { field: 'signalment.species', label: 'Species', type: 'select', required: true, options: ['Dog', 'Cat', 'Horse'] },
        { field: 'signalment.weight_kg', label: 'Weight (kg)', type: 'number', required: true },
        { field: 'signalment.age_years', label: 'Age (years)', type: 'number', required: true },
        { field: 'clinical_history.duration', label: 'Duration of clinical signs', type: 'text', required: true, maxLength: 500 },
        { field: 'clinical_history.previous_treatments', label: 'Previous treatments', type: 'textarea', required: true },
        { field: 'diagnostics.idexx_sdma', label: 'IDEXX SDMA (ug/mL)', type: 'number', required: false, unit: 'ug/mL' },
        { field: 'diagnostics.idexx_creatinine', label: 'IDEXX Creatinine (umol/L)', type: 'number', required: false, unit: 'umol/L' }
      ],
      required_documents: ['idexx_lab_report'],
      rejection_message: 'Please include IDEXX SDMA and Creatinine results before submitting.'
    },
    virtual_practice: {
      team_emails: ['nurse@mitchellvetcare.com'],
      response_sla_hours: 24,
      consultation_type: 'TELEADVICE',
      fee_per_consult: 150,
      platform_cut_percent: 15,
      stripe_account_id: 'acct_demo_stripe'
    },
    cpd_module_ids: ['m1-audit'],
    created_at: new Date().toISOString(),
    status: 'ACTIVE'
  };

  await adminDb.collection('specialist_profiles').doc(specialistId).set(profile);
  return specialistId;
}
