import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeFirestore, fakeStripe } from '$lib/server/pro_billing.testkit';

const h = vi.hoisted(() => ({
	env: {} as Record<string, string | undefined>,
	db: null as any
}));

vi.mock('$env/dynamic/private', () => ({ env: h.env }));
vi.mock('$lib/server/firebase-admin', () => ({
	adminDb: {
		collection: (c: string) => h.db.collection(c),
		runTransaction: (fn: any) => h.db.runTransaction(fn)
	},
	adminAuth: { getUser: async () => ({ customClaims: {} }) },
	FieldValue: { serverTimestamp: () => 'SERVER_TS' }
}));

import { POST } from './+server';
import { TERMS_VERSION } from '$lib/constants/legal';

const ORIGIN = 'https://vetnotes.test';
const VET = { uid: 'u1', email: 'vet@example.test' };

function call(opts: { user?: { uid: string; email?: string }; body?: Record<string, unknown> } = {}) {
	return (POST as any)({
		request: new Request(`${ORIGIN}/api/pro/checkout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				return_path: '/pricing',
				accept_terms: true,
				terms_version: TERMS_VERSION,
				...(opts.body ?? {})
			})
		}),
		locals: { user: opts.user },
		url: new URL(`${ORIGIN}/api/pro/checkout`)
	}) as Promise<Response>;
}

/** A Stripe account with nothing on it: any customer may be created, no subscriptions, no open sessions. */
function emptyStripe(over: Parameters<typeof fakeStripe>[0] = {}) {
	return fakeStripe({
		'POST customers': { body: { id: 'cus_new' } },
		'GET subscriptions': { body: { data: [] } },
		'GET checkout/sessions': { body: { data: [] } },
		'POST checkout/sessions': { body: { id: 'cs_new', url: 'https://checkout.stripe.com/c/pay/cs_new' } },
		...over
	});
}

const posts = (stripe: ReturnType<typeof fakeStripe>, path: string) =>
	stripe.calls.filter((c) => c.method === 'POST' && c.path === path);

const openSession = {
	id: 'cs_open',
	mode: 'subscription',
	url: 'https://checkout.stripe.com/c/pay/cs_open',
	metadata: { product: 'vetnotes_pro', terms_version: '' } as Record<string, string>
};

const proSub = (over: Record<string, unknown> = {}) => ({
	id: 'sub_1',
	status: 'active',
	metadata: { product: 'vetnotes_pro', user_id: 'u1' },
	items: { data: [{ price: { id: 'price_pro' } }] },
	...over
});

describe('POST /api/pro/checkout — one customer, one subscription', () => {
	let errSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		for (const k of Object.keys(h.env)) delete h.env[k];
		h.env.STRIPE_SECRET_KEY = 'sk_test_x';
		h.env.VETNOTES_PRO_PRICE_ID = 'price_pro';
		h.db = fakeFirestore();
		errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		errSpy.mockRestore();
	});

	it('refuses a caller who is not signed in, without touching Stripe', async () => {
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);
		await expect(call({})).rejects.toMatchObject({ status: 401 });
		expect(stripe.calls).toHaveLength(0);
	});

	it('first checkout: creates ONE customer for the vet, stores it, and checks out as that customer', async () => {
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: VET });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ success: true, url: 'https://checkout.stripe.com/c/pay/cs_new', sessionId: 'cs_new' });

		const created = posts(stripe, 'customers');
		expect(created).toHaveLength(1);
		expect(created[0].form.get('email')).toBe('vet@example.test');
		expect(created[0].form.get('metadata[user_id]')).toBe('u1');
		expect(created[0].form.get('metadata[app_key]')).toBe('vetnotes');
		expect(created[0].headers['idempotency-key']).toBe('vetnotes-pro-customer-u1');

		expect(h.db.docs.get('vetnotes_pro_billing/u1')).toMatchObject({ stripe_customer_id: 'cus_new' });

		const session = posts(stripe, 'checkout/sessions')[0].form;
		expect(session.get('customer')).toBe('cus_new');
		// Stripe rejects `customer` together with `customer_email`.
		expect(session.get('customer_email')).toBeNull();
	});

	it('keeps everything the webhook and the shared Stripe account rely on', async () => {
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);
		await call({ user: VET });
		const f = posts(stripe, 'checkout/sessions')[0].form;
		expect(f.get('mode')).toBe('subscription');
		expect(f.get('line_items[0][price]')).toBe('price_pro');
		expect(f.get('client_reference_id')).toBe('u1');
		expect(f.get('metadata[user_id]')).toBe('u1');
		expect(f.get('metadata[product]')).toBe('vetnotes_pro');
		expect(f.get('metadata[app_key]')).toBe('vetnotes');
		expect(f.get('subscription_data[metadata][user_id]')).toBe('u1');
		expect(f.get('subscription_data[metadata][product]')).toBe('vetnotes_pro');
		expect(f.get('subscription_data[metadata][app_key]')).toBe('vetnotes');
		expect(f.get('success_url')).toBe(`${ORIGIN}/pricing?pro_paid=1`);
		expect(f.get('cancel_url')).toBe(`${ORIGIN}/pricing?pro_cancelled=1`);
	});

	it('second checkout: reuses the stored customer and creates no new one', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({ user: VET });
		expect(posts(stripe, 'customers')).toHaveLength(0);
		expect(posts(stripe, 'checkout/sessions')[0].form.get('customer')).toBe('cus_stored');
		expect(stripe.calls.find((c) => c.path === 'subscriptions')?.query.get('customer')).toBe('cus_stored');
	});

	it('a vet who subscribed before (customer known only from the webhook) keeps that customer', async () => {
		h.db = fakeFirestore({
			'vetnotes_pro_entitlements/u1': { active: false, revoked_reason: 'subscription_deleted', stripe_customer_id: 'cus_legacy' }
		});
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({ user: VET });
		expect(posts(stripe, 'customers')).toHaveLength(0);
		expect(posts(stripe, 'checkout/sessions')[0].form.get('customer')).toBe('cus_legacy');
		expect(h.db.docs.get('vetnotes_pro_billing/u1')).toMatchObject({ stripe_customer_id: 'cus_legacy' });
	});

	it('never takes the customer or the user from the request body', async () => {
		h.db = fakeFirestore({
			'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_mine' },
			'vetnotes_pro_billing/victim': { stripe_customer_id: 'cus_victim' }
		});
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({ user: VET, body: { customer: 'cus_victim', user_id: 'victim', uid: 'victim', client_reference_id: 'victim' } });
		const f = posts(stripe, 'checkout/sessions')[0].form;
		expect(f.get('customer')).toBe('cus_mine');
		expect(f.get('client_reference_id')).toBe('u1');
		expect(f.get('metadata[user_id]')).toBe('u1');
	});

	for (const status of ['active', 'trialing', 'past_due']) {
		it(`refuses a second checkout while a Pro subscription is ${status}, and points to the portal`, async () => {
			h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
			const stripe = emptyStripe({ 'GET subscriptions': { body: { data: [proSub({ status })] } } });
			vi.stubGlobal('fetch', stripe.fetchImpl);

			const res = await call({ user: VET });
			expect(res.status).toBe(409);
			expect(await res.json()).toMatchObject({ success: false, code: 'already_subscribed', manage: true });
			expect(posts(stripe, 'checkout/sessions')).toHaveLength(0);
		});
	}

	it('refuses on the Pro price too, even if the subscription carries no metadata', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({ 'GET subscriptions': { body: { data: [proSub({ metadata: {} })] } } });
		vi.stubGlobal('fetch', stripe.fetchImpl);
		expect((await call({ user: VET })).status).toBe(409);
	});

	it('a cancelled Pro subscription, or a live one for another product, does not block', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({
			'GET subscriptions': {
				body: {
					data: [
						proSub({ status: 'canceled' }),
						proSub({ id: 'sub_cpd', metadata: { product: 'cpd_pass' }, items: { data: [{ price: { id: 'price_cpd' } }] } })
					]
				}
			}
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);
		expect((await call({ user: VET })).status).toBe(200);
		expect(posts(stripe, 'checkout/sessions')).toHaveLength(1);
		expect(stripe.calls.find((c) => c.path === 'subscriptions')?.query.get('status')).toBe('all');
	});

	it('fails closed: if existing subscriptions cannot be read, no checkout is started', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({ 'GET subscriptions': { status: 500, body: { error: {} } } });
		vi.stubGlobal('fetch', stripe.fetchImpl);
		await expect(call({ user: VET })).rejects.toMatchObject({ status: 502 });
		expect(posts(stripe, 'checkout/sessions')).toHaveLength(0);
	});

	it('a checkout already open for this vet is resumed, not duplicated', async () => {
		openSession.metadata.terms_version = TERMS_VERSION;
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({
			'GET checkout/sessions': {
				body: {
					data: [
						{ id: 'cs_other', mode: 'payment', url: 'https://checkout.stripe.com/other', metadata: { product: 'cpd_pass' } },
						openSession
					]
				}
			}
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: VET });
		expect(await res.json()).toMatchObject({ success: true, url: 'https://checkout.stripe.com/c/pay/cs_open', sessionId: 'cs_open', resumed: true });
		expect(posts(stripe, 'checkout/sessions')).toHaveLength(0);
		const listed = stripe.calls.find((c) => c.method === 'GET' && c.path === 'checkout/sessions');
		expect(listed?.query.get('customer')).toBe('cus_stored');
		expect(listed?.query.get('status')).toBe('open');
	});

	it('two first checkouts at once end up on the same stored customer', async () => {
		// The other request stores its customer while ours is being created at Stripe.
		const stripe = emptyStripe({
			'POST customers': () => {
				h.db.docs.set('vetnotes_pro_billing/u1', { stripe_customer_id: 'cus_winner' });
				return { body: { id: 'cus_loser' } };
			}
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({ user: VET });
		expect(h.db.docs.get('vetnotes_pro_billing/u1')).toMatchObject({ stripe_customer_id: 'cus_winner' });
		expect(posts(stripe, 'checkout/sessions')[0].form.get('customer')).toBe('cus_winner');
	});

	it('answers 503 { configured: false } when Stripe is not configured', async () => {
		delete h.env.VETNOTES_PRO_PRICE_ID;
		const res = await call({ user: VET });
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ configured: false });
	});
});

describe('POST /api/pro/checkout — agreement to the Terms and Refund Policy', () => {
	let errSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		for (const k of Object.keys(h.env)) delete h.env[k];
		h.env.STRIPE_SECRET_KEY = 'sk_test_x';
		h.env.VETNOTES_PRO_PRICE_ID = 'price_pro';
		h.db = fakeFirestore();
		errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-27T04:05:06.000Z'));
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		errSpy.mockRestore();
	});

	for (const [label, body] of [
		['no flag', { accept_terms: undefined }],
		['false', { accept_terms: false }],
		['the string "true"', { accept_terms: 'true' }],
		['1', { accept_terms: 1 }]
	] as const) {
		it(`refuses to start a checkout without agreement (${label}), before anything is created`, async () => {
			const stripe = emptyStripe();
			vi.stubGlobal('fetch', stripe.fetchImpl);

			const res = await call({ user: VET, body: body as Record<string, unknown> });
			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ success: false, code: 'terms_not_accepted' });
			expect(stripe.calls).toHaveLength(0);
			expect(h.db.docs.size).toBe(0);
		});
	}

	it('refuses agreement to a version of the Terms that is not the current one', async () => {
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		for (const terms_version of ['some-older-version', undefined, 7]) {
			const res = await call({ user: VET, body: { terms_version } });
			expect(res.status).toBe(409);
			expect(await res.json()).toMatchObject({ success: false, code: 'terms_version_stale', terms_version: TERMS_VERSION });
		}
		expect(stripe.calls).toHaveLength(0);
	});

	it('records the version and the server time of agreement on the session, the subscription and the vet', async () => {
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		// A time sent by the browser is not trusted.
		await call({ user: VET, body: { terms_accepted_at: '1999-01-01T00:00:00.000Z' } });

		const f = posts(stripe, 'checkout/sessions')[0].form;
		expect(f.get('metadata[terms_version]')).toBe(TERMS_VERSION);
		expect(f.get('metadata[terms_accepted_at]')).toBe('2026-11-27T04:05:06.000Z');
		expect(f.get('subscription_data[metadata][terms_version]')).toBe(TERMS_VERSION);
		expect(f.get('subscription_data[metadata][terms_accepted_at]')).toBe('2026-11-27T04:05:06.000Z');

		expect(h.db.docs.get('vetnotes_pro_billing/u1')).toMatchObject({
			stripe_customer_id: 'cus_new',
			terms_version: TERMS_VERSION,
			terms_accepted_at: '2026-11-27T04:05:06.000Z',
			last_checkout_session_id: 'cs_new'
		});
	});

	it('still starts the checkout if the Firestore copy of the agreement cannot be written (Stripe holds it)', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const realCollection = h.db.collection;
		h.db.collection = (c: string) => {
			const col = realCollection(c);
			return {
				doc: (id: string) => ({
					...col.doc(id),
					set: async () => {
						throw new Error('firestore unavailable');
					}
				})
			};
		};
		const stripe = emptyStripe();
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: VET });
		expect(res.status).toBe(200);
		expect(posts(stripe, 'checkout/sessions')[0].form.get('metadata[terms_version]')).toBe(TERMS_VERSION);
	});

	it('an open checkout made under an older version of the Terms is expired and replaced', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({
			'GET checkout/sessions': {
				body: { data: [{ ...openSession, id: 'cs_old', metadata: { product: 'vetnotes_pro', terms_version: 'some-older-version' } }] }
			},
			'POST checkout/sessions/cs_old/expire': { body: { id: 'cs_old', status: 'expired' } }
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: VET });
		expect(await res.json()).toMatchObject({ success: true, sessionId: 'cs_new' });
		expect(posts(stripe, 'checkout/sessions/cs_old/expire')).toHaveLength(1);
		expect(posts(stripe, 'checkout/sessions')).toHaveLength(1);
	});

	it('if the older open checkout cannot be expired, no second one is opened', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({
			'GET checkout/sessions': {
				body: { data: [{ ...openSession, id: 'cs_old', metadata: { product: 'vetnotes_pro', terms_version: 'some-older-version' } }] }
			},
			'POST checkout/sessions/cs_old/expire': { status: 500, body: {} }
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await expect(call({ user: VET })).rejects.toMatchObject({ status: 502 });
		expect(posts(stripe, 'checkout/sessions')).toHaveLength(0);
	});

	it('resuming an open checkout records the new agreement for the vet', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_billing/u1': { stripe_customer_id: 'cus_stored' } });
		const stripe = emptyStripe({
			'GET checkout/sessions': {
				body: { data: [{ ...openSession, metadata: { product: 'vetnotes_pro', terms_version: TERMS_VERSION } }] }
			}
		});
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({ user: VET });
		expect(h.db.docs.get('vetnotes_pro_billing/u1')).toMatchObject({
			terms_version: TERMS_VERSION,
			terms_accepted_at: '2026-11-27T04:05:06.000Z',
			last_checkout_session_id: 'cs_open'
		});
	});
});
