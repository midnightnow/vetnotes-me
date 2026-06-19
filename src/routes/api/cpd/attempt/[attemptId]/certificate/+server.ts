import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import type { CPDAttempt } from '$lib/types/cpd';

export const GET: RequestHandler = async ({ params, locals }) => {
  const { attemptId } = params;
  
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  const attemptDoc = await adminDb.collection('cpd_attempts').doc(attemptId).get();
  if (!attemptDoc.exists) {
    throw error(404, 'CPD Attempt not found');
  }

  const attempt = attemptDoc.data() as CPDAttempt;

  if (attempt.user_id !== locals.user.uid) {
    throw error(403, 'Forbidden: You do not own this attempt');
  }

  const isPass = attempt.current_step === 'COMPLETED';
  if (!isPass) {
    throw error(400, 'Attempt does not meet the passing threshold for certificate generation');
  }

  const certId = `cert_${locals.user.uid}_${attempt.case_id}_v${attempt.attempt_version}`;
  const certDoc = await adminDb.collection('cpd_certificates').doc(certId).get();

  if (!certDoc.exists) {
    throw error(404, 'Certificate record not found. Please verify the completion run.');
  }

  return json({
    success: true,
    certificate: certDoc.data()
  });
};
