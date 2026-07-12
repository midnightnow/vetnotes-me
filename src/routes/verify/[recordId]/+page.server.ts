import { adminDb } from '$lib/server/firebase-admin';

/**
 * Public CPD record verification (no auth). A third party (employer, regulator)
 * enters the Verification ID printed on a completion record and confirms it is
 * genuine. Reads via the admin SDK (bypasses client rules) and returns only the
 * fields needed to confirm the record — no attempt data, no answer keys.
 */
export const load = async ({ params }: any) => {
  const { recordId } = params;

  const snap = await adminDb.collection('cpd_attendance').doc(recordId).get();
  if (!snap.exists) return { valid: false, recordId };

  const a = snap.data() as any;
  if (!a.completed_at) return { valid: false, recordId };

  const sessionSnap = await adminDb.collection('cpd_sessions').doc(a.session_id).get();
  const session = sessionSnap.exists
    ? (sessionSnap.data() as any)
    : { title: 'CPD Activity', duration_minutes: 60 };

  let holder = 'Veterinary Practitioner';
  const userSnap = await adminDb.collection('users').doc(a.user_id).get();
  if (userSnap.exists && userSnap.data()?.displayName) holder = userSnap.data()!.displayName;

  return {
    valid: true,
    recordId,
    holder,
    module: session.title || 'CPD Activity',
    hours: (session.duration_minutes || 60) / 60,
    completedAt: a.completed_at
  };
};
