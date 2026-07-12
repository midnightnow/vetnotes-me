import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { hasCpdEntitlement } from '$lib/server/cpd_entitlement';
import { certIdFor, issueCertificate } from '$lib/server/cpd_certificate';
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

  const scoreSnap = await adminDb.collection('cpd_scores').doc(`score_${attemptId}`).get();
  if (!scoreSnap.exists) {
    throw error(404, 'Score record not found. Please verify the completion run.');
  }

  const scoreData = scoreSnap.data();
  const isPass = scoreData?.is_overall_pass === true;
  if (!isPass) {
    throw error(400, 'Attempt does not meet the passing threshold for certificate generation');
  }

  const certDoc = await adminDb.collection('cpd_certificates').doc(certIdFor(locals.user.uid, attempt)).get();
  if (certDoc.exists) {
    return json({ success: true, certificate: certDoc.data() });
  }

  // Attempt passed but no certificate issued yet — gate on entitlement.
  if (await hasCpdEntitlement(locals.user.uid)) {
    const certificate = await issueCertificate(locals.user.uid, attempt);
    return json({ success: true, certificate });
  }

  // Not entitled: surface the paywall (402 Payment Required) rather than a hard 404.
  return json(
    {
      success: false,
      paywall: { required: true, reason: 'certificate', checkout_path: '/api/cpd/checkout' },
      error: 'A verifiable CPD certificate requires an active CPD entitlement.'
    },
    { status: 402 }
  );
};
