import type { LayoutServerLoad } from './$types';

// /cpd is a marketing + catalog surface: anonymous visitors may browse the
// module list and free cases. Auth is enforced where it matters instead:
// certificate/[attendanceId] 401s without a user (and paywalls via
// hasCpdEntitlement), cases/[caseId] withholds locked case data, and the
// checkout/scoring +server.ts endpoints verify their own tokens. Redirecting
// the whole subtree to /login bounced paid traffic off a login wall.
export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null
  };
};
