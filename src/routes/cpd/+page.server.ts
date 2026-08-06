import { adminDb } from '$lib/server/firebase-admin';
import type { PageServerLoad } from './$types';
import { ensureAuditModuleExists } from '$lib/server/cpd_seed';

export const load: PageServerLoad = async () => {
  try {
    await ensureAuditModuleExists();
  } catch (error) {
    console.error('Failed to ensure Module 1 exists', error);
  }

  // The catalogue is rendered entirely client-side by CPDAcademy.svelte, which
  // reads `cpd_sessions` under the caller's own credentials. This load used to
  // also run `adminDb.collection('cpd_cases').orderBy('created_at','desc')` and
  // return `cases` + a hardcoded `modules` array — but `+page.svelte` renders
  // `<CPDAcademy />` and never touches `data`, so both were discarded.
  //
  // Removed for two reasons:
  //  1. It was an unauthenticated Admin-SDK collection scan on every anonymous
  //     hit to /cpd, billed and unbounded, for a result nobody read.
  //  2. It was a live trap. `cpd_seed.ts` writes no `created_at`, and Firestore
  //     silently EXCLUDES documents missing the orderBy field — so the moment
  //     anyone wired `data.cases` into the UI it would have rendered empty with
  //     no error. CPDAcademy.svelte already carries a comment explaining exactly
  //     this hazard for `cpd_sessions`; the server copy never got the memo.
  return {};
};
