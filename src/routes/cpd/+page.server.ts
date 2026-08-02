import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';
import { ensureAuditModuleExists } from '$lib/server/cpd_seed';

export const load: PageServerLoad = async () => {
  try {
    await ensureAuditModuleExists();
  } catch (error) {
    console.error('Failed to ensure Module 1 exists', error);
  }

  const casesSnap = await adminDb.collection('cpd_cases').orderBy('created_at', 'desc').get();
  const cases = casesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return {
    cases,
    modules: [
      {
        id: 'mod_m1_aiva_audit',
        title: 'Module 1: The AIVA Practice Audit',
        description: 'Reclaiming cognitive surplus using VetSorcery against the AIVA documentation standard.',
        hours: 0.5,
        sessionType: 'VT',
      },
    ],
  };
};
