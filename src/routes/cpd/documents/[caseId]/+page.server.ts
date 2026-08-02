import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Own gate, not the layout's: this load reads through adminDb, which
  // bypasses Firestore rules, and returns the whole case document. It also
  // has no is_free check, so it must never serve a locked/paid case body —
  // sibling route cases/[caseId] deliberately withholds exactly this data.
  if (!locals.user) throw error(401, 'Sign in to view CPD documents');

  const caseSnap = await adminDb.collection('cpd_cases').doc(params.caseId).get();

  if (!caseSnap.exists) {
    throw error(404, 'Document not found');
  }

  const caseData = caseSnap.data()!;
  if (caseData.is_free !== true) {
    throw error(403, 'This case requires CPD access');
  }

  return {
    caseId: params.caseId,
    document: {
      id: caseSnap.id,
      ...caseData
    }
  };
};
