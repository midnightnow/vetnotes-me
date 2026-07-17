import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** /plans — canonical pricing lives at /pricing. */
export const load: PageServerLoad = () => {
  throw redirect(308, '/pricing');
};
