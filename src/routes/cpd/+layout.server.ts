import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// CPD is UNLISTED, not deleted. The anonymous-browsing experiment (ea48ca2)
// is reverted here: a red-team pass found the credential forgeable and the
// case content ungated, so this subtree stays behind sign-in until the module
// is rebuilt (VET/REVENUE_PLAN_2026-08-02.md). Nav points at /docs instead.
// NB this redirect is NOT the only gate — [moduleId] and documents/[caseId]
// enforce their own, because they read via adminDb and once leaked full paid
// case content to anyone who guessed a URL.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  return {
    user: locals.user
  };
};
