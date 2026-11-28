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
 *
 * Reply: { pro, authenticated, manageable }. Everything is derived from the
 * verified caller (`locals.user.uid`); the request carries no parameters.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminDb } from '$lib/server/firebase-admin';
import { hasProEntitlement } from '$lib/server/pro_entitlement';
import { readProBillingState } from '$lib/server/pro_billing';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) return json({ pro: false, authenticated: false, manageable: false });
	const uid = locals.user.uid;
	const [pro, billing] = await Promise.all([
		hasProEntitlement(uid),
		readProBillingState(adminDb, uid).catch((err) => {
			console.error('[Pro] billing state read failed', err);
			return null;
		})
	]);
	/* `manageable`: this vet has their own VetNotes Pro subscription and a Stripe
	   customer on file, so "Manage subscription" (`api/pro/portal`) will work.
	   False for a vet who is Pro through a paid VetSorcery plan: that plan is not
	   billed here. */
	const manageable = pro && !!billing?.customerId && billing.hasOwnSubscription;
	return json({ pro, authenticated: true, manageable });
};
