/**
 * Is the signed-in user entitled to VetNotes Pro?
 *
 * The client gate (`$lib/services/vetsorcery.getSubscriptionInfo`) reads the
 * `plan` custom claim directly, which costs nothing and cannot be forged. That
 * covers users who are Pro via a paid VetSorcery plan. It cannot see a VetNotes
 * Pro entitlement bought on vetnotes.me, because that lives in a Firestore
 * collection the client has no rule to read — deliberately, see
 * `server/pro_entitlement.ts`.
 *
 * This endpoint closes that gap through the Admin SDK. It is the ONLY consumer
 * path for the entitlement on the client, and it is advisory: every gate that
 * actually matters (certificate issuance, PIMS sync) re-checks server-side.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasProEntitlement } from '$lib/server/pro_entitlement';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ pro: false, authenticated: false });
	const pro = await hasProEntitlement(locals.user.uid);
	return json({ pro, authenticated: true });
};
