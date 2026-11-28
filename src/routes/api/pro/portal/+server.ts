/**
 * VetNotes Pro billing portal — where a subscriber cancels, changes card or
 * downloads invoices without a support ticket.
 *
 * Creates a Stripe Billing Portal session for the CALLER's own Stripe customer
 * and returns its URL.
 *
 * SECURITY
 * - Signed-in only, checked the same way as `api/pro/checkout`: `locals.user`
 *   comes from a verified Firebase ID token (`hooks.server.ts`).
 * - The customer id is read from server-side state keyed by that verified uid
 *   (`readProBillingState`). The request body and query string are never read,
 *   so there is nothing a caller can send to reach another vet's customer.
 * - No stored customer is a 404. This route never creates a customer.
 *
 * OWNER SETUP: the Customer Portal must be switched on in the Stripe dashboard
 * (Settings -> Billing -> Customer portal) for the mode the key belongs to.
 * Until it is, Stripe refuses and this route answers 502.
 *
 * Required env: STRIPE_SECRET_KEY. Unset = 503 { configured: false }.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/server/firebase-admin';
import { createPortalSession, readProBillingState } from '$lib/server/pro_billing';

export const POST: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const secret = env.STRIPE_SECRET_KEY;
	if (!secret) {
		return json(
			{ success: false, configured: false, error: 'Subscription management is not yet configured.' },
			{ status: 503 }
		);
	}

	const { customerId } = await readProBillingState(adminDb, locals.user.uid);
	if (!customerId) {
		return json(
			{
				success: false,
				code: 'no_billing_account',
				error: 'There is no VetNotes Pro billing account for this sign-in.'
			},
			{ status: 404 }
		);
	}

	try {
		const portalUrl = await createPortalSession({ secret }, customerId, `${url.origin}/pricing`);
		return json({ success: true, url: portalUrl });
	} catch (err) {
		console.error('Pro portal: Stripe portal session creation failed', err);
		throw error(502, 'Unable to open subscription management. Please try again.');
	}
};
