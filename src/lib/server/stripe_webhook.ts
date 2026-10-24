/**
 * Shared Stripe webhook logic for VetNotes Pro (`/api/pro/webhook`) and the CPD
 * Pass (`/api/cpd/webhook`). No `stripe` npm dependency, same as before.
 *
 * WHAT THIS ADDS OVER THE ORIGINAL HANDLERS (2026-10-24)
 * -------------------------------------------------------
 * - Dedupe: every event id is recorded in `stripe_webhook_events/{id}` inside the
 *   same transaction that changes the entitlement, so a redelivery is a no-op.
 * - Ordering: each entitlement remembers the `created` time of the last event
 *   applied; an older event (e.g. a late redelivery of checkout.session.completed
 *   after customer.subscription.deleted) can no longer re-grant.
 * - Paid check: a checkout session only grants when `payment_status` is `paid`
 *   (or `no_payment_required` for a trial). Delayed methods grant on
 *   `checkout.session.async_payment_succeeded`.
 * - Revocation: subscription status canceled/unpaid/incomplete_expired/paused,
 *   a full refund, or a dispute revokes. `past_due` keeps access while Stripe
 *   retries the card.
 * - Expiry: subscription events set `expires_at` to the period end + grace, so a
 *   missed cancellation event stops access on its own.
 *
 * The account is shared by five products, so a refund or dispute is only acted
 * on after resolving the charge's own metadata (invoice -> subscription metadata,
 * or the payment intent's metadata). Unknown product = ignore, never revoke.
 *
 * Stripe endpoint events needed for all of the above:
 *   checkout.session.completed, checkout.session.async_payment_succeeded,
 *   customer.subscription.created, customer.subscription.updated,
 *   customer.subscription.deleted, charge.refunded, charge.dispute.created
 */
import crypto from 'node:crypto';

const TOLERANCE_SECONDS = 300;
export const GRACE_SECONDS = 3 * 24 * 60 * 60;

/** Verify a `Stripe-Signature` header. Accepts any of several v1 signatures (secret rotation). */
export function verifyStripeSignature(
	payload: string,
	header: string | null,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
	if (!header) return false;
	let timestamp = '';
	const signatures: string[] = [];
	for (const kv of header.split(',')) {
		const i = kv.indexOf('=');
		if (i < 0) continue;
		const k = kv.slice(0, i).trim();
		const v = kv.slice(i + 1).trim();
		if (k === 't') timestamp = v;
		else if (k === 'v1') signatures.push(v);
	}
	if (!timestamp || signatures.length === 0) return false;

	// Reject stale timestamps to blunt replay attacks.
	const age = nowSeconds - Number(timestamp);
	if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) return false;

	const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex'));
	return signatures.some((sig) => {
		const b = Buffer.from(sig);
		return b.length === expected.length && crypto.timingSafeEqual(expected, b);
	});
}

export interface StripeEvent {
	id: string;
	type: string;
	created: number;
	data?: { object?: Record<string, any> };
}

export type EntitlementAction =
	| { kind: 'grant'; userId: string; expiresAt: string | null; meta: Record<string, string | null> }
	| { kind: 'revoke'; userId: string; reason: string }
	/** Refund/dispute: the charge must be resolved to its product before acting. */
	| { kind: 'resolve_charge'; chargeId: string; reason: string; charge?: Record<string, any> }
	| { kind: 'ignore'; why: string };

const REVOKE_STATUSES = new Set(['canceled', 'unpaid', 'incomplete_expired', 'paused']);
const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function periodEnd(sub: Record<string, any>): number | null {
	const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
	return typeof end === 'number' ? end : null;
}

function str(v: unknown): string | null {
	return typeof v === 'string' && v ? v : null;
}

/** Map a verified event to what should happen to the entitlement. Pure. */
export function decideAction(event: StripeEvent, products: ReadonlySet<string>): EntitlementAction {
	const obj = event.data?.object || {};

	switch (event.type) {
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded': {
			const userId = str(obj.client_reference_id) || str(obj.metadata?.user_id);
			if (!userId || !products.has(obj.metadata?.product)) return { kind: 'ignore', why: 'not this product' };
			if (obj.payment_status !== 'paid' && obj.payment_status !== 'no_payment_required') {
				return { kind: 'ignore', why: `payment_status ${obj.payment_status}` };
			}
			return {
				kind: 'grant',
				userId,
				// Subscriptions get a real expiry from customer.subscription.* events.
				expiresAt: null,
				meta: {
					source: 'stripe_checkout',
					plan: str(obj.metadata?.plan),
					stripeSessionId: str(obj.id),
					stripeCustomerId: str(obj.customer),
					stripeSubscriptionId: str(obj.subscription),
					email: str(obj.customer_details?.email) || str(obj.customer_email)
				}
			};
		}
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted': {
			const userId = str(obj.metadata?.user_id);
			if (!userId || !products.has(obj.metadata?.product)) return { kind: 'ignore', why: 'not this product' };
			if (event.type === 'customer.subscription.deleted') return { kind: 'revoke', userId, reason: 'subscription_deleted' };
			if (REVOKE_STATUSES.has(obj.status)) return { kind: 'revoke', userId, reason: `subscription_${obj.status}` };
			if (!ACTIVE_STATUSES.has(obj.status)) return { kind: 'ignore', why: `status ${obj.status}` };
			const end = periodEnd(obj);
			return {
				kind: 'grant',
				userId,
				expiresAt: end ? new Date((end + GRACE_SECONDS) * 1000).toISOString() : null,
				meta: {
					source: 'stripe_subscription',
					plan: str(obj.metadata?.plan),
					stripeCustomerId: str(obj.customer),
					stripeSubscriptionId: str(obj.id)
				}
			};
		}
		case 'charge.refunded':
			// Partial refunds keep access; only a full refund revokes.
			if (obj.refunded !== true) return { kind: 'ignore', why: 'partial refund' };
			return { kind: 'resolve_charge', chargeId: String(obj.id), reason: 'refunded', charge: obj };
		case 'charge.dispute.created':
			return { kind: 'resolve_charge', chargeId: String(obj.charge), reason: 'disputed' };
		default:
			return { kind: 'ignore', why: `unhandled ${event.type}` };
	}
}

type Fetch = typeof fetch;

async function stripeGet(path: string, secret: string, fetchImpl: Fetch): Promise<Record<string, any> | null> {
	const res = await fetchImpl(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${secret}` } });
	if (!res.ok) return null;
	return (await res.json()) as Record<string, any>;
}

/**
 * Find whose purchase a charge was: invoice -> subscription metadata, else the
 * payment intent's metadata. Returns null when it cannot be tied to a product.
 */
export async function resolveChargeMetadata(
	chargeId: string,
	secret: string,
	charge?: Record<string, any>,
	fetchImpl: Fetch = fetch
): Promise<{ user_id?: string; product?: string } | null> {
	const ch = charge ?? (await stripeGet(`charges/${encodeURIComponent(chargeId)}`, secret, fetchImpl));
	if (!ch) return null;

	const invoiceId = typeof ch.invoice === 'string' ? ch.invoice : ch.invoice?.id;
	if (invoiceId) {
		const inv = await stripeGet(`invoices/${encodeURIComponent(invoiceId)}`, secret, fetchImpl);
		const meta = inv?.parent?.subscription_details?.metadata ?? inv?.subscription_details?.metadata;
		if (meta?.product) return meta;
	}
	const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
	if (piId) {
		const pi = await stripeGet(`payment_intents/${encodeURIComponent(piId)}`, secret, fetchImpl);
		if (pi?.metadata?.product) return pi.metadata;
	}
	return null;
}

export interface EntitlementStore {
	/**
	 * Apply `fields` to `collection/userId` once per event id, and only if no newer
	 * event has already been applied to that entitlement.
	 */
	apply(
		collection: string,
		userId: string,
		event: StripeEvent,
		fields: Record<string, unknown>
	): Promise<'applied' | 'duplicate' | 'stale'>;
}

/** Firestore implementation (Admin SDK, one transaction per event). */
export function firestoreStore(db: FirebaseFirestore.Firestore): EntitlementStore {
	return {
		async apply(collection, userId, event, fields) {
			const ledger = db.collection('stripe_webhook_events').doc(event.id);
			const ent = db.collection(collection).doc(userId);
			return db.runTransaction(async (tx) => {
				const [seen, current] = await Promise.all([tx.get(ledger), tx.get(ent)]);
				if (seen.exists) return 'duplicate' as const;
				const last = current.data()?.last_event_created;
				const stale = typeof last === 'number' && last > event.created;
				tx.create(ledger, {
					type: event.type,
					created: event.created,
					collection,
					user_id: userId,
					outcome: stale ? 'stale' : 'applied',
					processed_at: new Date().toISOString()
				});
				if (stale) return 'stale' as const;
				tx.set(ent, { ...fields, last_event_id: event.id, last_event_created: event.created }, { merge: true });
				return 'applied' as const;
			});
		}
	};
}

export interface HandleOptions {
	products: ReadonlySet<string>;
	collection: string;
	store: EntitlementStore;
	grantFields: (a: Extract<EntitlementAction, { kind: 'grant' }>) => Record<string, unknown>;
	revokeFields: (reason: string) => Record<string, unknown>;
	/** STRIPE_SECRET_KEY, for resolving refunds/disputes. Without it they are logged and ignored. */
	stripeSecret?: string;
	fetchImpl?: Fetch;
}

/** Decide and apply one verified event. Returns a short outcome for logs/tests. */
export async function handleEntitlementEvent(event: StripeEvent, opts: HandleOptions): Promise<string> {
	let action = decideAction(event, opts.products);

	if (action.kind === 'resolve_charge') {
		if (!opts.stripeSecret) return `ignored: ${action.reason} charge, no STRIPE_SECRET_KEY to resolve it`;
		const meta = await resolveChargeMetadata(action.chargeId, opts.stripeSecret, action.charge, opts.fetchImpl);
		if (!meta?.user_id || !opts.products.has(meta.product ?? '')) return `ignored: ${action.reason} charge is not this product`;
		action = { kind: 'revoke', userId: meta.user_id, reason: action.reason };
	}

	if (action.kind === 'ignore') return `ignored: ${action.why}`;
	const fields = action.kind === 'grant' ? opts.grantFields(action) : opts.revokeFields(action.reason);
	const outcome = await opts.store.apply(opts.collection, action.userId, event, fields);
	return `${action.kind} ${outcome}`;
}
