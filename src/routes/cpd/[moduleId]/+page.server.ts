import { error } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';
import type { CPDSession, CPDCase } from '$lib/types/cpd';

export const load: PageServerLoad = async ({ params, locals }) => {
  // Own gate: adminDb bypasses Firestore rules, and this load previously
  // spread every case document (clinical history, images, quiz questions)
  // for anyone who could guess a module id.
  if (!locals.user) throw error(401, 'Sign in to view CPD modules');

  const sessionSnap = await adminDb
    .collection('cpd_sessions')
    .where('module_id', '==', params.moduleId)
    .limit(1)
    .get();

  if (sessionSnap.empty) {
    throw error(404, 'Session not found');
  }

  const sessionDoc = sessionSnap.docs[0];
  const session = { id: sessionDoc.id, ...sessionDoc.data() } as CPDSession;

  let cases: CPDCase[] = [];
  if (session.case_ids?.length) {
    const caseSnaps = await Promise.all(
      session.case_ids.map((caseId) => adminDb.collection('cpd_cases').doc(caseId).get())
    );
    cases = caseSnaps
      .filter((snap) => snap.exists)
      // Locked cases are listed by title only — never with their body.
      .map((snap) => {
        const data = snap.data()!;
        if (data.is_free !== true) {
          return { id: snap.id, title: data.title, session_type: data.session_type, locked: true } as unknown as CPDCase;
        }
        return { id: snap.id, ...data } as CPDCase;
      });
  }

  return {
    session,
    cases
  };
};
