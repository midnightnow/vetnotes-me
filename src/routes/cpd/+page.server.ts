import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';
import { ensureAuditModuleExists } from '$lib/server/cpd_seed';

export const load: PageServerLoad = async () => {
  try {
    await ensureAuditModuleExists();
  } catch (error) {
    console.error('Failed to ensure Module 1 exists', error);
  }

  const [casesSnap, sessionsSnap] = await Promise.all([
    adminDb.collection('cpd_cases').orderBy('created_at', 'desc').get(),
    // Catalog is served server-side so anonymous visitors can browse it —
    // the client-side cpd_sessions read is auth-gated by Firestore rules.
    adminDb.collection('cpd_sessions').get(),
  ]);
  // JSON round-trip: Firestore Timestamp instances are not serializable by
  // SvelteKit's devalue and would 500 the page.
  const plain = (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
    JSON.parse(JSON.stringify({ id: doc.id, ...doc.data() }));
  const cases = casesSnap.docs.map(plain);
  const sessions = sessionsSnap.docs
    .map(plain)
    .sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));

  return {
    cases,
    sessions,
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
