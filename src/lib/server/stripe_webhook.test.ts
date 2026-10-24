import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
	decideAction,
	firestoreStore,
	GRACE_SECONDS,
	handleEntitlementEvent,
	verifyStripeSignature,
	type HandleOptions,
	type StripeEvent
} from './stripe_webhook';

const PRO = new Set(['vetnotes_pro']);
const SECRET = 'whsec_test';

function sign(payload: string, t: number, secret = SECRET): string {
	return crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
}

function ev(type: string, object: Record<string, unknown>, created = 1_800_000_000, id = `evt_${type}_${created}`): StripeEvent {
	return { id, type, created, data: { object } };
}

const session = (over: Record<string, unknown> = {}) => ({
	id: 'cs_1',
	client_reference_id: 'u1',
	customer: 'cus_1',
	subscription: 'sub_1',
	payment_status: 'paid',
	metadata: { product: 'vetnotes_pro', user_id: 'u1' },
	...over
});

const sub = (over: Record<string, unknown> = {}) => ({
	id: 'sub_1',
	customer: 'cus_1',
	status: 'active',
	current_period_end: 1_802_000_000,
	metadata: { product: 'vetnotes_pro', user_id: 'u1' },
	...over
});

describe('verifyStripeSignature', () => {
	const payload = '{"id":"evt_1"}';
	const now = 1_800_000_000;

	it('accepts a valid signature and rejects a tampered body', () => {
		const header = `t=${now},v1=${sign(payload, now)}`;
		expect(verifyStripeSignature(payload, header, SECRET, now)).toBe(true);
		expect(verifyStripeSignature(payload + ' ', header, SECRET, now)).toBe(false);
	});

	it('accepts any of several v1 signatures (secret rotation)', () => {
		const header = `t=${now},v1=${sign(payload, now, 'whsec_old')},v1=${sign(payload, now)}`;
		expect(verifyStripeSignature(payload, header, SECRET, now)).toBe(true);
	});

	it('rejects a stale timestamp and a missing header', () => {
		const t = now - 301;
		expect(verifyStripeSignature(payload, `t=${t},v1=${sign(payload, t)}`, SECRET, now)).toBe(false);
		expect(verifyStripeSignature(payload, null, SECRET, now)).toBe(false);
	});
});

describe('decideAction', () => {
	it('grants on a paid checkout for this product', () => {
		const a = decideAction(ev('checkout.session.completed', session()), PRO);
		expect(a).toMatchObject({ kind: 'grant', userId: 'u1', expiresAt: null });
	});

	it('ignores other products on the shared account (the ebook incident)', () => {
		const a = decideAction(ev('checkout.session.completed', session({ metadata: { product: 'ebook', user_id: 'u1' } })), PRO);
		expect(a.kind).toBe('ignore');
	});

	it('does not grant an unpaid checkout; grants when the async payment succeeds', () => {
		expect(decideAction(ev('checkout.session.completed', session({ payment_status: 'unpaid' })), PRO).kind).toBe('ignore');
		expect(decideAction(ev('checkout.session.async_payment_succeeded', session()), PRO).kind).toBe('grant');
		expect(decideAction(ev('checkout.session.completed', session({ payment_status: 'no_payment_required' })), PRO).kind).toBe('grant');
	});

	it('sets expiry from the period end plus grace, old and new API shapes', () => {
		const old = decideAction(ev('customer.subscription.updated', sub()), PRO);
		expect(old).toMatchObject({ kind: 'grant', expiresAt: new Date((1_802_000_000 + GRACE_SECONDS) * 1000).toISOString() });
		const nu = decideAction(
			ev('customer.subscription.updated', sub({ current_period_end: undefined, items: { data: [{ current_period_end: 1_803_000_000 }] } })),
			PRO
		);
		expect(nu).toMatchObject({ expiresAt: new Date((1_803_000_000 + GRACE_SECONDS) * 1000).toISOString() });
	});

	it('revokes on cancel, unpaid and paused; keeps access while past_due', () => {
		expect(decideAction(ev('customer.subscription.deleted', sub()), PRO)).toMatchObject({ kind: 'revoke', reason: 'subscription_deleted' });
		for (const status of ['canceled', 'unpaid', 'incomplete_expired', 'paused']) {
			expect(decideAction(ev('customer.subscription.updated', sub({ status })), PRO).kind).toBe('revoke');
		}
		expect(decideAction(ev('customer.subscription.updated', sub({ status: 'past_due' })), PRO).kind).toBe('ignore');
	});

	it('sends full refunds and disputes to charge resolution; ignores partial refunds', () => {
		expect(decideAction(ev('charge.refunded', { id: 'ch_1', refunded: true }), PRO)).toMatchObject({ kind: 'resolve_charge', chargeId: 'ch_1' });
		expect(decideAction(ev('charge.refunded', { id: 'ch_1', refunded: false }), PRO).kind).toBe('ignore');
		expect(decideAction(ev('charge.dispute.created', { id: 'dp_1', charge: 'ch_2' }), PRO)).toMatchObject({ kind: 'resolve_charge', chargeId: 'ch_2' });
	});
});

/** Minimal in-memory Firestore: collection().doc(), runTransaction(get/create/set merge). */
function fakeDb() {
	const docs = new Map<string, Record<string, unknown>>();
	const ref = (c: string, id: string) => ({ path: `${c}/${id}` });
	const db = {
		docs,
		collection: (c: string) => ({ doc: (id: string) => ref(c, id) }),
		runTransaction: async <T>(fn: (tx: any) => Promise<T>) => {
			const writes: (() => void)[] = [];
			const tx = {
				get: async (r: { path: string }) => ({ exists: docs.has(r.path), data: () => docs.get(r.path) }),
				create: (r: { path: string }, data: Record<string, unknown>) =>
					writes.push(() => {
						if (docs.has(r.path)) throw new Error('already exists');
						docs.set(r.path, data);
					}),
				set: (r: { path: string }, data: Record<string, unknown>) =>
					writes.push(() => docs.set(r.path, { ...(docs.get(r.path) || {}), ...data }))
			};
			const out = await fn(tx);
			writes.forEach((w) => w());
			return out;
		}
	};
	return db;
}

function opts(db: ReturnType<typeof fakeDb>, extra: Partial<HandleOptions> = {}): HandleOptions {
	return {
		products: PRO,
		collection: 'vetnotes_pro_entitlements',
		store: firestoreStore(db as unknown as FirebaseFirestore.Firestore),
		grantFields: (a) => ({ active: true, expires_at: a.expiresAt }),
		revokeFields: (reason) => ({ active: false, revoked_reason: reason }),
		...extra
	};
}

describe('handleEntitlementEvent + firestoreStore', () => {
	it('applies once; a redelivered event is a no-op', async () => {
		const db = fakeDb();
		const e = ev('checkout.session.completed', session(), 100, 'evt_a');
		expect(await handleEntitlementEvent(e, opts(db))).toBe('grant applied');
		expect(await handleEntitlementEvent(e, opts(db))).toBe('grant duplicate');
		expect(db.docs.get('vetnotes_pro_entitlements/u1')).toMatchObject({ active: true, last_event_id: 'evt_a' });
	});

	it('a late checkout event cannot re-grant after cancellation', async () => {
		const db = fakeDb();
		await handleEntitlementEvent(ev('customer.subscription.deleted', sub(), 200, 'evt_del'), opts(db));
		const late = await handleEntitlementEvent(ev('checkout.session.completed', session(), 100, 'evt_old'), opts(db));
		expect(late).toBe('grant stale');
		expect(db.docs.get('vetnotes_pro_entitlements/u1')).toMatchObject({ active: false, revoked_reason: 'subscription_deleted' });
		expect(db.docs.get('stripe_webhook_events/evt_old')).toMatchObject({ outcome: 'stale' });
	});

	it('revokes on a full refund only after tying the charge to this product', async () => {
		const db = fakeDb();
		await handleEntitlementEvent(ev('checkout.session.completed', session(), 100, 'evt_buy'), opts(db));
		const fetchImpl = (async (url: string) => {
			if (url.endsWith('/invoices/in_1')) {
				return new Response(JSON.stringify({ parent: { subscription_details: { metadata: { product: 'vetnotes_pro', user_id: 'u1' } } } }));
			}
			return new Response('{}', { status: 404 });
		}) as unknown as typeof fetch;
		const refund = ev('charge.refunded', { id: 'ch_1', refunded: true, invoice: 'in_1' }, 300, 'evt_refund');
		expect(await handleEntitlementEvent(refund, opts(db, { stripeSecret: 'sk_test', fetchImpl }))).toBe('revoke applied');
		expect(db.docs.get('vetnotes_pro_entitlements/u1')).toMatchObject({ active: false, revoked_reason: 'refunded' });
	});

	it('never revokes for a refund on another product of the shared account', async () => {
		const db = fakeDb();
		const fetchImpl = (async () =>
			new Response(JSON.stringify({ metadata: { product: 'ebook', user_id: 'u1' } }))) as unknown as typeof fetch;
		const refund = ev('charge.refunded', { id: 'ch_9', refunded: true, payment_intent: 'pi_9' }, 300, 'evt_r9');
		const out = await handleEntitlementEvent(refund, opts(db, { stripeSecret: 'sk_test', fetchImpl }));
		expect(out).toMatch(/^ignored/);
		expect(db.docs.size).toBe(0);
	});

	it('logs and ignores a refund when it cannot look the charge up', async () => {
		const db = fakeDb();
		const out = await handleEntitlementEvent(ev('charge.refunded', { id: 'ch_1', refunded: true }), opts(db));
		expect(out).toMatch(/no STRIPE_SECRET_KEY/);
	});
});
