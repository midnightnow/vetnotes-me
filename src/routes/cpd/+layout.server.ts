import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // Ensure the redirect is relative so it respects the active domain (e.g., vetcpd.web.app or localhost)
  if (!locals.user) {
    throw redirect(302, `/login?redirectTo=${encodeURIComponent(url.pathname)}`);
  }
  return {
    user: locals.user
  };
};
