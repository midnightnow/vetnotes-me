import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const caseSnap = await adminDb.collection('cpd_cases').doc(params.caseId).get();

  if (!caseSnap.exists) {
    throw new Error('Document not found');
  }

  return {
    caseId: params.caseId,
    document: {
      id: caseSnap.id,
      ...caseSnap.data()
    }
  };
};
