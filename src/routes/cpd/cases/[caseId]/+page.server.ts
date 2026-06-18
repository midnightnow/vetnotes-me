import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminDb } from '$lib/server/firebase-admin';

export const load: PageServerLoad = async ({ params, locals }) => {
  const userId = locals.user?.uid;
  // Layout now handles authentication redirect for /cpd paths

  const { caseId } = params;
  if (!caseId) {
    throw error(400, 'Missing Case ID');
  }

  try {
    const caseSnap = await adminDb.collection('cpd_cases').doc(caseId).get();

    if (!caseSnap.exists) {
      throw error(404, 'Case not found');
    }

    const caseData = caseSnap.data()!;

    // Gating rule: If is_free is not explicitly true, the case is locked
    const isLocked = caseData.is_free !== true;

    return {
      caseId,
      isLocked,
      sessionType: caseData.session_type || 'IMAGING',
      // Do not send case data to the client if locked
      publicCase: isLocked ? null : caseData
    };
  } catch (e: any) {
    if (e.status) throw e; // Re-throw SvelteKit errors
    throw error(500, `Database retrieval failure: ${e.message}`);
  }
};
