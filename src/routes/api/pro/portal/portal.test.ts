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

const ORIGIN = 'https://vetnotes.test';

function call(opts: { user?: { uid: string; email?: string }; body?: unknown; query?: string } = {}) {
	return (POST as any)({
		request: new Request(`${ORIGIN}/api/pro/portal${opts.query ?? ''}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(opts.body ?? {})
		}),
		locals: { user: opts.user },
		url: new URL(`${ORIGIN}/api/pro/portal${opts.query ?? ''}`)
	}) as Promise<Response>;
}

const portalOk = { 'POST billing_portal/sessions': { body: { id: 'bps_1', url: 'https://billing.stripe.com/p/session/bps_1' } } };

describe('POST /api/pro/portal', () => {
	beforeEach(() => {
		for (const k of Object.keys(h.env)) delete h.env[k];
		h.env.STRIPE_SECRET_KEY = 'sk_test_x';
		h.db = fakeFirestore();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('refuses a caller who is not signed in, without touching Stripe', async () => {
		const stripe = fakeStripe(portalOk);
		vi.stubGlobal('fetch', stripe.fetchImpl);
		await expect(call({})).rejects.toMatchObject({ status: 401 });
		expect(stripe.calls).toHaveLength(0);
	});

	it("opens the portal for the caller's own stored customer", async () => {
		h.db = fakeFirestore({
			'vetnotes_pro_entitlements/u1': { active: true, stripe_customer_id: 'cus_mine' }
		});
		const stripe = fakeStripe(portalOk);
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: { uid: 'u1' } });
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ success: true, url: 'https://billing.stripe.com/p/session/bps_1' });

		expect(stripe.calls).toHaveLength(1);
		expect(stripe.calls[0].form.get('customer')).toBe('cus_mine');
		expect(stripe.calls[0].form.get('return_url')).toBe(`${ORIGIN}/pricing`);
		expect(stripe.calls[0].headers.authorization).toBe('Bearer sk_test_x');
	});

	it('never takes the customer from the request body or the query string', async () => {
		h.db = fakeFirestore({
			'vetnotes_pro_entitlements/u1': { active: true, stripe_customer_id: 'cus_mine' },
			'vetnotes_pro_entitlements/victim': { active: true, stripe_customer_id: 'cus_victim' }
		});
		const stripe = fakeStripe(portalOk);
		vi.stubGlobal('fetch', stripe.fetchImpl);

		await call({
			user: { uid: 'u1' },
			body: { customer: 'cus_victim', customer_id: 'cus_victim', user_id: 'victim', uid: 'victim' },
			query: '?customer=cus_victim&user_id=victim'
		});
		expect(stripe.calls).toHaveLength(1);
		expect(stripe.calls[0].form.get('customer')).toBe('cus_mine');
	});

	it('gives a clear 404 and creates nothing when no customer is stored', async () => {
		const stripe = fakeStripe(portalOk);
		vi.stubGlobal('fetch', stripe.fetchImpl);

		const res = await call({ user: { uid: 'u1', email: 'vet@example.test' }, body: { customer: 'cus_victim' } });
		expect(res.status).toBe(404);
		expect(await res.json()).toMatchObject({ success: false, code: 'no_billing_account' });
		expect(stripe.calls).toHaveLength(0);
		expect(h.db.docs.size).toBe(0);
	});

	it('ignores a stored value that is not a Stripe customer id', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_entitlements/u1': { stripe_customer_id: 'sub_123&expand[]=x' } });
		const stripe = fakeStripe(portalOk);
		vi.stubGlobal('fetch', stripe.fetchImpl);
		expect((await call({ user: { uid: 'u1' } })).status).toBe(404);
		expect(stripe.calls).toHaveLength(0);
	});

	it('answers 503 { configured: false } when Stripe is not configured', async () => {
		delete h.env.STRIPE_SECRET_KEY;
		const res = await call({ user: { uid: 'u1' } });
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ configured: false });
	});

	it('answers 502 when Stripe refuses (for example, the Customer Portal is not switched on)', async () => {
		h.db = fakeFirestore({ 'vetnotes_pro_entitlements/u1': { stripe_customer_id: 'cus_mine' } });
		const stripe = fakeStripe({ 'POST billing_portal/sessions': { status: 400, body: { error: { message: 'No configuration provided' } } } });
		vi.stubGlobal('fetch', stripe.fetchImpl);
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(call({ user: { uid: 'u1' } })).rejects.toMatchObject({ status: 502 });
		errSpy.mockRestore();
	});
});
