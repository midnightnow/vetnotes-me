import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';
import type { CPDSession, CPDCase } from '$lib/types/cpd';

export const load: PageServerLoad = async ({ params }) => {
  const sessionSnap = await adminDb
    .collection('cpd_sessions')
    .where('module_id', '==', params.moduleId)
    .limit(1)
    .get();

  if (sessionSnap.empty) {
    throw new Error('Session not found');
  }

  const sessionDoc = sessionSnap.docs[0];
  const session = { id: sessionDoc.id, ...sessionDoc.data() } as CPDSession;

  let cases: CPDCase[] = [];
  if (session.case_ids?.length) {
    const casePromises = session.case_ids.map((caseId) =>
      adminDb.collection('cpd_cases').doc(caseId).get()
    );
    const caseSnaps = await Promise.all(casePromises);
    cases = caseSnaps
      .filter((snap) => snap.exists)
      .map((snap) => ({ id: snap.id, ...snap.data() } as CPDCase));
  }

  return {
    session,
    cases,
  };
};
