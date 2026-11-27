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
	/** Which record the customer id came from (see the header). */
	customerSource: 'billing' | 'entitlement' | null;
	/** True when the webhook has a live (active, not expired) VetNotes Pro grant for this user. */
	hasOwnSubscription: boolean;
}

/**
 * Read a user's billing state. `userId` MUST be the verified uid of the caller.
 */
export async function readProBillingState(db: BillingDb, userId: string): Promise<ProBillingState> {
	if (!userId) return { customerId: null, customerSource: null, hasOwnSubscription: false };
	const [billing, entitlement] = await Promise.all([
		db.collection(PRO_BILLING_COLLECTION).doc(userId).get(),
		db.collection(PRO_ENTITLEMENT_COLLECTION).doc(userId).get()
	]);
	const ent = (entitlement.exists && entitlement.data()) || {};
	const fromBilling = asStripeCustomerId(billing.exists ? billing.data()?.stripe_customer_id : null);
	const fromEntitlement = asStripeCustomerId(ent.stripe_customer_id);
	return {
		customerId: fromBilling || fromEntitlement,
		customerSource: fromBilling ? 'billing' : fromEntitlement ? 'entitlement' : null,
		hasOwnSubscription: isLiveProGrant(ent)
	};
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

/** `metadata.product` on every VetNotes Pro checkout session and subscription. */
export const PRO_PRODUCT = 'vetnotes_pro';

/**
 * The ONE Stripe customer for this user: the stored one, or a new one that is
 * stored before it is used.
 *
 * WHY: checkout used to send only `customer_email`, so Stripe made a brand-new
 * customer on every purchase. Nothing tied two purchases by the same vet
 * together, so nothing could stop a second subscription and a second monthly
 * charge. With one customer per user, Stripe itself can be asked "does this
 * vet already have Pro?" before a checkout starts, whether or not a webhook
 * has landed.
 *
 * `user.uid` MUST be the verified uid of the caller.
 */
export async function ensureStripeCustomer(
	db: FirebaseFirestore.Firestore,
	deps: StripeDeps,
	user: { uid: string; email?: string }
): Promise<string> {
	const state = await readProBillingState(db, user.uid);
	if (state.customerId && state.customerSource === 'billing') return state.customerId;

	let candidate = state.customerId; // a customer the webhook recorded before this record existed
	if (!candidate) {
		const form = new URLSearchParams();
		if (user.email) form.set('email', user.email);
		form.set('metadata[user_id]', user.uid);
		form.set('metadata[app_key]', 'vetnotes');
		/* The idempotency key makes a double-click or a retry within 24 hours
		   return the same customer instead of creating a second one. */
		const customer = await stripeCall(deps, 'POST', 'customers', form, {
			'Idempotency-Key': `vetnotes-pro-customer-${user.uid}`
		});
		candidate = asStripeCustomerId(customer.id);
		if (!candidate) throw new StripeApiError('POST', 'customers', 200, 'no customer id in reply');
	}

	// Store it. If another request stored one first, that one wins for both.
	const chosen = candidate;
	const ref = db.collection(PRO_BILLING_COLLECTION).doc(user.uid);
	return db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const existing = asStripeCustomerId(snap.exists ? snap.data()?.stripe_customer_id : null);
		if (existing) return existing;
		tx.set(
			ref,
			{
				stripe_customer_id: chosen,
				customer_source: state.customerId ? 'webhook_record' : 'checkout',
				customer_recorded_at: new Date().toISOString()
			},
			{ merge: true }
		);
		return chosen;
	});
}

/** Subscription states in which Stripe is still billing (or retrying) the customer. */
const LIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * The customer's live VetNotes Pro subscription, if there is one.
 *
 * Matched on the subscription's `metadata.product` or on the Pro price, so a
 * subscription to another product on this shared Stripe account is not mistaken
 * for Pro. Throws if Stripe cannot be asked: the caller must then refuse to
 * start a checkout rather than risk a second subscription.
 */
export async function findLiveProSubscription(
	deps: StripeDeps,
	customerId: string,
	proPriceId: string
): Promise<Record<string, any> | null> {
	const list = await stripeCall(
		deps,
		'GET',
		'subscriptions',
		new URLSearchParams({ customer: customerId, status: 'all', limit: '100' })
	);
	const subs: Record<string, any>[] = Array.isArray(list.data) ? list.data : [];
	return (
		subs.find((sub) => {
			if (!LIVE_SUBSCRIPTION_STATUSES.has(sub?.status)) return false;
			if (sub?.metadata?.product === PRO_PRODUCT) return true;
			const items: Record<string, any>[] = Array.isArray(sub?.items?.data) ? sub.items.data : [];
			return items.some((item) => item?.price?.id === proPriceId);
		}) ?? null
	);
}

/**
 * A VetNotes Pro checkout this customer already has open (for example in
 * another tab). Resuming it means two tabs lead to the same payment, not two.
 */
export async function findOpenProCheckout(
	deps: StripeDeps,
	customerId: string
): Promise<{ id: string; url: string; metadata: Record<string, string> } | null> {
	const list = await stripeCall(
		deps,
		'GET',
		'checkout/sessions',
		new URLSearchParams({ customer: customerId, status: 'open', limit: '20' })
	);
	const sessions: Record<string, any>[] = Array.isArray(list.data) ? list.data : [];
	const open = sessions.find(
		(s) =>
			s?.mode === 'subscription' &&
			s?.metadata?.product === PRO_PRODUCT &&
			typeof s?.id === 'string' &&
			typeof s?.url === 'string' &&
			s.url
	);
	return open ? { id: open.id, url: open.url, metadata: open.metadata || {} } : null;
}
