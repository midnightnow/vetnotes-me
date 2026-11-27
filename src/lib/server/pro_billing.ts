/**
 * VetNotes Pro billing state (server only): which Stripe customer belongs to
 * which signed-in user, and the Stripe calls made on that customer's behalf.
 *
 * THE RULE THIS FILE ENFORCES
 * ---------------------------
 * A Stripe customer id is only ever looked up from server-side state keyed by
 * the VERIFIED user id (`locals.user.uid`, set in `hooks.server.ts` from a
 * verified Firebase ID token). No function here accepts a customer id from a
 * request. A route that passed a body or query `customer` to Stripe would let
 * any signed-in user open someone else's billing portal and cancel their plan.
 *
 * WHERE THE CUSTOMER ID LIVES
 * ---------------------------
 *   1. `vetnotes_pro_billing/{uid}.stripe_customer_id` — written by the checkout
 *      route the first time a user starts a checkout.
 *   2. `vetnotes_pro_entitlements/{uid}.stripe_customer_id` — written by the
 *      signature-verified webhook. This is the only source for vets who
 *      subscribed before (1) existed.
 * Both collections are written through the Admin SDK only. No client rule
 * grants access to either, so a user cannot plant a customer id.
 *
 * Uses the Stripe REST API directly (no `stripe` npm dependency), like the
 * checkout and webhook code.
 */
import { PRO_ENTITLEMENT_COLLECTION, isLiveProGrant } from '$lib/server/pro_entitlement';

export const PRO_BILLING_COLLECTION = 'vetnotes_pro_billing';

const STRIPE_API = 'https://api.stripe.com/v1';

type Fetch = typeof fetch;

/** The slice of Firestore this module needs; `adminDb` satisfies it. */
export interface BillingDb {
	collection(name: string): {
		doc(id: string): {
			get(): Promise<{ exists: boolean; data(): Record<string, any> | undefined }>;
		};
	};
}

export interface StripeDeps {
	secret: string;
	/** Defaults to the global `fetch`, read at call time so tests can stub it. */
	fetchImpl?: Fetch;
}

export class StripeApiError extends Error {
	constructor(
		public readonly method: string,
		public readonly path: string,
		public readonly status: number,
		public readonly detail: string
	) {
		super(`Stripe ${method} ${path} failed: HTTP ${status}`);
	}
}

/** Only a well-formed Stripe customer id is ever sent to Stripe. */
export function asStripeCustomerId(value: unknown): string | null {
	return typeof value === 'string' && /^cus_[A-Za-z0-9]+$/.test(value) ? value : null;
}

/** One Stripe API call. Throws `StripeApiError` on any non-2xx reply. */
export async function stripeCall(
	deps: StripeDeps,
	method: 'GET' | 'POST',
	path: string,
	params?: URLSearchParams,
	extraHeaders: Record<string, string> = {}
): Promise<Record<string, any>> {
	const fetchImpl = deps.fetchImpl ?? fetch;
	const query = method === 'GET' && params ? `?${params.toString()}` : '';
	const res = await fetchImpl(`${STRIPE_API}/${path}${query}`, {
		method,
		headers: {
			Authorization: `Bearer ${deps.secret}`,
			...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
			...extraHeaders
		},
		...(method === 'POST' ? { body: (params ?? new URLSearchParams()).toString() } : {})
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new StripeApiError(method, path, res.status, detail);
	}
	return (await res.json()) as Record<string, any>;
}

export interface ProBillingState {
	/** The user's Stripe customer, or null when none is on file. */
	customerId: string | null;
	/** True when the webhook has a live (active, not expired) VetNotes Pro grant for this user. */
	hasOwnSubscription: boolean;
}

/**
 * Read a user's billing state. `userId` MUST be the verified uid of the caller.
 */
export async function readProBillingState(db: BillingDb, userId: string): Promise<ProBillingState> {
	if (!userId) return { customerId: null, hasOwnSubscription: false };
	const [billing, entitlement] = await Promise.all([
		db.collection(PRO_BILLING_COLLECTION).doc(userId).get(),
		db.collection(PRO_ENTITLEMENT_COLLECTION).doc(userId).get()
	]);
	const ent = (entitlement.exists && entitlement.data()) || {};
	const customerId =
		asStripeCustomerId(billing.exists ? billing.data()?.stripe_customer_id : null) ||
		asStripeCustomerId(ent.stripe_customer_id);
	return { customerId, hasOwnSubscription: isLiveProGrant(ent) };
}

/** Create a Stripe Billing Portal session for a customer id read by `readProBillingState`. */
export async function createPortalSession(deps: StripeDeps, customerId: string, returnUrl: string): Promise<string> {
	const form = new URLSearchParams();
	form.set('customer', customerId);
	form.set('return_url', returnUrl);
	const session = await stripeCall(deps, 'POST', 'billing_portal/sessions', form);
	if (typeof session.url !== 'string' || !session.url) {
		throw new StripeApiError('POST', 'billing_portal/sessions', 200, 'no url in reply');
	}
	return session.url;
}
