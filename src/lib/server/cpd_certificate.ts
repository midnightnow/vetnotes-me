/**
 * CPD certificate construction + lazy issuance (server authority).
 *
 * `buildCertificate` is a pure function used inside the submit-final
 * transaction (which has already read the case + user docs).
 *
 * `issueCertificate` performs its own reads/writes and is used for the
 * lazy "pay then retrieve" path, where the certificate was withheld at
 * grading time because the user was not yet entitled.
 */
import { adminDb } from '$lib/server/firebase-admin';
import { SCHEMA_VERSION } from '$lib/types/cpd_scoring_spec';
import type { CPDAttempt } from '$lib/types/cpd';

export interface CPDCertificate {
  id: string;
  user_id: string;
  module_id: string;
  recipient_name: string;
  provider_name: string;
  provider_veted_code: string;
  activity_veted_code: string;
  hours_awarded: number;
  schema_version: string;
  issued_at: string;
  verification_url: string;
}

export function certIdFor(userId: string, attempt: Pick<CPDAttempt, 'case_id' | 'attempt_version'>): string {
  return `cert_${userId}_${attempt.case_id}_v${attempt.attempt_version}`;
}

export function buildCertificate(
  userId: string,
  attempt: Pick<CPDAttempt, 'case_id' | 'attempt_version'>,
  caseData: any,
  recipientName: string
): CPDCertificate {
  const certId = certIdFor(userId, attempt);
  const providerName = caseData?.provider_name || 'VetNotes Academy';
  const providerCode = caseData?.provider_code || 'VN-2026-PRV';
  const activityCode = caseData?.activity_code || attempt.case_id;
  const hoursAwarded = caseData?.hours_awarded ?? 1.0;
  const verificationBase = caseData?.verification_url || 'https://vetnotes.app/verify';

  return {
    id: certId,
    user_id: userId,
    module_id: caseData?.module_id || 'mod_unknown',
    recipient_name: recipientName,
    provider_name: providerName,
    provider_veted_code: providerCode,
    activity_veted_code: activityCode,
    hours_awarded: hoursAwarded,
    schema_version: SCHEMA_VERSION,
    issued_at: new Date().toISOString(),
    verification_url: `${verificationBase}/${certId}`
  };
}

/**
 * Issue (or return existing) certificate for an already-passed attempt.
 * Caller is responsible for having verified ownership + entitlement + pass.
 */
export async function issueCertificate(userId: string, attempt: CPDAttempt): Promise<CPDCertificate> {
  const certId = certIdFor(userId, attempt);
  const certRef = adminDb.collection('cpd_certificates').doc(certId);

  const existing = await certRef.get();
  if (existing.exists) return existing.data() as CPDCertificate;

  const [caseSnap, userSnap] = await Promise.all([
    adminDb.collection('cpd_cases').doc(attempt.case_id).get(),
    adminDb.collection('users').doc(userId).get()
  ]);
  const recipientName =
    userSnap.exists && userSnap.data()?.displayName ? userSnap.data()!.displayName : 'Veterinary Practitioner';

  const certData = buildCertificate(userId, attempt, caseSnap.data(), recipientName);
  await certRef.set(certData);
  return certData;
}
