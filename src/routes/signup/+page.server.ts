import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * /signup — alias for /login. Auth is Google-popup only, so sign-in IS
 * sign-up (first Google sign-in creates the account). This route exists so
 * marketing links, ads and muscle-memory URLs don't dead-end in a 404.
 * Preserves ?redirectTo= so deep links survive the hop.
 */
export const load: PageServerLoad = ({ url }) => {
  const redirectTo = url.searchParams.get('redirectTo');
  const target = redirectTo
    ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/login';
  throw redirect(307, target);
};
