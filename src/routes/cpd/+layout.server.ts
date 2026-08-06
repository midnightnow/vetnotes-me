import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Free-to-learn: the CPD academy landing page and case viewer are open to
// anonymous visitors (locked cases still gate via `is_free` in their own
// loads; certificate/documents keep their own auth guards). Everything else
// under /cpd still requires login.
const ANON_ALLOWED = [/^\/cpd\/?$/, /^\/cpd\/cases(\/|$)/];

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Ensure the redirect is relative so it respects the active domain (e.g., vetcpd.web.app or localhost)
  if (!locals.user && !ANON_ALLOWED.some((re) => re.test(url.pathname))) {
    throw redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  return {
    user: locals.user
  };
};
